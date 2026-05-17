import type { Group, Receipt } from './storage';

export interface Transaction {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: number;
}

export interface MemberBalance {
  memberId: string;
  name: string;
  paid: number;
  owed: number;
  net: number; // paid - owed (positive = creditor, negative = debtor)
}

/**
 * Calculates the exact balance sheet for all members in a given group,
 * taking into account all group receipts, item assignments, tax surcharges, and split types.
 */
export const calculateBalances = (group: Group, receipts: Receipt[], rates?: Record<string, number>): MemberBalance[] => {
  const groupReceipts = receipts.filter(r => r.groupId === group.id && !r.settledId);

  // Initialize balances for all group members
  const balances: Record<string, { paid: number; owed: number }> = {};
  group.members.forEach(m => {
    balances[m.id] = { paid: 0, owed: 0 };
  });

  groupReceipts.forEach(receipt => {
    // Conversion Logic: Amount in MYR = Foreign Amount / Rate
    const rate = (receipt.currency === 'MYR' || !rates) ? 1 : (rates[receipt.currency] || 1);
    const totalAmount = receipt.totalEntered / rate;
    const paidById = receipt.paidBy;

    // 1. Credit the payer with the full amount they spent
    // Robust Fallback: If the paidBy ID is invalid or not in group, resolve it to maintain double-entry parity (sum = 0)
    let resolvedPayerId = paidById;
    if (!balances[resolvedPayerId]) {
      const match = group.members.find(m => m.name === paidById || m.id === paidById);
      if (match) {
        resolvedPayerId = match.id;
      } else {
        resolvedPayerId = group.members[0]?.id || '';
      }
    }

    if (balances[resolvedPayerId]) {
      balances[resolvedPayerId].paid += totalAmount;
    }

    // 2. Calculate what each member owes for this receipt
    let taxMultiplier = 1.0;
    if (receipt.taxServiceCharge) taxMultiplier += 0.10;
    if (receipt.taxSst) taxMultiplier += 0.06;

    const members = group.members;
    const itemsList = receipt.items || [];
    const hasItemAssignments = itemsList.some(it => it.assignedTo && it.assignedTo.length > 0);

    if (receipt.splitType === 'percentage' && receipt.customSplits) {
      members.forEach(m => {
        const percent = receipt.customSplits?.[m.id] || 0;
        balances[m.id].owed += (percent / 100) * totalAmount;
      });
    } else if (receipt.splitType === 'custom' && receipt.customSplits) {
      members.forEach(m => {
        const val = receipt.customSplits?.[m.id] || 0;
        const valInMYR = val / rate;
        // If user entered subtotal prices, apply tax. Otherwise treat as final amount.
        balances[m.id].owed += receipt.customIncludesTax ? valInMYR : (valInMYR * taxMultiplier);
      });
    } else if (receipt.splitType === 'equal' && (receipt.forceGlobalEqual || !hasItemAssignments)) {
      // Pure global equal split (forced by user OR no items are assigned)
      const centShare = Math.floor((totalAmount / members.length) * 100) / 100;
      let allocatedSoFar = 0;
      members.forEach((m, idx) => {
        if (idx === members.length - 1) {
          balances[m.id].owed += Number((totalAmount - allocatedSoFar).toFixed(2));
        } else {
          balances[m.id].owed += centShare;
          allocatedSoFar = Number((allocatedSoFar + centShare).toFixed(2));
        }
      });
    } else {
      // Itemized split (default if 'equal' with assignments, or fallback)
      const itemShareBase: Record<string, number> = {};
      members.forEach(m => { itemShareBase[m.id] = 0; });

      let itemShareBaseSum = 0;
      itemsList.forEach(item => {
        const assignees = item.assignedTo || [];
        if (assignees.length > 0) {
          const perAssigneeShare = item.price / assignees.length;
          itemShareBaseSum += item.price;
          assignees.forEach(memberId => {
            if (itemShareBase[memberId] !== undefined) {
              itemShareBase[memberId] += perAssigneeShare;
            }
          });
        }
      });

      // If nothing is assigned (edge case), fallback to equal
      if (itemShareBaseSum === 0) {
        const centShare = Math.floor((totalAmount / members.length) * 100) / 100;
        let allocatedSoFar = 0;
        members.forEach((m, idx) => {
          if (idx === members.length - 1) {
            balances[m.id].owed += Number((totalAmount - allocatedSoFar).toFixed(2));
          } else {
            balances[m.id].owed += centShare;
            allocatedSoFar = Number((allocatedSoFar + centShare).toFixed(2));
          }
        });
      } else {
        const flatTax = receipt.flatTax || 0;
        const calculatedTotalWithTax = (itemShareBaseSum * taxMultiplier) + flatTax;
        const adjustmentFactor = calculatedTotalWithTax > 0 ? (totalAmount / calculatedTotalWithTax) : 1;

        // Only members with non-zero base shares should participate in rounding adjustments
        const participatingMemberIds = members.filter(m => itemShareBase[m.id] > 0).map(m => m.id);
        let allocatedSoFar = 0;

        participatingMemberIds.forEach((mId, idx) => {
          if (idx === participatingMemberIds.length - 1) {
            balances[mId].owed += Number((totalAmount - allocatedSoFar).toFixed(2));
          } else {
            const share = Number(((itemShareBase[mId] * taxMultiplier + (itemShareBase[mId] / itemShareBaseSum) * flatTax) * adjustmentFactor).toFixed(2));
            balances[mId].owed += share;
            allocatedSoFar = Number((allocatedSoFar + share).toFixed(2));
          }
        });
      }
    }
  });

  // Map balances record back to a clean list of MemberBalance structures
  return group.members.map(m => {
    const record = balances[m.id] || { paid: 0, owed: 0 };
    return {
      memberId: m.id,
      name: m.name,
      paid: Number(record.paid.toFixed(2)),
      owed: Number(record.owed.toFixed(2)),
      net: Number((record.paid - record.owed).toFixed(2)),
    };
  });
};

/**
 * "Onz!" Greedy Debt-Minimization Algorithm
 * 
 * Objective: Convert arbitrary multi-lateral debts into the absolute minimum number
 * of transfers required to settle everyone's balances.
 * 
 * How it works:
 * 1. Filter out members who already have a net balance of ~0 (within a 0.01 cent margin).
 * 2. Separate members into:
 *    - Creditors: those who paid more than they owe (Net Balance > 0)
 *    - Debtors: those who owe more than they paid (Net Balance < 0)
 * 3. Sort both lists in descending order of absolute magnitudes:
 *    - Creditors are sorted so the person owed the largest sum is at the top.
 *    - Debtors are sorted so the person owing the largest sum is at the top.
 * 4. Greedily match the largest debtor with the largest creditor:
 *    - Determine settlement transaction: amount = Math.min(-debtor.balance, creditor.balance)
 *    - Create the transaction record.
 *    - Deduct the amount from both parties' balances.
 *    - If a party is fully settled (balance ≈ 0), remove them from their list.
 * 5. Re-sort the active creditor and debtor lists and repeat the process until all 
 *    balances are fully reconciled.
 * 
 * Why this is highly optimal:
 * By always matching the extreme ends of the ledger (largest debtor to largest creditor),
 * we eliminate high-volume, cascading transfers (e.g. A owes B, B owes C, C owes D). 
 * This reduces a potentially complex network of N*(N-1) transfers down to a maximum 
 * of N-1 elegant, direct transfers!
 */
export const runOnzAlgorithm = (
  balances: MemberBalance[],
  roundingMode: 'mamak' | 'precise' = 'precise'
): Transaction[] => {
  const transactions: Transaction[] = [];

  // 1. Setup lists of debtors and creditors with non-zero balances
  let debtors = balances
    .filter(b => b.net < -0.01)
    .map(b => ({ id: b.memberId, name: b.name, balance: b.net })); // balance is negative

  let creditors = balances
    .filter(b => b.net > 0.01)
    .map(b => ({ id: b.memberId, name: b.name, balance: b.net })); // balance is positive

  // 2. Run greedy matching loop
  while (debtors.length > 0 && creditors.length > 0) {
    // Sort so largest absolute values are at index 0
    debtors.sort((a, b) => a.balance - b.balance); // More negative (e.g., -50 before -10)
    creditors.sort((a, b) => b.balance - a.balance); // More positive (e.g., 50 before 10)

    const debtor = debtors[0];
    const creditor = creditors[0];

    // Find transaction value
    const oweAmount = -debtor.balance;
    const receiveAmount = creditor.balance;
    const transferAmount = Math.min(oweAmount, receiveAmount);

    // Format transaction value
    let finalAmount = Number(transferAmount.toFixed(2));

    if (roundingMode === 'mamak') {
      // Round to nearest 0.05
      finalAmount = Math.round(finalAmount * 20) / 20;
    }

    if (finalAmount > 0) {
      transactions.push({
        fromId: debtor.id,
        fromName: debtor.name,
        toId: creditor.id,
        toName: creditor.name,
        amount: finalAmount,
      });
    }

    // Update balances
    debtor.balance += finalAmount;
    creditor.balance -= finalAmount;

    // Filter out settled participants
    debtors = debtors.filter(d => d.balance < -0.01);
    creditors = creditors.filter(c => c.balance > 0.01);
  }

  return transactions;
};
export default runOnzAlgorithm;

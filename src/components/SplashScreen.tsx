import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getSettings } from '../utils/storage';
import { getRandomQuote } from '../utils/quotes';

export const SplashScreen: React.FC = () => {
  const isLightTheme = getSettings().theme === 'light';
  const [quote, setQuote] = useState('');

  useEffect(() => {
    setQuote(getRandomQuote());
  }, []);

  return (
    <motion.div 
      className="splash-screen"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.5, ease: "easeInOut" } }}
    >
      <div className="splash-content">
        <motion.div 
          className="splash-logo-wrapper"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ 
            scale: [0.5, 1.1, 1],
            opacity: 1 
          }}
          transition={{ 
            duration: 0.8,
            ease: "backOut"
          }}
        >
          <div className="splash-glow" />
          <img 
            src="/logo.png" 
            alt="OnzSplit Logo" 
            style={{ 
              height: '140px', 
              width: '140px', 
              objectFit: 'cover',
              borderRadius: '50%',
              mixBlendMode: isLightTheme ? 'normal' : 'lighten',
              filter: isLightTheme 
                ? 'invert(1) hue-rotate(180deg) brightness(1.1)' 
                : 'drop-shadow(0 0 30px var(--electric-mint-glow))'
            }} 
          />
        </motion.div>
        
        <motion.div 
          className="splash-text-wrapper"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          <h1 className="splash-title">SplitOnz</h1>
          <p className="splash-subtitle" style={{ fontStyle: 'italic', opacity: 0.9, maxWidth: '280px', margin: '8px auto 0 auto', fontSize: '13px', lineHeight: '1.4' }}>
            "{quote}"
          </p>
        </motion.div>
        
        <motion.div 
          className="splash-loader"
          initial={{ width: 0 }}
          animate={{ width: "120px" }}
          transition={{ delay: 0.6, duration: 1.2, ease: "easeInOut" }}
        />
      </div>
    </motion.div>
  );
};

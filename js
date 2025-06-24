// Файл: currencySlice.js
import { createSlice } from '@reduxjs/toolkit';

const currencySlice = createSlice({
  name: 'currency',
  initialState: {
    balance: localStorage.getItem('gCoinsBalance') 
             ? parseInt(localStorage.getItem('gCoinsBalance')) 
             : 100, // Стартовый баланс
    transactions: [] // История операций
  },
  reducers: {
    addCoins: (state, action) => {
      state.balance += action.payload.amount;
      state.transactions.push({
        type: 'credit',
        amount: action.payload.amount,
        source: action.payload.source,
        timestamp: new Date().toISOString()
      });
      localStorage.setItem('gCoinsBalance', state.balance);
    },
    deductCoins: (state, action) => {
      const newBalance = state.balance - action.payload.amount;
      state.balance = Math.max(0, newBalance);
      state.transactions.push({
        type: 'debit',
        amount: action.payload.amount,
        reason: action.payload.reason,
        timestamp: new Date().toISOString()
      });
      localStorage.setItem('gCoinsBalance', state.balance);
    },
    resetCurrency: (state) => {
      state.balance = 100;
      state.transactions = [];
      localStorage.removeItem('gCoinsBalance');
    }
  }
});

export const { addCoins, deductCoins, resetCurrency } = currencySlice.actions;
export default currencySlice.reducer;

// Файл: CurrencyDisplay.jsx
import React from 'react';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';

const CurrencyDisplay = () => {
  const balance = useSelector(state => state.currency.balance);
  const [pulse, setPulse] = React.useState(false);
  
  // Анимация при изменении баланса
  React.useEffect(() => {
    setPulse(true);
    const timer = setTimeout(() => setPulse(false), 500);
    return () => clearTimeout(timer);
  }, [balance]);

  return (
    <motion.div 
      className="currency-display"
      animate={{ scale: pulse ? 1.2 : 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="coin-icon">
        <img src="/assets/g-coin.png" alt="G-Coin" />
      </div>
      <div className="balance">
        {balance.toLocaleString()}
      </div>
      <div className="currency-name">G-Coins</div>
    </motion.div>
  );
};

export default CurrencyDisplay;
// Файл: dailyRewardsSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { isToday, isYesterday, differenceInDays } from 'date-fns';

export const checkDailyReward = createAsyncThunk(
  'dailyRewards/check',
  async (_, { getState }) => {
    const { lastLogin, streak, claimedToday } = getState().dailyRewards;
    const today = new Date();
    
    // Первый вход пользователя
    if (!lastLogin) {
      return { 
        newStreak: 1, 
        lastLogin: today, 
        claimedToday: false,
        rewardAvailable: true
      };
    }
    
    const lastLoginDate = new Date(lastLogin);
    const daysSinceLastLogin = differenceInDays(today, lastLoginDate);
    
    // Пользователь уже заходил сегодня
    if (isToday(lastLoginDate)) {
      return { 
        rewardAvailable: !claimedToday,
        claimedToday,
        streak
      };
    }
    
    // Последовательный вход (вчера)
    if (isYesterday(lastLoginDate)) {
      return { 
        newStreak: streak + 1, 
        lastLogin: today, 
        claimedToday: false,
        rewardAvailable: true
      };
    }
    
    // Перерыв более одного дня
    return { 
      newStreak: 1, 
      lastLogin: today, 
      claimedToday: false,
      rewardAvailable: true
    };
  }
);

const dailyRewardsSlice = createSlice({
  name: 'dailyRewards',
  initialState: {
    streak: 0,
    lastLogin: null,
    claimedToday: false,
    rewardSchedule: [10, 20, 30, 50, 80, 120, 200],
    maxStreak: 7
  },
  reducers: {
    claimReward: (state) => {
      state.claimedToday = true;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(checkDailyReward.fulfilled, (state, action) => {
      if (action.payload.newStreak) {
        state.streak = action.payload.newStreak;
      }
      if (action.payload.lastLogin) {
        state.lastLogin = action.payload.lastLogin.toISOString();
      }
      if (action.payload.claimedToday !== undefined) {
        state.claimedToday = action.payload.claimedToday;
      }
    });
  }
});

export const { claimReward } = dailyRewardsSlice.actions;
export default dailyRewardsSlice.reducer;
// Файл: DailyRewardsPopup.jsx
import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { checkDailyReward, claimReward } from '../store/dailyRewardsSlice';
import { addCoins } from '../store/currencySlice';

const DailyRewardsPopup = () => {
  const dispatch = useDispatch();
  const { 
    streak, 
    claimedToday, 
    rewardSchedule, 
    maxStreak 
  } = useSelector(state => state.dailyRewards);
  
  const [showPopup, setShowPopup] = React.useState(false);

  useEffect(() => {
    dispatch(checkDailyReward()).then((action) => {
      if (action.payload?.rewardAvailable) {
        setShowPopup(true);
      }
    });
  }, [dispatch]);

  const handleClaim = () => {
    const rewardAmount = rewardSchedule[Math.min(streak - 1, maxStreak - 1)];
    dispatch(claimReward());
    dispatch(addCoins({ amount: rewardAmount, source: 'daily_reward' }));
    setShowPopup(false);
  };

  if (!showPopup) return null;

  return (
    <div className="overlay">
      <div className="daily-rewards-popup">
        <h2>Ваша ежедневная награда!</h2>
        <div className="streak-container">
          <div className="streak-count">День {streak}</div>
          <div className="streak-bar">
            {Array.from({ length: maxStreak }).map((_, index) => (
              <div 
                key={index} 
                className={`streak-dot ${index < streak ? 'active' : ''}`}
              />
            ))}
          </div>
        </div>
        
        <div className="reward-amount">
          +{rewardSchedule[streak - 1]} 
          <img src="/assets/g-coin-large.png" alt="G-Coins" />
        </div>
        
        <p className="info-text">
          Возвращайтесь завтра, чтобы получить {streak < maxStreak ? 
          rewardSchedule[streak] : rewardSchedule[0]} G-Coins!
        </p>
        
        <div className="calendar-grid">
          {rewardSchedule.map((amount, index) => (
            <div 
              key={index} 
              className={`calendar-day ${index < streak ? 'claimed' : ''}`}
            >
              <div className="day-number">День {index + 1}</div>
              <div className="day-reward">
                <img src="/assets/g-coin-small.png" alt="Coin" />
                {amount}
              </div>
            </div>
          ))}
        </div>
        
        <button className="claim-button" onClick={handleClaim}>
          Получить награду
        </button>
      </div>
    </div>
  );
};

export default DailyRewardsPopup;
// Файл: gameProgressSlice.js
import { createSlice } from '@reduxjs/toolkit';
import { addCoins } from './currencySlice';

const gameProgressSlice = createSlice({
  name: 'gameProgress',
  initialState: {
    completedLevels: {},
    currentLevel: 1
  },
  reducers: {
    completeLevel: {
      reducer: (state, action) => {
        const { levelId, baseReward, bonus } = action.payload;
        state.completedLevels[levelId] = {
          completionDate: new Date().toISOString(),
          reward: baseReward + bonus
        };
      },
      prepare: (levelId, baseReward, bonus = 0) => {
        return {
          payload: { levelId, baseReward, bonus },
          meta: { coinsToAdd: baseReward + bonus }
        };
      }
    },
    setCurrentLevel: (state, action) => {
      state.currentLevel = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(completeLevel, (state, action) => {
      const coinsToAdd = action.meta?.coinsToAdd || 0;
      if (coinsToAdd > 0) {
        // Автоматическое начисление валюты при завершении уровня
        addCoins({ amount: coinsToAdd, source: `level_${action.payload.levelId}` });
      }
    });
  }
});

export const { completeLevel, setCurrentLevel } = gameProgressSlice.actions;
export default gameProgressSlice.reducer;
// Файл: LevelRewardPopup.jsx
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';

const LevelRewardPopup = ({ levelId, baseReward, bonus }) => {
  const [visible, setVisible] = useState(true);
  const [coinsAnimated, setCoinsAnimated] = useState(false);
  const dispatch = useDispatch();
  
  const totalReward = baseReward + bonus;
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setCoinsAnimated(true);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);
  
  const handleContinue = () => {
    setVisible(false);
    // Дополнительные действия после закрытия попапа
  };
  
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="level-reward-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div 
            className="level-reward-popup"
            initial={{ scale: 0.8, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: 'spring', damping: 15 }}
          >
            <h2>Уровень {levelId} пройден!</h2>
            
            <div className="reward-breakdown">
              <div className="reward-item">
                <span>Базовая награда:</span>
                <div className="coin-reward">
                  +{baseReward} <img src="/assets/g-coin.png" alt="G-Coin" />
                </div>
              </div>
              
              {bonus > 0 && (
                <motion.div 
                  className="reward-item"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <span>Бонус за идеальное прохождение:</span>
                  <div className="coin-reward bonus">
                    +{bonus} <img src="/assets/g-

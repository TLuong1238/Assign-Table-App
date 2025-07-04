// constants/paymentConfig.js
export const PAYMENT_CONFIG = {
  // ✅ Deposit Settings
  DEPOSIT_PERCENTAGE: 0.3,
  MIN_DEPOSIT_AMOUNT: 50000,
  MAX_DEPOSIT_AMOUNT: 5000000,
  TABLE_DEPOSIT: 30000,
  
  // ✅ Payment Types
  PAYMENT_TYPES: {
    DEPOSIT: 'deposit',
    FULL: 'full',
    COUNTER: 'counter'
  },
  
  // ✅ Payment Methods
  PAYMENT_METHODS: {
    VNPAY: 'vnpay',
    COUNTER: 'counter',
    CASH: 'cash',
    VIP: 'vip'
  },
  
  // ✅ Payment Status
  PAYMENT_STATUS: {
    PENDING: 'pending',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled'
  },
  
  // ✅ Bill Payment Status - THÊM TRẠNG THÁI MỚI
  BILL_PAYMENT_STATUS: {
    PENDING: 'pending',
    DEPOSIT_PAID: 'deposit_paid',
    FULLY_PAID: 'fully_paid',
    COUNTER_PAYMENT: 'counter_payment',
    PENDING_COUNTER: 'pending_counter',    
    DEPOSIT_VIP: 'deposit_vip'
  },
  
  // ✅ VIP Settings
  VIP_CONFIG: {
    ROLE: 'vip',
    DEPOSIT_AMOUNT: 0,
    PAYMENT_STATUS: 'deposit_paid',
    PAYMENT_METHOD: 'vip'
  },
  
  // ✅ ORDER ID Settings
  ORDER_ID_PREFIX: 'BUNCHAO_',
  ORDER_ID_LENGTH: 20,
  
  // ✅ Timeout Settings
  PAYMENT_TIMEOUT: 15 * 60 * 1000,
  VNPAY_TIMEOUT: 15,
  
  // ✅ Currency
  CURRENCY: {
    CODE: 'VND',
    SYMBOL: 'đ',
    LOCALE: 'vi-VN'
  }
};

// ✅ Helper Functions
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat(PAYMENT_CONFIG.CURRENCY.LOCALE).format(amount);
};

export const calculateDepositAmount = (totalAmount, hasFood = false, isVip = false) => {
  if (isVip) {
    return PAYMENT_CONFIG.VIP_CONFIG.DEPOSIT_AMOUNT;
  }
  
  if (!hasFood || totalAmount === 0) {
    return PAYMENT_CONFIG.TABLE_DEPOSIT;
  }
  
  const depositAmount = Math.round(totalAmount * PAYMENT_CONFIG.DEPOSIT_PERCENTAGE);
  return Math.max(
    PAYMENT_CONFIG.MIN_DEPOSIT_AMOUNT, 
    Math.min(depositAmount, PAYMENT_CONFIG.MAX_DEPOSIT_AMOUNT)
  );
};

export const generateOrderId = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${PAYMENT_CONFIG.ORDER_ID_PREFIX}${timestamp}_${random}`;
};

export const isVipUser = (user) => {
  return user?.role === PAYMENT_CONFIG.VIP_CONFIG.ROLE;
};

export const getVipBillData = (baseData) => ({
  ...baseData,
  payment_status: PAYMENT_CONFIG.VIP_CONFIG.PAYMENT_STATUS,
  payment_method: PAYMENT_CONFIG.VIP_CONFIG.PAYMENT_METHOD,
  deposit_amount: PAYMENT_CONFIG.VIP_CONFIG.DEPOSIT_AMOUNT
});

export const getPaymentAmountInfo = (cartPrice, hasFood, isVip) => {
  const totalAmount = cartPrice || 0;
  const depositAmount = calculateDepositAmount(totalAmount, hasFood, isVip);
  
  return {
    totalAmount,
    depositAmount,
    remainingAmount: totalAmount - depositAmount,
    hasFood,
    isVip,
    isTableBookingOnly: !hasFood
  };
};
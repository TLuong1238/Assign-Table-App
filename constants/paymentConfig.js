// constants/paymentConfig.js
export const PAYMENT_CONFIG = {
  // ✅ Deposit Settings
  DEPOSIT_PERCENTAGE: 0.3,        // 30% cọc
  MIN_DEPOSIT_AMOUNT: 50000,      // Cọc tối thiểu 50k
  MAX_DEPOSIT_AMOUNT: 5000000,    // Cọc tối đa 5 triệu
  
  // ✅ Payment Types
  PAYMENT_TYPES: {
    DEPOSIT: 'deposit',           // Thanh toán cọc
    FULL: 'full',                // Thanh toán đầy đủ
    COUNTER: 'counter'           // Thanh toán tại quầy
  },
  
  // ✅ Payment Methods
  PAYMENT_METHODS: {
    VNPAY: 'vnpay',              // VNPay
    COUNTER: 'counter',          // Tại quầy
    CASH: 'cash'                 // Tiền mặt
  },
  
  // ✅ Payment Status
  PAYMENT_STATUS: {
    PENDING: 'pending',          // Chờ thanh toán
    PROCESSING: 'processing',    // Đang xử lý
    COMPLETED: 'completed',      // Hoàn thành
    FAILED: 'failed',           // Thất bại
    CANCELLED: 'cancelled'       // Đã hủy
  },
  
  // ✅ Bill Payment Status
  BILL_PAYMENT_STATUS: {
    PENDING: 'pending',          // Chờ thanh toán
    DEPOSIT_PAID: 'deposit_paid', // Đã cọc
    FULLY_PAID: 'fully_paid',    // Đã thanh toán đầy đủ
    COUNTER_PAYMENT: 'counter_payment' // Thanh toán tại quầy
  },
  
  // ✅ Order ID Settings
  ORDER_ID_PREFIX: 'BUNCHAO_',   // Prefix cho order ID
  ORDER_ID_LENGTH: 20,           // Độ dài order ID
  
  // ✅ Timeout Settings
  PAYMENT_TIMEOUT: 15 * 60 * 1000, // 15 phút timeout
  VNPAY_TIMEOUT: 15,              // 15 phút cho VNPay
  
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

export const calculateDepositAmount = (totalAmount) => {
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
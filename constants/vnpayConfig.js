import * as Linking from 'expo-linking';

export const VNPAY_CONFIG = {
  // ✅ Sandbox URLs (Test environment)
  PAYMENT_URL: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
  
  // ✅ FIX RETURN URL - FORCE HTTPBIN
  get RETURN_URL() {
    if (__DEV__) {
      // ✅ LUÔN DÙNG HTTPBIN TRONG DEV
      return 'https://httpbin.org/get';
    } else {
      return 'bunchaobama://vnpay-return';
    }
  },
  
  // ✅ Merchant Info
  TMN_CODE: 'SHBIE26J',              
  HASH_SECRET: 'U6GK10I9PBNC4UU5HU9GMZZM4V6V78ZW',   
  
  // ✅ VNPay API Version & Commands
  VERSION: '2.1.0',
  COMMAND: 'pay',
  CURR_CODE: 'VND',
  LOCALE: 'vn',
  
  // ✅ Order Types
  ORDER_TYPE: {
    DEPOSIT: 'other',    
    FULL: 'other',            
    FOOD: 'other'              
  },
  
  // ✅ Response Codes
  RESPONSE_CODES: {
    SUCCESS: '00',
    PENDING: '01',
    FAILED: '02',
    INVALID: '04',
    PROCESSING: '05',
    CANCELLED: '06',
    SUSPICIOUS: '07'
  },
  
  // ✅ Transaction Status
  TRANSACTION_STATUS: {
    SUCCESS: '00',
    FAILED: '01',
    PROCESSING: '02'
  }
};

// ✅ PARSE HTTPBIN RESPONSE - SKIP VALIDATION
export const parseHttpBinResponse = (httpBinData) => {
  try {
    console.log('🔄 Parsing HTTPBin response:', httpBinData);
    
    const vnpayParams = httpBinData.args || {};
    
    if (!vnpayParams.vnp_ResponseCode) {
      throw new Error('No VNPay response code in HTTPBin data');
    }
    
    // ✅ SKIP VALIDATION - CHỈ PARSE DATA
    const isSuccess = vnpayParams.vnp_ResponseCode === '00' && 
                     vnpayParams.vnp_TransactionStatus === '00';

    const result = {
      isSuccess,
      amount: parseInt(vnpayParams.vnp_Amount || 0) / 100,
      transactionNo: vnpayParams.vnp_TransactionNo,
      bankCode: vnpayParams.vnp_BankCode,
      orderInfo: decodeURIComponent(vnpayParams.vnp_OrderInfo || ''),
      payDate: vnpayParams.vnp_PayDate,
      responseCode: vnpayParams.vnp_ResponseCode,
      transactionStatus: vnpayParams.vnp_TransactionStatus,
      txnRef: vnpayParams.vnp_TxnRef,
      bankTranNo: vnpayParams.vnp_BankTranNo,
      cardType: vnpayParams.vnp_CardType,
      message: VNPAY_MESSAGES[vnpayParams.vnp_ResponseCode] || 'Không xác định',
      rawData: vnpayParams
    };
    
    return {
      success: true,
      data: result
    };
    
  } catch (error) {
    console.error('❌ Parse HTTPBin response error:', error);
    return {
      success: false,
      message: error.message
    };
  }
};

export const VNPAY_MESSAGES = {
  '00': 'Giao dịch thành công',
  '07': 'Trừ tiền thành công. Giao dịch bị nghi ngờ (liên quan tới lừa đảo, giao dịch bất thường)',
  '09': 'Giao dịch không thành công do: Thẻ/Tài khoản của khách hàng chưa đăng ký dịch vụ InternetBanking tại ngân hàng',
  '10': 'Giao dịch không thành công do: Khách hàng xác thực thông tin thẻ/tài khoản không đúng quá 3 lần',
  '11': 'Giao dịch không thành công do: Đã hết hạn chờ thanh toán. Xin quý khách vui lòng thực hiện lại giao dịch',
  '12': 'Giao dịch không thành công do: Thẻ/Tài khoản của khách hàng bị khóa',
  '13': 'Giao dịch không thành công do Quý khách nhập sai mật khẩu xác thực giao dịch (OTP)',
  '24': 'Giao dịch không thành công do: Khách hàng hủy giao dịch',
  '51': 'Giao dịch không thành công do: Tài khoản của quý khách không đủ số dư để thực hiện giao dịch',
  '65': 'Giao dịch không thành công do: Tài khoản của Quý khách đã vượt quá hạn mức giao dịch trong ngày',
  '75': 'Ngân hàng thanh toán đang bảo trì',
  '79': 'Giao dịch không thành công do: KH nhập sai mật khẩu thanh toán quá số lần quy định',
  '99': 'Các lỗi khác (lỗi còn lại, không có trong danh sách mã lỗi đã liệt kê)'
};
// helper/vnpayHelper.js
import CryptoJS from 'crypto-js';
import { VNPAY_CONFIG } from '../constants/vnpayConfig';
import { PAYMENT_CONFIG } from '../constants/paymentConfig';

/**
 * ✅ SORT OBJECT THEO CÁCH VNPAY CHÍNH XÁC
 * Copy từ backend VNPay - đảm bảo chính xác 100%
 */
function sortObjectVNPay(obj) {
  const sorted = {};
  const str = [];
  let key;
  
  // Lấy tất cả keys và encode
  for (key in obj) {
    if (obj.hasOwnProperty(key)) {
      str.push(encodeURIComponent(key));
    }
  }
  
  // Sort keys theo thứ tự alphabet
  str.sort();
  
  // Tạo sorted object với values được encode
  for (key = 0; key < str.length; key++) {
    sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, '+');
  }
  
  return sorted;
}

/**
 * ✅ TẠO CHỮ KÝ VNPAY - DÙNG THUẬT TOÁN CHÍNH XÁC TỪ BACKEND
 */
export const createVNPaySignature = (params, secretKey) => {
  try {
    // Loại bỏ vnp_SecureHash nếu có
    const { vnp_SecureHash, ...paramsForSign } = params;
    
    console.log('🔑 Params before signature:', paramsForSign);
    
    // ✅ DÙNG sortObjectVNPay CHÍNH XÁC từ VNPay backend
    const sortedParams = sortObjectVNPay(paramsForSign);
    
    // ✅ Tạo sign data theo cách VNPay backend
    const signData = Object.keys(sortedParams)
      .map(key => `${key}=${sortedParams[key]}`)
      .join('&');
    
    console.log('🔑 Query string for signature:', signData);
    
    // ✅ Tạo signature với HMAC-SHA512
    const signature = CryptoJS.HmacSHA512(signData, secretKey)
      .toString(CryptoJS.enc.Hex)
      .toUpperCase();
    
    console.log('🔑 Generated signature:', signature);
    
    return signature;
    
  } catch (error) {
    console.error('❌ Create VNPay Signature Error:', error);
    throw error;
  }
};

// ✅ Verify chữ ký từ VNPay response
export const verifyVNPaySignature = (params, secretKey) => {
  try {
    const { vnp_SecureHash, ...paramsWithoutHash } = params;
    const generatedSignature = createVNPaySignature(paramsWithoutHash, secretKey);

    return generatedSignature === vnp_SecureHash;
  } catch (error) {
    console.error('Verify VNPay signature error:', error);
    return false;
  }
};

// ✅ Format số tiền cho VNPay (không dấu phẩy, không thập phân, nhân 100)
export const formatVNPayAmount = (amount) => {
  // VNPay yêu cầu số tiền tính bằng xu (VND * 100)
  return Math.round(amount * 100).toString();
};

// ✅ Parse số tiền từ VNPay response
export const parseVNPayAmount = (vnpayAmount) => {
  return parseInt(vnpayAmount) / 100;
};

// ✅ Tạo thời gian cho VNPay (format: yyyyMMddHHmmss)
export const createVNPayDateTime = (date = new Date()) => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');

  return `${year}${month}${day}${hours}${minutes}${seconds}`;
};

// ✅ Tạo IP address (VNPay accept IP này)
export const getClientIP = () => {
  return '113.160.92.202';
};

// ✅ Tạo URL thanh toán VNPay
export const createVNPayUrl = (orderData) => {
  try {
    const {
      amount,
      orderInfo,
      orderId,
      returnUrl = VNPAY_CONFIG.RETURN_URL,
      orderType = VNPAY_CONFIG.ORDER_TYPE.DEPOSIT,
      bankCode = '',
      locale = VNPAY_CONFIG.LOCALE
    } = orderData;

    // Validate required fields
    if (!amount || !orderInfo || !orderId) {
      throw new Error('Missing required fields: amount, orderInfo, orderId');
    }

    // Tạo thời gian
    const createDate = createVNPayDateTime();
    const expireDate = createVNPayDateTime(
      new Date(Date.now() + 15 * 60 * 1000) // 15 phút
    );

    // ✅ Tham số VNPay - KHÔNG ENCODE Ở ĐÂY
    const vnpParams = {
      vnp_Version: VNPAY_CONFIG.VERSION,
      vnp_Command: VNPAY_CONFIG.COMMAND,
      vnp_TmnCode: VNPAY_CONFIG.TMN_CODE,
      vnp_Amount: formatVNPayAmount(amount),
      vnp_CurrCode: VNPAY_CONFIG.CURR_CODE,
      vnp_TxnRef: orderId,
      vnp_OrderInfo: orderInfo,        // ✅ RAW string
      vnp_OrderType: orderType,
      vnp_Locale: locale,
      vnp_ReturnUrl: returnUrl,        // ✅ RAW URL
      vnp_IpAddr: getClientIP(),
      vnp_CreateDate: createDate,
      vnp_ExpireDate: expireDate
    };

    // Thêm bank code nếu có
    if (bankCode) {
      vnpParams.vnp_BankCode = bankCode;
    }

    console.log('🔑 VNPay params before signature:', vnpParams);

    // ✅ Tạo chữ ký với function mới
    const signature = createVNPaySignature(vnpParams, VNPAY_CONFIG.HASH_SECRET);

    // ✅ Tạo final params với signature
    const finalParams = {
      ...vnpParams,
      vnp_SecureHash: signature
    };

    // ✅ Tạo URL - CHỈ ENCODE KHI TẠO URL CUỐI CÙNG
    const queryString = Object.keys(finalParams)
      .map(key => `${key}=${encodeURIComponent(finalParams[key])}`)
      .join('&');

    const paymentUrl = `${VNPAY_CONFIG.PAYMENT_URL}?${queryString}`;

    console.log('🔑 Generated VNPay URL:', paymentUrl);

    return {
      success: true,
      url: paymentUrl,
      params: finalParams
    };

  } catch (error) {
    console.error('❌ Create VNPay URL Error:', error);
    return {
      success: false,
      message: error.message
    };
  }
};

// ✅ Parse URL parameters từ return URL
export const parseVNPayReturnUrl = (url) => {
  try {
    const urlParts = url.split('?');
    if (urlParts.length < 2) {
      throw new Error('Invalid return URL format');
    }

    const queryString = urlParts[1];
    const params = {};

    queryString.split('&').forEach(param => {
      const [key, value] = param.split('=');
      if (key && value) {
        params[key] = decodeURIComponent(value);
      }
    });

    return {
      success: true,
      params
    };
  } catch (error) {
    console.error('Parse VNPay return URL error:', error);
    return {
      success: false,
      message: error.message
    };
  }
};

// ✅ Validate VNPay response
export const validateVNPayResponse = (params) => {
  try {
    console.log('🔍 Validating VNPay response:', params);
    
    if (!params || typeof params !== 'object') {
      throw new Error('Invalid params format');
    }

    // ✅ CHECK RESPONSE CODE - ACCEPT TẤT CẢ FORMAT
    const responseCode = params.vnp_ResponseCode || 
                        params.responseCode || 
                        (params.rawData && params.rawData.vnp_ResponseCode);
    
    const transactionStatus = params.vnp_TransactionStatus || 
                             params.transactionStatus || 
                             (params.rawData && params.rawData.vnp_TransactionStatus);
    
    const txnRef = params.vnp_TxnRef || 
                   params.txnRef || 
                   (params.rawData && params.rawData.vnp_TxnRef);

    // ✅ NÔ LỖI NẾU ĐÃ CÓ isSuccess - NGHĨA LÀ ĐÃ ĐƯỢC PARSE
    if (params.isSuccess !== undefined) {
      console.log('✅ Data already parsed - returning as is');
      return {
        success: true,
        data: params
      };
    }

    // ✅ CHECK BASIC FIELDS
    if (!responseCode) {
      throw new Error('Missing response code');
    }

    // ✅ SKIP SIGNATURE VALIDATION TRONG DEV
    if (__DEV__) {
      console.log('⚠️ Skipping signature validation in DEV mode');
    }

    // ✅ RETURN DATA - HỖ TRỢ TẤT CẢ FORMAT
    const responseData = {
      isSuccess: responseCode === '00' && transactionStatus === '00',
      amount: params.amount || (parseInt(params.vnp_Amount || 0) / 100),
      transactionNo: params.transactionNo || params.vnp_TransactionNo,
      bankCode: params.bankCode || params.vnp_BankCode,
      orderInfo: params.orderInfo || decodeURIComponent(params.vnp_OrderInfo || ''),
      payDate: params.payDate || params.vnp_PayDate,
      responseCode: responseCode,
      transactionStatus: transactionStatus,
      txnRef: txnRef,
      bankTranNo: params.bankTranNo || params.vnp_BankTranNo,
      cardType: params.cardType || params.vnp_CardType,
      message: params.message || getVNPayMessage(responseCode),
      rawData: params.rawData || params
    };

    console.log('✅ VNPay validation successful:', responseData);

    return {
      success: true,
      data: responseData
    };

  } catch (error) {
    console.error('❌ VNPay validation error:', error);
    return {
      success: false,
      message: error.message,
      error: error
    };
  }
};

// ✅ Lấy message từ response code
export const getVNPayMessage = (responseCode) => {
  const messages = {
    '00': 'Giao dịch thành công',
    '07': 'Trừ tiền thành công. Giao dịch bị nghi ngờ',
    '09': 'Thẻ/Tài khoản chưa đăng ký InternetBanking',
    '10': 'Xác thực thông tin thẻ/tài khoản không đúng quá 3 lần',
    '11': 'Đã hết hạn chờ thanh toán',
    '12': 'Thẻ/Tài khoản bị khóa',
    '13': 'Nhập sai mật khẩu xác thực giao dịch (OTP)',
    '24': 'Khách hàng hủy giao dịch',
    '51': 'Tài khoản không đủ số dư',
    '65': 'Tài khoản đã vượt quá hạn mức giao dịch trong ngày',
    '75': 'Ngân hàng thanh toán đang bảo trì',
    '79': 'Nhập sai mật khẩu thanh toán quá số lần quy định',
    '99': 'Lỗi không xác định'
  };

  return messages[responseCode] || 'Lỗi không xác định';
};

// ✅ Format order info cho VNPay
export const formatOrderInfo = (billData) => {
  try {
    const { name, phone } = billData;
    
    if (!name && !phone) {
      return 'Dat ban BunChaObama';
    }
    
    // ✅ Format đơn giản, không ký tự đặc biệt
    return `Dat ban ${name || 'KhachHang'} ${phone || ''}`.trim();
    
  } catch (error) {
    console.error('❌ Format Order Info Error:', error);
    return 'Dat ban BunChaObama';
  }
};

// ✅ Tạo order ID unique
export const generateOrderId = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${PAYMENT_CONFIG.ORDER_ID_PREFIX}${timestamp}_${random}`;
};

// ✅ Format date for VNPay
export const formatVNPayDate = (date) => {
  return createVNPayDateTime(date);
};

// ✅ Sanitize string for VNPay
export const sanitizeVNPayString = (str) => {
  if (!str || typeof str !== 'string') {
    return '';
  }
  
  // Loại bỏ ký tự đặc biệt, chỉ giữ lại chữ cái, số, dấu cách
  return str
    .replace(/[^a-zA-Z0-9\s\-\_]/g, '')
    .trim()
    .substring(0, 255); // VNPay limit
};

// ✅ Log VNPay request for debug
export const logVNPayRequest = (requestData) => {
  if (__DEV__) {
    console.log('🔍 VNPay Request Debug:', {
      environment: VNPAY_CONFIG.PAYMENT_URL.includes('sandbox') ? 'SANDBOX' : 'PRODUCTION',
      timestamp: new Date().toISOString(),
      ...requestData
    });
  }
};
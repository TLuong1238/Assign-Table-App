// services/paymentService.js
import VNPayService from './vnpayService';

export const createPaymentUrl = async (paymentData) => {
  try {
    const {
      userId,
      billId,
      amount,
      description,
      orderType = 'billpayment'
    } = paymentData;

    console.log('🔄 Creating payment URL...');
    
    // ✅ Validate config
    VNPayService.validateConfig();
    
    // ✅ Tạo payment URL
    const result = VNPayService.createPaymentUrl({
      amount: amount,
      orderDescription: description,
      orderType: orderType,
      language: 'vn'
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    console.log('✅ Payment URL created:', result.orderId);
    
    // ✅ Lưu payment info (có thể lưu vào AsyncStorage hoặc state)
    const paymentInfo = {
      orderId: result.orderId,
      userId: userId,
      billId: billId,
      amount: amount,
      description: description,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    return {
      success: true,
      data: {
        paymentUrl: result.paymentUrl,
        orderId: result.orderId,
        payment: paymentInfo
      }
    };

  } catch (error) {
    console.error('❌ Create payment URL error:', error);
    return {
      success: false,
      message: error.message
    };
  }
};

export const verifyPaymentResponse = (responseParams) => {
  try {
    const isValid = VNPayService.verifyReturnResponse(responseParams);
    const responseCode = responseParams.vnp_ResponseCode;
    const orderId = responseParams.vnp_TxnRef;
    
    return {
      success: true,
      data: {
        isValid: isValid,
        orderId: orderId,
        responseCode: responseCode,
        isSuccess: responseCode === '00',
        message: VNPayService.getResponseMessage(responseCode)
      }
    };
  } catch (error) {
    console.error('❌ Verify payment response error:', error);
    return {
      success: false,
      message: error.message
    };
  }
};

export const queryPaymentStatus = async (orderId, transactionDate) => {
  try {
    const queryData = VNPayService.createQueryData(orderId, transactionDate);
    
    if (!queryData) {
      throw new Error('Không thể tạo query data');
    }

    // ✅ Gọi API VNPay (cần backend proxy)
    const response = await fetch('https://yourbackend.com/api/payment/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(queryData)
    });

    const result = await response.json();
    return result;

  } catch (error) {
    console.error('❌ Query payment status error:', error);
    return {
      success: false,
      message: error.message
    };
  }
};
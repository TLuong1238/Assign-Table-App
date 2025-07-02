// services/vnpayService.js
import { supabase } from '../lib/supabase';
import { 
  createVNPayUrl, 
  validateVNPayResponse, 
  formatOrderInfo,
  generateOrderId 
} from '../helper/vnpayHelper';
import { parseHttpBinResponse } from '../constants/vnpayConfig';
import { PAYMENT_CONFIG } from '../constants/paymentConfig';
import { createBillFromPayment } from './billService'; // ✅ IMPORT TỪ billService

// ✅ Tạo thanh toán VNPay
export const createVNPayPayment = async (paymentData) => {
  // ✅ TẮT MOCK MODE ĐỂ TEST THẬT
  const MOCK_MODE = false; // ← TẮT MOCK
  
  if (MOCK_MODE) {
    console.log('🎭 Mock VNPay Payment');
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    return {
      success: true,
      data: {
        paymentId: Math.floor(Math.random() * 1000),
        orderId: generateOrderId(),
        vnpayUrl: 'https://www.google.com?mock=success',
        amount: paymentData.amount
      }
    };
  }
  
  try {
    const {
      userId,
      billData,
      amount,
      paymentType = 'deposit' // 'deposit' hoặc 'full'
    } = paymentData;

    console.log('Creating VNPay payment:', { userId, amount, paymentType });

    // Validate input
    if (!userId || !billData || !amount || amount <= 0) {
      throw new Error('Invalid payment data');
    }

    // Tạo order ID unique
    const orderId = generateOrderId();
    
    // Tạo thông tin đơn hàng cho VNPay
    const orderInfo = formatOrderInfo(billData);
    
    // ✅ Lưu thông tin payment vào database trước - THEO SCHEMA
    const { data: payment, error: insertError } = await supabase
      .from('payments')
      .insert([
        {
          orderid: orderId,                                    // ✅ text NOT NULL UNIQUE
          userid: userId,                                      // ✅ uuid NOT NULL
          amount: amount,                                      // ✅ numeric NOT NULL CHECK > 0
          payment_type: paymentType === 'remaining' ? 'deposit' : paymentType,                     // ✅ CHECK constraint
          payment_method: 'vnpay',                            // ✅ CHECK constraint  
          status: 'pending',                                  // ✅ CHECK constraint
          bill_data: billData,                                // ✅ jsonb
          created_at: new Date().toISOString(),               // ✅ timestamp NOT NULL
          updated_at: new Date().toISOString()                // ✅ timestamp NOT NULL
        }
      ])
      .select('*')
      .single();

    if (insertError) {
      console.error('Insert payment error:', insertError);
      throw new Error(`Database error: ${insertError.message}`);
    }

    console.log('Payment created in database:', payment);

    // ✅ Tạo VNPay URL với function đã fix
    const vnpayResult = createVNPayUrl({
      amount,
      orderInfo,
      orderId,
      orderType: 'other'
    });

    if (!vnpayResult.success) {
      // Xóa payment đã tạo nếu tạo URL thất bại
      await supabase.from('payments').delete().eq('id', payment.id);
      throw new Error(`VNPay URL error: ${vnpayResult.message}`);
    }

    console.log('✅ VNPay payment created successfully:', {
      orderId,
      paymentId: payment.id
    });

    return {
      success: true,
      data: {
        paymentId: payment.id,
        orderId,
        vnpayUrl: vnpayResult.url,
        amount,
        orderInfo
      }
    };

  } catch (error) {
    console.error('❌ Create VNPay payment error:', error);
    return {
      success: false,
      message: error.message || 'Failed to create VNPay payment'
    };
  }
};

// ✅ XỬ LÝ KẾT QUẢ TỪNG FORMAT (httpbin hoặc normal)
export const handleVNPayReturn = async (returnParams, isHttpBin = false) => {
  try {
    console.log('Handling VNPay return:', { returnParams, isHttpBin });

    let vnpayData;
    
    if (isHttpBin) {
      // ✅ Xử lý HTTPBin response
      const parseResult = parseHttpBinResponse(returnParams);
      if (!parseResult.success) {
        throw new Error(`Invalid HTTPBin response: ${parseResult.message}`);
      }
      vnpayData = parseResult.data;
    } else {
      // ✅ Xử lý normal VNPay response
      const validation = validateVNPayResponse(returnParams);
      if (!validation.success) {
        throw new Error(`Invalid VNPay response: ${validation.message}`);
      }
      vnpayData = validation.data;
    }

    const { txnRef, amount, isSuccess, responseCode, transactionStatus } = vnpayData;

    // Tìm payment trong database bằng orderId
    const orderId = txnRef;
    const { data: payment, error: findError } = await supabase
      .from('payments')
      .select('*')
      .eq('orderid', orderId)
      .single();

    if (findError) {
      console.error('Find payment error:', findError);
      throw new Error(`Payment not found: ${orderId}`);
    }

    console.log('Found payment:', payment);

    // Xác định trạng thái payment
    let newStatus = 'failed';
    if (isSuccess) {
      newStatus = 'completed';
    } else if (responseCode === '24') { // User cancelled
      newStatus = 'cancelled';
    }

    // ✅ Cập nhật payment status - THEO SCHEMA
    const { data: updatedPayment, error: updateError } = await supabase
      .from('payments')
      .update({
        status: newStatus,                                     // ✅ CHECK constraint
        vnp_response_code: responseCode,                       // ✅ text
        vnp_transaction_status: transactionStatus,             // ✅ text
        vnp_txn_ref: txnRef,                                  // ✅ text
        vnpay_response: isHttpBin ? returnParams : returnParams, // ✅ jsonb
        completed_at: new Date().toISOString(),                // ✅ timestamp
        updated_at: new Date().toISOString()                   // ✅ timestamp NOT NULL
      })
      .eq('id', payment.id)
      .select('*')
      .single();

    if (updateError) {
      console.error('Update payment error:', updateError);
      throw new Error(`Failed to update payment: ${updateError.message}`);
    }

    // ✅ Nếu thanh toán thành công, tạo bill
    let billResult = null;
    if (newStatus === 'completed') {
      billResult = await createBillFromPayment(updatedPayment);
      
      if (!billResult.success) {
        console.error('Create bill failed:', billResult.message);
        // Không throw error, thanh toán đã thành công
      }
    }

    return {
      success: true,
      data: {
        payment: updatedPayment,
        bill: billResult?.data || null,
        vnpayData,
        status: newStatus,
        message: vnpayData.message
      }
    };

  } catch (error) {
    console.error('Handle VNPay return error:', error);
    return {
      success: false,
      message: error.message || 'Failed to handle VNPay return'
    };
  }
};

// ✅ HELPER - XỬ LÝ KẾT QUẢ TỪ WEBVIEW
export const processWebViewResult = async (webViewResult) => {
  try {
    console.log('🔄 Processing WebView result:', webViewResult);
    
    // ✅ Gọi service để xử lý và lưu database
    const serviceResult = await handleVNPayReturn(webViewResult.rawData, false);
    
    if (serviceResult.success) {
      console.log('✅ WebView result processed successfully');
      return {
        success: true,
        data: {
          ...webViewResult,
          payment: serviceResult.data.payment,
          bill: serviceResult.data.bill
        }
      };
    } else {
      throw new Error(serviceResult.message);
    }
    
  } catch (error) {
    console.error('❌ Error processing WebView result:', error);
    return {
      success: false,
      message: error.message
    };
  }
};

// ✅ XÓA createBillFromPayment CŨ - DÙNG TỪ billService
// const createBillFromPayment = async (payment) => { ... } // ← XÓA FUNCTION NÀY

// ✅ Lấy thông tin payment theo order ID
export const getPaymentByOrderId = async (orderId) => {
  try {
    const { data: payment, error } = await supabase
      .from('payments')
      .select(`
        *,
        bills (*)
      `)
      .eq('orderid', orderId)
      .single();

    if (error) {
      throw new Error(`Payment not found: ${error.message}`);
    }

    return {
      success: true,
      data: payment
    };

  } catch (error) {
    console.error('Get payment by order ID error:', error);
    return {
      success: false,
      message: error.message
    };
  }
};

// ✅ Lấy lịch sử thanh toán của user
export const getUserPayments = async (userId, limit = 10) => {
  try {
    const { data: payments, error } = await supabase
      .from('payments')
      .select(`
        *,
        bills (*)
      `)
      .eq('userid', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get user payments: ${error.message}`);
    }

    return {
      success: true,
      data: payments || []
    };

  } catch (error) {
    console.error('Get user payments error:', error);
    return {
      success: false,
      message: error.message
    };
  }
};

// ✅ Hủy payment
export const cancelPayment = async (paymentId, reason = 'User cancelled') => {
  try {
    const { data: payment, error } = await supabase
      .from('payments')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),                  // ✅ THÊM updated_at
        vnpay_response: { cancelled_reason: reason }
      })
      .eq('id', paymentId)
      .eq('status', 'pending') // Chỉ cancel được payment đang pending
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to cancel payment: ${error.message}`);
    }

    return {
      success: true,
      data: payment
    };

  } catch (error) {
    console.error('Cancel payment error:', error);
    return {
      success: false,
      message: error.message
    };
  }
};
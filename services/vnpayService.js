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
import { createBill, createDetail } from './billService';
import { createCartDetail } from './cartDetailService';

// ✅ Tạo thanh toán VNPay - XÓA VIP VALIDATION
export const createVNPayPayment = async (paymentData) => {
  // ✅ TẮT MOCK MODE ĐỂ TEST THẬT
  const MOCK_MODE = false;

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
      paymentType = 'deposit' // 'deposit', 'full', 'remaining'
    } = paymentData;

    console.log('Creating VNPay payment:', { userId, amount, paymentType });

    // ✅ XÓA VIP VALIDATION - KHÔNG CẦN KIỂM TRA VIP NỮA
    // Thanh toán phần còn lại không phân biệt VIP hay không

    // Validate input
    if (!userId || !billData || !amount || amount <= 0) {
      throw new Error('Invalid payment data');
    }

    // ✅ VALIDATE AMOUNT LOGIC CHO DEPOSIT (GIỮ LẠI)
    if (paymentType === 'deposit') {
      const hasFood = billData.cartDetails?.length > 0;
      if (!hasFood && amount !== PAYMENT_CONFIG.TABLE_DEPOSIT) {
        console.warn('⚠️ Table booking should have 30k deposit, got:', amount);
      }
    }

    // Tạo order ID unique
    const orderId = generateOrderId();

    // Tạo thông tin đơn hàng cho VNPay
    const orderInfo = formatOrderInfo(billData);

    // ✅ Lưu thông tin payment vào database trước
    const { data: payment, error: insertError } = await supabase
      .from('payments')
      .insert([
        {
          orderid: orderId,
          userid: userId,
          amount: amount,
          payment_type: paymentType === 'remaining' ? 'full' : paymentType,
          payment_method: 'vnpay',
          status: 'pending',
          bill_data: billData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ])
      .select('*')
      .single();

    if (insertError) {
      console.error('Insert payment error:', insertError);
      throw new Error(`Database error: ${insertError.message}`);
    }

    console.log('Payment created in database:', payment);

    // ✅ Tạo VNPay URL
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

// ✅ XỬ LÝ KẾT QUẢ TỪNG FORMAT - XÓA VIP CHECK
export const handleVNPayReturn = async (returnParams, isHttpBin = false) => {
  try {
    console.log('🔄 Handling VNPay return:', { returnParams, isHttpBin });

    let vnpayData;

    if (isHttpBin) {
      // ✅ PARSE HTTPBIN RESPONSE
      const parseResult = parseHttpBinResponse(returnParams);
      if (!parseResult.success) {
        throw new Error(`Invalid HTTPBin response: ${parseResult.message}`);
      }
      vnpayData = parseResult.data;
    } else {
      // ✅ VALIDATION THÔNG THƯỜNG
      const validation = validateVNPayResponse(returnParams);
      if (!validation.success) {
        throw new Error(`Invalid VNPay response: ${validation.message}`);
      }
      vnpayData = validation.data;
    }

    const { txnRef, amount, isSuccess, responseCode, transactionStatus } = vnpayData;

    console.log('💳 VNPay data extracted:', { txnRef, amount, isSuccess });

    // ✅ TÌM PAYMENT RECORD
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*')
      .eq('orderid', txnRef)
      .single();

    if (paymentError) {
      console.error('❌ Payment not found:', paymentError);
      throw new Error('Payment record not found');
    }

    console.log('✅ Found payment record:', payment.id);
    console.log('📊 Payment type:', payment.payment_type);
    console.log('📊 Payment bill_data:', payment.bill_data);

    // ✅ XÁC ĐỊNH LOẠI PAYMENT
    const isRemainingPayment = payment.bill_data?.remainingAmount ||
      payment.bill_data?.existingPaymentId;

    console.log('🔍 Is remaining payment:', isRemainingPayment);

    if (isSuccess) {
      console.log('✅ Processing successful payment...');

      if (isRemainingPayment && payment.bill_data?.existingPaymentId) {
        // ✅ XỬ LÝ REMAINING PAYMENT - UPDATE PAYMENT CŨ
        console.log('🔄 Processing remaining payment - updating existing payment...');

        const existingPaymentId = payment.bill_data.existingPaymentId;

        // 1. UPDATE PAYMENT CŨ THÀNH FULL
        const { error: updateOldPaymentError } = await supabase
          .from('payments')
          .update({
            payment_type: 'full',
            amount: payment.bill_data.totalAmount || payment.amount,
            payment_method: 'vnpay',
            updated_at: new Date().toISOString(),
            bill_data: {
              ...payment.bill_data,
              remainingPaymentId: payment.id,
              remainingPaymentDate: new Date().toISOString(),
              remainingAmount: payment.bill_data.remainingAmount
            }
          })
          .eq('id', existingPaymentId);

        if (updateOldPaymentError) {
          console.error('❌ Error updating old payment:', updateOldPaymentError);
          throw new Error('Failed to update original payment');
        }

        console.log('✅ Original payment updated to full');

        // 2. UPDATE PAYMENT HIỆN TẠI (REMAINING) THÀNH COMPLETED
        const { error: updateCurrentPaymentError } = await supabase
          .from('payments')
          .update({
            status: 'completed',
            vnp_response_code: responseCode,
            vnp_transaction_status: transactionStatus,
            vnpay_response: vnpayData.rawData,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', payment.id);

        if (updateCurrentPaymentError) {
          console.error('❌ Error updating current payment:', updateCurrentPaymentError);
          throw new Error('Failed to update current payment');
        }

        console.log('✅ Current payment updated to completed');

        // 3. UPDATE BILL STATUS
        if (payment.billid) {
          const { error: updateBillError } = await supabase
            .from('bills')
            .update({
              payment_status: 'fully_paid',
              payment_method: 'vnpay',
              payment_id: existingPaymentId.toString(), // ✅ DÙNG ID CỦA PAYMENT GỐC
              updated_at: new Date().toISOString()
            })
            .eq('id', payment.billid);

          if (updateBillError) {
            console.error('❌ Error updating bill:', updateBillError);
            throw new Error('Failed to update bill status');
          }

          console.log('✅ Bill updated to fully_paid');
        }

        // 4. RETURN SUCCESS DATA
        return {
          success: true,
          data: {
            payment: payment,
            originalPayment: { id: existingPaymentId },
            bill: payment.billid ? { id: payment.billid } : null,
            vnpayData: vnpayData,
            isRemainingPayment: true,
            status: 'completed',
            message: 'Remaining payment completed successfully'
          }
        };

      } else {
        // ✅ XỬ LÝ DEPOSIT PAYMENT THÔNG THƯỜNG
        console.log('🔄 Processing normal deposit payment...');

        const { data: updatedPayment, error: updateError } = await supabase
          .from('payments')
          .update({
            status: 'completed',
            vnp_response_code: responseCode,
            vnp_transaction_status: transactionStatus,
            vnpay_response: vnpayData.rawData,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', payment.id)
          .select()
          .single();

        if (updateError) {
          console.error('❌ Update payment error:', updateError);
          throw new Error('Failed to update payment status');
        }

        console.log('✅ Payment updated successfully:', updatedPayment.id);

        // UPDATE BILL STATUS
        let billResult = null;
        if (payment.billid) {
          let billStatus = 'fully_paid';
          if (payment.payment_type === 'deposit') {
            billStatus = 'deposit_paid';
          }

          billResult = await supabase
            .from('bills')
            .update({
              payment_status: billStatus,
              payment_id: payment.id.toString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', payment.billid)
            .select()
            .single();

          if (billResult.error) {
            console.error('❌ Update bill error:', billResult.error);
          } else {
            console.log('✅ Bill updated successfully:', billResult.data?.id);
          }
        }

        return {
          success: true,
          data: {
            payment: updatedPayment,
            bill: billResult?.data || null,
            vnpayData,
            isRemainingPayment: false,
            status: 'completed',
            message: vnpayData.message
          }
        };
      }

    } else {
      // ✅ PAYMENT FAILED
      console.log('❌ Processing failed payment...');

      const { error: updatePaymentError } = await supabase
        .from('payments')
        .update({
          status: 'failed',
          vnp_response_code: responseCode,
          vnp_transaction_status: transactionStatus,
          vnpay_response: vnpayData.rawData,
          updated_at: new Date().toISOString()
        })
        .eq('id', payment.id);

      if (updatePaymentError) {
        console.error('❌ Update payment error:', updatePaymentError);
      }

      return {
        success: false,
        message: vnpayData.message || 'Payment failed',
        data: {
          payment: payment,
          vnpayData: vnpayData,
          isRemainingPayment: isRemainingPayment,
          status: 'failed'
        }
      };
    }

  } catch (error) {
    console.error('❌ Handle VNPay return error:', error);
    return {
      success: false,
      message: error.message || 'Failed to process VNPay return'
    };
  }
};

// ✅ XỬ LÝ KẾT QUẢ TỪ WEBVIEW
export const processWebViewResult = async (webViewResult) => {
  try {
    console.log('🔄 Processing WebView result:', webViewResult);

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
        updated_at: new Date().toISOString(),
        vnpay_response: { cancelled_reason: reason }
      })
      .eq('id', paymentId)
      .eq('status', 'pending')
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

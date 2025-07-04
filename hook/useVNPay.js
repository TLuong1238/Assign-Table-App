// hooks/useVNPay.js
import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { 
  createVNPayPayment,
  handleVNPayReturn,
  getPaymentByOrderId,
  cancelPayment
} from '../services/vnpayService';
import { calculateDepositAmount, formatCurrency, isVipUser } from '../constants/paymentConfig';

const useVNPay = () => {
  const [loading, setLoading] = useState(false);
  const [showWebView, setShowWebView] = useState(false);
  const [vnpayUrl, setVnpayUrl] = useState('');
  const [currentPayment, setCurrentPayment] = useState(null);
  const [paymentResult, setPaymentResult] = useState(null);

  // ✅ Tạo thanh toán VNPay - XÓA VIP CHECK
  const createPayment = useCallback(async (paymentData) => {
    try {
      setLoading(true);
      console.log('Creating VNPay payment:', paymentData);

      // ✅ XÓA VIP VALIDATION - KHÔNG CẦN KIỂM TRA VIP NỮA
      // Thanh toán phần còn lại không phân biệt VIP hay không

      const result = await createVNPayPayment(paymentData);
      
      if (!result.success) {
        throw new Error(result.message);
      }

      const { paymentId, orderId, vnpayUrl, amount, orderInfo } = result.data;
      
      // Lưu thông tin payment hiện tại
      setCurrentPayment({
        id: paymentId,
        orderId,
        amount,
        orderInfo,
        paymentData
      });

      setVnpayUrl(vnpayUrl);
      setShowWebView(true);

      console.log('VNPay payment created successfully:', { paymentId, orderId });
      
      return {
        success: true,
        data: result.data
      };

    } catch (error) {
      console.error('Create payment error:', error);
      
      Alert.alert(
        'Lỗi thanh toán',
        error.message || 'Không thể tạo thanh toán. Vui lòng thử lại.',
        [{ text: 'OK' }]
      );

      return {
        success: false,
        message: error.message
      };
    } finally {
      setLoading(false);
    }
  }, []);

  // ✅ Xử lý thanh toán thành công
  const handlePaymentSuccess = useCallback(async (vnpayParams) => {
    try {
      console.log('Payment success params:', vnpayParams);
      
      setShowWebView(false);
      setLoading(true);

      // Xử lý kết quả từ VNPay
      const result = await handleVNPayReturn(vnpayParams);
      
      if (!result.success) {
        throw new Error(result.message);
      }

      const { payment, bill, vnpayData } = result.data;
      
      setPaymentResult({
        success: true,
        payment,
        bill,
        vnpayData,
        message: 'Thanh toán thành công!'
      });

      // Success notification
      Alert.alert(
        '🎉 Thanh toán thành công!',
        `Giao dịch ${formatCurrency(payment.amount)}đ đã được xử lý thành công.\n\nMã giao dịch: ${vnpayData.transactionNo || vnpayData.orderId}`,
        [
          {
            text: 'Xem chi tiết',
            onPress: () => {
              console.log('Navigate to payment detail:', payment.id);
            }
          },
          { text: 'OK' }
        ]
      );

      return result;

    } catch (error) {
      console.error('Handle payment success error:', error);
      
      Alert.alert(
        'Lỗi xử lý thanh toán',
        'Thanh toán có thể đã thành công nhưng có lỗi khi xử lý kết quả. Vui lòng kiểm tra lại.',
        [{ text: 'OK' }]
      );

      setPaymentResult({
        success: false,
        message: error.message
      });

    } finally {
      setLoading(false);
    }
  }, []);

  // ✅ Xử lý thanh toán thất bại
  const handlePaymentFailure = useCallback(async (errorData) => {
    try {
      console.log('Payment failure data:', errorData);
      
      setShowWebView(false);
      setLoading(true);

      let errorMessage = 'Thanh toán không thành công';
      let shouldRetry = true;

      // Phân loại lỗi
      if (errorData.error === 'user_cancelled') {
        errorMessage = 'Bạn đã hủy thanh toán';
        shouldRetry = true;
      } else if (errorData.vnp_ResponseCode === '24') {
        errorMessage = 'Giao dịch bị hủy bởi người dùng';
        shouldRetry = true;
      } else if (errorData.vnp_ResponseCode === '51') {
        errorMessage = 'Tài khoản không đủ số dư để thực hiện giao dịch';
        shouldRetry = true;
      } else if (errorData.vnp_ResponseCode === '11') {
        errorMessage = 'Đã hết thời gian thanh toán';
        shouldRetry = true;
      } else if (errorData.error === 'webview_error') {
        errorMessage = 'Lỗi tải trang thanh toán. Vui lòng kiểm tra kết nối internet';
        shouldRetry = true;
      } else {
        errorMessage = errorData.message || 'Giao dịch thất bại';
        shouldRetry = false;
      }

      // Xử lý VNPay response nếu có
      if (errorData.vnp_TxnRef) {
        const result = await handleVNPayReturn(errorData);
        if (result.success) {
          setPaymentResult({
            success: false,
            payment: result.data.payment,
            vnpayData: result.data.vnpayData,
            message: errorMessage
          });
        }
      }

      // Cancel payment nếu cần
      if (currentPayment?.id) {
        await cancelPayment(currentPayment.id, errorMessage);
      }

      setPaymentResult({
        success: false,
        message: errorMessage,
        canRetry: shouldRetry
      });

      // Error notification
      const alertButtons = [{ text: 'OK' }];
      
      if (shouldRetry) {
        alertButtons.unshift({
          text: 'Thử lại',
          onPress: () => {
            if (currentPayment?.paymentData) {
              createPayment(currentPayment.paymentData);
            }
          }
        });
      }

      Alert.alert('❌ Thanh toán thất bại', errorMessage, alertButtons);

    } catch (error) {
      console.error('Handle payment failure error:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPayment, createPayment]);

  // ✅ Đóng WebView
  const closeWebView = useCallback(() => {
    setShowWebView(false);
    setVnpayUrl('');
  }, []);

  // ✅ Reset payment state
  const resetPayment = useCallback(() => {
    setCurrentPayment(null);
    setPaymentResult(null);
    setVnpayUrl('');
    setShowWebView(false);
    setLoading(false);
  }, []);

  // ✅ Tạo thanh toán cọc - CHỈ GIỮ VIP CHECK CHO DEPOSIT
  const createDepositPayment = useCallback(async (billData, userId) => {
    try {
      // ✅ VIP CHECK CHỈ CHO DEPOSIT - GIỮ LẠI
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();

      if (userError) {
        throw new Error('Unable to verify user information');
      }

      if (isVipUser(userData)) {
        Alert.alert(
          '🌟 VIP Privilege',
          'VIP members don\'t need to pay any deposit. Please use direct booking.',
          [{ text: 'Got it!', style: 'default' }]
        );
        return {
          success: false,
          message: 'VIP users do not need to pay deposit'
        };
      }

      // ✅ TÍNH CỌC THEO LOGIC MỚI
      const totalAmount = billData.price || 0;
      const hasFood = billData.cartDetails?.length > 0;
      const depositAmount = calculateDepositAmount(totalAmount, hasFood, false);

      console.log('💰 Deposit calculation:', { totalAmount, hasFood, depositAmount });

      const paymentData = {
        userId,
        billData: {
          ...billData,
          totalAmount,
          depositAmount,
          hasFood
        },
        amount: depositAmount,
        paymentType: 'deposit'
      };

      return await createPayment(paymentData);

    } catch (error) {
      console.error('Create deposit payment error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }, [createPayment]);

  // ✅ Tạo thanh toán đầy đủ - CHỈ GIỮ VIP CHECK CHO FULL
  const createFullPayment = useCallback(async (billData, userId) => {
    try {
      // ✅ VIP CHECK CHỈ CHO FULL - GIỮ LẠI
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();

      if (userError) {
        throw new Error('Unable to verify user information');
      }

      if (isVipUser(userData)) {
        Alert.alert(
          '🌟 VIP Privilege',
          'VIP members don\'t need to pay anything. Please use direct booking.',
          [{ text: 'Got it!', style: 'default' }]
        );
        return {
          success: false,
          message: 'VIP users do not need to pay'
        };
      }

      // ✅ FULL PAYMENT CHỈ CHO ĐƠN CÓ MÓN ĂN
      if (!billData.cartDetails?.length) {
        Alert.alert(
          'Invalid Payment Type',
          'Full payment is only available for orders with food. For table booking only, please use deposit payment.',
          [{ text: 'OK', style: 'default' }]
        );
        return {
          success: false,
          message: 'Full payment is only available for orders with food'
        };
      }

      const totalAmount = billData.price || 0;

      const paymentData = {
        userId,
        billData,
        amount: totalAmount,
        paymentType: 'full'
      };

      return await createPayment(paymentData);

    } catch (error) {
      console.error('Create full payment error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }, [createPayment]);

  // ✅ Kiểm tra trạng thái payment
  const checkPaymentStatus = useCallback(async (orderId) => {
    try {
      setLoading(true);
      
      const result = await getPaymentByOrderId(orderId);
      
      if (result.success) {
        setCurrentPayment(prev => ({
          ...prev,
          ...result.data
        }));
      }

      return result;

    } catch (error) {
      console.error('Check payment status error:', error);
      return {
        success: false,
        message: error.message
      };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    // States
    loading,
    showWebView,
    vnpayUrl,
    currentPayment,
    paymentResult,

    // Actions
    createPayment,
    createDepositPayment,
    createFullPayment,
    handlePaymentSuccess,
    handlePaymentFailure,
    closeWebView,
    resetPayment,
    checkPaymentStatus
  };
};

export default useVNPay;
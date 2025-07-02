import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Modal, 
  StyleSheet, 
  Alert, 
  Text, 
  TouchableOpacity, 
  BackHandler 
} from 'react-native';
import { WebView } from 'react-native-webview';
import { theme } from '../constants/theme';
import { hp, wp } from '../helper/common';
import * as Icon from 'react-native-feather';
import MyLoading from './MyLoading';
import { parseVNPayReturnUrl } from '../helper/vnpayHelper';
import { parseHttpBinResponse } from '../constants/vnpayConfig';

const VNPayWebView = ({ 
  visible, 
  onClose, 
  vnpayUrl, 
  onPaymentSuccess, 
  onPaymentFailure,
  orderInfo = '',
  amount = 0
}) => {
  const [loading, setLoading] = useState(true);
  const [currentUrl, setCurrentUrl] = useState('');
  const [canGoBack, setCanGoBack] = useState(false);
  const [waitingForReturn, setWaitingForReturn] = useState(false);
  const [processingResult, setProcessingResult] = useState(false);
  const webViewRef = useRef(null);
  
  // ✅ THÊM REF ĐỂ TRÁNH XỬ LÝ TRÙNG LẶP
  const processedUrlsRef = useRef(new Set());
  const isProcessingRef = useRef(false);

  // ✅ Handle Android back button
  useEffect(() => {
    if (!visible) return;

    const handleBackPress = () => {
      if (canGoBack && webViewRef.current && !waitingForReturn) {
        webViewRef.current.goBack();
        return true;
      }
      
      // Show confirmation before closing
      Alert.alert(
        'Xác nhận',
        'Bạn có chắc muốn hủy thanh toán?',
        [
          { text: 'Tiếp tục thanh toán', style: 'cancel' },
          { 
            text: 'Hủy thanh toán', 
            style: 'destructive',
            onPress: () => {
              onPaymentFailure({ 
                error: 'user_cancelled',
                message: 'Người dùng hủy thanh toán' 
              });
            }
          }
        ]
      );
      return true;
    };

    BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    
    return () => {
      BackHandler.removeEventListener('hardwareBackPress', handleBackPress);
    };
  }, [visible, canGoBack, waitingForReturn, onPaymentFailure]);

  // ✅ Handle navigation state changes - SỬA ĐỂ TRÁNH TRÙNG LẶP
  const handleNavigationStateChange = (navState) => {
    const { url, canGoBack: webCanGoBack, loading: webLoading } = navState;
    
    setCurrentUrl(url);
    setCanGoBack(webCanGoBack);
    
    console.log('🌐 WebView navigation:', { url, canGoBack: webCanGoBack });
    
    // ✅ TRÁNH XỬ LÝ URL ĐÃ PROCESSED
    if (processedUrlsRef.current.has(url)) {
      console.log('🔄 URL already processed, skipping:', url.substring(0, 50) + '...');
      return;
    }

    // ✅ TRÁNH XỬ LÝ KHI ĐANG PROCESSING
    if (isProcessingRef.current) {
      console.log('⚠️ Already processing, skipping navigation');
      return;
    }
    
    // ✅ DETECT HTTPBIN.ORG RESPONSE
    if (url.includes('httpbin.org/get') && url.includes('vnp_ResponseCode')) {
      console.log('✅ Detected HTTPBin VNPay response:', url);
      
      // ✅ MARK URL AS PROCESSED VÀ SET PROCESSING FLAG
      processedUrlsRef.current.add(url);
      isProcessingRef.current = true;
      
      setWaitingForReturn(true);
      setProcessingResult(true);
      
      // ✅ Parse URL parameters từ httpbin
      setTimeout(() => {
        processHttpBinResponse(url);
      }, 2000);
      
      return;
    }

    // ✅ IGNORE VNPay Error URLs - KHÔNG XỬ LÝ
    if (url.includes('vnpayment.vn') && url.includes('Error.html')) {
      console.log('⚠️ Detected VNPay error URL (ignored):', url.substring(0, 50) + '...');
      // Không xử lý, chờ HTTPBin response
      return;
    }
    
    // ✅ DETECT EXPO LINKING DEEP LINK PATTERN
    const returnPatterns = [
      'bunchaobama://vnpay-return',
      'vnpay-return',
      'payment-return',
      '/return'
    ];
    
    const isReturnUrl = returnPatterns.some(pattern => url.includes(pattern));
    
    if (isReturnUrl) {
      console.log('✅ Expo Linking - Detected return URL:', url);
      setWaitingForReturn(true);
      
      // ✅ SMALL DELAY TO LET EXPO LINKING HANDLE THE URL
      setTimeout(() => {
        console.log('📱 Closing WebView - Expo Linking will handle the result');
        onClose(); // Close WebView, let Expo Linking handle the response
      }, 2000);
      
      return;
    }

    // ✅ DETECT ERROR PATTERNS (KHÁC VNPay Error.html)
    const errorPatterns = [
      'cancel',
      'failure',
      'timeout'
    ];

    const isErrorUrl = errorPatterns.some(pattern => 
      url.toLowerCase().includes(pattern.toLowerCase())
    );

    if (isErrorUrl) {
      console.log('❌ Detected error URL:', url);
      handlePaymentError(url);
      return;
    }
  };

  // ✅ PROCESS HTTPBIN RESPONSE - THÊM PROTECTION CHỐNG TRÙNG LẶP
  const processHttpBinResponse = async (url) => {
    try {
      console.log('🔄 Processing HTTPBin response:', url);
      
      // ✅ DOUBLE CHECK ĐỂ TRÁNH TRÙNG LẶP
      if (processingResult) {
        console.log('🚫 Already processing result, aborting');
        return;
      }
      
      // ✅ FETCH JSON DATA FROM HTTPBIN
      const response = await fetch(url);
      const httpBinData = await response.json();
      
      console.log('📊 HTTPBin data:', httpBinData);
      
      // ✅ EXTRACT VNPAY PARAMS FROM ARGS
      const params = httpBinData.args;
      if (!params || !params.vnp_ResponseCode) {
        throw new Error('No VNPay response parameters found in HTTPBin data');
      }
      
      console.log('📊 VNPay params from HTTPBin:', params);
      
      // ✅ DIRECT PARSE - KHÔNG QUA VALIDATION + THÊM FLAG
      const vnpayData = {
        isSuccess: params.vnp_ResponseCode === '00' && params.vnp_TransactionStatus === '00',
        amount: parseInt(params.vnp_Amount || 0) / 100,
        transactionNo: params.vnp_TransactionNo,
        bankCode: params.vnp_BankCode,
        orderInfo: decodeURIComponent(params.vnp_OrderInfo || ''),
        payDate: params.vnp_PayDate,
        responseCode: params.vnp_ResponseCode,
        transactionStatus: params.vnp_TransactionStatus,
        txnRef: params.vnp_TxnRef,
        bankTranNo: params.vnp_BankTranNo,
        cardType: params.vnp_CardType,
        message: getVNPayMessage(params.vnp_ResponseCode),
        rawData: params,
        // ✅ THÊM FLAG ĐỂ TRÁNH VALIDATION LẠI
        _alreadyParsed: true,
        _source: 'httpbin'
      };
      
      console.log('✅ Direct parsed VNPay data:', vnpayData);
      
      // ✅ DIRECT CALL SUCCESS/FAILURE - CHỈ 1 LẦN
      setTimeout(() => {
        // ✅ RESET PROCESSING STATE
        setProcessingResult(false);
        isProcessingRef.current = false;
        
        if (vnpayData.isSuccess) {
          console.log('✅ Calling onPaymentSuccess directly');
          Alert.alert(
            '✅ Thanh toán thành công!',
            `Số tiền: ${vnpayData.amount.toLocaleString('vi-VN')} VND\n` +
            `Mã giao dịch: ${vnpayData.transactionNo}\n` +
            `Ngân hàng: ${vnpayData.bankCode}`,
            [
              {
                text: 'OK',
                onPress: () => {
                  // ✅ DIRECT CALL - KHÔNG QUA HÀM KHÁC
                  onPaymentSuccess(vnpayData);
                  onClose();
                }
              }
            ]
          );
        } else {
          console.log('❌ Calling onPaymentFailure directly');
          Alert.alert(
            '❌ Thanh toán thất bại!',
            `Lý do: ${vnpayData.message}\n` +
            `Mã lỗi: ${vnpayData.responseCode}`,
            [
              {
                text: 'Thử lại',
                onPress: () => {
                  setWaitingForReturn(false);
                  setProcessingResult(false);
                  // ✅ RESET PROCESSING STATE
                  isProcessingRef.current = false;
                  processedUrlsRef.current.clear();
                }
              },
              {
                text: 'Đóng',
                style: 'cancel',
                onPress: () => {
                  // ✅ DIRECT CALL - KHÔNG QUA HÀM KHÁC
                  onPaymentFailure(vnpayData);
                  onClose();
                }
              }
            ]
          );
        }
      }, 1500);
      
    } catch (error) {
      console.error('❌ Error processing HTTPBin response:', error);
      
      // ✅ RESET STATE ON ERROR
      setProcessingResult(false);
      setWaitingForReturn(false);
      isProcessingRef.current = false;
      
      Alert.alert(
        '❌ Lỗi xử lý',
        `Có lỗi xảy ra khi xử lý kết quả thanh toán:\n${error.message}`,
        [
          {
            text: 'OK',
            onPress: () => {
              onPaymentFailure({
                error: 'processing_error',
                message: error.message,
                _alreadyParsed: true
              });
            }
          }
        ]
      );
    }
  };

  // ✅ HELPER GET VNPAY MESSAGE
  const getVNPayMessage = (responseCode) => {
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
      '65': 'Vượt quá hạn mức giao dịch trong ngày',
      '75': 'Ngân hàng thanh toán đang bảo trì',
      '79': 'Nhập sai mật khẩu thanh toán quá số lần quy định',
      '99': 'Các lỗi khác'
    };
    
    return messages[responseCode] || 'Không xác định';
  };
  
  // ✅ Handle payment errors that don't trigger deep links
  const handlePaymentError = (url) => {
    let errorMessage = 'Giao dịch không thành công';
    
    if (url.includes('cancel')) {
      errorMessage = 'Bạn đã hủy giao dịch';
    } else if (url.includes('timeout')) {
      errorMessage = 'Đã hết thời gian chờ thanh toán';
    } else if (url.includes('error')) {
      errorMessage = 'Có lỗi xảy ra trong quá trình thanh toán';
    }

    Alert.alert(
      '❌ Thanh toán thất bại',
      errorMessage,
      [
        {
          text: 'Thử lại',
          onPress: () => {
            onPaymentFailure({
              error: 'payment_error',
              message: errorMessage,
              url
            });
          }
        },
        {
          text: 'Hủy',
          style: 'cancel',
          onPress: () => {
            onPaymentFailure({
              error: 'user_cancelled',
              message: 'Người dùng hủy thanh toán',
              url
            });
          }
        }
      ]
    );
  };

  // ✅ Handle WebView events
  const handleLoadStart = () => {
    setLoading(true);
  };

  const handleLoadEnd = () => {
    setLoading(false);
  };

  const handleError = (syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    console.error('❌ WebView error:', nativeEvent);
    
    // ✅ RESET PROCESSING STATE ON ERROR
    isProcessingRef.current = false;
    
    Alert.alert(
      'Lỗi kết nối',
      'Không thể tải trang thanh toán. Vui lòng kiểm tra kết nối internet và thử lại.',
      [
        {
          text: 'Thử lại',
          onPress: () => {
            if (webViewRef.current) {
              webViewRef.current.reload();
            }
          }
        },
        {
          text: 'Hủy',
          style: 'cancel',
          onPress: () => {
            onPaymentFailure({
              error: 'webview_error',
              message: 'Lỗi tải trang thanh toán'
            });
          }
        }
      ]
    );
  };

  // ✅ Handle close button
  const handleClose = () => {
    if (waitingForReturn || processingResult) {
      // Just close if waiting for return
      onClose();
      return;
    }

    Alert.alert(
      'Xác nhận hủy',
      'Bạn có chắc muốn hủy thanh toán? Giao dịch sẽ không được hoàn thành.',
      [
        { text: 'Tiếp tục thanh toán', style: 'cancel' },
        { 
          text: 'Hủy thanh toán',
          style: 'destructive', 
          onPress: () => {
            onPaymentFailure({
              error: 'user_cancelled',
              message: 'Người dùng hủy thanh toán'
            });
          }
        }
      ]
    );
  };

  // ✅ Format amount for display
  const formatAmount = (amount) => {
    return new Intl.NumberFormat('vi-VN').format(amount);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>💳 Thanh toán VNPay</Text>
            <Text style={styles.subtitle}>
              {formatAmount(amount)}đ
            </Text>
          </View>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Icon.X width={24} height={24} color={theme.colors.dark} />
          </TouchableOpacity>
        </View>

        {/* Order Info */}
        {orderInfo ? (
          <View style={styles.orderInfo}>
            <Text style={styles.orderInfoText} numberOfLines={1}>
              📋 {orderInfo}
            </Text>
          </View>
        ) : null}

        {/* ✅ PROCESSING RESULT INDICATOR */}
        {processingResult && (
          <View style={styles.processingContainer}>
            <MyLoading text="Đang xử lý kết quả từ VNPay..." />
            <Text style={styles.processingText}>
              Vui lòng đợi trong giây lát...
            </Text>
          </View>
        )}

        {/* ✅ WAITING FOR RETURN INDICATOR */}
        {waitingForReturn && !processingResult && (
          <View style={styles.waitingContainer}>
            <MyLoading text="Đang xử lý kết quả thanh toán..." />
            <Text style={styles.waitingText}>
              Vui lòng đợi trong giây lát...
            </Text>
          </View>
        )}

        {/* WebView Container */}
        <View style={styles.webViewContainer}>
          {loading && !waitingForReturn && !processingResult && (
            <View style={styles.loadingOverlay}>
              <MyLoading text="Đang tải trang thanh toán..." />
              <Text style={styles.loadingHint}>
                Vui lòng đợi trong giây lát...
              </Text>
            </View>
          )}
          
          <WebView
            ref={webViewRef}
            source={{ uri: vnpayUrl }}
            onNavigationStateChange={handleNavigationStateChange}
            onLoadStart={handleLoadStart}
            onLoadEnd={handleLoadEnd}
            onError={handleError}
            style={[
              styles.webView, 
              (waitingForReturn || processingResult) && { opacity: 0.5 }
            ]}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={false}
            allowsBackForwardNavigationGestures={true}
            showsVerticalScrollIndicator={true}
            showsHorizontalScrollIndicator={false}
            // Security settings
            mixedContentMode="compatibility"
            allowsInlineMediaPlaybook={true}
            mediaPlaybackRequiresUserAction={false}
            // ✅ USER AGENT for better compatibility
            userAgent="Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36"
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.securityInfo}>
            <Icon.Shield width={16} height={16} color="#27ae60" />
            <Text style={styles.securityText}>
              Giao dịch được bảo mật bởi VNPay
            </Text>
          </View>
          
          {/* ✅ PROCESSING STATUS */}
          {processingResult && (
            <View style={styles.processingStatus}>
              <Icon.Clock width={16} height={16} color="#ff9800" />
              <Text style={styles.processingStatusText}>Đang xử lý...</Text>
            </View>
          )}
          
          {/* ✅ EXPO LINKING STATUS */}
          {waitingForReturn && !processingResult && (
            <View style={styles.linkingStatus}>
              <Icon.Link width={16} height={16} color="#007AFF" />
              <Text style={styles.linkingText}>Expo Linking</Text>
            </View>
          )}
          
          {/* Back button when can go back */}
          {canGoBack && !waitingForReturn && !processingResult && (
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => webViewRef.current?.goBack()}
            >
              <Icon.ArrowLeft width={16} height={16} color={theme.colors.primary} />
              <Text style={styles.backButtonText}>Quay lại</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

// ✅ STYLES GIỮ NGUYÊN - KHÔNG SỬA
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: wp(4),
    paddingVertical: hp(2),
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: 'white',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontSize: hp(2.2),
    fontWeight: 'bold',
    color: theme.colors.dark,
  },
  subtitle: {
    fontSize: hp(1.6),
    color: theme.colors.primary,
    fontWeight: '600',
    marginTop: hp(0.5),
  },
  closeButton: {
    padding: wp(2),
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
  },
  orderInfo: {
    paddingHorizontal: wp(4),
    paddingVertical: hp(1),
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  orderInfoText: {
    fontSize: hp(1.4),
    color: theme.colors.text,
    fontStyle: 'italic',
  },
  processingContainer: {
    padding: wp(4),
    backgroundColor: '#fff3cd',
    borderBottomWidth: 1,
    borderBottomColor: '#ffeaa7',
    alignItems: 'center',
  },
  processingText: {
    marginTop: hp(1),
    fontSize: hp(1.4),
    color: '#856404',
    textAlign: 'center',
    fontWeight: '500',
  },
  waitingContainer: {
    padding: wp(4),
    backgroundColor: '#e3f2fd',
    borderBottomWidth: 1,
    borderBottomColor: '#bbdefb',
    alignItems: 'center',
  },
  waitingText: {
    marginTop: hp(1),
    fontSize: hp(1.4),
    color: '#1976d2',
    textAlign: 'center',
    fontWeight: '500',
  },
  webViewContainer: {
    flex: 1,
    position: 'relative',
  },
  webView: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'white',
    zIndex: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingHint: {
    marginTop: hp(2),
    fontSize: hp(1.4),
    color: theme.colors.textLight,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.5),
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#f8f9fa',
  },
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
  },
  securityText: {
    fontSize: hp(1.4),
    color: '#27ae60',
    fontWeight: '500',
  },
  processingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(1),
    paddingHorizontal: wp(2),
    paddingVertical: hp(0.5),
    backgroundColor: '#fff3cd',
    borderRadius: 10,
  },
  processingStatusText: {
    fontSize: hp(1.2),
    color: '#856404',
    fontWeight: '500',
  },
  linkingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(1),
    paddingHorizontal: wp(2),
    paddingVertical: hp(0.5),
    backgroundColor: '#e3f2fd',
    borderRadius: 10,
  },
  linkingText: {
    fontSize: hp(1.2),
    color: '#007AFF',
    fontWeight: '500',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(1),
    paddingHorizontal: wp(3),
    paddingVertical: hp(1),
    backgroundColor: 'white',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  backButtonText: {
    fontSize: hp(1.4),
    color: theme.colors.primary,
    fontWeight: '500',
  },
});

export default VNPayWebView;
import { useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { validateVNPayResponse } from '../helper/vnpayHelper';
import { handleVNPayReturn } from '../services/vnpayService';

export const useExpoVNPayLinking = () => {
  const router = useRouter();

  // ✅ HANDLE VNPAY DEEP LINK
  const handleVNPayDeepLink = useCallback(async (url) => {
    console.log('🔗 Expo Linking - VNPay URL received:', url);
    
    try {
      if (!url || !url.includes('vnpay-return')) {
        console.log('🔄 URL không phải VNPay return:', url);
        return;
      }

      console.log('💳 Processing VNPay return với Expo Linking...');
      
      // ✅ PARSE URL PARAMETERS
      const parsed = Linking.parse(url);
      console.log('📱 Parsed URL:', parsed);

      const params = parsed.queryParams || {};
      console.log('📱 VNPay return params:', params);

      if (Object.keys(params).length === 0) {
        throw new Error('Không tìm thấy parameters trong URL');
      }

      // ✅ VALIDATE VNPAY RESPONSE
      const validation = validateVNPayResponse(params);
      console.log('🔍 VNPay validation result:', validation);

      if (validation.success) {
        const { data: vnpayData } = validation;
        
        if (vnpayData.isSuccess) {
          console.log('✅ Payment successful với Expo Linking:', vnpayData);
          
          // ✅ PROCESS PAYMENT RESULT
          try {
            const processResult = await handleVNPayReturn(params);
            console.log('💾 Payment processing result:', processResult);
          } catch (processError) {
            console.error('❌ Process payment error:', processError);
          }
          
          // ✅ SHOW SUCCESS ALERT
          Alert.alert(
            '🎉 Thanh toán thành công!',
            `Mã đơn hàng: ${vnpayData.orderId}\nSố tiền: ${vnpayData.amount.toLocaleString('vi-VN')} VND\n\nCảm ơn bạn đã sử dụng dịch vụ BunChaObama!`,
            [
              {
                text: 'Xem lịch sử',
                style: 'default',
                onPress: () => {
                  try {
                    router.push('/main/(tabs)/historyScr');
                  } catch (navError) {
                    console.error('Navigation error:', navError);
                    router.replace('/main/(tabs)/historyScr');
                  }
                }
              },
              {
                text: 'Về trang chủ',
                style: 'cancel',
                onPress: () => {
                  try {
                    router.push('/main/(tabs)');
                  } catch (navError) {
                    console.error('Navigation error:', navError);
                    router.replace('/main/(tabs)');
                  }
                }
              }
            ]
          );
          
        } else {
          console.log('❌ Payment failed với Expo Linking:', vnpayData);
          
          let failureMessage = vnpayData.message || 'Thanh toán không thành công';
          
          // ✅ HANDLE SPECIFIC ERROR CODES
          switch (vnpayData.responseCode) {
            case '24':
              failureMessage = 'Bạn đã hủy giao dịch';
              break;
            case '11':
              failureMessage = 'Đã hết hạn chờ thanh toán';
              break;
            case '51':
              failureMessage = 'Tài khoản không đủ số dư';
              break;
            case '65':
              failureMessage = 'Tài khoản đã vượt quá hạn mức giao dịch';
              break;
            case '12':
              failureMessage = 'Thẻ/Tài khoản bị khóa';
              break;
            case '13':
              failureMessage = 'Sai mật khẩu xác thực giao dịch (OTP)';
              break;
            case '79':
              failureMessage = 'Nhập sai mật khẩu thanh toán quá số lần quy định';
              break;
            case '75':
              failureMessage = 'Ngân hàng thanh toán đang bảo trì';
              break;
            default:
              break;
          }
          
          Alert.alert(
            '❌ Thanh toán thất bại',
            `Mã đơn hàng: ${vnpayData.orderId}\nLý do: ${failureMessage}\n\nVui lòng thử lại hoặc liên hệ hỗ trợ.`,
            [
              {
                text: 'Thử lại',
                style: 'default',
                onPress: () => {
                  try {
                    router.push('/main/assignTableScr');
                  } catch (navError) {
                    console.error('Navigation error:', navError);
                    router.replace('/main/assignTableScr');
                  }
                }
              },
              {
                text: 'Về trang chủ',
                style: 'cancel',
                onPress: () => {
                  try {
                    router.push('/main/(tabs)');
                  } catch (navError) {
                    console.error('Navigation error:', navError);
                    router.replace('/main/(tabs)');
                  }
                }
              }
            ]
          );
        }
      } else {
        // ❌ INVALID SIGNATURE
        console.error('❌ Invalid VNPay signature:', validation.message);
        
        Alert.alert(
          '⚠️ Lỗi xác thực thanh toán',
          'Không thể xác thực thông tin thanh toán từ VNPay.\n\nCó thể dữ liệu đã bị thay đổi trong quá trình truyền tải.\n\nVui lòng kiểm tra lại giao dịch trong lịch sử hoặc liên hệ hỗ trợ.',
          [
            {
              text: 'Kiểm tra lịch sử',
              style: 'default',
              onPress: () => {
                try {
                  router.push('/main/(tabs)/historyScr');
                } catch (navError) {
                  console.error('Navigation error:', navError);
                  router.replace('/main/(tabs)/historyScr');
                }
              }
            },
            {
              text: 'Liên hệ hỗ trợ',
              style: 'default',
              onPress: () => {
                console.log('Contact support requested');
                // TODO: Implement support contact
              }
            },
            {
              text: 'OK',
              style: 'cancel',
              onPress: () => {
                try {
                  router.push('/main/(tabs)');
                } catch (navError) {
                  console.error('Navigation error:', navError);
                  router.replace('/main/(tabs)');
                }
              }
            }
          ]
        );
      }
      
    } catch (error) {
      console.error('❌ Expo Linking VNPay processing error:', error);
      
      Alert.alert(
        '⚠️ Lỗi xử lý thanh toán',
        `Đã có lỗi xảy ra khi xử lý kết quả thanh toán:\n\n${error.message}\n\nVui lòng kiểm tra lại trong lịch sử giao dịch hoặc liên hệ hỗ trợ.`,
        [
          {
            text: 'Kiểm tra lịch sử',
            style: 'default',
            onPress: () => {
              try {
                router.push('/main/(tabs)/historyScr');
              } catch (navError) {
                console.error('Navigation error:', navError);
                router.replace('/main/(tabs)/historyScr');
              }
            }
          },
          {
            text: 'Liên hệ hỗ trợ',
            style: 'default',
            onPress: () => {
              console.log('Contact support requested');
              // TODO: Implement support contact
            }
          },
          {
            text: 'OK',
            style: 'cancel',
            onPress: () => {
              try {
                router.push('/main/(tabs)');
              } catch (navError) {
                console.error('Navigation error:', navError);
                router.replace('/main/(tabs)');
              }
            }
          }
        ]
      );
    }
  }, [router]);

  // ✅ SETUP EXPO LINKING LISTENERS
  useEffect(() => {
    let subscription;
    
    const setupExpoLinking = async () => {
      try {
        // ✅ CHECK INITIAL URL
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          console.log('🚀 Expo Linking - Initial URL detected:', initialUrl);
          
          // ✅ Delay để đảm bảo app đã load hoàn toàn
          setTimeout(() => {
            handleVNPayDeepLink(initialUrl);
          }, 3000);
        }
      } catch (error) {
        console.error('❌ Error getting initial URL:', error);
      }

      // ✅ LISTEN FOR URL EVENTS
      subscription = Linking.addEventListener('url', (event) => {
        console.log('🔄 Expo Linking - URL event received:', event.url);
        
        // ✅ Small delay để đảm bảo UI ready
        setTimeout(() => {
          handleVNPayDeepLink(event.url);
        }, 1000);
      });
    };

    setupExpoLinking();

    // ✅ CLEANUP
    return () => {
      if (subscription && subscription.remove) {
        subscription.remove();
      }
    };
  }, [handleVNPayDeepLink]);

  // ✅ TEST FUNCTION FOR DEVELOPMENT
  const testExpoDeepLink = useCallback((testUrl) => {
    console.log('🧪 Testing Expo deep link:', testUrl);
    handleVNPayDeepLink(testUrl);
  }, [handleVNPayDeepLink]);

  // ✅ CHECK SCHEME SUPPORT
  const checkSchemeSupport = useCallback(async () => {
    try {
      const testUrl = 'bunchaobama://test';
      const supported = await Linking.canOpenURL(testUrl);
      
      console.log('🔍 Expo Scheme support check:', {
        url: testUrl,
        supported
      });

      return supported;
    } catch (error) {
      console.error('❌ Scheme support check error:', error);
      return false;
    }
  }, []);

  return { 
    handleVNPayDeepLink,
    testExpoDeepLink,
    checkSchemeSupport
  };
};
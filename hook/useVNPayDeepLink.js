import { useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { validateVNPayResponse } from '../helper/vnpayHelper';
import { handleVNPayReturn } from '../services/vnpayService';

export const useExpoVNPayLinking = () => {
  const router = useRouter();

  // ✅ HANDLE VNPAY DEEP LINK - THÊM XỬ LÝ LỖI CHO REMAINING PAYMENT
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

          // ✅ PROCESS PAYMENT RESULT VỚI XỬ LÝ LỖI
          try {
            const processResult = await handleVNPayReturn(params);
            console.log('💾 Payment processing result:', processResult);

            if (!processResult.success) {
              // ✅ XỬ LÝ LỖI PROCESSING NHƯNG PAYMENT THÀNH CÔNG
              console.error('❌ Processing failed but payment was successful:', processResult.message);

              Alert.alert(
                '⚠️ Cảnh báo thanh toán',
                `Thanh toán đã thành công nhưng có lỗi khi cập nhật dữ liệu:\n\n${processResult.message}\n\n` +
                `Vui lòng kiểm tra lại trong lịch sử giao dịch hoặc liên hệ hỗ trợ.`,
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
                      console.log('Contact support requested for processing error');
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
              return;
            }

          } catch (processError) {
            console.error('❌ Critical processing error:', processError);

            // ✅ XỬ LÝ LỖI CRITICAL PROCESSING
            Alert.alert(
              '⚠️ Lỗi xử lý thanh toán',
              `Thanh toán đã thành công nhưng có lỗi nghiêm trọng khi xử lý:\n\n${processError.message}\n\n` +
              `Vui lòng liên hệ hỗ trợ ngay lập tức với thông tin sau:\n` +
              `- Mã giao dịch: ${vnpayData.transactionNo || vnpayData.orderId}\n` +
              `- Số tiền: ${vnpayData.amount?.toLocaleString('vi-VN')}đ`,
              [
                {
                  text: 'Sao chép thông tin',
                  style: 'default',
                  onPress: () => {
                    // TODO: Copy to clipboard
                    console.log('Copy transaction info to clipboard');
                  }
                },
                {
                  text: 'Liên hệ hỗ trợ',
                  style: 'default',
                  onPress: () => {
                    console.log('Contact support requested for critical error');
                    // TODO: Implement urgent support contact
                  }
                },
                {
                  text: 'Kiểm tra lịch sử',
                  style: 'cancel',
                  onPress: () => {
                    try {
                      router.push('/main/(tabs)/historyScr');
                    } catch (navError) {
                      console.error('Navigation error:', navError);
                      router.replace('/main/(tabs)/historyScr');
                    }
                  }
                }
              ]
            );
            return;
          }

          // ✅ SUCCESS ALERT VỚI XỬ LÝ PAYMENT TYPE
          const isRemainingPayment = processResult.data?.payment?.bill_data?.remainingAmount;
          const paymentTypeText = isRemainingPayment
            ? 'Thanh toán phần còn lại đã hoàn tất!'
            : 'Đặt bàn đã hoàn tất!';

          Alert.alert(
            '🎉 Thanh toán thành công!',
            `${paymentTypeText}\n\n` +
            `Mã đơn hàng: ${vnpayData.orderId}\n` +
            `Số tiền: ${vnpayData.amount.toLocaleString('vi-VN')} VND\n` +
            `Mã giao dịch: ${vnpayData.transactionNo || 'N/A'}\n` +
            `Ngân hàng: ${vnpayData.bankCode || 'N/A'}\n\n` +
            `Cảm ơn bạn đã sử dụng dịch vụ BunChaObama!`,
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
          let failureTitle = '❌ Thanh toán thất bại';

          // ✅ HANDLE SPECIFIC ERROR CODES VỚI XỬ LÝ LỖI REMAINING PAYMENT
          switch (vnpayData.responseCode) {
            case '24':
              failureMessage = 'Bạn đã hủy giao dịch';
              failureTitle = '🚫 Giao dịch đã hủy';
              break;
            case '11':
              failureMessage = 'Đã hết hạn chờ thanh toán';
              failureTitle = '⏰ Hết thời gian';
              break;
            case '51':
              failureMessage = 'Tài khoản không đủ số dư';
              failureTitle = '💳 Không đủ số dư';
              break;
            case '65':
              failureMessage = 'Tài khoản đã vượt quá hạn mức giao dịch';
              failureTitle = '🚫 Vượt hạn mức';
              break;
            case '12':
              failureMessage = 'Thẻ/Tài khoản bị khóa';
              failureTitle = '🔒 Tài khoản bị khóa';
              break;
            case '13':
              failureMessage = 'Sai mật khẩu xác thực giao dịch (OTP)';
              failureTitle = '🔐 Sai OTP';
              break;
            case '79':
              failureMessage = 'Nhập sai mật khẩu thanh toán quá số lần quy định';
              failureTitle = '🚫 Sai mật khẩu';
              break;
            case '75':
              failureMessage = 'Ngân hàng thanh toán đang bảo trì';
              failureTitle = '🔧 Ngân hàng bảo trì';
              break;
            default:
              break;
          }

          // ✅ FAILURE ALERT VỚI OPTIONS DỰA TRÊN PAYMENT TYPE
          const isRemainingPayment = vnpayData.orderInfo?.includes('phan con lai') ||
                                    vnpayData.orderInfo?.includes('remaining');
          const paymentTypePrefix = isRemainingPayment
            ? 'Thanh toán phần còn lại thất bại'
            : 'Đặt bàn thất bại';

          const alertButtons = [
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
          ];

          // ✅ THÊM BUTTON THỬ LẠI CHO REMAINING PAYMENT
          if (isRemainingPayment) {
            alertButtons.unshift({
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
            });
          } else {
            alertButtons.unshift({
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
            });
          }

          Alert.alert(
            failureTitle,
            `${paymentTypePrefix}\n\n` +
            `Mã đơn hàng: ${vnpayData.orderId}\n` +
            `Lý do: ${failureMessage}\n` +
            `Mã lỗi: ${vnpayData.responseCode}\n\n` +
            `Vui lòng thử lại hoặc liên hệ hỗ trợ.`,
            alertButtons
          );
        }
      } else {
        // ❌ INVALID SIGNATURE VỚI XỬ LÝ LỖI
        console.error('❌ Invalid VNPay signature:', validation.message);

        Alert.alert(
          '⚠️ Lỗi xác thực thanh toán',
          'Không thể xác thực thông tin thanh toán từ VNPay.\n\n' +
          'Có thể dữ liệu đã bị thay đổi trong quá trình truyền tải.\n\n' +
          'Vui lòng kiểm tra lại giao dịch trong lịch sử hoặc liên hệ hỗ trợ.',
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
                console.log('Contact support requested for signature validation error');
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

      // ✅ XỬ LÝ LỖI EXCEPTION VỚI CONTEXT
      let errorContext = '';
      if (error.message?.includes('network')) {
        errorContext = '\n\nLỗi này có thể do kết nối mạng không ổn định.';
      } else if (error.message?.includes('timeout')) {
        errorContext = '\n\nLỗi này có thể do thời gian chờ quá lâu.';
      } else if (error.message?.includes('parse')) {
        errorContext = '\n\nLỗi này có thể do dữ liệu trả về không đúng định dạng.';
      }

      Alert.alert(
        '⚠️ Lỗi xử lý thanh toán',
        `Đã có lỗi xảy ra khi xử lý kết quả thanh toán:\n\n${error.message}${errorContext}\n\n` +
        `Vui lòng kiểm tra lại trong lịch sử giao dịch hoặc liên hệ hỗ trợ.`,
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
              console.log('Contact support requested for exception error');
              // TODO: Implement support contact with error details
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

  // ✅ SETUP EXPO LINKING LISTENERS VỚI XỬ LÝ LỖI
  useEffect(() => {
    let subscription;

    const setupExpoLinking = async () => {
      try {
        // ✅ CHECK INITIAL URL VỚI XỬ LÝ LỖI
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          console.log('🚀 Expo Linking - Initial URL detected:', initialUrl);

          // ✅ Delay để đảm bảo app đã load hoàn toàn
          setTimeout(() => {
            try {
              handleVNPayDeepLink(initialUrl);
            } catch (error) {
              console.error('❌ Error handling initial URL:', error);
            }
          }, 3000);
        }
      } catch (error) {
        console.error('❌ Error getting initial URL:', error);
      }

      // ✅ LISTEN FOR URL EVENTS VỚI XỬ LÝ LỖI
      try {
        subscription = Linking.addEventListener('url', (event) => {
          console.log('🔄 Expo Linking - URL event received:', event.url);

          // ✅ Small delay để đảm bảo UI ready
          setTimeout(() => {
            try {
              handleVNPayDeepLink(event.url);
            } catch (error) {
              console.error('❌ Error handling URL event:', error);

              // ✅ FALLBACK ERROR ALERT
              Alert.alert(
                '⚠️ Lỗi xử lý',
                'Có lỗi xảy ra khi xử lý liên kết thanh toán. Vui lòng thử lại.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      try {
                        router.push('/main/(tabs)');
                      } catch (navError) {
                        console.error('Navigation error:', navError);
                      }
                    }
                  }
                ]
              );
            }
          }, 1000);
        });
      } catch (error) {
        console.error('❌ Error setting up URL listener:', error);
      }
    };

    setupExpoLinking();

    // ✅ CLEANUP VỚI XỬ LÝ LỖI
    return () => {
      try {
        if (subscription && subscription.remove) {
          subscription.remove();
        }
      } catch (error) {
        console.error('❌ Error cleaning up URL listener:', error);
      }
    };
  }, [handleVNPayDeepLink]);

  // ✅ TEST FUNCTION FOR DEVELOPMENT VỚI XỬ LÝ LỖI
  const testExpoDeepLink = useCallback((testUrl) => {
    console.log('🧪 Testing Expo deep link:', testUrl);

    try {
      handleVNPayDeepLink(testUrl);
    } catch (error) {
      console.error('❌ Error in test deep link:', error);
      Alert.alert(
        'Test Error',
        `Error testing deep link: ${error.message}`,
        [{ text: 'OK' }]
      );
    }
  }, [handleVNPayDeepLink]);

  // ✅ CHECK SCHEME SUPPORT VỚI XỬ LÝ LỖI
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

  // ✅ THÊM FUNCTION HANDLE PAYMENT ERROR CHO REMAINING PAYMENT
  const handleRemainingPaymentError = useCallback((errorData) => {
    console.log('❌ Handling remaining payment error:', errorData);

    let errorMessage = 'Thanh toán phần còn lại thất bại';
    let actionText = 'Thử lại';

    if (errorData.error === 'user_cancelled') {
      errorMessage = 'Bạn đã hủy thanh toán phần còn lại';
      actionText = 'Quay lại';
    } else if (errorData.error === 'insufficient_funds') {
      errorMessage = 'Tài khoản không đủ số dư để thanh toán phần còn lại';
      actionText = 'Kiểm tra tài khoản';
    } else if (errorData.error === 'payment_expired') {
      errorMessage = 'Phiên thanh toán đã hết hạn';
      actionText = 'Thử lại';
    }

    Alert.alert(
      '❌ Lỗi thanh toán phần còn lại',
      `${errorMessage}\n\nBạn có thể thử lại hoặc thanh toán tại quầy khi đến nhà hàng.`,
      [
        {
          text: 'Thanh toán tại quầy',
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
          text: actionText,
          style: 'cancel',
          onPress: () => {
            try {
              router.push('/main/(tabs)/historyScr');
            } catch (navError) {
              console.error('Navigation error:', navError);
              router.replace('/main/(tabs)/historyScr');
            }
          }
        }
      ]
    );
  }, [router]);

  return {
    handleVNPayDeepLink,
    testExpoDeepLink,
    checkSchemeSupport,
    handleRemainingPaymentError // ✅ EXPORT THÊM FUNCTION MỚI
  };
};
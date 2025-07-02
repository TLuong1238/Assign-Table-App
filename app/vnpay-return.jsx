import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { validateVNPayResponse } from '../helper/vnpayHelper';
import { handleVNPayReturn } from '../services/vnpayService';

const VNPayReturnHandler = () => {
  const params = useLocalSearchParams();
  const router = useRouter();
  const [processing, setProcessing] = useState(true);
  const [message, setMessage] = useState('Đang xử lý kết quả thanh toán...');

  useEffect(() => {
    console.log('💳 VNPay return handler received params:', params);
    
    const processVNPayReturn = async () => {
      try {
        setProcessing(true);
        setMessage('Đang xác thực thông tin thanh toán...');

        // ✅ Check if we have VNPay params
        const hasVNPayParams = params.vnp_ResponseCode || params.vnp_TxnRef;
        
        if (!hasVNPayParams) {
          console.log('ℹ️ No VNPay params found, redirecting to main');
          router.replace('/main/(tabs)');
          return;
        }

        // ✅ Use existing deep link handler if available
        if (global.testExpoGoVNPayDeepLink) {
          console.log('🔗 Using global deep link handler');
          setMessage('Đang xử lý qua deep link handler...');
          
          const url = `exp+bunchaobama://vnpay-return?${new URLSearchParams(params).toString()}`;
          global.testExpoGoVNPayDeepLink(url);
          
          // ✅ Wait a moment then redirect
          setTimeout(() => {
            router.replace('/main/(tabs)');
          }, 3000);
          
        } else {
          console.log('🔧 Processing VNPay return directly');
          setMessage('Đang xác thực chữ ký điện tử...');
          
          // ✅ Direct processing fallback
          const validation = validateVNPayResponse(params);
          
          if (validation.success) {
            const { data: vnpayData } = validation;
            
            setMessage('Đang cập nhật trạng thái giao dịch...');
            
            if (vnpayData.isSuccess) {
              // ✅ Process successful payment
              try {
                const processResult = await handleVNPayReturn(params);
                console.log('💾 Payment processing result:', processResult);
                
                setMessage('✅ Thanh toán thành công!');
                
                setTimeout(() => {
                  Alert.alert(
                    '🎉 Thanh toán thành công!',
                    `Mã đơn hàng: ${vnpayData.orderId}\nSố tiền: ${vnpayData.amount.toLocaleString('vi-VN')} VND\n\nCảm ơn bạn đã sử dụng dịch vụ!`,
                    [
                      {
                        text: 'Xem lịch sử',
                        style: 'default',
                        onPress: () => router.replace('/main/(tabs)/historyScr')
                      },
                      {
                        text: 'Về trang chủ',
                        style: 'cancel',
                        onPress: () => router.replace('/main/(tabs)')
                      }
                    ]
                  );
                }, 1000);
                
              } catch (processError) {
                console.error('❌ Payment processing error:', processError);
                setMessage('⚠️ Lỗi xử lý giao dịch');
                
                setTimeout(() => {
                  Alert.alert(
                    '⚠️ Lỗi xử lý',
                    'Có lỗi xảy ra khi xử lý giao dịch. Vui lòng kiểm tra lại trong lịch sử.',
                    [{ text: 'OK', onPress: () => router.replace('/main/(tabs)') }]
                  );
                }, 1000);
              }
              
            } else {
              // ✅ Payment failed
              setMessage('❌ Thanh toán thất bại');
              
              setTimeout(() => {
                Alert.alert(
                  '❌ Thanh toán thất bại',
                  `Mã đơn hàng: ${vnpayData.orderId}\nLý do: ${vnpayData.message}\n\nVui lòng thử lại.`,
                  [
                    {
                      text: 'Thử lại',
                      style: 'default',
                      onPress: () => router.replace('/main/assignTableScr')
                    },
                    {
                      text: 'Về trang chủ',
                      style: 'cancel',
                      onPress: () => router.replace('/main/(tabs)')
                    }
                  ]
                );
              }, 1000);
            }
            
          } else {
            // ✅ Validation failed
            console.error('❌ VNPay validation failed:', validation.message);
            setMessage('❌ Xác thực thất bại');
            
            setTimeout(() => {
              Alert.alert(
                '⚠️ Lỗi xác thực',
                'Không thể xác thực thông tin thanh toán. Vui lòng kiểm tra lại giao dịch.',
                [{ text: 'OK', onPress: () => router.replace('/main/(tabs)') }]
              );
            }, 1000);
          }
        }
        
      } catch (error) {
        console.error('❌ VNPay return processing error:', error);
        setMessage('❌ Có lỗi xảy ra');
        
        setTimeout(() => {
          Alert.alert(
            '⚠️ Lỗi xử lý',
            `Đã có lỗi xảy ra: ${error.message}\n\nVui lòng kiểm tra lại trong lịch sử giao dịch.`,
            [{ text: 'OK', onPress: () => router.replace('/main/(tabs)') }]
          );
        }, 1000);
        
      } finally {
        setProcessing(false);
      }
    };

    // ✅ Process with slight delay to ensure proper mounting
    const timer = setTimeout(() => {
      processVNPayReturn();
    }, 500);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [params, router]);

  return (
    <View style={{ 
      flex: 1, 
      justifyContent: 'center', 
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.8)'
    }}>
      <View style={{
        backgroundColor: 'white',
        padding: 40,
        borderRadius: 20,
        alignItems: 'center',
        minWidth: 300,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: 4,
        },
        shadowOpacity: 0.25,
        shadowRadius: 6,
      }}>
        {/* ✅ VNPay Logo */}
        <View style={{
          width: 80,
          height: 80,
          backgroundColor: '#1976D2',
          borderRadius: 40,
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: 20
        }}>
          <Text style={{
            fontSize: 30,
            fontWeight: 'bold',
            color: 'white'
          }}>
            💳
          </Text>
        </View>

        {/* ✅ Loading Indicator */}
        {processing && (
          <ActivityIndicator size="large" color="#1976D2" style={{ marginBottom: 15 }} />
        )}
        
        {/* ✅ Processing Message */}
        <Text style={{
          fontSize: 16,
          fontWeight: 'bold',
          color: '#333',
          textAlign: 'center',
          marginBottom: 10
        }}>
          {message}
        </Text>

        {/* ✅ Sub Message */}
        <Text style={{
          fontSize: 14,
          color: '#666',
          textAlign: 'center',
          lineHeight: 20
        }}>
          {processing ? 
            'Vui lòng không tắt ứng dụng trong quá trình xử lý' : 
            'Đang chuyển hướng...'
          }
        </Text>

        {/* ✅ VNPay Branding */}
        <Text style={{
          marginTop: 20,
          fontSize: 12,
          color: '#999',
          textAlign: 'center'
        }}>
          Powered by VNPay
        </Text>
      </View>
    </View>
  );
};

export default VNPayReturnHandler;
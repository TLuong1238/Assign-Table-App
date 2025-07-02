import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
  ScrollView,
  // ❌ Xóa Image nếu không dùng
} from 'react-native';
import { theme } from '../constants/theme';
import { hp, wp } from '../helper/common';
import MyLoading from './MyLoading';
import { createPaymentUrl } from '../services/paymentService';
import * as Icon from 'react-native-feather';

const DemoPaymentModal = ({ 
  visible, 
  onClose, 
  billData,
  onPaymentSuccess,
  onPaymentFailure 
}) => {
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('vnpay');
  const [step, setStep] = useState(1); // 1: Info, 2: Processing, 3: Result

  const handlePayment = async () => {
    if (!billData) return;

    setLoading(true);
    setStep(2);
    
    try {
      // ✅ Tạo payment data
      const paymentData = {
        userId: billData.userId || 'demo_user',
        billId: billData.id,
        amount: billData.price || 100000,
        description: `Thanh toán đơn đặt bàn #${billData.id} - ${billData.name}`,
        orderType: 'billpayment'
      };

      console.log('🔄 Creating payment with data:', paymentData);

      // ✅ Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // ✅ Tạo payment URL
      const result = await createPaymentUrl(paymentData);
      
      if (result.success) {
        console.log('✅ Payment URL created successfully');
        console.log('🔗 Payment URL:', result.data.paymentUrl);
        console.log('📝 Order ID:', result.data.orderId);
        
        setLoading(false);
        
        // ✅ Hiển thị demo options
        showPaymentOptions(result.data);
        
      } else {
        throw new Error(result.message || 'Không thể tạo thanh toán');
      }
      
    } catch (error) {
      console.error('❌ Payment error:', error);
      setLoading(false);
      setStep(1);
      Alert.alert('Lỗi', 'Có lỗi xảy ra: ' + error.message);
    }
  };

  const showPaymentOptions = (paymentData) => {
    Alert.alert(
      '🎉 Tạo thanh toán thành công!',
      `Mã giao dịch: ${paymentData.orderId}\n\nTrong thực tế, bạn sẽ được chuyển đến VNPay. Chọn kết quả demo:`,
      [
        {
          text: 'Hủy',
          style: 'cancel',
          onPress: () => {
            setStep(1);
          }
        },
        {
          text: '🌐 Xem URL VNPay',
          onPress: () => {
            setStep(1);
            Alert.alert(
              '🔗 VNPay Payment URL',
              'URL thanh toán đã được tạo thành công!\n\nTrong production, URL này sẽ redirect user đến trang VNPay.',
              [
                {
                  text: 'Copy URL',
                  onPress: () => {
                    console.log('📋 VNPay URL copied:', paymentData.paymentUrl);
                    Alert.alert('✅', 'URL đã được log ra console');
                  }
                },
                { text: 'OK' }
              ]
            );
          }
        },
        {
          text: '✅ Demo Thành công',
          onPress: () => simulateSuccess(paymentData)
        },
        {
          text: '❌ Demo Thất bại',
          onPress: () => simulateFailure(paymentData)
        }
      ]
    );
  };

  const simulateSuccess = (paymentData) => {
    setStep(3);
    
    setTimeout(() => {
      Alert.alert(
        '🎉 Thanh toán thành công!',
        `Giao dịch ${paymentData.orderId} đã hoàn tất.\n\nSố tiền: ${billData.price?.toLocaleString('vi-VN') || '100,000'}đ\nPhương thức: VNPay\nTrạng thái: Thành công`,
        [
          {
            text: 'Xem lịch sử',
            onPress: () => {
              onClose();
              onPaymentSuccess?.(paymentData);
              console.log('✅ Navigate to payment history');
            }
          },
          {
            text: 'Về trang chủ',
            onPress: () => {
              onClose();
              onPaymentSuccess?.(paymentData);
              console.log('✅ Navigate to home');
            }
          }
        ]
      );
    }, 1500);
  };

  const simulateFailure = (paymentData) => {
    setStep(3);
    
    setTimeout(() => {
      const errorCodes = ['24', '51', '79', '11'];
      const randomCode = errorCodes[Math.floor(Math.random() * errorCodes.length)];
      
      Alert.alert(
        '❌ Thanh toán thất bại!',
        `Giao dịch ${paymentData.orderId} không thành công.\n\nMã lỗi: ${randomCode}\nLý do: ${getErrorMessage(randomCode)}`,
        [
          {
            text: 'Thử lại',
            onPress: () => {
              setStep(1);
              console.log('🔄 Retry payment');
            }
          },
          {
            text: 'Hủy',
            onPress: () => {
              onClose();
              onPaymentFailure?.({ 
                orderId: paymentData.orderId, 
                errorCode: randomCode 
              });
            }
          }
        ]
      );
    }, 1500);
  };

  const getErrorMessage = (code) => {
    const messages = {
      '24': 'Khách hàng hủy giao dịch',
      '51': 'Tài khoản không đủ số dư',
      '79': 'Nhập sai mật khẩu quá nhiều lần',
      '11': 'Hết hạn chờ thanh toán'
    };
    return messages[code] || 'Lỗi không xác định';
  };

  const renderPaymentInfo = () => (
    <ScrollView style={styles.scrollContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>💳 Thanh toán đơn đặt bàn</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Icon.X width={24} height={24} color={theme.colors.dark} />
        </TouchableOpacity>
      </View>

      {/* Bill Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📋 Thông tin đặt bàn</Text>
        <View style={styles.billCard}>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Mã đơn:</Text>
            <Text style={styles.value}>#{billData?.id}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Khách hàng:</Text>
            <Text style={styles.value}>{billData?.name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Số điện thoại:</Text>
            <Text style={styles.value}>{billData?.phone}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Số người:</Text>
            <Text style={styles.value}>{billData?.num_people} người</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Thời gian:</Text>
            <Text style={styles.value}>
              {billData?.time ? new Date(billData.time).toLocaleString('vi-VN') : 'N/A'}
            </Text>
          </View>
        </View>
      </View>

      {/* Amount Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💰 Chi tiết thanh toán</Text>
        <View style={styles.amountCard}>
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Phí đặt bàn:</Text>
            <Text style={styles.amountValue}>
              {billData?.price ? `${billData.price.toLocaleString('vi-VN')}đ` : '100,000đ'}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tổng thanh toán:</Text>
            <Text style={styles.totalValue}>
              {billData?.price ? `${billData.price.toLocaleString('vi-VN')}đ` : '100,000đ'}
            </Text>
          </View>
        </View>
      </View>

      {/* Payment Method */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🏦 Phương thức thanh toán</Text>
        
        <TouchableOpacity 
          style={[
            styles.paymentMethodCard,
            paymentMethod === 'vnpay' && styles.selectedMethod
          ]}
          onPress={() => setPaymentMethod('vnpay')}
        >
          <View style={styles.methodLeft}>
            <View style={styles.vnpayIcon}>
              <Text style={styles.vnpayIconText}>VNP</Text>
            </View>
            <View style={styles.methodInfo}>
              <Text style={styles.methodName}>VNPay</Text>
              <Text style={styles.methodDesc}>Internet Banking • Ví điện tử • Thẻ ATM</Text>
              <Text style={styles.methodNote}>Hỗ trợ: Vietcombank, Techcombank, BIDV, VietinBank...</Text>
            </View>
          </View>
          <View style={styles.radioContainer}>
            <View style={styles.radioButton}>
              {paymentMethod === 'vnpay' && <View style={styles.radioSelected} />}
            </View>
          </View>
        </TouchableOpacity>

        {/* Other payment methods (disabled for demo) */}
        <TouchableOpacity style={[styles.paymentMethodCard, styles.disabledMethod]}>
          <View style={styles.methodLeft}>
            <View style={[styles.vnpayIcon, { backgroundColor: '#6c757d' }]}>
              <Icon.CreditCard width={20} height={20} color="white" />
            </View>
            <View style={styles.methodInfo}>
              <Text style={[styles.methodName, { color: '#6c757d' }]}>Thẻ tín dụng</Text>
              <Text style={[styles.methodDesc, { color: '#6c757d' }]}>Visa • MasterCard • JCB</Text>
              <Text style={[styles.methodNote, { color: '#6c757d' }]}>Sắp ra mắt</Text>
            </View>
          </View>
          <View style={[styles.radioButton, { borderColor: '#6c757d' }]} />
        </TouchableOpacity>
      </View>

      {/* Demo Notice */}
      <View style={styles.demoNotice}>
        <Icon.Info width={20} height={20} color="#856404" />
        <View style={styles.demoContent}>
          <Text style={styles.demoTitle}>ℹ️ Chế độ Demo</Text>
          <Text style={styles.demoText}>
            • Đây là môi trường demo, không thực hiện giao dịch thật{'\n'}
            • Bạn có thể test cả trường hợp thành công và thất bại{'\n'}
            • URL VNPay sẽ được tạo thật nhưng không redirect{'\n'}
            • Trong production sẽ chuyển đến trang VNPay
          </Text>
        </View>
      </View>

      {/* Security Info */}
      <View style={styles.securityInfo}>
        <Icon.Shield width={16} height={16} color="#28a745" />
        <Text style={styles.securityText}>
          Giao dịch được bảo mật bởi VNPay SSL 256-bit
        </Text>
      </View>
    </ScrollView>
  );

  const renderProcessing = () => (
    <View style={styles.processingContainer}>
      <View style={styles.processingCard}>
        <MyLoading size="large" />
        <Text style={styles.processingTitle}>Đang tạo thanh toán...</Text>
        <Text style={styles.processingText}>
          Vui lòng đợi trong giây lát{'\n'}
          Hệ thống đang tạo liên kết thanh toán VNPay
        </Text>
        
        <View style={styles.processingSteps}>
          <View style={styles.stepItem}>
            <Icon.CheckCircle width={16} height={16} color="#28a745" />
            <Text style={styles.stepText}>Xác thực thông tin</Text>
          </View>
          <View style={styles.stepItem}>
            <MyLoading size="small" />
            <Text style={styles.stepText}>Tạo liên kết thanh toán</Text>
          </View>
          <View style={styles.stepItem}>
            <Icon.Clock width={16} height={16} color="#6c757d" />
            <Text style={[styles.stepText, { color: '#6c757d' }]}>Chuyển hướng VNPay</Text>
          </View>
        </View>
      </View>
    </View>
  );

  if (!billData) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {step === 1 && renderPaymentInfo()}
          {step === 2 && renderProcessing()}

          {/* Action Buttons */}
          {step === 1 && (
            <View style={styles.buttonContainer}>
              <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={onClose}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>Hủy</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.payButton, loading && styles.disabledButton]} 
                onPress={handlePayment}
                disabled={loading}
              >
                <Icon.CreditCard width={20} height={20} color="white" />
                <Text style={styles.payButtonText}>
                  Thanh toán {billData?.price ? `${billData.price.toLocaleString('vi-VN')}đ` : '100,000đ'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    maxHeight: hp(90),
    width: '100%',
  },
  scrollContainer: {
    maxHeight: hp(75),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: wp(5),
    paddingBottom: wp(3),
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: hp(2.5),
    fontWeight: 'bold',
    color: theme.colors.dark,
  },
  closeButton: {
    padding: wp(2),
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
  },
  section: {
    padding: wp(5),
    paddingTop: wp(3),
  },
  sectionTitle: {
    fontSize: hp(2),
    fontWeight: 'bold',
    color: theme.colors.dark,
    marginBottom: hp(1.5),
  },
  billCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: wp(4),
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp(1),
  },
  label: {
    fontSize: hp(1.7),
    color: theme.colors.text,
    flex: 1,
  },
  value: {
    fontSize: hp(1.7),
    color: theme.colors.dark,
    fontWeight: '600',
    flex: 1.5,
    textAlign: 'right',
  },
  amountCard: {
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    padding: wp(4),
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp(1),
  },
  amountLabel: {
    fontSize: hp(1.8),
    color: '#1565c0',
  },
  amountValue: {
    fontSize: hp(1.8),
    color: '#1565c0',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#bbdefb',
    marginVertical: hp(1),
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: hp(2),
    color: '#0d47a1',
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: hp(2.5),
    color: '#0d47a1',
    fontWeight: 'bold',
  },
  paymentMethodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: wp(4),
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e9ecef',
    marginBottom: hp(1.5),
  },
  selectedMethod: {
    borderColor: '#007bff',
    backgroundColor: '#e3f2fd',
  },
  disabledMethod: {
    opacity: 0.5,
  },
  methodLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  vnpayIcon: {
    width: 50,
    height: 50,
    backgroundColor: '#007bff',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: wp(3),
  },
  vnpayIconText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: hp(1.6),
  },
  methodInfo: {
    flex: 1,
  },
  methodName: {
    fontSize: hp(1.9),
    fontWeight: 'bold',
    color: theme.colors.dark,
  },
  methodDesc: {
    fontSize: hp(1.5),
    color: theme.colors.text,
    marginTop: hp(0.3),
  },
  methodNote: {
    fontSize: hp(1.3),
    color: theme.colors.textLight,
    marginTop: hp(0.2),
    fontStyle: 'italic',
  },
  radioContainer: {
    padding: wp(2),
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#007bff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#007bff',
  },
  demoNotice: {
    flexDirection: 'row',
    backgroundColor: '#fff3cd',
    margin: wp(5),
    marginTop: 0,
    padding: wp(4),
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  demoContent: {
    flex: 1,
    marginLeft: wp(3),
  },
  demoTitle: {
    fontSize: hp(1.7),
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: hp(0.5),
  },
  demoText: {
    fontSize: hp(1.5),
    color: '#856404',
    lineHeight: hp(2.2),
  },
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: wp(3),
    marginHorizontal: wp(5),
    backgroundColor: '#d4edda',
    borderRadius: 8,
    marginBottom: hp(2),
  },
  securityText: {
    fontSize: hp(1.4),
    color: '#155724',
    marginLeft: wp(2),
    fontWeight: '500',
  },
  processingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp(5),
  },
  processingCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: wp(8),
    alignItems: 'center',
    width: '100%',
  },
  processingTitle: {
    fontSize: hp(2.2),
    fontWeight: 'bold',
    color: theme.colors.dark,
    marginTop: hp(2),
    marginBottom: hp(1),
  },
  processingText: {
    fontSize: hp(1.6),
    color: theme.colors.text,
    textAlign: 'center',
    lineHeight: hp(2.3),
    marginBottom: hp(3),
  },
  processingSteps: {
    width: '100%',
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp(1.5),
    paddingHorizontal: wp(2),
  },
  stepText: {
    fontSize: hp(1.6),
    color: theme.colors.dark,
    marginLeft: wp(3),
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: wp(5),
    paddingTop: wp(3),
    gap: wp(3),
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingVertical: hp(1.8),
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  cancelButtonText: {
    color: '#6c757d',
    fontSize: hp(1.8),
    fontWeight: '600',
  },
  payButton: {
    flex: 2,
    backgroundColor: '#007bff',
    paddingVertical: hp(1.8),
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: wp(2),
  },
  disabledButton: {
    backgroundColor: '#6c757d',
    opacity: 0.6,
  },
  payButtonText: {
    color: 'white',
    fontSize: hp(1.8),
    fontWeight: 'bold',
  },
});

export default DemoPaymentModal;
// components/RefundModal.jsx - TẠO FILE MỚI
import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, Alert, ScrollView } from 'react-native';
import { StyleSheet } from 'react-native';
import { wp, hp } from '../helper/common';
import { theme } from '../constants/theme';
import * as Icon from 'react-native-feather';
import { VNPayRefundService } from '../services/vnpayRefundService';

const RefundModal = ({ visible, onClose, bill, onRefundSuccess }) => {
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [eligibility, setEligibility] = useState(null);
  if (!visible || !bill) return null;

  // ✅ REFUND REASONS
  const refundReasons = [
    'Khách hàng yêu cầu hủy',
    'Nhà hàng không thể phục vụ',
    'Thời tiết xấu',
    'Sự cố kỹ thuật',
    'Lý do cá nhân',
    'Khác'
  ];

  // ✅ CHECK ELIGIBILITY
  useEffect(() => {
    if (visible && bill && bill.id) {
      checkRefundEligibility();
    }
  }, [visible, bill]);

  const checkRefundEligibility = async () => {
    if (!bill || !bill.id) return;
    try {

      const result = await VNPayRefundService.validateRefundEligibility(bill.id);
      if (result.success) {
        setEligibility(result.data);
        if (result.data.canRefund) {
          setRefundAmount(result.data.maxRefundAmount.toString());
        }
      }
    } catch (error) {
      console.error('Check eligibility error:', error);
    }
  };

  // ✅ HANDLE REFUND
  // RefundModal.jsx - SỬA handleRefund
  const handleRefund = async () => {
    try {
      if (!refundAmount || !refundReason) {
        Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ thông tin');
        return;
      }

      const amount = parseFloat(refundAmount);
      if (isNaN(amount) || amount <= 0) {
        Alert.alert('Lỗi', 'Số tiền hoàn không hợp lệ');
        return;
      }

      if (amount > eligibility.maxRefundAmount) {
        Alert.alert('Lỗi', `Số tiền hoàn không thể vượt quá ${eligibility.maxRefundAmount.toLocaleString('vi-VN')}đ`);
        return;
      }

      setLoading(true);

      const refundData = {
        billId: bill.id,
        originalAmount: bill.total_amount || bill.deposit_amount,
        refundAmount: amount,
        refundReason: refundReason,
        userId: bill.userId,
        transactionNo: bill.payment_id
      };

      console.log('🔄 Sending refund request with data:', refundData);

      const result = await VNPayRefundService.simulateRefund(refundData);

      if (result.success) {
        console.log('✅ Refund service successful:', result.data);

        // ✅ TRUYỀN FULL DATA CHO SUCCESS CALLBACK
        const successData = {
          ...result.data,
          bill: bill,  // ✅ THÊM BILL INFO
          refundAmount: amount,
          refundReason: refundReason
        };

        Alert.alert(
          '✅ Hoàn tiền thành công!',
          `Đã hoàn ${amount.toLocaleString('vi-VN')}đ cho đơn hàng #${bill.id}\n\n` +
          `🏦 Mã giao dịch: ${result.data.vnpayResponse.vnp_RefundTransactionNo}\n` +
          `📱 Phương thức: VNPay Demo\n\n` +
          `Đơn hàng sẽ được hủy và bàn được giải phóng.`,
          [
            {
              text: 'OK',
              onPress: () => {
                // ✅ GỌI SUCCESS CALLBACK VỚI FULL DATA
                onRefundSuccess?.(successData);
                onClose();
              }
            }
          ]
        );
      } else {
        Alert.alert('Lỗi', result.message);
      }

    } catch (error) {
      console.error('❌ Refund error:', error);
      Alert.alert('Lỗi', 'Có lỗi xảy ra khi hoàn tiền: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!eligibility) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* ✅ HEADER */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Hoàn tiền đơn hàng</Text>
              <TouchableOpacity onPress={onClose}>
                <Icon.X width={24} height={24} color={theme.colors.textLight} />
              </TouchableOpacity>
            </View>

            {/* ✅ BILL INFO */}
            <View style={styles.billInfo}>
              <Text style={styles.billInfoTitle}>Thông tin đơn hàng</Text>
              <Text style={styles.billInfoText}>Mã đơn: {bill.id}</Text>
              <Text style={styles.billInfoText}>Khách hàng: {bill.name}</Text>
              <Text style={styles.billInfoText}>
                Tổng tiền: {bill.total_amount?.toLocaleString('vi-VN')}đ
              </Text>
              <Text style={styles.billInfoText}>
                Đã thanh toán: {(bill.deposit_amount || bill.total_amount)?.toLocaleString('vi-VN')}đ
              </Text>
            </View>

            {/* ✅ REFUND ELIGIBILITY */}
            {!eligibility.canRefund ? (
              <View style={styles.errorSection}>
                <Icon.AlertCircle width={20} height={20} color="#e74c3c" />
                <Text style={styles.errorText}>
                  Không thể hoàn tiền: {eligibility.reasons.join(', ')}
                </Text>
              </View>
            ) : (
              <>
                {/* ✅ REFUND AMOUNT */}
                <View style={styles.inputSection}>
                  <Text style={styles.inputLabel}>Số tiền hoàn</Text>
                  <TextInput
                    style={styles.amountInput}
                    value={refundAmount}
                    onChangeText={setRefundAmount}
                    placeholder="Nhập số tiền hoàn"
                    keyboardType="numeric"
                  />
                  <Text style={styles.maxAmountText}>
                    Tối đa: {eligibility.maxRefundAmount.toLocaleString('vi-VN')}đ
                  </Text>
                </View>

                {/* ✅ REFUND REASON */}
                <View style={styles.inputSection}>
                  <Text style={styles.inputLabel}>Lý do hoàn tiền</Text>
                  <View style={styles.reasonsContainer}>
                    {refundReasons.map((reason, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.reasonButton,
                          refundReason === reason && styles.selectedReasonButton
                        ]}
                        onPress={() => setRefundReason(reason)}
                      >
                        <Text
                          style={[
                            styles.reasonButtonText,
                            refundReason === reason && styles.selectedReasonButtonText
                          ]}
                        >
                          {reason}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* ✅ CUSTOM REASON */}
                {refundReason === 'Khác' && (
                  <View style={styles.inputSection}>
                    <Text style={styles.inputLabel}>Lý do cụ thể</Text>
                    <TextInput
                      style={styles.textInput}
                      value={refundReason}
                      onChangeText={setRefundReason}
                      placeholder="Nhập lý do cụ thể"
                      multiline
                      numberOfLines={3}
                    />
                  </View>
                )}



                {/* ✅ BUTTONS */}
                <View style={styles.buttonContainer}>
                  <TouchableOpacity
                    style={[styles.button, styles.cancelButton]}
                    onPress={onClose}
                  >
                    <Text style={styles.cancelButtonText}>Hủy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.button, styles.refundButton]}
                    onPress={handleRefund}
                    disabled={loading}
                  >
                    <Text style={styles.refundButtonText}>
                      {loading ? 'Đang xử lý...' : 'Hoàn tiền'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: wp(6),
    width: wp(90),
    maxHeight: hp(80),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp(2),
  },
  modalTitle: {
    fontSize: hp(2.4),
    fontWeight: 'bold',
    color: theme.colors.dark,
  },
  billInfo: {
    backgroundColor: '#f8f9fa',
    padding: wp(4),
    borderRadius: 12,
    marginBottom: hp(2),
  },
  billInfoTitle: {
    fontSize: hp(1.8),
    fontWeight: '600',
    color: theme.colors.dark,
    marginBottom: hp(1),
  },
  billInfoText: {
    fontSize: hp(1.6),
    color: theme.colors.text,
    marginBottom: hp(0.5),
  },
  errorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
    backgroundColor: '#ffeaea',
    padding: wp(4),
    borderRadius: 12,
    marginBottom: hp(2),
  },
  errorText: {
    fontSize: hp(1.6),
    color: '#e74c3c',
    flex: 1,
  },
  inputSection: {
    marginBottom: hp(2),
  },
  inputLabel: {
    fontSize: hp(1.8),
    fontWeight: '600',
    color: theme.colors.dark,
    marginBottom: hp(1),
  },
  amountInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: wp(4),
    fontSize: hp(1.8),
    backgroundColor: 'white',
  },
  maxAmountText: {
    fontSize: hp(1.4),
    color: theme.colors.textLight,
    marginTop: hp(0.5),
  },
  reasonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: wp(2),
  },
  reasonButton: {
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.8),
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectedReasonButton: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  reasonButtonText: {
    fontSize: hp(1.4),
    color: theme.colors.text,
  },
  selectedReasonButtonText: {
    color: 'white',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: wp(4),
    fontSize: hp(1.6),
    backgroundColor: 'white',
    textAlignVertical: 'top',
  },
  demoWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
    backgroundColor: '#fff8e1',
    padding: wp(4),
    borderRadius: 12,
    marginBottom: hp(2),
  },
  demoWarningText: {
    fontSize: hp(1.4),
    color: '#f39c12',
    flex: 1,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: wp(3),
    marginTop: hp(2),
  },
  button: {
    flex: 1,
    paddingVertical: hp(1.5),
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  refundButton: {
    backgroundColor: theme.colors.primary,
  },
  cancelButtonText: {
    fontSize: hp(1.8),
    color: theme.colors.text,
    fontWeight: '600',
  },
  refundButtonText: {
    fontSize: hp(1.8),
    color: 'white',
    fontWeight: '600',
  },
});

export default RefundModal;
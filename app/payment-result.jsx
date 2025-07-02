// app/payment-result.jsx
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { checkPaymentStatus } from '../services/paymentService';
import VNPayService from '../services/vnpayService';
import * as Icon from 'react-native-feather';
import { theme } from '../constants/theme';
import { hp, wp } from '../helper/common';

const PaymentResult = () => {
  const router = useRouter();
  const { status, orderId, code } = useLocalSearchParams();
  const [paymentData, setPaymentData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orderId) {
      loadPaymentData();
    }
  }, [orderId]);

  const loadPaymentData = async () => {
    try {
      const result = await checkPaymentStatus(orderId);
      if (result.success) {
        setPaymentData(result.data);
      }
    } catch (error) {
      console.error('Load payment data error:', error);
    } finally {
      setLoading(false);
    }
  };

  const isSuccess = status === 'success';
  const statusMessage = isSuccess 
    ? 'Thanh toán thành công!' 
    : VNPayService.getResponseMessage(code) || 'Thanh toán thất bại';

  return (
    <View style={styles.container}>
      <View style={styles.resultContainer}>
        {/* Icon */}
        <View style={[styles.iconContainer, isSuccess ? styles.successIcon : styles.failureIcon]}>
          {isSuccess ? (
            <Icon.CheckCircle width={hp(8)} height={hp(8)} color="white" />
          ) : (
            <Icon.XCircle width={hp(8)} height={hp(8)} color="white" />
          )}
        </View>

        {/* Status */}
        <Text style={[styles.statusText, isSuccess ? styles.successText : styles.failureText]}>
          {statusMessage}
        </Text>

        {/* Payment Info */}
        {paymentData && (
          <View style={styles.paymentInfo}>
            <Text style={styles.infoTitle}>Thông tin giao dịch</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Mã giao dịch:</Text>
              <Text style={styles.infoValue}>{paymentData.id}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Số tiền:</Text>
              <Text style={styles.infoValue}>{paymentData.amount.toLocaleString('vi-VN')}đ</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Thời gian:</Text>
              <Text style={styles.infoValue}>
                {new Date(paymentData.created_at).toLocaleString('vi-VN')}
              </Text>
            </View>
          </View>
        )}

        {/* Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace('/main')}
          >
            <Text style={styles.backButtonText}>Về trang chủ</Text>
          </TouchableOpacity>

          {isSuccess && (
            <TouchableOpacity
              style={styles.historyButton}
              onPress={() => router.replace('/main/(tabs)/historyScr')}
            >
              <Text style={styles.historyButtonText}>Xem lịch sử</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp(5),
  },
  resultContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: wp(8),
    alignItems: 'center',
    width: '100%',
    maxWidth: wp(90),
  },
  iconContainer: {
    width: hp(12),
    height: hp(12),
    borderRadius: hp(6),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: hp(3),
  },
  successIcon: {
    backgroundColor: '#28a745',
  },
  failureIcon: {
    backgroundColor: '#dc3545',
  },
  statusText: {
    fontSize: hp(2.5),
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: hp(3),
  },
  successText: {
    color: '#28a745',
  },
  failureText: {
    color: '#dc3545',
  },
  paymentInfo: {
    width: '100%',
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: wp(4),
    marginBottom: hp(3),
  },
  infoTitle: {
    fontSize: hp(2),
    fontWeight: 'bold',
    color: theme.colors.dark,
    marginBottom: hp(2),
    textAlign: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: hp(1),
  },
  infoLabel: {
    fontSize: hp(1.8),
    color: theme.colors.text,
  },
  infoValue: {
    fontSize: hp(1.8),
    fontWeight: '600',
    color: theme.colors.dark,
  },
  buttonContainer: {
    width: '100%',
    gap: hp(1.5),
  },
  backButton: {
    backgroundColor: theme.colors.gray,
    paddingVertical: hp(1.5),
    borderRadius: 10,
    alignItems: 'center',
  },
  backButtonText: {
    color: theme.colors.dark,
    fontSize: hp(1.8),
    fontWeight: '600',
  },
  historyButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: hp(1.5),
    borderRadius: 10,
    alignItems: 'center',
  },
  historyButtonText: {
    color: 'white',
    fontSize: hp(1.8),
    fontWeight: '600',
  },
});

export default PaymentResult;
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ScrollView, Alert, RefreshControl, StatusBar } from 'react-native';
import React, { useEffect, useState, useCallback, memo, useMemo } from 'react';
import ScreenWrapper from '../../../components/ScreenWrapper';
import { theme } from '../../../constants/theme';
import { hp, wp } from '../../../helper/common';
import * as Icon from 'react-native-feather';
import { supabase } from '../../../lib/supabase';
import MyLoading from '../../../components/MyLoading';
import VNPayWebView from '../../../components/VNPayWebView';
import { createVNPayPayment, handleVNPayReturn } from '../../../services/vnpayService';
import { useAuth } from '../../../context/AuthContext';

import RefundModal from '../../../components/RefundModal';
import { VNPayRefundService } from '../../../services/vnpayRefundService';


import { updateTableState } from '../../../services/tableService';
// ✅ PAYMENT STATUS CONSTANTS VÀ UTILITIES
const PAYMENT_STATUS = {
  PENDING: 'pending',
  DEPOSIT_PAID: 'deposit_paid',
  FULLY_PAID: 'fully_paid',
  COUNTER_PAYMENT: 'counter_payment',
  PENDING_COUNTER: 'pending_counter'
};

// historyScr.jsx - SỬA PaymentUtils (dòng 50-100)
// historyScr.jsx - SỬA PaymentUtils (KHÔNG dùng useMemo)
const PaymentUtils = {
  getPaymentStatusInfo: (paymentStatus, depositAmount, totalAmount, price) => {
    const currentTotal = price || totalAmount || 0;
    const deposit = depositAmount || 0;
    const remaining = currentTotal - deposit;

    switch (paymentStatus) {
      case PAYMENT_STATUS.PENDING:
        return {
          status: 'Chưa thanh toán',
          color: '#e74c3c',
          icon: 'AlertCircle',
          amount: currentTotal,
          amountText: `Cần thanh toán: ${currentTotal.toLocaleString('vi-VN')}đ`,
          bgColor: '#ffeaea',
          borderColor: '#ffb3b3',
          showTimeStatus: true
        };

      case PAYMENT_STATUS.DEPOSIT_PAID:
        return {
          status: 'Đã đặt cọc',
          color: '#f39c12',
          icon: 'Clock',
          amount: remaining,
          amountText: `Đã cọc: ${deposit.toLocaleString('vi-VN')}đ - Còn lại: ${remaining.toLocaleString('vi-VN')}đ`,
          bgColor: '#fff8e1',
          borderColor: '#ffe082',
          showTimeStatus: true
        };

      case PAYMENT_STATUS.FULLY_PAID:
        return {
          status: 'Đã thanh toán đủ',
          color: '#27ae60',
          icon: 'CheckCircle',
          amount: currentTotal,
          amountText: `Đã thanh toán: ${currentTotal.toLocaleString('vi-VN')}đ`,
          bgColor: '#e8f5e8',
          borderColor: '#90ee90',
          showTimeStatus: false
        };

      case PAYMENT_STATUS.COUNTER_PAYMENT:
        return {
          status: 'Thanh toán tại quầy',
          color: '#8e44ad',
          icon: 'Home',
          amount: currentTotal,
          amountText: `Thanh toán tại quầy: ${currentTotal.toLocaleString('vi-VN')}đ`,
          bgColor: '#f3e5f5',
          borderColor: '#ce93d8',
          showTimeStatus: false
        };

      default:
        return {
          status: 'Không xác định',
          color: '#95a5a6',
          icon: 'HelpCircle',
          amount: currentTotal,
          amountText: `Tổng tiền: ${currentTotal.toLocaleString('vi-VN')}đ`,
          bgColor: '#f5f5f5',
          borderColor: '#e0e0e0',
          showTimeStatus: true
        };
    }
  },

  getPaymentMethodInfo: (paymentMethod) => {
    switch (paymentMethod) {
      case 'vnpay':
        return { name: 'VNPay', icon: 'CreditCard', color: '#007AFF' };
      case 'counter':
        return { name: 'Tại quầy', icon: 'Home', color: '#8e44ad' };
      case 'cash':
        return { name: 'Tiền mặt', icon: 'DollarSign', color: '#27ae60' };
      case 'vip':
        return { name: 'VIP', icon: 'Star', color: '#f39c12' };
      default:
        return { name: 'Chưa chọn', icon: 'HelpCircle', color: '#95a5a6' };
    }
  }
};

// Constants for status mapping
const STATUS_CONFIG = {
  in_order: {
    on_process: { text: 'Đang chờ xử lý', color: '#e67e22', bgColor: '#fdf2e9' },
    visited: { text: 'Đã đến - Đang phục vụ', color: '#8e44ad', bgColor: '#f4ecf7' }
  },
  completed: {
    visited: { text: 'Hoàn thành', color: '#27ae60', bgColor: '#eafaf1' }
  },
  cancelled: {
    un_visited: { text: 'Đã hủy', color: '#e74c3c', bgColor: '#fdedec' }
  }
};

const BILL_STATUS = {
  WAITING: 'waiting',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

// ✅ TimeUtils - SỬA LOGIC THỜI GIAN VÀ THÊM LOGIC NÚT "ĐÃ ĐẾN"
const TimeUtils = {
  calculateTimeStatus: (timeString) => {
    const now = new Date();
    const billTime = new Date(timeString);
    const diffMs = billTime.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffMinutes = diffMs / (1000 * 60);

    if (diffMs < 0) {
      // ✅ QUÁ GIỜ - HIỂN THỊ SỐ PHÚT/GIỜ QUÁ
      const overdueMinutes = Math.abs(Math.floor(diffMinutes));
      const overdueHours = Math.floor(overdueMinutes / 60);
      const remainingMinutes = overdueMinutes % 60;

      let overdueText;
      if (overdueHours > 0) {
        overdueText = remainingMinutes > 0
          ? `Quá ${overdueHours}h ${remainingMinutes}p`
          : `Quá ${overdueHours} giờ`;
      } else {
        overdueText = `Quá ${overdueMinutes} phút`;
      }

      return {
        status: 'expired',
        text: overdueText,
        color: '#e74c3c',
        shouldAutoCancel: overdueMinutes >= 15, // ✅ TỰ ĐỘNG HỦY SAU 15 PHÚT
        overdueMinutes,
        canCancel: false, // ✅ KHÔNG CHO HỦY KHI QUÁ GIỜ
        canArrived: overdueMinutes <= 10 // ✅ CHỈ CHO ĐẾN TRONG 10 PHÚT ĐẦU
      };
    } else if (diffHours <= 2) {
      return {
        status: 'soon',
        text: `Còn ${Math.ceil(diffMinutes)} phút`,
        color: '#e67e22',
        canCancel: false, // ✅ KHÔNG CHO HỦY KHI CÒN < 2 TIẾNG
        canArrived: diffMinutes <= 10 // ✅ CHỈ CHO ĐẾN TRONG 10 PHÚT CUỐI
      };
    } else {
      return {
        status: 'normal',
        text: `Còn ${Math.ceil(diffHours)} giờ`,
        color: '#27ae60',
        canCancel: true, // ✅ CHO PHÉP HỦY KHI CÒN > 2 TIẾNG
        canArrived: false // ✅ KHÔNG CHO ĐẾN KHI CÒN QUÁ SỚM
      };
    }
  },

  // ✅ LOGIC HỦY ĐƠN - CHỈ 2 TRƯỜNG HỢP
  calculateCancelInfo: (billTime, depositAmount, paymentMethod) => {
    const now = new Date();
    const billTimeDate = new Date(billTime);
    const diffHours = (billTimeDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (diffHours >= 24) {
      // ✅ CHỈ HOÀN TIỀN KHI LÀ VNPAY
      const refundMessage = paymentMethod === 'vnpay'
        ? 'Hủy trước 24h - Hoàn 100% tiền'
        : 'Hủy trước 24h - Liên hệ quầy để được hỗ trợ';

      return {
        canCancel: true,
        message: refundMessage,
        canRefund: paymentMethod === 'vnpay'
      };
    } else if (diffHours >= 2) {
      return {
        canCancel: true,
        message: 'Hủy trong 24h - Không được hoàn tiền',
        canRefund: false
      };
    } else {
      return {
        canCancel: false,
        message: 'Không được hủy khi còn 2 tiếng nữa là đến thời gian đặt',
        canRefund: false
      };
    }
  },

  // ✅ THÊM FUNCTION KIỂM TRA THỜI GIAN CHO NÚT "ĐÃ ĐẾN"
  calculateArrivedInfo: (billTime) => {
    const now = new Date();
    const billTimeDate = new Date(billTime);
    const diffMinutes = (billTimeDate.getTime() - now.getTime()) / (1000 * 60);

    if (diffMinutes > 10) {
      return {
        canArrived: false,
        message: 'Chỉ có thể xác nhận đã đến trong vòng 10 phút trước giờ hẹn'
      };
    } else if (diffMinutes >= -10) {
      return {
        canArrived: true,
        message: 'Có thể xác nhận đã đến'
      };
    } else {
      return {
        canArrived: false,
        message: 'Đã quá 10 phút sau giờ hẹn'
      };
    }
  }
};

// ✅ PAYMENT INFO COMPONENT

// historyScr.jsx - SỬA PaymentInfoSection
const PaymentInfoSection = memo(({ item }) => {
  // ✅ MEMOIZE calculations với useMemo
  const paymentInfo = useMemo(() => {
    return PaymentUtils.getPaymentStatusInfo(
      item.payment_status,
      item.deposit_amount,
      item.total_amount,
      item.price
    );
  }, [item.payment_status, item.deposit_amount, item.total_amount, item.price]);

  const paymentMethodInfo = useMemo(() => {
    return PaymentUtils.getPaymentMethodInfo(item.payment_method);
  }, [item.payment_method]);

  return (
    <View style={[styles.paymentSection, {
      backgroundColor: paymentInfo.bgColor,
      borderColor: paymentInfo.borderColor
    }]}>
      {/* Payment Status */}
      <View style={styles.paymentStatusRow}>
        {React.createElement(Icon[paymentInfo.icon], {
          width: 18,
          height: 18,
          color: paymentInfo.color
        })}
        <Text style={[styles.paymentStatusText, { color: paymentInfo.color }]}>
          {paymentInfo.status}
        </Text>
      </View>

      {/* Payment Amount */}
      <Text style={styles.paymentAmountText}>
        {paymentInfo.amountText}
      </Text>

      {/* Payment Method */}
      {item.payment_method && (
        <View style={styles.paymentMethodRow}>
          {React.createElement(Icon[paymentMethodInfo.icon], {
            width: 16,
            height: 16,
            color: paymentMethodInfo.color
          })}
          <Text style={[styles.paymentMethodText, { color: paymentMethodInfo.color }]}>
            Phương thức: {paymentMethodInfo.name}
          </Text>
        </View>
      )}

      {/* Payment ID */}
      {item.payment_id && (
        <Text style={styles.paymentIdText}>
          Mã thanh toán: {item.payment_id}
        </Text>
      )}
    </View>
  );
});

// ✅ REMAINING PAYMENT COMPONENT
// historyScr.jsx - SỬA RemainingPaymentSection
const RemainingPaymentSection = memo(({ item, onPayRemaining }) => {
  // ✅ CHỈ HIỂN THỊ KHI payment_status = 'deposit_paid'
  if (item.payment_status !== PAYMENT_STATUS.DEPOSIT_PAID) {
    return null;
  }

  // ✅ SỬA: SỬ DỤNG price THAY VÌ total_amount
  const actualTotal = item.price || item.total_amount || 0; // ✅ PRICE FIRST
  const depositAmount = item.deposit_amount || 0;
  const remaining = actualTotal - depositAmount;


  // ✅ KHÔNG HIỂN THỊ NẾU KHÔNG CÓ TIỀN CÒN LẠI
  if (remaining <= 0) {
    return null;
  }

  console.log('✅ SHOWING REMAINING PAYMENT BUTTONS!');

  return (
    <View style={styles.remainingPaymentSection}>
      <View style={styles.remainingPaymentHeader}>
        <Icon.AlertTriangle width={20} height={20} color="#f39c12" />
        <Text style={styles.remainingPaymentTitle}>
          Cần thanh toán thêm
        </Text>
      </View>

      <Text style={styles.remainingAmountText}>
        {remaining.toLocaleString('vi-VN')}đ
      </Text>

      <View style={styles.remainingPaymentActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.payRemainingButton]}
          onPress={() => {
            console.log('🔘 VNPay button pressed for remaining:', remaining);
            onPayRemaining(item, remaining, 'vnpay');
          }}
        >
          <Icon.CreditCard width={16} height={16} color="white" />
          <Text style={styles.actionButtonText}>Thanh toán VNPay</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.counterPayButton]}
          onPress={() => {
            console.log('🔘 Counter button pressed for remaining:', remaining);
            onPayRemaining(item, remaining, 'counter');
          }}
        >
          <Icon.Home width={16} height={16} color="white" />
          <Text style={styles.actionButtonText}>Tại quầy</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});
// Components
const BillInfoRow = memo(({ icon, text, iconColor = theme.colors.textLight, textStyle = {} }) => (
  <View style={styles.billInfoRow}>
    {React.createElement(Icon[icon], {
      width: 16,
      height: 16,
      color: iconColor
    })}
    <Text style={[styles.billInfoText, textStyle]}>{text}</Text>
  </View>
));

const TablesSection = memo(({ details, getTableName }) => (
  <View style={styles.tablesSection}>
    <Text style={styles.tablesSectionTitle}>Bàn đã chọn:</Text>
    <View style={styles.tablesContainer}>
      {details.map((detail, index) => (
        <View key={index} style={styles.tableTag}>
          <Icon.Hash width={14} height={14} color={theme.colors.primary} />
          <Text style={styles.tableTagText}>{getTableName(detail.tableId)}</Text>
        </View>
      ))}
    </View>
  </View>
));

// ✅ ActionButtons - SỬA LOGIC HIỂN THỊ NÚT "ĐÃ ĐẾN"
// historyScr.jsx - SỬA ActionButtons component (dòng 420-500)
// historyScr.jsx - SỬA ActionButtons để đảm bảo logic đúng
const ActionButtons = memo(({ item, timeStatus, onCancel, onArrived, paymentInfo, openRefundModal }) => {
  // ✅ KHÔNG HIỂN THỊ NẾU ĐÃ ĐẾN HOẶC ĐÃ HỦY
  if (item.visit === 'visited' || item.state === 'cancelled') {
    return null;
  }

  // ✅ KHÔNG HIỂN THỊ NẾU QUÁ 15 PHÚT (SẼ TỰ ĐỘNG HỦY)
  if (timeStatus.shouldAutoCancel && paymentInfo.showTimeStatus) {
    return (
      <View style={styles.autoCancelSection}>
        <Icon.Clock width={20} height={20} color="#e74c3c" />
        <Text style={styles.autoCancelText}>
          Đơn hàng sẽ được tự động hủy do quá giờ hẹn 15 phút
        </Text>
      </View>
    );
  }

  const arrivedInfo = TimeUtils.calculateArrivedInfo(item.time);

  // ✅ LOGIC CHO NÚT HỦY/HOÀN TIỀN THÔNG MINH
  const getCancelRefundButtonInfo = () => {
    if (item.payment_status === PAYMENT_STATUS.COUNTER_PAYMENT) {
      return null;
    }

    if (timeStatus.canCancel === false) {
      return null;
    }

    if (!paymentInfo.showTimeStatus) {
      return null;
    }

    const billTime = new Date(item.time);
    const now = new Date();
    const diffHours = (billTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    // ✅ ĐIỀU KIỆN HOÀN TIỀN: ≥24h + đã thanh toán + VNPay
    const isPaid = (item.payment_status === 'deposit_paid' || item.payment_status === 'fully_paid');
    const isVNPay = item.payment_method === 'vnpay';
    const canRefund = isPaid && isVNPay && diffHours >= 24;

    console.log('🔍 Cancel/Refund button logic:', {
      billId: item.id,
      diffHours: diffHours,
      isPaid: isPaid,
      isVNPay: isVNPay,
      canRefund: canRefund,
      paymentStatus: item.payment_status,
      paymentMethod: item.payment_method
    });

    if (canRefund) {
      return {
        type: 'refund',
        icon: 'RefreshCw',
        text: 'Hủy & Hoàn tiền',
        color: '#f39c12',
        action: () => {
          console.log('🔄 Opening refund modal for bill:', item.id);
          openRefundModal(item);
        }
      };
    } else if (diffHours >= 2) {
      return {
        type: 'cancel',
        icon: 'X',
        text: 'Hủy đơn',
        color: '#e74c3c',
        action: () => onCancel(item, timeStatus)
      };
    }

    return null;
  };

  const cancelRefundButton = getCancelRefundButtonInfo();

  return (
    <View style={styles.actionButtons}>
      {/* ✅ NÚT HỦY/HOÀN TIỀN THÔNG MINH */}
      {cancelRefundButton && cancelRefundButton.type === 'refund' && (
        <TouchableOpacity
          style={styles.simpleRefundButton}
          onPress={cancelRefundButton.action}
          activeOpacity={0.85}
        >
          <Icon.RefreshCw width={16} height={16} color="#fff" />
          <Text style={styles.simpleRefundButtonText}>Hoàn tiền</Text>
        </TouchableOpacity>
      )}
      {cancelRefundButton && cancelRefundButton.type === 'cancel' && (
        <TouchableOpacity
          style={[styles.actionButton, styles.smartCancelButton]}
          onPress={cancelRefundButton.action}
          activeOpacity={0.85}
        >
          <Icon.X width={16} height={16} color="#fff" />
          <Text style={styles.actionButtonText}>Hủy đơn</Text>
        </TouchableOpacity>
      )}

      {/* ✅ NÚT ĐÃ ĐẾN */}
      {arrivedInfo.canArrived && (
        <TouchableOpacity
          style={[styles.actionButton, styles.arrivedButton]}
          onPress={() => onArrived(item)}
        >
          <Icon.Check width={16} height={16} color="white" />
          <Text style={styles.actionButtonText}>Đã đến</Text>
        </TouchableOpacity>
      )}

      {/* ✅ THÔNG BÁO KHI KHÔNG THỂ ĐẾN */}
      {!arrivedInfo.canArrived && !timeStatus.shouldAutoCancel && (
        <View style={styles.arrivedDisabledSection}>
          <Icon.Info width={18} height={18} color="#95a5a6" />
          <Text style={styles.arrivedDisabledText}>
            {arrivedInfo.message}
          </Text>
        </View>
      )}
    </View>
  );
});

const StatusSection = memo(({ billStatus, item }) => {
  if (billStatus === BILL_STATUS.COMPLETED) {
    return (
      <View style={styles.completedSection}>
        <Icon.CheckCircle width={20} height={20} color="#27ae60" />
        <Text style={styles.completedText}>
          Đơn hàng đã hoàn thành vào {new Date(item.updated_at).toLocaleString('vi-VN')}
        </Text>
      </View>
    );
  }

  if (billStatus === BILL_STATUS.CANCELLED) {
    return (
      <View style={styles.cancelledSection}>
        <Icon.XCircle width={20} height={20} color="#e74c3c" />
        <Text style={styles.cancelledText}>
          Đơn hàng đã bị hủy vào {new Date(item.updated_at).toLocaleString('vi-VN')}
        </Text>
      </View>
    );
  }

  return null;
});

const HistoryScr = () => {
  const { user } = useAuth();
  const [bills, setBills] = useState([]);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState('all');
  // ✅ VNPAY WEBVIEW STATE
  const [vnpayWebViewVisible, setVnpayWebViewVisible] = useState(false);
  const [vnpayUrl, setVnpayUrl] = useState('');
  const [currentPaymentData, setCurrentPaymentData] = useState(null);
  // 
  const [refundModal, setRefundModal] = useState({
    visible: false,
    bill: null
  });
  // REFUND 
  // historyScr.jsx - SỬA handleRefundSuccess
  const handleRefundSuccess = useCallback(async (refundData) => {
    try {
      console.log('✅ Refund success:', refundData);

      const billId = refundData.refund.bill_id;
      console.log('🔄 Updating bill status after refund:', billId);

      // ✅ TÌM BILL TRONG LOCAL STATE
      const billToUpdate = bills.find(b => b.id === billId);
      if (!billToUpdate) {
        console.error('❌ Bill not found in local state:', billId);
        await fetchBills(); // Fallback
        return;
      }

      // ✅ CẬP NHẬT TRẠNG THÁI BÀN THÀNH empty
      if (billToUpdate.details?.length > 0) {
        console.log('🪑 Updating table status to empty after refund for bill:', billId);

        for (const detail of billToUpdate.details) {
          try {
            const tableUpdateResult = await updateTableState(detail.tableId, 'empty');

            if (tableUpdateResult.success) {
              console.log(`✅ Table ${detail.tableId} updated to empty after refund`);
            } else {
              console.error(`❌ Failed to update table ${detail.tableId} after refund:`, tableUpdateResult.msg);
            }
          } catch (tableError) {
            console.error(`❌ Error updating table ${detail.tableId} after refund:`, tableError);
          }
        }
      }

      // ✅ CẬP NHẬT LOCAL STATE
      setBills(prev => prev.map(b =>
        b.id === billId
          ? {
            ...b,
            state: 'cancelled',
            visit: 'un_visited',
            refund_amount: refundData.refund.refund_amount,
            refund_status: 'completed',
            updated_at: new Date().toISOString()
          }
          : b
      ));

      console.log('✅ Bill status updated to cancelled in local state');

      // ✅ HIỂN THỊ THÔNG BÁO THÀNH CÔNG
      Alert.alert(
        '✅ Hoàn tiền & Hủy đơn thành công!',
        `Đơn hàng #${billId} đã được hủy và hoàn tiền thành công.\n\n` +
        `💰 Số tiền hoàn: ${refundData.refund.refund_amount.toLocaleString('vi-VN')}đ\n` +
        `🏦 Mã giao dịch: ${refundData.refund.refund_transaction_no}\n` +
        `📱 Phương thức: VNPay Demo\n\n` +
        [{ text: 'OK' }]
      );

    } catch (error) {
      console.error('❌ Error in handleRefundSuccess:', error);
      Alert.alert('Cảnh báo', 'Hoàn tiền thành công nhưng có lỗi cập nhật trạng thái. Vui lòng refresh lại trang.');

      // ✅ FALLBACK - REFRESH DATA
      await fetchBills();
    }
  }, [bills, fetchBills]);

  // historyScr.jsx - SỬA openRefundModal
  const openRefundModal = useCallback((bill) => {
    console.log('🔄 Opening refund modal for bill:', {
      id: bill.id,
      name: bill.name,
      paymentStatus: bill.payment_status,
      paymentMethod: bill.payment_method,
      depositAmount: bill.deposit_amount,
      totalAmount: bill.total_amount,
      time: bill.time
    });
    if (!bill || !bill.id) return;

    // ✅ VALIDATION TRƯỚC KHI MỞ MODAL
    if (!bill.id) {
      Alert.alert('Lỗi', 'Thông tin đơn hàng không hợp lệ');
      return;
    }

    if (bill.payment_status !== 'deposit_paid' && bill.payment_status !== 'fully_paid') {
      Alert.alert('Lỗi', 'Chỉ có thể hoàn tiền cho đơn hàng đã thanh toán');
      return;
    }

    if (bill.payment_method !== 'vnpay') {
      Alert.alert('Lỗi', 'Chỉ hỗ trợ hoàn tiền cho thanh toán VNPay');
      return;
    }

    const billTime = new Date(bill.time);
    const now = new Date();
    const diffHours = (billTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (diffHours < 24) {
      Alert.alert('Lỗi', 'Chỉ được hoàn tiền khi còn ít nhất 24 giờ đến thời gian đặt bàn');
      return;
    }

    setRefundModal({
      visible: true,
      bill: bill
    });
  }, []);

  const closeRefundModal = useCallback(() => {

    setRefundModal({
      visible: false,
      bill: null
    });
  }, []);

  // Utility functions
  const getBillStatus = (state, visit) => {
    if (state === 'completed') return BILL_STATUS.COMPLETED;
    if (state === 'cancelled') return BILL_STATUS.CANCELLED;
    return BILL_STATUS.WAITING;
  };

  const getStatusText = (state, visit) => {
    return STATUS_CONFIG[state]?.[visit]?.text || 'Không xác định';
  };

  const getStatusColor = (state, visit) => {
    return STATUS_CONFIG[state]?.[visit]?.color || '#95a5a6';
  };

  const getTableName = useCallback((tableId) => {
    const table = tables.find(t => t.id === tableId);
    return table ? `Bàn ${table.id} - Tầng ${table.floor}` : `Bàn ${tableId}`;
  }, [tables]);

  // ✅ TỰ ĐỘNG HỦY ĐƠN QUÁ GIỜ - CHỈ KHI CHƯA THANH TOÁN ĐẦY ĐỦ
  const autoCanCelOverdueBills = useCallback(async () => {
    if (!bills.length) return;

    const now = new Date();
    const billsToCancel = bills.filter(bill => {
      if (bill.state !== 'in_order' || bill.visit === 'visited') return false;

      // ✅ KHÔNG TỰ ĐỘNG HỦY NẾU ĐÃ THANH TOÁN ĐẦY ĐỦ
      if (bill.payment_status === PAYMENT_STATUS.FULLY_PAID ||
        bill.payment_status === PAYMENT_STATUS.COUNTER_PAYMENT) {
        return false;
      }

      const billTime = new Date(bill.time);
      const overdueMinutes = (now.getTime() - billTime.getTime()) / (1000 * 60);

      return overdueMinutes >= 15; // Quá 15 phút
    });

    if (billsToCancel.length === 0) return;

    console.log(`🔄 Auto cancelling ${billsToCancel.length} overdue bills...`);

    for (const bill of billsToCancel) {
      try {
        await processBillCancellation(bill, 'auto_cancel', true);
      } catch (error) {
        console.error('Error auto cancelling bill:', bill.id, error);
      }
    }
  }, [bills]);

  // ✅ TỰ ĐỘNG HOÀN THÀNH SAU 40 PHÚT ĐÃ ĐẾN
  // historyScr.jsx - SỬA autoCompleteVisitedBills
  const autoCompleteVisitedBills = useCallback(async () => {
    if (!bills.length) return;

    const now = new Date();
    const billsToComplete = bills.filter(bill => {
      if (bill.state !== 'in_order' || bill.visit !== 'visited') return false;

      const visitedTime = new Date(bill.updated_at);
      const minutesSinceVisited = (now.getTime() - visitedTime.getTime()) / (1000 * 60);

      return minutesSinceVisited >= 40;
    });

    if (billsToComplete.length === 0) return;

    console.log(`🔄 Auto completing ${billsToComplete.length} visited bills after 40 minutes...`);

    for (const bill of billsToComplete) {
      try {
        // ✅ CẬP NHẬT BILL STATUS
        const { error: billError } = await supabase
          .from('bills')
          .update({
            state: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('id', bill.id);

        if (billError) throw billError;

        // ✅ THÊM: CẬP NHẬT TRẠNG THÁI BÀN THÀNH empty
        if (bill.details?.length > 0) {
          console.log('🪑 Auto-complete: Updating table status to empty for completed bill:', bill.id);

          for (const detail of bill.details) {
            try {
              const tableUpdateResult = await updateTableState(detail.tableId, 'empty');

              if (tableUpdateResult.success) {
                console.log(`✅ Auto-complete: Table ${detail.tableId} updated to empty`);
              } else {
                console.error(`❌ Auto-complete: Failed to update table ${detail.tableId}:`, tableUpdateResult.msg);
              }
            } catch (tableError) {
              console.error(`❌ Auto-complete: Error updating table ${detail.tableId}:`, tableError);
            }
          }
        }

        // ✅ UPDATE LOCAL STATE
        setBills(prev => prev.map(b =>
          b.id === bill.id
            ? { ...b, state: 'completed', updated_at: new Date().toISOString() }
            : b
        ));

        console.log(`✅ Auto-completed bill ${bill.id} and freed tables`);

      } catch (error) {
        console.error('Error auto completing bill:', bill.id, error);
      }
    }
  }, [bills]);

  // ✅ XỬ LÝ HỦY ĐƠN - CHỈ UPDATE STATE/VISIT, KHÔNG CÓ REFUND
  // historyScr.jsx - SỬA processBillCancellation
  const processBillCancellation = useCallback(async (bill, cancelReason = 'user_cancel', isAutoCancel = false) => {
    try {
      console.log('🔄 Processing bill cancellation:', { billId: bill.id, cancelReason });

      // ✅ KIỂM TRA ĐIỀU KIỆN HOÀN TIỀN
      const shouldProcessRefund = await checkCancellationRefundEligibility(bill);

      if (shouldProcessRefund.canRefund) {
        // ✅ HIỂN THỊ MODAL XÁC NHẬN HOÀN TIỀN
        const confirmed = await showCancellationRefundConfirm(bill, shouldProcessRefund);

        if (confirmed) {
          // ✅ XỬ LÝ HOÀN TIỀN TRƯỚC KHI HỦY
          const refundResult = await processAutomaticRefund(bill, shouldProcessRefund);

          if (!refundResult.success) {
            Alert.alert('Lỗi', 'Không thể xử lý hoàn tiền: ' + refundResult.message);
            return { success: false };
          }

          console.log('✅ Refund processed successfully');
        } else {
          // ✅ NGƯỜI DÙNG KHÔNG ĐỒNG Ý HOÀN TIỀN
          return { success: false, cancelled: true };
        }
      }

      // ✅ CẬP NHẬT BILL STATUS
      const updateData = {
        state: 'cancelled',
        visit: 'un_visited',
        updated_at: new Date().toISOString()
      };

      const { error: billError } = await supabase
        .from('bills')
        .update(updateData)
        .eq('id', bill.id);

      if (billError) throw billError;

      // ✅ THÊM: CẬP NHẬT TRẠNG THÁI BÀN THÀNH empty
      if (bill.details?.length > 0) {
        console.log('🪑 Updating table status to empty for cancelled bill:', bill.id);

        for (const detail of bill.details) {
          try {
            const tableUpdateResult = await updateTableState(detail.tableId, 'empty');

            if (tableUpdateResult.success) {
              console.log(`✅ Table ${detail.tableId} updated to empty`);
            } else {
              console.error(`❌ Failed to update table ${detail.tableId}:`, tableUpdateResult.msg);
            }
          } catch (tableError) {
            console.error(`❌ Error updating table ${detail.tableId}:`, tableError);
          }
        }
      }

      // ✅ UPDATE LOCAL STATE
      setBills(prev => prev.map(b =>
        b.id === bill.id
          ? { ...b, ...updateData }
          : b
      ));

      // ✅ THÔNG BÁO
      if (!isAutoCancel) {
        const message = shouldProcessRefund.canRefund
          ? 'Đơn hàng đã được hủy và hoàn tiền thành công'
          : 'Đơn hàng đã được hủy thành công';
        Alert.alert('Thành công', message);
      } else {
        console.log(`🔄 Auto-cancelled bill ${bill.id} and freed tables`);
      }

      return { success: true };
    } catch (error) {
      console.error('Error processing bill cancellation:', error);
      if (!isAutoCancel) {
        Alert.alert('Lỗi', 'Không thể hủy đơn hàng');
      }
      return { success: false, error };
    }
  }, []);

  // ✅ THÊM HELPER FUNCTIONS MỚI:
  const checkCancellationRefundEligibility = useCallback(async (bill) => {
    // ✅ KIỂM TRA CÓ THANH TOÁN ONLINE KHÔNG
    if (bill.payment_status !== 'deposit_paid' && bill.payment_status !== 'fully_paid') {
      return { canRefund: false, reason: 'Chưa thanh toán' };
    }

    // ✅ KIỂM TRA PHƯƠNG THỨC THANH TOÁN
    if (bill.payment_method !== 'vnpay') {
      return { canRefund: false, reason: 'Không phải thanh toán VNPay' };
    }

    // ✅ KIỂM TRA THỜI GIAN
    const billTime = new Date(bill.time);
    const now = new Date();
    const diffHours = (billTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (diffHours < 2) {
      return { canRefund: false, reason: 'Không được hủy khi còn ít hơn 2 giờ' };
    }

    if (diffHours < 24) {
      return { canRefund: false, reason: 'Không được hoàn tiền khi còn ít hơn 24 giờ' };
    }

    // ✅ ĐỦ ĐIỀU KIỆN HOÀN TIỀN
    const refundAmount = bill.payment_status === 'deposit_paid'
      ? bill.deposit_amount
      : bill.total_amount || bill.price;

    return {
      canRefund: true,
      refundAmount: refundAmount,
      refundRate: 1.0, // 100%
      hoursLeft: diffHours
    };
  }, []);

  const showCancellationRefundConfirm = useCallback(async (bill, refundInfo) => {
    return new Promise((resolve) => {
      Alert.alert(
        'Xác nhận hủy đơn và hoàn tiền',
        `Bạn có chắc muốn hủy đơn hàng của ${bill.name}?\n\n` +
        `⏰ Còn ${Math.ceil(refundInfo.hoursLeft)} giờ đến thời gian đặt\n` +
        `💰 Sẽ hoàn ${refundInfo.refundAmount.toLocaleString('vi-VN')}đ (100%)\n` +
        `🏦 Phương thức: VNPay Demo\n\n` +
        `Tiền sẽ được hoàn về tài khoản thanh toán trong 1-3 ngày làm việc.`,
        [
          {
            text: 'Không hủy',
            style: 'cancel',
            onPress: () => resolve(false)
          },
          {
            text: 'Hủy & Hoàn tiền',
            style: 'destructive',
            onPress: () => resolve(true)
          }
        ]
      );
    });
  }, []);

  const processAutomaticRefund = useCallback(async (bill, refundInfo) => {
    try {
      console.log('🔄 Processing automatic refund for cancellation:', {
        billId: bill.id,
        refundAmount: refundInfo.refundAmount
      });

      // ✅ IMPORT VNPayRefundService

      const refundData = {
        billId: bill.id,
        originalAmount: bill.total_amount || bill.price,
        refundAmount: refundInfo.refundAmount,
        refundReason: 'Khách hàng hủy đơn trước 24h',
        userId: bill.userId,
        transactionNo: bill.payment_id
      };

      const result = await VNPayRefundService.simulateRefund(refundData);

      if (result.success) {
        console.log('✅ Automatic refund successful:', result.data);
        return { success: true, data: result.data };
      } else {
        console.error('❌ Automatic refund failed:', result.message);
        return { success: false, message: result.message };
      }

    } catch (error) {
      console.error('❌ Error in automatic refund:', error);
      return { success: false, message: error.message };
    }
  }, []);

  // Data fetching
  const fetchTables = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .order('floor', { ascending: true })
        .order('id', { ascending: true });

      if (error) throw error;
      setTables(data || []);
    } catch (error) {
      console.error('Error fetching tables:', error);
    }
  }, []);

  const fetchBills = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      const { data: billsData, error: billsError } = await supabase
        .from('bills')
        .select(`
          *,
          details:detailBills(
            tableId
          )
        `)
        .eq('userId', user.id)
        .order('created_at', { ascending: false });

      if (billsError) throw billsError;

      setBills(billsData || []);
    } catch (error) {
      console.error('Error fetching bills:', error);
      Alert.alert('Lỗi', 'Không thể tải danh sách đơn hàng');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchBills(), fetchTables()]);
    setRefreshing(false);
  }, [fetchBills, fetchTables]);

  // Effects
  useEffect(() => {
    if (user?.id) {
      fetchTables();
      fetchBills();
    }
  }, [user?.id, fetchTables, fetchBills]);

  // ✅ AUTO CANCEL VÀ AUTO COMPLETE
  useEffect(() => {
    if (bills.length > 0) {
      autoCanCelOverdueBills();
      autoCompleteVisitedBills();
    }
  }, [bills, autoCanCelOverdueBills, autoCompleteVisitedBills]);

  // ✅ INTERVAL CHO AUTO CANCEL VÀ AUTO COMPLETE MỖI 5 PHÚT
  useEffect(() => {
    const interval = setInterval(() => {
      if (bills.length > 0) {
        autoCanCelOverdueBills();
        autoCompleteVisitedBills();
      }
    }, 5 * 60 * 1000); // 5 phút

    return () => clearInterval(interval);
  }, [bills, autoCanCelOverdueBills, autoCompleteVisitedBills]);

  // Event handlers
  // ✅ HỦY ĐƠN - CHỈ 2 TRƯỜNG HỢP
  // historyScr.jsx - SỬA handleCancelBill
  const handleCancelBill = useCallback(async (bill, timeStatus) => {
    try {
      // ✅ KHÔNG CHO HỦY NẾU ĐÃ THANH TOÁN TẠI QUẦY
      if (bill.payment_status === PAYMENT_STATUS.COUNTER_PAYMENT) {
        Alert.alert(
          'Không thể hủy đơn',
          'Đơn hàng đã được thanh toán tại quầy, vui lòng liên hệ nhân viên để được hỗ trợ.',
          [{ text: 'OK' }]
        );
        return;
      }

      const cancelInfo = TimeUtils.calculateCancelInfo(bill.time, bill.deposit_amount, bill.payment_method);

      // ✅ CHỈ CHO PHÉP HỦY KHI CÒN > 2H
      if (!cancelInfo.canCancel) {
        Alert.alert(
          'Không thể hủy đơn',
          cancelInfo.message,
          [{ text: 'OK' }]
        );
        return;
      }

      // ✅ HIỂN THỊ MODAL XÁC NHẬN
      Alert.alert(
        'Xác nhận hủy đơn',
        `Bạn có chắc muốn hủy đơn hàng của ${bill.name}?\n\n${cancelInfo.message}`,
        [
          { text: 'Không hủy', style: 'cancel' },
          {
            text: 'Hủy đơn',
            style: 'destructive',
            onPress: async () => {
              // ✅ XỬ LÝ HỦY ĐƠN VÀ CẬP NHẬT BÀNG
              await processBillCancellation(bill, 'user_cancel', false);
            }
          }
        ]
      );

    } catch (error) {
      console.error('❌ Error in handleCancelBill:', error);
      Alert.alert('Lỗi', 'Có lỗi xảy ra khi hủy đơn');
    }
  }, [processBillCancellation]);

  // ✅ SỬA handleArrived - THÊM VALIDATION THỜI GIAN
  // historyScr.jsx - SỬA handleArrived
  const handleArrived = useCallback(async (bill) => {
    const arrivedInfo = TimeUtils.calculateArrivedInfo(bill.time);

    if (!arrivedInfo.canArrived) {
      Alert.alert(
        'Không thể xác nhận đã đến',
        arrivedInfo.message,
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Xác nhận đã đến',
      `Xác nhận bạn đã đến nhà hàng cho đơn hàng của ${bill.name}?`,
      [
        { text: 'Chưa đến', style: 'cancel' },
        {
          text: 'Đã đến',
          onPress: async () => {
            try {
              // ✅ CẬP NHẬT BILL STATUS
              const { error: billError } = await supabase
                .from('bills')
                .update({
                  visit: 'visited',
                  updated_at: new Date().toISOString()
                })
                .eq('id', bill.id);

              if (billError) throw billError;

              // ✅ THÊM: CẬP NHẬT TRẠNG THÁI BÀN THÀNH occupied
              if (bill.details?.length > 0) {
                console.log('🪑 Updating table status to occupied for arrived customer:', bill.id);

                for (const detail of bill.details) {
                  try {
                    const tableUpdateResult = await updateTableState(detail.tableId, 'occupied');

                    if (tableUpdateResult.success) {
                      console.log(`✅ Table ${detail.tableId} updated to occupied`);
                    } else {
                      console.error(`❌ Failed to update table ${detail.tableId}:`, tableUpdateResult.msg);
                    }
                  } catch (tableError) {
                    console.error(`❌ Error updating table ${detail.tableId}:`, tableError);
                  }
                }
              }

              // ✅ UPDATE LOCAL STATE
              setBills(prev => prev.map(b =>
                b.id === bill.id
                  ? { ...b, visit: 'visited', updated_at: new Date().toISOString() }
                  : b
              ));

              Alert.alert('Thành công', 'Đã xác nhận bạn đã đến nhà hàng');
            } catch (error) {
              console.error('Error updating arrival status:', error);
              Alert.alert('Lỗi', 'Không thể cập nhật trạng thái');
            }
          }
        }
      ]
    );
  }, []);

  // ✅ THANH TOÁN CÒN LẠI
  // historyScr.jsx - SỬA handlePayRemaining (dòng 850)
  const handlePayRemaining = useCallback(async (bill, remainingAmount, paymentMethod = 'vnpay') => {
    try {
      // ✅ VALIDATION TRƯỚC KHI THANH TOÁN
      if (!bill || !bill.id) {
        Alert.alert('Lỗi', 'Thông tin đơn hàng không hợp lệ');
        return;
      }

      // ✅ KIỂM TRA TRẠNG THÁI BILL
      if (bill.payment_status !== 'deposit_paid') {
        Alert.alert('Lỗi', 'Đơn hàng này không thể thanh toán phần còn lại');
        return;
      }

      // ✅ SỬA: TÍNH TOÁN SỐ TIỀN CÒN LẠI DÙNG price
      const actualTotal = bill.price || bill.total_amount || 0; // ✅ PRICE FIRST
      const depositAmount = bill.deposit_amount || 0;
      const calculatedRemaining = actualTotal - depositAmount;

      // ✅ VALIDATION SỐ TIỀN
      if (calculatedRemaining <= 0) {
        Alert.alert('Thông báo', 'Đơn hàng này đã được thanh toán đầy đủ');
        return;
      }

      if (calculatedRemaining > 50000000) { // 50M limit
        Alert.alert('Lỗi', 'Số tiền thanh toán quá lớn');
        return;
      }

      // ✅ HIỂN THỊ MODAL XÁC NHẬN
      Alert.alert(
        'Xác nhận thanh toán',
        `Bạn có muốn thanh toán phần còn lại?\n\n` +
        `Tổng tiền: ${actualTotal.toLocaleString('vi-VN')}đ\n` +
        `Đã cọc: ${depositAmount.toLocaleString('vi-VN')}đ\n` +
        `Còn lại: ${calculatedRemaining.toLocaleString('vi-VN')}đ\n\n` +
        `Phương thức: ${paymentMethod === 'vnpay' ? 'VNPay' : 'Tại quầy'}`,
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Thanh toán',
            onPress: async () => {
              await processRemainingPayment(bill, calculatedRemaining, paymentMethod);
            }
          }
        ]
      );

    } catch (error) {
      console.error('❌ Error in handlePayRemaining:', error);
      Alert.alert('Lỗi', 'Có lỗi xảy ra khi xử lý thanh toán: ' + error.message);
    }
  }, []);

  // ✅ THÊM FUNCTION processRemainingPayment MỚI:
  const processRemainingPayment = useCallback(async (bill, remainingAmount, paymentMethod) => {
    try {
      console.log('🔄 Processing remaining payment:', {
        billId: bill.id,
        amount: remainingAmount,
        method: paymentMethod
      });

      setLoading(true);

      if (paymentMethod === 'counter') {
        // 1. Tìm payment cọc (nếu có)
        const { data: depositPayment, error: findError } = await supabase
          .from('payments')
          .select('*')
          .eq('billid', bill.id)
          .eq('payment_type', 'deposit')
          .eq('status', 'completed')
          .maybeSingle();

        if (depositPayment) {
          // Có payment cọc: cập nhật thành full
          const { error: updatePaymentError } = await supabase
            .from('payments')
            .update({
              payment_type: 'full',
              amount: bill.total_amount || bill.price,
              payment_method: 'counter',
              updated_at: new Date().toISOString(),
              bill_data: {
                ...depositPayment.bill_data,
                remainingAmount,
                remainingPaymentMethod: 'counter',
                remainingPaymentDate: new Date().toISOString()
              }
            })
            .eq('id', depositPayment.id);

          if (updatePaymentError) {
            console.error('❌ Error updating payment:', updatePaymentError);
            throw updatePaymentError;
          }
          console.log('✅ Payment updated to full payment');
        } else {
          const orderId = `COUNTER_${bill.id}_${Date.now()}`; // Tạo orderid duy nhất
          // Không có payment cọc: tạo payment mới cho thanh toán tại quầy
          const { error: createError } = await supabase
            .from('payments')
            .insert([{
              orderid: orderId,
              billid: bill.id,
              userid: bill.userId,
              amount: remainingAmount,
              payment_type: 'counter',
              payment_method: 'counter',
              status: 'pending',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              bill_data: {
                billId: bill.id,
                name: bill.name,
                phone: bill.phone,
                num_people: bill.num_people,
                time: bill.time,
                note: bill.note,
                totalAmount: bill.total_amount || bill.price,
                remainingAmount,
                remainingPaymentMethod: 'counter',
                remainingPaymentDate: new Date().toISOString()
              }
            }]);
          if (createError) {
            console.error('❌ Error creating counter payment:', createError);
            throw createError;
          }
          console.log('✅ Counter payment created');
        }

        // 2. Cập nhật trạng thái bill
        const { error: billError } = await supabase
          .from('bills')
          .update({
            payment_status: 'pending_counter',
            payment_method: 'counter',
            updated_at: new Date().toISOString()
          })
          .eq('id', bill.id);

        if (billError) {
          console.error('❌ Error updating bill:', billError);
          throw billError;
        }

        console.log('✅ Bill updated to pending_counter');

        // 3. Cập nhật local state
        setBills(prev => prev.map(b =>
          b.id === bill.id
            ? {
              ...b,
              payment_status: 'pending_counter',
              payment_method: 'counter',
              updated_at: new Date().toISOString()
            }
            : b
        ));

        Alert.alert('✅ Thành công', 'Đã gửi yêu cầu thanh toán tại quầy. Vui lòng chờ xác nhận từ nhân viên.');

      } else if (paymentMethod === 'vnpay') {
        // ...giữ nguyên logic xử lý VNPay như cũ...
        // 1. Tìm payment cọc (bắt buộc phải có)
        const { data: depositPayment, error: findError } = await supabase
          .from('payments')
          .select('*')
          .eq('billid', bill.id)
          .eq('payment_type', 'deposit')
          .eq('status', 'completed')
          .single();

        if (findError) {
          console.error('❌ Cannot find existing payment:', findError);
          throw new Error('Không tìm thấy thanh toán cọc ban đầu');
        }

        console.log('✅ Found existing payment for VNPay update:', depositPayment.id);

        // 2. Tạo payment data cho VNPay
        const paymentData = {
          userId: user.id,
          billId: bill.id,
          amount: remainingAmount,
          paymentType: 'remaining',
          existingPaymentId: depositPayment.id,
          billData: {
            billId: bill.id,
            name: bill.name,
            phone: bill.phone,
            num_people: bill.num_people,
            time: bill.time,
            note: bill.note,
            totalAmount: bill.total_amount || bill.price,
            depositAmount: bill.deposit_amount,
            remainingAmount,
            existingPaymentId: depositPayment.id
          }
        };

        console.log('📋 VNPay payment data with existing payment:', paymentData);

        // 3. Tạo VNPay URL
        const result = await createVNPayPayment(paymentData);

        if (result.success) {
          console.log('✅ VNPay payment created for remaining amount');

          setCurrentPaymentData({
            ...result.data,
            existingPaymentId: depositPayment.id,
            billId: bill.id
          });
          setVnpayUrl(result.data.vnpayUrl);
          setVnpayWebViewVisible(true);
        } else {
          console.error('❌ VNPay payment creation failed:', result);
          throw new Error(result.message || 'Không thể tạo thanh toán VNPay');
        }
      }

    } catch (error) {
      console.error('❌ Error in processRemainingPayment:', error);

      let errorMessage = 'Có lỗi xảy ra khi xử lý thanh toán';
      if (error.message?.includes('find')) {
        errorMessage = 'Không tìm thấy thông tin thanh toán ban đầu';
      } else if (error.message?.includes('constraint')) {
        errorMessage = 'Dữ liệu thanh toán không hợp lệ';
      } else if (error.message?.includes('network')) {
        errorMessage = 'Lỗi kết nối mạng. Vui lòng thử lại';
      } else if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert('❌ Lỗi thanh toán', errorMessage);

    } finally {
      setLoading(false);
    }
  }, [user]);


  const handleVNPaySuccess = useCallback(async (vnpayData) => {
    try {
      console.log('✅ VNPay payment success:', vnpayData);

      // ✅ VALIDATION VNPAY DATA
      if (!vnpayData || !vnpayData.rawData) {
        throw new Error('Dữ liệu thanh toán không hợp lệ');
      }

      const serviceResult = await handleVNPayReturn(vnpayData.rawData, true);

      if (serviceResult.success) {
        const { payment, bill } = serviceResult.data;

        // ✅ CẬP NHẬT BILL CHO REMAINING PAYMENT
        if (currentPaymentData?.billId) {
          const { error: billUpdateError } = await supabase
            .from('bills')
            .update({
              payment_status: 'fully_paid',
              payment_id: payment.id.toString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', currentPaymentData.billId);

          if (billUpdateError) {
            console.error('Error updating bill:', billUpdateError);
          } else {
            setBills(prev => prev.map(b =>
              b.id === currentPaymentData.billId
                ? {
                  ...b,
                  payment_status: 'fully_paid',
                  payment_id: payment.id.toString(),
                  updated_at: new Date().toISOString()
                }
                : b
            ));
          }
        }

        // ✅ REFRESH DATA
        await fetchBills();

        Alert.alert(
          '✅ Thanh toán thành công!',
          `Bạn đã thanh toán thành công ${vnpayData.amount.toLocaleString('vi-VN')}đ\n\n` +
          `Mã đơn hàng: #${currentPaymentData?.billId || 'N/A'}\n` +
          `Mã giao dịch: ${vnpayData.transactionNo || 'N/A'}\n` +
          `Ngân hàng: ${vnpayData.bankCode || 'N/A'}\n\n` +
          `Đơn hàng đã được thanh toán đầy đủ!`,
          [
            {
              text: 'OK',
              onPress: () => {
                setVnpayWebViewVisible(false);
                setCurrentPaymentData(null);
                setVnpayUrl('');
              }
            }
          ]
        );
      } else {
        throw new Error(serviceResult.message || 'Lỗi xử lý thanh toán từ server');
      }

    } catch (error) {
      console.error('❌ Error in handleVNPaySuccess:', error);

      Alert.alert(
        '⚠️ Cảnh báo',
        'Thanh toán đã thực hiện thành công nhưng có vấn đề khi cập nhật dữ liệu.\n\n' +
        'Vui lòng kiểm tra lại lịch sử giao dịch hoặc liên hệ hỗ trợ.',
        [
          {
            text: 'OK',
            onPress: () => {
              setVnpayWebViewVisible(false);
              setCurrentPaymentData(null);
              setVnpayUrl('');
              fetchBills();
            }
          }
        ]
      );
    }
  }, [currentPaymentData, fetchBills]);

  const handleVNPayFailure = useCallback(async (errorData) => {
    try {
      console.log('❌ VNPay payment failed:', errorData);

      if (currentPaymentData?.orderId) {
        await supabase
          .from('payments')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            vnpay_response: errorData
          })
          .eq('orderid', currentPaymentData.orderId);
      }

      Alert.alert(
        '❌ Thanh toán thất bại',
        errorData.message || 'Có lỗi xảy ra trong quá trình thanh toán.',
        [
          {
            text: 'Thử lại',
            onPress: () => {
              if (currentPaymentData?.originalBill) {
                const remaining = (currentPaymentData.originalBill.total_amount || currentPaymentData.originalBill.price) -
                  (currentPaymentData.originalBill.deposit_amount || 0);
                handlePayRemaining(currentPaymentData.originalBill, remaining, 'vnpay');
              }
            }
          },
          {
            text: 'Đóng',
            style: 'cancel'
          }
        ]
      );
    } catch (error) {
      console.error('❌ Error handling VNPay failure:', error);
    } finally {
      setVnpayWebViewVisible(false);
      setCurrentPaymentData(null);
      setVnpayUrl('');
    }
  }, [currentPaymentData, handlePayRemaining]);

  const handleVNPayClose = useCallback(() => {
    console.log('🔒 VNPay WebView closed');

    setVnpayWebViewVisible(false);
    setCurrentPaymentData(null);
    setVnpayUrl('');
  }, []);

  // Filter bills based on selected tab
  const filteredBills = bills.filter(bill => {
    const billStatus = getBillStatus(bill.state, bill.visit);
    switch (selectedTab) {
      case 'waiting': return billStatus === BILL_STATUS.WAITING;
      case 'completed': return billStatus === BILL_STATUS.COMPLETED;
      case 'cancelled': return billStatus === BILL_STATUS.CANCELLED;
      default: return true;
    }
  });

  // historyScr.jsx - SỬA renderBillItem
  const renderBillItem = useCallback(({ item, index }) => {
    // ✅ TÍNH TOÁN TRỰC TIẾP - KHÔNG DÙNG HOOKS
    const billStatus = getBillStatus(item.state, item.visit);
    const timeStatus = TimeUtils.calculateTimeStatus(item.time);

    return (
      <View style={styles.billCard}>
        {/* Header */}
        <View style={styles.billHeader}>
          <View style={styles.billHeaderLeft}>
            <Text style={styles.billId}>Đơn #{bills.length - index}</Text>
            <Text style={styles.billPrice}>
              {item.price ? `${item.price.toLocaleString('vi-VN')}đ` : 'Miễn phí'}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.state, item.visit) }]}>
            <Text style={styles.statusText}>{getStatusText(item.state, item.visit)}</Text>
          </View>
        </View>

        {/* Bill Info */}
        <View style={styles.billInfo}>
          <BillInfoRow icon="User" text={item.name} />
          <BillInfoRow icon="Phone" text={item.phone} />
          <BillInfoRow icon="Users" text={`${item.num_people} người`} />
          <BillInfoRow icon="Clock" text={new Date(item.time).toLocaleString('vi-VN')} />
          <BillInfoRow
            icon="DollarSign"
            text={item.price ? `${item.price.toLocaleString('vi-VN')}đ` : 'Chưa có món ăn'}
            iconColor={theme.colors.primary}
            textStyle={styles.priceText}
          />

          {/* Time Status */}
          {billStatus === BILL_STATUS.WAITING && (
            <BillInfoRow
              icon="Info"
              text={timeStatus.text}
              iconColor={timeStatus.color}
              textStyle={{
                color: timeStatus.color,
                fontWeight: 'normal'
              }}
            />
          )}

          {item.note && <BillInfoRow icon="FileText" text={item.note} />}
        </View>

        {/* Payment Info */}
        <PaymentInfoSection item={item} />

        {/* Tables */}
        {item.details?.length > 0 && (
          <TablesSection details={item.details} getTableName={getTableName} />
        )}

        {/* ✅ REMAINING PAYMENT - CHỈ CHO WAITING BILLS */}
        {billStatus === BILL_STATUS.WAITING && (
          <RemainingPaymentSection
            item={item}
            onPayRemaining={handlePayRemaining}
          />
        )}

        {/* Actions */}
        {billStatus === BILL_STATUS.WAITING && (
          <ActionButtons
            item={item}
            timeStatus={timeStatus}
            paymentInfo={{ showTimeStatus: true }}
            onCancel={handleCancelBill}
            onArrived={handleArrived}
            openRefundModal={openRefundModal}
          />
        )}

        {/* Status Sections */}
        <StatusSection billStatus={billStatus} item={item} />
      </View>
    );
  }, [bills.length, getTableName, handleCancelBill, handleArrived, handlePayRemaining, openRefundModal]);

  const renderTabButton = (key, label) => (
    <TouchableOpacity
      key={key}
      style={[styles.tabButton, selectedTab === key && styles.activeTabButton]}
      onPress={() => setSelectedTab(key)}
    >
      <Text style={[styles.tabButtonText, selectedTab === key && styles.activeTabButtonText]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <ScreenWrapper bg="FFBF00">
        <StatusBar style="dark" />
        <MyLoading />
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper bg="FFBF00">
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Text style={styles.title}>Lịch sử đặt bàn</Text>
        <Text style={styles.subtitle}>
          {filteredBills.length} đơn hàng
        </Text>
      </View>

      <View style={styles.tabContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScrollContainer}
        >
          {renderTabButton('all', 'Tất cả')}
          {renderTabButton('waiting', 'Đang chờ')}
          {renderTabButton('completed', 'Hoàn thành')}
          {renderTabButton('cancelled', 'Đã hủy')}
        </ScrollView>
      </View>

      {filteredBills.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon.FileText width={64} height={64} color={theme.colors.textLight} />
          <Text style={styles.emptyText}>
            {selectedTab === 'all' ? 'Chưa có đơn đặt bàn nào' :
              selectedTab === 'waiting' ? 'Không có đơn đang chờ' :
                selectedTab === 'completed' ? 'Không có đơn hoàn thành' :
                  'Không có đơn đã hủy'}
          </Text>
          <Text style={styles.emptySubtext}>
            Hãy đặt bàn để bắt đầu trải nghiệm của bạn
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredBills}
          renderItem={renderBillItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}

      <VNPayWebView
        visible={vnpayWebViewVisible}
        onClose={handleVNPayClose}
        vnpayUrl={vnpayUrl}
        onPaymentSuccess={handleVNPaySuccess}
        onPaymentFailure={handleVNPayFailure}
        orderInfo={currentPaymentData?.orderInfo || 'Thanh toán còn lại'}
        amount={currentPaymentData?.amount || 0}
      />
      <RefundModal
        visible={refundModal.visible}
        bill={refundModal.bill}
        onClose={closeRefundModal}
        onRefundSuccess={handleRefundSuccess}
      />
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: wp(4),
    paddingVertical: hp(2),
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: hp(2.8),
    fontWeight: 'bold',
    color: theme.colors.dark,
  },
  subtitle: {
    fontSize: hp(1.6),
    color: theme.colors.textLight,
    marginTop: hp(0.5),
  },
  tabContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tabScrollContainer: {
    paddingHorizontal: wp(4),
    paddingVertical: hp(1),
  },
  tabButton: {
    paddingHorizontal: wp(4),
    paddingVertical: hp(1),
    marginRight: wp(2),
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
  },
  activeTabButton: {
    backgroundColor: theme.colors.primary,
  },
  tabButtonText: {
    fontSize: hp(1.6),
    color: theme.colors.textLight,
    fontWeight: '500',
  },
  activeTabButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  listContainer: {
    padding: wp(4),
  },
  billCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: wp(4),
    marginBottom: hp(2),
    borderWidth: 1,
    borderColor: '#f0f0f0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  billHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp(1.5),
  },
  billHeaderLeft: {
    flex: 1,
  },
  billId: {
    fontSize: hp(2),
    fontWeight: 'bold',
    color: theme.colors.dark,
  },
  billPrice: {
    fontSize: hp(1.8),
    color: theme.colors.primary,
    fontWeight: '600',
    marginTop: hp(0.3),
  },
  statusBadge: {
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.5),
    borderRadius: 15,
  },
  statusText: {
    fontSize: hp(1.4),
    color: 'white',
    fontWeight: '600',
  },
  billInfo: {
    gap: hp(0.8),
    marginBottom: hp(1.5),
  },
  billInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
  },
  billInfoText: {
    fontSize: hp(1.6),
    color: theme.colors.text,
    flex: 1,
  },
  priceText: {
    fontWeight: '600',
    color: theme.colors.primary,
  },

  // Payment styles
  paymentSection: {
    marginTop: hp(1.5),
    paddingHorizontal: wp(3),
    paddingVertical: hp(1.2),
    borderRadius: 8,
    borderWidth: 1,
  },
  paymentStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
    marginBottom: hp(0.5),
  },
  paymentStatusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  paymentAmountText: {
    fontSize: 13,
    color: theme.colors.text,
    marginBottom: hp(0.5),
    marginLeft: wp(6),
  },
  paymentMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(1.5),
    marginLeft: wp(6),
  },
  paymentMethodText: {
    fontSize: 12,
    fontWeight: '500',
  },
  paymentIdText: {
    fontSize: 11,
    color: theme.colors.textLight,
    fontStyle: 'italic',
    marginLeft: wp(6),
    marginTop: hp(0.3),
  },

  // Remaining payment styles
  remainingPaymentSection: {
    marginTop: hp(1.5),
    paddingHorizontal: wp(3),
    paddingVertical: hp(1.2),
    backgroundColor: '#fff8e1',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffe082',
  },
  remainingPaymentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
    marginBottom: hp(0.8),
  },
  remainingPaymentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f39c12',
  },
  remainingAmountText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e67e22',
    textAlign: 'center',
    marginBottom: hp(1),
  },
  remainingPaymentActions: {
    flexDirection: 'row',
    gap: wp(2),
  },
  payRemainingButton: {
    backgroundColor: '#007AFF',
    flex: 1,
  },
  counterPayButton: {
    backgroundColor: '#8e44ad',
    flex: 1,
  },

  // Tables section
  tablesSection: {
    marginTop: hp(1.5),
    paddingTop: hp(1.5),
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  tablesSectionTitle: {
    fontSize: hp(1.6),
    fontWeight: '600',
    color: theme.colors.dark,
    marginBottom: hp(0.8),
  },
  tablesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: wp(2),
  },
  tableTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(1),
    paddingHorizontal: wp(2.5),
    paddingVertical: hp(0.5),
    backgroundColor: theme.colors.primary + '15',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: theme.colors.primary + '30',
  },
  tableTagText: {
    fontSize: hp(1.4),
    color: theme.colors.primary,
    fontWeight: '500',
  },

  // ✅ AUTO CANCEL SECTION STYLES
  autoCancelSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
    marginTop: hp(1.5),
    paddingTop: hp(1.5),
    paddingHorizontal: wp(3),
    paddingVertical: hp(1),
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#ffeaea',
    borderRadius: 8,
  },
  autoCancelText: {
    fontSize: hp(1.4),
    color: '#e74c3c',
    fontStyle: 'italic',
    flex: 1,
  },

  actionButtons: {
    flexDirection: 'row',
    gap: wp(2),
    marginTop: hp(1.5),
    paddingTop: hp(1.5),
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: wp(1.5),
    paddingVertical: hp(1.2),
    borderRadius: 8,
  },
  actionButtonText: {
    fontSize: hp(1.4),
    color: 'white',
    fontWeight: '600',
  },
  arrivedButton: {
    backgroundColor: '#27ae60',
  },
  completedSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
    marginTop: hp(1.5),
    paddingTop: hp(1.5),
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  completedText: {
    fontSize: hp(1.4),
    color: '#27ae60',
    fontStyle: 'italic',
    flex: 1,
  },
  cancelledSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
    marginTop: hp(1.5),
    paddingTop: hp(1.5),
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  cancelledText: {
    fontSize: hp(1.4),
    color: '#e74c3c',
    fontStyle: 'italic',
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: wp(8),
  },
  emptyText: {
    fontSize: hp(2.2),
    fontWeight: '600',
    color: theme.colors.textLight,
    textAlign: 'center',
    marginTop: hp(2),
  },
  emptySubtext: {
    fontSize: hp(1.6),
    color: theme.colors.textLight,
    textAlign: 'center',
    marginTop: hp(1),
  },
  arrivedDisabledSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
    marginTop: hp(1),
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.8),
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
  },
  arrivedDisabledText: {
    fontSize: hp(1.3),
    color: '#95a5a6',
    fontStyle: 'italic',
    flex: 1,
  },
  smartCancelRefundButton: {
    backgroundColor: '#f39c12', // Màu cam cho hoàn tiền
  },
  smartCancelButton: {
   flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'red',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 18,
    minWidth: 110,
    marginRight: 8,
    shadowColor: '#f39c12',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  simpleRefundButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f39c12',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 18,
    minWidth: 110,
    marginRight: 8,
    shadowColor: '#f39c12',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  simpleRefundButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
    marginLeft: 8,
  },
});

export default HistoryScr;
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ScrollView, Alert, RefreshControl, StatusBar } from 'react-native';
import React, { useEffect, useState, useCallback, memo } from 'react';
import ScreenWrapper from '../../../components/ScreenWrapper';
import { theme } from '../../../constants/theme';
import { hp, wp } from '../../../helper/common';
import * as Icon from 'react-native-feather';
import { supabase } from '../../../lib/supabase';
import MyLoading from '../../../components/MyLoading';
import VNPayWebView from '../../../components/VNPayWebView';
import { createVNPayPayment, handleVNPayReturn } from '../../../services/vnpayService';
import { useAuth } from '../../../context/AuthContext';

// ✅ PAYMENT STATUS CONSTANTS VÀ UTILITIES
const PAYMENT_STATUS = {
  PENDING: 'pending',
  DEPOSIT_PAID: 'deposit_paid',
  FULLY_PAID: 'fully_paid',
  COUNTER_PAYMENT: 'counter_payment'
};

const PaymentUtils = {
  getPaymentStatusInfo: (paymentStatus, depositAmount, totalAmount, price) => {
    const currentTotal = totalAmount || price || 0;
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
          borderColor: '#ffb3b3'
        };

      case PAYMENT_STATUS.DEPOSIT_PAID:
        return {
          status: 'Đã đặt cọc',
          color: '#f39c12',
          icon: 'Clock',
          amount: remaining,
          amountText: `Đã cọc: ${deposit.toLocaleString('vi-VN')}đ - Còn lại: ${remaining.toLocaleString('vi-VN')}đ`,
          bgColor: '#fff8e1',
          borderColor: '#ffe082'
        };

      case PAYMENT_STATUS.FULLY_PAID:
        return {
          status: 'Đã thanh toán đủ',
          color: '#27ae60',
          icon: 'CheckCircle',
          amount: currentTotal,
          amountText: `Đã thanh toán: ${currentTotal.toLocaleString('vi-VN')}đ`,
          bgColor: '#e8f5e8',
          borderColor: '#90ee90'
        };

      case PAYMENT_STATUS.COUNTER_PAYMENT:
        return {
          status: 'Thanh toán tại quầy',
          color: '#8e44ad',
          icon: 'Home',
          amount: currentTotal,
          amountText: `Thanh toán tại quầy: ${currentTotal.toLocaleString('vi-VN')}đ`,
          bgColor: '#f3e5f5',
          borderColor: '#ce93d8'
        };

      default:
        return {
          status: 'Không xác định',
          color: '#95a5a6',
          icon: 'HelpCircle',
          amount: currentTotal,
          amountText: `Tổng tiền: ${currentTotal.toLocaleString('vi-VN')}đ`,
          bgColor: '#f5f5f5',
          borderColor: '#e0e0e0'
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

// ✅ TimeUtils - LOGIC HỦY ĐƠN
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
        overdueMinutes
      };
    } else if (diffHours <= 2) {
      return {
        status: 'soon',
        text: `Còn ${Math.ceil(diffMinutes)} phút`,
        color: '#e67e22',
        canCancel: false // ✅ KHÔNG CHO HỦY KHI CÒN < 2 TIẾNG
      };
    } else {
      return {
        status: 'normal',
        text: `Còn ${Math.ceil(diffHours)} giờ`,
        color: '#27ae60',
        canCancel: true // ✅ CHO PHÉP HỦY KHI CÒN > 2 TIẾNG
      };
    }
  },

  // ✅ LOGIC HỦY ĐƠN - CHỈ 2 TRƯỜNG HỢP
  calculateCancelInfo: (billTime, depositAmount) => {
    const now = new Date();
    const billTimeDate = new Date(billTime);
    const diffHours = (billTimeDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    if (diffHours >= 24) {
      return {
        canCancel: true,
        message: 'Hủy trước 24h - Không mất gì'
      };
    } else if (diffHours >= 2) {
      return {
        canCancel: true,
        message: 'Hủy trong 24h - Sẽ mất tiền cọc'
      };
    } else {
      return {
        canCancel: false,
        message: 'Không thể hủy (còn < 2 tiếng)'
      };
    }
  }
};

// ✅ PAYMENT INFO COMPONENT
const PaymentInfoSection = memo(({ item }) => {
  const paymentInfo = PaymentUtils.getPaymentStatusInfo(
    item.payment_status,
    item.deposit_amount,
    item.total_amount,
    item.price
  );

  const paymentMethodInfo = PaymentUtils.getPaymentMethodInfo(item.payment_method);

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

      {/* Payment ID nếu có */}
      {item.payment_id && (
        <Text style={styles.paymentIdText}>
          Mã thanh toán: {item.payment_id}
        </Text>
      )}
    </View>
  );
});

// ✅ REMAINING PAYMENT COMPONENT
const RemainingPaymentSection = memo(({ item, onPayRemaining }) => {
  if (item.payment_status !== PAYMENT_STATUS.DEPOSIT_PAID) return null;

  const remaining = (item.total_amount || item.price || 0) - (item.deposit_amount || 0);

  if (remaining <= 0) return null;

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
          onPress={() => onPayRemaining(item, remaining)}
        >
          <Icon.CreditCard width={16} height={16} color="white" />
          <Text style={styles.actionButtonText}>Thanh toán còn lại</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.counterPayButton]}
          onPress={() => onPayRemaining(item, remaining, 'counter')}
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

// ✅ ActionButtons - LOGIC HIỂN THỊ BUTTONS
const ActionButtons = memo(({ item, timeStatus, onCancel, onArrived }) => {
  // ✅ KHÔNG HIỂN THỊ NẾU ĐÃ ĐẾN HOẶC ĐÃ HỦY
  if (item.visit === 'visited' || item.state === 'cancelled') {
    return null;
  }

  // ✅ KHÔNG HIỂN THỊ NẾU QUÁ 15 PHÚT (SẼ TỰ ĐỘNG HỦY)
  if (timeStatus.shouldAutoCancel) {
    return (
      <View style={styles.autoCancelSection}>
        <Icon.Clock width={20} height={20} color="#e74c3c" />
        <Text style={styles.autoCancelText}>
          Đơn hàng sẽ được tự động hủy do quá giờ hẹn 15 phút
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.actionButtons}>
      {/* ✅ NÚT HỦY - CHỈ HIỂN THỊ NẾU ĐƯỢC PHÉP HỦY */}
      {(timeStatus.canCancel !== false) && (
        <TouchableOpacity
          style={[styles.actionButton, styles.cancelButton]}
          onPress={() => onCancel(item, timeStatus)}
        >
          <Icon.X width={16} height={16} color="white" />
          <Text style={styles.actionButtonText}>Hủy đơn</Text>
        </TouchableOpacity>
      )}

      {/* ✅ NÚT ĐÃ ĐẾN - LUÔN HIỂN THỊ NẾU CHƯA visited */}
      <TouchableOpacity
        style={[styles.actionButton, styles.arrivedButton]}
        onPress={() => onArrived(item)}
      >
        <Icon.Check width={16} height={16} color="white" />
        <Text style={styles.actionButtonText}>Đã đến</Text>
      </TouchableOpacity>
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

  // ✅ TỰ ĐỘNG HỦY ĐƠN QUÁ GIỜ
  const autoCanCelOverdueBills = useCallback(async () => {
    if (!bills.length) return;

    const now = new Date();
    const billsToCancel = bills.filter(bill => {
      if (bill.state !== 'in_order' || bill.visit === 'visited') return false;
      
      const billTime = new Date(bill.time);
      const overdueMinutes = (now.getTime() - billTime.getTime()) / (1000 * 60);
      
      return overdueMinutes >= 15; // Quá 15 phút
    });

    if (billsToCancel.length === 0) return;

    console.log(`🔄 Auto cancelling ${billsToCancel.length} overdue bills...`);

    for (const bill of billsToCancel) {
      try {
        // ✅ HỦY ĐƠN
        await processBillCancellation(bill, 'auto_cancel', true);
      } catch (error) {
        console.error('Error auto cancelling bill:', bill.id, error);
      }
    }
  }, [bills]);

  // ✅ TỰ ĐỘNG HOÀN THÀNH SAU 40 PHÚT ĐÃ ĐẾN
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
        const { error } = await supabase
          .from('bills')
          .update({
            state: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('id', bill.id);

        if (error) throw error;

        setBills(prev => prev.map(b => 
          b.id === bill.id 
            ? { ...b, state: 'completed', updated_at: new Date().toISOString() }
            : b
        ));

      } catch (error) {
        console.error('Error auto completing bill:', bill.id, error);
      }
    }
  }, [bills]);

  // ✅ XỬ LÝ HỦY ĐƠN - CHỈ UPDATE STATE/VISIT, KHÔNG CÓ REFUND
  const processBillCancellation = useCallback(async (bill, cancelReason = 'user_cancel', isAutoCancel = false) => {
    try {
      // ✅ CẬP NHẬT BILL STATUS - CHỈ CẬP NHẬT STATE VÀ VISIT
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

      // ✅ UPDATE LOCAL STATE
      setBills(prev => prev.map(b => 
        b.id === bill.id 
          ? { ...b, ...updateData }
          : b
      ));

      if (!isAutoCancel) {
        Alert.alert('Hủy đơn thành công', 'Đơn hàng đã được hủy');
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
  const handleCancelBill = useCallback((bill, timeStatus) => {
    const cancelInfo = TimeUtils.calculateCancelInfo(bill.time, bill.deposit_amount);
    
    let alertMessage = `Bạn có chắc muốn hủy đơn hàng của ${bill.name}?\n\n`;
    alertMessage += cancelInfo.message;

    Alert.alert(
      'Xác nhận hủy đơn',
      alertMessage,
      [
        { text: 'Không', style: 'cancel' },
        {
          text: 'Hủy đơn',
          style: 'destructive',
          onPress: () => processBillCancellation(bill, 'user_cancel', false)
        }
      ]
    );
  }, [processBillCancellation]);

  const handleArrived = useCallback((bill) => {
    Alert.alert(
      'Xác nhận đã đến',
      `Xác nhận bạn đã đến nhà hàng cho đơn hàng của ${bill.name}?`,
      [
        { text: 'Chưa đến', style: 'cancel' },
        {
          text: 'Đã đến',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('bills')
                .update({
                  visit: 'visited',
                  updated_at: new Date().toISOString()
                })
                .eq('id', bill.id);

              if (error) throw error;

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
  const handlePayRemaining = useCallback(async (bill, remainingAmount, paymentMethod = 'vnpay') => {
    console.log('💰 Pay remaining:', { billId: bill.id, amount: remainingAmount, method: paymentMethod });
    
    if (paymentMethod === 'counter') {
      Alert.alert(
        'Xác nhận thanh toán tại quầy',
        `Thanh toán ${remainingAmount.toLocaleString('vi-VN')}đ tại quầy cho đơn #${bill.id}?`,
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Xác nhận',
            onPress: async () => {
              try {
                const { error: billError } = await supabase
                  .from('bills')
                  .update({
                    visit: 'visited',
                    payment_status: PAYMENT_STATUS.FULLY_PAID,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', bill.id);

                if (billError) throw billError;

                const { error: paymentError } = await supabase
                  .from('payments')
                  .insert([
                    {
                      orderid: `COUNTER_${bill.id}_${Date.now()}`,
                      billid: bill.id,
                      userid: user.id,
                      amount: remainingAmount,
                      payment_type: 'counter',
                      payment_method: 'counter',
                      status: 'completed',
                      completed_at: new Date().toISOString(),
                      bill_data: {
                        billId: bill.id,
                        name: bill.name,
                        phone: bill.phone,
                        originalAmount: bill.total_amount || bill.price
                      }
                    }
                  ]);

                if (paymentError) throw paymentError;

                setBills(prev => prev.map(b =>
                  b.id === bill.id
                    ? {
                      ...b,
                      visit: 'visited',
                      payment_status: PAYMENT_STATUS.FULLY_PAID,
                      updated_at: new Date().toISOString()
                    }
                    : b
                ));

                Alert.alert('Thành công', 'Đã hoàn thành thanh toán tại quầy');
              } catch (error) {
                console.error('Error updating payment status:', error);
                Alert.alert('Lỗi', 'Không thể cập nhật trạng thái thanh toán');
              }
            }
          }
        ]
      );
    } else if (paymentMethod === 'vnpay') {
      try {
        console.log('🔄 Creating VNPay payment for remaining amount...');
        
        const paymentData = {
          userId: user.id,
          billData: {
            billId: bill.id,
            name: bill.name,
            phone: bill.phone,
            num_people: bill.num_people,
            originalAmount: bill.total_amount || bill.price,
            remainingAmount: remainingAmount
          },
          amount: remainingAmount,
          paymentType: 'remaining'
        };

        const result = await createVNPayPayment(paymentData);

        if (result.success) {
          console.log('✅ VNPay payment created:', result.data);
          
          setCurrentPaymentData({
            ...result.data,
            billId: bill.id,
            originalBill: bill
          });
          setVnpayUrl(result.data.vnpayUrl);
          setVnpayWebViewVisible(true);
        } else {
          throw new Error(result.message);
        }
      } catch (error) {
        console.error('❌ Error creating VNPay payment:', error);
        Alert.alert(
          'Lỗi tạo thanh toán',
          error.message || 'Không thể tạo thanh toán VNPay. Vui lòng thử lại.'
        );
      }
    }
  }, [user.id]);

  const handleVNPaySuccess = useCallback(async (vnpayData) => {
    try {
      console.log('💰 VNPay payment success:', vnpayData);
      
      const serviceResult = await handleVNPayReturn(vnpayData.rawData, true);
      
      if (serviceResult.success) {
        const { payment, bill } = serviceResult.data;
        
        if (currentPaymentData?.billId) {
          const { error: billUpdateError } = await supabase
            .from('bills')
            .update({
              visit: 'visited',
              payment_status: PAYMENT_STATUS.FULLY_PAID,
              payment_id: payment.orderid,
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
                  visit: 'visited',
                  payment_status: PAYMENT_STATUS.FULLY_PAID,
                  payment_id: payment.orderid,
                  updated_at: new Date().toISOString()
                }
                : b
            ));
          }
        }

        Alert.alert(
          '✅ Thanh toán thành công!',
          `Bạn đã thanh toán thành công ${vnpayData.amount.toLocaleString('vi-VN')}đ\n\n` +
          `Mã giao dịch: ${vnpayData.transactionNo}\n` +
          `Ngân hàng: ${vnpayData.bankCode}\n\n` +
          `Đơn hàng của bạn đã được thanh toán đầy đủ!`,
          [
            {
              text: 'OK',
              onPress: () => {
                fetchBills();
              }
            }
          ]
        );
      } else {
        throw new Error(serviceResult.message);
      }
    } catch (error) {
      console.error('❌ Error handling VNPay success:', error);
      Alert.alert(
        'Lỗi xử lý',
        'Thanh toán thành công nhưng có lỗi cập nhật dữ liệu. Vui lòng liên hệ hỗ trợ.'
      );
    } finally {
      setVnpayWebViewVisible(false);
      setCurrentPaymentData(null);
      setVnpayUrl('');
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

  // ✅ renderBillItem
  const renderBillItem = useCallback(({ item, index }) => {
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

          {billStatus === BILL_STATUS.WAITING && (
            <BillInfoRow
              icon="Info"
              text={timeStatus.text}
              iconColor={timeStatus.color}
              textStyle={{ color: timeStatus.color }}
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

        {/* Remaining Payment */}
        {billStatus === BILL_STATUS.WAITING && (
          <RemainingPaymentSection
            item={item}
            onPayRemaining={handlePayRemaining}
          />
        )}

        {/* ✅ Actions - CHỈ CHO WAITING BILLS */}
        {billStatus === BILL_STATUS.WAITING && (
          <ActionButtons
            item={item}
            timeStatus={timeStatus}
            onCancel={handleCancelBill}
            onArrived={handleArrived}
          />
        )}

        {/* Status Sections */}
        <StatusSection billStatus={billStatus} item={item} />
      </View>
    );
  }, [bills.length, getTableName, handleCancelBill, handleArrived, handlePayRemaining]);

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
  cancelButton: {
    backgroundColor: '#e74c3c',
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
});

export default HistoryScr;
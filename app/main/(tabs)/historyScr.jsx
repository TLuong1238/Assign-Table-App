import React, { memo, useCallback, useState, useEffect, useRef } from 'react';
import { View,Text,FlatList,TouchableOpacity,Alert,StyleSheet,AppState,RefreshControl} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

// Components & Utils
import ScreenWrapper from '../../../components/ScreenWrapper';
import MyHeader from '../../../components/MyHeader';
import MyLoading from '../../../components/MyLoading';
import { useAuth } from '../../../context/AuthContext';
import { hp, wp } from '../../../helper/common';
import { theme } from '../../../constants/theme';
import * as Icon from 'react-native-feather';

// Services
import { fetchBillByUser, fetchDetailByBillIds, updateBill } from '../../../services/billService';
import { fetchTable, updateTableState } from '../../../services/tableService';

// Helpers
import { getStatusColor, getStatusText, getBillStatus, BILL_STATUS } from '../../../helper/billStatus';

// ===== CONSTANTS =====
const CONFIG = {
  REFRESH_INTERVAL: 60 * 1000, // time refresh
  OVERDUE_THRESHOLD: 15, // time if customer does not arrive 
  AUTO_COMPLETE_DELAY: 40 * 60 * 1000, // time after arrival
  FLATLIST: {
    maxToRenderPerBatch: 10,
    windowSize: 10,
    initialNumToRender: 5,
    updateCellsBatchingPeriod: 50,
    itemHeight: 300
  }
};

// ===== UTILITIES =====
// time status
const TimeUtils = {
  calculateTimeStatus: (bookingTime) => {
    const now = new Date();
    const timeDiff = new Date(bookingTime).getTime() - now.getTime();
    const minutesDiff = timeDiff / (1000 * 60);

    if (minutesDiff > 10) {
      const hours = Math.floor(minutesDiff / 60);
      const minutes = Math.floor(minutesDiff % 60);
      return {
        text: `Còn ${hours > 0 ? `${hours}h ` : ''}${minutes}p mới đến giờ`,
        color: '#f39c12',
        status: 'waiting',
        canArrive: false
      };
    }

    if (minutesDiff > 0) {
      return {
        text: `Còn ${Math.floor(minutesDiff)}p nữa`,
        color: '#2ed573',
        status: 'can_arrive',
        canArrive: true
      };
    }

    if (minutesDiff > -15) {
      const overdueMinutes = Math.abs(Math.floor(minutesDiff));
      return {
        text: `Đã quá giờ ${overdueMinutes}p`,
        color: '#e74c3c',
        status: 'overdue',
        canArrive: true
      };
    }

    return {
      text: "Đơn sẽ bị hủy tự động",
      color: '#95a5a6',
      status: 'expired',
      canArrive: false
    };
  }
};

// ===== COMPONENTS =====

const BillInfoRow = memo(({ icon, text, iconColor = theme.colors.textLight, textStyle = {} }) => (
  <View style={styles.infoRow}>
    {React.createElement(Icon[icon], { width: 16, height: 16, color: iconColor })}
    <Text style={[styles.infoText, textStyle]}>{text}</Text>
  </View>
));

const TablesSection = memo(({ details, getTableName }) => {
  const tableIds = [...new Set(details.map(detail => detail.tableId))];

  return (
    <View style={styles.tablesSection}>
      <Text style={styles.tablesTitle}>Bàn đã đặt:</Text>
      <View style={styles.tablesContainer}>
        {tableIds.map(tableId => (
          <View key={tableId} style={styles.tableChip}>
            <Text style={styles.tableText}>{getTableName(tableId)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
});

const StatusSection = memo(({ billStatus, item }) => {
  const statusConfigs = {
    [BILL_STATUS.USING]: {
      style: styles.visitedSection,
      indicator: { icon: 'CheckCircle', color: '#2ed573', text: 'Đang sử dụng bàn' },
      content: (
        <>
          <Text style={styles.visitedSubText}>
            Tổng chi phí: <Text style={styles.visitedPrice}>{item.price?.toLocaleString('vi-VN') || 0}đ</Text>
          </Text>
          <Text style={styles.visitedSubText}>Chúc bạn có bữa ăn ngon miệng!</Text>
        </>
      )
    },
    [BILL_STATUS.USER_CANCELLED]: {
      style: styles.cancelledSection,
      indicator: { icon: 'Slash', color: '#e74c3c', text: 'Bạn đã hủy đơn' },
      content: <Text style={styles.cancelledSubText}>Đơn đặt bàn này đã được bạn hủy bỏ.</Text>
    },
    [BILL_STATUS.SYSTEM_CANCELLED]: {
      style: styles.unvisitedSection,
      indicator: { icon: 'AlertTriangle', color: '#f39c12', text: 'Không hoàn thành' },
      content: <Text style={styles.unvisitedSubText}>Khách hàng không đến đúng giờ, đơn đã được hệ thống hủy tự động.</Text>
    },
    [BILL_STATUS.COMPLETED]: {
      style: styles.completedSection,
      indicator: { icon: 'CheckCircle', color: '#27ae60', text: 'Đơn đã hoàn thành' },
      content: (
        <>
          <Text style={styles.completedSubText}>
            Tổng thanh toán: <Text style={styles.completedPrice}>{item.price?.toLocaleString('vi-VN') || 0}đ</Text>
          </Text>
          <Text style={styles.completedSubText}>Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi!</Text>
        </>
      )
    }
  };

  const config = statusConfigs[billStatus];
  if (!config) return null;

  return (
    <View style={config.style}>
      <View style={styles.statusIndicator}>
        {React.createElement(Icon[config.indicator.icon], {
          width: 20,
          height: 20,
          color: config.indicator.color
        })}
        <Text style={[styles.statusIndicatorText, { color: config.indicator.color }]}>
          {config.indicator.text}
        </Text>
      </View>
      {config.content}
    </View>
  );
});

const ActionButtons = memo(({ item, timeStatus, onCancel, onArrived }) => (
  <View style={styles.actionSection}>
    <TouchableOpacity style={[styles.actionButton, styles.cancelButton]} onPress={() => onCancel(item)}>
      <Icon.X width={16} height={16} color="white" />
      <Text style={styles.actionButtonText}>Hủy đơn</Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={[styles.actionButton, timeStatus.canArrive ? styles.arrivedButton : styles.disabledButton]}
      onPress={timeStatus.canArrive ? () => onArrived(item) : null}
      disabled={!timeStatus.canArrive}
    >
      <Icon.Check width={16} height={16} color="white" />
      <Text style={styles.actionButtonText}>
        {timeStatus.canArrive ? "Đã đến" : "Chưa đến giờ"}
      </Text>
    </TouchableOpacity>
  </View>
));

const EmptyState = memo(() => (
  <View style={styles.emptyContainer}>
    <Icon.Calendar width={50} height={50} color={theme.colors.textLight} />
    <Text style={styles.emptyText}>Bạn chưa có đơn đặt bàn nào</Text>
    <Text style={styles.emptySubText}>Hãy đặt bàn để thưởng thức những món ăn ngon!</Text>
  </View>
));

// ===== MAIN COMPONENT =====
const HistoryScr = () => {
  // ===== STATE =====
  const { user } = useAuth();
  const [bills, setBills] = useState([]);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ===== REFS =====
  const overdueIntervalRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const autoCompleteTimeoutsRef = useRef(new Map());

  // ===== DATA FETCHERS =====
  const fetchTableData = useCallback(async () => {
    try {
      const tableRes = await fetchTable();
      if (tableRes.success) setTables(tableRes.data);
    } catch (error) {
      console.error('Error fetching tables:', error);
    }
  }, []);

  const fetchUserBills = useCallback(async (showLoading = true) => {
    if (!user?.id) return;

    if (showLoading) setLoading(true);
    try {
      const billRes = await fetchBillByUser(user.id);

      if (billRes.success && billRes.data.length > 0) {
        const sortedBills = billRes.data.sort((a, b) =>
          new Date(b.created_at) - new Date(a.created_at)
        );

        const billIds = sortedBills.map(bill => bill.id);
        const detailRes = await fetchDetailByBillIds(billIds);

        if (detailRes.success) {
          const billsWithDetails = sortedBills.map(bill => ({
            ...bill,
            details: detailRes.data.filter(detail => detail.billId === bill.id)
          }));
          setBills(billsWithDetails);
        } else {
          setBills(sortedBills);
        }
      } else {
        setBills([]);
      }
    } catch (error) {
      console.error('Error fetching user bills:', error);
      if (showLoading) Alert.alert('Lỗi', 'Không thể lấy dữ liệu đơn đặt bàn');
    } finally {
      if (showLoading) setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  // ===== BUSINESS LOGIC =====
  const checkAndUpdateOverdueBills = useCallback(async () => {
    if (!bills.length || !user?.id) return;

    try {
      const now = new Date();
      const overdueBills = bills.filter(bill => {
        const minutesDiff = (now - new Date(bill.time)) / (1000 * 60);
        return bill.state === 'in_order' &&
          bill.visit === 'un_visited' &&
          minutesDiff > CONFIG.OVERDUE_THRESHOLD;
      });

      if (overdueBills.length === 0) return;

      const updatePromises = overdueBills.map(async (bill) => {
        try {
          const updateRes = await updateBill(bill.id, {
            visit: 'un_visited',
            state: 'cancelled'
          });

          if (updateRes.success && bill.details?.length > 0) {
            const tableIds = [...new Set(bill.details.map(detail => detail.tableId))];
            await Promise.all(tableIds.map(tableId => updateTableState(tableId, 'empty')));
          }
          return { success: true, billId: bill.id };
        } catch (error) {
          console.error(`Error updating bill ${bill.id}:`, error);
          return { success: false, billId: bill.id };
        }
      });

      const results = await Promise.allSettled(updatePromises);
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;

      if (successCount > 0) await fetchUserBills(false);
    } catch (error) {
      console.error('Error in overdue check:', error);
    }
  }, [bills, user?.id, fetchUserBills]);

  const handleCancelBill = useCallback((bill) => {
    Alert.alert(
      "Xác nhận hủy đơn",
      "Bạn có chắc chắn muốn hủy đơn này không?",
      [
        { text: "Không", style: "cancel" },
        {
          text: "Hủy đơn",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              const updateRes = await updateBill(bill.id, { state: 'cancelled' });

              if (updateRes.success) {
                // Clear auto-complete timeout
                if (autoCompleteTimeoutsRef.current.has(bill.id)) {
                  clearTimeout(autoCompleteTimeoutsRef.current.get(bill.id));
                  autoCompleteTimeoutsRef.current.delete(bill.id);
                }

                // Free tables
                if (bill.details?.length > 0) {
                  const tableIds = [...new Set(bill.details.map(detail => detail.tableId))];
                  await Promise.all(tableIds.map(tableId => updateTableState(tableId, 'empty')));
                }

                Alert.alert("Thành công", "Đã hủy đơn thành công");
                await fetchUserBills(false);
              } else {
                Alert.alert("Lỗi", updateRes.msg || "Không thể hủy đơn");
              }
            } catch (error) {
              console.error('Error cancelling bill:', error);
              Alert.alert("Lỗi", "Có lỗi xảy ra khi hủy đơn");
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  }, [fetchUserBills]);

  const handleArrived = useCallback((bill) => {
    Alert.alert(
      "Xác nhận đã đến",
      "Xác nhận bạn đã đến nhà hàng?",
      [
        { text: "Chưa", style: "cancel" },
        {
          text: "Đã đến",
          onPress: async () => {
            setLoading(true);
            try {
              const visitedTime = new Date().toISOString();

              const updateRes = await updateBill(bill.id, {
                visit: 'visited',
                time: visitedTime
              });

              if (updateRes.success) {
                // Update table states
                if (bill.details?.length > 0) {
                  const tableIds = [...new Set(bill.details.map(detail => detail.tableId))];
                  await Promise.all(tableIds.map(tableId => updateTableState(tableId, 'occupied')));
                }

                Alert.alert("Thành công", "Chúc bạn có bữa ăn ngon miệng!");

                // Schedule auto-complete
                const timeoutId = setTimeout(async () => {
                  try {
                    if (bill.details?.length > 0) {
                      const tableIds = [...new Set(bill.details.map(detail => detail.tableId))];
                      await Promise.all([
                        ...tableIds.map(tableId => updateTableState(tableId, 'empty')),
                        updateBill(bill.id, { state: 'completed' })
                      ]);
                      autoCompleteTimeoutsRef.current.delete(bill.id);
                      fetchUserBills(false);
                    }
                  } catch (error) {
                    console.error('Error auto-completing bill:', error);
                  }
                }, CONFIG.AUTO_COMPLETE_DELAY);

                autoCompleteTimeoutsRef.current.set(bill.id, timeoutId);
                await fetchUserBills(false);
              } else {
                Alert.alert("Lỗi", updateRes.msg || "Không thể cập nhật trạng thái");
              }
            } catch (error) {
              console.error('Error updating arrival status:', error);
              Alert.alert("Lỗi", "Có lỗi xảy ra khi cập nhật trạng thái");
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  }, [fetchUserBills]);

  // ===== HELPERS =====
  const getTableName = useCallback((tableId) => {
    const table = tables.find(t => t.id === tableId);
    return table ? `Bàn ${table.id} (Tầng ${table.floor})` : `Bàn ${tableId}`;
  }, [tables]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchUserBills(false);
  }, [fetchUserBills]);

  // ===== RENDER FUNCTIONS =====
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

        {/* Tables */}
        {item.details?.length > 0 && (
          <TablesSection details={item.details} getTableName={getTableName} />
        )}

        {/* Actions */}
        {billStatus === BILL_STATUS.WAITING && timeStatus.status !== 'expired' && (
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
  }, [bills.length, getTableName, handleCancelBill, handleArrived]);

  const keyExtractor = useCallback((item) => item.id.toString(), []);

  // ===== EFFECTS =====
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        fetchUserBills(false);
        checkAndUpdateOverdueBills();
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [fetchUserBills, checkAndUpdateOverdueBills]);

  useFocusEffect(
    useCallback(() => {
      if (user?.id) fetchUserBills(false);
    }, [user?.id, fetchUserBills])
  );

  useEffect(() => {
    if (user?.id) {
      fetchUserBills();
      fetchTableData();
    }
  }, [user?.id, fetchUserBills, fetchTableData]);

  useEffect(() => {
    if (!user?.id) return;

    overdueIntervalRef.current = setInterval(checkAndUpdateOverdueBills, CONFIG.REFRESH_INTERVAL);
    return () => clearInterval(overdueIntervalRef.current);
  }, [user?.id, checkAndUpdateOverdueBills]);

  useEffect(() => {
    // Setup auto-complete for existing visited bills
    bills.forEach(bill => {
      if (bill.visit === 'visited' && bill.state === 'in_order' && !autoCompleteTimeoutsRef.current.has(bill.id)) {
        const visitTime = new Date(bill.time);
        const now = new Date();
        const elapsed = now - visitTime;
        const remaining = CONFIG.AUTO_COMPLETE_DELAY - elapsed;

        if (remaining > 0) {
          const timeoutId = setTimeout(async () => {
            try {
              if (bill.details?.length > 0) {
                const tableIds = [...new Set(bill.details.map(detail => detail.tableId))];
                await Promise.all([
                  ...tableIds.map(tableId => updateTableState(tableId, 'empty')),
                  updateBill(bill.id, { state: 'completed' })
                ]);
                autoCompleteTimeoutsRef.current.delete(bill.id);
                fetchUserBills(false);
              }
            } catch (error) {
              console.error('Error auto-completing existing bill:', error);
            }
          }, remaining);

          autoCompleteTimeoutsRef.current.set(bill.id, timeoutId);
        }
      }
    });
  }, [bills, fetchUserBills]);

  useEffect(() => {
    return () => {
      // Cleanup all timeouts
      autoCompleteTimeoutsRef.current.forEach(timeoutId => clearTimeout(timeoutId));
      autoCompleteTimeoutsRef.current.clear();
      if (overdueIntervalRef.current) clearInterval(overdueIntervalRef.current);
    };
  }, []);

  // Loading
  if (loading && bills.length === 0) {
    return (
      <ScreenWrapper bg="#FFBF00">
        <View style={styles.container}>
          <MyHeader title="Lịch sử đặt bàn" showBackButton={false} />
          <View style={styles.fullScreenLoading}>
            <MyLoading text="Đang tải lịch sử đặt bàn..." />
          </View>
        </View>
      </ScreenWrapper>
    );
  }

  // ===== RENDER =====
  return (
    <ScreenWrapper bg="#FFBF00">
      <View style={styles.container}>
        <MyHeader title="Lịch sử đặt bàn" showBackButton={false} />

        {bills.length === 0 ? (
          <EmptyState />
        ) : (
          <FlatList
            data={bills}
            renderItem={renderBillItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[theme.colors.primary]}
                tintColor={theme.colors.primary}
              />
            }
            removeClippedSubviews={true}
            maxToRenderPerBatch={CONFIG.FLATLIST.maxToRenderPerBatch}
            windowSize={CONFIG.FLATLIST.windowSize}
            initialNumToRender={CONFIG.FLATLIST.initialNumToRender}
            updateCellsBatchingPeriod={CONFIG.FLATLIST.updateCellsBatchingPeriod}
            getItemLayout={(data, index) => ({
              length: CONFIG.FLATLIST.itemHeight,
              offset: CONFIG.FLATLIST.itemHeight * index,
              index,
            })}
          />
        )}
      </View>
    </ScreenWrapper>
  );
};

// ===== STYLES =====
const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: wp(4) },
  listContainer: { paddingBottom: hp(2) },

  billCard: {
    backgroundColor: 'white', borderRadius: 12, padding: wp(4), marginVertical: hp(1),
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1,
    shadowRadius: 3, elevation: 3
  },

  billHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: hp(1.5) },
  billHeaderLeft: { flex: 1 },
  billId: { fontSize: 18, fontWeight: 'bold', color: theme.colors.dark },
  billPrice: { fontSize: 16, fontWeight: '600', color: theme.colors.primary, marginTop: hp(0.3) },

  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 15 },
  statusText: { color: 'white', fontSize: 12, fontWeight: '600' },

  billInfo: { gap: hp(0.8) },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: wp(2) },
  infoText: { fontSize: 14, color: theme.colors.text, flex: 1 },
  priceText: { fontWeight: '600', color: theme.colors.primary },

  tablesSection: {
    marginTop: hp(1.5), paddingTop: hp(1.5),
    borderTopWidth: 1, borderTopColor: theme.colors.gray
  },
  tablesTitle: { fontSize: 14, fontWeight: '600', color: theme.colors.dark, marginBottom: hp(1) },
  tablesContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: wp(2) },
  tableChip: { backgroundColor: theme.colors.primaryLight, paddingHorizontal: wp(3), paddingVertical: hp(0.5), borderRadius: 20 },
  tableText: { fontSize: 12, color: theme.colors.primary, fontWeight: '500' },

  actionSection: {
    flexDirection: 'row', gap: wp(3), marginTop: hp(1.5), paddingTop: hp(1.5),
    borderTopWidth: 1, borderTopColor: theme.colors.gray
  },
  actionButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: hp(1.2), borderRadius: 8, gap: wp(2)
  },
  cancelButton: { backgroundColor: '#e74c3c' },
  arrivedButton: { backgroundColor: '#2ed573' },
  disabledButton: { backgroundColor: '#95a5a6' },
  actionButtonText: { color: 'white', fontSize: 14, fontWeight: '600' },

  // Status sections
  visitedSection: {
    marginTop: hp(1.5), paddingHorizontal: wp(3), paddingVertical: hp(1),
    backgroundColor: '#f0fff4', borderRadius: 8, borderWidth: 1, borderColor: '#90ee90'
  },
  cancelledSection: {
    marginTop: hp(1.5), paddingHorizontal: wp(3), paddingVertical: hp(1),
    backgroundColor: '#fff0f0', borderRadius: 8, borderWidth: 1, borderColor: '#ffb3b3'
  },
  unvisitedSection: {
    marginTop: hp(1.5), paddingHorizontal: wp(3), paddingVertical: hp(1),
    backgroundColor: '#fff8f0', borderRadius: 8, borderWidth: 1, borderColor: '#ffd699'
  },
  completedSection: {
    marginTop: hp(1.5), paddingHorizontal: wp(3), paddingVertical: hp(1),
    backgroundColor: '#f0fff4', borderRadius: 8, borderWidth: 1, borderColor: '#90ee90'
  },

  statusIndicator: { flexDirection: 'row', alignItems: 'center', gap: wp(2), marginBottom: hp(0.5) },
  statusIndicatorText: { fontSize: 14, fontWeight: '600' },

  visitedSubText: { fontSize: 12, color: theme.colors.textLight, fontStyle: 'italic', marginBottom: hp(0.5) },
  visitedPrice: { fontWeight: 'bold', color: theme.colors.primary, fontSize: 14 },

  cancelledSubText: { fontSize: 12, color: theme.colors.textLight, fontStyle: 'italic' },
  unvisitedSubText: { fontSize: 12, color: theme.colors.textLight, fontStyle: 'italic' },

  completedSubText: { fontSize: 12, color: theme.colors.textLight, fontStyle: 'italic', marginBottom: hp(0.3) },
  completedPrice: { fontWeight: 'bold', color: '#27ae60', fontSize: 14 },

  fullScreenLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },

  emptyContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    gap: hp(2), paddingHorizontal: wp(8)
  },
  emptyText: { fontSize: 18, fontWeight: '600', color: theme.colors.dark, textAlign: 'center' },
  emptySubText: { fontSize: 14, color: theme.colors.textLight, textAlign: 'center', lineHeight: 20 },
});

export default memo(HistoryScr);
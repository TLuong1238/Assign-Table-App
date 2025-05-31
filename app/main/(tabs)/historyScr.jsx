import { View, Text, StyleSheet, FlatList, Alert, TouchableOpacity } from 'react-native';
import React, { useState, useEffect } from 'react';
import { fetchBillByUser, fetchDetailByBillIds, updateBill } from '../../../services/billService';
import { fetchTable, updateTableState } from '../../../services/tableService';
import ScreenWrapper from '../../../components/ScreenWrapper';
import MyHeader from '../../../components/MyHeader';
import { hp, wp } from '../../../helper/common';
import { theme } from '../../../constants/theme';
import { useAuth } from '../../../context/AuthContext';
// Sửa import ở đầu file (dòng 7)
import * as Icon from 'react-native-feather';
const HistoryScr = () => {
  const { user } = useAuth();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tables, setTables] = useState([]);

  useEffect(() => {
    if (user) {
      fetchUserBills();
      fetchTableData();

      // ✅ Set interval để check overdue bills mỗi phút
      const overdueInterval = setInterval(() => {
        checkAndUpdateOverdueBills();
      }, 60 * 1000); // Check mỗi phút

      // Cleanup interval
      return () => {
        clearInterval(overdueInterval);
      };
    }
  }, [user]);

  // Fetch table data để hiển thị tên bàn
  const fetchTableData = async () => {
    try {
      const tableRes = await fetchTable();
      if (tableRes.success) {
        setTables(tableRes.data);
      }
    } catch (error) {
      console.error('Error fetching tables:', error);
    }
  };

  // Fetch bills của user hiện tại
  const fetchUserBills = async () => {
    setLoading(true);
    try {
      const billRes = await fetchBillByUser(user.id);

      if (billRes.success && billRes.data.length > 0) {
        // Sort bills theo thời gian tạo (mới nhất trước)
        const sortedBills = billRes.data.sort((a, b) =>
          new Date(b.created_at) - new Date(a.created_at)
        );

        // Fetch details cho mỗi bill
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
      Alert.alert('Lỗi', 'Không thể lấy dữ liệu đơn đặt bàn');
    }
    setLoading(false);
  };

  // Get table name từ tableId
  const getTableName = (tableId) => {
    const table = tables.find(t => t.id === tableId);
    return table ? `Bàn ${table.id} (Tầng ${table.floor})` : `Bàn ${tableId}`;
  };

  // ✅ Function check và update bills quá giờ
  const checkAndUpdateOverdueBills = async () => {
    try {
      const now = new Date();

      // Tìm bills quá giờ mà chưa check-in
      const overdueBills = bills.filter(bill => {
        const bookingTime = new Date(bill.time);
        const timeDiff = now.getTime() - bookingTime.getTime();
        const minutesDiff = timeDiff / (1000 * 60);

        return (
          bill.state === 'in_order' &&
          bill.visit === 'on_process' && // ✅ Sửa thành on_process
          minutesDiff > 20 // Quá giờ 20 phút
        );
      });

      if (overdueBills.length > 0) {
        console.log(`Found ${overdueBills.length} overdue bills, updating to unvisited...`);

        // Update từng bill quá giờ
        for (const bill of overdueBills) {
          const updateRes = await updateBill(bill.id, {
            visit: 'unvisited', // ✅ Set thành unvisited
            state: 'cancelled'   // Cancel bill quá giờ
          });

          if (updateRes.success) {
            // ✅ Giải phóng bàn khi quá giờ
            if (bill.details && bill.details.length > 0) {
              const tableIds = [...new Set(bill.details.map(detail => detail.tableId))];

              for (const tableId of tableIds) {
                await updateTableState(tableId, 'empty');
                console.log(`Table ${tableId} set to empty (overdue)`);
              }
            }

            console.log(`Updated overdue bill ${bill.id} to unvisited`);
          }
        }

        // Refresh data để cập nhật UI
        fetchUserBills();
      }
    } catch (error) {
      console.error('Error checking overdue bills:', error);
    }
  };

  // ✅ Xử lý hủy đơn
  const handleCancelBill = async (bill) => {
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
              // Update bill status
              const updateRes = await updateBill(bill.id, {
                state: 'cancelled',
                // ✅ Giữ nguyên visit = 'on_process' khi user tự hủy
              });

              if (updateRes.success) {
                // ✅ Giải phóng bàn khi user hủy đơn
                if (bill.details && bill.details.length > 0) {
                  const tableIds = [...new Set(bill.details.map(detail => detail.tableId))];

                  for (const tableId of tableIds) {
                    await updateTableState(tableId, 'empty');
                    console.log(`Table ${tableId} set to empty (user cancelled)`);
                  }
                }

                Alert.alert("Thành công", "Đã hủy đơn thành công");
                fetchUserBills(); // Refresh data
              } else {
                Alert.alert("Lỗi", updateRes.msg || "Không thể hủy đơn");
              }
            } catch (error) {
              console.error('Error cancelling bill:', error);
              Alert.alert("Lỗi", "Có lỗi xảy ra khi hủy đơn");
            }
            setLoading(false);
          }
        }
      ]
    );
  };

  // ✅ Xử lý khi khách hàng đã đến
  const handleArrived = async (bill) => {
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
              // Update visit status
              const updateRes = await updateBill(bill.id, {
                visit: 'on_process', // ✅ Set visit thành on_process
              });

              if (updateRes.success) {
                // ✅ Set bàn thành occupied khi khách check-in
                if (bill.details && bill.details.length > 0) {
                  const tableIds = [...new Set(bill.details.map(detail => detail.tableId))];

                  for (const tableId of tableIds) {
                    await updateTableState(tableId, 'occupied');
                    console.log(`Table ${tableId} set to occupied (customer arrived)`);
                  }
                }

                Alert.alert("Thành công", "Chúc bạn có bữa ăn ngon miệng!");

                // ✅ Set timeout để tự động giải phóng bàn sau 1 giờ
                setTimeout(async () => {
                  try {
                    if (bill.details && bill.details.length > 0) {
                      const tableIds = [...new Set(bill.details.map(detail => detail.tableId))];

                      // Giải phóng tất cả bàn
                      for (const tableId of tableIds) {
                        await updateTableState(tableId, 'empty');
                        console.log(`Table ${tableId} set to empty (1 hour completed)`);
                      }

                      // Update bill status thành completed
                      await updateBill(bill.id, {
                        state: 'completed',
                      });


                      // Optional: Refresh bills để cập nhật UI
                      fetchUserBills();
                    }
                  } catch (error) {
                    console.error('Lỗi khi giải phóng bàn sau 1 giờ:', error);
                  }
                }, 40 * 60 * 1000);

                fetchUserBills(); // Refresh để hiển thị trạng thái mới
              } else {
                Alert.alert("Lỗi", updateRes.msg || "Không thể cập nhật trạng thái");
              }
            } catch (error) {
              console.error('Error updating arrival status:', error);
              Alert.alert("Lỗi", "Có lỗi xảy ra khi cập nhật trạng thái");
            }
            setLoading(false);
          }
        }
      ]
    );
  };

  // Get màu sắc theo trạng thái
  const getStatusColor = (state) => {
    switch (state) {
      case 'in_order': return theme.colors.primary;
      case 'completed': return '#2ed573';
      case 'cancelled': return '#ff4757';
      default: return theme.colors.textLight;
    }
  };

  // Get text hiển thị theo trạng thái
  const getStatusText = (state) => {
    switch (state) {
      case 'in_order': return 'Đang đặt';
      case 'completed': return 'Hoàn thành';
      case 'cancelled': return 'Đã hủy';
      default: return state;
    }
  };

  // ✅ Component hiển thị countdown timer cho khách đã check-in
  const CountdownTimer = ({ startTime }) => {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
      const interval = setInterval(() => {
        const now = new Date();
        const visitTime = new Date(startTime);
        const endTime = new Date(visitTime.getTime() + 60 * 60 * 1000); // +1 hour
        const diff = endTime.getTime() - now.getTime();

        if (diff <= 0) {
          setTimeLeft('Hết thời gian');
          clearInterval(interval);
        } else {
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);
          setTimeLeft(`${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
        }
      }, 1000);

      return () => clearInterval(interval);
    }, [startTime]);

    return (
      <Text style={styles.countdownText}>
        Thời gian còn lại: {timeLeft}
      </Text>
    );
  };

  // Render mỗi bill item
  const renderBillItem = ({ item, index }) => {
    // ✅ Get thông tin thời gian với logic overdue
    const getTimeStatus = () => {
      const now = new Date();
      const bookingTime = new Date(item.time);
      const timeDiff = bookingTime.getTime() - now.getTime();
      const minutesDiff = timeDiff / (1000 * 60);

      if (minutesDiff > 10) {
        const hours = Math.floor(minutesDiff / 60);
        const minutes = Math.floor(minutesDiff % 60);
        return {
          text: `Còn ${hours > 0 ? `${hours}h ` : ''}${minutes}p mới đến giờ`,
          color: 'orange',
          status: 'waiting'
        };
      } else if (minutesDiff > 0) {
        return {
          text: `Còn ${Math.floor(minutesDiff)}p nữa`,
          color: 'green',
          status: 'can_arrive'
        };
      } else if (minutesDiff > -20) { // ✅ Trong vòng 20 phút sau giờ đặt
        const overdueMinutes = Math.abs(Math.floor(minutesDiff));
        return {
          text: `Đã quá giờ ${overdueMinutes}p`,
          color: 'red',
          status: 'overdue'
        };
      } else {
        return {
          text: "Đơn của bạn đã bị hủy do quá thời gian",
          color: '#666',
          status: 'expired'
        };
      }
    };

    const timeStatus = getTimeStatus();

    return (
      <View style={styles.billCard}>
        {/* Header với ID và status */}
        <View style={styles.billHeader}>
          <View style={styles.billHeaderLeft}>
            <Text style={styles.billId}>Đơn #{bills.length - index}</Text>
            {/* ✅ THÊM - Hiển thị giá tiền ngay dưới ID */}
            <Text style={styles.billPrice}>
              {item.price ? `${item.price.toLocaleString('vi-VN')}đ` : 'Miễn phí'}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.state) }]}>
            <Text style={styles.statusText}>{getStatusText(item.state)}</Text>
          </View>
        </View>

        {/* Thông tin chi tiết */}
        <View style={styles.billInfo}>
          <View style={styles.infoRow}>
            <Icon.User width={16} height={16} color={theme.colors.textLight} />
            <Text style={styles.infoText}>{item.name}</Text>
          </View>

          <View style={styles.infoRow}>
            <Icon.Phone width={16} height={16} color={theme.colors.textLight} />
            <Text style={styles.infoText}>{item.phone}</Text>
          </View>

          <View style={styles.infoRow}>
            <Icon.Users width={16} height={16} color={theme.colors.textLight} />
            <Text style={styles.infoText}>{item.num_people} người</Text>
          </View>

          <View style={styles.infoRow}>
            <Icon.Clock width={16} height={16} color={theme.colors.textLight} />
            <Text style={styles.infoText}>
              {new Date(item.time).toLocaleString('vi-VN')}
            </Text>
          </View>
          {/* ✅ THÊM DÒNG NÀY - Hiển thị giá tiền */}
          <View style={styles.infoRow}>
            <Icon.DollarSign width={16} height={16} color={theme.colors.primary} />
            <Text style={[styles.infoText, styles.priceText]}>
              {item.price ? `${item.price.toLocaleString('vi-VN')}đ` : 'Chưa có món ăn'}
            </Text>
          </View>

          {/* ✅ Hiển thị thông tin thời gian cho đơn đang chờ */}
          {item.state === 'in_order' && item.visit === 'on_process' && (
            <View style={styles.infoRow}>
              <Icon.Info width={16} height={16} color={timeStatus.color} />
              <Text style={[styles.infoText, { color: timeStatus.color }]}>
                {timeStatus.text}
              </Text>
            </View>
          )}

          {/* Note nếu có */}
          {item.note && (
            <View style={styles.infoRow}>
              <Icon.FileText width={16} height={16} color={theme.colors.textLight} />
              <Text style={styles.infoText}>{item.note}</Text>
            </View>
          )}
        </View>

        {/* Danh sách bàn đã đặt */}
        {item.details && item.details.length > 0 && (
          <View style={styles.tablesSection}>
            <Text style={styles.tablesTitle}>Bàn đã đặt:</Text>
            <View style={styles.tablesContainer}>
              {[...new Set(item.details.map(detail => detail.tableId))].map(tableId => (
                <View key={tableId} style={styles.tableChip}>
                  <Text style={styles.tableText}>{getTableName(tableId)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ✅ Action buttons - Cập nhật logic với overdue check */}
        {item.state === 'in_order' && item.visit === 'on_process' && timeStatus.status !== 'expired' && (
          <View style={styles.actionSection}>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={() => handleCancelBill(item)}
            >
              <Icon.X width={16} height={16} color="white" />
              <Text style={styles.actionButtonText}>Hủy đơn</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionButton,
                (timeStatus.status === 'can_arrive' || timeStatus.status === 'overdue')
                  ? styles.arrivedButton
                  : styles.disabledButton
              ]}
              onPress={(timeStatus.status === 'can_arrive' || timeStatus.status === 'overdue')
                ? () => handleArrived(item)
                : null}
              disabled={!(timeStatus.status === 'can_arrive' || timeStatus.status === 'overdue')}
            >
              <Icon.Check width={16} height={16} color="white" />
              <Text style={styles.actionButtonText}>
                {(timeStatus.status === 'can_arrive' || timeStatus.status === 'overdue')
                  ? "Đã đến"
                  : "Chưa đến giờ"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ✅ Hiển thị thông báo khi đã check-in */}
        {item.state === 'in_order' && item.visit === 'visited' && (
          <View style={styles.visitedSection}>
            <View style={styles.visitedIndicator}>
              <Icon.CheckCircle width={20} height={20} color="green" />
              <Text style={styles.visitedText}>Bạn đã check-in thành công</Text>
            </View>
            {/* ✅ THÊM - Hiển thị tổng chi phí */}
            <Text style={styles.visitedSubText}>
              Tổng chi phí: <Text style={styles.visitedPrice}>{item.price?.toLocaleString('vi-VN') || 0}đ</Text>
            </Text>
            <Text style={styles.visitedSubText}>
              Chúc bạn có bữa ăn ngon miệng! Bàn sẽ được giải phóng sau 1 giờ.
            </Text>
            <CountdownTimer startTime={item.updated_at || item.created_at} />
          </View>
        )}

        {/* ✅ Hiển thị thông báo khi user tự hủy đơn */}
        {item.state === 'cancelled' && item.visit === 'on_process' && (
          <View style={styles.cancelledSection}>
            <View style={styles.cancelledIndicator}>
              <Icon.Slash width={20} height={20} color="#ff6b6b" />
              <Text style={styles.cancelledText}>Bạn đã hủy đơn</Text>
            </View>
            <Text style={styles.cancelledSubText}>
              Đơn đặt bàn này đã được bạn hủy bỏ.
            </Text>
          </View>
        )}

        {/* ✅ Hiển thị thông báo khi visit = 'unvisited' (đến muộn) */}
        {item.visit === 'unvisited' && (
          <View style={styles.unvisitedSection}>
            <View style={styles.unvisitedIndicator}>
              <Icon.XCircle width={20} height={20} color="#ff6b6b" />
              <Text style={styles.unvisitedText}>Không đến đúng giờ</Text>
            </View>
            <Text style={styles.unvisitedSubText}>
              Bạn đã không đến trong vòng 20 phút. Đơn đã được tự động hủy.
            </Text>
          </View>
        )}

        {/* ✅ Hiển thị thông báo khi đơn đã hoàn thành */}
        {item.state === 'completed' && (
          <View style={styles.completedSection}>
            <View style={styles.completedIndicator}>
              <Icon.CheckCircle width={20} height={20} color="#2ed573" />
              <Text style={styles.completedText}>Đơn đã hoàn thành</Text>
            </View>
            {/* ✅ THÊM - Hiển thị tổng thanh toán */}
            <Text style={styles.completedSubText}>
              Tổng thanh toán: <Text style={styles.completedPrice}>{item.price?.toLocaleString('vi-VN') || 0}đ</Text>
            </Text>
            <Text style={styles.completedSubText}>
              Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi!
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <ScreenWrapper bg="#FFBF00">
      <View style={styles.container}>
        <MyHeader title="Lịch sử đặt bàn" showBackButton={false} />

        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Đang tải...</Text>
          </View>
        ) : bills.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon.Calendar width={50} height={50} color={theme.colors.textLight} />
            <Text style={styles.emptyText}>Bạn chưa có đơn đặt bàn nào</Text>
            <Text style={styles.emptySubText}>Hãy đặt bàn để thưởng thức những món ăn ngon!</Text>
          </View>
        ) : (
          <FlatList
            data={bills}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderBillItem}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            refreshing={loading}
            onRefresh={fetchUserBills}
          />
        )}
      </View>
    </ScreenWrapper>
  );
};

export default HistoryScr;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: wp(4),
  },
  listContainer: {
    paddingBottom: hp(2),
  },
  billCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: wp(4),
    marginVertical: hp(1),
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  billHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center', // ✅ SỬA thành 'flex-start' để align đúng
    marginBottom: hp(1.5),
  },
  priceText: {
    fontWeight: '600',
    color: theme.colors.primary,
  },
  // ✅ THÊM MỚI
  billHeaderLeft: {
    flex: 1,
  },
  billPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primary,
    marginTop: hp(0.3),
  },
  billId: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.dark,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 15,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  billInfo: {
    gap: hp(0.8),
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
  },
  infoText: {
    fontSize: 14,
    color: theme.colors.text,
    flex: 1,
  },
  tablesSection: {
    marginTop: hp(1.5),
    paddingTop: hp(1.5),
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray,
  },
  tablesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.dark,
    marginBottom: hp(1),
  },
  tablesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: wp(2),
  },
  tableChip: {
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.5),
    borderRadius: 20,
  },
  tableText: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  actionSection: {
    flexDirection: 'row',
    gap: wp(3),
    marginTop: hp(1.5),
    paddingTop: hp(1.5),
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp(1.2),
    borderRadius: 8,
    gap: wp(2),
  },
  cancelButton: {
    backgroundColor: '#ff4757',
  },
  arrivedButton: {
    backgroundColor: '#2ed573',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#95a5a6',
  },
  visitedSection: {
    marginTop: hp(1.5),
    paddingTop: hp(1.5),
    paddingHorizontal: wp(3),
    paddingVertical: hp(1),
    backgroundColor: '#f0fff4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#90ee90',
  },
  visitedPrice: {
    fontWeight: 'bold',
    color: theme.colors.primary,
    fontSize: 14,
  },
  visitedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
    marginBottom: hp(0.5),
  },
  visitedText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'green',
  },
  visitedSubText: {
    fontSize: 12,
    color: theme.colors.textLight,
    fontStyle: 'italic',
    marginBottom: hp(0.5),
  },
  countdownText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2ed573',
  },
  unvisitedSection: {
    marginTop: hp(1.5),
    paddingTop: hp(1.5),
    paddingHorizontal: wp(3),
    paddingVertical: hp(1),
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  unvisitedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
    marginBottom: hp(0.5),
  },
  unvisitedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ff6b6b',
  },
  unvisitedSubText: {
    fontSize: 12,
    color: theme.colors.textLight,
    fontStyle: 'italic',
  },
  cancelledSection: {
    marginTop: hp(1.5),
    paddingTop: hp(1.5),
    paddingHorizontal: wp(3),
    paddingVertical: hp(1),
    backgroundColor: '#fff0f0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffb3b3',
  },
  cancelledIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
    marginBottom: hp(0.5),
  },
  cancelledText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e74c3c',
  },
  cancelledSubText: {
    fontSize: 12,
    color: theme.colors.textLight,
    fontStyle: 'italic',
  },
  completedSection: {
    marginTop: hp(1.5),
    paddingTop: hp(1.5),
    paddingHorizontal: wp(3),
    paddingVertical: hp(1),
    backgroundColor: '#f0fff4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#90ee90',
  },
  completedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
    marginBottom: hp(0.5),
  },
  completedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2ed573',
  },
  completedSubText: {
    fontSize: 12,
    color: theme.colors.textLight,
    fontStyle: 'italic',
  },
  completedPrice: {
    fontWeight: 'bold',
    color: '#2ed573',
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.text,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: hp(2),
    paddingHorizontal: wp(8),
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.dark,
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: 14,
    color: theme.colors.textLight,
    textAlign: 'center',
    lineHeight: 20,
  },
});
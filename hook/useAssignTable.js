import { useState, useCallback, useMemo, useRef } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { fetchTable } from '../services/tableService';
import { fetchProduct } from '../services/productService';
import { fetchCate } from '../services/cateServiec';
import { createCartDetail } from '../services/cartDetailService';
import { calculateDepositAmount, formatCurrency, PAYMENT_CONFIG, TimeUtils } from '../constants/paymentConfig';
import { createBill, createDetail } from '../services/billService';
import { supabase } from '../lib/supabase';

const SEARCH_DEBOUNCE_DELAY = 300;
const MAX_QUANTITY_PER_ITEM = 20;
const PEOPLE_PER_TABLE = 6;
const STATUS_MESSAGE_DURATION = 5000;

export const useAssignTable = (user) => {
  // State management
  const [tableState, setTableState] = useState({
    tables: [],
    floors: [],
    bills: [],
    chooseTable: [],
    statusMessage: ''
  });

  const [formState, setFormState] = useState({
    name: '',
    phone: '',
    note: '',
    peopleCount: 1,
    date: new Date(),
    time: new Date(),
    showDatePicker: false,
    showTimePicker: false
  });

  const [productState, setProductState] = useState({
    products: [],
    categories: [],
    filteredProducts: [],
    selectedCategory: 'all',
    searchQuery: ''
  });

  const [modalState, setModalState] = useState({
    showFoodModal: false,
    showCartModal: false
  });

  const [cart, setCart] = useState({
    details: [],
    cartPrice: 0
  });

  const [loading, setLoading] = useState(false);
  // ✅ THÊM VNPay states
  const [vnpayLoading, setVnpayLoading] = useState(false);
  const [showWebView, setShowWebView] = useState(false);
  const [vnpayUrl, setVnpayUrl] = useState('');
  const [currentPayment, setCurrentPayment] = useState(null);
  const [paymentResult, setPaymentResult] = useState(null);

  const searchTimeoutRef = useRef(null);
  const statusTimeoutRef = useRef(null);

  // ✅ Payment state
  const [paymentState, setPaymentState] = useState({
    showPaymentModal: false,
    selectedPaymentMethod: null,
    depositAmount: 0,
    totalAmount: 0,
    tableDeposit: PAYMENT_CONFIG.TABLE_DEPOSIT
  });

  // ✅ CHECK VIP USER
  const isVipUser = useMemo(() => user?.role === 'vip', [user?.role]);

  // ✅ APPOINTMENT TIME MEMOIZED
  const appointmentTime = useMemo(() => {
    return new Date(
      formState.date.getFullYear(),
      formState.date.getMonth(),
      formState.date.getDate(),
      formState.time.getHours(),
      formState.time.getMinutes()
    );
  }, [formState.date, formState.time]);

  // ✅ PAYMENT REQUIREMENT THEO THỜI GIAN
  const paymentRequirement = useMemo(() => {
    const hoursUntil = (appointmentTime.getTime() - Date.now()) / (1000 * 60 * 60);

    return {
      required: !isVipUser && hoursUntil < 24,
      reason: isVipUser
        ? 'VIP - No payment required'
        : hoursUntil >= 24
          ? 'More than 24 hours - No payment required'
          : 'Less than 24 hours - Payment required',
      hoursUntil: Math.ceil(hoursUntil)
    };
  }, [appointmentTime, cart.cartPrice, isVipUser]);

  // ✅ VNPay helper functions
  const closeWebView = useCallback(() => {
    setShowWebView(false);
    setVnpayUrl('');
    setCurrentPayment(null);
    setVnpayLoading(false);
  }, []);

  const resetPayment = useCallback(() => {
    setCurrentPayment(null);
    setPaymentResult(null);
    setVnpayUrl('');
    setShowWebView(false);
    setVnpayLoading(false);
  }, []);

  // function to show message and auto-hide
  const showStatusMessage = useCallback((message, duration = STATUS_MESSAGE_DURATION) => {
    setTableState(prev => ({
      ...prev,
      statusMessage: message
    }));

    if (statusTimeoutRef.current) {
      clearTimeout(statusTimeoutRef.current);
    }

    statusTimeoutRef.current = setTimeout(() => {
      setTableState(prev => ({
        ...prev,
        statusMessage: ''
      }));
    }, duration);
  }, []);

  const hideStatusMessage = useCallback(() => {
    setTableState(prev => ({
      ...prev,
      statusMessage: ''
    }));

    if (statusTimeoutRef.current) {
      clearTimeout(statusTimeoutRef.current);
    }
  }, []);

  // Memoized derived values
  const requiredTables = useMemo(() =>
    Math.ceil(formState.peopleCount / PEOPLE_PER_TABLE) || 1,
    [formState.peopleCount]
  );

  const totalCartItems = useMemo(() =>
    cart.details.reduce((total, detail) => total + detail.num, 0),
    [cart.details]
  );

  const availableTables = useMemo(() =>
    tableState.tables.filter(table =>
      table.state !== 'in_use' && !tableState.chooseTable.includes(table.id)
    ),
    [tableState.tables, tableState.chooseTable]
  );

  // ✅ CALCULATE PAYMENT AMOUNTS
  const calculatePaymentAmounts = useCallback(() => {
    const totalAmount = cart.cartPrice || 0;
    const hasFood = cart.details.length > 0;
    const depositAmount = calculateDepositAmount(totalAmount, hasFood, isVipUser, appointmentTime);

    setPaymentState(prev => ({
      ...prev,
      totalAmount,
      depositAmount,
      tableDeposit: hasFood ? 0 : PAYMENT_CONFIG.TABLE_DEPOSIT
    }));

    return { totalAmount, depositAmount };
  }, [cart.cartPrice, cart.details.length, isVipUser, appointmentTime]);

  // Data fetching functions
  const fetchProductsData = useCallback(async () => {
    try {
      const [productRes, categoryRes] = await Promise.all([
        fetchProduct(),
        fetchCate()
      ]);

      const products = productRes.success && Array.isArray(productRes.data)
        ? productRes.data
        : [];
      const categories = categoryRes.success && Array.isArray(categoryRes.data)
        ? categoryRes.data
        : [];

      setProductState(prev => ({
        ...prev,
        products,
        categories,
        filteredProducts: products
      }));
    } catch (error) {
      console.error('Error fetching products/categories:', error);
      setProductState(prev => ({
        ...prev,
        products: [],
        categories: [],
        filteredProducts: []
      }));
    }
  }, []);

  const refreshTableData = useCallback(async () => {
    setLoading(true);
    try {
      const tableRes = await fetchTable();

      if (!tableRes.success) {
        Alert.alert('Lỗi', 'Không thể lấy dữ liệu bàn');
        return;
      }

      const updatedTables = tableRes.data.map(table => ({
        ...table,
        state: table.state || 'empty'
      }));

      const groupedFloors = updatedTables.reduce((acc, table) => {
        if (!acc[table.floor]) acc[table.floor] = [];
        acc[table.floor].push(table);
        return acc;
      }, {});

      setTableState(prev => ({
        ...prev,
        tables: updatedTables,
        floors: Object.values(groupedFloors)
      }));
    } catch (error) {
      console.error('Error in refreshTableData:', error);
      Alert.alert('Lỗi', 'Có lỗi xảy ra khi lấy dữ liệu');
    } finally {
      setLoading(false);
    }
  }, []);

  // Filter products function
  const filterProducts = useCallback((products, selectedCategory, searchQuery) => {
    if (!products || products.length === 0) {
      return [];
    }

    let filtered = [...products];

    if (selectedCategory && selectedCategory !== 'all') {
      if (selectedCategory === 'favorite') {
        filtered = filtered.filter(product => product.isFavor === true);
      } else {
        filtered = filtered.filter(product => {
          const productCateId = product.cateId;
          const categoryId = selectedCategory;
          return productCateId == categoryId;
        });
      }
    }

    if (searchQuery && searchQuery.trim() !== '') {
      const searchLower = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(product =>
        product.name && product.name.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, []);

  // Search handlers
  const handleSearch = useCallback((query) => {
    setProductState(prev => ({ ...prev, searchQuery: query }));

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setProductState(currentState => {
        const filtered = filterProducts(
          currentState.products,
          currentState.selectedCategory,
          query
        );
        return {
          ...currentState,
          filteredProducts: filtered
        };
      });
    }, SEARCH_DEBOUNCE_DELAY);
  }, [filterProducts]);

  const clearSearch = useCallback(() => {
    setProductState(prev => {
      const filtered = filterProducts(
        prev.products,
        prev.selectedCategory,
        ''
      );
      return {
        ...prev,
        searchQuery: '',
        filteredProducts: filtered
      };
    });
  }, [filterProducts]);

  const handleCategoryChange = useCallback((categoryId) => {
    setProductState(prev => {
      const filtered = filterProducts(prev.products, categoryId, prev.searchQuery);
      return {
        ...prev,
        selectedCategory: categoryId,
        filteredProducts: filtered
      };
    });
  }, [filterProducts]);

  // Cart functions
  const addToCart = useCallback((product, quantity = 1) => {
    setCart(prevCart => {
      const existingDetailIndex = prevCart.details.findIndex(
        detail => detail.productId === product.id
      );

      let newDetails = [...prevCart.details];

      if (existingDetailIndex >= 0) {
        const currentQuantity = newDetails[existingDetailIndex].num;
        const newQuantity = Math.min(currentQuantity + quantity, MAX_QUANTITY_PER_ITEM);

        if (newQuantity <= 0) {
          newDetails.splice(existingDetailIndex, 1);
        } else {
          newDetails[existingDetailIndex] = {
            ...newDetails[existingDetailIndex],
            num: newQuantity
          };
        }
      } else if (quantity > 0) {
        newDetails.push({
          productId: product.id,
          num: Math.min(quantity, MAX_QUANTITY_PER_ITEM),
          price: product.price || 0,
          productName: product.name || 'Unknown Product',
        });
      }

      const cartPrice = newDetails.reduce((total, detail) =>
        total + (detail.price * detail.num), 0
      );

      return { details: newDetails, cartPrice };
    });
  }, []);

  const updateCartItemQuantity = useCallback((productId, newQuantity) => {
    setCart(prevCart => {
      const existingDetailIndex = prevCart.details.findIndex(
        detail => detail.productId === productId
      );

      if (existingDetailIndex < 0) return prevCart;

      let newDetails = [...prevCart.details];

      if (newQuantity <= 0) {
        newDetails.splice(existingDetailIndex, 1);
      } else {
        newDetails[existingDetailIndex] = {
          ...newDetails[existingDetailIndex],
          num: Math.min(newQuantity, MAX_QUANTITY_PER_ITEM)
        };
      }

      const cartPrice = newDetails.reduce((total, detail) =>
        total + (detail.price * detail.num), 0
      );

      return { details: newDetails, cartPrice };
    });
  }, []);

  const getCartItemQuantity = useCallback((productId) => {
    const detail = cart.details.find(detail => detail.productId === productId);
    return detail ? detail.num : 0;
  }, [cart.details]);

  const clearCart = useCallback(() => {
    setCart({ details: [], cartPrice: 0 });
  }, []);

  // Date/time handlers
  const handleDateChange = useCallback((event, selectedDate) => {
    setFormState(prev => ({ ...prev, showDatePicker: false }));
    if (selectedDate) {
      setFormState(prev => ({ ...prev, date: selectedDate }));
    }
  }, []);

  const handleTimeChange = useCallback((event, selectedTime) => {
    setFormState(prev => ({ ...prev, showTimePicker: false }));
    if (selectedTime) {
      const today = new Date();
      const isToday =
        formState.date.getDate() === today.getDate() &&
        formState.date.getMonth() === today.getMonth() &&
        formState.date.getFullYear() === today.getFullYear();

      let selected = new Date(selectedTime);

      if (isToday) {
        const now = new Date();
        selected.setFullYear(now.getFullYear(), now.getMonth(), now.getDate());
        if (selected < now) {
          Alert.alert('Thông báo', 'Không thể chọn giờ trong quá khứ!');
          return;
        }
      } else {
        selected.setFullYear(formState.date.getFullYear(), formState.date.getMonth(), formState.date.getDate());
      }

      setFormState(prev => ({ ...prev, time: selected }));
    }
  }, [formState.date]);

  // Table selection with auto-hide message
  const handleChooseTable = useCallback((item) => {
    if (item.state === 'in_use') return;

    const isSelected = tableState.chooseTable.includes(item.id);

    if (isSelected) {
      setTableState(prev => ({
        ...prev,
        chooseTable: prev.chooseTable.filter(id => id !== item.id)
      }));

      const newSelectedCount = tableState.chooseTable.length - 1;
      if (newSelectedCount === 0) {
        hideStatusMessage();
      } else {
        showStatusMessage(`Đã chọn ${newSelectedCount}/${requiredTables} bàn`);
      }
      return;
    }

    if (tableState.chooseTable.length < requiredTables) {
      const newSelectedCount = tableState.chooseTable.length + 1;
      setTableState(prev => ({
        ...prev,
        chooseTable: [...prev.chooseTable, item.id]
      }));

      showStatusMessage(`Đã chọn ${newSelectedCount}/${requiredTables} bàn`);
    } else {
      showStatusMessage(`Số người hiện tại chỉ được chọn tối đa ${requiredTables} bàn!`);
    }
  }, [tableState.chooseTable, requiredTables, showStatusMessage, hideStatusMessage]);

  const autoSelectTables = useCallback((missingTables) => {
    if (availableTables.length < missingTables) {
      Alert.alert("Lỗi", "Không đủ bàn trống để tự động chọn!");
      return;
    }

    let selectedTables = [];
    if (tableState.chooseTable.length > 0) {
      const selectedTable = tableState.tables.find(t => t.id === tableState.chooseTable[0]);
      const sortedTables = availableTables.sort((a, b) => {
        if (a.floor === selectedTable.floor && b.floor !== selectedTable.floor) return -1;
        if (b.floor === selectedTable.floor && a.floor !== selectedTable.floor) return 1;
        return Math.abs(a.id - selectedTable.id) - Math.abs(b.id - selectedTable.id);
      });
      selectedTables = sortedTables.slice(0, missingTables).map(t => t.id);
    } else {
      selectedTables = availableTables.slice(0, missingTables).map(t => t.id);
    }

    setTableState(prev => ({
      ...prev,
      chooseTable: [...prev.chooseTable, ...selectedTables]
    }));

    const totalSelected = tableState.chooseTable.length + selectedTables.length;
    showStatusMessage(`Hệ thống đã tự động chọn thêm ${missingTables} bàn! Tổng: ${totalSelected}/${requiredTables} bàn`);
  }, [availableTables, tableState.chooseTable, tableState.tables, requiredTables, showStatusMessage]);

  // ✅ HELPER FUNCTION KẾT HỢP DATE VÀ TIME
  const combineDateAndTime = (date, time) => {
    const combined = new Date(date);
    combined.setHours(time.getHours());
    combined.setMinutes(time.getMinutes());
    combined.setSeconds(0);
    combined.setMilliseconds(0);
    return combined.toISOString();
  };

  // ✅ TẠO BILL FUNCTION
  const createBillWithData = useCallback(async (paymentData) => {
    try {
      console.log('🔄 Creating bill with payment data:', paymentData);

      // ✅ TẠO BILL TRONG BILLS TABLE
      const billData = {
        userId: user.id,
        name: formState.name,
        phone: formState.phone,
        time: combineDateAndTime(formState.date, formState.time),
        num_people: formState.peopleCount,
        note: formState.note,
        payment_status: paymentData.paymentStatus,
        payment_method: paymentData.paymentMethod,
        payment_id: paymentData.paymentId,
        price: cart.cartPrice || 0,
        total_amount: paymentData.totalAmount,
        deposit_amount: paymentData.depositAmount,
        state: 'in_order',
        visit: 'on_process',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const billResult = await createBill(billData);
      if (!billResult.success) {
        throw new Error('Không thể tạo hóa đơn: ' + billResult.msg);
      }

      const bill = billResult.data[0];
      console.log('✅ Bill created successfully:', bill.id);

      // ✅ UPDATE PAYMENT VỚI BILL ID
      if (paymentData.paymentMethod === 'vnpay' && paymentData.paymentDbId) {
        const { error: updatePaymentError } = await supabase
          .from('payments')
          .update({
            billid: bill.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', paymentData.paymentDbId);

        if (updatePaymentError) {
          console.error('❌ Error updating payment with bill ID:', updatePaymentError);
        } else {
          console.log('✅ Payment updated with bill ID:', bill.id);
        }
      }

      // ✅ TẠO DETAIL BILLS
      if (tableState.chooseTable.length > 0) {
        const detailResult = await createDetail(bill.id, tableState.chooseTable, formState.peopleCount);
        if (!detailResult.success) {
          console.error('❌ Error creating bill details:', detailResult.msg);
        } else {
          console.log('✅ Bill details created successfully');
        }
      }

      // ✅ TẠO CART DETAILS
      if (cart.details.length > 0) {
        const cartResult = await createCartDetail(bill.id, cart.details);
        if (!cartResult.success) {
          console.error('❌ Error creating cart details:', cartResult.msg);
        } else {
          console.log('✅ Cart details created successfully');
        }
      }

      // ✅ CẬP NHẬT TABLE STATUS
      if (tableState.chooseTable.length > 0) {
        const { error: tableError } = await supabase
          .from('tables')
          .update({
            state: 'reserved',
          })
          .in('id', tableState.chooseTable);

        if (tableError) {
          console.error('❌ Error updating table status:', tableError);
        } else {
          console.log('✅ Table status updated to reserved');
        }
      }

      return {
        success: true,
        billId: bill.id,
        billData: bill
      };

    } catch (error) {
      console.error('❌ Error in createBillWithData:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }, [formState, tableState, cart, user]);

  // ✅ HANDLE PAYMENT METHOD SELECTION
  const handlePaymentMethodSelect = useCallback(async (method) => {
    if (!user) {
      Alert.alert('Lỗi', 'Vui lòng đăng nhập để tiếp tục');
      return;
    }

    try {
      setPaymentState(prev => ({ ...prev, showPaymentModal: false }));

      if (method === 'counter') {
        setLoading(true);

        const paymentData = {
          paymentMethod: 'counter',
          paymentId: `COUNTER_${Date.now()}`,
          paymentStatus: 'pending_counter',
          totalAmount: paymentState.totalAmount,
          depositAmount: 0
        };

        const billResult = await createBillWithData(paymentData);

        if (billResult.success) {
          Alert.alert(
            '🏪 Đặt bàn thành công!',
            `Mã đơn hàng: ${billResult.billId}\n` +
            `💰 Thanh toán tại quầy: ${paymentState.totalAmount.toLocaleString('vi-VN')}đ\n` +
            `⏰ Vui lòng thanh toán cho nhân viên để được xác nhận\n\n` +
            [
              {
                text: 'Xem đơn hàng',
                onPress: () => {
                  resetForm();
                  router.push('/main/(tabs)/historyScr');
                }
              }
            ]
          );
        } else {
          Alert.alert('Lỗi', billResult.message);
        }

        setLoading(false);
        return;
      }

      // VNPay payment
      setVnpayLoading(true);

      const billData = {
        name: formState.name,
        phone: formState.phone,
        time: appointmentTime.toISOString(),
        peopleCount: formState.peopleCount,
        note: formState.note,
        price: cart.cartPrice,
        tableIds: tableState.chooseTable,
        cartDetails: cart.details
      };

      let paymentData;
      if (method === 'deposit_vnpay') {
        paymentData = {
          userId: user.id,
          billData: billData,
          amount: paymentState.depositAmount,
          paymentType: 'deposit'
        };
      } else if (method === 'full_vnpay') {
        paymentData = {
          userId: user.id,
          billData: billData,
          amount: paymentState.totalAmount,
          paymentType: 'full'
        };
      }

      const { createVNPayPayment } = require('../services/vnpayService');
      const result = await createVNPayPayment(paymentData);

      if (result.success) {
        setVnpayUrl(result.data.vnpayUrl);
        setCurrentPayment({
          ...paymentData,
          paymentId: result.data.paymentId,
          orderId: result.data.orderId
        });
        setShowWebView(true);
      } else {
        Alert.alert('Lỗi thanh toán', result.message);
      }

    } catch (error) {
      console.error('❌ Error in payment method selection:', error);
      Alert.alert('Lỗi', 'Có lỗi xảy ra khi xử lý thanh toán');
    } finally {
      setVnpayLoading(false);
    }
  }, [user, formState, cart, tableState, paymentState, appointmentTime, createBillWithData, resetForm]);

  // ✅ VNPay success handler
  // ✅ SỬA HOÀN CHỈNH handleVNPaySuccess
  const handleVNPaySuccess = useCallback(async (vnpayParams) => {
    try {
      console.log('✅ VNPay success with params:', vnpayParams);

      setShowWebView(false);
      setVnpayLoading(false);

      // ✅ XỬ LÝ VNPay RETURN
      const { handleVNPayReturn } = require('../services/vnpayService');
      const result = await handleVNPayReturn(vnpayParams);

      if (result.success) {
        console.log('✅ VNPay return processed successfully');

        // ✅ CHUẨN BỊ DỮ LIỆU TẠO BILL
        const payment = result.data.payment;
        const finalPaymentData = {
          paymentMethod: 'vnpay',
          paymentId: payment.vnp_txn_ref || payment.orderid,
          paymentDbId: payment.id, // ✅ THÊM ID ĐỂ UPDATE PAYMENT
          paymentStatus: payment.payment_type === 'full' ? 'fully_paid' : 'deposit_paid',
          totalAmount: payment.amount,
          depositAmount: payment.payment_type === 'deposit' ? payment.amount : 0
        };

        // ✅ TẠO BILL
        const billResult = await createBillWithData(finalPaymentData);

        if (billResult.success) {
          Alert.alert(
            '🎉 Đặt bàn thành công!',
            `Mã đơn hàng: ${billResult.billId}\n` +
            `Giao dịch: ${payment.orderid}\n` +
            `Số tiền: ${payment.amount.toLocaleString('vi-VN')}đ\n\n` +
            `${payment.payment_type === 'full'
              ? '✅ Đã thanh toán đầy đủ'
              : '💰 Đã thanh toán cọc - Thanh toán phần còn lại tại quầy'
            }`,
            [
              {
                text: 'Xem đơn hàng',
                onPress: () => {
                  resetForm();
                  router.push('/main/(tabs)/historyScr');
                }
              }
            ]
          );
        } else {
          Alert.alert(
            '⚠️ Cần hỗ trợ',
            `Thanh toán thành công nhưng không thể tạo đơn hàng.\n\n` +
            `Mã giao dịch: ${payment.orderid}\n` +
            `Lỗi: ${billResult.message}`,
            [{ text: 'Liên hệ hỗ trợ' }]
          );
        }
      } else {
        throw new Error(result.message);
      }

    } catch (error) {
      console.error('❌ Error handling VNPay success:', error);
      Alert.alert('Lỗi', 'Có lỗi xảy ra sau khi thanh toán');
    } finally {
      setCurrentPayment(null);
      setVnpayUrl('');
      setPaymentResult(null);
    }
  }, [createBillWithData, resetForm, router]);

  // ✅ VNPay failure handler
  const handleVNPayFailure = useCallback(async (errorData) => {
    try {
      console.log('VNPay failure with data:', errorData);

      Alert.alert('❌ Thanh toán thất bại',
        'Bạn có muốn thử lại hoặc chọn phương thức thanh toán khác?',
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Thử lại',
            onPress: () => setPaymentState(prev => ({
              ...prev,
              showPaymentModal: true
            }))
          }
        ]
      );
    } catch (error) {
      console.error('VNPay failure handling error:', error);
    } finally {
      closeWebView();
    }
  }, [closeWebView]);

  // ✅ Reset all states
  const resetAllStates = useCallback(() => {
    setTableState(prev => ({
      ...prev,
      chooseTable: [],
      statusMessage: ''
    }));

    setFormState(prev => ({
      ...prev,
      name: user?.name || '',
      phone: user?.phone || '',
      note: '',
      peopleCount: 1
    }));

    setPaymentState({
      showPaymentModal: false,
      selectedPaymentMethod: null,
      depositAmount: 0,
      totalAmount: 0,
      tableDeposit: PAYMENT_CONFIG.TABLE_DEPOSIT
    });

    clearCart();
    hideStatusMessage();
    resetPayment();
    refreshTableData();
  }, [user, clearCart, hideStatusMessage, resetPayment, refreshTableData]);

  // ✅ Reset form
  const resetForm = useCallback(() => {
    setFormState({
      name: user?.name || '',
      phone: user?.phone || '',
      date: new Date(),
      time: new Date(),
      peopleCount: 1,
      note: '',
      showDatePicker: false,
      showTimePicker: false
    });

    setTableState(prev => ({
      ...prev,
      chooseTable: [],
      statusMessage: ''
    }));

    setPaymentState({
      showPaymentModal: false,
      selectedPaymentMethod: null,
      depositAmount: 0,
      totalAmount: 0,
      tableDeposit: PAYMENT_CONFIG.TABLE_DEPOSIT
    });

    setShowWebView(false);
    setVnpayUrl('');
    setCurrentPayment(null);
    setVnpayLoading(false);
    setLoading(false);
    clearCart();

    console.log('✅ Form reset completed');
  }, [user, clearCart]);

  // ✅ Handle assign - MAIN ASSIGNMENT LOGIC
  const handleAssign = useCallback(async () => {
    if (!user) {
      Alert.alert('Lỗi', 'Vui lòng đăng nhập để đặt bàn');
      return;
    }

    // Validation
    if (!formState.name.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập tên');
      return;
    }

    if (!formState.phone.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập số điện thoại');
      return;
    }

    if (formState.peopleCount <= 0) {
      Alert.alert('Lỗi', 'Vui lòng nhập số người hợp lệ');
      return;
    }

    if (tableState.chooseTable.length === 0) {
      Alert.alert('Lỗi', 'Vui lòng chọn bàn');
      return;
    }

    // VIP user - create bill directly
    if (user.role === 'vip') {
      setLoading(true);

      const paymentData = {
        paymentMethod: 'vip',
        paymentId: `VIP_${Date.now()}`,
        paymentStatus: cart.cartPrice > 0 ? 'deposit_paid' : 'fully_paid',
        totalAmount: cart.cartPrice || 0,
        depositAmount: 0
      };

      const billResult = await createBillWithData(paymentData);

      if (billResult.success) {
        Alert.alert(
          '🌟 Đặt bàn VIP thành công!',
          `Mã đơn hàng: ${billResult.billId}\n` +
          `✅ Miễn phí cọc đặt bàn\n` +
          `🎯 Ưu tiên phục vụ\n\n` +
          `${cart.cartPrice > 0
            ? `💰 Thanh toán ${cart.cartPrice.toLocaleString('vi-VN')}đ tại quầy`
            : '🆓 Hoàn toàn miễn phí'
          }`,
          [
            {
              text: 'Xem đơn hàng',
              onPress: () => {
                resetForm();
                router.push('/main/(tabs)/historyScr');
              }
            }
          ]
        );
      } else {
        Alert.alert('Lỗi', billResult.message);
      }

      setLoading(false);
      return;
    }

    // Regular user - show payment modal
    calculatePaymentAmounts();
    setPaymentState(prev => ({
      ...prev,
      showPaymentModal: true
    }));
  }, [user, formState, tableState, cart, createBillWithData, resetForm, calculatePaymentAmounts]);

  // Cleanup timeouts when component unmount
  const cleanup = useCallback(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    if (statusTimeoutRef.current) {
      clearTimeout(statusTimeoutRef.current);
    }
  }, []);

  return {
    // States
    tableState,
    formState,
    productState,
    modalState,
    cart,
    loading,
    vnpayLoading,
    searchTimeoutRef,

    // VNPay states
    showWebView,
    vnpayUrl,
    currentPayment,
    paymentResult,
    paymentState,

    // VIP state
    isVipUser,

    // Payment requirement and appointment time
    paymentRequirement,
    appointmentTime,

    // Derived values
    requiredTables,
    totalCartItems,
    availableTables,

    // State setters
    setTableState,
    setFormState,
    setProductState,
    setModalState,
    setLoading,
    setPaymentState,

    // Functions
    fetchProductsData,
    refreshTableData,
    filterProducts,
    handleSearch,
    clearSearch,
    handleCategoryChange,
    addToCart,
    updateCartItemQuantity,
    getCartItemQuantity,
    clearCart,
    handleDateChange,
    handleTimeChange,
    handleChooseTable,
    autoSelectTables,
    handleAssign,

    // Functions for status message
    showStatusMessage,
    hideStatusMessage,
    cleanup,

    // VNPay functions
    handlePaymentMethodSelect,
    handleVNPaySuccess,
    handleVNPayFailure,
    closeWebView,

    // Utility functions
    resetAllStates,
    calculatePaymentAmounts,
    resetForm,
  };
};
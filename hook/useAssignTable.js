import { useState, useCallback, useMemo, useRef } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { fetchTable } from '../services/tableService';
import { fetchProduct } from '../services/productService';
import { fetchCate } from '../services/cateServiec';
import { createBill, createDetail, fetchBillByTimeRange, fetchDetailByBillIds } from '../services/billService';
import { createCartDetail } from '../services/cartDetailService';
import { calculateDepositAmount, formatCurrency, PAYMENT_CONFIG, TimeUtils } from '../constants/paymentConfig';
import { supabase } from '../lib/supabase';
import useVNPay from './useVNPay';

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
  const searchTimeoutRef = useRef(null);
  const statusTimeoutRef = useRef(null);

  // ✅ VNPay hook
  const {
    loading: vnpayLoading,
    showWebView,
    vnpayUrl,
    currentPayment,
    paymentResult,
    createDepositPayment,
    createFullPayment,
    handlePaymentSuccess,
    handlePaymentFailure,
    closeWebView,
    resetPayment
  } = useVNPay();

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

  // ✅ THÊM APPOINTMENT TIME MEMOIZED
  const appointmentTime = useMemo(() => {
    return new Date(
      formState.date.getFullYear(),
      formState.date.getMonth(),
      formState.date.getDate(),
      formState.time.getHours(),
      formState.time.getMinutes()
    );
  }, [formState.date, formState.time]);

  // ✅ KIỂM TRA PAYMENT REQUIREMENT THEO THỜI GIAN
  const paymentRequirement = useMemo(() => {
    return TimeUtils.getPaymentRequirement(appointmentTime, cart.cartPrice, isVipUser);
  }, [appointmentTime, cart.cartPrice, isVipUser]);

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

  // ✅ SỬA calculatePaymentAmounts - THÊM LOGIC THỜI GIAN
  const calculatePaymentAmounts = useCallback(() => {
    const totalAmount = cart.cartPrice || 0;
    const hasFood = cart.details.length > 0;

    // ✅ TÍNH DEPOSIT THEO THỜI GIAN
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
      const [tableRes, billRes] = await Promise.all([
        fetchTable(),
        fetchBillByTimeRange(formState.time)
      ]);

      if (!tableRes.success || !billRes.success) {
        Alert.alert('Lỗi', 'Không thể lấy dữ liệu bàn hoặc hóa đơn');
        return;
      }

      const bills = billRes.data;
      const inOrderBills = bills.filter(bill => bill.state === 'in_order');
      const inOrderBillIds = inOrderBills.map(bill => bill.id);

      let detailBills = [];
      if (inOrderBillIds.length > 0) {
        const detailRes = await fetchDetailByBillIds(inOrderBillIds);
        if (detailRes.success && Array.isArray(detailRes.data)) {
          detailBills = detailRes.data;
        }
      }

      const inUseTableIds = detailBills.map(detail => detail.tableId);
      const updatedTables = tableRes.data.map(table => ({
        ...table,
        state: inUseTableIds.includes(table.id) ? 'in_use' : 'empty'
      }));

      const groupedFloors = updatedTables.reduce((acc, table) => {
        if (!acc[table.floor]) acc[table.floor] = [];
        acc[table.floor].push(table);
        return acc;
      }, {});

      setTableState(prev => ({
        ...prev,
        tables: updatedTables,
        bills,
        floors: Object.values(groupedFloors)
      }));
    } catch (error) {
      console.error('Error in refreshTableData:', error);
      Alert.alert('Lỗi', 'Có lỗi xảy ra khi lấy dữ liệu');
    } finally {
      setLoading(false);
    }
  }, [formState.time]);

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

  // ✅ TẠO VIP BILL
  const createVipBill = useCallback(async () => {
    try {
      console.log('🌟 Creating VIP bill...');

      const billData = {
        userId: user.id,
        name: formState.name,
        phone: formState.phone,
        time: appointmentTime.toISOString(),
        num_people: formState.peopleCount,
        note: formState.note || '',
        price: cart.cartPrice || 0,
        total_amount: cart.cartPrice || 0,
        deposit_amount: 0,
        payment_status: 'deposit_paid',
        payment_method: 'vip',
        state: 'in_order',
        visit: 'on_process'
      };

      const billResult = await createBill(billData);
      if (!billResult.success) {
        throw new Error(billResult.msg);
      }

      const bill = billResult.data[0];
      console.log('✅ VIP Bill created:', bill.id);

      const { data: paymentData, error: paymentError } = await supabase
        .from('payments')
        .insert([{
          orderid: `VIP_${Date.now()}`,
          billid: bill.id,
          userid: user.id,
          amount: 1,
          payment_type: 'deposit',
          payment_method: 'vip',
          status: 'completed',
          bill_data: {
            ...billData,
            tableIds: tableState.chooseTable,
            cartDetails: cart.details,
            note: 'VIP - No payment required'
          },
          completed_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select('*')
        .single();

      if (paymentError) {
        console.error('Create VIP payment record failed:', paymentError);
        throw new Error('Failed to create VIP payment record');
      }

      const payment = paymentData;
      console.log('✅ VIP payment record created:', payment.id);

      const { error: updateBillError } = await supabase
        .from('bills')
        .update({
          payment_id: payment.id.toString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', bill.id);

      if (updateBillError) {
        console.error('Update bill with payment ID failed:', updateBillError);
      } else {
        console.log('✅ Bill updated with payment ID:', payment.id);
      }

      const detailResult = await createDetail(bill.id, tableState.chooseTable, formState.peopleCount);
      if (!detailResult.success) {
        console.error('Create detail bills failed:', detailResult.msg);
      }

      if (cart.details.length > 0) {
        const cartResult = await createCartDetail(bill.id, cart.details);
        if (!cartResult.success) {
          console.error('Create cart details failed:', cartResult.msg);
        }
      }

      const successMessage = cart.details.length > 0
        ? `Đặt bàn VIP thành công! Đã chọn ${cart.details.length} món ăn.\n\nMã đơn: ${bill.id}\nMã thanh toán: ${payment.id}\n\nKhông cần thanh toán - Đặc quyền VIP!`
        : `Đặt bàn VIP thành công! Đã đặt ${tableState.chooseTable.length} bàn.\n\nMã đơn: ${bill.id}\nMã thanh toán: ${payment.id}\n\nKhông cần thanh toán cọc - Đặc quyền VIP!`;

      Alert.alert(
        '🌟 Đặt bàn VIP thành công!',
        successMessage,
        [
          {
            text: 'OK',
            onPress: () => {
              resetAllStates();
              router.back();
            }
          }
        ]
      );

    } catch (error) {
      console.error('Create VIP bill error:', error);
      Alert.alert('Lỗi', 'Không thể tạo đơn đặt bàn VIP: ' + error.message);
    }
  }, [user, formState, cart, tableState.chooseTable, appointmentTime]);

  // ✅ TẠO BILL KHÔNG CẦN THANH TOÁN (> 24H)
  const createNoPaymentBill = useCallback(async () => {
    try {
      console.log('⏰ Creating no payment required bill...');

      const { totalAmount } = calculatePaymentAmounts();

      const billData = {
        userId: user.id,
        name: formState.name,
        phone: formState.phone,
        time: appointmentTime.toISOString(),
        num_people: formState.peopleCount,
        note: formState.note || '',
        price: totalAmount,
        total_amount: totalAmount,
        deposit_amount: 0,
        payment_status: PAYMENT_CONFIG.BILL_PAYMENT_STATUS.NO_PAYMENT_REQUIRED,
        payment_method: PAYMENT_CONFIG.PAYMENT_METHODS.NO_PAYMENT,
        state: 'in_order',
        visit: 'on_process'
      };

      const billResult = await createBill(billData);
      if (!billResult.success) {
        throw new Error(billResult.msg);
      }

      const bill = billResult.data[0];
      console.log('✅ No payment bill created:', bill.id);

      const detailResult = await createDetail(bill.id, tableState.chooseTable, formState.peopleCount);
      if (!detailResult.success) {
        console.error('Create detail bills failed:', detailResult.msg);
        throw new Error('Không thể tạo chi tiết đơn hàng');
      }

      if (cart.details.length > 0) {
        const cartResult = await createCartDetail(bill.id, cart.details);
        if (!cartResult.success) {
          console.error('Create cart details failed:', cartResult.msg);
        }
      }

      const hoursUntil = TimeUtils.calculateHoursUntilAppointment(appointmentTime);
      const successMessage = cart.details.length > 0
        ? `Đặt bàn thành công! Đã chọn ${cart.details.length} món ăn với tổng tiền ${formatCurrency(totalAmount)}đ.\n\n` +
          `Mã đơn: ${bill.id}\n\n` +
          `⏰ Đặt trước ${Math.ceil(hoursUntil)} giờ - Không cần thanh toán cọc!\n\n` +
          `Vui lòng đến đúng giờ hẹn để được phục vụ.`
        : `Đặt bàn thành công! Đã đặt ${tableState.chooseTable.length} bàn.\n\n` +
          `Mã đơn: ${bill.id}\n\n` +
          `⏰ Đặt trước ${Math.ceil(hoursUntil)} giờ - Không cần thanh toán cọc!\n\n` +
          `Vui lòng đến đúng giờ hẹn để được phục vụ.`;

      Alert.alert(
        '✅ Đặt bàn thành công!',
        successMessage,
        [
          {
            text: 'OK',
            onPress: () => {
              resetAllStates();
              router.back();
            }
          }
        ]
      );

    } catch (error) {
      console.error('Create no payment bill error:', error);
      Alert.alert('Lỗi', 'Không thể tạo đơn đặt bàn: ' + error.message);
    }
  }, [user, formState, cart, tableState.chooseTable, appointmentTime, calculatePaymentAmounts, resetAllStates]);

  // ✅ Handle payment method selection
  const handlePaymentMethodSelect = useCallback(async (method) => {
    const { totalAmount, depositAmount } = calculatePaymentAmounts();

    setPaymentState(prev => ({
      ...prev,
      selectedPaymentMethod: method,
      showPaymentModal: false
    }));

    if (method === 'deposit_vnpay') {
      await handleVNPayDepositPayment();
    } else if (method === 'full_vnpay') {
      await handleVNPayFullPayment();
    } else if (method === 'counter') {
      await handleCounterPayment();
    }
  }, [calculatePaymentAmounts]);

  // ✅ VNPay deposit payment
  const handleVNPayDepositPayment = useCallback(async () => {
    try {
      if (!user?.id) {
        Alert.alert('Lỗi', 'Vui lòng đăng nhập để thanh toán');
        return;
      }

      const { depositAmount } = calculatePaymentAmounts();

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

      console.log('Creating VNPay deposit payment with data:', billData);

      const result = await createDepositPayment(billData, user.id);

      if (!result.success) {
        Alert.alert('Lỗi thanh toán', result.message);
      }

    } catch (error) {
      console.error('VNPay deposit payment error:', error);
      Alert.alert('Lỗi', 'Không thể thực hiện thanh toán');
    }
  }, [user, formState, cart, tableState.chooseTable, calculatePaymentAmounts, createDepositPayment, appointmentTime]);

  // ✅ VNPay full payment
  const handleVNPayFullPayment = useCallback(async () => {
    try {
      if (!user?.id) {
        Alert.alert('Lỗi', 'Vui lòng đăng nhập để thanh toán');
        return;
      }

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

      console.log('Creating VNPay full payment with data:', billData);

      const result = await createFullPayment(billData, user.id);

      if (!result.success) {
        Alert.alert('Lỗi thanh toán', result.message);
      }

    } catch (error) {
      console.error('VNPay full payment error:', error);
      Alert.alert('Lỗi', 'Không thể thực hiện thanh toán');
    }
  }, [user, formState, cart, tableState.chooseTable, createFullPayment, appointmentTime]);

  // ✅ COUNTER PAYMENT
  const handleCounterPayment = useCallback(async () => {
    try {
      console.log('🏪 Creating counter payment...');
      
      if (!user?.id) {
        Alert.alert('Lỗi', 'Vui lòng đăng nhập để đặt bàn');
        return;
      }

      setLoading(true);

      const { totalAmount, depositAmount } = calculatePaymentAmounts();
      const hasFood = cart.details.length > 0;

      const billData = {
        userId: user.id,
        name: formState.name,
        phone: formState.phone,
        time: appointmentTime.toISOString(),
        num_people: formState.peopleCount,
        note: formState.note || '',
        price: totalAmount,
        total_amount: totalAmount,
        deposit_amount: depositAmount,
        payment_status: PAYMENT_CONFIG.BILL_PAYMENT_STATUS.PENDING_COUNTER,
        payment_method: 'counter',
        state: 'in_order',
        visit: 'on_process'
      };

      console.log('📋 Creating bill with data:', billData);

      const billResult = await createBill(billData);
      if (!billResult.success) {
        throw new Error(billResult.msg || 'Không thể tạo đơn hàng');
      }

      const bill = billResult.data[0];
      console.log('✅ Bill created:', bill.id);

      const { data: paymentData, error: paymentError } = await supabase
        .from('payments')
        .insert([{
          orderid: `COUNTER_${bill.id}_${Date.now()}`,
          billid: bill.id,
          userid: user.id,
          amount: totalAmount,
          payment_type: hasFood ? 'full' : 'deposit',
          payment_method: 'counter',
          status: 'pending',
          bill_data: {
            ...billData,
            tableIds: tableState.chooseTable,
            cartDetails: cart.details,
            note: 'Counter payment - waiting for admin confirmation'
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select('*')
        .single();

      if (paymentError) {
        console.error('Create payment record failed:', paymentError);
        throw new Error('Không thể tạo thanh toán');
      }

      const payment = paymentData;
      console.log('✅ Payment record created:', payment.id);

      const { error: updateBillError } = await supabase
        .from('bills')
        .update({
          payment_id: payment.id.toString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', bill.id);

      if (updateBillError) {
        console.error('Update bill with payment ID failed:', updateBillError);
      } else {
        console.log('✅ Bill updated with payment ID:', payment.id);
      }

      const detailResult = await createDetail(bill.id, tableState.chooseTable, formState.peopleCount);
      if (!detailResult.success) {
        console.error('Create detail bills failed:', detailResult.msg);
        throw new Error('Không thể tạo chi tiết đơn hàng');
      }

      if (cart.details.length > 0) {
        const cartResult = await createCartDetail(bill.id, cart.details);
        if (!cartResult.success) {
          console.error('Create cart details failed:', cartResult.msg);
        }
      }

      const successMessage = hasFood
        ? `Đặt bàn thành công! Đã chọn ${cart.details.length} món ăn với tổng tiền ${formatCurrency(totalAmount)}đ.\n\n` +
          `Mã đơn: ${bill.id}\n` +
          `Mã thanh toán: ${payment.id}\n\n` +
          `⏳ Trạng thái: Chờ xác nhận thanh toán tại quầy\n\n` +
          `Khi đến nhà hàng, vui lòng thông báo cho nhân viên để xác nhận thanh toán.`
        : `Đặt bàn thành công! Cọc đặt bàn ${formatCurrency(depositAmount)}đ.\n\n` +
          `Mã đơn: ${bill.id}\n` +
          `Mã thanh toán: ${payment.id}\n\n` +
          `⏳ Trạng thái: Chờ xác nhận thanh toán tại quầy\n\n` +
          `Khi đến nhà hàng, vui lòng thông báo cho nhân viên để xác nhận thanh toán.`;

      Alert.alert(
        '✅ Đặt bàn thành công!',
        successMessage,
        [
          {
            text: 'OK',
            onPress: () => {
              resetAllStates();
              router.back();
            }
          }
        ]
      );

    } catch (error) {
      console.error('❌ Counter payment error:', error);
      Alert.alert('Lỗi', error.message || 'Không thể thực hiện thanh toán tại quầy');
    } finally {
      setLoading(false);
    }
  }, [user, formState, cart, tableState.chooseTable, calculatePaymentAmounts, resetAllStates, appointmentTime]);

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

  // ✅ Handle VNPay success
  const handleVNPaySuccess = useCallback(async (vnpayParams) => {
    console.log('VNPay success with params:', vnpayParams);

    await handlePaymentSuccess(vnpayParams);

    setTimeout(() => {
      Alert.alert('🎉 Đặt bàn thành công!',
        'Thanh toán đã được xử lý thành công. Bạn sẽ nhận được xác nhận qua SMS.',
        [{
          text: 'OK',
          onPress: () => {
            resetAllStates();
            router.back();
          }
        }]
      );
    }, 1000);
  }, [handlePaymentSuccess, resetAllStates]);

  // ✅ Handle VNPay failure
  const handleVNPayFailure = useCallback(async (errorData) => {
    console.log('VNPay failure with data:', errorData);

    await handlePaymentFailure(errorData);

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
        },
        {
          text: 'Thanh toán tại quầy',
          onPress: handleCounterPayment
        }
      ]
    );
  }, [handlePaymentFailure, handleCounterPayment]);

  // ✅ Handle assign - SỬA LOGIC THEO THỜI GIAN
  const handleAssign = useCallback(async () => {
    try {
      setLoading(true);

      // ✅ VALIDATION
      if (!formState.name.trim() || !formState.phone.trim()) {
        Alert.alert('Lỗi', 'Vui lòng điền đầy đủ thông tin');
        return;
      }

      const phoneRegex = /^(0\d{9,10})$/;
      if (!phoneRegex.test(formState.phone.trim())) {
        Alert.alert("Lỗi", "Số điện thoại không hợp lệ!");
        return;
      }

      if (!formState.peopleCount || isNaN(formState.peopleCount) || formState.peopleCount <= 0) {
        Alert.alert("Lỗi", "Vui lòng nhập số người hợp lệ!");
        return;
      }

      if (tableState.chooseTable.length === 0) {
        Alert.alert('Lỗi', 'Vui lòng chọn ít nhất 1 bàn');
        return;
      }

      if (tableState.chooseTable.length < requiredTables) {
        const missingTables = requiredTables - tableState.chooseTable.length;
        Alert.alert(
          "Thiếu bàn",
          `Với ${formState.peopleCount} người, bạn cần ít nhất ${requiredTables} bàn. Hiện tại bạn mới chọn ${tableState.chooseTable.length} bàn.`,
          [
            { text: "Tự chọn thêm", style: "cancel" },
            { text: "Hệ thống tự chọn", onPress: () => autoSelectTables(missingTables) },
          ]
        );
        return;
      }

      console.log('User role check:', { userId: user?.id, role: user?.role, isVip: isVipUser });
      console.log('Payment requirement:', paymentRequirement);

      // ✅ XỬ LÝ THEO PAYMENT REQUIREMENT
      if (isVipUser) {
        console.log('🌟 VIP User - Creating bill directly');
        await createVipBill();
      } else if (!paymentRequirement.required) {
        console.log('⏰ No payment required - Creating bill directly');
        await createNoPaymentBill();
      } else {
        console.log('💰 Payment required - Showing payment options');
        calculatePaymentAmounts();
        setPaymentState(prev => ({ ...prev, showPaymentModal: true }));
      }

    } catch (error) {
      console.error('HandleAssign error:', error);
      Alert.alert('Lỗi', 'Có lỗi xảy ra khi đặt bàn');
    } finally {
      setLoading(false);
    }
  }, [
    formState,
    tableState.chooseTable,
    requiredTables,
    isVipUser,
    paymentRequirement,
    autoSelectTables,
    calculatePaymentAmounts,
    createVipBill,
    createNoPaymentBill
  ]);

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
    searchTimeoutRef,

    // ✅ VNPay states
    showWebView,
    vnpayUrl,
    currentPayment,
    paymentResult,
    paymentState,
    vnpayLoading,

    // ✅ VIP state
    isVipUser,

    // ✅ THÊM PAYMENT REQUIREMENT VÀ APPOINTMENT TIME
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

    //VNPay functions
    handlePaymentMethodSelect,
    handleVNPaySuccess,
    handleVNPayFailure,
    closeWebView,
    setPaymentState,

    //VIP functions
    createVipBill,
    createNoPaymentBill,

    // Utility functions
    resetAllStates,
    calculatePaymentAmounts
  };
};
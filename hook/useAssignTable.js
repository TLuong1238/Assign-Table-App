import { useState, useCallback, useMemo, useRef } from 'react';
import { Alert } from 'react-native';
import { fetchTable } from '../services/tableService';
import { fetchProduct } from '../services/productService';
import { fetchCate } from '../services/cateServiec';
import { createBill, createDetail, fetchBillByTimeRange, fetchDetailByBillIds } from '../services/billService';
import { createCartDetail } from '../services/cartDetailService';

const SEARCH_DEBOUNCE_DELAY = 300;
const MAX_QUANTITY_PER_ITEM = 20;
const PEOPLE_PER_TABLE = 6;
// constant for auto-hide message
const STATUS_MESSAGE_DURATION = 5000; // 5 seconds

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
  // ref for status message timeout
  const statusTimeoutRef = useRef(null);

  // function to show message and auto-hide
  const showStatusMessage = useCallback((message, duration = STATUS_MESSAGE_DURATION) => {
    setTableState(prev => ({
      ...prev,
      statusMessage: message
    }));
    
    // Clear ofl timeout 
    if (statusTimeoutRef.current) {
      clearTimeout(statusTimeoutRef.current);
    }
    
    // Set new timeout
    statusTimeoutRef.current = setTimeout(() => {
      setTableState(prev => ({
        ...prev,
        statusMessage: ''
      }));
    }, duration);
  }, []);

  // hide message immediately
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

    // Filter by category
    if (selectedCategory && selectedCategory !== 'all') {
      filtered = filtered.filter(product => {
        const productCateId = product.cateId;
        const categoryId = selectedCategory;
        return productCateId == categoryId;
      });
    }

    // Filter by search text
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
      // remove selected table
      setTableState(prev => ({
        ...prev,
        chooseTable: prev.chooseTable.filter(id => id !== item.id)
      }));
      
      const newSelectedCount = tableState.chooseTable.length - 1;
      if (newSelectedCount === 0) {
        hideStatusMessage(); // Hide message when no table is selected
      } else {
        showStatusMessage(`Đã chọn ${newSelectedCount}/${requiredTables} bàn`);
      }
      return;
    }

    if (tableState.chooseTable.length < requiredTables) {
      // Choose new table
      const newSelectedCount = tableState.chooseTable.length + 1;
      setTableState(prev => ({
        ...prev,
        chooseTable: [...prev.chooseTable, item.id]
      }));
      
      showStatusMessage(`Đã chọn ${newSelectedCount}/${requiredTables} bàn`);
    } else {
      // Already enough tables
      showStatusMessage(`Số người hiện tại chỉ được chọn tối đa ${requiredTables} bàn!`);
    }
  }, [tableState.chooseTable, requiredTables, showStatusMessage, hideStatusMessage]);

  // Fix Auto select tables with auto-hide message
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
    
    // message and auto-hide
    const totalSelected = tableState.chooseTable.length + selectedTables.length;
    showStatusMessage(`Hệ thống đã tự động chọn thêm ${missingTables} bàn! Tổng: ${totalSelected}/${requiredTables} bàn`);
  }, [availableTables, tableState.chooseTable, tableState.tables, requiredTables, showStatusMessage]);

  // Form submission
  const handleAssign = useCallback(async () => {
    // Validation
    if (!formState.name?.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập tên của bạn!");
      return;
    }
    if (!formState.phone?.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập số điện thoại!");
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

    setLoading(true);
    try {
      // Create bill
      const bill = {
        userId: user?.id,
        num_people: formState.peopleCount,
        note: formState.note || "",
        phone: formState.phone,
        name: formState.name,
        time: formState.time.toISOString(),
        state: "in_order",
        visit: "on_process",
        price: cart.cartPrice,
      };

      const billRes = await createBill(bill);
      if (!billRes.success) {
        Alert.alert("Lỗi", billRes.msg || "Đặt bàn thất bại!");
        return;
      }

      const billId = billRes.data[0].id;

      // Create table details
      const detailRes = await createDetail(billId, tableState.chooseTable, formState.peopleCount);
      if (!detailRes.success) {
        Alert.alert("Lỗi", detailRes.msg || "Tạo chi tiết bill thất bại!");
        return;
      }

      // Create cart details if any
      if (cart.details.length > 0) {
        const cartDetailRes = await createCartDetail(billId, cart.details);
        if (!cartDetailRes.success) {
          Alert.alert("Cảnh báo", "Đặt bàn thành công nhưng có lỗi khi lưu món ăn: " + cartDetailRes.msg);
        }
      }

      Alert.alert("Thành công",
        `Đặt bàn thành công!${cart.details.length > 0
          ? ` Đã chọn ${cart.details.length} món ăn với tổng tiền ${cart.cartPrice.toLocaleString()}đ.`
          : ''}`
      );

      // Reset all states and hide message
      setTableState(prev => ({ ...prev, chooseTable: [], statusMessage: '' }));
      hideStatusMessage(); // Clear timeout
      setFormState(prev => ({
        ...prev,
        name: '',
        phone: '',
        note: '',
        peopleCount: 1
      }));
      clearCart();
      refreshTableData();

    } catch (err) {
      console.error('Error in handleAssign:', err);
      Alert.alert("Lỗi", "Có lỗi xảy ra khi đặt bàn!");
    } finally {
      setLoading(false);
    }
  }, [
    formState,
    tableState.chooseTable,
    requiredTables,
    cart,
    user,
    autoSelectTables,
    clearCart,
    refreshTableData,
    hideStatusMessage
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
    cleanup, // Để cleanup timeouts 
  };
};
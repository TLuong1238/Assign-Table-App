import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Alert, StatusBar, FlatList, Pressable, Modal, TextInput, Image } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import MyHeader from '../../components/MyHeader';
import MyInput from '../../components/MyInput';
import MyButton from '../../components/MyButton';
import MyTableItem from '../../components/MyTableItem';
import { fetchTable } from '../../services/tableService';
import { fetchProduct } from '../../services/productService';
import { fetchCate } from '../../services/cateServiec';
import { hp, wp } from '../../helper/common';
import { theme } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import * as Icon from 'react-native-feather';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Feather from '@expo/vector-icons/Feather';
import SimpleLineIcons from '@expo/vector-icons/SimpleLineIcons';

import DateTimePicker from '@react-native-community/datetimepicker';
import { TouchableOpacity } from 'react-native';
import { createBill, createDetail, fetchBill, fetchBillByTimeRange, fetchDetailByBillIds } from '../../services/billService';
import { createCartDetail } from '../../services/cartDetailService';

const AssignTableScr = () => {
  const { user } = useAuth();
  const [tables, setTables] = useState([]);
  const [floors, setFloors] = useState([]);
  const [bills, setBills] = useState([]);

  const [loading, setLoading] = useState(false);
  const today = new Date();

  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [chooseTable, setChooseTable] = useState([]);
  const [state, setState] = useState('');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [peopleCount, setPeopleCount] = useState(1);

  // ✅ Cart states
  const [cart, setCart] = useState({
    details: [],
    cartPrice: 0
  });

  // ✅ Food selection states
  const [showFoodModal, setShowFoodModal] = useState(false);
  const [showCartModal, setShowCartModal] = useState(false);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredProducts, setFilteredProducts] = useState([]);

  // ✅ Debounce search
  const searchTimeoutRef = useRef(null);

  // ✅ Fetch data functions
  const fetchProductsData = async () => {
    try {
      const productRes = await fetchProduct();
      const categoryRes = await fetchCate();

      if (productRes.success) {
        setProducts(productRes.data);
        setFilteredProducts(productRes.data);
      }

      if (categoryRes.success) {
        setCategories(categoryRes.data);
        if (categoryRes.data.length > 0) {
          setSelectedCategory(categoryRes.data[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching products/categories:', error);
    }
  };

  // ✅ Filter products by category and search
  const filterProducts = (category, search) => {
    let filtered = products;

    if (category) {
      filtered = filtered.filter(product => product.categoryId === category);
    }

    if (search && search.trim() !== '') {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(search.toLowerCase())
      );
    }

    setFilteredProducts(filtered);
  };

  // ✅ Debounced search
  const handleSearch = (query) => {
    setSearchQuery(query);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      filterProducts(selectedCategory, query);
    }, 500);
  };

  // ✅ Handle category change
  const handleCategoryChange = (categoryId) => {
    setSelectedCategory(categoryId);
    filterProducts(categoryId, searchQuery);
  };

  // ✅ Cart helper functions
  const addToCart = (product, quantity = 1) => {
    setCart(prevCart => {
      const existingDetailIndex = prevCart.details.findIndex(
        detail => detail.productId === product.id
      );

      let newDetails = [...prevCart.details];

      if (existingDetailIndex >= 0) {
        const currentQuantity = newDetails[existingDetailIndex].num;
        const newQuantity = Math.min(currentQuantity + quantity, 20);

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
          num: Math.min(quantity, 20),
          price: product.price,
          productName: product.name,
        });
      }

      const cartPrice = newDetails.reduce((total, detail) =>
        total + (detail.price * detail.num), 0
      );

      return {
        details: newDetails,
        cartPrice: cartPrice
      };
    });
  };

  const updateCartItemQuantity = (productId, newQuantity) => {
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
          num: Math.min(newQuantity, 20)
        };
      }

      const cartPrice = newDetails.reduce((total, detail) =>
        total + (detail.price * detail.num), 0
      );

      return {
        details: newDetails,
        cartPrice: cartPrice
      };
    });
  };

  const getCartItemQuantity = (productId) => {
    const detail = cart.details.find(detail => detail.productId === productId);
    return detail ? detail.num : 0;
  };

  const clearCart = () => {
    setCart({
      details: [],
      cartPrice: 0
    });
  };

  const getTotalCartItems = () => {
    return cart.details.reduce((total, detail) => total + detail.num, 0);
  };

  // ✅ Existing functions (handleDateChange, handleTimeChange, etc.)
  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const handleTimeChange = (event, selectedTime) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const today = new Date();
      const isToday =
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear();

      let selected = new Date(selectedTime);

      if (isToday) {
        const now = new Date();
        selected.setFullYear(now.getFullYear(), now.getMonth(), now.getDate());
        if (selected < now) {
          Alert.alert('Thông báo', 'Không thể chọn giờ trong quá khứ!');
          return;
        }
      } else {
        selected.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
      }

      setTime(selected);
    }
  };

  const updateTablesWithBills = (tables, detailBills) => {
    const inUseTableIds = detailBills.map(detail => detail.tableId);
    return tables.map(table =>
      inUseTableIds.includes(table.id)
        ? { ...table, state: 'in_use' }
        : { ...table, state: 'empty' }
    );
  };

  const refreshData = async () => {
    setLoading(true);
    const tableRes = await fetchTable();
    const billRes = await fetchBillByTimeRange(time);

    if (tableRes.success && billRes.success) {
      setBills(billRes.data);
      const inOrderBills = billRes.data.filter(bill => bill.state === 'in_order');
      const inOrderBillIds = inOrderBills.map(bill => bill.id);

      let detailBills = [];
      if (inOrderBillIds.length > 0) {
        const detailRes = await fetchDetailByBillIds(inOrderBillIds);
        if (detailRes.success && Array.isArray(detailRes.data)) {
          detailBills = detailRes.data;
        }
      }

      const updatedTables = updateTablesWithBills(tableRes.data, detailBills);
      setTables(updatedTables);

      const groupedFloors = updatedTables.reduce((acc, table) => {
        if (!acc[table.floor]) acc[table.floor] = [];
        acc[table.floor].push(table);
        return acc;
      }, {});
      setFloors(Object.values(groupedFloors));
    } else {
      Alert.alert('Lỗi', 'Không thể lấy dữ liệu bàn hoặc hóa đơn');
    }
    setLoading(false);
  };

  useEffect(() => {
    refreshData();
    fetchProductsData(); // ✅ Fetch products data
    if (user) {
      setName(user.name || '');
      setPhone(user.phone || '');
    }
  }, [date, time, user, peopleCount]);

  // ✅ Updated handleAssign to include cart
  const handleAssign = async () => {
    if (!name || name.trim() === "") {
      Alert.alert("Lỗi", "Vui lòng nhập tên của bạn!");
      return;
    }
    if (!phone || phone.trim() === "") {
      Alert.alert("Lỗi", "Vui lòng nhập số điện thoại!");
      return;
    }
    const phoneRegex = /^(0\d{9,10})$/;
    if (!phoneRegex.test(phone.trim())) {
      Alert.alert("Lỗi", "Số điện thoại không hợp lệ!");
      return;
    }
    if (!peopleCount || isNaN(peopleCount) || peopleCount <= 0) {
      Alert.alert("Lỗi", "Vui lòng nhập số người hợp lệ!");
      return;
    }

    const requiredTables = Math.ceil(peopleCount / 6);
    if (chooseTable.length < requiredTables) {
      const missingTables = requiredTables - chooseTable.length;
      Alert.alert(
        "Thiếu bàn",
        `Với ${peopleCount} người, bạn cần ít nhất ${requiredTables} bàn. Hiện tại bạn mới chọn ${chooseTable.length} bàn.`,
        [
          { text: "Tự chọn thêm", style: "cancel" },
          { text: "Hệ thống tự chọn", onPress: () => autoSelectTables(missingTables) },
        ]
      );
      return;
    }

    setLoading(true);
    try {
      // 1. Tạo bill
      const bill = {
        userId: user?.id,
        num_people: peopleCount,
        note: note || "",
        phone: phone,
        name: name,
        time: time.toISOString(),
        state: "in_order",
        visit: "on_process",
        // Tạm thời set price = 0, sẽ được cập nhật sau khi tạo cart details
        price: 0,
      };

      const billRes = await createBill(bill);
      if (!billRes.success) {
        Alert.alert("Lỗi", billRes.msg || "Đặt bàn thất bại!");
        setLoading(false);
        return;
      }

      const billId = billRes.data[0].id;

      // 2. Tạo table details
      const detailRes = await createDetail(billId, chooseTable, peopleCount);
      if (!detailRes.success) {
        Alert.alert("Lỗi", detailRes.msg || "Tạo chi tiết bill thất bại!");
        setLoading(false);
        return;
      }

      // 3. ✅ Tạo cart details nếu có món ăn
      if (cart.details.length > 0) {
        const cartDetailRes = await createCartDetail(billId, cart.details);
        if (!cartDetailRes.success) {
          Alert.alert("Cảnh báo", "Đặt bàn thành công nhưng có lỗi khi lưu món ăn: " + cartDetailRes.msg);
        }
      }

      Alert.alert("Thành công", `Đặt bàn thành công!${cart.details.length > 0 ? ` Đã chọn ${cart.details.length} món ăn với tổng tiền ${cart.cartPrice.toLocaleString()}đ.` : ''}`);

      // Reset states
      setChooseTable([]);
      clearCart();
      setState("");
      setName('');
      setPhone('');
      setNote('');
      setPeopleCount(1);
      refreshData();

    } catch (err) {
      console.error('Error in handleAssign:', err);
      Alert.alert("Lỗi", "Có lỗi xảy ra khi đặt bàn!");
    }
    setLoading(false);
  };

  const autoSelectTables = (missingTables) => {
    const availableTables = tables.filter(table =>
      table.state !== 'in_use' && !chooseTable.includes(table.id)
    );

    if (availableTables.length < missingTables) {
      Alert.alert("Lỗi", "Không đủ bàn trống để tự động chọn!");
      return;
    }

    let selectedTables = [];
    if (chooseTable.length > 0) {
      const selectedTable = tables.find(t => t.id === chooseTable[0]);
      const sortedTables = availableTables.sort((a, b) => {
        if (a.floor === selectedTable.floor && b.floor !== selectedTable.floor) return -1;
        if (b.floor === selectedTable.floor && a.floor !== selectedTable.floor) return 1;
        return Math.abs(a.id - selectedTable.id) - Math.abs(b.id - selectedTable.id);
      });
      selectedTables = sortedTables.slice(0, missingTables).map(t => t.id);
    } else {
      selectedTables = availableTables.slice(0, missingTables).map(t => t.id);
    }

    setChooseTable([...chooseTable, ...selectedTables]);
    setState(`Hệ thống đã tự động chọn thêm ${missingTables} bàn!`);
  };

  const handleChoose = (item) => {
    if (item.state === 'in_use') return;

    const maxTable = Math.ceil(peopleCount / 6) || 1;
    const isSelected = chooseTable.includes(item.id);
    let newChooseTable = [...chooseTable];

    if (isSelected) {
      newChooseTable = newChooseTable.filter(id => id !== item.id);
      setChooseTable(newChooseTable);
      setState('');
      return;
    }

    if (chooseTable.length < maxTable) {
      newChooseTable.push(item.id);
      setChooseTable(newChooseTable);
      setState('');
    } else {
      setState(`Số người hiện tại chỉ được chọn tối đa ${maxTable} bàn!`);
    }
  };

  // ✅ Render Product Item
  const renderProductItem = ({ item }) => (
    <View style={styles.productItem}>
      <View style={styles.productInfo}>
        <Image
          source={{ uri: item.image}}
          style={styles.productImage}
        />
        <View style={styles.productDetails}>
          <Text style={styles.productName}>{item.name}</Text>
          <Text style={styles.productPrice}>{item.price?.toLocaleString()}đ</Text>
          {item.description && (
            <Text style={styles.productDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.productActions}>
        {getCartItemQuantity(item.id) > 0 ? (
          <View style={styles.quantityControls}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => updateCartItemQuantity(item.id, getCartItemQuantity(item.id) - 1)}
            >
              <Icon.Minus stroke="white" strokeWidth={2} width={wp(4)} height={wp(4)} />
            </TouchableOpacity>

            <Text style={styles.quantityText}>{getCartItemQuantity(item.id)}</Text>

            <TouchableOpacity
              style={[
                styles.quantityButton,
                getCartItemQuantity(item.id) >= 20 && styles.quantityButtonDisabled
              ]}
              onPress={() => updateCartItemQuantity(item.id, getCartItemQuantity(item.id) + 1)}
              disabled={getCartItemQuantity(item.id) >= 20}
            >
              <Icon.Plus stroke="white" strokeWidth={2} width={wp(4)} height={wp(4)} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.addToCartButton}
            onPress={() => addToCart(item, 1)}
          >
            <Icon.Plus stroke="white" strokeWidth={2} width={wp(4)} height={wp(4)} />
            <Text style={styles.addToCartText}>Thêm</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  // ✅ Render Cart Item
  const renderCartItem = ({ item }) => (
    <View style={styles.cartItem}>
      <View style={styles.cartItemInfo}>
        <Text style={styles.cartItemName}>{item.productName}</Text>
        <Text style={styles.cartItemPrice}>
          {item.price.toLocaleString()}đ x {item.num} = {(item.price * item.num).toLocaleString()}đ
        </Text>
      </View>

      <View style={styles.cartItemControls}>
        <TouchableOpacity
          style={styles.cartQuantityButton}
          onPress={() => updateCartItemQuantity(item.productId, item.num - 1)}
        >
          <Icon.Minus stroke="#666" strokeWidth={2} width={wp(4)} height={wp(4)} />
        </TouchableOpacity>

        <Text style={styles.cartQuantityText}>{item.num}</Text>

        <TouchableOpacity
          style={[
            styles.cartQuantityButton,
            item.num >= 20 && styles.cartQuantityButtonDisabled
          ]}
          onPress={() => updateCartItemQuantity(item.productId, item.num + 1)}
          disabled={item.num >= 20}
        >
          <Icon.Plus stroke={item.num >= 20 ? "#ccc" : "#666"} strokeWidth={2} width={wp(4)} height={wp(4)} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ScreenWrapper bg="#FFBF00">
      <View style={styles.container}>
        <MyHeader title="Đặt bàn" showBackButton={true} />

        <View style={styles.formContainer}>
          {/* Form Section */}
          <View style={styles.formContent}>
            <Text style={styles.titleText}>
              Vui lòng điền thông tin của bạn:
            </Text>

            <MyInput
              placeholder="Tên của bạn..."
              value={name}
              onChangeText={setName}
              icon={<FontAwesome name="pencil-square-o" size={wp(6)} color="black" />}
            />

            <MyInput
              icon={<Feather name="phone-call" size={wp(6)} color="black" />}
              placeholder="Số điện thoại..."
              value={phone}
              onChangeText={setPhone}
            />

            <View style={styles.dateTimeRow}>
              <TouchableOpacity
                style={styles.dateTimeButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Icon.Calendar
                  stroke={theme.colors.dark}
                  strokeWidth={2}
                  width={wp(6)}
                  height={wp(6)}
                />
                <Text style={styles.dateTimeText}>
                  {date.toLocaleDateString()}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dateTimeButton}
                onPress={() => setShowTimePicker(true)}
              >
                <Icon.Clock
                  stroke={theme.colors.dark}
                  strokeWidth={2}
                  width={wp(6)}
                  height={wp(6)}
                />
                <Text style={styles.dateTimeText}>
                  {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                </Text>
              </TouchableOpacity>

              <View style={styles.peopleInputContainer}>
                <MyInput
                  containerStyle={styles.peopleInput}
                  icon={<SimpleLineIcons name="people" size={wp(6)} color="black" />}
                  keyboardType="numeric"
                  value={peopleCount.toString()}
                  onChangeText={(value) => {
                    const numValue = parseInt(value) || 0;
                    setPeopleCount(numValue);
                  }}
                />
              </View>
            </View>

            {showDatePicker && (
              <DateTimePicker
                testID="datePicker"
                value={date}
                mode="date"
                display="default"
                onChange={handleDateChange}
                minimumDate={new Date()}
              />
            )}
            {showTimePicker && (
              <DateTimePicker
                testID="timePicker"
                value={time}
                mode="time"
                display="default"
                onChange={handleTimeChange}
                minuteInterval={1}
              />
            )}

            <MyInput
              containerStyle={styles.noteInput}
              placeholder="Ghi chú..."
              value={note}
              onChangeText={setNote}
              multiline={true}
            />
          </View>

          {/* ✅ Food Selection Section (replaced Table Selection) */}
          <View style={styles.foodSection}>
            <TouchableOpacity
              style={styles.selectFoodButton}
              onPress={() => setShowFoodModal(true)}
            >

              <Icon.Plus stroke="white" strokeWidth={2} width={wp(5)} height={wp(5)} />
              <Text style={styles.selectFoodText}>
                {cart.details.length > 0
                  ? `Đã chọn ${cart.details.length} món (${cart.cartPrice.toLocaleString()}đ)`
                  : "Chọn món ăn"
                }
              </Text>
            </TouchableOpacity>
            {/*  */}
            <TouchableOpacity
              style={styles.cartButton}
              onPress={() => setShowCartModal(true)}
            >
              <Icon.ShoppingCart stroke="white" strokeWidth={2} width={wp(5)} height={wp(5)} />
              {getTotalCartItems() > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{getTotalCartItems()}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Mini Cart Preview */}
            {/* {cart.details.length > 0 && (
              <View style={styles.miniCartPreview}>
                {cart.details.slice(0, 3).map((item, index) => (
                  <Text key={item.productId} style={styles.miniCartItem}>
                    {item.productName} x{item.num}
                  </Text>
                ))}
                {cart.details.length > 3 && (
                  <Text style={styles.miniCartMore}>... và {cart.details.length - 3} món khác</Text>
                )}
              </View>
            )} */}
          </View>

          {/* Table Selection Section */}
          <View style={styles.tableSection}>
            {/* <Text style={styles.tableSectionTitle}>Chọn bàn:</Text> */}

            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={styles.floorScrollView}
              contentContainerStyle={styles.floorScrollContent}
            >
              {floors.map((tables, index) => {
                const floorAvailable = tables.filter(t => t.state !== 'in_use').length;
                const floorTotal = tables.length;

                return (
                  <View key={index} style={styles.floorContainer}>
                    <View style={styles.floorHeader}>
                      <Text style={styles.floorTitle}>Tầng {index + 1}</Text>
                      <Text style={styles.floorStatus}>
                        ({floorAvailable}/{floorTotal} bàn trống)
                      </Text>
                    </View>

                    <FlatList
                      data={[...tables].sort((a, b) => a.id - b.id)}
                      keyExtractor={(item) => item.id.toString()}
                      numColumns={3}
                      renderItem={({ item }) => (
                        <MyTableItem
                          item={item}
                          isSelected={chooseTable.includes(item.id)}
                          tableClick={() => handleChoose(item)}
                        />
                      )}
                      contentContainerStyle={styles.tableGrid}
                      showsVerticalScrollIndicator={true}
                      scrollEnabled={true}
                      nestedScrollEnabled={true}
                    />
                  </View>
                );
              })}
            </ScrollView>

            {state !== '' && (
              <View style={styles.statusContainer}>
                <Text style={styles.statusText}>{state}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Submit Button */}
        <View style={styles.buttonContainer}>
          <MyButton
            title={cart.cartPrice > 0
              ? `Đặt bàn (${cart.cartPrice.toLocaleString()}đ)`
              : "Đặt bàn"
            }
            loading={loading}
            onPress={handleAssign}
            style={styles.submitButton}
          />
        </View>

        {/* ✅ Food Selection Modal */}
        <Modal
          visible={showFoodModal}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowFoodModal(false)}
              >
                <Icon.X stroke="#666" strokeWidth={2} width={wp(6)} height={wp(6)} />
              </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Tìm kiếm món ăn..."
                value={searchQuery}
                onChangeText={handleSearch}
              />
              <Icon.Search stroke="#666" strokeWidth={2} width={wp(5)} height={wp(5)} />
            </View>

            {/* Category Tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoryTabs}
              contentContainerStyle={styles.categoryTabsContent}
            >
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.categoryTab,
                    selectedCategory === category.id && styles.categoryTabActive
                  ]}
                  onPress={() => handleCategoryChange(category.id)}
                >
                  <Text style={[
                    styles.categoryTabText,
                    selectedCategory === category.id && styles.categoryTabTextActive
                  ]}>
                    {category.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Products List */}
            <FlatList
              data={filteredProducts}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderProductItem}
              contentContainerStyle={styles.productsList}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </Modal>

        {/* ✅ Cart Modal */}
        <Modal
          visible={showCartModal}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Giỏ hàng ({getTotalCartItems()} món)</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowCartModal(false)}
              >
                <Icon.X stroke="#666" strokeWidth={2} width={wp(6)} height={wp(6)} />
              </TouchableOpacity>
            </View>

            {cart.details.length > 0 ? (
              <>
                <FlatList
                  data={cart.details}
                  keyExtractor={(item) => item.productId.toString()}
                  renderItem={renderCartItem}
                  contentContainerStyle={styles.cartList}
                  showsVerticalScrollIndicator={false}
                />

                <View style={styles.cartSummary}>
                  <View style={styles.cartTotal}>
                    <Text style={styles.cartTotalText}>
                      Tổng cộng: {cart.cartPrice.toLocaleString()}đ
                    </Text>
                  </View>

                  <View style={styles.cartActions}>
                    <TouchableOpacity
                      style={styles.clearCartButton}
                      onPress={clearCart}
                    >
                      <Text style={styles.clearCartText}>Xóa tất cả</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.continueButton}
                      onPress={() => setShowCartModal(false)}
                    >
                      <Text style={styles.continueText}>Tiếp tục</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.emptyCart}>
                <Icon.ShoppingCart stroke="#ccc" strokeWidth={2} width={wp(15)} height={wp(15)} />
                <Text style={styles.emptyCartText}>Giỏ hàng trống</Text>
                <Text style={styles.emptyCartSubText}>Thêm món ăn để bắt đầu đặt hàng</Text>
              </View>
            )}
          </View>
        </Modal>
      </View>
    </ScreenWrapper>
  );
};

export default AssignTableScr;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: wp(4),
    paddingTop: hp(1),
  },

  formContainer: {
    flex: 1,
    backgroundColor: '#fff7bf',
    borderRadius: wp(3),
    marginBottom: hp(1),
  },

  formContent: {
    paddingHorizontal: wp(4),
    paddingVertical: hp(2),
    gap: hp(1.5),
  },

  titleText: {
    color: 'black',
    fontSize: wp(5),
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: hp(1),
  },

  dateTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: wp(2),
  },

  dateTimeButton: {
    backgroundColor: theme.colors.light,
    paddingHorizontal: wp(3),
    paddingVertical: hp(1.5),
    borderRadius: wp(2.5),
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
    borderWidth: 1,
    borderColor: theme.colors.gray,
    flex: 1,
    justifyContent: 'center',
  },

  dateTimeText: {
    fontSize: wp(3.5),
    color: theme.colors.dark,
    fontWeight: '500',
  },

  peopleInputContainer: {
    width: '32%',
  },

  peopleInput: {
    width: '100%',
  },

  noteInput: {
    height: hp(8),
    textAlignVertical: 'top',
  },

  // ✅ Food Section Styles
  foodSection: {
    paddingHorizontal: wp(4),
    paddingVertical: hp(2),
    borderTopWidth: 1,
    borderTopColor: 'black',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  cartButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: wp(3),
    paddingVertical: hp(1),
    borderRadius: wp(6),
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cartBadge: {
    position: 'absolute',
    top: -hp(0.5),
    right: -wp(1),
    backgroundColor: '#ff4757',
    borderRadius: wp(2.5),
    minWidth: wp(5),
    height: wp(5),
    justifyContent: 'center',
    alignItems: 'center',
  },

  cartBadgeText: {
    color: 'white',
    fontSize: wp(3),
    fontWeight: 'bold',
  },

  selectFoodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.5),
    borderRadius: wp(2),
    gap: wp(2),
    justifyContent: 'center',
  },

  selectFoodText: {
    color: 'white',
    fontSize: wp(4),
    fontWeight: '600',
  },

  miniCartPreview: {
    marginTop: hp(1),
    paddingHorizontal: wp(2),
  },

  miniCartItem: {
    fontSize: wp(3.5),
    color: theme.colors.text,
    marginBottom: hp(0.3),
  },

  miniCartMore: {
    fontSize: wp(3.5),
    color: theme.colors.textLight,
    fontStyle: 'italic',
  },

  tableSection: {
    flex: 1,
    paddingHorizontal: wp(2),
    paddingBottom: hp(2),
  },

  tableSectionTitle: {
    fontSize: wp(4.5),
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: hp(1.5),
    color: theme.colors.dark,
  },

  floorScrollView: {
    flex: 1,
  },

  floorScrollContent: {
    paddingHorizontal: wp(1),
  },

  floorContainer: {
    width: wp(87),
    marginHorizontal: wp(1),
    flex: 1,
  },

  floorHeader: {
    alignItems: 'center',
    paddingVertical: hp(1),
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: wp(2),
    flexDirection: 'row',
    alignSelf: 'center',
    paddingHorizontal: wp(2),
  },

  floorTitle: {
    fontSize: wp(5),
    fontWeight: 'bold',
    color: theme.colors.dark,
  },

  floorStatus: {
    fontSize: wp(3.5),
    color: theme.colors.textLight,
    marginTop: hp(0.5),
  },

  tableGrid: {
    paddingHorizontal: wp(2),
    justifyContent: 'center',
    flexGrow: 1,
  },

  statusContainer: {
    marginTop: hp(1),
    paddingHorizontal: wp(4),
    paddingVertical: hp(1),
    backgroundColor: 'rgba(255, 77, 77, 0.1)',
    borderRadius: wp(2),
    marginHorizontal: wp(2),
  },

  statusText: {
    color: '#ff4d4d',
    fontSize: wp(3.8),
    textAlign: 'center',
    fontWeight: '500',
  },

  buttonContainer: {
    paddingVertical: hp(1),
  },

  submitButton: {
    marginHorizontal: 0,
  },

  // ✅ Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: wp(4),
    paddingVertical: hp(2),
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },

  modalTitle: {
    fontSize: wp(5),
    fontWeight: 'bold',
    color: theme.colors.dark,
  },

  closeButton: {
    padding: wp(2),
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.5),
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },

  searchInput: {
    flex: 1,
    fontSize: wp(4),
    paddingHorizontal: wp(3),
    paddingVertical: hp(1),
    backgroundColor: '#f5f5f5',
    borderRadius: wp(2),
    marginRight: wp(2),
  },

  categoryTabs: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },

  categoryTabsContent: {
    paddingHorizontal: wp(2),
    paddingVertical: hp(1),
  },

  categoryTab: {
    paddingHorizontal: wp(4),
    paddingVertical: hp(1),
    marginHorizontal: wp(1),
    borderRadius: wp(5),
    backgroundColor: '#f5f5f5',
  },

  categoryTabActive: {
    backgroundColor: theme.colors.primary,
  },

  categoryTabText: {
    fontSize: wp(3.5),
    color: theme.colors.text,
    fontWeight: '500',
  },

  categoryTabTextActive: {
    color: 'white',
  },

  productsList: {
    paddingHorizontal: wp(4),
    paddingBottom: hp(2),
  },

  productItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: hp(1.5),
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },

  productInfo: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'center',
  },

  productImage: {
    width: wp(20),
    height: wp(20),
    borderRadius: wp(2),
    marginRight: wp(3),
  },

  productDetails: {
    flex: 1,
  },

  productName: {
    fontSize: wp(4),
    fontWeight: '600',
    color: theme.colors.dark,
    marginBottom: hp(0.5),
  },

  productPrice: {
    fontSize: wp(3.5),
    color: theme.colors.primary,
    fontWeight: 'bold',
    marginBottom: hp(0.5),
  },

  productDescription: {
    fontSize: wp(3),
    color: theme.colors.textLight,
  },

  productActions: {
    alignItems: 'center',
  },

  addToCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: wp(3),
    paddingVertical: hp(1),
    borderRadius: wp(2),
    gap: wp(1),
  },

  addToCartText: {
    color: 'white',
    fontSize: wp(3.5),
    fontWeight: '600',
  },

  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
  },

  quantityButton: {
    backgroundColor: theme.colors.primary,
    width: wp(8),
    height: wp(8),
    borderRadius: wp(4),
    justifyContent: 'center',
    alignItems: 'center',
  },

  quantityButtonDisabled: {
    backgroundColor: '#ccc',
  },

  quantityText: {
    fontSize: wp(4),
    fontWeight: 'bold',
    minWidth: wp(6),
    textAlign: 'center',
  },

  // ✅ Cart Modal Styles
  cartList: {
    paddingHorizontal: wp(4),
    paddingTop: hp(1),
  },

  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: hp(1.5),
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },

  cartItemInfo: {
    flex: 1,
  },

  cartItemName: {
    fontSize: wp(4),
    fontWeight: '600',
    color: theme.colors.dark,
    marginBottom: hp(0.5),
  },

  cartItemPrice: {
    fontSize: wp(3.5),
    color: theme.colors.textLight,
  },

  cartItemControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
  },

  cartQuantityButton: {
    width: wp(8),
    height: wp(8),
    borderRadius: wp(4),
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },

  cartQuantityButtonDisabled: {
    backgroundColor: '#e0e0e0',
  },

  cartQuantityText: {
    fontSize: wp(4),
    fontWeight: 'bold',
    minWidth: wp(6),
    textAlign: 'center',
  },

  cartSummary: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingHorizontal: wp(4),
    paddingVertical: hp(2),
  },

  cartTotal: {
    marginBottom: hp(2),
  },

  cartTotalText: {
    fontSize: wp(5),
    fontWeight: 'bold',
    color: theme.colors.primary,
    textAlign: 'center',
  },

  cartActions: {
    flexDirection: 'row',
    gap: wp(3),
  },

  clearCartButton: {
    flex: 1,
    paddingVertical: hp(1.5),
    backgroundColor: '#ff4757',
    borderRadius: wp(2),
    alignItems: 'center',
  },

  clearCartText: {
    color: 'white',
    fontSize: wp(4),
    fontWeight: '600',
  },

  continueButton: {
    flex: 1,
    paddingVertical: hp(1.5),
    backgroundColor: theme.colors.primary,
    borderRadius: wp(2),
    alignItems: 'center',
  },

  continueText: {
    color: 'white',
    fontSize: wp(4),
    fontWeight: '600',
  },

  emptyCart: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: hp(2),
  },

  emptyCartText: {
    fontSize: wp(5),
    fontWeight: '600',
    color: theme.colors.dark,
  },

  emptyCartSubText: {
    fontSize: wp(4),
    color: theme.colors.textLight,
    textAlign: 'center',
  },
});
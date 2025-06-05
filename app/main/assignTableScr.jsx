import React, { useEffect, useCallback, memo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  FlatList,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';

// Components
import ScreenWrapper from '../../components/ScreenWrapper';
import MyHeader from '../../components/MyHeader';
import MyInput from '../../components/MyInput';
import MyButton from '../../components/MyButton';
import MyTableItem from '../../components/MyTableItem';

// Local Components


// Hooks & Utils
import { theme } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { hp, wp } from '../../helper/common';

import CartItem from '../../components/CartItem';
import CategoryTab from '../../components/CategoryTab';
import { useAssignTable } from '../../hook/useAssignTable';

// Icons
import * as Icon from 'react-native-feather';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Feather from '@expo/vector-icons/Feather';
import SimpleLineIcons from '@expo/vector-icons/SimpleLineIcons';
import ProductItem from '../../components/ProductItem';

// Constants
const FLATLIST_CONFIG = {
  removeClippedSubviews: true,
  maxToRenderPerBatch: 10,
  windowSize: 10,
  initialNumToRender: 5,
  updateCellsBatchingPeriod: 50,
};

const AssignTableScr = () => {
  const { user } = useAuth();

  const {
    tableState, formState, productState, modalState, cart, loading,
    requiredTables, totalCartItems,
    setFormState, setModalState,
    fetchProductsData, refreshTableData, handleSearch, clearSearch,
    handleCategoryChange, addToCart, updateCartItemQuantity, getCartItemQuantity,
    clearCart, handleDateChange, handleTimeChange, handleChooseTable, handleAssign
  } = useAssignTable(user);

  // Render functions
  const renderProductItem = useCallback(({ item }) => (
    <ProductItem
      item={item}
      quantity={getCartItemQuantity(item.id)}
      onAdd={addToCart}
      onUpdateQuantity={updateCartItemQuantity}
      styles={styles}
    />
  ), [getCartItemQuantity, addToCart, updateCartItemQuantity]);

  const renderCartItem = useCallback(({ item }) => (
    <CartItem item={item} onUpdateQuantity={updateCartItemQuantity} styles={styles} />
  ), [updateCartItemQuantity]);

  const keyExtractor = useCallback((item) => item.id?.toString() || Math.random().toString(), []);
  const productKeyExtractor = useCallback((item) => item.productId?.toString() || Math.random().toString(), []);

  // Effects
  useEffect(() => {
    if (user) {
      setFormState(prev => ({ ...prev, name: user.name || '', phone: user.phone || '' }));
    }
  }, [user]);

  useEffect(() => { refreshTableData(); }, [formState.date, formState.time, formState.peopleCount]);
  useEffect(() => { fetchProductsData(); }, []);
  useFocusEffect(useCallback(() => { refreshTableData(); }, []));

  return (
    <ScreenWrapper bg="#FFBF00">
      <View style={styles.container}>
        <MyHeader title="Đặt bàn" showBackButton={true} />

        <View style={styles.formContainer}>
          {/* Form Section */}
          <View style={styles.formContent}>
            <Text style={styles.titleText}>Vui lòng điền thông tin của bạn:</Text>

            <MyInput
              placeholder="Tên của bạn..."
              value={formState.name}
              onChangeText={(value) => setFormState(prev => ({ ...prev, name: value }))}
              icon={<FontAwesome name="pencil-square-o" size={wp(6)} color="black" />}
            />

            <MyInput
              icon={<Feather name="phone-call" size={wp(6)} color="black" />}
              placeholder="Số điện thoại..."
              value={formState.phone}
              onChangeText={(value) => setFormState(prev => ({ ...prev, phone: value }))}
              keyboardType="phone-pad"
            />

            {/* Date Time Row */}
            <View style={styles.dateTimeRow}>
              <TouchableOpacity
                style={styles.dateTimeButton}
                onPress={() => setFormState(prev => ({ ...prev, showDatePicker: true }))}
              >
                <Icon.Calendar stroke={theme.colors.dark} strokeWidth={2} width={wp(6)} height={wp(6)} />
                <Text style={styles.dateTimeText}>{formState.date.toLocaleDateString()}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dateTimeButton}
                onPress={() => setFormState(prev => ({ ...prev, showTimePicker: true }))}
              >
                <Icon.Clock stroke={theme.colors.dark} strokeWidth={2} width={wp(6)} height={wp(6)} />
                <Text style={styles.dateTimeText}>
                  {formState.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                </Text>
              </TouchableOpacity>

              <View style={styles.peopleInputContainer}>
                <MyInput
                  containerStyle={styles.peopleInput}
                  icon={<SimpleLineIcons name="people" size={wp(6)} color="black" />}
                  keyboardType="numeric"
                  value={formState.peopleCount.toString()}
                  onChangeText={(value) => {
                    const numValue = parseInt(value) || 0;
                    setFormState(prev => ({ ...prev, peopleCount: numValue }));
                  }}
                />
              </View>
            </View>

            {/* Date Time Pickers */}
            {formState.showDatePicker && (
              <DateTimePicker
                value={formState.date}
                mode="date"
                display="default"
                onChange={handleDateChange}
                minimumDate={new Date()}
              />
            )}

            {formState.showTimePicker && (
              <DateTimePicker
                value={formState.time}
                mode="time"
                display="default"
                onChange={handleTimeChange}
              />
            )}

            <MyInput
              containerStyle={styles.noteInput}
              placeholder="Ghi chú..."
              value={formState.note}
              onChangeText={(value) => setFormState(prev => ({ ...prev, note: value }))}
              multiline={true}
            />
          </View>

          {/* Food Selection Section */}
          <View style={styles.foodSection}>
            <TouchableOpacity
              style={styles.selectFoodButton}
              onPress={() => setModalState(prev => ({ ...prev, showFoodModal: true }))}
            >
              <Icon.Plus stroke="white" strokeWidth={2} width={wp(5)} height={wp(5)} />
              <Text style={styles.selectFoodText}>
                {cart.details.length > 0
                  ? `Đã chọn ${cart.details.length} món (${cart.cartPrice.toLocaleString()}đ)`
                  : "Chọn món ăn"
                }
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cartButton}
              onPress={() => setModalState(prev => ({ ...prev, showCartModal: true }))}
            >
              <Icon.ShoppingCart stroke="white" strokeWidth={2} width={wp(5)} height={wp(5)} />
              {totalCartItems > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{totalCartItems}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Table Selection Section */}
          <View style={styles.tableSection}>
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
              {tableState.floors.map((tables, index) => {
                const floorAvailable = tables.filter(t => t.state !== 'in_use').length;
                const floorTotal = tables.length;

                return (
                  <View key={index} style={styles.floorContainer}>
                    <View style={styles.floorHeader}>
                      <Text style={styles.floorTitle}>Tầng {index + 1}</Text>
                      <Text style={styles.floorStatus}>({floorAvailable}/{floorTotal} bàn trống)</Text>
                    </View>

                    <FlatList
                      data={[...tables].sort((a, b) => a.id - b.id)}
                      keyExtractor={keyExtractor}
                      numColumns={3}
                      renderItem={({ item }) => (
                        <MyTableItem
                          item={item}
                          isSelected={tableState.chooseTable.includes(item.id)}
                          tableClick={() => handleChooseTable(item)}
                        />
                      )}
                      contentContainerStyle={styles.tableGrid}
                      {...FLATLIST_CONFIG}
                    />
                  </View>
                );
              })}
            </ScrollView>

            {tableState.statusMessage !== '' && (
              <View style={styles.statusContainer}>
                <Text style={styles.statusText}>{tableState.statusMessage}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Submit Button */}
        <View style={styles.buttonContainer}>
          <MyButton
            title={cart.cartPrice > 0 ? `Đặt bàn (${cart.cartPrice.toLocaleString()}đ)` : "Đặt bàn"}
            loading={loading}
            onPress={handleAssign}
            style={styles.submitButton}
          />
        </View>

        {/* Food Selection Modal */}
        <Modal visible={modalState.showFoodModal} animationType="slide" presentationStyle="pageSheet">
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn món ăn</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setModalState(prev => ({ ...prev, showFoodModal: false }))}
              >
                <Icon.X stroke="#666" strokeWidth={2} width={wp(6)} height={wp(6)} />
              </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <View style={styles.searchInputWrapper}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Tìm kiếm món ăn..."
                  value={productState.searchQuery}
                  onChangeText={handleSearch}
                />
                {productState.searchQuery.length > 0 && (
                  <TouchableOpacity style={styles.clearSearchButton} onPress={clearSearch}>
                    <Icon.X stroke="#999" strokeWidth={2} width={wp(4)} height={wp(4)} />
                  </TouchableOpacity>
                )}
              </View>
              <Icon.Search stroke="#666" strokeWidth={2} width={wp(5)} height={wp(5)} />
            </View>

            {/* Category Tabs */}
            <View style={styles.categoryTabsContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <CategoryTab
                  category={{ name: 'Tất cả' }}
                  isSelected={productState.selectedCategory === 'all'}
                  onPress={() => handleCategoryChange('all')}
                  styles={styles}
                />
                {productState.categories.map((category) => (
                  <CategoryTab
                    key={category.id}
                    category={category}
                    isSelected={productState.selectedCategory === category.id}
                    onPress={() => handleCategoryChange(category.id)}
                    styles={styles}
                  />
                ))}
              </ScrollView>
            </View>

            {/* Products List */}
            <View style={styles.productsContainer}>
              {productState.filteredProducts.length > 0 ? (
                <FlatList
                  data={productState.filteredProducts}
                  keyExtractor={keyExtractor}
                  renderItem={renderProductItem}
                  contentContainerStyle={styles.productsList}
                  {...FLATLIST_CONFIG}
                />
              ) : (
                <View style={styles.emptyProducts}>
                  {loading ? (
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                  ) : (
                    <>
                      <Icon.Search stroke="#ccc" strokeWidth={2} width={wp(15)} height={wp(15)} />
                      <Text style={styles.emptyProductsText}>
                        {productState.searchQuery || productState.selectedCategory !== 'all'
                          ? 'Không tìm thấy món ăn phù hợp'
                          : 'Chưa có món ăn nào'}
                      </Text>
                      {productState.searchQuery && (
                        <TouchableOpacity style={styles.clearSearchTextButton} onPress={clearSearch}>
                          <Text style={styles.clearSearchTextButtonText}>Xóa từ khóa tìm kiếm</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </View>
              )}
            </View>
          </View>
        </Modal>

        {/* Cart Modal */}
        <Modal visible={modalState.showCartModal} animationType="slide" presentationStyle="pageSheet">
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Giỏ hàng ({totalCartItems} món)</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setModalState(prev => ({ ...prev, showCartModal: false }))}
              >
                <Icon.X stroke="#666" strokeWidth={2} width={wp(6)} height={wp(6)} />
              </TouchableOpacity>
            </View>

            {cart.details.length > 0 ? (
              <>
                <FlatList
                  data={cart.details}
                  keyExtractor={productKeyExtractor}
                  renderItem={renderCartItem}
                  contentContainerStyle={styles.cartList}
                  {...FLATLIST_CONFIG}
                />
                <View style={styles.cartSummary}>
                  <View style={styles.cartTotal}>
                    <Text style={styles.cartTotalText}>Tổng cộng: {cart.cartPrice.toLocaleString()}đ</Text>
                  </View>
                  <View style={styles.cartActions}>
                    <TouchableOpacity style={styles.clearCartButton} onPress={clearCart}>
                      <Text style={styles.clearCartText}>Xóa tất cả</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.continueButton}
                      onPress={() => setModalState(prev => ({ ...prev, showCartModal: false }))}
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

export default memo(AssignTableScr);

// ===== STYLES - Simplified but complete =====
const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: wp(4), paddingTop: hp(1), backgroundColor: 'transparent' },
  formContainer: { flex: 1, backgroundColor: '#fff7bf', borderRadius: wp(3), marginBottom: hp(1), overflow: 'hidden' },
  formContent: { paddingHorizontal: wp(4), paddingVertical: hp(2), gap: hp(1.5) },
  titleText: { color: 'black', fontSize: wp(5), fontWeight: '600', textAlign: 'center', marginBottom: hp(1) },

  dateTimeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: wp(2) },
  dateTimeButton: {
    backgroundColor: theme.colors.light, paddingHorizontal: wp(3), paddingVertical: hp(1.5),
    borderRadius: wp(2.5), flexDirection: 'row', alignItems: 'center', gap: wp(2),
    borderWidth: 1, borderColor: theme.colors.gray, flex: 1, justifyContent: 'center', minHeight: hp(6)
  },
  dateTimeText: { fontSize: wp(3.5), color: theme.colors.dark, fontWeight: '500' },
  peopleInputContainer: { width: '32%' },
  peopleInput: { width: '100%' },
  noteInput: { height: hp(8), textAlignVertical: 'top' },

  foodSection: {
    paddingHorizontal: wp(4), paddingVertical: hp(1.5), borderTopWidth: 1, borderTopColor: 'black',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.3)'
  },
  selectFoodButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.primary,
    paddingHorizontal: wp(4), paddingVertical: hp(1.5), borderRadius: wp(2), gap: wp(2),
    justifyContent: 'center', marginRight: wp(2), minHeight: hp(6)
  },
  selectFoodText: { color: 'white', fontSize: wp(4), fontWeight: '600' },
  cartButton: {
    backgroundColor: theme.colors.primary, paddingHorizontal: wp(3), paddingVertical: hp(1.5),
    borderRadius: wp(2), position: 'relative', alignItems: 'center', justifyContent: 'center',
    minWidth: wp(12), minHeight: hp(6)
  },
  cartBadge: {
    position: 'absolute', top: -hp(0.5), right: -wp(1), backgroundColor: '#ff4757', borderRadius: wp(3),
    minWidth: wp(5), height: wp(5), justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'white'
  },
  cartBadgeText: { color: 'white', fontSize: wp(2.8), fontWeight: 'bold' },

  tableSection: { flex: 1, paddingHorizontal: wp(2), paddingBottom: hp(2) },
  floorContainer: { width: wp(87), marginHorizontal: wp(1), flex: 1 },
  floorHeader: {
    alignItems: 'center', paddingVertical: hp(1), backgroundColor: 'rgba(255, 255, 255, 0.8)', borderRadius: wp(2),
    flexDirection: 'row', alignSelf: 'center', paddingHorizontal: wp(3), gap: wp(2), marginBottom: hp(1),
    borderWidth: 1, borderColor: 'rgba(0, 0, 0, 0.1)'
  },
  floorTitle: { fontSize: wp(5), fontWeight: 'bold', color: theme.colors.dark },
  floorStatus: { fontSize: wp(3.5), color: theme.colors.textLight, fontStyle: 'italic' },
  tableGrid: { paddingHorizontal: wp(2), justifyContent: 'center', flexGrow: 1 },
  statusContainer: {
    marginTop: hp(1), paddingHorizontal: wp(4), paddingVertical: hp(1), backgroundColor: 'rgba(255, 77, 77, 0.1)',
    borderRadius: wp(2), marginHorizontal: wp(2), borderLeftWidth: 4, borderLeftColor: '#ff4d4d'
  },
  statusText: { color: '#ff4d4d', fontSize: wp(3.8), textAlign: 'center', fontWeight: '500' },

  buttonContainer: { paddingVertical: hp(1), paddingHorizontal: wp(4) },
  submitButton: {
    marginHorizontal: 0, backgroundColor: theme.colors.primary, borderRadius: wp(3), elevation: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84
  },

  modalContainer: { flex: 1, backgroundColor: 'white' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: wp(4),
    paddingVertical: hp(2), borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: 'white',
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3
  },
  modalTitle: { fontSize: wp(5.5), fontWeight: 'bold', color: theme.colors.dark },
  closeButton: { padding: wp(2), borderRadius: wp(5), backgroundColor: '#f5f5f5' },

  searchContainer: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: wp(4), paddingVertical: hp(1.5),
    borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: 'white'
  },
  searchInputWrapper: {
    flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f9fa', borderRadius: wp(3),
    marginRight: wp(2), position: 'relative', borderWidth: 1, borderColor: '#e9ecef'
  },
  searchInput: {
    flex: 1, fontSize: wp(4), paddingHorizontal: wp(3), paddingVertical: hp(1.2),
    paddingRight: wp(10), color: theme.colors.dark
  },
  clearSearchButton: {
    position: 'absolute', right: wp(2), padding: wp(1.5), borderRadius: wp(4), backgroundColor: 'rgba(0,0,0,0.1)'
  },

  categoryTabsContainer: { height: hp(8), borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: 'white' },
  categoryTab: {
    paddingHorizontal: wp(4), paddingVertical: hp(1.2), marginHorizontal: wp(1), borderRadius: wp(6),
    backgroundColor: '#f8f9fa', height: hp(5), justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#e9ecef', minWidth: wp(20)
  },
  categoryTabActive: {
    backgroundColor: theme.colors.primary, borderColor: theme.colors.primary, elevation: 2,
    shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 2
  },
  categoryTabText: { fontSize: wp(3.5), color: theme.colors.text, fontWeight: '500', textAlign: 'center' },
  categoryTabTextActive: { color: 'white', fontWeight: '600' },

  productsContainer: { flex: 1, backgroundColor: '#fafbfc' },
  productsList: { paddingHorizontal: wp(4), paddingTop: hp(1), paddingBottom: hp(2), flexGrow: 1 },
  productItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: hp(1.5),
    paddingHorizontal: wp(2), borderBottomWidth: 1, borderBottomColor: '#f0f1f2', backgroundColor: 'white',
    borderRadius: wp(2), marginBottom: hp(0.5), elevation: 1, shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 1
  },
  productInfo: { flexDirection: 'row', flex: 1, alignItems: 'center' },
  productImage: {
    width: wp(18), height: wp(18), borderRadius: wp(2), marginRight: wp(3),
    backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#e9ecef'
  },
  productDetails: { flex: 1, paddingRight: wp(2) },
  productName: {
    fontSize: wp(4), fontWeight: '600', color: theme.colors.dark,
    marginBottom: hp(0.5), lineHeight: wp(5.5)
  },
  productPrice: { fontSize: wp(3.8), color: theme.colors.primary, fontWeight: 'bold', marginBottom: hp(0.3) },
  productDescription: { fontSize: wp(3.2), color: theme.colors.textLight, lineHeight: wp(4.5) },
  productActions: { alignItems: 'center', justifyContent: 'center', minWidth: wp(28) },
  addToCartButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.primary, paddingHorizontal: wp(3),
    paddingVertical: hp(1), borderRadius: wp(2), gap: wp(1.5), elevation: 2, shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 2
  },
  addToCartText: { color: 'white', fontSize: wp(3.5), fontWeight: '600' },
  quantityControls: {
    flexDirection: 'row', alignItems: 'center', gap: wp(2), backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: wp(3), padding: wp(1)
  },
  quantityButton: {
    backgroundColor: theme.colors.primary, width: wp(8), height: wp(8), borderRadius: wp(4),
    justifyContent: 'center', alignItems: 'center', elevation: 2, shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 2
  },
  quantityButtonDisabled: { backgroundColor: '#ccc', elevation: 0, shadowOpacity: 0 },
  quantityText: {
    fontSize: wp(4.2), fontWeight: 'bold', minWidth: wp(8), textAlign: 'center',
    color: theme.colors.dark, backgroundColor: 'white', paddingVertical: hp(0.5), borderRadius: wp(1)
  },

  emptyProducts: {
    flex: 1, justifyContent: 'center', alignItems: 'center', gap: hp(2), paddingHorizontal: wp(8),
    backgroundColor: 'white', margin: wp(4), borderRadius: wp(3), paddingVertical: hp(4)
  },
  emptyProductsText: { fontSize: wp(4.2), color: theme.colors.textLight, textAlign: 'center', lineHeight: wp(6) },
  clearSearchTextButton: {
    marginTop: hp(1), paddingHorizontal: wp(4), paddingVertical: hp(1.2), backgroundColor: theme.colors.primary,
    borderRadius: wp(3), elevation: 2, shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3, shadowRadius: 2
  },
  clearSearchTextButtonText: { color: 'white', fontSize: wp(3.5), fontWeight: '600' },

  cartList: { paddingHorizontal: wp(4), paddingTop: hp(1), backgroundColor: '#fafbfc' },
  cartItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: hp(1.5),
    paddingHorizontal: wp(3), borderBottomWidth: 1, borderBottomColor: '#f0f1f2', backgroundColor: 'white',
    borderRadius: wp(2), marginBottom: hp(0.5), elevation: 1, shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 1
  },
  cartItemInfo: { flex: 1, paddingRight: wp(2) },
  cartItemName: {
    fontSize: wp(4), fontWeight: '600', color: theme.colors.dark,
    marginBottom: hp(0.5), lineHeight: wp(5.5)
  },
  cartItemPrice: { fontSize: wp(3.5), color: theme.colors.textLight, lineHeight: wp(4.5) },
  cartItemControls: {
    flexDirection: 'row', alignItems: 'center', gap: wp(2), backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: wp(3), padding: wp(1)
  },
  cartQuantityButton: {
    width: wp(8), height: wp(8), borderRadius: wp(4), backgroundColor: '#f8f9fa',
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e9ecef'
  },
  cartQuantityButtonDisabled: { backgroundColor: '#e9ecef', borderColor: '#dee2e6' },
  cartQuantityText: {
    fontSize: wp(4), fontWeight: 'bold', minWidth: wp(8), textAlign: 'center',
    color: theme.colors.dark, backgroundColor: 'white', paddingVertical: hp(0.5), borderRadius: wp(1)
  },

  cartSummary: {
    borderTopWidth: 2, borderTopColor: '#e9ecef', paddingHorizontal: wp(4), paddingVertical: hp(2),
    backgroundColor: 'white', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1, shadowRadius: 3
  },
  cartTotal: {
    marginBottom: hp(2), paddingVertical: hp(1), paddingHorizontal: wp(3), backgroundColor: '#f8f9fa',
    borderRadius: wp(2), borderWidth: 1, borderColor: '#e9ecef'
  },
  cartTotalText: { fontSize: wp(5.2), fontWeight: 'bold', color: theme.colors.primary, textAlign: 'center' },
  cartActions: { flexDirection: 'row', gap: wp(3) },
  clearCartButton: {
    flex: 1, paddingVertical: hp(1.8), backgroundColor: '#dc3545', borderRadius: wp(3), alignItems: 'center',
    elevation: 2, shadowColor: '#dc3545', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 2
  },
  clearCartText: { color: 'white', fontSize: wp(4), fontWeight: '600' },
  continueButton: {
    flex: 1, paddingVertical: hp(1.8), backgroundColor: theme.colors.primary, borderRadius: wp(3),
    alignItems: 'center', elevation: 2, shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3, shadowRadius: 2
  },
  continueText: { color: 'white', fontSize: wp(4), fontWeight: '600' },

  emptyCart: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: hp(2), paddingHorizontal: wp(8), backgroundColor: '#fafbfc' },
  emptyCartText: { fontSize: wp(5.5), fontWeight: '600', color: theme.colors.dark },
  emptyCartSubText: { fontSize: wp(4), color: theme.colors.textLight, textAlign: 'center', lineHeight: wp(6) },
});
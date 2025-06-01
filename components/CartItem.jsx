import React, { memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import * as Icon from 'react-native-feather';
import { wp, hp } from '../helper/common';

const MAX_QUANTITY_PER_ITEM = 20;

const CartItem = memo(({ item, onUpdateQuantity, styles }) => {
  const isMaxQuantity = item.num >= MAX_QUANTITY_PER_ITEM;
  const totalPrice = (item.price || 0) * item.num;

  return (
    <View style={styles.cartItem}>
      <View style={styles.cartItemInfo}>
        <Text style={styles.cartItemName} numberOfLines={2}>
          {item.productName || 'Unknown Product'}
        </Text>
        <Text style={styles.cartItemPrice}>
          {(item.price || 0).toLocaleString()}đ x {item.num} = {totalPrice.toLocaleString()}đ
        </Text>
      </View>

      <View style={styles.cartItemControls}>
        <TouchableOpacity
          style={styles.cartQuantityButton}
          onPress={() => onUpdateQuantity(item.productId, item.num - 1)}
        >
          <Icon.Minus stroke="#666" strokeWidth={2} width={wp(4)} height={wp(4)} />
        </TouchableOpacity>
        <Text style={styles.cartQuantityText}>{item.num}</Text>
        <TouchableOpacity
          style={[styles.cartQuantityButton, isMaxQuantity && styles.cartQuantityButtonDisabled]}
          onPress={() => onUpdateQuantity(item.productId, item.num + 1)}
          disabled={isMaxQuantity}
        >
          <Icon.Plus stroke={isMaxQuantity ? "#ccc" : "#666"} strokeWidth={2} width={wp(4)} height={wp(4)} />
        </TouchableOpacity>
      </View>
    </View>
  );
});

export default CartItem;
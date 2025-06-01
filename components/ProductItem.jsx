import React, { memo } from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import * as Icon from 'react-native-feather';
import { wp, hp } from '../helper/common';

const MAX_QUANTITY_PER_ITEM = 20;

const ProductItem = memo(({ item, quantity, onAdd, onUpdateQuantity, styles }) => {
  const hasQuantity = quantity > 0;
  const isMaxQuantity = quantity >= MAX_QUANTITY_PER_ITEM;

  return (
    <View style={styles.productItem}>
      <View style={styles.productInfo}>
        <Image
          source={{ uri: item.image || 'https://via.placeholder.com/150' }}
          style={styles.productImage}
          resizeMode="cover"
        />
        <View style={styles.productDetails}>
          <Text style={styles.productName} numberOfLines={2}>
            {item.name || 'Unknown Product'}
          </Text>
          <Text style={styles.productPrice}>
            {(item.price || 0).toLocaleString()}đ
          </Text>
          {item.description && (
            <Text style={styles.productDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.productActions}>
        {hasQuantity ? (
          <View style={styles.quantityControls}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => onUpdateQuantity(item.id, quantity - 1)}
            >
              <Icon.Minus stroke="white" strokeWidth={2} width={wp(4)} height={wp(4)} />
            </TouchableOpacity>
            <Text style={styles.quantityText}>{quantity}</Text>
            <TouchableOpacity
              style={[styles.quantityButton, isMaxQuantity && styles.quantityButtonDisabled]}
              onPress={() => onUpdateQuantity(item.id, quantity + 1)}
              disabled={isMaxQuantity}
            >
              <Icon.Plus stroke={isMaxQuantity ? "#888" : "white"} strokeWidth={2} width={wp(4)} height={wp(4)} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.addToCartButton} onPress={() => onAdd(item, 1)}>
            <Icon.Plus stroke="white" strokeWidth={2} width={wp(4)} height={wp(4)} />
            <Text style={styles.addToCartText}>Thêm</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

export default ProductItem;
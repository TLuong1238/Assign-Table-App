import React, { memo } from 'react';
import { Text, TouchableOpacity } from 'react-native';

const CategoryTab = memo(({ category, isSelected, onPress, styles }) => (
  <TouchableOpacity
    style={[styles.categoryTab, isSelected && styles.categoryTabActive]}
    onPress={onPress}
  >
    <Text style={[styles.categoryTabText, isSelected && styles.categoryTabTextActive]}>
      {category.name || 'Unknown Category'}
    </Text>
  </TouchableOpacity>
));

export default CategoryTab;
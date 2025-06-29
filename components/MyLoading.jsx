import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { theme } from '../constants/theme'
import { hp, wp } from '../helper/common'

const MyLoading = ({ size = "large", color = theme.colors.primary, text = "Đang tải..." }) => {
  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={color} />
      <Text style={styles.loadingText}>{text}</Text>
    </View>
  )
}

export default MyLoading

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: hp(1)
  },
  loadingText: {
    fontSize: hp(2),
    color: theme.colors.text,
    fontWeight: '500',
    textAlign: 'center'
  }
})
import { StyleSheet, Text, TouchableOpacity } from 'react-native'
import React from 'react'
import { hp } from '../helper/common'
import { theme } from '../constants/theme'
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

const MyTableItem = ({
    item,
    tableClick,
    isSelected = false
}) => {
    // Đổi màu icon và nền khi được chọn hoặc đang sử dụng
    let bgColor = 'white';
    let iconColor = 'gray';
    if (item.state === 'reserved' || item.state === 'occupied') {
        bgColor = '#ffd6d6';
        iconColor = 'red';
    } else if (isSelected) {
        bgColor = '#b6fcb6';
        iconColor = 'green';
    }

    return (
        <TouchableOpacity
            style={[styles.container, { backgroundColor: bgColor, borderColor: isSelected ? 'green' : '#eee', borderWidth: 2 }]}
            onPress={tableClick}
            disabled={item.state === 'reserved' || item.state === 'occupied'}
            activeOpacity={0.7}
        >
            <MaterialIcons name="table-bar" size={60} color={iconColor} />
            <Text style={styles.tableNumber}>{item.id}</Text>
        </TouchableOpacity>
    )
}

export default MyTableItem

const styles = StyleSheet.create({
    container: {
        flex: 1,
        margin: 6,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 90,
        minWidth: 90,
    },
    tableNumber: {
        position: 'absolute',
        fontSize: 16,
        fontWeight: 'bold',
        color: 'white',
        backgroundColor: 'rgba(0,0,0,0.4)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        overflow: 'hidden',
        top: 10,
        right: 10,
    },
});
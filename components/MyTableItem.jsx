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
    const getTableColors = () => {
        if (isSelected) {
            return {
                bgColor: '#d4edda',
                iconColor: '#28a745',
                borderColor: '#28a745'
            };
        }
        
        switch (item.state) {
            case 'reserved':
            case 'occupied':
            case 'in_use':
                return {
                    bgColor: '#f8d7da',
                    iconColor: '#dc3545',
                    borderColor: '#dc3545'
                };
            default:
                return {
                    bgColor: '#ffffff',
                    iconColor: '#6c757d',
                    borderColor: '#dee2e6'
                };
        }
    };

    const { bgColor, iconColor, borderColor } = getTableColors();
    
    const isDisabled = item.state === 'reserved' || 
                      item.state === 'occupied' || 
                      item.state === 'in_use'; 

    return (
        <TouchableOpacity
            style={[
                styles.container, 
                { 
                    backgroundColor: bgColor, 
                    borderColor: borderColor, 
                    borderWidth: 2,
                    opacity: isDisabled ? 0.6 : 1
                }
            ]}
            onPress={tableClick}
            disabled={isDisabled}
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
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 5,
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
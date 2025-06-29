import { StyleSheet, Text, View, Image, ActivityIndicator, ScrollView, FlatList } from 'react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { fetchProduct, fetchProductById } from '../../services/productService';
import ScreenWrapper from '../../components/ScreenWrapper';
import { TouchableOpacity } from 'react-native';

const ProductDetailScr = () => {
    const { productId } = useLocalSearchParams();
    const [product, setProduct] = useState(null);
    const [other, setOther] = useState([]);
    const router = useRouter();


    const getProductById = async (id) => {
        try {
            const res = await fetchProductById(id);
            if (res.success) {
                setProduct(res.data);
            } else {
                return null;
            }
        } catch (error) {
            return null;
        }
    }
    // 
    const getProduct = useCallback(async () => {
        const res = await fetchProduct();
        if (res.success) {
            setOther(res.data);
        }

    })

    useEffect(() => {
        if (productId) {
            getProductById(productId)
        }
        getProduct();
    }, [productId]);



    if (!product) {
        return (
            <View style={styles.center}>
                <Text>Không tìm thấy sản phẩm</Text>
            </View>
        );
    }
    const otherProducts = other.filter(item => item.id !== product?.id);

    return (
        <ScreenWrapper bg={'#FFBF00'}>
            <View style={styles.container}>
                {product.image && (
                    <Image source={{ uri: product.image }} style={styles.image} />
                )}
                <Text style={styles.name}>{product.name}</Text>
                <Text style={styles.price}>{product.price} VNĐ</Text>
                <Text style={styles.desc}>{product.description}</Text>
                {/* Sản phẩm khác */}
                <View style={styles.otherContainer}>
                    <Text style={styles.otherTitle}>Sản phẩm khác</Text>
                    <FlatList
                        data={otherProducts}
                        keyExtractor={item => item.id.toString()}
                        numColumns={2}
                        columnWrapperStyle={{ justifyContent: 'space-between' }}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.otherItem}
                                onPress={() => router.push({ pathname: '/main/productDetailScr', params: { productId: item.id } })}
                            >
                                {item.image && (
                                    <Image source={{ uri: item.image }} style={styles.otherImage} />
                                )}
                                <Text style={styles.otherName} numberOfLines={1}>{item.name}</Text>
                                <Text style={styles.otherPrice}>{item.price} VNĐ</Text>
                            </TouchableOpacity>
                        )}
                        showsVerticalScrollIndicator={false}
                    />
                </View>
            </View>
        </ScreenWrapper>
    );
};

export default ProductDetailScr;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#fff7bf',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    image: {
        width: '100%',
        height: 250,
        borderRadius: 10,
        marginBottom: 20,
        resizeMode: 'cover',
    },
    name: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#222',
    },
    price: {
        fontSize: 20,
        color: '#FFBF00',
        marginBottom: 10,
        fontWeight: 'bold',
    },
    desc: {
        fontSize: 16,
        color: '#333',
        lineHeight: 22,
    },
    otherContainer: {
        marginTop: 30,
        paddingHorizontal: 10,
    },
    otherTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#222',
    },
    otherItem: {
    backgroundColor: '#FFBF00',
    borderRadius: 10,
    padding: 10,
    marginBottom: 15,
    alignItems: 'center',
    width: '48%',
    elevation: 2,
},
    otherImage: {
        width: 100,
        height: 100,
        borderRadius: 8,
        marginBottom: 8,
        resizeMode: 'cover',
    },
    otherName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
        textAlign: 'center',
    },
    otherPrice: {
        fontSize: 14,
        color: '#FFBF00',
        fontWeight: 'bold',
    },
});
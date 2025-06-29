import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import React, { useCallback, useEffect, useState, useMemo } from 'react'
import { useAuth } from '../../../context/AuthContext'
import ScreenWrapper from '../../../components/ScreenWrapper'
import { hp, wp } from '../../../helper/common'
import { theme } from '../../../constants/theme'
import * as Icon from 'react-native-feather';
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import MyAvatar from '../../../components/MyAvatar'
import MyButton from '../../../components/MyButton'

import Fontisto from '@expo/vector-icons/Fontisto';
import MyCategory from '../../../components/MyCategory'
import { fetchProduct } from '../../../services/productService'
import { fetchCate } from '../../../services/cateServiec'

const index = () => {
    const { user } = useAuth()
    const router = useRouter();
    const [searchText, setSearchText] = useState('');

    const [products, setProducts] = useState([]);
    const [cates, setCates] = useState([]);

    const getProduct = useCallback(async () => {
        const res = await fetchProduct();
        if (res.success) {
            setProducts(res.data);
        }
    }, []);

    const getCate = useCallback(async () => {
        const res = await fetchCate();
        if (res.success) {
            setCates(res.data);
        }
    }, []);

    useEffect(() => {
        getProduct();
        getCate();
    }, []);

    //products based on search
    const filteredProducts = useMemo(() => {
        if (!searchText.trim()) {
            return products;
        }
        
        const searchLower = searchText.toLowerCase().trim();
        return products.filter(product => 
            product.name?.toLowerCase().includes(searchLower) ||
            product.description?.toLowerCase().includes(searchLower)
        );
    }, [products, searchText]);

    //categories matching products
    const filteredCatesWithProducts = useMemo(() => {
        if (!searchText.trim()) {
            return cates.map(cate => ({
                ...cate,
                products: products.filter(p => p.cateId === cate.id)
            }));
        }

        return cates.map(cate => ({
            ...cate,
            products: filteredProducts.filter(p => p.cateId === cate.id)
        })).filter(cate => cate.products.length > 0); // Chỉ hiển thị category có sản phẩm
    }, [cates, products, filteredProducts, searchText]);

    //Search results count
    const searchResultsCount = useMemo(() => {
        return searchText.trim() ? filteredProducts.length : 0;
    }, [filteredProducts, searchText]);

    const handlePressItem = (item) => {
        console.log('Selected item:', item);
        router.push({
            pathname: '../main/productDetailScr',
            params: { productId: item.id }
        });
    }

    //Clear search function
    const clearSearch = () => {
        setSearchText('');
    };

    return (
        <ScreenWrapper bg={'#FFBF00'}>
            <View style={styles.container}>
                {/* header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Bún chả Obama</Text>
                    <View style={styles.icons}>
                        <Pressable onPress={() => router.push('/main/profileScr')}>
                            <MyAvatar uri={user?.image} />
                        </Pressable>
                    </View>
                </View>

                {/* search */}
                <View style={styles.searchContainer}>
                    <Icon.Search stroke={theme.colors.dark} strokeWidth={2} width={20} height={20} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Tìm kiếm món ăn..."
                        placeholderTextColor={theme.colors.textLight}
                        value={searchText}
                        onChangeText={setSearchText}
                        returnKeyType="search"
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                    {/* Clear search */}
                    {searchText.length > 0 && (
                        <Pressable onPress={clearSearch} style={styles.clearButton}>
                            <Icon.X stroke={theme.colors.textLight} strokeWidth={2} width={16} height={16} />
                        </Pressable>
                    )}
                </View>

                {/* Search results */}
                {searchText.trim() && (
                    <View style={styles.searchResultsContainer}>
                        <Text style={styles.searchResultsText}>
                            {searchResultsCount > 0 
                                ? `Tìm thấy ${searchResultsCount} món ăn cho "${searchText}"`
                                : `Không tìm thấy món ăn nào cho "${searchText}"`
                            }
                        </Text>
                        {searchResultsCount === 0 && (
                            <Text style={styles.searchSuggestionText}>
                                Hãy thử tìm kiếm với từ khóa khác
                            </Text>
                        )}
                    </View>
                )}

                {/* button */}
                <View style={styles.buttonContainer}>
                    <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 15 }}>
                        <MyButton
                            onPress={() => router.push('/main/assignTableScr')}
                            buttonStyle={{ width: wp(20), height: wp(20) }}
                            icon={<MaterialIcons name="dinner-dining" size={40} color="black" />}
                        />
                        <Text style={{ color: 'white', padding: 2, fontSize: 18, fontWeight: 'bold' }}>Đặt bàn</Text>
                    </View>

                    <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 15 }}>
                        <MyButton
                            onPress={() => router.push('../main/locationScr')}
                            buttonStyle={{ width: wp(20), height: wp(20) }}
                            icon={<Fontisto name="map" size={40} color="black" />}
                        />
                        <Text style={{ color: 'white', padding: 2, fontSize: 18, fontWeight: 'bold' }}>Vị trí</Text>
                    </View>
                </View>

                {/* content */}
                <View style={styles.content}>
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ flexGrow: 1 }}
                    >
                        {/*Hide cover image when searching */}
                        {!searchText.trim() && (
                            <View style={styles.cover}>
                                <Image
                                    source={require('../../../assets/images/coverImg2.jpg')}
                                    resizeMode='cover'
                                    style={styles.image}
                                />
                            </View>
                        )}

                        {/*Hide voucher when searching */}
                        {!searchText.trim() && (
                            <>
                                <Text style={{ fontSize: 24, color: 'black', fontWeight: 'bold', paddingLeft: 10, }}>
                                    Ưu đãi đặc biệt:
                                </Text>
                                <View style={{ flexDirection: 'row' }}>
                                    <View style={styles.voucherContainer}>
                                        <Image
                                            source={require('../../../assets/images/fire.png')}
                                            style={{ width: wp(20), height: wp(20), borderRadius: 10 }}
                                        />
                                        <Text style={styles.textVoucher}>20%</Text>
                                        <Text style={{ color: 'white' }}>Ưu đãi giờ vàng</Text>
                                    </View>
                                    <View style={styles.voucherContainer}>
                                        <Image
                                            source={require('../../../assets/images/price-tag.png')}
                                            style={{ width: wp(20), height: wp(20), borderRadius: 10 }}
                                        />
                                        <Text style={styles.textVoucher}>8%</Text>
                                        <Text style={{ color: 'white' }}>Ưu đãi dành cho thành viên</Text>
                                    </View>
                                </View>
                            </>
                        )}

                        {/*Categories with filtered products */}
                        {filteredCatesWithProducts.map(cate => (
                            <View key={cate.id} style={{ marginTop: 20 }}>
                                <MyCategory
                                    title={`${cate.name} ${searchText.trim() ? `(${cate.products.length})` : ''}`}
                                    data={cate.products}
                                    onPressItem={handlePressItem}
                                />
                            </View>
                        ))}

                        {/*No results message */}
                        {searchText.trim() && filteredCatesWithProducts.length === 0 && (
                            <View style={styles.noResultsContainer}>
                                <Icon.Search stroke={theme.colors.textLight} strokeWidth={1} width={hp(8)} height={hp(8)} />
                                <Text style={styles.noResultsTitle}>Không tìm thấy món ăn</Text>
                                <Text style={styles.noResultsSubtitle}>
                                    Không có món ăn nào phù hợp với từ khóa "{searchText}"
                                </Text>
                                <Pressable onPress={clearSearch} style={styles.clearSearchButton}>
                                    <Text style={styles.clearSearchButtonText}>Xóa tìm kiếm</Text>
                                </Pressable>
                            </View>
                        )}
                    </ScrollView>
                </View>
            </View>
        </ScreenWrapper>
    )
}

export default index

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    cover: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
        marginHorizontal: wp(4)
    },
    title: {
        fontSize: hp(3.5),
        fontWeight: 'bold',
        color: theme.colors.text
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        width: wp(90),
        height: 50,
        paddingHorizontal: 20,
        borderRadius: 10,
        marginBottom: 10,
        alignSelf: 'center',
    },
    searchInput: {
        flex: 1,
        marginLeft: 10,
        fontSize: 16,
        color: theme.colors.dark,
    },
    clearButton: {
        padding: 5,
        marginLeft: 5,
    },
    searchResultsContainer: {
        paddingHorizontal: wp(4),
        paddingVertical: hp(1),
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        marginHorizontal: wp(2),
        borderRadius: 8,
        marginBottom: 10,
    },
    searchResultsText: {
        fontSize: hp(2),
        color: theme.colors.dark,
        fontWeight: '600',
        textAlign: 'center',
    },
    searchSuggestionText: {
        fontSize: hp(1.6),
        color: theme.colors.textLight,
        textAlign: 'center',
        marginTop: hp(0.5),
        fontStyle: 'italic',
    },
    noResultsContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: hp(8),
        paddingHorizontal: wp(8),
    },
    noResultsTitle: {
        fontSize: hp(2.5),
        fontWeight: 'bold',
        color: theme.colors.dark,
        marginTop: hp(2),
        textAlign: 'center',
    },
    noResultsSubtitle: {
        fontSize: hp(1.8),
        color: theme.colors.textLight,
        textAlign: 'center',
        marginTop: hp(1),
        lineHeight: hp(2.5),
    },
    clearSearchButton: {
        backgroundColor: theme.colors.primary,
        paddingHorizontal: wp(6),
        paddingVertical: hp(1.2),
        borderRadius: 8,
        marginTop: hp(2),
    },
    clearSearchButtonText: {
        color: 'white',
        fontSize: hp(1.8),
        fontWeight: '600',
    },
    content: {
        flex: 1,
        backgroundColor: '#fff7bf',
        marginTop: 10,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingTop: 20,
        marginHorizontal: wp(2),
    },
    buttonContainer: {
        flexDirection: 'row',
        marginVertical: wp(2),
        marginHorizontal: wp(4),
        height: hp(10),
        alignItems: 'flex-start',
        gap: 15,
    },
    image: {
        width: wp(92),
        height: hp(25),
        borderRadius: 20,
    },
    voucherContainer: {
        backgroundColor: '#FFBF00',
        padding: 10,
        width: wp(45),
        height: wp(45),
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 10,
    },
    textVoucher: {
        fontSize: 40,
        color: 'white',
        fontWeight: 'bold',
    },
})
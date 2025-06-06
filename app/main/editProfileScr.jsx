import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import ScreenWrapper from '../../components/ScreenWrapper';
import { hp, wp } from '../../helper/common';
import { theme } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { getUserImageSrc, uploadFile } from '../../services/imageService';
import * as Icon from 'react-native-feather';
import MyInput from '../../components/MyInput';
import MyButton from '../../components/MyButton';
import { updateUser } from '../../services/userService';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import MyHeader from '../../components/MyHeader';

// ===================
// CONSTANTS
// ===================
const FORM_FIELDS = {
    NAME: 'name',
    PHONE: 'phone',
    IMAGE: 'image',
    BIO: 'bio',
    ADDRESS: 'address'
};

const VALIDATION_RULES = {
    [FORM_FIELDS.NAME]: {
        required: true,
        minLength: 2,
        maxLength: 50,
        message: 'Tên phải từ 2-50 ký tự'
    },
    [FORM_FIELDS.PHONE]: {
        required: true,
        pattern: /^[0-9]{10,11}$/,
        message: 'Số điện thoại phải có 10-11 chữ số'
    },
    [FORM_FIELDS.ADDRESS]: {
        required: true,
        minLength: 5,
        maxLength: 200,
        message: 'Địa chỉ phải từ 5-200 ký tự'
    },
    [FORM_FIELDS.BIO]: {
        required: true,
        minLength: 10,
        maxLength: 500,
        message: 'Mô tả phải từ 10-500 ký tự'
    },
    [FORM_FIELDS.IMAGE]: {
        required: true,
        message: 'Vui lòng chọn ảnh đại diện'
    }
};

const IMAGE_PICKER_OPTIONS = {
    mediaTypes: 'images',
    allowsEditing: false,
    aspect: [1, 1],
    quality: 0.8,
    allowsMultipleSelection: false
};

// ===================
// VALIDATION HELPERS
// ===================
const validateField = (field, value) => {
    const rule = VALIDATION_RULES[field];
    if (!rule) return null;

    // Required check
    if (rule.required && (!value || value.toString().trim().length === 0)) {
        return `${getFieldDisplayName(field)} là bắt buộc`;
    }

    if (!value) return null;

    const stringValue = value.toString().trim();

    // Length validation
    if (rule.minLength && stringValue.length < rule.minLength) {
        return rule.message;
    }
    if (rule.maxLength && stringValue.length > rule.maxLength) {
        return rule.message;
    }

    // Pattern validation
    if (rule.pattern && !rule.pattern.test(stringValue.replace(/\s/g, ''))) {
        return rule.message;
    }

    return null;
};

const validateForm = (formData) => {
    const errors = {};
    
    Object.keys(FORM_FIELDS).forEach(key => {
        const field = FORM_FIELDS[key];
        const error = validateField(field, formData[field]);
        if (error) {
            errors[field] = error;
        }
    });

    return {
        isValid: Object.keys(errors).length === 0,
        errors,
        firstError: Object.values(errors)[0]
    };
};

const getFieldDisplayName = (field) => {
    const names = {
        [FORM_FIELDS.NAME]: 'Tên',
        [FORM_FIELDS.PHONE]: 'Số điện thoại',
        [FORM_FIELDS.ADDRESS]: 'Địa chỉ',
        [FORM_FIELDS.BIO]: 'Mô tả',
        [FORM_FIELDS.IMAGE]: 'Ảnh đại diện'
    };
    return names[field] || field;
};

// ===================
// CUSTOM HOOKS
// ===================
const useFormState = (initialUser) => {
    const [user, setUser] = useState({
        name: '',
        phone: '',
        image: '',
        bio: '',
        address: ''
    });

    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        if (initialUser) {
            const newUser = {
                name: initialUser.name || '',
                phone: initialUser.phone || '',
                image: initialUser.image || '',
                bio: initialUser.bio || '',
                address: initialUser.address || ''
            };
            setUser(newUser);
            setHasChanges(false);
        }
    }, [initialUser]);

    const updateField = useCallback((field, value) => {
        setUser(prevUser => ({
            ...prevUser,
            [field]: value
        }));
        setHasChanges(true);
    }, []);

    const resetForm = useCallback(() => {
        if (initialUser) {
            setUser({
                name: initialUser.name || '',
                phone: initialUser.phone || '',
                image: initialUser.image || '',
                bio: initialUser.bio || '',
                address: initialUser.address || ''
            });
            setHasChanges(false);
        }
    }, [initialUser]);

    return {
        user,
        hasChanges,
        updateField,
        resetForm
    };
};

const useImageHandler = (currentImage, onImageChange) => {
    const [isImageLoading, setIsImageLoading] = useState(false);

    const handleImagePick = useCallback(async () => {
        try {
            // Request permissions
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert(
                    'Quyền truy cập',
                    'Cần quyền truy cập thư viện ảnh để chọn ảnh đại diện'
                );
                return;
            }

            setIsImageLoading(true);

            const result = await ImagePicker.launchImageLibraryAsync(IMAGE_PICKER_OPTIONS);

            if (!result.canceled && result.assets?.[0]) {
                const selectedImage = result.assets[0];
                
                // Validate image size (max 5MB)
                if (selectedImage.fileSize && selectedImage.fileSize > 5 * 1024 * 1024) {
                    Alert.alert('Lỗi', 'Kích thước ảnh không được vượt quá 5MB');
                    return;
                }

                console.log('✅ Image selected:', {
                    uri: selectedImage.uri,
                    width: selectedImage.width,
                    height: selectedImage.height,
                    size: selectedImage.fileSize
                });

                onImageChange(selectedImage.uri);
            }
        } catch (error) {
            console.error('❌ Error picking image:', error);
            Alert.alert('Lỗi', 'Không thể chọn ảnh, vui lòng thử lại');
        } finally {
            setIsImageLoading(false);
        }
    }, [onImageChange]);

    const imageSource = useMemo(() => {
        if (!currentImage) {
            // return require('../../assets/images/defaultUser.png');
            return { uri: 'https://www.lewesac.co.uk/wp-content/uploads/2017/12/default-avatar.jpg' }; 
        }

        // Local image (newly selected)
        if (currentImage.startsWith('file://') || currentImage.startsWith('content://')) {
            return { uri: currentImage };
        }

        // Remote image (from server)
        return getUserImageSrc(currentImage);
    }, [currentImage]);

    return {
        imageSource,
        isImageLoading,
        handleImagePick
    };
};

// ===================
// MAIN COMPONENT
// ===================
const EditProfileScreen = () => {
    const router = useRouter();
    const { user: currentUser, setUserData } = useAuth();
    const [loading, setLoading] = useState(false);

    // Custom hooks
    const { user, hasChanges, updateField, resetForm } = useFormState(currentUser);
    const { imageSource, isImageLoading, handleImagePick } = useImageHandler(
        user.image, 
        useCallback((newImage) => updateField(FORM_FIELDS.IMAGE, newImage), [updateField])
    );

    // ===================
    // HANDLERS
    // ===================
    const handleSubmit = useCallback(async () => {
        if (loading) return;

        try {
            // Validate form
            const validation = validateForm(user);
            if (!validation.isValid) {
                Alert.alert('Thông báo!', validation.firstError);
                return;
            }

            setLoading(true);
            let userData = { ...user };

            // Clean data
            userData = {
                name: userData.name.trim(),
                phone: userData.phone.trim().replace(/\s/g, ''),
                bio: userData.bio.trim(),
                address: userData.address.trim(),
                image: userData.image
            };

            // Upload image if changed
            if (userData.image && userData.image !== currentUser?.image) {
                console.log('🖼️ Uploading new image...');
                
                try {
                    const imageRes = await uploadFile('profiles', userData.image, true);
                    if (imageRes.success) {
                        userData.image = imageRes.data;
                        console.log('✅ Image uploaded successfully');
                    } else {
                        throw new Error(imageRes.msg || 'Upload failed');
                    }
                } catch (imageError) {
                    console.error('❌ Image upload error:', imageError);
                    Alert.alert('Lỗi!', 'Không thể tải ảnh lên. Vui lòng thử lại.');
                    return;
                }
            }

            // Update user data
            console.log('📝 Updating user data...');
            const res = await updateUser(currentUser?.id, userData);

            if (res.success) {
                console.log('✅ Profile updated successfully');
                Alert.alert(
                    'Thành công!', 
                    'Cập nhật thông tin thành công',
                    [
                        {
                            text: 'OK',
                            onPress: () => {
                                setUserData({ ...currentUser, ...userData });
                                router.back();
                            }
                        }
                    ]
                );
            } else {
                console.error('❌ Update failed:', res.msg);
                Alert.alert('Lỗi!', res.msg || 'Có lỗi xảy ra, vui lòng thử lại');
            }

        } catch (error) {
            console.error('❌ Submit error:', error);
            
            let errorMessage = 'Có lỗi không xác định xảy ra';
            if (error?.message) {
                errorMessage = error.message;
            } else if (typeof error === 'string') {
                errorMessage = error;
            }

            Alert.alert('Lỗi nghiêm trọng!', errorMessage);
        } finally {
            setLoading(false);
        }
    }, [user, currentUser, setUserData, router, loading]);

    const handleBackPress = useCallback(() => {
        if (hasChanges) {
            Alert.alert(
                'Xác nhận',
                'Bạn có thay đổi chưa lưu. Bạn có muốn thoát không?',
                [
                    { text: 'Hủy', style: 'cancel' },
                    { text: 'Thoát', style: 'destructive', onPress: () => router.back() }
                ]
            );
        } else {
            router.back();
        }
    }, [hasChanges, router]);

    // ===================
    // FIELD HANDLERS
    // ===================
    const handleNameChange = useCallback((value) => {
        updateField(FORM_FIELDS.NAME, value);
    }, [updateField]);

    const handlePhoneChange = useCallback((value) => {
        // Auto format phone number
        const formatted = value.replace(/[^0-9]/g, '');
        updateField(FORM_FIELDS.PHONE, formatted);
    }, [updateField]);

    const handleAddressChange = useCallback((value) => {
        updateField(FORM_FIELDS.ADDRESS, value);
    }, [updateField]);

    const handleBioChange = useCallback((value) => {
        updateField(FORM_FIELDS.BIO, value);
    }, [updateField]);

    // ===================
    // RENDER HELPERS
    // ===================
    const renderFormField = useCallback((config) => (
        <MyInput
            key={config.field}
            icon={config.icon}
            placeholder={config.placeholder}
            value={user[config.field]}
            onChangeText={config.onChangeText}
            multiline={config.multiline}
            containerStyle={config.containerStyle}
            keyboardType={config.keyboardType}
            maxLength={config.maxLength}
            autoCapitalize={config.autoCapitalize}
            returnKeyType={config.returnKeyType}
        />
    ), [user]);

    // ===================
    // FORM CONFIGURATION
    // ===================
    const formFields = useMemo(() => [
        {
            field: FORM_FIELDS.NAME,
            icon: <Icon.User stroke={theme.colors.dark} />,
            placeholder: 'Nhập tên của bạn',
            onChangeText: handleNameChange,
            maxLength: 50,
            autoCapitalize: 'words',
            returnKeyType: 'next'
        },
        {
            field: FORM_FIELDS.PHONE,
            icon: <Icon.PhoneCall stroke={theme.colors.dark} />,
            placeholder: 'Nhập số điện thoại',
            onChangeText: handlePhoneChange,
            keyboardType: 'phone-pad',
            maxLength: 11,
            returnKeyType: 'next'
        },
        {
            field: FORM_FIELDS.ADDRESS,
            icon: <Icon.Home stroke={theme.colors.dark} />,
            placeholder: 'Nhập địa chỉ của bạn',
            onChangeText: handleAddressChange,
            maxLength: 200,
            autoCapitalize: 'words',
            returnKeyType: 'next'
        },
        {
            field: FORM_FIELDS.BIO,
            placeholder: 'Mô tả một chút về bạn',
            onChangeText: handleBioChange,
            multiline: true,
            containerStyle: styles.bio,
            maxLength: 500,
            autoCapitalize: 'sentences',
            returnKeyType: 'done'
        }
    ], [handleNameChange, handlePhoneChange, handleAddressChange, handleBioChange]);

    // ===================
    // RENDER
    // ===================
    return (
        <ScreenWrapper bg={'#FFBF00'}>
            <View style={styles.container}>
                <ScrollView 
                    style={styles.scrollView}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <MyHeader 
                        title="Chỉnh sửa thông tin" 
                        showBackButton={true}
                        onBackPress={handleBackPress}
                    />

                    {/* Form */}
                    <View style={styles.form}>
                        {/* Avatar Section */}
                        <View style={styles.avatarContainer}>
                            <Image 
                                source={imageSource} 
                                style={styles.avatar} 
                                resizeMode="cover" 
                            />
                            <Pressable 
                                style={[
                                    styles.cameraIcon,
                                    isImageLoading && styles.cameraIconLoading
                                ]} 
                                onPress={handleImagePick}
                                disabled={isImageLoading || loading}
                            >
                                {isImageLoading ? (
                                    <Icon.Loader 
                                        strokeWidth={3} 
                                        height={20} 
                                        width={20} 
                                        color={theme.colors.primary} 
                                    />
                                ) : (
                                    <Icon.Camera 
                                        strokeWidth={3} 
                                        height={20} 
                                        width={20} 
                                        color={'black'} 
                                    />
                                )}
                            </Pressable>
                        </View>

                        {/* Form Title */}
                        <Text style={styles.formTitle}>
                            Vui lòng điền thông tin của bạn!
                        </Text>

                        {/* Form Fields */}
                        {formFields.map(renderFormField)}

                        {/* Character Count for Bio */}
                        <Text style={styles.characterCount}>
                            {user.bio.length}/500 ký tự
                        </Text>

                        {/* Submit Button */}
                        <MyButton 
                            title={hasChanges ? 'Cập nhật' : 'Không có thay đổi'} 
                            loading={loading}
                            onPress={handleSubmit}
                            disabled={!hasChanges}
                            buttonStyle={!hasChanges && styles.disabledButton}
                        />

                        {/* Reset Button */}
                        {hasChanges && (
                            <Pressable 
                                style={styles.resetButton} 
                                onPress={resetForm}
                                disabled={loading}
                            >
                                <Text style={styles.resetButtonText}>
                                    Hoàn tác thay đổi
                                </Text>
                            </Pressable>
                        )}
                    </View>
                </ScrollView>
            </View>
        </ScreenWrapper>
    );
};

export default EditProfileScreen;

// ===================
// STYLES
// ===================
const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: wp(4)
    },
    scrollView: {
        flex: 1
    },
    form: {
        gap: 18,
        marginTop: 20,
        paddingBottom: 30
    },
    avatarContainer: {
        height: hp(20),
        width: hp(20),
        alignSelf: 'center',
        marginBottom: 10
    },
    avatar: {
        width: '100%',
        height: '100%',
        borderRadius: hp(10),
        borderWidth: 3,
        borderColor: 'white',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8
    },
    cameraIcon: {
        position: 'absolute',
        bottom: hp(1),
        right: hp(1),
        padding: 10,
        borderRadius: 25,
        backgroundColor: 'white',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
        borderWidth: 2,
        borderColor: theme.colors.primary
    },
    cameraIconLoading: {
        backgroundColor: '#f0f0f0'
    },
    formTitle: {
        fontSize: hp(2.5),
        color: theme.colors.text,
        textAlign: 'center',
        fontWeight: '600',
        marginBottom: 10
    },
    bio: {
        flexDirection: 'row',
        height: hp(12),
        alignItems: 'flex-start',
        paddingVertical: 15,
        textAlignVertical: 'top'
    },
    characterCount: {
        fontSize: 12,
        color: theme.colors.textLight,
        textAlign: 'right',
        marginTop: -10,
        marginBottom: 5
    },
    disabledButton: {
        backgroundColor: theme.colors.textLight,
        opacity: 0.6
    },
    resetButton: {
        padding: 12,
        alignItems: 'center',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.colors.primary,
        backgroundColor: 'transparent'
    },
    resetButtonText: {
        color: theme.colors.primary,
        fontSize: 16,
        fontWeight: '600'
    }
});
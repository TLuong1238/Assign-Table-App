import { Alert, StyleSheet, Text, View, KeyboardAvoidingView, Platform } from 'react-native'
import React, { useRef, useState } from 'react'
import * as Icon from 'react-native-feather'
import { theme } from '../constants/theme'
import ScreenWrapper from '../components/ScreenWrapper'
import BackButton from '../components/MyBackButton'
import { hp, wp } from '../helper/common'
import MyInput from '../components/MyInput'
import MyButton from '../components/MyButton'
import { supabase } from '../lib/supabase'
import { useRouter, useLocalSearchParams } from 'expo-router'

const ChangePasswordScr = () => {
  const router = useRouter();
  const { email, fromProfile } = useLocalSearchParams(); // ✅ Nhận flag fromProfile
  const newPasswordRef = useRef(null);
  const confirmPasswordRef = useRef(null);
  const [loading, setLoading] = useState(false);

  const updatePassword = async () => {
    if (!newPasswordRef.current || !confirmPasswordRef.current) {
      Alert.alert('Thông báo', 'Vui lòng nhập đầy đủ thông tin!');
      return;
    }

    const newPassword = newPasswordRef.current.trim();
    const confirmPassword = confirmPasswordRef.current.trim();

    if (newPassword !== confirmPassword) {
      Alert.alert('Thông báo', 'Mật khẩu xác nhận không khớp!');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Thông báo', 'Mật khẩu phải có ít nhất 6 ký tự!');
      return;
    }

    setLoading(true);
    try {
      // ✅ Update password
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        Alert.alert('Lỗi', 'Không thể cập nhật mật khẩu: ' + error.message);
        setLoading(false);
        return;
      }

      // ✅ Success - handle different flows
      if (fromProfile === 'true') {
        // ✅ Từ profile - về profile screen
        Alert.alert(
          'Thành công!',
          'Mật khẩu đã được cập nhật thành công!',
          [
            {
              text: 'OK',
              onPress: () => router.back() // ✅ Quay về profile
            }
          ]
        );
      } else {
        // ✅ Từ forgot password - sign out và về login
        await supabase.auth.signOut();
        Alert.alert(
          'Thành công!',
          'Mật khẩu đã được cập nhật thành công!',
          [
            {
              text: 'Đăng nhập ngay',
              onPress: () => router.replace('/loginScr')
            }
          ]
        );
      }

    } catch (error) {
      console.error('Update password error:', error);
      Alert.alert('Lỗi', 'Có lỗi xảy ra. Vui lòng thử lại!');
    }
    setLoading(false);
  };

  return (
    <ScreenWrapper bg='#FFBF00'>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <BackButton />
        
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Icon.Lock width={50} height={50} color={theme.colors.primary} />
            </View>
            <Text style={styles.title}>
              {fromProfile === 'true' ? 'Đổi mật khẩu' : 'Tạo mật khẩu mới'}
            </Text>
            <Text style={styles.subtitle}>
              {fromProfile === 'true' 
                ? 'Cập nhật mật khẩu cho tài khoản' 
                : 'Tạo mật khẩu mới cho tài khoản'
              }
            </Text>
            <Text style={styles.email}>{email}</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.formTitle}>
              Vui lòng nhập mật khẩu mới và xác nhận!
            </Text>

            <MyInput
              icon={<Icon.Lock stroke={theme.colors.dark} strokeWidth={2} width={26} height={26} />}
              placeholder='Nhập mật khẩu mới...'
              secureTextEntry
              onChangeText={value => newPasswordRef.current = value}
              autoFocus
            />

            <MyInput
              icon={<Icon.Lock stroke={theme.colors.dark} strokeWidth={2} width={26} height={26} />}
              placeholder='Xác nhận mật khẩu mới...'
              secureTextEntry
              onChangeText={value => confirmPasswordRef.current = value}
            />

            <MyButton
              title={fromProfile === 'true' ? 'Đổi mật khẩu' : 'Cập nhật mật khẩu'}
              loading={loading}
              onPress={updatePassword}
              buttonStyle={styles.actionButton}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
};

export default ChangePasswordScr;

// ✅ Styles remain the same...
const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: wp(2),
    paddingTop: wp(2),
  },
  content: {
    flex: 1,
    gap: hp(3),
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: hp(3),
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp(2),
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
  },
  title: {
    fontSize: hp(2.8),
    fontWeight: 'bold',
    color: theme.colors.dark,
    textAlign: 'center',
    marginBottom: hp(1),
  },
  subtitle: {
    fontSize: hp(1.6),
    color: theme.colors.textLight,
    textAlign: 'center',
  },
  email: {
    fontSize: hp(1.8),
    fontWeight: '600',
    color: theme.colors.primary,
    textAlign: 'center',
    marginTop: hp(0.5),
  },
  form: {
    gap: 20,
  },
  formTitle: {
    fontSize: hp(2.2),
    fontWeight: '500',
    color: 'white',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
    padding: hp(1.5),
    borderRadius: wp(3),
  },
  actionButton: {
    width: wp(80),
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: hp(2),
  },
});
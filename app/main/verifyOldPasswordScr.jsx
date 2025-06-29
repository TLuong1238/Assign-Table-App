import { Alert, StyleSheet, Text, View, KeyboardAvoidingView, Platform } from 'react-native'
import React, { useRef, useState } from 'react'
import * as Icon from 'react-native-feather'
import { theme } from '../../constants/theme'
import ScreenWrapper from '../../components/ScreenWrapper'
import BackButton from '../../components/MyBackButton'
import { hp, wp } from '../../helper/common'
import MyInput from '../../components/MyInput'
import MyButton from '../../components/MyButton'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'expo-router'
import { useAuth } from '../../context/AuthContext'

const VerifyOldPasswordScr = () => {
  const router = useRouter();
  const { user } = useAuth();
  const oldPasswordRef = useRef(null);
  const [loading, setLoading] = useState(false);

  const verifyOldPassword = async () => {
    if (!oldPasswordRef.current) {
      Alert.alert('Thông báo', 'Vui lòng nhập mật khẩu hiện tại!');
      return;
    }

    const oldPassword = oldPasswordRef.current.trim();

    if (oldPassword.length < 6) {
      Alert.alert('Thông báo', 'Mật khẩu phải có ít nhất 6 ký tự!');
      return;
    }

    setLoading(true);
    try {
      // verify old password with Supabase
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: oldPassword,
      });

      if (error) {
        Alert.alert('Lỗi', 'Mật khẩu hiện tại không đúng!');
        setLoading(false);
        return;
      }

      // changePasswordScr
      Alert.alert(
        'Xác thực thành công!',
        'Mật khẩu đúng. Chuyển sang tạo mật khẩu mới.',
        [
          {
            text: 'OK',
            onPress: () => {
              router.push({
                pathname: '/changePasswordScr',
                params: { 
                  email: user.email,
                  fromProfile: 'true' // 
                }
              });
            }
          }
        ]
      );

    } catch (error) {
      console.error('Verify password error:', error);
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
              <Icon.Shield width={50} height={50} color={theme.colors.primary} />
            </View>
            <Text style={styles.title}>Xác thực bảo mật</Text>
            <Text style={styles.subtitle}>Nhập mật khẩu hiện tại để tiếp tục</Text>
            <Text style={styles.email}>{user?.email}</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.formTitle}>
              Để bảo mật tài khoản, vui lòng nhập mật khẩu hiện tại!
            </Text>

            <MyInput
              icon={<Icon.Lock stroke={theme.colors.dark} strokeWidth={2} width={26} height={26} />}
              placeholder='Nhập mật khẩu hiện tại...'
              secureTextEntry
              onChangeText={value => oldPasswordRef.current = value}
              autoFocus
            />

            <MyButton
              title='Xác thực'
              loading={loading}
              onPress={verifyOldPassword}
              buttonStyle={styles.actionButton}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
};

export default VerifyOldPasswordScr;

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
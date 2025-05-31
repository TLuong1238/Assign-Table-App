import { Alert, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native'
import React, { useEffect, useRef, useState } from 'react'
import * as Icon from 'react-native-feather'
import { theme } from '../constants/theme'
import ScreenWrapper from '../components/ScreenWrapper'
import BackButton from '../components/MyBackButton'
import { hp, wp } from '../helper/common'
import MyInput from '../components/MyInput'
import MyButton from '../components/MyButton'
import { useNavigation } from '@react-navigation/native'
import { supabase } from '../lib/supabase'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { TouchableOpacity } from 'react-native'

const SignUpScr = () => {
  const router = useRouter();
  const { verified } = useLocalSearchParams(); 
  const nameRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmPasswordRef = useRef(null);
  const [loading, setLoading] = useState(false);

  // check verified 
  useEffect(() => {
    if (verified === 'true') {
      Alert.alert(
        'Thành công!',
        'Email đã được xác nhận. Tài khoản đã được tạo thành công!',
        [
          {
            text: 'Đăng nhập ngay',
            onPress: () => router.replace('/loginScr')
          }
        ]
      );
    }
  }, [verified]);

  // email format
  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const onSubmit = async () => {
    // Validate
    if (!emailRef.current || !passwordRef.current || !nameRef.current || !confirmPasswordRef.current) {
      Alert.alert('Thông báo', 'Vui lòng nhập đầy đủ thông tin!');
      return;
    }

    let name = nameRef.current.trim();
    let email = emailRef.current.trim();
    let password = passwordRef.current.trim();
    let confirmPassword = confirmPasswordRef.current.trim();

    if (!isValidEmail(email)) {
      Alert.alert('Thông báo', 'Email không hợp lệ!');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Thông báo', 'Mật khẩu xác nhận không khớp!');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Thông báo', 'Mật khẩu phải có ít nhất 6 ký tự!');
      return;
    }

    setLoading(true);

    try {

      // send email
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            name: name,
            email: email
          }
        }
      });

      // console.log('SignUp response:', { signUpData, signUpError });

      if (signUpError) {
        if (signUpError.message.includes('already registered') ||
          signUpError.message.includes('User already registered')) {

          Alert.alert(
            'Email đã tồn tại',
            'Email này đã được đăng ký. Bạn có muốn gửi lại mã xác nhận?',
            [
              { text: 'Hủy', style: 'cancel' },
              {
                text: 'Gửi lại',
                onPress: async () => {
                  const { error: resendError } = await supabase.auth.resend({
                    type: 'signup',
                    email: email
                  });

                  if (resendError) {
                    Alert.alert('Lỗi', resendError.message);
                  } else {
                    router.push({
                      pathname: '/emailScr',
                      params: {
                        email: email,
                        type: 'signup'
                      }
                    });
                  }
                }
              }
            ]
          );
        } else {
          Alert.alert('Lỗi đăng ký', signUpError.message);
        }
      } else {
        //send otp
        Alert.alert(
          'Đăng ký thành công!',
          'Mã xác nhận đã được gửi đến email của bạn. Vui lòng kiểm tra hộp thư.',
          [
            {
              text: 'OK',
              onPress: () => {
                router.push({
                  pathname: '/emailScr',
                  params: {
                    email: email,
                    type: 'signup'
                  }
                });
              }
            }
          ]
        );
      }
    } catch (error) {
      Alert.alert('Lỗi', 'Có lỗi xảy ra khi đăng ký. Vui lòng thử lại!');
      console.error('Sign up error:', error);
    }

    setLoading(false);
  }

  return (
    <ScreenWrapper bg='#FFBF00'>
      <View style={styles.container}>
        <BackButton />

        {/* Welcome text */}
        <View>
          <Text style={styles.welcomText}>Xin chào</Text>
          <Text style={styles.welcomText}>Hãy bắt đầu!</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.formTitle}>
            Vui lòng điền thông tin chi tiết để tạo tài khoản!
          </Text>

          <MyInput
            icon={<Icon.User stroke={theme.colors.dark} strokeWidth={2} width={26} height={26} />}
            placeholder='Nhập họ và tên của bạn...'
            onChangeText={value => nameRef.current = value}
          />

          <MyInput
            icon={<Icon.Mail stroke={theme.colors.dark} strokeWidth={2} width={26} height={26} />}
            placeholder='Nhập email của bạn...'
            keyboardType="email-address"
            autoCapitalize="none"
            onChangeText={value => emailRef.current = value}
          />

          <MyInput
            icon={<Icon.Lock stroke={theme.colors.dark} strokeWidth={2} width={26} height={26} />}
            placeholder='Nhập mật khẩu của bạn...'
            secureTextEntry
            onChangeText={value => passwordRef.current = value}
          />

          <MyInput
            icon={<Icon.Lock stroke={theme.colors.dark} strokeWidth={2} width={26} height={26} />}
            placeholder='Xác nhận mật khẩu...'
            secureTextEntry
            onChangeText={value => confirmPasswordRef.current = value}
          />

          <MyButton
            title='Đăng ký'
            loading={loading}
            onPress={onSubmit}
            buttonStyle={styles.signUpButton}
          />

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Đã có tài khoản?</Text>
            <Pressable onPress={() => router.push('/loginScr')}>
              <Text style={styles.loginLink}>
                Đăng nhập!
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </ScreenWrapper>
  )
}

export default SignUpScr

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 45,
    paddingHorizontal: wp(2),
    paddingTop: wp(2),
  },
  welcomText: {
    fontSize: hp(4),
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: wp(2),
  },
  form: {
    gap: 20,
  },
  formTitle: {
    fontSize: hp(2.5),
    fontWeight: '500',
    color: 'white',
  },
  signUpButton: {
    width: wp(70),
    alignItems: 'center',
    alignSelf: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
  },
  footerText: {
    fontSize: hp(2.5),
    fontWeight: '500',
    color: theme.colors.text,
  },
  loginLink: {
    color: theme.colors.primary,
    fontSize: hp(2.5),
    fontWeight: '500',
  },
})
import { Alert, Pressable, StyleSheet, Text, View, TextInput, KeyboardAvoidingView, Platform } from 'react-native'
import React, { useRef, useState, useEffect } from 'react'
import * as Icon from 'react-native-feather'
import { theme } from '../constants/theme'
import ScreenWrapper from '../components/ScreenWrapper'
import BackButton from '../components/MyBackButton'
import { hp, wp } from '../helper/common'
import MyInput from '../components/MyInput'
import MyButton from '../components/MyButton'
import { supabase } from '../lib/supabase'
import { useRouter } from 'expo-router'

const ForgotPassScr = () => {
  const router = useRouter();
  const emailRef = useRef(null);
  
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: email, 2: otp
  const [userEmail, setUserEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  // Refs input OTP
  const inputRefs = useRef([]);

  // Countdown timer
  useEffect(() => {
    if (step === 2 && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      setCanResend(true);
    }
  }, [countdown, step]);

  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Step 1: Send reset email
  const sendResetEmail = async () => {
    if (!emailRef.current) {
      Alert.alert('Thông báo', 'Vui lòng nhập email!');
      return;
    }

    const email = emailRef.current.trim();
    if (!isValidEmail(email)) {
      Alert.alert('Thông báo', 'Email không hợp lệ!');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);

      if (error) {
        Alert.alert('Lỗi', error.message);
      } else {
        setUserEmail(email);
        setStep(2);
        setCountdown(60);
        setCanResend(false);
        Alert.alert(
          'Thành công!', 
          'Mã xác nhận 6 chữ số đã được gửi đến email của bạn.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Alert.alert('Lỗi', 'Có lỗi xảy ra. Vui lòng thử lại!');
    }
    setLoading(false);
  };

  //Handle OTP input
  const handleOtpChange = (value, index) => {
    if (value.length > 1) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle backspace
  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Step 2: Verify OTP và redirect
  const verifyOtp = async () => {
    const otpCode = otp.join('');

    if (otpCode.length !== 6) {
      Alert.alert('Thông báo', 'Vui lòng nhập đầy đủ 6 chữ số!');
      return; // stop
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: userEmail,
        token: otpCode,
        type: 'recovery'
      });

      if (error) {
        Alert.alert('Lỗi', 'Mã xác nhận không đúng hoặc đã hết hạn!');
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        setLoading(false); // 
        return;
      }

      //  Success - redirect to change password screen
      Alert.alert(
        'Thành công!', 
        'Mã xác nhận đúng! Chuyển sang tạo mật khẩu mới.', 
        [
          {
            text: 'OK',
            onPress: () => {
              router.push({
                pathname: '/changePasswordScr',
                params: { email: userEmail }
              });
            }
          }
        ]
      );
      
    } catch (error) {
      console.error('Verify OTP error:', error);
      Alert.alert('Lỗi', 'Có lỗi xảy ra. Vui lòng thử lại!');
    }
    setLoading(false);
  };

  // Resend OTP
  const resendCode = async () => {
    if (!canResend) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(userEmail);
      
      if (error) {
        Alert.alert('Lỗi', error.message);
      } else {
        Alert.alert('Thành công!', 'Mã xác nhận mới đã được gửi!');
        setCountdown(60);
        setCanResend(false);
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể gửi lại mã.');
    }
    setLoading(false);
  };

  // Step 1: Email input
  const renderEmailStep = () => (
    <View style={styles.content}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Icon.Mail width={50} height={50} color={theme.colors.primary} />
        </View>
        <Text style={styles.title}>Quên mật khẩu</Text>
        <Text style={styles.subtitle}>Nhập email để nhận mã xác nhận</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.formTitle}>
          Vui lòng nhập email đã đăng ký để lấy lại mật khẩu!
        </Text>

        <MyInput
          icon={<Icon.Mail stroke={theme.colors.dark} strokeWidth={2} width={26} height={26} />}
          placeholder='Nhập email của bạn...'
          keyboardType="email-address"
          autoCapitalize="none"
          onChangeText={value => emailRef.current = value}
        />

        <MyButton
          title='Gửi mã xác nhận'
          loading={loading}
          onPress={sendResetEmail}
          buttonStyle={styles.actionButton}
        />

        <View style={styles.footer}>
          <Text style={styles.footerText}>Nhớ mật khẩu rồi?</Text>
          <Pressable onPress={() => router.push('/loginScr')}>
            <Text style={styles.loginLink}>Đăng nhập!</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );

  // Step 2: OTP input
  const renderOtpStep = () => (
    <View style={styles.content}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Icon.Key width={50} height={50} color={theme.colors.primary} />
        </View>
        <Text style={styles.title}>Nhập mã xác nhận</Text>
        <Text style={styles.subtitle}>Mã OTP đã được gửi đến</Text>
        <Text style={styles.email}>{userEmail}</Text>
      </View>

      {/* OTP Input */}
      <View style={styles.otpContainer}>
        {otp.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => inputRefs.current[index] = ref}
            style={[
              styles.otpInput,
              digit ? styles.otpInputFilled : null
            ]}
            value={digit}
            onChangeText={(value) => handleOtpChange(value, index)}
            onKeyPress={(e) => handleKeyPress(e, index)}
            keyboardType="numeric"
            maxLength={1}
            textAlign="center"
            selectTextOnFocus
          />
        ))}
      </View>

      {/* Timer & Resend */}
      <View style={styles.resendContainer}>
        {canResend ? (
          <Text style={styles.resendText}>
            Không nhận được mã?{' '}
            <Text style={styles.resendLink} onPress={resendCode}>
              Gửi lại
            </Text>
          </Text>
        ) : (
          <Text style={styles.timerText}>
            Gửi lại sau {countdown}s
          </Text>
        )}
      </View>

      <MyButton
        title='Xác nhận mã'
        loading={loading}
        onPress={verifyOtp}
        buttonStyle={styles.actionButton}
      />

      <View style={styles.footer}>
        <Pressable onPress={() => setStep(1)}>
          <Text style={styles.backLink}>← Quay lại</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <ScreenWrapper bg='#FFBF00'>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <BackButton />
        
        <View style={styles.stepIndicator}>
          <Text style={styles.stepText}>
            Bước {step} / 2: {
              step === 1 ? 'Nhập Email' : 'Xác nhận mã'
            }
          </Text>
        </View>
        
        {step === 1 && renderEmailStep()}
        {step === 2 && renderOtpStep()}
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
};

export default ForgotPassScr;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: wp(2),
    paddingTop: wp(2),
  },
  stepIndicator: {
    alignItems: 'center',
    marginBottom: hp(2),
  },
  stepText: {
    fontSize: hp(1.8),
    fontWeight: '600',
    color: theme.colors.text,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: wp(4),
    paddingVertical: hp(0.8),
    borderRadius: wp(3),
  },
  content: {
    flex: 1,
    gap: hp(3),
  },
  header: {
    alignItems: 'center',
    marginTop: hp(1),
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
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: hp(2),
    paddingHorizontal: wp(2),
  },
  otpInput: {
    width: wp(12),
    height: wp(12),
    borderWidth: 2,
    borderColor: theme.colors.gray,
    borderRadius: 10,
    fontSize: hp(2.5),
    fontWeight: 'bold',
    color: theme.colors.dark,
    backgroundColor: 'white',
  },
  otpInputFilled: {
    borderColor: theme.colors.primary,
  },
  resendContainer: {
    alignItems: 'center',
    marginVertical: hp(1),
  },
  resendText: {
    fontSize: hp(1.6),
    color: theme.colors.text,
  },
  resendLink: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  timerText: {
    fontSize: hp(1.6),
    color: theme.colors.textLight,
  },
  actionButton: {
    width: wp(80),
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: hp(2),
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    marginTop: hp(2),
  },
  footerText: {
    fontSize: hp(2.2),
    fontWeight: '500',
    color: theme.colors.text,
  },
  loginLink: {
    color: theme.colors.primary,
    fontSize: hp(2.2),
    fontWeight: '600',
  },
  backLink: {
    color: theme.colors.textLight,
    fontSize: hp(2.2),
    fontWeight: '500',
  },
});
import { StyleSheet, Text, View, Alert, KeyboardAvoidingView, Platform, TextInput } from 'react-native'
import React, { useState, useEffect, useRef } from 'react'
import ScreenWrapper from '../components/ScreenWrapper'
import MyHeader from '../components/MyHeader'
import { hp, wp } from '../helper/common'
import { theme } from '../constants/theme'
import MyButton from '../components/MyButton'
import { supabase } from '../lib/supabase'
import { useRouter, useLocalSearchParams } from 'expo-router'
import * as Icon from 'react-native-feather'

const EmailScr = () => {
    const router = useRouter()
    const { email } = useLocalSearchParams() //  email from params
    const [otp, setOtp] = useState(['', '', '', '', '', ''])
    const [loading, setLoading] = useState(false)
    const [countdown, setCountdown] = useState(60)
    const [canResend, setCanResend] = useState(false)

    // Refs for input OTP
    const inputRefs = useRef([])

    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
            return () => clearTimeout(timer)
        } else {
            setCanResend(true)
        }
    }, [countdown])

    // handle OTP
    const handleOtpChange = (value, index) => {
        if (value.length > 1) return // Chỉ cho phép 1 ký tự

        const newOtp = [...otp]
        newOtp[index] = value
        setOtp(newOtp)

        // next input focus
        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus()
        }
    }

    // handle Backspace
    const handleKeyPress = (e, index) => {
        if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus()
        }
    }

    // verify OTP
    const verifyOtp = async () => {
        const otpCode = otp.join('')

        if (otpCode.length !== 6) {
            Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ 6 số OTP')
            return
        }

        setLoading(true)
        try {
            console.log('Verifying OTP:', otpCode, 'for email:', email);

            const { data, error } = await supabase.auth.verifyOtp({
                email: email,
                token: otpCode,
                type: 'signup'  // Hoặc 'email' tùy theo version
            })

            console.log('Verify OTP response:', { data, error });

            if (error) {
                Alert.alert('Lỗi', 'Mã OTP không đúng hoặc đã hết hạn')
                setOtp(['', '', '', '', '', ''])
                inputRefs.current[0]?.focus()
            } else {
                Alert.alert(
                    'Thành công!',
                    'Email đã được xác nhận thành công!',
                    [
                        {
                            text: 'Đăng nhập',
                            onPress: () => router.replace('/loginScr')
                        }
                    ]
                )
            }
        } catch (error) {
            Alert.alert('Lỗi', 'Có lỗi xảy ra khi xác nhận OTP')
            console.error('Verify OTP error:', error)
        }
        setLoading(false)
    }

    // resend OTP
    const resendOtp = async () => {
        if (!canResend) return

        setLoading(true)
        try {
            const { error } = await supabase.auth.resend({
                type: 'signup',
                email: email
            })

            if (error) {
                Alert.alert('Lỗi', error.message)
            } else {
                Alert.alert('Thành công', 'Mã OTP mới đã được gửi')
                setCountdown(60)
                setCanResend(false)
                setOtp(['', '', '', '', '', ''])
                inputRefs.current[0]?.focus()
            }
        } catch (error) {
            Alert.alert('Lỗi', 'Có lỗi xảy ra khi gửi lại OTP')
        }
        setLoading(false)
    }

    return (
        <ScreenWrapper bg="#FFBF00">
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <MyHeader title="Xác nhận Email" showBackButton={true} />

                <View style={styles.content}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.iconContainer}>
                            <Icon.Mail width={50} height={50} color={theme.colors.primary} />
                        </View>
                        <Text style={styles.title}>Nhập mã xác nhận</Text>
                        <Text style={styles.subtitle}>
                            Mã OTP đã được gửi đến
                        </Text>
                        <Text style={styles.email}>{email}</Text>
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
                                <Text style={styles.resendLink} onPress={resendOtp}>
                                    Gửi lại
                                </Text>
                            </Text>
                        ) : (
                            <Text style={styles.timerText}>
                                Gửi lại sau {countdown}s
                            </Text>
                        )}
                    </View>

                    {/* Verify Button */}
                    <MyButton
                        title="Xác nhận"
                        loading={loading}
                        onPress={verifyOtp}
                        buttonStyle={styles.button}
                    />

                    {/* Instructions */}
                    <View style={styles.instructions}>
                        <Text style={styles.instructionText}>
                            • Kiểm tra hộp thư email của bạn
                        </Text>
                        <Text style={styles.instructionText}>
                            • Mã OTP có hiệu lực trong 10 phút
                        </Text>
                        <Text style={styles.instructionText}>
                            • Kiểm tra cả thư mục Spam nếu không thấy email
                        </Text>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </ScreenWrapper>
    )
}

export default EmailScr

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: wp(5),
    },
    content: {
        flex: 1,
        gap: hp(3),
    },
    header: {
        alignItems: 'center',
        marginTop: hp(3),
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
        color: theme.colors.dark,
        textAlign: 'center',
        marginTop: hp(0.5),
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
        color: theme.colors.textLight,
    },
    resendLink: {
        color: theme.colors.primary,
        fontWeight: '600',
    },
    timerText: {
        fontSize: hp(1.6),
        color: theme.colors.textLight,
    },
    button: {
        marginHorizontal: 0,
        marginTop: hp(2),
    },
    instructions: {
        backgroundColor: 'white',
        padding: wp(4),
        borderRadius: 15,
        marginTop: hp(1),
    },
    instructionText: {
        fontSize: hp(1.5),
        color: theme.colors.text,
        marginBottom: hp(0.5),
    },
})
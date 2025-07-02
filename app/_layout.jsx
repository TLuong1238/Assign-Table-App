import React, { useEffect } from 'react'
import { AuthProvider, useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Stack, useRouter } from 'expo-router'
import { getUserData } from '../services/userService'
import { LogBox, StatusBar, View, Linking, Alert } from 'react-native'
import MyLoading from '../components/MyLoading'
// import cronService from '../services/cronService'

LogBox.ignoreLogs([
  'Warning: TNodeChildrenRenderer',
  'Warning: MemoizedTNodeRenderer',
  'Warning: TRenderEngineProvider'
]);

const RootLayout = () => {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  )
}

const MainLayout = () => {
  const { user, setAuth, setUserData, setLoading, isLoading } = useAuth();
  const router = useRouter();

  // ✅ Handle VNPay Deep Linking
  const handleDeepLink = (url) => {
    console.log('🔗 Deep link received:', url);
    
    try {
      if (url.includes('payment/success')) {
        const urlObj = new URL(url);
        const orderId = urlObj.searchParams.get('orderId');
        
        console.log('✅ Payment success for order:', orderId);
        
        // Hiển thị thông báo thành công
        Alert.alert(
          'Thanh toán thành công!',
          `Giao dịch ${orderId} đã được xử lý thành công.`,
          [
            {
              text: 'Xem chi tiết',
              onPress: () => router.push(`/payment-result?status=success&orderId=${orderId}`)
            },
            {
              text: 'Về trang chủ',
              onPress: () => router.push('/main/(tabs)')
            }
          ]
        );
        
      } else if (url.includes('payment/failure')) {
        const urlObj = new URL(url);
        const orderId = urlObj.searchParams.get('orderId');
        const code = urlObj.searchParams.get('code');
        
        console.log('❌ Payment failed for order:', orderId, 'Code:', code);
        
        // Hiển thị thông báo thất bại
        Alert.alert(
          'Thanh toán thất bại',
          `Giao dịch ${orderId} không thành công. Mã lỗi: ${code}`,
          [
            {
              text: 'Xem chi tiết',
              onPress: () => router.push(`/payment-result?status=failure&orderId=${orderId}&code=${code}`)
            },
            {
              text: 'Thử lại',
              onPress: () => router.push('/main/(tabs)/historyScr')
            }
          ]
        );
      }
    } catch (error) {
      console.error('❌ Deep link parsing error:', error);
      Alert.alert('Lỗi', 'Không thể xử lý liên kết thanh toán');
    }
  };

  useEffect(() => {
    // ✅ Existing code - cron service
    // cronService.startAll();

    // ✅ Deep Link Listeners
    let linkingSubscription;
    
    const initDeepLinking = async () => {
      // Handle deep link khi app mở từ link (app đã đóng)
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          console.log('🚀 Initial URL:', initialUrl);
          // Delay để đảm bảo app đã load xong
          setTimeout(() => handleDeepLink(initialUrl), 1000);
        }
      } catch (error) {
        console.error('❌ Get initial URL error:', error);
      }

      // Handle deep link khi app đã mở
      linkingSubscription = Linking.addEventListener('url', (event) => {
        console.log('🔄 URL event:', event.url);
        handleDeepLink(event.url);
      });
    };

    const checkSession = async () => {
      setLoading(true);
      try {
        const { data } = await supabase.auth.getSession();
        console.log("Initial session check:", data?.session ? "Session found" : "No session");

        if (data?.session) {
          setAuth(data.session.user);
          await updateUserData(data.session.user, data.session.user?.email);
          router.replace('/main/(tabs)');
        } else {
          setAuth(null);
          router.replace('/welcomeScr');
        }
      } catch (error) {
        console.error("Error checking session:", error);
        router.replace('/welcomeScr');
      } finally {
        setLoading(false);
      }
    };

    // ✅ Initialize both session check and deep linking
    const initialize = async () => {
      await checkSession();
      await initDeepLinking();
    };

    initialize();

    // ✅ Existing auth state listener
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log("Auth state changed:", _event);

      if (session) {
        setAuth(session?.user);
        updateUserData(session?.user, session?.user?.email);
        router.replace('/main/(tabs)');
      } else {
        setAuth(null);
        router.replace('/welcomeScr');
      }
    });

    return () => {
      // ✅ Cleanup
      data?.subscription?.unsubscribe();
      linkingSubscription?.remove();
      // cronService.stopAll();
    };
  }, []);

  const updateUserData = async (user, email) => {
    if (!user?.id) return;
    let res = await getUserData(user?.id);
    if (res.success) {
      setUserData({ ...res.data, email });
    }
  }

  // ✅ Loading state
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <MyLoading />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" backgroundColor="#FFBF00" />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          tabBarActiveTintColor: '#FFBF00',
        }}
      >
        <Stack.Screen name="main" />
        <Stack.Screen name="welcomeScr" />
        {/* ✅ Thêm payment result screen */}
        <Stack.Screen 
          name="payment-result" 
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom'
          }}
        />
      </Stack>
    </>
  )
}

export default RootLayout
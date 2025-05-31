import React, { useEffect } from 'react'
import { AuthProvider, useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Stack, useRouter } from 'expo-router'
import { getUserData } from '../services/userService'
import { LogBox, StatusBar, View } from 'react-native'
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

  // 
  useEffect(() => {
    // cron service
    // cronService.startAll();


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

    checkSession();

    // check session
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
      data?.subscription?.unsubscribe();
      // clean cron
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

  // 
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
      </Stack>
    </>
  )
}

export default RootLayout
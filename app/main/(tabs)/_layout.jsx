import { Tabs } from 'expo-router'
import { theme } from '../../../constants/theme'
import { hp } from '../../../helper/common'
import Feather from '@expo/vector-icons/Feather';
import AntDesign from '@expo/vector-icons/AntDesign';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Ionicons from '@expo/vector-icons/Ionicons';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: '#FFBF00',
        tabBarInactiveTintColor: theme.colors.textLight,


        tabBarStyle: {
          height: hp(5),
          backgroundColor: 'white',
          justifyContent: 'center',
        },
      }}
    >
      {/*Home*/}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Trang chủ',
          tabBarIcon: ({ color }) => (
            <Ionicons name="home-outline" size={24} color={color} />
          ),
        }}
      />
      {/* Social */}
      <Tabs.Screen
        name="socialScr"
        options={{
          title: 'Mạng xã hội',
          tabBarIcon: ({ color }) => (
            <AntDesign name="cloudo" size={24} color={color} />
          ),
        }}
      />

      {/* notifi */}
      <Tabs.Screen
        name="notificationScr"
        options={{
          title: 'Thông báo',
          tabBarIcon: ({ color }) => (
            <Ionicons name="notifications-outline" size={24} color={color} />
          ),
        }}
      />
      {/* history */}
      <Tabs.Screen
        name="historyScr"
        options={{
          title: 'Lịch sử',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="history" size={24} color={color} />
          ),
        }}
      />
      {/* profile */}
      <Tabs.Screen
        name="profileScr"
        options={{
          title: 'Thông tin',
          tabBarIcon: ({ color }) => (
            <Feather name="user" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  )
}
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import React, { useEffect, useState } from 'react'
import { fetchNotification } from '../../../services/notificationServices';
import { useAuth } from '../../../context/AuthContext';
import { hp, wp } from '../../../helper/common';
import { theme } from '../../../constants/theme';
import ScreenWrapper from '../../../components/ScreenWrapper';
import { useRouter } from 'expo-router';
import MyNotifiItem from '../../../components/MyNotifiItem';
import MyHeader from '../../../components/MyHeader';
import useNotiRt from '../../../hook/useNotiRt';
import MyLoading from '../../../components/MyLoading';

const NotificationScr = () => {
  const { user } = useAuth();
  const router = useRouter();

  const {
    noti,
    loading,
    hasMore,
    getNotis,
  } = useNotiRt(user, 10);

  // Loading
  if (loading && noti.length === 0) {
    return (
      <ScreenWrapper bg={'#FFBF00'}>
        <View style={styles.container}>
          <MyHeader
            title={'Thông báo'}
            showBackButton={false}
          />
          <View style={styles.loadingContainer}>
            <MyLoading text="Đang tải thông báo..." />
          </View>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper bg={'#FFBF00'}>
      <View style={styles.container}>
        <MyHeader
          title={'Thông báo'}
          showBackButton={false}
        />
        <ScrollView
          showVerticalScrollIndicator={false}
          contentContainerStyle={styles.listStyle}
          refreshing={loading}
          onRefresh={getNotis}
        >
          {noti.map(item => (
            <MyNotifiItem
              key={item?.id}
              item={item}
              router={router}
            />
          ))}
          
          {/* load more loading */}
          {loading && noti.length > 0 && (
            <View style={styles.loadMoreContainer}>
              <MyLoading text="Đang tải thêm..." />
            </View>
          )}
          
          {/*No notifi*/}
          {noti.length === 0 && !loading && (
            <Text style={styles.noData}>
              Không có thông báo nào
            </Text>
          )}
        </ScrollView>
      </View>
    </ScreenWrapper>
  )
}

export default NotificationScr

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: wp(5),
  },
  listStyle: {
    paddingVertical: 10,
    gap: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadMoreContainer: {
    marginVertical: hp(2),
  },
  noData: {
    fontSize: hp(2),
    fontWeight: 'semibold',
    textAlign: 'center',
    color: theme.colors.text,
    marginTop: hp(10)
  }
})
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import ScreenWrapper from '../../../components/ScreenWrapper'
import { useAuth } from '../../../context/AuthContext'
import { hp, wp } from '../../../helper/common'
import { theme } from '../../../constants/theme'
import * as Icon from 'react-native-feather';
import { useRouter } from 'expo-router'
import MyAvatar from '../../../components/MyAvatar'
import MyLoading from '../../../components/MyLoading'
import MyPostCard from '../../../components/MyPostCard'
import usePostRt from '../../../hook/usePostRt'

const SocialScr = () => {
  const { user } = useAuth();
  const router = useRouter();
  // refreshing state
  const [refreshing, setRefreshing] = useState(false);

  const {
    posts,
    loading,
    hasMore,
    getPosts,
    notificationCount,
    setNotificationCount,
  } = usePostRt(user, 10);

  // onRefresh function
  const onRefresh = useCallback(async () => {
    if (refreshing) return;
    
    setRefreshing(true);
    try {
      await getPosts(true); // Reset posts and reload
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [getPosts, refreshing]);

  // 
  const handleEndReached = useCallback(() => {
    if (hasMore && !loading && !refreshing) {
      getPosts(); // Load more posts
    }
  }, [hasMore, loading, refreshing, getPosts]);

  return (
    <ScreenWrapper bg='#FFBF00'>
      <View style={styles.container}>
        {/* header */}
        <View style={styles.header}>
          <Text style={styles.title}>Bún chả Obama</Text>
          <View style={styles.icons}>
            <Pressable onPress={() => {
              setNotificationCount(0);
              router.push('/main/notificationScr')
            }}>
              <Icon.Heart strokeWidth={2} width={hp(3)} height={hp(3)} color={theme.colors.primaryDark} />
              {
                notificationCount > 0 && (
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>
                      {notificationCount}
                    </Text>
                  </View>
                )
              }
            </Pressable>
            <Pressable onPress={() => {
              setNotificationCount(0);
              router.push('/main/newPostScr')
            }}>
              <Icon.PlusSquare strokeWidth={2} width={hp(3)} height={hp(3)} color={theme.colors.primaryDark} />
            </Pressable>
            <Pressable onPress={() => router.push('/main/profileScr')}>
              <MyAvatar uri={user?.image} />
            </Pressable>
          </View>
        </View>

        {/* post */}
        <FlatList
          data={posts}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listStyle}
          keyExtractor={item => item.id.toString()}
          // refresh control
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
              title="Đang làm mới..."
              titleColor={theme.colors.primary}
            />
          }
          renderItem={({ item }) => (
            <MyPostCard
              item={item}
              currentUser={user}
              router={router}
            />
          )}
          //handleEndReached 
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.2}
          ListFooterComponent={() => {
            // 
            if (hasMore && loading && !refreshing) {
              return (
                <View style={{ marginVertical: posts.length === 0 ? hp(25) : hp(3) }}>
                  <MyLoading 
                    text={posts.length === 0 ? "Đang tải bài viết..." : "Đang tải thêm..."} 
                  />
                </View>
              );
            }
            
            if (posts.length > 0 && !hasMore) {
              return (
                <View style={{ marginVertical: hp(2.5) }}>
                  <Text style={styles.noPosts}>
                    Bạn đã xem hết nội dung...
                  </Text>
                </View>
              );
            }
            
            return null;
          }}
        />
      </View>
    </ScreenWrapper>
  )
}

export default SocialScr

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginHorizontal: wp(4)
  },
  title: {
    fontSize: hp(3.5),
    fontWeight: 'bold',
    color: theme.colors.text
  },
  icons: {
    flexDirection: 'row',
    gap: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listStyle: {
    paddingTop: 20,
    paddingHorizontal: wp(4)
  },
  noPosts: {
    fontSize: hp(2.5),
    textAlign: 'center',
    color: theme.colors.text
  },
  pill: {
    position: 'absolute',
    top: -5,
    right: -10,
    backgroundColor: theme.colors.roseLight,
    width: hp(2),
    height: hp(2),
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: {
    fontSize: hp(1.5),
    color: 'white',
    fontWeight: theme.fonts.bold
  }
})
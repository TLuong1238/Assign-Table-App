import React, { memo, useCallback, useState } from 'react';
import { 
  Alert, 
  FlatList, 
  Pressable, 
  StyleSheet, 
  Text, 
  TouchableOpacity, 
  View,
  RefreshControl
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Icon from 'react-native-feather';

// Components
import ScreenWrapper from '../../../components/ScreenWrapper';
import Avatar from '../../../components/MyAvatar';
import MyLoading from '../../../components/MyLoading';
import MyPostCard from '../../../components/MyPostCard';
import MyHeader from '../../../components/MyHeader';

// Context & Hooks
import { useAuth } from '../../../context/AuthContext';
import  usePostRt  from '../../../hook/usePostRt'

// Utils
import { hp, wp } from '../../../helper/common';
import { theme } from '../../../constants/theme';
import { supabase } from '../../../lib/supabase';

// ===== MEMOIZED COMPONENTS =====
const UserInfo = memo(({ icon: IconComponent, text, color = 'white' }) => (
  <View style={styles.info}>
    <IconComponent strokeWidth={2} height={hp(2.5)} width={wp(5)} color={color} />
    <Text style={styles.infoText}>{text}</Text>
  </View>
));

const UserHeader = memo(({ user, router, handleLogout, handleChangePassword }) => (
  <View style={styles.headerContainer}>
    <View>
      <MyHeader title="Trang cá nhân" showBackButton={false} />
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.changePasswordButton} onPress={handleChangePassword}>
          <Icon.Key strokeWidth={2} width={wp(5)} height={wp(5)} color="#3B82F6" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Icon.Power strokeWidth={2} width={wp(5)} height={wp(5)} color="red" />
        </TouchableOpacity>
      </View>
    </View>

    <View style={styles.container}>
      <View style={styles.profileSection}>
        <View style={styles.avatarContainer}>
          <Avatar
            uri={user?.image}
            size={hp(20)}
            rounded={wp(12.5)}
          />
          <Pressable 
            style={styles.editIcon} 
            onPress={() => router.push('/main/editProfileScr')}
          >
            <Icon.Edit strokeWidth={2} width={hp(3)} height={hp(3)} color="black" />
          </Pressable>

          <View style={styles.userDetails}>
            <Text style={styles.userName}>{user?.name || 'Chưa có tên'}</Text>
            <Text style={styles.userBio}>{user?.bio || 'Chưa có tiểu sử'}</Text>
            
            <UserInfo icon={Icon.Mail} text={user?.email || 'Chưa có email'} />
            <UserInfo icon={Icon.Phone} text={user?.phone || 'Chưa cập nhật số điện thoại'} />
            <UserInfo icon={Icon.Home} text={user?.address || 'Chưa cập nhật địa chỉ'} />
          </View>
        </View>
      </View>
    </View>
  </View>
));

const EmptyPosts = memo(() => (
  <View style={styles.emptyContainer}>
    <Icon.FileText width={hp(8)} height={hp(8)} color={theme.colors.textLight} />
    <Text style={styles.noPosts}>Bạn chưa có bài viết nào</Text>
    <Text style={styles.noPostsSubtext}>Hãy chia sẻ những khoảnh khắc đáng nhớ!</Text>
  </View>
));

// LoadingFooter
const LoadingFooter = memo(({ hasMore, loading, postsLength }) => {
  if (!hasMore || !loading) return null;
  
  return (
    <View style={{ marginVertical: postsLength === 0 ? hp(12.5) : hp(3.75) }}>
      <MyLoading 
        text={postsLength === 0 ? "Đang tải bài viết..." : "Đang tải thêm bài viết..."} 
      />
    </View>
  );
});

// ===== MAIN COMPONENT =====
const ProfileScr = () => {
  const { user, setAuth } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  
  const {
    posts,
    loading,
    hasMore,
    getPosts,
    removePostFromState,
  } = usePostRt(user, 10, true);

  // ===== HANDLERS =====
  const handleLogout = useCallback(() => {
    Alert.alert(
      "Xác nhận đăng xuất", 
      "Bạn có chắc chắn muốn đăng xuất không?", 
      [
        { text: "Hủy bỏ", style: 'cancel' },
        {
          text: "Đồng ý", 
          style: 'destructive',
          onPress: async () => {
            try {
              setAuth(null);
              await supabase.auth.signOut();
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Lỗi', 'Không thể đăng xuất');
            }
          }
        }
      ]
    );
  }, [setAuth]);

  const handleChangePassword = useCallback(() => {
    Alert.alert(
      "Đổi mật khẩu",
      "Bạn sẽ cần xác thực mật khẩu hiện tại để tiếp tục.",
      [
        { text: "Hủy bỏ", style: 'cancel' },
        {
          text: "Tiếp tục",
          onPress: () => {
            router.push('/main/verifyOldPasswordScr');
          }
        }
      ]
    );
  }, [router]);

  const onRefresh = useCallback(async () => {
    if (refreshing) return;
    
    setRefreshing(true);
    try {
      await getPosts(true);
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [getPosts, refreshing]);

  const handleEndReached = useCallback(() => {
    if (hasMore && !loading && !refreshing) {
      getPosts();
    }
  }, [hasMore, loading, refreshing, getPosts]);

  const renderPost = useCallback(({ item }) => (
    <MyPostCard
      item={item}
      currentUser={user}
      router={router}
      showDeleteIcon={true}
      onEdit={(item) => {
        if (item.state === 'accept') {
          router.push({
            pathname: 'main/newPostScr',
            params: { post: JSON.stringify(item) }
          });
        }
      }}
      onDelete={removePostFromState}
    />
  ), [user, router, removePostFromState]);

  const keyExtractor = useCallback((item) => item.id.toString(), []);

  // Loading
  if (loading && posts.length === 0 && !refreshing) {
    return (
      <ScreenWrapper bg="#FFBF00">
        <UserHeader 
          user={user} 
          router={router} 
          handleLogout={handleLogout}
          handleChangePassword={handleChangePassword}
        />
        <View style={styles.fullScreenLoading}>
          <MyLoading text="Đang tải hồ sơ..." />
        </View>
      </ScreenWrapper>
    );
  }

  // ===== RENDER =====
  return (
    <ScreenWrapper bg="#FFBF00">
      <FlatList
        ListHeaderComponent={
          <UserHeader 
            user={user} 
            router={router} 
            handleLogout={handleLogout}
            handleChangePassword={handleChangePassword}
          />
        }
        ListHeaderComponentStyle={styles.headerStyle}
        ListEmptyComponent={!loading && !refreshing ? <EmptyPosts /> : null}
        ListFooterComponent={
          <LoadingFooter 
            hasMore={hasMore} 
            loading={loading} 
            postsLength={posts.length} 
          />
        }
        data={posts}
        renderItem={renderPost}
        keyExtractor={keyExtractor}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listStyle}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.2}
        removeClippedSubviews={true}
        maxToRenderPerBatch={5}
        windowSize={5}
        initialNumToRender={3}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#FFBF00']}
            tintColor="#FFBF00"
            title="Đang làm mới..."
            titleColor="#FFBF00"
          />
        }
      />
    </ScreenWrapper>
  );
};

// ===== STYLES =====
const styles = StyleSheet.create({
  headerContainer: {
    flex: 1,
    backgroundColor: '#FFBF00',
    paddingHorizontal: wp(2)
  },
  headerStyle: {
    marginBottom: hp(2.5)
  },
  
  buttonContainer: {
    position: 'absolute',
    right: 0,
    marginTop: hp(1.25),
    flexDirection: 'row',
    gap: wp(2),
  },
  
  changePasswordButton: {
    padding: wp(1.25),
    borderRadius: wp(2.5),
    backgroundColor: "#dbeafe",
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  
  logoutButton: {
    padding: wp(1.25),
    borderRadius: wp(2.5),
    backgroundColor: "#fee2e2",
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  
  container: {
    flex: 1,
  },
  profileSection: {
    gap: hp(1.875)
  },
  avatarContainer: {
    marginTop: hp(2),
    flexDirection: 'row',
    alignItems: 'center',
  },
  editIcon: {
    position: 'absolute',
    bottom: 0,
    left: wp(32.5),
    backgroundColor: 'white',
    padding: wp(1.75),
    borderRadius: wp(12.5),
    borderWidth: wp(0.25),
    borderColor: 'white',
    shadowColor: theme.colors.textLight,
    shadowOffset: { width: 0, height: hp(0.25) },
    shadowOpacity: 0.25,
    shadowRadius: wp(0.96),
    elevation: wp(1.75),
  },
  userDetails: {
    alignItems: 'flex-start',
    gap: hp(0.625),
    paddingLeft: wp(2.5),
    flex: 1
  },
  userName: {
    fontSize: hp(4),
    fontWeight: 'bold',
    color: 'white',
  },
  userBio: {
    color: 'white',
    fontSize: hp(1.8),
    fontStyle: 'italic',
    opacity: 0.9
  },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2.5),
    alignSelf: 'flex-start'
  },
  infoText: {
    fontSize: hp(2),
    color: 'white',
    fontWeight: '500',
    flex: 1
  },
  listStyle: {
    paddingTop: hp(2.5),
    paddingHorizontal: wp(4),
    flexGrow: 1
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: hp(10),
    gap: hp(2)
  },
  noPosts: {
    fontSize: hp(2.5),
    textAlign: 'center',
    color: theme.colors.text,
    fontWeight: '600'
  },
  noPostsSubtext: {
    fontSize: hp(1.8),
    textAlign: 'center',
    color: theme.colors.textLight,
    paddingHorizontal: wp(8),
    lineHeight: hp(2.5)
  },
  
  fullScreenLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: hp(10)
  }
});

export default memo(ProfileScr);
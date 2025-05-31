import { Alert, ScrollView, StyleSheet, Text, Touchable, TouchableOpacity, View } from 'react-native'
import React, { useEffect, useRef, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { createComment, fetchPostsDetails, removePost, removePostComment } from '../../services/postServices';
import { hp, wp } from '../../helper/common';
import { theme } from '../../constants/theme';
import MyPostCard from '../../components/MyPostCard';
import { useAuth } from '../../context/AuthContext';
import MyLoading from '../../components/MyLoading';
import MyInput from '../../components/MyInput';
import * as Icon from 'react-native-feather'
import MyCommentItem from '../../components/MyCommentItem';
import { supabase } from '../../lib/supabase';
import { getUserData } from '../../services/userService';
import { createNotification } from '../../services/notificationServices';




const PostDetailsScr = () => {
    const { postId, commentId } = useLocalSearchParams();
    const { user } = useAuth();
    const router = useRouter();
    const [startLoading, setStartLoading] = useState(true);
    // console.log('got post id:', postId);
    const [post, setPosts] = useState(null);
    const inputRef = useRef(null);
    const commentRef = useRef('');
    const [loading, setLoading] = useState(false);
    const scrollViewRef = useRef(null);


    // handle new comment

    const handleNewComment = async (paylod) => {
        console.log('new comment payload:', paylod);
        if (paylod?.new) {
            let newComment = { ...paylod.new };
            let res = await getUserData(newComment.userId);
            newComment.user = res.success ? res.data : {};
            setPosts(prev => {
                return {
                    ...prev,
                    comments: [newComment, ...prev.comments]
                }
            })
        }
    }

    useEffect(() => {

        let commentChannel = supabase
            .channel('comments')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'comments',
                filter: `postId=eq.${postId}`
            },

                handleNewComment)
            .subscribe();


        getPostDetails();
        if (commentId && post?.comments) {
            // render time
            setTimeout(() => {
                if (commentRef.current[commentId]) {
                    commentRef.current[commentId].measure((x, y, width, height, pageX, pageY) => {
                        scrollViewRef.current?.scrollTo({
                            y: pageY - 100,
                            animated: true
                        });
                    });
                }
            }, 500);
        }
        return () => {
            supabase.removeChannel(commentChannel);
        }
    }, [])

    const getPostDetails = async () => {
        //fetch postDetails
        let res = await fetchPostsDetails(postId);
        console.log('postDetail:', res);
        if (res.success) {
            setPosts(res.data);
        }
        setStartLoading(false);

    }

    // delete comment
    const onDeleteComment = async (comment) => {
        console.log('delete comment:', comment);
        let res = await removePostComment(comment?.id);
        if (res.success) {
            setPosts(prev => {
                let updatePost = { ...prev };
                updatePost.comments = updatePost.comments.filter(c => c.id != comment?.id);
                return updatePost;
            })
        } else {
            Alert.alert('Xóa bình luận', res.msg);
        }
    }
    // loading
    if (startLoading) {
        return (
            <View style={styles.center}>
                <MyLoading />
            </View>
        )
    }

    // no post
    if (!post) {
        return (
            <View style={[styles.center, { justifyContent: 'flex-start', paddingTop: hp(20) }]}>
                <Text style={styles.notFound}>Bài viết không tồn tại hoặc đã bị xóa!</Text>
            </View>
        )
    }
    // new comment
    const onNewComment = async () => {
        if (!commentRef.current) return null;
        let data = {
            userId: user?.id,
            postId: post?.id,
            text: commentRef.current
        }
        // create comment
        setLoading(true);
        let res = await createComment(data);
        setLoading(false);
        if (res.success) {
            //send notification
            if (user.id != post?.userId) {
                let notifi = {
                    senderId: user.id,
                    receiverId: post?.userId,
                    title: `${user?.name} đã bình luận về bài viết của bạn`,
                    data: JSON.stringify({
                        postId: post?.id,
                        commentId: res.data.id,
                    })
                }
                createNotification(notifi);
            }
            //
            inputRef?.current?.clear();
            commentRef.current = "";
        } else {
            Alert.alert('Comment: ', res.msg)
        }
    }
    // edit post
    const onEditPost = async (item) => {
        console.log('edit post');
        router.back();
        router.push({
            pathname: '/main/newPostScr',
            params: {
                ...item
            }
        })
    }

    // delete post
    const onDeletePost = async (item) => {
        console.log('delete post');
        let res = await removePost(post?.id);
        if (res.success) {
            router.back();
        } else {
            console.log('delete post error:', res.msg);
        }

    }




    return (
        <View style={styles.container}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.list}>
                {post ? (
                    <MyPostCard
                        item={{
                            ...post,
                            comments: [{ count: post?.comments?.length }],
                        }}
                        currentUser={user}
                        router={router}
                        hasShadow={false}
                        showMoreIcon={false}
                        showDeleteIcon={true}
                        onDelete={onDeletePost}
                        onEdit={onEditPost}
                    />
                ) : (
                    <MyLoading />
                )}

                {/* comments input */}

                <View style={styles.inputContainer}>
                    <MyInput
                        inputRef={inputRef}
                        placeholder="Nhập bình luận của bạn..."
                        onChangeText={value => commentRef.current = value}
                        placeholderTextColor={theme.colors.textLight}
                        containerStyle={{ flex: 1, height: hp(6.2), borderRadius: 20 }}

                    />
                    {
                        loading ? (
                            <View>
                                <MyLoading size='large' />
                            </View>
                        ) : (
                            <TouchableOpacity style={styles.sendIcon} onPress={onNewComment}>
                                <Icon.Send stroke={theme.colors.primaryDark} height={30} width={30} />
                            </TouchableOpacity>
                        )
                    }
                </View>
                {/*comment list*/}
                <View styles={{ marginVertical: hp(2), gap: 17, backgroundColor: 'white' }}>
                    {
                        post?.comments?.map(comment =>
                            <MyCommentItem
                                item={comment}
                                key={comment?.id?.toString()}
                                canDelete={user?.id == comment?.userId || user?.id == post?.userId}
                                onDelete={onDeleteComment}
                                highlight={comment.id == commentId}
                            />
                        )
                    }

                    {
                        post?.comments?.length === 0 && (
                            <View style={{
                                color: theme.colors.textLight, marginTop: hp(6), alignItems: 'center', justifyContent: 'center',backgroundColor: '#FFBF00'
                            }}>
                                <Icon.MessageCircle stroke={theme.colors.textLight} height={hp(5)} width={hp(5)} />
                                <Text style={styles.notFound}>Hãy tạo bình luận đầu tiên!</Text>
                            </View>
                        )
                    }

                </View>
            </ScrollView >
        </View >
    )
}

export default PostDetailsScr

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFBF00',
        paddingVertical: wp(7)
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10
    },
    list: {
        paddingHorizontal: wp(4)
    },
    sendIcon: {
        alignItems: 'center',
        justifyContent: 'center',
        height: hp(5),
        width: hp(5)
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center'
    },
    notFound: {
        fontSize: hp(2.5),
        color: theme.colors.text,
        fontWeight: 'semibold'
    },
    loading: {
        height: hp(5),
        width: hp(5),
        justifyContent: 'center',
        alignItems: 'center',
        transform: [{ scale: 1.3 }]
    }

})
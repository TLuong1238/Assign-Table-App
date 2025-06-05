import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { fetchPosts } from '../services/postServices';
import { getUserData } from '../services/userService';

export default function usePostRt(user, limit = 10, own = false) {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [notificationCount, setNotificationCount] = useState(0);
    
    // ✅ Use refs to prevent dependency changes
    const postsMapRef = useRef(new Map());
    const userRef = useRef(user);
    const ownRef = useRef(own);
    const limitRef = useRef(limit);
    const channelsRef = useRef([]);

    // ✅ Update refs when props change
    useEffect(() => {
        userRef.current = user;
        ownRef.current = own;
        limitRef.current = limit;
    }, [user, own, limit]);

    // ✅ Stable removePostFromState function
    const removePostFromState = useCallback((postId) => {
        console.log('🗑️ Removing post from state:', postId);
        postsMapRef.current.delete(postId);
        setPosts(prev => prev.filter(post => post.id !== postId));
    }, []);

    // ✅ Stable getPosts function with refs
    const getPosts = useCallback(async (reset = false) => {
        if (loading || (!hasMore && !reset)) return;
        
        console.log(`📱 [getPosts] Reset: ${reset}, Loading: ${loading}, HasMore: ${hasMore}`);
        setLoading(true);

        try {
            const currentUser = userRef.current;
            const currentOwn = ownRef.current;
            const currentLimit = limitRef.current;
            const offset = reset ? 0 : posts.length;
            
            let res;
            if (currentOwn) {
                res = await fetchPosts(currentLimit, currentUser?.id, offset);
            } else {
                res = await fetchPosts(currentLimit, undefined, offset);
            }

            if (res.success) {
                const newPosts = res.data || [];
                
                if (reset) {
                    console.log(`🔄 [getPosts] Resetting with ${newPosts.length} posts`);
                    postsMapRef.current.clear();
                    newPosts.forEach(post => postsMapRef.current.set(post.id, post));
                    setPosts(newPosts);
                } else {
                    newPosts.forEach(post => postsMapRef.current.set(post.id, post));
                    
                    setPosts(prev => {
                        const prevIds = new Set(prev.map(p => p.id));
                        const uniqueNewPosts = newPosts.filter(post => !prevIds.has(post.id));
                        return [...prev, ...uniqueNewPosts];
                    });
                }
                
                setHasMore(newPosts.length === currentLimit);
            }
        } catch (error) {
            console.error('Error fetching posts:', error);
        } finally {
            setLoading(false);
        }
    }, [loading, hasMore, posts.length]); // ✅ Minimal dependencies

    // ✅ Stable event handlers with refs
    const handlePostEvent = useCallback(async (payload) => {
        const { eventType, new: newData, old: oldData } = payload;
        console.log(`[POSTS] Received ${eventType} event:`, payload);

        try {
            const currentUser = userRef.current;
            const currentOwn = ownRef.current;

            switch (eventType) {
                case 'INSERT':
                    if (newData?.id && !postsMapRef.current.has(newData.id)) {
                        const shouldShow = currentOwn 
                            ? newData.userId === currentUser?.id
                            : newData.state === 'accept';

                        if (shouldShow) {
                            const res = await getUserData(newData.userId);
                            const newPost = {
                                ...newData,
                                likes: [],
                                comments: [{ count: 0 }],
                                user: res.success ? res.data : {}
                            };

                            postsMapRef.current.set(newPost.id, newPost);
                            setPosts(prev => {
                                if (prev.some(p => p.id === newPost.id)) return prev;
                                return [newPost, ...prev];
                            });
                        }
                    }
                    break;

                case 'UPDATE':
                    if (newData?.id) {
                        const currentPost = postsMapRef.current.get(newData.id);
                        const shouldShow = currentOwn 
                            ? newData.userId === currentUser?.id 
                            : newData.state === 'accept';

                        if (!shouldShow && currentPost) {
                            postsMapRef.current.delete(newData.id);
                            setPosts(prev => prev.filter(post => post.id !== newData.id));
                        } else if (shouldShow) {
                            if (currentPost) {
                                const updatedPost = {
                                    ...currentPost,
                                    ...newData,
                                    likes: currentPost.likes,
                                    comments: currentPost.comments,
                                    user: currentPost.user
                                };
                                postsMapRef.current.set(updatedPost.id, updatedPost);
                                setPosts(prev => prev.map(post => 
                                    post.id === updatedPost.id ? updatedPost : post
                                ));
                            } else if (newData.state === 'accept') {
                                const res = await getUserData(newData.userId);
                                const newPost = {
                                    ...newData,
                                    likes: [],
                                    comments: [{ count: 0 }],
                                    user: res.success ? res.data : {}
                                };
                                postsMapRef.current.set(newPost.id, newPost);
                                setPosts(prev => {
                                    if (prev.some(p => p.id === newPost.id)) return prev;
                                    return [newPost, ...prev];
                                });
                            }
                        }
                    }
                    break;

                case 'DELETE':
                    if (oldData?.id && postsMapRef.current.has(oldData.id)) {
                        postsMapRef.current.delete(oldData.id);
                        setPosts(prev => prev.filter(post => post.id !== oldData.id));
                    }
                    break;
            }
        } catch (error) {
            console.error(`[POSTS] Error handling ${eventType} event:`, error);
        }
    }, []); // ✅ No dependencies

    const handleCommentEvent = useCallback(async (payload) => {
        const { eventType, new: newData, old: oldData } = payload;

        try {
            switch (eventType) {
                case 'INSERT':
                    if (newData?.postId && postsMapRef.current.has(newData.postId)) {
                        const post = postsMapRef.current.get(newData.postId);
                        const updatedPost = { 
                            ...post,
                            comments: [{ count: (post.comments?.[0]?.count || 0) + 1 }]
                        };
                        postsMapRef.current.set(newData.postId, updatedPost);
                        setPosts(prev => prev.map(p => p.id === newData.postId ? updatedPost : p));
                    }
                    break;

                case 'DELETE':
                    if (oldData?.postId && postsMapRef.current.has(oldData.postId)) {
                        const post = postsMapRef.current.get(oldData.postId);
                        const newCount = Math.max(0, (post.comments?.[0]?.count || 0) - 1);
                        const updatedPost = { ...post, comments: [{ count: newCount }] };
                        postsMapRef.current.set(oldData.postId, updatedPost);
                        setPosts(prev => prev.map(p => p.id === oldData.postId ? updatedPost : p));
                    }
                    break;
            }
        } catch (error) {
            console.error(`[COMMENTS] Error handling ${eventType} event:`, error);
        }
    }, []);

    const handleLikeEvent = useCallback(async (payload) => {
        try {
            if (payload?.eventType === 'INSERT' && payload?.new?.postId) {
                const postId = payload.new.postId;
                if (postsMapRef.current.has(postId)) {
                    const post = postsMapRef.current.get(postId);
                    const updatedPost = { 
                        ...post,
                        likes: Array.isArray(post.likes) 
                            ? [...post.likes, payload.new]
                            : [payload.new]
                    };
                    postsMapRef.current.set(postId, updatedPost);
                    setPosts(prev => prev.map(p => p.id === postId ? updatedPost : p));
                }
            } else if (payload?.eventType === 'DELETE') {
                const likeId = payload.old?.id;
                let postId = payload.old?.postId;

                if (!postId) {
                    postsMapRef.current.forEach((post, key) => {
                        if (post.likes?.some(like => like.id === likeId)) {
                            postId = key;
                        }
                    });
                }

                if (postId && postsMapRef.current.has(postId)) {
                    const post = postsMapRef.current.get(postId);
                    const updatedPost = { 
                        ...post,
                        likes: Array.isArray(post.likes) 
                            ? post.likes.filter(like => like.id !== likeId)
                            : []
                    };
                    postsMapRef.current.set(postId, updatedPost);
                    setPosts(prev => prev.map(p => p.id === postId ? updatedPost : p));
                }
            }
        } catch (error) {
            console.error(`[LIKES] Error handling event:`, error);
        }
    }, []);

    const handleNewNotification = useCallback(async (payload) => {
        if (payload.eventType === 'INSERT' && payload.new) {
            setNotificationCount(prev => prev + 1);
        }
    }, []);

    // ✅ Setup realtime subscriptions with proper cleanup
    useEffect(() => {
        if (!user?.id) return;
        
        // ✅ Cleanup existing channels first
        if (channelsRef.current.length > 0) {
            console.log('🧹 Cleaning up existing channels...');
            channelsRef.current.forEach(channel => {
                supabase.removeChannel(channel);
            });
            channelsRef.current = [];
        }

        const channelId = `posts-${user.id}-${own ? 'own' : 'public'}-${Date.now()}`;

        // ✅ Create new channels
        const postsChannel = supabase
            .channel(`${channelId}-posts`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'posts',
                filter: own ? `userId=eq.${user.id}` : undefined
            }, handlePostEvent)
            .subscribe();

        const commentsChannel = supabase
            .channel(`${channelId}-comments`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'comments'
            }, handleCommentEvent)
            .subscribe();

        const notificationsChannel = supabase
            .channel(`${channelId}-notifications`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `receiverId=eq.${user.id}`
            }, handleNewNotification)
            .subscribe();

        const likesChannel = supabase
            .channel(`${channelId}-likes`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'likes'
            }, handleLikeEvent)
            .subscribe();

        // ✅ Store channels for cleanup
        channelsRef.current = [postsChannel, commentsChannel, notificationsChannel, likesChannel];

        // ✅ Initial data fetch only once
        if (posts.length === 0) {
            getPosts(true);
        }

        // ✅ Cleanup function
        return () => {
            console.log('🧹 Cleaning up realtime channels');
            channelsRef.current.forEach(channel => {
                supabase.removeChannel(channel);
            });
            channelsRef.current = [];
        };
    }, [user?.id, own]); // ✅ Only depend on user.id and own

    return {
        posts,
        loading,
        hasMore,
        getPosts,
        removePostFromState,
        notificationCount,
        setNotificationCount,
        postsMapRef
    };
}
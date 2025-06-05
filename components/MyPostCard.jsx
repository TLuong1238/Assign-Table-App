import { Alert, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React, { useEffect, useRef, useState } from 'react'
import { theme } from '../constants/theme'
import MyAvatar from './MyAvatar'
import { hp, scriptHtmlTags, wp } from '../helper/common'
import moment from 'moment'
import * as Icon from 'react-native-feather'
import RenderHtml from 'react-native-render-html';
import { downloadFile, getSupabaseFileUrl } from '../services/imageService'
import { Image } from 'expo-image'
import { Video } from 'expo-av'
import { createPostLike, removePost, removePostLike } from '../services/postServices'
import * as Sharing from 'expo-sharing';
import MyLoading from './MyLoading'

// ===== CONSTANTS =====
const POST_STATES = {
    WAIT: 'wait',
    ACCEPT: 'accept',
    REJECT: 'reject'
};

const STATUS_CONFIG = {
    [POST_STATES.WAIT]: {
        icon: '⏳',
        text: 'Bài viết đang chờ duyệt bởi quản trị viên',
        bgColor: '#fff3cd',
        borderColor: '#ffeaa7',
        textColor: '#856404'
    },
    [POST_STATES.REJECT]: {
        icon: '❌',
        text: 'Bài viết đã bị từ chối',
        bgColor: '#f8d7da',
        borderColor: '#f5c6cb',
        textColor: '#721c24'
    }
};

const textStyles = { color: theme.colors.dark, fontSize: hp(1.75) };
const tagsStyles = {
    div: textStyles,
    p: textStyles,
    ol: textStyles,
    h1: { color: theme.colors.dark },
    h4: { color: theme.colors.dark }
};

// ===== COMPONENT =====
const MyPostCard = ({
    item,
    currentUser,
    router,
    hasShadow = true,
    showMoreIcon = true,
    showDeleteIcon = false,
    onEdit = () => { },
    onDelete = () => { },
}) => {
    // ===== STATE & COMPUTED VALUES =====
    const canInteract = item?.state === POST_STATES.ACCEPT;
    const isOwnPost = item?.userId === currentUser?.id;
    const canEdit = isOwnPost && item?.state === POST_STATES.ACCEPT; // ✅ Chỉ edit được khi ACCEPT
    const createAt = moment(item?.created_at).fromNow();

    const [likeCount, setLikeCount] = useState(0);
    const [localLiked, setLocalLiked] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const lastClickTime = useRef(0);

    const shadowStyles = hasShadow ? {
        shadowOffset: { width: 0, height: hp(0.25) },
        shadowOpacity: 0.06,
        shadowRadius: wp(1.5),
        elevation: 1
    } : {};

    // ===== EFFECTS =====
    useEffect(() => {
        if (item?.likes?.length > 0) {
            if (item.likes[0]?.count !== undefined) {
                setLikeCount(item.likes[0].count);
            } else {
                setLikeCount(item.likes.length);
                const userLiked = item.likes.some(like => like.userId === currentUser?.id);
                setLocalLiked(userLiked);
            }
        } else {
            setLikeCount(0);
            setLocalLiked(false);
        }
    }, [item?.likes, currentUser?.id]);

    // ===== HANDLERS =====
    const onLike = async () => {
        if (!canInteract || isProcessing) return;

        const now = Date.now();
        if (now - lastClickTime.current < 500) return;
        lastClickTime.current = now;

        setIsProcessing(true);
        const newLiked = !localLiked;
        setLocalLiked(newLiked);
        setLikeCount(prev => newLiked ? prev + 1 : Math.max(0, prev - 1));

        try {
            const res = newLiked 
                ? await createPostLike({ userId: currentUser?.id, postId: item?.id })
                : await removePostLike(item?.id, currentUser?.id);

            if (!res.success) {
                // Revert on error
                setLocalLiked(!newLiked);
                setLikeCount(prev => newLiked ? Math.max(0, prev - 1) : prev + 1);
                Alert.alert('Lỗi', 'Không thể thực hiện thao tác');
            }
        } catch (error) {
            // Revert on error
            setLocalLiked(!newLiked);
            setLikeCount(prev => newLiked ? Math.max(0, prev - 1) : prev + 1);
            console.error('Like/unlike error:', error);
        } finally {
            setTimeout(() => setIsProcessing(false), 500);
        }
    };

    const openPostDetails = () => {
        if (!canInteract) return;
        router.push({
            pathname: 'main/postDetailsScr',
            params: { postId: item?.id }
        });
    };

    const handlePostDelete = () => {
        if (isDeleting) return;

        Alert.alert("Xác nhận", "Bạn có chắc chắn muốn xóa bài viết này không?", [
            { text: "Hủy bỏ", style: 'cancel' },
            {
                text: "Đồng ý",
                style: 'destructive',
                onPress: async () => {
                    setIsDeleting(true);
                    try {
                        const res = await removePost(item?.id);
                        if (res.success) {
                            onDelete(item?.id);
                            Alert.alert('Thành công', 'Đã xóa bài viết thành công');
                        } else {
                            Alert.alert('Lỗi', res.msg || 'Không thể xóa bài viết');
                        }
                    } catch (error) {
                        console.error('Delete error:', error);
                        Alert.alert('Lỗi', 'Có lỗi xảy ra khi xóa bài viết');
                    } finally {
                        setIsDeleting(false);
                    }
                }
            }
        ]);
    };

    const onShare = async () => {
        if (!canInteract) return;
        
        const content = item?.body ? scriptHtmlTags(item.body) : 'Xem bài viết này!';
        try {
            await Share.share({ message: content });
        } catch (error) {
            Alert.alert('Lỗi', 'Không thể chia sẻ');
        }
    };

    // ===== RENDER FUNCTIONS =====
    const renderStatusBanner = () => {
        if (canInteract) return null;
        const config = STATUS_CONFIG[item?.state] || STATUS_CONFIG[POST_STATES.WAIT];
        
        return (
            <View style={[styles.statusBanner, {
                backgroundColor: config.bgColor,
                borderColor: config.borderColor
            }]}>
                <Text style={[styles.statusText, { color: config.textColor }]}>
                    {config.icon} {config.text}
                </Text>
            </View>
        );
    };

    const renderHeader = () => (
        <View style={styles.header}>
            <View style={styles.userInfo}>
                <MyAvatar
                    size={hp(4.5)}
                    uri={item?.user?.image}
                    rounded={wp(6.25)}
                />
                <View style={styles.userDetails}>
                    <Text style={styles.username}>{item?.user?.name}</Text>
                    <Text style={styles.postTime}>{createAt}</Text>
                </View>
            </View>

            {/* Actions */}
            <View style={styles.headerActions}>
                {/* More Icon - chỉ cho posts accept */}
                {showMoreIcon && canInteract && (
                    <TouchableOpacity onPress={openPostDetails} style={styles.actionButton}>
                        <Icon.MoreHorizontal stroke={theme.colors.dark} height={hp(3)} width={hp(3)} />
                    </TouchableOpacity>
                )}

                {/* Owner Actions */}
                {showDeleteIcon && isOwnPost && (
                    <View style={styles.ownerActions}>
                        {/* ✅ Edit chỉ hiện khi ACCEPT */}
                        {canEdit && (
                            <TouchableOpacity 
                                onPress={() => onEdit(item)} 
                                style={styles.actionButton}
                                disabled={isDeleting}
                            >
                                <Icon.Edit stroke={theme.colors.dark} height={hp(3)} width={hp(3)} />
                            </TouchableOpacity>
                        )}
                        
                        {/* Delete luôn hiện cho owner */}
                        <TouchableOpacity 
                            onPress={handlePostDelete} 
                            style={styles.actionButton}
                            disabled={isDeleting}
                        >
                            {isDeleting ? (
                                <MyLoading size={hp(3)} />
                            ) : (
                                <Icon.Trash2 stroke={'red'} height={hp(3)} width={hp(3)} />
                            )}
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </View>
    );

    const renderContent = () => (
        <View style={styles.content}>
            {item?.body && (
                <View style={styles.postBody}>
                    <RenderHtml
                        contentWidth={wp(100)}
                        source={{ html: item.body }}
                        tagsStyles={tagsStyles}
                    />
                </View>
            )}

            {item?.file?.includes('postImages') && (
                <Image
                    source={getSupabaseFileUrl(item.file)}
                    transition={100}
                    style={styles.postMedia}
                    contentFit='cover'
                />
            )}

            {item?.file?.includes('postVideos') && (
                <Video
                    style={styles.postMedia}
                    source={getSupabaseFileUrl(item.file)}
                    useNativeControls
                    resizeMode='cover'
                    isLooping
                />
            )}
        </View>
    );

    const renderFooter = () => {
        if (canInteract) {
            return (
                <View style={styles.footer}>
                    <TouchableOpacity onPress={onLike} style={styles.footerAction}>
                        <Icon.Heart
                            color={localLiked ? theme.colors.rose : theme.colors.textLight}
                            height={hp(3.75)} width={hp(3.75)}
                            fill={localLiked ? theme.colors.rose : 'none'} 
                        />
                        <Text style={styles.count}>{likeCount}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={openPostDetails} style={styles.footerAction}>
                        <Icon.MessageSquare stroke={theme.colors.rose} height={hp(3.75)} width={hp(3.75)} />
                        <Text style={styles.count}>
                            {item?.comments?.[0]?.count || 0}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={onShare} style={styles.footerAction}>
                        <Icon.Share2 stroke={theme.colors.rose} height={hp(3.75)} width={hp(3.75)} />
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <View style={styles.disabledFooter}>
                <View style={styles.statsRow}>
                    <Text style={styles.disabledStats}>❤️ {likeCount}</Text>
                    <Text style={styles.disabledStats}>💬 {item?.comments?.[0]?.count || 0}</Text>
                </View>
                <Text style={styles.disabledText}>Không thể tương tác với bài viết này</Text>

                {/* Owner Actions for disabled posts */}
                {isOwnPost && (
                    <View style={styles.ownerActionsFooter}>
                        {/* ✅ Edit chỉ hiện khi ACCEPT (nhưng ở đây không bao giờ ACCEPT) */}
                        {canEdit && (
                            <TouchableOpacity 
                                style={styles.ownerActionButton}
                                onPress={() => onEdit(item)}
                                disabled={isDeleting}
                            >
                                <Icon.Edit stroke={theme.colors.dark} height={hp(2.5)} width={hp(2.5)} />
                                <Text style={styles.ownerActionText}>Chỉnh sửa</Text>
                            </TouchableOpacity>
                        )}
                        
                        <TouchableOpacity 
                            style={[styles.ownerActionButton, styles.deleteActionButton]}
                            onPress={handlePostDelete}
                            disabled={isDeleting}
                        >
                            {isDeleting ? (
                                <MyLoading size={hp(2.5)} />
                            ) : (
                                <Icon.Trash2 stroke={'red'} height={hp(2.5)} width={hp(2.5)} />
                            )}
                            <Text style={[styles.ownerActionText, { color: 'red' }]}>
                                {isDeleting ? 'Đang xóa...' : 'Xóa'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    };

    // ===== MAIN RENDER =====
    return (
        <View style={[
            styles.container,
            shadowStyles,
            !canInteract && styles.disabledContainer,
            isDeleting && styles.deletingContainer
        ]}>
            {renderStatusBanner()}
            {renderHeader()}
            {renderContent()}
            {renderFooter()}
        </View>
    );
};

export default MyPostCard;

// ===== STYLES =====
const styles = StyleSheet.create({
    container: {
        gap: hp(1.25),
        marginBottom: hp(1.875),
        borderRadius: wp(3.75),
        borderCurve: 'continuous',
        padding: wp(2.5),
        paddingVertical: hp(1.5),
        backgroundColor: 'white',
        borderWidth: wp(0.125),
        borderColor: theme.colors.gray,
        shadowColor: '#000'
    },
    disabledContainer: {
        opacity: 0.8,
        backgroundColor: '#f8f9fa'
    },
    deletingContainer: {
        opacity: 0.6,
        backgroundColor: '#f5f5f5'
    },
    statusBanner: {
        borderWidth: wp(0.25),
        borderRadius: wp(2),
        padding: hp(1.2),
        marginBottom: hp(1),
    },
    statusText: {
        fontSize: hp(1.75),
        fontWeight: '500',
        textAlign: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: wp(2.5),
        flex: 1
    },
    userDetails: {
        gap: hp(0.25)
    },
    username: {
        fontSize: hp(1.8),
        fontWeight: '600',
        color: theme.colors.dark
    },
    postTime: {
        fontSize: hp(1.5),
        color: theme.colors.textLight,
        fontWeight: '500'
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: wp(2)
    },
    ownerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: wp(2.5),
    },
    actionButton: {
        padding: wp(1.5),
        borderRadius: wp(2),
    },
    content: {
        gap: hp(1.25)
    },
    postBody: {
        marginLeft: wp(1.25)
    },
    postMedia: {
        height: hp(40),
        width: '100%',
        borderRadius: wp(3.75),
        borderCurve: 'continuous'
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: wp(3.75),
        paddingTop: hp(1.5),
        borderTopWidth: wp(0.125),
        borderTopColor: theme.colors.gray
    },
    footerAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: wp(1.5),
        marginLeft: wp(1.25),
    },
    count: {
        color: theme.colors.text,
        fontSize: hp(1.6),
        fontWeight: '500'
    },
    disabledFooter: {
        paddingTop: hp(1.5),
        borderTopWidth: wp(0.125),
        borderTopColor: theme.colors.gray,
        gap: hp(1.5)
    },
    statsRow: {
        flexDirection: 'row',
        gap: wp(4),
        justifyContent: 'center'
    },
    disabledStats: {
        fontSize: hp(1.6),
        color: theme.colors.textLight,
        fontWeight: '500'
    },
    disabledText: {
        textAlign: 'center',
        color: theme.colors.textLight,
        fontSize: hp(1.4),
        fontStyle: 'italic'
    },
    ownerActionsFooter: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: wp(5),
        paddingTop: hp(1),
        borderTopWidth: wp(0.125),
        borderTopColor: theme.colors.gray,
    },
    ownerActionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: wp(1.5),
        paddingHorizontal: wp(4),
        paddingVertical: hp(1),
        borderRadius: wp(2),
        backgroundColor: '#f8f9fa',
        borderWidth: wp(0.125),
        borderColor: theme.colors.gray,
    },
    deleteActionButton: {
        backgroundColor: '#fff5f5',
        borderColor: '#fed7d7',
    },
    ownerActionText: {
        fontSize: hp(1.5),
        fontWeight: '500',
        color: theme.colors.dark,
    }
});
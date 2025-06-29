import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { fetchNotification } from '../services/notificationServices';

export default function useNotiRt(user, limit = 20) {
    const [noti, setNotis] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const notiMapRef = useRef(new Map());

    // Fetch notifications from server
    const getNotis = useCallback(async () => {
        if (loading || !hasMore || !user) return;
        setLoading(true);

        try {
            const offset = noti.length;
            const res = await fetchNotification(user.id, limit, offset);

            if (res.success) {
                res.data.forEach((notification) => {
                    if (!notiMapRef.current.has(notification.id)) {
                        notiMapRef.current.set(notification.id, notification);
                    }
                });

                // Update state
                setNotis((prev) => [...prev, ...res.data]);
                setHasMore(res.data.length === limit);
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setLoading(false);
        }
    }, [loading, hasMore, noti.length, user, limit]);

    // Handle new notification from realtime
    const handleNewNotification = useCallback(async (payload) => {
        console.log(`[NOTIFICATION] Received new notification:`, payload);

        if (payload.eventType === 'INSERT' && payload.new) {
            const notificationId = payload.new.id;

            if (!notiMapRef.current.has(notificationId)) {
                try {
                    const { data: senderData, error } = await supabase
                        .from('users')
                        .select('id, name, image')
                        .eq('id', payload.new.senderId)
                        .single();

                    const updateNotification = {
                        ...payload.new,
                        sender: senderData || { id: payload.new.senderId, name: 'Unknown', image: null },
                    };

                    notiMapRef.current.set(notificationId, updateNotification);
                    setNotis((prev) => [updateNotification, ...prev]);
                } catch (err) {
                    console.error('Error fetching sender:', err);
                }
            }
        }
    }, []);

    // Set up realtime channel
    useEffect(() => {
        if (!user) return;

        const channelId = `notifications-${Date.now()}`;
        console.log(`Setting up channel: ${channelId}`);

        const notificationsChannel = supabase
            .channel(`${channelId}-notifications`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `receiverId=eq.${user.id}`,
            }, handleNewNotification)
            .subscribe((status) => console.log(`Notifications channel status: ${status}`));

        // Fetch initial notifications
        getNotis();

        return () => {
            if (notificationsChannel) {
                console.log('Cleaning up notifications channel');
                supabase.removeChannel(notificationsChannel);
            }
        };
    }, [getNotis, user, handleNewNotification]);

    return {
        loading,
        hasMore,
        noti,
        setNotis,
        getNotis,
        notiMapRef,
    };
}
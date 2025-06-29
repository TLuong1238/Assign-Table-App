import { Alert, StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { hp } from '../helper/common'
import { theme } from '../constants/theme'
import { TouchableOpacity } from 'react-native'
import MyAvatar from './MyAvatar'
import moment from 'moment'

const MyNotifiItem = (
    {
        item,
        router
    }
) => {
    // console.log('Sender image URL:', item?.sender?.image);
    const createAt = moment(item?.created_at).fromNow();
    const handleNotiClick = () => {
        try {
            if (!item?.data) {
                console.log('Notification data is empty');
                return;
            }

            // Parse JSON 
            const parsedData = JSON.parse(item.data);

            // check array or object
            if (Array.isArray(parsedData)) {
                const [postId, commentId] = parsedData;
                router.push({
                    pathname: `main/postDetailsScr`,
                    params: {
                        postId,
                        commentId
                    }
                });
            }
            //result is an object
            else if (typeof parsedData === 'object') {
                const { postId, commentId } = parsedData;

                if (postId) {
                    router.push({
                        pathname: `main/postDetailsScr`,
                        params: {
                            postId,
                            commentId
                        }
                    });
                } else {
                    console.log('No postId found in notification data', parsedData);
                }
            }
            else {
                console.log('Notification data format is invalid', parsedData);
            }
        } catch (error) {
            console.error('Error parsing notification data:', error, item?.data);
        }
    }


    return (
        <TouchableOpacity style={styles.container} onPress={handleNotiClick}>
            <MyAvatar
                uri={item?.sender?.image}
                size={hp(5)}

            />
            <View style={styles.nameTitle}>
                <Text style={styles.text}>
                    {item?.sender?.name}
                </Text>
                <Text style={[styles.text, { color: theme.colors.textDark }]}>
                    {item?.title}
                </Text>
            </View>
            <Text style={[styles.text, { color: theme.colors.textLight }]}>
                {
                    createAt
                }

            </Text>

        </TouchableOpacity>
    )
}

export default MyNotifiItem

const styles = StyleSheet.create({
    container: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        backgroundColor: 'white',
        borderWidth: 0.5,
        borderColor: theme.colors.darkLight,
        padding: 15,
        // paddingVertical: 12,
        borderRadius: 10,
        borderCurve: 'continuous'
    },
    nameTitle: {
        flex: 1,
        gap: 2,
    },
    text: {
        fontSize: hp(1.6),
        fontWeight: theme.fonts.medium,
        color: theme.colors.text,
    }
})
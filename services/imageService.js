import * as FileSystem from 'expo-file-system'
import { supabase } from '../lib/supabase'
import { decode } from 'base64-arraybuffer'
import { supabaseURL } from '../constants'

export const getUserImageSrc = imagePath => {
    if (imagePath) {
        return getSupabaseFileUrl(imagePath);
    } else {
       return { uri: 'https://www.lewesac.co.uk/wp-content/uploads/2017/12/default-avatar.jpg' }; 
    }
}
export const getSupabaseFileUrl = filePath => {
    if(filePath){
        return {uri: `${supabaseURL}/storage/v1/object/public/uploads/${filePath}`}
    }
    return null;
}

export const uploadFile = async (folderName, fileUri, isImage = true) => {
    try {
        let fileName = getFilePath(folderName, isImage);
        const fileBase64 = await FileSystem.readAsStringAsync(fileUri, {
            encoding: FileSystem.EncodingType.Base64
        }) // Mã hóa nhị phân thành chuỗi ký tự

        let imageData = decode(fileBase64); // chuyển đổi thành mảng byte để biểu diễn dữ liệu nhị phân
        let { data, error } = await supabase
            .storage
            .from("uploads")
            .upload(fileName, imageData, {
                cacheControl: "3600",
                upsert: false,
                contentType: isImage ? "image/*" : "video/*",
            });

        if (error) {
            console.log("file upload error: ", error);
            return { success: false, msg: "Could not upload media" };
        }

        return { success: true, data: data.path };

    } catch (error) {
        console.log("Thông báo!", error)
        return { success: false, msg: 'Không thể upload ảnh' };
    }

}

export const getFilePath = (folderName, isImage) => {
    return `/${folderName}/${(new Date()).getTime()}${isImage ? '.jpeg' : '.mp4'}`;
};

export const downloadFile = async (url) => {
    try {
        const {uri} = await FileSystem.downloadAsync(url, getLocalFilePath(url));
        return uri;
    } catch(error) {
        return (null);
    }
}

export const getLocalFilePath = filePath => {
    let fileName = filePath.split('/').pop();
    return `${FileSystem.documentDirectory}${fileName}`;
}
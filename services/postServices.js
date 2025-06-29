import { supabase } from "../lib/supabase";
import { uploadFile } from "./imageService";

export const createOrUpdatePost = async (post) => {
   try {
      //  Add default state as 'wait'
      post.state = 'wait';
      
      //upload images
      if (post.file && typeof post.file == 'object') {
         let isImage = post?.file?.type == 'image';

         let folderName = isImage ? 'postImages' : 'postVideos';

         let fileResult = await uploadFile(folderName, post?.file?.uri, isImage);
         if (fileResult.success) post.file = fileResult.data;
         else {
            return fileResult;
         }
         //
         const { data, error } = await supabase
            .from('posts')
            .upsert(post)
            .select()
            .single();


         if (error) {
            console.log('create post error: ', error);
            return { success: false, msg: 'Không thể tạo post' };
         }

         return { success: true, data: data };
      }
      // Xử lý chỉ có text 
      const { data, error } = await supabase
         .from('posts')
         .upsert(post)
         .select()
         .single();

      if (error) {
         console.log('create post error:', error);
         return { success: false, msg: 'Không thể tạo post' };
      }

      return { success: true, data };
   } catch (error) {
      console.log('createPost error: ', error);
      return { success: false, msg: 'Không thể tạo post' };
   }
}

// fetch Post
export const fetchPosts = async (limit = 15, userId, offset = 0) => {
   try {
      if (userId) {
         const { data, error } = await supabase
            .from('posts')
            .select(`
               *,
               user: users(id, name, image),
               likes (*),
               comments (count)
               `)
            .order('created_at', { ascending: false })
            .eq('userId', userId)
            .limit(limit);

         if (error) {
            console.log('fetchPost error: ', error);
            return { success: false, msg: 'Không thể fetch post' };
         }
         return { success: true, data: data };
      } else {
         const { data, error } = await supabase
            .from('posts')
            .select(`
               *,
               user: users(id, name, image),
               likes (*),
               comments (count)
               `)
            .eq('state', 'accept') // fetch only accepted posts
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

         if (error) {
            console.log('fetchPost error: ', error);
            return { success: false, msg: 'Không thể fetch post' };
         }
         return { success: true, data: data };
      }



   } catch (error) {
      console.log('fetchPost error: ', error);
      return { success: false, msg: 'Không thể fetch post' };
   }
}

// post Like
export const createPostLike = async (postLike) => {
   try {
      const { data, error } = await supabase
         .from('likes')
         .insert(postLike)
         .select()
         .single();

      if (error) {
         console.log('postLike error: ', error);
         return { success: false, msg: 'Không thể like post' };
      }
      return { success: true, data: data };



   } catch (error) {
      console.log('postLike error: ', error);
      return { success: false, msg: 'Không thể like post' };
   }
}
// remove Like
export const removePostLike = async (postId, userId) => {
   try {
      const { error } = await supabase
         .from('likes')
         .delete()
         .eq('userId', userId)
         .eq('postId', postId)

      if (error) {
         console.log('postLike error: ', error);
         return { success: false, msg: 'Không thể xóa like post' };
      }
      return { success: true, data: { postId, userId } };



   } catch (error) {
      console.log('postLike error: ', error);
      return { success: false, msg: 'Không thể xóa like post' };
   }
}

// fetch Post Details
export const fetchPostsDetails = async (postId) => {
   try {
      const { data, error } = await supabase
         .from('posts')
         .select(`
        *,
        user: users(id, name, image),
        likes (*),
        comments (*, user: users(id, name, image))
    `)
         .eq('id', postId)
         .order('created_at', { ascending: false, foreignTable: 'comments' })
         .single();

      if (error) {
         console.log('fetchPostDetails error: ', error);
         return { success: false, msg: 'Không thể fetch post details' };
      }
      return { success: true, data: data };



   } catch (error) {
      console.log('fetchPostDetails error: ', error);
      return { success: false, msg: 'Không thể fetch post details' };
   }
}

// create comment
export const createComment = async (comment) => {
   try {
      const { data, error } = await supabase
         .from('comments')
         .insert(comment)
         .select()
         .single();

      if (error) {
         console.log('comment error: ', error);
         return { success: false, msg: 'Không thể tạo comment' };
      }
      return { success: true, data: data };



   } catch (error) {
      console.log('comment error: ', error);
      return { success: false, msg: 'Không thể tạo comment' };
   }
}
//remove comment
export const removePostComment = async (commentId) => {
   try {
      const { error } = await supabase
         .from('comments')
         .delete()
         .eq('id', commentId)

      if (error) {
         console.log('remove comment error: ', error);
         return { success: false, msg: 'Không thể xóa comment post' };
      }
      return { success: true, data: { commentId } };



   } catch (error) {
      console.log('remove comment error: ', error);
      return { success: false, msg: 'Không thể xóa comment post' };
   }
}
// remove post
export const removePost = async (postId) => {
   try {
      const { error } = await supabase
         .from('posts')
         .delete()
         .eq('id', postId)

      if (error) {
         console.log('remove post error: ', error);
         return { success: false, msg: 'Không thể xóa post' };
      }
      return { success: true, data: { postId } };



   } catch (error) {
      console.log('remove post error: ', error);
      return { success: false, msg: 'Không thể xóa post' };
   }
}
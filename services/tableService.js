import { supabase } from '../lib/supabase' // ✅ GIỮ NGUYÊN IMPORT PATH NẾU ĐÚNG

export const fetchTable = async () => {
    try {
        const { data, error } = await supabase
            .from('tables')
            .select()

        // console.log('fetchTable data: ', data);

        if (error) {
            return { success: false, msg: error?.message };
        }
        return { success: true, data };

    } catch (error) {
        console.error('Error fetching table data:', error);
        return { success: false, msg: error.message }; // ✅ SỬA: succes -> success
    }
}

export const updateTableState = async (tableId, state) => {
    try {
        const { data, error } = await supabase
            .from('tables')
            .update({ state })
            .eq('id', tableId)
            .select();

        if (error) {
            console.log('updateTableState error: ', error);
            return { success: false, msg: 'Không thể cập nhật trạng thái bàn' };
        }
        return { success: true, data };
    } catch (error) {
        console.log('updateTableState error: ', error);
        return { success: false, msg: 'Có lỗi xảy ra khi cập nhật trạng thái bàn' };
    }
};
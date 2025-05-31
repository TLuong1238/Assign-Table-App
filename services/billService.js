import { supabase } from "../lib/supabase";

export const createBill = async (bill) => {
    try {
        console.log('createBill input:', bill);

        const { data, error } = await supabase
            .from('bills')
            .insert([bill])
            .select();

        console.log('createBill response:', { data, error });

        if (error) {
            console.log('createBill error details: ', error);
            return { success: false, msg: error.message || 'Không thể đặt bàn' };
        }
        return { success: true, data };
    } catch (error) {
        console.log('createBill catch error: ', error);
        return { success: false, msg: error.message || 'Không thể đặt bàn' };
    }
};

export const fetchBill = async () => {
    try {
        const { data, error } = await supabase
            .from('bills')
            .select('*')
            .order('created_at', { ascending: false });

        console.log('fetchBill data: ', data);
        if (error) {
            console.log('fetchBill error: ', error);
            return { success: false, msg: 'Không thể lấy dữ liệu đặt bàn' };
        }
        return { success: true, data: data };
    } catch (error) {
        console.log('fetchBill error: ', error);
        return { success: false, msg: 'Không thể lấy dữ liệu đặt bàn' };
    }
}


export const fetchBillByTimeRange = async (time) => {
    try {
        const targetDateTime = new Date(time);

        const startTime = new Date(targetDateTime.getTime() -  15 * 60 * 1000);
        const endTime = new Date(targetDateTime.getTime() +  15 * 60 * 1000);

        const { data, error } = await supabase
            .from('bills')
            .select('*')
            .gte('time', startTime.toISOString())
            .lte('time', endTime.toISOString())
            .order('time', { ascending: true });

        if (error) {
            console.log('fetchBillByTimeRange error: ', error);
            return { success: false, msg: 'Không thể lấy dữ liệu đặt bàn theo thời gian' };
        }

        return { success: true, data };
    } catch (error) {
        console.log('fetchBillByTimeRange error: ', error);
        return { success: false, msg: 'Có lỗi xảy ra khi lấy dữ liệu đặt bàn' };
    }
};
// detail
export const fetchDetailByBillIds = async (billIds) => {
    try {
        const { data, error } = await supabase
            .from('detailBills')
            .select('*')
            .in('billId', billIds);

        if (error) {
            console.log('fetchDetailByBillIds error: ', error);
            return { success: false, msg: 'Không thể lấy chi tiết bill' };
        }
        return { success: true, data };
    } catch (error) {
        console.log('fetchDetailByBillIds error: ', error);
        return { success: false, msg: 'Có lỗi xảy ra khi lấy chi tiết bill' };
    }
};
export const createDetail = async (billId, tableIds, peopleCount) => {
    try {
        let details = [];
        let remainingPeople = peopleCount;
        let tableIndex = 0;

        while (remainingPeople > 0 && tableIndex < tableIds.length) {
            const currentTableId = tableIds[tableIndex];

            const peopleForThisTable = Math.min(remainingPeople, 6);

            const detailsNeeded = Math.ceil(peopleForThisTable / 6);

            for (let i = 0; i < detailsNeeded; i++) {
                details.push({
                    billId,
                    tableId: currentTableId,
                });
            }

            remainingPeople -= peopleForThisTable;
            tableIndex++;
        }

        const { data, error } = await supabase
            .from('detailBills')
            .insert(details)
            .select();

        if (error) {
            console.log('createDetail error: ', error);
            return { success: false, msg: 'Không thể tạo chi tiết bill' };
        }
        return { success: true, data };
    } catch (error) {
        console.log('createDetail error: ', error);
        return { success: false, msg: 'Có lỗi xảy ra khi tạo chi tiết bill' };
    }
};
export const fetchBillByUser = async (userId) => {
    try {
        const { data, error } = await supabase
            .from('bills')
            .select('*')
            .eq('userId', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.log('fetchBillByUser error: ', error);
            return { success: false, msg: 'Không thể lấy dữ liệu bill của user' };
        }
        return { success: true, data };
    } catch (error) {
        console.log('fetchBillByUser error: ', error);
        return { success: false, msg: 'Có lỗi xảy ra khi lấy bill của user' };
    }
};
export const updateBill = async (billId, updateData) => {
  try {
    const { data, error } = await supabase
      .from('bills')
      .update(updateData)
      .eq('id', billId)
      .select();

    if (error) {
      console.log('updateBill error: ', error);
      return { success: false, msg: 'Không thể cập nhật bill' };
    }
    return { success: true, data };
  } catch (error) {
    console.log('updateBill error: ', error);
    return { success: false, msg: 'Có lỗi xảy ra khi cập nhật bill' };
  }
};
//updateBills expired
export const updateExpiredBills = async () => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    
    console.log('Checking for expired bills before:', today.toISOString());

    const { data: expiredBills, error: fetchError } = await supabase
      .from('bills')
      .select('*')
      .eq('state', 'in_order')
      .lt('time', today.toISOString());

    if (fetchError) {
      console.error('Error fetching expired bills:', fetchError);
      return { success: false, msg: fetchError.message };
    }

    if (!expiredBills || expiredBills.length === 0) {
      console.log('No expired bills found');
      return { success: true, data: [] };
    }

    console.log(`Found ${expiredBills.length} expired bills:`, expiredBills);

    const billIds = expiredBills.map(bill => bill.id);
    
    const { data: updatedBills, error: updateError } = await supabase
      .from('bills')
      .update({
        state: 'cancelled',
        visit: 'not_visited',
        updated_at: new Date().toISOString()
      })
      .in('id', billIds)
      .select();

    if (updateError) {
      console.error('Error updating expired bills:', updateError);
      return { success: false, msg: updateError.message };
    }

    console.log(`Successfully updated ${updatedBills.length} expired bills`);
    
    return { 
      success: true, 
      data: updatedBills,
      count: updatedBills.length 
    };

  } catch (error) {
    console.error('Error in updateExpiredBills:', error);
    return { success: false, msg: error.message };
  }
};

export const checkAndUpdateExpiredBills = async () => {
  try {
    console.log('=== STARTING EXPIRED BILLS CHECK ===');
    
    const result = await updateExpiredBills();
    
    if (result.success && result.count > 0) {
      console.log(`✅ Auto-cancelled ${result.count} expired bills`);
      
      // Alert.alert('Thông báo', `Đã tự động hủy ${result.count} đơn đặt bàn quá hạn`);
    }
    
    console.log('=== EXPIRED BILLS CHECK COMPLETED ===');
    return result;
    
  } catch (error) {
    console.error('Error in checkAndUpdateExpiredBills:', error);
    return { success: false, msg: error.message };
  }
};
import { supabase } from '../lib/supabase';

// ✅ Tạo cart detail cho bill
export const createCartDetail = async (billId, cartDetails) => {
  try {
    console.log('Creating cart details for bill:', billId);
    console.log('Cart details:', cartDetails);

    // Validate input
    if (!billId || !cartDetails || cartDetails.length === 0) {
      return {
        success: false,
        msg: 'Bill ID và cart details không được để trống'
      };
    }

    // Prepare data for insertion
    const detailsToInsert = cartDetails.map(detail => ({
      billId: billId,
      productId: detail.productId,
      num: detail.num,
      price: detail.price * detail.num // Tính tổng tiền cho mỗi item
    }));

    console.log('Details to insert:', detailsToInsert);

    // Insert cart details
    const { data, error } = await supabase
      .from('detailsCart')
      .insert(detailsToInsert)
      .select();

    if (error) {
      console.log('Error creating cart details:', error);
      return {
        success: false,
        msg: error.message
      };
    }

    console.log('Cart details created successfully:', data);

    // ✅ Tính tổng tiền và cập nhật bill
    const totalPrice = detailsToInsert.reduce((sum, detail) => sum + detail.price, 0);
    
    const updateResult = await updateBillPrice(billId, totalPrice);
    if (!updateResult.success) {
      console.log('Warning: Failed to update bill price:', updateResult.msg);
    }

    return {
      success: true,
      data: data,
      msg: 'Tạo cart details thành công'
    };

  } catch (error) {
    console.log('Error in createCartDetail:', error);
    return {
      success: false,
      msg: error.message
    };
  }
};

// ✅ Cập nhật tổng tiền của bill
export const updateBillPrice = async (billId, totalPrice) => {
  try {
    console.log('Updating bill price:', { billId, totalPrice });

    const { data, error } = await supabase
      .from('bills')
      .update({ 
        price: totalPrice,
        
      })
      .eq('id', billId)
      .select();

    if (error) {
      console.log('Error updating bill price:', error);
      return {
        success: false,
        msg: error.message
      };
    }

    console.log('Bill price updated successfully:', data);
    return {
      success: true,
      data: data,
      msg: 'Cập nhật tổng tiền thành công'
    };

  } catch (error) {
    console.log('Error in updateBillPrice:', error);
    return {
      success: false,
      msg: error.message
    };
  }
};

// ✅ Lấy cart details theo bill ID
export const fetchCartDetailsByBillId = async (billId) => {
  try {
    console.log('Fetching cart details for bill:', billId);

    const { data, error } = await supabase
      .from('detailsCart')
      .select(`
        *,
        products:productId (
          id,
          name,
          price,
          image,
          description
        )
      `)
      .eq('billId', billId);

    if (error) {
      console.log('Error fetching cart details:', error);
      return {
        success: false,
        msg: error.message
      };
    }

    console.log('Cart details fetched successfully:', data);
    return {
      success: true,
      data: data || [],
      msg: 'Lấy cart details thành công'
    };

  } catch (error) {
    console.log('Error in fetchCartDetailsByBillId:', error);
    return {
      success: false,
      msg: error.message
    };
  }
};

// ✅ Cập nhật số lượng cart detail
export const updateCartDetailQuantity = async (detailId, newQuantity, unitPrice) => {
  try {
    console.log('Updating cart detail quantity:', { detailId, newQuantity, unitPrice });

    if (newQuantity <= 0) {
      // Xóa detail nếu số lượng <= 0
      return await deleteCartDetail(detailId);
    }

    const newPrice = unitPrice * newQuantity;

    const { data, error } = await supabase
      .from('detailsCart')
      .update({ 
        num: newQuantity,
        price: newPrice
      })
      .eq('id', detailId)
      .select();

    if (error) {
      console.log('Error updating cart detail:', error);
      return {
        success: false,
        msg: error.message
      };
    }

    // Cập nhật lại tổng tiền bill
    if (data && data.length > 0) {
      const billId = data[0].billId;
      await recalculateBillPrice(billId);
    }

    console.log('Cart detail updated successfully:', data);
    return {
      success: true,
      data: data,
      msg: 'Cập nhật cart detail thành công'
    };

  } catch (error) {
    console.log('Error in updateCartDetailQuantity:', error);
    return {
      success: false,
      msg: error.message
    };
  }
};

// ✅ Xóa cart detail
export const deleteCartDetail = async (detailId) => {
  try {
    console.log('Deleting cart detail:', detailId);

    // Lấy thông tin bill trước khi xóa
    const { data: detailData } = await supabase
      .from('detailsCart')
      .select('billId')
      .eq('id', detailId)
      .single();

    const { data, error } = await supabase
      .from('detailsCart')
      .delete()
      .eq('id', detailId)
      .select();

    if (error) {
      console.log('Error deleting cart detail:', error);
      return {
        success: false,
        msg: error.message
      };
    }

    // Cập nhật lại tổng tiền bill
    if (detailData?.billId) {
      await recalculateBillPrice(detailData.billId);
    }

    console.log('Cart detail deleted successfully:', data);
    return {
      success: true,
      data: data,
      msg: 'Xóa cart detail thành công'
    };

  } catch (error) {
    console.log('Error in deleteCartDetail:', error);
    return {
      success: false,
      msg: error.message
    };
  }
};

// ✅ Tính lại tổng tiền bill dựa trên cart details
export const recalculateBillPrice = async (billId) => {
  try {
    console.log('Recalculating bill price for:', billId);

    // Lấy tất cả cart details của bill
    const { data: cartDetails, error } = await supabase
      .from('detailsCart')
      .select('price')
      .eq('billId', billId);

    if (error) {
      console.log('Error fetching cart details for recalculation:', error);
      return {
        success: false,
        msg: error.message
      };
    }

    // Tính tổng tiền
    const totalPrice = cartDetails?.reduce((sum, detail) => sum + (detail.price || 0), 0) || 0;

    // Cập nhật bill
    return await updateBillPrice(billId, totalPrice);

  } catch (error) {
    console.log('Error in recalculateBillPrice:', error);
    return {
      success: false,
      msg: error.message
    };
  }
};

// ✅ Xóa tất cả cart details của bill
export const clearCartDetailsByBillId = async (billId) => {
  try {
    console.log('Clearing all cart details for bill:', billId);

    const { data, error } = await supabase
      .from('detailsCart')
      .delete()
      .eq('billId', billId)
      .select();

    if (error) {
      console.log('Error clearing cart details:', error);
      return {
        success: false,
        msg: error.message
      };
    }

    // Reset bill price to 0
    await updateBillPrice(billId, 0);

    console.log('Cart details cleared successfully:', data);
    return {
      success: true,
      data: data,
      msg: 'Xóa tất cả cart details thành công'
    };

  } catch (error) {
    console.log('Error in clearCartDetailsByBillId:', error);
    return {
      success: false,
      msg: error.message
    };
  }
};
import { supabase } from '../lib/supabase';
import { PAYMENT_CONFIG, TimeUtils } from '../constants/paymentConfig';

// ✅ THÊM FUNCTION KIỂM TRA PAYMENT REQUIREMENT
const getPaymentRequirement = (appointmentTime, cartPrice, isVip = false) => {
  return TimeUtils.getPaymentRequirement(appointmentTime, cartPrice, isVip);
};

// ✅ SỬA FUNCTION TẠO BILL - THÊM LOGIC THỜI GIAN
export const createBill = async (billData) => {
  try {
    console.log('📋 Creating bill with data:', billData);
    
    // ✅ KIỂM TRA VÀ XÁC ĐỊNH PAYMENT STATUS THEO THỜI GIAN
    let finalBillData = { ...billData };
    
    if (billData.time && !billData.payment_status) {
      const appointmentTime = new Date(billData.time);
      const paymentReq = getPaymentRequirement(
        appointmentTime, 
        billData.price || 0, 
        billData.payment_method === 'vip'
      );
      
      finalBillData.payment_status = paymentReq.status;
      
      if (!billData.payment_method && paymentReq.method) {
        finalBillData.payment_method = paymentReq.method;
      }
      
      console.log('✅ Payment requirement determined:', paymentReq);
    }
    
    // ✅ XÁC ĐỊNH DEPOSIT AMOUNT THEO THỜI GIAN
    if (finalBillData.time && typeof finalBillData.deposit_amount === 'undefined') {
      const appointmentTime = new Date(finalBillData.time);
      const hasFood = (finalBillData.price || 0) > 0;
      const isVip = finalBillData.payment_method === 'vip';
      
      if (!TimeUtils.isDepositRequired(appointmentTime, isVip)) {
        finalBillData.deposit_amount = 0;
        console.log('⏰ No deposit required - appointment > 24h ahead');
      } else {
        // Giữ nguyên logic cũ cho trường hợp cần cọc
        if (hasFood) {
          finalBillData.deposit_amount = Math.max(
            (finalBillData.price || 0) * PAYMENT_CONFIG.DEPOSIT_PERCENTAGE,
            PAYMENT_CONFIG.MIN_DEPOSIT_AMOUNT
          );
        } else {
          finalBillData.deposit_amount = PAYMENT_CONFIG.TABLE_DEPOSIT;
        }
        console.log('💰 Deposit required - appointment < 24h ahead');
      }
    }
    
    console.log('📋 Final bill data:', finalBillData);
    
    const { data, error } = await supabase
      .from('bills')
      .insert([finalBillData])
      .select();

    if (error) {
      console.error('❌ Error creating bill:', error);
      return { success: false, msg: error.message, data: null };
    }

    console.log('✅ Bill created successfully:', data[0]?.id);
    return { success: true, msg: 'Bill created successfully', data };
  } catch (error) {
    console.error('❌ Exception in createBill:', error);
    return { success: false, msg: error.message || 'Unknown error', data: null };
  }
};

// ✅ THÊM FUNCTION UPDATE BILL PAYMENT STATUS
export const updateBillPaymentStatus = async (billId, paymentStatus, paymentMethod = null, paymentId = null) => {
  try {
    console.log(`📋 Updating bill ${billId} payment status to:`, paymentStatus);
    
    const updateData = {
      payment_status: paymentStatus,
      updated_at: new Date().toISOString()
    };
    
    if (paymentMethod) {
      updateData.payment_method = paymentMethod;
    }
    
    if (paymentId) {
      updateData.payment_id = paymentId;
    }
    
    const { data, error } = await supabase
      .from('bills')
      .update(updateData)
      .eq('id', billId)
      .select();

    if (error) {
      console.error('❌ Error updating bill payment status:', error);
      return { success: false, msg: error.message, data: null };
    }

    console.log('✅ Bill payment status updated successfully');
    return { success: true, msg: 'Bill payment status updated', data };
  } catch (error) {
    console.error('❌ Exception in updateBillPaymentStatus:', error);
    return { success: false, msg: error.message || 'Unknown error', data: null };
  }
};

// ✅ THÊM FUNCTION KIỂM TRA BILL CÓ CẦN THANH TOÁN KHÔNG
export const checkBillPaymentRequirement = async (billId) => {
  try {
    const { data, error } = await supabase
      .from('bills')
      .select('time, price, payment_method, payment_status')
      .eq('id', billId)
      .single();

    if (error) {
      console.error('❌ Error fetching bill for payment check:', error);
      return { success: false, msg: error.message, data: null };
    }

    const appointmentTime = new Date(data.time);
    const isVip = data.payment_method === 'vip';
    const paymentReq = getPaymentRequirement(appointmentTime, data.price || 0, isVip);
    
    return { 
      success: true, 
      msg: 'Payment requirement checked', 
      data: {
        ...data,
        paymentRequirement: paymentReq
      }
    };
  } catch (error) {
    console.error('❌ Exception in checkBillPaymentRequirement:', error);
    return { success: false, msg: error.message || 'Unknown error', data: null };
  }
};

export const createDetail = async (billId, tableIds, peopleCount) => {
  try {
    console.log('📋 Creating detail bills for:', { billId, tableIds, peopleCount });
    
    if (!Array.isArray(tableIds) || tableIds.length === 0) {
      return { success: false, msg: 'No tables provided', data: null };
    }

    const detailBills = tableIds.map(tableId => ({
      billId: billId,
      tableId: tableId,
      peopleCount: Math.ceil(peopleCount / tableIds.length)
    }));

    const { data, error } = await supabase
      .from('detailBills')
      .insert(detailBills)
      .select();

    if (error) {
      console.error('❌ Error creating detail bills:', error);
      return { success: false, msg: error.message, data: null };
    }

    console.log('✅ Detail bills created successfully');
    return { success: true, msg: 'Detail bills created successfully', data };
  } catch (error) {
    console.error('❌ Exception in createDetail:', error);
    return { success: false, msg: error.message || 'Unknown error', data: null };
  }
};

export const fetchBillByTimeRange = async (targetTime) => {
  try {
    const targetDate = new Date(targetTime);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from('bills')
      .select('*')
      .gte('time', startOfDay.toISOString())
      .lte('time', endOfDay.toISOString())
      .order('time', { ascending: true });

    if (error) {
      console.error('❌ Error fetching bills by time range:', error);
      return { success: false, msg: error.message, data: [] };
    }

    return { success: true, msg: 'Bills fetched successfully', data: data || [] };
  } catch (error) {
    console.error('❌ Exception in fetchBillByTimeRange:', error);
    return { success: false, msg: error.message || 'Unknown error', data: [] };
  }
};

export const fetchDetailByBillIds = async (billIds) => {
  try {
    if (!Array.isArray(billIds) || billIds.length === 0) {
      return { success: true, msg: 'No bill IDs provided', data: [] };
    }

    const { data, error } = await supabase
      .from('detailBills')
      .select('*')
      .in('billId', billIds);

    if (error) {
      console.error('❌ Error fetching detail bills:', error);
      return { success: false, msg: error.message, data: [] };
    }

    return { success: true, msg: 'Detail bills fetched successfully', data: data || [] };
  } catch (error) {
    console.error('❌ Exception in fetchDetailByBillIds:', error);
    return { success: false, msg: error.message || 'Unknown error', data: [] };
  }
};

// ✅ THÊM FUNCTION FETCH BILLS WITH PAYMENT REQUIREMENT CHECK
export const fetchBillsWithPaymentCheck = async (userId) => {
  try {
    console.log('📋 Fetching bills with payment requirement check for user:', userId);
    
    const { data, error } = await supabase
      .from('bills')
      .select(`
        *,
        details:detailBills(
          tableId
        )
      `)
      .eq('userId', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching bills:', error);
      return { success: false, msg: error.message, data: [] };
    }

    // ✅ KIỂM TRA PAYMENT REQUIREMENT CHO MỖI BILL
    const billsWithPaymentCheck = data.map(bill => {
      const appointmentTime = new Date(bill.time);
      const isVip = bill.payment_method === 'vip';
      const paymentReq = getPaymentRequirement(appointmentTime, bill.price || 0, isVip);
      
      return {
        ...bill,
        paymentRequirement: paymentReq,
        hoursUntilAppointment: TimeUtils.calculateHoursUntilAppointment(appointmentTime)
      };
    });

    console.log('✅ Bills fetched with payment requirement check');
    return { 
      success: true, 
      msg: 'Bills fetched successfully', 
      data: billsWithPaymentCheck 
    };
  } catch (error) {
    console.error('❌ Exception in fetchBillsWithPaymentCheck:', error);
    return { success: false, msg: error.message || 'Unknown error', data: [] };
  }
};

// ✅ THÊM FUNCTION AUTO UPDATE PAYMENT STATUS THEO THỜI GIAN
export const autoUpdatePaymentStatusByTime = async () => {
  try {
    console.log('🔄 Running auto update payment status by time...');
    
    // Lấy tất cả bills có payment_status = 'no_payment_required' và thời gian < 24h
    const { data: bills, error } = await supabase
      .from('bills')
      .select('id, time, price, payment_method, payment_status')
      .eq('payment_status', PAYMENT_CONFIG.BILL_PAYMENT_STATUS.NO_PAYMENT_REQUIRED)
      .eq('state', 'in_order');

    if (error) {
      console.error('❌ Error fetching bills for auto update:', error);
      return { success: false, msg: error.message, data: null };
    }

    let updatedCount = 0;
    
    for (const bill of bills) {
      const appointmentTime = new Date(bill.time);
      const hoursUntil = TimeUtils.calculateHoursUntilAppointment(appointmentTime);
      
      // Nếu còn < 24h và chưa thanh toán thì cần chuyển sang pending
      if (hoursUntil < PAYMENT_CONFIG.TIME_RULES.NO_DEPOSIT_HOURS) {
        const updateResult = await updateBillPaymentStatus(
          bill.id, 
          PAYMENT_CONFIG.BILL_PAYMENT_STATUS.PENDING
        );
        
        if (updateResult.success) {
          updatedCount++;
          console.log(`✅ Updated bill ${bill.id} from no_payment_required to pending`);
        }
      }
    }
    
    console.log(`✅ Auto update completed. Updated ${updatedCount} bills.`);
    return { 
      success: true, 
      msg: `Auto update completed. Updated ${updatedCount} bills.`, 
      data: { updatedCount } 
    };
  } catch (error) {
    console.error('❌ Exception in autoUpdatePaymentStatusByTime:', error);
    return { success: false, msg: error.message || 'Unknown error', data: null };
  }
};

// ✅ THÊM FUNCTION VALIDATE BILL BEFORE PAYMENT
export const validateBillBeforePayment = async (billId) => {
  try {
    const checkResult = await checkBillPaymentRequirement(billId);
    
    if (!checkResult.success) {
      return checkResult;
    }
    
    const { paymentRequirement, payment_status, time } = checkResult.data;
    const appointmentTime = new Date(time);
    const hoursUntil = TimeUtils.calculateHoursUntilAppointment(appointmentTime);
    
    // Kiểm tra bill có còn valid để thanh toán không
    if (hoursUntil < 0) {
      return {
        success: false,
        msg: 'Bill has expired - appointment time has passed',
        data: { expired: true }
      };
    }
    
    // Kiểm tra payment requirement có thay đổi không
    if (!paymentRequirement.required && payment_status !== PAYMENT_CONFIG.BILL_PAYMENT_STATUS.NO_PAYMENT_REQUIRED) {
      return {
        success: false,
        msg: 'Payment requirement has changed - no payment needed',
        data: { paymentRequirementChanged: true, newRequirement: paymentRequirement }
      };
    }
    
    return {
      success: true,
      msg: 'Bill is valid for payment',
      data: {
        valid: true,
        paymentRequirement,
        hoursUntil
      }
    };
  } catch (error) {
    console.error('❌ Exception in validateBillBeforePayment:', error);
    return { success: false, msg: error.message || 'Unknown error', data: null };
  }
};

// Export thêm các utilities
export const BillUtils = {
  getPaymentRequirement,
  ...TimeUtils
};
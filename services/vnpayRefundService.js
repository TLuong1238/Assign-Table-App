// services/vnpayRefundService.js - TẠO FILE MỚI
import { supabase } from '../lib/supabase';
import { VNPAY_CONFIG } from '../constants/vnpayConfig';

export const VNPayRefundService = {
    // ✅ SIMULATE HOÀN TIỀN (DEMO)
    simulateRefund: async (refundData) => {
        try {
            console.log('🔄 Simulating VNPay refund:', refundData);

            const {
                billId,
                originalAmount,
                refundAmount,
                refundReason,
                userId,
                transactionNo
            } = refundData;

            // ✅ VALIDATE REFUND DATA
            if (!billId || !originalAmount || !refundAmount || !userId) {
                throw new Error('Missing required refund data');
            }

            if (refundAmount > originalAmount) {
                throw new Error('Refund amount cannot exceed original amount');
            }

            // ✅ GENERATE REFUND TRANSACTION
            const refundTxnRef = `REFUND_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const refundOrderInfo = `Hoan tien don hang ${billId} - ${refundReason}`;

            // ✅ SIMULATE VNPAY REFUND RESPONSE (DEMO)
            const simulatedResponse = {
                vnp_ResponseCode: '00', // Success
                vnp_TransactionStatus: '00', // Success
                vnp_TxnRef: refundTxnRef,
                vnp_Amount: refundAmount * 100, // VNPay uses cents
                vnp_OrderInfo: refundOrderInfo,
                vnp_TransactionNo: `RF${Date.now()}`,
                vnp_BankCode: 'DEMO',
                vnp_PayDate: new Date().toISOString().replace(/[-T:]/g, '').slice(0, 14),
                vnp_RefundAmount: refundAmount * 100,
                vnp_RefundTransactionNo: `RF${Date.now()}`,
                vnp_Message: 'Giao dich hoan tien thanh cong',
                isSuccess: true,
                isDemoRefund: true
            };

            console.log('✅ Simulated refund response:', simulatedResponse);

            // ✅ SAVE REFUND TO DATABASE
            const { data: refundRecord, error: refundError } = await supabase
                .from('refunds')
                .insert([
                    {
                        bill_id: billId,
                        user_id: userId,
                        original_amount: originalAmount,
                        refund_amount: refundAmount,
                        refund_reason: refundReason,
                        original_transaction_no: transactionNo,
                        refund_transaction_no: simulatedResponse.vnp_RefundTransactionNo,
                        vnp_response_code: simulatedResponse.vnp_ResponseCode,
                        vnp_transaction_status: simulatedResponse.vnp_TransactionStatus,
                        status: 'completed',
                        refund_method: 'vnpay_demo',
                        refund_data: simulatedResponse,
                        created_at: new Date().toISOString(),
                        completed_at: new Date().toISOString()
                    }
                ])
                .select()
                .single();

            if (refundError) {
                console.error('❌ Error saving refund:', refundError);
                throw new Error('Failed to save refund record');
            }

            console.log('✅ Refund saved:', refundRecord);

            // ✅ UPDATE BILL STATUS
            const { error: billUpdateError } = await supabase
                .from('bills')
                .update({
                    state: 'cancelled',
                    visit: 'un_visited',
                    refund_amount: refundAmount,
                    refund_status: 'completed',
                    updated_at: new Date().toISOString()
                })
                .eq('id', billId);

            if (billUpdateError) {
                console.error('❌ Error updating bill:', billUpdateError);
                throw new Error('Failed to update bill status');
            }

            return {
                success: true,
                data: {
                    refund: refundRecord,
                    vnpayResponse: simulatedResponse,
                    message: 'Hoàn tiền thành công (Demo)'
                }
            };

        } catch (error) {
            console.error('❌ Refund simulation error:', error);
            return {
                success: false,
                message: error.message
            };
        }
    },

    // ✅ GET REFUND HISTORY
    getRefundHistory: async (userId, billId = null) => {
        try {
            let query = supabase
                .from('refunds')
                .select(`
          *,
          bills (
            id,
            name,
            phone,
            time,
            total_amount
          )
        `)
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (billId) {
                query = query.eq('bill_id', billId);
            }

            const { data, error } = await query;

            if (error) {
                throw new Error(error.message);
            }

            return {
                success: true,
                data: data || []
            };

        } catch (error) {
            console.error('❌ Get refund history error:', error);
            return {
                success: false,
                message: error.message
            };
        }
    },

    // ✅ VALIDATE REFUND ELIGIBILITY
    validateRefundEligibility: async (billId) => {
        try {
            const { data: bill, error } = await supabase
                .from('bills')
                .select('*')
                .eq('id', billId)
                .single();

            if (error) {
                throw new Error('Bill not found');
            }

            // ✅ CHECK REFUND CONDITIONS
            const conditions = {
                canRefund: false,
                reasons: [],
                maxRefundAmount: 0,
                refundDeadline: null
            };

            // ✅ CHECK IF ALREADY REFUNDED
            if (bill.state === 'refunded') {
                conditions.reasons.push('Đơn hàng đã được hoàn tiền');
                return { success: true, data: conditions };
            }

            // ✅ CHECK IF CANCELLED
            if (bill.state === 'cancelled') {
                conditions.reasons.push('Đơn hàng đã bị hủy');
                return { success: true, data: conditions };
            }

            // ✅ CHECK PAYMENT STATUS
            if (bill.payment_status !== 'deposit_paid' && bill.payment_status !== 'fully_paid') {
                conditions.reasons.push('Chưa thanh toán để có thể hoàn tiền');
                return { success: true, data: conditions };
            }

            // ✅ KIỂM TRA PHƯƠNG THỨC THANH TOÁN - CHỈ ONLINE MỚI HOÀN
            if (bill.payment_method === 'counter' || bill.payment_method === 'cash') {
                conditions.reasons.push('Thanh toán tại quầy/tiền mặt không thể hoàn tiền online');
                return { success: true, data: conditions };
            }

            // ✅ CHỈ CHO PHÉP HOÀN TIỀN VNPAY
            if (bill.payment_method !== 'vnpay') {
                conditions.reasons.push('Chỉ hỗ trợ hoàn tiền cho thanh toán VNPay');
                return { success: true, data: conditions };
            }

            // ✅ CHECK TIME CONSTRAINTS
            const billTime = new Date(bill.time);
            const now = new Date();
            const diffHours = (billTime.getTime() - now.getTime()) / (1000 * 60 * 60); // ✅ ĐẢO NGƯỢC: billTime - now

            // ✅ LOGIC HOÀN TIỀN THEO THỜI GIAN MỚI
            if (diffHours < 2) {
                conditions.reasons.push('Không được hủy/hoàn tiền khi còn ít hơn 2 giờ đến thời gian đặt');
                return { success: true, data: conditions };
            }

            if (diffHours < 24) {
                conditions.reasons.push('Không được hoàn tiền khi còn ít hơn 24 giờ đến thời gian đặt');
                return { success: true, data: conditions };
            }
            // ✅ DETERMINE REFUND AMOUNT
            let maxRefundAmount = 0;
            if (bill.payment_status === 'deposit_paid') {
                maxRefundAmount = bill.deposit_amount || 0;
            } else if (bill.payment_status === 'fully_paid') {
                maxRefundAmount = bill.total_amount || 0;
            }

            // ✅ CALCULATE REFUND DEADLINE
            const refundDeadline = new Date(billTime.getTime() + 24 * 60 * 60 * 1000);

            conditions.canRefund = true;
            conditions.maxRefundAmount = maxRefundAmount;
            conditions.refundDeadline = refundDeadline;

            return {
                success: true,
                data: conditions
            };

        } catch (error) {
            console.error('❌ Validate refund eligibility error:', error);
            return {
                success: false,
                message: error.message
            };
        }
    }
};
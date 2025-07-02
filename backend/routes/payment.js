// backend/routes/payment.js
const express = require('express');
const router = express.Router();
const moment = require('moment');
const crypto = require('crypto');
const { supabase } = require('../config/supabase');

const VNPAY_CONFIG = {
  vnp_TmnCode: 'BIKN7UYP',
  vnp_HashSecret: 'Q626P0V8P522OBROKPJ79K7HW5K952TD',
  vnp_Url: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
  vnp_Api: 'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction',
  vnp_ReturnUrl: 'http://localhost:8888/payment/vnpay_return'
};

// ✅ Tạo payment URL (tương tự POST /create_payment_url)
router.post('/create_payment_url', async (req, res) => {
  try {
    process.env.TZ = 'Asia/Ho_Chi_Minh';
    
    const { userId, billId, amount, description } = req.body;
    
    const date = new Date();
    const createDate = moment(date).format('YYYYMMDDHHmmss');
    
    const ipAddr = req.headers['x-forwarded-for'] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      req.connection.socket.remoteAddress;

    const orderId = moment(date).format('DDHHmmss') + '_' + Math.random().toString(36).substr(2, 5);
    
    // ✅ Lưu payment vào database trước
    const { data: payment, error } = await supabase
      .from('payments')
      .insert([{
        id: orderId,
        user_id: userId,
        bill_id: billId,
        amount: amount,
        description: description,
        status: 'pending',
        payment_method: 'vnpay',
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;

    // ✅ Tạo VNPay parameters
    const vnp_Params = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: VNPAY_CONFIG.vnp_TmnCode,
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: orderId,
      vnp_OrderInfo: description || `Thanh toan cho ma GD:${orderId}`,
      vnp_OrderType: 'other',
      vnp_Amount: amount * 100,
      vnp_ReturnUrl: VNPAY_CONFIG.vnp_ReturnUrl,
      vnp_IpAddr: ipAddr,
      vnp_CreateDate: createDate
    };

    // ✅ Sort và tạo signature
    const sortedParams = sortObject(vnp_Params);
    const querystring = require('qs');
    const signData = querystring.stringify(sortedParams, { encode: false });
    const hmac = crypto.createHmac('sha512', VNPAY_CONFIG.vnp_HashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
    
    sortedParams.vnp_SecureHash = signed;
    const vnpUrl = VNPAY_CONFIG.vnp_Url + '?' + querystring.stringify(sortedParams, { encode: false });

    res.json({
      success: true,
      data: {
        paymentUrl: vnpUrl,
        orderId: orderId,
        payment: payment
      }
    });

  } catch (error) {
    console.error('Create payment URL error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ✅ VNPay return URL (tương tự GET /vnpay_return)
router.get('/vnpay_return', async (req, res) => {
  try {
    let vnp_Params = req.query;
    const secureHash = vnp_Params['vnp_SecureHash'];

    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    vnp_Params = sortObject(vnp_Params);

    const querystring = require('qs');
    const signData = querystring.stringify(vnp_Params, { encode: false });
    const hmac = crypto.createHmac('sha512', VNPAY_CONFIG.vnp_HashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    const orderId = vnp_Params['vnp_TxnRef'];
    const responseCode = vnp_Params['vnp_ResponseCode'];

    if (secureHash === signed) {
      // ✅ Cập nhật payment status
      const status = responseCode === '00' ? 'completed' : 'failed';
      
      const { error } = await supabase
        .from('payments')
        .update({
          status: status,
          vnpay_response: vnp_Params,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) console.error('Update payment error:', error);

      // ✅ Redirect về app với deep link
      if (responseCode === '00') {
        res.redirect(`myapp://payment/success?orderId=${orderId}`);
      } else {
        res.redirect(`myapp://payment/failure?orderId=${orderId}&code=${responseCode}`);
      }
    } else {
      res.redirect(`myapp://payment/failure?orderId=${orderId}&code=97`);
    }

  } catch (error) {
    console.error('VNPay return error:', error);
    res.redirect(`myapp://payment/failure?error=${encodeURIComponent(error.message)}`);
  }
});

// ✅ VNPay IPN (tương tự GET /vnpay_ipn)
router.get('/vnpay_ipn', async (req, res) => {
  try {
    let vnp_Params = req.query;
    const secureHash = vnp_Params['vnp_SecureHash'];
    
    const orderId = vnp_Params['vnp_TxnRef'];
    const rspCode = vnp_Params['vnp_ResponseCode'];

    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    vnp_Params = sortObject(vnp_Params);
    
    const querystring = require('qs');
    const signData = querystring.stringify(vnp_Params, { encode: false });
    const hmac = crypto.createHmac('sha512', VNPAY_CONFIG.vnp_HashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
    
    // ✅ Kiểm tra payment tồn tại
    const { data: payment, error } = await supabase
      .from('payments')
      .select('*')
      .eq('id', orderId)
      .single();

    const checkOrderId = !error && payment;
    const checkAmount = payment && (vnp_Params['vnp_Amount'] == payment.amount * 100);
    const paymentStatus = payment ? payment.status : null;
    
    if (secureHash === signed) {
      if (checkOrderId) {
        if (checkAmount) {
          if (paymentStatus === 'pending') {
            const newStatus = rspCode === '00' ? 'completed' : 'failed';
            
            // ✅ Cập nhật payment status
            await supabase
              .from('payments')
              .update({
                status: newStatus,
                vnpay_response: vnp_Params,
                updated_at: new Date().toISOString()
              })
              .eq('id', orderId);

            res.status(200).json({ RspCode: '00', Message: 'Success' });
          } else {
            res.status(200).json({ RspCode: '02', Message: 'This order has been updated to the payment status' });
          }
        } else {
          res.status(200).json({ RspCode: '04', Message: 'Amount invalid' });
        }
      } else {
        res.status(200).json({ RspCode: '01', Message: 'Order not found' });
      }
    } else {
      res.status(200).json({ RspCode: '97', Message: 'Checksum failed' });
    }

  } catch (error) {
    console.error('VNPay IPN error:', error);
    res.status(200).json({ RspCode: '99', Message: 'Unknown error' });
  }
});

// ✅ Sort object function từ code mẫu
function sortObject(obj) {
  const sorted = {};
  const str = [];
  let key;
  
  for (key in obj) {
    if (obj.hasOwnProperty(key)) {
      str.push(encodeURIComponent(key));
    }
  }
  
  str.sort();
  
  for (key = 0; key < str.length; key++) {
    sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, '+');
  }
  
  return sorted;
}

module.exports = router;
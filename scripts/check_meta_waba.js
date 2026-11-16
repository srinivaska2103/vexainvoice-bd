const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const axios = require('axios');

const token = process.env.WHATSAPP_ACCESS_TOKEN;
const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

async function checkMeta() {
  try {
    const resWaba = await axios.get(`https://graph.facebook.com/v20.0/${wabaId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('WABA info:', resWaba.data);

    const resPhone = await axios.get(`https://graph.facebook.com/v20.0/${phoneId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Phone info:', resPhone.data);
  } catch (err) {
    console.error('Meta Check Error:', err.response?.data || err.message);
  }
}

checkMeta();


const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const axios = require('axios');

const token = process.env.WHATSAPP_ACCESS_TOKEN;
const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

const orderReceiptTemplate = {
  name: 'vexa_order_receipt',
  category: 'UTILITY',
  language: 'en',
  components: [
    {
      type: 'BODY',
      text: 'Hello {{1}},\n\nYour order has been successfully recorded with {{2}}.\n\nOrder Number: {{3}}\nOrder Date: {{4}}\nTotal Amount: {{5}}\nPayment Status: {{6}}\n\nThank you for shopping with us!\n\nFor any order-related assistance, please contact {{2}}.\n\nTeam VEXA',
      example: {
        body_text: [
          ['Priya', 'ASVA Textiles', 'ORD-8941', '10-Nov-2026', '₹2,350.00', 'PAID']
        ]
      }
    },
    {
      type: 'FOOTER',
      text: 'Vexa Invoice'
    }
  ]
};

async function fix() {
  try {
    const res = await axios.post(
      `https://graph.facebook.com/v20.0/${wabaId}/message_templates`,
      orderReceiptTemplate,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log(`✅ Success: vexa_order_receipt -> ID:`, res.data.id, 'Status:', res.data.status);
  } catch (err) {
    console.error('Error:', JSON.stringify(err.response?.data || err.message));
  }
}

fix();


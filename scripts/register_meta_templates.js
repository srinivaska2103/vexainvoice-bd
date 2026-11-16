const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const axios = require('axios');

const token = process.env.WHATSAPP_ACCESS_TOKEN;
const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

const templatesToRegister = [
  {
    name: 'vexa_low_stock_alert',
    category: 'UTILITY',
    language: 'en',
    components: [
      {
        type: 'BODY',
        text: 'Low Stock Alert!\n\nHello {{1}},\n\nThis is a low stock alert from VEXA Invoice.\n\nYour product {{2}} is running low on stock.\n\nCurrent Stock: {{3}}\nMinimum Stock Level: {{4}}\n\nPlease review your inventory and restock the product to avoid stock shortages.',
        example: {
          body_text: [
            ['Srinivas', 'Cotton Shirt XL', '3', '10']
          ]
        }
      },
      {
        type: 'FOOTER',
        text: 'Vexa Invoice'
      }
    ]
  },
  {
    name: 'vexa_subscription_reminder',
    category: 'UTILITY',
    language: 'en',
    components: [
      {
        type: 'BODY',
        text: 'Subscription Reminder!\n\nHello {{1}},\n\nThis is a reminder about your VEXA Invoice subscription.\n\nYour {{2}} plan is scheduled to expire on {{3}}.\n\nSubscription Amount: {{4}}\n\nPlease renew your subscription before the expiry date to continue using your subscribed features without interruption.\n\nThank you for choosing VEXA Invoice!',
        example: {
          body_text: [
            ['Srinivas', 'Growth Monthly', '15-Dec-2026', '₹999']
          ]
        }
      },
      {
        type: 'FOOTER',
        text: 'Vexa Invoice'
      }
    ]
  },
  {
    name: 'vexa_new_offers_campaign',
    category: 'MARKETING',
    language: 'en',
    components: [
      {
        type: 'BODY',
        text: 'Grab Your Offer!\n\nHello {{1}} from {{2}}\n\nWe have exciting news for your business!\n\n{{3}}\n\nOffer: {{4}}\nValid Until: {{5}}\n\nExplore the latest opportunities and make the most of this offer.\n\nThank you for being part of {{2}}!\n\nGrab Soon!',
        example: {
          body_text: [
            ['Rahul', 'ASVA Textiles', 'Festive Season Clearance Sale', 'Flat 20% Off on all silk sarees', '30-Nov-2026']
          ]
        }
      },
      {
        type: 'FOOTER',
        text: 'Vexa Invoice'
      }
    ]
  },
  {
    name: 'vexa_new_product_announcement',
    category: 'MARKETING',
    language: 'en',
    components: [
      {
        type: 'BODY',
        text: 'New Product Announcement!\n\nHello {{1}}!\n\nWe are excited to introduce something new!\n\nProduct: {{2}}\nDescription: {{3}}\nPrice: {{4}}\n\nDiscover our latest product and explore its features.\n\nThank you for being part of {{5}}.\n\nContact us to know more!',
        example: {
          body_text: [
            ['Customer', 'Premium Linen Shirt', 'Breathable 100% linen formal shirt', '₹1,499', 'ASVA Textiles']
          ]
        }
      },
      {
        type: 'FOOTER',
        text: 'Vexa Invoice'
      }
    ]
  },
  {
    name: 'vexa_payment_overdue',
    category: 'UTILITY',
    language: 'en',
    components: [
      {
        type: 'BODY',
        text: 'Hello {{1}},\n\nPAYMENT REMINDER\n\nShop: {{2}}\n\nYour payment is overdue.\n\nInvoice Number: {{3}}\nOutstanding Amount: {{4}}\nDue Date: {{5}}\n\nKindly arrange the pending payment at your earliest convenience.\n\nFor assistance, contact {{2}}.\n\nThank you!',
        example: {
          body_text: [
            ['Anand Traders', 'ASVA Textiles', 'INV-2026-0042', '₹4,500.00', '01-Nov-2026']
          ]
        }
      }
    ]
  },
  {
    name: 'vexa_order_receipt',
    category: 'UTILITY',
    language: 'en',
    components: [
      {
        type: 'BODY',
        text: 'Hello {{1}},\n\nYour order has been successfully recorded with {{2}}.\n\nOrder Number: {{3}}\nOrder Date: {{4}}\nTotal Amount: {{5}}\nPayment Status: {{6}}\n\nThank you for shopping with us!\n\nFor any order-related assistance, please contact {{2}}.',
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
  },
  {
    name: 'vexa_thank_you_purchase',
    category: 'UTILITY',
    language: 'en',
    components: [
      {
        type: 'BODY',
        text: 'Thank You for Purchasing!\n\nHello {{1}},\n\nThank you for purchasing from {{2}}!\n\nWe truly appreciate your trust and support.\n\nInvoice Number: {{3}}\nPurchase Amount: {{4}}\n\nWe look forward to serving you again.\n\nThank you for choosing us!',
        example: {
          body_text: [
            ['Priya', 'ASVA Textiles', 'INV-1093', '₹2,350.00']
          ]
        }
      },
      {
        type: 'FOOTER',
        text: 'Vexa Invoice'
      }
    ]
  }
];

async function submitTemplates() {
  console.log(`Starting registration of 7 VEXA templates on WABA: ${wabaId}...`);
  for (const tpl of templatesToRegister) {
    try {
      console.log(`Submitting ${tpl.name} (${tpl.category})...`);
      const res = await axios.post(
        `https://graph.facebook.com/v20.0/${wabaId}/message_templates`,
        tpl,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log(`✅ Success: ${tpl.name} -> ID:`, res.data.id, 'Status:', res.data.status);
    } catch (err) {
      if (err.response?.data?.error?.message?.includes('already exists')) {
        console.log(`ℹ️ Already exists on Meta: ${tpl.name}`);
      } else {
        console.error(`❌ Error submitting ${tpl.name}:`, JSON.stringify(err.response?.data || err.message));
      }
    }
  }
}

submitTemplates();


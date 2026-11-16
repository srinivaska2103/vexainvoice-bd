/**
 * Complete, verified, production-accurate FAQs data for VEXA Invoice.
 * Covers all 68 questions across 11 designated categories.
 */

const faqsData = [
  // ==========================================
  // 1. GETTING STARTED (Questions 1 - 7)
  // ==========================================
  {
    category: 'Getting Started',
    question: 'What is VEXA Invoice?',
    slug: 'what-is-vexa-invoice',
    answer: 'VEXA Invoice is a modern, full-stack GST billing, inventory control, and enterprise management platform engineered for Indian retail and wholesale businesses. It features fast POS barcode billing, GST tax breakdowns (CGST/SGST/IGST), customer ledger tracking, stock inward/adjustments, thermal and A4 invoice printing, WhatsApp customer communication, an online storefront, customer self-service portal, and comprehensive role-based access control.',
    sort_order: 1
  },
  {
    category: 'Getting Started',
    question: 'How do I log in to VEXA Invoice?',
    slug: 'how-do-i-log-in-to-vexa-invoice',
    answer: 'To log in as a Company Owner or Admin, navigate to the main login portal at /auth/login. Enter your registered email address and password. If you are an employee assigned a custom role (such as Billing Staff, Inventory Manager, or Accountant), navigate to your company role-specific URL: /company/{roleSlug}/login/ to sign in directly with your staff credentials.',
    sort_order: 2
  },
  {
    category: 'Getting Started',
    question: 'How do I set up my business profile?',
    slug: 'how-do-i-set-up-my-business-profile',
    answer: 'Go to Settings > Business Settings from your dashboard sidebar. Fill in your Company Legal Name, Trade Name, GSTIN number, PAN, Official Phone Number, Registered Business Address, State, and Pincode. You can also upload your company logo, set your invoice prefix and starting number, and choose your default financial year.',
    sort_order: 3
  },
  {
    category: 'Getting Started',
    question: 'How can I update my company information?',
    slug: 'how-can-i-update-my-company-information',
    answer: 'Navigate to Settings > Business Settings. You can update your business contact details, email address, address lines, state code, GST registration type (Regular or Composition), and bank account details for invoice footers. After making the desired changes, click the "Save Settings" button at the bottom right.',
    sort_order: 4
  },
  {
    category: 'Getting Started',
    question: 'How do I change my password?',
    slug: 'how-do-i-change-my-password',
    answer: 'Click on your user profile avatar in the top right corner of the navigation bar and select "Profile Settings" or "Account". In the Security section, input your current password followed by your new password. Re-type the new password for verification and click "Update Password". You can also use the "Forgot Password" link on the login screen if you cannot remember your current password.',
    sort_order: 5
  },
  {
    category: 'Getting Started',
    question: 'How can I access VEXA Invoice from another device?',
    slug: 'how-can-i-access-vexa-invoice-from-another-device',
    answer: 'VEXA Invoice is fully cloud-hosted and accessible from any modern web browser on desktop PCs, laptops, tablets, and smartphones. Simply open Chrome, Edge, Safari, or Firefox on your secondary device, navigate to your VEXA Invoice web application URL, and sign in with your credentials. Your inventory, sales records, and ledger balances sync in real-time across all connected devices.',
    sort_order: 6
  },
  {
    category: 'Getting Started',
    question: 'How do I manage employee accounts?',
    slug: 'how-do-i-manage-employee-accounts',
    answer: 'Admins can manage staff members under Settings > Team Users. Click "+ Add User" to invite or create a new team member. Provide their name, email, phone, login password, and select an Assigned Role (e.g., Stock Role, Billing Staff, Accountant, or any custom role created under Roles & Permissions). You can edit credentials, activate/deactivate accounts, or revoke access at any time.',
    sort_order: 7
  },

  // ==========================================
  // 2. SALES & BILLING (Questions 8 - 15)
  // ==========================================
  {
    category: 'Sales & Billing',
    question: 'How do I create a new sale?',
    slug: 'how-do-i-create-a-new-sale',
    answer: 'From the dashboard or navigation header, click the blue "+ New Sale" button or go to Sales > New Sale in the sidebar. Select an existing customer or quick-add a cash customer. Add items to the cart by barcode scanning or searching by product title/SKU. Adjust quantities, apply item discounts or tax if needed, select the payment mode (Cash, UPI, Card, or Credit/Due), and click "Complete Sale" to generate the invoice.',
    sort_order: 8
  },
  {
    category: 'Sales & Billing',
    question: 'How do I generate a GST invoice?',
    slug: 'how-do-i-generate-a-gst-invoice',
    answer: 'When creating a sale, ensure the selected customer has their GSTIN and State recorded (or select Cash Customer for B2C). Each product in the cart automatically calculates applicable GST based on its configured tax rate (e.g. 5%, 12%, 18%, 28%) and HSN code. If the customer is in the same state, CGST and SGST are split evenly; for inter-state sales, IGST is applied automatically. Complete the checkout to generate a compliant GST Tax Invoice.',
    sort_order: 9
  },
  {
    category: 'Sales & Billing',
    question: 'Can I generate a non-GST invoice?',
    slug: 'can-i-generate-a-non-gst-invoice',
    answer: 'Yes. If your business operates under the GST Composition Scheme or sells tax-exempt items, you can create products with a 0% GST rate or set the invoice type to Bill of Supply / Non-GST Invoice in the checkout drawer. The generated document will display as a standard Bill of Supply without GST tax component breakdowns.',
    sort_order: 10
  },
  {
    category: 'Sales & Billing',
    question: 'How do I download an invoice as PDF?',
    slug: 'how-do-i-download-an-invoice-as-pdf',
    answer: 'Go to Sales > Invoices in the sidebar. Click on any invoice number or click the "..." action menu and select "View Invoice". On the invoice preview screen, click the "Download PDF" button in the top action bar to save a clean, high-resolution vector PDF to your local device.',
    sort_order: 11
  },
  {
    category: 'Sales & Billing',
    question: 'How do I print an invoice?',
    slug: 'how-do-i-print-an-invoice',
    answer: 'Immediately upon completing a sale, the Print dialog prompts you to print the receipt. You can also open any invoice from Sales > Invoices and click "Print". VEXA Invoice supports standard A4/A5 laser/inkjet printers as well as 80mm / 58mm thermal receipt printers. You can configure your default printer and page format under Settings > Printers & Printing.',
    sort_order: 12
  },
  {
    category: 'Sales & Billing',
    question: 'Can I edit a generated invoice?',
    slug: 'can-i-edit-a-generated-invoice',
    answer: 'To preserve financial integrity and GST compliance, generated tax invoices cannot be directly edited after closure if payments or tax filings are attached. However, authorized Admins can cancel or void an invoice, issue a Credit Note / Sales Return to adjust balances, or make adjustments under Sales > Invoices > Actions > Edit if the transaction has not been reconciled in a closed accounting period.',
    sort_order: 13
  },
  {
    category: 'Sales & Billing',
    question: 'How do I manage sales returns?',
    slug: 'how-do-i-manage-sales-returns',
    answer: 'Go to Sales > Sales Returns (or locate the original invoice in Sales > Invoices and click "Return Items"). Enter the return quantity for each item, specify the return reason (e.g. damaged, exchange, customer cancellation), and select whether to refund payment or credit the customer ledger balance. Once confirmed, stock quantities automatically restore to active inventory and a Credit Note is generated.',
    sort_order: 14
  },
  {
    category: 'Sales & Billing',
    question: 'How do I view previous invoices?',
    slug: 'how-do-i-view-previous-invoices',
    answer: 'Navigate to Sales > Invoices. The table lists all past invoices with invoice number, date, customer name, total amount, payment status (Paid, Partial, Unpaid), and fulfillment status. You can filter by date range, payment status, customer, or search by invoice number.',
    sort_order: 15
  },
  
  // ===========================================
  // 3. PRODUCTS & INVENTORY (Questions 16 - 24)
  // ==========================================
  {
    category: 'Products & Inventory',
    question: 'How do I add a new product?',
    slug: 'how-do-i-add-a-new-product',
    answer: 'Go to Products > Products List from the sidebar and click "+ Add Product". Enter the Product Name, SKU, Barcode, Category, Unit of Measurement (Pcs, Box, Kg, Mtr), Purchase Price, Selling Price (MRP), HSN Code, and GST Rate (%). Set your Initial Stock and Low Stock Alert threshold, then click "Save Product".',
    sort_order: 16
  },
  {
    category: 'Products & Inventory',
    question: 'How do I create product categories?',
    slug: 'how-do-i-create-product-categories',
    answer: 'Go to Products > Categories. Click "+ New Category", type in the Category Name (e.g. Menswear, Electronics, Hardware), add an optional description and parent category if nesting sub-categories, and click "Save". Categories help organize inventory and filter reports.',
    sort_order: 17
  },
  {
    category: 'Products & Inventory',
    question: 'What is SKU in VEXA Invoice?',
    slug: 'what-is-sku-in-vexa-invoice',
    answer: 'SKU (Stock Keeping Unit) is a unique alphanumeric identifier assigned to each product or product variant in your catalog. In VEXA Invoice, SKUs ensure precise inventory tracking, prevent duplication, and can be automatically generated based on category initials or custom product codes.',
    sort_order: 18
  },
  {
    category: 'Products & Inventory',
    question: 'How are product variants managed?',
    slug: 'how-are-product-variants-managed',
    answer: 'When adding or editing a product, enable the "This product has variants" toggle. You can define variant attributes such as Size (S, M, L, XL), Color (Red, Blue, Black), or Material. VEXA Invoice creates child SKU records for each combination, allowing individual stock tracking, pricing, and barcodes per variant.',
    sort_order: 19
  },
  {
    category: 'Products & Inventory',
    question: 'How do I generate barcode labels?',
    slug: 'how-do-i-generate-barcode-labels',
    answer: 'Navigate to Products > Barcode Generator (or click "Generate Barcode" from any product actions menu). Select the products, specify the number of copies for each item, choose your label paper format (e.g., 24 stickers per A4 sheet, 40-up, or roll barcode printer 50x25mm), and click "Generate & Print Labels".',
    sort_order: 20
  },
  {
    category: 'Products & Inventory',
    question: 'How do I scan product barcodes?',
    slug: 'how-do-i-scan-product-barcodes',
    answer: 'VEXA Invoice supports all standard USB and wireless 1D/2D handheld barcode scanners as well as camera-based scanning. On the POS / New Sale screen, simply place your cursor in the Barcode / Search input and scan any physical label. The scanner automatically inputs the barcode number and adds the item to the billing cart instantly.',
    sort_order: 21
  },
  {
    category: 'Products & Inventory',
    question: 'How do I update stock quantities?',
    slug: 'how-do-i-update-stock-quantities',
    answer: 'Stock quantities can be updated through two primary methods: 1) Creating a Purchase Inward under Purchases > Purchase Orders when receiving vendor deliveries, or 2) Making a direct manual adjustment under Stock > Stock Adjustments for corrections or physical inventory counts.',
    sort_order: 22
  },
  {
    category: 'Products & Inventory',
    question: 'How can I view stock movements?',
    slug: 'how-can-i-view-stock-movements',
    answer: 'Go to Stock > Stock Movements (or open any product under Products List and view the "Movement History" tab). Here you can audit an immutable log of every stock change: date, source document (Sales Invoice, Purchase Inward, Return, Adjustment), user who performed the action, previous quantity, changed quantity, and resulting balance.',
    sort_order: 23
  },
  {
    category: 'Products & Inventory',
    question: 'How do I manage stock adjustments?',
    slug: 'how-do-i-manage-stock-adjustments',
    answer: 'Go to Stock > Stock Adjustments and click "+ New Adjustment". Select the item, choose adjustment type ("Increase" or "Decrease"), specify the quantity, and choose a reason (e.g. Damage, Expired, Theft, Physical Count Correction). Submit the form to re-calibrate your book stock.',
    sort_order: 24
  },

  // ==========================================
  // 4. CUSTOMERS & CRM (Questions 25 - 30)
  // ==========================================
  {
    category: 'Customers & CRM',
    question: 'How do I add a new customer?',
    slug: 'how-do-i-add-a-new-customer',
    answer: 'Go to Customers > Customer List and click "+ Add Customer" (or click Quick Add Customer directly from the POS billing screen). Enter Customer Name, Mobile Number, Email, Billing Address, Shipping Address, State, GSTIN (for B2B), and optional credit limit.',
    sort_order: 25
  },
  {
    category: 'Customers & CRM',
    question: 'How do I view customer balance and dues?',
    slug: 'how-do-i-view-customer-balance-and-dues',
    answer: 'Navigate to Customers > Customer List. Each customer row displays their Current Outstanding Due balance alongside their Total Lifetime Purchases. You can sort by outstanding balance to instantly identify top debtors and overdue accounts.',
    sort_order: 26
  },
  {
    category: 'Customers & CRM',
    question: 'How do I generate a customer ledger statement?',
    slug: 'how-do-i-generate-a-customer-ledger-statement',
    answer: 'Go to Customers > Customer List, click on the customer name to open their profile, and switch to the "Customer Ledger" tab. Select your custom date range (e.g. This Month, Last Quarter, or Financial Year). The ledger displays all debits (sales invoices), credits (payments received, returns), and running balances. Click "Export PDF" or "Print Statement" to share with the customer.',
    sort_order: 27
  },
  {
    category: 'Customers & CRM',
    question: 'Can I set credit limits for customers?',
    slug: 'can-i-set-credit-limits-for-customers',
    answer: 'Yes. In the Customer edit form, specify a numerical value under "Credit Limit (₹)". When billing on credit, VEXA Invoice checks the customer current outstanding balance against their limit. If the total exceeds the limit, the cashier receives an authorization warning to prevent bad debt exposure.',
    sort_order: 28
  },
  {
    category: 'Customers & CRM',
    question: 'How do I send payment reminders to customers?',
    slug: 'how-do-i-send-payment-reminders-to-customers',
    answer: 'On the customer profile page or under Customers > Outstanding Dues, click the "Send Reminder" button next to any unpaid invoice. You can send an automated payment reminder with outstanding balance and UPI payment link via WhatsApp or Email.',
    sort_order: 29
  },
  {
    category: 'Customers & CRM',
    question: 'How do I record payments received from customers?',
    slug: 'how-do-i-record-payments-received-from-customers',
    answer: 'Go to Finance > Payments In (or click "Receive Payment" directly on the invoice or customer ledger). Select Customer, enter the Amount Paid, Payment Date, Payment Mode (Cash, Bank Transfer, UPI, Cheque), and Reference / UTR Number. Allocate the payment against specific pending invoices or leave as on-account credit.',
    sort_order: 30
  },

  // ==========================================
  // 5. PURCHASES & SUPPLIERS (Questions 31 - 35)
  // ==========================================
  {
    category: 'Purchases & Suppliers',
    question: 'How do I add a supplier?',
    slug: 'how-do-i-add-a-supplier',
    answer: 'Go to Suppliers > Supplier List and click "+ Add Supplier". Enter the Vendor / Company Name, Contact Person, Phone, Email, Address, State, GSTIN, PAN, and payment terms (e.g. Net 15, Net 30). Save the supplier to enable them in purchase orders and stock inward.',
    sort_order: 31
  },
  {
    category: 'Purchases & Suppliers',
    question: 'How do I create a purchase order?',
    slug: 'how-do-i-create-a-purchase-order',
    answer: 'Navigate to Purchases > Purchase Orders and click "+ Create PO". Select the Supplier, expected delivery date, and add the required raw materials or inventory products with quantities and agreed purchase unit rates. Save and send the PO to the supplier as PDF or via WhatsApp.',
    sort_order: 32
  },
  {
    category: 'Purchases & Suppliers',
    question: 'How do I record a purchase bill or inward?',
    slug: 'how-do-i-record-a-purchase-bill-or-inward',
    answer: 'Go to Purchases > Purchase Bills and click "+ New Purchase Bill" (or convert an approved Purchase Order). Enter the Supplier Invoice Number, Invoice Date, and verify received item quantities and tax rates. When you submit the bill, your inventory stock counts increase automatically and the payable liability is added to the supplier ledger.',
    sort_order: 33
  },
  {
    category: 'Purchases & Suppliers',
    question: 'How do I track supplier payments and payables?',
    slug: 'how-do-i-track-supplier-payments-and-payables',
    answer: 'Navigate to Suppliers > Payables or open the Supplier Profile. View the running balance of all unpaid vendor bills. Click "Record Payment" under Finance > Payments Out to log payments made via bank transfer, cheque, or cash, reconciling the vendor balance.',
    sort_order: 34
  },
  {
    category: 'Purchases & Suppliers',
    question: 'How do I manage purchase returns / debit notes?',
    slug: 'how-do-i-manage-purchase-returns-debit-notes',
    answer: 'Under Purchases > Purchase Returns, click "+ New Return". Select the supplier and the original purchase bill. Specify the returned items, quantities, and reasons. The system reduces inventory levels accordingly and generates a Debit Note to deduct from the supplier payable balance.',
    sort_order: 35
  },

  // ==========================================
  // 6. PAYMENTS & FINANCE (Questions 36 - 40)
  // ==========================================
  {
    category: 'Payments & Finance',
    question: 'What payment methods does VEXA Invoice support?',
    slug: 'what-payment-methods-does-vexa-invoice-support',
    answer: 'VEXA Invoice supports multiple payment modes during sales and billing: Cash, UPI (Dynamic QR or Static VPA), Credit & Debit Cards, Net Banking / NEFT / RTGS, Cheques, and Store Credit / Customer Balance. Split payments (e.g. paying partial cash and partial UPI) are fully supported.',
    sort_order: 36
  },
  {
    category: 'Payments & Finance',
    question: 'How do I track daily cash and payment collections?',
    slug: 'how-do-i-track-daily-cash-and-payment-collections',
    answer: 'Go to Finance > Cash Register / Daily Register from the sidebar. You can view the Opening Float, Cash Sales, UPI Collections, Card Collections, Expenses Paid Out, and net Cash in Hand for any selected business date or cashier shift.',
    sort_order: 37
  },
  {
    category: 'Payments & Finance',
    question: 'How do I record business expenses?',
    slug: 'how-do-i-record-business-expenses',
    answer: 'Navigate to Finance > Expenses and click "+ Add Expense". Select the Expense Category (e.g., Rent, Electricity, Staff Salary, Tea & Snacks, Maintenance), enter the Amount, Date, Payment Account, and attach an optional receipt image for auditing.',
    sort_order: 38
  },
  {
    category: 'Payments & Finance',
    question: 'How do I view my Profit and Loss report?',
    slug: 'how-do-i-view-my-profit-and-loss-report',
    answer: 'Navigate to Reports > Financial Reports > Profit & Loss. Choose your fiscal period. The report computes Total Sales Revenue minus Cost of Goods Sold (COGS) to calculate Gross Profit, then subtracts Operating Expenses to determine Net Profit/Loss.',
    sort_order: 39
  },
  {
    category: 'Payments & Finance',
    question: 'How do I reconcile bank accounts?',
    slug: 'how-do-i-reconcile-bank-accounts',
    answer: 'Go to Finance > Bank Accounts. You can add your company bank accounts, import your monthly bank statement (CSV/Excel), and match transactions against customer payments received and supplier payouts for reconciliation.',
    sort_order: 40
  },

  // ==========================================
  // 7. QUOTATIONS & ESTIMATES (Questions 41 - 45)
  // ==========================================
  {
    category: 'Quotations & Estimates',
    question: 'How do I create a quotation or estimate?',
    slug: 'how-do-i-create-a-quotation-or-estimate',
    answer: 'Go to Sales > Quotations & Estimates and click "+ New Quotation". Select the prospect or existing customer, add requested products with proposed prices, tax rates, validity date (e.g. 15 days), and custom terms & conditions. Click "Save & Issue".',
    sort_order: 41
  },
  {
    category: 'Quotations & Estimates',
    question: 'How do I convert a quotation into a sales invoice?',
    slug: 'how-do-i-convert-a-quotation-into-a-sales-invoice',
    answer: 'In the Quotations list, locate the approved quotation and click "Convert to Invoice" in the action menu. The system automatically populates the POS billing screen with all items, rates, and customer details from the estimate, saving data re-entry time.',
    sort_order: 42
  },
  {
    category: 'Quotations & Estimates',
    question: 'Can I share quotations directly with customers via WhatsApp or PDF?',
    slug: 'can-i-share-quotations-directly-with-customers-via-whatsapp-or-pdf',
    answer: 'Yes! From the quotation preview window, click "Share on WhatsApp" to send a pre-formatted message with a direct download link and quotation summary to the customer mobile number, or click "Download PDF" to attach it via email.',
    sort_order: 43
  },
  {
    category: 'Quotations & Estimates',
    question: 'Do quotations affect current inventory stock?',
    slug: 'do-quotations-affect-current-inventory-stock',
    answer: 'No. Quotations and proforma estimates are non-accounting documents and do not deduct items from active physical inventory stock until they are formally converted into a finalized Sales Invoice.',
    sort_order: 44
  },
  {
    category: 'Quotations & Estimates',
    question: 'How do I track quotation approval status?',
    slug: 'how-do-i-track-quotation-approval-status',
    answer: 'Quotations support status tracking: Draft, Sent, Accepted, Declined, and Converted. You can filter by status under Sales > Quotations to follow up on pending deals.',
    sort_order: 45
  },

  // ==========================================
  // 8. ONLINE SHOP & CUSTOMER PORTAL (Questions 46 - 51)
  // ==========================================
  {
    category: 'Online Shop & Customer Portal',
    question: 'What is the VEXA Online Shop Storefront?',
    slug: 'what-is-the-vexa-online-shop-storefront',
    answer: 'The Online Shop is a custom digital storefront (available on Growth and Lifetime plans) located at /shop/{shopSlug}. It gives your business a branded e-commerce catalog where customers can browse your products, check real-time availability, and place orders directly from their smartphone or computer.',
    sort_order: 46
  },
  {
    category: 'Online Shop & Customer Portal',
    question: 'How do I configure my shop URL and branding?',
    slug: 'how-do-i-configure-my-shop-url-and-branding',
    answer: 'Go to Settings > Online Shop Settings. You can customize your unique Shop Slug (e.g., /shop/saitextiles), upload a banner, set your tagline, configure operating hours, and enable or disable customer order submissions.',
    sort_order: 47
  },
  {
    category: 'Online Shop & Customer Portal',
    question: 'How do customers place orders through the online shop?',
    slug: 'how-do-customers-place-orders-through-the-online-shop',
    answer: 'Customers visit your public shop link or scan your in-store QR code, add products to their digital cart, provide their contact details and delivery preferences, and submit the order. The business receives an instant notification.',
    sort_order: 48
  },
  {
    category: 'Online Shop & Customer Portal',
    question: 'How do I process orders received from the online shop?',
    slug: 'how-do-i-process-orders-received-from-the-online-shop',
    answer: 'Go to Sales > Online Orders in your admin panel. Review incoming orders with customer details and line items. You can Accept, Reject, or click "Convert to Invoice" to generate a tax invoice and dispatch items directly from your inventory.',
    sort_order: 49
  },
  {
    category: 'Online Shop & Customer Portal',
    question: 'What is the Customer Self-Service Portal?',
    slug: 'what-is-the-customer-self-service-portal',
    answer: 'The Customer Portal (Growth & Lifetime plans) allows your registered buyers to log in with their mobile number at /shop/{shopSlug}/portal. They can view their lifetime invoice history, download past tax invoices as PDF, inspect payment receipts, review ledger balances, and check status of their pending quotations.',
    sort_order: 50
  },
  {
    category: 'Online Shop & Customer Portal',
    question: 'How do I generate a QR code for my shop?',
    slug: 'how-do-i-generate-a-qr-code-for-my-shop',
    answer: 'Under Settings > Online Shop Settings, click the "Download Shop QR Code" button. You can print this high-resolution QR poster and display it at your retail billing counter or storefront entrance so customers can scan and shop instantly on their phones.',
    sort_order: 51
  },

  // ==========================================
  // 9. WHATSAPP & NOTIFICATIONS (Questions 52 - 56)
  // ==========================================
  {
    category: 'WhatsApp & Notifications',
    question: 'How do I connect WhatsApp in VEXA Invoice?',
    slug: 'how-do-i-connect-whatsapp-in-vexa-invoice',
    answer: 'Navigate to Settings > WhatsApp Connection. You can connect your official Meta WhatsApp Business Cloud API by entering your Phone Number ID, WhatsApp Business Account ID (WABA), and permanent Access Token. Verify the connection with a quick test message.',
    sort_order: 52
  },
  {
    category: 'WhatsApp & Notifications',
    question: 'Can I send invoices automatically via WhatsApp?',
    slug: 'can-i-send-invoices-automatically-via-whatsapp',
    answer: 'Yes. In Settings > WhatsApp Connection, enable "Auto-send Invoice on Checkout". Whenever a cashier finalizes a sale for a customer with a valid 10-digit mobile number, VEXA Invoice dispatches an instant WhatsApp message with the invoice summary and a direct PDF download link.',
    sort_order: 53
  },
  {
    category: 'WhatsApp & Notifications',
    question: 'How do I send marketing campaigns or promotional messages?',
    slug: 'how-do-i-send-marketing-campaigns-or-promotional-messages',
    answer: 'Go to Marketing > WhatsApp Campaigns (available on Growth and Lifetime plans). Create a campaign, select your target audience (e.g., All Customers, VIP Customers, or Inactive Buyers), pick an approved Meta template, and schedule or broadcast your promotion.',
    sort_order: 54
  },
  {
    category: 'WhatsApp & Notifications',
    question: 'Why did a WhatsApp message fail to deliver?',
    slug: 'why-did-a-whatsapp-message-fail-to-deliver',
    answer: 'Common reasons for WhatsApp delivery failure include: 1) The recipient mobile number is missing the correct country code (+91) or has invalid digits, 2) Meta API token has expired or requires renewal in Meta Business Manager, or 3) The template has not been approved yet by WhatsApp. Check the logs under Marketing > Message Logs for exact error codes.',
    sort_order: 55
  },
  {
    category: 'WhatsApp & Notifications',
    question: 'What automated notifications does VEXA Invoice provide?',
    slug: 'what-automated-notifications-does-vexa-invoice-provide',
    answer: 'VEXA Invoice supports automated notifications for: Sale Invoice Confirmation, Payment Receipt Acknowledgement, Overdue Payment Reminders, Low Stock Alerts to management, Quotation Acceptance, and Order Status Updates.',
    sort_order: 56
  },

  // ==========================================
  // 10. SUBSCRIPTION & BILLING (Questions 57 - 61)
  // ==========================================
  {
    category: 'Subscription & Billing',
    question: 'What subscription plans are available in VEXA Invoice?',
    slug: 'what-subscription-plans-are-available-in-vexa-invoice',
    answer: 'VEXA Invoice offers three flexible plans: 1) Starter Plan (₹599/month) for core billing, inventory, and customer ledgers; 2) Growth Plan (₹999/month) which includes all Starter features plus the Customer Self-Service Portal, Online Shop Storefront, WhatsApp Campaigns, and Advanced Reports; and 3) Lifetime Ownership (₹59,999 one-time) providing full enterprise access forever with zero monthly charges.',
    sort_order: 57
  },
  {
    category: 'Subscription & Billing',
    question: 'How do I upgrade or renew my subscription?',
    slug: 'how-do-i-upgrade-or-renew-my-subscription',
    answer: 'Go to Settings > Subscription & Billing. View your current plan and expiry date. Click "Upgrade Plan" or "Renew Subscription", choose Starter, Growth, or Lifetime, and complete payment securely via our integrated Razorpay gateway (UPI, Netbanking, Cards). Your access updates instantly.',
    sort_order: 58
  },
  {
    category: 'Subscription & Billing',
    question: 'Where can I download my VEXA subscription tax receipts?',
    slug: 'where-can-i-download-my-vexa-subscription-tax-receipts',
    answer: 'In Settings > Subscription & Billing, scroll down to the "Billing & Payment History" section. Every renewal transaction generates a GST-compliant tax invoice. Click "Download Receipt" next to any payment to retrieve your PDF invoice for input tax credit (ITC) claims.',
    sort_order: 59
  },
  {
    category: 'Subscription & Billing',
    question: 'What payment gateway does VEXA Invoice use for subscriptions?',
    slug: 'what-payment-gateway-does-vexa-invoice-use-for-subscriptions',
    answer: 'VEXA Invoice uses Razorpay — India’s leading RBI-authorized payment gateway — ensuring 100% secure, PCI-DSS compliant transactions supporting all major UPI apps (GPay, PhonePe, Paytm), credit/debit cards, and 50+ net banking institutions.',
    sort_order: 60
  },
  {
    category: 'Subscription & Billing',
    question: 'What happens when my subscription expires?',
    slug: 'what-happens-when-my-subscription-expires',
    answer: 'If your monthly subscription lapses, your account enters a temporary grace period. Your customer data, sales records, and inventory history remain 100% safe and intact. You will be prompted to renew your subscription upon login to continue creating new invoices and accessing portal features.',
    sort_order: 61
  },

  // ==========================================
  // 11. ACCOUNT & TECHNICAL SUPPORT (Questions 62 - 68)
  // ==========================================
  {
    category: 'Account & Technical Support',
    question: 'How do I raise a support ticket to VEXA TECH?',
    slug: 'how-do-i-raise-a-support-ticket-to-vexa-tech',
    answer: 'Click "Raise a Ticket" in the Help & Support sidebar menu or go to /company/{roleSlug}/support/new/. Fill in the ticket Title, select Category (Billing, Inventory, Payment Gateway, Technical, etc.), choose Priority (Low, Medium, High, Urgent), provide detailed description, and attach screenshots if applicable. Click "Submit Ticket".',
    sort_order: 62
  },
  {
    category: 'Account & Technical Support',
    question: 'Where can I track my existing support tickets?',
    slug: 'where-can-i-track-my-existing-support-tickets',
    answer: 'Go to Help & Support > My Support Tickets (or /company/{roleSlug}/support/tickets/). You can view all past and active tickets, see real-time status updates (Open, In Progress, Resolved, Closed), and reply directly to VEXA TECH support engineers.',
    sort_order: 63
  },
  {
    category: 'Account & Technical Support',
    question: 'How do I create a database backup?',
    slug: 'how-do-i-create-a-database-backup',
    answer: 'Go to Settings > Database Backup. Click "Generate Backup Now". The system creates an encrypted, standalone snapshot of your entire database including sales, inventory, and ledgers, and gives you a one-click download link to store safely on your secure backup drive.',
    sort_order: 64
  },
  {
    category: 'Account & Technical Support',
    question: 'What should I do if a thermal printer does not print properly?',
    slug: 'what-should-i-do-if-a-thermal-printer-does-not-print-properly',
    answer: '1) Ensure the thermal printer driver (POS-80 or POS-58) is installed on your OS and set paper size to 80mm / 3 inch. 2) In VEXA Invoice Settings > Printers & Printing, select "80mm Thermal Receipt" as your default layout. 3) Disable headers and footers in your browser print settings dialog.',
    sort_order: 65
  },
  {
    category: 'Account & Technical Support',
    question: 'How do custom employee roles and permissions work?',
    slug: 'how-do-custom-employee-roles-and-permissions-work',
    answer: 'Admins can navigate to Settings > Roles & Permissions to create granular staff roles (e.g. Cashier, Store Manager, Accountant). You can individually toggle permissions for Sales, Purchases, Inventory, Pricing Visibility, Customer Ledgers, and Reports so employees only access what they need.',
    sort_order: 66
  },
  {
    category: 'Account & Technical Support',
    question: 'Is my business data secure and confidential on VEXA Invoice?',
    slug: 'is-my-business-data-secure-and-confidential-on-vexa-invoice',
    answer: 'Yes. VEXA Invoice uses enterprise-grade security protocols: 256-bit TLS/SSL encryption in transit, strict multi-tenant database isolation (where your business records are never exposed to other companies), automated hourly snapshots, and encrypted password hashing.',
    sort_order: 67
  },
  {
    category: 'Account & Technical Support',
    question: 'How do I contact VEXA TECH emergency technical support?',
    slug: 'how-do-i-contact-vexa-tech-emergency-technical-support',
    answer: 'For emergency outages or critical payment issues, raise an "Urgent" priority ticket from your dashboard for high-priority dispatch, or email support@vexatech.in. Urgent tickets trigger automated alerts directly to our on-call engineering team.',
    sort_order: 68
  }
];

module.exports = faqsData;

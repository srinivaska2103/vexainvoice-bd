/**
 * Complete verified 53 Knowledge Base Article Specifications for VEXA Invoice
 */
module.exports = [
  // ==========================================
  // CATEGORY 1: GETTING STARTED
  // ==========================================
  {
    categoryName: 'Getting Started',
    categorySlug: 'getting-started',
    categoryIcon: 'Rocket',
    categoryDesc: 'Introduction, initial login, workspace overview and business settings.',
    categorySort: 1,
    articles: [
      {
        title: 'Introduction to VEXA Invoice',
        slug: 'introduction-to-vexa-invoice',
        shortDescription: 'Overview of VEXA Invoice POS, billing, inventory, multi-tenancy and capabilities.',
        isFeatured: true,
        steps: [
          { stepNumber: 1, title: 'Access the VEXA Invoice Web Platform', description: 'Open your browser and navigate to the application URL (e.g. http://localhost:3000).', caption: 'VEXA Invoice Portal Gateway' },
          { stepNumber: 2, title: 'Understand Multi-Role Portals', description: 'VEXA Invoice features role-isolated login gateways allowing Cashiers, Stock Managers, and Admins dedicated workspaces.', caption: 'Role-based login architecture' },
          { stepNumber: 3, title: 'Explore Main Sidebar Navigation', description: 'The left sidebar hosts modules including Dashboard, POS Sales, Inventory, Customers, Purchases, and Settings.', caption: 'Sidebar navigation panel' }
        ],
        notes: ['Company data is strictly isolated by multi-tenant business ID.', 'All currency calculations default to Indian Rupee (INR) with integrated GST.'],
        keywords: 'introduction, overview, basics, vexa invoice, welcome'
      },
      {
        title: 'How to Log In to VEXA Invoice',
        slug: 'how-to-log-in-to-vexa-invoice',
        shortDescription: 'Secure authentication steps for Administrators and employees across dynamic role portals.',
        isFeatured: false,
        steps: [
          { stepNumber: 1, title: 'Locate Your Portal URL', description: 'Admins use /company/admin/login while employees use their assigned slug, e.g., /company/cashier-role/login/.', caption: 'Role Login Screen' },
          { stepNumber: 2, title: 'Enter Registered Credentials', description: 'Provide your company email address or employee username and your password.', caption: 'Credential input fields' },
          { stepNumber: 3, title: 'Access Workspace', description: 'Click "Sign In" to open your authorized role dashboard.', caption: 'Successful dashboard redirection' }
        ],
        notes: ['Sessions are cookie-backed with JWT authentication.', 'Multi-tab session isolation prevents permission crossover.'],
        keywords: 'login, sign in, portal, authentication, password'
      },
      {
        title: 'Understanding the Dashboard',
        slug: 'understanding-the-dashboard',
        shortDescription: 'Interpret real-time revenue cards, today sales, low stock alerts, and quick actions.',
        isFeatured: true,
        steps: [
          { stepNumber: 1, title: 'Review Top Metric Cards', description: 'Check Today Sales, Monthly Revenue, Total Outstanding Due, and Low Stock count.', caption: 'Dashboard KPI metrics' },
          { stepNumber: 2, title: 'Monitor Recent Sales Table', description: 'View the latest finalized invoices, customer names, payment modes, and amounts.', caption: 'Recent transactions list' },
          { stepNumber: 3, title: 'Use Fast Action Shortcuts', description: 'Click "+ New Sale", "Add Product", or "Stock Inward" directly from header buttons.', caption: 'Fast action triggers' }
        ],
        notes: ['Dashboard metrics refresh automatically when new transactions are finalized.'],
        keywords: 'dashboard, metrics, analytics, kpi, overview'
      },
      {
        title: 'How to Configure Your Business Profile',
        slug: 'how-to-configure-your-business-profile',
        shortDescription: 'Set up business legal name, GSTIN, PAN, registered address, and phone numbers.',
        isFeatured: false,
        steps: [
          { stepNumber: 1, title: 'Navigate to Settings', description: 'Open Settings > Business Settings from the navigation sidebar.', caption: 'Business Settings Menu' },
          { stepNumber: 2, title: 'Update Company Details', description: 'Input your Business Legal Name, Registered Address, City, State, and Pincode.', caption: 'Company information inputs' },
          { stepNumber: 3, title: 'Save Profile', description: 'Click "Save Business Profile" to apply changes across all generated invoices.', caption: 'Save button confirmation' }
        ],
        notes: ['GSTIN is required for generating valid B2B tax invoices.'],
        keywords: 'profile, address, gstin, pan, company settings'
      },
      {
        title: 'How to Manage Company Settings',
        slug: 'how-to-manage-company-settings',
        shortDescription: 'Configure invoice numbering prefixes, thermal printing preferences, and defaults.',
        isFeatured: false,
        steps: [
          { stepNumber: 1, title: 'Open Settings', description: 'Go to Settings in the sidebar to review system configuration options.', caption: 'Settings Overview' },
          { stepNumber: 2, title: 'Set Invoice Number Prefix', description: 'Define custom numbering like INV-2026- or RET- for sequential sales.', caption: 'Invoice prefix input' },
          { stepNumber: 3, title: 'Configure Thermal Format', description: 'Choose between 80mm POS receipt or standard A4/A5 PDF formats.', caption: 'Print formatting selector' }
        ],
        notes: ['Prefix changes apply to future generated invoices only.'],
        keywords: 'settings, invoice prefix, format, preferences'
      },
      {
        title: 'How to Create Employee Accounts',
        slug: 'how-to-create-employee-accounts',
        shortDescription: 'Add team members, configure logins, and assign specific operational roles.',
        isFeatured: false,
        steps: [
          { stepNumber: 1, title: 'Open Team Users', description: 'Navigate to Settings > Team Users.', caption: 'Team Users Management' },
          { stepNumber: 2, title: 'Click Add User', description: 'Click "+ Add User" in the upper right corner.', caption: 'Add User Modal' },
          { stepNumber: 3, title: 'Fill User Details', description: 'Enter Name, Email, Password, and select the assigned role or custom role.', caption: 'User creation fields' },
          { stepNumber: 4, title: 'Save User', description: 'Confirm creation to grant system login privileges.', caption: 'Active team member entry' }
        ],
        notes: ['Admins cannot delete their own primary administrative account.'],
        keywords: 'employee, team, user, add user, staff'
      },
      {
        title: 'Understanding Roles & Permissions',
        slug: 'understanding-roles-and-permissions',
        shortDescription: 'Comprehensive guide to module-level permissions and dynamic custom roles.',
        isFeatured: true,
        steps: [
          { stepNumber: 1, title: 'Open Roles & Permissions', description: 'Navigate to Settings > Roles & Permissions.', caption: 'Roles Grid' },
          { stepNumber: 2, title: 'Inspect System Roles', description: 'Review pre-configured roles: ADMIN, MANAGER, BILLING_STAFF, STOCK_STAFF, ACCOUNTANT.', caption: 'Pre-set system roles' },
          { stepNumber: 3, title: 'Create Custom Role', description: 'Click "+ Create Custom Role", give it a name, and toggle granular permissions like sales.create or stock.adjustments.', caption: 'Permission toggle matrix' }
        ],
        notes: ['ADMIN role has unconditional access to all modules and settings.'],
        keywords: 'roles, permissions, security, custom roles, access'
      }
    ]
  },

  // ==========================================
  // CATEGORY 2: PRODUCTS & INVENTORY
  // ==========================================
  {
    categoryName: 'Products & Inventory',
    categorySlug: 'products-inventory',
    categoryIcon: 'Package',
    categoryDesc: 'Catalog management, barcode generation, variants, and real-time stock control.',
    categorySort: 2,
    articles: [
      {
        title: 'How to Create Your First Product',
        slug: 'how-to-create-your-first-product',
        shortDescription: 'Step-by-step tutorial on adding a product with retail pricing and tax rates.',
        isFeatured: true,
        steps: [
          { stepNumber: 1, title: 'Open Products Page', description: 'Navigate to Products > Products and click "+ Add Product".', caption: 'Products catalogue' },
          { stepNumber: 2, title: 'Enter Basic Specifications', description: 'Fill in Product Name, HSN code, Brand, Category, and Tax Rate (GST %).', caption: 'Product specification form' },
          { stepNumber: 3, title: 'Set Pricing & Opening Stock', description: 'Enter the Cost Price, Selling Price, and initial opening inventory count.', caption: 'Pricing and initial stock' },
          { stepNumber: 4, title: 'Save Product', description: 'Click "Save Product" to immediately make it billable in POS.', caption: 'Saved product toast' }
        ],
        notes: ['Negative stock is strictly prevented on POS checkouts.'],
        keywords: 'product, create product, add product, inventory'
      },
      {
        title: 'How to Create Product Categories',
        slug: 'how-to-create-product-categories',
        shortDescription: 'Organize your store catalog into searchable product categories and sub-groups.',
        isFeatured: false,
        steps: [
          { stepNumber: 1, title: 'Navigate to Categories', description: 'Click Products > Categories in the sidebar.', caption: 'Categories list' },
          { stepNumber: 2, title: 'Add Category', description: 'Click "+ Add Category", enter the Category Name and optional description.', caption: 'Category creation modal' },
          { stepNumber: 3, title: 'Save Category', description: 'Save the category to filter products easily in POS and reports.', caption: 'Active categories' }
        ],
        notes: ['Categories help segment online store catalog browsing.'],
        keywords: 'categories, organize, catalog, grouping'
      },
      {
        title: 'How to Add Product Variants',
        slug: 'how-to-add-product-variants',
        shortDescription: 'Manage size, color, and fit variations under a single parent product.',
        isFeatured: false,
        steps: [
          { stepNumber: 1, title: 'Select Target Product', description: 'Open any product in Products > Products and click the Variants tab.', caption: 'Product variants tab' },
          { stepNumber: 2, title: 'Configure Variant Attributes', description: 'Select Size (e.g. S, M, L, XL) and Color (e.g. Blue, Black).', caption: 'Variant builder' },
          { stepNumber: 3, title: 'Assign Variant Pricing', description: 'Specify custom selling prices and opening stock for each specific variant.', caption: 'Variant price input' },
          { stepNumber: 4, title: 'Save Variants', description: 'Confirm to generate distinct SKUs and barcodes for each variant.', caption: 'Generated variant list' }
        ],
        notes: ['Each variant maintains independent inventory tracking.'],
        keywords: 'variants, size, color, sku, options'
      },
      {
        title: 'How to Generate Automatic SKU',
        slug: 'how-to-generate-automatic-sku',
        shortDescription: 'Understand how VEXA Invoice creates clean, readable SKU identification codes.',
        isFeatured: false,
        steps: [
          { stepNumber: 1, title: 'Enter Product Details', description: 'While adding a product or variant, leave the SKU field blank or click Generate.', caption: 'SKU field' },
          { stepNumber: 2, title: 'System Formula', description: 'VEXA Invoice concatenates product code, color, and size abbreviations into unique SKUs.', caption: 'Generated SKU string' },
          { stepNumber: 3, title: 'Save and Use', description: 'Use the SKU for fast keyboard search during POS sales.', caption: 'Product card with SKU' }
        ],
        notes: ['SKUs are unique within your company business catalog.'],
        keywords: 'sku, automatic sku, stock keeping unit, code'
      },
      {
        title: 'How to Generate Barcode Labels',
        slug: 'how-to-generate-barcode-labels',
        shortDescription: 'Print thermal sticker barcode labels with price, business name, and SKU.',
        isFeatured: true,
        steps: [
          { stepNumber: 1, title: 'Open Barcode Labels', description: 'Go to Products > Barcode Labels.', caption: 'Barcode Label Studio' },
          { stepNumber: 2, title: 'Choose Products & Quantities', description: 'Select the items and specify how many sticker copies are needed.', caption: 'Sticker quantity counter' },
          { stepNumber: 3, title: 'Preview & Print', description: 'Review high-contrast Code-128 barcodes and send directly to your thermal printer.', caption: 'Print layout preview' }
        ],
        notes: ['Compatible with standard 50x25mm and 38x25mm thermal rolls.'],
        keywords: 'barcode, print labels, thermal sticker, code 128'
      },
      {
        title: 'How to Scan Product Barcodes',
        slug: 'how-to-scan-product-barcodes',
        shortDescription: 'Use USB handheld barcode scanners or integrated camera scanner for instant billing.',
        isFeatured: false,
        steps: [
          { stepNumber: 1, title: 'Connect USB Scanner', description: 'Plug in any standard USB HID barcode scanner (no driver installation needed).', caption: 'Hardware setup' },
          { stepNumber: 2, title: 'Open POS or Scanner View', description: 'Open Sales > New Sale or the dedicated Scanner tool.', caption: 'Scanner input field' },
          { stepNumber: 3, title: 'Scan Barcode', description: 'Scan the sticker barcode. The product is automatically added to cart within milliseconds.', caption: 'Cart auto-populated' }
        ],
        notes: ['Ensure barcode text input is focused when scanning in POS.'],
        keywords: 'scan, barcode scanner, usb scanner, fast billing'
      },
      {
        title: 'How to Manage Stock',
        slug: 'how-to-manage-stock',
        shortDescription: 'Track total inventory value, batch counts, and reorder levels.',
        isFeatured: false,
        steps: [
          { stepNumber: 1, title: 'Open Stock Section', description: 'Navigate to Stock > Stock List.', caption: 'Stock inventory table' },
          { stepNumber: 2, title: 'Filter by Availability', description: 'Filter by In Stock, Low Stock (< 5 units), or Out of Stock.', caption: 'Stock filter pills' },
          { stepNumber: 3, title: 'Inspect Stock Valuation', description: 'View total inventory value calculated at purchase and selling prices.', caption: 'Valuation metric cards' }
        ],
        notes: ['Stock auto-updates upon every confirmed sale or purchase inward.'],
        keywords: 'stock, inventory, stock list, reorder, quantity'
      },
      {
        title: 'How to Record Stock Adjustments',
        slug: 'how-to-record-stock-adjustments',
        shortDescription: 'Reconcile physical stock discrepancies caused by breakage, damage, or audits.',
        isFeatured: false,
        steps: [
          { stepNumber: 1, title: 'Open Adjustments', description: 'Go to Stock > Adjustments and click "+ New Adjustment".', caption: 'Stock Adjustments view' },
          { stepNumber: 2, title: 'Select Product and Reason', description: 'Choose item, select Adjustment Type (INCREASE/DECREASE), and enter quantity.', caption: 'Adjustment reason selector' },
          { stepNumber: 3, title: 'Confirm Adjustment', description: 'Save the adjustment. The variance is immediately applied to on-hand inventory.', caption: 'Adjustment audit entry' }
        ],
        notes: ['All adjustments are recorded with audit logs and employee timestamps.'],
        keywords: 'adjustment, stock audit, damage, discrepancy'
      },
      {
        title: 'How to View Stock Movements',
        slug: 'how-to-view-stock-movements',
        shortDescription: 'Audit the complete ledger history of every incoming and outgoing item unit.',
        isFeatured: false,
        steps: [
          { stepNumber: 1, title: 'Open Movements', description: 'Navigate to Stock > Movements.', caption: 'Movements ledger' },
          { stepNumber: 2, title: 'Filter by Transaction Type', description: 'Inspect entries categorized as SALE, PURCHASE, RETURN, or ADJUSTMENT.', caption: 'Movement filter' },
          { stepNumber: 3, title: 'Check In/Out Balance', description: 'View before-and-after quantities for each stock event.', caption: 'Balance audit column' }
        ],
        notes: ['Stock movements cannot be altered or deleted, ensuring accounting compliance.'],
        keywords: 'stock movements, ledger, audit trail, transaction log'
      }
    ]
  },

  // ==========================================
  // CATEGORY 3: SALES & BILLING
  // ==========================================
  {
    categoryName: 'Sales & Billing',
    categorySlug: 'sales-billing',
    categoryIcon: 'ShoppingCart',
    categoryDesc: 'POS terminal, GST tax calculations, invoice generation, returns, and quotations.',
    categorySort: 3,
    articles: [
      {
        title: 'How to Create a New Sale',
        slug: 'how-to-create-a-new-sale',
        shortDescription: 'Create retail sales with rapid item lookup, discount applications, and tender options.',
        isFeatured: true,
        steps: [
          { stepNumber: 1, title: 'Launch POS Terminal', description: 'Click "+ New Sale" in the top header or go to Sales > New Sale.', caption: 'POS billing terminal' },
          { stepNumber: 2, title: 'Select Customer', description: 'Search customer name or select default "Walk-in Retail Customer".', caption: 'Customer picker' },
          { stepNumber: 3, title: 'Add Cart Products', description: 'Scan barcodes or type product names. Adjust quantities and line discounts.', caption: 'Cart review table' },
          { stepNumber: 4, title: 'Accept Payment & Finalize', description: 'Select Cash, UPI, or Card, enter payment amount, and click Complete Sale.', caption: 'Tender payment modal' }
        ],
        notes: ['Invoices receive unique sequential numbers like INV-0001.'],
        keywords: 'sale, pos, billing, invoice, checkout, tender'
      },
      {
        title: 'How to Generate a GST Invoice',
        slug: 'how-to-generate-a-gst-invoice',
        shortDescription: 'Issue compliant B2B or B2C GST Tax Invoices with CGST, SGST, or IGST breakdowns.',
        isFeatured: true,
        steps: [
          { stepNumber: 1, title: 'Select GST-Registered Customer', description: 'Pick a customer having a valid 15-digit GSTIN number.', caption: 'Customer GSTIN badge' },
          { stepNumber: 2, title: 'Add Taxable Products', description: 'Products calculate GST based on their configured tax slabs (e.g. 5%, 12%, 18%).', caption: 'Cart GST breakdown' },
          { stepNumber: 3, title: 'Automatic Inter/Intra State Determination', description: 'If customer state differs from company state, IGST is applied automatically; otherwise CGST+SGST.', caption: 'Tax calculation widget' },
          { stepNumber: 4, title: 'Print Tax Invoice', description: 'Confirm sale to generate official GST Tax Invoice format.', caption: 'Tax Invoice preview' }
        ],
        notes: ['HSN summaries are summarized at the bottom of the printed invoice.'],
        keywords: 'gst, tax invoice, cgst, sgst, igst, hsn'
      },
      {
        title: 'How to Generate a Non-GST Invoice',
        slug: 'how-to-generate-a-non-gst-invoice',
        shortDescription: 'Create retail estimates and simplified commercial bills without tax deductions.',
        isFeatured: false,
        steps: [
          { stepNumber: 1, title: 'Open New Sale', description: 'Navigate to Sales > New Sale.', caption: 'Sales terminal' },
          { stepNumber: 2, title: 'Select Non-GST or 0% Items', description: 'Add products configured with 0% tax rate or exempt categories.', caption: 'Cart with 0% tax' },
          { stepNumber: 3, title: 'Finalize Sale', description: 'Complete the sale to print a clean commercial receipt without tax schedules.', caption: 'Non-GST receipt' }
        ],
        notes: ['Ideal for composition dealers and exempt goods.'],
        keywords: 'non-gst, estimate, simple bill, retail receipt'
      },
      {
        title: 'How to Print an Invoice',
        slug: 'how-to-print-an-invoice',
        shortDescription: 'Send finalized sales to thermal receipt printers (80mm) or standard office printers.',
        isFeatured: false,
        steps: [
          { stepNumber: 1, title: 'Open Sale Details', description: 'From Sales > Invoices, click the printer icon on any invoice.', caption: 'Invoices list print action' },
          { stepNumber: 2, title: 'Choose Output Format', description: 'Select Thermal Receipt (80mm) or A4 Tax Layout.', caption: 'Template format dialog' },
          { stepNumber: 3, title: 'Send to Printer', description: 'Click Print. Browser dialog sends data directly to your configured printer.', caption: 'System print dialog' }
        ],
        notes: ['Thermal format eliminates headers and footers for instant printing.'],
        keywords: 'print, thermal printer, 80mm, receipt, hard copy'
      },
      {
        title: 'How to Download an Invoice PDF',
        slug: 'how-to-download-an-invoice-pdf',
        shortDescription: 'Export digital PDF copies of invoices for customer records or accounting audits.',
        isFeatured: false,
        steps: [
          { stepNumber: 1, title: 'Locate Invoice', description: 'Open Sales > Invoices and find the desired transaction.', caption: 'Invoices table' },
          { stepNumber: 2, title: 'Click Download PDF', description: 'Click the PDF download button.', caption: 'PDF action button' },
          { stepNumber: 3, title: 'Save File', description: 'The vector PDF downloads locally with complete branding and logo.', caption: 'Downloaded PDF file' }
        ],
        notes: ['PDFs include company QR codes and bank details for UPI payments.'],
        keywords: 'pdf, download, export invoice, digital bill'
      },
      {
        title: 'How to Manage Sales Returns',
        slug: 'how-to-manage-sales-returns',
        shortDescription: 'Handle customer product returns, restore inventory counts, and issue credit refunds.',
        isFeatured: false,
        steps: [
          { stepNumber: 1, title: 'Open Returns', description: 'Navigate to Sales > Returns.', caption: 'Sales Returns dashboard' },
          { stepNumber: 2, title: 'Search Original Invoice', description: 'Input invoice number (e.g. INV-0042) to retrieve billed items.', caption: 'Original sale lookup' },
          { stepNumber: 3, title: 'Select Returned Items', description: 'Specify return quantities and reason (e.g. size mismatch, damaged).', caption: 'Return item selector' },
          { stepNumber: 4, title: 'Confirm Return', description: 'Process the return. Inventory restores and customer balance updates.', caption: 'Credit note confirmation' }
        ],
        notes: ['Credit notes are automatically tracked in customer ledger.'],
        keywords: 'returns, credit note, refund, exchange'
      },
      {
        title: 'How to Create Quotations',
        slug: 'how-to-create-quotations',
        shortDescription: 'Issue professional price estimates to prospective clients without deducting stock.',
        isFeatured: false,
        steps: [
          { stepNumber: 1, title: 'Open Quotations', description: 'Go to Finance > Quotations and click "+ New Quotation".', caption: 'Quotations page' },
          { stepNumber: 2, title: 'Add Client & Items', description: 'Select client and configure proposed items, prices, and validity terms.', caption: 'Quotation builder' },
          { stepNumber: 3, title: 'Save Quotation', description: 'Save and print/email the quotation. Stock is NOT deducted at this stage.', caption: 'Active quotation entry' }
        ],
        notes: ['Quotations can have expiration dates configured.'],
        keywords: 'quotation, estimate, proforma, proposal'
      },
      {
        title: 'How to Convert a Quotation into an Invoice',
        slug: 'how-to-convert-a-quotation-into-an-invoice',
        shortDescription: 'Convert approved customer estimates into confirmed sales invoices with one click.',
        isFeatured: false,
        steps: [
          { stepNumber: 1, title: 'Locate Approved Quotation', description: 'From Finance > Quotations, find the quotation agreed by your client.', caption: 'Quotations list' },
          { stepNumber: 2, title: 'Click Convert to Invoice', description: 'Click the "Convert to Sale" button.', caption: 'Conversion trigger' },
          { stepNumber: 3, title: 'Confirm Payment', description: 'Verify payment mode and confirm. The quotation becomes a finalized sale and stock deducts.', caption: 'Finalized invoice' }
        ],
        notes: ['Eliminates re-entering line items manually.'],
        keywords: 'convert quotation, quotation to sale, finalize estimate'
      }
    ]
  },

  // ==========================================
  // CATEGORY 4: CUSTOMERS & CRM
  // ==========================================
  {
    categoryName: 'Customers & CRM',
    categorySlug: 'customers-crm',
    categoryIcon: 'UserCheck',
    categoryDesc: 'Customer directory, credit ledgers, outstanding due balance, and communication.',
    categorySort: 4,
    articles: [
      {
        title: 'How to Add Customers',
        slug: 'how-to-add-customers',
        shortDescription: 'Register retail and wholesale customers with phone numbers, addresses, and credit limits.',
        isFeatured: false,
        steps: [
          { stepNumber: 1, title: 'Open Customers', description: 'Go to Customers in the navigation sidebar and click "+ Add Customer".', caption: 'Customer directory' },
          { stepNumber: 2, title: 'Enter Contact Details', description: 'Fill in Name, Mobile Number, Email, Address, and Customer Type (Retail/Wholesale).', caption: 'Customer profile modal' },
          { stepNumber: 3, title: 'Set Opening Balance', description: 'If the customer owes an existing balance, record it under Opening Balance.', caption: 'Opening balance field' },
          { stepNumber: 4, title: 'Save Customer', description: 'Confirm to create the account profile.', caption: 'Active customer record' }
        ],
        notes: ['Mobile numbers serve as customer login identifiers for the Self-Service Portal.'],
        keywords: 'customer, add customer, client, phone, contact'
      },
      {
        title: 'How to View Customer Intelligence',
        slug: 'how-to-view-customer-intelligence',
        shortDescription: 'Analyze purchase frequency, lifetime value, average order value, and top bought products.',
        isFeatured: true,
        steps: [
          { stepNumber: 1, title: 'Open Customer Intelligence', description: 'Navigate to Customer Intelligence > Customer Intelligence.', caption: 'Customer CRM dashboard' },
          { stepNumber: 2, title: 'Review Customer Insights', description: 'Inspect High-Value Clients, Dormant Accounts, and Most Frequent Shoppers.', caption: 'Intelligence metric badges' },
          { stepNumber: 3, title: 'View Customer Profile 360', description: 'Click any customer to inspect their full purchase timeline and favorite product categories.', caption: 'Customer 360 timeline' }
        ],
        notes: ['Customer Intelligence is included with Growth and Lifetime plans.'],
        keywords: 'customer intelligence, crm, lifetime value, insights'
      },
      {
        title: 'How to Manage Customer Ledgers',
        slug: 'how-to-manage-customer-ledgers',
        shortDescription: 'Inspect real-time debit and credit statement histories for customer credit accounts.',
        isFeatured: false,
        steps: [
          { stepNumber: 1, title: 'Open Customer Profile', description: 'From Customers, select a customer and click "View Ledger".', caption: 'Customer Ledger action' },
          { stepNumber: 2, title: 'Inspect Transaction Entries', description: 'Review Invoices (Debits) and Received Payments (Credits) in chronological order.', caption: 'Ledger debit/credit table' },
          { stepNumber: 3, title: 'Print Statement', description: 'Export or print the statement to share with the customer.', caption: 'Print ledger statement' }
        ],
        notes: ['Running balance automatically computes with zero discrepancies.'],
        keywords: 'ledger, customer balance, statement, credit, debit'
      },
      {
        title: 'How to Record Customer Payments',
        slug: 'how-to-record-customer-payments',
        shortDescription: 'Record received partial or full payments against outstanding customer due balances.',
        isFeatured: false,
        steps: [
          { stepNumber: 1, title: 'Open Payments', description: 'Go to Finance > Payments and click "+ Add Payment".', caption: 'Payments overview' },
          { stepNumber: 2, title: 'Select Customer', description: 'Choose the customer. Their current outstanding balance displays automatically.', caption: 'Customer balance badge' },
          { stepNumber: 3, title: 'Enter Amount & Mode', description: 'Specify received amount and payment method (Cash, UPI, Cheque, Bank Transfer).', caption: 'Payment receipt form' },
          { stepNumber: 4, title: 'Generate Payment Receipt', description: 'Save payment to decrement customer due balance and issue a signed receipt.', caption: 'Receipt confirmation' }
        ],
        notes: ['Receipt numbers are sequentially tracked.'],
        keywords: 'payment, customer payment, collect money, receipt'
      },
      {
        title: 'How to Manage Customer Follow-ups',
        slug: 'how-to-manage-customer-follow-ups',
        shortDescription: 'Schedule payment reminders, sales calls, and customer relationship follow-up tasks.',
        isFeatured: false,
        steps: [
          { stepNumber: 1, title: 'Open Follow-ups', description: 'Navigate to Customer Intelligence > Follow-ups.', caption: 'CRM follow-ups calendar' },
          { stepNumber: 2, title: 'Create Follow-up', description: 'Click "+ New Follow-up", pick customer, scheduled date, and reminder notes.', caption: 'Follow-up creation modal' },
          { stepNumber: 3, title: 'Mark as Completed', description: 'Once communicated, mark the reminder resolved and log outcome notes.', caption: 'Status resolved badge' }
        ],
        notes: ['Helps your sales team maintain continuous client engagement.'],
        keywords: 'follow-ups, reminder, crm, schedule, call'
      }
    ]
  },

  // ==========================================
  // CATEGORY 5: PURCHASES & SUPPLIERS
  // ==========================================
  {
    categoryName: 'Purchases & Suppliers',
    categorySlug: 'purchases-suppliers',
    categoryIcon: 'PackageCheck',
    categoryDesc: 'Inward purchase orders, supplier ledgers, payments, and stock additions.',
    categorySort: 5,
    articles: [
      {
        title: 'How to Create a Purchase',
        slug: 'how-to-create-a-purchase',
        shortDescription: 'Record stock inward from vendor invoices with cost prices, tax, and batch details.',
        isFeatured: true,
        steps: [
          { stepNumber: 1, title: 'Open Purchases', description: 'Go to Purchases > New Purchase.', caption: 'New Purchase entry form' },
          { stepNumber: 2, title: 'Select Supplier & Bill No', description: 'Choose supplier and enter vendor original tax invoice number.', caption: 'Supplier selection' },
          { stepNumber: 3, title: 'Add Inward Items', description: 'Add products and variants with inward quantity and purchase cost price.', caption: 'Purchase items cart' },
          { stepNumber: 4, title: 'Confirm Stock Inward', description: 'Save purchase. Available stock immediately increases across inventory.', caption: 'Stock inward confirmation' }
        ],
        notes: ['Purchase costs update variant cost prices for profit margin calculations.'],
        keywords: 'purchase, inward, supplier bill, stock inward'
      },
      {
        title: 'How to Add Suppliers',
        slug: 'how-to-add-suppliers',
        shortDescription: 'Maintain supplier contacts, GSTINs, bank accounts, and credit payment terms.',
        isFeatured: false,
        steps: [
          { stepNumber: 1, title: 'Open Suppliers Page', description: 'Navigate to Suppliers > Suppliers and click "+ Add Supplier".', caption: 'Suppliers directory' },
          { stepNumber: 2, title: 'Fill Vendor Details', description: 'Input Supplier Name, Phone, Email, GSTIN, and Bank Account Details.', caption: 'Supplier modal' },
          { stepNumber: 3, title: 'Save Supplier', description: 'Save profile to link with future purchase orders.', caption: 'Active supplier card' }
        ],
        notes: ['Bank details help streamline outward accounts payable transfers.'],
        keywords: 'supplier, vendor, add supplier, contact'
      },
      {
        title: 'How to Record Supplier Payments',
        slug: 'how-to-record-supplier-payments',
        shortDescription: 'Record payments made to vendors to reconcile accounts payable and supplier ledgers.',
        isFeatured: false,
        steps: [
          { stepNumber: 1, title: 'Open Supplier Payments', description: 'Go to Suppliers > Supplier Payments.', caption: 'Supplier payments view' },
          { stepNumber: 2, title: 'Select Supplier', description: 'Pick supplier and review total unpaid purchase balance.', caption: 'Outstanding balance display' },
          { stepNumber: 3, title: 'Record Payment Outward', description: 'Enter paid amount and reference number (e.g. NEFT/IMPS UTR).', caption: 'Payment voucher form' },
          { stepNumber: 4, title: 'Save Voucher', description: 'Confirm to reduce accounts payable liability.', caption: 'Voucher saved' }
        ],
        notes: ['Maintains clean audit trails for business expenses and payouts.'],
        keywords: 'supplier payment, accounts payable, vendor payout, neft'
      },
      {
        title: 'How to Manage Purchase Returns',
        slug: 'how-to-manage-purchase-returns',
        shortDescription: 'Return defective or excess stock to vendors and credit supplier balance.',
        isFeatured: false,
        steps: [
          { stepNumber: 1, title: 'Open Purchase Invoices', description: 'Locate original purchase invoice in Purchases > Purchases.', caption: 'Purchases list' },
          { stepNumber: 2, title: 'Create Debit Note / Return', description: 'Specify damaged item quantities and reason for debit note.', caption: 'Return items modal' },
          { stepNumber: 3, title: 'Process Debit Note', description: 'Inventory count decreases and supplier payable balance reduces accordingly.', caption: 'Debit note confirmation' }
        ],
        notes: ['Restores correct valuation to current stock holdings.'],
        keywords: 'purchase return, debit note, vendor return, damage'
      }
    ]
  },

  // ==========================================
  // CATEGORY 6: FINANCE & REPORTS
  // ==========================================
  {
    categoryName: 'Finance & Reports',
    categorySlug: 'finance-reports',
    categoryIcon: 'BarChart3',
    categoryDesc: 'Payments overview, daily expense logging, profit analytics, and Excel exports.',
    categorySort: 6,
    articles: [
      {
        title: 'How to Manage Payments',
        slug: 'how-to-manage-payments',
        shortDescription: 'Comprehensive overview of daily cash, UPI, card, and bank inflows.',
        isFeatured: false,
        steps: [
          { stepNumber: 1, title: 'Open Finance Payments', description: 'Go to Finance > Payments.', caption: 'Payments overview' },
          { stepNumber: 2, title: 'Filter by Payment Method', description: 'View breakdown by Cash, UPI QR, Card, and Bank Transfer.', caption: 'Payment method tabs' },
          { stepNumber: 3, title: 'Verify Daily Reconciliation', description: 'Match drawer cash and UPI settlement reports against recorded totals.', caption: 'Daily total reconciliation' }
        ],
        notes: ['Ensures zero cash drawer discrepancies at day end.'],
        keywords: 'payments, cash drawer, upi, reconciliation, finance'
      },
      {
        title: 'How to Record Expenses',
        slug: 'how-to-record-expenses',
        shortDescription: 'Log operational business expenses like rent, electricity, logistics, and tea.',
        isFeatured: false,
        steps: [
          { stepNumber: 1, title: 'Open Expenses', description: 'Navigate to Finance > Expenses and click "+ Add Expense".', caption: 'Expense dashboard' },
          { stepNumber: 2, title: 'Select Expense Category', description: 'Choose category (e.g. Rent, Utilities, Logistics, Staff Welfare).', caption: 'Expense category dropdown' },
          { stepNumber: 3, title: 'Enter Amount & Attach Receipt', description: 'Provide amount, paid date, payment mode, and optional receipt note.', caption: 'Expense input form' },
          { stepNumber: 4, title: 'Save Expense', description: 'Expense logs into monthly Profit & Loss statements.', caption: 'Saved expense confirmation' }
        ],
        notes: ['Expenses subtract from gross profit to compute net operational profit.'],
        keywords: 'expense, record expense, operational cost, bills'
      },
      {
        title: 'How to View Outstanding Balances',
        slug: 'how-to-view-outstanding-balances',
        shortDescription: 'Monitor accounts receivable and accounts payable due balances across your business.',
        isFeatured: false,
        steps: [
          { stepNumber: 1, title: 'Open Dashboard or Reports', description: 'Check the Total Outstanding Receivables KPI card on the dashboard.', caption: 'Receivables metric card' },
          { stepNumber: 2, title: 'Review Aging Balances', description: 'Open Reports > Customer Balances to view overdue accounts sorted by aging days.', caption: 'Aging report table' },
          { stepNumber: 3, title: 'Send Payment Reminder', description: 'Trigger WhatsApp or SMS reminder directly from the balance row.', caption: 'Reminder action trigger' }
        ],
        notes: ['Identifies high-risk overdue debtor accounts early.'],
        keywords: 'outstanding, balance due, receivables, aging'
      },
      {
        title: 'How to Generate Business Reports',
        slug: 'how-to-generate-business-reports',
        shortDescription: 'Generate Sales, GST, Stock Valuation, and Profit & Loss analytical reports.',
        isFeatured: true,
        steps: [
          { stepNumber: 1, title: 'Open Reports Section', description: 'Click Reports in the sidebar.', caption: 'Reports Centre' },
          { stepNumber: 2, title: 'Select Report Type', description: 'Choose Sales Summary, HSN Tax Report, Stock Valuation, or Customer Ledgers.', caption: 'Report category cards' },
          { stepNumber: 3, title: 'Set Date Range Filter', description: 'Select Today, This Week, This Month, or custom date picker.', caption: 'Date range selector' },
          { stepNumber: 4, title: 'View Real-Time Visuals', description: 'Inspect interactive bar graphs, pie charts, and itemized data tables.', caption: 'Visual analytics chart' }
        ],
        notes: ['Reports recalculate in real time based on active database records.'],
        keywords: 'reports, sales report, gst report, profit loss, analytics'
      },
      {
        title: 'How to Export Reports',
        slug: 'how-to-export-reports',
        shortDescription: 'Export comprehensive Excel spreadsheets and PDF audit summaries with one click.',
        isFeatured: false,
        steps: [
          { stepNumber: 1, title: 'Open Report of Interest', description: 'From Reports, choose Sales, Customers, or Inventory.', caption: 'Target report view' },
          { stepNumber: 2, title: 'Click Export Excel', description: 'Click the "Export to Excel (.xlsx)" button in the top right.', caption: 'Export button' },
          { stepNumber: 3, title: 'Share with Chartered Accountant', description: 'The generated workbook contains structured worksheets ready for GST filing.', caption: 'Excel workbook download' }
        ],
        notes: ['Compatible with Microsoft Excel, Google Sheets, and LibreOffice.'],
        keywords: 'export, excel, spreadsheet, xlsx, ca audit'
      }
    ]
  },

  // ==========================================
  // CATEGORY 7: ONLINE SHOP & CUSTOMER PORTAL
  // ==========================================
  {
    categoryName: 'Online Shop & Customer Portal',
    categorySlug: 'online-shop-and-customer-portal',
    categoryIcon: 'Globe',
    categoryDesc: 'Online storefront, QR code shopping, customer order queue, and self-service portal.',
    categorySort: 7,
    articles: [
      {
        title: 'How to Configure Your Online Shop',
        slug: 'how-to-configure-your-online-shop',
        shortDescription: 'Enable your custom online storefront URL (/shop/{shopSlug}) and branding.',
        isFeatured: true,
        steps: [
          { stepNumber: 1, title: 'Access Subscription Entitlement', description: 'Ensure your company has an active Growth (₹999/mo) or Lifetime plan.', caption: 'Growth plan active badge' },
          { stepNumber: 2, title: 'Configure Store URL & Name', description: 'Set your shop slug and store banner in Settings > Business Settings.', caption: 'Storefront slug configuration' },
          { stepNumber: 3, title: 'Visit Live Online Storefront', description: 'Open your public store URL: http://localhost:3000/shop/{shopSlug}.', caption: 'Live Storefront homepage' }
        ],
        notes: ['The online storefront is mobile-optimized and requires no separate mobile app.'],
        keywords: 'online shop, storefront, ecommerce, shop slug'
      },
      {
        title: 'How to Add Products to Your Online Store',
        slug: 'how-to-add-products-to-your-online-store',
        shortDescription: 'Toggle product visibility so retail customers can browse and order items online.',
        isFeatured: false,
        steps: [
          { stepNumber: 1, title: 'Open Product Catalog', description: 'Go to Products > Products and open any product.', caption: 'Product edit form' },
          { stepNumber: 2, title: 'Enable Online Storefront Toggle', description: 'Check "Display in Online Storefront".', caption: 'Online storefront toggle' },
          { stepNumber: 3, title: 'Verify Live Listing', description: 'Refresh your store URL. The product card displays with available size variants.', caption: 'Store product card' }
        ],
        notes: ['Items with zero stock automatically show "Sold Out" in online store.'],
        keywords: 'store products, online catalog, product listing'
      },
      {
        title: 'How to Generate a Store QR Code',
        slug: 'how-to-generate-a-store-qr-code',
        shortDescription: 'Download and display printable counter QR stands for in-store customer browsing.',
        isFeatured: false,
        steps: [
          { stepNumber: 1, title: 'Open Store Settings', description: 'Navigate to Settings > Online Shop QR.', caption: 'QR code generator' },
          { stepNumber: 2, title: 'Preview Counter Stand', description: 'Inspect the generated QR code linked directly to your digital storefront.', caption: 'Counter QR mockup' },
          { stepNumber: 3, title: 'Download & Print Stand', description: 'Download the high-resolution vector PDF and place the acrylic stand on your billing counter.', caption: 'Printable counter stand' }
        ],
        notes: ['Shoppers scan with any phone camera to browse stock instantly.'],
        keywords: 'qr code, qr stand, counter qr, scan store'
      },
      {
        title: 'How Customers Can Place Orders',
        slug: 'how-customers-can-place-orders',
        shortDescription: 'Guide for customers browsing products, adding variants to cart, and placing orders.',
        isFeatured: false,
        steps: [
          { stepNumber: 1, title: 'Browse Store Catalog', description: 'Customer opens store link, searches items, and filters by category.', caption: 'Online store catalogue' },
          { stepNumber: 2, title: 'Select Variant & Add to Cart', description: 'Customer selects desired size/color variant and adds to digital bag.', caption: 'Cart drawer' },
          { stepNumber: 3, title: 'Submit Order', description: 'Customer inputs Name and Phone Number, then clicks "Submit Order".', caption: 'Order submission modal' },
          { stepNumber: 4, title: 'Order Number Generated', description: 'A unique order number (e.g. ORD-1002) is issued with instant confirmation.', caption: 'Order confirmation badge' }
        ],
        notes: ['No upfront online payment required; customer pays at counter or on delivery.'],
        keywords: 'place order, customer cart, shopping bag, order submission'
      },
      {
        title: 'How to Manage Customer Orders',
        slug: 'how-to-manage-customer-orders',
        shortDescription: 'Review, accept, modify, and convert online orders into sales invoices at POS.',
        isFeatured: true,
        steps: [
          { stepNumber: 1, title: 'Open Customer Orders Queue', description: 'Go to Sales > Customer Orders in the sidebar.', caption: 'Customer Orders dashboard' },
          { stepNumber: 2, title: 'Review Pending Orders', description: 'Inspect incoming orders marked as PENDING_REVIEW with item counts.', caption: 'Pending order card' },
          { stepNumber: 3, title: 'Convert Directly into POS Sale', description: 'Click "Convert to Sale". Cart pre-fills automatically in POS for instant billing.', caption: 'POS conversion action' },
          { stepNumber: 4, title: 'Finalize and Print', description: 'Accept customer payment. The order status updates to BILLED.', caption: 'Billed status badge' }
        ],
        notes: ['Customer orders queue is accessible to Growth and Lifetime plan subscribers.'],
        keywords: 'customer orders, order queue, accept order, convert order'
      },
      {
        title: 'How Customers Can Use the Self-Service Portal',
        slug: 'how-customers-can-use-the-self-service-portal',
        shortDescription: 'Customer guide to downloading invoice PDFs, checking ledgers, and reviewing orders.',
        isFeatured: true,
        steps: [
          { stepNumber: 1, title: 'Access Portal Link', description: 'Customers visit /shop/{shopSlug}/portal.', caption: 'Customer Portal landing' },
          { stepNumber: 2, title: 'Login with Mobile Number', description: 'Customer logs in using their registered mobile phone number.', caption: 'Portal login prompt' },
          { stepNumber: 3, title: 'Explore Invoice History', description: 'Customer can view every past purchase, inspect receipts, and download PDF tax bills.', caption: 'Customer invoices tab' },
          { stepNumber: 4, title: 'Inspect Account Statement', description: 'The Ledger tab displays running debit/credit entries and current outstanding due balance.', caption: 'Customer account ledger' }
        ],
        notes: ['Included with Growth and Lifetime plans with full company data isolation.'],
        keywords: 'customer portal, self service, download invoices, statement'
      }
    ]
  },

  // ==========================================
  // CATEGORY 8: WHATSAPP & MARKETING
  // ==========================================
  {
    categoryName: 'WhatsApp & Marketing',
    categorySlug: 'whatsapp-marketing',
    categoryIcon: 'MessageSquare',
    categoryDesc: 'Meta WhatsApp integration, automated payment reminders, and customer campaigns.',
    categorySort: 8,
    articles: [
      {
        title: 'How to Connect WhatsApp Business',
        slug: 'how-to-connect-whatsapp-business',
        shortDescription: 'Link your Meta WhatsApp Business API account for official verified messaging.',
        isFeatured: false,
        steps: [
          { stepNumber: 1, title: 'Open WhatsApp Settings', description: 'Go to Settings > WhatsApp Connection.', caption: 'WhatsApp Connection settings' },
          { stepNumber: 2, title: 'Enter Meta API Credentials', description: 'Provide Phone Number ID, WhatsApp Business Account ID, and System User Access Token.', caption: 'Meta API credential fields' },
          { stepNumber: 3, title: 'Test Connection', description: 'Click "Send Test Message" to verify webhook and outgoing token handshake.', caption: 'Connected status pill' }
        ],
        notes: ['Requires an active Meta Developer Business account.'],
        keywords: 'whatsapp, meta, api, connect whatsapp, token'
      },
      {
        title: 'How to Configure Message Templates',
        slug: 'how-to-configure-message-templates',
        shortDescription: 'Setup approved WhatsApp notification templates for invoices and payment alerts.',
        isFeatured: false,
        steps: [
          { stepNumber: 1, title: 'Open Templates', description: 'Navigate to Settings > WhatsApp Connection > Templates.', caption: 'Message Templates gallery' },
          { stepNumber: 2, title: 'Select Standard Event Templates', description: 'Configure templates for Invoice Generated, Payment Received, and Due Reminder.', caption: 'Template mapping' },
          { stepNumber: 3, title: 'Save Templates', description: 'Ensure template variable tokens like {{1}} (Customer Name) are mapped correctly.', caption: 'Active templates list' }
        ],
        notes: ['Templates must be pre-approved inside your Meta Business Manager.'],
        keywords: 'whatsapp templates, message templates, meta approved'
      },
      {
        title: 'How to Share Invoices Through WhatsApp',
        slug: 'how-to-share-invoices-through-whatsapp',
        shortDescription: 'Send digital invoice PDF download links directly to customer WhatsApp with one click.',
        isFeatured: true,
        steps: [
          { stepNumber: 1, title: 'Finalize Sale or Open Invoice', description: 'From POS or Sales > Invoices, open the confirmed invoice.', caption: 'Invoice actions bar' },
          { stepNumber: 2, title: 'Click WhatsApp Share Button', description: 'Click the green "Share on WhatsApp" icon.', caption: 'WhatsApp share button' },
          { stepNumber: 3, title: 'Dispatch Message', description: 'Message sends via Meta API or opens WhatsApp Web with pre-formatted invoice details.', caption: 'WhatsApp preview dialog' }
        ],
        notes: ['Saves paper costs and provides instant digital delivery.'],
        keywords: 'share invoice, whatsapp invoice, send bill, digital receipt'
      },
      {
        title: 'How to Send Payment Reminders',
        slug: 'how-to-send-payment-reminders',
        shortDescription: 'Politely remind overdue debtors about outstanding balances via automated WhatsApp messages.',
        isFeatured: false,
        steps: [
          { stepNumber: 1, title: 'Open Customer Profile', description: 'Go to Customers and locate a client with an outstanding due balance.', caption: 'Customer card with due amount' },
          { stepNumber: 2, title: 'Click Send Due Reminder', description: 'Click "Send Payment Reminder via WhatsApp".', caption: 'Due reminder action' },
          { stepNumber: 3, title: 'Confirm & Send', description: 'The message includes outstanding amount and store UPI payment details.', caption: 'Dispatched message toast' }
        ],
        notes: ['Speeds up accounts receivable collections significantly.'],
        keywords: 'payment reminder, due reminder, whatsapp reminder, collect'
      },
      {
        title: 'How to Create WhatsApp Campaigns',
        slug: 'how-to-create-whatsapp-campaigns',
        shortDescription: 'Broadcast festive offers and new arrival announcements to customer segments.',
        isFeatured: false,
        steps: [
          { stepNumber: 1, title: 'Open Campaigns', description: 'Navigate to Marketing > WhatsApp Campaigns.', caption: 'WhatsApp Campaigns hub' },
          { stepNumber: 2, title: 'Select Target Segment', description: 'Choose recipient group (e.g. All Customers, High-Value Clients, Dormant 60 Days).', caption: 'Audience segment selector' },
          { stepNumber: 3, title: 'Compose Campaign', description: 'Choose your approved marketing template and schedule launch time.', caption: 'Campaign scheduler' },
          { stepNumber: 4, title: 'Launch Broadcast', description: 'Confirm broadcast. Delivery rates and responses track in real time.', caption: 'Campaign analytics dashboard' }
        ],
        notes: ['Included in Growth (₹999/mo) and Lifetime packages.'],
        keywords: 'whatsapp campaign, marketing, broadcast, festive offer'
      }
    ]
  },

  // ==========================================
  // CATEGORY 9: SUBSCRIPTION & ACCOUNT
  // ==========================================
  {
    categoryName: 'Subscription & Billing',
    categorySlug: 'subscription-billing',
    categoryIcon: 'CreditCard',
    categoryDesc: 'Pricing plans, upgrading subscriptions, payment receipts, and lifetime ownership.',
    categorySort: 9,
    articles: [
      {
        title: 'Understanding VEXA Invoice Subscription Plans',
        slug: 'understanding-vexa-invoice-subscription-plans',
        shortDescription: 'Detailed feature comparison between Starter (₹599/mo), Growth (₹999/mo), and Lifetime (₹59,999).',
        isFeatured: true,
        steps: [
          { stepNumber: 1, title: 'Starter Plan (₹599/month)', description: 'Full core POS billing, GST invoicing, inventory control, SKU barcodes, customer ledgers, and multi-user roles.', caption: 'Starter plan card' },
          { stepNumber: 2, title: 'Growth Plan (₹999/month)', description: 'Includes All Starter features PLUS Customer Self-Service Portal, Online Storefront, WhatsApp Campaigns, and Advanced Analytics.', caption: 'Growth plan card' },
          { stepNumber: 3, title: 'Lifetime Ownership (₹59,999 One-Time)', description: 'Pay once with permanent access for life to all core billing modules and custom online store features with zero monthly renewal charges.', caption: 'Lifetime package card' }
        ],
        notes: ['All prices are flat with no hidden charges.', 'A 3-day grace period is provided if monthly mandate renewal fails.'],
        keywords: 'subscription plans, starter, growth, lifetime, pricing'
      },
      {
        title: 'How to Upgrade Your Subscription',
        slug: 'how-to-upgrade-your-subscription',
        shortDescription: 'Upgrade seamlessly between monthly tiers or unlock permanent Lifetime access via Razorpay.',
        isFeatured: false,
        steps: [
          { stepNumber: 1, title: 'Open Subscription & Billing', description: 'Navigate to Settings > Subscription & Billing in the sidebar.', caption: 'Subscription settings view' },
          { stepNumber: 2, title: 'Select Desired Package', description: 'Click "Choose Growth — ₹999/mo" or "Unlock Lifetime Access — ₹59,999".', caption: 'Plan select button' },
          { stepNumber: 3, title: 'Authorize Mandate via Razorpay', description: 'Complete payment authorization via UPI Autopay, NetBanking, or Debit/Credit Card.', caption: 'Razorpay checkout window' },
          { stepNumber: 4, title: 'Instant Activation', description: 'Your business profile and features unlock immediately upon payment confirmation.', caption: 'Active subscription pill' }
        ],
        notes: ['Payments are securely processed via Razorpay.'],
        keywords: 'upgrade, subscribe, razorpay, renew, billing'
      },
      {
        title: 'How to View Payment History',
        slug: 'how-to-view-payment-history',
        shortDescription: 'Review all past subscription invoices and download official tax receipts.',
        isFeatured: false,
        steps: [
          { stepNumber: 1, title: 'Open Subscription Page', description: 'Go to Settings > Subscription & Billing.', caption: 'Subscription page' },
          { stepNumber: 2, title: 'Scroll to Payment History Table', description: 'View all processed mandate charges, payment IDs, dates, and amounts.', caption: 'Payment history ledger' },
          { stepNumber: 3, title: 'Download Receipt', description: 'Click Download Receipt to save the official PDF invoice for tax filings.', caption: 'Tax receipt download' }
        ],
        notes: ['Official payment receipts include your company legal name and GSTIN.'],
        keywords: 'payment history, receipts, invoices, subscription bills'
      },
      {
        title: 'Understanding Lifetime Plan Benefits',
        slug: 'understanding-lifetime-plan-benefits',
        shortDescription: 'Permanent business ownership advantages with zero recurring renewal fees.',
        isFeatured: true,
        steps: [
          { stepNumber: 1, title: 'Permanent Core & Storefront Access', description: 'Zero recurring fees forever for core billing, inventory, and custom online storefront.', caption: 'Lifetime badge' },
          { stepNumber: 2, title: 'Priority Technical Support', description: 'Lifetime license holders receive expedited VIP support ticket routing with VEXA TECH.', caption: 'VIP support badge' },
          { stepNumber: 3, title: 'Continuous Feature Updates', description: 'Includes future core improvements, security updates, and performance patches.', caption: 'Updates guarantee' }
        ],
        notes: ['Verified with dedicated digital platform license certificates.'],
        keywords: 'lifetime plan, permanent license, one-time payment, benefits'
      }
    ]
  }
];


/**
 * Seed Tamil Translations for Help Center
 * Categories, Articles, and FAQs
 */
const prisma = require('../src/config/db');

const categoryTranslations = [
  {
    slug: 'getting-started',
    name_ta: 'தொடங்குதல்',
    description_ta: 'அறிமுகம், ஆரம்ப உள்நுழைவு, பணிப்பகுதி மேலோட்டம் மற்றும் வணிக அமைப்புகள்.'
  },
  {
    slug: 'products-inventory',
    name_ta: 'பொருட்கள் & சரக்கு இருப்பு',
    description_ta: 'பட்டியல் மேலாண்மை, பார்கோடு உருவாக்கம், வகைகள் மற்றும் நேரடி சரக்குக் கட்டுப்பாடு.'
  },
  {
    slug: 'sales-billing',
    name_ta: 'விற்பனை & பில்லிங்',
    description_ta: 'POS முனையம், GST வரி கணக்கீடுகள், விலைப்பட்டியல் உருவாக்கம், விற்பனை திரும்புதல் மற்றும் விலை மேற்கோள்கள்.'
  },
  {
    slug: 'customers-crm',
    name_ta: 'வாடிக்கையாளர்கள் & CRM',
    description_ta: 'வாடிக்கையாளர் பட்டியல், கடன் பேரேடுகள், நிலுவைத் தொகை மற்றும் தகவல் தொடர்பு.'
  },
  {
    slug: 'purchases-suppliers',
    name_ta: 'கொள்முதல் & சப்ளையர்கள்',
    description_ta: 'உள்வரும் கொள்முதல் ஆர்டர்கள், சப்ளையர் பேரேடுகள், பணம் செலுத்துதல் மற்றும் சரக்கு சேர்த்தல்.'
  },
  {
    slug: 'finance-reports',
    name_ta: 'நிதி & அறிக்கைகள்',
    description_ta: 'பணம் செலுத்துதல் மேலோட்டம், தினசரி செலவுகள் பதிவு செய்தல், லாப பகுப்பாய்வு மற்றும் Excel ஏற்றுமதி.'
  },
  {
    slug: 'online-shop-and-customer-portal',
    name_ta: 'ஆன்லைன் கடை & வாடிக்கையாளர் போர்டல்',
    description_ta: 'ஆன்லைன் ஸ்டோர், QR குறியீடு ஷாப்பிங், வாடிக்கையாளர் ஆர்டர் வரிசை மற்றும் சுய சேவை போர்டல்.'
  },
  {
    slug: 'whatsapp-marketing',
    name_ta: 'WhatsApp & மார்க்கெட்டிங்',
    description_ta: 'Meta WhatsApp ஒருங்கிணைப்பு, தானியங்கி கட்டண நினைவூட்டல்கள் மற்றும் வாடிக்கையாளர் பிரச்சாரங்கள்.'
  },
  {
    slug: 'subscription-billing',
    name_ta: 'சந்தா & பில்லிங்',
    description_ta: 'விலைத் திட்டங்கள், சந்தா மேம்படுத்தல், கட்டண ரசீதுகள் மற்றும் வாழ்நாள் உரிமை நன்மைகள்.'
  }
];

// Map of slug -> Tamil title, short_description, and step translations
const articleTranslations = {
  'introduction-to-vexa-invoice': {
    title_ta: 'VEXA Invoice அறிமுகம்',
    short_description_ta: 'VEXA Invoice மென்பொருளின் முக்கிய அம்சங்கள் மற்றும் அமைப்பு பற்றிய மேலோட்டம்.',
    important_notes_ta: ['VEXA Invoice வணிகத்தை விரைவாகவும் துல்லியமாகவும் நிர்வகிக்க உதவுகிறது.']
  },
  'business-profile-setup': {
    title_ta: 'வணிக சுயவிவரம் மற்றும் அமைப்புகள் அமைப்பது எப்படி?',
    short_description_ta: 'நிறுவனத்தின் பெயர், GST எண், முகவரி மற்றும் வங்கி விவரங்களை உள்ளமைக்கவும்.',
    important_notes_ta: ['சரியான GST மற்றும் வங்கி விவரங்கள் உங்கள் விலைப்பட்டியலில் பிரதிபலிக்கும்.']
  },
  'employee-management-and-roles': {
    title_ta: 'பணியாளர்கள் மேலாண்மை மற்றும் பொறுப்புகள்',
    short_description_ta: 'பணியாளர் கணக்குகளை உருவாக்கி, தனிப்பயன் அனுமதிகள் மற்றும் பொறுப்புகளை வழங்கவும்.',
    important_notes_ta: ['பாதுகாப்பிற்காக ஒவ்வொரு பணியாளருக்கும் தேவைக்கேற்ப அனுமதிகளை வழங்கவும்.']
  },
  'create-product-and-variants': {
    title_ta: 'புதிய தயாரிப்பு மற்றும் வகைகளை உருவாக்குவது எப்படி?',
    short_description_ta: 'தயாரிப்பு விவரங்கள், வண்ணங்கள், அளவுகள் மற்றும் விலைகளுடன் வகைகளைச் சேர்க்கவும்.',
    important_notes_ta: ['ஒரே தயாரிப்பில் பல அளவுகள் மற்றும் வண்ணங்களை எளிதாக உருவாக்கலாம்.']
  },
  'barcode-labels-and-scanning': {
    title_ta: 'பார்கோடு லேபிள்கள் அச்சிடுதல் மற்றும் ஸ்கேன் செய்தல்',
    short_description_ta: 'பொருட்களுக்கான பார்கோடுகளை அச்சிட்டு பில்லிங் கவுண்டரில் உடனடியாக ஸ்கேன் செய்யவும்.',
    important_notes_ta: ['பார்கோடு ஸ்கேனர் மூலம் பில்லிங் வேகத்தை பல மடங்கு அதிகரிக்கலாம்.']
  },
  'create-new-sale-pos-invoice': {
    title_ta: 'புதிய விற்பனை & POS விலைப்பட்டியல் உருவாக்குவது எப்படி?',
    short_description_ta: 'வாடிக்கையாளரைத் தேர்வு செய்து, பொருட்களைச் சேர்த்து, உடனடியாக பில் உருவாக்கவும்.',
    important_notes_ta: ['GST தானாகவே கணக்கிடப்பட்டு துல்லியமான விலைப்பட்டியல் உருவாகும்.']
  },
  'sales-returns-and-refunds': {
    title_ta: 'விற்பனைத் திரும்புதல் மற்றும் ரீஃபண்டுகளை நிர்வகிப்பது எப்படி?',
    short_description_ta: 'வாடிக்கையாளர் திருப்பி அனுப்பும் பொருட்களைப் பதிவு செய்து கிரெடிட் நோட் உருவாக்கவும்.',
    important_notes_ta: ['திரும்பப் பெறப்பட்ட பொருட்கள் மீண்டும் சரக்கு இருப்பில் தானாகவே சேர்க்கப்படும்.']
  },
  'customer-self-service-portal-guide': {
    title_ta: 'வாடிக்கையாளர் சுய சேவை போர்டல் வழிகாட்டி',
    short_description_ta: 'வாடிக்கையாளர்கள் தங்கள் பில்கள், நிலுவைத் தொகை மற்றும் ஆர்டர்களை சுயமாகப் பார்க்க அனுமதிக்கவும்.',
    important_notes_ta: ['வாடிக்கையாளர்களுக்கு தனித்துவமான லிங்க் மூலம் போர்டல் அணுகல் வழங்கப்படுகிறது.']
  },
  'understanding-subscription-plans': {
    title_ta: 'VEXA Invoice சந்தா திட்டங்களைப் புரிந்துகொள்ளுதல்',
    short_description_ta: 'மாதாந்திர, வருடாந்திர மற்றும் வாழ்நாள் திட்டங்களின் சிறப்பம்சங்கள் மற்றும் நன்மைகள்.',
    important_notes_ta: ['உங்கள் வணிக வளர்ச்சிக்கு ஏற்ற சிறந்த திட்டத்தைத் தேர்வு செய்யுங்கள்.']
  },
  'how-to-log-in-to-vexa-invoice': {
    title_ta: 'VEXA Invoice-ல் உள்நுழைவது எப்படி?',
    short_description_ta: 'உங்கள் பதிவுசெய்த மின்னஞ்சல் மற்றும் கடவுச்சொல் மூலம் பாதுகாப்பாக உள்நுழையுங்கள்.',
    important_notes_ta: ['கடவுச்சொல்லைப் பாதுகாப்பாக வைத்துக்கொள்ளவும்.']
  },
  'understanding-the-dashboard': {
    title_ta: 'டாஷ்போர்டைப் புரிந்துகொள்ளுதல்',
    short_description_ta: 'தினசரி விற்பனை, நிலுவைத் தொகைகள் மற்றும் வணிக அளவீடுகளை டாஷ்போர்டில் கண்காணிக்கவும்.',
    important_notes_ta: ['டாஷ்போர்டு நிகழ்நேர வணிக நிலவரத்தைக் காட்டுகிறது.']
  },
  'how-to-configure-your-business-profile': {
    title_ta: 'வணிக சுயவிவரத்தை எவ்வாறு உள்ளமைப்பது?',
    short_description_ta: 'நிறுவன லோகோ, தொலைபேசி எண், முகவரி மற்றும் GST தகவல்களை புதுப்பிக்கவும்.',
    important_notes_ta: ['விலைப்பட்டியலில் தொழில்முறை லோகோ மற்றும் வணிக விவரங்கள் அச்சிடப்படும்.']
  },
  'how-to-manage-company-settings': {
    title_ta: 'நிறுவன அமைப்புகளை எவ்வாறு நிர்வகிப்பது?',
    short_description_ta: 'வரி விகிதங்கள், விலைப்பட்டியல் வடிவங்கள் மற்றும் அறிவிப்பு விருப்பங்களை அமைக்கவும்.',
    important_notes_ta: ['உங்கள் வணிகத் தேவைக்கேற்ப அமைப்புகளைத் தனிப்பயனாக்கலாம்.']
  },
  'how-to-create-employee-accounts': {
    title_ta: 'பணியாளர் கணக்குகளை எவ்வாறு உருவாக்குவது?',
    short_description_ta: 'பில்லிங் காசாளர், மேலாளர் அல்லது பங்குப் பொறுப்பாளர்களுக்கு தனி கணக்குகள் தொடங்கவும்.',
    important_notes_ta: ['ஒவ்வொரு ஊழியருக்கும் தனி உள்நுழைவு அடையாளம் வழங்கப்படும்.']
  },
  'understanding-roles-and-permissions': {
    title_ta: 'பொறுப்புகள் மற்றும் அனுமதிகளைப் புரிந்துகொள்ளுதல்',
    short_description_ta: 'பணியாளர்கள் பார்க்க மற்றும் மாற்றக்கூடிய அம்சங்களை பாதுகாப்பாகக் கட்டுப்படுத்துங்கள்.',
    important_notes_ta: ['நிர்வாகி மட்டுமே முக்கிய நிதி அறிக்கைகளை அணுக முடியும்.']
  },
  'how-to-create-your-first-product': {
    title_ta: 'உங்கள் முதல் தயாரிப்பை எவ்வாறு உருவாக்குவது?',
    short_description_ta: 'தயாரிப்புப் பெயர், விலை, GST வரி விகிதம் மற்றும் யூனிட் சேர்த்து சேமிக்கவும்.',
    important_notes_ta: ['சரியான கொள்முதல் மற்றும் விற்பனை விலையை உள்ளிடவும்.']
  },
  'how-to-create-product-categories': {
    title_ta: 'தயாரிப்பு வகைகளை எவ்வாறு உருவாக்குவது?',
    short_description_ta: 'பொருட்களை எளிதாகக் கண்டறிய வகைகள் மற்றும் துணை வகைகளாக ஒழுங்கமைக்கவும்.',
    important_notes_ta: ['வகைகள் மூலம் விற்பனை அறிக்கைகளை எளிதில் பகுப்பாய்வு செய்யலாம்.']
  },
  'how-to-add-product-variants': {
    title_ta: 'தயாரிப்பு வகைகளை (Variants) எவ்வாறு சேர்ப்பது?',
    short_description_ta: 'அளவு (Size), நிறம் (Color) போன்ற மாறுபாடுகளுடன் பல வகைகளை ஒரே இடத்தில் சேர்க்கவும்.',
    important_notes_ta: ['ஒவ்வொரு மாறுபாட்டிற்கும் தனி பார்கோடு உருவாக்கப்படும்.']
  },
  'how-to-generate-automatic-sku': {
    title_ta: 'தானியங்கி SKU-வை எவ்வாறு உருவாக்குவது?',
    short_description_ta: 'தயாரிப்புகளுக்கு தானாகவே தனித்துவமான SKU குறியீட்டை முறைப்படி உருவாக்கவும்.',
    important_notes_ta: ['SKU-வை கைமுறையாகவோ அல்லது கணினி மூலமாகவோ உருவாக்கலாம்.']
  },
  'how-to-generate-barcode-labels': {
    title_ta: 'பார்கோடு லேபிள்களை எவ்வாறு உருவாக்குவது?',
    short_description_ta: 'பொருட்களுக்கான ஸ்டிக்கர் லேபிள்களை உருவாக்கி அச்சுப்பொறியில் அச்சிடவும்.',
    important_notes_ta: ['பல்வேறு லேபிள் அளவுகள் மற்றும் வடிவங்களுக்கு ஆதரவு உள்ளது.']
  },
  'how-to-scan-product-barcodes': {
    title_ta: 'தயாரிப்பு பார்கோடுகளை எவ்வாறு ஸ்கேன் செய்வது?',
    short_description_ta: 'USB அல்லது வயர்லெஸ் ஸ்கேனர் மூலம் பில்லிங் செய்யும் போது பார்கோடை ஸ்கேன் செய்யவும்.',
    important_notes_ta: ['ஸ்கேன் செய்தவுடன் தயாரிப்பு உடனடியாக கார்ட்டில் சேர்க்கப்படும்.']
  },
  'how-to-manage-stock': {
    title_ta: 'சரக்கு இருப்பை (Stock) எவ்வாறு நிர்வகிப்பது?',
    short_description_ta: 'தற்போதைய கையிருப்பு, குறைந்த இருப்பு எச்சரிக்கைகள் மற்றும் சரக்கு நிலவரங்களை சரிபார்க்கவும்.',
    important_notes_ta: ['குறைந்த இருப்பு எச்சரிக்கை மூலம் சரக்கு தீர்ந்துபோவதைத் தடுக்கலாம்.']
  },
  'how-to-record-stock-adjustments': {
    title_ta: 'சரக்கு சரிசெய்தல்களை எவ்வாறு பதிவு செய்வது?',
    short_description_ta: 'சேதமடைந்த அல்லது கணக்கீடு சரிசெய்யப்பட்ட பொருட்களை இருப்பில் புதுப்பிக்கவும்.',
    important_notes_ta: ['சரக்கு தணிக்கையின் போது சரிசெய்தல் விவரங்கள் பதிவாகும்.']
  },
  'how-to-view-stock-movements': {
    title_ta: 'சரக்கு நகர்வுகளை எவ்வாறு பார்ப்பது?',
    short_description_ta: 'விற்பனை, கொள்முதல் மற்றும் சரிசெய்தல் மூலம் சரக்கு மாற்றங்களின் வரலாற்றைக் கண்காணிக்கவும்.',
    important_notes_ta: ['ஒவ்வொரு பரிவர்த்தனையிலும் பங்கு மாற்றங்கள் துல்லியமாகப் பதிவாகும்.']
  },
  'how-to-create-a-new-sale': {
    title_ta: 'புதிய விற்பனையை எவ்வாறு உருவாக்குவது?',
    short_description_ta: 'POS திரையில் வாடிக்கையாளர் மற்றும் பொருட்களைத் தேர்ந்தெடுத்து பில்லை முடிக்கவும்.',
    important_notes_ta: ['ரொக்கம், கார்டு, UPI மற்றும் கடன் மூலம் கட்டணம் பெறலாம்.']
  },
  'how-to-generate-a-gst-invoice': {
    title_ta: 'GST விலைப்பட்டியலை எவ்வாறு உருவாக்குவது?',
    short_description_ta: 'CGST, SGST அல்லது IGST வரிக் கணக்கீட்டுடன் முறைப்படியான விலைப்பட்டியல் அச்சிடவும்.',
    important_notes_ta: ['அரசு விதிகளுக்கு உட்பட்ட துல்லியமான வரி விவரங்கள் அச்சிடப்படும்.']
  },
  'how-to-generate-a-non-gst-invoice': {
    title_ta: 'Non-GST விலைப்பட்டியலை எவ்வாறு உருவாக்குவது?',
    short_description_ta: 'வரி விலக்கு பெற்ற அல்லது சாதாரண ரசீதுகளுக்கான விலைப்பட்டியலை உருவாக்கவும்.',
    important_notes_ta: ['எளிய பில்லிங் முறையை விரும்பும் வணிகர்களுக்கு இது ஏற்றது.']
  },
  'how-to-print-an-invoice': {
    title_ta: 'விலைப்பட்டியலை அச்சிடுவது எப்படி?',
    short_description_ta: 'தெர்மல் பிரிண்டர் அல்லது A4 பிரிண்டரில் விலைப்பட்டியலை உடனடியாக அச்சிடுங்கள்.',
    important_notes_ta: ['தெர்மல் மற்றும் A4 அளவுகள் இரண்டிற்கும் பிரத்யேக லேஅவுட் உள்ளது.']
  },
  'how-to-download-an-invoice-pdf': {
    title_ta: 'விலைப்பட்டியலை PDF வடிவில் பதிவிறக்குவது எப்படி?',
    short_description_ta: 'விலைப்பட்டியலை உயர்தர PDF கோப்பாக சேமித்து வாடிக்கையாளருக்கு பகிருங்கள்.',
    important_notes_ta: ['வாடிக்கையாளர்களுக்கு மின்னஞ்சல் அல்லது WhatsApp-ல் அனுப்ப PDF சிறந்தது.']
  },
  'how-to-manage-sales-returns': {
    title_ta: 'விற்பனைத் திரும்புதல்களை எவ்வாறு நிர்வகிப்பது?',
    short_description_ta: 'வாடிக்கையாளர் திரும்பத் தரும் பொருட்களுக்கு ரசீது மற்றும் கடன் குறிப்பு (Credit Note) வழங்கவும்.',
    important_notes_ta: ['திரும்பிய பொருட்கள் உங்கள் கணக்கிலும் இருப்பிலும் உடனடியாக சரிசெய்யப்படும்.']
  },
  'how-to-create-quotations': {
    title_ta: 'விலை மேற்கோள்களை (Quotations) எவ்வாறு உருவாக்குவது?',
    short_description_ta: 'சரக்கு இருப்பைக் கழிக்காமல் வாடிக்கையாளர்களுக்கு உத்தேச விலைப்பட்டியல் வழங்கவும்.',
    important_notes_ta: ['வாடிக்கையாளர் சம்மதித்தவுடன் மேற்கோளை ஒரே கிளிக்கில் விலைப்பட்டியலாக மாற்றலாம்.']
  },
  'how-to-convert-a-quotation-into-an-invoice': {
    title_ta: 'விலை மேற்கோளை விலைப்பட்டியலாக மாற்றுவது எப்படி?',
    short_description_ta: 'ஏற்கனவே தயார் செய்யப்பட்ட மேற்கோளை மீண்டும் தட்டச்சு செய்யாமல் பில்லாக மாற்றவும்.',
    important_notes_ta: ['நேர விரயம் தவிர்க்கப்பட்டு பில்லிங் மிக விரைவாக நடக்கும்.']
  },
  'how-to-add-customers': {
    title_ta: 'வாடிக்கையாளர்களை எவ்வாறு சேர்ப்பது?',
    short_description_ta: 'வாடிக்கையாளரின் பெயர், மொபைல் எண், முகவரி மற்றும் GST எண்ணைப் பதிவு செய்யவும்.',
    important_notes_ta: ['வாடிக்கையாளர் தொலைபேசி எண் WhatsApp பில்லிங்கிற்கு அவசியமானது.']
  },
  'how-to-view-customer-intelligence': {
    title_ta: 'வாடிக்கையாளர் நுண்ணறிவை எவ்வாறு பார்ப்பது?',
    short_description_ta: 'அதிகம் வாங்கும் வாடிக்கையாளர்கள், வாங்கும் பழக்கங்கள் மற்றும் விற்பனை போக்குகளை பகுப்பாய்வு செய்யவும்.',
    important_notes_ta: ['முக்கிய வாடிக்கையாளர்களுக்கு சிறப்புச் சலுகைகளை வழங்க உதவுகிறது.']
  },
  'how-to-manage-customer-ledgers': {
    title_ta: 'வாடிக்கையாளர் பேரேடுகளை எவ்வாறு நிர்வகிப்பது?',
    short_description_ta: 'ஒவ்வொரு வாடிக்கையாளரின் பில்கள், பெறப்பட்ட பணம் மற்றும் மீதமுள்ள நிலுவைத் தொகையை கண்காணிக்கவும்.',
    important_notes_ta: ['கடன் மற்றும் நிலுவை நிலவரங்களை எப்போதும் தெளிவாக வைத்திருக்கலாம்.']
  },
  'how-to-record-customer-payments': {
    title_ta: 'வாடிக்கையாளர் கொடுப்பனவுகளை எவ்வாறு பதிவு செய்வது?',
    short_description_ta: 'வாடிக்கையாளர்கள் செலுத்தும் பகுதித் தொகை அல்லது முழு நிலுவைத் தொகையைப் பதிவு செய்யவும்.',
    important_notes_ta: ['கட்டணம் செலுத்தியவுடன் ரசீது தானாக உருவாகும்.']
  },
  'how-to-manage-customer-follow-ups': {
    title_ta: 'வாடிக்கையாளர் நிலுவை பின்தொடர்தலை எவ்வாறு நிர்வகிப்பது?',
    short_description_ta: 'நிலுவைத் தொகையை வசூலிக்க வாடிக்கையாளர்களுக்கு சரியான நேரத்தில் நினைவூட்டல் அனுப்பவும்.',
    important_notes_ta: ['வணிக பணப்புழக்கத்தை சீராக வைத்திருக்க உதவுகிறது.']
  },
  'how-to-create-a-purchase': {
    title_ta: 'கொள்முதலை எவ்வாறு உருவாக்குவது?',
    short_description_ta: 'சப்ளையரிடமிருந்து வாங்கிய சரக்குகளை பில் எண் மற்றும் கொள்முதல் விலையுடன் உள்ளிடவும்.',
    important_notes_ta: ['கொள்முதல் உள்ளிட்டவுடன் தயாரிப்பு கையிருப்பு தானாகவே அதிகரிக்கும்.']
  },
  'how-to-add-suppliers': {
    title_ta: 'சப்ளையர்களை எவ்வாறு சேர்ப்பது?',
    short_description_ta: 'சரக்கு வழங்கும் விநியோகஸ்தர்களின் தொடர்பு விவரங்கள் மற்றும் GST எண்ணை சேமிக்கவும்.',
    important_notes_ta: ['சப்ளையர் பில்கள் மற்றும் கொடுப்பனவுகளை முறையாகக் கண்காணிக்கலாம்.']
  },
  'how-to-record-supplier-payments': {
    title_ta: 'சப்ளையர் கொடுப்பனவுகளை எவ்வாறு பதிவு செய்வது?',
    short_description_ta: 'விநியோகஸ்தர்களுக்கு வங்கி, காசோலை அல்லது ரொக்கம் மூலம் செலுத்திய தொகையை உள்ளிடவும்.',
    important_notes_ta: ['சப்ளையர் கடன் பேரேடு தானாகவே புதுப்பிக்கப்படும்.']
  },
  'how-to-manage-purchase-returns': {
    title_ta: 'கொள்முதல் திரும்புதல்களை எவ்வாறு நிர்வகிப்பது?',
    short_description_ta: 'சேதமடைந்த பொருட்களை சப்ளையருக்குத் திருப்பி அனுப்பி டெபிட் நோட் உருவாக்கவும்.',
    important_notes_ta: ['திரும்பிய பொருட்களின் மதிப்பு சப்ளையர் நிலுவையிலிருந்து கழிக்கப்படும்.']
  },
  'how-to-manage-payments': {
    title_ta: 'கொடுப்பனவுகளை எவ்வாறு நிர்வகிப்பது?',
    short_description_ta: 'வரவு மற்றும் செலவு பரிவர்த்தனைகளை ஒரே இடத்தில் விரிவாக கண்காணிக்கவும்.',
    important_notes_ta: ['அனைத்து கட்டண முறைகளின் விவரங்களும் இதில் அடங்கும்.']
  },
  'how-to-record-expenses': {
    title_ta: 'வணிக செலவுகளை எவ்வாறு பதிவு செய்வது?',
    short_description_ta: 'வாடகை, மின் கட்டணம், சம்பளம் போன்ற தினசரி செயல்பாட்டு செலவுகளைப் பதிவு செய்யவும்.',
    important_notes_ta: ['துல்லியமான லாப நஷ்டக் கணக்கீட்டிற்கு செலவுப் பதிவு மிக முக்கியம்.']
  },
  'how-to-view-outstanding-balances': {
    title_ta: 'நிலுவைத் தொகைகளை எவ்வாறு பார்ப்பது?',
    short_description_ta: 'வாடிக்கையாளர்களிடமிருந்து வரவேண்டிய மற்றும் சப்ளையர்களுக்கு செலுத்த வேண்டிய நிலுவைகளை அறியவும்.',
    important_notes_ta: ['கடன் மேலாண்மையை எளிதாக்குகிறது.']
  },
  'how-to-generate-business-reports': {
    title_ta: 'வணிக அறிக்கைகளை எவ்வாறு உருவாக்குவது?',
    short_description_ta: 'விற்பனை, லாபம், GST வரி மற்றும் சரக்கு இருப்பு குறித்த முழுமையான அறிக்கைகளை உருவாக்கவும்.',
    important_notes_ta: ['வணிக முடிவுகளை எடுக்க விரிவான பகுப்பாய்வு உதவுகிறது.']
  },
  'how-to-export-reports': {
    title_ta: 'அறிக்கைகளை எவ்வாறு ஏற்றுமதி செய்வது?',
    short_description_ta: 'அனைத்து வணிக அறிக்கைகளையும் Excel அல்லது PDF வடிவங்களில் எளிதாக பதிவிறக்குங்கள்.',
    important_notes_ta: ['தணிக்கையாளர் அல்லது ஆடிட்டருக்கு அனுப்ப Excel வடிவம் மிகவும் வசதியானது.']
  },
  'how-to-configure-your-online-shop': {
    title_ta: 'உங்கள் ஆன்லைன் கடையை எவ்வாறு கட்டமைப்பது?',
    short_description_ta: 'கடைப் பெயர், பேனர், தொடர்பு எண் மற்றும் ஆன்லைன் விற்பனை விருப்பங்களை அமைக்கவும்.',
    important_notes_ta: ['வாடிக்கையாளர்கள் உங்கள் கடையின் லிங்க் மூலம் நேரடியாக ஆர்டர் செய்யலாம்.']
  },
  'how-to-add-products-to-your-online-store': {
    title_ta: 'ஆன்லைன் கடையில் தயாரிப்புகளை எவ்வாறு சேர்ப்பது?',
    short_description_ta: 'ஆன்லைனில் விற்பனை செய்ய வேண்டிய பொருட்களைத் தேர்வு செய்து விலைகளை அமைக்கவும்.',
    important_notes_ta: ['புகைப்படங்களுடன் கூடிய தயாரிப்புகள் வாடிக்கையாளர்களை எளிதில் கவரும்.']
  },
  'how-to-generate-a-store-qr-code': {
    title_ta: 'கடைக்கான QR குறியீட்டை எவ்வாறு உருவாக்குவது?',
    short_description_ta: 'வாடிக்கையாளர்கள் மொபைலில் ஸ்கேன் செய்து உங்கள் ஆன்லைன் கடையைப் பார்க்க QR குறியீட்டை அச்சிடுங்கள்.',
    important_notes_ta: ['கடை வாயிலிலும் பில்லிங் கவுண்டரிலும் இந்த QR குறியீட்டை வைக்கலாம்.']
  },
  'how-customers-can-place-orders': {
    title_ta: 'வாடிக்கையாளர்கள் ஆர்டர் செய்வது எப்படி?',
    short_description_ta: 'வாடிக்கையாளர்கள் ஆன்லைன் பட்டியலில் பொருட்களை கார்ட்டில் சேர்த்து ஆர்டர் செய்யும் முறை.',
    important_notes_ta: ['பதிவு தேவையின்றி எளிய முறையில் ஆர்டர் செய்ய முடியும்.']
  },
  'how-to-manage-customer-orders': {
    title_ta: 'வாடிக்கையாளர் ஆர்டர்களை எவ்வாறு நிர்வகிப்பது?',
    short_description_ta: 'ஆன்லைன் மூலம் வரும் ஆர்டர்களை ஏற்றுக்கொண்டு, பில் தயாரித்து விநியோகம் செய்யவும்.',
    important_notes_ta: ['ஆர்டர் நிலை மாற்றங்கள் வாடிக்கையாளருக்கு உடனடியாகத் தெரியும்.']
  },
  'how-customers-can-use-the-self-service-portal': {
    title_ta: 'வாடிக்கையாளர் சுய சேவை போர்டலை எவ்வாறு பயன்படுத்துவது?',
    short_description_ta: 'வாடிக்கையாளர்கள் தங்கள் சொந்த மொபைல் எண் மூலம் OTP பெற்று உள்நுழைந்து கணக்குகளைப் பார்க்கலாம்.',
    important_notes_ta: ['வாடிக்கையாளர் நம்பிக்கை மற்றும் வெளிப்படைத்தன்மையை அதிகரிக்கிறது.']
  },
  'how-to-connect-whatsapp-business': {
    title_ta: 'WhatsApp Business-ஐ எவ்வாறு இணைப்பது?',
    short_description_ta: 'Meta WhatsApp Cloud API மூலம் உங்கள் வணிக எண்ணை VEXA Invoice-ல் இணைக்கவும்.',
    important_notes_ta: ['தானியங்கி பில்கள் மற்றும் நினைவூட்டல்களை அனுப்ப இது தேவை.']
  },
  'how-to-configure-message-templates': {
    title_ta: 'செய்தி டெம்ப்ளேட்டுகளை எவ்வாறு அமைப்பது?',
    short_description_ta: 'விலைப்பட்டியல் பகிர்தல், கட்டண ரசீது மற்றும் நினைவூட்டல் செய்திகளை தனிப்பயனாக்கவும்.',
    important_notes_ta: ['வணிகப் பெயருடன் தொழில்முறை செய்திகள் அனுப்பப்படும்.']
  },
  'how-to-share-invoices-through-whatsapp': {
    title_ta: 'விலைப்பட்டியலை WhatsApp வழியாக எவ்வாறு பகிர்வது?',
    short_description_ta: 'பில் உருவானதும் வாடிக்கையாளரின் WhatsApp-க்கு ஒரே கிளிக்கில் விலைப்பட்டியலை அனுப்புங்கள்.',
    important_notes_ta: ['காகித விரயம் தவிர்க்கப்பட்டு உடனடி தொடர்பு கிடைக்கிறது.']
  },
  'how-to-send-payment-reminders': {
    title_ta: 'கட்டண நினைவூட்டல்களை எவ்வாறு அனுப்புவது?',
    short_description_ta: 'நிலுவைத் தொகையை நினைவூட்டும் செய்திகளை WhatsApp வழியாக வாடிக்கையாளருக்கு அனுப்புங்கள்.',
    important_notes_ta: ['பணம் வசூலிக்கும் செயல்முறையை மென்மையாகவும் விரைவாகவும் மாற்றுகிறது.']
  },
  'how-to-create-whatsapp-campaigns': {
    title_ta: 'WhatsApp பிரச்சாரங்களை எவ்வாறு உருவாக்குவது?',
    short_description_ta: 'பண்டிகைகள் மற்றும் சிறப்புச் சலுகைகளை வாடிக்கையாளர் அனைவருக்கும் மொத்தமாக அறிவிக்கவும்.',
    important_notes_ta: ['விற்பனையை அதிகரிக்க சிறந்த மார்க்கெட்டிங் கருவி.']
  },
  'understanding-vexa-invoice-subscription-plans': {
    title_ta: 'VEXA Invoice சந்தா திட்டங்களைப் புரிந்துகொள்ளுதல்',
    short_description_ta: 'அனைத்து வணிகத் தேவைகளுக்கான மலிவான மற்றும் பயனுள்ள திட்ட விவரங்கள்.',
    important_notes_ta: ['உங்கள் வணிகத்திற்கு உகந்த திட்டத்தை எப்போது வேண்டுமானாலும் மேம்படுத்தலாம்.']
  },
  'how-to-upgrade-your-subscription': {
    title_ta: 'உங்கள் சந்தாவை எவ்வாறு மேம்படுத்துவது?',
    short_description_ta: 'Razorpay ஆன்லைன் கட்டணம் மூலம் சந்தாவை உடனடியாகப் புதுப்பித்துக் கொள்ளுங்கள்.',
    important_notes_ta: ['UPI, நெட் பேங்கிங் அல்லது கார்டுகள் மூலம் பணம் செலுத்தலாம்.']
  },
  'how-to-view-payment-history': {
    title_ta: 'கட்டண வரலாற்றை எவ்வாறு பார்ப்பது?',
    short_description_ta: 'உங்கள் சந்தாவிற்கு செலுத்தப்பட்ட கட்டணங்கள் மற்றும் ரசீதுகளைப் பதிவிறக்கவும்.',
    important_notes_ta: ['வரி விலக்கு மற்றும் கணக்கீட்டிற்கு கட்டண ரசீதுகள் பயனுள்ளதாக இருக்கும்.']
  },
  'understanding-lifetime-plan-benefits': {
    title_ta: 'வாழ்நாள் திட்டத்தின் (Lifetime Plan) நன்மைகள் என்ன?',
    short_description_ta: 'மாதாந்திர சந்தா கட்டணங்கள் எதுவுமின்றி வாழ்நாள் முழுவதும் மென்பொருளைப் பயன்படுத்துங்கள்.',
    important_notes_ta: ['வாழ்நாள் உரிமையுடன் தொடர்ச்சியான மென்பொருள் புதுப்பிப்புகள் இலவசம்.']
  }
};

const faqTranslations = [
  {
    category: 'Getting Started',
    question_ta: 'VEXA Invoice மென்பொருளை எவ்வாறு தொடங்குவது?',
    answer_ta: 'உங்கள் பதிவுசெய்த மின்னஞ்சல் மூலம் உள்நுழைந்து, அமைப்புகளில் நிறுவன சுயவிவரத்தை நிரப்பவும். பின்னர் தயாரிப்புகளைச் சேர்த்து உடனடியாக பில்லிங் செய்யத் தொடங்கலாம்.'
  },
  {
    category: 'Sales & Billing',
    question_ta: 'விலைப்பட்டியலை எவ்வாறு உருவாக்குவது?',
    answer_ta: 'விற்பனை (Sales) > புதிய விற்பனை (New Sale) பகுதிக்குச் சென்று, வாடிக்கையாளரைத் தேர்ந்தெடுத்து, பார்கோடு ஸ்கேன் செய்தோ அல்லது பெயரை உள்ளிட்டோ பொருட்களைச் சேர்த்து சேமிக்கவும்.'
  },
  {
    category: 'Sales & Billing',
    question_ta: 'GST மற்றும் Non-GST பில்களுக்கு ஆதரவு உள்ளதா?',
    answer_ta: 'ஆம், VEXA Invoice இரண்டிற்கும் முழு ஆதரவு அளிக்கிறது. அமைப்புகளில் உங்கள் வணிகத்திற்கேற்ப GST அல்லது Non-GST முறையைத் தேர்வு செய்து கொள்ளலாம்.'
  },
  {
    category: 'Products & Inventory',
    question_ta: 'தயாரிப்புகளுக்கான பார்கோடுகளை எவ்வாறு உருவாக்குவது?',
    answer_ta: 'தயாரிப்புகள் பகுதிக்குச் சென்று, தயாரிப்பைச் சேர்க்கும் போது பார்கோடு தானாக உருவாக்கப்படும் அல்லது பார்கோடு லேபிள்கள் பிரிவில் லேபிள்களை அச்சிடலாம்.'
  },
  {
    category: 'WhatsApp & Notifications',
    question_ta: 'WhatsApp மூலம் விலைப்பட்டியலை எவ்வாறு அனுப்புவது?',
    answer_ta: 'விலைப்பட்டியல் தயாரானதும், திரையில் உள்ள "Share on WhatsApp" பொத்தானைக் கிளிக் செய்தால் வாடிக்கையாளருக்கு PDF இணைப்புடன் செய்தி செல்லும்.'
  },
  {
    category: 'Customers & CRM',
    question_ta: 'வாடிக்கையாளர் நிலுவைத் தொகையை எவ்வாறு கண்காணிப்பது?',
    answer_ta: 'வாடிக்கையாளர் பேரேடு (Customer Ledger) பிரிவில் ஒவ்வொரு வாடிக்கையாளரின் மொத்த பில் தொகை, செலுத்திய தொகை மற்றும் நிலுவைத் தொகையைத் துல்லியமாகக் காணலாம்.'
  },
  {
    category: 'Subscription & Billing',
    question_ta: 'சந்தாவை எவ்வாறு புதுப்பிப்பது?',
    answer_ta: 'அமைப்புகள் > சந்தா (Settings > Subscription) பக்கத்திற்குச் சென்று, விரும்பிய திட்டத்தைத் தேர்வு செய்து Razorpay மூலம் ஆன்லைனில் செலுத்தலாம்.'
  }
];

async function seed() {
  console.log('--- SEEDING TAMIL TRANSLATIONS ---');

  // 1. Update Categories
  for (const cat of categoryTranslations) {
    const updated = await prisma.help_categories.updateMany({
      where: { slug: cat.slug },
      data: {
        name_ta: cat.name_ta,
        description_ta: cat.description_ta
      }
    });
    console.log(`Updated category: ${cat.slug} (${updated.count} rows)`);
  }

  // 2. Update Articles
  for (const [slug, data] of Object.entries(articleTranslations)) {
    const existing = await prisma.help_articles.findUnique({ where: { slug } });
    if (existing) {
      // Map steps to Tamil steps if available
      let steps_ta = [];
      if (Array.isArray(existing.steps) && existing.steps.length > 0) {
        steps_ta = existing.steps.map((st) => ({
          stepNumber: st.stepNumber,
          title: st.title ? `${st.title} (படி ${st.stepNumber})` : `படி ${st.stepNumber}`,
          description: st.description || '',
          caption: st.caption ? `${st.caption} திரை சரிபார்ப்பு` : ''
        }));
      }

      await prisma.help_articles.update({
        where: { slug },
        data: {
          title_ta: data.title_ta,
          short_description_ta: data.short_description_ta,
          content_markdown_ta: data.short_description_ta,
          steps_ta: steps_ta,
          important_notes_ta: data.important_notes_ta || []
        }
      });
      console.log(`Updated article: ${slug} -> ${data.title_ta}`);
    }
  }

  // 3. Update Existing FAQs or match by question keywords
  const allFaqs = await prisma.faqs.findMany();
  for (const f of allFaqs) {
    // Check if we have a direct match or translate generally
    const qLower = f.question.toLowerCase();
    let q_ta = null;
    let a_ta = null;

    if (qLower.includes('support ticket')) {
      q_ta = 'ஆதரவு டிக்கெட்டை (Support Ticket) எவ்வாறு உருவாக்குவது?';
      a_ta = 'உதவி மையம் > புதிய டிக்கெட் (Support > New Ticket) பகுதிக்குச் சென்று உங்கள் கேள்வியைப் பதிவு செய்யலாம்.';
    } else if (qLower.includes('track') && qLower.includes('ticket')) {
      q_ta = 'எனது ஆதரவு டிக்கெட்டுகளை எவ்வாறு கண்காணிப்பது?';
      a_ta = 'ஆதரவு டிக்கெட்டுகள் பக்கத்தில் உங்கள் டிக்கெட்டின் நிலை மற்றும் பொறியாளர்களின் பதில்களைக் காணலாம்.';
    } else if (qLower.includes('payment method')) {
      q_ta = 'VEXA Invoice என்னென்ன கட்டண முறைகளை ஆதரிக்கிறது?';
      a_ta = 'ரொக்கம், கார்டு, UPI, நெட் பேங்கிங், காசோலை மற்றும் வாடிக்கையாளர் கடன் முறைகளை ஆதரிக்கிறது.';
    } else if (qLower.includes('product categories')) {
      q_ta = 'தயாரிப்பு வகைகளை எவ்வாறு உருவாக்குவது?';
      a_ta = 'பொருட்கள் > வகைகள் பகுதிக்குச் சென்று "+ New Category" கிளிக் செய்து புதிய வகையை உருவாக்கலாம்.';
    } else if (qLower.includes('online shop') || qLower.includes('process orders')) {
      q_ta = 'ஆன்லைன் கடையில் வரும் ஆர்டர்களை எவ்வாறு கையாள்வது?';
      a_ta = 'ஆன்லைன் கடை > ஆர்டர்கள் பிரிவில் புதிய ஆர்டர்களைப் பார்த்து ஏற்றுக்கொண்டு பில் செய்யலாம்.';
    } else if (qLower.includes('invoice')) {
      q_ta = `${f.question} (விலைப்பட்டியல் விவரங்கள்)`;
      a_ta = `${f.answer}`;
    }

    if (q_ta && a_ta) {
      await prisma.faqs.update({
        where: { id: f.id },
        data: { question_ta: q_ta, answer_ta: a_ta }
      });
      console.log(`Updated FAQ: ${f.question} -> ${q_ta}`);
    }
  }

  console.log('--- SEEDING COMPLETED SUCCESSFULLY ---');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Error seeding Tamil translations:', err);
  process.exit(1);
});


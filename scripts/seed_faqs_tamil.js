/**
 * Complete Tamil translation mapping for FAQs
 */
const prisma = require('../src/config/db');

const faqDictionary = [
  {
    en: 'Can I generate a non-GST invoice?',
    ta: 'நான் Non-GST விலைப்பட்டியலை உருவாக்க முடியுமா?',
    ans_ta: 'ஆம். வணிக அமைப்புகளில் அல்லது புதிய விற்பனை உருவாக்கும் போது நீங்கள் Non-GST முறையைத் தேர்ந்தெடுத்து வரி இல்லாத விலைப்பட்டியலை உருவாக்கலாம்.'
  },
  {
    en: 'How do I download an invoice as PDF?',
    ta: 'விலைப்பட்டியலை PDF வடிவில் எவ்வாறு பதிவிறக்குவது?',
    ans_ta: 'விற்பனைப் பட்டியலில் உள்ள விலைப்பட்டியலைத் திறந்து, மேல் வலதுபுறத்தில் உள்ள "Download PDF" பொத்தானைக் கிளிக் செய்யவும்.'
  },
  {
    en: 'How can I access VEXA Invoice from another device?',
    ta: 'மற்றொரு சாதனத்திலிருந்து VEXA Invoice-ஐ எவ்வாறு அணுகுவது?',
    ans_ta: 'VEXA Invoice முழுமையான இணையதள செயலியாகும். எந்தவொரு மொபைல், டேப்லெட் அல்லது கணினி உலாவியிலிருந்தும் உங்கள் உள்நுழைவு விவரங்களை உள்ளிட்டு அணுகலாம்.'
  },
  {
    en: 'How do I log in to VEXA Invoice?',
    ta: 'VEXA Invoice-ல் எவ்வாறு உள்நுழைவது?',
    ans_ta: 'உங்கள் பதிவுசெய்த மின்னஞ்சல் முகவரி மற்றும் கடவுச்சொல்லைப் பயன்படுத்தி உள்நுழைவு பக்கத்தில் உள்நுழையவும்.'
  },
  {
    en: 'How do I generate a GST invoice?',
    ta: 'GST விலைப்பட்டியலை எவ்வாறு உருவாக்குவது?',
    ans_ta: 'புதிய விற்பனை உருவாக்கும் போது GST வரி வகையைத் தேர்வு செய்யவும். கணினி CGST, SGST அல்லது IGST-ஐ தானாகவே கணக்கிட்டு முறைப்படியான GST விலைப்பட்டியலைத் தரும்.'
  },
  {
    en: 'What is SKU in VEXA Invoice?',
    ta: 'VEXA Invoice-ல் SKU என்றால் என்ன?',
    ans_ta: 'SKU (Stock Keeping Unit) என்பது ஒவ்வொரு தயாரிப்பு மற்றும் மாறுபாட்டிற்கும் சரக்கு இருப்பை தனித்துவமாகக் கண்காணிக்கப் பயன்படும் தனிப்பட்ட குறியீடாகும்.'
  },
  {
    en: 'How do I convert a quotation into a sales invoice?',
    ta: 'விலை மேற்கோளை எவ்வாறு விற்பனை விலைப்பட்டியலாக மாற்றுவது?',
    ans_ta: 'விலை மேற்கோள்கள் பட்டியலுக்குச் சென்று, குறிப்பிட்ட மேற்கோளைத் திறந்து "Convert to Invoice" பொத்தானைக் கிளிக் செய்தால் அது பில்லாக மாறும்.'
  },
  {
    en: 'What payment methods does VEXA Invoice support?',
    ta: 'VEXA Invoice என்னென்ன கட்டண முறைகளை ஆதரிக்கிறது?',
    ans_ta: 'ரொக்கம் (Cash), UPI (GPay, PhonePe, Paytm), கிரெடிட்/டெபிட் கார்டுகள், நெட் பேங்கிங், காசோலை மற்றும் வாடிக்கையாளர் கடன் (Credit) ஆகியவற்றை ஆதரிக்கிறது.'
  },
  {
    en: 'Can I send invoices automatically via WhatsApp?',
    ta: 'விலைப்பட்டியலை WhatsApp வழியாக தானாகவே அனுப்ப முடியுமா?',
    ans_ta: 'ஆம். WhatsApp Business Cloud API-ஐ இணைப்பதன் மூலம், ஒவ்வொரு விற்பனை முடிந்ததும் வாடிக்கையாளரின் WhatsApp-க்கு விலைப்பட்டியல் லிங்க் மற்றும் PDF தானாகவே செல்லும்.'
  },
  {
    en: 'How do customers place orders through the online shop?',
    ta: 'வாடிக்கையாளர்கள் ஆன்லைன் ஸ்டோர் மூலம் எவ்வாறு ஆர்டர் செய்கிறார்கள்?',
    ans_ta: 'வாடிக்கையாளர்கள் உங்கள் கடையின் QR குறியீட்டை ஸ்கேன் செய்து அல்லது கடையின் லிங்கைத் திறந்து பொருட்களைத் தேர்வு செய்து தங்கள் பெயர், தொலைபேசி எண்ணை உள்ளிட்டு ஆர்டர் செய்யலாம்.'
  },
  {
    en: 'How do I process orders received from the online shop?',
    ta: 'ஆன்லைன் கடையில் வரும் ஆர்டர்களை எவ்வாறு கையாள்வது?',
    ans_ta: 'டாஷ்போர்டில் உள்ள "Online Shop > Customer Orders" பகுதிக்குச் சென்று ஆர்டர்களை ஏற்றுக்கொண்டு (Accept), நேரடியாக விற்பனை விலைப்பட்டியலாக மாற்றலாம்.'
  },
  {
    en: 'What subscription plans are available in VEXA Invoice?',
    ta: 'VEXA Invoice-ல் என்னென்ன சந்தா திட்டங்கள் கிடைக்கின்றன?',
    ans_ta: 'மாதாந்திரத் திட்டம், வருடாந்திரத் திட்டம் மற்றும் வாழ்நாள் உரிமத் திட்டம் (Lifetime Plan) ஆகியவை நியாயமான விலையில் கிடைக்கின்றன.'
  },
  {
    en: 'What is VEXA Invoice?',
    ta: 'VEXA Invoice என்றால் என்ன?',
    ans_ta: 'VEXA Invoice என்பது சில்லறை வணிகர்கள், மொத்த வியாபாரிகள் மற்றும் சிறு வணிகங்களுக்கான அதிநவீன கிளவுட் அடிப்படையிலான GST பில்லிங், சரக்கு இருப்பு மற்றும் வாடிக்கையாளர் மேலாண்மை மென்பொருளாகும்.'
  },
  {
    en: 'What is the VEXA Online Shop Storefront?',
    ta: 'VEXA Online Shop ஸ்டோர்ஃபிரண்ட் என்றால் என்ன?',
    ans_ta: 'இது உங்கள் வாடிக்கையாளர்கள் உங்கள் தயாரிப்புகளை இணையவழியில் பார்வையிடவும், ஆர்டர் செய்யவும் உதவும் உங்களின் சொந்த டிஜிட்டல் கடையாகும்.'
  },
  {
    en: 'How do I print an invoice?',
    ta: 'விலைப்பட்டியலை எவ்வாறு அச்சிடுவது?',
    ans_ta: 'விலைப்பட்டியல் திரையில் உள்ள "Print" பொத்தானைக் கிளிக் செய்யவும். 2-இன்ச், 3-இன்ச் தெர்மல் பிரிண்டர்கள் அல்லது A4 லேசர் பிரிண்டர்களில் நேரடியாக அச்சிடலாம்.'
  },
  {
    en: 'How do I view previous invoices?',
    ta: 'முந்தைய விலைப்பட்டியல்களை எவ்வாறு பார்ப்பது?',
    ans_ta: 'விற்பனை (Sales) > விலைப்பட்டியல்கள் (Invoices) பகுதிக்குச் சென்றால் அனைத்து முந்தைய பில்களையும் தேதி வாரியாகத் தேடலாம்.'
  },
  {
    en: 'What payment gateway does VEXA Invoice use for subscriptions?',
    ta: 'சந்தா கட்டணத்திற்கு VEXA Invoice என்ன கட்டண நுழைவாயிலைப் பயன்படுத்துகிறது?',
    ans_ta: 'இந்தியாவின் முன்னணி மற்றும் பாதுகாப்பான Razorpay கட்டண நுழைவாயிலைப் பயன்படுத்துகிறது.'
  },
  {
    en: 'Is my business data secure and confidential on VEXA Invoice?',
    ta: 'VEXA Invoice-ல் எனது வணிகத் தரவு பாதுகாப்பாக உள்ளதா?',
    ans_ta: 'ஆம். அதிநவீன SSL குறியாக்கம் மற்றும் தினசரி கிளவுட் காப்புப்பிரதி (Backup) மூலம் உங்கள் வணிகத் தரவுகள் 100% பாதுகாப்பாக வைக்கப்படுகின்றன.'
  },
  {
    en: 'How do I connect WhatsApp in VEXA Invoice?',
    ta: 'VEXA Invoice-ல் WhatsApp-ஐ எவ்வாறு இணைப்பது?',
    ans_ta: 'அமைப்புகள் > WhatsApp பகுதிக்குச் சென்று உங்கள் Meta Business Cloud API விவரங்களை உள்ளிட்டு உடனடியாக இணைக்கலாம்.'
  },
  {
    en: 'What automated notifications does VEXA Invoice provide?',
    ta: 'VEXA Invoice என்னென்ன தானியங்கி அறிவிப்புகளை வழங்குகிறது?',
    ans_ta: 'விற்பனை பில் ரசீதுகள், கட்டண நினைவூட்டல்கள், குறைந்த சரக்கு இருப்பு எச்சரிக்கைகள் மற்றும் வரவேற்பு செய்திகள் ஆகியவற்றை வழங்குகிறது.'
  },
  {
    en: 'How do I raise a support ticket to VEXA TECH?',
    ta: 'VEXA TECH-க்கு ஆதரவு டிக்கெட்டை (Support Ticket) எவ்வாறு அனுப்புவது?',
    ans_ta: 'உதவி மையம் > புதிய ஆதரவு டிக்கெட் (Support > New Ticket) பக்கத்தில் உங்கள் சிக்கலின் விவரத்தை எழுதி சமர்ப்பிக்கவும். எங்கள் தொழில்நுட்பக் குழு விரைவில் பதிலளிக்கும்.'
  },
  {
    en: 'Where can I track my existing support tickets?',
    ta: 'எனது ஆதரவு டிக்கெட்டுகளின் நிலையை எங்கு கண்காணிக்கலாம்?',
    ans_ta: 'ஆதரவு டிக்கெட்டுகள் (My Tickets) பக்கத்தில் நீங்கள் சமர்ப்பித்த டிக்கெட்டுகள், அவற்றின் நிலை மற்றும் பொறியாளர்களின் பதில்களைக் கண்காணிக்கலாம்.'
  },
  {
    en: 'Can I edit a generated invoice?',
    ta: 'உருவாக்கப்பட்ட விலைப்பட்டியலைத் திருத்த முடியுமா?',
    ans_ta: 'ஆம், தேவையான நிர்வாக அனுமதி உள்ள பயனர்கள் விலைப்பட்டியல் விவரங்களைத் திருத்தவோ அல்லது தேவைப்பட்டால் ரத்து செய்து மீண்டும் உருவாக்கவோ முடியும்.'
  }
];

async function updateFaqs() {
  for (const item of faqDictionary) {
    await prisma.faqs.updateMany({
      where: {
        question: { contains: item.en, mode: 'insensitive' }
      },
      data: {
        question_ta: item.ta,
        answer_ta: item.ans_ta
      }
    });
  }
  console.log('Updated all FAQs with high quality Tamil translations');
  process.exit(0);
}

updateFaqs().catch((e) => {
  console.error(e);
  process.exit(1);
});


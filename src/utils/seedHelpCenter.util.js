const prisma = require('../config/db');
const articlesData = require('./articlesData');
const faqsData = require('./faqsData');

const seedHelpCenterAndFaqs = async () => {
  try {
    console.log('🌱 Checking Help Center categories and comprehensive user guides...');

    // Upsert all categories and articles
    for (const catData of articlesData) {
      // 1. Upsert Category
      let category = await prisma.help_categories.findUnique({
        where: { slug: catData.categorySlug }
      });

      if (!category) {
        category = await prisma.help_categories.create({
          data: {
            name: catData.categoryName,
            slug: catData.categorySlug,
            icon: catData.categoryIcon || 'BookOpen',
            description: catData.categoryDesc || '',
            sort_order: catData.categorySort || 0,
            is_active: true
          }
        });
      } else {
        // Keep category details updated
        await prisma.help_categories.update({
          where: { id: category.id },
          data: {
            name: catData.categoryName,
            icon: catData.categoryIcon || 'BookOpen',
            description: catData.categoryDesc || '',
            sort_order: catData.categorySort || 0
          }
        });
      }

      // 2. Upsert Articles
      for (const art of catData.articles) {
        const existingArticle = await prisma.help_articles.findUnique({
          where: { slug: art.slug }
        });

        if (!existingArticle) {
          await prisma.help_articles.create({
            data: {
              category_id: category.id,
              title: art.title,
              slug: art.slug,
              short_description: art.shortDescription,
              content_markdown: art.shortDescription,
              steps: art.steps || [],
              important_notes: art.notes || [],
              search_keywords: art.keywords || '',
              is_published: true,
              is_featured: !!art.isFeatured,
              view_count: 5
            }
          });
        }
      }
    }

    // Upsert FAQs
    for (const faq of faqsData) {
      const existingFaq = await prisma.faqs.findUnique({
        where: { slug: faq.slug }
      });

      if (!existingFaq) {
        await prisma.faqs.create({
          data: {
            category: faq.category,
            question: faq.question,
            slug: faq.slug,
            answer: faq.answer,
            sort_order: faq.sort_order,
            is_published: true,
            helpful_count: 0,
            unhelpful_count: 0
          }
        });
      } else {
        await prisma.faqs.update({
          where: { id: existingFaq.id },
          data: {
            category: faq.category,
            question: faq.question,
            answer: faq.answer,
            sort_order: faq.sort_order,
            is_published: true
          }
        });
      }
    }

    const totalArticles = await prisma.help_articles.count();
    const totalFaqs = await prisma.faqs.count();
    console.log(`✅ Help Center database confirmed ready with ${totalArticles} articles and ${totalFaqs} FAQs!`);
  } catch (error) {
    console.error('Error seeding Help Center data:', error.message);
  }
};

module.exports = { seedHelpCenterAndFaqs };

const prisma = require('../config/db');

/**
 * Get Published Categories with Guides
 */
const getCategoriesWithArticles = async (search = '') => {
  const articleWhere = { is_published: true };
  let categoryWhere = { is_active: true };

  if (search && search.trim()) {
    const term = search.trim();
    articleWhere.OR = [
      { title: { contains: term, mode: 'insensitive' } },
      { title_ta: { contains: term, mode: 'insensitive' } },
      { short_description: { contains: term, mode: 'insensitive' } },
      { short_description_ta: { contains: term, mode: 'insensitive' } },
      { content_markdown: { contains: term, mode: 'insensitive' } },
      { content_markdown_ta: { contains: term, mode: 'insensitive' } },
      { search_keywords: { contains: term, mode: 'insensitive' } },
      { category: { name: { contains: term, mode: 'insensitive' } } },
      { category: { name_ta: { contains: term, mode: 'insensitive' } } }
    ];
  }

  const categories = await prisma.help_categories.findMany({
    where: categoryWhere,
    orderBy: { sort_order: 'asc' },
    include: {
      articles: {
        where: articleWhere,
        orderBy: [{ is_featured: 'desc' }, { created_at: 'asc' }],
        select: {
          id: true,
          category_id: true,
          title: true,
          title_ta: true,
          slug: true,
          short_description: true,
          short_description_ta: true,
          cover_image: true,
          is_featured: true,
          view_count: true,
          created_at: true,
          updated_at: true
        }
      }
    }
  });

  // If a search query is active, only return categories that have matching articles
  if (search && search.trim()) {
    return categories.filter(c => c.articles && c.articles.length > 0);
  }

  return categories;
};

/**
 * Get Featured / Popular Articles
 */
const getFeaturedArticles = async () => {
  return prisma.help_articles.findMany({
    where: { is_published: true, is_featured: true },
    include: {
      category: { select: { id: true, name: true, name_ta: true, slug: true, icon: true } }
    },
    orderBy: { view_count: 'desc' },
    take: 6
  });
};

/**
 * Get Latest Articles
 */
const getLatestArticles = async () => {
  return prisma.help_articles.findMany({
    where: { is_published: true },
    include: {
      category: { select: { id: true, name: true, name_ta: true, slug: true, icon: true } }
    },
    orderBy: { created_at: 'desc' },
    take: 6
  });
};

/**
 * Get Single Help Article by Slug
 */
const getArticleBySlug = async (slug) => {
  const article = await prisma.help_articles.findUnique({
    where: { slug },
    include: {
      category: true,
      images: { orderBy: { sort_order: 'asc' } }
    }
  });

  if (!article || !article.is_published) {
    throw new Error('Help guide not found or unavailable.');
  }

  // Increment view count asynchronously
  prisma.help_articles.update({
    where: { id: article.id },
    data: { view_count: { increment: 1 } }
  }).catch(() => {});

  // Fetch related articles if specified
  let relatedArticles = [];
  if (Array.isArray(article.related_article_ids) && article.related_article_ids.length > 0) {
    relatedArticles = await prisma.help_articles.findMany({
      where: {
        OR: [
          { id: { in: article.related_article_ids.filter(x => typeof x === 'string' && x.length > 20) } },
          { slug: { in: article.related_article_ids } }
        ],
        is_published: true
      },
      select: { id: true, title: true, title_ta: true, slug: true, short_description: true, short_description_ta: true }
    });
  } else {
    // Fallback: fetch up to 3 other articles from the same category
    relatedArticles = await prisma.help_articles.findMany({
      where: {
        category_id: article.category_id,
        id: { not: article.id },
        is_published: true
      },
      select: { id: true, title: true, title_ta: true, slug: true, short_description: true, short_description_ta: true },
      take: 3
    });
  }

  // Fetch Previous and Next Article in Category
  const [prevArticle, nextArticle] = await Promise.all([
    prisma.help_articles.findFirst({
      where: { category_id: article.category_id, is_published: true, created_at: { lt: article.created_at } },
      orderBy: { created_at: 'desc' },
      select: { title: true, title_ta: true, slug: true }
    }),
    prisma.help_articles.findFirst({
      where: { category_id: article.category_id, is_published: true, created_at: { gt: article.created_at } },
      orderBy: { created_at: 'asc' },
      select: { title: true, title_ta: true, slug: true }
    })
  ]);

  return { ...article, relatedArticles, prevArticle, nextArticle };
};

/**
 * Record Article Feedback (Helpful: Yes / No)
 */
const recordArticleFeedback = async (slug, isHelpful) => {
  return prisma.help_articles.update({
    where: { slug },
    data: isHelpful
      ? { helpful_count: { increment: 1 } }
      : { unhelpful_count: { increment: 1 } }
  });
};

/**
 * Record FAQ Feedback (Helpful: Yes / No)
 */
const recordFaqFeedback = async (id, isHelpful) => {
  return prisma.faqs.update({
    where: { id },
    data: isHelpful
      ? { helpful_count: { increment: 1 } }
      : { unhelpful_count: { increment: 1 } }
  });
};

/**
 * Get FAQs
 */
const getFaqs = async (category = '', search = '') => {
  const where = { is_published: true };
  if (category && category !== 'ALL') {
    where.category = category;
  }
  if (search && search.trim()) {
    const term = search.trim();
    where.OR = [
      { question: { contains: term, mode: 'insensitive' } },
      { question_ta: { contains: term, mode: 'insensitive' } },
      { answer: { contains: term, mode: 'insensitive' } },
      { answer_ta: { contains: term, mode: 'insensitive' } },
      { category: { contains: term, mode: 'insensitive' } }
    ];
  }
  return prisma.faqs.findMany({
    where,
    orderBy: { sort_order: 'asc' }
  });
};

/**
 * Super Admin: Get all articles (Drafts & Published)
 */
const getSuperAdminArticles = async (query = {}) => {
  const where = {};
  if (query.categoryId && query.categoryId !== 'ALL') where.category_id = query.categoryId;
  if (query.status === 'PUBLISHED') where.is_published = true;
  if (query.status === 'DRAFT') where.is_published = false;

  if (query.search && query.search.trim()) {
    const term = query.search.trim();
    where.OR = [
      { title: { contains: term, mode: 'insensitive' } },
      { short_description: { contains: term, mode: 'insensitive' } },
      { slug: { contains: term, mode: 'insensitive' } }
    ];
  }

  return prisma.help_articles.findMany({
    where,
    include: {
      category: { select: { id: true, name: true, slug: true } }
    },
    orderBy: { created_at: 'desc' }
  });
};

/**
 * Super Admin Management: Categories CRUD
 */
const createCategory = async (data) => {
  const slug = (data.slug || data.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return prisma.help_categories.create({
    data: {
      name: data.name.trim(),
      slug,
      icon: data.icon || 'BookOpen',
      description: data.description || '',
      sort_order: Number(data.sort_order || 0)
    }
  });
};

const updateCategory = async (id, data) => {
  return prisma.help_categories.update({
    where: { id },
    data: {
      name: data.name?.trim(),
      icon: data.icon,
      description: data.description,
      sort_order: data.sort_order !== undefined ? Number(data.sort_order) : undefined,
      is_active: data.is_active
    }
  });
};

const deleteCategory = async (id) => {
  return prisma.help_categories.delete({ where: { id } });
};

/**
 * Super Admin Management: Articles CRUD
 */
const createArticle = async (data) => {
  const slug = (data.slug || data.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return prisma.help_articles.create({
    data: {
      category_id: data.category_id,
      title: data.title.trim(),
      title_ta: data.title_ta?.trim() || null,
      slug,
      short_description: data.short_description.trim(),
      short_description_ta: data.short_description_ta?.trim() || null,
      content_markdown: data.content_markdown || '',
      content_markdown_ta: data.content_markdown_ta || null,
      cover_image: data.cover_image || null,
      steps: data.steps || [],
      steps_ta: data.steps_ta || [],
      important_notes: data.important_notes || [],
      important_notes_ta: data.important_notes_ta || [],
      related_article_ids: data.related_article_ids || [],
      search_keywords: data.search_keywords || '',
      is_published: data.is_published !== false,
      is_featured: !!data.is_featured
    }
  });
};

const updateArticle = async (id, data) => {
  const updateData = { ...data, updated_at: new Date() };
  if (data.title && !data.slug) {
    updateData.slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
  return prisma.help_articles.update({
    where: { id },
    data: updateData
  });
};

const deleteArticle = async (id) => {
  return prisma.help_articles.delete({ where: { id } });
};

/**
 * Super Admin Management: FAQs CRUD
 */
const createFaq = async (data) => {
  return prisma.faqs.create({
    data: {
      category: data.category || 'General',
      question: data.question.trim(),
      question_ta: data.question_ta?.trim() || null,
      answer: data.answer.trim(),
      answer_ta: data.answer_ta?.trim() || null,
      sort_order: Number(data.sort_order || 0),
      is_published: data.is_published !== false
    }
  });
};

const updateFaq = async (id, data) => {
  return prisma.faqs.update({
    where: { id },
    data: {
      category: data.category,
      question: data.question?.trim(),
      question_ta: data.question_ta !== undefined ? (data.question_ta?.trim() || null) : undefined,
      answer: data.answer?.trim(),
      answer_ta: data.answer_ta !== undefined ? (data.answer_ta?.trim() || null) : undefined,
      sort_order: data.sort_order !== undefined ? Number(data.sort_order) : undefined,
      is_published: data.is_published
    }
  });
};

const deleteFaq = async (id) => {
  return prisma.faqs.delete({ where: { id } });
};

module.exports = {
  getCategoriesWithArticles,
  getFeaturedArticles,
  getLatestArticles,
  getArticleBySlug,
  recordArticleFeedback,
  getFaqs,
  getSuperAdminArticles,
  createCategory,
  updateCategory,
  deleteCategory,
  createArticle,
  updateArticle,
  deleteArticle,
  recordFaqFeedback,
  createFaq,
  updateFaq,
  deleteFaq
};

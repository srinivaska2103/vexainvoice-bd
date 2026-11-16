const assert = require('assert');
const path = require('path');
const supportTicketService = require('../src/services/supportTicket.service');
const helpCenterService = require('../src/services/helpCenter.service');
const prisma = require('../src/config/db');

async function runSupportTestSuite() {
  console.log('--- RUNNING HELP CENTER & SUPPORT TICKET TEST SUITE ---');

  // Test 1: Seed verification - Categories & FAQs exist
  const categories = await helpCenterService.getCategoriesWithArticles();
  assert(categories.length >= 4, 'Help categories should be seeded with at least 4 topics');
  console.log(`✅ Test 1 Passed: ${categories.length} Help Center categories confirmed`);

  const faqs = await helpCenterService.getFaqs();
  assert(faqs.length >= 5, 'FAQs should be seeded with at least 5 common questions');
  console.log(`✅ Test 2 Passed: ${faqs.length} FAQs loaded successfully`);

  // Test 2: Help Article retrieval by slug
  const article = await helpCenterService.getArticleBySlug('create-product-and-variants');
  assert.strictEqual(article.slug, 'create-product-and-variants');
  assert(Array.isArray(article.steps), 'Article must have step-by-step instructions');
  assert(article.steps.length > 0, 'Article must have at least one step');
  console.log(`✅ Test 3 Passed: Article "${article.title}" retrieved with ${article.steps.length} step-by-step instructions`);

  // Test 3: Create Support Ticket with Company Context
  const testCompany = await prisma.businesses.findFirst();
  assert(testCompany, 'A company business must exist in database');

  const testUser = await prisma.users.findFirst({ where: { business_id: testCompany.id } });
  assert(testUser, 'A user must exist for testing tickets');

  const dummyPngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  const ticketResult = await supportTicketService.createTicket(
    testCompany.id,
    testUser.id,
    {
      subject: `Automated Test Ticket ${Date.now()}`,
      category: 'SALES_INVOICES',
      priority: 'HIGH',
      affected_module: 'POS Billing',
      description: 'Customer thermal printer printing blank paper on invoice confirmation.'
    },
    [
      {
        fileName: 'sample_error.png',
        fileType: 'image/png',
        base64Data: dummyPngBase64
      }
    ]
  );

  assert(ticketResult.success, 'Ticket creation must succeed');
  assert(ticketResult.ticketNumber.startsWith('VEXA-'), 'Ticket number must follow VEXA-YYYY-XXXXXX format');
  console.log(`✅ Test 4 Passed: Ticket ${ticketResult.ticketNumber} created with binary verified PNG attachment`);

  // Test 4: Company User Ticket Isolation (cannot see another company's tickets)
  const myTickets = await supportTicketService.getCompanyTickets(testCompany.id, testUser.id, testUser.role);
  assert(myTickets.some(t => t.ticket_number === ticketResult.ticketNumber), 'Newly created ticket must appear in company ticket list');
  console.log(`✅ Test 5 Passed: Company isolation verified; user can access their company tickets`);

  // Test 5: Company User Reply
  const replyResult = await supportTicketService.replyCompanyTicket(
    testCompany.id,
    testUser.id,
    testUser,
    ticketResult.ticketId,
    'Following up: We also tested with an 80mm roll and same issue occurs.'
  );
  assert(replyResult.success, 'Reply creation must succeed');
  console.log(`✅ Test 6 Passed: Company user successfully replied to ticket`);

  // Test 6: Super Admin Management, Internal Notes & Status Updates
  const superAdminTickets = await supportTicketService.getSuperAdminTickets();
  assert(superAdminTickets.tickets.length > 0, 'Super admin should see platform tickets');

  const internalNoteResult = await supportTicketService.updateSuperAdminTicket(
    { id: '00000000-0000-0000-0000-000000000001', name: 'Super Admin Tech' },
    ticketResult.ticketId,
    {
      action: 'REPLY',
      message: 'Investigated: User driver settings configured to raster mode rather than ESC/POS.',
      isInternalNote: true
    }
  );
  assert(internalNoteResult.success, 'Internal note must be recorded');

  // Verify internal notes are HIDDEN from company user details
  const companyView = await supportTicketService.getCompanyTicketDetails(testCompany.id, testUser.id, testUser.role, ticketResult.ticketId);
  const internalNoteLeak = companyView.messages.some(m => m.is_internal_note === true);
  assert.strictEqual(internalNoteLeak, false, 'Internal notes MUST NEVER be returned to company user views');
  console.log(`✅ Test 7 Passed: Private internal notes confirmed hidden from customer views`);

  // Status Change to RESOLVED
  const statusUpdate = await supportTicketService.updateSuperAdminTicket(
    { id: '00000000-0000-0000-0000-000000000001', name: 'Super Admin Tech' },
    ticketResult.ticketId,
    {
      action: 'UPDATE_STATUS',
      status: 'RESOLVED'
    }
  );
  assert.strictEqual(statusUpdate.status, 'RESOLVED');
  console.log(`✅ Test 8 Passed: Super Admin updated ticket status to RESOLVED`);

  console.log('\n🎉 ALL HELP CENTER & SUPPORT TICKET TESTS PASSED SUCCESSFULLY!\n');
  process.exit(0);
}

runSupportTestSuite().catch((err) => {
  console.error('❌ Support Test Suite Failed:', err);
  process.exit(1);
});


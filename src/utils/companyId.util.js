const prisma = require('../config/db');

/**
 * Generates next sequential Company ID (e.g., VEXA-000118)
 * Checks existing maximum numeric identifier and guarantees uniqueness.
 */
const generateCompanyId = async (tx = prisma) => {
  const businesses = await tx.businesses.findMany({
    where: { company_id: { not: null } },
    select: { company_id: true }
  });

  let maxNum = 100;
  for (const b of businesses) {
    if (b.company_id && b.company_id.startsWith('VEXA-')) {
      const numPart = parseInt(b.company_id.replace('VEXA-', ''), 10);
      if (!isNaN(numPart) && numPart > maxNum) {
        maxNum = numPart;
      }
    }
  }

  let nextNum = maxNum + 1;
  let candidateId = `VEXA-${String(nextNum).padStart(6, '0')}`;

  while (await tx.businesses.findFirst({ where: { company_id: candidateId } })) {
    nextNum++;
    candidateId = `VEXA-${String(nextNum).padStart(6, '0')}`;
  }

  return candidateId;
};

/**
 * Backfills company_id for any existing business records that don't have one
 */
const ensureCompanyIdsForExistingBusinesses = async () => {
  try {
    const businessesWithoutId = await prisma.businesses.findMany({
      where: { company_id: null },
      select: { id: true }
    });

    let index = 101;
    for (const biz of businessesWithoutId) {
      let companyId = `VEXA-${String(index).padStart(6, '0')}`;
      let exists = await prisma.businesses.findFirst({ where: { company_id: companyId } });
      while (exists) {
        index++;
        companyId = `VEXA-${String(index).padStart(6, '0')}`;
        exists = await prisma.businesses.findFirst({ where: { company_id: companyId } });
      }
      await prisma.businesses.update({
        where: { id: biz.id },
        data: { company_id: companyId }
      });
      index++;
    }
  } catch (err) {
    console.error('Error backfilling company IDs:', err.message);
  }
};

module.exports = {
  generateCompanyId,
  ensureCompanyIdsForExistingBusinesses
};

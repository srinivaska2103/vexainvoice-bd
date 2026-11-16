/**
 * SKU and Barcode Generator Utility for Product Variants
 *
 * SKU Pattern: `PRODUCTCODE-SIZE-SEQUENCE`
 * Example for OTTO Shirt:
 * - OTTO-SHIRT-S-001
 * - OTTO-SHIRT-S-002
 * - OTTO-SHIRT-M-001
 * - OTTO-SHIRT-L-001
 * - OTTO-SHIRT-XL-001
 *
 * Rules:
 * 1. Generate unique SKUs automatically when creating variants.
 * 2. Maintain a separate sequence for each product/size combination.
 * 3. If another variant is created for the same product and size, increment the sequence.
 * 4. A different size starts its own sequence (e.g. -001).
 * 5. Sequence numbers are formatted as 3-digit padded numbers (e.g. 001, 002).
 * 6. Never reuse an existing SKU after deletion unless explicitly permitted.
 * 7. Barcode value equals the generated SKU (CODE128 standard).
 */

function sanitizeSlug(str) {
  if (!str) return '';
  return str
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Determine the product code segment based on product details.
 * Hierarchy:
 * 1. If product.sku exists and is not a generic auto-SKU, or if user specified product code
 * 2. If product has brand and category or name, e.g. OTTO + Shirt -> OTTO-SHIRT
 * 3. Fallback to sanitized product name
 */
function deriveProductCode(product, brandName, categoryName) {
  // If product already has an established base prefix (e.g. "OTTO-SHIRT" or "OTTO-MENS")
  if (product?.sku) {
    const rawSku = product.sku.trim();
    // If it matches pattern like PREFIX-001 or has -001 suffix, strip the sequence
    const seqMatch = rawSku.match(/^(.*)-(\d{3,4})(-\d+)?$/);
    if (seqMatch && seqMatch[1]) {
      const cleanPrefix = sanitizeSlug(seqMatch[1]);
      if (cleanPrefix) return cleanPrefix;
    }
    // If it's not a generic timestamp SKU like SKU-123456
    if (!rawSku.startsWith('SKU-')) {
      const cleanSku = sanitizeSlug(rawSku);
      if (cleanSku) return cleanSku;
    }
  }

  const sBrand = sanitizeSlug(brandName || product?.brands?.name || '');
  const sCat = sanitizeSlug(categoryName || product?.categories?.name || '');
  const sName = sanitizeSlug(product?.name || 'PROD');

  if (sBrand && sCat) {
    return `${sBrand}-${sCat}`;
  }

  if (sBrand && sName) {
    // If product name already contains brand, don't duplicate
    if (sName.startsWith(sBrand)) {
      return sName;
    }
    return `${sBrand}-${sName}`;
  }

  return sName || 'PROD';
}

/**
 * Derives size code slug. E.g. "S" -> "S", "XL" -> "XL", "Free Size" -> "FS", etc.
 */
function deriveSizeCode(sizeName) {
  if (!sizeName) return 'STD';
  const clean = sanitizeSlug(sizeName);
  return clean || 'STD';
}

/**
 * Parses existing variant SKUs matching the prefix `${productCode}-${sizeCode}-`
 * to find the highest sequence number ever issued.
 * Ensures sequences never collide and deleted sequences are not reused.
 */
function getHighestSequenceFromSkus(existingSkus, prefix) {
  let maxSeq = 0;
  const escapedPrefix = prefix.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`^${escapedPrefix}-(\\d+)$`, 'i');

  for (const sku of existingSkus) {
    if (!sku) continue;
    const match = sku.trim().match(regex);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }
  return maxSeq;
}

/**
 * Format a sequence number with 3 digits minimum (001, 002, ... 999, 1000)
 */
function formatSequence(num) {
  return String(num).padStart(3, '0');
}

module.exports = {
  sanitizeSlug,
  deriveProductCode,
  deriveSizeCode,
  getHighestSequenceFromSkus,
  formatSequence
};

const prisma = require('../src/config/db');

async function auditDatabaseMetrics() {
  console.log('=== AUDITING POSTGRESQL & PRISMA METRICS ===');
  try {
    // 1. Connection Limits and Current Activity
    const connInfo = await prisma.$queryRaw`
      SELECT 
        (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections,
        (SELECT count(*)::int FROM pg_stat_activity) as total_connections,
        (SELECT count(*)::int FROM pg_stat_activity WHERE state = 'active') as active_connections,
        (SELECT count(*)::int FROM pg_stat_activity WHERE state = 'idle') as idle_connections,
        (SELECT count(*)::int FROM pg_stat_activity WHERE wait_event_type IS NOT NULL) as waiting_connections
    `;
    console.log('\n[1] Connection Capacity:', connInfo[0]);

    // 2. Database Size & Cache Hit Ratio
    const dbStats = await prisma.$queryRaw`
      SELECT 
        pg_database_size(current_database()) as db_bytes,
        pg_size_pretty(pg_database_size(current_database())) as db_size_pretty,
        sum(heap_blks_read)::bigint as blocks_read,
        sum(heap_blks_hit)::bigint as blocks_hit,
        round((sum(heap_blks_hit)::numeric / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0) * 100), 2) as buffer_cache_hit_pct
      FROM pg_statio_user_tables
    `;
    console.log('\n[2] Database Size & Cache Hit Ratio:', dbStats[0]);

    // 3. Top Tables by Row Count and Disk Size
    const tableSizes = await prisma.$queryRaw`
      SELECT 
        relname as table_name,
        n_live_tup as estimated_rows,
        pg_size_pretty(pg_total_relation_size(relid)) as total_size,
        pg_size_pretty(pg_relation_size(relid)) as table_size,
        pg_size_pretty(pg_indexes_size(relid)) as index_size,
        seq_scan,
        idx_scan
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(relid) DESC
      LIMIT 12
    `;
    console.log('\n[3] Top Tables by Storage & Scan Pattern:');
    console.table(tableSizes);

    // 4. Missing Index Candidates (Tables with high sequential scans vs index scans)
    const seqScanSuspects = await prisma.$queryRaw`
      SELECT 
        relname as table_name,
        seq_scan,
        seq_tup_read,
        idx_scan,
        idx_tup_fetch,
        n_live_tup
      FROM pg_stat_user_tables
      WHERE seq_scan > 5 AND (idx_scan IS NULL OR idx_scan < seq_scan)
      ORDER BY seq_tup_read DESC
      LIMIT 10
    `;
    console.log('\n[4] Tables with High Sequential Scans:');
    console.table(seqScanSuspects);

    // 5. Existing Indexes on Critical Multi-tenant Tables (sales, products, stock_transactions, customers)
    const criticalIndexes = await prisma.$queryRaw`
      SELECT 
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' 
        AND tablename IN ('sales', 'sale_items', 'products', 'product_variants', 'stock_transactions', 'customers', 'customer_payments')
      ORDER BY tablename, indexname
    `;
    console.log('\n[5] Existing Indexes on Key Tables:');
    criticalIndexes.forEach(idx => {
      console.log(`- [${idx.tablename}] ${idx.indexname}: ${idx.indexdef}`);
    });

  } catch (err) {
    console.error('Audit query error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

auditDatabaseMetrics();

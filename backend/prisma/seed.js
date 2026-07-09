const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('[SEED] Seeding database...');

  // Create a sample session
  const session = await prisma.uploadSession.create({
    data: {
      filename: 'sample_import.csv',
      originalCsv: 'seed-sample.csv',
      totalRows: 0,
      status: 'pending',
    },
  });

  console.log(`[SEED] Created session: ${session.id}`);

  // Create sample leads
  const leads = await prisma.lead.createMany({
    data: [
      { uploadSessionId: session.id, email: 'john@example.com', company: 'Acme Corp', importStatus: 'parsed' },
      { uploadSessionId: session.id, email: 'jane@example.com', company: 'Globex', importStatus: 'parsed' },
    ],
    skipDuplicates: true,
  });

  console.log(`[SEED] Created ${leads.count} leads`);
  console.log('[SEED] Done');
}

main()
  .catch((e) => { console.error('[SEED] Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
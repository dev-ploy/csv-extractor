const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

async function main() {
  console.log('Seeding users...');

  const users = [
    { email: 'admin@csv-extractor.com', password: bcrypt.hashSync('admin123', 12), name: 'Admin', role: 'admin' },
    { email: 'user@csv-extractor.com', password: bcrypt.hashSync('user123', 12), name: 'User', role: 'user' },
  ];

  for (const user of users) {
    const existing = await prisma.user.findUnique({ where: { email: user.email } });
    if (existing) {
      console.log(`  Already exists: ${user.email}`);
      continue;
    }
    await prisma.user.create({ data: user });
    console.log(`  Created: ${user.email} (${user.role})`);
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
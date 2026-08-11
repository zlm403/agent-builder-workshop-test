import { PrismaClient } from '@prisma/client';
import { getTemplate } from '../src/lib/courseConfig';

const prisma = new PrismaClient();

async function main() {
  const tpl = getTemplate();
  const existing = await prisma.courseTemplate.findUnique({ where: { version: 'A' } });
  if (existing) {
    console.log('CourseTemplate A 已存在，跳过。');
    return;
  }
  await prisma.courseTemplate.create({
    data: {
      version: tpl.version,
      name: tpl.name,
      subtitle: tpl.subtitle ?? null,
      modules: tpl as unknown as object,
    },
  });
  console.log('已写入 CourseTemplate A。');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

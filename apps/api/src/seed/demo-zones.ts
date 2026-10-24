import type { PrismaClient } from '../generated/prisma/client';

const DHAKA_DISTRICT = 47;
const SUBURB_DISTRICTS = [41, 43]; // Gazipur, Narayanganj
/** Dhaka city thanas added by the geo seed migration (ids 1001+). */
const METRO_MIN_ID = 1001;

const tk = (n: number) => n * 100;

/** Demo delivery zones. Idempotent: does nothing when any zone exists. */
export async function seedDemoZones(prisma: PrismaClient): Promise<boolean> {
  if ((await prisma.deliveryZone.count()) > 0) return false;
  const metro = await prisma.upazila.findMany({
    where: { districtId: DHAKA_DISTRICT, id: { gte: METRO_MIN_ID } },
    select: { id: true },
  });
  await prisma.$transaction(async (tx) => {
    await tx.deliveryZone.create({
      data: {
        nameEn: 'Inside Dhaka',
        nameBn: 'ঢাকার ভিতরে',
        baseChargeP: tk(60),
        extraPerKgP: tk(15),
        etaMinDays: 1,
        etaMaxDays: 2,
        freeAboveP: tk(3000),
        sort: 1,
        locations: { createMany: { data: metro.map((u) => ({ upazilaId: u.id })) } },
      },
    });
    await tx.deliveryZone.create({
      data: {
        nameEn: 'Dhaka suburbs',
        nameBn: 'ঢাকার আশেপাশে',
        baseChargeP: tk(100),
        extraPerKgP: tk(20),
        etaMinDays: 2,
        etaMaxDays: 3,
        sort: 2,
        locations: {
          create: [DHAKA_DISTRICT, ...SUBURB_DISTRICTS].map((districtId) => ({ districtId })),
        },
      },
    });
    await tx.deliveryZone.create({
      data: {
        nameEn: 'Outside Dhaka',
        nameBn: 'ঢাকার বাইরে',
        baseChargeP: tk(120),
        extraPerKgP: tk(25),
        etaMinDays: 3,
        etaMaxDays: 5,
        isDefault: true,
        sort: 3,
      },
    });
  });
  console.log('demo delivery zones seeded');
  return true;
}

/// <reference types="node" />
import { PrismaClient } from '@prisma/client';
import { stockMatrix, StockEntry } from '../../src/data/baselineStock';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting SurgeOps seed...\n');

  // ─── STORES ───────────────────────────────────────────────────────────────
  console.log('📍 Seeding stores...');

  const stores = await Promise.all([
    prisma.store.upsert({
      where: { id: 'store-mumbai-bandra' },
      update: {},
      create: {
        id: 'store-mumbai-bandra',
        name: 'SurgeOps Bandra West',
        city: 'Mumbai',
        pincode: '400050',
        lat: 19.0596,
        lng: 72.8295,
        isActive: true,
      },
    }),
    prisma.store.upsert({
      where: { id: 'store-pune-kothrud' },
      update: {},
      create: {
        id: 'store-pune-kothrud',
        name: 'SurgeOps Kothrud',
        city: 'Pune',
        pincode: '411038',
        lat: 18.5074,
        lng: 73.8077,
        isActive: true,
      },
    }),
    prisma.store.upsert({
      where: { id: 'store-bangalore-koramangala' },
      update: {},
      create: {
        id: 'store-bangalore-koramangala',
        name: 'SurgeOps Koramangala',
        city: 'Bangalore',
        pincode: '560095',
        lat: 12.9352,
        lng: 77.6245,
        isActive: true,
      },
    }),
    prisma.store.upsert({
      where: { id: 'store-delhi-noida' },
      update: {},
      create: {
        id: 'store-delhi-noida',
        name: 'SurgeOps Noida Sector 18',
        city: 'Delhi NCR',
        pincode: '201301',
        lat: 28.5708,
        lng: 77.3260,
        isActive: true,
      },
    }),
  ]);
  console.log(`  ✅ ${stores.length} stores created\n`);

  // ─── CATEGORIES ────────────────────────────────────────────────────────────
  console.log('📦 Seeding categories...');

  const categories = await Promise.all([
    prisma.category.upsert({
      where: { id: 'cat-grocery' },
      update: {},
      create: { id: 'cat-grocery', name: 'Grocery & Staples', slug: 'grocery-staples' },
    }),
    prisma.category.upsert({
      where: { id: 'cat-snacks' },
      update: {},
      create: { id: 'cat-snacks', name: 'Snacks & Namkeen', slug: 'snacks-namkeen' },
    }),
    prisma.category.upsert({
      where: { id: 'cat-beverages' },
      update: {},
      create: { id: 'cat-beverages', name: 'Beverages', slug: 'beverages' },
    }),
    prisma.category.upsert({
      where: { id: 'cat-dairy' },
      update: {},
      create: { id: 'cat-dairy', name: 'Dairy & Eggs', slug: 'dairy-eggs' },
    }),
    prisma.category.upsert({
      where: { id: 'cat-instant' },
      update: {},
      create: { id: 'cat-instant', name: 'Instant Food', slug: 'instant-food' },
    }),
  ]);
  console.log(`  ✅ ${categories.length} categories created\n`);

  // ─── PRODUCTS ─────────────────────────────────────────────────────────────
  // Session 27 addition: added realistic Indian MRP (Maximum Retail Price)
  // values, researched against real-world retail listings. For these FMCG
  // categories, mrp == basePrice — there's normally no gap between shelf
  // price and printed MRP for everyday packaged groceries/snacks/beverages.
  // Six products had unrealistic basePrice values corrected in this pass:
  // Tata Salt, Fortune Oil, Lay's Chips, Parle-G, Kurkure, Amul Butter,
  // Maggi (family pack), MTR Poha.
  console.log('🛍️  Seeding products...');

  type ProductSeed = {
    id: string;
    sku: string;
    name: string;
    categoryId: string;
    basePrice: number;
    mrp: number;
    unit: string;
    weightGrams: number;
  };

  const productSeeds: ProductSeed[] = [
    // GROCERY & STAPLES
    { id: 'prod-tata-salt',        sku: 'GRC-SALT-1KG',   name: 'Tata Salt',                         categoryId: 'cat-grocery',   basePrice: 28.00,  mrp: 28.00,  unit: 'piece', weightGrams: 1000 },
    { id: 'prod-fortune-oil',      sku: 'GRC-OIL-1L',     name: 'Fortune Sunflower Oil',              categoryId: 'cat-grocery',   basePrice: 155.00, mrp: 155.00, unit: 'litre', weightGrams: 900 },
    { id: 'prod-aashirvaad-atta',  sku: 'GRC-ATTA-5KG',   name: 'Aashirvaad Whole Wheat Atta',        categoryId: 'cat-grocery',   basePrice: 285.00, mrp: 285.00, unit: 'kg',    weightGrams: 5000 },
    { id: 'prod-india-gate-rice',  sku: 'GRC-RICE-5KG',   name: 'India Gate Basmati Rice',            categoryId: 'cat-grocery',   basePrice: 549.00, mrp: 549.00, unit: 'kg',    weightGrams: 5000 },
    // SNACKS & NAMKEEN
    { id: 'prod-lays-classic',     sku: 'SNK-LAYS-26G',   name: "Lay's Classic Salted Chips",         categoryId: 'cat-snacks',    basePrice: 10.00,  mrp: 10.00,  unit: 'piece', weightGrams: 26 },
    { id: 'prod-haldiram-bhujia',  sku: 'SNK-HALD-200G',  name: 'Haldiram Aloo Bhujia',               categoryId: 'cat-snacks',    basePrice: 85.00,  mrp: 85.00,  unit: 'piece', weightGrams: 200 },
    { id: 'prod-parle-g',          sku: 'SNK-PRLG-200G',  name: 'Parle-G Original Glucose Biscuits',  categoryId: 'cat-snacks',    basePrice: 22.00,  mrp: 22.00,  unit: 'piece', weightGrams: 200 },
    { id: 'prod-kurkure-masala',   sku: 'SNK-KURK-90G',   name: 'Kurkure Masala Munch',               categoryId: 'cat-snacks',    basePrice: 20.00,  mrp: 20.00,  unit: 'piece', weightGrams: 90 },
    // BEVERAGES
    { id: 'prod-coca-cola-250',    sku: 'BEV-COKE-250ML', name: 'Coca-Cola',                          categoryId: 'cat-beverages', basePrice: 20.00,  mrp: 20.00,  unit: 'litre', weightGrams: 250 },
    { id: 'prod-tropicana-orange', sku: 'BEV-TROP-1L',    name: 'Tropicana Orange Juice',             categoryId: 'cat-beverages', basePrice: 120.00, mrp: 120.00, unit: 'litre', weightGrams: 1000 },
    { id: 'prod-bisleri-water',    sku: 'BEV-BISL-1L',    name: 'Bisleri Mineral Water',              categoryId: 'cat-beverages', basePrice: 20.00,  mrp: 20.00,  unit: 'litre', weightGrams: 1000 },
    { id: 'prod-redbull',          sku: 'BEV-RBUL-250ML', name: 'Red Bull Energy Drink',              categoryId: 'cat-beverages', basePrice: 125.00, mrp: 125.00, unit: 'litre', weightGrams: 250 },
    // DAIRY & EGGS
    { id: 'prod-amul-milk',        sku: 'DRY-AMUL-500ML', name: 'Amul Taaza Full Cream Milk',         categoryId: 'cat-dairy',     basePrice: 30.00,  mrp: 30.00,  unit: 'litre', weightGrams: 500 },
    { id: 'prod-amul-butter',      sku: 'DRY-AMBL-100G',  name: 'Amul Butter',                        categoryId: 'cat-dairy',     basePrice: 62.00,  mrp: 62.00,  unit: 'piece', weightGrams: 100 },
    { id: 'prod-eggs-dozen',       sku: 'DRY-EGGS-12',    name: 'Farm Fresh Eggs',                    categoryId: 'cat-dairy',     basePrice: 95.00,  mrp: 95.00,  unit: 'piece', weightGrams: 720 },
    // INSTANT FOOD
    { id: 'prod-maggi-masala',     sku: 'INS-MAGG-560G',  name: 'Maggi 2-Minute Masala Noodles',      categoryId: 'cat-instant',   basePrice: 112.00, mrp: 112.00, unit: 'piece', weightGrams: 560 },
    { id: 'prod-yippee-noodles',   sku: 'INS-YIPP-240G',  name: 'Sunfeast Yippee Noodles',            categoryId: 'cat-instant',   basePrice: 65.00,  mrp: 65.00,  unit: 'piece', weightGrams: 240 },
    { id: 'prod-mtr-poha',         sku: 'INS-MTR-500G',   name: 'MTR Poha Breakfast Mix',             categoryId: 'cat-instant',   basePrice: 165.00, mrp: 165.00, unit: 'piece', weightGrams: 500 },
  ];

  const products = await Promise.all(
    productSeeds.map((p) =>
      prisma.product.upsert({
        where: { sku: p.sku },
        update: {
          basePrice: p.basePrice,
          mrp: p.mrp,
          unit: p.unit,
          weightGrams: p.weightGrams,
        },
        create: {
          id: p.id,
          sku: p.sku,
          name: p.name,
          categoryId: p.categoryId,
          basePrice: p.basePrice,
          mrp: p.mrp,
          unit: p.unit,
          weightGrams: p.weightGrams,
          isActive: true,
        },
      }),
    ),
  );
  console.log(`  ✅ ${products.length} products created/updated\n`);

  // ─── INVENTORY ─────────────────────────────────────────────────────────────
  // Schema fields: quantityOnHand, reorderLevel, reorderQty, currentPrice
  // Baseline numbers now live in src/data/baselineStock.ts (shared with the
  // /simulator/reset/:storeId safety endpoint — see Session 27).
  console.log('📊 Seeding inventory per store...');

  let inventoryCount = 0;
  for (const store of stores) {
    for (const product of products) {
      const s: StockEntry | undefined = stockMatrix[store.id]?.[product.id];
      if (!s) continue;
      await prisma.inventory.upsert({
        where: { storeId_productId: { storeId: store.id, productId: product.id } },
        update: {
          quantityOnHand: s.qty,
          reorderLevel: s.reorderLevel,
          reorderQty: s.reorderQty,
          currentPrice: s.currentPrice,
        },
        create: {
          storeId: store.id,
          productId: product.id,
          quantityOnHand: s.qty,
          reorderLevel: s.reorderLevel,
          reorderQty: s.reorderQty,
          currentPrice: s.currentPrice,
        },
      });
      inventoryCount++;
    }
  }
  console.log(`  ✅ ${inventoryCount} inventory records created\n`);

  // ─── PRICING RULES ─────────────────────────────────────────────────────────
  // Schema: floorPrice, ceilPrice, surgeMultiplierMax per store × product
  console.log('💰 Seeding pricing rules...');

  // Guardrail tiers by product sensitivity
  // floor = 95% of basePrice, ceil = 150–200% depending on category
  type RuleTier = { floorPct: number; ceilPct: number; surgeMax: number };
  const tiers: Record<string, RuleTier> = {
    'cat-grocery':   { floorPct: 0.95, ceilPct: 1.30, surgeMax: 1.30 }, // essentials — tight ceiling
    'cat-dairy':     { floorPct: 0.95, ceilPct: 1.25, surgeMax: 1.25 }, // perishables — tightest
    'cat-snacks':    { floorPct: 0.90, ceilPct: 1.60, surgeMax: 1.60 },
    'cat-beverages': { floorPct: 0.90, ceilPct: 1.75, surgeMax: 1.75 },
    'cat-instant':   { floorPct: 0.92, ceilPct: 1.50, surgeMax: 1.50 },
  };

  let ruleCount = 0;
  for (const store of stores) {
    for (const product of products) {
      const tier = tiers[product.categoryId] ?? { floorPct: 0.90, ceilPct: 1.50, surgeMax: 1.50 };
      await prisma.pricingRule.upsert({
        where: { storeId_productId: { storeId: store.id, productId: product.id } },
        update: {},
        create: {
          storeId: store.id,
          productId: product.id,
          floorPrice: parseFloat((product.basePrice * tier.floorPct).toFixed(2)),
          ceilPrice: parseFloat((product.basePrice * tier.ceilPct).toFixed(2)),
          surgeMultiplierMax: tier.surgeMax,
          isActive: true,
        },
      });
      ruleCount++;
    }
  }
  console.log(`  ✅ ${ruleCount} pricing rules created\n`);

  console.log('🎉 Seed complete! Summary:');
  console.log(`   Stores:         ${stores.length}`);
  console.log(`   Categories:     ${categories.length}`);
  console.log(`   Products:       ${products.length}`);
  console.log(`   Inventory rows: ${inventoryCount}`);
  console.log(`   Pricing rules:  ${ruleCount}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
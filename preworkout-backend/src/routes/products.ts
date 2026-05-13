import { Router } from 'express';
import { inventory, products } from '../data/store';

const router = Router();

function stockStatus(qty: number): string {
  if (qty === 0) return 'Niet op voorraad';
  if (qty <= 5) return 'Beperkt';
  return 'Op voorraad';
}

// GET /api/products — search, flavor, minPrice, maxPrice, inStock, minCaffeine, maxCaffeine, sort, page, pageSize
router.get('/', (req: any, res: any) => {
  const { search, flavor, minPrice, maxPrice, inStock, minCaffeine, maxCaffeine, sort, page = 1, pageSize = 20 } = req.query;

  let result = products.filter((p) => p.isActive);

  if (search) result = result.filter((p) => p.name.toLowerCase().includes((search as string).toLowerCase()));
  if (flavor) result = result.filter((p) => p.flavor === flavor);
  if (minPrice) result = result.filter((p) => p.price >= Number(minPrice));
  if (maxPrice) result = result.filter((p) => p.price <= Number(maxPrice));
  if (minCaffeine) result = result.filter((p) => p.caffeineMg >= Number(minCaffeine));
  if (maxCaffeine) result = result.filter((p) => p.caffeineMg <= Number(maxCaffeine));
  if (inStock === 'true') {
    const inStockIds = new Set(inventory.filter((i) => i.quantity > 0).map((i) => i.productId));
    result = result.filter((p) => inStockIds.has(p.id));
  }

  switch (sort) {
    case 'price_asc':     result.sort((a, b) => a.price - b.price); break;
    case 'price_desc':    result.sort((a, b) => b.price - a.price); break;
    case 'caffeine_desc': result.sort((a, b) => b.caffeineMg - a.caffeineMg); break;
    default:              result.sort((a, b) => a.name.localeCompare(b.name));
  }

  const total = result.length;
  const start = (Number(page) - 1) * Number(pageSize);
  const paged = result.slice(start, start + Number(pageSize));

  const withStock = paged.map((p) => {
    const inv = inventory.find((i) => i.productId === p.id);
    return { ...p, availableSizes: ['One Size'], stockStatus: stockStatus(inv?.quantity ?? 0) };
  });

  return res.json({ total, page: Number(page), pageSize: Number(pageSize), items: withStock });
});

// GET /api/products/:id — 200: product detail; 404: not found
router.get('/:id', (req: any, res: any) => {
  const product = products.find((p) => p.id === Number(req.params.id) && p.isActive);
  if (!product) return res.status(404).json({ message: 'Product not found' });

  const inv = inventory.find((i) => i.productId === product.id);
  return res.json({ ...product, stockStatus: stockStatus(inv?.quantity ?? 0), quantity: inv?.quantity ?? 0 });
});

export default router;

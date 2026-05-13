import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { ids, inventory, orders, products } from '../data/store';
import { requireAdmin } from '../middleware/auth';
import { Inventory, Order, OrderStatus, Product } from '../types';

const router = Router();

// All admin routes require Admin role — BR-006
router.use(requireAdmin);

// POST /api/admin/products — 201: new product; 400: validation error
router.post(
  '/products',
  [
    body('name').notEmpty().trim(),
    body('price').isFloat({ min: 0.01 }),
    body('categoryId').isInt(),
    body('caffeineMg').isInt({ min: 0 }),
    body('servings').isInt({ min: 1 }),
    body('inventory').isInt({ min: 0 }),
  ],
  (req: any, res: any) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, description, price, categoryId, flavor, caffeineMg, servings, imageUrl, inventory: qty } = req.body;

    const product: Product = {
      id: products.length + 1,
      categoryId,
      name,
      description: description ?? '',
      price,
      flavor: flavor ?? '',
      caffeineMg,
      servings,
      imageUrl: imageUrl ?? '',
      isActive: true,
    };
    products.push(product);

    const inv: Inventory = { id: ids.nextCart(), productId: product.id, quantity: qty };
    inventory.push(inv);

    return res.status(201).json({ product, inventory: inv });
  }
);

// PUT /api/admin/products/:id — 200: updated product; 404: not found
router.put('/products/:id', (req: any, res: any) => {
  const product = products.find((p) => p.id === Number(req.params.id));
  if (!product) return res.status(404).json({ message: 'Product not found' });

  const allowed: (keyof Product)[] = ['name', 'description', 'price', 'categoryId', 'flavor', 'caffeineMg', 'servings', 'imageUrl', 'isActive'];
  allowed.forEach((key) => {
    if (req.body[key] !== undefined) (product as any)[key] = req.body[key];
  });

  return res.json(product);
});

// GET /api/admin/products — list all products including inactive
router.get('/products', (_req: any, res: any) => res.json(products));

// GET /api/admin/orders — list all orders
router.get('/orders', (_req: any, res: any) => res.json(orders));

// PATCH /api/admin/orders/:id/status — 200: updated; 400: invalid transition
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  Pending:   ['Paid', 'Cancelled'],
  Paid:      ['Shipped', 'Cancelled'],
  Shipped:   ['Delivered'],
  Delivered: [],
  Cancelled: [],
};

router.patch('/orders/:id/status', [body('status').notEmpty()], (req: any, res: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const order = orders.find((o) => o.id === Number(req.params.id));
  if (!order) return res.status(404).json({ message: 'Order not found' });

  const newStatus: OrderStatus = req.body.status;
  if (!VALID_TRANSITIONS[order.status].includes(newStatus)) {
    return res.status(400).json({ message: `Invalid status transition from ${order.status} to ${newStatus}` });
  }

  order.status = newStatus;
  return res.json(order);
});

export default router;

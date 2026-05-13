import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { cartItems, ids, inventory, products } from '../data/store';
import { requireAuth } from '../middleware/auth';
import { AuthPayload, CartItem } from '../types';

const router = Router();

// GET /api/cart — returns cart items + totals for authenticated user
router.get('/', requireAuth, (req: any, res: any) => {
  const { userId } = req.auth as AuthPayload;
  const items = cartItems.filter((c) => c.userId === userId);
  const enriched = items.map((c) => {
    const product = products.find((p) => p.id === c.productId);
    return { ...c, product };
  });
  const totalPrice = enriched.reduce((sum, i) => sum + (i.product?.price ?? 0) * i.quantity, 0);
  return res.json({ items: enriched, totalPrice });
});

// POST /api/cart/items — 201: added; 400: invalid quantity; 409: insufficient stock
// BR-001: product can only be ordered when in stock
router.post(
  '/items',
  requireAuth,
  [body('productId').isInt(), body('quantity').isInt({ min: 1 }), body('flavor').notEmpty()],
  (req: any, res: any) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { userId } = req.auth as AuthPayload;
    const { productId, quantity, flavor } = req.body;

    const product = products.find((p) => p.id === productId && p.isActive);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const inv = inventory.find((i) => i.productId === productId);
    if (!inv || inv.quantity < quantity) {
      return res.status(409).json({ message: 'Insufficient stock' });
    }

    const existing = cartItems.find((c) => c.userId === userId && c.productId === productId && c.flavor === flavor);
    if (existing) {
      if (inv.quantity < existing.quantity + quantity) {
        return res.status(409).json({ message: 'Insufficient stock' });
      }
      existing.quantity += quantity;
      return res.status(201).json(existing);
    }

    const item: CartItem = { id: ids.nextCart(), userId, productId, quantity, flavor };
    cartItems.push(item);
    return res.status(201).json(item);
  }
);

// PATCH /api/cart/items/:id — 200: updated; 404: not found
router.patch('/items/:id', requireAuth, [body('quantity').isInt({ min: 1 })], (req: any, res: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { userId } = req.auth as AuthPayload;
  const item = cartItems.find((c) => c.id === Number(req.params.id) && c.userId === userId);
  if (!item) return res.status(404).json({ message: 'Cart item not found' });

  const inv = inventory.find((i) => i.productId === item.productId);
  if (!inv || inv.quantity < req.body.quantity) {
    return res.status(409).json({ message: 'Insufficient stock' });
  }

  item.quantity = req.body.quantity;
  return res.json(item);
});

// DELETE /api/cart/items/:id — 204: deleted; 404: not found
router.delete('/items/:id', requireAuth, (req: any, res: any) => {
  const { userId } = req.auth as AuthPayload;
  const idx = cartItems.findIndex((c) => c.id === Number(req.params.id) && c.userId === userId);
  if (idx === -1) return res.status(404).json({ message: 'Cart item not found' });
  cartItems.splice(idx, 1);
  return res.status(204).send();
});

export default router;

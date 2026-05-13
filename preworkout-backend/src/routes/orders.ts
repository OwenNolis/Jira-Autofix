import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { cartItems, ids, inventory, orderLines, orders, products } from '../data/store';
import { requireAuth } from '../middleware/auth';
import { AuthPayload, Order, OrderLine } from '../types';

const router = Router();

// POST /api/orders — 201: order Pending + paymentUrl; 400: empty cart; 409: stock issue
// BR-003: order starts as Pending
// BR-004: inventory reserved at order creation
router.post(
  '/',
  requireAuth,
  [body('paymentMethod').notEmpty()],
  (req: any, res: any) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { userId } = req.auth as AuthPayload;
    const userCart = cartItems.filter((c) => c.userId === userId);

    if (userCart.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    // Validate stock for all items
    for (const item of userCart) {
      const inv = inventory.find((i) => i.productId === item.productId);
      if (!inv || inv.quantity < item.quantity) {
        return res.status(409).json({ message: `Insufficient stock for product ${item.productId}` });
      }
    }

    // Reserve inventory — BR-004
    for (const item of userCart) {
      const inv = inventory.find((i) => i.productId === item.productId)!;
      inv.quantity -= item.quantity;
    }

    const totalPrice = userCart.reduce((sum, item) => {
      const product = products.find((p) => p.id === item.productId);
      return sum + (product?.price ?? 0) * item.quantity;
    }, 0);

    const order: Order = {
      id: ids.nextOrder(),
      userId,
      addressId: req.body.addressId ?? 0,
      totalPrice,
      status: 'Pending',
      createdAt: new Date().toISOString(),
    };
    orders.push(order);

    for (const item of userCart) {
      const product = products.find((p) => p.id === item.productId)!;
      const line: OrderLine = {
        id: ids.nextLine(),
        orderId: order.id,
        productId: item.productId,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: product.price,
        flavor: item.flavor,
      };
      orderLines.push(line);
    }

    // Clear cart after order creation
    const indices = cartItems.reduce<number[]>((acc, c, i) => {
      if (c.userId === userId) acc.push(i);
      return acc;
    }, []).reverse();
    indices.forEach((i) => cartItems.splice(i, 1));

    return res.status(201).json({
      order: { ...order, lines: orderLines.filter((l) => l.orderId === order.id) },
      paymentUrl: `https://payment.pulsepre.be/checkout/${order.id}`,
    });
  }
);

// GET /api/orders/me — returns authenticated user's orders
// BR-005: customers can only view their own orders
router.get('/me', requireAuth, (req: any, res: any) => {
  const { userId } = req.auth as AuthPayload;
  const userOrders = orders
    .filter((o) => o.userId === userId)
    .map((o) => ({ ...o, lines: orderLines.filter((l) => l.orderId === o.id) }));
  return res.json(userOrders);
});

export default router;

import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { ids, orderLines, orders, returnRequests } from '../data/store';
import { requireAuth } from '../middleware/auth';
import { AuthPayload, ReturnRequest } from '../types';

const router = Router();

// POST /api/returns — 201: return request created
// BR-007: return only allowed for Delivered orders within 14 days
router.post(
  '/',
  requireAuth,
  [body('orderId').isInt(), body('orderLineId').isInt(), body('reason').notEmpty().trim()],
  (req: any, res: any) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { userId } = req.auth as AuthPayload;
    const { orderId, orderLineId, reason } = req.body;

    const order = orders.find((o) => o.id === Number(orderId) && o.userId === userId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // BR-007: only Delivered orders can be returned
    if (order.status !== 'Delivered') {
      return res.status(400).json({ message: 'Return only allowed for delivered orders' });
    }

    // BR-007: within 14 days of delivery
    const deliveredAt = new Date(order.createdAt);
    const daysSince = (Date.now() - deliveredAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince > 14) {
      return res.status(400).json({ message: 'Return window of 14 days has passed' });
    }

    const line = orderLines.find((l) => l.id === Number(orderLineId) && l.orderId === order.id);
    if (!line) return res.status(404).json({ message: 'Order line not found' });

    const returnRequest: ReturnRequest = {
      id: ids.nextReturn(),
      orderId: order.id,
      orderLineId: line.id,
      reason,
      status: 'Requested',
      requestedAt: new Date().toISOString(),
    };
    returnRequests.push(returnRequest);

    return res.status(201).json(returnRequest);
  }
);

export default router;

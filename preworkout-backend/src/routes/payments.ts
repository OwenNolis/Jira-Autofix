import { Router } from 'express';
import { ids, inventory, orderLines, orders, payments } from '../data/store';
import { Payment } from '../types';

const router = Router();

// POST /api/payments/webhook — provider posts transactionReference + status
// BR-003: order becomes Paid only after successful webhook
// BR-004: inventory definitively reduced after successful payment
router.post('/webhook', (req: any, res: any) => {
  const { transactionReference, status, orderId } = req.body;

  if (!transactionReference || !status || !orderId) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  const order = orders.find((o) => o.id === Number(orderId));
  if (!order) return res.status(404).json({ message: 'Order not found' });

  // NFR-004: payment data not stored locally beyond reference
  const existing = payments.find((p) => p.orderId === order.id);
  if (existing) {
    existing.status = status === 'completed' ? 'Completed' : 'Failed';
    existing.transactionRef = transactionReference;
  } else {
    const payment: Payment = {
      id: ids.nextPay(),
      orderId: order.id,
      provider: req.body.provider ?? 'unknown',
      status: status === 'completed' ? 'Completed' : 'Failed',
      transactionRef: transactionReference,
    };
    payments.push(payment);
  }

  if (status === 'completed') {
    order.status = 'Paid';
  } else {
    order.status = 'Cancelled';
    // Release reserved inventory on failed payment
    const lines = orderLines.filter((l) => l.orderId === order.id);
    for (const line of lines) {
      const inv = inventory.find((i) => i.productId === line.productId);
      if (inv) inv.quantity += line.quantity;
    }
  }

  return res.json({ message: 'Webhook processed', orderId: order.id, status: order.status });
});

export default router;

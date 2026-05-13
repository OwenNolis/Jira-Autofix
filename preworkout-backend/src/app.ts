import cors from 'cors';
import express from 'express';
import adminRouter from './routes/admin';
import authRouter from './routes/auth';
import cartRouter from './routes/cart';
import ordersRouter from './routes/orders';
import paymentsRouter from './routes/payments';
import productsRouter from './routes/products';
import returnsRouter from './routes/returns';

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// NFR-005: all endpoints use validation, authentication and authorisation
app.use('/api/products',        productsRouter);
app.use('/api/auth',            authRouter);
app.use('/api/cart',            cartRouter);
app.use('/api/orders',          ordersRouter);
app.use('/api/payments',        paymentsRouter);
app.use('/api/returns',         returnsRouter);
app.use('/api/admin',           adminRouter);   // BR-006: Admin role required

// NFR-008: log errors without storing sensitive data
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(`[ERROR] ${err.message}`);
  res.status(500).json({ message: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`PULSE PRE backend running on port ${PORT}`);
});

export default app;

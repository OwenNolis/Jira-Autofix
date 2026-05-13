import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { ids, users } from '../data/store';
import { signToken } from '../middleware/auth';
import { User } from '../types';

const router = Router();

// POST /api/auth/register — 201: user + token; 409: email already exists
router.post(
  '/register',
  [
    body('firstName').notEmpty().trim(),
    body('lastName').notEmpty().trim(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
  ],
  async (req: any, res: any) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { firstName, lastName, email, password } = req.body;

    if (users.find((u) => u.email === email)) {
      return res.status(409).json({ message: 'Email already exists' });
    }

    // NFR-003: passwords are hashed — never stored in plain text
    const passwordHash = await bcrypt.hash(password, 10);

    const user: User = {
      id: ids.nextUser(),
      firstName,
      lastName,
      email,
      passwordHash,
      role: 'Customer',
      createdAt: new Date().toISOString(),
    };
    users.push(user);

    const token = signToken({ userId: user.id, role: user.role });
    return res.status(201).json({
      user: { id: user.id, firstName, lastName, email, role: user.role },
      token,
    });
  }
);

// POST /api/auth/login — 200: user + token; 401: invalid credentials
router.post(
  '/login',
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  async (req: any, res: any) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    const user = users.find((u) => u.email === email);
    if (!user) return res.status(401).json({ message: 'Invalid email or password' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ message: 'Invalid email or password' });

    const token = signToken({ userId: user.id, role: user.role });
    return res.status(200).json({
      user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role },
      token,
    });
  }
);

export default router;

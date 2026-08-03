import express, { type Request, type Response, type NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db/pg_adaptor.js';

const router = express.Router();

/**
 * Extended Express Request to attach authenticated user context
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    [key: string]: any;
  };
}

/**
 * Middleware: Authenticates requests using JWT Authorization header
 * Expects header format: Authorization: Bearer <token>
 */
export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const secret = process.env.JWT_SECRET || 'fallback_secret';

  jwt.verify(token, secret, (err: any, decoded: any) => {
    if (err) {
      return res.status(403).json({ error: 'Forbidden: Invalid or expired token' });
    }

    // Maps { userId: ... } from signed token payload to req.user.id
    req.user = {
      id: decoded.userId,
    };

    next();
  });
};

/**
 * POST /auth/register
 */
router.post('/register', async (req: Request, res: Response) => {
  const { username, email, password } = req.body;

  console.log('Register req received:', username, email);

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }

  try {
    const existingUser = await db.oneOrNone(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existingUser) {
      return res.status(409).json({ error: 'Username or email already in use' });
    }

    const salt = await bcrypt.genSalt(10);
    const pwd_hash = await bcrypt.hash(password, salt);

    const newUser = await db.one(
      `INSERT INTO users (username, email, pwd_hash) 
       VALUES ($1, $2, $3) 
       RETURNING id, username, email, created_at`,
      [username, email, pwd_hash]
    );

    const token = jwt.sign(
      { userId: newUser.id },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '30d' }
    );

    return res.status(201).json({
      message: 'User registered successfully',
      user: newUser,
      token,
    });
  } catch (err) {
    console.error('Registration Error:', err);
    return res.status(500).json({ error: 'Internal server error during registration' });
  }
});

/**
 * POST /auth/login
 */
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  console.log('Login request received:', email);

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await db.oneOrNone('SELECT * FROM users WHERE email = $1', [email]);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.pwd_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '30d' }
    );

    return res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        created_at: user.created_at,
      },
      token,
    });
  } catch (err) {
    console.error('Login Error:', err);
    return res.status(500).json({ error: 'Internal server error during login' });
  }
});

export default router;
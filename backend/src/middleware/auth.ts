import { type Request, type Response, type NextFunction } from 'express';
import jwt = require('jsonwebtoken');

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: number;
  };
}

function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret', (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user as { userId: number };
    next();
  });
}

module.exports = {authenticateToken};
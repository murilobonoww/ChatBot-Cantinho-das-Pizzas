const jwt = require("jsonwebtoken");
import { Request, Response, NextFunction } from 'express';

const { JWT_SECRET_KEY } = process.env;

export default function autenticarUser (req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token;

  if (!token) return res.status(401).json({ error: 'Token not provided' })

  try {
    const decoded = jwt.verify(token, JWT_SECRET_KEY as string);
    (req as any).user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
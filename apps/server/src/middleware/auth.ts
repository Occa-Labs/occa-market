/*
  Session auth. We verify a Privy token once (see features/auth), then issue our
  own short-lived JWT; every authenticated request carries that JWT, not the
  Privy token. requireAuth verifies it and attaches req.user.
*/

import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

export type AuthTokenPayload = {
  userId: string;
  privyDid: string;
  iat?: number;
  exp?: number;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

export function signToken(payload: { userId: string; privyDid: string }): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: "24h" });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "missing token" });
    return;
  }
  try {
    req.user = jwt.verify(header.slice(7), env.jwtSecret) as AuthTokenPayload;
    next();
  } catch {
    res.status(401).json({ error: "invalid token" });
  }
}

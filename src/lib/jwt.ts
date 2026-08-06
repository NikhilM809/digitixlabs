import jwt, { type SignOptions } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

export function signToken(payload: JwtPayload, expiresIn: string | number = "30m") {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresIn as SignOptions["expiresIn"] });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export function generateResetToken(email: string) {
  return jwt.sign({ email, purpose: "reset" }, JWT_SECRET, {
    expiresIn: "1h" as SignOptions["expiresIn"],
  });
}

export function verifyResetToken(token: string): { email: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { email: string; purpose: string };
    if (decoded.purpose !== "reset") return null;
    return { email: decoded.email };
  } catch {
    return null;
  }
}

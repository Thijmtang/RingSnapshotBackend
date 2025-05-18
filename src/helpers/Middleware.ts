import { Request, Response, NextFunction } from "express";
import { auth } from "express-oauth2-jwt-bearer";

export const checkAuthorizedEmail = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Get the user from the auth payload (added by auth0 middleware)
  const user = req.auth?.payload;
  const allowedMails = new Set(process.env.ALLOWED_EMAILS?.split(",") || []);
  if (!user?.email || !allowedMails.has(user.email)) {
    return res.status(403).send("Email not allowed");
  }

  next();
};

export const auth0JwtCheck = () => {
  return auth({
    audience: process.env.AUTH0_IDENTIFIER,
    issuerBaseURL: process.env.AUTH0_DOMAIN,
    tokenSigningAlg: "RS256",
  });
};

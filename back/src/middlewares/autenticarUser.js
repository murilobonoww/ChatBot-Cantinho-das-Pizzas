const jwt = require("jsonwebtoken");

const { JWT_SECRET_KEY } = process.env;

module.exports = function autenticarUser (req, res, next) {
  const token = req.cookies?.token;

  if (!token) return res.status(401).json({ error: 'Token not provided' })

  try {
    const decoded = jwt.verify(token, JWT_SECRET_KEY);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
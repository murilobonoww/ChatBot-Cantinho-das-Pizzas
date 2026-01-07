const rateLimit = require("express-rate-limit");


module.exports = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Muitas tentativas. Tente novamente mais tarde." },
});
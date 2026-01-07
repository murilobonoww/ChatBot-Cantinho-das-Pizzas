//config
dotenv.config();
const { CODE_HASH, JWT_SECRET_KEY } = process.env

//libs
const express = require("express");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

//internos
const limiter = require('../middlewares/rateLimiter')
const autenticar = require('../middlewares/autenticarUser')
const router = express.Router();


router.post("/check-auth", autenticar, (req, res) => {
  return res.status(200).json({ logged: true })
})

router.post("/logout", (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      path: "/",
    });
    return res.status(200).json({ message: "Logout bem suscedido" });
  } catch (error) {
    console.log(`Erro no logout: ${error}`);
    res.status(500).json({ error: "Erro interno ao limpar cookie" });
  }
});

router.post("/login", limiter, async (req, res) => {
  const { code } = req.body

  if (!code) return res.status(400).json({ error: 'Código não informado' })

  const isCodeValid = await bcrypt.compare(code, CODE_HASH)
  if (!isCodeValid) return res.status(401).json({ error: 'Código incorreto' })

  const token = jwt.sign({ acesso: "allowed" }, JWT_SECRET_KEY, { expiresIn: "10h" });

  res.cookie("token", token, { httpOnly: true, secure: true, sameSite: "none", maxAge: 10 * 60 * 60 * 1000, path: "/", });

  return res.status(200).json({ ok: true });
});

router.post("/confirmPass/:pass", (req, res) => {
  const pass = req.params.pass;
  const gerenciaPass = process.env.SENHA_GERENCIA;
  if (pass === gerenciaPass) {
    res.status(200).json({ message: "autorizado" });
  } else {
    res.status(401).json({ error: "senha incorreta" });
  }
});

module.exports = router;
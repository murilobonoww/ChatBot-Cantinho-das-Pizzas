import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { Request, Response } from 'express';

import autenticar from '../shared/middlewares/autenticarUser';
const router = express.Router();

router.post("/check-auth", autenticar, (req: Request, res: Response) => {
  return res.status(200).json({ logged: true })
})

router.post("/logout", (req: Request, res: Response) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
    });
    return res.status(200).json({ message: "Logout bem suscedido" });
  } catch (error) {
    console.log(`Erro no logout: ${error}`);
    res.status(500).json({ error: "Erro interno ao limpar cookie" });
  }
});

const { CODE_HASH, JWT_SECRET_KEY } = process.env;
import limiter from '../shared/middlewares/rateLimiter';

router.post("/login", limiter, async (req: Request, res: Response) => {
  const { code } = req.body

  if (!code) return res.status(400).json({ error: 'Código não informado' })

  const isCodeValid = await bcrypt.compare(code, CODE_HASH as string);
  if (!isCodeValid) return res.status(401).json({ error: 'Código incorreto' });
  const token = jwt.sign({ acesso: "allowed" }, JWT_SECRET_KEY as string, { expiresIn: "10h" });
  res.cookie("token", token, { httpOnly: true, secure: true, sameSite: "none", maxAge: 10 * 60 * 60 * 1000, path: "/", });
  return res.status(200).json({ ok: true });
});

router.post("/confirmPass/:pass", (req: Request, res: Response) => {
  const pass = req.params.pass;
  const gerenciaPass = process.env.SENHA_GERENCIA as string;
  if (pass === gerenciaPass) {
    res.status(200).json({ message: "autorizado" });
  } else {
    res.status(401).json({ error: "senha incorreta" });
  }
});

export default router;
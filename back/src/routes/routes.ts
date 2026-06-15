import express from "express";
const router = express.Router();
import { Request, Response } from 'express';

router.get("/keep-server-on", (req: Request, res: Response) => {
  return res.sendStatus(200)
})

export default router;
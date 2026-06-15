import express from "express";
import { randomUUID } from "crypto";

import db from "../db";
const router = express.Router();

function Emit(id: string, numero: string, mensagem: string, tipo: string, status_default: string, id_pedido: string) {
    try {
        if (tipo === 'cancelamento') global.io.emit('notificacao_cancelamento', { id, numero, mensagem, tipo, status_default, id_pedido });
        else global.io.emit('notificacao', { id, numero, mensagem, tipo, status_default });
    } catch (error) {
        console.log("Erro ao emitir notificação: ", error)
        throw error;
    }
}

router.post("/", async (req, res) => {
    try {
        const { numero, mensagem, tipo, id_pedido } = req.body;
        const id = randomUUID();
        const status_default = 'pendente';
        let values = [id, numero, mensagem, tipo, status_default];

        let sql = 'INSERT INTO notificacoes (id_notificacao, numero_cliente, mensagem, tipo, status) VALUES (?, ?, ?, ?, ?)';
        const [rows] = await db.execute(sql, values);

        if (global.io) Emit(id, numero, mensagem, tipo, status_default, id_pedido);
        else console.warn("⚠️ Socket.IO não inicializado");
        return res.status(200).json({ message: "Notificação salva com sucesso" });

    } catch (error) {
        console.error("Erro ao salvar notificação:", error);
        return res.status(200).json({ message: "Erro ao salvar a notificação" });
    }
})

router.get("/pending", async (req, res) => {
    try {
        const sql = 'SELECT * FROM notificacoes WHERE status = ?';
        const [rows] = await db.query(sql, ['pendente']);
        return res.status(200).json(rows);
    } catch (error) {
        console.error("Erro ao salvar notificação:", error);
        return res.status(200).json({ message: "Erro ao listar notificações" });
    }
})

router.put("/", async (req, res) => {
    try {
        const { id, status } = req.body;
        const values = [status, id]
        const sql = 'UPDATE notificacoes SET status = ? where id_notificacao = ?';
        const [rows] = await db.query(sql, values);
        return res.status(200).json({ message: "Notificação atualizada com sucesso" })
    } catch (error) {
        console.error("Erro ao atualizar notificação:", error);
        return res.status(200).json({ message: "Erro ao atualizar notificações" });
    }
})

router.delete("/", async (req, res) => {
    try {
        const sql = 'DELETE FROM notificacoes';
        await db.query(sql);
        return res.status(200).json({ message: "Notificações limpas com sucesso" })
    } catch (error) {
        console.error("Erro ao limpar notificações:", error);
        return res.status(200).json({ message: "Erro ao limpar notificações" });
    }
})

export default router;
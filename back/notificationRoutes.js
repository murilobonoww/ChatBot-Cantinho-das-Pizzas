const express = require("express");
const router = express.Router();
const db = require("./db");
const dotenv = require("dotenv");
dotenv.config();
const axios = require("axios");
const { randomUUID } = require("crypto");

router.post("/post", async (req, res) => {
    try {
        const { numero, mensagem, tipo } = req.body;
        const id = randomUUID();
        let values = [id, numero, mensagem, tipo, 'pendente'];

        let sql = 'INSERT INTO notificacoes (id_notificacao, numero_cliente, mensagem, tipo, status) VALUES (?, ?, ?, ?, ?)';
        const [rows] = await db.execute(sql, values)
        return res.status(200).json({ message: "Notificação salva com sucesso" })

    } catch (error) {
        console.error("Erro ao salvar notificação:", error);
        return res.status(200).json({ message: "Erro ao salvar a notificação"}) //Retorna 200 para não interromper fluxo do N8N
    }
})

router.get("/pendentes", async (req, res) => {
    try {
        const sql = 'SELECT * FROM notificacoes WHERE status = ?';
        const [rows] = await db.query(sql, ['pendente']);
        return res.status(200).json({ message: "Notificações listadas com sucesso" })
    } catch (error) {
        console.error("Erro ao salvar notificação:", error);
        return res.status(200).json({ message: "Erro ao listar notificações"}) //Retorna 200 para não interromper fluxo do N8N
    }
})

router.put("/atualizar", async (req, res) => {
    try {
        const {id, status} = req.body;
        const values = [status, id]
        const sql = 'UPDATE notificacoes SET status = ? where id_notificacao = ?';
        const [rows] = await db.query(sql, values);
        return res.status(200).json({ message: "Notificação atualizada com sucesso" })
    } catch (error) {
        console.error("Erro ao atualizar notificação:", error);
        return res.id_(200).json({ message: "Erro ao atualizar notificações"}) //Retorna 200 para não interromper fluxo do N8N
    }
})

module.exports = router;
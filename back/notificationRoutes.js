const express = require("express");
const router = express.Router();
const db = require("./db");
const dotenv = require("dotenv");
dotenv.config();
const axios = require("axios");

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

module.exports = router;
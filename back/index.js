require("dotenv").config();
const express = require("express");
const cors = require("cors");
const routes = require("./routes");
const db = require("./db");
const axios = require("axios");
const app = express();
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const fs = require("fs");

let pollingEmExecucao = false;

const http = require("http");

const server = http.createServer(app)

const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: "*"
  },
});

global.io = io;

app.use(helmet());
app.use(cors({
  origin: ["https://cantinho-das-pizzas.vercel.app", "http://localhost:5173"],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(routes);

const PORT = process.env.PORT || 10000;

(async () => {
  try {
    await db.query("SELECT 1");
    console.log("✅ Pool MySQL pronto");
  } catch (error) {
    console.error("❌ Erro no pool MySQL:", error.message);
  }
})();


function mapearStatusFoody(status) {
  const mapeamento = {
    open: "aberto",
    accepted: "aceito",
    dispatched: "despachado",
    onGoing: "andamento",
    delivered: "entregue",
    pending: "aberto",
    canceled: "cancelado",
  };
  const statusMapeado = mapeamento[status] || status;
  console.log(`Mapeando status: ${status} -> ${statusMapeado}`);
  return statusMapeado;
}

async function buscarPedidosAbertos() {
  const sql = "SELECT id_pedido, uid_foody, status_pedido FROM pedido WHERE status_pedido IN ('Despachado', 'Aceito', 'Dispatched', 'aberto', 'Andamento') AND uid_foody IS NOT NULL"
  const [rows] = await db.query(sql);
  console.log(`Pedidos encontrados: ${rows.length}`);
  return rows;
}

async function consultarStatusFoody(uid_foody) {
  try {
    console.log(`Consultando status do pedido com uid_foody: ${uid_foody}`);
    const response = await axios.get(
      `https://app.foodydelivery.com/rest/1.2/orders/${uid_foody}`,
      {
        headers: {
          Authorization:
            process.env.FOODY_API_TOKEN || "edab289cff47488bb78c9e2897420ffe",
          "Content-Type": "application/json;charset=UTF-8",
        },
      }
    );
    const statusOriginal = response.data.status;
    const statusMapeado = mapearStatusFoody(statusOriginal);
    console.log(`Status recebido da API: ${statusOriginal} -> ${statusMapeado}`);
    return statusMapeado;
  } catch (error) {
    console.error(
      `❌ Erro ao consultar pedido ${uid_foody}:`,
      error.response?.data || error.message
    );
    return null;
  }
}

async function atualizarStatusPedido(id_pedido, novoStatus) {
  console.log(`🔄 Atualizando status do pedido ${id_pedido} para ${novoStatus}...`);
  try {
    const [rows] = await db.query('UPDATE pedido SET status_pedido = ? WHERE id_pedido = ?', [novoStatus, id_pedido]);
    console.log(`✅ Status do pedido ${id_pedido} atualizado para ${novoStatus}!`);
    return rows;
  } catch (error) {
    console.error(`❌ Erro ao atualizar status do pedido ${id_pedido}:`, error.message);
    throw error;
  }
}

// Função de polling
async function sincronizarStatusPedidos() {
  if (pollingEmExecucao) return;

  pollingEmExecucao = true;

  try {
    console.log("Iniciando sincronização de status dos pedidos...");
    const pedidos = await buscarPedidosAbertos();

    if (pedidos.length === 0) {
      console.log("ℹ️ Nenhum pedido aberto para sincronizar.");
      return;
    }

    for (const pedido of pedidos) {
      const { id_pedido, uid_foody, status_pedido } = pedido;

      const novoStatus = await consultarStatusFoody(uid_foody);
      if (novoStatus && novoStatus !== status_pedido) {
        await atualizarStatusPedido(id_pedido, novoStatus);

        const [rows] = await db.query(
          "SELECT * FROM pedido WHERE id_pedido = ?",
          [id_pedido]
        );

        io.emit("pedidoAtualizado", rows[0]);
      }
    }
  } catch (error) {
    console.error("⚠️ Erro ao sincronizar status:", error.message);
  } finally {
    pollingEmExecucao = false;
  }
}

setInterval(sincronizarStatusPedidos, 5000);

// Monitorar conexões WebSocket
io.on("connection", (socket) => {
  console.log("Cliente WebSocket conectado:", socket.id);
  socket.on("disconnect", () => {
    console.log("Cliente WebSocket desconectado:", socket.id);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Backend rodando em :${PORT}`);
});
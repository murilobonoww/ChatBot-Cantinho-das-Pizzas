require("dotenv").config();
const express = require("express");
const cors = require("cors");
const routes = require("./routes");
const connection = require("./db");
const axios = require("axios");
const app = express();
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const https = require('https');
const fs = require("fs");


const http = require("http");

const server = https.createServer({
  key: fs.readFileSync('./localhost+2-key.pem'),
  cert: fs.readFileSync('./localhost+2.pem')
},app)

const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: "*"
  },
});

global.io = io;

app.use(helmet());
app.use(cors({
  origin: "https://chat-bot-cantinho-das-pizzas.vercel.app",
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(routes);

const PORT = process.env.PORT || 10000;

connection.connect((err) => {
  if (err) {
    console.error("❌ Erro ao conectar ao banco de dados:", err.message);
    process.exit(1);
  }
  console.log("✅ Conectado ao banco de dados MySQL com sucesso!");
});

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

// Função para buscar pedidos abertos
async function buscarPedidosAbertos() {
  return new Promise((resolve, reject) => {
    console.log("Executando consulta para buscar pedidos abertos...");
    connection.query(
      "SELECT id_pedido, uid_foody, status_pedido FROM pedido WHERE status_pedido IN ('Despachado', 'Aceito', 'Dispatched', 'aberto', 'Andamento') AND uid_foody IS NOT NULL",
      (err, results) => {
        if (err) {
          console.error("❌ Erro ao consultar pedidos:", err.message);
          return reject(err);
        }
        console.log(`Pedidos encontrados: ${results.length}`);
        console.log("Resultados:", results);
        resolve(results);
      }
    );
  });
}

// Função para consultar status na Foody API
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
  return new Promise((resolve, reject) => {
    connection.query(
      "UPDATE pedido SET status_pedido = ? WHERE id_pedido = ?",
      [novoStatus, id_pedido],
      (err) => {
        if (err) {
          console.error(`❌ Erro ao atualizar status do pedido ${id_pedido}:`, err.message);
          return reject(err);
        }
        console.log(`✅ Status do pedido ${id_pedido} atualizado com sucesso!`);
        resolve();
      }
    );
  });
}

// Função de polling
async function sincronizarStatusPedidos() {
  console.log("Iniciando sincronização de status dos pedidos...");
  try {
    const pedidos = await buscarPedidosAbertos();
    if (pedidos.length === 0) {
      console.log("ℹ️ Nenhum pedido aberto para sincronizar.");
      return;
    }

    for (const pedido of pedidos) {
      const { id_pedido, uid_foody, status_pedido } = pedido;
      console.log(`Processando pedido ${id_pedido} (uid: ${uid_foody}, status atual: ${status_pedido})`);
      const novoStatus = await consultarStatusFoody(uid_foody);
      if (novoStatus && novoStatus !== status_pedido) {
        await atualizarStatusPedido(id_pedido, novoStatus);

        // Buscar o pedido completo do banco
        const [pedidoAtualizado] = await new Promise((resolve, reject) => {
          console.log(`Buscando dados completos do pedido ${id_pedido}...`);
          connection.query(
            "SELECT * FROM pedido WHERE id_pedido = ?",
            [id_pedido],
            (err, results) => {
              if (err) {
                console.error(`❌ Erro ao buscar pedido ${id_pedido}:`, err.message);
                return reject(err);
              }
              console.log(`Dados do pedido ${id_pedido}:`, results[0]);
              resolve(results);
            }
          );
        });

        // Emitir evento com o nome correto e objeto completo
        console.log(`Emitindo pedidoAtualizado para pedido ${id_pedido}:`, pedidoAtualizado);
        io.emit("pedidoAtualizado", pedidoAtualizado);
      } else if (!novoStatus) {
        console.log(`⚠️ Não foi possível obter status para o pedido ${id_pedido} (uid: ${uid_foody})`);
      } else {
        console.log(`ℹ️ Status do pedido ${id_pedido} não mudou: ${status_pedido}`);
      }
    }
  } catch (err) {
    console.error("⚠️ Erro ao sincronizar status dos pedidos:", err.message);
  }
}

// Iniciar polling a cada 5 segundos
console.log("Configurando polling para sincronizar status...");
setInterval(sincronizarStatusPedidos, 5000);

// Monitorar conexões WebSocket
io.on("connection", (socket) => {
  console.log("Cliente WebSocket conectado:", socket.id);
  socket.on("disconnect", () => {
    console.log("Cliente WebSocket desconectado:", socket.id);
  });
});




server.listen(10000, "0.0.0.0", () => {
  console.log(`🚀 Backend rodando em :${PORT}`);
});
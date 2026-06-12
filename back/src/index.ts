const { Server } = require("socket.io");
import type { Socket } from 'socket.io';
require("dotenv").config();
import app from './shared/app';
import db from "./db";
// const orderHelper = require('./order/order.helper');

const http = require("http");
const server = http.createServer(app)
const io_ = new Server(server, { cors: { origin: "*" }});
global.io = io_;

const PORT = process.env.PORT || 10000;

(async () => {
  try {
    await db.query("SELECT 1");
    console.log("✅ Pool MySQL pronto");
  } catch (error : any) {
    console.error("❌ Erro no pool MySQL:", error.message);
  }
})();

// setInterval(orderHelper.sincronizarStatusPedidos(), 5000);

io_.on("connection", (socket: Socket) => {
  console.log("Cliente WebSocket conectado:", socket.id);
  socket.on("disconnect", () => {
    console.log("Cliente WebSocket desconectado:", socket.id);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Backend rodando em :${PORT}`);
});
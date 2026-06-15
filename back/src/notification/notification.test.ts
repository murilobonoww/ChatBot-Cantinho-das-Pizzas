import app from "../shared/app";
import request from 'supertest';
import { Server } from "socket.io";
import type { Socket } from 'socket.io';
import http from "http";
const server = http.createServer(app)
const io_ = new Server(server, { cors: { origin: "*" }});
global.io = io_ as any;

io_.on("connection", (socket: Socket) => {
    console.log("Cliente WebSocket conectado:", socket.id);
    socket.on("disconnect", () => {
      console.log("Cliente WebSocket desconectado:", socket.id);
    });
  });

test('POST /notification', async () => {
    const res = await request(app).post('/notification').send({
        "numero": "1234567890",
        "mensagem": "Teste de notificação para atendente real",
        "tipo": "atendente_real"
    });
    expect(res.status).toBe(200);
});

test('GET /notification/pending', async () => {
    const res = await request(app).get('/notification/pending');
    expect(res.status).toBe(200);
});

test('PUT /notification', async () => {
    const res = await request(app).put('/notification').send({
        "id": "1234567890",
        "status": "lido"
    });
    expect(res.status).toBe(200);
});

test('DELETE /notification', async () => {
    const res = await request(app).delete('/notification');
    expect(res.status).toBe(200);
});
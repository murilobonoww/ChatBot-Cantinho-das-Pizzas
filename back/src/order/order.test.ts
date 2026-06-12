import request from 'supertest';
import app from '../shared/app';

let id: number;

test('POST /order', async () => {
    const res = await request(app).post('/order').send({
        "tipo": "finalizar_pedido",
        "nome_cliente": "Carlos da Silva",
        "endereco_entrega": "Av. Bariloche, 88-244 - Jardim Maria Helena",
        "taxa_entrega": null,
        "forma_pagamento": "Cartão",
        "status_pedido": "em andamento",
        "latitude": null,
        "longitude": null,
        "houseNumber": 123,
        "street": null,
        "alteracao": 0,
        "delivery": 1,
        "telefone_cliente": "55xxxxxxxxxxx",
        "itens": [
            {
                "produto": "Pizza",
                "sabor": "Calabresa",
                "quantidade": 2,
                "observacao": "35cm"
            }
        ]
    });
    expect(res.status).toBe(201);
    expect(res.body).toBeDefined();
    id = res.body.id;
});

test('GET /order', async () => {
    const res = await request(app).get('/order');
    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
});

test('GET /order/:id/status', async () => {
    const res = await request(app).get(`/order/${id}/status`);
    expect(res.status).toBe(200);
});

test('GET /order/new', async () => {
    const res = await request(app).get(`/order/new`);
    expect(res.status).toBe(200);
});

// pq nao tem rota de pegar um pedido especifico por id?

test('PUT /order/:id', async () => {
    const res = await request(app).put(`/order/${id}`).send({
        status_pedido: 'fechado',
    });
    expect(res.status).toBe(200);
});

test('PUT /order/setPrinted/:id', async () => {
    const res = await request(app).put(`/order/setPrinted/${id}`);
    expect(res.status).toBe(200);
});

test('PUT /order/item/:id', async () => {
    const res = await request(app).put(`/order/item/${id}`).send({
        "produto": "Pizza",
        "sabor": "Calabresa",
        "quantidade": 2,
        "observacao": "35cm"
    });
    expect(res.status).toBe(200);
});

test('GET /order/generate-relatorio', async () => {
    const res = await request(app).get(`/order/generate-relatorio`).set('Authorization', `Bearer ${process.env.SENHA_GERENCIA}`).query({ inicio: '2026-01-01', fim: '2026-01-31' });
    expect(res.status).toBe(200);
});

test('DELETE /order/:id', async () => {
    const res = await request(app).delete(`/order/${id}`);
    expect(res.status).toBe(200);
});
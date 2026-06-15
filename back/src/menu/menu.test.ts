import request from 'supertest';
import app from '../shared/app';

let id: number;

test('GET /menu', async () => {
    const res = await request(app).get('/menu');
    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
})

test('POST /menu', async () => {
    const res = await request(app).post('/menu').send({
        section: 'pizzas',
        nome: 'Pizza de Calabresa',
        ingredientes: 'Calabresa, Cebola, Azeitona',
        preco: 30.00,
        preco_25: 25.00,
        preco_35: 35.00,
        tamanho: '25cm'
    });
    expect(res.status).toBe(201);
    expect(res.body).toBeDefined();
    id = res.body.id;
})

test('PUT /menu/:id', async () => {
    const res = await request(app).put(`/menu/${id}`).send({
        section: 'pizzas',
        nome: 'Pizza de Calabresa',
        ingredientes: 'Calabresa, Cebola, Azeitona',
        preco: 30.00,
        preco_25: 25.00,
        preco_35: 35.00,
        tamanho: '25cm'
    });
    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
})

test('DELETE /menu', async () => {
    const res = await request(app).delete('/menu').send({
        section: 'pizzas',
        ids: [id]
    });
    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
})
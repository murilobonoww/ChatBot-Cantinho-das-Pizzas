import { IItem, IOrder } from "./IOrder";
import * as helper from "./helpers/order.helper";
import db from "../db";
import AppError from "../shared/AppError";

export const sql = {
    insertPedido: "INSERT INTO pedido (nome_cliente, endereco_entrega, taxa_entrega, preco_total, forma_pagamento, status_pedido, alteracao, delivery, telefone_cliente) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    insertItemPedido: "INSERT INTO item_pedido (pedido_id_fk, produto, sabor, quantidade, observacao, preco) VALUES (?, ?, ?, ?, ?, ?)",
    GET_ALL: "SELECT p.id_pedido, p.nome_cliente, p.endereco_entrega, p.taxa_entrega, p.preco_total, p.forma_pagamento, p.status_pedido, p.data_pedido, p.printed, p.alteracao, p.delivery, p.telefone_cliente , i.id AS id_item, i.produto, i.sabor, i.quantidade, i.observacao, i.preco FROM pedido p LEFT JOIN item_pedido i ON p.id_pedido = i.pedido_id_fk",
    GET_ORDER: `SELECT p.id_pedido, p.nome_cliente, p.endereco_entrega, p.taxa_entrega,  p.preco_total, p.forma_pagamento, p.status_pedido, p.data_pedido, p.alteracao,p.telefone_cliente , i.id, i.produto, i.sabor, i.quantidade, i.observacao FROM pedido p LEFT JOIN item_pedido i ON p.id_pedido = i.pedido_id_fk WHERE p.id_pedido = ? `,
    GET_ORDER_STATUS: `SELECT status_pedido FROM pedido where id_pedido = ?`,
    GET_ORDERS_WITH_OPENED_STATUS: `SELECT COUNT(*) AS total FROM pedido WHERE status_pedido = 'aberto'`,
    SET_PRINTED: `UPDATE pedido SET printed = true WHERE id_pedido = ?`,
    UPDATE_ORDER: `UPDATE pedido SET nome_cliente = ?, endereco_entrega = ?, forma_pagamento = ?, status_pedido = ?, taxa_entrega = ?, preco_total = ? WHERE id_pedido = ?`,
    UPDATE_ORDER_ITEM: `UPDATE item_pedido SET produto = ?, sabor = ?, quantidade = ?, observacao = ? WHERE id = ?`,
    UPDATE_ORDER_STATUS: `UPDATE pedido SET status_pedido = ? WHERE id_pedido = ?`,
    DELETE_ITENS_OF_ORDER: `DELETE FROM item_pedido WHERE pedido_id_fk = ?`,
    DELETE_ORDER: `DELETE FROM pedido WHERE id_pedido = ?`,
    GET_TOP_3: 'SELECT ip.sabor, SUM(ip.quantidade) AS total_vendido FROM item_pedido ip JOIN pedido p ON p.id_pedido = ip.pedido_id_fk WHERE ip.produto = ? AND p.data_pedido BETWEEN ? AND ? GROUP BY ip.sabor ORDER BY total_vendido DESC LIMIT 3;',
    GET_MOST_SELLED_PRODUCT: `SELECT produto FROM item_pedido GROUP BY produto ORDER BY COUNT(produto) DESC LIMIT 1;`,
    GET_MOST_SELLED_FLAVOR: `SELECT sabor FROM item_pedido WHERE produto = ? GROUP BY sabor ORDER BY SUM(quantidade) DESC LIMIT 1;`
}

export async function getProductPrice(sabor: string, productConfig: {table:string, column: string, keyColumn: string}) {
    const [rows] = await db.execute(`SELECT ${productConfig.column} FROM ${productConfig.table} WHERE ${productConfig.keyColumn} = ?`, [sabor]);
    if (!rows.length) throw new AppError(`Busca de preço do produto resultou não retornou nenhuma linha`, 404);
    const price = Number(rows[0][productConfig?.column]);
    if (isNaN(price)) throw new AppError(`Preço do produto resultou em um valor inválido`, 400);
    return price;
}

export async function insertOrder(order: IOrder) {
    const [result] = await db.execute(sql.insertPedido, helper.orderValues(order));
    const order_id = result.insertId;
    return order_id;
}

export async function insertItems(order_id: number, items: any[]){
    for (const item of items) {
        await db.execute(sql.insertItemPedido, [
            order_id,
            item.produto,
            item.saborItem,
            item.quantidade,
            item.observacao,
            item.preco
        ]);
    }
}

export async function getProductNames(productConfig: {table:string, column: string, keyColumn: string}) {
    const [rows] = await db.execute(`SELECT ${productConfig.keyColumn} FROM ${productConfig.table}`);
    if (productConfig.keyColumn === 'sabor') return rows.map((row: { sabor: string }) => row.sabor);
    return rows.map((row: { nome: string }) => row.nome);
}
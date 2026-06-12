import { IOrder, IFilters } from "./IOrder";
import * as helper from "./helpers/order.helper";
import * as repo from "./order.repository";
import { sql } from "./order.repository";
import db from "../db";

export async function processOrder(order: IOrder) {
  const orderID = await helper.processOrder(order);
  return orderID;
  // return helper.generateFinalMessage(orderID, order);
}

export async function getAll(filters: IFilters) {
  let { query, params } = helper.applyFilters(filters, sql.GET_ALL);
  query = helper.appendOrderByClause(query);
  const [rows] = await db.query(query, params);
  const orders = helper.structureOrders(rows);
  return orders;
}

export async function deleteOrder(orderID: number) {
  const [rows_itens] = await db.query(sql.DELETE_ITENS_OF_ORDER, orderID)
  const [rows_order] = await db.query(sql.DELETE_ORDER, orderID)
}

export async function getOrderStatus(orderID: number) {
  const [rows] = await db.query(sql.GET_ORDER_STATUS, orderID)
  helper.checkIfNotFound(rows)
  return rows
}

export async function setPrinted(orderID: number) {
  const [rows] = await db.query(sql.SET_PRINTED, [orderID])
}

export async function update(orderID: number, new_order: IOrder) {
  const { nome_cliente, endereco_entrega, forma_pagamento, status_pedido, taxa_entrega, preco_total } = new_order
  const [rows] = await db.query(sql.UPDATE_ORDER, [nome_cliente, endereco_entrega, forma_pagamento, status_pedido, taxa_entrega, preco_total, orderID])
  helper.checkIfNotFound(rows)
}

export async function updateOrderItem(orderID: number, new_order: any) {
  const { novoProdutoNome: produto, novoSabor: sabor, novaQuant: quantidade, novaOBS: obs, } = new_order

  const [rows] = await db.query(sql.UPDATE_ORDER_ITEM, [produto, sabor, quantidade, obs, orderID])
  helper.checkIfNotFound(rows)
}

export async function getOrdersWithOpenedStatus() {
  const [rows] = await db.query(sql.GET_ORDERS_WITH_OPENED_STATUS);
  const temNovos = rows[0].total > 0;
  return temNovos;
}

export async function generateReport(start: string, end: string) {
  let sql_txt = `SELECT p.data_pedido, p.nome_cliente, p.forma_pagamento, p.preco_total FROM pedido p`;

  const valores = [];
  let diasEmFiltro = 0;
  let topPizzas: Record<string, number> = {};
  let topEsfihas: Record<string, number> = {};
  let topBebidas: Record<string, number> = {};

  if (start && end) {
    sql_txt += ` WHERE p.data_pedido BETWEEN ? AND ? `;
    valores.push(start + " 00:00:00", end + " 23:59:59");
    diasEmFiltro = calculateDiff(start, end);
    topPizzas = await getTop3(start, end, 'pizza');
    topEsfihas = await getTop3(start, end, 'esfiha');
    topBebidas = await getTop3(start, end, 'bebida');
  }

  sql_txt += ` ORDER BY p.data_pedido DESC LIMIT 100`;

  const [results] = await db.query(sql_txt, valores);

  let total_vendas = 0;
  let total_pedidos = results.length;
  let pagamentos = { pix: 0, débito: 0, crédito: 0 };

  const pedidosFormatados = results.map((r: any) => {
    total_vendas += parseFloat(r.preco_total);

    const pg = r.forma_pagamento.toLowerCase();

    if (pg.includes("pix")) pagamentos.pix += parseFloat(r.preco_total);
    else if (pg.includes("débito"))
      pagamentos.débito += parseFloat(r.preco_total);
    else pagamentos.crédito += parseFloat(r.preco_total);

    return {
      data: new Date(r.data_pedido).toLocaleDateString("pt-BR"),
      cliente: r.nome_cliente,
      valor: parseFloat(r.preco_total),
      pagamento: r.forma_pagamento,
    };
  });

  const ticket_medio = total_pedidos > 0 ? total_vendas / total_pedidos : 0;
  const [resultProduct] = await db.query(sql.GET_MOST_SELLED_PRODUCT);

  let mais_vendido = resultProduct.length > 0 ? resultProduct[0].produto : null;

  const [resultFlavor] = await db.query(sql.GET_MOST_SELLED_FLAVOR, [mais_vendido]);

  let sabor_mais_vendido = resultFlavor.length > 0 ? resultFlavor[0].sabor : null;

  mais_vendido = String(mais_vendido + " de " + sabor_mais_vendido);

  if (mais_vendido === null || sabor_mais_vendido === null) {
    mais_vendido = "Não há dados suficientes";
  }

  const faturamento_medio = total_vendas / diasEmFiltro;

  return { total_vendas, total_pedidos, ticket_medio, mais_vendido, sabor_mais_vendido, pagamentos, pedidos: pedidosFormatados, faturamento_medio, topPizzas, topEsfihas, topBebidas }
}

function calculateDiff(inicio: string, fim: string) {
  const startDate: Date = new Date(inicio);
  const endDate: Date = new Date(fim);
  const MSDiff: number = endDate.getTime() - startDate.getTime();
  const DaysDiff = (MSDiff / (1000 * 60 * 60 * 24));
  return DaysDiff;
}

export async function getTop3(start: string, end: string, product: string) {
  const sabores: Record<string, number> = {};

  const [results] = await db.query(sql.GET_TOP_3, [product, start + ' 00:00:00', end + ' 23:59:59']);
  for (const row of results) {
    sabores[row.sabor] = row.total_vendido;
  }
  return sabores;
}

// export async function getOrderFromFoody(uid: string) {
//   const response = await helper.getFoodyOrder(uid);
//   const order = helper.structureResponse(response);
//   return order;
// }
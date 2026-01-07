//interns
const db = require("../db");

//helper functions
const { processOrder, generate_final_message, applyFilters, sortOrdersinSQL, sql, structureOrders, ensureResultExists, buildOrderFromRow, checkIfNotFound, getFoodyOrder, structureResponse } = require("./order.helper");

async function submitOrder(order) {
  const orderID = await processOrder(order)
  return generate_final_message(orderID, order)
}

async function getAll(req, res) {
  const filters = req.body
  let { sql, params } = applyFilters(filters, sql.GET_ALL)

  sortOrdersinSQL(sql)
  const [rows] = await db.query(sql, params);

  const orders = structureOrders(rows)
  return orders
}

async function update(orderID) {
  const [rows] = await db.query(sql.GET_ORDER, orderID)
  ensureResultExists(rows)
  buildOrderFromRow(rows)
}

async function deleteOrder(orderID) {
  const [rows_order] = await db.query(sql.DELETE_ORDER, orderID)
  const [rows_itens] = await db.query(sql.DELETE_ITENS_OF_ORDER, orderID)
}

async function getOrderStatus(orderID) {
  const [rows] = await db.query(sql.GET_ORDER_STATUS, orderID)
  checkIfNotFound(rows)
  return rows
}

async function updateStatus(orderID, newStatus) {
  const [rows] = await db.query(sql.UPDATE_ORDER_STATUS, [newStatus, orderID])
  checkIfNotFound(rows)
}

async function setPrinted(orderID) {
  const [rows] = await db.query(sql.SET_PRINTED, [orderID])
}

async function updateOrder(orderID, new_order) {
  const { nome_cliente, endereco_entrega, forma_pagamento, status_pedido, taxa_entrega, preco_total } = new_order
  const [rows] = await db.query(sql.UPDATE_ORDER, [nome_cliente, endereco_entrega, forma_pagamento, status_pedido, taxa_entrega, preco_total, orderID])
  checkIfNotFound(rows)
}

async function updateOrderItem(orderID, new_order) {
  const { novoProdutoNome: produto, novoSabor: sabor, novaQuant: quantidade, novaOBS: obs, } = new_order

  const [rows] = await db.query(sql.UPDATE_ORDER_ITEM, [produto, sabor, quantidade, obs, orderID])
  checkIfNotFound(rows)
}

async function getOrdersWithOpenedStatus() {
  const [rows] = await db.query(sql.GET_ORDERS_WITH_OPENED_STATUS)
  const temNovos = rows[0].total > 0;
  return res.json({ novos: temNovos });
}

async function getOrderFromFoody(uid) {
  const response = await getFoodyOrder(uid)
  const order = structureResponse(response)
  return order
}

function authorize(pass, MANAGEMENT_PASS) {
  if (pass !== MANAGEMENT_PASS) throw new Error ('Senha incorreta')
}

async function generateRelatorio(pass, MANAGEMENT_PASS, start, end) {
  authorize(pass, MANAGEMENT_PASS)

  let sql = `SELECT p.data_pedido, p.nome_cliente, p.forma_pagamento, p.preco_total FROM pedido p`

  const valores = [];

  if (start && end) {
    sql += ` WHERE p.data_pedido BETWEEN ? AND ? `;
    valores.push(start + " 00:00:00", end + " 23:59:59");
  }

  sql += ` ORDER BY p.data_pedido DESC LIMIT 100`;

    const [resultados] = await db.query(sql, valores);

    let total_vendas = 0;
    let total_pedidos = resultados.length;
    let pagamentos = { pix: 0, débito: 0, crédito: 0 };

    const pedidosFormatados = resultados.map((r) => {
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
    let most_selled_product_query = `SELECT produto FROM item_pedido GROUP BY produto ORDER BY COUNT(produto) DESC LIMIT 1;`;
    const [resultProduct] = await db.query(most_selled_product_query);

    let mais_vendido = resultProduct.length > 0 ? resultProduct[0].produto : null;
    let most_selled_flavor_query = `SELECT sabor FROM item_pedido WHERE produto = ? GROUP BY sabor ORDER BY SUM(quantidade) DESC LIMIT 1;`;

    const [resultFlavor] = await db.query(most_selled_flavor_query, [mais_vendido]);

    let sabor_mais_vendido = resultFlavor.length > 0 ? resultFlavor[0].sabor : null;

    mais_vendido = String(mais_vendido + " de " + sabor_mais_vendido);

    if (mais_vendido === null || sabor_mais_vendido === null) {
      mais_vendido = "Não há dados suficientes"
    }

    return { total_vendas, total_pedidos, ticket_medio, mais_vendido, sabor_mais_vendido, pagamentos, pedidos: pedidosFormatados }
}

module.exports = { submitOrder, getAll, update, deleteOrder, getOrderStatus, updateStatus, setPrinted, updateOrder, updateOrderItem, getOrdersWithOpenedStatus, getOrderFromFoody, generateRelatorio }
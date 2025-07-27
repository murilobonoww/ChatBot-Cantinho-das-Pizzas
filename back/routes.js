const express = require("express");
const router = express.Router();
const db = require("./db"); // conexão com MySQL (connection.js)
const { resolvePath } = require("react-router-dom");
const dotenv = require("dotenv");
dotenv.config();
const axios = require("axios");

function formatarEndereco(endereco) {
  if (!endereco || typeof endereco !== "string") return "";
  return endereco
    .trim()
    .replace(/^R\.\s*/i, "") // remove "R." do início
    .replace(/\s*-\s*/g, ", ") // substitui traço por vírgula e espaço
    .replace(/,([^ ])/g, ", $1") // força espaço após vírgulas
    .replace(/\s{2,}/g, " ") // remove espaços duplos
    .replace(/,+/g, ",") // evita vírgulas duplicadas
    .trim();
}

async function enviarParaFoody(pedido, id_pedido, lat, lng) {
  const enderecoFormatado = formatarEndereco(pedido.endereco_entrega);

  const payload = {
    id: String(id_pedido),
    status: "open",
    notes: pedido.observacao || "",
    courierFee: pedido.taxa_entrega || 0,
    orderTotal: pedido.preco_total || 0,
    deliveryPoint: {
      address: enderecoFormatado || "",
      street: "", // gpt irá extrair
      houseNumber: "", // gpt irá extrair
      coordinates: {
        lat: lat || "",
        lng: lng || "",
      },
      city: "Barueri",
      region: "SP",
      country: "BR",
    },
  };

  console.log(payload);

  try {
    const res = await axios.post(
      "https://app.foodydelivery.com/rest/1.2/orders",
      payload,
      {
        headers: {
          "Content-Type": "application/json;charset=UTF-8",
          Authorization: "edab289cff47488bb78c9e2897420ffe",
        },
      }
    );

    console.log(
      `✅ Pedido #${id_pedido} enviado para Foody. Status: ${res.status}`
    );

    // Extrair o uid da resposta da API
    const uid_foody = res.data.uid; // Ajuste conforme a estrutura real da resposta da API

    // Atualizar a tabela pedido com o uid
    const sqlUpdateUid = `UPDATE pedido SET uid_foody = ? WHERE id_pedido = ?`;
    db.query(sqlUpdateUid, [uid_foody, id_pedido], (err) => {
      if (err) {
        console.error(
          `❌ Erro ao atualizar uid_foody do pedido #${id_pedido}:`,
          err
        );
        return;
      }
      console.log(
        `✅ uid_foody ${uid_foody} salvo para o pedido #${id_pedido}`
      );
    });
  } catch (error) {
    console.error(
      `❌ Erro ao enviar pedido #${id_pedido} para Foody:`,
      error?.response?.data || error.message
    );
  }
}

router.post("/pedido/post", (req, res) => {
  const pedido = req.body;

  const {
    nome_cliente,
    endereco_entrega,
    taxa_entrega,
    preco_total,
    forma_pagamento,
    status_pedido,
    itens,
    latitude,
    longitude,
  } = pedido;

  const sqlPedido = `
    INSERT INTO pedido (
      nome_cliente, endereco_entrega, taxa_entrega, preco_total, forma_pagamento, status_pedido
    ) VALUES (?, ?, ?, ?, ?, ?)
  `;

  const valoresPedido = [
    nome_cliente,
    endereco_entrega,
    taxa_entrega,
    preco_total,
    forma_pagamento,
    status_pedido || "aberto",
  ];

  db.query(sqlPedido, valoresPedido, (err, resultado) => {
    if (err) {
      console.error("❌ Erro ao inserir pedido:", err);
      return res.status(500).json({ mensagem: "Erro ao registrar o pedido" });
    }

    const id_pedido = resultado.insertId;

    const sqlItem = `
      INSERT INTO item_pedido (pedido_id_fk, produto, sabor, quantidade, observacao)
      VALUES ?
    `;

    const valoresItens = itens.map((item) => [
      id_pedido,
      item.produto,
      item.sabor,
      item.quantidade,
      item.observacao || "",
    ]);

    db.query(sqlItem, [valoresItens], (err2) => {
      if (err2) {
        console.error("❌ Erro ao inserir itens do pedido:", err2);
        return res
          .status(500)
          .json({ mensagem: "Erro ao registrar os itens do pedido" });
      }

      console.log(
        `📦 Pedido #${id_pedido} registrado com sucesso. (ainda não enviado pra foody)`
      );
      enviarParaFoody(pedido, id_pedido, latitude, longitude); // ← envia para a Foody de forma assíncrona
      res
        .status(200)
        .json({
          mensagem: "✅ Pedido registrado e enviado para a Foody com sucesso!",
          id_pedido,
        });
    });
  });
});

router.get("/pedido/getAll", (req, res) => {
  const { inicio, fim, cliente } = req.query;

  let sql = `
    SELECT 
      p.id_pedido, p.nome_cliente, p.endereco_entrega, p.taxa_entrega, p.preco_total, 
      p.forma_pagamento, p.status_pedido, p.data_pedido,
      i.id AS id_item, i.produto, i.sabor, i.quantidade, i.observacao
    FROM pedido p
    LEFT JOIN item_pedido i ON p.id_pedido = i.pedido_id_fk
  `;

  const conditions = [];
  const params = [];

  if (inicio && fim) {
    conditions.push(`p.data_pedido BETWEEN ? AND ?`);
    params.push(`${inicio} 00:00:00`, `${fim} 23:59:59`);
  }

  if (cliente) {
    conditions.push(`p.nome_cliente LIKE ?`);
    params.push(`%${cliente}%`);
  }

  if (conditions.length > 0) {
    sql += ` WHERE ` + conditions.join(" AND ");
  }

  sql += ` ORDER BY p.id_pedido DESC`;

  db.query(sql, params, (err, resultados) => {
    if (err) {
      console.error("❌ Erro ao buscar pedidos:", err);
      return res.status(500).json({ mensagem: "Erro ao buscar pedidos" });
    }

    const pedidosMap = {};

    resultados.forEach((row) => {
      const id = row.id_pedido;
      if (!pedidosMap[id]) {
        pedidosMap[id] = {
          id_pedido: id,
          nome_cliente: row.nome_cliente,
          endereco_entrega: row.endereco_entrega,
          taxa_entrega: row.taxa_entrega,
          preco_total: row.preco_total,
          forma_pagamento: row.forma_pagamento,
          status_pedido: row.status_pedido,
          data_pedido: row.data_pedido,
          itens: [],
        };
      }

      if (row.id_item !== null) {
        pedidosMap[id].itens.push({
          id_item: row.id_item,
          produto: row.produto,
          sabor: row.sabor,
          quantidade: row.quantidade,
          observacao: row.observacao,
        });
      }
    });

    const pedidos = Object.values(pedidosMap);
    res.status(200).json(pedidos);
  });
});

router.get("/pedido/:id", (req, res) => {
  const idPedido = req.params.id;

  const sql = `
    SELECT
      p.id_pedido, p.nome_cliente, p.endereco_entrega, p.taxa_entrega, 
      p.preco_total, p.forma_pagamento, p.status_pedido, p.data_pedido,
      i.id, i.produto, i.sabor, i.quantidade, i.observacao
    FROM pedido p
    LEFT JOIN item_pedido i ON p.id_pedido = i.pedido_id_fk
    WHERE p.id_pedido = ?
  `;

  db.query(sql, [idPedido], (err, resultados) => {
    if (err) {
      console.error("❌ Erro ao buscar pedido:", err);
      return res.status(500).json({ mensagem: "Erro ao buscar pedido" });
    }

    if (resultados.length === 0) {
      return res.status(404).json({ mensagem: "Pedido não encontrado" });
    }

    const pedido = {
      id_pedido: resultados[0].id_pedido,
      nome_cliente: resultados[0].nome_cliente,
      endereco_entrega: resultados[0].endereco_entrega,
      taxa_entrega: resultados[0].taxa_entrega,
      preco_total: resultados[0].preco_total,
      forma_pagamento: resultados[0].forma_pagamento,
      status_pedido: resultados[0].status_pedido,
      data_pedido: resultados[0].data_pedido,
      itens: [],
    };

    resultados.forEach((row) => {
      if (row.id_item !== null) {
        pedido.itens.push({
          id_item: row.id_item,
          produto: row.produto,
          sabor: row.sabor,
          quantidade: row.quantidade,
          observacao: row.observacao,
        });
      }
    });

    res.status(200).json(pedido);
  });
});

router.delete("/pedido/:id", (req, res) => {
  const idPedido = req.params.id;

  // Primeiro, exclui os itens vinculados ao pedido
  const sqlDeleteItens = `DELETE FROM item_pedido WHERE pedido_id_fk = ?`;

  db.query(sqlDeleteItens, [idPedido], (err1) => {
    if (err1) {
      console.error("❌ Erro ao deletar itens do pedido:", err1);
      return res
        .status(500)
        .json({ mensagem: "Erro ao deletar itens do pedido" });
    }

    // Depois, exclui o próprio pedido
    const sqlDeletePedido = `DELETE FROM pedido WHERE id_pedido = ?`;

    db.query(sqlDeletePedido, [idPedido], (err2, resultado) => {
      if (err2) {
        console.error("❌ Erro ao deletar pedido:", err2);
        return res.status(500).json({ mensagem: "Erro ao deletar pedido" });
      }

      if (resultado.affectedRows === 0) {
        return res.status(404).json({ mensagem: "Pedido não encontrado" });
      }

      console.log(`🗑️ Pedido #${idPedido} e seus itens foram deletados.`);
      res
        .status(200)
        .json({ mensagem: `✅ Pedido #${idPedido} deletado com sucesso.` });
    });
  });
});

router.put("/pedido/:id/status", (req, res) => {
  const id = req.params.id;
  const { novoStatus } = req.body;

  const sql = `UPDATE pedido SET status_pedido = ? WHERE id_pedido = ?`;

  db.query(sql, [novoStatus, id], (err, resultado) => {
    if (err) {
      console.error("❌ Erro ao atualizar status do pedido:", err);
      return res
        .status(500)
        .json({ mensagem: "Erro ao atualizar status do pedido" });
    }

    if (resultado.affectedRows === 0) {
      return res.status(404).json({ mensagem: "Pedido não encontrado" });
    }

    console.log(`✅ Status do pedido #${id} atualizado para '${novoStatus}'`);
    res.status(200).json({ mensagem: "Status atualizado com sucesso!" });
  });
});

router.get("/relatorios/financeiro", (req, res) => {
  const token = req.headers["authorization"];
  const SENHA_GERENCIA = process.env.SENHA_GERENCIA;

  if (token !== `Bearer ${SENHA_GERENCIA}`) {
    return res.status(403).json({ mensagem: "Acesso negado: senha incorreta" });
  }
  const { inicio, fim } = req.query;

  let sql = `
    SELECT 
      p.data_pedido,
      p.nome_cliente,
      p.forma_pagamento,
      p.preco_total,
      e.nome AS entregador
    FROM pedido p
    LEFT JOIN entregador e ON p.id_pedido = e.pedido_id_fk
  `;

  const valores = [];

  if (inicio && fim) {
    sql += ` WHERE p.data_pedido BETWEEN ? AND ? `;
    valores.push(inicio + " 00:00:00", fim + " 23:59:59");
  }

  sql += ` ORDER BY p.data_pedido DESC LIMIT 100`;

  db.query(sql, valores, (err, resultados) => {
    if (err) {
      console.error("❌ Erro ao buscar dados financeiros:", err);
      return res
        .status(500)
        .json({ mensagem: "Erro ao buscar relatório financeiro" });
    }

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
        entregador: r.entregador || "-",
      };
    });

    const ticket_medio = total_pedidos > 0 ? total_vendas / total_pedidos : 0;

    res.status(200).json({
      total_vendas,
      total_pedidos,
      ticket_medio,
      mais_vendido: "-",
      pagamentos,
      pedidos: pedidosFormatados,
    });
  });
});

router.put("/pedido/:id", (req, res) => {
  const id = req.params.id;
  const {
    nome_cliente,
    endereco_entrega,
    forma_pagamento,
    status_pedido,
    taxa_entrega,
    preco_total,
  } = req.body;

  const sql = `
    UPDATE pedido
    SET nome_cliente = ?, endereco_entrega = ?, forma_pagamento = ?, status_pedido = ?, taxa_entrega = ?, preco_total = ?
    WHERE id_pedido = ?
  `;

  db.query(
    sql,
    [
      nome_cliente,
      endereco_entrega,
      forma_pagamento,
      status_pedido,
      taxa_entrega,
      preco_total,
      id,
    ],
    (err, resultado) => {
      if (err) {
        console.error("❌ Erro ao atualizar pedido:", err);
        return res.status(500).json({ mensagem: "Erro ao atualizar pedido" });
      }

      if (resultado.affectedRows === 0) {
        return res.status(404).json({ mensagem: "Pedido não encontrado" });
      }

      console.log(`✅ Pedido #${id} atualizado com sucesso`);
      res.status(200).json({ mensagem: "Pedido atualizado com sucesso!" });
    }
  );
});

const mysqlPromise = require("mysql2/promise");

router.get("/cardapio", async (req, res) => {
  try {
    const tempConnection = await mysqlPromise.createConnection({
      host: process.env.HOST,
      user: process.env.USER,
      password: process.env.PASS,
      database: process.env.DB,
      port: process.env.DB_PORT || 3306,
    });

    const [pizzas] = await tempConnection.query("SELECT * FROM pizzas");
    const [esfihas] = await tempConnection.query("SELECT * FROM esfihas");
    const [bebidas] = await tempConnection.query("SELECT * FROM bebidas");
    const [doces] = await tempConnection.query("SELECT * FROM doces");

    await tempConnection.end();

    res.json({ pizzas, esfihas, bebidas, doces });
  } catch (err) {
    console.error("Erro ao buscar cardápio:", err);
    res.status(500).json({ erro: "Erro ao buscar cardápio" });
  }
});

router.get("/pedidos/new", (req, res) => {
  const sql = `SELECT COUNT(*) AS total FROM pedido WHERE status_pedido = 'aberto'`;

  db.query(sql, (err, resultados) => {
    if (err) {
      console.error("❌ Erro ao verificar pedidos novos:", err);
      return res.status(500).json({ erro: "Erro ao verificar pedidos novos" });
    }

    const temNovos = resultados[0].total > 0;
    res.json({ novos: temNovos });
  });
});




router.get("/pedido/foody/:uid", async (req, res) => {
  const { uid } = req.params;

  try {
    const response = await axios.get(
      `https://app.foodydelivery.com/rest/1.2/orders/${uid}`,
      {
        headers: {
          "Content-Type": "application/json;charset=UTF-8",
          Authorization: "edab289cff47488bb78c9e2897420ffe",
        },
      }
    );

    const pedidoFoody = response.data;

    // Estruturar a resposta com base no payload da Foody
    const resposta = {
      uid: pedidoFoody.uid,
      id: pedidoFoody.id,
      status: pedidoFoody.status,
      deliveryFee: pedidoFoody.deliveryFee,
      paymentMethod: pedidoFoody.paymentMethod,
      notes: pedidoFoody.notes,
      courierFee: pedidoFoody.courierFee,
      orderTotal: pedidoFoody.orderTotal,
      orderDetails: pedidoFoody.orderDetails,
      orderTrackerUrl: pedidoFoody.orderTrackerUrl,
      despatchMode: pedidoFoody.despatchMode,
      deliveryPoint: {
        address: pedidoFoody.deliveryPoint?.address,
        street: pedidoFoody.deliveryPoint?.street,
        houseNumber: pedidoFoody.deliveryPoint?.houseNumber,
        postalCode: pedidoFoody.deliveryPoint?.postalCode,
        coordinates: {
          lat: pedidoFoody.deliveryPoint?.coordinates?.lat,
          lng: pedidoFoody.deliveryPoint?.coordinates?.lng,
        },
        city: pedidoFoody.deliveryPoint?.city,
        region: pedidoFoody.deliveryPoint?.region,
        country: pedidoFoody.deliveryPoint?.country,
        complement: pedidoFoody.deliveryPoint?.complement,
      },
      collectionPoint: {
        name: pedidoFoody.collectionPoint?.name,
        address: pedidoFoody.collectionPoint?.address,
        postalCode: pedidoFoody.collectionPoint?.postalCode,
        coordinates: {
          lat: pedidoFoody.collectionPoint?.coordinates?.lat,
          lng: pedidoFoody.collectionPoint?.coordinates?.lng,
        },
        city: pedidoFoody.collectionPoint?.city,
        region: pedidoFoody.collectionPoint?.region,
        country: pedidoFoody.collectionPoint?.country,
      },
      customer: {
        customerPhone: pedidoFoody.customer?.customerPhone,
        customerName: pedidoFoody.customer?.customerName,
        customerEmail: pedidoFoody.customer?.customerEmail,
      },
      courier: {
        courierPhone: pedidoFoody.courier?.courierPhone,
        courierName: pedidoFoody.courier?.courierName,
        courierType: pedidoFoody.courier?.courierType,
      },
      date: pedidoFoody.date,
      readyDate: pedidoFoody.readyDate,
      despatchDate: pedidoFoody.despatchDate,
      collectedDate: pedidoFoody.collectedDate,
      deliveryDate: pedidoFoody.deliveryDate,
      creationDate: pedidoFoody.creationDate,
      updateDate: pedidoFoody.updateDate,
    };

    res.status(200).json(resposta);
  } catch (error) {
    console.error(`❌ Erro ao buscar pedido #${uid} na Foody:`, error?.response?.data || error.message);
    res.status(500).json({ mensagem: "Erro ao buscar pedido na Foody Delivery" });
  }
});

module.exports = router;


module.exports = router;

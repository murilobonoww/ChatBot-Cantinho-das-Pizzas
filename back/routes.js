const express = require("express");
const router = express.Router();
const db = require("./db");
const dotenv = require("dotenv");
dotenv.config();
const axios = require("axios");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const rateLimit = require("express-rate-limit");

const MAPS_API_KEY = process.env.MAPS_API_KEY;
const CODE_HASH = process.env.COMPANY_CODE_HASH;
const SECRET_KEY = process.env.JWT_SECRET;

router.get("/keep-server-on", (req, res) => {
  return res.sendStatus(200)
})

router.post("/check-auth", autenticar, (req, res) => {
  return res.status(200).json({ logged: true })
})

router.post("/logout", (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      maxAge: 4 * 60 * 60 * 1000,
      path: "/",
    });
    return res.status(200).json({ message: "Logout bem suscedido" });
  } catch (error) {
    console.log(`Erro no logout: ${error}`);
    res.status(500).json({ error: "Erro interno ao limpar cookie" });
  }
});

// impede ataques de força bruta, botando limite de tentativas pra inserir a senha
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: "Muitas tentativas. Tente novamente mais tarde." },
});

function autenticar(req, res, next) {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ error: "Token ausente" });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: "Token inválido ou expirado." });
  }
}

router.post("/login", limiter, async (req, res) => {
  const { code } = req.body;

  if (!code) return res.status(400).json({ error: "código obrigatório" });

  const ok = await bcrypt.compare(code, CODE_HASH);

  if (!ok) return res.status(401).json({ error: "código incorreto" });

  const token = jwt.sign({ acesso: "allowed" }, SECRET_KEY, {
    expiresIn: "10h",
  });

  res.cookie("token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 4 * 60 * 60 * 1000,
    path: "/",
  });

  res.json({ ok: true });
});

router.post("/confirmAuthPass/:pass", (req, res) => {
  const pass = req.params.pass;
  const gerenciaPass = process.env.SENHA_GERENCIA;
  if (pass === gerenciaPass) {
    res.status(200).json({ message: "autorizado" });
  } else {
    res.status(401).json({ error: "senha incorreta" });
  }
});

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

const get_id_pedido = async () => {
  const query = `SELECT MAX(id_pedido) AS ultimo_id FROM pedido;`

  const [rows] = await db.query(query);
  const ultimoId = rows[0].ultimo_id;

  if (!rows || rows.length === 0) {
    throw new Error("Consulta ao banco falhou.");
  }

  if (isNaN(ultimoId)) {
    throw new Error("Erro ao gerar id para pedido.")
  }
  return ultimoId
}

// Calcula a distância em KM entre o endereço fixo e o destino
async function calcularDistanciaKm(enderecoDestino) {

  const controller = new AbortController();
  setTimeout(() => controller.abort(), 15000);
  const origem = "R. Copacabana, 111 - Jardim Maria Helena, Barueri - SP, 06445-060";
  const url = "https://routes.googleapis.com/directions/v2:computeRoutes";

  const body = {
    origin: { address: origem },
    destination: { address: enderecoDestino },
    travelMode: "DRIVE"
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": MAPS_API_KEY,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters"
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    const data = await response.json();
    console.log("🛰 API Google Maps:", response.status, JSON.stringify(data));

    const route = data?.routes?.[0];
    if (!route?.distanceMeters) {
      console.log("❌ 'distanceMeters' ausente na resposta.");
      return null;
    }

    return route.distanceMeters / 1000;
  } catch (err) {
    console.log("❌ Erro ao calcular distância:", err);
    return null;
  }
}

// Calcula a taxa de entrega baseada na distância
function calcularTaxaEntrega(km) {

  const distancia = km

  if (distancia == null) return null;

  if (distancia < 1) return 4.00;
  if (distancia < 3) return parseFloat((distancia * 3).toFixed(2));

  return parseFloat((distancia * 2).toFixed(2));
}

// ✅ verificar endereço e distancia com a api do google maps
// ✅ calcular taxa de entrega
// ✅ registrar pedido no banco de dados
// enviar mensagem final

// router.get("/finalizar-pedido", async (req, res) => {
//   console.log("🔵 1 - rota entrou");
//   const ok = "olá cliente, seu pedido foi finalizado com sucesso"
//   return res.status(200).send("olá cliente, seu pedido foi finalizado com sucesso");
// });

router.post("/finalizar-pedido", async (req, res) => {
  try {
    console.log(req.body)
    console.log("executando finalizar-pedido")
    const pedido = req.body;
    const endereco = pedido.endereco_entrega

    const distancia = await calcularDistanciaKm(endereco)

    if (distancia == null) {
      return res.status(500).json({ error: `Não foi possível calcular a distância : ${JSON.stringify(req.body, null, 2)}`, });
    }

    if (distancia > 15) {
      return res.status(500).json({ error: "Fora do raio de atendimento." })
    }

    const taxa = calcularTaxaEntrega(distancia)

    pedido.taxa_entrega = taxa
    const pedido_id = await inserir_pedido_no_db(pedido)

    return res.send(gerar_msg_final(pedido_id, pedido))

  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
});

function gerar_msg_final(id_pedido, pedido) {
  const msg_final = `🍕 Pedido *${id_pedido}*\n${pedido.itens}`
  return msg_final

  // let produtos = ``

  // for (const item of pedido.itens) {

  //   if (item.produto === 'pizza' || item.produto === 'esfiha') {
  //     let item = `${item.quantidade} x ${item.produto} de ${item.sabor} - R$${item.preco} (${item.observacao}) \n`
  //   }
  //   else {
  //     let item = `${item.quantidade} x ${item.produto} - R$${item.preco} \n`
  //   }

  //   produtos = produtos + item
  // }

  // const title = `🍕 Pedido ${id_pedido}`

  // let msg = `${title}\n${produtos}\n${pedido.endereco}\n${pedido.taxa}`
}

//retorna o SQL de inserir_pedido_no_db
function query_pedido() {
  return `INSERT INTO pedido (nome_cliente, endereco_entrega, taxa_entrega, preco_total, forma_pagamento, status_pedido, data_pedido, alteracao) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
}

//retorna o SQL de inserir_pedido_no_db
function query_item_pedido() {
  return `INSERT INTO item_pedido (pedido_id_fk, produto, sabor, quantidade, observacao, preco) VALUES (?, ?, ?, ?, ?, ?)`;
}

//retorna valores do SQL de inserir_pedido_no_db
function valores_pedido(p) {
  return [
    p.nome_cliente,
    p.endereco_entrega,
    p.taxa_entrega,
    p.preco_total,
    p.forma_pagamento,
    p.status_pedido || "aberto",
    p.data_pedido,
    p.alteracao
  ];
}

//retorna valores do SQL **DOS ITENS DO PEDIDO** de inserir_pedido_no_db
function valores_item_pedido(i, pedido_id) {
  return [
    pedido_id,
    i.produto,
    i.sabor,
    i.quantidade,
    i.observacao,
    i.preco
  ];
}

async function inserir_pedido_no_db(pedido) {

  try {
    const [resultadoPedido] = await db.execute(query_pedido(), valores_pedido(pedido));
    const pedido_id = resultadoPedido.insertId;

    if (Array.isArray(pedido.itens) && pedido.itens.length > 0) {
      for (const item of pedido.itens) {

        const [resultadoItem] = await db.execute(query_item_pedido(), valores_item_pedido(item, pedido_id));
      }
    }

    console.log(
      `📦 Pedido #${pedido_id} registrado com sucesso. (ainda não enviado pra foody)`
    );
    const { latitude, longitude } = pedido;

    enviarParaFoody(pedido, pedido_id, latitude, longitude); // ← envia para a Foody de forma assíncrona
    return pedido_id

  } catch (error) {
    console.error("Erro ao inserir pedido no database: ", error)
    throw error;
  }
}

router.get("/pedido/getAll", autenticar, async (req, res) => {

  try {
    const { id, inicio, fim, cliente } = req.query;

    let sql = `SELECT p.id_pedido, p.nome_cliente, p.endereco_entrega, p.taxa_entrega, p.preco_total, p.forma_pagamento, p.status_pedido, p.data_pedido, p.printed, p.alteracao, i.id AS id_item, i.produto, i.sabor, i.quantidade, i.observacao, i.preco FROM pedido p LEFT JOIN item_pedido i ON p.id_pedido = i.pedido_id_fk`;

    const conditions = [];
    const params = [];

    if (id) {
      conditions.push(`p.id_pedido = ?`);
      console.log(id);
      params.push(id);
    }

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

    const [resultados] = await db.query(sql, params);

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
          printed: row.printed,
          itens: [],
          alteracao: row.alteracao,
        };
      }

      if (row.id_item !== null) {
        pedidosMap[id].itens.push({
          id_item: row.id_item,
          produto: row.produto,
          sabor: row.sabor,
          quantidade: row.quantidade,
          observacao: row.observacao,
          preco: row.preco,
        });
      }
    });

    const pedidos = Object.values(pedidosMap);
    res.status(200).json(pedidos);

  } catch (error) {
    console.error(err);
    res.status(500).json({ mensagem: "Erro ao buscar pedidos" });
  }

});

router.get("/pedido/:id", async (req, res) => {
  try {
    const idPedido = req.params.id;

    const sql = `SELECT p.id_pedido, p.nome_cliente, p.endereco_entrega, p.taxa_entrega,  p.preco_total, p.forma_pagamento, p.status_pedido, p.data_pedido, p.alteracao, i.id, i.produto, i.sabor, i.quantidade, i.observacao FROM pedido p LEFT JOIN item_pedido i ON p.id_pedido = i.pedido_id_fk WHERE p.id_pedido = ? `;

    const [resultados] = await db.query(sql, [idPedido]);

    if (!resultados.length) {
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
      printed: resultados[0].printed,
      itens: [],
      alteracao: resultados[0].alteracao
    };

    resultados.forEach((row) => {
      if (row.id_item !== null) {
        pedido.itens.push({
          id_item: row.id_item,
          produto: row.produto,
          sabor: row.sabor,
          quantidade: row.quantidade,
          observacao: row.observacao,
          printed: row.printed,
        });
      }
    });

    res.status(200).json(pedido);

  } catch (error) {
    console.error(error);
    res.status(500).json({ mensagem: "Erro ao buscar pedido" });
  }
});

router.delete("/pedido/:id", async (req, res) => {
  const idPedido = req.params.id;

  const sqlDeleteItens = `DELETE FROM item_pedido WHERE pedido_id_fk = ?`;
  const sqlDeletePedido = `DELETE FROM pedido WHERE id_pedido = ?`;

  try {
    const [resultado_itens] = await db.query(sqlDeleteItens, [idPedido]);
    const [resultado_pedido] = await db.query(sqlDeletePedido, [idPedido]);

    if (resultado_pedido.affectedRows === 0) {
      return res.status(404).json({ mensagem: "Pedido não encontrado" });
    }
    else if (resultado_itens.affectedRows === 0) {
      return res.status(404).json({ mensagem: "Pedido não encontrado" });
    }

    console.log(`🗑️ Pedido #${idPedido} e seus itens foram deletados.`);
    return res.status(200).json({ mensagem: `✅ Pedido #${idPedido} deletado com sucesso.` });
  } catch (error) {
    console.error("❌ Erro ao deletar itens do pedido:", error);
    return res.status(500).json({ mensagem: "Erro ao deletar itens do pedido ou o pedido em si." });
  }
  });

router.get("/pedido/:id/status", async (req, res) => {
  const id = req.params.id;

  const sql = `SELECT status_pedido FROM pedido where id_pedido = ${id}`;

  try {
    const [resultado] = await db.query(sql);
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ mensagem: "Pedido não encontrado" })
    }
    return res.status(200).json({ "status": resultado })

  } catch (error) {
    console.error("Erro ao pegar status de pedido: ", error)
    return res.status(500).json({ mensagem: "Erro ao pegar status de pedido" })
  }
})

router.put("/pedido/:id/status", async (req, res) => {
  const id = req.params.id;
  const { novoStatus } = req.body;

  const sql = `UPDATE pedido SET status_pedido = ? WHERE id_pedido = ?`;

  try {
    const [resultado] = await db.query(sql, [novoStatus, id])

    if (resultado.affectedRows === 0) {
      return res.status(404).json({ mensagem: "Pedido não encontrado" });
    }
    console.log(`✅ Status do pedido #${id} atualizado para '${novoStatus}'`);
    res.status(200).json({ mensagem: "Status atualizado com sucesso!" });

  } catch (error) {
    console.error("❌ Erro ao atualizar status do pedido:", error);
    return res.status(500).json({ mensagem: "Erro ao atualizar status do pedido" });
  }
});

router.get("/relatorios/financeiro", async (req, res) => {
  const token = req.headers["authorization"];
  const SENHA_GERENCIA = process.env.SENHA_GERENCIA;

  if (token !== `Bearer ${SENHA_GERENCIA}`) {
    return res.status(403).json({ mensagem: "Acesso negado: senha incorreta" });
  }
  const { inicio, fim } = req.query;

  let sql = `SELECT p.data_pedido, p.nome_cliente, p.forma_pagamento, p.preco_total FROM pedido p`;

  const valores = [];

  if (inicio && fim) {
    sql += ` WHERE p.data_pedido BETWEEN ? AND ? `;
    valores.push(inicio + " 00:00:00", fim + " 23:59:59");
  }

  sql += ` ORDER BY p.data_pedido DESC LIMIT 100`;

  try {
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

    res.status(200).json({ total_vendas, total_pedidos, ticket_medio, mais_vendido, sabor_mais_vendido, pagamentos, pedidos: pedidosFormatados });

  } catch (error) {
    console.error("❌ Erro ao gerar relatório financeiro: ", error);
    return res.status(500).json({ mensagem: "Erro ao gerar relatório financeiro" });
  }
});


router.put("/pedido/setPrinted/:id", async (req, res) => {
  const id = req.params.id;
  const sql = `UPDATE pedido SET printed = true WHERE id_pedido = ?`;
  try {
    const [resultado] = await db.query(sql, [id]);
    return res.status(200).json({ mensagem: "Printed setted to true" });

  } catch (error) {
    return res.status(200).json({ mensagem: "Erro ao modificar printed" });
  }
});

router.put("/item-pedido/:id", async (req, res) => {
  const id = req.params.id;
  console.log(req);

  const {
    novoProdutoNome: produto,
    novoSabor: sabor,
    novaQuant: quantidade,
    novaOBS: obs,
  } = req.body;

  const sql = `UPDATE item_pedido SET produto = ?, sabor = ?, quantidade = ?, observacao = ? WHERE id = ?`;

  try {
    const [resultado] = await db.execute(sql, [produto, sabor, quantidade, obs, id]);
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ mensagem: "Pedido não encontrado" });
    }
    return res.status(200).json({ mensagem: "Pedido alterado com sucesso!" });

  } catch (error) {
    console.error(err);
    return res.status(500).json({ mensagem: "Erro ao atualizar pedido." });
  }
});

router.put("/pedido/:id", async (req, res) => {
  const id = req.params.id;
  console.log(req.body);
  const {
    nome_cliente,
    endereco_entrega,
    forma_pagamento,
    status_pedido,
    taxa_entrega,
    preco_total,
  } = req.body;

  const sql = `UPDATE pedido SET nome_cliente = ?, endereco_entrega = ?, forma_pagamento = ?, status_pedido = ?, taxa_entrega = ?, preco_total = ? WHERE id_pedido = ?`;

  try {
    const [resultado] = await db.execute(sql, [nome_cliente, endereco_entrega, forma_pagamento, status_pedido, taxa_entrega, preco_total, id,]);

    if (resultado.affectedRows === 0) {
      return res.status(404).json({ mensagem: "Pedido não encontrado" });
    }
    console.log(`✅ Pedido #${id} atualizado com sucesso`);
    res.status(200).json({ mensagem: "Pedido atualizado com sucesso!" });
  } catch (error) {
    console.error("❌ Erro ao atualizar pedido:", err);
    res.status(500).json({ mensagem: "Erro ao atualizar pedido" });
  }
});

router.get("/pedidos/new", async (req, res) => {
  try {
    const sql = `SELECT COUNT(*) AS total FROM pedido WHERE status_pedido = 'aberto'`;
    const [resultados] = await db.query(sql);

    const temNovos = resultados[0].total > 0;
    return res.json({ novos: temNovos });

  } catch (error) {
    console.error("❌ Erro ao verificar pedidos novos:", err);
    return res.status(500).json({ erro: "Erro ao verificar pedidos novos" });
  }
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

    return res.status(200).json(resposta);

  } catch (error) {
    console.error(`❌ Erro ao buscar pedido #${uid} na Foody:`, error?.response?.data || error.message);
    return res.status(500).json({ mensagem: "Erro ao buscar pedido na Foody Delivery" });
  }
});

router.get("/cardapio", async (req, res) => {
  try {
    const [pizzas] = await db.query("SELECT * FROM pizzas");
    const [esfihas] = await db.query("SELECT * FROM esfihas");
    const [bebidas] = await db.query("SELECT * FROM bebidas");
    const [doces] = await db.query("SELECT * FROM doces");
    const [outros] = await db.query("SELECT * FROM outros");

    res.json({ pizzas, esfihas, bebidas, doces, outros });
  } catch (err) {
    console.error("Erro ao buscar cardápio:", err);
    res.status(500).json({ erro: "Erro ao buscar cardápio" });
  }
});

router.post("/cardapio", async (req, res) => {
  const { section, nome, ingredientes, preco, preco_25, preco_35, tamanho } = req.body;

  const validSections = ["pizzas", "esfihas", "bebidas", "doces", "outros"];
  if (!validSections.includes(section)) {
    return res.status(400).json({ mensagem: "Seção inválida" });
  }

  if (!nome) {
    return res.status(400).json({ mensagem: "Nome ou sabor é obrigatório" });
  }
  if (section === "pizzas" && (!ingredientes || !preco_25 || !preco_35)) {
    return res.status(400).json({ mensagem: "Ingredientes, preço 25cm e preço 35cm são obrigatórios" });
  }
  if ((section === "esfihas" || section === "doces" || section === "outros") && !preco) {
    return res.status(400).json({ mensagem: "Preço é obrigatório" });
  }
  if (section === "bebidas" && (!tamanho || !preco)) {
    return res.status(400).json({ mensagem: "Tamanho e preço são obrigatórios para bebidas" });
  }

  try {
    let sql;
    let values;

    switch (section) {
      case "pizzas":
        sql = `INSERT INTO pizzas (sabor, ingredientes, preco_25, preco_35) VALUES (?, ?, ?, ?)`;
        values = [nome, ingredientes, preco_25, preco_35];
        break;
      case "esfihas":
        sql = `INSERT INTO esfihas (sabor, preco) VALUES (?, ?)`;
        values = [nome, preco];
        break;
      case "bebidas":
        sql = `INSERT INTO bebidas (nome, tamanho, preco) VALUES (?, ?, ?)`;
        values = [nome, tamanho, preco];
        break;
      case "doces":
        sql = `INSERT INTO doces (nome, preco) VALUES (?, ?)`;
        values = [nome, preco];
        break;
      case "outros":
        sql = `INSERT INTO outros (nome, preco) VALUES (?, ?)`;
        values = [nome, preco];
        break;
    }

    await db.query(sql, values);
    return res.status(201).json({ mensagem: `Item adicionado com sucesso à seção ${section}` });

  } catch (err) {
    console.error(`❌ Erro ao adicionar item na seção ${section}:`, err);
    res.status(500).json({ mensagem: "Erro ao adicionar item ao cardápio" });
  }
});

router.put("/cardapio/:id", async (req, res) => {
  const { id } = req.params;
  const { section, nome, ingredientes, preco, preco_25, preco_35, tamanho } =
    req.body;

  const validSections = ["pizzas", "esfihas", "bebidas", "doces", "outros"];
  if (!validSections.includes(section)) {
    return res.status(400).json({ mensagem: "Seção inválida" });
  }

  if (!nome) {
    return res.status(400).json({ mensagem: "Nome ou sabor é obrigatório" });
  }
  if (section === "pizzas" && (!ingredientes || !preco_25 || !preco_35)) {
    return res.status(400).json({
      mensagem: "Ingredientes, preço 25cm e preço 35cm são obrigatórios",
    });
  }
  if ((section === "esfihas" || section === "doces" || section === "outros") && !preco) {
    return res.status(400).json({ mensagem: "Preço é obrigatório" });
  }
  if (section === "bebidas" && (!tamanho || !preco)) {
    return res
      .status(400)
      .json({ mensagem: "Tamanho e preço são obrigatórios para bebidas" });
  }

  try {
    let sql;
    let values;

    switch (section) {
      case "pizzas":
        sql = `UPDATE pizzas SET sabor = ?, ingredientes = ?, preco_25 = ?, preco_35 = ? WHERE id = ?`;
        values = [nome, ingredientes, preco_25, preco_35, id];
        break;
      case "esfihas":
        sql = `UPDATE esfihas SET sabor = ?, preco = ? WHERE id = ?`;
        values = [nome, preco, id];
        break;
      case "bebidas":
        sql = `UPDATE bebidas SET nome = ?, tamanho = ?, preco = ? WHERE id = ?`;
        values = [nome, tamanho, preco, id];
        break;
      case "doces":
        sql = `UPDATE doces SET nome = ?, preco = ? WHERE id = ?`;
        values = [nome, preco, id];
        break;
      case "outros":
        sql = `UPDATE outros SET nome = ?, preco = ? WHERE id = ?`;
        values = [nome, preco, id];
        break;
    }

    const [result] = await db.query(sql, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ mensagem: "Item não encontrado" });
    }

    console.log(`✅ Item #${id} atualizado com sucesso na seção ${section}`);
    return res.status(200).json({ mensagem: `Item atualizado com sucesso na seção ${section}` });

  } catch (err) {
    console.error(`❌ Erro ao atualizar item #${id} na seção ${section}:`, err);
    res.status(500).json({ mensagem: "Erro ao atualizar item no cardápio" });
  }
});

router.delete("/cardapio", async (req, res) => {
  const { section, ids } = req.body;

  const validSections = ["pizzas", "esfihas", "bebidas", "doces", "outros"];
  if (
    !validSections.includes(section) || !Array.isArray(ids) || ids.length === 0
  ) {
    return res.status(400).json({ mensagem: "Seção inválida ou lista de IDs vazia" });
  }

  try {
    // Sanitizar IDs para números inteiros
    const sanitizedIds = ids.map((id) => parseInt(id)).filter((id) => !isNaN(id));
    if (sanitizedIds.length === 0) {
      return res.status(400).json({ mensagem: "Nenhum ID válido fornecido" });
    }

    const sql = `DELETE FROM ${section} WHERE id IN (?)`;
    const [result] = await db.query(sql, [sanitizedIds]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ mensagem: "Nenhum item encontrado para exclusão" });
    }

    console.log(
      `✅ ${result.affectedRows} item(s) deletado(s) da seção ${section}`
    );
    return res.status(200).json({ mensagem: `Item(s) deletado(s) com sucesso da seção ${section}` });

  } catch (err) {
    console.error(`❌ Erro ao deletar itens da seção ${section}:`, err);
    return res.status(500).json({ mensagem: err.message || "Erro ao deletar itens do cardápio" });
  }
});

module.exports = router;
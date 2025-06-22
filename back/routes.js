const express = require('express');
const router = express.Router();
const db = require('./db'); // conexão com MySQL (connection.js)
const { resolvePath } = require('react-router-dom');

router.post('/pedido/post', (req, res) => {
  const pedido = req.body;

  const {
    nome_cliente,
    endereco_entrega,
    taxa_entrega,
    preco_total,
    forma_pagamento,
    status_pedido,
    itens
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
    status_pedido || 'pendente'
  ];

  db.query(sqlPedido, valoresPedido, (err, resultado) => {
    if (err) {
      console.error('❌ Erro ao inserir pedido:', err);
      return res.status(500).json({ mensagem: 'Erro ao registrar o pedido' });
    }

    const id_pedido = resultado.insertId;

    const sqlItem = `
      INSERT INTO item_pedido (pedido_id_fk, produto, sabor, quantidade, observacao)
      VALUES ?
    `;

    const valoresItens = itens.map(item => [
      id_pedido,
      item.produto,
      item.sabor,
      item.quantidade,
      item.observacao || ''
    ]);

    db.query(sqlItem, [valoresItens], (err2) => {
      if (err2) {
        console.error('❌ Erro ao inserir itens do pedido:', err2);
        return res.status(500).json({ mensagem: 'Erro ao registrar os itens do pedido' });
      }

      console.log(`📦 Pedido #${id_pedido} registrado com sucesso.`);
      res.status(200).json({ mensagem: "✅ Pedido registrado com sucesso!", id_pedido });
    });
  });
});


router.get('/pedido/getAll', (req, res) => {
  const sql = `
    SELECT 
      p.id_pedido, p.nome_cliente, p.endereco_entrega, p.taxa_entrega, p.preco_total, p.forma_pagamento, p.status_pedido,
      i.id, i.produto, i.sabor, i.quantidade, i.observacao
    FROM pedido p
    LEFT JOIN item_pedido i ON p.id_pedido = i.pedido_id_fk
    ORDER BY p.id_pedido DESC
  `;

    db.query(sql, (err, resultados) => {
    if (err) {
      console.error('❌ Erro ao buscar pedidos:', err);
      return res.status(500).json({ mensagem: 'Erro ao buscar pedidos' });
    }

    console.log(resultados); // 👈 Veja se os itens realmente aparecem

    const pedidosMap = {};

    resultados.forEach(row => {
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
          itens: []
        };
      }

      // Só adiciona item se realmente vier um ID de item (evita campos nulos no LEFT JOIN)
      if (row.id_item !== null) {
        pedidosMap[id].itens.push({
          id_item: row.id_item,
          produto: row.produto,
          sabor: row.sabor,
          quantidade: row.quantidade,
          observacao: row.observacao
        });
      }
    });

    const pedidos = Object.values(pedidosMap);
    res.status(200).json(pedidos);
  });

});


router.get('/pedido/:id', (req, res) => {
  const idPedido = req.params.id;

  const sql = `
    SELECT 
      p.id_pedido, p.nome_cliente, p.endereco_entrega, p.taxa_entrega, 
      p.preco_total, p.forma_pagamento, p.status_pedido,
      i.id, i.produto, i.sabor, i.quantidade, i.observacao
    FROM pedido p
    LEFT JOIN item_pedido i ON p.id_pedido = i.pedido_id_fk
    WHERE p.id_pedido = ?
  `;

  db.query(sql, [idPedido], (err, resultados) => {
    if (err) {
      console.error('❌ Erro ao buscar pedido:', err);
      return res.status(500).json({ mensagem: 'Erro ao buscar pedido' });
    }

    if (resultados.length === 0) {
      return res.status(404).json({ mensagem: 'Pedido não encontrado' });
    }

    const pedido = {
      id_pedido: resultados[0].id_pedido,
      nome_cliente: resultados[0].nome_cliente,
      endereco_entrega: resultados[0].endereco_entrega,
      taxa_entrega: resultados[0].taxa_entrega,
      preco_total: resultados[0].preco_total,
      forma_pagamento: resultados[0].forma_pagamento,
      status_pedido: resultados[0].status_pedido,
      itens: []
    };

    resultados.forEach(row => {
      if (row.id_item !== null) {
        pedido.itens.push({
          id_item: row.id_item,
          produto: row.produto,
          sabor: row.sabor,
          quantidade: row.quantidade,
          observacao: row.observacao
        });
      }
    });

    res.status(200).json(pedido);
  });
});


router.delete('/pedido/:id', (req, res) => {
  const idPedido = req.params.id;

  // Primeiro, exclui os itens vinculados ao pedido
  const sqlDeleteItens = `DELETE FROM item_pedido WHERE pedido_id_fk = ?`;

  db.query(sqlDeleteItens, [idPedido], (err1) => {
    if (err1) {
      console.error('❌ Erro ao deletar itens do pedido:', err1);
      return res.status(500).json({ mensagem: 'Erro ao deletar itens do pedido' });
    }

    // Depois, exclui o próprio pedido
    const sqlDeletePedido = `DELETE FROM pedido WHERE id_pedido = ?`;

    db.query(sqlDeletePedido, [idPedido], (err2, resultado) => {
      if (err2) {
        console.error('❌ Erro ao deletar pedido:', err2);
        return res.status(500).json({ mensagem: 'Erro ao deletar pedido' });
      }

      if (resultado.affectedRows === 0) {
        return res.status(404).json({ mensagem: 'Pedido não encontrado' });
      }

      console.log(`🗑️ Pedido #${idPedido} e seus itens foram deletados.`);
      res.status(200).json({ mensagem: `✅ Pedido #${idPedido} deletado com sucesso.` });
    });
  });
});

router.put('/pedido/:id/status', (req, res) => {
  const id = req.params.id;
  const { novoStatus } = req.body;

  const sql = `UPDATE pedido SET status_pedido = ? WHERE id_pedido = ?`;

  db.query(sql, [novoStatus, id], (err, resultado) => {
    if (err) {
      console.error("❌ Erro ao atualizar status do pedido:", err);
      return res.status(500).json({ mensagem: "Erro ao atualizar status do pedido" });
    }

    if (resultado.affectedRows === 0) {
      return res.status(404).json({ mensagem: "Pedido não encontrado" });
    }

    console.log(`✅ Status do pedido #${id} atualizado para '${novoStatus}'`);
    res.status(200).json({ mensagem: "Status atualizado com sucesso!" });
  });
});







module.exports = router;

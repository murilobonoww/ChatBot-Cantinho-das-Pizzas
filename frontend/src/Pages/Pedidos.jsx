import React, { useEffect, useState } from "react";
import "../Style/Pedidos.css";
import relatorios_img from "../assets/relatorios.png";
import pedido_img from "../assets/pedido.png";
import entregadores_img from "../assets/entregadores.png";
import { Link } from "react-router-dom";

const Pedidos = () => {
  const [pedidos, setPedidos] = useState([]);
  const [abertos, setAbertos] = useState({});

  useEffect(() => {
    fetch("http://localhost:3000/pedido/getAll")
      .then(res => res.json())
      .then(data => setPedidos(data))
      .catch(err => console.error("Erro ao buscar pedidos:", err));
  }, []);

  const togglePedido = (id) => {
    setAbertos(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const alternarStatus = (id) => {
  const estados = ["pendente", "andamento", "concluído"];
  const pedido = pedidos.find(p => p.id_pedido === id);
  const atual = pedido.status_pedido;
  const proximo = estados[(estados.indexOf(atual) + 1) % estados.length];

  fetch(`http://localhost:3000/pedido/${id}/status`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ novoStatus: proximo }),
  })
    .then(res => {
      if (!res.ok) throw new Error("Erro ao atualizar status");
      setPedidos(prev =>
        prev.map(p =>
          p.id_pedido === id ? { ...p, status_pedido: proximo } : p
        )
      );
    })
    .catch(err => console.error("Erro ao alterar status:", err));
};


  return (
    <div className="page-pedidos">
      <div className="sidebar">
        <ul>
          <li><img id="icon" src={entregadores_img} /></li>
          <li><Link to={"/pedidos"}><img id="icon" src={pedido_img} /></Link></li>
          <li><img id="icon" src={relatorios_img} /></li>
        </ul>
      </div>

      <div className="pedidos">
        <h1>Histórico de pedidos</h1>

        {pedidos.map((pedido) => (
          <div key={pedido.id_pedido} className={`pedido-card ${abertos[pedido.id_pedido] ? "aberto" : "fechado"}`}>
            <div className="pedido-header">
              <h2 onClick={() => togglePedido(pedido.id_pedido)}>
                Pedido #{pedido.id_pedido} {abertos[pedido.id_pedido] ? "🔼" : "🔽"}
              </h2>

              <button
                className={`status-botao ${pedido.status_pedido.replace(" ", "-")}`}
                onClick={() => alternarStatus(pedido.id_pedido)}
              >
                {pedido.status_pedido}
              </button>
            </div>

            {abertos[pedido.id_pedido] && (
              <div className="pedido-detalhes">
                <p><strong>Cliente:</strong> {pedido.nome_cliente}</p>
                <p><strong>Endereço:</strong> {pedido.endereco_entrega}</p>
                <p><strong>Pagamento:</strong> {pedido.forma_pagamento}</p>
                <p><strong>Status:</strong> {pedido.status_pedido}</p>
                <p><strong>Taxa de Entrega:</strong> R$ {parseFloat(pedido.taxa_entrega).toFixed(2)}</p>
                <p><strong>Total:</strong> R$ {parseFloat(pedido.preco_total).toFixed(2)}</p>

                <div className="pedido-itens">
                  <h3>Itens:</h3>
                  {pedido.itens.map((item, index) => (
                    <div key={index} className="pedido-item">
                      <p><strong>Produto:</strong> {item.produto}</p>
                      <p><strong>Sabor:</strong> {item.sabor}</p>
                      <p><strong>Quantidade:</strong> {item.quantidade}</p>
                      {item.observacao && <p className="pedido-observacao"><strong>Obs.:</strong> {item.observacao}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Pedidos;

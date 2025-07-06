import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import relatorios_img from "../assets/relatorios.png";
import pedido_img from "../assets/pedido.png";
import entregadores_img from "../assets/entregadores.png";
import "../Style/Relatorios.css";
import { PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

const Relatorios = () => {
  const [relatorio, setRelatorio] = useState({});
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");

  const pagamentosData = [
    { name: "Pix", value: relatorio.pagamentos?.pix || 0 },
    { name: "Dinheiro", value: relatorio.pagamentos?.dinheiro || 0 },
    { name: "Cartão", value: relatorio.pagamentos?.cartao || 0 },
  ];

  const COLORS = ["#00C49F", "#FFBB28", "#FF8042"];


  const buscarRelatorio = (i = inicio, f = fim) => {
    const params = new URLSearchParams();
    if (i && f) {
      params.append("inicio", i);
      params.append("fim", f);
    }

    fetch(`http://localhost:3000/relatorios/financeiro?${params.toString()}`)
      .then(res => res.json())
      .then(data => setRelatorio(data))
      .catch(err => console.error("Erro ao buscar relatórios:", err));
  };

  useEffect(() => {
    buscarRelatorio(); // carrega tudo inicialmente
  }, []);

  const aplicarFiltroRapido = (dias) => {
    const hoje = new Date();
    const dataFim = hoje.toISOString().slice(0, 10);
    const dataInicio = new Date(hoje.setDate(hoje.getDate() - dias))
      .toISOString()
      .slice(0, 10);

    setInicio(dataInicio);
    setFim(dataFim);
    buscarRelatorio(dataInicio, dataFim);
  };

  return (
    <div className="page-relatorios">
      <div className="sidebar">
        <ul>
          <li><Link to="/entregadores"><img id="icon" src={entregadores_img} /></Link></li>
          <li><Link to="/pedidos"><img id="icon" src={pedido_img} /></Link></li>
          <li><Link to="/relatorios"><img id="icon" src={relatorios_img} /></Link></li>
        </ul>
      </div>

      <div className="relatorios">
        <h1>Relatórios</h1>

        {/* Filtros de Data */}
        <div className="filtros-data">
          <label>Início: <input type="date" value={inicio} onChange={e => setInicio(e.target.value)} /></label>
          <label>Fim: <input type="date" value={fim} onChange={e => setFim(e.target.value)} /></label>
          <button onClick={() => buscarRelatorio()}>Buscar</button>
        </div>

        {/* Filtros rápidos */}
        <div className="filtros-rapidos">
          <p>Filtros rápidos:</p>
          <button onClick={() => aplicarFiltroRapido(0)}>Hoje</button>
          <button onClick={() => aplicarFiltroRapido(7)}>Últimos 7 dias</button>
          <button onClick={() => aplicarFiltroRapido(15)}>Últimos 15 dias</button>
          <button onClick={() => aplicarFiltroRapido(30)}>Últimos 30 dias</button>
          <button onClick={() => aplicarFiltroRapido(90)}>Últimos 3 meses</button>
          <button onClick={() => aplicarFiltroRapido(365)}>Últimos 12 meses</button>
        </div>

        {/* Resumos */}
        <div className="resumos">
          <div className="card">Total em vendas: <strong>R$ {relatorio.total_vendas?.toFixed(2) || "0,00"}</strong></div>
          <div className="card">Pedidos no período: <strong>{relatorio.total_pedidos || 0}</strong></div>
          <div className="card">Ticket médio: <strong>R$ {relatorio.ticket_medio?.toFixed(2) || "0,00"}</strong></div>
          <div className="card">Mais vendido: <strong>{relatorio.mais_vendido || "-"}</strong></div>
        </div>

        <h2>Vendas por forma de pagamento</h2>
          <PieChart width={400} height={350}>
            <Pie
              data={pagamentosData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              fill="#8884d8"
              label={({ percent, value }) => `${(percent * 100).toFixed(0)}% (${value.toFixed(2)})`}
            >
              {pagamentosData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>

        {/* Tabela de Pedidos */}
        <h2>Últimos pedidos</h2>
        <table className="tabela-pedidos">
          <thead>
            <tr>
              <th>Data</th>
              <th>Cliente</th>
              <th>Valor</th>
              <th>Pagamento</th>
              <th>Entregador</th>
            </tr>
          </thead>
          <tbody>
            {(relatorio.pedidos || []).map((p, i) => (
              <tr key={i}>
                <td>{p.data}</td>
                <td>{p.cliente}</td>
                <td>R$ {p.valor.toFixed(2)}</td>
                <td id="table_pagamento">{p.pagamento}</td>
                <td>{p.entregador}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Relatorios;

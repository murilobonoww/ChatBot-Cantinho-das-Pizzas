import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import "../Style/Relatorios.css";
import { PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import voltar from "../assets/voltar.png";
import toast from "react-hot-toast";
import { Toaster } from "react-hot-toast";

export default function Relatorios() {
  const [relatorio, setRelatorio] = useState({});
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [senha, setSenha] = useState("");
  const [autorizado, setAutorizado] = useState(false);
  const [filtroSelecionado, setFiltroSelecionado] = useState(null);

  useEffect(() => {
    if (autorizado && relatorio.total_vendas === undefined) {
      aplicarFiltroRapido(7); // ou 0, 15, 30 etc.
    }
  }, [autorizado]);

  const pagamentosData = [
    { name: "Pix", value: relatorio.pagamentos?.pix || 0 },
    { name: "Dinheiro", value: relatorio.pagamentos?.dinheiro || 0 },
    { name: "Cartão", value: relatorio.pagamentos?.cartao || 0 },
  ];

  const COLORS = ["#2E2E2E", "#009247", "#8303d2"];

  const buscarRelatorio = (i = inicio, f = fim) => {
    const params = new URLSearchParams();
    if (i && f) {
      params.append("inicio", i);
      params.append("fim", f);
    }

    fetch(`http://localhost:3000/relatorios/financeiro?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${senha}`
      }
    })
      .then(async res => {
        if (!res.ok) {
          setAutorizado(false);
          setSenha("");
          toast.error("Senha incorreta");
          return;
        }
        const data = await res.json();
        setRelatorio(data);
        setAutorizado(true);
      })
      .catch(err => {
        console.error("Erro ao buscar relatórios:", err);
      });
  };

  const aplicarFiltroRapido = (dias) => {
    if (filtroSelecionado === dias) {
      setFiltroSelecionado(null);
      setInicio("");
      setFim("");
      buscarRelatorio("", ""); // busca sem filtro
    } else {
      const hoje = new Date();
      const dataFim = hoje.toISOString().slice(0, 10);
      const dataInicio = new Date(hoje.setDate(hoje.getDate() - dias))
        .toISOString()
        .slice(0, 10);

      setInicio(dataInicio);
      setFim(dataFim);
      setFiltroSelecionado(dias);
      buscarRelatorio(dataInicio, dataFim);
    }
  };

  const buscaManual = () => {
    setFiltroSelecionado(null);
    buscarRelatorio();
  };

  return (
    <div className="page-relatorios">
      <Toaster />

      <div className="header-relatorios">
        <Link to="/" className="btn-fechar">
          <img id="voltar_icone" src={voltar} alt="Voltar" />
        </Link>
        <h1 id="title_relatorios1">Relatórios</h1>
      </div>

      <div className="relatorios">
        {!autorizado && (
          <div className="centralizar_gerencia">
            <div className="senha-gerencia">
              <p>Digite a senha da gerência:</p>
              <div className="input_senha_gerencia">
                <input
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && buscarRelatorio()}
                  placeholder="Senha"
                />
                <button onClick={() => buscarRelatorio()}>Acessar Relatórios</button>
              </div>
            </div>
          </div>
        )}

        {autorizado && (
          <>
            <div className="filtros-data">
              <label>Início: <input id="inputs_inicio_e_fim_relatorios" type="date" value={inicio} onChange={e => setInicio(e.target.value)} /></label>
              <label>Fim: <input id="inputs_inicio_e_fim_relatorios" type="date" value={fim} onChange={e => setFim(e.target.value)} /></label>
              <button onClick={() => buscaManual()}> Buscar</button>
            </div>

            <div className="filtros-rapidos">
              <p>Filtros rápidos:</p>
              <button className={filtroSelecionado === 0 ? "filtro-ativo" : ""} onClick={() => aplicarFiltroRapido(0)}>Hoje</button>
              <button className={filtroSelecionado === 7 ? "filtro-ativo" : ""} onClick={() => aplicarFiltroRapido(7)}>Últimos 7 dias</button>
              <button className={filtroSelecionado === 15 ? "filtro-ativo" : ""} onClick={() => aplicarFiltroRapido(15)}>Últimos 15 dias</button>
              <button className={filtroSelecionado === 30 ? "filtro-ativo" : ""} onClick={() => aplicarFiltroRapido(30)}>Últimos 30 dias</button>
              <button className={filtroSelecionado === 90 ? "filtro-ativo" : ""} onClick={() => aplicarFiltroRapido(90)}>Últimos 3 meses</button>
              <button className={filtroSelecionado === 365 ? "filtro-ativo" : ""} onClick={() => aplicarFiltroRapido(365)}>Últimos 12 meses</button>
            </div>

            <div className="resumos">
              <div className="card">Total em vendas: <strong>R$ {relatorio.total_vendas?.toFixed(2) || "0,00"}</strong></div>
              <div className="card">Pedidos no período: <strong>{relatorio.total_pedidos || 0}</strong></div>
              <div className="card">Ticket médio: <strong>R$ {relatorio.ticket_medio?.toFixed(2) || "0,00"}</strong></div>
              <div className="card">Mais vendido: <strong>{relatorio.mais_vendido || "-"}</strong></div>
            </div>

            <h2>Vendas por forma de pagamento</h2>
            <PieChart width={440} height={350}>
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
          </>
        )}
      </div>
    </div>
  );
}

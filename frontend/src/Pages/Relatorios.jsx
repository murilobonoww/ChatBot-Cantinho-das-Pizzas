import React, { useState, useEffect, useRef } from "react";
import { data, Link } from "react-router-dom";
import "@/Style/Relatorios.css";
import { PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import axios from "axios";
import bell_sound from "/assets/bell.mp3"
import { Toaster } from "react-hot-toast";
import { toast } from "react-toastify";

import { PiggyBank, ShoppingBasket, Lock, Award, CreditCard } from 'lucide-react';

export default function Relatorios() {
  const [relatorio, setRelatorio] = useState({});
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [senha, setSenha] = useState("");
  const [autorizado, setAutorizado] = useState(false);
  const [filtroSelecionado, setFiltroSelecionado] = useState(null);
  const carregamentoInicial = useRef(true);
  const last_time_data = useRef([]);
  const [toggle_customized_period_window, setToggle_customized_period_window] = useState(false);
  const senhaInputRef = useRef(null);

  const playSound = () => {
    const audio = new Audio(bell_sound)
    audio.volume = 0.7
    audio.play()
  }

  useEffect(() => {
    const fetchPedidos = async () => {
      try {
        const res = await axios.get('https://back-cantinho-das-pizzas.onrender.com/order/getAll', { withCredentials: true })
        const data = res.data
        if (res.status === 401) navigate('/login')
        if (carregamentoInicial.current === true) {
          console.log("carregamento inicial")
          carregamentoInicial.current = false
        }
        else {
          console.log("carregamento nao inicial", last_time_data, data)
          if (data.length > last_time_data.current.length) {
            playSound()
            toast.info("Novo pedido!",
              {
                className: "custom-info-toast",
                progressClassName: "custom-info-progress"
              }
            )
          }
        }
        last_time_data.current = data
      } catch (error) {
        console.log("algo deu errado no fetchpedidos :( ", error)
      }
    }

    fetchPedidos()
    const interval = setInterval(fetchPedidos, 5000);
    return () => clearInterval(interval);
  }, [])

  useEffect(() => {
    if (autorizado && relatorio.total_vendas === undefined) {
      aplicarFiltroRapido(7);
      console.log(filtroSelecionado)
    }
    senhaInputRef.current?.focus();
  }, [autorizado]);

  const pagamentosData = [
    { name: "Pix", value: relatorio.pagamentos?.pix || 0 },
    { name: "Débito", value: relatorio.pagamentos?.débito || 0 },
    { name: "Crédito", value: relatorio.pagamentos?.crédito || 0 },
  ];

  const COLORS = ["#2dd69c", "#34b2fe", "#895ce1"];

  const buscarRelatorio = (start, end) => {
    const params = new URLSearchParams();
    params.append("inicio", start);
    params.append("fim", end);

    fetch(`https://back-cantinho-das-pizzas.onrender.com/order/generate-relatorio?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${senha}`
      },
      credentials: "include"
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
    if (dias !== 999) {
      const today = new Date();
      const end = today.toISOString().slice(0, 10);
      const start = new Date(today.setDate(today.getDate() - dias)).toISOString().slice(0, 10);

      setInicio(start);
      setFim(end);
      setFiltroSelecionado(dias);
      buscarRelatorio(start, end);
    }
    else {
      const today = new Date();
      const end = today.toISOString().slice(0, 10);
      const start = new Date("2000-01-01").toISOString().slice(0, 10)

      setInicio(start);
      setFim(end);
      setFiltroSelecionado(dias);
      buscarRelatorio(start, end);
    }
  };

  const buscaManual = () => {
    setFiltroSelecionado(null);
    buscarRelatorio();
  };

  return (
    <div className="page-relatorios">
      <Toaster />

      <div className="relatorios">
        {!autorizado && (
          <div>
            <div className="header-relatorios-input">
              <Lock size={150} strokeWidth={3} id="lock_icon_dashboard" />
            </div>
            <div className="centralizar_gerencia">
              <h1 id="title_locked_dashboard">Digite a senha da gerência</h1>
              <div className="senha-gerencia">
                <div className="input_senha_gerencia">
                  <input
                    type="password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && buscarRelatorio()}
                    placeholder="Senha"
                    ref={senhaInputRef}
                  />
                  <button onClick={() => buscarRelatorio()}>Acessar dashboard</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {autorizado && (
          <div className="relatorios_panel">
            <div className="header-relatorios">
              <h1 id="title_relatorios1">Dashboard</h1>
            </div>
            <div className="relatorios-container">

              <div className="coluna-esquerda">
                <div className="filtros-rapidos">
                  <button className={filtroSelecionado === 0 ? "filtro-ativo" : ""} onClick={() => aplicarFiltroRapido(0)}>Hoje</button>
                  <button className={filtroSelecionado === 7 ? "filtro-ativo" : ""} onClick={() => aplicarFiltroRapido(7)}>Esta semana</button>
                  <button className={filtroSelecionado === 15 ? "filtro-ativo" : ""} onClick={() => aplicarFiltroRapido(15)}>Últimos 15 dias</button>
                  <button className={filtroSelecionado === 30 ? "filtro-ativo" : ""} onClick={() => aplicarFiltroRapido(30)}>Este mês</button>
                  <button className={filtroSelecionado === 90 ? "filtro-ativo" : ""} onClick={() => aplicarFiltroRapido(90)}>Últimos 3 meses</button>
                  <button className={filtroSelecionado === 365 ? "filtro-ativo" : ""} onClick={() => aplicarFiltroRapido(365)}>Este ano</button>
                  <button className={filtroSelecionado === 999 ? "filtro-ativo" : ""} onClick={() => aplicarFiltroRapido(999)}>Tudo</button>
                  <button onClick={() => setToggle_customized_period_window(!toggle_customized_period_window)} style={{ background: "#ff7043", color: "white", padding: "10px" }}>Customizar período</button>
                </div>

{/* <div className="filter"></div> */}
                  <div class="filtros-data" style={{ opacity: toggle_customized_period_window === true ? "100" : "0", pointerEvents: toggle_customized_period_window === true ? "auto" : "none", position: "fixed", zIndex: "3000", top: "50%", left: "50%", transform: "translate(-50%, -80%)", display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <h1 style={{ marginBottom: "10px" }}>Customizar período</h1>
                    <div style={{ display: "flex", gap: "20px", marginTop: "10px", alignItems: "center",  }}>
                    <label>
                      De
                      <input type="date" onChange={(e) => setInicio(e.target.value)} class="inputs-relatorios" />
                    </label>

                    <label>
                      Até
                      <input type="date" max={new Date().toISOString().split("T")[0]} onChange={(e) => setFim(e.target.value)} class="inputs-relatorios" />
                    </label>
                    <button id="buscar_btn" onClick={() => buscarRelatorio(inicio, fim)}>Buscar</button>
                    </div>
                  </div>

                <div className="resumos">
                  <div className="card">
                    <PiggyBank size={45} style={{ padding: "5", backgroundColor: "#895ce1", color: "white", borderRadius: "50%", transform: "scaleX(-1)", strokeWidth: "1", marginRight: "10" }} />
                    <div style={{ display: "flex", flexDirection: "column", textAlign: "start" }}>
                      <span style={{ color: "gray" }}>Faturamento:</span> <strong>   <span style={{ fontSize: "20px", color: "#525252" }} >R$ {relatorio.total_vendas?.toFixed(2).replace(".", ",") || "0,00"}</span> </strong>
                    </div>
                  </div>

                  <div className="card">
                    <ShoppingBasket size={45} style={{ padding: "5", backgroundColor: "#2dd69c", color: "white", borderRadius: "50%", transform: "scaleX(-1)", strokeWidth: "1", marginRight: "10" }} />
                    <div style={{ display: "flex", flexDirection: "column", textAlign: "start" }}>
                      <span style={{ color: "gray" }}>Qtd pedidos:</span> <strong>   <span style={{ fontSize: "20px", color: "#525252" }} >{relatorio.total_pedidos || "0"}</span> </strong>
                    </div>
                  </div>

                  <div className="card">
                    <CreditCard size={45} style={{ padding: "5", backgroundColor: "#34b2fe", color: "white", borderRadius: "50%", transform: "scaleX(-1)", strokeWidth: "1", marginRight: "10" }} />
                    <div style={{ display: "flex", flexDirection: "column", textAlign: "start" }}>
                      <span style={{ color: "gray" }}>Ticket médio:</span> <strong>   <span style={{ fontSize: "20px", color: "#525252" }} >R$ {relatorio.ticket_medio?.toFixed(2).replace(".", ",") || "0,00"}</span> </strong>
                    </div>
                  </div>

                  <div className="card">
                    <Award size={45} style={{ padding: "5", backgroundColor: "#ffaa7b", color: "white", borderRadius: "50%", transform: "scaleX(-1)", strokeWidth: "1", marginRight: "10" }} />
                    <div style={{ display: "flex", flexDirection: "column", textAlign: "start" }}>
                      <span style={{ color: "gray" }}>Mais vendido:</span> <strong>   <span style={{ fontSize: "20px", color: "#525252" }} >{relatorio.mais_vendido || "-"}</span> </strong>
                    </div>
                  </div>
                </div>

                {relatorio.total_vendas > 0 ? (
                  <div className="piechart">
                    <PieChart width={500} height={250}>
                      <Pie
                        data={pagamentosData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        label={({ percent, value }) => `${(percent * 100).toFixed(0)}% (R$${value.toFixed(2).replace(".", ",")})`}
                      >
                        {pagamentosData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </div>
                ) : (
                  <p className="txt_relatorios_not_found">Não encontramos vendas neste período</p>
                )}
              </div>

              {relatorio.total_vendas > 0 && (<div className="coluna-direita">
                <h2>Últimos pedidos</h2>
                <div className="tabela-container">
                  <table className="tabela-pedidos">
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Cliente</th>
                        <th>Valor</th>
                        <th>Pagamento</th>
                        {/* <th>Entregador</th> */}
                      </tr>
                    </thead>
                    <tbody>
                      {(relatorio.pedidos || []).map((p, i) => (
                        <tr key={i}>
                          <td>{p.data}</td>
                          <td>{p.cliente}</td>
                          <td>R$ {p.valor.toFixed(2).replace(".", ",")}</td>
                          <td id="table_pagamento">{p.pagamento}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>)}

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
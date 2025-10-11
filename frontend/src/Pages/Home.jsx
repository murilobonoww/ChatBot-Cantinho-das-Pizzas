import React, { useState, useEffect, useRef } from "react";
import "../Style/Home.css";
import relatorios from "/assets/statistics.webp";
import historico from "/assets/historico.webp";
import menu from "/assets/menu.webp";
import config from "/assets/control.webp";
import entregadores from "/assets/entregador.webp";
import { data, Link } from "react-router-dom";
import entregas_icon2 from "/assets/entregas.webp";
import notificacao_icone from "/assets/notification_icon.webp";
import bug_report from "/assets/bug-report.webp"
import bell_sound from "/assets/bell.mp3"
import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import Appp from "../App"

const cards = [
  { icon: <img id="menu_img" src={historico} />, title: "Pedidos", to: "/pedidos" },
  { icon: <img id="menu_img" src={entregas_icon2} />, title: "Entregas", external: true, to: "https://app.foodydelivery.com/u/0/home" },
  { icon: <img id="menu_img_entregadores" src={entregadores} />, title: "Entregadores", external: true, to: "https://app.foodydelivery.com/u/0/couriers" },
  { icon: <img id="menu_img" src={relatorios} />, title: "Faturamento", to: "/relatorios" },
  { icon: <img id="menu_img" src={menu} />, title: "Menu", to: "/cardapio" },
  { icon: <img id="menu_img" src={bug_report} />, title: "Reportar bug", to: "https://wa.me/5548992254888" }
];

export default function Home({ enviarListaDeNovosIDs }) {
  const [temPedidoNovo, setTemPedidoNovo] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [notificacoes, setNotificacoes] = useState([]);
  const [temNotificacoesNaoLidas, setTemNotificacoesNaoLidas] = useState(false);
  const socketRef = useRef(null);
  const reconnectIntervalRef = useRef(null);
  const processedEventsRef = useRef(new Set());
  const pedidosAnteriores = useRef([]);
  const carregamentoInicial = useRef(true);
  const [toggle_badge, setToggle_badge] = useState(false);
  const [ids_novos_pedidos, setIds_novos_pedidos] = useState([]);


  const playSound = () => {
    const audio = new Audio(bell_sound);
    audio.volume = 0.7;
    audio.play();
  }

  useEffect(() => {
    const fetchPedidos = async () => {
      console.log("Executando fetchPedidos!")
      try {
        const res = await axios.get('http://localhost:3000/pedido/getAll')
        const pedidos_atualizados = res.data

        if (carregamentoInicial.current === true) {
          carregamentoInicial.current = false
        }
        else {
          if (pedidos_atualizados.length > pedidosAnteriores.current.length) {
            playSound()
            toast.info("Novo pedido!", {
              className: "custom-info-toast",
              progressClassName: "custom-info-progress"
            })
            setToggle_badge(true)
          }
        }

        pedidosAnteriores.current = pedidos_atualizados

      } catch (error) {
        console.log(error)
      }
    }
    fetchPedidos()

    const intervalFetch = setInterval(fetchPedidos, 5000)
    return () => clearInterval(intervalFetch)
  }, [])





  // Function to format timestamp to HH:mm
  const formatarHora = (timestamp) => {
    try {
      const data = new Date(timestamp);
      if (isNaN(data.getTime())) {
        console.error("Timestamp inválido:", timestamp);
        return "Horário inválido";
      }
      const horas = String(data.getHours()).padStart(2, "0");
      const minutos = String(data.getMinutes()).padStart(2, "0");
      return `${horas}:${minutos}`;
    } catch (error) {
      console.error("Erro ao formatar timestamp:", error, "Timestamp:", timestamp);
      return "Horário inválido";
    }
  };

  // Load initial notifications
  useEffect(() => {
    async function carregarNotificacoesIniciais() {
      try {
        const response = await axios.get("http://localhost:5000/notificacoes/ativas");
        setNotificacoes(response.data);
        setTemNotificacoesNaoLidas(response.data.some((n) => n.status === "pendente"));
      } catch (error) {
        console.error("Erro ao carregar notificações iniciais:", error);
        toast.error("Erro ao carregar notificações iniciais", {
          toastId: `initial-load-error-${Date.now()}`,
        });
      }
    }
    carregarNotificacoesIniciais();
  }, []);

  // WebSocket setup
  useEffect(() => {
    const connectWebSocket = () => {
      if (socketRef.current) {
        console.log("🔌 Fechando conexão WebSocket existente");
        socketRef.current.close();
        socketRef.current = null;
      }

      socketRef.current = new WebSocket("ws://localhost:5000/ws");

      socketRef.current.onopen = () => {
        console.log("🔗 Conectado ao servidor WebSocket");
        if (reconnectIntervalRef.current) {
          clearInterval(reconnectIntervalRef.current);
          reconnectIntervalRef.current = null;
        }
      };

      socketRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("📥 Mensagem WebSocket recebida:", data);

          const eventKey = `${data.event}-${data.data?.id_notificacao || Date.now()}`;
          if (processedEventsRef.current.has(eventKey)) {
            console.log("⚠️ Evento duplicado ignorado:", eventKey);
            return;
          }
          processedEventsRef.current.add(eventKey);

          if (data.event === "notificacao_nova") {
            const toastId = `notificacao_nova-${data.data.id_notificacao}`;
            if (!toast.isActive(toastId)) { // Fixed: Removed .current
              toast.info(
                `Cliente ${data.data.numero_cliente} solicitou um atendente real`,
                { autoClose: 5000, toastId }
              );
              console.log("🍞 Toast disparado:", toastId);
            }
            setNotificacoes((prev) => {
              if (prev.some((n) => n.id_notificacao === data.data.id_notificacao)) {
                console.log("⚠️ Notificação duplicada ignorada:", data.data.id_notificacao);
                return prev;
              }
              console.log("📋 Adicionando nova notificação:", data.data);
              return [...prev, data.data];
            });
            setTemNotificacoesNaoLidas(true);
          }

          if (data.event === "notificacao_atualizada") {
            const toastId = `notificacao_atualizada-${data.data.id_notificacao}`;
            if (!toast.isActive(toastId)) { // Fixed: Removed .current
              toast.success(
                `Notificação marcada como ${data.data.status}`,
                { autoClose: 4000, toastId }
              );
              console.log("🍞 Toast disparado:", toastId);
            }
            setNotificacoes((prev) => {
              const updatedNotificacoes = prev.map((notif) =>
                notif.id_notificacao === data.data.id_notificacao
                  ? { ...notif, status: data.data.status }
                  : notif
              );
              setTemNotificacoesNaoLidas(
                updatedNotificacoes.some((n) => n.status === "pendente")
              );
              return updatedNotificacoes;
            });
          }

          if (data.event === "notificacao_removida") {
            const toastId = `notificacao_removida-${data.data.id_notificacao}`;
            if (!toast.isActive(toastId)) { // Fixed: Removed .current
              toast.warn(
                `Notificação ${data.data.id_notificacao.slice(0, 8)}... foi removida`,
                { autoClose: 4000, toastId }
              );
              console.log("🍞 Toast disparado:", toastId);
            }
            setNotificacoes((prev) => {
              const updatedNotificacoes = prev.filter(
                (notif) => notif.id_notificacao !== data.data.id_notificacao
              );
              setTemNotificacoesNaoLidas(
                updatedNotificacoes.some((n) => n.status === "pendente")
              );
              return updatedNotificacoes;
            });
          }
        } catch (err) {
          console.error("Erro ao processar mensagem WebSocket:", err);
          toast.error("Erro ao processar notificação em tempo real", {
            toastId: `error-${Date.now()}`,
          });
        }
        // Removed: console.log(toastId); // This was causing undefined errors
      };

      socketRef.current.onerror = (error) => {
        console.error("❌ Erro WebSocket:", error);
      };

      socketRef.current.onclose = () => {
        console.warn("🔌 WebSocket desconectado. Tentando reconectar...");
        if (!reconnectIntervalRef.current) {
          reconnectIntervalRef.current = setInterval(connectWebSocket, 5000);
        }
      };
    };

    connectWebSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      if (reconnectIntervalRef.current) {
        clearInterval(reconnectIntervalRef.current);
        reconnectIntervalRef.current = null;
      }
      processedEventsRef.current.clear();
    };
  }, []);

  // Check for new orders
  useEffect(() => {
    async function verificarPedidosNovos() {
      try {
        const res = await axios.get("http://localhost:3000/pedidos/new");
        setTemPedidoNovo(res.data.novos);
      } catch (error) {
        console.error("Erro ao verificar pedidos novos:", error);
      }
    }

    verificarPedidosNovos();
    const intervalo = setInterval(verificarPedidosNovos, 4000);
    return () => clearInterval(intervalo);
  }, []);

  // Mark notification as attended
  const atualizarStatusNotificacao = async (id_notificacao) => {
    try {
      const response = await axios.post(`http://localhost:5000/notificacoes/atender/${id_notificacao}`);
      console.log(`Notificação ${id_notificacao} marcada como atendida:`, response.data);
    } catch (error) {
      console.error(`Erro ao atualizar status da notificação ${id_notificacao}:`, error);
      toast.error(`Erro ao marcar notificação ${id_notificacao.slice(0, 8)}... como atendida`, {
        toastId: `atender-error-${id_notificacao}`,
      });
    }
  };

  // Clear all notifications
  const limparNotificacoes = async () => {
    try {
      const response = await axios.post("http://localhost:5000/notificacoes/limpar");
      console.log("Notificações limpas:", response.data);
      setNotificacoes((prev) => prev.map((n) => ({ ...n, status: "atendida" })));
      setTemNotificacoesNaoLidas(false);
      toast.success("Todas as notificações foram marcadas como atendidas", {
        toastId: "limpar-notificacoes",
      });
    } catch (error) {
      console.error("Erro ao limpar notificações:", error);
      toast.error("Erro ao limpar notificações", { toastId: "limpar-error" });
    }
  };

  // Toggle sidebar
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
    console.log("Sidebar toggled:", !isSidebarOpen ? "Abrindo" : "Fechando");
    setTemNotificacoesNaoLidas(false);
  };

  return (
    <div className="dashboard-container">
      <div className="notification-icon-container">
        <img
          src={notificacao_icone}
          id="not_icon"
          draggable="false"
          alt="Ícone de Notificação"
          onClick={toggleSidebar}
          onKeyDown={(e) => e.key === "Enter" && toggleSidebar()}
          className={`${isSidebarOpen ? "clicked" : ""} ${temNotificacoesNaoLidas ? "has-unread" : ""}`}
          aria-label={isSidebarOpen ? "Fechar painel de notificações" : "Abrir painel de notificações"}
          tabIndex={0}
        />
        {temNotificacoesNaoLidas && (
          <span className="notification-badge">
            {notificacoes.filter((n) => n.status === "pendente").length}
          </span>
        )}
      </div>
      <div className={`sidebar ${isSidebarOpen ? "open" : ""}`}>
        <h2>Notificações</h2>
        <button
          onClick={limparNotificacoes}
          className="limpar-button"
          aria-label="Limpar todas as notificações"
        >
          Limpar Todas
        </button>
        {notificacoes.length === 0 ? (
          <p>Nenhuma notificação</p>
        ) : (
          <ul className="notification-list" role="list">
            {notificacoes.map((notificacao) => (
              <li
                key={notificacao.id_notificacao}
                className={`notification-item ${notificacao.status}`}
                role="listitem"
              >
                <span>
                  <strong>{notificacao.numero_cliente}</strong> solicitou um atendente real às{" "}
                  {formatarHora(notificacao.timestamp)} {/* Updated: Use formatted time */}
                </span>
                {notificacao.status === "pendente" && (
                  <button
                    onClick={() => atualizarStatusNotificacao(notificacao.id_notificacao)}
                    className="atender-button"
                    aria-label={`Marcar notificação ${notificacao.id_notificacao.slice(0, 8)} como atendida`}
                  >
                    Marcar como Atendida
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <h1>Cantinho das Pizzas e do Açaí</h1>
      <div className="dashboard-grid">
        {cards.map((card, index) => {
          const badge = index === 0 && toggle_badge ? <span className="badge" /> : null;

          return card.external ? (
            <a
              href={card.to}
              target="_blank"
              rel="noopener noreferrer"
              key={index}
              className="dashboard-card"
            >
              {badge}
              <div className="icon">{card.icon}</div>
              <h2>{card.title}</h2>
            </a>
          ) : (
            <Link to={card.to} key={index} className="dashboard-card">
              {badge}
              <div className="icon">{card.icon}</div>
              <h2>{card.title}</h2>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
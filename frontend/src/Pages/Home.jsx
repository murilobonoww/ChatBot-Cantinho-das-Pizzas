import React, { useState, useEffect, useRef } from "react";
import "../Style/Home.css";
import relatorios from "../Assets/relatorios_img.png";
import historico from "../Assets/historico.png";
import menu from "../Assets/menu5.png";
import config from "../Assets/config.png";
import entregadores from "../Assets/entregador2.png";
import { Link } from "react-router-dom";
import entregas_icon2 from "../Assets/icone_entregas_2.png";
import notificacao_icone from "../Assets/notification_icon.png";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const cards = [
  { icon: <img id="menu_img" src={historico} />, title: "Histórico de Pedidos", to: "/pedidos" },
  { icon: <img id="menu_img" src={entregas_icon2} />, title: "Entregas", external: true, to: "https://app.foodydelivery.com/u/0/home" },
  { icon: <img id="menu_img" src={entregadores} />, title: "Entregadores", external: true, to: "https://app.foodydelivery.com/u/0/couriers" },
  { icon: <img id="menu_img" src={relatorios} />, title: "Faturamento", to: "/relatorios" },
  { icon: <img id="menu_img" src={menu} />, title: "Cardápio", to: "/cardapio" },
  { icon: <img id="menu_img" src={config} />, title: "Configurações", to: "/configuracoes" },
];

export default function Home() {
  const [temPedidoNovo, setTemPedidoNovo] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [notificacoes, setNotificacoes] = useState([]);
  const [temNotificacoesNaoLidas, setTemNotificacoesNaoLidas] = useState(false);
  const socketRef = useRef(null);
  const reconnectIntervalRef = useRef(null);
  const processedEventsRef = useRef(new Set());

  // Log component render for debugging
  console.log("🖥️ Home component rendered");

  // Load initial notifications
  useEffect(() => {
    async function carregarNotificacoesIniciais() {
      try {
        const response = await axios.get("http://localhost:5000/notificacoes/ativas");
        setNotificacoes(response.data);
        setTemNotificacoesNaoLidas(response.data.some((n) => n.status === "pendente"));
        console.log("📥 Notificações iniciais carregadas:", response.data);
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
    console.log("📥 Configurando WebSocket para notificações");

    const connectWebSocket = () => {
      // Ensure no existing connection
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

          // Create a unique event key
          const eventKey = `${data.event}-${data.data?.id_notificacao || Date.now()}`;
          if (processedEventsRef.current.has(eventKey)) {
            console.log("⚠️ Evento duplicado ignorado:", eventKey);
            return;
          }
          processedEventsRef.current.add(eventKey);

          if (data.event === "notificacao_nova") {
            setNotificacoes((prev) => {
              if (prev.some((n) => n.id_notificacao === data.data.id_notificacao)) {
                console.log("⚠️ Notificação duplicada ignorada:", data.data.id_notificacao);
                return prev;
              }
              toast.info(
                `Cliente ${data.data.numero_cliente} solicitou um atendente real`,
                { autoClose: 5000, toastId: `notificacao_nova-${data.data.id_notificacao}` }
              );
              console.log("📋 Adicionando nova notificação:", data.data);
              return [...prev, data.data];
            });
            setTemNotificacoesNaoLidas(true);
          }

          if (data.event === "notificacao_atualizada") {
            toast.success(
              `Notificação ${data.data.id_notificacao.slice(0, 8)}... marcada como ${data.data.status}`,
              { autoClose: 4000, toastId: `notificacao_atualizada-${data.data.id_notificacao}` }
            );
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
            toast.warn(
              `Notificação ${data.data.id_notificacao.slice(0, 8)}... foi removida`,
              { autoClose: 4000, toastId: `notificacao_removida-${data.data.id_notificacao}` }
            );
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
      };

      socketRef.current.onerror = (error) => {
        console.error("❌ Erro WebSocket:", error);
        toast.error("Erro na conexão WebSocket", { toastId: `ws-error-${Date.now()}` });
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
      console.log("🔌 Limpando WebSocket");
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
      <ToastContainer limit={3} />
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
                  Cliente <strong>{notificacao.numero_cliente}</strong> solicitou um atendente real em{" "}
                  {notificacao.timestamp}
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
      <h1>Cantinho das Pizzas - Sistema</h1>
      <div className="dashboard-grid">
        {cards.map((card, index) => {
          const badge = index === 0 && temPedidoNovo ? <span className="badge" /> : null;

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
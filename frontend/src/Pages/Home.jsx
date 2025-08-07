import React, { useState, useEffect } from "react";
import "../Style/Home.css";
import relatorios from "../Assets/relatorios_img.png";
import historico from "../Assets/historico.png";
import menu from "../Assets/menu5.png";
import config from "../Assets/config.png";
import entregadores from "../Assets/entregador2.png";
import { Link } from "react-router-dom";
import fundo from "../Assets/fundo.png";
import entregas_icon from "../Assets/icone_entregas.png";
import entregas_icon2 from "../Assets/icone_entregas_2.png";
import axios from "axios";
import notificacao_icone from "../Assets/notification_icon.png";
import io from 'socket.io-client';

const socket = io("http://localhost:80", { 
  transports: ['websocket', 'polling'],
  cors: {
    origin: 'http://localhost:5173',
    credentials: true
  },
  debug: true
});

const cards = [
  { icon: <img id="menu_img" src={historico} />, title: "Histórico de Pedidos", to: "/pedidos" },
  { icon: <img id="menu_img" src={entregas_icon2} />, title: "Entregas", external: true, to: "https://app.foodydelivery.com/u/0/home" },
  { icon: <img id="menu_img" src={entregadores} />, title: "Entregadores", external: true, to: "https://app.foodydelivery.com/u/0/couriers" },
  { icon: <img id="menu_img" src={relatorios} />, title: "Faturamento", to: "/relatorios" },
  { icon: <img id="menu_img" src={menu} />, title: "Cardápio", to: "/cardapio" },
  { icon: <img id="menu_img" src={config} />, title: "Configurações", to: "/configuracoes" }
];

export default function Home({ temNotificacoesNaoLidas, notificacoes = [], marcarNotificacaoComoLida, limparNotificacoes }) {
  const [temPedidoNovo, setTemPedidoNovo] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [notificacoesLocais, setNotificacoesLocais] = useState(notificacoes);

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

  useEffect(() => {
  console.log("📥 Configurando Socket.IO para notificações");
  socket.on('nova_notificacao', (notificacao) => {
    setNotificacoesLocais((prev) => [...prev, notificacao]);
    console.log("📥 Nova notificação recebida:", notificacao);
  });

  socket.on('notificacao_atualizada', ({ id_notificacao, status }) => {
    setNotificacoesLocais((prev) =>
      prev.map((notif) =>
        notif.id_notificacao === id_notificacao ? { ...notif, status } : notif
      )
    );
    console.log(`📥 Notificação ${id_notificacao} atualizada para ${status}`);
  });

  socket.on('notificacao_removida', ({ id_notificacao }) => {
    setNotificacoesLocais((prev) =>
      prev.filter((notif) => notif.id_notificacao !== id_notificacao)
    );
    console.log(`📥 Notificação ${id_notificacao} removida`);
  });

  return () => {
    socket.off('nova_notificacao');
    socket.off('notificacao_atualizada');
    socket.off('notificacao_removida');
  };
}, []);

  const atualizarStatusNotificacao = async (id_notificacao, status) => {
    try {
      await axios.put(`http:localhost:80/notificacoes/${id_notificacao}/status`, { status});
      marcarNotificacaoComoLida(id_notificacao);
    } catch (error) {
      console.error(`Erro ao atualizar status da notificação ${id_notificacao}: `, error)
    }
  };


  const handleLimparNotificacoes = () => {
    limparNotificacoes();
    setNotificacoesLocais([]);
  }

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
    console.log("Sidebar toggled:", isSidebarOpen ? "Fechando" : "Abrindo");
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
        {temNotificacoesNaoLidas && <span className="notification-badge"></span>}
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

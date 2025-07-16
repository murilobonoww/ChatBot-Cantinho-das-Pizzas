import React from "react";
import "../Style/Home.css";
import relatorios from "../Assets/relatorios_img.png";
import historico from "../Assets/historico.png";
import menu from "../Assets/menu5.png";
import config from "../Assets/config.png";
import entregadores from "../Assets/entregador2.png";
import { Link } from "react-router-dom";
import fundo from "../Assets/fundo.png";

const cards = [
  { icon: <img id="menu_img" src={historico}/>, title: "Histórico de Pedidos", to: "/pedidos" },
  { icon: <img id="menu_img" src={entregadores}/>, title: "Entregadores", to: "/entregadores" },
  { icon: <img id="menu_img" src={relatorios}/>, title: "Relatórios/faturamento", to: "/relatorios" },
  { icon: <img id="menu_img" src={menu}/> , title: "Cardápio", to: "/cardapio" },
  { icon: <img id="menu_img" src={config}/>, title: "Configurações", to: "/configuracoes" }
];

export default function Home() {
  return (
    <div className="dashboard-container">
      <h1>Cantinho das Pizzas - Sistema</h1>
      <div className="dashboard-grid">
        {cards.map((card, index) => (
          <Link to={card.to} key={index} className="dashboard-card">
            <div className="icon">{card.icon}</div>
            <h2>{card.title}</h2>
          </Link>
        ))}
      </div>
    </div>
  );
} 

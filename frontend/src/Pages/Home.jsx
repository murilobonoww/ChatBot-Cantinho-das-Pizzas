import React from "react";
import "../Style/Home.css";
import { Link } from "react-router-dom";

const cards = [
  { icon: "📜", title: "Histórico de Pedidos", to: "/pedidos" },
  { icon: "🛵", title: "Entregadores", to: "/entregadores" },
  { icon: "📊", title: "Relatórios", to: "/relatorios" },
  { icon: "📦", title: "Cardápio", to: "/cardapio" },
  { icon: "⚙️", title: "Configurações", to: "/configuracoes" }
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

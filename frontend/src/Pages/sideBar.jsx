import React from "react";
import "../Style/sideBar.css"

const SideBar = () => (
    <aside className="sidebar">
        <h2>🍕 Cantinho</h2>
        <nav>
          <a href="#">Pedidos</a>
          <a href="#">Faturamento</a>
          <a href="#">Entregadores</a>
          <a href="#">Relatórios</a>
        </nav>
      </aside>
)

export default SideBar;
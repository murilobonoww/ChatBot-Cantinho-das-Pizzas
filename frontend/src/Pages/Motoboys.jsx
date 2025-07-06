import React from "react";
import { Link } from "react-router-dom";
import relatorios_img from "../assets/relatorios.png";
import pedido_img from "../assets/pedido.png";
import entregadores_img from "../assets/entregadores.png";
import "../Style/Motoboys.css"

const Entregadores = () => (
    <div className="page-motoboys">
          <div className="sidebar">
            <ul>
              <li><Link to={"/entregadores"}><img id="icon" src={entregadores_img} /></Link></li>
              <li><Link to={"/pedidos"}><img id="icon" src={pedido_img} /></Link></li>
              <li><Link to={"/relatorios"}><img id="icon" src={relatorios_img} /></Link></li>
            </ul>
          </div>
          <div className="motoboys">
            <h1>Entregadores</h1>
            <ul>
                <li className="list_motoboys">Lucas</li>
                <li className="list_motoboys">Pablo</li>
            </ul>
          </div>
    </div>
)

export default Entregadores;
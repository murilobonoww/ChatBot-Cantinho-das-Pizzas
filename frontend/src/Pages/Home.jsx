import React from "react";
import "../Style/Home.css";
import relatorios_img from "../assets/relatorios.png";
import pedido_img from "../assets/pedido.png";
import entregadores_img from "../assets/entregadores.png";
import { Link } from "react-router-dom";


const Home = () => {
    return (
        <div className="page-home">
            <div className="sidebar">
                <ul>
                    <li><Link to={"/entregadores"}><img id="icon" src={entregadores_img} /></Link></li>

                    <li><Link to={"/pedidos"}><img id="icon" src={pedido_img} /></Link></li>

                    <li><Link to={"/relatorios"}><img id="icon" src={relatorios_img} /></Link></li>
                </ul>
            </div>
            <div className="textHome">
                <h1 id="title">
                    👋Olá!
                </h1>
                <h2 id="subtitle1">
                    Este é o painel de controle!
                </h2>
                <h2 id="subtitle2">
                    Acompanhe seus pedidos, entregas e mais, tudo em um só lugar.
                </h2>
            </div>
        </div>

    )
}


export default Home;
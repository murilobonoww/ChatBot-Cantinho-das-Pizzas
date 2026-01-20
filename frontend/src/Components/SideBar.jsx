import '../Style/SideBar.css'
import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, NavLink } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { LayoutDashboard, ShoppingBag, Pizza, Truck, UserCheck, Bell, LogOut, Bug } from 'lucide-react';

export default function SideBar() {
    const [isNotifBarOpened, setIsNotifBarOpened] = useState(false)
    const [haveUnreadedNotifs, setHaveUnreadedNotifs] = useState(false)
    const navigate = useNavigate()
    const [temPedidoNovo, setTemPedidoNovo] = useState(false);
    const [notificacoes, setNotificacoes] = useState([]);
    const carregamentoInicial = useRef(true);

    const toggleNotificationBar = () => {
        setIsNotifBarOpened(!isNotifBarOpened)
        setHaveUnreadedNotifs(false)
    }

    useEffect(() => {
        async function carregarNotificacoesIniciais() {
            try {
                const response = await axios.get("https://back-cantinho-das-pizzas.onrender.com/notification/pendentes");
                setNotificacoes(response.data);
                setHaveUnreadedNotifs(response.data.length > 0);
            } catch (error) {
                console.error("Erro ao carregar notificações iniciais:", error);
                toast.error("Erro ao carregar notificações iniciais", {
                    toastId: `initial-load-error-${Date.now()}`,
                });
            }
        }
        carregarNotificacoesIniciais();
    }, []);

    const limparNot = async (id_not) => {
        try {
            const body = { id: id_not, status: 'atendida' }
            const res = await axios.put('https://back-cantinho-das-pizzas.onrender.com/notification/atualizar', body)
            toast.success('Notificação apagada com sucesso!', { autoClose: 1500, closeOnClick: true })
        } catch (error) {
            console.log(error)
            throw error;
        }
    }

    async function limparNotificacoes() {
        try {
            const res = await axios.delete('https://back-cantinho-das-pizzas.onrender.com/notification/limpar')
            toast.success('Todas as notificações apagadas com sucesso!', { autoClose: 1500, closeOnClick: true })
        } catch (error) {
            console.log(error)
            throw error;
        }
    }

    return (
        <div>
             <div className={`sidebar ${isNotifBarOpened ? "open" : ""}`}>
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
                {notificacao.mensagem}
                <div id="hour_notifications">-{formatarHora(notificacao.timestamp)}</div>
              </span>
              {notificacao.status === "pendente" && (
                <button
                  onClick={() => limparNot(notificacao.id_notificacao)}
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
        <aside id="sidebar_aside">
            <nav>
                <div className='sidebar_title'>
                    <h1 id='pizza_sidebar_title'>🍕</h1>
                    <h1 id='sidebarTitle'>Cantinho<br />Desktop</h1>
                </div>

                <ul>
                    <li>
                        <NavLink to="/pedidos">
                            <ShoppingBag size={20} style={{ marginRight: '10px' }} />
                            <span>Pedidos</span>
                        </NavLink>
                    </li>
                    <li>
                        <NavLink to="/relatorios">
                            <LayoutDashboard size={20} style={{ marginRight: '10px' }} />
                            <span>Dashboard</span>
                        </NavLink>
                    </li>

                    <li>
                        <NavLink to="/cardapio">
                            <Pizza size={20} style={{ marginRight: '10px' }} />
                            <span>Cardápio</span>
                        </NavLink>
                    </li>
                    {/* externos */}
                    <li>
                        <Link to="/">
                            <Truck size={20} style={{ marginRight: '10px' }} />
                            <span>Entregas</span>
                        </Link>
                    </li>
                    <li>
                        <Link to="/">
                            <UserCheck size={20} style={{ marginRight: '10px' }} />
                            <span>Entregadores</span>
                        </Link>
                    </li>
                    <li>
                        <Link to="/">   
                            <Bug size={20} style={{ marginRight: '10px' }} />
                            <span>Reportar bug</span>
                        </Link>
                    </li>
                    <li onClick={toggleNotificationBar} id='notification_btn_sidebar'>
                        <Bell size={20} style={{ marginRight: '10px' }} />
                        <span>Notificações</span>
                    </li>
                    <li>
                        <Link to="/login">
                            <LogOut size={20} style={{ marginRight: '10px' }} />
                            <span>Sair</span>
                        </Link>
                    </li>
                </ul>
            </nav>
        </aside>
        </div>
    )
}
import '../Style/SideBar.css'
import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, NavLink } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import socket from '@/services/socket';
import { Check } from 'lucide-react';
import CheckboxSplash from './CheckboxSplash';

import { LayoutDashboard, ShoppingBag, Pizza, Truck, UserCheck, Bell, LogOut, Bug, Trash2 } from 'lucide-react';

export default function SideBar() {
    const navigate = useNavigate()
    const [isNotifBarOpened, setIsNotifBarOpened] = useState(true)
    const [notificacoes, setNotificacoes] = useState([]);
    const carregamentoInicial = useRef(true);
    const [checked, setChecked] = useState(false);

    const toggleNotificationBar = () => {
        setIsNotifBarOpened(!isNotifBarOpened)
    }

    async function carregarNotificacoesIniciais() {
        try {
            const response = await axios.get("https://back-cantinho-das-pizzas.onrender.com/notification/pendentes");
            setNotificacoes(response.data);
        } catch (error) {
            console.error("Erro ao carregar notificações iniciais:", error);
            toast.error("Erro ao carregar notificações iniciais", {
                toastId: `initial-load-error-${Date.now()}`,
            });
        }
    }

    useEffect(() => {
        carregarNotificacoesIniciais();
    }, []);

    useEffect(() => {
        function handleNovaNotificacao(dados) {
            const notif = normalizarNotificacao(dados)
            setNotificacoes(prev => [...prev, notif])
        }
        socket.on('notificacao', handleNovaNotificacao)
        socket.on('notificacao_cancelamento', handleNovaNotificacao)
        return () => {
            socket.off('notificacao', handleNovaNotificacao)
            socket.off('notificacao_cancelamento', handleNovaNotificacao)
        }
    }, [])

    function normalizarNotificacao(dados) {
        const notificacaoNormalizada = {
            id_notificacao: dados.id_notificacao,
            mensagem: dados.mensagem,
            status: 'pendente',
            timestamp: dados.timestamp
        };
        return notificacaoNormalizada;
    }

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

    const limparNot = async (id_not) => {
        try {
            const body = { id: id_not, status: 'atendida' }
            const res = await axios.put('https://back-cantinho-das-pizzas.onrender.com/notification/atualizar', body)
            setNotificacoes(prev => prev.filter(notif => notif.id_notificacao !== id_not))
            toast.success('Notificação apagada com sucesso!', { autoClose: 1500, closeOnClick: true })
        } catch (error) {
            console.log(error)
            throw error;
        }
    }

    async function limparNotificacoes() {
        try {
            const res = await axios.delete('https://back-cantinho-das-pizzas.onrender.com/notification/limpar')
            setNotificacoes([])
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
                    <Trash2 size={18} />
                    Limpar Todas
                </button>
                {notificacoes.length !== 0 && (
                    <ul className="notification-list" role="list">
                        {notificacoes.map((notificacao) => (
                            <li
                                key={notificacao.id_notificacao}
                                className={`notification-item ${notificacao.status}`}
                                role="listitem"
                            >
                                <span>
                                    <div id='notification_msg'>{notificacao.mensagem}</div>
                                    <div id="hour_notifications">-{formatarHora(notificacao.timestamp)}</div>
                                </span>
                                {notificacao.status === "pendente" && (
                                    <CheckboxSplash onChange={() => limparNot(notificacao.id_notificacao)} />


                                    // <button
                                    //     onClick={() => limparNot(notificacao.id_notificacao)}
                                    //     className="atender-button"
                                    //     aria-label={`Marcar notificação ${notificacao.id_notificacao.slice(0, 8)} como atendida`}
                                    // >
                                    //     <Check size={18} />
                                    // </button>


                                // <div className="checkbox-wrapper-12">
                                //     <div className="cbx">
                                //         <input checked="" type="checkbox" id="cbx-12"/>
                                //             <label htmlFor="cbx-12"></label>
                                //             <svg fill="none" viewBox="0 0 15 14" height="14" width="15">
                                //                 <path d="M2 8.36364L6.23077 12L13 2"></path>
                                //             </svg>
                                //     </div>

                                //     <svg style={{ width: "0", height: "0" }} version="1.1" xmlns="http://www.w3.org/2000/svg">
                                //         <defs>
                                //             <filter id="goo-12">
                                //                 <feGaussianBlur result="blur" stdDeviation="4" in="SourceGraphic"></feGaussianBlur>
                                //                 <feColorMatrix result="goo-12" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -7" mode="matrix" in="blur"></feColorMatrix>
                                //                 <feBlend in2="goo-12" in="SourceGraphic"></feBlend>
                                //             </filter>
                                //         </defs>
                                //     </svg>
                                // </div>

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
import '../Style/SideBar.css'
import React, { useState, useEffect, useRef } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import socket from '@/services/socket';
import CheckboxSplash from './CheckboxSplash';
import ManagerAuth from '../shared/ManagerAuth';

import { LayoutDashboard, ShoppingBag, Pizza, Truck, UserCheck, Bell, LogOut, Bug, Trash2, Bot } from 'lucide-react';

export default function SideBar({ isNotifBarOpened, setIsNotifBarOpened }) {
    const [notificacoes, setNotificacoes] = useState([]);
    const carregamentoInicial = useRef(true);
    const [checked, setChecked] = useState(false);
    const [chatbotON, setChatbotON] = useState(true);
    const [showManagerAuth, setShowManagerAuth] = useState(false);
    const location = useLocation();
    const isDashboardActive = location.pathname === "/relatorios";

    const toggleNotificationBar = () => {
        setIsNotifBarOpened(!isNotifBarOpened)
    }

    async function carregarNotificacoesIniciais() {
        try {
            const response = await axios.get("https://back-cantinho-das-pizzas.onrender.com/notification/pending");
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
            carregarNotificacoesIniciais()
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
        console.log(dados.timestamp)
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
            const res = await axios.put('https://back-cantinho-das-pizzas.onrender.com/notification/', body)
            setNotificacoes(prev => prev.filter(notif => notif.id_notificacao !== id_not))
            toast.success('Notificação limpa!', { autoClose: 1500, closeOnClick: true })
        } catch (error) {
            console.log(error)
            throw error;
        }
    }

    async function limparNotificacoes() {
        try {
            const res = await axios.delete('https://back-cantinho-das-pizzas.onrender.com/notification/')
            setNotificacoes([])
            toast.success('Todas as notificações apagadas com sucesso!', { autoClose: 1500, closeOnClick: true })
        } catch (error) {
            console.log(error)
            throw error;
        }
    }

    function toggleChatbot(bool) {
        console.log('entrou na funcao togglechatbot')
        try {
            window.api?.toggleChatbot({
                turn: bool
            })
            console.log('enviou pro IPC')
        } catch (e) {
            console.error("Erro ao ligar/desligar chatbot: ", e)
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
                        <li id='dashboard_btn_sidebar' onClick={() => setShowManagerAuth(true)} className={isDashboardActive ? 'active' : ''}>
                            <LayoutDashboard size={20} style={{ marginRight: '10px' }} />
                            <span>Dashboard</span>
                        </li>

                        <li>
                            <NavLink to="/cardapio">
                                <Pizza size={20} style={{ marginRight: '10px' }} />
                                <span>Cardápio</span>
                            </NavLink>
                        </li>
                        <li>
                            <Link to="/">
                                <Truck size={20} style={{ marginRight: '10px' }} />
                                <span>Entregas</span>
                            </Link>
                        </li>
                        <li>
                            <Link to="/">
                                <UserCheck size={20} style={{ marginRight: '10px' }} />
                                <span>Motoboys</span>
                            </Link>
                        </li>
                        <li>
                            <Link to="/">
                                <Bug size={20} style={{ marginRight: '10px' }} />
                                <span>Reportar</span>
                            </Link>
                        </li>
                        <li onClick={toggleNotificationBar} id='notification_btn_sidebar'>
                            <Bell size={20} style={{ marginRight: '10px' }} />
                            <span>Alertas</span>
                        </li>
                        <li onClick={() => { setChatbotON(!chatbotON); toggleChatbot(chatbotON); }} id="bot_btn_sidebar">
                            <Bot size={20} style={{ marginRight: '10px' }} />
                            <span>Bot {chatbotON ? 'ON' : 'OFF'}</span>
                        </li>
                        <li>
                            <Link to="/login" onClick={() => setChatbotON(false)}>
                                <LogOut size={20} style={{ marginRight: '10px' }} />
                                <span>Sair</span>
                            </Link>
                        </li>
                    </ul>
                </nav>
            </aside>

            {showManagerAuth && <ManagerAuth
                method={"report"}
                closeModal={() => setShowManagerAuth(false)}
                isNotifBarOpened={isNotifBarOpened}
                sendCode={(code) => { }}
            />}
        </div>
    )
}
import { useEffect } from "react";
import socket from "@/services/socket";
import { toast } from "react-toastify";
import bell_sound from "/assets/bell.mp3"
import axios from "axios";

export function useSocketNotifications () {
    console.log("🚀 useSocketNotifications EXECUTADO");

    async function cancelarPedido(id) {
        try {
            const res = await axios.delete(`https://back-cantinho-das-pizzas.onrender.com/order/${id}`)
            toast.success('Pedido cancelado com sucesso!')
        } catch (error) {
            console.log('Erro ao cancelar pedido: ', error)
            throw new error
        }
    }

    function toastCancelamento(numero, id_pedido) {
        toast(
            ({ closeToast }) => (
                <div>
                    Solicitação de cancelamento para <strong>#{id_pedido}</strong>

                    <div style={{ marginTop: 10 }}>
                        <button style={{ backgroundColor: '#7adb72', color: 'white' }}
                            onClick={() => { cancelarPedido(id_pedido) }}
                        >
                            Aceitar
                        </button>

                        <button style={{ marginLeft: '10px', backgroundColor: '#ff6185', color: 'white' }}
                            onClick={() => { closeToast() }}
                        >
                            Rejeitar
                        </button>
                    </div>
                </div>
            ),
            {
                autoClose: false, // não fecha sozinho
                closeOnClick: false,
            }
        );
    }

    useEffect(() => {
        socket.on('connect', () => {
            console.log('Conectado socket: ', socket.id);
        })

        socket.on('notificacao', (dados) => {
            toast.warning(dados.mensagem, { autoClose: false })
            playSound()
        })

        socket.on('notificacao_cancelamento', (dados) => {
            console.log("pedido cancelado")
            playSound()
            toastCancelamento(dados.numero, dados.id_pedido)
        })

        return () => {
            socket.off('connect');
            socket.off('notificacao');
            socket.off('notificacao_cancelamento');
        }
    }, [])

    const playSound = () => {
        const audio = new Audio(bell_sound);
        audio.volume = 0.8;
        audio.play();
    }
}
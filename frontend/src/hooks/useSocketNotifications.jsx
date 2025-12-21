import { useEffect } from "react";
import socket from "@/services/socket";
import { toast } from "react-toastify";
import bell_sound from "/assets/bell.mp3"

export function useSocketNotifications() {
    console.log("🚀 useSocketNotifications EXECUTADO");

    function toastCancelamento(numero) {
        toast(
            ({ closeToast }) => (
                <div>
                    <strong>{numero}</strong> pede cancelamento de <strong>#75</strong>
                    <div style={{ marginTop: 10 }}>
                        <button style={{ backgroundColor: '#ff6185', color: 'white' }}
                            onClick={() => {
                                console.log("pedido cancelado")
                            }}
                        >
                            Aceitar
                        </button>

                        <button onClick={closeToast} style={{ marginLeft: 8, backgroundColor: '#7adb72', color: 'white' }}>
                            Recusar
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
            toast.warning(dados.mensagem, {autoClose: false})
            playSound();
        })

        socket.on('notificacao_cancelamento', (dados) => {
            console.log("pedido cancelado")
            playSound();
            toastCancelamento(dados.numero);
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
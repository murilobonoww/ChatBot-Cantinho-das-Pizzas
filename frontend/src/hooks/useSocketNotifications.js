import { useEffect } from "react";
import socket from "@/services/socket";
import { toast } from "react-toastify";
import bell_sound from "/assets/bell.mp3"

export function useSocketNotifications() {
    useEffect(() => {
        socket.on('connect', () => {
            console.log('Conectado socket: ', socket.id);
        })

        socket.on('notificacao', (dados) => {
            toast.warning(dados.mensagem)
            playSound();
        })

        return () => {
            socket.off('connect');
            socket.off('nova_notificacao');
        }
    }, [])

    const playSound = () => {
      const audio = new Audio(bell_sound);
      audio.volume = 0.8;
      audio.play();
    }
}
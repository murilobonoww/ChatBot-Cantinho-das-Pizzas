import { io } from 'socket.io-client';

const socket = io('https://back-cantinho-das-pizzas.onrender.com', {
    transports: ['websocket'],
});

export default socket;
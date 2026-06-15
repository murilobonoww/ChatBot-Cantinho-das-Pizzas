const { Server } = require("socket.io");

declare global {
    var io: Server;
}

export {};
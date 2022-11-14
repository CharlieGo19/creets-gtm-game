import { Socket } from 'socket.io';

export function unauthorisedDisconnect(socket: Socket): void {
    socket.emit("401", "Unauthorised");
    socket.disconnect();
    // TODO: Redirect on client side to homepage.
}
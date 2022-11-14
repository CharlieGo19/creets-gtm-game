import { Socket } from 'socket.io';

export function inactiveDisconnect(socket: Socket): void {
    console.log(socket.request.session.user.discName, " has left the queue.");
    socket.emit("418", "Looks like you're on a coffee break, don't use a teapot.");
    socket.disconnect();
    // TODO: Redirect client side to homepage.
}
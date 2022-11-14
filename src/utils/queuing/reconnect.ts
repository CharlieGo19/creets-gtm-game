import { Socket } from 'socket.io';
import { UserConnectivityStatus } from './userstatus';

export function offerReconnection(socket: Socket, userConnState: UserConnectivityStatus): void {
    socket.emit("reconnect");
    // TODO: Add a cooldown to reconnect to make sure that we're not spammed with them & possibly abused.
    // If reconnect:
            // If true: Send is user reconnect|forfeit signal
                 // Does BoardID exist:
                     // true: check capacity, if 2 something funky going on - maybe disconnect user reconn.
                         // rejoin.
                 // If BoardID does not exist:
                         // Update table to mark user out of game.
             // If forfeit: clear game, mark loss, notify end user
    socket.on("reconnect", (resp: string) => {
        if (resp === "true") {
            console.log("Fighting spirit.")
            // TODO: Reconnection
        } else {
            console.log("you smelly burnt toast...")
            // TODO: Forfeit.
        }
    });
}
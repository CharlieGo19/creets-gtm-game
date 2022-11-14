import { Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../server';
import { GAME_ACCEPTED, GAME_FOUND, GAME_OFFER_TIMER } from '../constants';
import { inactiveDisconnect } from '../socket-errs/418';
import { UserConnectivityStatus } from './userstatus';

const queuedPlayers: string[] = [];

// TODO: Check if this blocks -- do with random name again & remove this comment.
export async function findGame(socket: Socket, activePlayers: Map<string, UserConnectivityStatus>): Promise<string | undefined> {
    // check user is not already in the queue, if they are, continue.
    // TODO: add userName to this too as if we reconn, it will add user connId twice.
    const player: string = socket.request.session.user.discName;

    if (!queuedPlayers.includes(player)) {
        queuedPlayers.push(player);
    }
    
    if (queuedPlayers.length > 1) {

        const playerOne: string | undefined = queuedPlayers.shift();
        const playerTwo: string | undefined = queuedPlayers.shift();

        // ensure we have popped players off of queue.
        if (playerOne === undefined && playerTwo === undefined) {
            console.log('INFO: Players undefined...');
            return;
        }
        
        if (!activePlayers.has(playerOne as string) && !activePlayers.has(playerTwo as string)) {
            // Players do not exist - something has gone wrong here...
            // TODO: Logging
            console.log(`ERROR: ${playerOne} and ${playerTwo} were not found in activePlayers.`);
            return;
        }
        // ensure we has the players conn_id.
        // playerOne has gone missing
        if (!activePlayers.has(playerOne as string) && activePlayers.has(playerTwo as string)) {
            // put playerTwo at front of queue.
            queuedPlayers.unshift(playerTwo as string);
            findGame(activePlayers.get(playerTwo as string)?.userSocket as Socket, activePlayers);
            return;
        }

        // playerTwo has gone missing.
        if (activePlayers.has(playerOne as string) && !activePlayers.has(playerTwo as string)) {
            // put playerOne at front of queue.
            queuedPlayers.unshift(playerOne as string);
            findGame(activePlayers.get(playerOne as string)?.userSocket as Socket, activePlayers);
            return;
        }

        const playerResp: boolean | string = await offerGame(activePlayers.get(playerOne as string)?.userSocket as Socket, activePlayers.get(playerTwo as string)?.userSocket as Socket);

        if (typeof playerResp === "string") {
            switch(playerResp) {
                case playerOne: 
                    // playerOne should be requeued and playerTwo disconnected.
                    inactiveDisconnect(activePlayers.get(playerTwo as string)?.userSocket as Socket);
                    activePlayers.delete(playerTwo as string);
                    findGame(activePlayers.get(playerOne as string)?.userSocket as Socket, activePlayers);
                    return;
                case playerTwo: 
                    // playerTwo should be requeued and playerOne disconnected.
                    inactiveDisconnect(activePlayers.get(playerOne as string)?.userSocket as Socket);
                    activePlayers.delete(playerOne as string);
                    findGame(activePlayers.get(playerTwo as string)?.userSocket as Socket, activePlayers);
                    return;
            }
        }

        if (typeof playerResp === "boolean") {
            if (playerResp === true) {
                // TODO: Check boardId does not already exist, although collisions are unlikely, best to do DD.
                const boardId: string = uuidv4();

                // Add players to lobby.
                activePlayers.get(playerOne as string)?.userSocket.join(boardId);
                activePlayers.get(playerTwo as string)?.userSocket.join(boardId);
                //TODO: Set boardId on UserConnectivityStatus Obj.

                updateUserInfoInGame(playerOne as string, playerTwo as string, (activePlayers.get(playerOne as string)?.userSocket as Socket).id, (activePlayers.get(playerTwo as string)?.userSocket as Socket).id, boardId);
                
                // TODO: Create Topic -- Create topic.
                // TODO: Update activeUsers
                return boardId;
            } else {
                // Remove from ActiveUsers & disconnect. inactivity
                inactiveDisconnect(activePlayers.get(playerOne as string)?.userSocket as Socket);
                activePlayers.delete(playerOne as string);

                inactiveDisconnect(activePlayers.get(playerTwo as string)?.userSocket as Socket);
                activePlayers.delete(playerTwo as string);

                return;
            }
        }
    }
}

export function removePlayerFromQueue(name: string): void {
    const indexOfPlayer: number = queuedPlayers.indexOf(name);
    if (indexOfPlayer > -1) {
        queuedPlayers.splice(indexOfPlayer, 1);
        console.log(`${name} left the queue.`); // TODO: Remove.
    }
}

async function offerGame(playerOneSocket: Socket, playerTwoSocket: Socket): Promise<boolean | string> {

    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    let playerOneAccepted = false;
    let playerTwoAccepted = false;

    playerOneSocket.emit(GAME_FOUND);
    playerTwoSocket.emit(GAME_FOUND);
    
    playerOneSocket.on(GAME_ACCEPTED, (ack) => {
        if (ack === "true") {
            playerOneAccepted = true;
        }
    });

    playerTwoSocket.on(GAME_ACCEPTED, (ack) => {
        if (ack === "true") {
            playerTwoAccepted = true;
        }
    })

    await sleep(GAME_OFFER_TIMER);
    
    // Everyone responds, very nice!
    if (playerOneAccepted && playerTwoAccepted) {
        return true;
    }

    // Player Two is snoozing.
    if (playerOneAccepted && !playerTwoAccepted) {
        return playerOneSocket.request.session.user.discName as string;
    }

    // Player One just wasn't built for this...
    if (!playerOneAccepted && playerTwoAccepted) {
        return playerTwoSocket.request.session.user.discName as string
    }

    // :sad: nobody wants to play...
    return false;
}

async function updateUserInfoInGame(playerOne: string, playerTwo: string, playerOneConnId: string, playerTwoConnId: string, boardId: string): Promise<void> {

    try {
        const playerOneData: { user_id: number } = await prisma.users.findFirstOrThrow({
            where: {
                disc_name: playerOne,
            }, 
            select: {
                user_id: true,
            }
        });

        await prisma.game_user_info.update({
            where: {
                user_id: playerOneData.user_id,
            },
            data: {
                in_game: true,
                conn_id: playerOneConnId,
                board_id: boardId
            }
        });
        
    } catch(err) {
        // playerOneErr; requeue playerTwo, send Internal.
        // TODO: logging.
        console.log("ERROR (PLAYER ONE): ", err);
    }

    try {
        const playerTwoData: { user_id: number } = await prisma.users.findFirstOrThrow({
            where: {
                disc_name: playerTwo,
            }, 
            select: {
                user_id: true,
            }
        });

        await prisma.game_user_info.update({
            where: {
                user_id: playerTwoData.user_id,
            },
            data: {
                in_game: true,
                conn_id: playerTwoConnId,
                board_id: boardId
            }
        });
    } catch(err) {
        // undo changes to playerOne
        // playerTwoErr: requeue playerOne, send internal.
        // TODO: logging:
        console.log("ERROR (PLAYER TWO): ", err);
    }
}
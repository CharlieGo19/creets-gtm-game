import { Socket } from 'socket.io';
import { prisma } from '../../server';
import { unauthorisedDisconnect } from '../socket-errs/401';

export interface UserConnectivityStatus {
    userSocket: Socket;
    inGame: boolean;
    connId: string | null;
    boardId: string | null;
}

interface GameUserInfo {
    game_user_info: {
        in_game: boolean;
        conn_id: string | null;
        board_id: string | null;
    } | null;
}

export async function isUserInGame(socket: Socket): Promise<UserConnectivityStatus | null> {
    try {
        const userGameState: GameUserInfo | null = await prisma.users.findUniqueOrThrow({
            where: {
                disc_name: socket.request.session.user.discName,
            },
            select: {
                game_user_info: {
                    select: {
                        in_game: true,
                        conn_id: true,
                        board_id: true,
                    },
                },
            },
        });

        if (userGameState === null) {
            return null;
        }

        const userConnStatus: UserConnectivityStatus = {
            userSocket: socket,
            inGame: userGameState.game_user_info?.in_game as boolean,
            connId: userGameState.game_user_info?.conn_id as string | null,
            boardId: userGameState.game_user_info?.board_id as string | null,
        };

        return userConnStatus;
    } catch (err) {
        // If we're here, the user should not be playing the game or we've not entered their details correctly on setup.
        // Or we have multiple entries for user, or user is being fruity.
        // TODO: Frontend - let user know that if they should be playing, then @ us.
        // TODO: logging.
        console.log(err);
        unauthorisedDisconnect(socket);
        return null;
    }
}

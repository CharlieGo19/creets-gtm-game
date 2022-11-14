import express, { Express, Request, Response, NextFunction } from 'express';
import { createClient, RedisClientType } from 'redis';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import session from 'express-session';
import { Env } from './utils/startup';
import { PrismaClient } from '@prisma/client';
import { isUserInGame, UserConnectivityStatus } from './utils/queuing/userstatus'
import { unauthorisedDisconnect } from './utils/socket-errs/401';
import { offerReconnection } from './utils/queuing/reconnect';
import { findGame, removePlayerFromQueue } from './utils/queuing/queue';
import { CONNECTION, DISCONNECTION, GAME_INITIALISED } from './utils/constants';

dotenv.config();

export const env: Env = new Env();
const app: Express = express();

app.use(cors());
app.use(helmet());
app.use(express.json());

declare module 'http' {
    interface IncomingMessage {
        session: { 
            authenticated: boolean,
            user: {
                discName: string,
                discID: string,
                discAvatar: string | null,
                bearerToken: string
            }
        }
    }
}
// eslint-disable-next-line @typescript-eslint/no-var-requires
const redisStore = require('connect-redis')(session);
// TODO: Set production env variables in client and connect remotely.
export const redisClient: RedisClientType = createClient(env.GetRedisClientOptions());

(
    async () => {
        await redisClient.connect();
        console.log(`Connected to redis on: ${env.GetRedisClientOptions().socket.host}`);
    }
)();

// TODO: Add userId to session data.

const sessionMiddleware = session({
    secret: env.GetSessionSecret() as string,
    store: new redisStore({
        client: redisClient,
        prefix: 'gtm:'
    }),
    cookie: {
        httpOnly: true,
        secure: env.GetSessionSecure()
    },
    saveUninitialized: false,
    resave: false
});

export const prisma: PrismaClient = new PrismaClient();

app.use(sessionMiddleware);

/*const options: ServerOptions = {
    path: '',
    serveClient: false,
    adapter: undefined,
    parser: undefined,
    connectTimeout: 0
};*/

// eslint-disable-next-line @typescript-eslint/no-var-requires
const httpServer = createServer(app);
const io: Server = new Server(httpServer);

// do an auth function like main api, then add to middleware
// use the auth function onQueue and onGamefound.
io.use((socket, next) => {
    sessionMiddleware(socket.request as Request, {} as Response, next as NextFunction);
});
// TODO: Do a middleware to check capacity of / socket io, if >= to no. of alpha participants, reject connection (possibly vet who's in there...);

// discName:{socket, conn_id, board_id}
const activePlayers: Map<string, UserConnectivityStatus> = new Map<string, UserConnectivityStatus>();


io.on(CONNECTION, async(socket) => {
    // TODO: Auth user, is user session valid? if so, allow in queue, if not redirect.

    
    /********** TEST BLOCK ***************
    if (socket.request.session.user?.discName === undefined) {
        
        switch(activePlayers.size) {
            case 1: 
                socket.request.session.user = { discName: "Uriah#6969", discID: '', discAvatar: null, bearerToken: '1234'};
                break;
            case 2:
                socket.request.session.user = { discName: "Don Hector#3191", discID: '', discAvatar: null, bearerToken: '1234'};
                break;
            case 3:
                socket.request.session.user = { discName: "Deejay#0076", discID: '', discAvatar: null, bearerToken: '1234'};
                break;
            case 4:
                socket.request.session.user = { discName: "bugbytes#0817", discID: '', discAvatar: null, bearerToken: '1234'};
                break;
            case 5:
                socket.request.session.user = { discName: "Healthycheekums#3639", discID: '', discAvatar: null, bearerToken: '1234'};
                break;
        }
    }

    const userTest: UserConnectivityStatus = {
        userSocket: socket,
        inGame: false,
        connId: socket.id,
        boardId: null
    }

    activePlayers.set(socket.request.session.user.discName, userTest);
    const boardId: string | undefined = await findGame(socket, activePlayers);
    console.log(boardId);
    *** END OF TEST BLOCK */

    
    const userConnState: UserConnectivityStatus | undefined | null = await isUserInGame(socket);
    
    if (userConnState === null) {
        console.log('Disconnecting.')
        unauthorisedDisconnect(socket);
    }
    activePlayers.set(socket.request.session.user.discName, userConnState as UserConnectivityStatus);

    if (userConnState?.inGame) {
        offerReconnection(socket, userConnState as UserConnectivityStatus); 
    } else {
        // Add user to Queue
        const boardId: string | undefined = await findGame(socket, activePlayers);
        if (boardId !== undefined) {
            broadcastGameFound(io, boardId);
        } else {
            console.log("Not enough players...");
        }
    }

    socket.on(DISCONNECTION, () => {
        // TODO: soon as server knows that game has concluded, disconnect wss, handover data, let front end wrap up.
        // TODO: check if in game, i.e. check other params on activeUsers, if they're not null then they were in the game.
        removePlayerFromQueue(socket.request.session.user.discName);
        activePlayers.delete(socket.request.session.user.discName);
        // TODO: update DB.
    });
});

function broadcastGameFound(server: Server, boardId): void {
    server.to(boardId).emit(GAME_INITIALISED, `Hello Future! BoardID: ${boardId}`);
}

httpServer.listen(env.GetPort(), () => console.log(`Server is listening on port ${env.GetPort()}!`));

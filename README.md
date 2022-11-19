# creets-gtm-game

## Initial Setup

1. You'll first need a dev account with discord, i've left an env template I think it's up to date, put the details in there.
2. Create an application, then an OAUTH profile, you should get client id and secret, these go in your .env.
3. Create a redirect to: <http://localhost:3002/api/v0/auth/discord/>
4. Then if you go to URL generator you can select your scopes, I'm using identity and email, save this url it will be what you use in the future for getting a valid session.

## Run CREETS-CLUB-API

For now for authentication we're piggy backing off of CREETS the NFT Project auth due to the way I have Railway and Auto deployment setup.

```sh
  docker compose up -d
  npm run dev
```

You can now hit your disc url to test, it will then update relevant tables and put a session in REDIS with the prefix gtm:
Once you have a valid session you can stop the CREETS-CLUB-API, we only needed it for auth. To check just exec into container and use the redis cli tools to get all keys, there should only be one in there.

## Running CREETS-GTM-GAME

```sh
npm run dev
```

1. In postman you'll want to copy over the session token if you're testing your own acc. otherwise uncomment the test block and comment out live block in the game API and create a few SOCKET.IO connections no header and it will create the people in the switch statement as players.
2. Events to listen to can be found in the constants file.
3. When you get the game found message, you can send the gameAccepted with an argument of true to accept.

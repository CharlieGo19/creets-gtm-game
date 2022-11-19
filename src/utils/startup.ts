import { RedisClientOptions } from 'redis';

export class Env {
    private startupTime = new Date().toUTCString();
    private getOrDefault(envVar: string, defaultValue: string): string {
        if (!process.env[envVar]) {
            console.log(`${this.startupTime} ${envVar} UNDEFINED: Setting sensible default - ${defaultValue}.`);
            return defaultValue;
        } else {
            return process.env[envVar] as string;
        }
    }
    private getOrLog(envVar: string, logMessage: string): string | undefined {
        if (!process.env[envVar]) {
            console.log(`${this.startupTime} ${envVar} UNDEFINED: Setting sensible default - ${logMessage}.`);
        }

        return process.env[envVar];
    }
    private getOrExit(envVar: string): string {
        if (!process.env[envVar]) {
            console.log(`${this.startupTime} ${envVar} UNDEFINED: Exiting... Can not continue...`);
            process.exit();
        }
        return process.env[envVar] as string;
    }
    private port = this.getOrDefault('PORT', '3005');
    private discClientId = this.getOrLog('DISCORD_CLIENT_ID', 'Discord oauth2 will be unavailable.');
    private discSecret = this.getOrLog('DISCORD_CLIENT_SECRET', 'Discord oauth2 will be unavailable.');
    private discAuthRedirUrl = this.getOrLog('DISCORD_AUTH_REDIRECT_URL', 'Discord oauth2 will be unavailable.');
    private discTokenUrl = this.getOrLog('DISCORD_API_TOKEN_URL', 'Discord oauth2 will be unavailable.');
    private discApiIdentityUrl = this.getOrLog('DISCORD_API_IDENTITY_URL', 'Discord oauth2 will be unavailable.');
    private redisPort = parseInt(this.getOrExit('REDIS_PORT'));
    private redisHost = this.getOrExit('REDIS_HOST');
    private redisUrl = process.env.REDIS_URL;
    private redisUser = process.env.REDIS_USER;
    private redisPassword = process.env.REDIS_PASSWORD;
    private sessionSecret = this.getOrExit('SESSION_SECRET');
    private sessionSecure = this.getOrDefault('SESSION_SECURE', 'true') !== 'false';

    GetPort(): string {
        return this.port;
    }

    GetDiscClientId(): string {
        if (this.discClientId) {
            return this.discClientId;
        } else {
            return '';
        }
    }

    GetDiscClientSecret(): string {
        if (this.discSecret) {
            return this.discSecret;
        } else {
            return '';
        }
    }

    GetDisAuthRedirUrl(): string {
        if (this.discAuthRedirUrl) {
            return this.discAuthRedirUrl;
        } else {
            return '';
        }
    }

    GetDiscTokenUrl(): string {
        if (this.discTokenUrl) {
            return this.discTokenUrl;
        } else {
            return '';
        }
    }

    GetDiscIdentityUrl(): string {
        if (this.discApiIdentityUrl) {
            return this.discApiIdentityUrl;
        } else {
            return '';
        }
    }

    IsSet(): boolean {
        if (
            this.discClientId &&
            this.discSecret &&
            this.discAuthRedirUrl &&
            this.discTokenUrl &&
            this.discApiIdentityUrl
        ) {
            return true;
        }
        return false;
    }

    GetRedisClientOptions(): any {
        if (this.redisUrl === undefined) {
            return <RedisClientOptions>{
                socket: {
                    host: this.redisHost,
                    port: this.redisPort,
                },
                legacyMode: true,
            };
        } else {
            return <RedisClientOptions>{
                socket: {
                    host: this.redisHost,
                    port: this.redisPort,
                    username: this.redisUser,
                    password: this.redisPassword,
                },
                url: this.redisUrl,
                legacyMode: true,
            };
        }
    }

    GetSessionSecret(): string | undefined {
        return this.sessionSecret;
    }

    GetSessionSecure(): boolean {
        return this.sessionSecure;
    }
}

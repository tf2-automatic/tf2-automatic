export interface Config {
  port: number;
  steam: SteamAccountConfig;
  dataDir: string;
}

export interface SteamAccountConfig {
  username: string;
  password: string;
  sharedSecret: string;
  identitySecret: string;
}

export default (): Config => {
  return {
    port:
      process.env.NODE_ENV === 'production'
        ? 3000
        : parseInt(process.env.PORT as string, 10),
    steam: {
      username: process.env.STEAM_USERNAME as string,
      password: process.env.STEAM_PASSWORD as string,
      sharedSecret: process.env.STEAM_SHARED_SECRET as string,
      identitySecret: process.env.STEAM_IDENTITY_SECRET as string,
    },
    dataDir: process.env.DATA_DIR as string,
  };
};

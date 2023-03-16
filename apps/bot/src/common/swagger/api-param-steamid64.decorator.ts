import { ApiParam } from '@nestjs/swagger';

export const ApiParamSteamID = () => {
  return ApiParam({
    name: 'steamid',
    example: '76561198120070906',
    description: 'SteamID64 of a Steam account',
    type: 'string',
  });
};

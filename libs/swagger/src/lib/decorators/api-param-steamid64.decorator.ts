import { ApiParam } from '@nestjs/swagger';

export const ApiParamSteamID = (
  description = 'SteamID64 of a Steam account'
) => {
  return ApiParam({
    name: 'steamid',
    example: '76561198120070906',
    description,
    type: 'string',
  });
};

import { ApiParam } from '@nestjs/swagger';

export const ApiParamOfferID = () => {
  return ApiParam({
    name: 'id',
    example: '1234567890',
    description: 'The id of the trade',
    type: 'string',
  });
};

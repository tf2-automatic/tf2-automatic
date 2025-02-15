import { ApiQuery } from '@nestjs/swagger';

export const ApiQuerySchemaTime = () => {
  return ApiQuery({
    name: 'time',
    description: 'A time used to select the schema used',
    type: 'integer',
    required: false,
    example: Math.floor(Date.now() / 1000),
  });
};

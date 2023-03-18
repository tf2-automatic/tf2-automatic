import { ApiProperty } from '@nestjs/swagger';

export class MessageModel {
  @ApiProperty({
    description: 'The message as it was sent by Steam',
  })
  modified_message: string;

  @ApiProperty({
    description: 'Unix timestamp of when the message was sent',
  })
  server_timestamp: number;

  @ApiProperty({
    description:
      'This is a number incremented for each message sent at the same timestamp starting at 0',
  })
  ordinal: number;
}

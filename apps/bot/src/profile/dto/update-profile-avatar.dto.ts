import { ApiProperty } from '@nestjs/swagger';
import { UpdateProfileAvatar } from '@tf2-automatic/bot-data';
import { IsUrl } from 'class-validator';

export class UpdateProfileAvatarDto implements UpdateProfileAvatar {
  @ApiProperty({
    description: 'The new avatar url',
    example:
      'https://avatars.akamai.steamstatic.com/8903f73ef9dab679c4712f07fcd570d13ce01c1d_full.jpg',
  })
  @IsUrl({
    protocols: ['http', 'https'],
  })
  url: string;
}

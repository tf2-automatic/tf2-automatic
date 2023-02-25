import { UpdateProfileAvatar } from '@tf2-automatic/bot-data';
import { IsUrl } from 'class-validator';

export class UpdateProfileAvatarDto implements UpdateProfileAvatar {
  @IsUrl({
    protocols: ['http', 'https'],
  })
  url: string;
}

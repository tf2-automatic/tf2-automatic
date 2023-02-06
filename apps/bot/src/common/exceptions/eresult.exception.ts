import {
  HttpException,
  HttpStatus,
  InternalServerErrorException,
} from '@nestjs/common';
import { EResult } from 'steam-user';

export class EResultException extends InternalServerErrorException {
  constructor(readonly message: string, readonly eresult: EResult) {
    const obj: any = HttpException.createBody(
      'Steam responded to request with EResult ' + eresult,
      'EResult',
      HttpStatus.INTERNAL_SERVER_ERROR
    );

    obj.eresult = eresult;
    obj.details = message;

    super(obj);
  }
}

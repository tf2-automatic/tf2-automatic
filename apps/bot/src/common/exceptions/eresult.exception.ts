import {
  HttpException,
  HttpExceptionBody,
  HttpStatus,
  InternalServerErrorException,
} from '@nestjs/common';
import { EResult } from 'steam-user';

interface ExceptionBody extends HttpExceptionBody {
  eresult?: EResult;
  details?: string;
  cause?: string;
}

export class SteamException extends InternalServerErrorException {
  constructor(message: string, eresult?: EResult, cause?: string) {
    let newMessage = `Steam responded to request with an error`;

    if (eresult) {
      newMessage += ` with EResult ${eresult}`;
    }

    if (cause) {
      newMessage += ` (cause: ${cause})`;
    }

    const obj: ExceptionBody = HttpException.createBody(
      newMessage,
      'SteamException',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );

    obj.eresult = eresult;
    obj.details = message;
    obj.cause = cause;

    super(obj);
  }
}

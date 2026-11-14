import { ConsoleLogger } from '@nestjs/common';
import { ClsServiceManager } from 'nestjs-cls';

// Adds the account being worked on to the context, e.g. [Context<steamid64>]
export class AccountLogger extends ConsoleLogger {
  protected override formatContext(context: string): string {
    const cls = ClsServiceManager.getClsService();
    const steamid64 = cls.isActive() ? cls.get('steamid64') : undefined;

    return super.formatContext(
      context && steamid64 ? `${context}<${steamid64}>` : context,
    );
  }
}

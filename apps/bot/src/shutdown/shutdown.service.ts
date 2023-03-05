import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

@Injectable()
export class ShutdownService {
  // Create an rxjs Subject that your application can subscribe to
  private shutdownListener: Subject<void> = new Subject();

  // Subscribe to the shutdown in your main.ts
  subscribeToShutdown(callback: () => void): void {
    this.shutdownListener.subscribe(() => callback());
  }

  // Emit the shutdown event
  shutdown() {
    this.shutdownListener.next();
  }
}

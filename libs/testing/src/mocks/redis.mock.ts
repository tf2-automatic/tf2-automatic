import { jest } from '@jest/globals';
import Redis from 'ioredis';

export const redis: Partial<{ [K in keyof Redis] }> = {
  multi: jest.fn().mockReturnThis(),
  hset: jest.fn(),
  hdel: jest.fn(),
  exec: jest.fn(),
};

import { Test, TestingModule } from '@nestjs/testing';
import { HeartbeatsService } from './heartbeats.service';

describe('HeartbeatsService', () => {
  let service: HeartbeatsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [{ provide: HeartbeatsService, useValue: {} }],
    }).compile();

    service = module.get<HeartbeatsService>(HeartbeatsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

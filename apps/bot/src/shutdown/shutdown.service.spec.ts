import { Test, TestingModule } from '@nestjs/testing';
import { ShutdownService } from './shutdown.service';

describe('ShutdownService', () => {
  let service: ShutdownService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: ShutdownService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<ShutdownService>(ShutdownService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

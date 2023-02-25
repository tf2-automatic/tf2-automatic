import { Test, TestingModule } from '@nestjs/testing';
import { BotsService } from './bots.service';

describe('BotsService', () => {
  let service: BotsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: BotsService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<BotsService>(BotsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

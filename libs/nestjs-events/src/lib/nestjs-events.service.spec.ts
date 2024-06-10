import { Test, TestingModule } from '@nestjs/testing';
import { NestEventsService } from './nestjs-events.service';

describe('NestEventsService', () => {
  let service: NestEventsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: NestEventsService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<NestEventsService>(NestEventsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

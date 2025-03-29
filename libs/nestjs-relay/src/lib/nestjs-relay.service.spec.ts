import { Test, TestingModule } from '@nestjs/testing';
import { RelayService } from './nestjs-relay.service';

describe('NestRelayService', () => {
  let service: RelayService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: RelayService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<RelayService>(RelayService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

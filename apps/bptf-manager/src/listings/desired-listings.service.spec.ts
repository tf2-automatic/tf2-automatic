import { Test, TestingModule } from '@nestjs/testing';
import { DesiredListingsService } from './desired-listings.service';

describe('DesiredListingsService', () => {
  let service: DesiredListingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: DesiredListingsService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<DesiredListingsService>(DesiredListingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

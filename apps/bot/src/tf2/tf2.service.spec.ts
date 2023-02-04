import { Test, TestingModule } from '@nestjs/testing';
import { TF2Service } from './tf2.service';

describe('TF2Service', () => {
  let service: TF2Service;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: TF2Service,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<TF2Service>(TF2Service);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

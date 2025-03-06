import { Test, TestingModule } from '@nestjs/testing';
import { NestStorageService } from './nestjs-storage.service';

describe('NestStorageService', () => {
  let service: NestStorageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: NestStorageService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<NestStorageService>(NestStorageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

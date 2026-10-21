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

describe('NestStorageService concurrency', () => {
  it('limits concurrent reads to readConcurrency', async () => {
    const service = new NestStorageService({
      type: 'local',
      directory: '',
      readConcurrency: 4,
      writeConcurrency: 1,
    });

    let active = 0;
    let peak = 0;
    jest.spyOn(service.getEngine(), 'read').mockImplementation(async () => {
      peak = Math.max(peak, ++active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      return null;
    });

    await Promise.all(
      Array.from({ length: 50 }, (_, i) => service.read(`file_${i}`)),
    );

    expect(peak).toBe(4);
  });
});

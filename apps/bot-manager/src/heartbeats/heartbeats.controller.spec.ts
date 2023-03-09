import { Test, TestingModule } from '@nestjs/testing';
import { HeartbeatsController } from './heartbeats.controller';
import { HeartbeatsService } from './heartbeats.service';

describe('HeartbeatsController', () => {
  let controller: HeartbeatsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HeartbeatsController],
      providers: [
        {
          provide: HeartbeatsService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<HeartbeatsController>(HeartbeatsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

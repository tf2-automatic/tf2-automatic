import { Test, TestingModule } from '@nestjs/testing';
import { BotsController } from './bots.controller';
import { BotsService } from './bots.service';

describe('BotsController', () => {
  let controller: BotsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BotsController],
      providers: [
        {
          provide: BotsService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<BotsController>(BotsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

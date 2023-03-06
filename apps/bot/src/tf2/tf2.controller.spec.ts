import { Test, TestingModule } from '@nestjs/testing';
import { TF2Controller } from './tf2.controller';
import { TF2Service } from './tf2.service';

describe('TF2Controller', () => {
  let controller: TF2Controller;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TF2Controller],
      providers: [
        {
          provide: TF2Service,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<TF2Controller>(TF2Controller);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

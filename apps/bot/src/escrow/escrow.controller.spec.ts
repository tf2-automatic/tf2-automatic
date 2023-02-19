import { Test, TestingModule } from '@nestjs/testing';
import { EscrowController } from './escrow.controller';

describe('EscrowController', () => {
  let controller: EscrowController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EscrowController],
    }).compile();

    controller = module.get<EscrowController>(EscrowController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import SteamID from 'steamid';
import { MetadataService } from './metadata.service';

describe('MetadataService', () => {
  let service: MetadataService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MetadataService],
    }).compile();

    service = module.get<MetadataService>(MetadataService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return null if steamid is not set', () => {
    expect(service.getSteamID()).toBeNull();
  });

  it('should return steamid if steamid is set', () => {
    const steamid64 = '76561198120070906';
    service.setSteamID(new SteamID(steamid64));
    expect(service.getSteamID()?.getSteamID64()).toBe(steamid64);
  });
});

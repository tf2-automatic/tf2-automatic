import { Validator } from 'class-validator';
import { IsSteamID } from './is-steamid-validator';

class TestClass {
  @IsSteamID()
  steamid!: string;
}

describe('IsSteamIDValidator', () => {
  let validator = new Validator();

  beforeEach(() => {
    validator = new Validator();
  });

  it('should work with a valid steamid64', async () => {
    const testClass = new TestClass();
    testClass.steamid = '76561198120070906';

    const validationErrors = await validator.validate(testClass);

    expect(validationErrors).toHaveLength(0);
  });

  it('should fail with an invalid steamid64', async () => {
    const testClass = new TestClass();
    testClass.steamid = 'abc123';

    const validationErrors = await validator.validate(testClass);

    expect(validationErrors).toHaveLength(1);
  });
});

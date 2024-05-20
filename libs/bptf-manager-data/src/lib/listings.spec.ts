import { Validator } from 'class-validator';
import { ListingCurrenciesDto } from './listings';

describe('ListingCurrenciesDto', () => {
  let validator = new Validator();

  beforeEach(() => {
    validator = new Validator();
  });

  it('should fail with negative numbers', async () => {
    const testClass = new ListingCurrenciesDto();
    testClass.keys = -1;
    testClass.metal = -10.22;

    const validationErrors = await validator.validate(testClass);

    expect(validationErrors).toHaveLength(2);
  });

  it('should work with positive numbers', async () => {
    const testClass = new ListingCurrenciesDto();
    testClass.keys = 1;
    testClass.metal = 10.22;

    const validationErrors = await validator.validate(testClass);

    expect(validationErrors).toHaveLength(0);
  });

  it('should work with only refined', async () => {
    const testClass = new ListingCurrenciesDto();
    testClass.metal = 10.22;

    const validationErrors = await validator.validate(testClass);

    expect(validationErrors).toHaveLength(0);
  });

  it('should work with only keys', async () => {
    const testClass = new ListingCurrenciesDto();
    testClass.keys = 1;

    const validationErrors = await validator.validate(testClass);

    expect(validationErrors).toHaveLength(0);
  });
});

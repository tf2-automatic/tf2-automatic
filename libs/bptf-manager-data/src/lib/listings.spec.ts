import { plainToInstance } from 'class-transformer';
import { Validator } from 'class-validator';
import { AddListingDto, ListingCurrenciesDto } from './listings';

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

  it('should work with 1 key 0 metal', async () => {
    const testClass = new ListingCurrenciesDto();
    testClass.keys = 1;
    testClass.metal = 0;

    const validationErrors = await validator.validate(testClass);

    expect(validationErrors).toHaveLength(0);
  });

  it('should work with 0 keys 1 metal', async () => {
    const testClass = new ListingCurrenciesDto();
    testClass.keys = 0;
    testClass.metal = 1;

    const validationErrors = await validator.validate(testClass);

    expect(validationErrors).toHaveLength(0);
  });

  it('should work with 0 keys 0 metal', async () => {
    const testClass = new ListingCurrenciesDto();
    testClass.keys = 0;
    testClass.metal = 0;

    const validationErrors = await validator.validate(testClass);

    expect(validationErrors).toHaveLength(0);
  });
});

describe('AddListingDto', () => {
  const validator = new Validator();

  function create(details: string) {
    return plainToInstance(AddListingDto, {
      item: { defindex: 5021, quality: 6 },
      currencies: { metal: 0.11 },
      details,
    });
  }

  it('should work with 200 character details', async () => {
    const validationErrors = await validator.validate(create('a'.repeat(200)));

    expect(validationErrors).toHaveLength(0);
  });

  it('should fail with details longer than 200 characters', async () => {
    const validationErrors = await validator.validate(create('a'.repeat(201)));

    expect(validationErrors).toHaveLength(1);
    expect(validationErrors[0].property).toBe('details');
  });
});

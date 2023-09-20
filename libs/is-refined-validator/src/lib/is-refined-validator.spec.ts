import { Validator } from 'class-validator';
import { IsRefined } from './is-refined-validator';

class TestClass {
  @IsRefined()
  metal!: number;
}

describe('IsRefinedValidator', () => {
  let validator = new Validator();

  beforeEach(() => {
    validator = new Validator();
  });

  it('should work with 10.22', async () => {
    const testClass = new TestClass();
    testClass.metal = 10.22;

    const validationErrors = await validator.validate(testClass);

    expect(validationErrors).toHaveLength(0);
  });

  it('should work with 0.05', async () => {
    const testClass = new TestClass();
    testClass.metal = 0.05;

    const validationErrors = await validator.validate(testClass);

    expect(validationErrors).toHaveLength(0);
  });

  it('should fail with 10.5', async () => {
    const testClass = new TestClass();
    testClass.metal = 10.5;

    const validationErrors = await validator.validate(testClass);

    expect(validationErrors).toHaveLength(1);
  });

  it('should fail with 0.8', async () => {
    const testClass = new TestClass();
    testClass.metal = 0.8;

    const validationErrors = await validator.validate(testClass);

    expect(validationErrors).toHaveLength(1);
  });

  it('should fail with 10.99', async () => {
    const testClass = new TestClass();
    testClass.metal = 10.99;

    const validationErrors = await validator.validate(testClass);

    expect(validationErrors).toHaveLength(1);
  });
});

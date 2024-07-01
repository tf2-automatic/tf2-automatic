import Joi from 'joi';
import { addWhen } from './joi';

describe('joi', () => {
  test('it should add when conditions to existing rules', () => {
    const rules = {
      foo: Joi.string(),
      bar: Joi.string(),
    };

    addWhen(rules, ['foo'], {
      ref: 'bar',
      options: { is: Joi.string().valid('bar'), then: Joi.string().required() },
    });

    const schema = Joi.object(rules);

    expect(schema.validate({ foo: 'foo', bar: 'bar' }).error).toBeUndefined();
    expect(schema.validate({ bar: 'bar' }).error).toBeDefined();
    expect(schema.validate({ foo: 'foo' }).error).toBeUndefined();
  });
});

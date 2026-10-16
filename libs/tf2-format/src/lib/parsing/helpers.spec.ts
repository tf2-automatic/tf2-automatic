import { parseInputs } from './helpers';
import { DefindexByName, QualityByName } from '../schemas';

describe('parseInputs', () => {
  let schema: QualityByName & DefindexByName;

  beforeEach(() => {
    schema = {
      getQualityByName: jest.fn().mockReturnValue(6),
      fetchQualityByName: jest.fn(),
      getDefindexByName: jest.fn().mockReturnValue(undefined),
      fetchDefindexByName: jest.fn(),
    } as unknown as QualityByName & DefindexByName;
  });

  it('will fall back to the full name when the stripped name is not found', async () => {
    (schema.fetchDefindexByName as jest.Mock).mockImplementation(
      async (name: string) => (name === 'The Foo' ? 123 : null),
    );

    const inputs = await parseInputs(
      [{ name: 'The Foo', quantity: 1 }],
      schema,
    );

    expect(inputs).toEqual([{ quality: 6, quantity: 1, defindex: 123 }]);
  });

  it('will use the stripped name when it is found', async () => {
    (schema.fetchDefindexByName as jest.Mock).mockImplementation(
      async (name: string) => (name === 'Foo' ? 5 : null),
    );

    const inputs = await parseInputs(
      [{ name: 'The Foo', quantity: 1 }],
      schema,
    );

    expect(inputs).toEqual([{ quality: 6, quantity: 1, defindex: 5 }]);
    expect(schema.fetchDefindexByName).toHaveBeenCalledTimes(1);
    expect(schema.fetchDefindexByName).toHaveBeenCalledWith('Foo');
  });
});

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

  it('will fall back to the full name when the stripped name is cached as an error', async () => {
    (schema.getDefindexByName as jest.Mock).mockImplementation(
      (name: string) => (name === 'The Foo' ? 123 : new Error('Not found')),
    );

    const inputs = await parseInputs(
      [{ name: 'The Foo', quantity: 1 }],
      schema,
    );

    expect(inputs).toEqual([{ quality: 6, quantity: 1, defindex: 123 }]);
    expect(schema.fetchDefindexByName).not.toHaveBeenCalled();
  });

  it('will use a cached defindex of 0 for the stripped name', async () => {
    (schema.getDefindexByName as jest.Mock).mockImplementation(
      (name: string) => (name === 'Foo' ? 0 : undefined),
    );

    const inputs = await parseInputs(
      [{ name: 'The Foo', quantity: 1 }],
      schema,
    );

    expect(inputs).toEqual([{ quality: 6, quantity: 1, defindex: 0 }]);
    expect(schema.fetchDefindexByName).not.toHaveBeenCalled();
  });
});

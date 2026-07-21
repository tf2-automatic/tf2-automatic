import { metricAttributes, setDefaultMetricLabels } from './metrics';

describe('metric attributes', () => {
  beforeEach(() => {
    // Replace semantics: reset the process-global defaults between tests.
    setDefaultMetricLabels({});
  });

  test('returns the given labels when no defaults are set', () => {
    expect(metricAttributes({ type: 'sent' })).toEqual({ type: 'sent' });
  });

  test('returns an empty object with no labels and no defaults', () => {
    expect(metricAttributes()).toEqual({});
  });

  test('merges default attributes into every set', () => {
    setDefaultMetricLabels({ steamid64: '76561198000000000' });
    expect(metricAttributes({ type: 'sent' })).toEqual({
      steamid64: '76561198000000000',
      type: 'sent',
    });
    expect(metricAttributes()).toEqual({ steamid64: '76561198000000000' });
  });

  test('coerces null/undefined values to empty strings', () => {
    expect(metricAttributes({ status: null, other: undefined })).toEqual({
      status: '',
      other: '',
    });
  });

  test('setDefaultMetricLabels replaces (does not merge) previous defaults', () => {
    setDefaultMetricLabels({ a: '1' });
    setDefaultMetricLabels({ b: '2' });
    expect(metricAttributes()).toEqual({ b: '2' });
  });
});

import { type Attributes } from '@opentelemetry/api';

export type MetricLabels = Record<string, string | number | null | undefined>;

/**
 * Process-global default attributes (e.g. steamid64) merged into every
 * measurement via `metricAttributes()`. OpenTelemetry has no meter-level
 * default labels and the resource is fixed at SDK init (before Steam login), so
 * they are merged lazily at record time instead.
 */
let defaultAttributes: Attributes = {};

/**
 * Set default labels applied to every metric measurement built with
 * `metricAttributes()` (the OpenTelemetry analogue of prom-client's
 * `register.setDefaultLabels`, which replaces the previous set).
 */
export function setDefaultMetricLabels(labels: MetricLabels): void {
  defaultAttributes = sanitize(labels);
}

/**
 * Merge the given labels with the process-global default attributes, producing
 * attributes safe to pass to an OpenTelemetry instrument.
 */
export function metricAttributes(labels?: MetricLabels): Attributes {
  return { ...defaultAttributes, ...sanitize(labels) };
}

/**
 * OpenTelemetry attribute values must be string | number | boolean. Coerce
 * null/undefined (e.g. an absent HTTP status) to an empty string, matching
 * prom-client's behavior of rendering absent labels as empty.
 */
function sanitize(labels?: MetricLabels): Attributes {
  const out: Attributes = {};
  if (labels) {
    for (const [key, value] of Object.entries(labels)) {
      out[key] = value ?? '';
    }
  }
  return out;
}

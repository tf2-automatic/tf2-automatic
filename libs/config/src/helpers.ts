type ParsedValue<T> = T extends 'string'
? string | undefined
: T extends 'float'
  ? number | undefined
  : T extends 'integer'
    ? number | undefined
    : T extends 'boolean'
      ? boolean
      : never;

type ParsedValueWithDefault<T> = T extends 'string'
  ? string
  : T extends 'float'
    ? number
    : T extends 'integer'
      ? number
      : T extends 'boolean'
        ? boolean
        : never;

export function getEnv<T extends 'string' | 'float' | 'integer' | 'boolean'>(
  key: string,
  type: T,
): ParsedValue<T> {
  const value = process.env[key];

  if (type === 'string') {
    return value as ParsedValue<T>;
  } else if (type === 'boolean') {
    return (value === 'true') as ParsedValue<T>;
  }

  // Check if value is undefined because we do not want to parse it
  if (value === undefined) {
    return undefined as ParsedValue<T>;
  }

  if (type === 'float') {
    return parseFloat(value) as ParsedValue<T>;
  } else if (type === 'integer') {
    return parseInt(value, 10) as ParsedValue<T>;
  }

  throw new Error(`Invalid type: ${type}`);
}

export function getEnvWithDefault<T extends 'string' | 'float' | 'integer' | 'boolean'>(
  key: string,
  type: T,
  defaultValue: ParsedValueWithDefault<T>,
): ParsedValueWithDefault<T> {
  const value = getEnv(key, type);

  if (value === undefined) {
    return defaultValue;
  }

  return value as ParsedValueWithDefault<T>;
}

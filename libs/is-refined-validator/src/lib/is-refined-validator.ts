import { buildMessage, ValidateBy, ValidationOptions } from 'class-validator';
import { toRefined, toScrap } from 'tf2-currencies';

export function isRefined(value: unknown) {
  if (typeof value !== 'number') {
    return false;
  }

  const refined = toRefined(toScrap(value));

  return refined === value;
}

export function IsRefined(validationOptions?: ValidationOptions) {
  return ValidateBy({
    name: 'IsRefined',
    validator: {
      validate: (value): boolean => isRefined(value),
      defaultMessage: buildMessage(
        (eachPrefix) => eachPrefix + '$property must be in refined',
        validationOptions,
      ),
    },
  });
}

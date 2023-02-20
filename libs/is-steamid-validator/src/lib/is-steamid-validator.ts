import { buildMessage, ValidateBy, ValidationOptions } from 'class-validator';
import SteamID from 'steamid';

export function isSteamID(value: unknown) {
  let steamid: SteamID | null = null;
  if (value instanceof SteamID) {
    steamid = value;
  } else {
    try {
      steamid = new SteamID((value ?? '').toString());
    } catch (err) {
      return false;
    }
  }

  return steamid.isValid();
}

export function IsSteamID(validationOptions?: ValidationOptions) {
  return ValidateBy({
    name: 'IsSteamID',
    validator: {
      validate: (value): boolean => isSteamID(value),
      defaultMessage: buildMessage(
        (eachPrefix) => eachPrefix + '$property must be a SteamID',
        validationOptions
      ),
    },
  });
}

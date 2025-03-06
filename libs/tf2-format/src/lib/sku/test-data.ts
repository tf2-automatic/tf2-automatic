import { RequiredItemAttributes } from '../types';

export function getBasicItem(): RequiredItemAttributes {
  return {
    defindex: 5021,
    quality: 6,
  };
}

export function getAustraliumItem(): RequiredItemAttributes {
  return {
    defindex: 211,
    quality: 11,
    australium: true,
    killstreak: 3,
  };
}

export function getBasicSKU(): string {
  return '5021;6';
}

export function getAustraliumSKU(): string {
  return '211;11;australium;kt-3';
}

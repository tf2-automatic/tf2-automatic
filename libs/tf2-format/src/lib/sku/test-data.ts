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

export function getProfessionalBigKillItem(): RequiredItemAttributes {
  return {
    defindex: 161,
    quality: 6,
    killstreak: 3,
    sheen: 1,
    killstreaker: 2005,
  };
}

export function getPaintedUnusualItem(): RequiredItemAttributes {
  return {
    defindex: 378,
    quality: 5,
    effect: 13,
    paint: 16738740,
  };
}

export function getRedRockRoscoePistolItem(): RequiredItemAttributes {
  return {
    defindex: 15013,
    quality: 15,
    wear: 1,
    paintkit: 0,
  };
}

export function getBasicSKU(): string {
  return '5021;6';
}

export function getAustraliumSKU(): string {
  return '211;11;australium;kt-3';
}

export function getProfessionalBigKillSKU(): string {
  return '161;6;kt-3;ks-1;ke-2005';
}

export function getPaintedUnusualSKU(): string {
  return '378;5;u13;p16738740';
}

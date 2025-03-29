import { Redis } from "./connections";
import { getEnvWithDefault } from "./helpers";

export interface RelayConfig {
  leaderTimeout: number;
  leaderRenewTimeout: number;
}

export interface RelayModuleConfig {
  relay: RelayConfig;
  redis: Redis.Config;
}

export function getRelayConfig() {
  return {
    leaderTimeout: getEnvWithDefault('LEADER_TIMEOUT', 'integer', 5000),
    leaderRenewTimeout: getEnvWithDefault(
      'LEADER_RENEW_TIMEOUT',
      'integer',
      10000,
    ),
  };
}
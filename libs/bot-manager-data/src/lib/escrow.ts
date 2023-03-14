export interface EscrowResponse {
  cached: boolean;
  timestamp: number;
  escrowDays: number;
}

export const ESCROW_BASE_URL = '/escrow';
export const ESCROW_PATH = '/:steamid';

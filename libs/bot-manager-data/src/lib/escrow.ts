export interface EscrowResponse {
  cached: boolean;
  timestamp: number;
  escrowDays: number;
}

export const ESCROW_BASE_URL = '/escrow';
export const ESCROW_PATH = '/:steamid';

export const ESCROW_FULL_PATH = `${ESCROW_BASE_URL}${ESCROW_PATH}`;

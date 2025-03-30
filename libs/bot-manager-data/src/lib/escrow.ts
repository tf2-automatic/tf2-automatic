export interface EscrowResponse {
  timestamp: number;
  ttl: number;
  escrowDays: number;
}

export const ESCROW_BASE_URL = '/escrow';
export const ESCROW_PATH = '/:steamid';
export const ESCROW_QUEUE_PATH = ESCROW_PATH + '/queue';
export const ESCROW_FETCH_PATH = ESCROW_PATH + '/fetch';

export const ESCROW_FULL_PATH = `${ESCROW_BASE_URL}${ESCROW_PATH}`;

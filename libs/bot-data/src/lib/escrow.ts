export const ESCROW_BASE_URL = '/escrow';
export const ESCROW_GET_DURATION = '/:steamid';

export const ESCROW_FULL_PATH = `${ESCROW_BASE_URL}${ESCROW_GET_DURATION}`;

export interface GetEscrowResponse {
  escrowDays: number;
}

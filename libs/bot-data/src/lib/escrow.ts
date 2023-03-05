export const ESCROW_BASE_URL = 'escrow';
export const ESCROW_GET_DURATION = '/:steamid';

export interface GetEscrowResponse {
  escrowDays: number;
}

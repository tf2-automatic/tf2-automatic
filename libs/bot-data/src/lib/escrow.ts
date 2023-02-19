export const ESCROW_BASE_PATH = 'escrow';
export const ESCROW_GET_ESCROW_DURATION = '/:steamid';

export interface GetEscrowResponse {
  escrowDays: number;
}

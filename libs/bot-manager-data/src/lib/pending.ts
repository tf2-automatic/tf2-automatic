export const PENDING_BASE_URL = '/pending';
export const PENDING_PATH = '/:steamid';

export const PENDING_FULL_PATH = `${PENDING_BASE_URL}${PENDING_PATH}`;

export interface PendingResponse {
  gain: Record<string, number>;
  lose: Record<string, number>;
}

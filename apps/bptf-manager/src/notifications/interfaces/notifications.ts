import { Notification } from '@tf2-automatic/bptf-manager-data';

export interface GetNotificationsResponse {
  results: Notification[];
  cursor: {
    skip: number;
    limit: number;
    total: number;
  };
}

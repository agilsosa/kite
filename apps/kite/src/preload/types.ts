import type { KiteApi } from '../shared/types';

declare global {
  interface Window {
    api: KiteApi;
  }
}

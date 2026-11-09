/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />

declare module '*.css';

declare module 'node-wifi' {
  export interface NodeWifiNetwork {
    ssid: string;
    signal_level: number;
    quality?: number;
    security: string;
  }

  interface NodeWifi {
    init: (options?: { iface?: string | null; debug?: boolean }) => void;
    scan: () => Promise<NodeWifiNetwork[]>;
    connect: (options: { ssid: string; password?: string }) => Promise<void>;
    disconnect: () => Promise<void>;
    getCurrentConnections: () => Promise<NodeWifiNetwork[]>;
  }

  const wifi: NodeWifi;
  export default wifi;
}

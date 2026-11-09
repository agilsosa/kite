import wifi from 'node-wifi';
import type { WifiNetwork, WifiStatus } from '../shared/types';

let initialized = false;

function ensureInitialized() {
  if (!initialized) {
    wifi.init({ iface: null });
    initialized = true;
  }
}

function signalPercent(network: {
  signal_level?: number;
  quality?: number;
}): number {
  if (typeof network.quality === 'number' && Number.isFinite(network.quality)) {
    return Math.max(0, Math.min(100, Math.round(network.quality)));
  }

  if (
    typeof network.signal_level === 'number' &&
    Number.isFinite(network.signal_level)
  ) {
    // node-wifi reports dBm on Linux and macOS; convert it to a percentage.
    if (network.signal_level <= 0) {
      return Math.max(
        0,
        Math.min(100, Math.round(2 * (network.signal_level + 100))),
      );
    }

    return Math.max(0, Math.min(100, Math.round(network.signal_level)));
  }

  return 0;
}

function sanitizeNetwork(network: {
  ssid?: string;
  signal_level?: number;
  quality?: number;
  security?: string;
}): WifiNetwork | null {
  const ssid = typeof network.ssid === 'string' ? network.ssid.trim() : '';

  if (!ssid) {
    return null;
  }

  return {
    ssid,
    signal: signalPercent(network),
    security:
      typeof network.security === 'string' && network.security.length > 0
        ? network.security
        : 'Open',
    connected: false,
  };
}

export async function scanWifiNetworks(): Promise<WifiNetwork[]> {
  ensureInitialized();

  try {
    const [networks, connections] = await Promise.all([
      wifi.scan(),
      wifi.getCurrentConnections().catch(() => []),
    ]);
    const connectedSsids = new Set(
      connections.map((network) => network.ssid).filter(Boolean),
    );
    const seen = new Set<string>();

    return networks
      .map(sanitizeNetwork)
      .filter((network): network is WifiNetwork => network !== null)
      .filter((network) => {
        if (seen.has(network.ssid)) {
          return false;
        }

        seen.add(network.ssid);
        return true;
      })
      .map((network) => ({
        ...network,
        connected: connectedSsids.has(network.ssid),
      }))
      .sort(
        (a, b) =>
          Number(b.connected) - Number(a.connected) || b.signal - a.signal,
      );
  } catch {
    throw new Error(
      'El escaneo de Wi-Fi no está disponible. Comprueba que NetworkManager esté en ejecución.',
    );
  }
}

export async function connectWifi(
  ssid: string,
  password: string,
): Promise<void> {
  ensureInitialized();

  if (
    typeof ssid !== 'string' ||
    ssid.trim().length === 0 ||
    ssid.length > 64
  ) {
    throw new Error('Elige una red Wi-Fi válida');
  }

  if (typeof password !== 'string' || password.length > 128) {
    throw new Error('La contraseña de Wi-Fi es demasiado larga');
  }

  try {
    await wifi.connect({
      ssid: ssid.trim(),
      ...(password.length > 0 ? { password } : {}),
    });
  } catch {
    throw new Error('No se pudo conectar a esa red Wi-Fi');
  }
}

export async function disconnectWifi(): Promise<void> {
  ensureInitialized();

  try {
    await wifi.disconnect();
  } catch {
    throw new Error('No se pudo desconectar del Wi-Fi');
  }
}

export async function getWifiStatus(): Promise<WifiStatus> {
  ensureInitialized();

  try {
    const connections = await wifi.getCurrentConnections();
    const ssid =
      connections
        .map((network) => network.ssid)
        .find(
          (value): value is string =>
            typeof value === 'string' && value.length > 0,
        ) ?? null;

    return { connected: ssid !== null, ssid };
  } catch {
    return { connected: false, ssid: null };
  }
}

import { execFile } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import type { BatteryStatus } from '../shared/types';

const execFileAsync = promisify(execFile);

const NO_BATTERY: BatteryStatus = { level: null, charging: false };
const LINUX_POWER_SUPPLY = '/sys/class/power_supply';
const CACHE_MS = 15_000;

let cached: { at: number; status: BatteryStatus } | null = null;

function clampLevel(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

async function readText(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
}

/** Reads a percentage from a sysfs `capacity` file or a CLI field. */
export function parseLevel(raw: string | null | undefined): number | null {
  if (!raw) {
    return null;
  }

  const value = Number.parseFloat(raw.trim());

  return Number.isFinite(value) ? clampLevel(value) : null;
}

function ratioLevel(
  nowRaw: string | null | undefined,
  fullRaw: string | null | undefined,
): number | null {
  const now = Number.parseFloat(nowRaw?.trim() ?? '');
  const full = Number.parseFloat(fullRaw?.trim() ?? '');

  if (!Number.isFinite(now) || !Number.isFinite(full) || full <= 0) {
    return null;
  }

  return clampLevel((now / full) * 100);
}

/** `Full` means plugged in, so it charges like `Charging` for the indicator. */
function isPluggedStatus(status: string): boolean {
  return /^(charging|full)$/i.test(status.trim());
}

async function linuxBattery(): Promise<BatteryStatus> {
  let entries: string[];

  try {
    entries = await readdir(LINUX_POWER_SUPPLY);
  } catch {
    return upowerBattery();
  }

  // Prefer BAT0/BAT1 order, and skip AC adapters and other power supplies.
  entries.sort((left, right) => left.localeCompare(right));

  for (const entry of entries) {
    const dir = `${LINUX_POWER_SUPPLY}/${entry}`;
    const [type, present] = await Promise.all([
      readText(`${dir}/type`),
      readText(`${dir}/present`),
    ]);

    if (type?.trim() !== 'Battery') {
      continue;
    }

    if (present !== null && present.trim() === '0') {
      continue;
    }

    const capacity =
      parseLevel(await readText(`${dir}/capacity`)) ??
      ratioLevel(
        await readText(`${dir}/energy_now`),
        await readText(`${dir}/energy_full`),
      ) ??
      ratioLevel(
        await readText(`${dir}/charge_now`),
        await readText(`${dir}/charge_full`),
      );

    if (capacity === null) {
      continue;
    }

    const status = (await readText(`${dir}/status`))?.trim() ?? '';

    return { level: capacity, charging: isPluggedStatus(status) };
  }

  // Some systems only expose the battery through UPower.
  return upowerBattery();
}

async function upowerBattery(): Promise<BatteryStatus> {
  try {
    const { stdout: devices } = await execFileAsync('upower', ['-e'], {
      timeout: 4_000,
    });
    const device = devices
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.includes('/battery_'));

    if (!device) {
      return NO_BATTERY;
    }

    const { stdout } = await execFileAsync('upower', ['-i', device], {
      timeout: 4_000,
    });
    const level = parseLevel(/percentage:\s*([\d.]+)%/i.exec(stdout)?.[1]);

    if (level === null) {
      return NO_BATTERY;
    }

    const state = /state:\s*(\S+)/i.exec(stdout)?.[1] ?? '';

    return {
      level,
      charging: /^(charging|fully-charged|pending-charge)$/i.test(state),
    };
  } catch {
    return NO_BATTERY;
  }
}

interface WindowsBatterySample {
  EstimatedChargeRemaining?: number | string | null;
  BatteryStatus?: number | string | null;
}

/**
 * `Win32_Battery.BatteryStatus` values that mean the device is plugged in and
 * charging (or already full).
 */
const WINDOWS_PLUGGED_STATUSES = new Set([3, 6, 7, 8, 9]);

export function parseWindowsBattery(raw: string): BatteryStatus {
  const trimmed = raw.trim();

  if (!trimmed) {
    return NO_BATTERY;
  }

  let parsed: WindowsBatterySample | WindowsBatterySample[];

  try {
    parsed = JSON.parse(trimmed) as
      | WindowsBatterySample
      | WindowsBatterySample[];
  } catch {
    return NO_BATTERY;
  }

  const sample = Array.isArray(parsed) ? parsed[0] : parsed;
  const level = parseLevel(
    sample?.EstimatedChargeRemaining === null ||
      sample?.EstimatedChargeRemaining === undefined
      ? null
      : String(sample.EstimatedChargeRemaining),
  );

  if (level === null) {
    return NO_BATTERY;
  }

  const status = Number(sample?.BatteryStatus);

  return { level, charging: WINDOWS_PLUGGED_STATUSES.has(status) };
}

async function windowsBattery(): Promise<BatteryStatus> {
  const script = [
    '$ErrorActionPreference = "Stop"',
    '$battery = Get-CimInstance -ClassName Win32_Battery -ErrorAction Stop | Select-Object -First 1 -Property EstimatedChargeRemaining, BatteryStatus',
    'if ($null -ne $battery) { $battery | ConvertTo-Json -Compress }',
  ].join('; ');

  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script],
    { timeout: 10_000, windowsHide: true, maxBuffer: 64 * 1024 },
  );

  return parseWindowsBattery(stdout);
}

export function parseMacBattery(output: string): BatteryStatus {
  const level = parseLevel(/(\d+)%/.exec(output)?.[1]);

  if (level === null) {
    return NO_BATTERY;
  }

  const charging =
    /;\s*(charging|charged|AC attached)/i.test(output) &&
    !/discharging/i.test(output);

  return { level, charging };
}

async function macBattery(): Promise<BatteryStatus> {
  const { stdout } = await execFileAsync('pmset', ['-g', 'batt'], {
    timeout: 4_000,
  });

  return parseMacBattery(stdout);
}

async function readBatteryStatus(): Promise<BatteryStatus> {
  switch (process.platform) {
    case 'linux':
      return linuxBattery();
    case 'win32':
      return windowsBattery();
    case 'darwin':
      return macBattery();
    default:
      return NO_BATTERY;
  }
}

/**
 * Reads the battery percentage and charging state. Returns `level: null` when
 * the machine has no battery, so the renderer can hide the indicator.
 */
export async function getBatteryStatus(): Promise<BatteryStatus> {
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return cached.status;
  }

  let status = NO_BATTERY;

  try {
    status = await readBatteryStatus();
  } catch {
    // A missing sysfs entry, blocked UPower, or a failed PowerShell call just
    // means the indicator stays hidden.
  }

  cached = { at: Date.now(), status };

  return status;
}

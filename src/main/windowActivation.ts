import { execFile } from 'node:child_process';
import path from 'node:path';

const WINDOWS_ENABLED = process.platform === 'win32';
const POWERSHELL = path.join(
  process.env['SystemRoot'] ?? 'C:\\Windows',
  'System32',
  'WindowsPowerShell',
  'v1.0',
  'powershell.exe',
);

/**
 * Bring an existing Windows app window to the foreground. Electron has no API
 * for focusing windows owned by other processes, so this asks Windows through
 * a short PowerShell script. The window is matched by executable name, which
 * also covers launchers that hand the real window to a child process.
 */
const ACTIVATE_SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class KiteWindowActivation
{
    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc callback, IntPtr extraData);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern IntPtr GetWindow(IntPtr hWnd, uint command);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetWindowTextLength(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool ShowWindowAsync(IntPtr hWnd, int command);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool BringWindowToTop(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern bool AttachThreadInput(uint attach, uint attachTo, bool enable);

    [DllImport("kernel32.dll")]
    public static extern uint GetCurrentThreadId();

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr extraData);

    public static bool Activate(string[] names)
    {
        string[] wanted = new string[names.Length];
        for (int i = 0; i < names.Length; i++)
        {
            wanted[i] = names[i].Trim().ToLowerInvariant();
        }

        IntPtr target = IntPtr.Zero;

        EnumWindows(delegate(IntPtr hWnd, IntPtr extraData)
        {
            if (!IsWindowVisible(hWnd)) return true;
            if (GetWindow(hWnd, 4) != IntPtr.Zero) return true;
            if (GetWindowTextLength(hWnd) == 0) return true;

            uint processId;
            GetWindowThreadProcessId(hWnd, out processId);

            try
            {
                string processName = System.Diagnostics.Process
                    .GetProcessById((int)processId)
                    .ProcessName
                    .ToLowerInvariant();

                if (Array.IndexOf(wanted, processName) < 0) return true;
            }
            catch
            {
                return true;
            }

            target = hWnd;
            return false;
        }, IntPtr.Zero);

        if (target == IntPtr.Zero) return false;

        uint foregroundProcessId;
        IntPtr foreground = GetForegroundWindow();
        uint foregroundThread = foreground == IntPtr.Zero
            ? 0
            : GetWindowThreadProcessId(foreground, out foregroundProcessId);

        uint targetProcessId;
        uint targetThread = GetWindowThreadProcessId(target, out targetProcessId);
        uint currentThread = GetCurrentThreadId();

        bool attachedForeground = foregroundThread != 0 && foregroundThread != currentThread;
        bool attachedTarget = targetThread != 0 && targetThread != currentThread;

        if (attachedForeground) AttachThreadInput(currentThread, foregroundThread, true);
        if (attachedTarget) AttachThreadInput(currentThread, targetThread, true);

        if (IsIconic(target)) ShowWindowAsync(target, 9);
        BringWindowToTop(target);
        SetForegroundWindow(target);

        if (attachedTarget) AttachThreadInput(currentThread, targetThread, false);
        if (attachedForeground) AttachThreadInput(currentThread, foregroundThread, false);

        return true;
    }
}
'@
$names = [string[]]@([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('__NAMES__')) | ConvertFrom-Json)
if ([KiteWindowActivation]::Activate($names)) { Write-Output 'activated' } else { Write-Output 'missing' }
`;

function runPowerShell(script: string): Promise<string> {
  const encoded = Buffer.from(script, 'utf16le').toString('base64');

  return new Promise((resolve, reject) => {
    execFile(
      POWERSHELL,
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-EncodedCommand',
        encoded,
      ],
      { timeout: 5000, windowsHide: true },
      (error, stdout) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout);
        }
      },
    );
  });
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function focusWindowsApp(appPath: string): Promise<boolean> {
  if (!WINDOWS_ENABLED) {
    return false;
  }

  const name = path
    .basename(appPath, path.extname(appPath))
    .trim()
    .toLowerCase();

  if (name.length === 0) {
    return false;
  }

  const names = Buffer.from(JSON.stringify([name]), 'utf8').toString('base64');
  const script = ACTIVATE_SCRIPT.replace('__NAMES__', names);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      if ((await runPowerShell(script)).trim() === 'activated') {
        return true;
      }
    } catch {
      // PowerShell might be unavailable; the caller can decide what to do.
    }

    if (attempt < 2) {
      await sleep(250);
    }
  }

  return false;
}

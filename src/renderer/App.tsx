import { Origami } from 'lucide-react';
import { useCallback, useState } from 'react';
import type { PublicApp, PublicConfig } from '../shared/types';
import { ParentGateDialog } from './components/ParentGateDialog';
import { VirtualKeyboard } from './components/VirtualKeyboard';
import { ParentSettingsDialog } from './components/settings/ParentSettingsDialog';
import { useBatteryStatus } from './hooks/useBatteryStatus';
import { useKioskConfig } from './hooks/useKioskConfig';
import { useParentStatus } from './hooks/useParentStatus';
import { useVolume } from './hooks/useVolume';
import { useWifiStatus } from './hooks/useWifiStatus';
import { errorMessage } from './lib/format';
import { HomeScreen, type HomeNotice } from './screens/HomeScreen';
import { Button } from './components/Button';
import { Taskbar } from './Taskbar';

function LoadingScreen({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <main className="grid min-h-full place-items-center p-8">
      <div className="max-w-md rounded-[2rem] border-4 border-ink bg-paper p-8 text-center shadow-kite">
        <Origami
          aria-hidden="true"
          className="mx-auto h-16 w-16 text-coral"
          strokeWidth={1.8}
        />
        <h1 className="mt-4 text-4xl font-black tracking-tight">Kite</h1>
        {error ? (
          <>
            <p className="mt-3 font-bold text-coral" role="alert">
              {error}
            </p>
            <Button className="mt-6" onClick={onRetry}>
              Reintentar
            </Button>
          </>
        ) : (
          <p className="mt-3 font-bold text-ink-soft" role="status">
            Preparando todo…
          </p>
        )}
      </div>
    </main>
  );
}

export function App() {
  const {
    config,
    error: configError,
    reload: reloadConfig,
    setConfig,
  } = useKioskConfig();
  const { status: parentStatus, refresh: refreshParent } = useParentStatus();
  const {
    volume,
    error: volumeError,
    refresh: refreshVolume,
    setLevel,
    setMuted,
  } = useVolume();
  const { status: wifi, refresh: refreshWifi } = useWifiStatus();
  const { status: battery } = useBatteryStatus();

  const [gateOpen, setGateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notice, setNotice] = useState<HomeNotice | null>(null);

  const openGate = useCallback(() => {
    setNotice(null);
    setGateOpen(true);
  }, []);

  const handleUnlocked = useCallback(() => {
    setGateOpen(false);
    setSettingsOpen(true);
    void refreshParent();
  }, [refreshParent]);

  const handleSettingsOpenChange = useCallback(
    (open: boolean) => {
      setSettingsOpen(open);

      if (!open) {
        void window.api.parent.lock().then(refreshParent);
      }
    },
    [refreshParent],
  );

  const handleConfigSaved = useCallback(
    (next: PublicConfig) => {
      setConfig(next);
      void refreshVolume();
      setNotice({
        tone: 'success',
        message: 'Ajustes de adultos guardados.',
      });
    },
    [refreshVolume, setConfig],
  );

  const launchApp = useCallback(async (app: PublicApp) => {
    setNotice(null);

    try {
      await window.api.apps.launch(app.id);
    } catch (cause) {
      setNotice({ tone: 'error', message: errorMessage(cause) });
    }
  }, []);

  const openWebsite = useCallback(async (origin: string) => {
    setNotice(null);

    try {
      await window.api.web.open(origin);
    } catch (cause) {
      setNotice({ tone: 'error', message: errorMessage(cause) });
    }
  }, []);

  const openFiles = useCallback(async () => {
    setNotice(null);

    try {
      await window.api.files.open();
    } catch (cause) {
      setNotice({ tone: 'error', message: errorMessage(cause) });
    }
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-paper text-ink">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {config ? (
          <HomeScreen
            battery={battery}
            config={config}
            notice={notice}
            onDismissNotice={() => setNotice(null)}
            onLaunchApp={(app) => void launchApp(app)}
            onMute={(muted) => void setMuted(muted)}
            onOpenFiles={() => void openFiles()}
            onOpenWebsite={(origin) => void openWebsite(origin)}
            onRefreshVolume={() => void refreshVolume()}
            onRefreshWifi={() => void refreshWifi()}
            onSetVolume={(level) => void setLevel(level)}
            volume={volume}
            volumeError={volumeError}
            wifi={wifi}
          />
        ) : (
          <LoadingScreen
            error={configError}
            onRetry={() => void reloadConfig()}
          />
        )}
      </div>

      <Taskbar onRequestParent={openGate} />

      {config ? (
        <>
          <ParentGateDialog
            hasPin={parentStatus.hasPin}
            onOpenChange={setGateOpen}
            onUnlocked={handleUnlocked}
            open={gateOpen}
          />

          <ParentSettingsDialog
            config={config}
            onOpenChange={handleSettingsOpenChange}
            onSaved={handleConfigSaved}
            open={settingsOpen}
          />
        </>
      ) : null}

      {config?.childKeyboard ? <VirtualKeyboard /> : null}
    </div>
  );
}

export default App;

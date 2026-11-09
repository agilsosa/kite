import type {
  BatteryStatus,
  PublicApp,
  PublicConfig,
  VolumeState,
  WifiStatus,
} from '../../shared/types';
import { AppTile } from '../components/AppTile';
import { Button } from '../components/Button';
import { TopBar } from '../components/TopBar';
import { WebTile } from '../components/WebTile';

const FILES_APP: PublicApp = {
  id: 'files',
  name: 'Archivos',
  icon: 'folder',
};

export interface HomeNotice {
  tone: 'error' | 'success';
  message: string;
}

interface HomeScreenProps {
  battery: BatteryStatus;
  config: PublicConfig;
  volume: VolumeState;
  volumeError: string | null;
  wifi: WifiStatus;
  notice: HomeNotice | null;
  onDismissNotice: () => void;
  onLaunchApp: (app: PublicApp) => void;
  onOpenWebsite: (origin: string) => void;
  onOpenFiles: () => void;
  onRefreshVolume: () => void;
  onRefreshWifi: () => void;
  onSetVolume: (level: number) => void;
  onMute: (muted: boolean) => void;
}

function EmptyState({ children }: { children: string }) {
  return (
    <p className="rounded-[1.75rem] border-4 border-dashed border-ink/25 bg-white/40 p-6 text-lg font-bold text-ink-soft">
      {children}
    </p>
  );
}

export function HomeScreen({
  battery,
  config,
  volume,
  volumeError,
  wifi,
  notice,
  onDismissNotice,
  onLaunchApp,
  onOpenWebsite,
  onOpenFiles,
  onRefreshVolume,
  onRefreshWifi,
  onSetVolume,
  onMute,
}: HomeScreenProps) {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-10 px-6 py-8 sm:px-10 lg:px-14">
      <TopBar
        battery={battery}
        childName={config.childName}
        onMute={onMute}
        onRefreshVolume={onRefreshVolume}
        onRefreshWifi={onRefreshWifi}
        onSetVolume={onSetVolume}
        volume={volume}
        volumeError={volumeError}
        wifi={wifi}
      />

      {notice ? (
        <div
          className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border-4 p-4 font-bold ${
            notice.tone === 'error'
              ? 'border-coral bg-coral/10 text-[#8f2c12]'
              : 'border-leaf bg-leaf/10 text-ink'
          }`}
          role={notice.tone === 'error' ? 'alert' : 'status'}
        >
          <p>{notice.message}</p>
          <Button onClick={onDismissNotice} variant="ghost">
            Cerrar
          </Button>
        </div>
      ) : null}

      <section aria-labelledby="apps-heading" className="flex flex-col gap-5">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-3xl font-black tracking-tight" id="apps-heading">
            Aplicaciones
          </h2>
          <p className="text-sm font-bold text-ink-soft">
            Elige algo para jugar
          </p>
        </div>

        <ul className="grid list-none grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-4">
          {config.allowedApps.map((app, index) => (
            <li className="min-w-0" key={app.id}>
              <AppTile
                app={app}
                index={index}
                onLaunch={() => onLaunchApp(app)}
              />
            </li>
          ))}
          <li className="min-w-0">
            <AppTile
              app={FILES_APP}
              index={config.allowedApps.length}
              onLaunch={onOpenFiles}
            />
          </li>
        </ul>
      </section>

      <section
        aria-labelledby="websites-heading"
        className="flex flex-col gap-5"
      >
        <div className="flex items-baseline justify-between gap-4">
          <h2
            className="text-3xl font-black tracking-tight"
            id="websites-heading"
          >
            Sitios web
          </h2>
          <p className="text-sm font-bold text-ink-soft">
            Sitios seguros elegidos por un adulto
          </p>
        </div>

        {config.allowedOrigins.length === 0 ? (
          <EmptyState>
            Aún no hay sitios web. Pide a un adulto que añada uno en los ajustes
            de adultos.
          </EmptyState>
        ) : (
          <ul className="grid list-none grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-4">
            {config.allowedOrigins.map((origin) => (
              <li className="min-w-0" key={origin}>
                <WebTile onOpen={() => onOpenWebsite(origin)} origin={origin} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

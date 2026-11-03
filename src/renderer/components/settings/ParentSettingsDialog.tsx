import { Tabs } from '@base-ui/react/tabs';
import { useEffect, useRef, useState } from 'react';
import type {
  AllowedApp,
  ConfigUpdate,
  PublicConfig,
  SyncResult,
} from '../../../shared/types';
import { errorMessage } from '../../lib/format';
import { Button } from '../Button';
import { Modal } from '../Modal';
import { AppsSettings } from './AppsSettings';
import { DeviceSettings } from './DeviceSettings';
import { SyncSettings } from './SyncSettings';
import { WebsitesSettings } from './WebsitesSettings';

interface ParentSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: PublicConfig;
  onSaved: (config: PublicConfig) => void;
}

const tabClass =
  'min-h-12 rounded-xl px-4 py-2 text-base font-extrabold text-ink-soft transition hover:bg-ink/10 data-[active]:bg-ink data-[active]:text-paper';

export function ParentSettingsDialog({
  open,
  onOpenChange,
  config,
  onSaved,
}: ParentSettingsDialogProps) {
  const [childName, setChildName] = useState(config.childName);
  const [apps, setApps] = useState<AllowedApp[]>([]);
  const [origins, setOrigins] = useState(config.allowedOrigins);
  const [volumeCap, setVolumeCap] = useState(config.volumeCap);
  const [loadingApps, setLoadingApps] = useState(false);
  const [appsLoaded, setAppsLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const appsRequestId = useRef(0);

  useEffect(() => {
    if (!open) {
      appsRequestId.current += 1;
      setApps([]);
      setAppsLoaded(false);
      setLoadingApps(false);
      return;
    }

    setChildName(config.childName);
    setOrigins(config.allowedOrigins);
    setVolumeCap(config.volumeCap);
    setApps([]);
    setLoadingApps(true);
    setAppsLoaded(false);
    setError(null);
    setSaved(false);

    let cancelled = false;
    const requestId = ++appsRequestId.current;

    window.api.config
      .getEditableApps()
      .then((editableApps) => {
        if (!cancelled && requestId === appsRequestId.current) {
          setApps(editableApps);
          setAppsLoaded(true);
          setLoadingApps(false);
        }
      })
      .catch((cause) => {
        if (!cancelled && requestId === appsRequestId.current) {
          setError(errorMessage(cause));
          setLoadingApps(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // Only re-initialise when the dialog opens; saving updates the config prop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = async () => {
    if (!appsLoaded) {
      setError(
        'Las aplicaciones todavía se están cargando. Cierra y vuelve a desbloquear si sigue así.',
      );
      return;
    }

    setSaving(true);
    setError(null);
    setSaved(false);

    const update: ConfigUpdate = {
      childName,
      allowedApps: apps,
      allowedOrigins: origins,
      volumeCap,
    };

    try {
      const next = await window.api.config.update(update);
      onSaved(next);
      setSaved(true);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  const applySync = (result: SyncResult) => {
    appsRequestId.current += 1;
    onSaved(result.config);
    setChildName(result.config.childName);
    setOrigins(result.config.allowedOrigins);
    setVolumeCap(result.config.volumeCap);
    setApps(result.apps);
    setAppsLoaded(true);
    setLoadingApps(false);
    setError(null);
    setSaved(true);
  };

  return (
    <Modal
      className="max-w-5xl"
      description="Gestiona las aplicaciones, los sitios web y el límite de volumen de este equipo."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} variant="secondary">
            Cerrar
          </Button>
          <Button disabled={saving || !appsLoaded} onClick={() => void save()}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </>
      }
      modal="trap-focus"
      onOpenChange={onOpenChange}
      open={open}
      title="Ajustes de adultos"
    >
      <Tabs.Root defaultValue="apps">
        <Tabs.List className="flex flex-wrap gap-2 rounded-2xl border-2 border-ink/15 bg-white/40 p-2">
          <Tabs.Tab className={tabClass} value="apps">
            Aplicaciones
          </Tabs.Tab>
          <Tabs.Tab className={tabClass} value="websites">
            Sitios web
          </Tabs.Tab>
          <Tabs.Tab className={tabClass} value="device">
            Equipo
          </Tabs.Tab>
          <Tabs.Tab className={tabClass} value="sync">
            Sincronización
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel className="pt-6" value="apps">
          {loadingApps ? (
            <p className="font-bold text-ink-soft" role="status">
              Cargando aplicaciones…
            </p>
          ) : appsLoaded ? (
            <AppsSettings apps={apps} onChange={setApps} />
          ) : (
            <p className="font-bold text-coral" role="alert">
              No se pudieron cargar las aplicaciones. Cierra los ajustes y
              vuelve a desbloquear.
            </p>
          )}
        </Tabs.Panel>
        <Tabs.Panel className="pt-6" value="websites">
          <WebsitesSettings origins={origins} onChange={setOrigins} />
        </Tabs.Panel>
        <Tabs.Panel className="pt-6" value="device">
          <DeviceSettings
            childName={childName}
            onChildNameChange={setChildName}
            onVolumeCapChange={setVolumeCap}
            volumeCap={volumeCap}
          />
        </Tabs.Panel>
        <Tabs.Panel className="pt-6" value="sync">
          <SyncSettings onApplied={applySync} />
        </Tabs.Panel>
      </Tabs.Root>

      {error ? (
        <p className="mt-4 font-bold text-coral" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="mt-4 font-bold text-leaf" role="status">
          Cambios guardados.
        </p>
      ) : null}
    </Modal>
  );
}

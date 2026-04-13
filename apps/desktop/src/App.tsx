import { useEffect, useMemo, useState, type FC } from "react";
import Sidebar, { type Page } from "./components/Sidebar";
import SearchBar, { type NavigateOpts } from "./components/SearchBar";
import HyprlandRuntimeBanner from "./components/HyprlandRuntimeBanner";
import DirtyBanner from "./components/DirtyBanner";
import OnboardingModal from "./components/OnboardingModal";
import AppearancePage from "./pages/AppearancePage";
import HyprlandPage from "./pages/HyprlandPage";
import HyprlandSchemaPage from "./pages/HyprlandSchemaPage";
import AnimationsPage from "./pages/AnimationsPage";
import MonitorsPage from "./pages/MonitorsPage";
import WaybarPage from "./pages/WaybarPage";
import RofiPage from "./pages/RofiPage";
import ThemeManagerPage from "./pages/ThemeManagerPage";
import WallpapersPage from "./pages/WallpapersPage";
import SystemdPage from "./pages/SystemdPage";
import SnapshotsPage from "./pages/SnapshotsPage";
import ProfilesPage from "./pages/ProfilesPage";
import RecentOperationsPage from "./pages/RecentOperationsPage";
import PreferencesPage from "./pages/PreferencesPage";
import NetworkPage from "./pages/NetworkPage";
import PowerPage from "./pages/PowerPage";
import KeybindingsPage from "./pages/KeybindingsPage";
import WindowRulesPage from "./pages/WindowRulesPage";
import SearchResultsPage from "./pages/SearchResultsPage";
import type { AppSettings } from "./types/settings";
import type { BackendStatus } from "./types/backend";
import type { SettingEntry } from "./search/index";
import { getAutoSavePreference } from "./app/appPreferences";
import { SettingsSessionProvider, useSettingsSession } from "./app/SettingsSessionContext";
import { useGlobalSettingsShortcuts } from "./app/useGlobalSettingsShortcuts";
import { computeDirtyPageCounts } from "./app/dirtyPageCounts";
import {
  getActiveProfile,
  importSystemSettings,
  saveSettings,
  updateProfile,
} from "./tauri/api";
import { ps } from "./theme/playstationDark";

type SyncStatus = "idle" | "syncing" | "ok" | "error";

const App: FC = () => (
  <SettingsSessionProvider>
    <AppShell />
  </SettingsSessionProvider>
);

const AppShell: FC = () => {
  const {
    settings,
    setSettings,
    markSaved,
    isDirty,
    baselineSettings,
    backendStatus,
    sessionReady,
  } = useSettingsSession();
  const [currentPage, setCurrentPage] = useState<Page>("appearance");
  const [searchFullQuery, setSearchFullQuery] = useState("");
  const [focusSchemaKey, setFocusSchemaKey] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [syncMessage, setSyncMessage] = useState<string>("");
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(getAutoSavePreference);
  const [dirtySaveBusy, setDirtySaveBusy] = useState(false);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [activeProfileName, setActiveProfileName] = useState<string | null>(null);

  const backendForUi: BackendStatus = sessionReady ? backendStatus : "loading";

  const dirtyCounts = useMemo(
    () => computeDirtyPageCounts(settings, baselineSettings),
    [settings, baselineSettings]
  );

  useEffect(() => {
    if (backendForUi !== "ready") return;
    void getActiveProfile()
      .then((p) => {
        setActiveProfileId(p.profile_id);
        setActiveProfileName(p.profile_name);
      })
      .catch(() => {});
  }, [backendForUi]);

  const handleNavigate = (page: Page, opts?: NavigateOpts) => {
    if (opts?.searchQuery !== undefined) setSearchFullQuery(opts.searchQuery);
    setCurrentPage(page);
    if (opts?.focusSchemaKey !== undefined) setFocusSchemaKey(opts.focusSchemaKey);
    else setFocusSchemaKey(null);
  };

  const onSearchPick = (entry: SettingEntry) => {
    const focus = entry.id.startsWith("schema:") ? entry.id.slice(7) : undefined;
    setFocusSchemaKey(focus ?? null);
    setCurrentPage(entry.page);
  };

  useGlobalSettingsShortcuts({
    enabled: sessionReady && backendForUi === "ready",
    isDirty,
    onSaveRequest: async () => {
      if (!isDirty || dirtySaveBusy) return;
      setDirtySaveBusy(true);
      try {
        const saved = await saveSettings({ settings });
        markSaved(saved);
        setSyncStatus("ok");
        setSyncMessage("Guardado (Ctrl+S).");
        window.setTimeout(() => setSyncStatus("idle"), 2000);
      } catch (e) {
        setSyncStatus("error");
        setSyncMessage(e instanceof Error ? e.message : String(e));
      } finally {
        setDirtySaveBusy(false);
      }
    },
  });

  useEffect(() => {
    if (backendForUi !== "ready" || !autoSaveEnabled || !isDirty) return;
    const t = window.setTimeout(() => {
      void saveSettings({ settings })
        .then((saved) => {
          markSaved(saved);
          setSyncStatus("ok");
          setSyncMessage("Autoguardado.");
          window.setTimeout(() => setSyncStatus("idle"), 2200);
        })
        .catch((err) => {
          setSyncStatus("error");
          setSyncMessage(err instanceof Error ? err.message : String(err));
        });
    }, 800);
    return () => window.clearTimeout(t);
  }, [settings, backendForUi, autoSaveEnabled, isDirty, markSaved]);

  const handleSyncFromSystem = async () => {
    setSyncStatus("syncing");
    setSyncMessage("");
    try {
      const imported = await importSystemSettings();
      const saved = await saveSettings({ settings: imported });
      markSaved(saved);
      setSyncStatus("ok");
      setSyncMessage("Configuración importada del sistema.");
    } catch (err) {
      setSyncStatus("error");
      setSyncMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setTimeout(() => setSyncStatus("idle"), 3000);
    }
  };

  return (
    <div style={styles.root}>
      <OnboardingModal backendReady={backendForUi === "ready"} />
      <Sidebar
        current={currentPage}
        onNavigate={handleNavigate}
        backendStatus={backendForUi}
        dirtyCounts={dirtyCounts}
        settings={settings}
      />
      <div style={styles.content}>
        <HyprlandRuntimeBanner
          backendReady={backendForUi === "ready"}
          onNavigate={handleNavigate}
        />
        <div style={styles.toolbar}>
          <SearchBar onNavigate={handleNavigate} disabled={backendForUi !== "ready"} />
          <button
            type="button"
            className="ps-btn-secondary"
            style={syncStatus === "syncing" ? styles.syncBtnDisabled : undefined}
            onClick={handleSyncFromSystem}
            disabled={syncStatus === "syncing" || backendForUi !== "ready"}
            title="Lee ~/.config/hypr, ~/.config/waybar y ~/.config/rofi y carga los valores actuales"
          >
            {syncStatus === "syncing" ? "Importando…" : "⟳ Sync desde sistema"}
          </button>
          {syncMessage && (
            <span
              style={{
                ...styles.syncMsg,
                color: syncStatus === "error" ? ps.dangerText : ps.successText,
              }}
            >
              {syncMessage}
            </span>
          )}
        </div>
        <DirtyBanner
          busy={dirtySaveBusy}
          onBusyChange={setDirtySaveBusy}
          activeProfile={
            activeProfileId && activeProfileName
              ? { id: activeProfileId, name: activeProfileName }
              : null
          }
          onSaveAndUpdateProfile={
            activeProfileId
              ? async () => {
                  const saved = await saveSettings({ settings });
                  await updateProfile({
                    id: activeProfileId,
                    name: activeProfileName ?? "Perfil",
                    description: null,
                    settings: saved,
                  });
                  markSaved(saved);
                }
              : undefined
          }
          onSaveWithoutProfile={async () => {
            const saved = await saveSettings({ settings });
            markSaved(saved);
            const { setActiveProfile } = await import("./tauri/api");
            await setActiveProfile(null, null);
            setActiveProfileId(null);
            setActiveProfileName(null);
          }}
          onSaveAsNewProfile={async () => {
            const name = window.prompt("Nombre del nuevo perfil", "Nuevo perfil");
            if (name === null) return;
            const { saveProfile } = await import("./tauri/api");
            const saved = await saveSettings({ settings });
            await saveProfile({
              name: name.trim() || "Nuevo perfil",
              description: null,
              settings: saved,
            });
            markSaved(saved);
          }}
        />
        <main style={styles.main}>
          <div style={styles.pageFrame}>
            <PageRouter
              current={currentPage}
              settings={settings}
              onSettingsChange={setSettings}
              backendStatus={backendForUi}
              autoSaveEnabled={autoSaveEnabled}
              onAutoSaveChange={setAutoSaveEnabled}
              focusSchemaKey={focusSchemaKey}
              onConsumedFocusSchemaKey={() => setFocusSchemaKey(null)}
              onActiveProfileChange={(id, name) => {
                setActiveProfileId(id);
                setActiveProfileName(name);
              }}
              searchFullQuery={searchFullQuery}
              onSearchQueryChange={setSearchFullQuery}
              onSearchPick={onSearchPick}
            />
          </div>
        </main>
      </div>
    </div>
  );
};

const PageRouter: FC<{
  current: Page;
  settings: AppSettings;
  onSettingsChange: (s: AppSettings) => void;
  backendStatus: BackendStatus;
  autoSaveEnabled: boolean;
  onAutoSaveChange: (v: boolean) => void;
  focusSchemaKey: string | null;
  onConsumedFocusSchemaKey: () => void;
  onActiveProfileChange: (id: string | null, name: string | null) => void;
  searchFullQuery: string;
  onSearchQueryChange: (q: string) => void;
  onSearchPick: (entry: SettingEntry) => void;
}> = ({
  current,
  settings,
  onSettingsChange,
  backendStatus,
  autoSaveEnabled,
  onAutoSaveChange,
  focusSchemaKey,
  onConsumedFocusSchemaKey,
  onActiveProfileChange,
  searchFullQuery,
  onSearchQueryChange,
  onSearchPick,
}) => {
  switch (current) {
    case "search":
      return (
        <SearchResultsPage
          query={searchFullQuery}
          onQueryChange={onSearchQueryChange}
          backendStatus={backendStatus}
          onPick={onSearchPick}
        />
      );
    case "preferences":
      return (
        <PreferencesPage
          backendStatus={backendStatus}
          autoSaveEnabled={autoSaveEnabled}
          onAutoSaveChange={onAutoSaveChange}
        />
      );
    case "appearance":
      return (
        <AppearancePage
          settings={settings}
          onSettingsChange={onSettingsChange}
          backendStatus={backendStatus}
        />
      );
    case "hyprland":
      return (
        <HyprlandPage
          settings={settings}
          onSettingsChange={onSettingsChange}
          backendStatus={backendStatus}
        />
      );
    case "hyprland_schema":
      return (
        <HyprlandSchemaPage
          settings={settings}
          onSettingsChange={onSettingsChange}
          backendStatus={backendStatus}
          focusSchemaKey={focusSchemaKey}
          onConsumedFocusSchemaKey={onConsumedFocusSchemaKey}
        />
      );
    case "animations":
      return (
        <AnimationsPage
          settings={settings}
          onSettingsChange={onSettingsChange}
          backendStatus={backendStatus}
        />
      );
    case "monitors":
      return <MonitorsPage backendStatus={backendStatus} />;
    case "keybindings":
      return (
        <KeybindingsPage
          settings={settings}
          onSettingsChange={onSettingsChange}
          backendStatus={backendStatus}
        />
      );
    case "window-rules":
      return (
        <WindowRulesPage
          settings={settings}
          onSettingsChange={onSettingsChange}
          backendStatus={backendStatus}
        />
      );
    case "waybar":
      return (
        <WaybarPage
          settings={settings}
          onSettingsChange={onSettingsChange}
          backendStatus={backendStatus}
        />
      );
    case "rofi":
      return (
        <RofiPage
          settings={settings}
          onSettingsChange={onSettingsChange}
          backendStatus={backendStatus}
        />
      );
    case "themes":
      return (
        <ThemeManagerPage
          settings={settings}
          onSettingsChange={onSettingsChange}
          backendStatus={backendStatus}
        />
      );
    case "wallpapers":
      return <WallpapersPage backendStatus={backendStatus} />;
    case "systemd":
      return <SystemdPage backendStatus={backendStatus} />;
    case "network":
      return <NetworkPage backendStatus={backendStatus} />;
    case "power":
      return <PowerPage backendStatus={backendStatus} />;
    case "snapshots":
      return (
        <SnapshotsPage
          settings={settings}
          onSettingsChange={onSettingsChange}
          backendStatus={backendStatus}
        />
      );
    case "profiles":
      return (
        <ProfilesPage
          settings={settings}
          onSettingsChange={onSettingsChange}
          backendStatus={backendStatus}
          onActiveProfileChange={onActiveProfileChange}
        />
      );
    case "recent_operations":
      return <RecentOperationsPage backendStatus={backendStatus} />;
    default: {
      const _exhaustive: never = current;
      return _exhaustive;
    }
  }
};

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: "flex",
    minHeight: "100vh",
    background: ps.surfaceRoot,
    color: ps.textPrimary,
    fontFamily: "Arial, Helvetica, system-ui, sans-serif",
  },
  content: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "10px 20px",
    background: ps.surfaceChrome,
    borderBottom: `1px solid ${ps.borderDefault}`,
    flexShrink: 0,
    flexWrap: "wrap",
  },
  syncBtnDisabled: {
    opacity: 0.55,
    cursor: "not-allowed",
  },
  syncMsg: {
    fontSize: "12px",
  },
  main: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    width: "100%",
    overflow: "auto",
    display: "flex",
    flexDirection: "column",
  },
  pageFrame: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    width: "100%",
    display: "flex",
    flexDirection: "column",
  },
};

export default App;

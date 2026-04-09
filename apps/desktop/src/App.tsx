import { useEffect, useState, type FC } from "react";
import Sidebar, { type Page } from "./components/Sidebar";
import AppearancePage from "./pages/AppearancePage";
import HyprlandPage from "./pages/HyprlandPage";
import WaybarPage from "./pages/WaybarPage";
import RofiPage from "./pages/RofiPage";
import SystemdPage from "./pages/SystemdPage";
import SnapshotsPage from "./pages/SnapshotsPage";
import ProfilesPage from "./pages/ProfilesPage";
import { defaultSettings, type AppSettings } from "./types/settings";
import type { BackendStatus } from "./types/backend";
import { getCurrentSettings, importSystemSettings, saveSettings } from "./tauri/api";

type SyncStatus = "idle" | "syncing" | "ok" | "error";

const App: FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>("appearance");
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>("loading");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [syncMessage, setSyncMessage] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    getCurrentSettings()
      .then((s) => {
        if (cancelled) return;
        setSettings(s);
        setBackendStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setBackendStatus("unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSyncFromSystem = async () => {
    setSyncStatus("syncing");
    setSyncMessage("");
    try {
      const imported = await importSystemSettings();
      await saveSettings({ settings: imported });
      setSettings(imported);
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
      <Sidebar
        current={currentPage}
        onNavigate={setCurrentPage}
        backendStatus={backendStatus}
      />
      <div style={styles.content}>
        <div style={styles.toolbar}>
          <button
            style={{
              ...styles.syncBtn,
              ...(syncStatus === "syncing" ? styles.syncBtnDisabled : {}),
            }}
            onClick={handleSyncFromSystem}
            disabled={syncStatus === "syncing" || backendStatus !== "ready"}
            title="Lee ~/.config/hypr, ~/.config/waybar y ~/.config/rofi y carga los valores actuales"
          >
            {syncStatus === "syncing" ? "Importando…" : "⟳ Sync desde sistema"}
          </button>
          {syncMessage && (
            <span
              style={{
                ...styles.syncMsg,
                color: syncStatus === "error" ? "#f87171" : "#4ade80",
              }}
            >
              {syncMessage}
            </span>
          )}
        </div>
        <main style={styles.main}>
          <PageRouter
            current={currentPage}
            settings={settings}
            onSettingsChange={setSettings}
            backendStatus={backendStatus}
          />
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
}> = ({ current, settings, onSettingsChange, backendStatus }) => {
  switch (current) {
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
    case "systemd":
      return <SystemdPage backendStatus={backendStatus} />;
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
        />
      );
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
    background: "#16181f",
    color: "#e2e8f0",
    fontFamily: "system-ui, 'Segoe UI', sans-serif",
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
    padding: "8px 16px",
    background: "#1e2130",
    borderBottom: "1px solid #2d3148",
    flexShrink: 0,
  },
  syncBtn: {
    padding: "6px 14px",
    borderRadius: "6px",
    border: "1px solid #3d4466",
    background: "#252840",
    color: "#a0aec0",
    cursor: "pointer",
    fontSize: "13px",
    fontFamily: "inherit",
    transition: "background 0.15s",
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
    overflow: "auto",
  },
};

export default App;

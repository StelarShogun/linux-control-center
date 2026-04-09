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
import { getCurrentSettings } from "./tauri/api";

const App: FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>("appearance");
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>("loading");

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

  return (
    <div style={styles.root}>
      <Sidebar
        current={currentPage}
        onNavigate={setCurrentPage}
        backendStatus={backendStatus}
      />
      <main style={styles.main}>
        <PageRouter
          current={currentPage}
          settings={settings}
          onSettingsChange={setSettings}
          backendStatus={backendStatus}
        />
      </main>
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
  main: {
    flex: 1,
    overflow: "auto",
  },
};

export default App;

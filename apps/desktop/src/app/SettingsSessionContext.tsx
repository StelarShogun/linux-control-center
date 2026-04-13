import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type ReactNode,
} from "react";
import { defaultSettings, type AppSettings } from "../types/settings";
import type { BackendStatus } from "../types/backend";
import { getCurrentSettings } from "../tauri/api";
import { cloneAppSettings, stableSettingsFingerprint } from "./settingsSnapshot";

const MAX_UNDO = 80;

export interface SettingsSessionValue {
  settings: AppSettings;
  baselineSettings: AppSettings;
  isDirty: boolean;
  sessionReady: boolean;
  backendStatus: BackendStatus;
  setSettings: (next: AppSettings | ((prev: AppSettings) => AppSettings)) => void;
  markSaved: (saved: AppSettings) => void;
  discardToBaseline: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const SettingsSessionContext = createContext<SettingsSessionValue | null>(null);

export function useSettingsSession(): SettingsSessionValue {
  const ctx = useContext(SettingsSessionContext);
  if (!ctx) {
    throw new Error("useSettingsSession debe usarse dentro de SettingsSessionProvider");
  }
  return ctx;
}

export const SettingsSessionProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettingsState] = useState<AppSettings>(() => cloneAppSettings(defaultSettings));
  const [baseline, setBaseline] = useState<AppSettings>(() => cloneAppSettings(defaultSettings));
  const [sessionReady, setSessionReady] = useState(false);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>("loading");
  const pastRef = useRef<AppSettings[]>([]);
  const futureRef = useRef<AppSettings[]>([]);
  const [histVersion, setHistVersion] = useState(0);
  const bumpHist = useCallback(() => setHistVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    getCurrentSettings()
      .then((s) => {
        if (cancelled) return;
        const c = cloneAppSettings(s);
        setSettingsState(c);
        setBaseline(c);
        setBackendStatus("ready");
        setSessionReady(true);
        pastRef.current = [];
        futureRef.current = [];
        bumpHist();
      })
      .catch(() => {
        if (cancelled) return;
        const c = cloneAppSettings(defaultSettings);
        setSettingsState(c);
        setBaseline(c);
        setBackendStatus("unavailable");
        setSessionReady(true);
        pastRef.current = [];
        futureRef.current = [];
        bumpHist();
      });
    return () => {
      cancelled = true;
    };
  }, [bumpHist]);

  const setSettings = useCallback(
    (next: AppSettings | ((prev: AppSettings) => AppSettings)) => {
      setSettingsState((prev) => {
        const resolved = typeof next === "function" ? (next as (p: AppSettings) => AppSettings)(prev) : next;
        if (stableSettingsFingerprint(prev) !== stableSettingsFingerprint(resolved)) {
          pastRef.current = [...pastRef.current.slice(-(MAX_UNDO - 1)), cloneAppSettings(prev)];
          futureRef.current = [];
          bumpHist();
        }
        return resolved;
      });
    },
    [bumpHist]
  );

  const markSaved = useCallback(
    (saved: AppSettings) => {
      const c = cloneAppSettings(saved);
      setSettingsState(c);
      setBaseline(c);
      pastRef.current = [];
      futureRef.current = [];
      bumpHist();
    },
    [bumpHist]
  );

  const discardToBaseline = useCallback(() => {
    setSettingsState(cloneAppSettings(baseline));
    pastRef.current = [];
    futureRef.current = [];
    bumpHist();
  }, [baseline, bumpHist]);

  const undo = useCallback(() => {
    const stack = pastRef.current;
    if (stack.length === 0) return;
    const prev = stack.pop()!;
    setSettingsState((cur) => {
      futureRef.current.push(cloneAppSettings(cur));
      return prev;
    });
    bumpHist();
  }, [bumpHist]);

  const redo = useCallback(() => {
    const stack = futureRef.current;
    if (stack.length === 0) return;
    const nxt = stack.pop()!;
    setSettingsState((cur) => {
      pastRef.current = [...pastRef.current.slice(-(MAX_UNDO - 1)), cloneAppSettings(cur)];
      return nxt;
    });
    bumpHist();
  }, [bumpHist]);

  const isDirty = useMemo(
    () => stableSettingsFingerprint(settings) !== stableSettingsFingerprint(baseline),
    [settings, baseline]
  );

  const canUndo = pastRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;

  const value = useMemo<SettingsSessionValue>(
    () => ({
      settings,
      baselineSettings: baseline,
      isDirty,
      sessionReady,
      backendStatus,
      setSettings,
      markSaved,
      discardToBaseline,
      undo,
      redo,
      canUndo,
      canRedo,
    }),
    [
      settings,
      baseline,
      isDirty,
      sessionReady,
      backendStatus,
      setSettings,
      markSaved,
      discardToBaseline,
      undo,
      redo,
      canUndo,
      canRedo,
      histVersion,
    ]
  );

  return (
    <SettingsSessionContext.Provider value={value}>{children}</SettingsSessionContext.Provider>
  );
};

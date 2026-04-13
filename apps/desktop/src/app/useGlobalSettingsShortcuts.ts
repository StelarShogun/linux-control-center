import { useEffect } from "react";
import { useSettingsSession } from "./SettingsSessionContext";

interface Args {
  enabled: boolean;
  isDirty: boolean;
  onSaveRequest: () => void | Promise<void>;
}

function inTextField(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return Boolean(el.isContentEditable);
}

function insideNoGlobalUndo(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el?.closest) return false;
  return Boolean(el.closest("[data-no-global-undo]"));
}

export function useGlobalSettingsShortcuts({ enabled, isDirty, onSaveRequest }: Args): void {
  const { undo, redo, canUndo, canRedo } = useSettingsSession();

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (inTextField(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (isDirty) void onSaveRequest();
        return;
      }
      if (mod && e.key.toLowerCase() === "z") {
        if (insideNoGlobalUndo(e.target)) return;
        e.preventDefault();
        if (e.shiftKey) {
          if (canRedo) redo();
        } else {
          if (canUndo) undo();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, isDirty, onSaveRequest, undo, redo, canUndo, canRedo]);
}

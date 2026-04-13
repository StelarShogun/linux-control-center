/**
 * Metadatos de dispatchers y tipos de bind (portado desde HyprMod `binds/dispatchers.py`).
 */

export interface BindTypeInfo {
  label: string;
  desc: string;
}

export const BIND_TYPES: Record<string, BindTypeInfo> = {
  bind: { label: "Normal", desc: "Se dispara al pulsar la tecla" },
  binde: { label: "Repetición", desc: "Se repite mientras se mantiene pulsado" },
  bindm: { label: "Ratón", desc: "Botón del ratón (mover/redimensionar)" },
  bindl: { label: "Bloqueado", desc: "Funciona con la pantalla bloqueada" },
  bindr: { label: "Soltar", desc: "Se dispara al soltar la tecla" },
  bindn: { label: "No consumir", desc: "El evento llega también a las ventanas" },
};

export interface DispatcherInfo {
  label: string;
  arg_type: string;
}

export interface DispatcherInfoWithCategory extends DispatcherInfo {
  category_id: string;
}

export interface DispatcherCategory {
  id: string;
  label: string;
  icon: string;
  dispatchers: Record<string, DispatcherInfo>;
}

export const DISPATCHER_CATEGORIES: DispatcherCategory[] = [
  {
    id: "apps",
    label: "Lanzar aplicación",
    icon: "system-run-symbolic",
    dispatchers: {
      exec: { label: "Ejecutar comando", arg_type: "command" },
      execr: { label: "Ejecutar comando raw", arg_type: "command" },
    },
  },
  {
    id: "window_mgmt",
    label: "Gestión de ventanas",
    icon: "overlapping-windows-symbolic",
    dispatchers: {
      killactive: { label: "Cerrar ventana", arg_type: "none" },
      forcekillactive: { label: "Forzar cierre", arg_type: "none" },
      togglefloating: { label: "Alternar flotante", arg_type: "none" },
      fullscreen: { label: "Pantalla completa", arg_type: "fullscreen_mode" },
      pin: { label: "Fijar ventana", arg_type: "none" },
      centerwindow: { label: "Centrar ventana", arg_type: "none" },
      pseudo: { label: "Pseudo-tiling", arg_type: "none" },
      layoutmsg: { label: "Mensaje al layout", arg_type: "text" },
    },
  },
  {
    id: "workspace_nav",
    label: "Espacios de trabajo",
    icon: "shell-overview-symbolic",
    dispatchers: {
      workspace: { label: "Ir a espacio", arg_type: "workspace" },
      movetoworkspace: { label: "Mover ventana a espacio", arg_type: "workspace" },
      movetoworkspacesilent: { label: "Mover ventana (silencioso)", arg_type: "workspace" },
      togglespecialworkspace: { label: "Scratchpad", arg_type: "optional_text" },
    },
  },
  {
    id: "window_focus",
    label: "Foco y mover",
    icon: "move-to-window-symbolic",
    dispatchers: {
      movefocus: { label: "Mover foco", arg_type: "direction" },
      movewindow: { label: "Mover ventana", arg_type: "direction" },
      swapwindow: { label: "Intercambiar ventana", arg_type: "direction" },
      movewindoworgroup: { label: "Mover ventana o grupo", arg_type: "direction" },
      resizeactive: { label: "Redimensionar", arg_type: "text" },
      cyclenext: { label: "Ciclo siguiente", arg_type: "none" },
      swapnext: { label: "Intercambiar con siguiente", arg_type: "none" },
      focuscurrentorlast: { label: "Última ventana", arg_type: "none" },
      focusurgentorlast: { label: "Urgente / última", arg_type: "none" },
    },
  },
  {
    id: "grouping",
    label: "Agrupación",
    icon: "group-symbolic",
    dispatchers: {
      togglegroup: { label: "Alternar grupo", arg_type: "none" },
      changegroupactive: { label: "Miembro del grupo", arg_type: "group_dir" },
      moveoutofgroup: { label: "Sacar del grupo", arg_type: "none" },
      moveintogroup: { label: "Meter en grupo", arg_type: "direction" },
      movegroupwindow: { label: "Reordenar en grupo", arg_type: "group_dir" },
      lockgroups: { label: "Bloquear grupos", arg_type: "text" },
      lockactivegroup: { label: "Bloquear grupo activo", arg_type: "text" },
      denywindowfromgroup: { label: "Denegar ventana al grupo", arg_type: "text" },
    },
  },
  {
    id: "monitor",
    label: "Monitores",
    icon: "preferences-desktop-display-symbolic",
    dispatchers: {
      focusmonitor: { label: "Foco monitor", arg_type: "text" },
      movecurrentworkspacetomonitor: { label: "Mover WS a monitor", arg_type: "text" },
      moveworkspacetomonitor: { label: "Mover WS concreto", arg_type: "text" },
      swapactiveworkspaces: { label: "Intercambiar WS entre monitores", arg_type: "text" },
      focusworkspaceoncurrentmonitor: { label: "Foco WS en monitor actual", arg_type: "workspace" },
      dpms: { label: "DPMS pantalla", arg_type: "dpms" },
    },
  },
  {
    id: "session",
    label: "Sesión",
    icon: "computer-symbolic",
    dispatchers: {
      exit: { label: "Salir de Hyprland", arg_type: "none" },
      pass: { label: "Pasar tecla a ventana", arg_type: "text" },
      global: { label: "Atajo global", arg_type: "text" },
      submap: { label: "Entrar en submapa", arg_type: "text" },
    },
  },
  {
    id: "advanced",
    label: "Otro",
    icon: "terminal-symbolic",
    dispatchers: {},
  },
];

function buildLookups(): {
  dispatcherInfo: Record<string, DispatcherInfoWithCategory>;
  categoryById: Record<string, DispatcherCategory>;
} {
  const dispatcherInfo: Record<string, DispatcherInfoWithCategory> = {};
  const categoryById: Record<string, DispatcherCategory> = {};
  for (const cat of DISPATCHER_CATEGORIES) {
    categoryById[cat.id] = cat;
    for (const [dname, dinfo] of Object.entries(cat.dispatchers)) {
      dispatcherInfo[dname] = { ...dinfo, category_id: cat.id };
    }
  }
  return { dispatcherInfo, categoryById };
}

const { dispatcherInfo: DISPATCHER_INFO, categoryById: CATEGORY_BY_ID } = buildLookups();

export { DISPATCHER_INFO, CATEGORY_BY_ID };

/** Categorías para el diálogo de edición (sin la categoría catch-all vacía). */
export const DIALOG_CATEGORIES = DISPATCHER_CATEGORIES.filter((c) => c.id !== "advanced");

export function categorizeDispatcher(dispatcher: string): string {
  const info = DISPATCHER_INFO[dispatcher];
  return info ? info.category_id : "advanced";
}

export function dispatcherLabel(dispatcher: string): string {
  const info = DISPATCHER_INFO[dispatcher];
  return info ? info.label : dispatcher;
}

export function formatAction(dispatcher: string, arg: string): string {
  const label = dispatcherLabel(dispatcher);
  if (arg.trim()) {
    return `${label}: ${arg}`;
  }
  return label;
}

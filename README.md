# Linux Control Center

Panel de control de escritorio para entornos Hyprland. Permite editar, previsualizar y aplicar configuraciones de Hyprland, Waybar, Rofi y systemd desde una sola interfaz, con backups automáticos y rollback completo.

---

## Características actuales

- **Importación del sistema real** — lee `~/.config/hypr/hyprland.conf`, `~/.config/waybar/config.jsonc` y `~/.config/rofi/config.rasi` al primer arranque y vía botón "Sync desde sistema"
- **Preview** — muestra el texto de configuración que se generaría antes de aplicar ningún cambio
- **Apply sandbox** — escribe en el directorio de datos de la app sin tocar el sistema real
- **Apply real** — escribe en `~/.config/…` con backup atómico (`*.bak.<timestamp>-<uuid>`)
- **Apply live (Hyprland)** — escribe el include gestionado y ejecuta `hyprctl reload`
- **Rollback completo** — restaura el archivo y los settings desde cualquier backup/snapshot previo
- **Snapshots** — historial de estados ligados a operaciones; restaurables en cualquier momento
- **Perfiles** — estados nombrados que el usuario puede guardar y cargar
- **systemd** — listado de unidades activas via D-Bus (solo lectura)
- **Escritura segura** — allowlist compilada de targets; ninguna ruta arbitraria del frontend llega al disco

---

## Dependencias del sistema

La app requiere que estas herramientas estén instaladas en el sistema:

| Herramienta | Rol |
|---|---|
| `hyprland` | Compositor gestionado |
| `hyprctl` | Recarga en vivo de Hyprland |
| `waybar` | Barra de estado gestionada |
| `rofi` | Launcher gestionado |
| `systemd` + `dbus` | Listado de unidades |
| `webkit2gtk-4.1` | Motor de renderizado de la UI |

---

## Build y desarrollo

### Requisitos de build

- Rust (stable, 1.77.2+)
- Node.js 20+
- pnpm 9+
- `webkit2gtk-4.1` (libs de desarrollo)

### Modo desarrollo

```bash
pnpm install
pnpm tauri dev
```

### Build de producción

```bash
pnpm tauri build
```

Genera AppImage, DEB y tar.gz en `apps/desktop/src-tauri/target/release/bundle/`.

### Paquete AUR / Arch Linux

```bash
cd packaging/arch
export SSH_AUTH_SOCK="$HOME/.ssh/agent/$(ls -1 ~/.ssh/agent | head -n 1)"
makepkg -Csi
```

### Tests

```bash
cargo test --workspace
```

---

## Estructura del proyecto

```
linux-control-center/
├── apps/desktop/          # Aplicación Tauri + React
│   ├── src/               # Frontend React 19 + TypeScript
│   └── src-tauri/         # Backend Rust + comandos Tauri
├── crates/
│   ├── core-model/        # Dominio puro: settings, snapshots, perfiles, validación
│   ├── adapters-hyprland/ # Lector y generador de hyprland.conf
│   ├── adapters-waybar/   # Lector y generador de config.jsonc
│   ├── adapters-rofi/     # Lector y generador de config.rasi
│   ├── adapters-systemd/  # Listado de unidades via D-Bus (zbus)
│   └── privileged-helper/ # Escritura atómica, backups, allowlist de targets
├── docs/
│   ├── architecture-v2.md # Arquitectura completa y decisiones de diseño
│   └── architecture.md    # Documento histórico (fase 1, superado)
├── fixtures/              # Configs de ejemplo para desarrollo y tests
├── profiles/              # Perfil de ejemplo
└── packaging/arch/        # PKGBUILD para Arch Linux / AUR
```

---

## Arquitectura

Ver [`docs/architecture-v2.md`](docs/architecture-v2.md) para la arquitectura completa, el modelo transaccional, la política de ownership de archivos, las decisiones de diseño (ADRs) y el roadmap de implementación.

---

## Licencia

MIT

#!/usr/bin/env sh
# Cursor/VS Code puede tener guardada la ruta ~/linux-control-center; el repo real suele estar en GitHub.
# Ejecuta esto una vez:  sh scripts/ensure-legacy-workspace-path.sh

set -e
REAL="${LINUX_CONTROL_CENTER_REAL:-$HOME/Documentos/GitHub/linux-control-center}"
LEGACY="$HOME/linux-control-center"

if [ ! -d "$REAL" ]; then
  echo "No existe el repo en: $REAL" >&2
  echo "Exporta LINUX_CONTROL_CENTER_REAL con la ruta correcta y vuelve a ejecutar." >&2
  exit 1
fi

if [ -e "$LEGACY" ] && [ ! -L "$LEGACY" ]; then
  echo "Ya existe $LEGACY y no es un enlace simbólico; no se toca." >&2
  exit 1
fi

ln -sfn "$REAL" "$LEGACY"
echo "Listo: $LEGACY -> $REAL"

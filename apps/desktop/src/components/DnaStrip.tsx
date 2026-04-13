import { useMemo, type FC } from "react";
import type { AppSettings } from "../types/settings";
import { stableSettingsFingerprint } from "../app/settingsSnapshot";
import { ps } from "../theme/playstationDark";

interface Props {
  settings?: AppSettings;
  /** Si se pasa, sustituye al fingerprint de `settings` (p. ej. id de perfil). */
  seed?: string;
  width?: number;
  height?: number;
}

/** Resumen visual tipo “DNA” a partir del fingerprint de settings (no es criptográfico). */
const DnaStrip: FC<Props> = ({ settings, seed, width = 180, height = 22 }) => {
  const bars = useMemo(() => {
    const fp = seed ?? (settings ? stableSettingsFingerprint(settings) : "lcc");
    const out: { w: number; color: string }[] = [];
    for (let i = 0; i < 24; i++) {
      const code = fp.charCodeAt(i % fp.length) + i * 7;
      out.push({
        w: 3 + (code % 5),
        color: `hsl(${code % 360}, ${45 + (code % 30)}%, ${35 + (code % 25)}%)`,
      });
    }
    return out;
  }, [settings, seed]);

  return (
    <div
      title="Resumen visual de la configuración"
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 2,
        width,
        height,
        padding: "2px 0",
        boxSizing: "border-box",
      }}
    >
      {bars.map((b, i) => (
        <span
          key={i}
          style={{
            width: b.w,
            height: Math.max(4, (i % 5) + 8),
            borderRadius: 1,
            background: b.color,
            flexShrink: 0,
            border: `1px solid ${ps.borderDefault}`,
          }}
        />
      ))}
    </div>
  );
};

export default DnaStrip;

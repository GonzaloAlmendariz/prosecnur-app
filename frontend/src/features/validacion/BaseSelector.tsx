import { Database, Layers } from "lucide-react";
import type { EstudioPayload } from "../../api/client";
import { RepeatBadge } from "../../components/RepeatBadge";
import { GlidingTabList } from "../../components/GlidingTabList";
import { isRepeatChildBase } from "../../lib/repeatIdentity";

// =============================================================================
// BaseSelector — selector de base arriba del todo en Fase 2
// =============================================================================
// Multi-base: grupo de botones segmentados con el nombre de cada base.
// Single-base (sin estudio o con 1 sola base): se oculta, no tiene sentido
// ofrecer un selector. El valor `null` significa "usa la primera base por
// defecto" y el backend lo resuelve.
//
// Cambiar de base dispara una invalidación masiva de caché en los tabs
// (vía `version` en el store) — el caller ya lo maneja.

type Props = {
  estudio: EstudioPayload | null;
  selected: string | null;
  onChange: (nombre: string) => void;
  disabled?: boolean;
  className?: string;
};

export default function BaseSelector({ estudio, selected, onChange, disabled, className }: Props) {
  if (!estudio || estudio.n_bases <= 1) return null;

  const bases = Object.values(estudio.bases);
  const activeKey = selected ?? bases[0]?.nombre ?? null;

  return (
    <GlidingTabList
      activeKey={activeKey}
      role="group"
      aria-label="Base activa para validar"
      className={["pulso-validacion-base-selector", className].filter(Boolean).join(" ")}
    >
      <span
        aria-hidden="true"
        className="pulso-validacion-base-label"
      >
        <Layers size={12} /> Validar
      </span>
      <div className="pulso-validacion-base-list">
        {bases.map((b) => {
          const active = b.nombre === activeKey;
          const label = b.source_alias || b.source_title || b.nombre;
          const isRepeatChild = isRepeatChildBase(b);
          const repeatGroup = String(b.repeat_group ?? "").trim();
          const repeatParent = String(b.parent_base ?? "").trim();
          return (
            <button
              key={b.nombre}
              type="button"
              aria-pressed={active}
              data-gliding-key={b.nombre}
              onClick={() => onChange(b.nombre)}
              disabled={disabled || active}
              title={
                b.n_filas != null
                  ? `${label} · ${b.n_filas} filas · ${b.n_columnas} columnas`
                  : label
              }
              className={`pulso-validacion-base-chip${active ? " is-active" : ""}${isRepeatChild ? " is-repeat" : ""}`}
            >
              <Database size={11} />
              {label}
              {isRepeatChild && (
                <RepeatBadge
                  repeatGroup={repeatGroup || null}
                  compact
                  title={
                    repeatParent
                      ? `Respuestas repetidas de «${repeatParent}» (una fila por opción marcada)`
                      : "Base de respuestas repetidas"
                  }
                />
              )}
              {b.n_filas != null && (
                <span>
                  · {b.n_filas}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </GlidingTabList>
  );
}

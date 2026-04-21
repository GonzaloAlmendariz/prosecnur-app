import { useMemo, useState } from "react";
import * as Lucide from "lucide-react";
import { RotateCcw, Circle } from "lucide-react";
import { ArgGrupo, ArgMetadata } from "../../api/client";
import { usePlanStore } from "./store";
import { usePresetsMetadata } from "./usePresetsMetadata";
import { ArgGroup, GRUPO_META } from "./ArgGroup";
import { AdvancedJsonEditor } from "./AdvancedJsonEditor";

// Editor de presets globales tipo-de-graficador.
//
// Layout:
//   [ sidebar con lista de tipos ]  |  [ editor de args del tipo seleccionado ]
//
// Cada tipo muestra:
//   - Header con ícono + titulo_humano + descripción + badge "Modificado".
//   - Args agrupados por `grupo` semántico (textos / estilo / avanzado).
//   - Botón "Restaurar default" si el tipo tiene args custom.
//
// La fuente de verdad del catálogo es `/api/graficos/presets-metadata`;
// la fuente de verdad del estado persistido es el store (`presets`).

type LucideIcon = (props: { size?: number; color?: string }) => JSX.Element;

function resolveLucide(name: string | undefined): LucideIcon {
  const registry = Lucide as unknown as Record<string, LucideIcon>;
  return (name && registry[name]) || registry["Sliders"] || registry["Square"];
}

export function PresetsEditor() {
  const { presets, loading, error } = usePresetsMetadata();
  const configPresets = usePlanStore((s) => s.presets);
  const resetPreset = usePlanStore((s) => s.resetPreset);

  const [selected, setSelected] = useState<string>("base");

  if (loading) {
    return (
      <div style={{ fontSize: 12, color: "var(--pulso-text-soft)", padding: 10 }}>
        Cargando catálogo de presets…
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ fontSize: 12, color: "#991b1b", padding: 10 }}>
        Error cargando presets: {error}
      </div>
    );
  }

  const meta = presets.find((p) => p.name === selected) ?? presets[0];
  if (!meta) return null;

  const current = configPresets[meta.name] ?? {};
  const hasChanges = Object.keys(current).length > 0;

  return (
    <div style={{ display: "flex", gap: 16, minHeight: 420 }}>
      {/* Sidebar — lista de tipos de preset */}
      <aside
        style={{
          width: 220, flexShrink: 0,
          borderRight: "1px solid var(--pulso-border)",
          paddingRight: 12,
          display: "flex", flexDirection: "column", gap: 2,
        }}
      >
        <div
          style={{
            fontSize: 10, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: 0.4,
            color: "var(--pulso-text-soft)",
            padding: "0 6px 6px",
          }}
        >
          Tipo de preset
        </div>
        {presets.map((p) => {
          const modified = Object.keys(configPresets[p.name] ?? {}).length > 0;
          const isActive = p.name === selected;
          const Icon = resolveLucide(p.icono_ui);
          return (
            <button
              key={p.name}
              type="button"
              onClick={() => setSelected(p.name)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "7px 9px", borderRadius: 6,
                border: "1px solid transparent",
                background: isActive ? "var(--pulso-primary-soft)" : "transparent",
                color: isActive ? "var(--pulso-primary)" : "var(--pulso-text)",
                fontSize: 12, fontWeight: isActive ? 600 : 500,
                textAlign: "left", cursor: "pointer",
                transition: "background 120ms ease",
              }}
            >
              <Icon size={14} />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.titulo_humano}
              </span>
              {modified && (
                <Circle
                  size={7}
                  fill={isActive ? "var(--pulso-primary)" : "var(--pulso-primary)"}
                  color="transparent"
                  aria-label="Modificado"
                />
              )}
            </button>
          );
        })}
      </aside>

      {/* Editor del preset seleccionado */}
      <section style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        <PresetHeader
          meta={meta}
          hasChanges={hasChanges}
          onReset={() => resetPreset(meta.name)}
        />
        <PresetBody meta={meta} values={current} />
      </section>
    </div>
  );
}

function PresetHeader({
  meta,
  hasChanges,
  onReset,
}: {
  meta: { name: string; titulo_humano: string; descripcion: string; icono_ui: string };
  hasChanges: boolean;
  onReset: () => void;
}) {
  const Icon = resolveLucide(meta.icono_ui);
  return (
    <header
      style={{
        display: "flex", alignItems: "flex-start", gap: 10,
        paddingBottom: 10,
        borderBottom: "1px solid var(--pulso-border)",
      }}
    >
      <span
        style={{
          width: 30, height: 30, borderRadius: 7,
          background: "var(--pulso-primary-soft)",
          color: "var(--pulso-primary)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={15} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 14, lineHeight: 1.3 }}>{meta.titulo_humano}</h3>
          {hasChanges && (
            <span
              style={{
                fontSize: 10, fontWeight: 600,
                padding: "2px 7px", borderRadius: 999,
                background: "var(--pulso-primary-soft)",
                color: "var(--pulso-primary)",
              }}
            >
              Modificado
            </span>
          )}
          <code
            style={{
              fontSize: 10, fontFamily: "ui-monospace, monospace",
              color: "var(--pulso-text-soft)", marginLeft: "auto",
            }}
          >
            {meta.name}
          </code>
        </div>
        {meta.descripcion && (
          <p
            style={{
              margin: "4px 0 0", fontSize: 11,
              color: "var(--pulso-text-soft)", lineHeight: 1.5,
              maxWidth: 560,
            }}
          >
            {meta.descripcion}
          </p>
        )}
      </div>
      {hasChanges && (
        <button
          type="button"
          onClick={onReset}
          title="Volver a los defaults de prosecnur (elimina tus cambios en este preset)."
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            fontSize: 11, padding: "5px 10px",
            border: "1px solid var(--pulso-border)", borderRadius: 6,
            background: "white", color: "var(--pulso-text)",
            cursor: "pointer", flexShrink: 0,
          }}
        >
          <RotateCcw size={11} />
          Restaurar default
        </button>
      )}
    </header>
  );
}

function PresetBody({
  meta,
  values,
}: {
  meta: { name: string; args: ArgMetadata[] };
  values: Record<string, unknown>;
}) {
  const setPresetArg = usePlanStore((s) => s.setPresetArg);
  const replacePreset = usePlanStore((s) => s.replacePreset);
  const curatedArgNames = useMemo(() => meta.args.map((a) => a.name), [meta.args]);

  // Agrupar args por grupo semántico, manteniendo el orden de GRUPO_META.
  const gruposDeArgs = useMemo(() => {
    const byGrupo: Record<ArgGrupo, ArgMetadata[]> = {
      datos: [], textos: [], estilo: [], calculo: [], semaforo: [], canvas: [], tabla: [], avanzado: [],
    };
    for (const a of meta.args) {
      const g: ArgGrupo = (a.grupo as ArgGrupo) ?? "avanzado";
      (byGrupo[g] ?? byGrupo.avanzado).push(a);
    }
    return (Object.keys(byGrupo) as ArgGrupo[])
      .filter((g) => byGrupo[g].length > 0)
      .sort((a, b) => GRUPO_META[a].order - GRUPO_META[b].order)
      .map((g) => ({ grupo: g, args: byGrupo[g] }));
  }, [meta]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 560 }}>
      {meta.args.length === 0 ? (
        <div
          style={{
            fontSize: 12, color: "var(--pulso-text-soft)",
            padding: "14px 16px", borderRadius: 6,
            background: "var(--pulso-surface)",
            border: "1px solid var(--pulso-border)",
          }}
        >
          Este preset no tiene args catalogados. Usa la edición JSON avanzada
          abajo para setear args específicos.
        </div>
      ) : (
        gruposDeArgs.map(({ grupo, args }) => (
          <ArgGroup
            key={grupo}
            grupo={grupo}
            args={args}
            values={values}
            onChangeArg={(name, val) => setPresetArg(meta.name, name, val)}
            variables={[]}
          />
        ))
      )}

      <AdvancedJsonEditor
        value={values}
        onChange={(next) => replacePreset(meta.name, next)}
        curatedArgNames={curatedArgNames}
        label="Edición JSON avanzada"
        hint="Todos los args del preset — incluidos los que no están en los grupos de arriba. Útil para args específicos del canvas (canvas_w_*, alto_por_categoria, etc.) que aún no están en el catálogo."
      />
    </div>
  );
}

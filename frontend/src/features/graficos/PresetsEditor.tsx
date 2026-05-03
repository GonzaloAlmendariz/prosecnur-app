import { useMemo } from "react";
import { useState } from "react";
import * as Lucide from "lucide-react";
import { RotateCcw, Circle } from "lucide-react";
import { ArgGrupo, ArgMetadata } from "../../api/client";
import { usePlanStore } from "./store";
import { usePresetsMetadata } from "./usePresetsMetadata";
import { ArgGroup, GRUPO_META, ARG_GROUP_ORDER, normalizeArgGroup } from "./ArgGroup";
import { usePresetsDefaults, presetArgsEqual } from "./usePresetsDefaults";
// La edición de presets usa solo controles catalogados. Si un argumento
// no tiene metadata visual, no se expone como campo editable.

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
  const { presets: defaults } = usePresetsDefaults();
  const configPresets = usePlanStore((s) => s.presets);
  const resetPreset = usePlanStore((s) => s.resetPreset);
  const replacePreset = usePlanStore((s) => s.replacePreset);

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
  const defaultForPreset = defaults[meta.name] ?? {};
  // "Modificado" ahora compara contra el DEFAULT (no contra vacío). Los
  // presets llegan pre-poblados con los defaults → antes siempre se
  // mostraba el badge aunque el usuario no hubiera tocado nada. Ahora
  // solo se enciende cuando el value difiere del default real.
  const hasChanges = !presetArgsEqual(current, defaultForPreset);

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
        {/* Agrupamos los presets en dos secciones:
            - Gráficos normales: base + 2D/1D habituales (barras, pie, etc.).
            - Gráficos dimensionales: los que requieren reporte_dimensiones
              (dim_heatmap, dim_radar, dim_heatmap_criterios, dim_foda).
            La sidebar deja claro cuál es cuál para que el analista no
            se sorprenda al configurar un preset que su instrumento no va
            a ejercitar. */}
        {(() => {
          const isDim = (name: string) => name.startsWith("dim_");
          const normales = presets.filter((p) => !isDim(p.name));
          const dimensionales = presets.filter((p) => isDim(p.name));

          const renderItem = (p: typeof presets[number]) => {
            // Mismo criterio que el badge "Modificado" del header: hay
            // cambios vs el default efectivo, no "hay algo en el store"
            // (los presets vienen pre-poblados con defaults).
            const modified = !presetArgsEqual(
              configPresets[p.name] ?? {},
              defaults[p.name] ?? {},
            );
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
          };

          const groupHeader = (label: string, hint?: string, isFirst = false) => (
            <div
              style={{
                fontSize: 10, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: 0.5,
                color: "var(--pulso-text-soft)",
                padding: isFirst ? "2px 8px 6px" : "14px 8px 6px",
                marginBottom: 2,
                display: "flex", alignItems: "center", gap: 6,
              }}
              title={hint}
            >
              <span
                style={{
                  flex: 1,
                  height: 1,
                  maxWidth: 0,
                }}
              />
              <span>{label}</span>
              <span
                style={{
                  flex: 1, height: 1,
                  background: "var(--pulso-border)",
                }}
              />
            </div>
          );

          return (
            <>
              {groupHeader("Gráficos normales", "Base + los graficadores 2D habituales", true)}
              {normales.map(renderItem)}
              {dimensionales.length > 0 && (
                <>
                  {groupHeader("Gráficos dimensionales", "Requieren haber calculado `reporte_dimensiones` en Fase 4.")}
                  {dimensionales.map(renderItem)}
                </>
              )}
            </>
          );
        })()}
      </aside>

      {/* Editor del preset seleccionado */}
      <section style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        <PresetHeader
          meta={meta}
          hasChanges={hasChanges}
          onReset={() => {
            // Restaurar default: reemplazar el preset con el default
            // efectivo (user-saved o factory). No borrar — los presets
            // SIEMPRE tienen valores de default; "vacío" no es un
            // estado válido en el UX.
            const def = defaults[meta.name];
            if (def && Object.keys(def).length > 0) {
              replacePreset(meta.name, def);
            } else {
              resetPreset(meta.name);
            }
          }}
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
          <h3
            style={{ margin: 0, fontSize: 14, lineHeight: 1.3 }}
            title={`ID interno: ${meta.name}`}
          >
            {meta.titulo_humano}
          </h3>
          {hasChanges && (
            <span
              style={{
                fontSize: 10, fontWeight: 600,
                padding: "2px 8px 2px 7px", borderRadius: 999,
                background: "var(--pulso-primary-soft)",
                color: "var(--pulso-primary)",
                display: "inline-flex", alignItems: "center", gap: 5,
                border: "1px solid var(--pulso-primary-border)",
              }}
            >
              <Circle size={6} fill="var(--pulso-primary)" color="transparent" />
              Modificado
            </span>
          )}
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
          title="Volver a los defaults (elimina tus cambios en este preset)."
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--pulso-surface)";
            e.currentTarget.style.borderColor = "var(--pulso-primary-border)";
            e.currentTarget.style.color = "var(--pulso-primary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.borderColor = "var(--pulso-border)";
            e.currentTarget.style.color = "var(--pulso-text-soft)";
          }}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            fontSize: 11, padding: "5px 10px",
            border: "1px solid var(--pulso-border)", borderRadius: 6,
            background: "transparent", color: "var(--pulso-text-soft)",
            cursor: "pointer", flexShrink: 0,
            transition: "background 120ms ease, border-color 120ms ease, color 120ms ease",
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

  // Agrupar args por grupo semántico, manteniendo el orden de GRUPO_META.
  const gruposDeArgs = useMemo(() => {
    const byGrupo: Partial<Record<ArgGrupo, ArgMetadata[]>> = {};
    for (const a of meta.args) {
      const g = normalizeArgGroup(a.grupo as ArgGrupo);
      (byGrupo[g] ??= []).push(a);
    }
    return ARG_GROUP_ORDER
      .filter((g) => byGrupo[g] && byGrupo[g]!.length > 0)
      .sort((a, b) => GRUPO_META[a].order - GRUPO_META[b].order)
      .map((g) => ({ grupo: g, args: byGrupo[g]! }));
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
          Este preset no tiene ajustes visuales catalogados todavía.
          No se puede editar desde esta pantalla.
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

    </div>
  );
}

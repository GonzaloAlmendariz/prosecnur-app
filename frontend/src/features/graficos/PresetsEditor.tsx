import { useMemo } from "react";
import { useState } from "react";
import { CheckCircle2, Circle, Palette, RotateCcw, SlidersHorizontal } from "lucide-react";
import { ArgGrupo, ArgMetadata } from "../../api/client";
import { usePlanStore } from "./store";
import { usePresetsMetadata } from "./usePresetsMetadata";
import { ArgGroup, GRUPO_META, ARG_GROUP_ORDER, normalizeArgGroup } from "./ArgGroup";
import { usePresetsDefaults } from "./usePresetsDefaults";
import { ChartLayoutEditor, hasChartLayoutSpec } from "./ChartLayoutPopover";
import { resolveGraphLucideIcon } from "./lucideRegistry";
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

function clarifyPresetGraphTitleArg(arg: ArgMetadata): ArgMetadata {
  if (arg.name !== "titulo") return arg;
  return {
    ...arg,
    label: "Título del gráfico",
    descripcion: "Texto que se muestra como título propio del gráfico.",
  };
}

function samePresetValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function presetCustomArgs(
  current: Record<string, unknown> | undefined,
  defaults: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const defaultValues = defaults ?? {};
  for (const [key, value] of Object.entries(current ?? {})) {
    if (value === null || value === undefined || value === "") continue;
    if (samePresetValue(value, defaultValues[key])) continue;
    out[key] = value;
  }
  return out;
}

function presetCustomCount(
  current: Record<string, unknown> | undefined,
  defaults: Record<string, unknown> | undefined,
): number {
  return Object.keys(presetCustomArgs(current, defaults)).length;
}

export function PresetsEditor() {
  const { presets, loading, error } = usePresetsMetadata();
  const { presets: defaults } = usePresetsDefaults();
  const configPresets = usePlanStore((s) => s.presets);
  const resetPreset = usePlanStore((s) => s.resetPreset);

  const [selected, setSelected] = useState<string>("base");

  if (loading) {
    return (
      <div style={{ fontSize: 12, color: "var(--pulso-text-soft)", padding: 10 }}>
        Cargando bases visuales...
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ fontSize: 12, color: "#991b1b", padding: 10 }}>
        Error cargando bases visuales: {error}
      </div>
    );
  }

  const meta = presets.find((p) => p.name === selected) ?? presets[0];
  if (!meta) return null;

  const rawCurrent = configPresets[meta.name] ?? {};
  const defaultForPreset = defaults[meta.name] ?? {};
  const current = presetCustomArgs(rawCurrent, defaultForPreset);
  const customArgCount = Object.keys(current).length;
  const hasChanges = customArgCount > 0;
  const modifiedCount = presets.filter((p) => presetCustomCount(configPresets[p.name], defaults[p.name]) > 0).length;

  return (
    <div className="pulso-gv2-presets-stack">
      <div className="pulso-gv2-presets-overview" aria-label="Resumen de bases visuales de PowerPoint">
        <span className="pulso-gv2-presets-overview-icon" aria-hidden="true">
          <Palette size={15} />
        </span>
        <span className="pulso-gv2-presets-overview-copy">
          <strong>Biblioteca visual PPT</strong>
          <span>
            {presets.length} tipos · {modifiedCount === 0
              ? "sin cambios sobre la base"
              : `${modifiedCount} personalizado${modifiedCount === 1 ? "" : "s"}`}
          </span>
        </span>
        <span
          className={`pulso-gv2-presets-overview-current ${hasChanges ? "is-custom" : "is-inherited"}`}
          title={`ID interno: ${meta.name}`}
        >
          {hasChanges ? `${customArgCount} ajuste${customArgCount === 1 ? "" : "s"}` : "Valor por defecto"}
        </span>
      </div>
      <div className="pulso-gv2-presets-editor">
      {/* Sidebar — lista de tipos de preset */}
      <aside
        className="pulso-gv2-presets-sidebar"
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
            const customCount = presetCustomCount(configPresets[p.name], defaults[p.name]);
            const modified = customCount > 0;
            const isActive = p.name === selected;
            const Icon = resolveGraphLucideIcon(p.icono_ui, "Sliders");
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => setSelected(p.name)}
                className={`pulso-gv2-preset-nav-item ${isActive ? "is-active" : ""}`}
                data-state={modified ? "custom" : "base"}
                aria-pressed={isActive}
                aria-label={`${p.titulo_humano}. ${modified ? `${customCount} ajustes personalizados` : "Valor por defecto"}`}
              >
                <span
                  className="pulso-gv2-presets-sidebar-icon"
                  aria-hidden="true"
                  data-active={isActive ? "true" : "false"}
                >
                  <Icon size={14} />
                </span>
                <span className="pulso-gv2-preset-nav-label">
                  {p.titulo_humano}
                </span>
                <span
                  className={`pulso-gv2-preset-nav-state ${modified ? "is-custom" : "is-base"}`}
                  title={modified ? `${customCount} ajustes personalizados` : "Valor por defecto"}
                >
                  {modified ? `${customCount} ajuste${customCount === 1 ? "" : "s"}` : "Por defecto"}
                </span>
              </button>
            );
          };

          const groupHeader = (label: string, hint?: string, isFirst = false) => (
            <div
              className={`pulso-gv2-preset-nav-group ${isFirst ? "is-first" : ""}`}
              title={hint}
            >
              <span>{label}</span>
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
      <section className="pulso-gv2-presets-detail">
        <PresetHeader
          meta={meta}
          hasChanges={hasChanges}
          customArgCount={customArgCount}
          onReset={() => {
            resetPreset(meta.name);
          }}
        />
        <PresetSourceRail
          metaName={meta.name}
          editableArgCount={meta.args.length}
          customArgCount={customArgCount}
          hasChanges={hasChanges}
        />
        <PresetBody meta={meta} values={current} />
      </section>
      </div>
    </div>
  );
}

function PresetSourceRail({
  metaName,
  editableArgCount,
  customArgCount,
  hasChanges,
}: {
  metaName: string;
  editableArgCount: number;
  customArgCount: number;
  hasChanges: boolean;
}) {
  const inheritedCount = Math.max(0, editableArgCount - customArgCount);
  return (
    <div className="pulso-gv2-preset-source-rail" aria-label="Estado de la base seleccionada">
      <span className="is-base">
        <CheckCircle2 size={12} />
        <strong>Valor por defecto</strong>
        <b>Activa</b>
      </span>
      <span className={hasChanges ? "is-custom" : "is-inherited"}>
        <Circle size={8} fill={hasChanges ? "currentColor" : "transparent"} />
        <strong>{hasChanges ? "Personalización PPT" : "Sin diferencia PPT"}</strong>
        <b>
          {hasChanges
            ? `${customArgCount} ajuste${customArgCount === 1 ? "" : "s"}`
            : `${inheritedCount} heredado${inheritedCount === 1 ? "" : "s"}`}
        </b>
      </span>
      <span className="is-model">
        <SlidersHorizontal size={12} />
        <strong>Tipo</strong>
        <code>{metaName}</code>
      </span>
    </div>
  );
}


function PresetHeader({
  meta,
  hasChanges,
  customArgCount,
  onReset,
}: {
  meta: { name: string; titulo_humano: string; descripcion: string; icono_ui: string };
  hasChanges: boolean;
  customArgCount: number;
  onReset: () => void;
}) {
  const Icon = resolveGraphLucideIcon(meta.icono_ui, "Sliders");
  return (
    <header className="pulso-gv2-preset-header">
      <span className="pulso-gv2-preset-header-icon" aria-hidden="true">
        <Icon size={15} />
      </span>
      <div className="pulso-gv2-preset-header-copy">
        <div className="pulso-gv2-preset-header-title-row">
          <h3
            className="pulso-gv2-preset-header-title"
            title={`ID interno: ${meta.name}`}
          >
            {meta.titulo_humano}
          </h3>
          {hasChanges ? (
            <span className="pulso-gv2-preset-modified-badge is-custom">
              <Circle className="pulso-gv2-modified-dot" size={6} fill="var(--pulso-primary)" color="transparent" />
              Personalizado · {customArgCount} ajuste{customArgCount === 1 ? "" : "s"}
            </span>
          ) : (
            <span className="pulso-gv2-preset-modified-badge is-inherited">
              <CheckCircle2 size={12} />
              Valor por defecto
            </span>
          )}
        </div>
        {meta.descripcion && (
          <p className="pulso-gv2-preset-header-description">
            {meta.descripcion}
          </p>
        )}
      </div>
      {hasChanges && (
        <button
          type="button"
          onClick={onReset}
          title="Volver al valor por defecto de este tipo de gráfico."
          className="pulso-gv2-preset-reset"
        >
          <span className="pulso-gv2-preset-action-icon" aria-hidden="true">
            <RotateCcw size={11} />
          </span>
          Volver al valor
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
  const replacePreset = usePlanStore((s) => s.replacePreset);
  const { presets: defaults } = usePresetsDefaults();
  const presetArgs = useMemo(() => meta.args.map(clarifyPresetGraphTitleArg), [meta.args]);

  // Agrupar args por grupo semántico, manteniendo el orden de GRUPO_META.
  const gruposDeArgs = useMemo(() => {
    const byGrupo: Partial<Record<ArgGrupo, ArgMetadata[]>> = {};
    for (const a of presetArgs) {
      const g = normalizeArgGroup(a.grupo as ArgGrupo);
      (byGrupo[g] ??= []).push(a);
    }
    return ARG_GROUP_ORDER
      .filter((g) => byGrupo[g] && byGrupo[g]!.length > 0)
      .sort((a, b) => GRUPO_META[a].order - GRUPO_META[b].order)
      .map((g) => ({ grupo: g, args: byGrupo[g]! }));
  }, [presetArgs]);

  const currentDefaults = defaults[meta.name] ?? {};

  function handleSetPresetArg(name: string, value: unknown) {
    handleSetPresetPatch({ [name]: value });
  }

  function handleSetPresetPatch(patchIn: Record<string, unknown>) {
    const next: Record<string, unknown> = { ...values };
    for (const [name, value] of Object.entries(patchIn)) {
      if (value === null || value === undefined || value === "") {
        delete next[name];
        continue;
      }
      const defaultValue = currentDefaults[name];
      if (samePresetValue(value, defaultValue)) {
        delete next[name];
      } else {
        next[name] = value;
      }
    }
    replacePreset(meta.name, next);
  }

  return (
    <div className="pulso-gv2-presets-body">
      {meta.args.length === 0 ? (
        <div
          style={{
            fontSize: 12, color: "var(--pulso-text-soft)",
            padding: "14px 16px", borderRadius: 6,
            background: "var(--pulso-surface)",
            border: "1px solid var(--pulso-border)",
          }}
        >
          Esta base visual no tiene ajustes catalogados todavía.
          No se puede editar desde esta pantalla.
        </div>
      ) : (
        gruposDeArgs.map(({ grupo, args }) => (
          <ArgGroup
            key={grupo}
            grupo={grupo}
            args={args}
            values={values}
            onChangeArg={handleSetPresetArg}
            variables={[]}
            inheritedValues={currentDefaults}
            bodyIntro={normalizeArgGroup(grupo) === "espacio" && hasChartLayoutSpec(meta.name, presetArgs) ? (
              <ChartLayoutEditor
                presetType={meta.name}
                args={presetArgs}
                values={values}
                inheritedValues={currentDefaults}
                onChangeArg={handleSetPresetArg}
                onChangeArgs={handleSetPresetPatch}
              />
            ) : undefined}
          />
        ))
      )}

    </div>
  );
}

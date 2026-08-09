import { useMemo, useState } from "react";
import { CheckCircle2, Circle, FileText, RotateCcw, SlidersHorizontal } from "lucide-react";
import { ArgGrupo, ArgMetadata } from "../../api/client";
import { createDefaultWordPresets } from "../../api/graficosConfigNormalizer";
import { usePlanStore } from "./store";
import { usePresetsMetadata } from "./usePresetsMetadata";
import { ArgGroup, ARG_GROUP_ORDER, GRUPO_META, normalizeArgGroup } from "./ArgGroup";
import { LoadingBlock, ErrorBlock } from "../../components/States";
import { resolveGraphLucideIcon } from "./lucideRegistry";
import { ChartLayoutEditor, hasChartLayoutSpec } from "./ChartLayoutPopover";
import { resolveActiveChartLayoutOrigin } from "./chartLayoutOrigin";

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function wordChartPresets(wPresets: Record<string, Record<string, unknown>>) {
  const raw = wPresets.chart_presets;
  return isPlainRecord(raw) ? raw as Record<string, Record<string, unknown>> : {};
}

function wordChartOptions(wPresets: Record<string, Record<string, unknown>>) {
  const raw = wPresets.chart_options;
  return isPlainRecord(raw) ? raw : {};
}

function hasValue(v: unknown) {
  if (v === null || v === undefined || v === "") return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v as Record<string, unknown>).length > 0;
  return true;
}

export function WordPresetsEditor() {
  const { presets, loading, error } = usePresetsMetadata();
  const pptPresets = usePlanStore((s) => s.presets);
  const wPresets = usePlanStore((s) => s.wPresets);
  const setWPresets = usePlanStore((s) => s.setWPresets);
  const [selected, setSelected] = useState<string>("barras_apiladas");

  if (loading) return <LoadingBlock label="Cargando catálogo de ajustes…" />;
  if (error) return <ErrorBlock label="Error cargando catálogo" detail={error} />;

  const chartPresets = wordChartPresets(wPresets);
  const chartOptions = wordChartOptions(wPresets);
  const defaultChartPresets = wordChartPresets(createDefaultWordPresets());
  const hideDuplicateLabel = chartOptions.ocultar_etiqueta_si_titulo !== false;
  const editablePresets = presets.filter((p) => p.name !== "base" && p.name !== "debug");
  const meta = editablePresets.find((p) => p.name === selected) ?? editablePresets[0];
  if (!meta) return null;

  const selectedPatch = chartPresets[meta.name] ?? defaultChartPresets[meta.name] ?? {};
  const inherited = pptPresets[meta.name] ?? {};
  const hasSelectedChanges = Object.keys(selectedPatch).some((k) => hasValue(selectedPatch[k]));
  const wordTunedCount = editablePresets.filter((p) => {
    const patch = chartPresets[p.name] ?? defaultChartPresets[p.name] ?? {};
    return Object.keys(patch).some((k) => hasValue(patch[k]));
  }).length;
  const selectedPatchCount = Object.keys(selectedPatch).filter((k) => hasValue(selectedPatch[k])).length;
  const layoutOrigin = resolveActiveChartLayoutOrigin(selectedPatch);

  function setChartOptions(nextOptions: Record<string, unknown>) {
    setWPresets({
      ...wPresets,
      chart_options: nextOptions,
    });
  }

  function setPresetArg(presetName: string, argName: string, value: unknown) {
    setPresetPatch(presetName, { [argName]: value });
  }

  function setPresetPatch(presetName: string, patchIn: Record<string, unknown>) {
    const nextChartPresets: Record<string, Record<string, unknown>> = {
      ...chartPresets,
      [presetName]: { ...(chartPresets[presetName] ?? {}) },
    };
    const defaultPatch = defaultChartPresets[presetName] ?? {};
    for (const [argName, value] of Object.entries(patchIn)) {
      if (value === null || value === undefined || value === "") {
        if (Object.prototype.hasOwnProperty.call(defaultPatch, argName)) {
          nextChartPresets[presetName][argName] = defaultPatch[argName];
        } else {
          delete nextChartPresets[presetName][argName];
        }
      } else {
        nextChartPresets[presetName][argName] = value;
      }
    }
    if (Object.keys(nextChartPresets[presetName]).length === 0) {
      delete nextChartPresets[presetName];
    }
    setWPresets({
      ...wPresets,
      chart_presets: nextChartPresets,
    });
  }

  function resetPreset(presetName: string) {
    const nextChartPresets = { ...chartPresets };
    const defaultPatch = defaultChartPresets[presetName] ?? {};
    if (Object.keys(defaultPatch).length > 0) {
      nextChartPresets[presetName] = { ...defaultPatch };
    } else {
      delete nextChartPresets[presetName];
    }
    setWPresets({
      ...wPresets,
      chart_presets: nextChartPresets,
    });
  }

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
    <div className="pulso-gv2-word-presets">
      <div className="pulso-gv2-word-overview" aria-label="Resumen de estilo para Word">
        <span className="pulso-gv2-word-overview-icon" aria-hidden="true">
          <FileText size={15} />
        </span>
        <span className="pulso-gv2-word-overview-copy">
          <strong>Biblioteca visual Word</strong>
          <span>
            {editablePresets.length} tipos · {wordTunedCount === 0
              ? "todos heredan PPT"
              : `${wordTunedCount} con ajustes Word`}
          </span>
        </span>
        <span className={`pulso-gv2-word-overview-current ${hasSelectedChanges ? "is-custom" : "is-inherited"}`}>
          {hasSelectedChanges ? `${selectedPatchCount} ajuste${selectedPatchCount === 1 ? "" : "s"} Word` : "Hereda PPT"}
        </span>
      </div>

      <section className="pulso-gv2-word-option-card">
        <button
          type="button"
          className={`pulso-gv2-word-toggle ${hideDuplicateLabel ? "is-on" : ""}`}
          aria-pressed={hideDuplicateLabel}
          onClick={() => {
            setChartOptions({
              ...chartOptions,
              ocultar_etiqueta_si_titulo: !hideDuplicateLabel,
            });
          }}
          title="Activar o desactivar esta regla para Word"
        >
          <span />
        </button>
        <div className="pulso-gv2-word-option-copy">
          <div className="pulso-gv2-word-option-title">
            No repetir el título como etiqueta del eje Y
          </div>
          <div className="pulso-gv2-word-option-description">
            Cuando Word coloca el título encima del gráfico, las barras apiladas usan ese título y dejan limpia la etiqueta lateral.
            En listas multiapiladas separadas aplica igual: cada gráfico usa su título y no repite la misma pregunta en el eje.
          </div>
        </div>
      </section>

      <div className="pulso-gv2-word-layout">
        <aside className="pulso-gv2-word-sidebar">
          {editablePresets.map((p) => {
            const Icon = resolveGraphLucideIcon(p.icono_ui, "Sliders");
            const isActive = p.name === meta.name;
            const patch = chartPresets[p.name] ?? {};
            const modified = Object.keys(patch).some((k) => hasValue(patch[k]));
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => setSelected(p.name)}
                className={`pulso-gv2-word-preset ${isActive ? "is-active" : ""}`}
              >
                <Icon size={14} />
                <span className="pulso-gv2-word-preset-label">
                  {p.titulo_humano}
                </span>
                <span className={`pulso-gv2-word-preset-state ${modified ? "is-custom" : "is-inherited"}`}>
                  {modified ? "Word" : "Hereda"}
                </span>
              </button>
            );
          })}
        </aside>

        <section className="pulso-gv2-word-detail">
          <header className="pulso-gv2-word-detail-head">
            <span className="pulso-gv2-word-detail-icon">
              {(() => {
                const Icon = resolveGraphLucideIcon(meta.icono_ui, "Sliders");
                return <Icon size={15} />;
              })()}
            </span>
            <div className="pulso-gv2-word-detail-copy">
              <div className="pulso-gv2-word-title-row">
                <h3>
                  {meta.titulo_humano}
                </h3>
                {hasSelectedChanges && (
                  <span className="pulso-gv2-word-status">
                    <CheckCircle2 size={11} />
                    Ajuste Word
                  </span>
                )}
              </div>
              <p>
                Parte del valor por defecto del PPT y guarda solo las diferencias necesarias para una lectura cómoda en Word.
              </p>
            </div>
            {hasSelectedChanges && (
              <button
                type="button"
                onClick={() => resetPreset(meta.name)}
                className="pulso-gv2-word-reset"
              >
                <RotateCcw size={11} />
                Volver a heredar PPT
              </button>
            )}
          </header>

          <WordSourceRail
            metaName={meta.name}
            metaLabel={meta.titulo_humano}
            editableArgCount={meta.args.length}
            selectedPatchCount={selectedPatchCount}
            hasChanges={hasSelectedChanges}
          />

          <div className="pulso-gv2-word-args">
            {gruposDeArgs.length === 0 ? (
              <div className="pulso-gv2-word-empty">
                Este gráfico no tiene ajustes visuales disponibles para Word.
              </div>
            ) : (
              gruposDeArgs.map(({ grupo, args }) => (
                <ArgGroup
                  key={grupo}
                  grupo={grupo}
                  args={args}
                  values={selectedPatch}
                  inheritedValues={inherited}
                  onChangeArg={(name, val) => setPresetArg(meta.name, name, val)}
                  onResetArg={(name) => setPresetArg(meta.name, name, null)}
                  variables={[]}
                  bodyIntro={normalizeArgGroup(grupo) === "espacio" && hasChartLayoutSpec(meta.name, meta.args) ? (
                    <ChartLayoutEditor
                      presetType={meta.name}
                      args={meta.args}
                      values={selectedPatch}
                      inheritedValues={inherited}
                      origin={layoutOrigin}
                      surfaceLabel="Word"
                      onChangeArg={(name, value) => setPresetArg(meta.name, name, value)}
                      onChangeArgs={(patch) => setPresetPatch(meta.name, patch)}
                    />
                  ) : undefined}
                />
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function WordSourceRail({
  metaName,
  metaLabel,
  editableArgCount,
  selectedPatchCount,
  hasChanges,
}: {
  metaName: string;
  metaLabel: string;
  editableArgCount: number;
  selectedPatchCount: number;
  hasChanges: boolean;
}) {
  const inheritedCount = Math.max(0, editableArgCount - selectedPatchCount);
  return (
    <div className="pulso-gv2-word-source-rail" aria-label="Origen de valores del preset Word">
      <span className="is-ppt">
        <CheckCircle2 size={12} />
        <strong>Valor por defecto</strong>
        <b>PPT heredado</b>
      </span>
      <span className={hasChanges ? "is-word" : "is-inherited"}>
        <Circle size={8} fill={hasChanges ? "currentColor" : "transparent"} />
        <strong>{hasChanges ? "Ajustes Word" : "Sin ajustes extra"}</strong>
        <b>
          {hasChanges
            ? `${selectedPatchCount} ajuste${selectedPatchCount === 1 ? "" : "s"}`
            : `${inheritedCount} heredado${inheritedCount === 1 ? "" : "s"}`}
        </b>
      </span>
      <span className="is-model" title={`Tipo interno: ${metaName}`}>
        <SlidersHorizontal size={12} />
        <strong>Tipo de gráfico</strong>
        <b>{metaLabel}</b>
      </span>
    </div>
  );
}

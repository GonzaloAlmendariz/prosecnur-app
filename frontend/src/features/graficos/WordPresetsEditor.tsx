import { useMemo, useState } from "react";
import * as Lucide from "lucide-react";
import { Circle, RotateCcw } from "lucide-react";
import { ArgGrupo, ArgMetadata } from "../../api/client";
import { usePlanStore } from "./store";
import { usePresetsMetadata } from "./usePresetsMetadata";
import { ArgGroup, ARG_GROUP_ORDER, GRUPO_META, normalizeArgGroup } from "./ArgGroup";
import { LoadingBlock, ErrorBlock } from "../../components/States";

type LucideIcon = (props: { size?: number; color?: string }) => JSX.Element;

function resolveLucide(name: string | undefined): LucideIcon {
  const registry = Lucide as unknown as Record<string, LucideIcon>;
  return (name && registry[name]) || registry["Sliders"] || registry["Square"];
}

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
  const hideDuplicateLabel = chartOptions.ocultar_etiqueta_si_titulo !== false;
  const editablePresets = presets.filter((p) => p.name !== "base" && p.name !== "debug");
  const meta = editablePresets.find((p) => p.name === selected) ?? editablePresets[0];
  if (!meta) return null;

  const selectedPatch = chartPresets[meta.name] ?? {};
  const inherited = pptPresets[meta.name] ?? {};
  const hasSelectedChanges = Object.keys(selectedPatch).some((k) => hasValue(selectedPatch[k]));

  function setChartOptions(nextOptions: Record<string, unknown>) {
    setWPresets({
      ...wPresets,
      chart_options: nextOptions,
    });
  }

  function setPresetArg(presetName: string, argName: string, value: unknown) {
    const nextChartPresets: Record<string, Record<string, unknown>> = {
      ...chartPresets,
      [presetName]: { ...(chartPresets[presetName] ?? {}) },
    };
    if (value === null || value === undefined || value === "") {
      delete nextChartPresets[presetName][argName];
    } else {
      nextChartPresets[presetName][argName] = value;
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
    delete nextChartPresets[presetName];
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
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <section
        style={{
          border: "1px solid var(--pulso-border)",
          borderRadius: 8,
          background: "white",
          padding: 14,
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <button
          type="button"
          aria-pressed={hideDuplicateLabel}
          onClick={() => {
            setChartOptions({
              ...chartOptions,
              ocultar_etiqueta_si_titulo: !hideDuplicateLabel,
            });
          }}
          style={{
            width: 42,
            height: 24,
            borderRadius: 999,
            border: "1px solid",
            borderColor: hideDuplicateLabel ? "var(--pulso-primary)" : "var(--pulso-border)",
            background: hideDuplicateLabel ? "var(--pulso-primary)" : "var(--pulso-surface)",
            padding: 2,
            cursor: "pointer",
            display: "flex",
            justifyContent: hideDuplicateLabel ? "flex-end" : "flex-start",
            flexShrink: 0,
          }}
          title="Activar o desactivar esta regla para Word"
        >
          <span style={{ width: 18, height: 18, borderRadius: 999, background: "white", display: "block" }} />
        </button>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--pulso-text)" }}>
            No repetir el título como etiqueta del eje Y
          </div>
          <div style={{ marginTop: 3, fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.45, maxWidth: 620 }}>
            Cuando Word coloca el título encima del gráfico, las barras apiladas usan ese título y dejan limpia la etiqueta lateral.
            En listas multiapiladas separadas aplica igual: cada gráfico usa su título y no repite la misma pregunta en el eje.
          </div>
        </div>
      </section>

      <div style={{ display: "flex", gap: 16, minHeight: 420 }}>
        <aside
          style={{
            width: 220,
            flexShrink: 0,
            borderRight: "1px solid var(--pulso-border)",
            paddingRight: 12,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {editablePresets.map((p) => {
            const Icon = resolveLucide(p.icono_ui);
            const isActive = p.name === meta.name;
            const patch = chartPresets[p.name] ?? {};
            const modified = Object.keys(patch).some((k) => hasValue(patch[k]));
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => setSelected(p.name)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 9px",
                  borderRadius: 6,
                  border: "1px solid transparent",
                  background: isActive ? "var(--pulso-primary-soft)" : "transparent",
                  color: isActive ? "var(--pulso-primary)" : "var(--pulso-text)",
                  fontSize: 12,
                  fontWeight: isActive ? 600 : 500,
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <Icon size={14} />
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.titulo_humano}
                </span>
                {modified && <Circle size={7} fill="var(--pulso-primary)" color="transparent" aria-label="Modificado" />}
              </button>
            );
          })}
        </aside>

        <section style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          <header
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              paddingBottom: 10,
              borderBottom: "1px solid var(--pulso-border)",
            }}
          >
            <span
              style={{
                width: 30,
                height: 30,
                borderRadius: 7,
                background: "var(--pulso-primary-soft)",
                color: "var(--pulso-primary)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {(() => {
                const Icon = resolveLucide(meta.icono_ui);
                return <Icon size={15} />;
              })()}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 14, lineHeight: 1.3 }}>
                  {meta.titulo_humano}
                </h3>
                {hasSelectedChanges && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: "2px 8px 2px 7px",
                      borderRadius: 999,
                      background: "var(--pulso-primary-soft)",
                      color: "var(--pulso-primary)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      border: "1px solid var(--pulso-primary-border)",
                    }}
                  >
                    <Circle size={6} fill="var(--pulso-primary)" color="transparent" />
                    Ajuste Word
                  </span>
                )}
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.5, maxWidth: 620 }}>
                Parte de los valores del PPT. Cambia solo lo que necesite ser más compacto en Word.
              </p>
            </div>
            {hasSelectedChanges && (
              <button
                type="button"
                onClick={() => resetPreset(meta.name)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11,
                  padding: "5px 10px",
                  border: "1px solid var(--pulso-border)",
                  borderRadius: 6,
                  background: "transparent",
                  color: "var(--pulso-text-soft)",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                <RotateCcw size={11} />
                Usar PPT
              </button>
            )}
          </header>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 620 }}>
            {gruposDeArgs.length === 0 ? (
              <div
                style={{
                  fontSize: 12,
                  color: "var(--pulso-text-soft)",
                  padding: "14px 16px",
                  borderRadius: 6,
                  background: "var(--pulso-surface)",
                  border: "1px solid var(--pulso-border)",
                }}
              >
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
                />
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

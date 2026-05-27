import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { MoveHorizontal, RotateCcw, X } from "lucide-react";
import type { ArgMetadata } from "../../api/client";
import { buildGridTracks, clampByMeta, clampPairByMeta, flexTrackStyle } from "./chartLayoutHelpers";

type LayoutKind = "bars" | "vertical" | "radar";
type TitleAlign = "left" | "center" | "right";
type LegendPosition = "top" | "bottom" | "left" | "right" | "none";

type LayoutField = {
  name: string;
  label: string;
  short: string;
  role: "label" | "gap" | "plot" | "extra" | "header" | "legend" | "caption" | "table" | "row" | "panel";
};

type VisualField = LayoutField & {
  value: number;
  synthetic?: boolean;
};

type DragState = {
  axis: "x" | "y";
  names: [string, string] | [string];
  startClient: number;
  startValues: number[];
  scalePx: number;
  total: number;
  valueMin: number;
  direction?: 1 | -1;
  lastPatch?: Record<string, unknown>;
};

type Props = {
  presetType: string | null;
  args: ArgMetadata[];
  values: Record<string, unknown>;
  inheritedValues?: Record<string, unknown>;
  onChangeArg: (name: string, value: unknown) => void;
  onChangeArgs?: (patch: Record<string, unknown>) => void;
  onResetArg?: (name: string) => void;
};

const BAR_FIELDS: LayoutField[] = [
  { name: "canvas_w_grupo", label: "Columna de grupo", short: "Grupo", role: "label" },
  { name: "canvas_w_buf_grupo_etq", label: "Separador grupo-etiquetas", short: "Sep. grupo", role: "gap" },
  { name: "canvas_w_etiquetas", label: "Columna de etiquetas", short: "Etiquetas", role: "label" },
  { name: "canvas_w_buf_etq_bars", label: "Separador etiquetas-barras", short: "Sep. etiquetas", role: "gap" },
  { name: "canvas_w_bars", label: "Área principal de barras", short: "Área de barras", role: "plot" },
  { name: "canvas_w_buf_bars_extra", label: "Separador barras-extra", short: "Sep. extra", role: "gap" },
  { name: "canvas_w_extra", label: "Barra extra", short: "Barra extra", role: "extra" },
];

const VERTICAL_FIELDS: LayoutField[] = [
  { name: "canvas_h_header_in", label: "Franja de encabezado", short: "Encabezado", role: "header" },
  { name: "canvas_h_title", label: "Franja de título", short: "Título", role: "header" },
  { name: "canvas_pad_top", label: "Margen superior", short: "Margen sup.", role: "gap" },
  { name: "canvas_h_toprow_in", label: "Fila superior auxiliar", short: "Fila superior", role: "header" },
  { name: "alto_por_categoria", label: "Panel de categorías", short: "Categorías", role: "row" },
  { name: "canvas_h_legend_in", label: "Franja de leyenda", short: "Leyenda", role: "legend" },
  { name: "canvas_h_legend", label: "Franja de leyenda", short: "Leyenda", role: "legend" },
  { name: "canvas_h_legend_bottom", label: "Leyenda inferior", short: "Leyenda inferior", role: "legend" },
  { name: "canvas_h_caption_in", label: "Franja de pie", short: "Pie", role: "caption" },
  { name: "canvas_h_caption", label: "Franja de pie", short: "Pie", role: "caption" },
];

const RADAR_FIELDS: LayoutField[] = [
  { name: "tabla_ph_ancho", label: "Tabla de apoyo", short: "Tabla de apoyo", role: "table" },
  { name: "tabla_ph_gap", label: "Separador radar-tabla", short: "Separador", role: "gap" },
  { name: "tabla_ph_margin_top", label: "Margen superior de tabla", short: "Margen sup.", role: "gap" },
  { name: "tabla_ph_margin_bot", label: "Margen inferior de tabla", short: "Margen inf.", role: "gap" },
  { name: "canvas_h_header_in", label: "Franja de encabezado", short: "Encabezado", role: "header" },
  { name: "canvas_h_legend_in", label: "Franja de leyenda", short: "Leyenda", role: "legend" },
  { name: "canvas_h_caption_in", label: "Franja de pie", short: "Pie", role: "caption" },
];

const BARS_PRESETS = new Set(["barras_apiladas", "multi_apiladas", "barras_agrupadas"]);
const PIE_PRESETS = new Set(["pie", "donut"]);
const RADAR_PRESETS = new Set(["radar_tabla", "dim_radar"]);

export function ChartLayoutEditor({
  presetType,
  args,
  values,
  inheritedValues = {},
  onChangeArg,
  onChangeArgs,
  onResetArg,
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [liveValues, setLiveValues] = useState<Record<string, unknown>>({});

  const argsByName = useMemo(() => {
    const map: Record<string, ArgMetadata> = {};
    for (const arg of args) map[arg.name] = arg;
    return map;
  }, [args]);

  const kind = useMemo<LayoutKind | null>(() => resolveLayoutKind(presetType, argsByName), [presetType, argsByName]);
  const fields = useMemo(() => {
    if (!kind) return [];
    const source = kind === "bars" ? [...VERTICAL_FIELDS, ...BAR_FIELDS] : kind === "radar" ? RADAR_FIELDS : VERTICAL_FIELDS;
    return source.filter((field) => argsByName[field.name]);
  }, [argsByName, kind]);
  const valuesKey = JSON.stringify(values);
  const inheritedValuesKey = JSON.stringify(inheritedValues);

  useEffect(() => {
  function onPointerMove(e: PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const client = drag.axis === "x" ? e.clientX : e.clientY;
    const delta = ((client - drag.startClient) / Math.max(1, drag.scalePx)) * drag.total;
      if (drag.names.length === 2) {
        const [leftName, rightName] = drag.names;
        const [nextLeft, nextRight] = clampPairByMeta(
          drag.startValues[0] + delta,
          drag.total,
          argsByName[leftName],
          argsByName[rightName]
        );
        const patch = { [leftName]: nextLeft, [rightName]: nextRight };
        drag.lastPatch = patch;
        setLiveValues((prev) => ({ ...prev, ...patch }));
      } else {
        const name = drag.names[0];
        const direction = drag.direction ?? (kind === "radar" ? -1 : 1);
        const next = clampByMeta((drag.startValues[0] - drag.valueMin) + delta * direction + drag.valueMin, argsByName[name]);
        const patch = { [name]: next };
        drag.lastPatch = patch;
        setLiveValues((prev) => ({ ...prev, ...patch }));
      }
    }
    function onPointerUp() {
      const drag = dragRef.current;
      if (drag?.lastPatch) {
        let commitPatch = drag.lastPatch;
        if (drag.names.length === 2) {
          const [leftName, rightName] = drag.names;
          const [nextLeft, nextRight] = clampPairByMeta(
            Number(drag.lastPatch[leftName]),
            drag.total,
            argsByName[leftName],
            argsByName[rightName]
          );
          commitPatch = { [leftName]: nextLeft, [rightName]: nextRight };
        } else {
          const name = drag.names[0];
          commitPatch = { [name]: clampByMeta(Number(drag.lastPatch[name]), argsByName[name]) };
        }
        commitPatch = withPieLegendExclusion(commitPatch);
        setLiveValues((prev) => ({ ...prev, ...commitPatch }));
        if (onChangeArgs) {
          onChangeArgs(commitPatch);
        } else {
          for (const [name, value] of Object.entries(commitPatch)) onChangeArg(name, value);
        }
      }
      dragRef.current = null;
    }
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [argsByName, fields, kind, onChangeArg, onChangeArgs]);

  useEffect(() => {
    if (!dragRef.current) setLiveValues({});
  }, [valuesKey, inheritedValuesKey]);

  if (!kind || fields.length === 0) return null;

  function valueOf(name: string): number {
    const raw = liveValues[name] ?? values[name] ?? inheritedValues[name] ?? argsByName[name]?.default;
    const num = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(num)) return num;
    return fallbackValue(name);
  }

  function textValueOf(name: string): string {
    const raw = liveValues[name] ?? values[name] ?? inheritedValues[name] ?? argsByName[name]?.default;
    return typeof raw === "string" ? raw : String(raw ?? "");
  }

  function boolValueOf(name: string, fallback: boolean): boolean {
    const raw = liveValues[name] ?? values[name] ?? inheritedValues[name] ?? argsByName[name]?.default;
    if (raw === undefined || raw === null || raw === "") return fallback;
    if (typeof raw === "boolean") return raw;
    if (typeof raw === "string") {
      const normalized = normalizeSemanticValue(raw);
      if (["false", "no", "0", "ninguna", "none"].includes(normalized)) return false;
      if (["true", "si", "sí", "1"].includes(normalized)) return true;
    }
    return Boolean(raw);
  }

  const titleAlign = titleAlignFromValue(textValueOf("pos_titulo"));
  const captionAlign = titleAlignFromValue(textValueOf("pos_nota_pie"));
  const legendPosition = legendPositionFromValue(textValueOf("leyenda_posicion"));
  const showTitle = !argsByName.mostrar_titulo || boolValueOf("mostrar_titulo", true);
  const showLegend = legendPosition !== "none" && (!argsByName.mostrar_leyenda || boolValueOf("mostrar_leyenda", true));

function beginPairDrag(e: ReactPointerEvent, axis: "x" | "y", leftName: string, rightName: string) {
    e.preventDefault();
    e.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const total = valueOf(leftName) + valueOf(rightName);
    dragRef.current = {
      axis,
      names: [leftName, rightName],
      startClient: axis === "x" ? e.clientX : e.clientY,
      startValues: [valueOf(leftName), valueOf(rightName)],
      scalePx: getCanvasTrackLength(canvasRef.current, axis),
      total: total > 0 ? total : 1,
      valueMin: 0,
    };
  }

  function beginSingleDrag(e: ReactPointerEvent, axis: "x" | "y", name: string, direction?: 1 | -1) {
    e.preventDefault();
    e.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scalePx = getDragTrackLength(e.currentTarget.parentElement, axis) ?? getCanvasTrackLength(canvasRef.current, axis);
    dragRef.current = {
      axis,
      names: [name],
      startClient: axis === "x" ? e.clientX : e.clientY,
      startValues: [valueOf(name)],
      scalePx,
      total: Math.max(1e-6, getDragRange(name)),
      direction,
      valueMin: getDragMin(name),
    };
  }

  function getDragRange(name: string): number {
    const meta = argsByName[name];
    if (!meta) return 1;
    const min = typeof meta.min === "number" ? meta.min : 0;
    const max = typeof meta.max === "number" ? meta.max : 1;
    const range = max - min;
    return Number.isFinite(range) && range > 0 ? range : 1;
  }

  function getDragMin(name: string): number {
    const meta = argsByName[name];
    return typeof meta?.min === "number" ? meta.min : 0;
  }

  function resetAll() {
    setLiveValues({});
    if (onChangeArgs) {
      onChangeArgs(Object.fromEntries(fields.map((field) => [field.name, null])));
      return;
    }
    for (const field of fields) onResetArg?.(field.name);
  }

  function setArgValue(name: string, value: number) {
    const next = value === 0 ? 0 : clampByMeta(value, argsByName[name]);
    const rounded = next === 0 ? 0 : Number(next.toFixed(3));
    const patch = withPieLegendExclusion({ [name]: rounded });
    if (rounded === 0 && isLegendLayoutArg(name) && argsByName.mostrar_leyenda) {
      patch.mostrar_leyenda = false;
    }
    if (rounded > 0 && isLegendLayoutArg(name) && argsByName.mostrar_leyenda) {
      patch.mostrar_leyenda = true;
    }
    setLiveValues((prev) => ({ ...prev, ...patch }));
    if (onChangeArgs) {
      onChangeArgs(patch);
      return;
    }
    for (const [patchName, patchValue] of Object.entries(patch)) onChangeArg(patchName, patchValue);
  }

  function withPieLegendExclusion(patch: Record<string, unknown>): Record<string, unknown> {
    const next = { ...patch };
    const rightValue = Number(next.canvas_w_legend_right);
    const bottomNames = ["canvas_h_legend_bottom", "canvas_h_legend"];
    if (argsByName.canvas_w_legend_right && Number.isFinite(rightValue) && rightValue > 0) {
      if (argsByName.leyenda_posicion) {
        next.leyenda_posicion = "derecha";
      } else {
        for (const bottomName of bottomNames) {
          if (argsByName[bottomName]) next[bottomName] = 0;
        }
      }
    }
    const hasBottomActivation = bottomNames.some((bottomName) => {
      const value = Number(next[bottomName]);
      return argsByName[bottomName] && Number.isFinite(value) && value > 0;
    });
    if (hasBottomActivation && argsByName.canvas_w_legend_right) {
      if (argsByName.leyenda_posicion) {
        next.leyenda_posicion = "abajo";
      } else {
        next.canvas_w_legend_right = 0;
      }
    }
    return next;
  }

  return (
    <div className="pulso-gv2-layout-panel" aria-label="Editor visual de distribución del espacio">
          <div className="pulso-gv2-layout-head">
            <span className="pulso-gv2-layout-head-icon"><MoveHorizontal size={14} /></span>
            <div>
              <strong>Distribución del espacio</strong>
              <span>Arrastra separadores. Abajo siguen los argumentos originales con descripción y herencia.</span>
            </div>
          </div>

          <div ref={canvasRef} className={`pulso-gv2-layout-canvas is-${kind}`}>
            {kind === "bars" && (
              <BarsLayout
                fields={fields}
                valueOf={valueOf}
                titleAlign={titleAlign}
                captionAlign={captionAlign}
                showTitle={showTitle}
                showLegend={showLegend}
                legendPosition={legendPosition}
                beginPairDrag={beginPairDrag}
                onSetArgValue={setArgValue}
              />
            )}
            {kind === "vertical" && (
              hasPieLayout(argsByName, presetType) ? (
                <PieLayout
                  argsByName={argsByName}
                  valueOf={valueOf}
                  titleAlign={titleAlign}
                  captionAlign={captionAlign}
                  showTitle={showTitle}
                  showLegend={showLegend}
                  legendPosition={legendPosition}
                  beginPairDrag={beginPairDrag}
                  beginSingleDrag={beginSingleDrag}
                  onSetArgValue={setArgValue}
                />
              ) : (
                <VerticalLayout
                  fields={fields}
                  valueOf={valueOf}
                  titleAlign={titleAlign}
                  captionAlign={captionAlign}
                  showTitle={showTitle}
                  showLegend={showLegend}
                  legendPosition={legendPosition}
                  beginPairDrag={beginPairDrag}
                  onSetArgValue={setArgValue}
                />
              )
            )}
            {kind === "radar" && (
              <RadarLayout
                valueOf={valueOf}
                argsByName={argsByName}
                beginSingleDrag={beginSingleDrag}
                onSetArgValue={setArgValue}
              />
            )}
          </div>

          <div className="pulso-gv2-layout-footer">
            <span><i /> Base</span>
            <span><i /> Modo</span>
            <span><i /> Manual</span>
            <button type="button" onClick={resetAll}>
              <RotateCcw size={12} /> Restaurar layout
            </button>
          </div>
    </div>
  );
}

export function hasChartLayoutSpec(presetType: string | null, args: ArgMetadata[]): boolean {
  const argsByName: Record<string, ArgMetadata> = {};
  for (const arg of args) argsByName[arg.name] = arg;
  return resolveLayoutKind(presetType, argsByName) !== null;
}

export const ChartLayoutPopover = (props: Parameters<typeof ChartLayoutEditor>[0]) => <ChartLayoutEditor {...props} />;

function BarsLayout({
  fields,
  valueOf,
  titleAlign,
  captionAlign,
  showTitle,
  showLegend,
  legendPosition,
  beginPairDrag,
  onSetArgValue,
}: {
  fields: LayoutField[];
  valueOf: (name: string) => number;
  titleAlign: TitleAlign;
  captionAlign: TitleAlign;
  showTitle: boolean;
  showLegend: boolean;
  legendPosition: LegendPosition;
  beginPairDrag: (e: ReactPointerEvent, axis: "x" | "y", leftName: string, rightName: string) => void;
  onSetArgValue: (name: string, value: number) => void;
}) {
  const baseHorizontalFields = BAR_FIELDS.filter((field) => fields.some((item) => item.name === field.name));
  const sideLegendSource = VERTICAL_FIELDS.find((field) => field.role === "legend" && fields.some((item) => item.name === field.name));
  const sideLegendField: VisualField | null = showLegend && sideLegendSource && (legendPosition === "left" || legendPosition === "right")
    ? {
        name: "__layout_side_legend",
        label: legendPosition === "left" ? "Leyenda lateral izquierda" : "Leyenda lateral derecha",
        short: legendPosition === "left" ? "Leyenda izquierda" : "Leyenda derecha",
        role: "legend",
        value: activeLayoutValue(valueOf, sideLegendSource.name, 0.14),
        synthetic: true,
      }
    : null;
  const horizontalFields = sideLegendField && legendPosition === "left"
    ? [sideLegendField, ...baseHorizontalFields]
    : sideLegendField
      ? [...baseHorizontalFields, sideLegendField]
      : baseHorizontalFields;
  const verticalFields = applyVerticalLayoutSemantics(
    VERTICAL_FIELDS.filter((field) => fields.some((item) => item.name === field.name)),
    { showTitle, showLegend, legendPosition }
  );
  const verticalValueOf = (name: string) => {
    const field = verticalFields.find((item) => item.name === name);
    return field ? effectiveVerticalLayoutValue(field, valueOf, showLegend, legendPosition) : valueOf(name);
  };
  const hTotal = horizontalFields.reduce((sum, field) => sum + layoutFieldValue(field, valueOf), 0) || horizontalFields.length;
  const vTotal = verticalFields.reduce((sum, field) => sum + verticalValueOf(field.name), 0) || verticalFields.length;

  if (verticalFields.length === 0) {
    return <BarsHorizontalRow fields={horizontalFields} valueOf={valueOf} total={hTotal} beginPairDrag={beginPairDrag} onSetArgValue={onSetArgValue} />;
  }

  const rows = buildGridTracks(verticalFields, verticalValueOf);

  return (
    <div className="pulso-gv2-layout-bars-grid" style={{ gridTemplateRows: rows }}>
      {verticalFields.map((field, index) => {
        const rawValue = verticalValueOf(field.name);
        const share = vTotal > 0 ? rawValue / vTotal : 0;
        const next = findNextResizableField(verticalFields, index, verticalValueOf);
        const nextValue = next ? verticalValueOf(next.name) : 0;
        const prev = findPrevResizableField(verticalFields, index, verticalValueOf);
        const prevValue = prev ? verticalValueOf(prev.name) : 0;
        const isMain = field.name === "alto_por_categoria";
        return (
          <div
            key={field.name}
            className="pulso-gv2-layout-bars-band"
            style={flexTrackStyle(rawValue, field.role === "gap")}
          >
            {isResizableField(field) && prev && rawValue > 0 && prevValue > 0 && (
              <button
                type="button"
                className="pulso-gv2-layout-handle is-y is-leading"
                onPointerDown={(e) => beginPairDrag(e, "y", prev.name, field.name)}
                aria-label={`Ajustar ${prev.label} y ${field.label}`}
              />
            )}
            {isMain && horizontalFields.length > 0 ? (
              <BarsHorizontalRow fields={horizontalFields} valueOf={valueOf} total={hTotal} beginPairDrag={beginPairDrag} onSetArgValue={onSetArgValue} />
            ) : (
              <div
                className={`pulso-gv2-layout-frame${share < 0.08 ? " is-compact" : ""}${rawValue <= 0 ? " is-zero" : ""}`}
                data-role={field.role}
                data-title-align={isTitleLayoutField(field) ? titleAlign : undefined}
                data-caption-align={field.role === "caption" ? captionAlign : undefined}
                title={`${field.label}: ${formatNumber(rawValue)} (${formatPercent(share)})`}
              >
                <ZeroButton field={field} onSetArgValue={onSetArgValue} />
                <span>{field.short}</span>
                {field.role !== "gap" && (
                  <FrameMetric value={rawValue} total={vTotal} axisLabel="alto" onCommit={(next) => onSetArgValue(field.name, next)} />
                )}
              </div>
            )}
            {isResizableField(field) && next && rawValue > 0 && nextValue > 0 && (
              <button
                type="button"
                className="pulso-gv2-layout-handle is-y"
                onPointerDown={(e) => beginPairDrag(e, "y", field.name, next.name)}
                aria-label={`Ajustar ${field.label} y ${next.label}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function BarsHorizontalRow({
  fields,
  valueOf,
  total,
  beginPairDrag,
  onSetArgValue,
}: {
  fields: Array<LayoutField & { value?: number; synthetic?: boolean }>;
  valueOf: (name: string) => number;
  total: number;
  beginPairDrag: (e: ReactPointerEvent, axis: "x" | "y", leftName: string, rightName: string) => void;
  onSetArgValue: (name: string, value: number) => void;
}) {
  const columns = buildGridTracks(fields, (name) => {
    const field = fields.find((item) => item.name === name);
    return field ? layoutFieldValue(field, valueOf) : valueOf(name);
  });

  return (
    <div className="pulso-gv2-layout-row" style={{ gridTemplateColumns: columns }}>
      {fields.map((field, index) => {
        const rawValue = layoutFieldValue(field, valueOf);
        const share = total > 0 ? rawValue / total : 0;
        const next = findNextResizableField(fields, index, (name) => {
          const item = fields.find((field) => field.name === name);
          return item ? layoutFieldValue(item, valueOf) : valueOf(name);
        });
        const nextValue = next ? layoutFieldValue(next, valueOf) : 0;
        const prev = findPrevResizableField(fields, index, (name) => {
          const item = fields.find((field) => field.name === name);
          return item ? layoutFieldValue(item, valueOf) : valueOf(name);
        });
        const prevValue = prev ? layoutFieldValue(prev, valueOf) : 0;
        return (
          <div
            key={field.name}
            className={`pulso-gv2-layout-frame${share < 0.08 ? " is-compact" : ""}${rawValue <= 0 ? " is-zero" : ""}`}
            data-role={field.role}
            style={flexTrackStyle(rawValue, field.role === "gap")}
            title={`${field.label}: ${formatNumber(rawValue)} (${formatPercent(share)})`}
          >
            {isResizableField(field) && prev && rawValue > 0 && prevValue > 0 && (
              <button
                type="button"
                className="pulso-gv2-layout-handle is-x is-leading"
                onPointerDown={(e) => beginPairDrag(e, "x", prev.name, field.name)}
                aria-label={`Ajustar ${prev.label} y ${field.label}`}
              />
            )}
            <ZeroButton field={field} onSetArgValue={onSetArgValue} />
            <span>{field.short}</span>
            {field.role !== "gap" && (
              <FrameMetric
                value={rawValue}
                total={total}
                axisLabel="ancho"
                onCommit={!field.synthetic ? (next) => onSetArgValue(field.name, next) : undefined}
              />
            )}
            {isResizableField(field) && next && rawValue > 0 && nextValue > 0 && (
              <button
                type="button"
                className="pulso-gv2-layout-handle is-x"
                onPointerDown={(e) => beginPairDrag(e, "x", field.name, next.name)}
                aria-label={`Ajustar ${field.label} y ${next.label}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function VerticalLayout({
  fields,
  valueOf,
  titleAlign,
  captionAlign,
  showTitle,
  showLegend,
  legendPosition,
  beginPairDrag,
  onSetArgValue,
}: {
  fields: LayoutField[];
  valueOf: (name: string) => number;
  titleAlign: TitleAlign;
  captionAlign: TitleAlign;
  showTitle: boolean;
  showLegend: boolean;
  legendPosition: LegendPosition;
  beginPairDrag: (e: ReactPointerEvent, axis: "x" | "y", leftName: string, rightName: string) => void;
  onSetArgValue: (name: string, value: number) => void;
}) {
  const semanticFields = applyVerticalLayoutSemantics(fields, { showTitle, showLegend, legendPosition });
  const semanticValueOf = (name: string) => {
    const field = semanticFields.find((item) => item.name === name);
    return field ? effectiveVerticalLayoutValue(field, valueOf, showLegend, legendPosition) : valueOf(name);
  };
  const visualFields = buildVerticalVisualFields(semanticFields, semanticValueOf);
  const total = visualFields.reduce((sum, field) => sum + field.value, 0) || visualFields.length;
  const rows = buildGridTracks(visualFields, (name) => visualFields.find((field) => field.name === name)?.value ?? 0);

  return (
    <div className="pulso-gv2-layout-column" style={{ gridTemplateRows: rows }}>
      {visualFields.map((field, index) => {
        const rawValue = field.value;
        const share = total > 0 ? rawValue / total : 0;
        const next = findNextResizableField(visualFields, index, (name) => visualFields.find((item) => item.name === name)?.value ?? 0);
        const nextValue = next ? next.value : 0;
        const prev = findPrevResizableField(visualFields, index, (name) => visualFields.find((item) => item.name === name)?.value ?? 0);
        const prevValue = prev ? prev.value : 0;
        return (
          <div
            key={field.name}
            className={`pulso-gv2-layout-frame${share < 0.08 ? " is-compact" : ""}${rawValue <= 0 ? " is-zero" : ""}`}
            data-role={field.role}
            data-title-align={isTitleLayoutField(field) ? titleAlign : undefined}
            data-caption-align={field.role === "caption" ? captionAlign : undefined}
            style={flexTrackStyle(rawValue, field.role === "gap")}
            title={`${field.label}: ${formatNumber(rawValue)} (${formatPercent(share)})`}
          >
            {isResizableField(field) && prev && rawValue > 0 && prevValue > 0 && !field.synthetic && !prev.synthetic && (
              <button
                type="button"
                className="pulso-gv2-layout-handle is-y is-leading"
                onPointerDown={(e) => beginPairDrag(e, "y", prev.name, field.name)}
                aria-label={`Ajustar ${prev.label} y ${field.label}`}
              />
            )}
            <ZeroButton field={field} onSetArgValue={onSetArgValue} />
            <span>{field.short}</span>
            {field.role !== "gap" && (
              <FrameMetric value={rawValue} total={total} axisLabel="alto" onCommit={(next) => onSetArgValue(field.name, next)} />
            )}
            {isResizableField(field) && next && rawValue > 0 && nextValue > 0 && !field.synthetic && !next.synthetic && (
              <button
                type="button"
                className="pulso-gv2-layout-handle is-y"
                onPointerDown={(e) => beginPairDrag(e, "y", field.name, next.name)}
                aria-label={`Ajustar ${field.label} y ${next.label}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function PieLayout({
  argsByName,
  valueOf,
  titleAlign,
  captionAlign,
  showTitle,
  showLegend,
  legendPosition,
  beginPairDrag,
  beginSingleDrag,
  onSetArgValue,
}: {
  argsByName: Record<string, ArgMetadata>;
  valueOf: (name: string) => number;
  titleAlign: TitleAlign;
  captionAlign: TitleAlign;
  showTitle: boolean;
  showLegend: boolean;
  legendPosition: LegendPosition;
  beginPairDrag: (e: ReactPointerEvent, axis: "x" | "y", leftName: string, rightName: string) => void;
  beginSingleDrag: (e: ReactPointerEvent, axis: "x" | "y", name: string, direction?: 1 | -1) => void;
  onSetArgValue: (name: string, value: number) => void;
}) {
  const titleField = showTitle ? fieldIfPresent(argsByName, "canvas_h_title", "Franja de título", "Título", "header") : null;
  const legendBottomField = fieldIfPresent(argsByName, "canvas_h_legend_bottom", "Leyenda inferior", "Leyenda inferior", "legend")
    ?? fieldIfPresent(argsByName, "canvas_h_legend", "Franja de leyenda", "Leyenda", "legend");
  const captionField = fieldIfPresent(argsByName, "canvas_h_caption", "Franja de pie", "Pie", "caption");
  const legendRightField = fieldIfPresent(argsByName, "canvas_w_legend_right", "Leyenda lateral", "Leyenda lateral", "legend");

  const titleValue = titleField ? Math.max(0, valueOf(titleField.name)) : 0;
  const useRightLegend = Boolean(showLegend && legendRightField && legendPosition === "right");
  const legendRightValue = useRightLegend ? activeLayoutValue(valueOf, legendRightField!.name, 0.2) : 0;
  const activeLegendBottomField = showLegend && !useRightLegend && legendPosition !== "left" ? legendBottomField : null;
  const legendBottomValue = activeLegendBottomField ? activeLayoutValue(valueOf, activeLegendBottomField.name, 0.1) : 0;
  const captionValue = captionField ? Math.max(0, valueOf(captionField.name)) : 0;
  const panelValue = Math.max(0.01, 1 - titleValue - legendBottomValue - captionValue);
  const rows: VisualField[] = [
    ...(titleField ? [{ ...titleField, value: Math.max(titleValue, 0.035) }] : []),
    { name: "__layout_panel", label: "Área del gráfico", short: "Área del gráfico", role: "panel", value: panelValue, synthetic: true },
    ...(activeLegendBottomField ? [{ ...activeLegendBottomField, value: legendBottomValue > 0 ? legendBottomValue : 0 }] : []),
    ...(captionField ? [{ ...captionField, value: captionValue > 0 ? captionValue : 0.035 }] : []),
  ];
  const total = rows.reduce((sum, field) => sum + field.value, 0) || 1;
  const templateRows = buildGridTracks(rows, (name) => rows.find((field) => field.name === name)?.value ?? 0);

  return (
    <div className="pulso-gv2-layout-column" style={{ gridTemplateRows: templateRows }}>
      {rows.map((field, index) => {
        const realValue = field.synthetic ? field.value : Math.max(0, valueOf(field.name));
        const share = total > 0 ? field.value / total : 0;
        const next = rows[index + 1];
        const nextValue = next ? next.value : 0;
        const prev = findPrevResizableField(rows, index, (name) => rows.find((item) => item.name === name)?.value ?? 0);
        const prevValue = prev ? prev.value : 0;
        const isPanel = field.synthetic;
        return (
          <div
            key={field.name}
            className={`pulso-gv2-layout-frame${share < 0.08 ? " is-compact" : ""}${realValue <= 0 && !isPanel ? " is-zero" : ""}`}
            data-role={field.role}
            data-title-align={isTitleLayoutField(field) ? titleAlign : undefined}
            data-caption-align={field.role === "caption" ? captionAlign : undefined}
            title={`${field.label}: ${formatNumber(realValue)} (${formatPercent(share)})`}
          >
            {!isPanel && prev && field.value > 0 && prevValue > 0 && !prev.synthetic && (
              <button
                type="button"
                className="pulso-gv2-layout-handle is-y is-leading"
                onPointerDown={(e) => beginPairDrag(e, "y", prev.name, field.name)}
                aria-label={`Ajustar ${prev.label} y ${field.label}`}
              />
            )}
            {!isPanel && <ZeroButton field={field} onSetArgValue={onSetArgValue} />}
            {isPanel && useRightLegend ? (
              <PiePanel
                legendRightField={legendRightField!}
                legendRightValue={legendRightValue}
                beginSingleDrag={beginSingleDrag}
                onSetArgValue={onSetArgValue}
              />
            ) : (
              <>
                <span>{field.short}</span>
                <FrameMetric
                  value={realValue}
                  total={total}
                  axisLabel="alto"
                  onCommit={!isPanel ? (nextValue) => onSetArgValue(field.name, nextValue) : undefined}
                />
              </>
            )}
            {next && field.value > 0 && nextValue > 0 && !field.synthetic && !next.synthetic && (
              <button
                type="button"
                className="pulso-gv2-layout-handle is-y"
                onPointerDown={(e) => beginPairDrag(e, "y", field.name, next.name)}
                aria-label={`Ajustar ${field.label} y ${next.label}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function PiePanel({
  legendRightField,
  legendRightValue,
  beginSingleDrag,
  onSetArgValue,
}: {
  legendRightField: LayoutField;
  legendRightValue: number;
  beginSingleDrag: (e: ReactPointerEvent, axis: "x" | "y", name: string, direction?: 1 | -1) => void;
  onSetArgValue: (name: string, value: number) => void;
}) {
  const legendShare = Math.max(0, Math.min(0.8, legendRightValue));
  const plotShare = Math.max(0.05, 1 - legendShare);
  return (
    <div className="pulso-gv2-layout-pie-panel">
      <div className="pulso-gv2-layout-frame" data-role="panel" style={{ flex: `${plotShare} 1 0` }}>
        <span>Área del gráfico</span>
        <FrameMetric value={plotShare} total={1} axisLabel="ancho" />
      </div>
      {legendRightField && legendRightValue > 0 && (
        <div className="pulso-gv2-layout-frame" data-role="legend" style={{ flex: `${legendShare} 1 0` }}>
          <button
            type="button"
            className="pulso-gv2-layout-handle is-x is-leading"
            onPointerDown={(e) => beginSingleDrag(e, "x", legendRightField.name, -1)}
            aria-label={`Ajustar ancho de ${legendRightField.label}`}
          />
          <ZeroButton field={legendRightField} onSetArgValue={onSetArgValue} />
          <span>{legendRightField.short}</span>
          <FrameMetric
            value={legendRightValue}
            total={1}
            axisLabel="ancho"
            onCommit={(nextValue) => onSetArgValue(legendRightField.name, nextValue)}
          />
        </div>
      )}
    </div>
  );
}

function RadarLayout({
  valueOf,
  argsByName,
  beginSingleDrag,
  onSetArgValue,
}: {
  valueOf: (name: string) => number;
  argsByName: Record<string, ArgMetadata>;
  beginSingleDrag: (e: ReactPointerEvent, axis: "x" | "y", name: string) => void;
  onSetArgValue: (name: string, value: number) => void;
}) {
  const table = argsByName.tabla_ph_ancho ? Math.max(0, Math.min(0.8, valueOf("tabla_ph_ancho"))) : 0;
  const gap = argsByName.tabla_ph_gap ? Math.max(0, Math.min(0.2, valueOf("tabla_ph_gap"))) : 0;
  const plot = Math.max(0.12, 1 - table - gap);
  return (
    <div className="pulso-gv2-layout-radar-grid">
      <div className="pulso-gv2-layout-frame" data-role="plot" style={{ width: `${plot * 100}%` }}>
        <span>Radar</span>
        <FrameMetric value={plot} total={1} axisLabel="ancho" />
      </div>
      {argsByName.tabla_ph_gap && gap > 0 ? (
        <div className="pulso-gv2-layout-frame" data-role="gap" style={{ width: `${gap * 100}%` }}>
          <ZeroButton field={RADAR_FIELDS[1]} onSetArgValue={onSetArgValue} />
          <span>Gap</span>
        </div>
      ) : null}
      {argsByName.tabla_ph_ancho && (
        <div className="pulso-gv2-layout-frame" data-role="table" style={{ width: `${Math.max(12, table * 100)}%` }}>
          <ZeroButton field={RADAR_FIELDS[0]} onSetArgValue={onSetArgValue} />
          <button
            type="button"
            className="pulso-gv2-layout-handle is-x is-leading"
            onPointerDown={(e) => beginSingleDrag(e, "x", "tabla_ph_ancho")}
            aria-label="Ajustar ancho de tabla"
          />
          <span>Tabla</span>
          <FrameMetric value={table} total={1} axisLabel="ancho" onCommit={(next) => onSetArgValue("tabla_ph_ancho", next)} />
        </div>
      )}
    </div>
  );
}

function resolveLayoutKind(presetType: string | null, argsByName: Record<string, ArgMetadata>): LayoutKind | null {
  if (presetType && BARS_PRESETS.has(presetType)) return hasAny(argsByName, BAR_FIELDS) ? "bars" : null;
  if (presetType && RADAR_PRESETS.has(presetType)) return hasAny(argsByName, RADAR_FIELDS) ? "radar" : null;
  if (hasAny(argsByName, VERTICAL_FIELDS)) return "vertical";
  return null;
}

function hasPieLayout(argsByName: Record<string, ArgMetadata>, presetType: string | null): boolean {
  if (presetType && PIE_PRESETS.has(presetType)) return true;

  const hasLegendAnchor =
    Boolean(argsByName.canvas_w_legend_right) ||
    Boolean(argsByName.canvas_h_legend_bottom) ||
    Boolean(argsByName.canvas_h_legend);
  const hasPieMarker = Boolean(argsByName.tipo_pie) || Boolean(argsByName.donat_hole);
  const hasLegacyPieCore =
    Boolean(argsByName.canvas_h_title) &&
    Boolean(argsByName.canvas_h_caption) &&
    Boolean(argsByName.leyenda_posicion);

  return hasLegendAnchor && (hasPieMarker || hasLegacyPieCore);
}

function fieldIfPresent(
  argsByName: Record<string, ArgMetadata>,
  name: string,
  label: string,
  short: string,
  role: LayoutField["role"]
): LayoutField | null {
  return argsByName[name] ? { name, label, short, role } : null;
}

function isResizableField(field: LayoutField & { synthetic?: boolean }): boolean {
  return !field.synthetic && field.role !== "gap";
}

function findNextResizableField<T extends LayoutField & { synthetic?: boolean }>(
  fields: T[],
  index: number,
  valueOf: (name: string) => number
): T | null {
  for (let i = index + 1; i < fields.length; i += 1) {
    const field = fields[i];
    if (!isResizableField(field)) continue;
    if (Math.max(0, valueOf(field.name)) <= 0) continue;
    return field;
  }
  return null;
}

function findPrevResizableField<T extends LayoutField & { synthetic?: boolean }>(
  fields: T[],
  index: number,
  valueOf: (name: string) => number
): T | null {
  for (let i = index - 1; i >= 0; i -= 1) {
    const field = fields[i];
    if (!isResizableField(field)) continue;
    if (Math.max(0, valueOf(field.name)) <= 0) continue;
    return field;
  }
  return null;
}

function hasAny(argsByName: Record<string, ArgMetadata>, fields: LayoutField[]): boolean {
  return fields.some((field) => Boolean(argsByName[field.name]));
}

function buildVerticalVisualFields(fields: LayoutField[], valueOf: (name: string) => number): VisualField[] {
  const realFields = fields.map((field) => ({
    ...field,
    value: Math.max(0, valueOf(field.name)),
  }));
  const hasExplicitPanel = realFields.some((field) => field.role === "row" || field.role === "plot" || field.role === "panel");
  if (hasExplicitPanel) return realFields;

  const used = realFields.reduce((sum, field) => sum + field.value, 0);
  const panelValue = used < 0.98 ? Math.max(0.01, 1 - used) : Math.max(0.01, used * 0.55);
  const panel: VisualField = {
    name: "__layout_panel",
    label: "Panel gráfico",
    short: "Área del gráfico",
    role: "panel",
    value: panelValue,
    synthetic: true,
  };
  const insertAt = realFields.findIndex((field) => field.role === "legend" || field.role === "caption");
  if (insertAt < 0) return [...realFields, panel];
  return [...realFields.slice(0, insertAt), panel, ...realFields.slice(insertAt)];
}

function applyVerticalLayoutSemantics(
  fields: LayoutField[],
  {
    showTitle,
    showLegend,
    legendPosition,
  }: {
    showTitle: boolean;
    showLegend: boolean;
    legendPosition: LegendPosition;
  }
): LayoutField[] {
  const visibleFields = fields.filter((field) => {
    if (!showTitle && isTitleLayoutField(field)) return false;
    if (field.role === "legend") return false;
    return true;
  });
  const legendField = fields.find((field) => field.role === "legend") ?? null;
  if (!showLegend || !legendField || (legendPosition !== "top" && legendPosition !== "bottom")) return visibleFields;

  const mainIndex = visibleFields.findIndex((field) => field.name === "alto_por_categoria" || field.role === "row" || field.role === "panel");
  if (legendPosition === "top") {
    const insertAt = mainIndex >= 0 ? mainIndex : visibleFields.length;
    return [...visibleFields.slice(0, insertAt), legendField, ...visibleFields.slice(insertAt)];
  }

  const captionIndex = visibleFields.findIndex((field) => field.role === "caption");
  const insertAt = captionIndex >= 0 ? captionIndex : visibleFields.length;
  return [...visibleFields.slice(0, insertAt), legendField, ...visibleFields.slice(insertAt)];
}

function activeLayoutValue(valueOf: (name: string) => number, name: string, minimum: number): number {
  const value = Math.max(0, valueOf(name));
  return value > 0 ? value : minimum;
}

function effectiveVerticalLayoutValue(
  field: LayoutField & { value?: number },
  valueOf: (name: string) => number,
  showLegend: boolean,
  legendPosition: LegendPosition
): number {
  if (field.role === "legend" && showLegend && (legendPosition === "top" || legendPosition === "bottom")) {
    return activeLayoutValue(valueOf, field.name, 0.1);
  }
  return layoutFieldValue(field, valueOf);
}

function layoutFieldValue(field: LayoutField & { value?: number }, valueOf: (name: string) => number): number {
  return Math.max(0, typeof field.value === "number" ? field.value : valueOf(field.name));
}

function isTitleLayoutField(field: LayoutField & { synthetic?: boolean }): boolean {
  return field.name === "canvas_h_title" || field.name === "canvas_h_header_in";
}

function isLegendLayoutArg(name: string): boolean {
  return name === "canvas_w_legend_right" || name === "canvas_h_legend_bottom" || name === "canvas_h_legend" || name === "canvas_h_legend_in";
}

function normalizeSemanticValue(value: string): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function titleAlignFromValue(value: string): TitleAlign {
  const normalized = normalizeSemanticValue(value);
  if (normalized === "izquierda" || normalized === "left") return "left";
  if (normalized === "derecha" || normalized === "right") return "right";
  return "center";
}

function legendPositionFromValue(value: string): LegendPosition {
  const normalized = normalizeSemanticValue(value);
  if (normalized === "arriba" || normalized === "top") return "top";
  if (normalized === "derecha" || normalized === "right") return "right";
  if (normalized === "izquierda" || normalized === "left") return "left";
  if (normalized === "ninguna" || normalized === "none" || normalized === "no") return "none";
  return "bottom";
}

function fallbackValue(name: string): number {
  if (name.includes("_w_") || name.includes("_ancho")) return 0.2;
  if (name.includes("gap") || name.includes("buf") || name.includes("pad") || name.includes("margin")) return 0.02;
  if (name.includes("legend") || name.includes("caption")) return 0.1;
  return 0.3;
}

function ZeroButton({
  field,
  onSetArgValue,
}: {
  field: LayoutField & { synthetic?: boolean };
  onSetArgValue: (name: string, value: number) => void;
}) {
  if (field.synthetic || field.role === "plot" || field.role === "panel") return null;
  return (
    <button
      type="button"
      className="pulso-gv2-layout-zero"
      aria-label={`Poner ${field.label} en cero`}
      title={`Poner ${field.label} en 0`}
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onSetArgValue(field.name, 0);
      }}
    >
      <X size={10} strokeWidth={2.4} />
    </button>
  );
}

function FrameMetric({
  value,
  total,
  axisLabel,
  compact = false,
  onCommit,
}: {
  value: number;
  total: number;
  axisLabel: "ancho" | "alto";
  compact?: boolean;
  onCommit?: (value: number) => void;
}) {
  const share = total > 0 ? value / total : 0;
  const axisTitle = axisLabel === "ancho" ? "Ancho" : "Alto";
  const [draft, setDraft] = useState(formatNumber(value));
  useEffect(() => {
    setDraft(formatNumber(value));
  }, [value]);
  function commitDraft() {
    if (!onCommit) return;
    const next = parseLayoutNumber(draft);
    if (next === null) {
      setDraft(formatNumber(value));
      return;
    }
    onCommit(next);
  }
  const valueControl = onCommit ? (
    <input
      type="text"
      inputMode="decimal"
      aria-label="Editar valor del placeholder"
      value={draft}
      onPointerDown={(event) => event.stopPropagation()}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={commitDraft}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commitDraft();
          event.currentTarget.blur();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          setDraft(formatNumber(value));
          event.currentTarget.blur();
        }
      }}
    />
  ) : (
    <b>{formatNumber(value)}</b>
  );
  if (compact) {
    return (
      <small className="pulso-gv2-layout-metric is-gap-metric">
        {onCommit && (
          <span>
            <em>Valor</em>
            {valueControl}
          </span>
        )}
        <span>
          <em>{axisTitle}</em>
          <b>{formatPercent(share)}</b>
        </span>
      </small>
    );
  }
  return (
    <small className="pulso-gv2-layout-metric">
      <span>
        <em>Valor</em>
        {valueControl}
      </span>
      <span>
        <em>{axisTitle}</em>
        <b>{formatPercent(share)}</b>
      </span>
    </small>
  );
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return Number(value.toFixed(3)).toString().replace(".", ",");
}

function parseLayoutNumber(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(3)) : null;
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "0%";
  return `${Number((value * 100).toFixed(1)).toString().replace(".", ",")}%`;
}

function getCanvasTrackLength(canvas: HTMLDivElement | null, axis: "x" | "y"): number {
  if (!canvas) return 1;
  const style = getComputedStyle(canvas);
  const padX = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);
  const padY = Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom);
  const axisLength = axis === "x" ? canvas.clientWidth - padX : canvas.clientHeight - padY;
  return Number.isFinite(axisLength) && axisLength > 1 ? axisLength : 1;
}

function getDragTrackLength(node: HTMLElement | null, axis: "x" | "y"): number | null {
  if (!node) return null;
  const rect = node.getBoundingClientRect();
  const axisLength = axis === "x" ? rect.width : rect.height;
  if (!Number.isFinite(axisLength) || axisLength <= 1) return null;
  return axisLength;
}

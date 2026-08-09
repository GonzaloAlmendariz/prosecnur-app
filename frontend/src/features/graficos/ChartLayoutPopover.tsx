import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { MoveHorizontal, RotateCcw, Ruler, X } from "lucide-react";
import type { ArgMetadata } from "../../api/client";
import {
  buildGridTracks,
  canShareLayoutMeasurePair,
  clampByMeta,
  clampPairByMeta,
  flexTrackStyle,
  resolveLayoutMeasureContract,
} from "./chartLayoutHelpers";
import type { LayoutMeasureBasis, LayoutMeasureContract } from "./chartLayoutHelpers";
import { presentChartLayoutOrigin } from "./chartLayoutOrigin";
import type { ChartLayoutOrigin } from "./chartLayoutOrigin";
import "./chartLayoutEditor.css";

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

type DragGuideState = {
  axis: "x" | "y";
  position: number;
  label: string;
};

type Props = {
  presetType: string | null;
  args: ArgMetadata[];
  values: Record<string, unknown>;
  inheritedValues?: Record<string, unknown>;
  origin: ChartLayoutOrigin;
  surfaceLabel?: string;
  onChangeArg: (name: string, value: unknown) => void;
  onChangeArgs?: (patch: Record<string, unknown>) => void;
  onResetArg?: (name: string) => void;
};

const BAR_FIELDS: LayoutField[] = [
  { name: "canvas_w_grupo", label: "Columna de grupo", short: "Grupo", role: "label" },
  { name: "canvas_w_buf_grupo_etq", label: "Separación grupo-etiquetas", short: "Respiro", role: "gap" },
  { name: "canvas_w_etiquetas", label: "Espacio para etiquetas", short: "Etiquetas", role: "label" },
  { name: "canvas_w_buf_etq_bars", label: "Separación etiquetas-barras", short: "Respiro", role: "gap" },
  { name: "canvas_w_bars", label: "Espacio para barras", short: "Barras", role: "plot" },
  { name: "canvas_w_buf_bars_extra", label: "Separación barra-columna derecha", short: "Respiro", role: "gap" },
  { name: "canvas_w_extra", label: "Columna derecha", short: "Columna derecha", role: "extra" },
];

const VERTICAL_FIELDS: LayoutField[] = [
  { name: "canvas_h_header_in", label: "Alto del encabezado", short: "Encabezado", role: "header" },
  { name: "canvas_h_title", label: "Espacio para título", short: "Título", role: "header" },
  { name: "canvas_pad_top", label: "Respiro superior", short: "Respiro", role: "gap" },
  { name: "canvas_h_toprow_in", label: "Fila auxiliar superior", short: "Auxiliar", role: "header" },
  { name: "alto_por_categoria", label: "Alto de filas del gráfico", short: "Filas", role: "row" },
  { name: "canvas_h_legend_in", label: "Espacio para leyenda", short: "Leyenda", role: "legend" },
  { name: "canvas_h_legend", label: "Espacio para leyenda", short: "Leyenda", role: "legend" },
  { name: "canvas_h_legend_bottom", label: "Leyenda inferior", short: "Leyenda inferior", role: "legend" },
  { name: "canvas_h_caption_in", label: "Espacio para nota/base", short: "Nota / base", role: "caption" },
  { name: "canvas_h_caption", label: "Espacio para nota/base", short: "Nota / base", role: "caption" },
];

const RADAR_FIELDS: LayoutField[] = [
  { name: "tabla_ph_ancho", label: "Tabla de apoyo", short: "Tabla de apoyo", role: "table" },
  { name: "tabla_ph_gap", label: "Separación radar-tabla", short: "Respiro", role: "gap" },
  { name: "tabla_ph_margin_top", label: "Margen superior de tabla", short: "Margen sup.", role: "gap" },
  { name: "tabla_ph_margin_bot", label: "Margen inferior de tabla", short: "Margen inf.", role: "gap" },
  { name: "canvas_h_header_in", label: "Alto del encabezado", short: "Encabezado", role: "header" },
  { name: "canvas_h_legend_in", label: "Espacio para leyenda", short: "Leyenda", role: "legend" },
  { name: "canvas_h_caption_in", label: "Espacio para nota/base", short: "Nota / base", role: "caption" },
];

const BARS_PRESETS = new Set(["barras_apiladas", "multi_apiladas", "barras_agrupadas"]);
const PIE_PRESETS = new Set(["pie", "donut"]);
const RADAR_PRESETS = new Set(["radar_tabla", "dim_radar"]);

const BASIS_LABELS: Record<LayoutMeasureBasis, { label: string; rule: string }> = {
  "ratio-partition": { label: "Ancho", rule: "Reparto común" },
  "fixed-inch": { label: "Alto fijo", rule: "Banda del render" },
  "nested-inch": { label: "Fila interna", rule: "Dentro del panel" },
  "per-category-inch": { label: "Filas", rule: "Escala con los datos" },
  "measure-only": { label: "Medida exacta", rule: "Sin reparto visual" },
};

export function ChartLayoutEditor({
  presetType,
  args,
  values,
  inheritedValues = {},
  origin,
  surfaceLabel,
  onChangeArg,
  onChangeArgs,
  onResetArg,
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [liveValues, setLiveValues] = useState<Record<string, unknown>>({});
  const [dragGuide, setDragGuide] = useState<DragGuideState | null>(null);

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
      const guidePosition = pointerPositionInCanvas(canvasRef.current, drag.axis, e);
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
        setDragGuide({
          axis: drag.axis,
          position: guidePosition,
          label: `${layoutFieldLabel(leftName, fields, argsByName)} ${formatNumber(nextLeft)} · ${layoutFieldLabel(rightName, fields, argsByName)} ${formatNumber(nextRight)}. Suelta para guardar.`,
        });
      } else {
        const name = drag.names[0];
        const direction = drag.direction ?? (kind === "radar" ? -1 : 1);
        const next = clampByMeta((drag.startValues[0] - drag.valueMin) + delta * direction + drag.valueMin, argsByName[name]);
        const patch = { [name]: next };
        drag.lastPatch = patch;
        setLiveValues((prev) => ({ ...prev, ...patch }));
        setDragGuide({
          axis: drag.axis,
          position: guidePosition,
          label: `${layoutFieldLabel(name, fields, argsByName)} ${formatNumber(next)}. Suelta para guardar.`,
        });
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
      setDragGuide(null);
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

  const ownFields = fields.filter((field) => hasStoredValue(values[field.name]));
  const layoutKindLabel = kind === "bars" ? "Barras horizontales" : kind === "radar" ? "Radar + tabla" : hasPieLayout(argsByName, presetType) ? "Gráfico circular" : "Gráfico vertical";
  const measureContracts = useMemo(() => {
    const contracts: Record<string, LayoutMeasureContract> = {};
    for (const field of fields) {
      contracts[field.name] = resolveLayoutMeasureContract(field.name, argsByName[field.name]);
    }
    return contracts;
  }, [argsByName, fields]);
  const basisSummary = useMemo(() => buildBasisSummary(fields, measureContracts), [fields, measureContracts]);
  const originPresentation = presentChartLayoutOrigin(origin);
  const hasOwnLayout = ownFields.length > 0;

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
    const leftContract = resolveLayoutMeasureContract(leftName, argsByName[leftName]);
    const rightContract = resolveLayoutMeasureContract(rightName, argsByName[rightName]);
    if (!canShareLayoutMeasurePair(leftContract, rightContract) || leftContract.axis !== axis) return;
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
    setDragGuide({
      axis,
      position: pointerPositionInCanvas(canvasRef.current, axis, e.nativeEvent),
      label: `Repartiendo espacio entre ${layoutFieldLabel(leftName, fields, argsByName)} y ${layoutFieldLabel(rightName, fields, argsByName)}. Suelta para guardar.`,
    });
  }

  function resetAll() {
    if (!originPresentation.declared || ownFields.length === 0) return;
    setLiveValues({});
    if (onChangeArgs) {
      onChangeArgs(Object.fromEntries(ownFields.map((field) => [field.name, null])));
      return;
    }
    for (const field of ownFields) onResetArg?.(field.name);
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

  const hasPairDrag = hasCompatibleLayoutPair(fields, valueOf, argsByName);
  const canvasInteractionCopy = hasPairDrag
    ? "Arrastra bordes entre medidas compatibles o escribe medidas exactas."
    : "Escribe medidas exactas para ajustar los parámetros publicados.";

  return (
    <div
      className="pulso-gv2-layout-panel"
      data-source-state={originPresentation.state}
      data-qa-geometry-group="graficos/distribucion-espacio"
      data-qa-geometry-contract="intrinsic"
      aria-label={surfaceLabel ? `Editor visual de espacios del gráfico: ${surfaceLabel}` : "Editor visual de espacios del gráfico"}
    >
          <div className="pulso-gv2-layout-head">
            <span className="pulso-gv2-layout-head-icon"><MoveHorizontal size={14} /></span>
            <div className="pulso-gv2-layout-head-copy">
              <span className="pulso-gv2-layout-eyebrow">{layoutKindLabel}</span>
              <strong>Distribución del espacio</strong>
              <span>Controla parámetros del render. La vista PPT confirma el resultado final.</span>
            </div>
            <div
              className="pulso-gv2-layout-state-card"
              aria-label={`Procedencia de esta edición: ${originPresentation.label}. ${originPresentation.detail}`}
            >
              <span>Procedencia</span>
              <strong>{originPresentation.label}</strong>
              <small>{originPresentation.detail}</small>
            </div>
          </div>

          <div className="pulso-gv2-layout-basis-strip" aria-label="Bases dimensionales de las medidas visibles">
            {basisSummary.map((item) => (
              <span key={item.basis} data-basis={item.basis}>
                <strong>{item.label}</strong>
                <small>{item.unitLabel}</small>
                <em>{item.rule}</em>
              </span>
            ))}
          </div>

          <div
            ref={canvasRef}
            className={`pulso-gv2-layout-canvas is-${kind}${dragGuide ? " is-dragging" : ""}`}
            data-layout-kind={layoutKindLabel}
            role="group"
            aria-label={`Editor visual de espacios para ${layoutKindLabel}. ${canvasInteractionCopy}`}
          >
            {dragGuide && <DragGuide guide={dragGuide} />}
            {kind === "bars" && (
              <BarsLayout
                fields={fields}
                argsByName={argsByName}
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
                  onSetArgValue={setArgValue}
                />
              ) : (
                <VerticalLayout
                  fields={fields}
                  argsByName={argsByName}
                  valueOf={valueOf}
                  titleAlign={titleAlign}
                  captionAlign={captionAlign}
                  showTitle={showTitle}
                  showLegend={showLegend}
                  legendPosition={legendPosition}
                  onSetArgValue={setArgValue}
                />
              )
            )}
            {kind === "radar" && (
              <RadarLayout argsByName={argsByName} />
            )}
          </div>

          <LayoutMeasureBoard
            fields={fields}
            valueOf={valueOf}
            argsByName={argsByName}
            onSetArgValue={setArgValue}
          />

          <div className="pulso-gv2-layout-footer">
            <button
              type="button"
              onClick={resetAll}
              className="pulso-gv2-layout-reset"
              disabled={!originPresentation.declared || !hasOwnLayout}
              title={
                !originPresentation.declared
                  ? "Declara la procedencia antes de restablecer valores"
                  : hasOwnLayout
                    ? "Restablecer únicamente los valores propios visibles"
                    : "Este ámbito no tiene valores propios visibles"
              }
            >
              <RotateCcw size={12} /> {originPresentation.resetLabel}
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

function LayoutMeasureBoard({
  fields,
  valueOf,
  argsByName,
  onSetArgValue,
}: {
  fields: LayoutField[];
  valueOf: (name: string) => number;
  argsByName: Record<string, ArgMetadata>;
  onSetArgValue: (name: string, value: number) => void;
}) {
  const visibleFields = fields.filter((field) => argsByName[field.name]);
  if (visibleFields.length === 0) return null;

  return (
    <details className="pulso-gv2-layout-measure-board">
      <summary>
        <span>
          <Ruler size={12} />
          <strong>Medidas exactas</strong>
        </span>
        <small>{visibleFields.length} espacios editables</small>
      </summary>
      <div className="pulso-gv2-layout-measure-grid">
        {visibleFields.map((field) => (
          <LayoutMeasureCell
            key={field.name}
            field={field}
            value={valueOf(field.name)}
            meta={argsByName[field.name]}
            contract={resolveLayoutMeasureContract(field.name, argsByName[field.name])}
            onCommit={(next) => onSetArgValue(field.name, next)}
          />
        ))}
      </div>
    </details>
  );
}

function LayoutMeasureCell({
  field,
  value,
  meta,
  contract,
  onCommit,
}: {
  field: LayoutField;
  value: number;
  meta?: ArgMetadata;
  contract: LayoutMeasureContract;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(formatNumber(value));

  useEffect(() => {
    setDraft(formatNumber(value));
  }, [value]);

  function commitDraft() {
    const next = parseLayoutNumber(draft);
    if (next === null) {
      setDraft(formatNumber(value));
      return;
    }
    onCommit(next);
  }

  return (
    <label className="pulso-gv2-layout-measure-cell" data-role={field.role}>
      <span className="pulso-gv2-layout-measure-copy">
        <strong>{field.label}</strong>
        <small>{layoutFieldHelp(field, meta, contract)}</small>
      </span>
      <span className="pulso-gv2-layout-measure-input">
        <input
          type="text"
          inputMode="decimal"
          value={draft}
          aria-label={`Medida exacta: ${field.label}`}
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
        <em>{contract.unitLabel}</em>
      </span>
    </label>
  );
}

function buildBasisSummary(
  fields: LayoutField[],
  contracts: Record<string, LayoutMeasureContract>
): Array<{ basis: LayoutMeasureBasis; label: string; unitLabel: string; rule: string }> {
  const basisOrder: LayoutMeasureBasis[] = [
    "ratio-partition",
    "fixed-inch",
    "nested-inch",
    "per-category-inch",
    "measure-only",
  ];
  return basisOrder.flatMap((basis) => {
    const contract = fields.map((field) => contracts[field.name]).find((item) => item?.basis === basis);
    if (!contract) return [];
    return [{ basis, ...BASIS_LABELS[basis], unitLabel: contract.unitLabel }];
  });
}

function BarsLayout({
  fields,
  argsByName,
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
  argsByName: Record<string, ArgMetadata>;
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
  const horizontalFields = baseHorizontalFields.filter((field) => {
    const contract = resolveLayoutMeasureContract(field.name, argsByName[field.name]);
    return contract.basis === "ratio-partition" && contract.canShare;
  });
  const intrinsicHorizontalFields: Array<LayoutField & { value?: number; synthetic?: boolean }> = [
    ...baseHorizontalFields.filter((field) => !horizontalFields.some((candidate) => candidate.name === field.name)),
    ...(sideLegendField ? [sideLegendField] : []),
  ];
  const verticalFields = applyVerticalLayoutSemantics(
    VERTICAL_FIELDS.filter((field) => fields.some((item) => item.name === field.name)),
    { showTitle, showLegend, legendPosition }
  );
  const verticalValueOf = (name: string) => {
    const field = verticalFields.find((item) => item.name === name);
    return field ? effectiveVerticalLayoutValue(field, valueOf, showLegend, legendPosition) : valueOf(name);
  };
  const hTotal = horizontalFields.reduce((sum, field) => sum + layoutFieldValue(field, valueOf), 0) || horizontalFields.length;

  const horizontalSurface = (
    <>
      <IntrinsicLayoutRoles fields={intrinsicHorizontalFields} argsByName={argsByName} valueOf={valueOf} />
      {horizontalFields.length > 0 ? (
        <BarsHorizontalRow fields={horizontalFields} argsByName={argsByName} valueOf={valueOf} total={hTotal} beginPairDrag={beginPairDrag} onSetArgValue={onSetArgValue} />
      ) : (
        <div className="pulso-gv2-layout-qualitative-role" data-role="plot" data-synthetic="true">
          <span>Área horizontal · Sin partición publicada</span>
          <small>Usa las medidas exactas; la vista PPT confirma el resultado.</small>
        </div>
      )}
    </>
  );

  if (verticalFields.length === 0) {
    return <div className="pulso-gv2-layout-bars-main is-standalone">{horizontalSurface}</div>;
  }

  return (
    <div className="pulso-gv2-layout-bars-grid is-semantic">
      {verticalFields.map((field) => {
        const rawValue = verticalValueOf(field.name);
        const contract = resolveLayoutMeasureContract(field.name, argsByName[field.name]);
        const isMain = field.name === "alto_por_categoria";
        const isInternal = field.name === "canvas_h_toprow_in";

        if (isInternal) return null;

        return (
          <div
            key={field.name}
            className={`pulso-gv2-layout-bars-band${isMain ? " is-data-panel" : " is-fixed-measure"}`}
            data-basis={contract.basis}
          >
            {isMain ? (
              <div className="pulso-gv2-layout-bars-main">
                <LayoutRuleBadge field={field} value={rawValue} contract={contract} />
                {verticalFields.filter((candidate) => candidate.name === "canvas_h_toprow_in").map((candidate) => (
                  <LayoutRuleBadge
                    key={candidate.name}
                    field={candidate}
                    value={verticalValueOf(candidate.name)}
                    contract={resolveLayoutMeasureContract(candidate.name, argsByName[candidate.name])}
                  />
                ))}
                {horizontalSurface}
              </div>
            ) : (
              <div
                className={`pulso-gv2-layout-frame${contract.basis === "ratio-partition" && rawValue <= 0 ? " is-zero" : ""}`}
                data-role={field.role}
                data-basis={contract.basis}
                data-title-align={isTitleLayoutField(field) ? titleAlign : undefined}
                data-caption-align={field.role === "caption" ? captionAlign : undefined}
                title={layoutMeasureTitle(field, rawValue, contract)}
              >
                <ZeroButton field={field} onSetArgValue={onSetArgValue} />
                <span>{field.short}</span>
                {field.role !== "gap" && (
                  <FrameMetric value={rawValue} total={1} axisLabel="alto" fieldLabel={field.label} contract={contract} onCommit={(next) => onSetArgValue(field.name, next)} />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function LayoutRuleBadge({
  field,
  value,
  contract,
}: {
  field: LayoutField;
  value: number;
  contract: LayoutMeasureContract;
}) {
  return (
    <div
      className="pulso-gv2-layout-rule-badge"
      data-basis={contract.basis}
      title={layoutMeasureTitle(field, value, contract)}
    >
      <span>{field.name === "alto_por_categoria" ? "Alto por fila" : field.short}</span>
      <strong>{formatNumber(value)} {contract.unitLabel}</strong>
      <small>{layoutMeasureRule(contract)}</small>
    </div>
  );
}

function IntrinsicLayoutRoles({
  fields,
  argsByName,
  valueOf,
}: {
  fields: Array<LayoutField & { value?: number; synthetic?: boolean }>;
  argsByName: Record<string, ArgMetadata>;
  valueOf: (name: string) => number;
}) {
  if (fields.length === 0) return null;
  return (
    <div className="pulso-gv2-layout-intrinsic-roles" aria-label="Roles sin partición geométrica publicada">
      {fields.map((field) => {
        if (field.synthetic) {
          return (
            <div key={field.name} className="pulso-gv2-layout-qualitative-role" data-role={field.role} data-synthetic="true">
              <span>{field.short} · Estimado</span>
              <small>Rol cualitativo; no participa del reparto.</small>
            </div>
          );
        }
        return (
          <LayoutRuleBadge
            key={field.name}
            field={field}
            value={valueOf(field.name)}
            contract={resolveLayoutMeasureContract(field.name, argsByName[field.name])}
          />
        );
      })}
    </div>
  );
}

function BarsHorizontalRow({
  fields,
  argsByName,
  valueOf,
  total,
  beginPairDrag,
  onSetArgValue,
}: {
  fields: Array<LayoutField & { value?: number; synthetic?: boolean }>;
  argsByName: Record<string, ArgMetadata>;
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
        const contract = resolveLayoutMeasureContract(field.name, argsByName[field.name]);
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
            className={`pulso-gv2-layout-frame${share <= 0.1 ? " is-compact" : ""}${rawValue <= 0 ? " is-zero" : ""}`}
            data-role={field.role}
            data-basis={contract.basis}
            data-synthetic={field.synthetic ? "true" : undefined}
            style={flexTrackStyle(rawValue, field.role === "gap")}
            title={field.synthetic ? `${field.label}: Estimado` : layoutMeasureTitle(field, rawValue, contract, share)}
          >
            {isResizableField(field) && prev && rawValue > 0 && prevValue > 0 && canShareFieldPair(prev, field, argsByName) && (
              <button
                type="button"
                className="pulso-gv2-layout-handle is-x is-leading"
                onPointerDown={(e) => beginPairDrag(e, "x", prev.name, field.name)}
                aria-label={resizePairLabel(prev, field)}
                title={resizePairLabel(prev, field)}
              />
            )}
            <ZeroButton field={field} onSetArgValue={onSetArgValue} />
            <span>{field.short}{field.synthetic ? " · Estimado" : ""}</span>
            {field.role !== "gap" && (
              <FrameMetric
                value={rawValue}
                total={total}
                axisLabel="ancho"
                fieldLabel={field.label}
                contract={contract}
                onCommit={!field.synthetic ? (next) => onSetArgValue(field.name, next) : undefined}
              />
            )}
            {isResizableField(field) && next && rawValue > 0 && nextValue > 0 && canShareFieldPair(field, next, argsByName) && (
              <button
                type="button"
                className="pulso-gv2-layout-handle is-x"
                onPointerDown={(e) => beginPairDrag(e, "x", field.name, next.name)}
                aria-label={resizePairLabel(field, next)}
                title={resizePairLabel(field, next)}
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
  argsByName,
  valueOf,
  titleAlign,
  captionAlign,
  showTitle,
  showLegend,
  legendPosition,
  onSetArgValue,
}: {
  fields: LayoutField[];
  argsByName: Record<string, ArgMetadata>;
  valueOf: (name: string) => number;
  titleAlign: TitleAlign;
  captionAlign: TitleAlign;
  showTitle: boolean;
  showLegend: boolean;
  legendPosition: LegendPosition;
  onSetArgValue: (name: string, value: number) => void;
}) {
  const semanticFields = applyVerticalLayoutSemantics(fields, { showTitle, showLegend, legendPosition });
  const semanticValueOf = (name: string) => {
    const field = semanticFields.find((item) => item.name === name);
    return field ? effectiveVerticalLayoutValue(field, valueOf, showLegend, legendPosition) : valueOf(name);
  };
  const visualFields = buildVerticalVisualFields(semanticFields, semanticValueOf);

  return (
    <div className="pulso-gv2-layout-column is-intrinsic">
      {visualFields.map((field) => {
        const rawValue = field.value;
        const contract = resolveLayoutMeasureContract(field.name, argsByName[field.name]);
        return (
          <div
            key={field.name}
            className="pulso-gv2-layout-frame"
            data-role={field.role}
            data-basis={contract.basis}
            data-synthetic={field.synthetic ? "true" : undefined}
            data-title-align={isTitleLayoutField(field) ? titleAlign : undefined}
            data-caption-align={field.role === "caption" ? captionAlign : undefined}
            title={field.synthetic ? `${field.label}: Estimado` : layoutMeasureTitle(field, rawValue, contract)}
          >
            <ZeroButton field={field} onSetArgValue={onSetArgValue} />
            <span>{field.short}{field.synthetic ? " · Estimado" : ""}</span>
            {field.synthetic ? (
              <small className="pulso-gv2-layout-qualitative-copy">Rol cualitativo; no deriva su tamaño de medidas sin unidad.</small>
            ) : field.role !== "gap" && (
              <FrameMetric value={rawValue} total={1} axisLabel="alto" fieldLabel={field.label} contract={contract} onCommit={!field.synthetic ? (next) => onSetArgValue(field.name, next) : undefined} />
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
  onSetArgValue,
}: {
  argsByName: Record<string, ArgMetadata>;
  valueOf: (name: string) => number;
  titleAlign: TitleAlign;
  captionAlign: TitleAlign;
  showTitle: boolean;
  showLegend: boolean;
  legendPosition: LegendPosition;
  onSetArgValue: (name: string, value: number) => void;
}) {
  const titleField = showTitle ? fieldIfPresent(argsByName, "canvas_h_title", "Franja de título", "Título", "header") : null;
  const legendBottomField = fieldIfPresent(argsByName, "canvas_h_legend_bottom", "Leyenda inferior", "Leyenda inferior", "legend")
    ?? fieldIfPresent(argsByName, "canvas_h_legend", "Franja de leyenda", "Leyenda", "legend");
  const captionField = fieldIfPresent(argsByName, "canvas_h_caption", "Franja de pie", "Pie", "caption");
  const legendRightField = fieldIfPresent(argsByName, "canvas_w_legend_right", "Leyenda lateral", "Leyenda lateral", "legend");

  const useRightLegend = Boolean(showLegend && legendRightField && legendPosition === "right");
  const activeLegendBottomField = showLegend && !useRightLegend && legendPosition !== "left" ? legendBottomField : null;
  const rows: VisualField[] = [
    ...(titleField ? [{ ...titleField, value: Math.max(0, valueOf(titleField.name)) }] : []),
    { name: "__layout_panel", label: "Área del gráfico", short: "Área del gráfico", role: "panel", value: 1, synthetic: true },
    ...(useRightLegend && legendRightField ? [{ ...legendRightField, value: Math.max(0, valueOf(legendRightField.name)) }] : []),
    ...(activeLegendBottomField ? [{ ...activeLegendBottomField, value: Math.max(0, valueOf(activeLegendBottomField.name)) }] : []),
    ...(captionField ? [{ ...captionField, value: Math.max(0, valueOf(captionField.name)) }] : []),
  ];

  return (
    <div className="pulso-gv2-layout-column is-intrinsic">
      {rows.map((field) => {
        const realValue = field.synthetic ? 1 : Math.max(0, valueOf(field.name));
        const contract = resolveLayoutMeasureContract(field.name, argsByName[field.name]);
        return (
          <div
            key={field.name}
            className="pulso-gv2-layout-frame"
            data-role={field.role}
            data-basis={contract.basis}
            data-synthetic={field.synthetic ? "true" : undefined}
            data-title-align={isTitleLayoutField(field) ? titleAlign : undefined}
            data-caption-align={field.role === "caption" ? captionAlign : undefined}
            title={field.synthetic ? `${field.label}: Estimado` : layoutMeasureTitle(field, realValue, contract)}
          >
            {!field.synthetic && <ZeroButton field={field} onSetArgValue={onSetArgValue} />}
            <span>{field.short}{field.synthetic ? " · Estimado" : ""}</span>
            {field.synthetic ? (
              <small className="pulso-gv2-layout-qualitative-copy">Rol cualitativo; no deriva su tamaño de medidas sin unidad.</small>
            ) : (
              <FrameMetric
                value={realValue}
                total={1}
                axisLabel={contract.axis === "x" ? "ancho" : "alto"}
                fieldLabel={field.label}
                contract={contract}
                onCommit={(nextValue) => onSetArgValue(field.name, nextValue)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function RadarLayout({
  argsByName,
}: {
  argsByName: Record<string, ArgMetadata>;
}) {
  return (
    <div className="pulso-gv2-layout-radar-grid is-intrinsic">
      <div className="pulso-gv2-layout-frame" data-role="plot" data-synthetic="true" title="Radar: Estimado">
        <span>Radar · Estimado</span>
        <small className="pulso-gv2-layout-qualitative-copy">Rol cualitativo; la vista PPT confirma su tamaño.</small>
      </div>
      {argsByName.tabla_ph_gap ? (
        <div className="pulso-gv2-layout-frame" data-role="gap" data-synthetic="true" title="Separación radar-tabla: Estimado">
          <span>Gap · Estimado</span>
        </div>
      ) : null}
      {argsByName.tabla_ph_ancho && (
        <div className="pulso-gv2-layout-frame" data-role="table" data-synthetic="true" title="Tabla: Estimado; medida exacta sin unidad publicada">
          <span>Tabla · Estimado</span>
          <small className="pulso-gv2-layout-qualitative-copy">Rol cualitativo; edita el valor en Medidas exactas.</small>
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

function layoutFieldHelp(field: LayoutField, meta: ArgMetadata | undefined, contract: LayoutMeasureContract): string {
  if (field.name === "canvas_w_etiquetas") return "Más espacio evita cortes en preguntas largas.";
  if (field.name === "canvas_w_bars") return "Cuerpo principal donde se dibujan las barras.";
  if (field.name === "canvas_w_extra") return "Reserva para N, total, Top 2 u otra columna de apoyo.";
  if (field.name === "canvas_h_header_in") return "Banda fija para título, pregunta o subtítulo.";
  if (field.name === "canvas_h_toprow_in") return "Regla interna del panel para indicadores sobre las barras.";
  if (field.name === "alto_por_categoria") return "Escala dependiente de datos: se aplica una vez por categoría.";
  if (field.role === "legend") return "Espacio reservado para la leyenda visible.";
  if (field.role === "caption") return "Notas, fuente o base al pie del gráfico.";
  if (field.role === "gap") return "Separación visual entre zonas cercanas.";
  if (field.role === "table") return "Área dedicada a la tabla de apoyo.";
  if (meta?.descripcion) return meta.descripcion;
  return contract.basis === "measure-only"
    ? "Medida exacta sin geometría compartida publicada."
    : layoutMeasureRule(contract);
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

  const panel: VisualField = {
    name: "__layout_panel",
    label: "Panel gráfico",
    short: "Área del gráfico",
    role: "panel",
    value: 1,
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

function setZeroInteraction(button: HTMLElement, active: boolean) {
  button.closest(".pulso-gv2-layout-canvas")?.classList.toggle("is-zero-interacting", active);
}

function releaseZeroInteraction(button: HTMLElement) {
  const canvas = button.closest(".pulso-gv2-layout-canvas");
  window.requestAnimationFrame(() => {
    canvas?.classList.remove("is-zero-interacting");
  });
}

function ZeroButton({
  field,
  onSetArgValue,
}: {
  field: LayoutField & { synthetic?: boolean };
  onSetArgValue: (name: string, value: number) => void;
}) {
  const pointerCommitRef = useRef(false);

  if (field.synthetic || field.role === "plot" || field.role === "panel") return null;
  return (
    <button
      type="button"
      className="pulso-gv2-layout-zero"
      aria-label={`Ocultar ${field.label} poniendo su espacio en cero`}
      title={`Ocultar ${field.label} (espacio en 0)`}
      onPointerEnter={(event) => {
        setZeroInteraction(event.currentTarget, true);
      }}
      onPointerLeave={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
          releaseZeroInteraction(event.currentTarget);
        }
      }}
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        pointerCommitRef.current = false;
        setZeroInteraction(event.currentTarget, true);
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        event.stopPropagation();
      }}
      onPointerUp={(event) => {
        event.preventDefault();
        event.stopPropagation();
        pointerCommitRef.current = true;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        onSetArgValue(field.name, 0);
        releaseZeroInteraction(event.currentTarget);
      }}
      onPointerCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        pointerCommitRef.current = false;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        releaseZeroInteraction(event.currentTarget);
      }}
      onBlur={(event) => {
        releaseZeroInteraction(event.currentTarget);
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (pointerCommitRef.current) {
          pointerCommitRef.current = false;
          return;
        }
        onSetArgValue(field.name, 0);
      }}
    >
      <X size={13} strokeWidth={2.4} />
    </button>
  );
}

function FrameMetric({
  value,
  total,
  axisLabel,
  fieldLabel,
  contract,
  compact = false,
  onCommit,
}: {
  value: number;
  total: number;
  axisLabel: "ancho" | "alto";
  fieldLabel?: string;
  contract: LayoutMeasureContract;
  compact?: boolean;
  onCommit?: (value: number) => void;
}) {
  const axisTitle = axisLabel === "ancho" ? "Ancho" : "Alto";
  const publishesShare = contract.basis === "ratio-partition" && contract.canShare;
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
      aria-label={`Editar ${fieldLabel ?? "zona"}: medida exacta de ${axisTitle.toLowerCase()}`}
      title="Medida exacta del espacio. Usa coma o punto decimal; Enter aplica y Escape cancela."
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
  if (!publishesShare) {
    return (
      <small
        className="pulso-gv2-layout-metric is-measure-only"
        data-axis={axisLabel}
        data-basis={contract.basis}
        aria-label={`${fieldLabel ?? "Zona"}: valor exacto ${formatNumber(value)} ${contract.unitLabel}. ${layoutMeasureRule(contract)}`}
      >
        <span className="pulso-gv2-layout-metric-cell is-value">
          <em>Valor</em>
          {valueControl}
        </span>
        <span className="pulso-gv2-layout-metric-cell is-unit">
          <em>Unidad</em>
          <b>{contract.unitLabel}</b>
        </span>
      </small>
    );
  }

  const share = total > 0 ? value / total : 0;
  const sharePercent = formatPercent(share);
  const shareTier = metricShareTier(share, value);
  const shareLabel = metricShareLabel(shareTier);
  const metricStyle = {
    "--metric-progress": `${Math.max(0, Math.min(100, share * 100))}%`,
  } as CSSProperties;

  if (compact) {
    return (
      <small
        className="pulso-gv2-layout-metric is-gap-metric"
        data-axis={axisLabel}
        data-share-tier={shareTier}
        style={metricStyle}
        aria-label={`${fieldLabel ?? "Zona"}: ${axisTitle.toLowerCase()} relativo ${sharePercent}; valor exacto ${formatNumber(value)}`}
      >
        {onCommit && (
          <span className="pulso-gv2-layout-metric-cell is-value">
            <em>Valor</em>
            {valueControl}
          </span>
        )}
        <span className="pulso-gv2-layout-metric-cell is-share">
          <em>%</em>
          <b>{sharePercent}</b>
        </span>
      </small>
    );
  }
  return (
    <small
      className="pulso-gv2-layout-metric"
      data-axis={axisLabel}
      data-share-tier={shareTier}
      style={metricStyle}
      aria-label={`${fieldLabel ?? "Zona"}: ${axisTitle.toLowerCase()} relativo ${sharePercent}; valor exacto ${formatNumber(value)}; estado ${shareLabel}`}
    >
      <span className="pulso-gv2-layout-metric-cell is-value">
        <em>Valor</em>
        {valueControl}
      </span>
      <span className="pulso-gv2-layout-metric-cell is-share">
        <em>%</em>
        <b>{sharePercent}</b>
      </span>
      <i className="pulso-gv2-layout-metric-bar" aria-hidden="true" />
      <span className="pulso-gv2-layout-metric-tier" aria-hidden="true">
        <em>Estado</em>
        <b>{shareLabel}</b>
      </span>
    </small>
  );
}

function metricShareTier(share: number, value: number): "hidden" | "compact" | "balanced" | "dominant" {
  if (!Number.isFinite(value) || value <= 0 || share <= 0.005) return "hidden";
  if (share <= 0.11) return "compact";
  if (share >= 0.48) return "dominant";
  return "balanced";
}

function metricShareLabel(tier: ReturnType<typeof metricShareTier>): string {
  if (tier === "hidden") return "Oculta";
  if (tier === "compact") return "Compacta";
  if (tier === "dominant") return "Principal";
  return "Media";
}

function DragGuide({ guide }: { guide: DragGuideState }) {
  const style = guide.axis === "x"
    ? { left: `${guide.position * 100}%` }
    : { top: `${guide.position * 100}%` };
  return (
    <div className={`pulso-gv2-layout-drag-guide is-${guide.axis}`} style={style} aria-hidden="true">
      <span>{guide.label}</span>
    </div>
  );
}

function pointerPositionInCanvas(
  canvas: HTMLDivElement | null,
  axis: "x" | "y",
  event: Pick<PointerEvent, "clientX" | "clientY">
): number {
  const rect = canvas?.getBoundingClientRect();
  if (!rect) return 0.5;
  const axisSize = axis === "x" ? rect.width : rect.height;
  const axisStart = axis === "x" ? rect.left : rect.top;
  const client = axis === "x" ? event.clientX : event.clientY;
  const position = (client - axisStart) / Math.max(1, axisSize);
  return Math.min(1, Math.max(0, position));
}

function resizePairLabel(first: LayoutField, second: LayoutField): string {
  return `Arrastra el borde para repartir espacio entre ${first.label} y ${second.label}`;
}

function canShareFieldPair(
  first: LayoutField,
  second: LayoutField,
  argsByName: Record<string, ArgMetadata>
): boolean {
  return canShareLayoutMeasurePair(
    resolveLayoutMeasureContract(first.name, argsByName[first.name]),
    resolveLayoutMeasureContract(second.name, argsByName[second.name])
  );
}

function hasCompatibleLayoutPair(
  fields: LayoutField[],
  valueOf: (name: string) => number,
  argsByName: Record<string, ArgMetadata>
): boolean {
  const shareableByPartition = new Map<string, number>();
  for (const field of fields) {
    if (!isResizableField(field) || valueOf(field.name) <= 0) continue;
    const contract = resolveLayoutMeasureContract(field.name, argsByName[field.name]);
    if (!contract.canShare || !contract.partition || contract.basis !== "ratio-partition") continue;
    const count = (shareableByPartition.get(contract.partition) ?? 0) + 1;
    if (count >= 2) return true;
    shareableByPartition.set(contract.partition, count);
  }
  return false;
}

function layoutMeasureRule(contract: LayoutMeasureContract): string {
  if (contract.basis === "ratio-partition") return "Reparte el ancho con medidas compatibles.";
  if (contract.basis === "fixed-inch") return "Banda fija del render.";
  if (contract.basis === "nested-inch") return "Zona interna del panel.";
  if (contract.basis === "per-category-inch") return "Escala con la cantidad de categorías.";
  return "Edición exacta; sin reparto visual.";
}

function layoutMeasureTitle(
  field: LayoutField,
  value: number,
  contract: LayoutMeasureContract,
  share?: number
): string {
  if (contract.basis === "ratio-partition" && contract.canShare && typeof share === "number") {
    return `${field.label}: ${formatNumber(value)} ${contract.unitLabel} (${formatPercent(share)})`;
  }
  return `${field.label}: ${formatNumber(value)} ${contract.unitLabel}. ${layoutMeasureRule(contract)}`;
}

function layoutFieldLabel(
  name: string,
  fields: LayoutField[],
  argsByName: Record<string, ArgMetadata>
): string {
  const knownField =
    fields.find((field) => field.name === name) ??
    [...BAR_FIELDS, ...VERTICAL_FIELDS, ...RADAR_FIELDS].find((field) => field.name === name);
  return knownField?.short ?? knownField?.label ?? argsByName[name]?.label ?? name;
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

function hasStoredValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
}

function getCanvasTrackLength(canvas: HTMLDivElement | null, axis: "x" | "y"): number {
  if (!canvas) return 1;
  const style = getComputedStyle(canvas);
  const padX = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);
  const padY = Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom);
  const axisLength = axis === "x" ? canvas.clientWidth - padX : canvas.clientHeight - padY;
  return Number.isFinite(axisLength) && axisLength > 1 ? axisLength : 1;
}

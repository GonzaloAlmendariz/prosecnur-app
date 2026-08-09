import type { ReactNode } from "react";
import type { GraficadorBlueprintKind } from "../../api/client";
import {
  BarChart3,
  Hash,
  LayoutGrid,
  Map,
  MessageSquare,
  Radar,
  Table2,
  type LucideIcon,
} from "../../vendor/lucide-react";

export type GraficadorBlueprintVariant = "card" | "hero";

export type { GraficadorBlueprintKind } from "../../api/client";

const GRAFICADOR_BLUEPRINT_KINDS = new Set<string>([
  "bars-grouped",
  "bars-categorical",
  "bars-stacked",
  "bars-multi-stacked",
  "pie",
  "donut",
  "numeric",
  "histogram",
  "boxplot",
  "mean-range",
  "bars-diverging",
  "comparison-dots",
  "dumbbell",
  "lollipop",
  "line-series",
  "radar",
  "table",
  "word-cloud",
  "territory-map",
  "dimension-radar",
  "dimension-heatmap",
  "dimension-radar-bars",
  "dimension-foda",
  "dimension-criteria-heatmap",
  "future",
]);

function isGraficadorBlueprintKind(value: unknown): value is GraficadorBlueprintKind {
  return typeof value === "string" && GRAFICADOR_BLUEPRINT_KINDS.has(value);
}

export function resolveGraficadorBlueprint(blueprint: unknown): GraficadorBlueprintKind {
  return isGraficadorBlueprintKind(blueprint) ? blueprint : "future";
}

export function GraficadorBlueprint({
  blueprint,
  iconoUi,
  variant = "card",
  label,
}: {
  blueprint?: GraficadorBlueprintKind;
  iconoUi?: string;
  variant?: GraficadorBlueprintVariant;
  label?: string;
}) {
  const kind = resolveGraficadorBlueprint(blueprint);
  return (
    <span
      className={`pulso-graficador-library-blueprint pulso-graficador-library-blueprint--${variant}`}
      data-blueprint={kind}
      data-qa-geometry-capacity="owned"
    >
      <svg
        viewBox="0 0 160 90"
        preserveAspectRatio="xMidYMid meet"
        focusable="false"
        role={label ? "img" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
      >
        {label && <title>{label}</title>}
        <BlueprintMarks kind={kind} iconoUi={iconoUi} />
      </svg>
    </span>
  );
}

function BlueprintMarks({
  kind,
  iconoUi,
}: {
  kind: GraficadorBlueprintKind;
  iconoUi?: string;
}): ReactNode {
  switch (kind) {
    case "bars-grouped":
      return (
        <>
          <ChartAxes />
          <g className="pulso-graficador-library-blueprint-primary">
            <rect x="28" y="42" width="8" height="27" rx="2" />
            <rect x="66" y="28" width="8" height="41" rx="2" />
            <rect x="104" y="35" width="8" height="34" rx="2" />
          </g>
          <g className="pulso-graficador-library-blueprint-soft">
            <rect x="38" y="31" width="8" height="38" rx="2" />
            <rect x="76" y="46" width="8" height="23" rx="2" />
            <rect x="114" y="22" width="8" height="47" rx="2" />
          </g>
        </>
      );
    case "bars-categorical":
      return (
        <>
          <ChartAxes />
          <g className="pulso-graficador-library-blueprint-soft">
            <rect x="31" y="46" width="15" height="23" rx="3" />
            <rect x="58" y="24" width="15" height="45" rx="3" />
            <rect x="85" y="37" width="15" height="32" rx="3" />
            <rect x="112" y="17" width="15" height="52" rx="3" />
          </g>
          <g className="pulso-graficador-library-blueprint-primary">
            <circle cx="38.5" cy="42" r="2.5" />
            <circle cx="65.5" cy="20" r="2.5" />
            <circle cx="92.5" cy="33" r="2.5" />
            <circle cx="119.5" cy="13" r="2.5" />
          </g>
        </>
      );
    case "bars-stacked":
      return (
        <>
          <g className="pulso-graficador-library-blueprint-label-lines">
            <path d="M16 26H34M16 44H29M16 62H37" />
          </g>
          <g className="pulso-graficador-library-blueprint-soft">
            <rect x="42" y="20" width="74" height="12" rx="3" />
            <rect x="42" y="38" width="87" height="12" rx="3" />
            <rect x="42" y="56" width="68" height="12" rx="3" />
          </g>
          <g className="pulso-graficador-library-blueprint-primary">
            <path d="M42 20h31v12H42zM42 38h45v12H42zM42 56h24v12H42z" />
          </g>
          <g className="pulso-graficador-library-blueprint-cut-lines">
            <path d="M94 20v12M106 38v12M86 56v12" />
          </g>
        </>
      );
    case "bars-multi-stacked":
      return (
        <>
          <g className="pulso-graficador-library-blueprint-band">
            <rect x="14" y="14" width="18" height="27" rx="3" />
            <rect x="14" y="48" width="18" height="27" rx="3" />
          </g>
          <g className="pulso-graficador-library-blueprint-soft">
            <rect x="39" y="14" width="91" height="8" rx="2" />
            <rect x="39" y="25" width="78" height="8" rx="2" />
            <rect x="39" y="36" width="99" height="8" rx="2" />
            <rect x="39" y="48" width="84" height="8" rx="2" />
            <rect x="39" y="59" width="95" height="8" rx="2" />
            <rect x="39" y="70" width="70" height="8" rx="2" />
          </g>
          <g className="pulso-graficador-library-blueprint-primary">
            <path d="M39 14h34v8H39zM39 25h48v8H39zM39 36h25v8H39zM39 48h42v8H39zM39 59h56v8H39zM39 70h31v8H39z" />
          </g>
        </>
      );
    case "pie":
      return (
        <>
          <g className="pulso-graficador-library-blueprint-primary">
            <path d="M78 44V15A29 29 0 0 1 106 51Z" />
          </g>
          <g className="pulso-graficador-library-blueprint-soft">
            <path d="M78 44l28 7A29 29 0 0 1 59 67Z" />
          </g>
          <g className="pulso-graficador-library-blueprint-muted">
            <path d="M78 44 59 67A29 29 0 0 1 78 15Z" />
          </g>
          <LegendLines />
        </>
      );
    case "donut":
      return (
        <>
          <circle className="pulso-graficador-library-blueprint-ring-muted" cx="71" cy="45" r="26" />
          <circle className="pulso-graficador-library-blueprint-ring-primary" cx="71" cy="45" r="26" pathLength="100" strokeDasharray="45 55" transform="rotate(-90 71 45)" />
          <circle className="pulso-graficador-library-blueprint-ring-soft" cx="71" cy="45" r="26" pathLength="100" strokeDasharray="28 72" strokeDashoffset="-45" transform="rotate(-90 71 45)" />
          <circle className="pulso-graficador-library-blueprint-center" cx="71" cy="45" r="13" />
          <LegendLines x={111} />
        </>
      );
    case "numeric":
      return (
        <>
          <text className="pulso-graficador-library-blueprint-kpi" x="22" y="51">72%</text>
          <path className="pulso-graficador-library-blueprint-line" d="M87 57l13-9 12 4 16-20 13 5" />
          <g className="pulso-graficador-library-blueprint-primary">
            <circle cx="87" cy="57" r="2.5" /><circle cx="100" cy="48" r="2.5" />
            <circle cx="112" cy="52" r="2.5" /><circle cx="128" cy="32" r="2.5" />
            <circle cx="141" cy="37" r="2.5" />
          </g>
          <g className="pulso-graficador-library-blueprint-label-lines">
            <path d="M24 62h43M24 68h31M87 68h54" />
          </g>
        </>
      );
    case "histogram":
      return (
        <>
          <ChartAxes />
          <g className="pulso-graficador-library-blueprint-soft">
            <path d="M26 62h12v7H26zM38 50h12v19H38zM50 34h12v35H50zM62 20h12v49H62zM74 16h12v53H74zM86 25h12v44H86zM98 41h12v28H98zM110 55h12v14H110zM122 63h12v6H122z" />
          </g>
          <path className="pulso-graficador-library-blueprint-line" d="M27 62c20-2 25-42 53-46 28 2 32 42 53 47" />
        </>
      );
    case "boxplot":
      return (
        <>
          <g className="pulso-graficador-library-blueprint-axis">
            <path d="M20 20v54M20 29h125M20 51h125M20 72h125" />
          </g>
          <g className="pulso-graficador-library-blueprint-line">
            <path d="M39 20v18M34 20h10M34 38h10M80 14v30M75 14h10M75 44h10M121 27v23M116 27h10M116 50h10" />
          </g>
          <g className="pulso-graficador-library-blueprint-soft">
            <rect x="30" y="24" width="18" height="10" rx="2" />
            <rect x="70" y="22" width="20" height="14" rx="2" />
            <rect x="111" y="32" width="20" height="12" rx="2" />
          </g>
          <g className="pulso-graficador-library-blueprint-cut-lines">
            <path d="M39 24v10M80 22v14M121 32v12" />
          </g>
        </>
      );
    case "mean-range":
      return (
        <>
          <ChartAxes />
          <g className="pulso-graficador-library-blueprint-line">
            <path d="M39 27v35M34 27h10M34 62h10M72 18v31M67 18h10M67 49h10M105 37v32M100 37h10M100 69h10M136 23v26M131 23h10M131 49h10" />
          </g>
          <g className="pulso-graficador-library-blueprint-primary">
            <circle cx="39" cy="45" r="4" /><circle cx="72" cy="32" r="4" />
            <circle cx="105" cy="54" r="4" /><circle cx="136" cy="37" r="4" />
          </g>
        </>
      );
    case "bars-diverging":
      // El eje cruza en cero: lo que importa es que se vea el reparto a los dos
      // lados, no la longitud total.
      return (
        <>
          <line
            className="pulso-graficador-library-blueprint-axis"
            x1="80" y1="14" x2="80" y2="72"
          />
          <g className="pulso-graficador-library-blueprint-soft">
            <rect x="52" y="20" width="28" height="10" rx="2" />
            <rect x="40" y="36" width="40" height="10" rx="2" />
            <rect x="58" y="52" width="22" height="10" rx="2" />
          </g>
          <g className="pulso-graficador-library-blueprint-primary">
            <rect x="80" y="20" width="42" height="10" rx="2" />
            <rect x="80" y="36" width="26" height="10" rx="2" />
            <rect x="80" y="52" width="48" height="10" rx="2" />
          </g>
        </>
      );
    case "comparison-dots":
      // Un punto por grupo con tinta azul Pulso uniforme, sin distinguir series
      // ni insinuar una relación entre observaciones independientes.
      return (
        <>
          <ChartAxes />
          <g fill="#002457">
            <circle cx="52" cy="20" r="4" />
            <circle cx="83" cy="35" r="4" />
            <circle cx="109" cy="50" r="4" />
            <circle cx="70" cy="65" r="4" />
          </g>
          <g className="pulso-graficador-library-blueprint-quadrant-labels">
            <text x="119" y="22">n = 48</text>
            <text x="119" y="37">n = 61</text>
            <text x="119" y="52">n = 54</text>
            <text x="119" y="67">n = 39</text>
          </g>
        </>
      );
    case "dumbbell":
      // La brecha ES el segmento: dos puntos unidos, uno por base.
      return (
        <>
          <ChartAxes />
          <g className="pulso-graficador-library-blueprint-soft">
            <line x1="46" y1="26" x2="104" y2="26" strokeWidth="3" strokeLinecap="round" />
            <line x1="38" y1="44" x2="88" y2="44" strokeWidth="3" strokeLinecap="round" />
            <line x1="58" y1="62" x2="118" y2="62" strokeWidth="3" strokeLinecap="round" />
          </g>
          <g className="pulso-graficador-library-blueprint-primary">
            <circle cx="46" cy="26" r="4" />
            <circle cx="104" cy="26" r="4" />
            <circle cx="38" cy="44" r="4" />
            <circle cx="88" cy="44" r="4" />
            <circle cx="58" cy="62" r="4" />
            <circle cx="118" cy="62" r="4" />
          </g>
        </>
      );
    case "lollipop":
      // Tallo fino y punto: la misma lectura que una barra con menos tinta.
      return (
        <>
          <ChartAxes />
          <g className="pulso-graficador-library-blueprint-soft">
            <line x1="28" y1="22" x2="122" y2="22" strokeWidth="2" strokeLinecap="round" />
            <line x1="28" y1="36" x2="98" y2="36" strokeWidth="2" strokeLinecap="round" />
            <line x1="28" y1="50" x2="76" y2="50" strokeWidth="2" strokeLinecap="round" />
            <line x1="28" y1="64" x2="58" y2="64" strokeWidth="2" strokeLinecap="round" />
          </g>
          <g className="pulso-graficador-library-blueprint-primary">
            <circle cx="122" cy="22" r="4" />
            <circle cx="98" cy="36" r="4" />
            <circle cx="76" cy="50" r="4" />
            <circle cx="58" cy="64" r="4" />
          </g>
        </>
      );
    case "line-series":
      // Evolucion: una linea por tema, un punto por ola, y el ultimo destacado.
      return (
        <>
          <ChartAxes />
          <g className="pulso-graficador-library-blueprint-soft">
            <polyline
              points="32,58 64,50 96,52 124,40"
              fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            />
            <circle cx="32" cy="58" r="2.5" />
            <circle cx="64" cy="50" r="2.5" />
            <circle cx="96" cy="52" r="2.5" />
          </g>
          <g className="pulso-graficador-library-blueprint-primary">
            <polyline
              points="32,48 64,36 96,30 124,20"
              fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            />
            <circle cx="32" cy="48" r="2.5" />
            <circle cx="64" cy="36" r="2.5" />
            <circle cx="96" cy="30" r="2.5" />
            <circle cx="124" cy="20" r="4.5" />
          </g>
        </>
      );
    case "radar":
      return (
        <RadarShape cx={72} cy={45} radius={29} />
      );
    case "table":
      return (
        <>
          <rect className="pulso-graficador-library-blueprint-table-frame" x="18" y="14" width="124" height="62" rx="3" />
          <path className="pulso-graficador-library-blueprint-table-header" d="M18 14h124v14H18z" />
          <g className="pulso-graficador-library-blueprint-axis">
            <path d="M18 28h124M18 44h124M18 60h124M61 14v62M102 14v62" />
          </g>
          <g className="pulso-graficador-library-blueprint-primary">
            <rect x="108" y="34" width="25" height="5" rx="2" />
            <rect x="108" y="50" width="18" height="5" rx="2" />
            <rect x="108" y="66" width="22" height="5" rx="2" />
          </g>
        </>
      );
    case "word-cloud":
      return (
        <g className="pulso-graficador-library-blueprint-word-cloud">
          <text x="50" y="43" className="pulso-graficador-library-blueprint-word--large">tema</text>
          <text x="25" y="59" className="pulso-graficador-library-blueprint-word--medium">voces</text>
          <text x="92" y="58" className="pulso-graficador-library-blueprint-word--medium">ideas</text>
          <text x="30" y="31">dato</text>
          <text x="103" y="30">opinión</text>
          <text x="64" y="69">relato</text>
        </g>
      );
    case "territory-map":
      return (
        <>
          <g className="pulso-graficador-library-blueprint-map">
            <path d="M31 19l29-7 18 12-5 23-24 7-22-13z" />
            <path d="M78 24l27-9 22 14-7 22-21 9-26-13z" />
            <path d="M49 54l24-7 26 13-8 20-31-4-19-11z" />
            <path d="M99 60l21-9 17 12-11 17H91z" />
          </g>
          <g className="pulso-graficador-library-blueprint-primary">
            <circle cx="59" cy="34" r="3" /><circle cx="105" cy="36" r="3" />
            <circle cx="74" cy="64" r="3" /><circle cx="116" cy="68" r="3" />
          </g>
        </>
      );
    case "dimension-radar":
      return (
        <>
          <RadarShape cx={67} cy={45} radius={28} compact />
          <g className="pulso-graficador-library-blueprint-dimension-pills">
            <rect x="107" y="22" width="34" height="9" rx="4" />
            <rect x="107" y="36" width="27" height="9" rx="4" />
            <rect x="107" y="50" width="38" height="9" rx="4" />
            <rect x="107" y="64" width="31" height="9" rx="4" />
          </g>
        </>
      );
    case "dimension-heatmap":
      return <Heatmap criteria={false} />;
    case "dimension-radar-bars":
      return (
        <>
          <RadarShape cx={48} cy={45} radius={26} compact />
          <g className="pulso-graficador-library-blueprint-soft">
            <rect x="86" y="19" width="48" height="8" rx="2" />
            <rect x="86" y="34" width="61" height="8" rx="2" />
            <rect x="86" y="49" width="38" height="8" rx="2" />
            <rect x="86" y="64" width="54" height="8" rx="2" />
          </g>
          <g className="pulso-graficador-library-blueprint-primary">
            <path d="M86 19h29v8H86zM86 34h44v8H86zM86 49h22v8H86zM86 64h37v8H86z" />
          </g>
        </>
      );
    case "dimension-foda":
      return (
        <>
          <rect className="pulso-graficador-library-blueprint-table-frame" x="23" y="13" width="114" height="64" rx="3" />
          <path className="pulso-graficador-library-blueprint-axis" d="M80 13v64M23 45h114" />
          <g className="pulso-graficador-library-blueprint-quadrant-labels">
            <text x="31" y="27">F</text><text x="126" y="27">O</text>
            <text x="31" y="68">D</text><text x="126" y="68">A</text>
          </g>
          <g className="pulso-graficador-library-blueprint-primary">
            <circle cx="51" cy="31" r="4" /><circle cx="105" cy="35" r="3" />
            <circle cx="61" cy="62" r="3" /><circle cx="116" cy="58" r="4" />
          </g>
        </>
      );
    case "dimension-criteria-heatmap":
      return <Heatmap criteria />;
    case "future": {
      const FallbackIcon = fallbackIcon(iconoUi);
      return (
        <>
          <rect className="pulso-graficador-library-blueprint-fallback-frame" x="41" y="14" width="78" height="62" rx="8" />
          <FallbackIcon
            className="pulso-graficador-library-blueprint-fallback-icon"
            x="65"
            y="23"
            width="30"
            height="30"
            strokeWidth={1.6}
          />
          <g className="pulso-graficador-library-blueprint-label-lines">
            <path d="M57 61h46M67 68h26" />
          </g>
        </>
      );
    }
  }
}

function ChartAxes() {
  return (
    <g className="pulso-graficador-library-blueprint-axis">
      <path d="M18 14v55h128M18 52h128M18 34h128" />
    </g>
  );
}

function LegendLines({ x = 116 }: { x?: number }) {
  return (
    <g className="pulso-graficador-library-blueprint-legend" transform={`translate(${x} 27)`}>
      <circle cx="0" cy="0" r="3" /><path d="M7 0h21" />
      <circle cx="0" cy="13" r="3" /><path d="M7 13h17" />
      <circle cx="0" cy="26" r="3" /><path d="M7 26h22" />
    </g>
  );
}

function RadarShape({
  cx,
  cy,
  radius,
  compact = false,
}: {
  cx: number;
  cy: number;
  radius: number;
  compact?: boolean;
}) {
  const points = radarPoints(cx, cy, radius);
  const middlePoints = radarPoints(cx, cy, radius * 0.66);
  const valuePoints = radarPoints(cx, cy, radius * 0.78, compact ? 0.22 : -0.16);
  return (
    <>
      <g className="pulso-graficador-library-blueprint-radar-grid">
        <polygon points={points} />
        <polygon points={middlePoints} />
        {radarPointsArray(cx, cy, radius).map(([x, y]) => (
          <path key={`${x}-${y}`} d={`M${cx} ${cy}L${x} ${y}`} />
        ))}
      </g>
      <polygon className="pulso-graficador-library-blueprint-radar-value" points={valuePoints} />
      <g className="pulso-graficador-library-blueprint-primary">
        {radarPointsArray(cx, cy, radius * 0.78, compact ? 0.22 : -0.16).map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="2.2" />
        ))}
      </g>
    </>
  );
}

function Heatmap({ criteria }: { criteria: boolean }) {
  const cells = Array.from({ length: criteria ? 15 : 20 }, (_, index) => index);
  const columns = criteria ? 3 : 4;
  const cellWidth = criteria ? 25 : 23;
  const startX = criteria ? 48 : 38;
  return (
    <>
      {criteria && (
        <g className="pulso-graficador-library-blueprint-criteria-bands">
          <rect x="14" y="17" width="27" height="27" rx="3" />
          <rect x="14" y="48" width="27" height="25" rx="3" />
        </g>
      )}
      <g className="pulso-graficador-library-blueprint-heatmap">
        {cells.map((cell) => {
          const column = cell % columns;
          const row = Math.floor(cell / columns);
          return (
            <rect
              key={cell}
              className={`pulso-graficador-library-blueprint-heatmap-tone-${(cell + row) % 4}`}
              x={startX + column * (cellWidth + 3)}
              y={15 + row * 13}
              width={cellWidth}
              height="10"
              rx="2"
            />
          );
        })}
      </g>
    </>
  );
}

function radarPoints(cx: number, cy: number, radius: number, offset = 0): string {
  return radarPointsArray(cx, cy, radius, offset)
    .map(([x, y]) => `${x},${y}`)
    .join(" ");
}

function radarPointsArray(
  cx: number,
  cy: number,
  radius: number,
  offset = 0,
): Array<[number, number]> {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = -Math.PI / 2 + offset + index * Math.PI / 3;
    return [
      Number((cx + Math.cos(angle) * radius).toFixed(2)),
      Number((cy + Math.sin(angle) * radius).toFixed(2)),
    ];
  });
}

function fallbackIcon(iconoUi?: string): LucideIcon {
  switch (iconoUi) {
    case "Hash":
      return Hash;
    case "LayoutGrid":
    case "Grid3X3":
      return LayoutGrid;
    case "Map":
      return Map;
    case "Cloud":
      return MessageSquare;
    case "Radar":
    case "Activity":
      return Radar;
    case "Table":
      return Table2;
    default:
      return BarChart3;
  }
}

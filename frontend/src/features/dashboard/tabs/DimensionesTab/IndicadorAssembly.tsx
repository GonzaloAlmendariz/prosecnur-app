import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { apiDashboardDimPayload, type DashboardDimPayload } from "../../../../api/client";
import { useDashboardStore } from "../../store";
import { useDimCatalogo } from "../../useDashboardData";
import {
  colorOfScore as semColorOfScore,
  semaforoFromConfig,
  type SemaforoConfig,
} from "../../shared/semaforo";
import "./indicador-assembly.css";

// ============================================================================
// IndicadorAssembly — escena interactiva de "construcción del indicador"
//
// No es un chart: es una secuencia cinematográfica con 4 fases:
//   Fase 1 (0–280ms):  Índice central aparece con pulso suave.
//   Fase 2 (280–920ms): Conductores emergen radialmente desde el centro
//                       (stagger 100ms, easing tipo Apple).
//   Fase 3 (640–1320ms): Líneas se dibujan progresivamente (stroke-dasharray).
//   Fase 4 (post-mount): Click en conductor → atenuar resto, desplegar
//                        subcriterios desde el conductor con stagger.
// Click fuera o tecla Esc → colapsa.
// ============================================================================

type AssemblyRow = {
  axis_label: string;
  score_round: number | null;
  base: number | null;
};

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

const PALETA = [
  "#3a6df0", // azul
  "#16a37e", // verde-teal
  "#e2802c", // naranja
  "#a259d9", // púrpura
  "#0d8a9b", // cian
  "#d94a8a", // rosa
  "#6b8e23", // oliva
  "#c63d3d", // rojo
];

export function IndicadorAssembly({
  payload,
  modo,
  cruce,
  incluirTotal,
  maxed,
}: {
  payload: DashboardDimPayload;
  modo: "general" | "indicadores";
  cruce: string;
  incluirTotal: boolean;
  maxed: boolean;
}) {
  const { payload: catalogo } = useDimCatalogo();
  const filtros = useDashboardStore((s) => s.filtros);
  const dim = useDashboardStore((s) => s.dimensiones);
  const config = useDashboardStore((s) => s.config);
  const filtrosKey = JSON.stringify(dim.filtrosOn ? filtros : []);

  const sem = useMemo(
    () => semaforoFromConfig(config, payload.semaforo),
    [config, payload.semaforo],
  );

  const indiceLabel = payload.objective ?? "Índice";
  const totalRow = (payload.score_heat ?? []).find((r) => r.axis_label === "Total cruce");
  const indiceScore = totalRow?.score_round ?? null;

  const dimensiones: AssemblyRow[] = useMemo(() => {
    const rows = (payload.score_heat ?? []) as unknown as (AssemblyRow & { tipo?: string })[];
    return rows.filter(
      (r) => (r.tipo === "apertura" || r.tipo === undefined) && r.axis_label !== "Total cruce",
    );
  }, [payload.score_heat]);

  const dimColor = useMemo(() => {
    const map: Record<string, string> = {};
    dimensiones.forEach((d, i) => (map[d.axis_label] = PALETA[i % PALETA.length]));
    return map;
  }, [dimensiones]);

  // Iconos por axis_label — payload.axis_icons cubre conductores/eje
  // del nivel actual. subIcons (más abajo) cubre subcriterios.
  const axisIcons = useMemo<Record<string, string>>(
    () => payload.axis_icons ?? {},
    [payload.axis_icons],
  );

  // Subcriterios por dimensión (sólo modo general). subIcons mantiene
  // el mapa label → data-uri agregado a partir de los axis_icons de cada
  // payload de indicador, para pintar el icono dentro del rect del sub.
  const [subRows, setSubRows] = useState<Record<string, AssemblyRow[]>>({});
  const [subIcons, setSubIcons] = useState<Record<string, string>>({});
  useEffect(() => {
    if (modo !== "general" || !catalogo?.indicadores?.length) {
      setSubRows({});
      setSubIcons({});
      return;
    }
    let cancelled = false;
    const indByLabel = new Map<string, string>();
    for (const ind of catalogo.indicadores) indByLabel.set(ind.label, ind.id);
    const promises = dimensiones
      .map((d) => ({ label: d.axis_label, id: indByLabel.get(d.axis_label) }))
      .filter((x): x is { label: string; id: string } => Boolean(x.id))
      .map(({ label, id }) =>
        apiDashboardDimPayload({
          modo: "indicadores",
          objetivo: id,
          cruce: cruce || undefined,
          incluir_total: incluirTotal,
          iter: null,
          filtros: dim.filtrosOn ? filtros : [],
        })
          .then((r) => ({
            label,
            rows: ((r.payload.score_heat ?? []) as unknown as (AssemblyRow & { tipo?: string })[])
              .filter((s) => s.axis_label !== "Total cruce")
              .filter((s) => s.tipo === "apertura" || s.tipo === undefined || s.tipo === "subcriterio"),
            icons: r.payload.axis_icons ?? {},
          }))
          .catch(() => ({ label, rows: [] as AssemblyRow[], icons: {} as Record<string, string> })),
      );
    Promise.all(promises).then((results) => {
      if (cancelled) return;
      const rowsMap: Record<string, AssemblyRow[]> = {};
      const iconsMap: Record<string, string> = {};
      for (const { label, rows, icons } of results) {
        rowsMap[label] = rows;
        Object.assign(iconsMap, icons);
      }
      setSubRows(rowsMap);
      setSubIcons(iconsMap);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, payload.objective_id, cruce, incluirTotal, filtrosKey, catalogo?.indicadores?.length, dimensiones.length]);

  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSelected(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Medidor de texto preciso vía canvas — evita el espacio muerto entre
  // texto y chip. Cacheamos por label dentro de la sesión del componente.
  const textMeasurer = useMemo(() => {
    const cache = new Map<string, number>();
    let ctx: CanvasRenderingContext2D | null = null;
    if (typeof document !== "undefined") {
      const c = document.createElement("canvas");
      ctx = c.getContext("2d");
      if (ctx) ctx.font = '700 18px system-ui, -apple-system, "Segoe UI", sans-serif';
    }
    return (label: string) => {
      const cached = cache.get(label);
      if (cached !== undefined) return cached;
      const w = ctx ? ctx.measureText(label).width : label.length * 9.6;
      cache.set(label, w);
      return w;
    };
  }, []);

  // ── Layout geométrico ────────────────────────────────────────────────────
  // Lienzo SVG: viewBox cuadrado normalizado para escalar. Coordenadas
  // calculadas a partir del centro.
  const W = 1200;
  const H = maxed ? 880 : 800;
  const cx = W / 2;
  const cy = H / 2;
  const R_INDEX = 92;          // radio del nodo central (índice)
  const R_DIM = 72;            // radio de los conductores (acomoda label + icono + chip)
  const SUB_H = 48;            // alto rectángulo subcriterio (acomoda 15px bold)
  const SUB_PAD_X = 16;        // padding horizontal del rect alrededor del texto
  const SUB_CHIP_W = 42;       // ancho del chip semáforo dentro del rect
  // Ancho dinámico: depende del label más largo. Calculado abajo.
  const D_DIM = Math.min(W, H) * 0.30;  // distancia índice → conductor

  const dimPositions = useMemo(() => {
    const n = dimensiones.length || 1;
    // Distribuir en círculo completo, comenzando desde -90° (arriba).
    // Brazo MÁS LARGO si el conductor tiene más subcriterios — así los
    // rectángulos desplegados no chocan con la rama vecina.
    return dimensiones.map((d, i) => {
      const ang = -Math.PI / 2 + (2 * Math.PI * i) / n;
      const subsCount = subRows[d.axis_label]?.length ?? 0;
      const armBoost = Math.max(0, subsCount - 2) * 14; // px extra por sub > 2
      const dimDist = D_DIM + armBoost;
      return {
        label: d.axis_label,
        score: d.score_round,
        x: cx + Math.cos(ang) * dimDist,
        y: cy + Math.sin(ang) * dimDist,
        ang,
      };
    });
  }, [dimensiones, cx, cy, D_DIM, subRows]);

  // Posiciones de subcriterios — para el conductor seleccionado, distribuir
  // en arco que apunta hacia AFUERA (ángulo opuesto al índice).
  // Ancho del rect: medido REAL del texto + paddings + chip. Eliminamos
  // espacio muerto entre fin de texto y chip. Cap a 460px (deja espacio
  // si la rama no debe estirarse demasiado, los más largos truncan).
  const SUB_PAD_LEFT = 14;       // padding izq antes del icono/texto
  const SUB_PAD_RIGHT = 8;       // padding der después del chip
  const SUB_GAP_TEXT_CHIP = 10;  // separación texto ↔ chip
  const SUB_ICON_GAP = 8;        // separación icono ↔ texto
  const SUB_ICON_W = 28;         // ancho del icono
  const subRectWidth = (label: string) => {
    const iconBlock = subIcons[label] ? SUB_ICON_W + SUB_ICON_GAP : 0;
    const textPx = textMeasurer(label);
    return Math.max(
      140,
      Math.min(
        460,
        SUB_PAD_LEFT + iconBlock + textPx + SUB_GAP_TEXT_CHIP + SUB_CHIP_W + SUB_PAD_RIGHT,
      ),
    );
  };

  const subPositions = useMemo(() => {
    const map: Record<
      string,
      { label: string; score: number | null; x: number; y: number; w: number }[]
    > = {};
    for (const dp of dimPositions) {
      const subs = subRows[dp.label] ?? [];
      if (!subs.length) {
        map[dp.label] = [];
        continue;
      }
      // Distribución en abanico hacia afuera del centro. Abanico amplio
      // (hasta π) para que la rama esté CERCA del conductor en vez de
      // estirarse hacia afuera buscando separación tangencial.
      const baseAng = dp.ang;
      const widths = subs.map((s) => subRectWidth(s.axis_label));
      const maxW = Math.max(...widths);
      const arc = Math.PI * (subs.length <= 2 ? 0.45 : subs.length <= 4 ? 0.82 : 1.05);
      // Separación tangencial efectiva: usamos el ancho COMPLETO del
      // rect más gap. Más conservador para evitar cualquier solape.
      const gap = 22;
      const sepTangencial = maxW + gap;
      const minRadial =
        subs.length <= 1 ? 220 : sepTangencial / (arc / Math.max(1, subs.length - 1));
      const radialDist = Math.max(240, minRadial);
      const items = subs.map((s, i) => {
        const t = subs.length === 1 ? 0 : i / (subs.length - 1) - 0.5; // -0.5..0.5
        const ang = baseAng + t * arc;
        return {
          label: s.axis_label,
          score: s.score_round,
          x: dp.x + Math.cos(ang) * radialDist,
          y: dp.y + Math.sin(ang) * radialDist,
          w: widths[i],
        };
      });
      map[dp.label] = items;
    }
    return map;
  }, [dimPositions, subRows]);

  function handleBgClick() {
    setSelected(null);
  }

  // Auto-zoom narrativo: al seleccionar un conductor, calculamos el
  // bounding box de su rama (conductor + subcriterios) y aplicamos un
  // transform translate+scale al canvas para encuadrar la escena. Sin
  // cambiar el viewBox para que CSS transition pueda animarlo.
  const stageTransform = useMemo(() => {
    if (!selected) return undefined;
    const dp = dimPositions.find((d) => d.label === selected);
    if (!dp) return undefined;
    const subs = subPositions[selected] ?? [];
    // Bbox = rama + índice central. Sin el índice, el translate empuja la
    // raíz fuera del viewBox cuando la rama vive lejos del centro (caso
    // fullscreen, viewBox alto).
    const halfH = SUB_H / 2;
    const xs = [
      cx - R_INDEX,
      cx + R_INDEX,
      dp.x - R_DIM,
      dp.x + R_DIM,
      ...subs.flatMap((s) => [s.x - s.w / 2, s.x + s.w / 2]),
    ];
    const ys = [
      cy - R_INDEX,
      cy + R_INDEX,
      dp.y - R_DIM,
      dp.y + R_DIM,
      ...subs.flatMap((s) => [s.y - halfH, s.y + halfH]),
    ];
    const padX = 80;
    const padY = 80;
    const minX = Math.min(...xs) - padX;
    const maxX = Math.max(...xs) + padX;
    const minY = Math.min(...ys) - padY;
    const maxY = Math.max(...ys) + padY;
    const bw = maxX - minX;
    const bh = maxY - minY;
    // Escala: hasta 1.12 — zoom narrativo perceptible que da
    // protagonismo a la rama desplegada sin perder contexto.
    const scale = Math.min(W / bw, H / bh, 1.12);
    const tcx = (minX + maxX) / 2;
    const tcy = (minY + maxY) / 2;
    const tx = cx - tcx * scale;
    const ty = cy - tcy * scale;
    return `translate(${tx}px, ${ty}px) scale(${scale})`;
  }, [selected, dimPositions, subPositions, W, H, cx, cy]);

  // Helper: chip semáforo (rect + texto blanco) con el score. Mantiene el
  // color del nodo en el círculo, pero el chip aporta lectura semáforo.
  // rx por defecto = height/2 (pildora). Para chips más "cuadrados" usar
  // rx ≈ height/3 (esquinas suaves pero no totalmente redondeadas).
  function semChip(
    score: number | null,
    sem: SemaforoConfig,
    dyOffset: number,
    width = 30,
    height = 16,
    rx?: number,
    fontSize?: number,
  ) {
    if (score == null) return null;
    const fill = semColorOfScore(score, sem) ?? sem.green;
    const radius = rx ?? height / 2;
    return (
      <g transform={`translate(0, ${dyOffset})`} className="dash-assembly-chip">
        <rect x={-width / 2} y={-height / 2} width={width} height={height} rx={radius} fill={fill} />
        <text
          className="dash-assembly-chip-text"
          textAnchor="middle"
          dy={fontSize ? fontSize * 0.36 : 4}
          style={fontSize ? { fontSize: `${fontSize}px` } : undefined}
        >
          {score}
        </text>
      </g>
    );
  }

  if (!dimensiones.length) {
    return <p className="dash-cardbox-help">Sin dimensiones para construir el indicador.</p>;
  }

  return (
    <div className={`dash-assembly ${selected ? "is-focused" : ""}`}>
      <svg
        className="dash-assembly-svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Construcción del indicador ${indiceLabel}`}
        onClick={handleBgClick}
      >
        <defs>
          {/* Glow filter para el índice central. */}
          <filter id="dash-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g
          className="dash-assembly-stage"
          style={{
            transform: stageTransform ?? "none",
            transformOrigin: `0 0`,
          }}
        >
        {/* Líneas índice → conductores — fase 3, stroke-dasharray animado. */}
        <g className="dash-assembly-edges">
          {dimPositions.map((dp, i) => {
            const inactive = selected !== null && selected !== dp.label;
            return (
              <line
                key={`edge-${i}-${dp.label}`}
                className={`dash-assembly-edge ${inactive ? "is-muted" : ""}`}
                x1={cx}
                y1={cy}
                x2={dp.x}
                y2={dp.y}
                stroke={dimColor[dp.label]}
                strokeWidth={2}
                style={{ animationDelay: `${640 + i * 80}ms` }}
              />
            );
          })}
        </g>

        {/* Líneas conductor seleccionado → subcriterios. Sincronizadas
           con la entrada del rect: la línea termina de dibujarse justo
           cuando el rect aparece (delay rect = 120 + i*60 ms). Recortadas
           en ambos extremos para nacer en el borde del círculo y morir
           en el borde del rect — sin atravesar los nodos. */}
        {selected && (
          <g className="dash-assembly-sub-edges">
            {(subPositions[selected] ?? []).map((s, i) => {
              const dp = dimPositions.find((d) => d.label === selected);
              if (!dp) return null;
              const dx = s.x - dp.x;
              const dy = s.y - dp.y;
              const dist = Math.hypot(dx, dy) || 1;
              const ux = dx / dist;
              const uy = dy / dist;
              // Borde del rect (AABB): el lado por el que entra la línea
              // depende del ángulo. min(hw/|ux|, hh/|uy|) da la distancia
              // del centro del rect a su borde en dirección -u.
              const hw = s.w / 2;
              const hh = SUB_H / 2;
              const tx = Math.abs(ux) > 1e-6 ? hw / Math.abs(ux) : Infinity;
              const ty = Math.abs(uy) > 1e-6 ? hh / Math.abs(uy) : Infinity;
              const rectBorder = Math.min(tx, ty);
              const x1 = dp.x + ux * R_DIM;
              const y1 = dp.y + uy * R_DIM;
              const x2 = s.x - ux * rectBorder;
              const y2 = s.y - uy * rectBorder;
              return (
                <line
                  key={`sub-edge-${selected}-${i}-${s.label}`}
                  className="dash-assembly-sub-edge"
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={dimColor[selected]}
                  strokeWidth={1.4}
                  strokeOpacity={0.6}
                  style={{ animationDelay: `${i * 60}ms` }}
                />
              );
            })}
          </g>
        )}

        {/* Conductores — fase 2, stagger fade+pop. Usamos wrapper externo
           con translate fijo (atributo SVG) y un <g> interno que recibe la
           animación CSS — así scale/opacity no pisan el translate. */}
        <g className="dash-assembly-dims">
          {dimPositions.map((dp, i) => {
            const isSelected = selected === dp.label;
            const isMuted = selected !== null && !isSelected;
            return (
              <g
                key={`dim-${i}-${dp.label}`}
                transform={`translate(${dp.x}, ${dp.y})`}
              >
                <g
                  className={`dash-assembly-dim ${isSelected ? "is-selected" : ""} ${isMuted ? "is-muted" : ""}`}
                  style={{
                    animationDelay: `${280 + i * 100}ms`,
                    ['--orbit-dx' as string]: `${cx - dp.x}px`,
                    ['--orbit-dy' as string]: `${cy - dp.y}px`,
                  } as CSSProperties}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelected(isSelected ? null : dp.label);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(isSelected ? null : dp.label);
                    }
                  }}
                >
                  <circle r={R_DIM} fill={dimColor[dp.label]} className="dash-assembly-dim-circle" />
                  {/* Layout vertical: label arriba, icono al medio,
                     chip score abajo. Sin icono: label centrado y chip
                     debajo del label. */}
                  <text
                    className="dash-assembly-dim-label"
                    textAnchor="middle"
                    dy={axisIcons[dp.label] ? -28 : dp.score != null ? -8 : 4}
                  >
                    {dp.label}
                  </text>
                  {axisIcons[dp.label] ? (
                    <image
                      href={axisIcons[dp.label]}
                      x={-18}
                      y={-12}
                      width={36}
                      height={28}
                      preserveAspectRatio="xMidYMid meet"
                      className="dash-assembly-dim-icon"
                    />
                  ) : null}
                  {semChip(dp.score, sem, axisIcons[dp.label] ? 40 : 22, 48, 30, 8, 17)}
                </g>
              </g>
            );
          })}
        </g>

        {/* Subcriterios del conductor seleccionado — pop in stagger. */}
        {selected && (
          <g className="dash-assembly-subs">
            {(subPositions[selected] ?? []).map((s, i) => {
              const dp = dimPositions.find((d) => d.label === selected);
              // Origen del orbit-in: el conductor padre, en coords locales.
              const ox = dp ? dp.x - s.x : 0;
              const oy = dp ? dp.y - s.y : 0;
              return (
                <g
                  key={`sub-${selected}-${i}-${s.label}`}
                  transform={`translate(${s.x}, ${s.y})`}
                >
                  <g
                    className="dash-assembly-sub"
                    style={{
                      animationDelay: `${120 + i * 60}ms`,
                      ['--orbit-dx' as string]: `${ox}px`,
                      ['--orbit-dy' as string]: `${oy}px`,
                    } as CSSProperties}
                  >
                    {/* Rectángulo redondeado: icono opcional + label a la
                       izquierda, chip semáforo a la derecha. */}
                    <rect
                      x={-s.w / 2}
                      y={-SUB_H / 2}
                      width={s.w}
                      height={SUB_H}
                      rx={SUB_H / 2}
                      fill="#ffffff"
                      stroke={dimColor[selected]}
                      strokeWidth={1.5}
                      className="dash-assembly-sub-rect"
                    />
                    {subIcons[s.label] ? (
                      <image
                        href={subIcons[s.label]}
                        x={-s.w / 2 + 8}
                        y={-14}
                        width={28}
                        height={28}
                        preserveAspectRatio="xMidYMid meet"
                        className="dash-assembly-sub-icon"
                      />
                    ) : null}
                    <text
                      className="dash-assembly-sub-label"
                      textAnchor="start"
                      x={-s.w / 2 + SUB_PAD_LEFT + (subIcons[s.label] ? SUB_ICON_W + SUB_ICON_GAP : 0)}
                      dy={5}
                    >
                      {/* Trunca SOLO si el texto medido excede el espacio
                         disponible (ocurre cuando el rect alcanzó el cap).
                         Búsqueda binaria sobre la longitud para encontrar
                         el corte exacto. */}
                      {(() => {
                        const iconBlock = subIcons[s.label] ? SUB_ICON_W + SUB_ICON_GAP : 0;
                        const avail = s.w - SUB_PAD_LEFT - iconBlock - SUB_GAP_TEXT_CHIP - SUB_CHIP_W - SUB_PAD_RIGHT;
                        if (textMeasurer(s.label) <= avail) return s.label;
                        // Trunca con elipsis hasta que entre.
                        for (let n = s.label.length - 1; n >= 4; n--) {
                          const candidate = s.label.slice(0, n) + "…";
                          if (textMeasurer(candidate) <= avail) return candidate;
                        }
                        return s.label.slice(0, 4) + "…";
                      })()}
                    </text>
                    {s.score != null && (
                      <g
                        transform={`translate(${s.w / 2 - SUB_PAD_RIGHT - SUB_CHIP_W / 2}, 0)`}
                        className="dash-assembly-chip"
                      >
                        <rect
                          x={-SUB_CHIP_W / 2}
                          y={-13}
                          width={SUB_CHIP_W}
                          height={26}
                          rx={13}
                          fill={semColorOfScore(s.score, sem) ?? sem.green}
                        />
                        <text className="dash-assembly-chip-text" textAnchor="middle" dy={5}>
                          {s.score}
                        </text>
                      </g>
                    )}
                  </g>
                </g>
              );
            })}
          </g>
        )}

        {/* Índice central — fase 1, scale-in + glow pulse infinite. */}
        <g transform={`translate(${cx}, ${cy})`} onClick={(e) => e.stopPropagation()}>
          <g className="dash-assembly-index">
            <circle
              r={R_INDEX}
              fill="#1f2a3a"
              className="dash-assembly-index-circle"
              filter="url(#dash-glow)"
            />
            <text className="dash-assembly-index-label" textAnchor="middle" dy={-8}>
              {indiceLabel}
            </text>
            {semChip(indiceScore, sem, 36, 60, 36, 10, 21)}
          </g>
        </g>
        </g>
      </svg>

      {/* Texto contextual debajo del seleccionado. */}
      {selected && (
        <div className="dash-assembly-context" aria-live="polite">
          <strong>{selected}</strong>
          <span>
            {(subRows[selected]?.length ?? 0)} subcriterios · score{" "}
            {dimensiones.find((d) => d.axis_label === selected)?.score_round ?? "—"}
          </span>
        </div>
      )}

    </div>
  );
}

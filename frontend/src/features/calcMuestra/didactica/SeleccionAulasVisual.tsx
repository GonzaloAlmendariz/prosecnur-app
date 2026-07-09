/**
 * Capa didáctica del paso 4 ("Aulas y selección") sobre la selección ya
 * generada por el motor R: resume en KPIs qué quedó elegido, explica en
 * lenguaje llano por qué la selección es probabilística ("1 de cada k"),
 * muestra de dónde salen probabilidades y pesos, y — si el motor devolvió
 * diagnósticos — compara marco vs muestra por dimensión.
 *
 * No recalcula nada: todo sale de `seleccion` (motor R) leído con los
 * lectores tolerantes de didacticaData.
 */
import { useMemo } from "react";
import { GraduationCap, Landmark, Repeat, School } from "lucide-react";
import type { CalcMuestraAulasSelection } from "../../../api/client";
import { PlotlyChart } from "../../../lib/PlotlyChart";
import { fmtPct } from "../sharedCore";
import { BadgeMotor, TerminoGlosario } from "./PasoDidactico";
import { colorWithAlpha, didPlotLayout, DID_PLOT_CONFIG, useDidTokens } from "./didacticaCharts";
import { rowsFrom, rowText, safeNum } from "./didacticaData";
import "./didacticaAulas.css";

/** Réplica del mapa de labels de `classroomProbabilitySourceLabel` (CalcMuestraPage). */
function probabilidadFuenteLabel(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "Diseño probabilístico base";
  const key = raw.toLowerCase().replace(/[\s-]+/g, "_");
  const labels: Record<string, string> = {
    prescribed_design: "Diseño definido por el cálculo",
    design: "Diseño probabilístico base",
    base_design: "Diseño probabilístico base",
    pps: "PPS sistemático",
    pps_systematic: "PPS sistemático",
    balanced_probability: "Balance probabilístico",
    probability_with_operational_optimization: "Optimización con probabilidad auditada",
    simulation: "Simulación de probabilidades",
    simulated: "Simulación de probabilidades",
    monte_carlo: "Simulación Monte Carlo",
  };
  return labels[key] ?? raw.replace(/_/g, " ");
}

function esTitular(row: Record<string, unknown>): boolean {
  return rowText(row, ["sample_role"]) === "titular" || rowText(row, ["wave"]) === "M1";
}

function esReserva(row: Record<string, unknown>): boolean {
  if (esTitular(row)) return false;
  const role = rowText(row, ["sample_role"]);
  return role === "chain_reserve" || (role !== "extra_reserve_pool" && rowText(row, ["wave"]) !== "M1");
}

/** Primera clave numérica reconocible de la fila (varias variantes de columna). */
function numeroTolerante(row: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const n = safeNum(row[key], Number.NaN);
    if (Number.isFinite(n)) return n;
  }
  return Number.NaN;
}

type ComparacionFila = { etiqueta: string; marco: number; muestra: number };

/**
 * Busca en las filas de diagnóstico pares marco/muestra reconocibles
 * (frame_share vs sample_share, frame_prop vs selected_prop, etc.). Si las
 * filas no traen columnas comparables, devuelve [] y el chart se omite.
 */
function filasComparables(rows: Array<Record<string, unknown>>): ComparacionFila[] {
  const marcoKeys = ["frame_share", "frame_prop", "marco_prop", "frame_pct"];
  const muestraKeys = ["sample_share", "selected_prop", "selected_share", "seleccion_m1_prop", "sample_prop"];
  const brutas: Array<ComparacionFila & { dimension: string }> = [];
  rows.forEach((row) => {
    const marco = numeroTolerante(row, marcoKeys);
    const muestra = numeroTolerante(row, muestraKeys);
    if (!Number.isFinite(marco) || !Number.isFinite(muestra)) return;
    const dimension = rowText(row, ["label", "dimension", "variable"]);
    const categoria = rowText(row, ["category", "categoria", "metric_id"]);
    // Categorías vacías o placeholder no aportan comparación.
    if (!categoria || /^sin[_ ]dato/i.test(categoria)) return;
    const etiqueta = dimension && categoria !== dimension ? `${dimension} · ${categoria}` : categoria;
    brutas.push({ etiqueta, marco, muestra, dimension: dimension || categoria });
  });
  // Dimensiones con una sola categoría (100% marco y 100% muestra) no dicen
  // nada sobre representatividad: fuera.
  const porDimension = new Map<string, number>();
  brutas.forEach((fila) => porDimension.set(fila.dimension, (porDimension.get(fila.dimension) ?? 0) + 1));
  return brutas
    .filter((fila) => (porDimension.get(fila.dimension) ?? 0) > 1)
    .map(({ etiqueta, marco, muestra }) => ({ etiqueta, marco, muestra }));
}

export function SeleccionAulasVisual({
  seleccion,
  nObjetivo,
  totalFacultades,
}: {
  seleccion: CalcMuestraAulasSelection | null | undefined;
  nObjetivo?: number | null;
  /** Facultades del marco del cálculo, para leer la cobertura como "10 de 16". */
  totalFacultades?: number | null;
}) {
  const tokens = useDidTokens();

  const modelo = useMemo(() => {
    if (!seleccion) return null;
    const rows = rowsFrom<Record<string, unknown>>(seleccion.selection);
    const titulares = rows.filter(esTitular);
    const reservas = rows.filter(esReserva);
    const esperados = titulares.reduce((acc, row) => {
      const n = numeroTolerante(row, [
        "expected_completes",
        "expected_n",
        "esperados",
        "eligible_n",
        "matriculados_poblacion",
        "matriculados",
      ]);
      return acc + (Number.isFinite(n) ? n : 0);
    }, 0);
    const facultades = new Set(
      titulares
        .map((row) => rowText(row, ["faculty", "facultad", "stratum"]))
        .filter((value) => value.length > 0),
    );

    // profile_distributions es la fuente correcta: trae frame_prop vs
    // selected_prop por dimensión·categoría con tolerancia declarada.
    const perfiles = rowsFrom<Record<string, unknown>>(seleccion.diagnostics?.profile_distributions);
    const diagnostico = filasComparables(perfiles).slice(0, 16);
    const dentroTolerancia = perfiles.filter((row) => row.within_tolerance === true).length;
    const conTolerancia = perfiles.filter((row) => row.within_tolerance != null).length;

    return {
      titulares: titulares.length,
      reservas: reservas.length,
      esperados: Math.round(esperados),
      facultades: facultades.size,
      diagnostico,
      dentroTolerancia,
      conTolerancia,
    };
  }, [seleccion]);

  if (!seleccion || !modelo) return null;

  const objetivo = nObjetivo != null && Number.isFinite(nObjetivo) && nObjetivo > 0 ? Math.round(nObjetivo) : null;
  const enProporcion = modelo.diagnostico.every((fila) => fila.marco <= 1.5 && fila.muestra <= 1.5);
  const altoChart = Math.max(220, modelo.diagnostico.length * 30 + 80);

  // Lecturas honestas de los KPIs: brecha frente al objetivo del cálculo y
  // cobertura de facultades del marco (mismos números, cero estadística nueva).
  const brechaEsperados = objetivo != null && modelo.esperados > 0 && modelo.esperados < objetivo;
  const coberturaEsperados = brechaEsperados ? modelo.esperados / objetivo : null;
  const totalFac = totalFacultades != null && Number.isFinite(totalFacultades) && totalFacultades > 0
    ? Math.round(totalFacultades)
    : null;
  const facultadesIncompletas = totalFac != null && modelo.facultades > 0 && modelo.facultades < totalFac;

  return (
    <div className="cmv2-did-result">
      <div className="cmv2-did-result-head">
        <span className="cmv2-eyebrow">Qué quedó seleccionado y por qué es defendible</span>
        <BadgeMotor estado="validado" />
      </div>

      <dl className="cmv2-did-kpis">
        <div className="cmv2-did-kpi" data-hero="true">
          <dt>Aulas titulares</dt>
          <dd>{modelo.titulares.toLocaleString("es-PE")}</dd>
          <span className="cmv2-did-kpi-hint">se visitan primero (M1)</span>
        </div>
        <div className="cmv2-did-kpi">
          <dt>Aulas de reserva</dt>
          <dd>{modelo.reservas.toLocaleString("es-PE")}</dd>
          <span className="cmv2-did-kpi-hint">entran solo si un aula titular cae</span>
        </div>
        <div className="cmv2-did-kpi" data-tono={brechaEsperados ? "warn" : undefined}>
          <dt>Estudiantes esperados</dt>
          <dd>{modelo.esperados > 0 ? modelo.esperados.toLocaleString("es-PE") : "—"}</dd>
          <span className="cmv2-did-kpi-hint" data-tono={brechaEsperados ? "warn" : undefined}>
            {objetivo
              ? brechaEsperados && coberturaEsperados != null
                ? `objetivo del cálculo: ${objetivo.toLocaleString("es-PE")} · cubre ${fmtPct(coberturaEsperados)}`
                : `objetivo del cálculo: ${objetivo.toLocaleString("es-PE")}`
              : "según las aulas titulares"}
          </span>
        </div>
        <div className="cmv2-did-kpi" data-tono={facultadesIncompletas ? "warn" : undefined}>
          <dt>Facultades cubiertas</dt>
          <dd>
            {modelo.facultades > 0
              ? totalFac != null
                ? `${modelo.facultades.toLocaleString("es-PE")} de ${totalFac.toLocaleString("es-PE")}`
                : modelo.facultades.toLocaleString("es-PE")
              : "—"}
          </dd>
          <span className="cmv2-did-kpi-hint" data-tono={facultadesIncompletas ? "warn" : undefined}>
            {facultadesIncompletas
              ? `${((totalFac ?? 0) - modelo.facultades).toLocaleString("es-PE")} sin aula titular`
              : "con al menos un aula titular"}
          </span>
        </div>
      </dl>

      <p className="cmv2-did-note">
        <Repeat size={12} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: 4 }} />
        Ninguna de estas aulas se eligió "a dedo". La calculadora ordenó el marco y avanzó con un{" "}
        <TerminoGlosario termino="salto k" /> — como contar "1 de cada k" en una fila — de modo que cada aula
        entró con una <TerminoGlosario termino="pi (probabilidad">probabilidad de inclusión</TerminoGlosario>{" "}
        conocida antes del sorteo. Esa probabilidad registrada es lo que permite defender la muestra ante
        cualquier auditoría: se puede reconstruir por qué salió cada aula y qué chance tenía cada una.
      </p>

      <div className="cmv2-did-aulas-fuentes">
        <div className="cmv2-did-aulas-fuente">
          <small>
            <School size={11} aria-hidden="true" /> De dónde salen los pesos
          </small>
          <span>
            Cada aula pesa 1/π: las aulas con menor probabilidad de salir sorteadas pesan más al
            expandir. El detalle técnico vive en Sustento técnico.
          </span>
        </div>
        <div className="cmv2-did-aulas-fuente">
          <small>
            <Landmark size={11} aria-hidden="true" /> De dónde salen las probabilidades
          </small>
          <span>{probabilidadFuenteLabel(seleccion.probability_source)}</span>
        </div>
      </div>

      {modelo.diagnostico.length > 0 && (
        <div className="cmv2-did-stack">
          <span className="cmv2-eyebrow">Marco vs. muestra, dimensión por dimensión</span>
          <div className="cmv2-did-chart">
            <PlotlyChart
              data={[
                {
                  type: "bar",
                  orientation: "h",
                  name: "Marco",
                  y: modelo.diagnostico.map((fila) => fila.etiqueta),
                  x: modelo.diagnostico.map((fila) => (enProporcion ? fila.marco * 100 : fila.marco)),
                  marker: { color: colorWithAlpha(tokens.textMuted, 0.45), line: { color: tokens.surface, width: 1 } },
                  hovertemplate: enProporcion
                    ? "%{y} · marco: %{x:.1f}%<extra></extra>"
                    : "%{y} · marco: %{x:,.2f}<extra></extra>",
                },
                {
                  type: "bar",
                  orientation: "h",
                  name: "Muestra",
                  y: modelo.diagnostico.map((fila) => fila.etiqueta),
                  x: modelo.diagnostico.map((fila) => (enProporcion ? fila.muestra * 100 : fila.muestra)),
                  marker: { color: tokens.accent, line: { color: tokens.surface, width: 1 } },
                  hovertemplate: enProporcion
                    ? "%{y} · muestra: %{x:.1f}%<extra></extra>"
                    : "%{y} · muestra: %{x:,.2f}<extra></extra>",
                },
              ]}
              layout={didPlotLayout(tokens, {
                barmode: "group",
                height: altoChart,
                showlegend: true,
                legend: { orientation: "h", y: -0.1, font: { size: 11 } },
                xaxis: {
                  gridcolor: tokens.border,
                  zeroline: false,
                  tickfont: { size: 10.5 },
                  ticksuffix: enProporcion ? "%" : "",
                },
                yaxis: { automargin: true, tickfont: { size: 10.5 } },
              })}
              config={{ ...DID_PLOT_CONFIG }}
              height={altoChart}
              ariaLabel="Comparación de proporciones del marco frente a la muestra por dimensión"
            />
          </div>
          <p className="cmv2-did-note">
            <GraduationCap size={12} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: 4 }} />
            Si la muestra fuera sesgada, las barras de "Muestra" se alejarían mucho de las del "Marco". Cuando
            van casi parejas, la selección reproduce la estructura real de la universidad en cada dimensión.
            {modelo.conTolerancia > 0 && (
              <>
                {" "}
                En esta corrida, <strong>{modelo.dentroTolerancia} de {modelo.conTolerancia}</strong> categorías
                quedaron dentro de la tolerancia declarada por la calculadora.
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

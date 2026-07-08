/**
 * Pestaña "Población" de Marco. El flujo universo → elegibles → población con
 * cifras vivas del motor encabeza la lectura; debajo, las lecturas rápidas y
 * los gráficos de estructura (facultades, carreras, sexo) del antiguo
 * dashboard, y al cierre el bloque "Estructura por controles" que absorbe los
 * cruces (sexo por facultad + facultad por ciclo). Los criterios de
 * elegibilidad NO se re-explican aquí: se decidieron en Definición → Categorías.
 */
import { BarChart3 } from "lucide-react";
import { Popover } from "../../../../components/Popover";
import { EmptyState } from "../../../../components/States";
import type {
  CalcMuestraAulasState,
  CalcMuestraComponente,
  CalcMuestraWorkspace,
} from "../../../../api/client";
import { ContextoLlano, RespaldoMetodologico } from "../../didactica/PasoDidactico";
import { fmtInt, fmtPct } from "../../sharedCore";
import { CifraMotor, FlujoVertical, TerminoChip, type FlujoEtapa } from "../ui";
import {
  MarcoEstructuraControles,
  MarcoPoblacionFacultades,
  MarcoPoblacionInsights,
  MarcoPoblacionSexo,
  marcoPopulationFigures,
} from "./marcoCards";
import "../../didactica/didactica.css";
import "./marco.css";

export function MarcoPoblacionTab({
  workspace,
  totalComp,
  aulasState,
}: {
  workspace: CalcMuestraWorkspace;
  totalComp: CalcMuestraComponente;
  aulasState: CalcMuestraAulasState | null;
}) {
  const frame = aulasState?.frame ?? null;
  const hasMarco = Boolean(frame || (totalComp.marco.estratos ?? []).length);
  const { inputRows, eligibleRows, populationN, excludedN, eligibilityRate, dedupeLoad } =
    marcoPopulationFigures(frame, totalComp, workspace);

  const etapas: FlujoEtapa[] = [
    {
      id: "universo",
      label: "Universo",
      valor: inputRows > 0 ? fmtInt(inputRows) : undefined,
      detalle: "filas leídas del archivo",
      estado: inputRows > 0 ? "ready" : "pending",
      merma: excludedN > 0 ? { n: excludedN, label: "filas excluidas" } : undefined,
    },
    {
      id: "elegibles",
      label: "Elegibles",
      valor: eligibleRows > 0 ? fmtInt(eligibleRows) : undefined,
      detalle: "filas que cumplen los criterios",
      estado: eligibleRows > 0 ? "ready" : "pending",
      merma: eligibleRows > populationN && populationN > 0
        ? { n: eligibleRows - populationN, label: "filas repetidas" }
        : undefined,
    },
    {
      id: "poblacion",
      label: "Población",
      valor: populationN > 0 ? fmtInt(populationN) : undefined,
      detalle: "estudiantes únicos",
      estado: populationN > 0 ? "ready" : "pending",
    },
  ];

  return (
    <div className="cmv2-marco-stack">
      <ContextoLlano paso="marco" />
      <section className="cmv2-panel cmv2-marco-poblacion-head">
        <div className="cmv2-marco-flujo-layout">
          <div className="cmv2-marco-flujo-main cmv2-marco-flujo-stagger">
            <FlujoVertical etapas={etapas} orientacion="horizontal" ariaLabel="Del universo a la población objetivo" />
            <p className="cmv2-marco-flujo-copy">
              Cada flecha es una decisión auditada: el universo se filtra con los criterios decididos en
              Definición → Categorías y las filas repetidas se consolidan en estudiantes únicos{" "}
              <Popover
                openOn="hover"
                ariaLabel="Universo frente a población"
                trigger={<button type="button" className="cmv2-marco-when">¿universo vs población?</button>}
              >
                <div className="cmv2-marco-when-pop">
                  <strong>Universo vs población</strong>
                  <p>
                    El universo son todas las filas leídas del archivo institucional. La población son los{" "}
                    <TerminoChip termino="matriculados elegibles">matriculados elegibles</TerminoChip> únicos que
                    quedan después de aplicar los criterios de inclusión.
                  </p>
                  <p>
                    Esos criterios se decidieron en Definición → Categorías; esta pestaña solo audita su resultado.
                  </p>
                </div>
              </Popover>
              . La proporción que sobrevive al filtro
              ({Number.isFinite(eligibilityRate) ? fmtPct(eligibilityRate) : "pendiente"}) alimenta la{" "}
              <TerminoChip
                termino="tasa de rendimiento"
                valor={Number.isFinite(eligibilityRate) ? `${fmtPct(eligibilityRate)} de filas elegibles` : undefined}
              >
                tasa de rendimiento
              </TerminoChip>{" "}
              con la que el cálculo convierte cuotas en aulas.
            </p>
          </div>
          <div className="cmv2-marco-flujo-cifras">
            <CifraMotor
              label="Población objetivo"
              value={populationN > 0 ? fmtInt(populationN) : "pendiente"}
              detalle="estudiantes únicos elegibles"
              origen={populationN > 0 ? "motor" : undefined}
              hero
            />
            <CifraMotor
              label="Consolidación"
              value={Number.isFinite(dedupeLoad) ? fmtPct(dedupeLoad) : "pendiente"}
              detalle="filas repetidas absorbidas"
              origen={Number.isFinite(dedupeLoad) ? "motor" : undefined}
            />
          </div>
        </div>
      </section>

      {hasMarco ? (
        <>
          <MarcoPoblacionInsights frame={frame} totalComp={totalComp} workspace={workspace} />
          <div className="cmv2-dashboard-chart-grid">
            <MarcoPoblacionFacultades frame={frame} totalComp={totalComp} workspace={workspace} />
            <MarcoPoblacionSexo frame={frame} totalComp={totalComp} workspace={workspace} />
          </div>
          <section className="cmv2-marco-controles">
            <div className="cmv2-marco-subhead">
              <span className="cmv2-eyebrow">Estructura por controles</span>
              <strong>Cómo se reparte la población entre los controles del diseño</strong>
            </div>
            <MarcoEstructuraControles frame={frame} totalComp={totalComp} workspace={workspace} />
          </section>
        </>
      ) : (
        <EmptyState
          icon={<BarChart3 size={20} />}
          title="La población aparece al construir el marco"
          hint="Carga la base y mapea variables en Definición; la calculadora devolverá universo, elegibles, población única y su estructura."
        />
      )}
      <RespaldoMetodologico paso="marco" />
    </div>
  );
}

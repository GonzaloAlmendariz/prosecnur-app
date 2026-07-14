/**
 * Pestaña "Población" de Marco. El flujo universo → elegibles → población con
 * cifras vivas del motor encabeza la lectura; debajo, las lecturas rápidas y
 * los gráficos de estructura (facultades, carreras, sexo) del antiguo
 * dashboard, y al cierre el bloque "Estructura por controles" que absorbe los
 * cruces (sexo por facultad + facultad por ciclo). Los criterios de
 * elegibilidad NO se re-explican aquí: se decidieron en Definición → Categorías.
 */
import { BarChart3 } from "lucide-react";
import { EmptyState } from "../../../../components/States";
import type {
  CalcMuestraAulasState,
  CalcMuestraComponente,
  CalcMuestraWorkspace,
} from "../../../../api/client";
import { embudoAlumnoDesdeFrame } from "../../dominio";
import { RespaldoMetodologico } from "../../didactica/PasoDidactico";
import { fmtInt, fmtPct } from "../../sharedCore";
import { CifraMotor, FlujoVertical, type FlujoEtapa } from "../ui";
import { embudoEtapas } from "./embudoEtapas";
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
  const { inputRows, eligibleRows, populationN, dedupeLoad } =
    marcoPopulationFigures(frame, totalComp, workspace);
  // La merma del flujo se calcula con la misma aritmética visible
  // (universo − elegibles); el excluded_rows del audit vive en la auditoría
  // de exclusiones, no en este flujo.
  const filasExcluidas = inputRows > 0 && eligibleRows > 0 ? Math.max(0, inputRows - eligibleRows) : 0;

  // Preferimos el embudo detallado del backend (universo → pregrado → regular →
  // ≥18 → población) cuando el frame lo trae; si no, el flujo agregado de tres
  // pasos con la aritmética visible (universo − elegibles − repetidas).
  const embudoDetallado = embudoAlumnoDesdeFrame(frame);
  const etapasFallback: FlujoEtapa[] = [
    {
      id: "universo",
      label: "Universo",
      valor: inputRows > 0 ? fmtInt(inputRows) : undefined,
      detalle: "filas leídas del archivo",
      estado: inputRows > 0 ? "ready" : "pending",
      merma: filasExcluidas > 0 ? { n: filasExcluidas, label: "filas excluidas" } : undefined,
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
  const etapasBase: FlujoEtapa[] =
    embudoDetallado && embudoDetallado.length >= 3
      ? embudoEtapas(embudoDetallado, "estudiantes")
      : etapasFallback;
  // El backend conserva la etiqueta auditiva completa. En la banda visual la
  // presentamos con el mismo significado y una longitud que no se desarma en
  // ventanas compactas.
  const etiquetaVisual: Record<string, string> = {
    universo: "Universo",
    pregrado: "Solo pregrado",
    regular: "Matrícula regular",
    "mayor-edad": "Edad ≥ 18 años",
  };
  const etapas: FlujoEtapa[] = etapasBase.map((etapa) => ({
    ...etapa,
    label: etiquetaVisual[etapa.id] ?? etapa.label,
  }));

  return (
    <div className="cmv2-marco-stack">
      <section className="cmv2-panel cmv2-marco-poblacion-head">
        <div className="cmv2-marco-flujo-layout">
          <div className="cmv2-marco-flujo-main cmv2-marco-flujo-stagger">
            <FlujoVertical etapas={etapas} orientacion="horizontal" ariaLabel="Del universo a la población objetivo" />
          </div>
          <span className="cmv2-marco-flujo-result-connector" aria-hidden="true" />
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
              <strong>Estructura por controles</strong>
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

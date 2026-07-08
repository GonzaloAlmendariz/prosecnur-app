/**
 * Pestaña "Cierre" (id salidas-guia) de la sección Salida. No es un checklist:
 * es la ficha ejecutiva auditable que se defiende ante el cliente. Arriba el
 * contexto llano; luego el camino completo del diseño como flujo horizontal
 * con las cifras finales del motor (N marco → n validado → aulas M1 →
 * reservas → entregables); una fila de cifras de defensa (n objetivo, margen
 * real, representatividad, aulas, profundidad de reserva) y la línea compacta
 * de reproducibilidad (método, semilla, firma del marco) que referencia a
 * Aulas → Sustento técnico. Visualmente la ficha lleva marco de "documento"
 * (barra de acento superior + sombra de panel) y la reproducibilidad se
 * presenta como sello tipográfico en mono (.cmv2-sal-ficha en salidas.css).
 */
import type { CalcMuestraWorkspace } from "../../../../api/client";
import { ContextoLlano } from "../../didactica/PasoDidactico";
import { calcEPreview } from "../../didactica/motorPreview";
import { fmtInt, fmtPct, safeNumber } from "../../sharedCore";
import { classroomRowNumber, classroomRowText } from "../shared/format";
import { hasUsefulResult } from "../shared/study";
import { CifraFila, CifraMotor, FlujoVertical, type FlujoEtapa } from "../ui";
import { classroomMethodLabel, classroomScore, type ClassroomLabModel } from "../aulas/aulasParts";
import "../../didactica/didactica.css";
import "./salidas.css";

function fmtRatio(value: number) {
  return `×${value.toFixed(1).replace(".", ",")}`;
}

export function SalidasCierreTab({
  model,
  workspace,
}: {
  model: ClassroomLabModel;
  workspace: CalcMuestraWorkspace;
}) {
  const {
    totalComp,
    facultyComp,
    frame,
    selection,
    selectionReady,
    replacementReady,
    m1Rows,
    reserveRows,
    extraReserveRows,
    reserveDepthRows,
    currentRepresentativityScore,
    targetForDisplay,
  } = model;

  const calculationReady = hasUsefulResult(totalComp) || hasUsefulResult(facultyComp);
  const marcoN = Math.max(safeNumber(totalComp.marco.marco_validado), model.framePopulationCount);
  // Margen real: retrocálculo del motor si vino (0 incluido: con n ≥ N el
  // error muestral es nulo); si el motor no lo trae, la vista previa TS
  // etiquetada como preview (misma vía que Cálculo → Propuestas), anclada al
  // escenario nivel universidad (n y marco del mismo componente).
  const precisionRaw = totalComp.resultado?.precision_alcanzada;
  const precisionMotor = precisionRaw == null ? Number.NaN : safeNumber(precisionRaw, Number.NaN);
  const nUniversidad = safeNumber(totalComp.resultado?.n_objetivo, 0);
  const precisionPreview = nUniversidad > 0
    ? safeNumber(
        calcEPreview(
          nUniversidad,
          safeNumber(totalComp.marco.marco_validado),
          totalComp.parametros.p,
          totalComp.parametros.z,
          totalComp.parametros.deff,
        ),
        Number.NaN,
      )
    : Number.NaN;
  const precisionEsMotor = Number.isFinite(precisionMotor);
  const precision = precisionEsMotor ? precisionMotor : precisionPreview;
  const precisionCensal = precision === 0 && nUniversidad >= safeNumber(totalComp.marco.marco_validado) && nUniversidad > 0;
  const reservasTotal = reserveRows.length + extraReserveRows.length;

  // Profundidad mínima de reserva por celda (misma lectura que Aulas → Reemplazos).
  const depthRatios = reserveDepthRows.map((row) => classroomRowNumber(row, ["depth_ratio"]));
  const minDepth = depthRatios.length ? Math.min(...depthRatios) : Number.NaN;
  const peorCelda = reserveDepthRows.find((row) => classroomRowNumber(row, ["depth_ratio"]) === minDepth);

  const publication = workspace.publication_config ?? {};
  const sheetsConfigured = Boolean(publication.google_sheets_enabled || publication.spreadsheet_id || publication.spreadsheet_url);
  const workbookConfigured = publication.include_workbook !== false;
  const entregablesListos = (workbookConfigured || sheetsConfigured) && calculationReady && selectionReady;

  const etapas: FlujoEtapa[] = [
    {
      id: "marco",
      label: "N marco",
      valor: marcoN > 0 ? fmtInt(marcoN) : undefined,
      detalle: "población elegible validada",
      estado: marcoN > 0 ? "ready" : "pending",
    },
    {
      id: "n",
      label: "n validado",
      valor: calculationReady ? fmtInt(targetForDisplay) : undefined,
      detalle: "muestra objetivo de la calculadora",
      estado: calculationReady ? "ready" : marcoN > 0 ? "working" : "pending",
    },
    {
      id: "titulares",
      label: "Aulas titulares M1",
      valor: m1Rows.length ? fmtInt(m1Rows.length) : undefined,
      detalle: selectionReady && selection
        ? classroomMethodLabel(String(selection.selector_engine_used ?? selection.selector_engine ?? ""))
        : "selección pendiente",
      estado: selectionReady ? "ready" : calculationReady ? "working" : "pending",
    },
    {
      id: "reservas",
      label: "Reservas",
      valor: reservasTotal ? fmtInt(reservasTotal) : undefined,
      detalle: extraReserveRows.length
        ? `cadenas Rn + ${fmtInt(extraReserveRows.length)} en bolsa extra`
        : "cadenas de reemplazo equivalente",
      estado: replacementReady ? "ready" : selectionReady ? "working" : "pending",
    },
    {
      id: "entregables",
      label: "Entregables",
      valor: entregablesListos ? (sheetsConfigured ? "Excel + Sheets" : "Excel") : undefined,
      detalle: entregablesListos ? "listos para exportar" : "configúralos en Entregables",
      estado: entregablesListos ? "ready" : selectionReady ? "working" : "pending",
    },
  ];

  return (
    <div className="cmv2-sal-stack">
      <ContextoLlano paso="salidas" />

      <section className="cmv2-panel cmv2-sal-panel cmv2-sal-ficha" aria-label="Ficha ejecutiva del diseño muestral">
        <div className="cmv2-panel-head">
          <div>
            <span className="cmv2-eyebrow">Ficha ejecutiva</span>
            <strong>
              {calculationReady && selectionReady
                ? "El diseño completo, con las cifras que se defienden ante el cliente"
                : "El camino del diseño y lo que falta para cerrarlo"}
            </strong>
          </div>
          <span
            className="cmv2-pill-soft cmv2-sal-estado"
            data-cerrado={(calculationReady && selectionReady && replacementReady) || undefined}
          >
            {calculationReady && selectionReady && replacementReady ? "diseño cerrado" : "en preparación"}
          </span>
        </div>

        <FlujoVertical
          etapas={etapas}
          orientacion="horizontal"
          ariaLabel="Camino completo: del marco validado a los entregables"
        />

        <CifraFila>
          <CifraMotor
            label="n objetivo"
            value={calculationReady ? fmtInt(targetForDisplay) : "pendiente"}
            detalle="entrevistas a lograr"
            origen={calculationReady ? "motor" : undefined}
            hero
          />
          <CifraMotor
            label="Margen real alcanzado"
            value={Number.isFinite(precision) ? `±${fmtPct(precision)}` : "pendiente"}
            detalle={precisionCensal
              ? "el n cubre todo el marco (nivel universidad)"
              : "retrocálculo con el n final (nivel universidad)"}
            origen={Number.isFinite(precision) ? (precisionEsMotor ? "motor" : "preview") : undefined}
          />
          <CifraMotor
            label="Representatividad"
            value={Number.isFinite(currentRepresentativityScore) ? classroomScore(currentRepresentativityScore) : "pendiente"}
            detalle="score global de la selección"
            origen={Number.isFinite(currentRepresentativityScore) ? "motor" : undefined}
          />
          <CifraMotor
            label="Aulas titulares M1"
            value={m1Rows.length ? fmtInt(m1Rows.length) : "pendiente"}
            detalle={reservasTotal ? `con ${fmtInt(reservasTotal)} reservas` : "reservas pendientes"}
            origen={selectionReady ? "motor" : undefined}
          />
          <CifraMotor
            label="Profundidad de reserva"
            value={Number.isFinite(minDepth) ? fmtRatio(minDepth) : "pendiente"}
            detalle={Number.isFinite(minDepth)
              ? minDepth < 1
                ? "hay celdas sin reserva completa"
                : `mínima por celda${peorCelda ? `: ${classroomRowText(peorCelda, ["stratum"])}` : ""}`
              : "requiere simular reemplazos"}
            origen={Number.isFinite(minDepth) ? "motor" : undefined}
            tono={Number.isFinite(minDepth) ? (minDepth < 1 ? "alerta" : "ok") : undefined}
          />
        </CifraFila>

        <div className="cmv2-sal-meta" aria-label="Reproducibilidad del sorteo">
          <span>
            <b>Método</b>
            {selection
              ? classroomMethodLabel(String(selection.selector_engine_used ?? selection.selector_engine ?? ""))
              : "pendiente"}
          </span>
          <span>
            <b>Semilla</b>
            {selection ? String(safeNumber(selection.seed, model.config.semilla)) : "pendiente"}
          </span>
          <span>
            <b>Firma del marco</b>
            {selection?.frame_hash
              ? String(selection.frame_hash).slice(0, 10)
              : frame?.frame_hash
                ? String(frame.frame_hash).slice(0, 10)
                : "pendiente"}
          </span>
          <em>Con estos datos el sorteo se reconstruye exacto; el detalle completo vive en Aulas → Sustento técnico.</em>
        </div>
      </section>
    </div>
  );
}

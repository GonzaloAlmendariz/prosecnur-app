/**
 * Pestaña "Pase a Monitoreo" (id salidas-monitoreo) de la sección Salida.
 * Diagrama de handoff (titulares M1 → códigos/QR → agenda de campo →
 * seguimiento) que deja claro qué recibe Monitoreo y que allí solo se activan
 * reemplazos equivalentes, sin rediseñar el marco; el puente real
 * (AulasApplicationFlow) y la tabla de titulares; y absorbe la antigua
 * pestaña de reservas como bloque final read-only "Reservas listas para
 * campo" con la profundidad por celda y las rutas Rn.1, Rn.2…
 */
import { ArrowRight, CheckCircle2, Grid3X3, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { AulasApplicationFlow } from "../../../aulasFlow/AulasApplicationFlow";
import { fmtInt, fmtRatio } from "../../sharedCore";
import { classroomRowNumber, classroomRowText } from "../shared/format";
import { CifraFila, CifraMotor, FlujoVertical, type FlujoEtapa } from "../ui";
import {
  ClassroomEmptyState,
  ClassroomReplacementTables,
  ClassroomSelectionTable,
  classroomMethodLabel,
  type ClassroomLabModel,
} from "../aulas/aulasParts";
import "../../didactica/didactica.css";
import "./salidas.css";

export function SalidasMonitoreoTab({ model }: { model: ClassroomLabModel }) {
  const {
    selection,
    selectionReady,
    comparisonReady,
    replacementReady,
    replacementSimulation,
    comparison,
    m1Rows,
    reserveRows,
    extraReserveRows,
    reserveDepthRows,
  } = model;

  const reservasTotal = reserveRows.length + extraReserveRows.length;
  const methodLabel = selectionReady && selection
    ? classroomMethodLabel(String(selection.selector_engine_used ?? selection.selector_engine ?? ""))
    : comparisonReady
      ? "comparado, faltan titulares"
      : comparison?.recommendation?.method_label ?? "pendiente";

  const etapas: FlujoEtapa[] = [
    {
      id: "titulares",
      label: "Titulares M1",
      valor: m1Rows.length ? fmtInt(m1Rows.length) : undefined,
      detalle: "selección cerrada de la calculadora",
      estado: selectionReady ? "ready" : "pending",
    },
    {
      id: "codigos",
      label: "Códigos operativos y QR",
      valor: selectionReady ? `${fmtInt(m1Rows.length + reservasTotal)} cursos-horario` : undefined,
      detalle: "una ficha por curso-horario",
      estado: selectionReady ? "ready" : "pending",
    },
    {
      id: "agenda",
      label: "Agenda de campo",
      detalle: "contacto, fecha y aplicador por curso-horario",
      estado: selectionReady ? "working" : "pending",
    },
    {
      id: "monitoreo",
      label: "Monitoreo hace seguimiento",
      detalle: "registra avance y activa reemplazos equivalentes",
      estado: selectionReady ? "working" : "pending",
    },
  ];

  return (
    <div className="cmv2-sal-stack">
      <section className="cmv2-panel cmv2-sal-panel" aria-label="Qué recibe Monitoreo">
        <div className="cmv2-panel-head">
          <strong>Pase a Monitoreo</strong>
          <span className="cmv2-pill-soft">Monitoreo no rediseña la muestra</span>
        </div>
        <FlujoVertical
          etapas={etapas}
          orientacion="horizontal"
          ariaLabel="Handoff: de titulares M1 al seguimiento en Monitoreo"
        />
        <p className="cmv2-sal-nota">
          Monitoreo recibe la agenda cerrada (titulares, reservas, códigos y pesos). Si un curso-horario titular cae,
          activa el reemplazo equivalente que dejó este diseño y registra el motivo: el marco y las
          probabilidades no se tocan durante el campo.
        </p>
        <CifraFila>
          <CifraMotor
            label="Cursos-horario titulares"
            value={m1Rows.length ? fmtInt(m1Rows.length) : "pendiente"}
            origen={selectionReady ? "motor" : undefined}
            hero
          />
          <CifraMotor
            label="Cursos-horario de reemplazo"
            value={reservasTotal ? fmtInt(reservasTotal) : "pendiente"}
            detalle={extraReserveRows.length ? `incluye ${fmtInt(extraReserveRows.length)} en bolsa extra` : undefined}
            origen={reservasTotal ? "motor" : undefined}
          />
          <CifraMotor label="Método" value={methodLabel} origen={selectionReady ? "motor" : undefined} />
          <CifraMotor
            label="Simulación de reemplazos"
            value={replacementReady ? "disponible" : replacementSimulation ? "sin sugerencias" : "pendiente"}
            origen={replacementReady ? "motor" : undefined}
          />
        </CifraFila>
      </section>

      <AulasApplicationFlow
        tone="calc-muestra"
        current="muestra"
        compact
        showEngineOutputs
        title={selectionReady ? "Plan listo para fichas QR" : "Completa la selección antes de emitir fichas"}
        summary="Esta salida entrega la agenda de cursos-horario del estudio: cada fila conserva curso, horario, salón, selección y trazabilidad para que Monitoreo prepare fichas QR/PDF y lea el avance."
        metrics={[
          { label: "Agenda", value: selectionReady ? `${fmtInt(m1Rows.length + reservasTotal)} cursos-horario` : "pendiente", tone: selectionReady ? "ready" : "warning" },
          { label: "Titulares", value: m1Rows.length ? fmtInt(m1Rows.length) : "pendiente", tone: m1Rows.length ? "ready" : "warning" },
          { label: "Reservas", value: reservasTotal ? fmtInt(reservasTotal) : "sin reservas", tone: reservasTotal ? "ready" : "neutral" },
          { label: "Siguiente", value: selectionReady ? "Fichas QR" : "seleccionar cursos-horario", tone: selectionReady ? "current" : "warning" },
        ]}
        secondaryAction={{ to: "/monitoreo", label: "Ver monitoreo" }}
        action={{ to: "/recopiladores", label: "Preparar fichas QR", disabled: !selectionReady }}
      />

      {selectionReady ? (
        <ClassroomSelectionTable rows={m1Rows.slice(0, 16)} />
      ) : (
        <ClassroomEmptyState
          icon={Grid3X3}
          title="Plan de cursos-horario pendiente"
          detail="Genera la selección para que Monitoreo reciba titulares, reemplazos y trazabilidad metodológica."
        />
      )}

      <section className="cmv2-panel cmv2-sal-panel" aria-label="Reservas listas para campo">
        <div className="cmv2-panel-head">
          <strong>Reservas listas para campo</strong>
          <span className="cmv2-pill-soft">solo lectura · se gestiona en Selección</span>
        </div>
        {reserveDepthRows.length > 0 && (() => {
          // Celdas más ajustadas primero; las holgadas se resumen en un conteo.
          const ordenadas = [...reserveDepthRows].sort(
            (a, b) => classroomRowNumber(a, ["depth_ratio"]) - classroomRowNumber(b, ["depth_ratio"]),
          );
          const visibles = ordenadas.slice(0, 18);
          const restantes = ordenadas.length - visibles.length;
          return (
            <div className="cmv2-sal-profundidad cmv2-uni-stagger" aria-label="Profundidad de reserva por celda">
              {visibles.map((row, index) => {
                const ratio = classroomRowNumber(row, ["depth_ratio"]);
                return (
                  <span
                    key={`${classroomRowText(row, ["stratum"])}-${index}`}
                    data-tono={ratio < 1 ? "alerta" : ratio >= 2 ? "ok" : undefined}
                  >
                    <b>{classroomRowText(row, ["stratum"]) || `celda ${index + 1}`}</b>
                    {fmtInt(classroomRowNumber(row, ["reservas"]))} para {fmtInt(classroomRowNumber(row, ["titulares"]))} titulares
                    <i>{Number.isFinite(ratio) ? fmtRatio(ratio) : "—"}</i>
                  </span>
                );
              })}
              {restantes > 0 && (
                <span data-tono="ok">
                  <b>+{fmtInt(restantes)} celdas más</b>
                  con reserva holgada
                </span>
              )}
            </div>
          );
        })()}
        {replacementReady && replacementSimulation ? (
          <ClassroomReplacementTables simulation={replacementSimulation} />
        ) : reserveRows.length ? (
          <ClassroomSelectionTable rows={reserveRows.slice(0, 24)} />
        ) : (
          <ClassroomEmptyState
            icon={RefreshCw}
            title="Reemplazos pendientes"
            detail="Genera la selección y simula reemplazos para ver qué curso-horario conviene activar si uno titular cae."
          />
        )}
      </section>

      {selectionReady && (
        <div className="pulso-continue-cta cmv2-sal-cierre-cta" aria-label="Cierre del diseño muestral">
          <span aria-hidden="true" className="pulso-continue-cta-icon">
            <CheckCircle2 size={17} />
          </span>
          <div className="pulso-continue-cta-copy">
            <div className="pulso-continue-cta-title">Diseño muestral listo</div>
            <div className="pulso-continue-cta-note">
              Titulares, reservas y códigos quedaron cerrados. El seguimiento de campo vive en Monitoreo:
              allí se registra el avance y se activan los reemplazos equivalentes sin tocar el diseño.
            </div>
          </div>
          <Link to="/monitoreo" className="pulso-continue-cta-link">
            Abrir Monitoreo <ArrowRight size={13} />
          </Link>
        </div>
      )}
    </div>
  );
}

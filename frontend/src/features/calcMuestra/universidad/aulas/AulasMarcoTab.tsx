/**
 * Pestaña "Marco de aulas" (id marco) de la sección Aulas. Es la puerta del
 * laboratorio: contexto llano, la cadena metodológica real como flujo con
 * estados vivos, las 4 reglas del método como chips con Popover (absorben los
 * textos útiles del antiguo guide del laboratorio) y la tarjeta de
 * reproducibilidad del marco congelado (firma, fecha, filas y advertencia si
 * el marco de la sección 2 cambió después de la selección).
 */
import { Database } from "lucide-react";
import { Popover } from "../../../../components/Popover";
import { RespaldoMetodologico } from "../../didactica/PasoDidactico";
import { fmtInt } from "../../sharedCore";
import { AvisoModulo } from "../shared/AvisoModulo";
import { frameAuditNumber } from "../shared/frame";
import { CifraFila, CifraMotor, FlujoVertical, type FlujoEtapa } from "../ui";
import { classroomMethodLabel, type ClassroomLabModel } from "./aulasParts";
import "../../didactica/didactica.css";
import "./aulas.css";

/** Reglas del método: antes 4 tarjetas estáticas + guide; ahora chips con Popover. */
const REGLAS_METODO: Array<{ id: string; chip: string; titulo: string; parrafos: string[] }> = [
  {
    id: "unidad",
    chip: "Unidad seleccionable",
    titulo: "Se sortea el curso-horario, no la fila alumno-curso",
    parrafos: [
      "La base institucional trae una fila por estudiante en cada curso y horario; antes de sortear, el marco se colapsa a una fila por curso-horario.",
      "La idea es mirar la cadena real: base institucional, cursos y horarios, estudiantes únicos y exclusiones auditadas. Qué filas son válidas y qué curso-horario representa cada registro se decide aquí.",
    ],
  },
  {
    id: "repetidos",
    chip: "Estudiantes repetidos",
    titulo: "Un estudiante puede aparecer en varios cursos",
    parrafos: [
      "Si un estudiante está matriculado en varios cursos del marco, podría ser alcanzado por más de un curso-horario. El selector lo controla desde el marco institucional: mide la pérdida por repetidos y la penaliza al comparar métodos.",
      "Por eso la calidad se mide sobre estudiantes únicos elegibles, no sobre filas repetidas.",
    ],
  },
  {
    id: "reemplazos",
    chip: "Reemplazos ≠ extra",
    titulo: "Los reemplazos no son encuestas extra",
    parrafos: [
      "Cada curso-horario titular lleva reemplazos equivalentes (mismo perfil de facultad y tamaño) que solo se activan si el titular cae. No suman al N estadístico.",
      "El extra operativo es otra cosa: refuerzo de agenda presupuestado por separado, que tampoco cambia el diseño.",
    ],
  },
  {
    id: "anonimo",
    chip: "Campo anónimo",
    titulo: "No exige identificación personal en campo",
    parrafos: [
      "La aplicación no requiere identificar al estudiante: la trazabilidad de campo cruza recolector, enlace, curso-horario, fecha y estado operativo.",
      "Los identificadores internos del marco sirven para controlar duplicados y cobertura, y no se publican en salidas para cliente.",
    ],
  },
];

export function AulasMarcoTab({ model }: { model: ClassroomLabModel }) {
  const {
    frame,
    frameRows,
    frameReady,
    framePopulationCount,
    selection,
    selectionReady,
    comparisonReady,
    config,
    engineOption,
    m1Rows,
    m1ForDisplay,
    facultyTarget,
    frameTarget,
    targetForDisplay,
    frameAuditCardsForDisplay,
  } = model;

  // Cadena metodológica: de base institucional a agenda (estados vivos).
  const etapas: FlujoEtapa[] = [
    {
      id: "base",
      label: "Base institucional",
      valor: frameAuditNumber(frame, "input_rows") ? `${fmtInt(frameAuditNumber(frame, "input_rows"))} filas` : "estudiante × curso-horario",
      detalle: "un estudiante puede aparecer en varios cursos",
      estado: frameReady ? "ready" : "pending",
    },
    {
      id: "marco",
      label: "Marco de cursos-horario",
      valor: frameRows.length ? `${fmtInt(frameRows.length)} cursos-horario` : "curso y horario",
      detalle: "una fila por curso-horario seleccionable",
      estado: frameReady ? "ready" : "pending",
    },
    {
      id: "n",
      label: "N por facultad",
      valor: facultyTarget ? fmtInt(facultyTarget) : frameTarget ? `${fmtInt(frameTarget)} precargado` : "pendiente",
      detalle: facultyTarget ? "viene de la pestaña Cálculo" : "requiere calcular antes de seleccionar",
      estado: targetForDisplay > 0 ? "ready" : "working",
    },
    {
      id: "cuota-aulas",
      label: "Cursos-horario por facultad",
      valor: m1ForDisplay ? `${fmtInt(m1ForDisplay)} titulares` : "pendiente",
      detalle: "cuota / rendimiento esperado",
      estado: m1ForDisplay ? "ready" : "pending",
    },
    {
      id: "comparador",
      label: "Comparador de métodos",
      valor: comparisonReady ? "métodos evaluados" : "por correr",
      detalle: "sistemático, balanceado, dispersión y optimización",
      estado: comparisonReady ? "ready" : "pending",
    },
    {
      id: "seleccion",
      label: "Selección",
      valor: selectionReady ? `${fmtInt(m1Rows.length)} titulares` : comparisonReady ? engineOption.label : "pendiente",
      detalle: "balance, cobertura y repetidos",
      estado: selectionReady ? "ready" : "pending",
    },
    {
      id: "reemplazos",
      label: "Reemplazos",
      valor: `R1-R${config.bolsas_reemplazo}`,
      detalle: "rutas equivalentes por curso-horario titular",
      estado: selectionReady ? "ready" : "pending",
    },
  ];

  const frameHash = frame?.frame_hash ? String(frame.frame_hash) : "";
  const selectionHash = selection?.frame_hash ? String(selection.frame_hash) : "";
  const frameChangedAfterSelection = Boolean(frameHash && selectionHash && frameHash !== selectionHash);
  const generatedAt = frame?.generated_at ? String(frame.generated_at).slice(0, 16).replace("T", " ") : "";
  const exclusions = frame?.exclusions?.length ?? 0;

  return (
    <div className="cmv2-aulas-stack">
      <section className="cmv2-panel cmv2-aulas-panel">
        <div className="cmv2-subhead">
          <strong>Cadena metodológica</strong>
        </div>
        <div className="cmv2-aulas-marco-layout">
          <FlujoVertical etapas={etapas} ariaLabel="Cadena metodológica de selección de cursos-horario" />
          <div className="cmv2-aulas-marco-lateral">
            <div className="cmv2-aulas-chips" aria-label="Reglas del método de selección">
              <span className="cmv2-aulas-chips-titulo">Reglas del método</span>
              {REGLAS_METODO.map((regla) => (
                <Popover
                  key={regla.id}
                  openOn="hover"
                  ariaLabel={regla.titulo}
                  trigger={<button type="button" className="cmv2-aulas-chip">{regla.chip}</button>}
                >
                  <div className="cmv2-aulas-chip-pop">
                    <strong>{regla.titulo}</strong>
                    {regla.parrafos.map((parrafo, i) => (
                      <p key={i}>{parrafo}</p>
                    ))}
                  </div>
                </Popover>
              ))}
            </div>
            <div className="cmv2-classroom-audit-grid">
              {frameAuditCardsForDisplay.map((row) => (
                <div key={row.label}>
                  <small>{row.label}</small>
                  <strong>{row.value}</strong>
                  <span>{row.detail}</span>
                </div>
              ))}
              {!frameAuditCardsForDisplay.length && (
                <div>
                  <small>Marco pendiente</small>
                  <strong>Carga o construye el marco</strong>
                  <span>Cuando exista una base principal o dos bases equivalentes, esta sección mostrará auditoría real.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="cmv2-panel cmv2-aulas-panel cmv2-aulas-sello" aria-label="Reproducibilidad del marco congelado">
        <div className="cmv2-subhead">
          <strong>Reproducibilidad</strong>
        </div>
        {!frameReady ? (
          <div className="cmv2-classroom-empty is-compact">
            <span><Database size={16} /></span>
            <div>
              <strong>Marco pendiente</strong>
              <em>Construye el marco en Definición → Bases para congelar una firma reproducible.</em>
            </div>
          </div>
        ) : (
          <>
            <CifraFila>
              <CifraMotor
                label="Firma del marco"
                value={frameHash ? frameHash.slice(0, 10) : "pendiente"}
                detalle="hash del marco congelado"
                origen={frameHash ? "motor" : undefined}
                hero
              />
              {/* Un solo sello por panel (QA H11): la firma valida al grupo;
                  repetir "cifra validada" en las 4 celdas inflaba el sello. */}
              <CifraMotor
                label="Generado"
                value={generatedAt || "pendiente"}
                detalle="fecha de construcción"
              />
              <CifraMotor
                label="Filas del marco"
                value={frameRows.length ? fmtInt(frameRows.length) : "pendiente"}
                detalle="cursos-horario seleccionables"
              />
              <CifraMotor
                label="Estudiantes únicos"
                value={framePopulationCount ? fmtInt(framePopulationCount) : "pendiente"}
                detalle={exclusions ? `${fmtInt(exclusions)} exclusiones auditadas` : "población que representa"}
              />
            </CifraFila>
            <p className="cmv2-aulas-nota-suave">
              La selección conserva semilla, firma del marco y reglas usadas para poder replicarse; el sustento completo vive en la pestaña Sustento técnico.
            </p>
            {frameChangedAfterSelection && (
              <AvisoModulo tone="warn" title="El marco cambió después de la selección.">
                La selección vigente ({classroomMethodLabel(String(selection?.selector_engine_used ?? selection?.selector_engine ?? ""))}) se sorteó sobre la firma {selectionHash.slice(0, 10)}, pero el marco actual tiene la firma {frameHash.slice(0, 10)}. Vuelve a comparar métodos y seleccionar para que titulares y reemplazos correspondan al marco vigente.
              </AvisoModulo>
            )}
          </>
        )}
      </section>

      <RespaldoMetodologico paso="aulas" />
    </div>
  );
}

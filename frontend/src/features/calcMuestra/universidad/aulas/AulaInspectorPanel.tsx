/**
 * Inspector lateral del aula seleccionada (pestaña "Aulas titulares").
 * Panel dentro de la pestaña (no modal): identidad, sorteo (π, peso, rol,
 * método), plan B (cadena de reemplazos o titular de origen) y composición,
 * con nota de procedencia del motor. Cierra con ✕ o Esc; clic en un eslabón
 * de la cadena re-apunta el inspector. Scroll interno propio (nunca crea un
 * segundo scroll de página). Estilos: .cmv2-aulas-inspector-* en aulas.css.
 */
import { useEffect, useMemo } from "react";
import { ArrowLeft, Route, X } from "lucide-react";
import { BadgeMotor } from "../../didactica/PasoDidactico";
import { buildAulaInspectorModel, DASH } from "./aulaInspectorModel";
import "./aulas.css";

function DatoFila({ label, value }: { label: string; value: string }) {
  return (
    <div className="cmv2-aulas-inspector-dato">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function AulaInspectorPanel({
  row,
  selectionRows,
  methodLabel,
  onClose,
  onInspect,
}: {
  row: Record<string, unknown>;
  selectionRows: Array<Record<string, unknown>>;
  methodLabel?: string;
  onClose: () => void;
  /** Re-apunta el inspector a otra aula de la selección (por classroom_id). */
  onInspect?: (classroomId: string) => void;
}) {
  const model = useMemo(
    () => buildAulaInspectorModel({ row, selectionRows, methodLabel }),
    [row, selectionRows, methodLabel],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const identidad = [
    { label: "Facultad", value: model.faculty },
    { label: "Programa", value: model.level ? `${model.program} · nivel ${model.level}` : model.program },
    { label: "Horario", value: model.modality ? `${model.schedule} · ${model.modality}` : model.schedule },
    ...(model.teacher ? [{ label: "Docente", value: model.teacher }] : []),
  ];

  return (
    <aside
      className="cmv2-aulas-inspector"
      role="complementary"
      aria-label={`Detalle del curso-horario ${model.code}`}
    >
      <header className="cmv2-aulas-inspector-head">
        <div className="cmv2-aulas-inspector-titulo">
          <span className="cmv2-aulas-inspector-rol" data-rol={model.rol}>{model.rolLabel}</span>
          <strong>{model.courseName}</strong>
          <code>{model.code} · {model.id}</code>
        </div>
        <button
          type="button"
          className="cmv2-aulas-inspector-cerrar"
          aria-label="Cerrar inspector de curso-horario"
          onClick={onClose}
        >
          <X size={14} />
        </button>
      </header>

      <div className="cmv2-aulas-inspector-body">
        <section aria-label="Identidad del curso-horario">
          <span className="cmv2-aulas-inspector-eyebrow">Identidad</span>
          {identidad.map((item) => (
            <DatoFila key={item.label} label={item.label} value={item.value} />
          ))}
        </section>

        <section aria-label="Sorteo y probabilidad">
          <span className="cmv2-aulas-inspector-eyebrow">Sorteo</span>
          <div className="cmv2-aulas-inspector-pi">
            <div>
              <span>Prob. de inclusión π</span>
              <strong>{model.piText}</strong>
            </div>
            <div>
              <span>Peso 1/π</span>
              <strong>{model.pesoText}</strong>
            </div>
          </div>
          <DatoFila label="Método" value={model.metodoLabel} />
          {model.rol === "reemplazo" && (
            <>
              <DatoFila label="Reemplaza a" value={model.titular ? `${model.titular.code} · ${model.titular.label}` : DASH} />
              <DatoFila label="Equivalencia" value={model.equivalenciaLabel} />
            </>
          )}
          {model.rol === "extra" && (
            <p className="cmv2-aulas-inspector-nota">
              Bolsa extra: solo entra a campo cuando la cadena de un titular se agota o la celda queda frágil.
            </p>
          )}
        </section>

        <section aria-label="Plan B del curso-horario">
          <span className="cmv2-aulas-inspector-eyebrow">Plan B</span>
          {model.rol === "reemplazo" && model.titular && (
            <button
              type="button"
              className="cmv2-aulas-inspector-eslabon is-titular"
              onClick={model.titular.id && onInspect ? () => onInspect(model.titular!.id) : undefined}
              disabled={!model.titular.id || !onInspect}
            >
              <ArrowLeft size={12} aria-hidden="true" />
              <b>{model.titular.code}</b>
              <span>{model.titular.label}</span>
              <small>titular de esta cadena</small>
            </button>
          )}
          {model.cadena.length ? (
            <ol className="cmv2-aulas-inspector-cadena" aria-label="Cadena de reemplazos ordenada">
              {model.cadena.map((eslabon, index) => (
                <li key={`${eslabon.id || eslabon.code}-${index}`}>
                  <button
                    type="button"
                    className={`cmv2-aulas-inspector-eslabon${eslabon.activo ? " is-activo" : ""}`}
                    onClick={eslabon.id && onInspect ? () => onInspect(eslabon.id) : undefined}
                    disabled={!eslabon.id || !onInspect}
                    aria-current={eslabon.activo ? "true" : undefined}
                  >
                    <b>{eslabon.code}</b>
                    <span>{eslabon.label}</span>
                    <small>{eslabon.equivalencia}{eslabon.activo ? " · este curso-horario" : ""}</small>
                  </button>
                </li>
              ))}
            </ol>
          ) : model.rol !== "reemplazo" ? (
            <p className="cmv2-aulas-inspector-nota">
              <Route size={12} aria-hidden="true" /> {model.rol === "extra"
                ? "Sin cadena propia: se asigna desde Monitoreo cuando se activa."
                : "Sin reemplazos ligados en la selección actual."}
            </p>
          ) : null}
        </section>

        <section aria-label="Composición del curso-horario">
          <span className="cmv2-aulas-inspector-eyebrow">Composición</span>
          <DatoFila label="Elegibles" value={model.elegiblesText} />
          <DatoFila label="Matriculados" value={model.matriculadosText} />
          {model.unicosText && <DatoFila label="Únicos aportados" value={model.unicosText} />}
          <DatoFila label="Repetidos con otros cursos-horario" value={model.repetidosText} />
        </section>

        <footer className="cmv2-aulas-inspector-procedencia">
          <BadgeMotor estado="validado" />
          <span>Cifras leídas de la selección de la calculadora (motor R), sin recálculos en la interfaz.</span>
        </footer>
      </div>
    </aside>
  );
}

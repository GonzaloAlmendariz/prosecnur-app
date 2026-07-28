import { CalendarRange, ChevronDown, ChevronRight, CircleDot, Plus } from "../../../vendor/lucide-react";

import type { BitacoraFaseVista } from "../../../api/bitacora";
import type { PlanTrabajoTask } from "../../../api/planTrabajo";
import { duracionEnDias, etiquetaRango } from "./fases";

/**
 * Una fila del compositor: la fase, su rango y sus dos campos de fecha.
 *
 * Poner una fase en el cronograma tiene que costar dos clics —abrir el rango,
 * marcar dos fechas—; por eso los `input[type=date]` están en la fila y no
 * detrás de un diálogo. Las actividades sueltas viven en un disclosure, no en
 * el camino principal.
 */
export function FilaDeFase({
  fase,
  tareas,
  expandida,
  solapada,
  guardando,
  onToggle,
  onRango,
  onNuevaActividad,
}: {
  fase: BitacoraFaseVista;
  tareas: PlanTrabajoTask[];
  expandida: boolean;
  solapada: boolean;
  guardando: boolean;
  onToggle: () => void;
  onRango: (inicio: string, fin: string) => void;
  onNuevaActividad: () => void;
}) {
  const dias = duracionEnDias(fase.start_date, fase.end_date);
  const conEvidencia = fase.evidence_state === "evidence_available";
  const sinFechas = !fase.start_date && !fase.end_date;

  return (
    <div
      className={`bit-fase${expandida ? " is-expandida" : ""}${sinFechas ? " is-vacia" : ""}`}
      data-fase={fase.id}
      data-qa-geometry-member=""
    >
      <div className="bit-fase-cabecera">
        <button
          type="button"
          className="bit-fase-toggle"
          onClick={onToggle}
          aria-expanded={expandida}
          aria-label={`${expandida ? "Contraer" : "Expandir"} las actividades de ${fase.label}`}
        >
          {expandida ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>

        <span className="bit-fase-nombre">
          <strong>{fase.label}</strong>
          <small>
            {fase.task_count === 0
              ? "sin actividades"
              : `${fase.task_count} ${fase.task_count === 1 ? "actividad" : "actividades"}`}
          </small>
        </span>

        <span
          className={`bit-fase-evidencia is-${conEvidencia ? "real" : "plan"}`}
          title={
            conEvidencia
              ? `Ya hay trabajo registrado en ${fase.modulos.join(", ")}`
              : "Planificada; todavía sin trabajo registrado en la app"
          }
        >
          <CircleDot size={12} aria-hidden="true" />
          <span>{conEvidencia ? "En marcha" : "Planificada"}</span>
        </span>

        <span className="bit-fase-fechas">
          <label>
            <span className="pulso-sr-only">Inicio de {fase.label}</span>
            <input
              type="date"
              value={fase.start_date}
              disabled={guardando}
              onChange={(event) => onRango(event.target.value, fase.end_date)}
            />
          </label>
          <span aria-hidden="true">→</span>
          <label>
            <span className="pulso-sr-only">Fin de {fase.label}</span>
            <input
              type="date"
              value={fase.end_date}
              min={fase.start_date || undefined}
              disabled={guardando}
              onChange={(event) => onRango(fase.start_date, event.target.value)}
            />
          </label>
        </span>

        <span className={`bit-fase-rango${solapada ? " is-solapada" : ""}`}>
          <CalendarRange size={13} aria-hidden="true" />
          <span>{etiquetaRango(fase.start_date, fase.end_date)}</span>
          {dias > 0 && <small>{dias} d</small>}
        </span>
      </div>

      {solapada && (
        <p className="bit-fase-aviso">
          Se superpone con otra fase. Suele ser correcto —el procesamiento arranca
          antes de que cierre el campo—, pero conviene revisar que no sea un dedazo.
        </p>
      )}

      {expandida && (
        <div className="bit-fase-actividades">
          {tareas.length === 0 ? (
            <p className="bit-fase-sin-actividades">
              Esta fase todavía no tiene actividades sueltas. El rango de arriba ya
              la ubica en el cronograma; agrega actividades solo si necesitas
              detallarla.
            </p>
          ) : (
            <ul>
              {tareas.map((t) => (
                <li key={t.id} className={`bit-fase-actividad is-${t.status}`}>
                  <span>{t.activity}</span>
                  <small>{etiquetaRango(t.start_date, t.end_date)}</small>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="bit-boton-sutil" onClick={onNuevaActividad}>
            <Plus size={14} />
            <span>Actividad en {fase.label}</span>
          </button>
        </div>
      )}
    </div>
  );
}

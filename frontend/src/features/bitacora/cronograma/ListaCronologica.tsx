import { useMemo } from "react";
import { AlertTriangle, Archive, CalendarRange, Copy, Flag } from "../../../vendor/lucide-react";

import type { BitacoraEstado } from "../../../api/bitacora";
import { apiBitacoraTareaArchivar, apiBitacoraTareaDuplicar } from "../../../api/bitacora";
import type { PlanTrabajoTask } from "../../../api/planTrabajo";
import { EmptyState } from "../../../components/States";
import { agruparCronograma, etiquetaRango, estaVencida } from "./fases";

const ETIQUETA_PRIORIDAD: Record<string, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

/**
 * Lista cronológica agrupada: vencidos, hoy, esta semana, más adelante.
 *
 * Complementa al Gantt, que muestra la forma del cronograma pero no responde
 * "qué se me pasó". El agrupado se calcula contra el reloj LOCAL (ver
 * `fases.ts`), no contra la marca UTC del payload.
 */
export function ListaCronologica({
  estado,
  onEstado,
}: {
  estado: BitacoraEstado;
  onEstado: (siguiente: BitacoraEstado) => void;
}) {
  const ahora = useMemo(() => new Date(), []);
  const visibles = useMemo(
    () =>
      estado.plan.tasks.filter((t) =>
        estado.preferencias.cronograma.mostrar_archivadas ? true : !t.archived_at,
      ),
    [estado.plan.tasks, estado.preferencias.cronograma.mostrar_archivadas],
  );
  const grupos = useMemo(() => agruparCronograma(visibles, ahora), [visibles, ahora]);

  if (visibles.length === 0) {
    return (
      <EmptyState
        icon={<CalendarRange size={28} aria-hidden="true" />}
        title="Todavía no hay nada que ordenar por fecha"
        hint="Arma las fases del estudio en la vista Fases: acá aparecerán agrupadas por cercanía, con los vencidos primero."
      />
    );
  }

  async function accion(fn: () => Promise<BitacoraEstado>) {
    onEstado(await fn());
  }

  return (
    <div className="bit-lista" data-audit-ready="bitacora-cronograma-lista">
      {grupos.map((grupo) => (
        <section
          key={grupo.bucket}
          className={`bit-lista-grupo is-${grupo.bucket}`}
          aria-label={grupo.label}
        >
          <h3 className="bit-lista-titulo">
            {grupo.bucket === "vencido" && <AlertTriangle size={14} aria-hidden="true" />}
            <span>{grupo.label}</span>
            <small>{grupo.tareas.length}</small>
          </h3>
          <ul>
            {grupo.tareas.map((t) => (
              <FilaTarea
                key={t.id}
                tarea={t}
                vencida={estaVencida(t, ahora)}
                onArchivar={() => void accion(() => apiBitacoraTareaArchivar(t.id, !t.archived_at))}
                onDuplicar={() => void accion(() => apiBitacoraTareaDuplicar(t.id))}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function FilaTarea({
  tarea,
  vencida,
  onArchivar,
  onDuplicar,
}: {
  tarea: PlanTrabajoTask;
  vencida: boolean;
  onArchivar: () => void;
  onDuplicar: () => void;
}) {
  const esEntregable = tarea.kind === "deliverable" || tarea.kind === "milestone";
  return (
    <li
      className={`bit-lista-item is-${tarea.status}${vencida ? " is-vencida" : ""}${tarea.archived_at ? " is-archivada" : ""}`}
    >
      <span className="bit-lista-marca" aria-hidden="true">
        {esEntregable ? <Flag size={13} /> : null}
      </span>
      <span className="bit-lista-cuerpo">
        <strong>{tarea.activity}</strong>
        <small>
          {etiquetaRango(tarea.start_date, tarea.end_date)}
          {tarea.responsible ? ` · ${tarea.responsible}` : ""}
          {tarea.priority && tarea.priority !== "media"
            ? ` · ${ETIQUETA_PRIORIDAD[tarea.priority] ?? tarea.priority}`
            : ""}
        </small>
      </span>
      {/* La celda se renderiza SIEMPRE, aunque esté vacía: si se omitiera, la
          fila tendría tres columnas en vez de cuatro y las acciones subirían
          una posición, desalineándose de las filas que sí tienen etiquetas. */}
      <span className="bit-lista-etiquetas">
        {(tarea.tags ?? []).map((etq) => (
          <span key={etq} className="bit-etiqueta">{etq}</span>
        ))}
      </span>
      <span className="bit-lista-acciones">
        <button type="button" onClick={onDuplicar} title="Duplicar" aria-label={`Duplicar ${tarea.activity}`}>
          <Copy size={13} />
        </button>
        <button
          type="button"
          onClick={onArchivar}
          title={tarea.archived_at ? "Restaurar" : "Archivar"}
          aria-label={`${tarea.archived_at ? "Restaurar" : "Archivar"} ${tarea.activity}`}
        >
          <Archive size={13} />
        </button>
      </span>
    </li>
  );
}

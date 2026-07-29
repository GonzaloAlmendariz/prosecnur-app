import { Bell, BellRing, Plus, X } from "../../../vendor/lucide-react";

import type { BitacoraRecordatorio, PlanTrabajoTask } from "../../../api/planTrabajo";
import { etiquetaOffset, OFFSETS_SUGERIDOS } from "./motor";
import "./avisos.css";

/**
 * Recordatorios de un hito (ADR 0047).
 *
 * Los offsets son RELATIVOS al hito, nunca absolutos: mover la fecha del hito
 * mueve sus avisos sin que haya que reescribirlos. Esa es la razón por la que
 * la UI ofrece "1 día antes" y no un selector de fecha y hora.
 */
export function EditorRecordatorios({
  tarea,
  guardando,
  onCambio,
}: {
  tarea: PlanTrabajoTask;
  guardando: boolean;
  onCambio: (recordatorios: BitacoraRecordatorio[]) => void;
}) {
  const recordatorios = tarea.reminders ?? [];
  const sinFecha = !tarea.start_date && !tarea.end_date;

  function agregar(offsetMinutos: number) {
    if (recordatorios.some((r) => r.anchor === "start" && r.offset_minutes === offsetMinutos)) return;
    onCambio([
      ...recordatorios,
      {
        // El backend reemplaza el id por uno propio; acá basta con que sea
        // único dentro de esta lista para la key de React.
        id: `nuevo-${offsetMinutos}`,
        anchor: "start",
        offset_minutes: offsetMinutos,
        channel: "in_app",
        state: "programado",
        snoozed_until: "",
        created_at: "",
      },
    ]);
  }

  function quitar(id: string) {
    onCambio(recordatorios.filter((r) => r.id !== id));
  }

  return (
    <div className="bit-recordatorios">
      <div className="bit-recordatorios-cabecera">
        {recordatorios.length > 0 ? <BellRing size={14} /> : <Bell size={14} />}
        <strong>Recordatorios</strong>
        {sinFecha && (
          <small className="bit-recordatorios-nota">
            Ponle fechas a la etapa para que los avisos tengan cuándo sonar.
          </small>
        )}
      </div>

      {recordatorios.length > 0 && (
        <ul className="bit-recordatorios-lista">
          {recordatorios.map((r) => (
            <li key={r.id} className={`bit-recordatorio is-${r.state}`}>
              <span>
                {etiquetaOffset(r.offset_minutes)}
                <small>{r.anchor === "end" ? "del fin" : "del inicio"}</small>
              </span>
              <button
                type="button"
                onClick={() => quitar(r.id)}
                disabled={guardando}
                aria-label={`Quitar el recordatorio de ${etiquetaOffset(r.offset_minutes)}`}
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="bit-recordatorios-agregar">
        {OFFSETS_SUGERIDOS.filter(
          (o) => !recordatorios.some((r) => r.anchor === "start" && r.offset_minutes === o.minutos),
        ).map((o) => (
          <button
            key={o.minutos}
            type="button"
            className="bit-boton-sutil"
            disabled={guardando || sinFecha}
            onClick={() => agregar(o.minutos)}
          >
            <Plus size={12} />
            <span>{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

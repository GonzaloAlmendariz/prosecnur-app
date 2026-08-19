/**
 * EF2 — el registro visible de la reparación docente-único.
 *
 * La capacidad existe sólo si el analista puede verla: el motor intercambia
 * aulas para no repetir docente y lo registra en la selección; esta tarjeta
 * es ese registro, con cada swap (saliente → entrante) y su celda. VARA 0:
 * el sacrificio de aleatoriedad se declara, nunca se esconde — hacia adentro.
 * Sin registro (corrida vieja, criterio apagado o cero conflictos) no pinta
 * nada: un aviso sobre nada sería ruido.
 */
import { RefreshCw } from "lucide-react";
import {
  normalizeCalcMuestraDocenteUnico,
} from "../../../../api/calcMuestra";
import "./docenteUnico.css";

export function DocenteUnicoAviso({ registro }: { registro: unknown }) {
  const datos = normalizeCalcMuestraDocenteUnico(registro);
  if (!datos || (!datos.ajustes.length && !datos.no_reparables.length)) return null;

  return (
    <section className="cmv2-docente-unico" aria-label="Ajustes por docente único">
      <header>
        <RefreshCw size={14} aria-hidden="true" />
        <strong>Docente único: {datos.ajustes.length} intercambio{datos.ajustes.length === 1 ? "" : "s"} registrado{datos.ajustes.length === 1 ? "" : "s"}</strong>
        <span>
          un docente no se selecciona repetido entre titulares; el ajuste es en la misma celda y se declara aquí
        </span>
      </header>
      <ul>
        {datos.ajustes.map((a) => (
          <li key={`${a.saliente}-${a.entrante}`}>
            <b>{a.docente}</b>
            <span className="cmv2-docente-unico-celda">{a.stratum}</span>
            <span className="cmv2-docente-unico-swap">
              {a.saliente} → {a.entrante}
              {a.intercambiado_con_ola ? <i title="el aula saliente pasó a la ola de reserva; nada se pierde"> · con ola</i> : null}
            </span>
          </li>
        ))}
        {datos.no_reparables.map((n) => (
          <li key={`nr-${n.classroom_id}`} data-no-reparable="true">
            <b>{n.docente}</b>
            <span className="cmv2-docente-unico-celda">{n.stratum}</span>
            <span className="cmv2-docente-unico-swap">
              {n.classroom_id} se conserva repetido: su celda no tiene candidato sin conflicto
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

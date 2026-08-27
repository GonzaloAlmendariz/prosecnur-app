/**
 * El editor de titulares por facultad, en la celda donde se lee el número.
 *
 * Decisión de Gonzalo (2026-08-27): «se muda a cálculo». Hasta hoy el único
 * editor del reparto vivía dentro de `aulas/CertificacionFacultadCard.tsx`,
 * cuya línea 130 corta la tarjeta entera cuando no hay certificación corrida:
 * sin certificación NO HABÍA forma de subir aulas desde la pantalla, y la
 * decisión volvía a ser manual —justo lo que él pidió que no pasara: «nada
 * puede ser manual y todo tiene que estar registrado en la aplicación».
 *
 * El mecanismo no es nuevo: escribe `aulas_base_fijas` del estrato, igual que
 * el stepper de la certificación. Lo que cambia es que ahora vive donde el
 * número se lee por primera vez, y no exige haber sorteado.
 *
 * Una fijación REEMPLAZA lo que la fórmula calcula, así que la celda lo dice
 * en vez de mostrar los dos números como si fueran el mismo: mientras no se
 * recalcule, el número de la tabla sigue siendo el de la fórmula y el fijado
 * está esperando. El aviso `FijasPendientesAviso` nombra la cadena completa.
 */
import { Pin } from "../../../../vendor/lucide-react";
import { fmtInt } from "../../sharedCore";
import "./titularesEditor.css";

export function TitularesFacultadEditor({
  facultad,
  calculadas,
  fijadas,
  onAjustar,
}: {
  facultad: string;
  /** Lo que publicó el motor para esta facultad en la corrida vigente. */
  calculadas: number;
  /** El override escrito en el estrato, si lo hay. */
  fijadas: number | null;
  onAjustar: (facultad: string, aulasActuales: number, delta: 1 | -1) => void;
}) {
  // El stepper opera sobre el número VIGENTE de la facultad: el fijado si
  // existe, y si no el calculado. Sumar sobre el calculado cuando ya hay una
  // fijación pendiente devolvería a la facultad al valor anterior +1 y se
  // comería la decisión sin decirlo.
  const vigente = fijadas ?? calculadas;
  const pendiente = fijadas != null && fijadas !== calculadas;

  return (
    <span className="cmv2-titulares-editor" data-fijada={fijadas != null || undefined}>
      <span className="cmv2-titulares-valor">
        {fmtInt(pendiente ? fijadas! : calculadas)}
        {fijadas != null && (
          <Pin
            size={11}
            aria-label={`Titulares fijados a mano para ${facultad}`}
            className="cmv2-titulares-pin"
          />
        )}
      </span>
      <span className="cmv2-titulares-stepper">
        <button
          type="button"
          disabled={vigente <= 1}
          aria-label={`Un titular menos en ${facultad}`}
          title={`Fija ${vigente - 1} titulares para ${facultad}. Reemplaza lo que calcula la fórmula; recalcula la propuesta para aplicarlo.`}
          onClick={() => onAjustar(facultad, vigente, -1)}
        >−</button>
        <button
          type="button"
          aria-label={`Un titular más en ${facultad}`}
          title={`Fija ${vigente + 1} titulares para ${facultad}. Reemplaza lo que calcula la fórmula; recalcula la propuesta para aplicarlo.`}
          onClick={() => onAjustar(facultad, vigente, 1)}
        >+</button>
      </span>
      {pendiente && (
        <small className="cmv2-titulares-pendiente">
          la fórmula calcula {fmtInt(calculadas)}
        </small>
      )}
    </span>
  );
}

import { Check, Loader2 } from "../../../../vendor/lucide-react";

import "./confirmadorCriterio.css";

/**
 * F121 · La confirmación es por criterio.
 *
 * Gonzalo: «la confirmación tiene que ser por criterio. Yo hago un cambio en el
 * criterio, lo tengo que confirmar, y esa confirmación es lo que permite que el
 * criterio siguiente y los que vienen se actualicen. Eso es básicamente el
 * embudo vivo».
 *
 * Por qué existe, y no es un botón de guardar:
 *
 * Los criterios se aplican en cascada — cada uno actúa sobre lo que dejó el
 * anterior. Mientras uno está a medio ajustar, los siguientes **no pueden decir
 * cuánto recortan**, porque no saben sobre qué marco actúan. Sus cifras siguen
 * siendo las de antes del cambio, y mostrarlas con la misma firmeza que las
 * confirmadas sería mentir con un número viejo.
 *
 * Así que el estado no es «guardado / sin guardar»: es **hasta dónde llega lo
 * que se puede creer**.
 */
export type EstadoConfirmacion = "al-dia" | "pendiente" | "confirmando";

export function ConfirmadorCriterio({
  estado,
  cambios,
  /** Cuántos criterios quedan en espera detrás de éste. */
  enEspera = 0,
  onConfirmar,
  onDescartar,
}: {
  estado: EstadoConfirmacion;
  /** Cuántos ajustes sin confirmar acumula este criterio. */
  cambios?: number;
  enEspera?: number;
  onConfirmar: () => void;
  onDescartar?: () => void;
}) {
  if (estado === "al-dia") {
    return (
      <p className="cmv2-confirmar" data-estado="al-dia">
        <Check size={13} aria-hidden="true" />
        <span>Al día</span>
      </p>
    );
  }

  const confirmando = estado === "confirmando";
  return (
    <div className="cmv2-confirmar" data-estado={estado} role="status">
      <span className="cmv2-confirmar-texto">
        <strong>
          {cambios != null && cambios > 0
            ? `${cambios} ${cambios === 1 ? "cambio" : "cambios"} sin confirmar`
            : "Cambios sin confirmar"}
        </strong>
        {/* Lo que está en juego: sin esto, «confirmar» parece un trámite. */}
        {enEspera > 0 ? (
          <em>
            {enEspera} {enEspera === 1 ? "criterio queda" : "criterios quedan"} en espera
          </em>
        ) : null}
      </span>
      <span className="cmv2-confirmar-acciones">
        {onDescartar ? (
          <button type="button" className="cmv2-confirmar-descartar" onClick={onDescartar} disabled={confirmando}>
            Descartar
          </button>
        ) : null}
        <button type="button" className="cmv2-confirmar-btn" onClick={onConfirmar} disabled={confirmando}>
          {confirmando ? <Loader2 size={13} aria-hidden="true" className="cmv2-confirmar-girando" /> : null}
          {confirmando ? "Confirmando…" : "Confirmar"}
        </button>
      </span>
    </div>
  );
}

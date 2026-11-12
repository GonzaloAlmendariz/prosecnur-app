import { Check, Loader2 } from "../../../../vendor/lucide-react";
import type { CargaReviewReconciliationExtra } from "../../../../api/client";
import { PanelDeMesa } from "../../../../components/procesamiento/PanelDeMesa";
import { PieConEfecto } from "../../../../components/procesamiento/PieConEfecto";
import { PulsoButton } from "../../../../components/PulsoButton";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { hayCambiosPorGuardar, incluidasAlGuardar } from "./comprobacionesModel";

/**
 * Lo que pasa al guardar la decisión sobre las columnas fuera del formulario
 * (prototipo "carga-revision", columna derecha): las que entran como variables
 * y las que quedan fuera, y el pie con el efecto y "Guardar".
 *
 * El prototipo ofrece una tercera salida, "Marcar como dato personal": el motor
 * todavía no la guarda (pedido M-C8), así que no se ofrece. Tampoco se puede
 * dejar una parte "por decidir": el motor guarda la decisión de todas las
 * columnas a la vez.
 */
export function DecisionDeColumnas({
  extras,
  marcadas,
  guardando,
  error,
  ocupado,
  onGuardar,
}: {
  extras: readonly CargaReviewReconciliationExtra[];
  marcadas: readonly string[];
  guardando: boolean;
  error: string;
  ocupado: boolean;
  onGuardar: (incluidas: string[]) => void;
}) {
  const entran = incluidasAlGuardar(extras, marcadas);
  const set = new Set(entran);
  const fuera = extras.filter((e) => !set.has(e.name)).map((e) => e.name);
  const cambia = hayCambiosPorGuardar(extras, marcadas);
  const pie = (
    <PieConEfecto
      className="pulso-revision-pie"
      cifra={entran.length}
      efecto={`${entran.length === 1 ? "columna entra" : "columnas entran"} a la base como variables; ${formatoConteo(fuera.length)} ${fuera.length === 1 ? "queda" : "quedan"} fuera.`}
    >
      <PulsoButton
        variant="primary"
        size="lg"
        onClick={() => onGuardar(entran)}
        disabled={guardando || ocupado || !cambia}
        title={cambia ? undefined : "La decisión guardada es esta misma"}
      >
        {guardando ? <Loader2 size={15} className="pulso-spin" aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
        Guardar
      </PulsoButton>
    </PieConEfecto>
  );
  return (
    <PanelDeMesa zona="decision" titulo="Decisión" pie={pie} etiquetaCuerpo="Decisión sobre las columnas">
      <div className="pulso-revision-decision-cuerpo" data-huecos-del-motor='"Marcar como dato personal" (M-C8)'>
        <section className="pulso-revision-bloque" aria-labelledby="pulso-revision-entran">
          <h4 id="pulso-revision-entran">Entran como variables</h4>
          {entran.length > 0 ? (
            <ul className="pulso-revision-nombres">{entran.map((n) => <li key={n}><code>{n}</code></li>)}</ul>
          ) : <p className="pulso-revision-nada">Ninguna</p>}
        </section>
        <section className="pulso-revision-bloque" aria-labelledby="pulso-revision-fuera">
          <h4 id="pulso-revision-fuera">Quedan fuera</h4>
          {fuera.length > 0 ? (
            <ul className="pulso-revision-nombres">{fuera.map((n) => <li key={n}><code>{n}</code></li>)}</ul>
          ) : <p className="pulso-revision-nada">Ninguna</p>}
        </section>
        {error ? <p className="pulso-revision-error" role="alert">{error}</p> : null}
      </div>
    </PanelDeMesa>
  );
}

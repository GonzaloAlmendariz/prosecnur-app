// Un hallazgo del cierre (CierreHallazgos): la lámina de origen, una de sus cifras (con el texto tal como sale en esa
// lámina) y la frase del analista, que nace vacía. Si la lámina ya no está o ya no tiene la cifra, la fila lo dice y no
// muestra una cifra inventada.

import { useId } from "react";
import { ArrowDown, ArrowUp, X } from "../../../../vendor/lucide-react";
import { PulsoSelect } from "../../../../components/PulsoSelect";
import { useCifrasDeOrigen } from "./useCifrasDeOrigen";
import {
  avisoHallazgo, cifraConUnidad, conCifra, conLamina, type HallazgoCierre, type OrigenCifras,
} from "./modeloCierre";

type Props = {
  hallazgo: HallazgoCierre;
  numero: number;
  origenes: readonly OrigenCifras[];
  scope: "active" | "consolidated";
  primero: boolean;
  ultimo: boolean;
  onCambio: (h: HallazgoCierre) => void;
  onMover: (d: -1 | 1) => void;
  onQuitar: () => void;
};

export function FilaCierre({ hallazgo: h, numero, origenes, scope, primero, ultimo, onCambio, onMover, onQuitar }: Props) {
  const id = useId();
  const origen = origenes.find((o) => o.id === h.lamina) ?? null;
  const { cifras, cargando, error } = useCifrasDeOrigen(origen, scope);
  const lista = cifras?.cifras ?? null;
  const aviso = avisoHallazgo(h, origenes, lista);
  const elegida = lista?.find((c) => c.clave === h.cifra) ?? null;
  const nombre = `hallazgo ${numero}`;
  const sinCifras = !!lista && lista.length === 0;

  return (
    <div className={`pulso-f6-hallazgo pulso-f6-cierre-fila${aviso ? " is-incompleto" : ""}`} role="group" aria-label={`Hallazgo ${numero}`}
      data-qa-geometry-member data-qa-geometry-group="graficos/f6-cierre-campos" data-qa-geometry-contract="intrinsic">
      <div className="pulso-f6-hallazgo-cabeza">
        <span className="pulso-f6-dato-rotulo">Hallazgo {numero}</span>
        <span className="pulso-f6-hallazgo-acciones">
          <button type="button" className="pulso-f6-icono-boton" aria-label={`Subir el ${nombre}`} disabled={primero} onClick={() => onMover(-1)}>
            <ArrowUp size={14} aria-hidden="true" />
          </button>
          <button type="button" className="pulso-f6-icono-boton" aria-label={`Bajar el ${nombre}`} disabled={ultimo} onClick={() => onMover(1)}>
            <ArrowDown size={14} aria-hidden="true" />
          </button>
          <button type="button" className="pulso-f6-icono-boton" aria-label={`Quitar el ${nombre}`} onClick={onQuitar}>
            <X size={14} aria-hidden="true" />
          </button>
        </span>
      </div>

      <div className="pulso-f6-campo">
        <span id={`${id}-lamina`} className="pulso-f6-hallazgo-rotulo">Lámina</span>
        <PulsoSelect size="sm" value={origen ? origen.id : undefined} describedBy={`${id}-lamina`} ariaLabel={`Lámina del ${nombre}`}
          placeholder={h.lamina && !origen ? "Elige otra lámina" : "Elige una lámina"} invalid={!!h.lamina && !origen}
          onValueChange={(v) => onCambio(conLamina(h, v))}
          options={origenes.map((o) => ({ value: o.id, label: o.nombre, textValue: o.nombre }))} />
      </div>

      <div className="pulso-f6-campo">
        <span id={`${id}-cifra`} className="pulso-f6-hallazgo-rotulo">Cifra</span>
        <PulsoSelect size="sm" value={elegida ? elegida.clave : undefined} describedBy={`${id}-cifra`} ariaLabel={`Cifra del ${nombre}`}
          disabled={!origen || cargando || sinCifras || !!error}
          placeholder={!origen ? "Primero elige la lámina" : cargando ? "Leyendo las cifras" : sinCifras ? "Esta lámina no dibujó cifras" : "Elige una cifra"}
          onValueChange={(v) => onCambio(conCifra(h, lista?.find((c) => c.clave === v) ?? null))}
          options={(lista ?? []).map((c) => ({
            value: c.clave,
            textValue: `${cifraConUnidad(c)} ${c.rotulo}`,
            label: (
              <span className="pulso-f6-cierre-opcion">
                <strong className="pulso-f6-cierre-cifra">{cifraConUnidad(c)}</strong>
                <span>{c.rotulo}</span>
              </span>
            ),
          }))} />
        {error && <span className="pulso-f6-dato-ayuda is-aviso" role="note">{error}</span>}
      </div>

      <div className="pulso-f6-campo">
        <label htmlFor={`${id}-texto`} className="pulso-f6-hallazgo-rotulo">Frase</label>
        <textarea id={`${id}-texto`} className="pulso-f6-input" rows={2} value={h.texto} aria-required="true"
          onChange={(e) => onCambio({ ...h, texto: e.target.value })} />
      </div>

      {aviso && <span className="pulso-f6-dato-ayuda is-aviso" role="note">{aviso}</span>}
    </div>
  );
}

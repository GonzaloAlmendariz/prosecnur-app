// Un hallazgo del cierre (CierreHallazgos): una cifra de una lámina de resumen, elegida con «Elegir cifra» (lámina y
// cifra en un solo control), y la frase del analista, que nace vacía. La cifra se muestra viva, leída de su lámina. Si la
// lámina ya no está o ya no tiene la cifra, la fila lo dice y no muestra una cifra inventada; si la cifra cambió desde
// que se eligió, también.

import { useId } from "react";
import { ArrowDown, ArrowUp, X } from "../../../../vendor/lucide-react";
import { ElegirCifra } from "./ElegirCifra";
import type { CifrasLeidas } from "./modeloElegirCifra";
import { avisoCifraCambio, avisoHallazgo, conCifraDe, type HallazgoCierre, type OrigenCifras } from "./modeloCierre";
import { PulsoButton } from "../../../../components/PulsoButton";

type Props = {
  hallazgo: HallazgoCierre;
  numero: number;
  origenes: readonly OrigenCifras[];
  cifrasPorOrigen: Readonly<Record<string, CifrasLeidas>>;
  primero: boolean;
  ultimo: boolean;
  onCambio: (h: HallazgoCierre) => void;
  onMover: (d: -1 | 1) => void;
  onQuitar: () => void;
};

export function FilaCierre({ hallazgo: h, numero, origenes, cifrasPorOrigen, primero, ultimo, onCambio, onMover, onQuitar }: Props) {
  const id = useId();
  const vivas = h.lamina ? cifrasPorOrigen[h.lamina] : undefined;
  const lista = vivas?.cifras ?? null;
  const aviso = avisoHallazgo(h, origenes, lista);
  const elegida = lista?.find((c) => c.clave === h.cifra) ?? null;
  const cambio = avisoCifraCambio(h, elegida);
  const nombre = `hallazgo ${numero}`;

  return (
    <div className={`pulso-f6-hallazgo pulso-f6-cierre-fila${aviso ? " is-incompleto" : ""}`} role="group" aria-label={`Hallazgo ${numero}`}
      data-qa-geometry-member data-qa-geometry-group="graficos/f6-cierre-campos" data-qa-geometry-contract="intrinsic">
      <div className="pulso-f6-hallazgo-cabeza">
        <span className="pulso-f6-dato-rotulo">Hallazgo {numero}</span>
        <span className="pulso-f6-hallazgo-acciones">
          <PulsoButton variant="icon" tone="quiet" size="sm" aria-label={`Subir el ${nombre}`} disabled={primero} onClick={() => onMover(-1)}>
            <ArrowUp aria-hidden="true" />
          </PulsoButton>
          <PulsoButton variant="icon" tone="quiet" size="sm" aria-label={`Bajar el ${nombre}`} disabled={ultimo} onClick={() => onMover(1)}>
            <ArrowDown aria-hidden="true" />
          </PulsoButton>
          <PulsoButton variant="icon" tone="quiet" size="sm" intent="remove" aria-label={`Quitar el ${nombre}`} onClick={onQuitar}>
            <X aria-hidden="true" />
          </PulsoButton>
        </span>
      </div>

      <div className="pulso-f6-campo">
        <span id={`${id}-cifra`} className="pulso-f6-hallazgo-rotulo">Cifra</span>
        <ElegirCifra fila={h.clave} nombre={nombre} origenes={origenes} cifrasPorOrigen={cifrasPorOrigen} lamina={h.lamina} clave={h.cifra}
          elegida={elegida} describedBy={`${id}-cifra`} invalid={!!h.lamina && !origenes.some((o) => o.id === h.lamina)}
          onElegir={(lamina, cifra) => onCambio(conCifraDe(h, lamina, cifra))} />
        {vivas?.error && <span className="pulso-f6-dato-ayuda is-aviso" role="note">{vivas.error}</span>}
      </div>

      <div className="pulso-f6-campo">
        <label htmlFor={`${id}-texto`} className="pulso-f6-hallazgo-rotulo">Frase</label>
        <textarea id={`${id}-texto`} className="pulso-f6-input" rows={2} value={h.texto} aria-required="true"
          onChange={(e) => onCambio({ ...h, texto: e.target.value })} />
      </div>

      {aviso && <span className="pulso-f6-dato-ayuda is-aviso" role="note">{aviso}</span>}
      {!aviso && cambio && <span className="pulso-f6-dato-ayuda is-aviso" role="note">{cambio}</span>}
    </div>
  );
}

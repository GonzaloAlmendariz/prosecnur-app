// La coincidencia de un par como chip («Idéntico», «Parecido», «Distinto»; coincidencia.ts). Sin par no hay chip.

import { ROTULO_COINCIDENCIA, textoPuntaje, type CoincidenciaDePar } from "./coincidencia";

export function ChipCoincidencia({ coincidencia }: { coincidencia: CoincidenciaDePar | null }) {
  if (!coincidencia) return <span className="pulso-f6-emp-sin" aria-label="Sin par">—</span>;
  return (
    <span className="pulso-f6-emp-chip" data-coincidencia={coincidencia.clase} title={textoPuntaje(coincidencia.puntaje)}>
      {ROTULO_COINCIDENCIA[coincidencia.clase]}
    </span>
  );
}

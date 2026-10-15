// «N de 6 barras» junto a la lista de preguntas o temas (tope de Gonzalo, 2026-10-14). Discreto mientras cabe; un plan
// anterior a la regla que ya pasa de seis lo dice con lo que hay que hacer.

import { excedeTope, laminasNecesarias, rotuloConteoBarras, type ConteoBarras } from "./topeBarras";

export function ConteoBarrasMultiapiladas({ conteo }: { conteo: ConteoBarras }) {
  const excede = excedeTope(conteo);
  return (
    <span className={`pulso-mapi-conteo${excede ? " is-excede" : ""}`} aria-live="polite">
      {rotuloConteoBarras(conteo)}
      {excede && `: divídela en ${laminasNecesarias(conteo.barras)} láminas.`}
    </span>
  );
}

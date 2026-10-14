import type { OpcionLista } from "./listasModel";

const MAX_VISIBLES = 8;

/** Opciones de una lista: código en mono + etiqueta. Acotadas para que las
 *  tarjetas pares conserven el mismo marco (C2). */
export function OpcionesChips({ opciones, max = MAX_VISIBLES }: { opciones: readonly OpcionLista[]; max?: number }) {
  const visibles = opciones.slice(0, max);
  const resto = opciones.length - visibles.length;
  return (
    <ul className="pulso-xf-listas-chips" aria-label={`${opciones.length} opciones`}>
      {visibles.map((opcion, i) => (
        <li key={`${opcion.codigo}-${i}`} className="pulso-xf-listas-chip" title={opcion.etiqueta || opcion.codigo}>
          <code>{opcion.codigo || "—"}</code>
          <span>{opcion.etiqueta || "Sin etiqueta"}</span>
        </li>
      ))}
      {resto > 0 ? (
        <li className="pulso-xf-listas-chip is-resto">+{resto} más</li>
      ) : null}
    </ul>
  );
}

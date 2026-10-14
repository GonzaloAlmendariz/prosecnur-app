import type { OpcionLista } from "./listasModel";

const MAX_VISIBLES = 8;

/** Opciones de una lista como tabla de dos columnas rotuladas: el CÓDIGO (lo
 *  que se guarda en la base) en una marca propia y la ETIQUETA (lo que lee quien
 *  responde) como texto. Pegarlos en un mismo chip («1 Masculino») hacía que el
 *  analista no distinguiera uno de otro. Acotadas para que las tarjetas pares
 *  conserven el mismo marco (C2). */
export function OpcionesChips({ opciones, max = MAX_VISIBLES }: { opciones: readonly OpcionLista[]; max?: number }) {
  const visibles = opciones.slice(0, max);
  const resto = opciones.length - visibles.length;
  return (
    <table className="pulso-xf-listas-opciones" aria-label={`${opciones.length} opciones`}>
      <thead>
        <tr>
          <th scope="col">Código</th>
          <th scope="col">Etiqueta</th>
        </tr>
      </thead>
      <tbody>
        {visibles.map((opcion, i) => (
          <tr key={`${opcion.codigo}-${i}`}>
            <td>
              <code className="pulso-xf-listas-codigo">{opcion.codigo || "—"}</code>
            </td>
            <td className="pulso-xf-listas-etiqueta" title={opcion.etiqueta || undefined}>
              {opcion.etiqueta || <span className="is-vacia">Sin etiqueta</span>}
            </td>
          </tr>
        ))}
        {resto > 0 ? (
          <tr className="is-resto">
            <td colSpan={2}>+{resto} {resto === 1 ? "opción más" : "opciones más"}</td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}

import { rotuloDeDato } from "./rotulosDeColumna";

/**
 * Las columnas que espera una pieza del contrato telefónico, con su rótulo.
 * Lo monta la tarjeta de cada fuente (universo, barrido, encuesta) del
 * page-file; vive aquí para que la lista pase por `rotuloDeDato` sin hacer
 * crecer ese archivo y para que el test de claves sin rótulo la alcance.
 */
export function ColumnasEsperadas({ columnas, pieza }: { columnas: readonly string[]; pieza: string }) {
  return (
    <div className="mon-phone-source-slot-tags" aria-label={`Columnas esperadas para ${pieza}`}>
      {columnas.map((columna) => <i key={columna}>{rotuloDeDato(columna) ?? columna}</i>)}
    </div>
  );
}

/**
 * La frase de la regla del hallazgo abierto: la del catálogo (M3), con cada
 * pregunta en su ficha teñida por tipo y cada valor en negrita. El lector de
 * pantalla oye la etiqueta de la pregunta, no el código pegado a ella.
 *
 * Las piezas van en un grupo declarado (C1): son fichas en línea, de ancho
 * intrínseco.
 */
import { FichaPregunta } from "../../../components/procesamiento/FichaPregunta";
import type { PiezaDelCatalogo } from "../../../api/validacionCatalogo";

export function FraseDelHallazgo({ piezas }: { piezas: readonly PiezaDelCatalogo[] }) {
  return (
    <span className="pulso-hz-frase-piezas" data-qa-geometry-group="validacion/hallazgos-frase" data-qa-geometry-contract="intrinsic">
      {piezas.map((p, i) => {
        if (p.tipo === "pregunta") {
          const etiqueta = p.etiqueta ?? p.codigo;
          return (
            <span key={i}>
              <span className="pulso-sr-only">{etiqueta}</span>
              <span aria-hidden="true">
                <FichaPregunta tipo={p.tipoPregunta} codigo={p.etiqueta ? p.codigo : undefined} etiqueta={etiqueta} />
              </span>
            </span>
          );
        }
        if (p.tipo === "valor") return <strong key={i} className="pulso-rl-valor">{p.valor}</strong>;
        return <span key={i}>{p.texto}</span>;
      })}
    </span>
  );
}

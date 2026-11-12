/**
 * La frase de una regla del catálogo (M3), con cada pregunta en su ficha
 * teñida por tipo y cada valor en negrita. Es la única narrativa de la regla:
 * la misma en la lista, en la ficha y, cuando la usen, en Hallazgos y Explorar.
 */
import { FichaPregunta } from "../../../../components/procesamiento/FichaPregunta";
import type { PiezaDelCatalogo } from "./modeloCatalogo";

export function FraseDelCatalogo({ piezas }: { piezas: readonly PiezaDelCatalogo[] }) {
  return (
    <>
      {piezas.map((p, i) => {
        if (p.tipo === "pregunta") {
          return (
            <FichaPregunta
              key={i}
              tipo={p.tipoPregunta}
              codigo={p.etiqueta ? p.codigo : undefined}
              etiqueta={p.etiqueta ?? p.codigo}
            />
          );
        }
        if (p.tipo === "valor") return <strong key={i} className="pulso-rl-valor">{p.valor}</strong>;
        return <span key={i}>{p.texto}</span>;
      })}
    </>
  );
}

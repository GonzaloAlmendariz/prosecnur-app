import type { ReactNode } from "react";
import type { EstadoDePestana } from "../../../components/procesamiento/CabeceraDePestana";
import type { CifraDePestana } from "../../../components/procesamiento/CifrasDePestana";
import { formatoConteo } from "../../../lib/formatoNumero";
import { CabeceraDeCodificacion } from "../CabeceraDeCodificacion";
import { cifrasDePreguntas, type Unidad } from "./modeloUnidades";

/**
 * La cabecera de Preguntas (prototipo): el estado ("1 por decidir"), las cifras por camino (se codifican y
 * no se codifican, sobre las unidades con texto) y, a la derecha, la pista del arrastre. El tercer camino
 * del prototipo, "Ya viene codificada" (D14), no existe todavía en el motor: queda como hueco declarado.
 */
export function CabeceraDePreguntas({ unidades, cargadas, baseActual }: {
  unidades: readonly Unidad[];
  /** Mientras llegan las preguntas no hay estado ni cifras. */
  cargadas: boolean;
  baseActual?: ReactNode;
}) {
  const c = cifrasDePreguntas(unidades);
  const estado: EstadoDePestana | null = !cargadas
    ? null
    : c.porDecidir > 0
      ? { tono: "parcial", texto: `${formatoConteo(c.porDecidir)} por decidir` }
      : c.conTexto > 0
        ? { tono: "listo", texto: "Decididas" }
        : null;
  const cifras: CifraDePestana[] = cargadas && c.conTexto > 0
    ? [
        { clave: "se-codifican", valor: formatoConteo(c.seCodifican), base: formatoConteo(c.conTexto), rotulo: c.seCodifican === 1 ? "se codifica" : "se codifican", rango: 1 },
        { clave: "no-se-codifican", valor: formatoConteo(c.noSeCodifican), base: formatoConteo(c.conTexto), rotulo: c.noSeCodifican === 1 ? "no se codifica" : "no se codifican" },
      ]
    : [];
  return (
    <CabeceraDeCodificacion
      pestana="organizar"
      estado={estado}
      cifras={cifras}
      pendientes='"Ya viene codificada" (D14): el motor todavía no declara ese camino, así que la tercera cifra por camino no existe'
      acciones={(
        <>
          <span className="pulso-preg-pista">Arrastra un texto sobre su pregunta cerrada para unirlos</span>
          {baseActual}
        </>
      )}
    />
  );
}

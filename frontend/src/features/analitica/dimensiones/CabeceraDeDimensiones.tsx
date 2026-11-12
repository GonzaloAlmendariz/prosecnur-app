// La cabecera de Analítica › Dimensiones (prototipo, `tabHeading` de "Analítica,
// Dimensiones"): antetítulo, título del catálogo, si los puntajes están
// calculados, las cifras de la estructura y, a la derecha, editarla o volver a
// calcularla.

import type { ReactNode } from "react";

import { CabeceraDePestana, type EstadoDePestana } from "../../../components/procesamiento/CabeceraDePestana";
import type { CifraDePestana } from "../../../components/procesamiento/CifrasDePestana";
import { formatoConteo } from "../../../lib/formatoNumero";
import { PROCESAMIENTO_PESTANAS } from "../../../lib/navegacion/catalogos/procesamiento";
import type { CifrasDeDimensiones } from "./modeloDeDimensiones";

export function cifrasDeLaCabecera(c: CifrasDeDimensiones): CifraDePestana[] {
  return [
    { clave: "indices", valor: formatoConteo(c.indices), rotulo: c.indices === 1 ? "índice" : "índices", rango: 1 },
    { clave: "bloques", valor: formatoConteo(c.bloques), rotulo: c.bloques === 1 ? "bloque" : "bloques" },
    {
      clave: "preguntas",
      valor: formatoConteo(c.preguntasEnBloque),
      ...(c.preguntasDeEscala ? { base: formatoConteo(c.preguntasDeEscala) } : {}),
      rotulo: c.preguntasEnBloque === 1 ? "pregunta de escala en un bloque" : "preguntas de escala en un bloque",
      titulo: "Preguntas de las listas de escala elegidas que entran en algún bloque",
      rango: 3,
    },
  ];
}

export function CabeceraDeDimensiones({ cifras, estado, acciones }: {
  cifras: CifraDePestana[];
  estado: EstadoDePestana | null;
  acciones?: ReactNode;
}) {
  const meta = PROCESAMIENTO_PESTANAS.analitica.find((p) => p.key === "dimensiones") ?? PROCESAMIENTO_PESTANAS.analitica[0];
  return (
    <CabeceraDePestana
      seccion="Analítica"
      titulo={meta.label}
      icono={meta.icon}
      estado={estado}
      cifras={cifras}
      ariaCifras="Cifras de los índices"
      className="dimensiones-cabecera"
      acciones={acciones}
    />
  );
}

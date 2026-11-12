// La cabecera de Analítica › Orden de categorías (prototipo, `tabHeading` de
// "Analítica, Categorías"): antetítulo "Analítica", título del catálogo, las
// cuatro cifras de las listas y, a la derecha, cómo se mueve una categoría.

import { CabeceraDePestana } from "../../../components/procesamiento/CabeceraDePestana";
import type { CifraDePestana } from "../../../components/procesamiento/CifrasDePestana";
import { formatoConteo } from "../../../lib/formatoNumero";
import { PROCESAMIENTO_PESTANAS } from "../../../lib/navegacion/catalogos/procesamiento";
import type { CifrasDeCategorias } from "./modeloDeCategorias";

export function cifrasDeLaCabecera(c: CifrasDeCategorias): CifraDePestana[] {
  return [
    { clave: "listas", valor: formatoConteo(c.listas), rotulo: c.listas === 1 ? "lista de respuesta" : "listas de respuesta", rango: 1 },
    { clave: "ordinales", valor: formatoConteo(c.ordinales), base: formatoConteo(c.listas), rotulo: c.ordinales === 1 ? "ordinal" : "ordinales" },
    {
      clave: "especiales",
      valor: formatoConteo(c.especialesEnUso),
      rotulo: c.especialesEnUso === 1 ? "código especial en uso" : "códigos especiales en uso",
      titulo: "Códigos como No sabe o No responde que alguien eligió en las preguntas del estudio",
      rango: 3,
    },
    {
      clave: "preguntas",
      valor: formatoConteo(c.preguntasConLista),
      base: formatoConteo(c.preguntas),
      rotulo: c.preguntasConLista === 1 ? "pregunta con lista" : "preguntas con lista",
      titulo: "Preguntas de opción única o múltiple sobre el total de variables del formulario",
    },
  ];
}

export function CabeceraDeCategorias({ cifras }: { cifras: CifraDePestana[] }) {
  const meta = PROCESAMIENTO_PESTANAS.analitica.find((p) => p.key === "orden") ?? PROCESAMIENTO_PESTANAS.analitica[0];
  return (
    <CabeceraDePestana
      seccion="Analítica"
      titulo={meta.label}
      icono={meta.icon}
      cifras={cifras}
      ariaCifras="Cifras de las listas de respuesta"
      className="categorias-cabecera"
      acciones={<span className="categorias-ayuda">Arrastra una categoría o usa Alt con las flechas</span>}
    />
  );
}

/**
 * Catálogo de métodos de resumen de «estudiantes por aula» (el divisor del
 * cálculo de aulas). Compartido por el selector global y los encabezados de
 * referencia de la tabla por facultad, para que etiqueta y explicación vivan en
 * un solo sitio. Nada de caja negra: cada método trae su ayuda de una línea.
 */
import type { ResumenEstAula } from "../../dominio";

export type MetodoEstAula = {
  id: ResumenEstAula;
  /** Etiqueta corta del selector. */
  label: string;
  /** Encabezado de la columna de referencia en la tabla. */
  columna: string;
  /** Explicación de una línea (tooltip "?"). */
  ayuda: string;
};

/**
 * Orden canónico (de menos a más conservador respecto del nº de aulas):
 * mediana · media · mín(med, media) · LI 95%. El último exprime más aulas.
 */
export const METODOS_EST_AULA: MetodoEstAula[] = [
  {
    id: "mediana",
    label: "Mediana",
    columna: "Mediana",
    ayuda: "Punto medio de elegibles por CH: robusto a colas, ignora los extremos.",
  },
  {
    id: "media",
    label: "Media",
    columna: "Media",
    ayuda: "Promedio de elegibles por CH: punto simple, sensible a aulas muy grandes o chicas.",
  },
  {
    id: "min_mediana_media",
    label: "mín(med, media)",
    columna: "mín(med, media)",
    ayuda: "Heurístico conservador: toma la menor de mediana y media, así deja algo más de aulas.",
  },
  {
    id: "li_bootstrap",
    label: "LI 95%",
    columna: "LI 95%",
    ayuda: "Cota inferior del IC 95% del bootstrap de la media: garantía de cobertura al 95%, el divisor más chico y por tanto más aulas.",
  },
];

/** Metadatos del método por id (siempre existe: la unión está cubierta). */
export function metodoEstAula(id: ResumenEstAula): MetodoEstAula {
  return METODOS_EST_AULA.find((m) => m.id === id) ?? METODOS_EST_AULA[2];
}

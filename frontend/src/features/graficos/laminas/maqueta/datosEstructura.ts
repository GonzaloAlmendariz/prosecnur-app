// Lo que la maqueta de una lámina de estructura informa (contrato de la maqueta, M6: «las láminas de estructura con la
// anatomía del recetario»; Gonzalo: la maqueta «te indica qué actores intervienen»). Puro: lee el payload de la lámina;
// `DibujoEstructura` lo pone en su geometría y, donde falta, deja el renglón gris (el vacío se ve).

import type { Slide } from "../../../../api/graficos";
import { leerIndice } from "../../indice/modeloIndice";
import { capitulosDelInforme } from "../../indice/requisitoIndice";
import { leerSlideMeta } from "../../slideMeta";
import { normalizeTechnicalRows } from "../../technicalRows";
import { actoresDeMeta, dimensionesDeMeta, type Actor } from "../contenidoEspecial/modeloActoresObjetivo";

export type DatosEstructura = {
  titulo: string | null;
  subtitulo: string | null;
  fecha: string | null;
  capitulos: string[];
  /** Subcapítulos de cada capítulo, alineados con `capitulos` (vacío si no tiene). */
  subcapitulos: string[][];
  numero: string | null;
  texto: string | null;
  actores: Actor[];
  dimensiones: string[];
  criterios: string[];
  contactos: string[];
};

const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
/** El texto del objetivo sin los `**` de negrita (la maqueta no los interpreta: sólo informa). */
const sinMarcas = (t: string | null) => (t ? t.replace(/\*\*/g, "") : null);

/**
 * @param informe Las láminas del informe: un índice sin capítulos propios lista los separadores de capítulo, como el
 *   motor (`.lam_indice_capitulos_del_plan`); sin ellas la maqueta del índice salía vacía (catálogo del recetario, M4).
 */
export function datosEstructura(slide: Pick<Slide, "tipo" | "payload">, informe: readonly Pick<Slide, "tipo" | "payload">[] = []): DatosEstructura {
  const p = (slide.payload ?? {}) as Record<string, unknown>;
  const meta = leerSlideMeta(slide);
  const indice = slide.tipo === "p_slide_indice" ? leerIndice(p).capitulos.filter((c) => c.titulo.trim()) : [];
  const delInforme = slide.tipo === "p_slide_indice" && !indice.length ? capitulosDelInforme(informe) : [];
  const capitulos = indice.length ? indice.map((c) => c.titulo.trim()) : delInforme;
  const subcapitulos = indice.length ? indice.map((c) => c.subcapitulos.map((x) => x.trim()).filter(Boolean)) : delInforme.map(() => []);
  return {
    titulo: texto(p.titulo),
    subtitulo: texto(p.subtitulo),
    fecha: texto(p.fecha),
    capitulos,
    subcapitulos,
    numero: texto(meta.numero) ?? texto(meta.rotulo),
    texto: sinMarcas(texto(p.texto)),
    actores: actoresDeMeta(meta).filter((a) => a.nombre.trim()),
    dimensiones: dimensionesDeMeta(meta).map((d) => d.trim()).filter(Boolean),
    criterios: slide.tipo === "p_slide_tabla_tecnica" ? normalizeTechnicalRows(p.filas).map((f) => f.criterio.trim()).filter(Boolean) : [],
    contactos: [p.correo, p.direccion, p.web].map(texto).filter((x): x is string => !!x),
  };
}

// Serie temporal de estados telefónicos — fotografías, no eventos.
//
// Regla de dominio que gobierna todo lo que se dibuje con estos estados:
//
//   La base de barrido tiene N casos y CADA CASO TIENE UN SOLO ESTADO en cada
//   momento. Cada actualización es una fotografía completa de esos mismos N
//   casos, así que el eje temporal no cuenta producción: cuenta cómo fueron
//   cambiando de estado los mismos casos. Si un día trae más de una
//   actualización, manda la última.
//
// Por qué esto no es un detalle de implementación: sumar los estados de dos
// fotografías cuenta el mismo caso dos veces. Un apilado construido como
// histograma de eventos —el reflejo natural cuando uno ve «estados por día»—
// produciría totales que crecen solos y una lectura falsa de avance.
//
// De aquí salen dos invariantes que el gráfico puede confiar:
//
//   1. Un punto por día, el de la última actualización de ese día.
//   2. El total de cada punto es estable e igual al tamaño de la base. Cuando
//      no lo es, la serie lo DECLARA en vez de dibujarlo: un total que se mueve
//      significa que la base cambió de tamaño o que la fuente mezcló cortes, y
//      las dos cosas hay que verlas, no suavizarlas.

import type { AcreditacionFamiliaLlamada } from "./AcreditacionEstadosLlamada";
import { acreditacionFamiliaDeclarada } from "./AcreditacionEstadosLlamada";
import type { AcreditacionDeclaracionEstado } from "./AcreditacionEstadosLlamada";

/** Una lectura cruda: un estado del cliente, con su conteo y su marca de tiempo. */
export type AcreditacionLecturaDeEstado = {
  /** Fecha u hora del corte. Se acepta ISO o `YYYY-MM-DD`. */
  cutAt: string;
  estado: string;
  casos: number;
};

/** La fotografía de un día: reparto de los N casos entre familias. */
export type AcreditacionFotografia = {
  dia: string;
  /** Marca completa de la actualización que ganó, para trazabilidad. */
  cutAt: string;
  porFamilia: Record<AcreditacionFamiliaLlamada, number>;
  total: number;
};

export type AcreditacionSerieDeEstados = {
  fotografias: AcreditacionFotografia[];
  /**
   * `true` cuando los totales no coinciden entre días.
   *
   * No se corrige ni se normaliza: significa que la base cambió de tamaño o que
   * la fuente mezcló cortes distintos, y eso es información, no ruido.
   */
  totalInestable: boolean;
};

function familiasVacias(): Record<AcreditacionFamiliaLlamada, number> {
  return { efectivo: 0, sin_contacto: 0, numero_invalido: 0, rechazo: 0, sin_barrer: 0, otro: 0 };
}

/** El día de una marca de tiempo, sin depender de la zona horaria del cliente. */
function diaDe(cutAt: string): string {
  const texto = String(cutAt ?? "").trim();
  const iso = texto.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const parsed = new Date(texto);
  if (Number.isNaN(parsed.getTime())) return "";
  const mes = String(parsed.getMonth() + 1).padStart(2, "0");
  const dia = String(parsed.getDate()).padStart(2, "0");
  return `${parsed.getFullYear()}-${mes}-${dia}`;
}

/**
 * Construye la serie de fotografías a partir de lecturas crudas.
 *
 * `declaraciones` son las confirmaciones del usuario: qué familia le toca a
 * cada etiqueta cruda. La misma que gobierna el definidor de estados, para que
 * el gráfico y la tabla no puedan discrepar.
 */
export function acreditacionSerieDeEstados(
  lecturas: readonly AcreditacionLecturaDeEstado[],
  declaraciones: readonly AcreditacionDeclaracionEstado[] = [],
): AcreditacionSerieDeEstados {
  // Primero se agrupa por día quedándose con la ÚLTIMA actualización. Se
  // resuelve antes de sumar nada: si se acumulara primero, dos cortes del
  // mismo día ya habrían duplicado los casos.
  const ultimaPorDia = new Map<string, string>();
  for (const lectura of lecturas) {
    const dia = diaDe(lectura.cutAt);
    if (!dia) continue;
    const previa = ultimaPorDia.get(dia);
    if (!previa || String(lectura.cutAt) > previa) ultimaPorDia.set(dia, String(lectura.cutAt));
  }

  const porDia = new Map<string, AcreditacionFotografia>();
  for (const lectura of lecturas) {
    const dia = diaDe(lectura.cutAt);
    if (!dia) continue;
    // Solo cuenta la fotografía ganadora del día; las demás se descartan
    // enteras, no se promedian ni se suman.
    if (ultimaPorDia.get(dia) !== String(lectura.cutAt)) continue;
    const casos = Number(lectura.casos);
    if (!Number.isFinite(casos) || casos <= 0) continue;

    const foto = porDia.get(dia) ?? { dia, cutAt: String(lectura.cutAt), porFamilia: familiasVacias(), total: 0 };
    const familia = acreditacionFamiliaDeclarada(lectura.estado, declaraciones).familia;
    foto.porFamilia[familia] += casos;
    foto.total += casos;
    porDia.set(dia, foto);
  }

  const fotografias = [...porDia.values()].sort((a, b) => a.dia.localeCompare(b.dia));
  const totales = new Set(fotografias.map((foto) => foto.total));

  return { fotografias, totalInestable: totales.size > 1 };
}

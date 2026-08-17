/**
 * Los seis pasos de cada facultad, con la columna del estudio anterior.
 *
 * Es la cadena que Gonzalo pidió ver entera y por facultad: cuántos alumnos se
 * calcularon, cuánta es la muestra, cuántas aulas del catálogo pasan los
 * criterios, cuántos alumnos hay por curso-horario, cuántas aulas hacen falta y
 * si quedan reemplazos. Medida para LETRAS Y CIENCIAS HUMANAS: 225 alumnos →
 * cuota 26 → 12 de 149 aulas → p25 de 15 → 4 titulares → 8 sobrantes, o sea
 * **2 reservas por titular**. Y el contraste que importa: EE.GG. LETRAS
 * necesita 49 y tiene 12.
 *
 * Este módulo sólo proyecta cifras que R ya publicó y las enfrenta con las del
 * histórico. No recalcula nada: si un dato no está, viaja `null` y la ficha lo
 * dice, porque un 0 se leería como medido.
 */
import type {
  CalcMuestraAulasEstrato,
  CalcMuestraReferenciaCriterios,
  CalcMuestraReferenciaCriteriosFila,
} from "../../../../api/calcMuestra";

export type PasoFicha = {
  n: number;
  titulo: string;
  hoy: number | null;
  antes: number | null;
  /** Texto corto que explica de dónde sale la cifra de hoy. */
  detalle: string;
};

export type FichaFacultad = {
  facultad: string;
  pasos: PasoFicha[];
  /** Reservas por titular que la facultad puede sostener, y las que pide el
   *  diseño. `null` cuando el motor no publicó el margen. */
  reservasSostenibles: number | null;
  reservasPedidas: number | null;
  aviso: string;
};

/** Misma normalización que el motor: sin acentos, sin mayúsculas, sin espacios. */
export function claveFicha(valor: string): string {
  return valor
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function buscarHistorico(
  referencia: CalcMuestraReferenciaCriterios | null,
  facultad: string,
): CalcMuestraReferenciaCriteriosFila | null {
  if (!referencia) return null;
  const k = claveFicha(facultad);
  return referencia.por_facultad.find((f) => claveFicha(f.facultad) === k) ?? null;
}

export function fichaDeFacultad(
  fila: CalcMuestraAulasEstrato,
  aulasDelCatalogo: number | null,
  aulasElegibles: number | null,
  alumnosPorCh: number | null,
  referencia: CalcMuestraReferenciaCriterios | null,
): FichaFacultad {
  const h = buscarHistorico(referencia, fila.estrato);
  const m = fila.margen ?? null;
  const cuota = Number.isFinite(fila.cuota) ? fila.cuota : null;
  return {
    facultad: fila.estrato,
    reservasSostenibles: m?.reservas_sostenibles ?? null,
    reservasPedidas: m?.reservas_pedidas ?? null,
    aviso: m?.aviso ?? "",
    pasos: [
      {
        n: 1, titulo: "Población",
        hoy: Number.isFinite(fila.N) ? fila.N : null, antes: h?.poblacion ?? null,
        detalle: "alumnos únicos de esta facultad",
      },
      {
        n: 2, titulo: "Muestra",
        hoy: cuota, antes: h?.cuota ?? null,
        detalle: "cuota que le toca del total",
      },
      {
        n: 3, titulo: "Aulas que pasan los criterios",
        hoy: aulasElegibles, antes: h?.aulas_sorteadas ?? null,
        detalle: aulasDelCatalogo != null ? `de ${aulasDelCatalogo} en el catálogo` : "en el marco",
      },
      {
        n: 4, titulo: "Alumnos por curso-horario",
        hoy: alumnosPorCh, antes: h?.alumnos_por_ch ?? null,
        detalle: "el estadístico que dimensiona",
      },
      {
        n: 5, titulo: "Aulas necesarias",
        hoy: m?.aulas_requeridas ?? (Number.isFinite(fila.aulas_base) ? fila.aulas_base : null),
        antes: h?.aulas_titulares ?? null,
        detalle: "titulares que hay que visitar",
      },
      {
        n: 6, titulo: "Aulas que sobran",
        hoy: m?.aulas_sobrantes ?? null, antes: null,
        detalle: "de ellas salen los reemplazos",
      },
    ],
  };
}

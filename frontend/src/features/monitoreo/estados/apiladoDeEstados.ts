/**
 * Apilado de estados telefónicos por día.
 *
 * Qué dibuja, con precisión, porque de aquí depende que el gráfico no mienta:
 * el bloque `estatus_dia` es una PARTICIÓN de los casos barridos —cada caso
 * aparece una sola vez, en el día de su última actualización y con su estado
 * final—. Así que cada barra dice **qué estados quedaron registrados ese día**,
 * no cómo estaba la base entera ese día.
 *
 * Por eso no se acumula. Acumular daría "casos ya barridos hasta el día D,
 * clasificados por su estado FINAL", que se parece a una fotografía pero no lo
 * es: un caso actualizado el día 5 pudo estar en otro estado el día 3, y el
 * corte no guarda ese estado intermedio. Dibujar el acumulado como si fuera la
 * evolución real sería inventar una historia que el dato no tiene.
 *
 * Los colores salen del definidor de estados: la familia que el usuario
 * confirmó manda sobre la heurística, y el color declarado sobre el de fábrica.
 * Gráfico y tabla no pueden discrepar porque leen la misma declaración.
 */

import { contar } from "../fuentes/vocabulario";
import type { AcreditacionPhoneDailyStatusSeries } from "../profiles/acreditacion/AcreditacionPhoneDailyTrend";
import {
  ACREDITACION_ORDEN_FAMILIAS,
  acreditacionColorDeFamilia,
  acreditacionEtiquetaDeFamilia,
  acreditacionFamiliaDeclarada,
  type AcreditacionDeclaracionEstado,
  type AcreditacionFamiliaLlamada,
} from "./familiasDeLlamada";

export type SegmentoApilado = {
  familia: AcreditacionFamiliaLlamada;
  etiqueta: string;
  color: string;
  casos: number;
  /** Porcentaje sobre el total del día, para la altura del segmento. */
  porcentaje: number;
  /** Estados crudos que cayeron en esta familia ese día, para el hover. */
  crudos: string[];
};

export type DiaApilado = {
  dia: string;
  etiqueta: string;
  etiquetaEje: string;
  total: number;
  segmentos: SegmentoApilado[];
};

export type ApiladoPorDia = {
  dias: DiaApilado[];
  /** Mayor total diario; escala las alturas sin aplastar los días flojos. */
  maximo: number;
  /** Familias presentes en todo el periodo, en orden canónico, para la leyenda. */
  familias: { familia: AcreditacionFamiliaLlamada; etiqueta: string; color: string; casos: number }[];
  total: number;
};

export function construirApiladoDeEstados(
  series: readonly AcreditacionPhoneDailyStatusSeries[],
  declaraciones: readonly AcreditacionDeclaracionEstado[] = [],
): ApiladoPorDia {
  const porDia = new Map<string, {
    etiqueta: string;
    etiquetaEje: string;
    /** Para ordenar por tiempo real: la etiqueta cruda puede ser "3 jun". */
    orden: number;
    porFamilia: Map<AcreditacionFamiliaLlamada, { casos: number; crudos: string[] }>;
  }>();

  series.forEach((serie) => {
    const familia = acreditacionFamiliaDeclarada(serie.label, declaraciones).familia;
    serie.points.forEach((punto) => {
      // Sin fecha no hay barra: inventar un día ficticio desplazaría el resto.
      if (!punto.date || punto.value <= 0) return;
      const dia = punto.rawLabel;
      const entrada = porDia.get(dia) ?? {
        etiqueta: punto.label,
        etiquetaEje: punto.axisLabel || punto.label,
        orden: punto.date.getTime(),
        porFamilia: new Map(),
      };
      const acumulado = entrada.porFamilia.get(familia) ?? { casos: 0, crudos: [] };
      acumulado.casos += punto.value;
      if (!acumulado.crudos.includes(serie.label)) acumulado.crudos.push(serie.label);
      entrada.porFamilia.set(familia, acumulado);
      porDia.set(dia, entrada);
    });
  });

  const dias: DiaApilado[] = [...porDia.entries()]
    .sort((a, b) => a[1].orden - b[1].orden)
    .map(([dia, entrada]) => {
      const total = [...entrada.porFamilia.values()].reduce((suma, item) => suma + item.casos, 0);
      const segmentos = ACREDITACION_ORDEN_FAMILIAS
        .map((familia) => {
          const item = entrada.porFamilia.get(familia);
          if (!item?.casos) return null;
          return {
            familia,
            etiqueta: acreditacionEtiquetaDeFamilia(familia),
            color: acreditacionColorDeFamilia(familia, declaraciones),
            casos: item.casos,
            porcentaje: total > 0 ? (item.casos / total) * 100 : 0,
            crudos: item.crudos,
          };
        })
        .filter((segmento): segmento is SegmentoApilado => segmento != null);
      return { dia, etiqueta: entrada.etiqueta, etiquetaEje: entrada.etiquetaEje, total, segmentos };
    });

  const acumuladoPorFamilia = new Map<AcreditacionFamiliaLlamada, number>();
  dias.forEach((dia) => dia.segmentos.forEach((segmento) => {
    acumuladoPorFamilia.set(segmento.familia, (acumuladoPorFamilia.get(segmento.familia) ?? 0) + segmento.casos);
  }));

  const familias = ACREDITACION_ORDEN_FAMILIAS
    .filter((familia) => (acumuladoPorFamilia.get(familia) ?? 0) > 0)
    .map((familia) => ({
      familia,
      etiqueta: acreditacionEtiquetaDeFamilia(familia),
      color: acreditacionColorDeFamilia(familia, declaraciones),
      casos: acumuladoPorFamilia.get(familia) ?? 0,
    }));

  return {
    dias,
    maximo: Math.max(1, ...dias.map((dia) => dia.total)),
    familias,
    total: dias.reduce((suma, dia) => suma + dia.total, 0),
  };
}

/**
 * Resumen de un día para el hover: la fecha, cuántos casos y su reparto.
 *
 * Se lee en la cabecera del gráfico, no en un tooltip flotante: el `title`
 * nativo tarda cerca de un segundo y no sigue al puntero, y las franjas más
 * finas miden 4 px. Con el foco puesto en el día entero, apuntar es fácil y el
 * texto aparece siempre en el mismo sitio.
 */
/** La fecha y su volumen: «15 junio · 75 casos». El reparto lo pone la leyenda. */
export function tituloDelDia(dia: DiaApilado): string {
  return `${dia.etiqueta} · ${contar(dia.total, "caso", "casos")}`;
}

/** Lo mismo con el reparto detrás. Para lectores de pantalla, que no ven la leyenda. */
export function resumenDelDia(dia: DiaApilado): string {
  const reparto = dia.segmentos
    .map((segmento) => `${segmento.etiqueta} ${segmento.casos.toLocaleString("es-PE")}`)
    .join(" · ");
  // `contar` y no una plantilla propia: un día de un solo caso decía «1 casos».
  const cabeza = tituloDelDia(dia);
  return reparto ? `${cabeza} · ${reparto}` : cabeza;
}

/** Texto del hover de un segmento: qué familia, cuántos casos y de qué estados. */
export function detalleDeSegmento(dia: DiaApilado, segmento: SegmentoApilado): string {
  const parte = `${segmento.etiqueta}: ${segmento.casos.toLocaleString("es-PE")} de ${dia.total.toLocaleString("es-PE")}`;
  // Un crudo que se llama igual que su familia no aporta nada entre paréntesis.
  const detalle = segmento.crudos.filter(
    (crudo) => crudo.trim().toLocaleLowerCase("es") !== segmento.etiqueta.toLocaleLowerCase("es"),
  );
  if (!detalle.length) return `${dia.etiqueta} · ${parte}`;
  return `${dia.etiqueta} · ${parte} (${detalle.join(", ")})`;
}

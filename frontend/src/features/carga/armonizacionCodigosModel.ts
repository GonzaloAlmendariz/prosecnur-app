// Qué códigos lista el editor de armonización para una base, y de dónde salen
// sus casos (F4).
//
// Hay tres fuentes, en este orden:
//
// 1. el preview del backend, que cuenta los casos con la escala GUARDADA;
// 2. la lista de opciones del instrumento, sin conteos;
// 3. los valores observados en la data de la base (`/api/carga/codigos-observados`),
//    con su conteo sin ponderar. Entra cuando no hay preview y el instrumento no
//    trae lista: una numérica como `anio_ingreso` (2007–2024, sin etiquetas) se
//    ve con sus valores desde la primera apertura, sin guardar antes una escala.
//
// Una variable de texto libre no se lista: se dice en una línea que no es
// comparable por categorías.

import type { CodigosObservados, TipoCodigosObservados } from "../../api/codigosObservados";
import { ordenarCodigos } from "./codigosObservadosModel";

export type CodigoBase = { codigo: string; etiqueta: string | null; n: number | null };

export type ObservadosBase =
  | { estado: "leyendo" }
  | {
    estado: "listo";
    tipo: TipoCodigosObservados;
    codigos: CodigoBase[];
    nSinDato: number;
    truncado: boolean;
  }
  | { estado: "error"; mensaje: string };

export type CargaBase =
  | { tipo: "cargando" }
  /** Conteos reales desde el preview, con lo guardado. */
  | { tipo: "listo"; codigos: CodigoBase[]; nTotal: number }
  /**
   * Sin preview: la lista del instrumento y el porqué, más los valores
   * observados en la data. La lista del instrumento se deriva al pintar porque
   * el catálogo puede llegar después.
   */
  | { tipo: "instrumento"; motivo: string; observados: ObservadosBase };

export function observadosDesde(d: CodigosObservados): ObservadosBase {
  return {
    estado: "listo",
    tipo: d.tipo,
    codigos: d.tipo === "texto"
      ? []
      // Años y otros enteros en orden numérico, como los lee quien mapea.
      : ordenarCodigos(d.codigos).map((c) => ({ codigo: c.codigo, etiqueta: c.etiqueta || null, n: c.n })),
    nSinDato: d.n_sin_dato,
    truncado: d.truncado,
  };
}

/** Pone los observados de una base; no pisa un preview que llegó antes. */
export function conObservados(
  cargas: Record<string, CargaBase>,
  base: string,
  observados: ObservadosBase,
): Record<string, CargaBase> {
  const actual = cargas[base];
  if (!actual || actual.tipo !== "instrumento") return cargas;
  return { ...cargas, [base]: { ...actual, observados } };
}

export type FuenteCodigos = "cargando" | "preview" | "instrumento" | "observados" | "texto" | "sin-lectura";

export type CodigosDeBase = {
  fuente: FuenteCodigos;
  codigos: CodigoBase[];
  /** Los códigos traen casos: el resumen puede decir si se pierden. */
  conConteos: boolean;
  /** Por qué no hay conteo con la escala, si corresponde decirlo. */
  aviso: string | null;
  /** De dónde salen los casos cuando no es de lo guardado. */
  nota: string | null;
  /** Lo que ocupa el lugar de la tabla cuando no hay códigos (C3, C5). */
  vacio: string;
};

const VACIO_SIN_CODIGOS = "La variable no tiene lista de opciones ni valores observados en esta base.";

function plural(n: number, uno: string, varios: string): string {
  return n === 1 ? `1 ${uno}` : `${n} ${varios}`;
}

/** Nota de los observados: el conteo es de la data, no del mapa guardado. */
export function notaObservados(
  base: string,
  observados: Extract<ObservadosBase, { estado: "listo" }>,
  hayGuardado: boolean,
): string {
  const partes = [
    hayGuardado
      ? `Los casos se cuentan en la data de ${base}, no con la escala guardada.`
      : `Los casos se cuentan en la data de ${base}: todavía no hay una escala guardada.`,
  ];
  if (observados.nSinDato > 0) partes.push(`${plural(observados.nSinDato, "caso", "casos")} sin dato.`);
  if (observados.truncado) partes.push("La base tiene más valores de los que se listan.");
  return partes.join(" ");
}

export function textoVariableTexto(base: string, variable: string): string {
  return `«${variable}» es texto libre en ${base}: no es una variable comparable por categorías.`;
}

/**
 * Los códigos que el editor lista para una base. `instrumento` es la lista de
 * opciones del catálogo (puede venir vacía); `hayGuardado` dice si la fila ya
 * tiene una armonización guardada.
 */
export function codigosDeBase(
  carga: CargaBase | undefined,
  instrumento: readonly CodigoBase[],
  base: string,
  variable: string,
  hayGuardado: boolean,
): CodigosDeBase {
  const vista = (parcial: Partial<CodigosDeBase> & Pick<CodigosDeBase, "fuente">): CodigosDeBase => ({
    codigos: [],
    conConteos: false,
    aviso: null,
    nota: null,
    vacio: VACIO_SIN_CODIGOS,
    ...parcial,
  });
  if (!carga || carga.tipo === "cargando") return vista({ fuente: "cargando" });
  if (carga.tipo === "listo") return vista({ fuente: "preview", codigos: carga.codigos, conConteos: true });
  if (instrumento.length > 0) {
    return vista({ fuente: "instrumento", codigos: [...instrumento], aviso: carga.motivo });
  }
  const obs = carga.observados;
  if (obs.estado === "leyendo") return vista({ fuente: "cargando" });
  if (obs.estado === "error") {
    // C5: desconexión, no vacío. Sin esta rama se afirmaría que la base no
    // tiene valores cuando sólo no se pudieron leer.
    return vista({
      fuente: "sin-lectura",
      aviso: carga.motivo,
      vacio: `No se pudieron leer los valores de ${base}: ${obs.mensaje}`,
    });
  }
  if (obs.tipo === "texto") {
    return vista({ fuente: "texto", vacio: textoVariableTexto(base, variable) });
  }
  return vista({
    fuente: "observados",
    codigos: obs.codigos,
    conConteos: obs.codigos.length > 0,
    nota: obs.codigos.length > 0 ? notaObservados(base, obs, hayGuardado) : null,
  });
}

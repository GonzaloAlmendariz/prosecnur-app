// Lógica pura del panel «Base preparada fuera de la plataforma» (ADR 0100, P2 y
// Enmienda 1 / P2b): casos retirados y variables retiradas.
//
// De los casos se muestra el agregado: recibidas, retiradas fuera y cargadas,
// más el conteo por categoría. Los identificadores de las encuestas retiradas
// nunca llegan al frontend.

import type {
  OrigenExterno,
  OrigenExternoEstado,
  OrigenExternoMotivoVariable,
} from "../../api/cargaOrigenExterno";

/** Motivo elegido por variable; vacío = sin elegir (no se declara). */
export type MotivosBorrador = Record<string, OrigenExternoMotivoVariable | "">;

export type OrigenExternoBorrador = {
  archivo: File | null;
  /** Texto tal como se escribe; vacío = que el backend la deduzca. */
  recibidas: string;
  script: string;
  version: string;
  motivos: MotivosBorrador;
};

export const BORRADOR_VACIO: OrigenExternoBorrador = {
  archivo: null,
  recibidas: "",
  script: "",
  version: "",
  motivos: {},
};

export const ROTULO_MOTIVO: Record<OrigenExternoMotivoVariable, string> = {
  metadato: "Metadato",
  no_va_al_cliente: "No va al cliente",
  otra: "Otra",
};

/**
 * Motivo con el que arranca cada variable faltante: el ya declarado si lo hay;
 * si no, la sugerencia del backend (`metadato`); si no, sin elegir.
 */
export function motivosIniciales(datos: OrigenExterno): MotivosBorrador {
  const declarados = new Map(
    (datos.bloque?.variables_retiradas ?? []).map((item) => [item.variable, item.motivo] as const),
  );
  const motivos: MotivosBorrador = {};
  for (const faltante of datos.variables_faltantes) {
    motivos[faltante.variable] = declarados.get(faltante.variable) ?? faltante.motivo_sugerido;
  }
  return motivos;
}

export function borradorDesde(datos: OrigenExterno): OrigenExternoBorrador {
  return { ...BORRADOR_VACIO, motivos: motivosIniciales(datos) };
}

/** Sólo las variables con motivo elegido: es lo que viaja en `variables_motivo`. */
export function motivosElegidos(
  motivos: MotivosBorrador,
): Record<string, OrigenExternoMotivoVariable> {
  const elegidos: Record<string, OrigenExternoMotivoVariable> = {};
  for (const [variable, motivo] of Object.entries(motivos)) {
    if (motivo) elegidos[variable] = motivo;
  }
  return elegidos;
}

export type RecibidasLeidas =
  | { ok: true; valor: number | null }
  | { ok: false; mensaje: string };

/**
 * Lee las recibidas antes del script. Vacío es válido (se deduce). Acepta los
 * separadores de miles habituales (espacio, coma o punto entre grupos de tres).
 */
export function leerRecibidas(textoCrudo: string): RecibidasLeidas {
  const limpio = textoCrudo.trim();
  if (!limpio) return { ok: true, valor: null };
  if (!/^\d{1,3}([\s,.  ]?\d{3})*$/u.test(limpio)) {
    return { ok: false, mensaje: "Escribe un número entero de encuestas, sin decimales." };
  }
  const valor = Number(limpio.replace(/[\s,.  ]/gu, ""));
  if (!Number.isSafeInteger(valor)) {
    return { ok: false, mensaje: "Escribe un número entero de encuestas, sin decimales." };
  }
  return { ok: true, valor };
}

const EXTENSIONES = /\.(xlsx|xls|csv)$/iu;

export function esListaExclusiones(nombre: string): boolean {
  return EXTENSIONES.test(nombre.trim());
}

/** Qué falta para poder declarar; vacío cuando se puede. */
export function motivoNoDeclarable(borrador: OrigenExternoBorrador): string {
  if (borrador.archivo && !esListaExclusiones(borrador.archivo.name)) {
    return "La lista de casos retirados tiene que ser un xlsx o un csv.";
  }
  const recibidas = leerRecibidas(borrador.recibidas);
  if (!recibidas.ok) return recibidas.mensaje;
  const hayVariables = Object.keys(motivosElegidos(borrador.motivos)).length > 0;
  if (!borrador.archivo && !hayVariables) {
    return "No hay nada que declarar: elige la lista de casos retirados o el motivo de alguna variable.";
  }
  return "";
}

/** La cadena de casos se muestra si se retiraron casos, o si la declaración no retiró nada (la de siempre). */
export function muestraCadenaCasos(datos: OrigenExterno): boolean {
  const bloque = datos.bloque;
  if (!bloque) return false;
  return (datos.resumen?.excluidas ?? bloque.n_excluidas) > 0 || totalVariablesRetiradas(datos) === 0;
}

export function totalVariablesRetiradas(datos: OrigenExterno): number {
  if (!datos.bloque) return 0;
  return datos.resumen?.variables_retiradas.total ?? datos.bloque.n_variables_retiradas;
}

export function fraseVariablesRetiradas(n: number): string {
  return `${formatoEntero(n)} ${n === 1 ? "variable retirada" : "variables retiradas"}`;
}

export type MotivoDesglose = { motivo: OrigenExternoMotivoVariable; rotulo: string; valor: string };

export function desgloseVariables(datos: OrigenExterno): MotivoDesglose[] {
  return (datos.resumen?.variables_retiradas.por_motivo ?? []).map((fila) => ({
    motivo: fila.motivo,
    rotulo: ROTULO_MOTIVO[fila.motivo],
    valor: formatoEntero(fila.n),
  }));
}

export function formatoEntero(n: number | null): string {
  return n == null ? "—" : n.toLocaleString("es-PE");
}

export type TramoOrigen = {
  clave: "recibidas" | "retiradas" | "cargadas";
  rotulo: string;
  valor: string;
  nota: string;
};

/**
 * «Recibidas 3 327 → retiradas fuera 9 → cargadas 3 318». Las cifras salen del
 * resumen; si falta, del bloque.
 */
export function tramosOrigen(datos: OrigenExterno): TramoOrigen[] {
  const { bloque, resumen } = datos;
  if (!bloque) return [];
  const recibidas = resumen?.recibidas ?? bloque.n_recibidas;
  const excluidas = resumen?.excluidas ?? bloque.n_excluidas;
  const entregadas = resumen?.entregadas ?? bloque.n_entregadas;
  return [
    {
      clave: "recibidas",
      rotulo: "Recibidas",
      valor: formatoEntero(recibidas),
      nota: bloque.n_recibidas_deducida ? "deducidas: cargadas más retiradas" : "",
    },
    { clave: "retiradas", rotulo: "Retiradas fuera", valor: formatoEntero(excluidas), nota: "" },
    { clave: "cargadas", rotulo: "Cargadas", valor: formatoEntero(entregadas), nota: "" },
  ];
}

/** La misma cadena en una sola línea, para el nombre accesible. */
export function cadenaOrigenEnLlano(datos: OrigenExterno): string {
  const tramos = tramosOrigen(datos);
  if (!tramos.length) return "";
  return tramos
    .map((tramo, index) => `${index === 0 ? tramo.rotulo : tramo.rotulo.toLowerCase()} ${tramo.valor}`)
    .join(" → ");
}

export function rotuloEstado(estado: OrigenExternoEstado): string {
  if (estado === "vigente") return "Declarada";
  if (estado === "otra_base") return "Otra base";
  return "Sin declarar";
}

export function procedenciaScript(datos: OrigenExterno): string {
  const bloque = datos.bloque;
  if (!bloque) return "";
  const partes = [bloque.script, bloque.version ? `versión ${bloque.version}` : ""].filter(Boolean);
  return partes.join(" · ");
}

/**
 * Las variables retiradas que no salen en los entregables: las del bloque
 * guardado con motivo Metadato o No va al cliente, más las que el último POST
 * agregó. Leerlas sólo del POST las hacía desaparecer al recargar.
 */
export function variablesExcluidasDeLaDeclaracion(datos: OrigenExterno): string[] {
  const delBloque = (datos.bloque?.variables_retiradas ?? [])
    .filter((v) => v.motivo === "metadato" || v.motivo === "no_va_al_cliente")
    .map((v) => v.variable);
  return Array.from(new Set([...delBloque, ...datos.variables_excluidas_agregadas]));
}

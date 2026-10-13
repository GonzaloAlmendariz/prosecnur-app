// Lógica pura del panel «Depuración hecha fuera» (ADR 0100, P2).
//
// Lo que se muestra es el agregado: recibidas, retiradas fuera y cargadas, más
// el conteo por categoría. Los identificadores de las encuestas excluidas
// nunca llegan al frontend.

import type { OrigenExterno, OrigenExternoEstado } from "../../api/cargaOrigenExterno";

export type OrigenExternoBorrador = {
  archivo: File | null;
  /** Texto tal como se escribe; vacío = que el backend la deduzca. */
  recibidas: string;
  script: string;
  version: string;
};

export const BORRADOR_VACIO: OrigenExternoBorrador = {
  archivo: null,
  recibidas: "",
  script: "",
  version: "",
};

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
  if (!borrador.archivo) return "Elige la lista de exclusiones (xlsx o csv).";
  if (!esListaExclusiones(borrador.archivo.name)) {
    return "La lista de exclusiones tiene que ser un xlsx o un csv.";
  }
  const recibidas = leerRecibidas(borrador.recibidas);
  if (!recibidas.ok) return recibidas.mensaje;
  return "";
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

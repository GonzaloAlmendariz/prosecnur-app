// Legibilidad de los gráficos (O8 del rediseño, 2026-10-15): qué va en negrita y cómo se acomoda la leyenda, para todo el
// informe. Contrato con el motor (e68a546b5, api/R/estilo_negrita.R y leyenda_plan.R): `estilo_cliente.letra.negrita`
// con un valor por rol y `estilo_cliente.letra.leyenda`. Los valores por defecto reproducen lo que sale hoy; lo igual al
// defecto no se guarda. Puro.

import type { EstiloCliente } from "../../../api/graficosEstilo";

export type ModoCategorias = "mayor" | "todas" | "ninguna";
export type ModoLeyenda = "automatica" | "una_fila" | "dos_filas";
export type RolNegrita = "titulos" | "preguntas" | "cifras" | "box" | "leyenda" | "base";

export const ROLES_NEGRITA: readonly { rol: RolNegrita; rotulo: string; defecto: boolean }[] = [
  { rol: "titulos", rotulo: "Títulos", defecto: true },
  { rol: "preguntas", rotulo: "Preguntas", defecto: true },
  { rol: "cifras", rotulo: "Cifras", defecto: true },
  { rol: "box", rotulo: "Top y Bottom Box", defecto: true },
  { rol: "leyenda", rotulo: "Leyenda", defecto: false },
  { rol: "base", rotulo: "Base", defecto: true },
];

export const MODOS_CATEGORIAS: readonly { clave: ModoCategorias; rotulo: string }[] = [
  { clave: "mayor", rotulo: "Solo la mayor" },
  { clave: "todas", rotulo: "Todas" },
  { clave: "ninguna", rotulo: "Ninguna" },
];

export const MODOS_LEYENDA: readonly { clave: ModoLeyenda; rotulo: string; detalle: string }[] = [
  { clave: "automatica", rotulo: "Automática", detalle: "Una fila si cabe; si no, filas parejas en orden de lectura." },
  { clave: "una_fila", rotulo: "Una fila", detalle: "Junta las etiquetas y, si hace falta, reduce la letra hasta un mínimo legible." },
  { clave: "dos_filas", rotulo: "Dos filas", detalle: "Dos filas parejas, centradas, en orden de lectura." },
];

type Letra = NonNullable<EstiloCliente["letra"]>;
const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const negritaDe = (e: EstiloCliente): Record<string, unknown> => (esObjeto(e.letra?.negrita) ? (e.letra!.negrita as Record<string, unknown>) : {});

export function leerNegrita(e: EstiloCliente, rol: RolNegrita): boolean {
  const v = negritaDe(e)[rol];
  return typeof v === "boolean" ? v : ROLES_NEGRITA.find((r) => r.rol === rol)!.defecto;
}

export function leerCategorias(e: EstiloCliente): ModoCategorias {
  const v = negritaDe(e).categorias;
  return v === "todas" || v === "ninguna" ? v : "mayor";
}

export function leerLeyenda(e: EstiloCliente): ModoLeyenda {
  const v = e.letra?.leyenda;
  return v === "una_fila" || v === "dos_filas" ? v : "automatica";
}

function conLetra(e: EstiloCliente, letra: Letra): EstiloCliente {
  return { ...e, letra };
}

function conNegritaClave(e: EstiloCliente, clave: string, valor: unknown, defecto: unknown): EstiloCliente {
  const negrita = { ...negritaDe(e) };
  if (valor === defecto) delete negrita[clave]; else negrita[clave] = valor;
  const letra: Letra = { ...(e.letra ?? {}) };
  if (Object.keys(negrita).length) letra.negrita = negrita; else delete letra.negrita;
  return conLetra(e, letra);
}

export const conNegrita = (e: EstiloCliente, rol: RolNegrita, valor: boolean) =>
  conNegritaClave(e, rol, valor, ROLES_NEGRITA.find((r) => r.rol === rol)!.defecto);

export const conCategorias = (e: EstiloCliente, modo: ModoCategorias) => conNegritaClave(e, "categorias", modo, "mayor");

export function conLeyenda(e: EstiloCliente, modo: ModoLeyenda): EstiloCliente {
  const letra: Letra = { ...(e.letra ?? {}) };
  if (modo === "automatica") delete letra.leyenda; else letra.leyenda = modo;
  return conLetra(e, letra);
}

/** Algo de la legibilidad se aparta de lo de hoy. */
export function legibilidadModificada(e: EstiloCliente): boolean {
  return Object.keys(negritaDe(e)).length > 0 || leerLeyenda(e) !== "automatica";
}

export function sinLegibilidad(e: EstiloCliente): EstiloCliente {
  const letra: Letra = { ...(e.letra ?? {}) };
  delete letra.negrita;
  delete letra.leyenda;
  return conLetra(e, letra);
}

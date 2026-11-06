// xlsformImpreso.ts — opciones de la pestaña «Impreso» guardadas en el .pulso (L36 · DOC.4).
//
// Cada formulario guarda su `PdfDialogState` serializado y hasta 10 versiones con nombre
// (`api/R/xlsform_impreso.R`). El servidor no interpreta las opciones: las valida
// `parsePdfDialogState` al leerlas. Diseño: docs/qa/l36-doc0-direccion-cuestionario-2026-11-01.md
// (D-L36-15 a 18). No se reexporta desde el barrel `client.ts`.

import { apiFetch, handle, headers } from "./core";
import type { XlsformEditorWorkbook } from "./multiIntegrado";
import type { XlsformPaperExportOptions } from "./xlsformEditor";

export type ImpresoVersion = {
  nombre: string;
  /** `PdfDialogState` serializado (texto JSON). */
  opciones: string;
  guardado_en: string;
};

export type ImpresoGuardado = {
  /** Vacío si el formulario nunca guardó opciones en el proyecto. */
  opciones: string;
  guardado_en: string;
  versiones: ImpresoVersion[];
};

function registro(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function texto(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function normalizeImpresoGuardado(raw: unknown): ImpresoGuardado {
  const r = registro(raw);
  const versiones: ImpresoVersion[] = [];
  for (const v of Array.isArray(r.versiones) ? r.versiones : []) {
    const item = registro(v);
    const nombre = texto(item.nombre).trim();
    if (!nombre) continue;
    versiones.push({ nombre, opciones: texto(item.opciones), guardado_en: texto(item.guardado_en) });
  }
  return { opciones: texto(r.opciones), guardado_en: texto(r.guardado_en), versiones };
}

function ruta(formId: string): string {
  return `/api/xlsform-editor/forms/${encodeURIComponent(formId)}/impreso`;
}

function post(cuerpo: Record<string, string>): RequestInit {
  return {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(cuerpo),
  };
}

export async function apiImpresoLeer(formId: string): Promise<ImpresoGuardado> {
  const raw = registro(await handle<unknown>(await apiFetch(ruta(formId), { method: "GET", headers: headers() })));
  return normalizeImpresoGuardado(raw.impreso);
}

export async function apiImpresoGuardar(formId: string, opciones: string): Promise<ImpresoGuardado> {
  const raw = registro(await handle<unknown>(await apiFetch(ruta(formId), post({ opciones }))));
  return normalizeImpresoGuardado(raw.impreso);
}

export async function apiImpresoGuardarVersion(formId: string, nombre: string, opciones: string): Promise<ImpresoGuardado> {
  const raw = registro(await handle<unknown>(await apiFetch(`${ruta(formId)}/versiones`, post({ nombre, opciones }))));
  return normalizeImpresoGuardado(raw.impreso);
}

// ── Lógica impresa (L36 · D-L36-20) ─────────────────────────────────────────
// La lógica tal como sale en papel: cada condición, salto y salida, del mismo
// modelo que dibujan Word y PDF (`api/R/xlsform_logica_impresa.R`).

export type InstruccionImpresa = {
  numero: string;
  nombre: string;
  /** «condicion» va antes de la pregunta; «salto», junto a una opción; «salida», al final. */
  tipo: "condicion" | "salto" | "salida";
  /** Opción que dispara el salto, «Etiqueta (código)»; vacío en los otros tipos. */
  opcion: string;
  texto: string;
};

export type LogicaImpresa = {
  lenguaje: "saltos" | "condiciones";
  instrucciones: InstruccionImpresa[];
  avisos: string[];
};

export function normalizeLogicaImpresa(raw: unknown): LogicaImpresa {
  const r = registro(raw);
  const instrucciones: InstruccionImpresa[] = [];
  for (const v of Array.isArray(r.instrucciones) ? r.instrucciones : []) {
    const i = registro(v);
    const tipo = i.tipo === "condicion" || i.tipo === "salto" || i.tipo === "salida" ? i.tipo : null;
    const textoImpreso = texto(i.texto).trim();
    if (!tipo || !textoImpreso) continue;
    instrucciones.push({ numero: texto(i.numero), nombre: texto(i.nombre), tipo, opcion: texto(i.opcion), texto: textoImpreso });
  }
  const avisos = (Array.isArray(r.avisos) ? r.avisos : []).map(texto).filter(Boolean);
  return { lenguaje: r.lenguaje === "condiciones" ? "condiciones" : "saltos", instrucciones, avisos };
}

export async function apiLogicaImpresa(workbook: XlsformEditorWorkbook, options: XlsformPaperExportOptions): Promise<LogicaImpresa> {
  const raw = await handle<unknown>(await apiFetch("/api/xlsform-editor/logica-impresa", {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ workbook, options }),
  }));
  return normalizeLogicaImpresa(raw);
}

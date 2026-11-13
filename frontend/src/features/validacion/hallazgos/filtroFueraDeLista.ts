/**
 * La pregunta filtro de un salto con un código fuera de su lista (ítem 41 del
 * checklist de Validación usada por un practicante). El motor cuenta, sobre
 * todos los casos que la regla marca, cuántos traen en una pregunta de la
 * condición un valor que no está entre sus opciones, y redacta el aviso
 * (`validacion_salto_filtro_fuera_lista.R`). Aquí solo se lee: la cifra y el
 * texto salen del motor, nunca se recalculan.
 *
 * Ejemplo: "p6 vale 77 en los 48 casos, un código que no está en sus opciones;
 * puede ser el de "Otro motivo" (4 en el formulario): revisa el formulario
 * antes de corregir respuestas."
 */
import type { InstrumentoDrillResult } from "../../../api/validacion";

export type FiltroFueraDeLista = {
  /** La pregunta de la condición, por su código. */
  variable: string;
  /** Los valores fuera de lista, de más a menos casos. */
  valores: string[];
  /** Casos marcados con algún valor fuera de lista en la pregunta. */
  nCasos: number;
  /** Casos que la regla marca (la base de `nCasos`). */
  nMarcados: number;
  /** La opción "Otro" de la lista, si la hay y no es uno de los valores. */
  otro: { codigo: string; etiqueta: string } | null;
  texto: string;
};

const registro = (x: unknown): Record<string, unknown> => (x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {});
const texto = (x: unknown): string | null => {
  const v = Array.isArray(x) ? x[0] : x;
  return typeof v === "string" && v.trim() ? v : typeof v === "number" ? String(v) : null;
};
const numero = (x: unknown): number | null => {
  const v = Array.isArray(x) ? x[0] : x;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
};

/** Las entradas que el motor publicó en el detalle (`filtro_fuera_de_lista`); vacía si no hay o con un motor anterior. */
export function filtroFueraDeLista(drill: InstrumentoDrillResult | null): FiltroFueraDeLista[] {
  if (!drill) return [];
  const crudo = (drill as unknown as Record<string, unknown>).filtro_fuera_de_lista;
  const lista = Array.isArray(crudo) ? crudo : crudo && typeof crudo === "object" ? [crudo] : [];
  const out: FiltroFueraDeLista[] = [];
  for (const e of lista) {
    const r = registro(e);
    const variable = texto(r.variable);
    const aviso = texto(r.texto);
    const valores = (Array.isArray(r.valores) ? r.valores : []).map((v) => texto(registro(v).valor)).filter((v): v is string => v !== null);
    const nCasos = numero(r.n_casos);
    const nMarcados = numero(r.n_marcados);
    if (!variable || !aviso || !valores.length || nCasos === null || nMarcados === null) continue;
    const o = registro(r.otro);
    const codigo = texto(o.codigo);
    const etiqueta = texto(o.etiqueta);
    out.push({ variable, valores, nCasos, nMarcados, otro: codigo && etiqueta ? { codigo, etiqueta } : null, texto: aviso });
  }
  return out;
}

/** Si el valor crudo de una celda trae alguno de los valores fuera de lista (una múltiple se lee por opción). */
export function traeValorFueraDeLista(crudo: unknown, valores: readonly string[]): boolean {
  if (crudo === null || crudo === undefined || crudo === "") return false;
  const t = String(crudo).trim();
  if (valores.includes(t)) return true;
  return t.split(/\s+/).some((x) => valores.includes(x));
}

/** La pauta que va primero cuando la pregunta filtro trae un código fuera de su lista. */
export function pautaDelFiltro(f: FiltroFueraDeLista): string {
  const valores = f.valores.length === 1 ? `el ${f.valores[0]}` : `los códigos ${f.valores.slice(0, -1).join(", ")} y ${f.valores[f.valores.length - 1]}`;
  const verbo = f.valores.length === 1 ? "no está" : "no están";
  return `Revisa primero las opciones de ${f.variable} en el formulario: ${valores} de los casos ${verbo} en su lista. Si es el código de otra opción, corrige el formulario y vuelve a auditar antes de tocar las respuestas.`;
}

// «Dividir por» con sus grupos (oleada I2, ítem 7), sin React. Elegido el cruce, cada grupo es una barra del gráfico (una
// fila del detalle del motor, con su base exacta: pesos y filtros). Un grupo con menos de POCOS_CASOS casos se marca:
// su porcentaje se lee con cautela y el analista decide si lo excluye.

import type { DetalleCifras } from "../../../../api/graficosCifras";
import { nDeBase } from "../cifrasInspector/modeloCifras";

export const POCOS_CASOS = 30;

/** Los args de «Dividir por» bajo los que van los grupos. */
export const ARGS_CRUCE: ReadonlySet<string> = new Set(["cruces", "cruce"]);

export type Grupo = { clave: string; rotulo: string; n: number | null; pocos: boolean };

/** Los grupos del gráfico (sin la barra del total); vacío si el detalle no trae una barra por grupo. */
export function gruposDe(det: DetalleCifras | null): Grupo[] {
  if (!det) return [];
  const filas = det.filas.filter((f) => !f.esTotal);
  if (filas.length < 2) return [];
  return filas.map((f) => {
    const n = nDeBase(f.base);
    return { clave: f.clave, rotulo: f.rotulo, n, pocos: n !== null && n < POCOS_CASOS };
  });
}

/** R7-16: `excluir_grupos` guarda rótulos; un plan viejo con códigos sigue funcionando (el motor casa primero el código).
 *  Agregar un rótulo a lo guardado sin partir por comas (un rótulo puede llevarlas) y sin repetirlo. */
export function conGrupoExcluido(guardado: unknown, rotulo: string): string[] {
  const lista = (Array.isArray(guardado) ? guardado : typeof guardado === "string" && guardado.trim() ? [guardado] : [])
    .map((v) => (typeof v === "string" || typeof v === "number" ? String(v).trim() : "")).filter(Boolean);
  return lista.includes(rotulo) ? lista : [...lista, rotulo];
}

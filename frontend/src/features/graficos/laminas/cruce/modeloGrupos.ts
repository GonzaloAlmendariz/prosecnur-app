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

const norm = (s: string) => s.trim().toLocaleLowerCase("es");

/** El código del grupo en la pregunta del cruce, por su etiqueta; null si no se encuentra. */
export function codigoDeGrupo(rotulo: string, categorias: readonly { codigo: string; etiqueta: string }[]): string | null {
  const c = categorias.find((x) => norm(x.etiqueta) === norm(rotulo) || norm(x.codigo) === norm(rotulo));
  return c?.codigo ?? null;
}

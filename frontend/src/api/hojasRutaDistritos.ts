/**
 * ADR 0131 §1c: distritos de inclusión forzosa y distritos sorteados dentro de cada ciudad
 * o área de Lima. Lo declara `sample_size_preview.estrato_muestral` cuando rige (estrato
 * provincia con la base 2025); el normalizador devuelve null si no viene o viene roto.
 */

export const RUTAS_MINIMAS_DISTRITO = 3;

export type HojasRutaDistritosRegla = "ordinaria" | "minimo_descontado_de_forzosos" | "forzoso_al_grupo" | "estrato_bajo_minimo";

/** Una ciudad o área de Lima: cuántos distritos entran con certeza y cuántos se sortean. */
export type HojasRutaGrupoDistritos = {
  estrato: string;
  etiqueta: string;
  rutas: number;
  n_distritos: number;
  n_forzosos: number;
  n_candidatos: number;
  h: number;
  rutas_grupo: number;
  regla: HojasRutaDistritosRegla;
};

export type HojasRutaDistritosSorteo = { rutas_minimas_distrito: number; grupos: HojasRutaGrupoDistritos[] };

const escalar = (v: unknown): unknown => (Array.isArray(v) ? v[0] : v);
const num = (v: unknown): number | null => {
  const x = escalar(v);
  return typeof x === "number" && Number.isFinite(x) ? x : null;
};
const REGLAS: ReadonlySet<string> = new Set(["ordinaria", "minimo_descontado_de_forzosos", "forzoso_al_grupo", "estrato_bajo_minimo"]);

export function normalizeHojasRutaDistritosSorteo(r: Record<string, unknown>): HojasRutaDistritosSorteo | null {
  const minimo = num(r.rutas_minimas_distrito);
  if (minimo === null || !Array.isArray(r.grupos_distritos)) return null;
  const grupos = r.grupos_distritos.flatMap((g): HojasRutaGrupoDistritos[] => {
    if (!g || typeof g !== "object") return [];
    const x = g as Record<string, unknown>;
    const estrato = escalar(x.estrato);
    const rutas = num(x.rutas);
    const forzosos = num(x.n_forzosos);
    const h = num(x.h);
    if (typeof estrato !== "string" || rutas === null || forzosos === null || h === null) return [];
    const etiqueta = escalar(x.etiqueta);
    const regla = escalar(x.regla);
    return [{
      estrato,
      etiqueta: typeof etiqueta === "string" && etiqueta ? etiqueta : estrato,
      rutas,
      n_distritos: num(x.n_distritos) ?? 0,
      n_forzosos: forzosos,
      n_candidatos: num(x.n_candidatos) ?? 0,
      h,
      rutas_grupo: num(x.rutas_grupo) ?? 0,
      regla: typeof regla === "string" && REGLAS.has(regla) ? (regla as HojasRutaDistritosRegla) : "ordinaria",
    }];
  });
  return { rutas_minimas_distrito: minimo, grupos };
}

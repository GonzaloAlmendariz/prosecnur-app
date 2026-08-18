/**
 * El sexo en el perfil de la muestra (I5).
 *
 * «De qué está hecha la muestra» enseñaba tamaño, tipo de sesión y nivel del
 * curso — y callaba la composición por sexo, que es justo la dimensión que el
 * estudio certifica por celda. Este modelo la proyecta: cuántas mujeres y
 * hombres ELEGIBLES alcanzan las aulas titulares de cada facultad, con la
 * composición del marco completo como referencia (¿la muestra se parece a su
 * marco?).
 *
 * Sólo se suma lo observado: el sexo viaja como top-2 categorías por aula
 * (`sex_top_1/2` + su n, «F»/«M»); un aula sin sexo declarado no suma a nadie
 * y SE CUENTA — callarla inflaría la certeza de la composición.
 */
export type FilaLike = Record<string, unknown>;

export type FilaPerfilSexo = {
  facultad: string;
  titulares: number;
  mujeres: number;
  hombres: number;
  /** Aulas titulares sin sexo declarado en el marco. */
  aulasSinSexo: number;
  /** Proporción de mujeres del MARCO completo de la facultad (0–1); null si
   *  el marco no declara sexo ahí. Es la marca de referencia. */
  refMujeres: number | null;
};

export type PerfilSexo = {
  filas: FilaPerfilSexo[];
  totales: { mujeres: number; hombres: number; aulasSinSexo: number };
};

function num(v: unknown): number | null {
  const x = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof x === "number" && Number.isFinite(x) ? x : null;
}

function texto(v: unknown): string {
  return typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
}

/** Suma F/M de una fila de aula; null si el aula no declara sexo. */
function sexoDeAula(row: FilaLike): { mujeres: number; hombres: number } | null {
  let mujeres: number | null = null;
  let hombres: number | null = null;
  for (const [cat, n] of [
    [row.sex_top_1, row.sex_top_1_n],
    [row.sex_top_2, row.sex_top_2_n],
  ] as const) {
    const clave = texto(cat).toUpperCase();
    if (clave === "F") mujeres = num(n);
    else if (clave === "M") hombres = num(n);
  }
  if (mujeres == null && hombres == null) return null;
  return { mujeres: mujeres ?? 0, hombres: hombres ?? 0 };
}

export function construirPerfilSexo(
  titulares: ReadonlyArray<FilaLike> | null | undefined,
  marco: ReadonlyArray<FilaLike> | null | undefined,
): PerfilSexo | null {
  if (!titulares?.length) return null;

  const refPorFacultad = new Map<string, { mujeres: number; hombres: number }>();
  for (const row of marco ?? []) {
    const facultad = texto(row.faculty);
    const sexo = sexoDeAula(row);
    if (!facultad || !sexo) continue;
    const acc = refPorFacultad.get(facultad) ?? { mujeres: 0, hombres: 0 };
    acc.mujeres += sexo.mujeres;
    acc.hombres += sexo.hombres;
    refPorFacultad.set(facultad, acc);
  }

  const porFacultad = new Map<string, FilaPerfilSexo>();
  for (const row of titulares) {
    const facultad = texto(row.faculty);
    if (!facultad) continue;
    const fila = porFacultad.get(facultad) ?? {
      facultad,
      titulares: 0,
      mujeres: 0,
      hombres: 0,
      aulasSinSexo: 0,
      refMujeres: null,
    };
    fila.titulares += 1;
    const sexo = sexoDeAula(row);
    if (sexo) {
      fila.mujeres += sexo.mujeres;
      fila.hombres += sexo.hombres;
    } else {
      fila.aulasSinSexo += 1;
    }
    porFacultad.set(facultad, fila);
  }
  const filas = [...porFacultad.values()];
  if (!filas.length) return null;
  for (const fila of filas) {
    const ref = refPorFacultad.get(fila.facultad);
    const total = ref ? ref.mujeres + ref.hombres : 0;
    fila.refMujeres = ref && total > 0 ? ref.mujeres / total : null;
  }
  filas.sort((a, b) => (b.mujeres + b.hombres) - (a.mujeres + a.hombres) || a.facultad.localeCompare(b.facultad));
  return {
    filas,
    totales: {
      mujeres: filas.reduce((s, f) => s + f.mujeres, 0),
      hombres: filas.reduce((s, f) => s + f.hombres, 0),
      aulasSinSexo: filas.reduce((s, f) => s + f.aulasSinSexo, 0),
    },
  };
}

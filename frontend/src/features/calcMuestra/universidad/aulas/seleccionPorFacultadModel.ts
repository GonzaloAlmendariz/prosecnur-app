/**
 * La selección organizada como Gonzalo la lee: POR FACULTAD, con la cadena de
 * reemplazos plegada bajo su titular.
 *
 * Pliego textual (2026-08-20): «no te deja escoger por facultad — no tienes
 * claro qué curso-horario le pertenece a quién… no es necesidad de
 * mostrar-200-más: debería separarse por facultad, mostrar titulares y opción
 * de mostrar los reemplazos — los reemplazos después del titular, reemplazo 1,
 * reemplazo 2». El vínculo existe en el dato: `replacement_for` apunta al
 * classroom_id del titular y `replacement_order`/`orden` ordena la cadena.
 */
type Fila = Record<string, unknown>;

export type CadenaTitular = {
  titular: Fila;
  reemplazos: Fila[];
};

export type FacultadSeleccion = {
  facultad: string;
  titulares: CadenaTitular[];
  nReemplazos: number;
};

const texto = (v: unknown): string => String(v ?? "").trim();
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
};

/** Agrupa la selección por facultad; dentro, cada titular con su cadena. */
export function seleccionPorFacultad(rows: Fila[] | null | undefined): FacultadSeleccion[] {
  const titulares = (rows ?? []).filter((r) => texto(r.sample_role) === "titular");
  const reservas = (rows ?? []).filter((r) => texto(r.sample_role) !== "titular");
  const porTitular = new Map<string, Fila[]>();
  for (const r of reservas) {
    const clave = texto(r.replacement_for);
    if (!clave) continue;
    const lista = porTitular.get(clave) ?? [];
    lista.push(r);
    porTitular.set(clave, lista);
  }
  for (const lista of porTitular.values()) {
    lista.sort((a, b) => num(a.replacement_order ?? a.orden) - num(b.replacement_order ?? b.orden));
  }
  const porFacultad = new Map<string, CadenaTitular[]>();
  for (const t of titulares) {
    const fac = texto(t.faculty) || "(sin facultad)";
    const cadena: CadenaTitular = {
      titular: t,
      reemplazos: porTitular.get(texto(t.classroom_id)) ?? [],
    };
    const lista = porFacultad.get(fac) ?? [];
    lista.push(cadena);
    porFacultad.set(fac, lista);
  }
  const out: FacultadSeleccion[] = [];
  for (const [facultad, lista] of porFacultad) {
    lista.sort((a, b) => num(a.titular.orden) - num(b.titular.orden));
    out.push({
      facultad,
      titulares: lista,
      nReemplazos: lista.reduce((s, c) => s + c.reemplazos.length, 0),
    });
  }
  out.sort((a, b) => b.titulares.length - a.titulares.length);
  return out;
}

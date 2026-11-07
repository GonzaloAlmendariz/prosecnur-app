// Reconoce un experimento de viñetas ya escrito en el formulario (checklist elección por pares C10, 2026-11-07). Parte
// de las notas cuyo texto sólo cita textos sorteados (`${…_txt}` que llevan a un `once(random())`) y que comparten su
// grupo con una pregunta de calificación; de ahí lee la plantilla, los atributos, la pregunta y la escala. Conserva los
// nombres de las filas y, como el de pares, sólo es «fiel» si el diseño leído regenera exactamente lo mismo.

import { rowToRecord } from "../parsing/sheetUtils";
import type { XlsformEditorWorkbook } from "../types";
import { leerNivel, leerTabla, leerTexto, porPar, sufijoComun } from "./leerConjoint";
import type { AtributoConjoint, NivelConjoint } from "./modeloConjoint";
import { generarVinetas, validarVinetas, type DisenoVinetas, type NombresVinetas } from "./modeloVinetas";

export type VinetaLeida = { vineta: number; grupo: number; fin: number; nota: number; calificacion: number };

export type LecturaVinetas = {
  diseno: DisenoVinetas;
  nombres: NombresVinetas;
  vinetas: VinetaLeida[];
  /** Fila de cada cálculo del sorteo → viñeta a la que pertenece. */
  sorteo: ReadonlyMap<number, number>;
  intro: number | null;
  filas: number[];
  fiel: boolean;
  motivo: string | null;
};

type FilaV = { i: number; type: string; name: string; label: string; calculation: string; appearance: string; required: string };
const REF = /\$\{([^}]+)\}/g;

/** Plantilla por viñeta y atributo desde dos nombres de la viñeta 1 y la 2 («vi_v1_edad_r» → (v, c) => …). */
function porVinetaYClave(n1: string, n2: string | undefined, clave: string): ((v: number, c: string) => string) | null {
  const sin = (n: string) => {
    const k = n.lastIndexOf(clave);
    return k < 0 ? null : `${n.slice(0, k)}\u0000${n.slice(k + clave.length)}`;
  };
  const a = sin(n1);
  const b = n2 == null ? undefined : sin(n2);
  if (!a || b === null) return null;
  const f = porPar(a, b);
  return f ? (v, c) => f(v).replace("\u0000", c) : null;
}

export function leerVinetas(wb: Pick<XlsformEditorWorkbook, "survey" | "choices"> | null): LecturaVinetas | null {
  if (!wb) return null;
  const survey = wb.survey;
  const filas: FilaV[] = survey.rows.map((_, i) => {
    const r = rowToRecord(survey, i);
    return { i, type: (r.type ?? "").trim(), name: (r.name ?? "").trim(), label: r.label ?? "", calculation: (r.calculation ?? "").trim(), appearance: (r.appearance ?? "").trim(), required: (r.required ?? "").trim() };
  });
  const porNombre = new Map(filas.filter((f) => f.name).map((f) => [f.name, f]));
  const padre = new Map<number, number | null>();
  const cierre = new Map<number, number>();
  const pila: number[] = [];
  for (const f of filas) {
    padre.set(f.i, pila[pila.length - 1] ?? null);
    if (/^begin[ _](group|repeat)$/.test(f.type)) pila.push(f.i);
    else if (/^end[ _](group|repeat)$/.test(f.type)) {
      const b = pila.pop();
      if (b != null) cierre.set(b, f.i);
    }
  }

  // Una nota es escenario si cada `${}` de su texto lleva a un texto sorteado y su grupo tiene una calificación.
  type Cadena = { texto: string; nivel: string; azar: string; niveles: NivelConjoint[]; pesos: number[] | null; omiteSi: { base: string; noEs: string[] } | null };
  const cadena = (texto: string): Cadena | null => {
    const lt = leerTexto(porNombre.get(texto)?.calculation ?? "");
    if (!lt) return null;
    const ln = leerNivel(porNombre.get(lt.nivel)?.calculation ?? "");
    if (!ln || (porNombre.get(ln.azar)?.calculation ?? "").replace(/\s/g, "") !== "once(random())") return null;
    if (ln.codigos.join("|") !== lt.niveles.map((x) => x.codigo).join("|")) return null;
    return { texto, nivel: lt.nivel, azar: ln.azar, niveles: lt.niveles, pesos: ln.pesos, omiteSi: ln.omiteSi };
  };
  const escenarios = filas.flatMap((f) => {
    if (f.type !== "note" || leerTabla(f.label)) return [];
    const refs = [...f.label.matchAll(REF)].map((m) => m[1]!);
    if (!refs.length) return [];
    const cadenas = refs.map(cadena);
    if (cadenas.some((c) => !c)) return [];
    const grupo = padre.get(f.i);
    if (grupo == null) return [];
    const calif = filas.find((x) => x.i > f.i && padre.get(x.i) === grupo && /^select_one\s/.test(x.type));
    if (!calif) return [];
    let k = 0;
    const firma = f.label.replace(REF, () => `{#${k++}}`);
    return [{ fila: f, grupo, calif, cadenas: cadenas as Cadena[], firma }];
  });
  if (!escenarios.length) return null;
  const notas = escenarios.filter((e) => e.firma === escenarios[0]!.firma);
  const base = notas[0]!;

  // Atributos desde la viñeta 1, en el orden en que aparecen en el texto (sin repetir).
  const vistas = new Set<string>();
  const indices: number[] = [];
  base.cadenas.forEach((c, k) => { if (!vistas.has(c.nivel)) { vistas.add(c.nivel); indices.push(k); } });
  const atributos: AtributoConjoint[] = [];
  const claveDeNivel1 = new Map<string, string>();
  for (const k of indices) {
    const enCada = notas.map((n) => n.cadenas[k]);
    if (enCada.some((c) => !c)) return null;
    const clave = notas.length > 1 ? sufijoComun(enCada.map((c) => c!.nivel)) : base.cadenas[k]!.nivel.replace(/^.*?\d+_/, "");
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(clave)) return null;
    const c = base.cadenas[k]!;
    claveDeNivel1.set(c.nivel, clave);
    atributos.push({
      clave,
      rotulo: clave.charAt(0).toUpperCase() + clave.slice(1).replace(/_/g, " "),
      niveles: c.niveles.map((x, j) => (c.pesos ? { ...x, peso: c.pesos[j]! } : x)),
      ...(c.omiteSi ? { soloSi: { atributo: c.omiteSi.base, noEs: c.omiteSi.noEs } } : {}),
    });
  }
  for (const a of atributos) {
    if (!a.soloSi) continue;
    const clave = claveDeNivel1.get(a.soloSi.atributo);
    if (!clave) return null;
    a.soloSi = { atributo: clave, noEs: a.soloSi.noEs };
  }
  // La plantilla: el texto de la viñeta 1 con cada `${texto}` vuelto `{clave}`.
  const claveDeTexto = new Map(base.cadenas.map((c) => [c.texto, claveDeNivel1.get(c.nivel)!]));
  const texto = base.fila.label.trim().replace(REF, (_m, n: string) => `{${claveDeTexto.get(n)}}`);

  const segunda = notas[1];
  const c0 = base.cadenas[indices[0]!]!;
  const c0b = segunda?.cadenas[indices[0]!];
  const clave0 = atributos[0]!.clave;
  const pAzar = porVinetaYClave(c0.azar, c0b?.azar, clave0);
  const pNivel = porVinetaYClave(c0.nivel, c0b?.nivel, clave0);
  const pTexto = porVinetaYClave(c0.texto, c0b?.texto, clave0);
  const nombreDe = (i: number) => filas[i]!.name;
  const pGrupo = porPar(nombreDe(base.grupo), segunda ? nombreDe(segunda.grupo) : undefined);
  const pNota = porPar(base.fila.name, segunda?.fila.name);
  const pCalif = porPar(base.calif.name, segunda?.calif.name);
  if (!pAzar || !pNivel || !pTexto || !pGrupo || !pNota || !pCalif) return null;

  const previa = filas.filter((f) => f.i < base.grupo && padre.get(f.i) === padre.get(base.grupo)).pop();
  const intro = previa && previa.type === "note" && !(previa.label.match(REF)?.length) ? previa : null;
  const lista = base.calif.type.replace(/^select_one\s+/, "").trim();
  const prefijoEditor = /^([A-Za-z_][A-Za-z0-9_]*)_v1_/.exec(c0.nivel)?.[1];

  // La escala: los códigos de la lista son enteros seguidos; los extremos llevan su rótulo después del número.
  const opciones = wb.choices.rows
    .map((_, i) => rowToRecord(wb.choices, i))
    .filter((r) => (r.list_name ?? "").trim() === lista)
    .map((r) => ({ codigo: Number((r.name ?? "").trim()), label: (r.label ?? "").trim() }));
  if (opciones.length < 2 || opciones.some((o, k) => !Number.isInteger(o.codigo) || o.codigo !== opciones[0]!.codigo + k)) return null;
  const extremo = (o: { codigo: number; label: string }) => o.label.replace(new RegExp(`^${o.codigo}\\s*`), "");

  const nombres: NombresVinetas = {
    azar: pAzar,
    nivel: pNivel,
    texto: pTexto,
    grupo: pGrupo,
    nota: pNota,
    calificacion: pCalif,
    lista,
    intro: intro?.name ?? `${prefijoEditor ?? "vinetas"}_intro`,
  };
  const diseno: DisenoVinetas = {
    prefijo: prefijoEditor ?? "vi",
    vinetas: notas.length,
    texto,
    atributos,
    pregunta: base.calif.label.trim(),
    escala: { min: opciones[0]!.codigo, max: opciones[opciones.length - 1]!.codigo, etiquetaMin: extremo(opciones[0]!), etiquetaMax: extremo(opciones[opciones.length - 1]!) },
    ...(intro ? { intro: intro.label.trim() } : {}),
  };

  const vinetas: VinetaLeida[] = notas.map((n, k) => ({ vineta: k + 1, grupo: n.grupo, fin: cierre.get(n.grupo) ?? n.grupo, nota: n.fila.i, calificacion: n.calif.i }));
  const sorteo = new Map<number, number>();
  notas.forEach((n, k) => n.cadenas.forEach((c) => [c.azar, c.nivel, c.texto].forEach((nombre) => {
    const f = porNombre.get(nombre);
    if (f) sorteo.set(f.i, k + 1);
  })));
  const delExperimento = new Set<number>(sorteo.keys());
  if (intro) delExperimento.add(intro.i);
  for (const v of vinetas) for (let i = v.grupo; i <= v.fin; i += 1) delExperimento.add(i);

  let motivo: string | null = validarVinetas(diseno)[0] ?? null;
  if (!motivo) {
    const { survey: nuevas, choices } = generarVinetas(diseno, nombres);
    for (const n of nuevas) {
      if (!n.name) continue;
      const f = porNombre.get(n.name);
      const igual = f && f.type === n.type && (n.type === "calculate" ? f.calculation === n.calculation : f.label.trim() === n.label.trim());
      if (!igual) {
        motivo = `«${n.name}» no está escrito como lo escribe el editor.`;
        break;
      }
    }
    if (!motivo && choices.some((c, k) => opciones[k]?.label !== c.label)) motivo = `La escala «${lista}» no está escrita como la escribe el editor.`;
    if (!motivo && nuevas.filter((n) => n.name).length !== [...delExperimento].filter((i) => filas[i]!.name).length) {
      motivo = "El experimento tiene filas que el editor no genera.";
    }
  }
  return {
    diseno,
    nombres,
    vinetas,
    sorteo,
    intro: intro?.i ?? null,
    filas: [...delExperimento].sort((a, b) => a - b),
    fiel: motivo == null,
    motivo,
  };
}

// Reconoce experimentos de lista ya escritos (checklist elección por pares C14, 2026-11-07): una pregunta de número
// cuya restricción va de 0 a «J o J+1 según la asignación», con una asignación sorteada con `once(random())` y, en su
// misma página, una nota por grupo con la lista de afirmaciones. Sólo es «fiel» si el diseño leído regenera lo mismo.

import { rowToRecord } from "../parsing/sheetUtils";
import type { XlsformEditorWorkbook } from "../types";
import { leerNivel } from "./leerConjoint";
import { generarLista, nombresLista, validarLista, type DisenoLista } from "./modeloLista";

export type LecturaLista = {
  diseno: DisenoLista;
  /** Filas de la pregunta de conteo y de las dos listas. */
  conteo: number;
  control: number;
  tratamiento: number;
  /** Página que reúne las listas y la pregunta (null si no la tiene). */
  pagina: number | null;
  /** Piezas de primer nivel: los dos cálculos y la página (o, sin página, las listas y la pregunta). */
  primerNivel: number[];
  filas: number[];
  fiel: boolean;
  motivo: string | null;
};

const RESTRICCION = /^\. >= 0 and \. <= if\(\$\{([^}]+)\} = '2', (\d+), (\d+)\)$/;
const items = (label: string) => label.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => l.replace(/^[-*]\s+/, ""));

export function leerLista(wb: Pick<XlsformEditorWorkbook, "survey"> | null): LecturaLista[] {
  if (!wb) return [];
  const survey = wb.survey;
  const filas = survey.rows.map((_, i) => {
    const r = rowToRecord(survey, i);
    const v = (k: string) => (r[k] ?? "").trim();
    return { i, type: v("type"), name: v("name"), label: r.label ?? "", calculation: v("calculation"), relevant: v("relevant"), constraint: v("constraint"), constraint_message: v("constraint_message"), appearance: v("appearance"), required: v("required") };
  });
  const porNombre = new Map(filas.filter((f) => f.name).map((f) => [f.name, f]));
  const out: LecturaLista[] = [];
  for (const q of filas) {
    if (q.type !== "integer") continue;
    const m = RESTRICCION.exec(q.constraint);
    if (!m || Number(m[2]) !== Number(m[3]) + 1) continue;
    const asig = porNombre.get(m[1]!);
    const ln = leerNivel(asig?.calculation ?? "");
    const azar = ln ? porNombre.get(ln.azar) : undefined;
    if (!asig || !ln || ln.omiteSi || ln.codigos.join("|") !== "1|2" || !azar || azar.calculation.replace(/\s/g, "") !== "once(random())") continue;
    const deGrupo = (codigo: string) => filas.find((f) => f.type === "note" && f.relevant === `\${${asig.name}} = '${codigo}'`);
    const control = deGrupo("1");
    const tratamiento = deGrupo("2");
    if (!control || !tratamiento) continue;
    const c = items(control.label);
    const t = items(tratamiento.label);
    const posicion = t.findIndex((x, k) => x !== c[k]) + 1 || t.length;
    const sensible = t[posicion - 1] ?? "";
    const prefijo = /^(.+)_asignacion$/.exec(asig.name)?.[1] ?? asig.name;
    const diseno: DisenoLista = {
      prefijo,
      pregunta: q.label.trim(),
      controles: c,
      sensible,
      posicion,
      probTratamiento: ln.pesos ? ln.pesos[1]! : 0.5,
    };
    const n = nombresLista(prefijo);
    const pagina = porNombre.get(n.pagina);
    const cierre = pagina ? filas.find((f) => f.i > q.i && /^end[ _]group$/.test(f.type)) : undefined;
    const lasFilas = [azar.i, asig.i, ...(pagina ? [pagina.i] : []), control.i, tratamiento.i, q.i, ...(cierre ? [cierre.i] : [])].sort((a, b) => a - b);
    let motivo: string | null = validarLista(diseno)[0] ?? null;
    if (!motivo && (t.length !== c.length + 1 || t.filter((x, k) => k !== posicion - 1).join("|") !== c.join("|"))) motivo = "Las dos listas no difieren en una sola afirmación.";
    if (!motivo) {
      for (const g of generarLista(diseno)) {
        if (!g.name) continue;
        const f = porNombre.get(g.name);
        const igual = f && f.type === g.type && (g.label ?? "").trim() === f.label.trim() && (g.calculation ?? "") === f.calculation
          && (g.relevant ?? "") === f.relevant && (g.constraint ?? "") === f.constraint;
        if (!igual) {
          motivo = `«${g.name}» no está escrito como lo escribe el editor.`;
          break;
        }
      }
    }
    const primerNivel = pagina ? [azar.i, asig.i, pagina.i] : [azar.i, asig.i, control.i, tratamiento.i, q.i];
    out.push({ diseno, pagina: pagina?.i ?? null, conteo: q.i, control: control.i, tratamiento: tratamiento.i, primerNivel: primerNivel.sort((a, b) => a - b), filas: lasFilas, fiel: motivo == null, motivo });
  }
  return out;
}

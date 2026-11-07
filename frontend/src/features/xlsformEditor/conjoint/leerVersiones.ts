// Reconoce experimentos de versiones al azar ya escritos (checklist elección por pares C12, 2026-11-07): una pregunta
// cuyo enunciado es sólo `${texto}`, donde `texto` elige una redacción según una versión sorteada con
// `once(random())`. Puede haber varios en un formulario. Sólo es «fiel» si el diseño leído regenera lo mismo.

import { rowToRecord } from "../parsing/sheetUtils";
import type { XlsformEditorWorkbook } from "../types";
import { leerNivel, leerTexto } from "./leerConjoint";
import { generarVersiones, nombresVersiones, validarVersiones, type DisenoVersiones, type TipoRespuestaVersiones } from "./modeloVersiones";

export type LecturaVersiones = {
  diseno: DisenoVersiones;
  /** Fila de la pregunta y de sus tres cálculos. */
  pregunta: number;
  calculos: number[];
  filas: number[];
  fiel: boolean;
  motivo: string | null;
};

export function leerVersiones(wb: Pick<XlsformEditorWorkbook, "survey"> | null): LecturaVersiones[] {
  if (!wb) return [];
  const survey = wb.survey;
  const filas = survey.rows.map((_, i) => {
    const r = rowToRecord(survey, i);
    return { i, type: (r.type ?? "").trim(), name: (r.name ?? "").trim(), label: (r.label ?? "").trim(), calculation: (r.calculation ?? "").trim(), required: (r.required ?? "").trim() };
  });
  const porNombre = new Map(filas.filter((f) => f.name).map((f) => [f.name, f]));
  const out: LecturaVersiones[] = [];
  for (const q of filas) {
    const tipo: TipoRespuestaVersiones | null = /^select_one\s/.test(q.type) ? "select_one" : q.type === "integer" ? "integer" : q.type === "text" ? "text" : null;
    const m = /^\$\{([^}]+)\}$/.exec(q.label);
    if (!tipo || !m) continue;
    const texto = porNombre.get(m[1]!);
    const lt = leerTexto(texto?.calculation ?? "");
    if (!texto || !lt) continue;
    const version = porNombre.get(lt.nivel);
    const ln = leerNivel(version?.calculation ?? "");
    const azar = ln ? porNombre.get(ln.azar) : undefined;
    if (!version || !ln || ln.omiteSi || !azar || azar.calculation.replace(/\s/g, "") !== "once(random())") continue;
    if (ln.codigos.join("|") !== lt.niveles.map((x) => x.codigo).join("|")) continue;
    const prefijo = /^(.+)_version$/.exec(version.name)?.[1] ?? version.name;
    const diseno: DisenoVersiones = {
      prefijo,
      pregunta: q.name,
      tipo,
      lista: tipo === "select_one" ? q.type.replace(/^select_one\s+/, "").trim() : "",
      obligatoria: /^(yes|true|true\(\))$/i.test(q.required),
      versiones: lt.niveles.map((n, k) => ({ texto: n.texto, ...(ln.pesos ? { peso: ln.pesos[k]! } : {}) })),
    };
    const calculos = [azar.i, version.i, texto.i];
    let motivo: string | null = validarVersiones(diseno)[0] ?? null;
    const n = nombresVersiones(prefijo);
    if (!motivo && (n.azar !== azar.name || n.texto !== texto.name)) motivo = "Los cálculos no se llaman como los nombra el editor.";
    if (!motivo) {
      const [r, v, t, p] = generarVersiones(diseno);
      const igual = r!.calculation === azar.calculation && v!.calculation === version.calculation && t!.calculation === texto.calculation && p!.type === q.type && p!.label === q.label;
      if (!igual) motivo = `«${q.name}» no está escrito como lo escribe el editor.`;
    }
    out.push({ diseno, pregunta: q.i, calculos, filas: [...calculos, q.i].sort((a, b) => a - b), fiel: motivo == null, motivo });
  }
  return out;
}

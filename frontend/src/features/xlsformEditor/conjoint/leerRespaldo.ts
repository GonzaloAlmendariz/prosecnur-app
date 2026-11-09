// Reconoce experimentos de respaldo ya escritos (checklist elección por pares C15, 2026-11-07): cálculos con la forma
// `if(${brazo} = '1', concat(…), concat(…))` sobre un brazo sorteado con `once(random())`, cuyas concat() citan el
// nombre del actor y el texto de una política. Puede haber varios en un formulario. Sólo es «fiel» si el diseño leído
// regenera lo mismo.

import { rowToRecord } from "../parsing/sheetUtils";
import type { XlsformEditorWorkbook } from "../types";
import { leerNivel, leerTexto } from "./leerConjoint";
import { generarRespaldo, nombresRespaldo, validarRespaldo, type DisenoRespaldo } from "./modeloRespaldo";

export type LecturaRespaldo = {
  diseno: DisenoRespaldo;
  /** Por política: su página, su texto, la frase que le toca, su nota y su pregunta de apoyo. */
  politicas: { pagina: number | null; politica: number; texto: number; frase: number; apoyo: number }[];
  /** Los tres cálculos del sorteo (azar, brazo, actor). */
  sorteo: number[];
  /** Piezas de primer nivel: el sorteo y las páginas. */
  primerNivel: number[];
  filas: number[];
  fiel: boolean;
  motivo: string | null;
};

const LIT = /^'([^']*)'$|^"([^"]*)"$/;
const REF = /^\$\{([^}]+)\}$/;

/** Argumentos de primer nivel de concat(…), respetando las comillas. */
function argumentos(cuerpo: string): string[] | null {
  const out: string[] = [];
  let actual = "";
  let comilla: string | null = null;
  for (const c of cuerpo) {
    if (comilla) {
      actual += c;
      if (c === comilla) comilla = null;
    } else if (c === "'" || c === '"') {
      comilla = c;
      actual += c;
    } else if (c === ",") {
      out.push(actual.trim());
      actual = "";
    } else actual += c;
  }
  if (comilla) return null;
  out.push(actual.trim());
  return out;
}

/** La frase de una concat(): literales tal cual y las referencias como `{actor}` o `{politica}`. */
function frase(concat: string, actor: string, politica: string): string | null {
  const m = /^concat\((.*)\)$/.exec(concat.trim());
  const args = m ? argumentos(m[1]!) : null;
  if (!args) return null;
  let out = "";
  for (const a of args) {
    const l = LIT.exec(a);
    const r = REF.exec(a);
    if (l) out += l[1] ?? l[2] ?? "";
    else if (r && r[1] === actor) out += "{actor}";
    else if (r && r[1] === politica) out += "{politica}";
    else return null;
  }
  return out;
}

/** Corta `if(${brazo} = '1', A, B)` en sus dos ramas, respetando paréntesis y comillas. */
function ramas(f: string): { brazo: string; control: string; respaldo: string } | null {
  const m = /^if\(\$\{([^}]+)\} = '1', (.*)\)$/.exec(f.trim());
  if (!m) return null;
  const resto = m[2]!;
  let nivel = 0;
  let comilla: string | null = null;
  for (let i = 0; i < resto.length; i += 1) {
    const c = resto[i]!;
    if (comilla) { if (c === comilla) comilla = null; continue; }
    if (c === "'" || c === '"') comilla = c;
    else if (c === "(") nivel += 1;
    else if (c === ")") nivel -= 1;
    else if (c === "," && nivel === 0) return { brazo: m[1]!, control: resto.slice(0, i).trim(), respaldo: resto.slice(i + 1).trim() };
  }
  return null;
}

export function leerRespaldo(wb: (Pick<XlsformEditorWorkbook, "survey"> & Partial<Pick<XlsformEditorWorkbook, "choices">>) | null): LecturaRespaldo[] {
  if (!wb) return [];
  const survey = wb.survey;
  const filas = survey.rows.map((_, i) => {
    const r = rowToRecord(survey, i);
    const v = (k: string) => (r[k] ?? "").trim();
    return { i, type: v("type"), name: v("name"), label: r.label ?? "", calculation: v("calculation") };
  });
  const porNombre = new Map(filas.filter((f) => f.name).map((f) => [f.name, f]));
  const padre = new Map<number, number | null>();
  const pila: number[] = [];
  for (const f of filas) {
    padre.set(f.i, pila[pila.length - 1] ?? null);
    if (/^begin[ _]group$/.test(f.type)) pila.push(f.i);
    else if (/^end[ _]group$/.test(f.type)) pila.pop();
  }

  // Cada política: un cálculo-frase que corta por el brazo y cita al actor y a su texto.
  type Pol = { texto: typeof filas[number]; politica: typeof filas[number]; control: string; respaldo: string; brazo: string; actor: string };
  const porBrazo = new Map<string, Pol[]>();
  for (const f of filas) {
    if (f.type !== "calculate") continue;
    const r = ramas(f.calculation);
    if (!r) continue;
    const refs = [...f.calculation.matchAll(/\$\{([^}]+)\}/g)].map((m) => m[1]!).filter((x) => x !== r.brazo);
    const politica = refs.map((x) => porNombre.get(x)).find((x) => x && LIT.test(x.calculation));
    const actor = refs.find((x) => x !== politica?.name);
    if (!politica || !actor) continue;
    const control = frase(r.control, actor, politica.name);
    const respaldo = frase(r.respaldo, actor, politica.name);
    if (control == null || respaldo == null) continue;
    const lista = porBrazo.get(r.brazo) ?? [];
    lista.push({ texto: f, politica, control, respaldo, brazo: r.brazo, actor });
    porBrazo.set(r.brazo, lista);
  }

  const out: LecturaRespaldo[] = [];
  for (const [brazoNombre, pols] of porBrazo) {
    const brazo = porNombre.get(brazoNombre);
    const ln = leerNivel(brazo?.calculation ?? "");
    const azar = ln ? porNombre.get(ln.azar) : undefined;
    const actor = porNombre.get(pols[0]!.actor);
    const lt = leerTexto(actor?.calculation ?? "");
    if (!brazo || !ln || ln.omiteSi || ln.pesos || !azar || azar.calculation.replace(/\s/g, "") !== "once(random())" || !actor || !lt) continue;
    if (lt.nivel !== brazo.name || lt.niveles[0]?.codigo !== "1") continue;
    const politicas = pols.map((p) => {
      const nota = filas.find((x) => x.type === "note" && x.label.trim() === `\${${p.texto.name}}`);
      const grupo = nota ? padre.get(nota.i) ?? null : null;
      const apoyo = nota ? filas.find((x) => x.i > nota.i && padre.get(x.i) === grupo && /^select_one\s/.test(x.type)) : undefined;
      return { p, nota, grupo, apoyo };
    });
    if (politicas.some((x) => !x.nota || !x.apoyo)) continue;
    const prefijo = /^(.+)_brazo$/.exec(brazo.name)?.[1] ?? brazo.name;
    const lista = politicas[0]!.apoyo!.type.replace(/^select_one\s+/, "").trim();
    const choices = wb.choices;
    const opciones = choices
      ? choices.rows.map((_, i) => rowToRecord(choices, i)).filter((r) => (r.list_name ?? "").trim() === lista).map((r) => ({ codigo: Number((r.name ?? "").trim()), label: (r.label ?? "").trim() }))
      : [{ codigo: 1, label: "1" }, { codigo: 2, label: "2" }];
    if (opciones.length < 2 || opciones.some((o, k) => !Number.isInteger(o.codigo) || o.codigo !== opciones[0]!.codigo + k)) continue;
    const extremo = (o: { codigo: number; label: string }) => o.label.replace(new RegExp(`^${o.codigo}\\s*`), "");
    const diseno: DisenoRespaldo = {
      prefijo,
      actores: lt.niveles.slice(1).map((x) => x.texto),
      politicas: pols.map((p) => (LIT.exec(p.politica.calculation)?.slice(1).find((x) => x != null) ?? "")),
      fraseControl: pols[0]!.control,
      fraseRespaldo: pols[0]!.respaldo,
      pregunta: politicas[0]!.apoyo!.label.trim(),
      escala: { min: opciones[0]!.codigo, max: opciones[opciones.length - 1]!.codigo, etiquetaMin: extremo(opciones[0]!), etiquetaMax: extremo(opciones[opciones.length - 1]!) },
    };
    const sorteo = [azar.i, brazo.i, actor.i].sort((a, b) => a - b);
    const lasFilas = new Set<number>(sorteo);
    const primerNivel = new Set<number>(sorteo);
    for (const x of politicas) {
      [x.p.texto.i, x.p.politica.i, x.nota!.i, x.apoyo!.i].forEach((i) => lasFilas.add(i));
      if (x.grupo != null) {
        primerNivel.add(x.grupo);
        lasFilas.add(x.grupo);
        const cierre = filas.find((f) => f.i > x.apoyo!.i && /^end[ _]group$/.test(f.type));
        if (cierre) lasFilas.add(cierre.i);
      } else [x.p.texto.i, x.p.politica.i, x.nota!.i, x.apoyo!.i].forEach((i) => primerNivel.add(i));
    }
    let motivo: string | null = choices ? validarRespaldo(diseno)[0] ?? null : "Falta la hoja choices para leer la escala.";
    if (!motivo && pols.some((p) => p.control !== diseno.fraseControl || p.respaldo !== diseno.fraseRespaldo)) motivo = "Las políticas no usan las mismas frases.";
    const n = nombresRespaldo(prefijo);
    if (!motivo && (n.azar !== azar.name || n.actor !== actor.name)) motivo = "Los cálculos no se llaman como los nombra el editor.";
    if (!motivo) {
      const { survey: nuevas, choices: nuevasOpciones } = generarRespaldo(diseno);
      for (const g of nuevas) {
        if (!g.name) continue;
        const f = porNombre.get(g.name);
        const igual = f && f.type === g.type && (g.type === "calculate" ? f.calculation === g.calculation : f.label.trim() === (g.label ?? "").trim());
        if (!igual) {
          motivo = `"${g.name}" no está escrito como lo escribe el editor.`;
          break;
        }
      }
      if (!motivo && nuevasOpciones.some((c, k) => opciones[k]?.label !== c.label)) motivo = `La escala "${lista}" no está escrita como la escribe el editor.`;
    }
    out.push({
      diseno,
      politicas: politicas.map((x) => ({ pagina: x.grupo, politica: x.p.politica.i, texto: x.p.texto.i, frase: x.nota!.i, apoyo: x.apoyo!.i })),
      sorteo,
      primerNivel: [...primerNivel].sort((a, b) => a - b),
      filas: [...lasFilas].sort((a, b) => a - b),
      fiel: motivo == null,
      motivo,
    });
  }
  return out;
}

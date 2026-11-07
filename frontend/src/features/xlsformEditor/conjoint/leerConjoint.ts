// Reconoce un experimento de elección por pares ya escrito en el formulario (checklist elección por pares C4,
// 2026-11-07). Sirve igual para el que genera el editor y para uno escrito fuera (el XLSForm del v5 del TCD): parte de
// las notas con tabla de dos perfiles, sigue sus `${…_txt}` hasta el sorteo y lee de las fórmulas el diseño (pares,
// perfiles, atributos, niveles, pesos y condiciones). Conserva los nombres que tienen las filas.
//
// Sólo se declara «fiel» si el diseño leído vuelve a generar exactamente las mismas filas: así editarlo desde el panel
// no cambia nada que no se haya tocado.

import { rowToRecord } from "../parsing/sheetUtils";
import type { XlsformEditorWorkbook } from "../types";
import {
  generarConjoint,
  validarDiseno,
  type AtributoConjoint,
  type DisenoConjoint,
  type NivelConjoint,
  type NombresConjoint,
} from "./modeloConjoint";

type Perfil = "A" | "B";
const PERFILES: readonly Perfil[] = ["A", "B"];

export type ParLeido = { tarea: number; grupo: number; fin: number; tabla: number; eleccion: number };

export type LecturaConjoint = {
  diseno: DisenoConjoint;
  nombres: NombresConjoint;
  pares: ParLeido[];
  /** Fila de cada cálculo del sorteo → par al que pertenece. */
  sorteo: ReadonlyMap<number, number>;
  intro: number | null;
  /** Todas las filas del survey que forman el experimento. */
  filas: number[];
  /** El diseño leído regenera las mismas filas: se puede editar desde el panel. */
  fiel: boolean;
  motivo: string | null;
};

type Fila = { i: number; type: string; name: string; label: string; calculation: string; appearance: string; required: string };

const LIT = String.raw`('(?:[^']*)'|"(?:[^"]*)")`;
const desLit = (s: string) => s.slice(1, -1);
const REF = String.raw`\$\{([^}]+)\}`;

/** `if(${N} = 'c', 'texto', …'—')`: la variable del nivel y sus niveles con su texto. */
function leerTexto(f: string): { nivel: string; niveles: NivelConjoint[] } | null {
  const re = new RegExp(String.raw`^if\(${REF} = ${LIT}, ${LIT}, `);
  const niveles: NivelConjoint[] = [];
  let nivel: string | null = null;
  let resto = f.trim();
  for (;;) {
    const m = re.exec(resto);
    if (!m) break;
    if (nivel && m[1] !== nivel) return null;
    nivel = m[1]!;
    niveles.push({ codigo: desLit(m[2]!), texto: desLit(m[3]!) });
    resto = resto.slice(m[0].length);
    if (!resto.endsWith(")")) return null;
    resto = resto.slice(0, -1);
  }
  return nivel && niveles.length >= 2 && new RegExp(`^${LIT}$`).test(resto) ? { nivel, niveles } : null;
}

/** Fórmula del nivel: condición «se omite si», número al azar, códigos y pesos. */
function leerNivel(f: string): { azar: string; codigos: string[]; pesos: number[] | null; omiteSi: { base: string; noEs: string[] } | null } | null {
  let resto = f.trim();
  let omiteSi: { base: string; noEs: string[] } | null = null;
  const cond = new RegExp(String.raw`^if\(((?:${REF} = ${LIT})(?: or ${REF} = ${LIT})*), 'NA', `).exec(resto);
  if (cond) {
    const partes = [...cond[1]!.matchAll(new RegExp(String.raw`${REF} = ${LIT}`, "g"))];
    const base = partes[0]![1]!;
    if (partes.some((p) => p[1] !== base) || !resto.endsWith(")")) return null;
    omiteSi = { base, noEs: partes.map((p) => desLit(p[2]!)) };
    resto = resto.slice(cond[0].length, -1);
  }
  const equi = new RegExp(String.raw`^if\(int\(${REF} \* (\d+)\) = (\d+), ${LIT}, `);
  const peso = new RegExp(String.raw`^if\(${REF} < ([0-9.]+), ${LIT}, `);
  const codigos: string[] = [];
  const cortes: number[] = [];
  let azar: string | null = null;
  let modo: "equi" | "peso" | null = null;
  for (;;) {
    const e = equi.exec(resto);
    const w = e ? null : peso.exec(resto);
    const m = e ?? w;
    if (!m) break;
    const esteModo = e ? "equi" : "peso";
    if ((modo && modo !== esteModo) || (azar && m[1] !== azar)) return null;
    modo = esteModo;
    azar = m[1]!;
    if (e) {
      if (Number(e[3]) !== codigos.length) return null;
      codigos.push(desLit(e[4]!));
    } else {
      cortes.push(Number(w![2]));
      codigos.push(desLit(w![3]!));
    }
    resto = resto.slice(m[0].length);
    if (!resto.endsWith(")")) return null;
    resto = resto.slice(0, -1);
  }
  const ultimo = new RegExp(`^${LIT}$`).exec(resto);
  if (!azar || !ultimo) return null;
  codigos.push(desLit(ultimo[1]!));
  let pesos: number[] | null = null;
  if (modo === "peso") {
    const acumulados = [...cortes, 1];
    pesos = acumulados.map((c, k) => Math.round((c - (k ? acumulados[k - 1]! : 0)) * 1e6) / 1e6);
  }
  return { azar, codigos, pesos, omiteSi };
}

/** La tabla de dos perfiles de una nota: encabezados y, por fila, el rótulo y la variable de cada perfil. */
function leerTabla(label: string): { perfiles: [string, string]; filas: { rotulo: string; a: string; b: string }[] } | null {
  const lineas = label.trim().split("\n").map((l) => l.trim());
  const celdas = (l: string) => (l.startsWith("|") && l.endsWith("|") ? l.slice(1, -1).split("|").map((c) => c.trim()) : null);
  const cab = celdas(lineas[0] ?? "");
  if (!cab || cab.length !== 3 || cab[0] !== "" || !/^\|[-\s|:]+\|$/.test(lineas[1] ?? "")) return null;
  const filas: { rotulo: string; a: string; b: string }[] = [];
  for (const l of lineas.slice(2)) {
    const c = celdas(l);
    const a = c?.[1]?.match(/^\$\{([^}]+)\}$/)?.[1];
    const b = c?.[2]?.match(/^\$\{([^}]+)\}$/)?.[1];
    if (!c || c.length !== 3 || !a || !b) return null;
    filas.push({ rotulo: c[0]!, a, b });
  }
  return filas.length >= 2 ? { perfiles: [cab[1]!, cab[2]!], filas } : null;
}

/** Plantilla por par a partir de los nombres del par 1 y del 2 («tarea1» y «tarea2» → «tarea{t}»). */
function porPar(n1: string, n2: string | undefined): ((t: number) => string) | null {
  if (n2 == null) {
    const k = n1.lastIndexOf("1");
    return k < 0 ? null : (t) => `${n1.slice(0, k)}${t}${n1.slice(k + 1)}`;
  }
  let pre = 0;
  while (pre < n1.length && n1[pre] === n2[pre]) pre += 1;
  let suf = 0;
  while (suf < n1.length - pre && n1[n1.length - 1 - suf] === n2[n2.length - 1 - suf]) suf += 1;
  if (n1.slice(pre, n1.length - suf) !== "1" || n2.slice(pre, n2.length - suf) !== "2") return null;
  const a = n1.slice(0, pre);
  const z = n1.slice(n1.length - suf);
  return (t) => `${a}${t}${z}`;
}

/** Plantilla por par, perfil y atributo: «t1A_r_curso» → (t, P, clave) => `t${t}${P}_r_${clave}`. */
function porVariable(muestra: string, clave: string, n2: string | undefined): ((t: number, p: Perfil, c: string) => string) | null {
  const k = muestra.lastIndexOf(clave);
  if (k < 0) return null;
  const sinClave = `${muestra.slice(0, k)}\u0000${muestra.slice(k + clave.length)}`;
  const enPar = porPar(sinClave, n2 == null ? undefined : `${n2.slice(0, n2.lastIndexOf(clave))}\u0000${n2.slice(n2.lastIndexOf(clave) + clave.length)}`);
  if (!enPar) return null;
  const marca = enPar(0);
  const j = marca.indexOf("0A");
  if (j < 0) return null;
  return (t, p, c) => `${marca.slice(0, j)}${t}${p}${marca.slice(j + 2)}`.replace("\u0000", c);
}

const sufijoComun = (xs: string[]) => {
  let s = xs[0] ?? "";
  for (const x of xs) while (s && !x.endsWith(s)) s = s.slice(1);
  return s.replace(/^[^A-Za-z0-9]+/, "");
};

/** Sólo lee la hoja survey: la ficha, que no tiene choices a mano, también lo puede llamar. */
export function leerConjoint(wb: Pick<XlsformEditorWorkbook, "survey"> | null): LecturaConjoint | null {
  if (!wb) return null;
  const survey = wb.survey;
  const filas: Fila[] = survey.rows.map((_, i) => {
    const r = rowToRecord(survey, i);
    return { i, type: (r.type ?? "").trim(), name: (r.name ?? "").trim(), label: r.label ?? "", calculation: (r.calculation ?? "").trim(), appearance: (r.appearance ?? "").trim(), required: (r.required ?? "").trim() };
  });
  const porNombre = new Map(filas.filter((f) => f.name).map((f) => [f.name, f]));

  // Grupo que contiene cada fila y cierre de cada grupo.
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

  // Notas con tabla de dos perfiles; un experimento = las que comparten encabezados y rótulos.
  const tablas = filas.flatMap((f) => {
    if (f.type !== "note") return [];
    const t = leerTabla(f.label);
    return t ? [{ fila: f, ...t, firma: `${t.perfiles.join("|")}#${t.filas.map((x) => x.rotulo).join("|")}` }] : [];
  });
  if (!tablas.length) return null;
  const firma = tablas[0]!.firma;
  const notas = tablas.filter((t) => t.firma === firma);

  const pares: ParLeido[] = [];
  for (const [k, n] of notas.entries()) {
    const grupo = padre.get(n.fila.i);
    if (grupo == null) return null;
    const eleccion = filas.find((f) => f.i > n.fila.i && padre.get(f.i) === grupo && /^select_one\s/.test(f.type));
    if (!eleccion) return null;
    pares.push({ tarea: k + 1, grupo, fin: cierre.get(grupo) ?? grupo, tabla: n.fila.i, eleccion: eleccion.i });
  }

  // Atributos desde el par 1: texto → nivel → número al azar.
  const nombreDe = new Map<string, string>();
  const clave = (tipo: string, t: number, p: Perfil, k: number) => `${tipo}|${t}|${p}|${k}`;
  const atributos: AtributoConjoint[] = [];
  const base = notas[0]!;
  for (const [k, fila] of base.filas.entries()) {
    const lecturas: { t: number; p: Perfil; texto: string; nivel: string; azar: string }[] = [];
    let niveles: NivelConjoint[] | null = null;
    let soloSi: { base: string; noEs: string[] } | null = null;
    for (const [ti, n] of notas.entries()) {
      for (const p of PERFILES) {
        const textoN = p === "A" ? n.filas[k]!.a : n.filas[k]!.b;
        const lt = leerTexto(porNombre.get(textoN)?.calculation ?? "");
        if (!lt) return null;
        const ln = leerNivel(porNombre.get(lt.nivel)?.calculation ?? "");
        if (!ln || (porNombre.get(ln.azar)?.calculation ?? "").replace(/\s/g, "") !== "once(random())") return null;
        if (!niveles) {
          if (ln.codigos.join("|") !== lt.niveles.map((x) => x.codigo).join("|")) return null;
          niveles = lt.niveles.map((x, j) => (ln.pesos ? { ...x, peso: ln.pesos[j]! } : x));
          soloSi = ln.omiteSi;
        }
        lecturas.push({ t: ti + 1, p, texto: textoN, nivel: lt.nivel, azar: ln.azar });
      }
    }
    const c = sufijoComun(lecturas.map((l) => l.nivel));
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(c)) return null;
    for (const l of lecturas) {
      nombreDe.set(clave("texto", l.t, l.p, k), l.texto);
      nombreDe.set(clave("nivel", l.t, l.p, k), l.nivel);
      nombreDe.set(clave("azar", l.t, l.p, k), l.azar);
    }
    atributos.push({ clave: c, rotulo: fila.rotulo, niveles: niveles!, ...(soloSi ? { soloSi: { atributo: soloSi.base, noEs: soloSi.noEs } } : {}) });
  }
  // La condición apunta a la variable de nivel del par 1 perfil A; se traduce a la clave del atributo.
  for (const a of atributos) {
    if (!a.soloSi) continue;
    const k = atributos.findIndex((_, j) => nombreDe.get(clave("nivel", 1, "A", j)) === a.soloSi!.atributo);
    if (k < 0) return null;
    a.soloSi = { atributo: atributos[k]!.clave, noEs: a.soloSi.noEs };
  }

  // Nombres: plantillas desde el par 1 y el 2 (o sólo el 1); los existentes se leen tal cual.
  const n1 = (tipo: string, p: Perfil, k: number, t = 1) => nombreDe.get(clave(tipo, t, p, k));
  const plant = (tipo: string) => porVariable(n1(tipo, "A", 0)!, atributos[0]!.clave, n1(tipo, "A", 0, 2));
  const pAzar = plant("azar");
  const pNivel = plant("nivel");
  const pTexto = plant("texto");
  const segundo = pares[1];
  const pGrupo = porPar(filas[pares[0]!.grupo]!.name, segundo ? filas[segundo.grupo]!.name : undefined);
  const pTabla = porPar(filas[pares[0]!.tabla]!.name, segundo ? filas[segundo.tabla]!.name : undefined);
  const pEleccion = porPar(filas[pares[0]!.eleccion]!.name, segundo ? filas[segundo.eleccion]!.name : undefined);
  if (!pAzar || !pNivel || !pTexto || !pGrupo || !pTabla || !pEleccion) return null;
  const eleccion1 = filas[pares[0]!.eleccion]!;
  const primerGrupo = pares[0]!.grupo;
  const previa = filas.filter((f) => f.i < primerGrupo && padre.get(f.i) === padre.get(primerGrupo)).pop();
  const intro = previa && previa.type === "note" && !leerTabla(previa.label) ? previa : null;

  const prefijoEditor = /^([A-Za-z_][A-Za-z0-9_]*)_t1A_/.exec(n1("nivel", "A", 0)!)?.[1];
  const nombres: NombresConjoint = {
    azar: pAzar,
    nivel: pNivel,
    texto: pTexto,
    grupo: pGrupo,
    tabla: pTabla,
    eleccion: pEleccion,
    lista: eleccion1.type.replace(/^select_one\s+/, "").trim(),
    intro: intro?.name ?? `${prefijoEditor ?? "pares"}_intro`,
  };
  const diseno: DisenoConjoint = {
    prefijo: prefijoEditor ?? "cj",
    tareas: pares.length,
    rotulosPerfil: base.perfiles,
    atributos,
    pregunta: eleccion1.label.trim(),
    ...(intro ? { intro: intro.label.trim() } : {}),
    ordenAleatorio: false,
  };

  const sorteo = new Map<number, number>();
  for (const [key, nombre] of nombreDe) {
    const f = porNombre.get(nombre);
    if (f) sorteo.set(f.i, Number(key.split("|")[1]));
  }
  const delExperimento = new Set<number>(sorteo.keys());
  if (intro) delExperimento.add(intro.i);
  for (const p of pares) for (let i = p.grupo; i <= p.fin; i += 1) delExperimento.add(i);

  // ¿El diseño leído vuelve a escribir lo mismo?
  let motivo: string | null = validarDiseno(diseno)[0] ?? null;
  if (!motivo) {
    const { survey: nuevas } = generarConjoint(diseno, nombres);
    for (const n of nuevas) {
      if (!n.name) continue;
      const f = porNombre.get(n.name);
      const igual = f && f.type === n.type && (n.type === "calculate" ? f.calculation === n.calculation : f.label.trim() === n.label.trim());
      if (!igual) {
        motivo = `«${n.name}» no está escrito como lo escribe el editor.`;
        break;
      }
    }
    if (!motivo && nuevas.filter((n) => n.name).length !== [...delExperimento].filter((i) => filas[i]!.name).length) {
      motivo = "El experimento tiene filas que el editor no genera.";
    }
  }

  return {
    diseno,
    nombres,
    pares,
    sorteo,
    intro: intro?.i ?? null,
    filas: [...delExperimento].sort((a, b) => a - b),
    fiel: motivo == null,
    motivo,
  };
}

// Voz de RESTRICCIÓN (constraint): dice lo que la pregunta ACEPTA, con el vocabulario de su tipo.
//   . <= today()                 (fecha)   → No acepta fechas futuras
//   . >= ${fecha_nac}            (fecha)   → No puede ser anterior a ‹Fecha de nacimiento›
//   . >= 18 and . <= 100         (número)  → De 18 a 100
//   . <= ${total}                (número)  → No puede superar ‹Total›
//   string-length(.) <= 9        (texto)   → Máximo 9 caracteres
//   count-selected(.) <= 3       (varias)  → Máximo 3 opciones
//   not(selected(., '99') and count-selected(.) > 1) → ‹No sabe› no se puede marcar junto con otras opciones
//   if(${p} = '1', . = '2', true())        → Si ‹P› es ‹Sí›, solo acepta ‹No›
// Las partes que no tocan la respuesta («.») se leen como condición: «…, solo si ‹X› es 6 o más».

import type { CompareOp, Expr } from "../../logic";
import { type Clase, type Contexto, tocaActual } from "./contexto";
import { cantidad, capitalizar, enumerar, oraciones, t, unir, v, type Frase } from "./frase";
import { claseComparacion, leerCondicion, valorComparado } from "./condicion";
import { negar } from "./normalizar";
import { leerLapsoComparado } from "./lapso";
import { clasePresente, leerPatron } from "./regex";
import { numeroDe, textoDe } from "./valores";
import { leerValor } from "./valor";

type Comparacion = Extract<Expr, { kind: "compare" }>;
type Medida = "respuesta" | "caracteres" | "opciones" | "otro";

const esLlamadaSobreActual = (e: Expr, nombre: string) => e.kind === "call" && e.name === nombre && e.args.length === 1 && e.args[0]!.kind === "current";

function medidaDe(e: Expr): Medida {
  if (e.kind === "current") return "respuesta";
  if (esLlamadaSobreActual(e, "string-length")) return "caracteres";
  if (esLlamadaSobreActual(e, "count-selected")) return "opciones";
  return "otro";
}

const UNIDAD: Record<"caracteres" | "opciones", [string, string]> = { caracteres: ["carácter", "caracteres"], opciones: ["opción", "opciones"] };

/** Cota de conteo: «máximo 9 caracteres», «al menos 1 opción». */
function cotaConteo(op: CompareOp, n: string, medida: "caracteres" | "opciones"): Frase | null {
  const [s, p] = UNIDAD[medida];
  const c = cantidad(n, s, p);
  const palabra: Record<CompareOp, string> = { "<=": "máximo", "<": "menos de", ">=": medida === "opciones" ? "al menos" : "mínimo", ">": "más de", "=": "exactamente", "!=": "cualquier cantidad salvo" };
  return [t(palabra[op]), c];
}

/** Exigencia sobre la propia respuesta, por clase. */
function sobreRespuesta(c: Comparacion, ctx: Contexto): Frase | null {
  if (c.right.kind === "literal" && c.right.value === "" && (c.op === "=" || c.op === "!=")) return [t(c.op === "=" ? "tiene que quedar vacía" : "no puede quedar vacía")];
  const valor = valorComparado(c.right, c.left, ctx);
  if (!valor) return null;
  const clase = claseComparacion(c, ctx);
  const esHoy = c.right.kind === "call" && c.right.name === "today";
  if (clase === "fecha" || clase === "hora") {
    if (esHoy) {
      const hoy: Record<CompareOp, string> = { "<=": "no acepta fechas futuras", "<": "solo fechas anteriores a hoy", ">=": "no acepta fechas pasadas", ">": "solo fechas posteriores a hoy", "=": "solo la fecha de hoy", "!=": "no acepta la fecha de hoy" };
      return [t(hoy[c.op])];
    }
    const p: Record<CompareOp, string> = { ">=": "no puede ser anterior a", ">": "tiene que ser posterior a", "<=": "no puede ser posterior a", "<": "tiene que ser anterior a", "=": "tiene que ser", "!=": "no puede ser" };
    return [t(p[c.op]), ...valor];
  }
  const conPregunta = c.right.kind === "ref";
  switch (c.op) {
    case "=":
      return conPregunta ? [t("tiene que ser igual a"), ...valor] : [t("solo acepta"), ...valor];
    case "!=":
      return conPregunta ? [t("no puede ser igual a"), ...valor] : [t("no acepta"), ...valor];
    case ">=":
      return conPregunta ? [t("no puede ser menor que"), ...valor] : [...valor, t("o más")];
    case ">":
      return [t("mayor que"), ...valor];
    case "<=":
      return [t("no puede superar"), ...valor];
    case "<":
      return [t("menor que"), ...valor];
  }
}

/** Exigencia sobre otra cosa (otra pregunta, un dato de una tabla): «‹X› no puede ser ‹Sí›». */
function sobreOtro(c: Comparacion, ctx: Contexto): Frase | null {
  const sujeto = leerValor(c.left, ctx);
  if (!sujeto) return null;
  if (c.right.kind === "literal" && c.right.value === "" && (c.op === "=" || c.op === "!=")) return [...sujeto, t(c.op === "=" ? "tiene que quedar vacío" : "no puede quedar vacío")];
  const valor = valorComparado(c.right, c.left, ctx);
  if (!valor) return null;
  const clase: Clase = claseComparacion(c, ctx);
  const fecha = clase === "fecha" || clase === "hora";
  const p: Record<CompareOp, string> = fecha
    ? { ">=": "no puede ser anterior a", ">": "tiene que ser posterior a", "<=": "no puede ser posterior a", "<": "tiene que ser anterior a", "=": "tiene que ser", "!=": "no puede ser" }
    : { ">=": "tiene que ser al menos", ">": "tiene que ser mayor que", "<=": "no puede superar", "<": "tiene que ser menor que", "=": "tiene que ser", "!=": "no puede ser" };
  return [...sujeto, t(p[c.op]), ...valor];
}

function comparacion(c: Comparacion, ctx: Contexto): Frase | null {
  const lapso = leerLapsoComparado(c, ctx);
  if (lapso) return lapso;
  const medida = medidaDe(c.left);
  if (medida === "caracteres" || medida === "opciones") {
    const n = numeroDe(c.right);
    return n !== null ? cotaConteo(c.op, String(n), medida) : null;
  }
  if (medida === "respuesta") return sobreRespuesta(c, ctx);
  return sobreOtro(c, ctx);
}

/** Dos cotas sobre la misma medida: «de 18 a 100», «de 1 a 5000 caracteres», «desde hace 396 días hasta hoy». */
function rango(a: Comparacion, b: Comparacion, ctx: Contexto): Frase | null {
  if (JSON.stringify(a.left) !== JSON.stringify(b.left)) return null;
  const baja = [a, b].find((c) => c.op === ">=" || c.op === ">");
  const alta = [a, b].find((c) => c.op === "<=" || c.op === "<");
  if (!baja || !alta) return null;
  const medida = medidaDe(baja.left);
  if (medida === "caracteres" || medida === "opciones") {
    const lo = numeroDe(baja.right);
    const hi = numeroDe(alta.right);
    if (lo === null || hi === null) return null;
    const [s, p] = UNIDAD[medida];
    const min = baja.op === ">" ? lo + 1 : lo;
    const max = alta.op === "<" ? hi - 1 : hi;
    if (min === max) return [t("exactamente"), cantidad(String(min), s, p)];
    return [t("de"), v(String(min)), t("a"), v(`${max} ${p}`)];
  }
  const vb = valorComparado(baja.right, baja.left, ctx);
  const va = valorComparado(alta.right, alta.left, ctx);
  if (!vb || !va) return null;
  const fecha = ["fecha", "hora"].includes(claseComparacion(baja, ctx)) || ["fecha", "hora"].includes(claseComparacion(alta, ctx));
  const cerrado = baja.op === ">=" && alta.op === "<=";
  const cuerpo: Frase = fecha
    ? cerrado ? [t("desde"), ...vb, t("hasta"), ...va] : [t(baja.op === ">" ? "posterior a" : "desde"), ...vb, t("y"), t(alta.op === "<" ? "anterior a" : "hasta"), ...va]
    : cerrado
      ? JSON.stringify(vb) === JSON.stringify(va) ? [t("exactamente"), ...vb] : [t("de"), ...vb, t("a"), ...va]
      : [t(baja.op === ">" ? "mayor que" : "desde"), ...vb, t("y"), t(alta.op === "<" ? "menor que" : "hasta"), ...va];
  if (medida === "respuesta") return cuerpo;
  const sujeto = leerValor(baja.left, ctx);
  return sujeto ? [...sujeto, t("tiene que estar"), ...(fecha ? cuerpo : cerrado ? [t("entre"), ...vb, t("y"), ...va] : cuerpo)] : null;
}

const esSeleccionActual = (e: Expr): e is Extract<Expr, { kind: "call" }> => e.kind === "call" && e.name === "selected" && e.args.length === 2 && e.args[0]!.kind === "current";

/** Valores de selected(., v) — o de un or de ellos —; null si no tiene esa forma. */
function seleccionados(e: Expr): Expr[] | null {
  if (esSeleccionActual(e)) return [e.args[1]!];
  if (e.kind === "logical" && e.op === "or") {
    const vs = e.operands.map(seleccionados);
    return vs.every(Boolean) ? (vs as Expr[][]).flat() : null;
  }
  return null;
}

const esVariasMarcadas = (e: Expr) => e.kind === "compare" && esLlamadaSobreActual(e.left, "count-selected") && ((e.op === ">" && numeroDe(e.right) === 1) || (e.op === ">=" && numeroDe(e.right) === 2));

/** Opciones que «van solas»: not(<opciones> and count-selected(.) > 1). null si no tiene esa forma. */
function soloSolas(e: Expr): Expr[] | null {
  if (e.kind !== "not") return null;
  const x = e.operand;
  if (x.kind !== "logical" || x.op !== "and" || x.operands.length !== 2) return null;
  const cuenta = x.operands.find(esVariasMarcadas);
  if (!cuenta) return null;
  return seleccionados(x.operands.find((o) => o !== cuenta)!);
}

function opcionesDeActual(vals: Expr[], ctx: Contexto): Frase[] | null {
  const fs = vals.map((val) => valorComparado(val, { kind: "current" }, ctx));
  return fs.every(Boolean) ? (fs as Frase[]) : null;
}

function fraseSolas(vals: Expr[], ctx: Contexto): Frase | null {
  const fs = opcionesDeActual(vals, ctx);
  if (!fs) return null;
  return [...enumerar(fs, "y"), t(fs.length === 1 ? "no se puede marcar junto con otras opciones" : "no se pueden marcar junto con otras opciones")];
}

/** not(<opciones> and count-selected(.) > 1) y not(selected(., a) and selected(., b)). */
function exclusiva(e: Extract<Expr, { kind: "not" }>, ctx: Contexto): Frase | null {
  const solas = soloSolas(e);
  if (solas) return fraseSolas(solas, ctx);
  const x = e.operand;
  if (x.kind === "logical" && x.op === "and" && x.operands.length === 2 && x.operands.every(esSeleccionActual)) {
    const fs = opcionesDeActual(x.operands.map((o) => (o as Extract<Expr, { kind: "call" }>).args[1]!), ctx);
    return fs ? [...enumerar(fs, "y"), t("no se pueden marcar juntas")] : null;
  }
  return null;
}

/** Una exigencia suelta (cualquier nodo). */
function exigencia(e: Expr, ctx: Contexto): Frase | null {
  switch (e.kind) {
    case "compare":
      return comparacion(e, ctx);
    case "logical":
      return e.op === "and" ? conjuncion(e.operands, ctx, false) : disyuncion(e, ctx);
    case "not": {
      const ex = exclusiva(e, ctx);
      if (ex) return ex;
      // not(regex(., '\s')): no aparece ningún espacio en ninguna parte.
      const o = e.operand;
      if (o.kind === "call" && o.name === "regex" && o.args.length === 2 && o.args[0]!.kind === "current") {
        const buscada = clasePresente(textoDe(o.args[1]) ?? "");
        if (buscada) return [t("sin"), t(buscada)];
      }
      if (esSeleccionActual(e.operand)) {
        const val = valorComparado(e.operand.args[1]!, e.operand.args[0]!, ctx);
        return val ? [t("no acepta"), ...val] : null;
      }
      const n = negar(e.operand);
      if (n && n.kind !== "not") return exigencia(n, ctx);
      if (n && n.kind === "not" && n.operand.kind === "call" && n.operand.name === "selected") {
        const sujeto = leerValor(n.operand.args[0]!, ctx);
        const val = valorComparado(n.operand.args[1]!, n.operand.args[0]!, ctx);
        return sujeto && val ? [...sujeto, t("no puede incluir"), ...val] : null;
      }
      const f = leerCondicion(e.operand, ctx);
      return f ? [t("no puede pasar que"), ...f] : null;
    }
    case "call": {
      if (e.name === "selected" && e.args.length === 2) {
        const val = valorComparado(e.args[1]!, e.args[0]!, ctx);
        if (!val) return null;
        if (e.args[0]!.kind === "current") return [t("tiene que incluir"), ...val];
        const sujeto = leerValor(e.args[0]!, ctx);
        return sujeto ? [...sujeto, t("tiene que incluir"), ...val] : null;
      }
      if (e.name === "regex" && e.args.length === 2) {
        const patron = leerPatron(textoDe(e.args[1]) ?? "");
        if (!patron) return null;
        // «sin números» es una exclusión: «no acepta números», no «solo acepta sin números».
        if (e.args[0]!.kind === "current") return esSin(patron) ? [t("no acepta"), ...patron.slice(1)] : [t("solo acepta"), ...patron];
        const sujeto = leerValor(e.args[0]!, ctx);
        return sujeto ? [...sujeto, t("tiene que ser"), ...patron] : null;
      }
      if (e.name === "if" && e.args.length === 3) return condicional(e, ctx);
      return null;
    }
    case "literal":
      return typeof e.value === "boolean" ? [t(e.value ? "acepta cualquier respuesta" : "no acepta ninguna respuesta")] : null;
    default:
      return null;
  }
}

/** if(c, r, true()) → «Si c, r»; if(c, r1, r2) → «Si c, r1. Si no, r2». */
function condicional(e: Extract<Expr, { kind: "call" }>, ctx: Contexto): Frase | null {
  const [c, si, no] = e.args as [Expr, Expr, Expr];
  const fc = leerCondicion(c, ctx);
  const fsi = exigencia(si, ctx);
  if (!fc || !fsi) return null;
  const primera: Frase = [t("si"), ...fc, t(","), ...fsi];
  if (no.kind === "literal" && no.value === true) return primera;
  const fno = exigencia(no, ctx);
  return fno ? oraciones([primera, [t("si no,"), ...fno]]) : null;
}

/** (cond and req) or (cond and req) … → un caso por oración: «Si ‹P8› es ‹A›, solo acepta ‹1›». */
function disyuncion(e: Extract<Expr, { kind: "logical" }>, ctx: Contexto): Frase | null {
  const casos = e.operands.map((o) => {
    if (o.kind !== "logical" || o.op !== "and") return null;
    const cond = o.operands.filter((x) => !tocaActual(x));
    const req = o.operands.filter(tocaActual);
    if (!cond.length || !req.length) return null;
    const fc = leerCondicion(cond.length === 1 ? cond[0]! : { kind: "logical", op: "and", operands: cond }, ctx);
    const fr = conjuncion(req, ctx, false);
    return fc && fr ? [t("si"), ...fc, t(","), ...fr] : null;
  });
  if (casos.every(Boolean)) return oraciones(casos as Frase[]);
  return alternativas(e.operands, ctx);
}

const esSin = (f: Frase) => f[0]?.tipo === "texto" && f[0].texto === "sin";
const esSoloAcepta = (f: Frase) => f[0]?.tipo === "texto" && f[0].texto === "solo acepta";

/** Respuesta vacía: . = '' o string-length(.) = 0. */
const esVacia = (o: Expr) =>
  o.kind === "compare" && o.op === "=" && ((o.left.kind === "current" && o.right.kind === "literal" && o.right.value === "") || (esLlamadaSobreActual(o.left, "string-length") && numeroDe(o.right) === 0));

/**
 * a or b como ALTERNATIVAS de lo que se acepta: «Mayor que 0 y hasta 98, o 99», «8 dígitos o vacía». «Solo acepta»
 * dentro de un «o» se contradice; va una vez al frente sólo si todas las alternativas lo llevaban.
 */
function alternativas(operands: Expr[], ctx: Contexto): Frase | null {
  const fs: Frase[] = [];
  let todasSolo = true;
  for (const o of operands) {
    if (esVacia(o)) {
      fs.push([t("vacía")]);
      todasSolo = false;
      continue;
    }
    const f = exigencia(o, ctx);
    if (!f) return null;
    if (esSoloAcepta(f)) fs.push(f.slice(1));
    else {
      todasSolo = false;
      fs.push(f);
    }
  }
  const compuesta = fs.some((f) => f.some((p) => p.tipo === "texto" && (p.texto === "y" || p.texto === ",")));
  const lista = unir(fs, compuesta ? ", o" : "o");
  return todasSolo ? [t("solo acepta"), ...lista] : lista;
}

const textoPlano = (f: Frase) => f.map((p) => (p.tipo === "texto" || p.tipo === "valor" ? p.texto : p.etiqueta)).join(" ");

/** Varias exclusiones a la vez: «No acepta ‹A›, ‹B› ni ‹C›», «‹A›, ‹B› y ‹C› no pueden ser ‹Sí›». */
function agruparExclusiones(operands: Expr[], ctx: Contexto, raiz: boolean, usados: Set<number>, exigencias: Frase[]) {
  const grupos = new Map<string, number[]>();
  operands.forEach((o, i) => {
    if (usados.has(i) || o.kind !== "compare" || o.op !== "!=" || (o.right.kind === "literal" && o.right.value === "")) return;
    const actual = o.left.kind === "current";
    if (!actual && (raiz || o.left.kind !== "ref" || o.right.kind !== "literal")) return;
    const clave = actual ? `actual:${o.right.kind === "ref" ? "ref" : "lit"}` : `otro:${JSON.stringify(o.right)}`;
    grupos.set(clave, [...(grupos.get(clave) ?? []), i]);
  });
  for (const [clave, idx] of grupos) {
    if (idx.length < 2) continue;
    const cs = idx.map((i) => operands[i] as Comparacion);
    const vals = cs.map((c) => valorComparado(c.right, c.left, ctx));
    if (vals.some((x) => !x)) continue;
    let f: Frase;
    if (clave.startsWith("actual:")) {
      f = [t(clave === "actual:ref" ? "no puede ser igual a" : "no acepta"), ...enumerar(vals as Frase[], "ni")];
    } else {
      // El mismo código puede ser otra opción en cada lista: sólo se agrupa si se lee igual en todas.
      if (new Set((vals as Frase[]).map(textoPlano)).size > 1) continue;
      const sujetos = cs.map((c) => leerValor(c.left, ctx));
      if (sujetos.some((x) => !x)) continue;
      f = [...enumerar(sujetos as Frase[], "y"), t("no pueden ser"), ...vals[0]!];
    }
    idx.forEach((i) => usados.add(i));
    exigencias[idx[0]!] = f;
  }
}

/** Varias exigencias a la vez: junta rangos, une el resto y deja las condiciones para el final («solo si …»). */
function conjuncion(operands: Expr[], ctx: Contexto, raiz: boolean): Frase | null {
  const exigencias: Frase[] = [];
  const condiciones: Expr[] = [];
  const usados = new Set<number>();
  operands.forEach((o, i) => {
    if (usados.has(i) || o.kind !== "compare" || !tocaActual(o)) return;
    const j = operands.findIndex((p, k) => k > i && !usados.has(k) && p.kind === "compare" && rango(o, p, ctx));
    if (j < 0) return;
    usados.add(i);
    usados.add(j);
    exigencias[i] = rango(o, operands[j] as Comparacion, ctx)!;
  });
  agruparExclusiones(operands, ctx, raiz, usados, exigencias);
  // Varias opciones que van solas, en una sola frase.
  const solas = operands.map((o, i) => (usados.has(i) ? null : soloSolas(o)));
  const idxSolas = solas.flatMap((x, i) => (x ? [i] : []));
  if (idxSolas.length > 1) {
    const f = fraseSolas(idxSolas.flatMap((i) => solas[i]!), ctx);
    if (f) {
      idxSolas.forEach((i) => usados.add(i));
      exigencias[idxSolas[0]!] = f;
    }
  }
  for (let i = 0; i < operands.length; i++) {
    if (usados.has(i)) continue;
    const o = operands[i]!;
    if (raiz && !tocaActual(o)) {
      condiciones.push(o);
      continue;
    }
    const f = exigencia(o, ctx);
    if (!f) return null;
    exigencias[i] = f;
  }
  const lista = exigencias.filter(Boolean);
  let frase: Frase = [];
  if (lista.length) {
    const condicionales = lista.some((f) => f[0]?.tipo === "texto" && /^si\b/i.test(f[0].texto));
    frase = condicionales ? oraciones(lista) : enumerar(lista, "y");
  }
  if (condiciones.length) {
    const fc = leerCondicion(condiciones.length === 1 ? condiciones[0]! : { kind: "logical", op: "and", operands: condiciones }, ctx);
    if (!fc) return null;
    frase = lista.length ? [...frase, t(", solo si"), ...fc] : [t("se acepta solo si"), ...fc];
  }
  return frase.length ? frase : null;
}

export function leerRestriccion(e: Expr, ctx: Contexto): Frase | null {
  const f = e.kind === "logical" && e.op === "and" ? conjuncion(e.operands, ctx, true) : !tocaActual(e) && e.kind !== "call" ? (() => {
    const fc = leerCondicion(e, ctx);
    return fc ? [t("se acepta solo si"), ...fc] : null;
  })() : exigencia(e, ctx);
  return f ? capitalizar(f) : null;
}

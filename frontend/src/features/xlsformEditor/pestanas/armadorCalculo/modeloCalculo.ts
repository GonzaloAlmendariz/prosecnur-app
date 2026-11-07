// Armador de cálculos por intención (checklist editor-conjoint, E17, 2026-11-06). Pedido de Gonzalo: «la construcción
// de bloque o funciones tiene que quedar aún más clara, aún más intuitiva». En vez de escribir sintaxis, se elige QUÉ se
// quiere calcular y se completa una frase; de aquí sale la fórmula XLSForm, y de una fórmula conocida se vuelve a la
// intención para poder editarla con la misma frase.
import { parseExpressionLectura } from "../../logic";

export type Operador = "=" | "!=" | "<" | "<=" | ">" | ">=" | "marcó";

/** `codigo`: el valor es el código de una opción de la lista; va siempre entre comillas aunque sea «1». */
export type Caso = { pregunta: string; operador: Operador; valor: string; resultado: string; codigo?: boolean; resultadoTexto?: boolean };

export type Intencion =
  | { tipo: "segun"; casos: Caso[]; siNo: string; siNoTexto?: boolean }
  | { tipo: "operar"; operacion: "sumar" | "restar" | "multiplicar" | "promedio"; preguntas: string[]; constante: string }
  | { tipo: "contar"; pregunta: string }
  // `azar`: el cálculo que guarda el número al azar con once(random()). Va aparte porque cada once(random()) dentro de
  // una misma fórmula sortea un número distinto; el armador lo crea junto al cálculo (`filasAuxiliares`).
  | { tipo: "sortear"; azar: string; valores: { valor: string; peso: string; texto?: boolean }[] }
  | { tipo: "unir"; partes: { tipo: "texto" | "pregunta"; valor: string }[] };

export type TipoIntencion = Intencion["tipo"];

/** Las cinco intenciones, con el nombre directo que ve quien arma. */
export const INTENCIONES: { tipo: TipoIntencion; nombre: string; ejemplo: string }[] = [
  { tipo: "segun", nombre: "Valor por condiciones", ejemplo: "Si la edad es menor que 18, vale «menor»; si no, «adulto»" },
  { tipo: "operar", nombre: "Operación con números", ejemplo: "La suma de los hijos y las hijas" },
  { tipo: "contar", nombre: "Conteo de opciones marcadas", ejemplo: "Cuántos medios marcó en la pregunta 4" },
  { tipo: "sortear", nombre: "Sorteo", ejemplo: "«A» o «B», equiprobable o con pesos" },
  { tipo: "unir", nombre: "Unión de textos", ejemplo: "«Hola » y el nombre del encuestado" },
];

export function intencionVacia(tipo: TipoIntencion): Intencion {
  switch (tipo) {
    case "segun":
      return { tipo, casos: [{ pregunta: "", operador: "=", valor: "", resultado: "" }], siNo: "" };
    case "operar":
      return { tipo, operacion: "sumar", preguntas: ["", ""], constante: "" };
    case "contar":
      return { tipo, pregunta: "" };
    case "sortear":
      return { tipo, azar: "", valores: [{ valor: "", peso: "" }, { valor: "", peso: "" }] };
    case "unir":
      return { tipo, partes: [{ tipo: "texto", valor: "" }, { tipo: "pregunta", valor: "" }] };
  }
}

const ref = (n: string) => "${" + n + "}";
const NUMERO = /^-?\d+(?:\.\d+)?$/;

/** Literal XPath: número tal cual; texto entre comillas simples (o dobles si trae apóstrofo). */
export function literalDe(valor: string): string {
  // Un número va tal cual; un texto, con sus espacios (en «Unir textos» el espacio de «Hola » es parte del texto).
  if (NUMERO.test(valor.trim())) return valor.trim();
  return valor.includes("'") ? `"${valor.replace(/"/g, "”")}"` : `'${valor}'`;
}

/** Código de opción como texto XPath: `'1'`, nunca el número 1 (selected() y las listas comparan texto). */
const textoDe = (v: string) => (v.includes("'") ? `"${v}"` : `'${v}'`);

/** Un resultado: número tal cual, salvo que se haya escrito como texto ('1'), que conserva sus comillas. */
const salida = (v: string, texto?: boolean) => (texto ? textoDe(v) : literalDe(v));

function condicion(c: Caso): string {
  if (c.operador === "marcó") return `selected(${ref(c.pregunta)}, ${textoDe(c.valor)})`;
  return `${ref(c.pregunta)} ${c.operador} ${c.codigo ? textoDe(c.valor) : literalDe(c.valor)}`;
}

/** Lo que falta para que la intención dé una fórmula, en castellano. Vacío si está completa. */
export function faltantes(i: Intencion): string[] {
  const out: string[] = [];
  switch (i.tipo) {
    case "segun":
      i.casos.forEach((c, k) => {
        if (!c.pregunta) out.push(`Caso ${k + 1}: falta la pregunta.`);
        if (!c.valor.trim()) out.push(`Caso ${k + 1}: falta el valor con que se compara.`);
        if (!c.resultado.trim()) out.push(`Caso ${k + 1}: falta el resultado.`);
      });
      if (!i.siNo.trim()) out.push("Falta el valor por defecto.");
      break;
    case "operar":
      if (i.preguntas.filter(Boolean).length + (i.constante.trim() ? 1 : 0) < 2) out.push("Hacen falta al menos dos términos.");
      if (i.constante.trim() && !NUMERO.test(i.constante.trim())) out.push("El número fijo no es un número.");
      break;
    case "contar":
      if (!i.pregunta) out.push("Falta la pregunta de opción múltiple.");
      break;
    case "sortear": {
      if (!i.azar) out.push("Falta el nombre del número al azar.");
      const llenos = i.valores.filter((x) => x.valor.trim());
      if (llenos.length < 2) out.push("Un sorteo necesita al menos dos valores.");
      const pesos = llenos.map((x) => x.peso.trim()).filter(Boolean);
      if (pesos.length && pesos.length !== llenos.length) out.push("O todos los valores llevan peso o ninguno.");
      if (pesos.length === llenos.length && pesos.length) {
        const suma = pesos.reduce((s, p) => s + Number(p), 0);
        if (pesos.some((p) => !NUMERO.test(p) || Number(p) <= 0) || Math.abs(suma - 100) > 0.01) out.push(`Los pesos son porcentajes y deben sumar 100 (suman ${Math.round(suma * 100) / 100}).`);
      }
      break;
    }
    case "unir":
      if (i.partes.filter((p) => p.valor.trim()).length < 2) out.push("Hacen falta al menos dos partes.");
      break;
  }
  return out;
}

/** La fórmula XLSForm de una intención completa (`null` si le falta algo). */
export function aFormula(i: Intencion): string | null {
  if (faltantes(i).length) return null;
  switch (i.tipo) {
    case "segun":
      return i.casos.reduceRight((resto, c) => `if(${condicion(c)}, ${salida(c.resultado, c.resultadoTexto)}, ${resto})`, salida(i.siNo, i.siNoTexto));
    case "operar": {
      const terminos = [...i.preguntas.filter(Boolean).map(ref), ...(i.constante.trim() ? [i.constante.trim()] : [])];
      if (i.operacion === "promedio") return `(${terminos.join(" + ")}) div ${terminos.length}`;
      const op = { sumar: " + ", restar: " - ", multiplicar: " * " }[i.operacion];
      return terminos.join(op);
    }
    case "contar":
      return `count-selected(${ref(i.pregunta)})`;
    case "sortear": {
      const valores = i.valores.filter((x) => x.valor.trim());
      const conPesos = valores.every((x) => x.peso.trim());
      const azar = ref(i.azar);
      if (!conPesos) {
        const k = valores.length;
        return valores.slice(0, -1).reduceRight(
          (resto, x, j) => `if(int(${azar} * ${k}) = ${j}, ${salida(x.valor, x.texto)}, ${resto})`,
          salida(valores[k - 1]!.valor, valores[k - 1]!.texto),
        );
      }
      let acumulado = 0;
      const cortes = valores.slice(0, -1).map((x) => (acumulado += Number(x.peso) / 100));
      return valores.slice(0, -1).reduceRight(
        (resto, x, j) => `if(${azar} < ${Math.round(cortes[j]! * 1e6) / 1e6}, ${salida(x.valor, x.texto)}, ${resto})`,
        salida(valores[valores.length - 1]!.valor, valores[valores.length - 1]!.texto),
      );
    }
    case "unir":
      return `concat(${i.partes.filter((p) => p.valor.trim()).map((p) => (p.tipo === "pregunta" ? ref(p.valor) : literalDe(p.valor))).join(", ")})`;
  }
}

/** Filas que el armador agrega junto al cálculo: el número al azar de un sorteo, una vez por entrevista. */
export function filasAuxiliares(i: Intencion): { name: string; calculation: string }[] {
  return i.tipo === "sortear" && i.azar ? [{ name: i.azar, calculation: "once(random())" }] : [];
}

// ---------------------------------------------------------------------------------------------------------------------
// De la fórmula a la intención (E17, 2026-11-06): abrir el armador sobre un cálculo ya escrito. Sólo se reconoce una
// fórmula que el armador reproduce idéntica (misma estructura al volver a escribirla); cualquier otra se edita a mano.
// ---------------------------------------------------------------------------------------------------------------------

type Nodo = NonNullable<ReturnType<typeof parseExpressionLectura>>;

const esRef = (e: Nodo | undefined): e is Extract<Nodo, { kind: "ref" }> => e?.kind === "ref";
const esLit = (e: Nodo | undefined): e is Extract<Nodo, { kind: "literal" }> => e?.kind === "literal";
const esLlamada = (e: Nodo | undefined, nombre: string): e is Extract<Nodo, { kind: "call" }> => e?.kind === "call" && e.name === nombre;

/** Términos de una cadena `a + b + c` (o `-`, `*`). */
function terminos(e: Nodo, op: string): Nodo[] {
  return esLlamada(e, op) && e.args.length === 2 ? [...terminos(e.args[0]!, op), e.args[1]!] : [e];
}

function operarDe(e: Nodo): Intencion | null {
  let operacion: "sumar" | "restar" | "multiplicar" | "promedio" | null = null;
  let lista: Nodo[] = [];
  if (esLlamada(e, "div") && e.args.length === 2 && esLit(e.args[1]) && esLlamada(e.args[0], "+")) {
    operacion = "promedio";
    lista = terminos(e.args[0]!, "+");
    if (Number(e.args[1].value) !== lista.length) return null;
  } else {
    for (const [op, nombre] of [["+", "sumar"], ["-", "restar"], ["*", "multiplicar"]] as const) {
      if (esLlamada(e, op)) { operacion = nombre; lista = terminos(e, op); break; }
    }
  }
  if (!operacion || lista.length < 2) return null;
  const preguntas = lista.filter(esRef).map((r) => r.name);
  const numeros = lista.filter(esLit);
  if (preguntas.length + numeros.length !== lista.length || numeros.length > 1) return null;
  if (numeros.length && lista[lista.length - 1] !== numeros[0]) return null;
  return { tipo: "operar", operacion, preguntas, constante: numeros[0] ? String(numeros[0].value) : "" };
}

/** ¿Literal numérico escrito como texto ('1')? Se marca para que el armador lo vuelva a escribir con comillas. */
const textoNumerico = (e: Extract<Nodo, { kind: "literal" }>) => typeof e.value === "string" && NUMERO.test(e.value);

function casoDe(cond: Nodo, resultado: Nodo): Caso | null {
  if (!esLit(resultado)) return null;
  const r = String(resultado.value);
  const extra = textoNumerico(resultado) ? { resultadoTexto: true } : {};
  if (esLlamada(cond, "selected") && esRef(cond.args[0]) && esLit(cond.args[1])) {
    return { pregunta: cond.args[0].name, operador: "marcó", valor: String(cond.args[1].value), resultado: r, ...extra };
  }
  if (cond.kind === "compare" && esRef(cond.left) && esLit(cond.right)) {
    const v = cond.right.value;
    // Un código numérico entre comillas ('2') es un código de opción: se conserva como texto.
    const codigo = typeof v === "string" && NUMERO.test(v);
    return { pregunta: cond.left.name, operador: cond.op as Operador, valor: String(v), resultado: r, ...(codigo ? { codigo } : {}), ...extra };
  }
  return null;
}

function segunOSorteoDe(e: Nodo): Intencion | null {
  const cadena: { cond: Nodo; res: Nodo }[] = [];
  let resto: Nodo = e;
  while (esLlamada(resto, "if") && resto.args.length === 3) {
    cadena.push({ cond: resto.args[0]!, res: resto.args[1]! });
    resto = resto.args[2]!;
  }
  if (!cadena.length || !esLit(resto)) return null;
  const ultimo = String(resto.value);
  // Sorteo con la misma probabilidad: if(int(${azar} * k) = j, …).
  const equi = cadena.map(({ cond }) =>
    cond.kind === "compare" && cond.op === "=" && esLlamada(cond.left, "int") && esLlamada(cond.left.args[0], "*") &&
    esRef(cond.left.args[0].args[0]) && esLit(cond.left.args[0].args[1]) && esLit(cond.right)
      ? { azar: cond.left.args[0].args[0].name, k: Number(cond.left.args[0].args[1].value), j: Number(cond.right.value) }
      : null);
  if (equi.every(Boolean) && cadena.every((c) => esLit(c.res))) {
    const azar = equi[0]!.azar;
    if (equi.every((x, j) => x!.azar === azar && x!.k === cadena.length + 1 && x!.j === j)) {
      const lits = [...cadena.map((c) => c.res as Extract<Nodo, { kind: "literal" }>), resto];
      return { tipo: "sortear", azar, valores: lits.map((l) => ({ valor: String(l.value), peso: "", ...(textoNumerico(l) ? { texto: true } : {}) })) };
    }
  }
  // Sorteo con pesos: if(${azar} < corte, …) con cortes crecientes.
  const cortes = cadena.map(({ cond }) => (cond.kind === "compare" && cond.op === "<" && esRef(cond.left) && esLit(cond.right) ? { azar: cond.left.name, c: Number(cond.right.value) } : null));
  if (cortes.every(Boolean) && cadena.every((c) => esLit(c.res)) && cortes.every((x) => x!.azar === cortes[0]!.azar)) {
    const cs = cortes.map((x) => x!.c);
    if (cs.every((c, i) => c > 0 && c < 1 && (i === 0 || c > cs[i - 1]!))) {
      const pesos = [...cs.map((c, i) => c - (cs[i - 1] ?? 0)), 1 - cs[cs.length - 1]!].map((p) => String(Math.round(p * 10000) / 100));
      const lits = [...cadena.map((c) => c.res as Extract<Nodo, { kind: "literal" }>), resto];
      return { tipo: "sortear", azar: cortes[0]!.azar, valores: lits.map((l, i) => ({ valor: String(l.value), peso: pesos[i]!, ...(textoNumerico(l) ? { texto: true } : {}) })) };
    }
  }
  const casos = cadena.map((c) => casoDe(c.cond, c.res));
  if (!casos.every(Boolean)) return null;
  return { tipo: "segun", casos: casos as Caso[], siNo: ultimo, ...(textoNumerico(resto) ? { siNoTexto: true } : {}) };
}

/** La intención de una fórmula que el armador sabe reescribir idéntica; null si no. */
export function deFormula(formula: string): Intencion | null {
  const ast = parseExpressionLectura(formula.trim());
  if (!ast) return null;
  let i: Intencion | null = null;
  if (esLlamada(ast, "count-selected") && ast.args.length === 1 && esRef(ast.args[0])) i = { tipo: "contar", pregunta: ast.args[0].name };
  else if (esLlamada(ast, "concat") && ast.args.every((a) => esRef(a) || esLit(a))) {
    i = { tipo: "unir", partes: ast.args.map((a) => (esRef(a) ? { tipo: "pregunta" as const, valor: a.name } : { tipo: "texto" as const, valor: String((a as Extract<Nodo, { kind: "literal" }>).value) })) };
  } else if (esLlamada(ast, "if")) i = segunOSorteoDe(ast);
  else i = operarDe(ast);
  if (!i) return null;
  // Sólo si al volver a escribirla queda la misma estructura: el armador no cambia en silencio lo que no entiende.
  const vuelta = aFormula(i);
  return vuelta && JSON.stringify(parseExpressionLectura(vuelta)) === JSON.stringify(ast) ? i : null;
}

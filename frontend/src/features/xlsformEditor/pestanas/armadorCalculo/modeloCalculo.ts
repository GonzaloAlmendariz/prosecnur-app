// Armador de cálculos por intención (checklist editor-conjoint, E17, 2026-11-06). Pedido de Gonzalo: «la construcción
// de bloque o funciones tiene que quedar aún más clara, aún más intuitiva». En vez de escribir sintaxis, se elige QUÉ se
// quiere calcular y se completa una frase; de aquí sale la fórmula XLSForm, y de una fórmula conocida se vuelve a la
// intención para poder editarla con la misma frase.

export type Operador = "=" | "!=" | "<" | "<=" | ">" | ">=" | "marcó";

/** `codigo`: el valor es el código de una opción de la lista; va siempre entre comillas aunque sea «1». */
export type Caso = { pregunta: string; operador: Operador; valor: string; resultado: string; codigo?: boolean };

export type Intencion =
  | { tipo: "segun"; casos: Caso[]; siNo: string }
  | { tipo: "operar"; operacion: "sumar" | "restar" | "multiplicar" | "promedio"; preguntas: string[]; constante: string }
  | { tipo: "contar"; pregunta: string }
  // `azar`: el cálculo que guarda el número al azar con once(random()). Va aparte porque cada once(random()) dentro de
  // una misma fórmula sortea un número distinto; el armador lo crea junto al cálculo (`filasAuxiliares`).
  | { tipo: "sortear"; azar: string; valores: { valor: string; peso: string }[] }
  | { tipo: "unir"; partes: { tipo: "texto" | "pregunta"; valor: string }[] };

export type TipoIntencion = Intencion["tipo"];

/** Las cinco intenciones, con el nombre directo que ve quien arma. */
export const INTENCIONES: { tipo: TipoIntencion; nombre: string; ejemplo: string }[] = [
  { tipo: "segun", nombre: "Un valor según respuestas", ejemplo: "Si la edad es menor que 18, vale «menor»; si no, «adulto»" },
  { tipo: "operar", nombre: "Una cuenta con números", ejemplo: "La suma de los hijos y las hijas" },
  { tipo: "contar", nombre: "Cuántas opciones marcó", ejemplo: "Cuántos medios marcó en la pregunta 4" },
  { tipo: "sortear", nombre: "Un sorteo", ejemplo: "Uno de «A» o «B», con la misma probabilidad o con pesos" },
  { tipo: "unir", nombre: "Unir textos", ejemplo: "«Hola » y el nombre del encuestado" },
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
        if (!c.resultado.trim()) out.push(`Caso ${k + 1}: falta lo que vale.`);
      });
      if (!i.siNo.trim()) out.push("Falta lo que vale si no se cumple ningún caso.");
      break;
    case "operar":
      if (i.preguntas.filter(Boolean).length + (i.constante.trim() ? 1 : 0) < 2) out.push("Hacen falta al menos dos términos.");
      if (i.constante.trim() && !NUMERO.test(i.constante.trim())) out.push("El número fijo no es un número.");
      break;
    case "contar":
      if (!i.pregunta) out.push("Falta la pregunta de opción múltiple.");
      break;
    case "sortear": {
      if (!i.azar) out.push("Falta el cálculo que guarda el número al azar.");
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
      return i.casos.reduceRight((resto, c) => `if(${condicion(c)}, ${literalDe(c.resultado)}, ${resto})`, literalDe(i.siNo));
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
          (resto, x, j) => `if(int(${azar} * ${k}) = ${j}, ${literalDe(x.valor)}, ${resto})`,
          literalDe(valores[k - 1]!.valor),
        );
      }
      let acumulado = 0;
      const cortes = valores.slice(0, -1).map((x) => (acumulado += Number(x.peso) / 100));
      return valores.slice(0, -1).reduceRight(
        (resto, x, j) => `if(${azar} < ${Math.round(cortes[j]! * 1e6) / 1e6}, ${literalDe(x.valor)}, ${resto})`,
        literalDe(valores[valores.length - 1]!.valor),
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

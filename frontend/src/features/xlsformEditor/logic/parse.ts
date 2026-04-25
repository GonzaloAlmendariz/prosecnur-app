// =============================================================================
// logic/parse.ts — parser de expresiones ODK/XLSForm a AST
// =============================================================================
// Recursive descent parser sobre el subset XPath 1.0 que aparece en ODK:
//
//   expr        := orExpr
//   orExpr      := andExpr ('or' andExpr)*
//   andExpr     := notExpr ('and' notExpr)*
//   notExpr     := 'not(' expr ')' | compareExpr
//   compareExpr := unary (compareOp unary)?
//   unary       := primary
//   primary     := ref | current | literal | call | '(' expr ')'
//   ref         := '${' identifier '}'
//   current     := '.'
//   literal     := stringLiteral | numberLiteral | boolean
//   call        := identifier '(' (expr (',' expr)*)? ')'
//
// Si la expresión no encaja, devolvemos `{ kind: "raw", text }` para no
// perder la información — el editor preserva la lógica original al
// re-exportar y la muestra read-only en la UI guiada.
//
// Decisiones:
//   - Tolerante con whitespace en cualquier punto (incluyendo dentro de
//     `${ name }`).
//   - Strings con comillas simples (estándar ODK) y dobles (variante
//     común en RMS).
//   - Números: enteros, decimales, signo opcional.
//   - `true`/`false` como literales boolean (ODK suele usar 'true'/'false'
//     como strings, pero algunos archivos del corpus tienen boolean nudo).
// =============================================================================

import type { CompareOp, Expr } from "./ast";

class ParserError extends Error {
  constructor(public override readonly message: string, public readonly position: number) {
    super(message);
  }
}

class Parser {
  private pos = 0;

  constructor(private readonly src: string) {}

  // -- entry --------------------------------------------------------------
  parse(): Expr {
    this.skipWs();
    const expr = this.parseOr();
    this.skipWs();
    if (this.pos < this.src.length) {
      throw new ParserError(
        `Token inesperado a partir de la posición ${this.pos}: ${this.src.slice(this.pos)}`,
        this.pos,
      );
    }
    return expr;
  }

  // -- niveles del grammar ------------------------------------------------
  private parseOr(): Expr {
    const operands = [this.parseAnd()];
    while (this.peekKeyword("or")) {
      this.consumeKeyword("or");
      operands.push(this.parseAnd());
    }
    return operands.length === 1
      ? operands[0]!
      : { kind: "logical", op: "or", operands };
  }

  private parseAnd(): Expr {
    const operands = [this.parseNot()];
    while (this.peekKeyword("and")) {
      this.consumeKeyword("and");
      operands.push(this.parseNot());
    }
    return operands.length === 1
      ? operands[0]!
      : { kind: "logical", op: "and", operands };
  }

  private parseNot(): Expr {
    // ODK usa `not(expr)` como función, no como prefijo. Detectamos eso
    // en parseCall como un caso especial.
    return this.parseCompare();
  }

  private parseCompare(): Expr {
    const left = this.parsePrimary();
    this.skipWs();
    const op = this.tryConsumeCompareOp();
    if (!op) return left;
    this.skipWs();
    const right = this.parsePrimary();
    return { kind: "compare", op, left, right };
  }

  private parsePrimary(): Expr {
    this.skipWs();
    if (this.pos >= this.src.length) {
      throw new ParserError("Expresión incompleta", this.pos);
    }
    const ch = this.src[this.pos]!;

    if (ch === "(") {
      this.pos += 1;
      const inner = this.parseOr();
      this.skipWs();
      this.expect(")");
      return inner;
    }
    if (ch === "$" && this.src[this.pos + 1] === "{") {
      return this.parseRef();
    }
    if (ch === "'" || ch === '"') {
      return this.parseString();
    }
    if (this.isDigit(ch) || (ch === "-" && this.isDigit(this.src[this.pos + 1] ?? ""))) {
      return this.parseNumber();
    }
    if (ch === ".") {
      // `.` solo o `.something` (path) — solo soportamos `.` standalone.
      const next = this.src[this.pos + 1] ?? "";
      if (!this.isIdentStart(next)) {
        this.pos += 1;
        return { kind: "current" };
      }
    }
    if (this.isIdentStart(ch)) {
      return this.parseIdentifierOrCall();
    }
    throw new ParserError(
      `Token inesperado en posición ${this.pos}: '${ch}'`,
      this.pos,
    );
  }

  // -- terminales ---------------------------------------------------------
  private parseRef(): Expr {
    this.expect("$");
    this.expect("{");
    this.skipWs();
    const start = this.pos;
    while (this.pos < this.src.length && this.src[this.pos] !== "}") {
      this.pos += 1;
    }
    const name = this.src.slice(start, this.pos).trim();
    this.expect("}");
    if (!name) throw new ParserError("Variable vacía: ${}", start);
    return { kind: "ref", name };
  }

  private parseString(): Expr {
    const quote = this.src[this.pos];
    if (quote !== "'" && quote !== '"') {
      throw new ParserError(`Esperaba cadena en ${this.pos}`, this.pos);
    }
    this.pos += 1;
    let value = "";
    while (this.pos < this.src.length && this.src[this.pos] !== quote) {
      // Solo \' y \\ se interpretan como escape; cualquier otro \X se
      // preserva literal — esto es crítico para regex donde `\d`, `\s`,
      // etc. deben llegar intactos al motor de ODK.
      if (
        this.src[this.pos] === "\\" &&
        (this.src[this.pos + 1] === quote || this.src[this.pos + 1] === "\\")
      ) {
        value += this.src[this.pos + 1];
        this.pos += 2;
        continue;
      }
      value += this.src[this.pos];
      this.pos += 1;
    }
    if (this.pos >= this.src.length) {
      throw new ParserError("Cadena sin cerrar", this.pos);
    }
    this.pos += 1; // consume closing quote
    return { kind: "literal", value };
  }

  private parseNumber(): Expr {
    const start = this.pos;
    if (this.src[this.pos] === "-") this.pos += 1;
    while (this.pos < this.src.length && this.isDigit(this.src[this.pos]!)) {
      this.pos += 1;
    }
    if (this.src[this.pos] === ".") {
      this.pos += 1;
      while (this.pos < this.src.length && this.isDigit(this.src[this.pos]!)) {
        this.pos += 1;
      }
    }
    const raw = this.src.slice(start, this.pos);
    const num = Number(raw);
    if (!Number.isFinite(num)) {
      throw new ParserError(`Número inválido: ${raw}`, start);
    }
    return { kind: "literal", value: num };
  }

  private parseIdentifierOrCall(): Expr {
    const start = this.pos;
    // ODK permite identificadores con `:` (ej. `jr:choice-name`) y `-`.
    while (this.pos < this.src.length && this.isIdentBody(this.src[this.pos]!)) {
      this.pos += 1;
    }
    const name = this.src.slice(start, this.pos);
    this.skipWs();

    if (this.src[this.pos] === "(") {
      // Llamada a función — incluyendo `not(expr)`.
      this.pos += 1;
      const args: Expr[] = [];
      this.skipWs();
      if (this.src[this.pos] !== ")") {
        args.push(this.parseOr());
        this.skipWs();
        while (this.src[this.pos] === ",") {
          this.pos += 1;
          this.skipWs();
          args.push(this.parseOr());
          this.skipWs();
        }
      }
      this.expect(")");
      if (name === "not") {
        if (args.length !== 1) {
          throw new ParserError(
            `not() espera exactamente 1 argumento, recibió ${args.length}`,
            start,
          );
        }
        return { kind: "not", operand: args[0]! };
      }
      // Booleans devueltos como literales boolean (no como llamadas a fn).
      if ((name === "true" || name === "false") && args.length === 0) {
        return { kind: "literal", value: name === "true" };
      }
      return { kind: "call", name, args };
    }

    // Identificador suelto que no es llamada — `true`/`false` son los
    // únicos casos válidos en ODK; cualquier otro lo tratamos como
    // referencia simbólica (raro pero conservativo).
    if (name === "true" || name === "false") {
      return { kind: "literal", value: name === "true" };
    }
    // No es un identificador válido como expresión completa — devolvemos
    // el texto crudo del nombre para que el caller lo trate como `raw`.
    throw new ParserError(
      `Identificador inesperado fuera de llamada: '${name}'`,
      start,
    );
  }

  // -- helpers ------------------------------------------------------------
  private skipWs(): void {
    while (this.pos < this.src.length) {
      const ch = this.src[this.pos]!;
      if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
        this.pos += 1;
      } else {
        break;
      }
    }
  }

  private peekKeyword(kw: string): boolean {
    this.skipWs();
    const end = this.pos + kw.length;
    if (end > this.src.length) return false;
    if (this.src.slice(this.pos, end).toLowerCase() !== kw) return false;
    // El siguiente char no debe ser parte de un identificador (para no
    // matchear `andrea` como `and`).
    const next = this.src[end] ?? " ";
    return !this.isIdentBody(next);
  }

  private consumeKeyword(kw: string): void {
    if (!this.peekKeyword(kw)) {
      throw new ParserError(`Esperaba '${kw}' en ${this.pos}`, this.pos);
    }
    this.pos += kw.length;
  }

  private tryConsumeCompareOp(): CompareOp | null {
    // El orden importa: <= antes de <, etc.
    const order: CompareOp[] = ["<=", ">=", "!=", "=", "<", ">"];
    for (const op of order) {
      if (this.src.startsWith(op, this.pos)) {
        this.pos += op.length;
        return op;
      }
    }
    return null;
  }

  private expect(expected: string): void {
    if (this.src[this.pos] !== expected) {
      throw new ParserError(
        `Esperaba '${expected}' en ${this.pos}, encontró '${this.src[this.pos] ?? "EOF"}'`,
        this.pos,
      );
    }
    this.pos += 1;
  }

  private isDigit(ch: string): boolean {
    return ch >= "0" && ch <= "9";
  }

  private isIdentStart(ch: string): boolean {
    return /[a-zA-Z_]/.test(ch);
  }

  private isIdentBody(ch: string): boolean {
    return /[a-zA-Z0-9_:\-]/.test(ch);
  }
}

/**
 * Parsea una expresión ODK a AST. Si falla por sintaxis no soportada,
 * devuelve `{ kind: "raw", text }` con el original — el editor lo
 * mostrará read-only en la tab Lógica con un aviso.
 */
export function parseExpression(input: string | null | undefined): Expr | null {
  const text = (input ?? "").trim();
  if (!text) return null;
  try {
    return new Parser(text).parse();
  } catch {
    return { kind: "raw", text };
  }
}

/**
 * Como `parseExpression` pero lanza si no es parseable. Útil en tests +
 * debug; en runtime usar `parseExpression` siempre.
 */
export function parseExpressionStrict(input: string): Expr {
  const text = input.trim();
  if (!text) {
    throw new ParserError("Expresión vacía", 0);
  }
  return new Parser(text).parse();
}

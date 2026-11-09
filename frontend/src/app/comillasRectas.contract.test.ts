// R16-5 / R17: el texto visible cita con comillas dobles rectas ("así"), nunca con angulares. Recorre el AST de cada
// .ts/.tsx de producción de src/: literales de cadena, trozos de plantilla y texto JSX. Los comentarios no son nodos, así
// que no cuentan. Las expresiones regulares sí se recorren: las únicas que pueden llevar angulares son las que leen
// mensajes del motor (que todavía cita con angulares), el texto que teclea la persona o el de un comentario citado, y
// quedan nombradas abajo con su motivo. Nació en features/graficos (ronda 16) y cubre todo src/ desde la ronda 17.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ANGULAR = /[«»]/;

/** Regex que leen texto ajeno con angulares. Clave: archivo y un fragmento de la regex. */
const REGEX_PERMITIDAS: Array<{ archivo: string; fragmento: string; motivo: string }> = [
  { archivo: "features/graficos/avisosExportacion/avisosExportacionModel.ts", fragmento: "^Lámina\\s+(\\d+)", motivo: "lee el aviso de exportación del motor" },
  { archivo: "features/graficos/laminas/avisoEnLamina.ts", fragmento: "^Lámina\\s+\\d+", motivo: "quita el prefijo del aviso del motor" },
  { archivo: "features/graficos/humanizeExportError.ts", fragmento: "(?:Lámina|Sección) (\\d+)", motivo: "lee la lámina culpable del error del motor" },
  { archivo: "features/graficos/humanizeExportError.ts", fragmento: "requiere un [ií]cono", motivo: "lee el error de ícono requerido del motor" },
  { archivo: "features/graficos/laminas/citas/modeloCitas.ts", fragmento: "[.!?…,;:]", motivo: "cierre de frase en el comentario citado" },
  { archivo: "features/graficos/laminas/citas/modeloCitas.ts", fragmento: "[.!?…][", motivo: "fin de oración en el comentario citado" },
  { archivo: "features/graficos/laminas/citas/modeloCitas.ts", fragmento: "^[\"“”«»]+", motivo: "quita las comillas que trae el comentario citado" },
  { archivo: "api/codificacion.ts", fragmento: "/«([^»]+)»\\.?", motivo: "lee el nombre sugerido del 409 E_CODIF_AGRUPACION_TARGET_OCUPADO del motor" },
  { archivo: "features/codificacion/diccionarioPalabras.ts", fragmento: "/«([^»]+)»/", motivo: "lee el término citado del guardado rechazado del motor" },
  { archivo: "features/recopiladores/correos/comoArreglar.ts", fragmento: "destinatarios? recibir", motivo: "lee el detalle greeting_trato de la revisión del motor" },
  { archivo: "features/recopiladores/correos/historialCorreo.ts", fragmento: "¡¿()«»", motivo: "fin de palabra en el texto que teclea la persona" },
  { archivo: "features/validacion/components/RuleNarrative.tsx", fragmento: "[«\"]([^»\"]+)[»\"]", motivo: "lee las variables citadas en el objetivo que redacta el motor (y las rectas del front)" },
];

function fuentes(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "__tests__" || e.name === "node_modules" ? [] : fuentes(p);
    return /\.tsx?$/.test(e.name) && !/\.test(-util)?\.tsx?$/.test(e.name) && !e.name.endsWith(".d.ts") ? [p] : [];
  });
}

interface Hallazgo {
  archivo: string;
  linea: number;
  regex: boolean;
  texto: string;
}

const TIPOS_DE_TEXTO = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts.SyntaxKind.TemplateHead,
  ts.SyntaxKind.TemplateMiddle,
  ts.SyntaxKind.TemplateTail,
  ts.SyntaxKind.JsxText,
]);

function angularesEn(archivo: string, codigo: string): Hallazgo[] {
  if (!ANGULAR.test(codigo)) return [];
  const sf = ts.createSourceFile(archivo, codigo, ts.ScriptTarget.Latest, true, archivo.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: Hallazgo[] = [];
  const visitar = (n: ts.Node) => {
    const regex = n.kind === ts.SyntaxKind.RegularExpressionLiteral;
    if (regex || TIPOS_DE_TEXTO.has(n.kind)) {
      const texto = n.getText(sf);
      if (ANGULAR.test(texto)) out.push({ archivo, linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, regex, texto });
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return out;
}

const permitida = (h: Hallazgo) => h.regex && REGEX_PERMITIDAS.some((p) => p.archivo === h.archivo && h.texto.includes(p.fragmento));

// Se recorre una vez, al cargar el archivo: todo src/ son más de 3000 fuentes y, con el gate cargado, leerlas dentro de
// cada test pasaba el tope de 5 s.
const FUENTES = fuentes(SRC);
const CENSO: Hallazgo[] = FUENTES.flatMap((f) => angularesEn(path.relative(SRC, f).split(path.sep).join("/"), fs.readFileSync(f, "utf8")));

describe("comillas rectas en el texto de la app", () => {
  it("ningún texto visible lleva comillas angulares", () => {
    const todos = CENSO;
    expect(FUENTES.length, "vacuna: el censo recorre todo src/").toBeGreaterThan(2000);
    expect(FUENTES.some((f) => f.includes(`${path.sep}xlsformEditor${path.sep}`)), "vacuna: entra en los features").toBe(true);
    const malos = todos.filter((h) => !permitida(h)).map((h) => `${h.archivo}:${h.linea}: ${h.texto.slice(0, 90)}`);
    expect(malos, 'Cita con comillas dobles rectas: "así". En JSX, un atributo con comillas va entre simples o {"..."}.').toEqual([]);
  });

  it("cada regex permitida sigue existiendo (la lista no guarda excepciones muertas)", () => {
    const regex = CENSO.filter((h) => h.regex);
    const muertas = REGEX_PERMITIDAS.filter((p) => !regex.some((h) => h.archivo === p.archivo && h.texto.includes(p.fragmento)));
    expect(muertas.map((p) => `${p.archivo}: ${p.fragmento}`)).toEqual([]);
  });

  it("vacuna: el detector ve cadena, plantilla y JSX; no ve comentarios; la regex sólo pasa si está nombrada", () => {
    const codigo = [
      "// «comentario»",
      "/* «bloque» */",
      'const a = "«cadena»";',
      "const b = `x «${a}»`;",
      "const c = <p>«texto»</p>;",
      "const d = /«[^»]*»/;",
    ].join("\n");
    const h = angularesEn("features/graficos/x.tsx", codigo);
    expect(h.map((x) => x.linea)).toEqual([3, 4, 4, 5, 6]);
    expect(h.filter((x) => !permitida(x))).toHaveLength(5);
  });
});

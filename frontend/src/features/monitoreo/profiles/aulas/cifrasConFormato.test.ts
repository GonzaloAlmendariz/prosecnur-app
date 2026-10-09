// **Ninguna cifra del perfil se escribe cruda.**
//
// Medido en Avance el 2026-08-23, con el sorteo del 22: la misma pantalla decía
// «de 2,616 cursos-horario» y, cuatro renglones más abajo, «de 2109
// cursos-horario en juego». Dos formatos para el mismo tipo de número, en la
// misma vista, y el segundo cuesta leerlo: hay que contar los dígitos para
// saber si son dos mil o veintiún mil.
//
// No era un descuido de un archivo: siete de este perfil interpolaban números
// directamente en la frase mientras `fmt()` —con `Intl.NumberFormat("es-PE")`—
// vivía a dos carpetas de distancia y lo usaban los KPI de al lado.
//
// El test mira el fuente porque la regla ES del fuente: una cifra formateada y
// otra sin formatear se ven idénticas en un render de tres dígitos, y el
// defecto sólo aparece a partir de mil — con datos de un estudio real, cuando
// ya está en pantalla.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const aqui = path.dirname(fileURLToPath(import.meta.url));

/** Sustantivos que sólo acompañan a una cuenta, nunca a un identificador. */
const UNIDADES = "cursos-horario|aulas|respuestas|reservas|filas|celdas|titulares|facultades";

/**
 * `${algo} aulas` — una cifra metida en la frase sin pasar por el formateador.
 *
 * Se exige `fmt(`, `fmtCuenta(` o `toLocaleString` dentro de la interpolación.
 * `fmtCuenta()` entró después que este guard y es MÁS estricto que `fmt()`
 * —redondea hacia arriba porque media respuesta no existe—, así que dejarlo
 * fuera empujaba a usar el formateador menos correcto para una cuenta. Una
 * operación
 * —`${total - enJuego}`— también cuenta como cruda: el resultado es igual de
 * grande que sus operandos.
 */
// Se excluyen las interpolaciones que llevan comillas dentro: `${n === 1 ?
// "reserva" : "reservas"}` produce TEXTO, no una cifra, y formatearlo no
// significaría nada.
const SIN_FORMATO = String.raw`\$\{(?!fmt\(|fmtCuenta\(|fmtAporte\(|pctPerfil\(|[^}]*toLocaleString)[^}"']*\}`;

/**
 * Las formas en que una cifra llega a la frase, medidas en el perfil:
 *
 *   `${n} aulas`                      — pegada a su unidad
 *   `${n} de ${total} aulas`          — como numerador; el primero no toca la
 *                                       unidad y se escapaba del detector
 *   `${n} son reservas del banco`     — con un verbo de por medio
 *
 * No pretende ser exhaustivo: cubre lo que se ha visto y crece cuando aparezca
 * otra forma. Un detector que intente adivinar toda frase posible acaba
 * marcando texto que no es cifra, y entonces se ignora.
 */
const CIFRA_CRUDA = new RegExp(
  // `(?![-\w])` y no `\b`: sin él, `${className} aulas-foco-boton` —una clase
  // CSS— se lee como «una cifra seguida de la palabra aulas», porque el guión
  // cierra la palabra igual que un espacio.
  `${SIN_FORMATO}\\s*(?:(?:${UNIDADES})(?![-\\w])|(?:de|son|sobre|entre)\\s)`,
  "g",
);

const fuentes = fs
  .readdirSync(aqui)
  .filter((f) => (f.endsWith(".tsx") || f.endsWith(".ts")) && !f.includes(".test."));

/**
 * **El centinela de no-mudez.** Este guard enumera el directorio y luego afirma
 * que la lista de culpables está vacía. Si el barrido dejara de encontrar
 * fuentes —un renombre, una carpeta que se mueve, un filtro que deja de casar—
 * la lista saldría vacía y el guard pasaría **sin haber mirado nada**, en verde
 * y para siempre. Ha pasado en este repo con un guard anclado a un símbolo por
 * nombre.
 */
it("el barrido encuentra las fuentes del perfil, o no está guardando nada", () => {
  expect(fuentes.length).toBeGreaterThan(60);
});

describe("las cifras del perfil de aulas van formateadas", () => {
  it.each(fuentes)("%s", (archivo) => {
    const fuente = fs
      .readFileSync(path.join(aqui, archivo), "utf8")
      // Los comentarios citan cifras a propósito —«decía 2109»— y ahí es
      // exactamente donde deben ir crudas: son la evidencia del defecto.
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    const crudas = [...fuente.matchAll(CIFRA_CRUDA)].map((m) => m[0]);
    expect(crudas, crudas.join("\n")).toEqual([]);
  });

  it("el detector reconoce una cifra cruda cuando la hay", () => {
    // Sin este control, un regex roto daría verde en los treinta y pico
    // archivos sin haber mirado ninguno.
    const cruda = "`${enJuego} cursos-horario en juego`";
    expect([...cruda.matchAll(CIFRA_CRUDA)]).toHaveLength(1);
  });

  it("y acepta la que sí pasó por el formateador", () => {
    expect([..."`${fmt(enJuego)} cursos-horario`".matchAll(CIFRA_CRUDA)]).toHaveLength(0);
    expect([..."`${n.toLocaleString(\"es-PE\")} aulas`".matchAll(CIFRA_CRUDA)]).toHaveLength(0);
  });

  it("no confunde una clase CSS con una cifra", () => {
    expect([...'`${className} aulas-foco-boton`'.matchAll(CIFRA_CRUDA)]).toHaveLength(0);
  });

  it("caza el numerador de «N de M aulas», que no toca la unidad", () => {
    // Medido en pantalla: «2109 de 2,109 cursos-horario» — el segundo pasó por
    // el formateador y el primero no, en la MISMA frase.
    const linea = "`${sinSalirACampo} de ${fmt(enJuego)} cursos-horario`";
    expect([...linea.matchAll(CIFRA_CRUDA)]).toHaveLength(1);
  });

  it("caza la cifra con un verbo de por medio", () => {
    // «1916 son reservas del banco».
    expect([..."`${banco} son reservas del banco`".matchAll(CIFRA_CRUDA)]).toHaveLength(1);
  });

  it("no marca una interpolación que produce texto", () => {
    // `${n === 1 ? "reserva" : "reservas"}` es la palabra, no el número: va
    // seguida de «de» y aun así no es una cifra que formatear.
    const plural = '`${n === 1 ? "reserva" : "reservas"} de banco`';
    expect([...plural.matchAll(CIFRA_CRUDA)]).toHaveLength(0);
    // Y la cifra de al lado sí se caza cuando toca su unidad.
    expect([..."`${n} reservas`".matchAll(CIFRA_CRUDA)]).toHaveLength(1);
  });

  it("una operación dentro de la interpolación también es cruda", () => {
    // `${total - enJuego} reservas` da un número tan grande como sus operandos.
    expect([..."`${total - enJuego} reservas`".matchAll(CIFRA_CRUDA)]).toHaveLength(1);
  });
});

/**
 * **La coma no es el separador decimal en el Perú.**
 *
 * `es-PE` escribe `2,668` con coma de MILLAR y `88.1` con punto decimal, y es
 * lo que `Intl` produce en todo el perfil. Tres formateadores locales hacían
 * `.replace(".", ",")` para imponer la convención española, así que la pestaña
 * de Cuotas publicaba «88.1 %» en la tabla por facultad y «88,1%» en la barra
 * de arriba: dos notaciones para la misma cifra, con la coma actuando de
 * decimal en una y de millar en la otra.
 *
 * El guard anterior no podía verlo porque sólo miraba CUENTAS pegadas a su
 * unidad —«aulas», «respuestas»—, y un porcentaje no lleva ninguna de esas
 * palabras. Éste mira la operación, que es exacta y no necesita heurística.
 */
describe("el perfil no fuerza la coma decimal", () => {
  it.each(fuentes)("%s", (archivo) => {
    const fuente = fs.readFileSync(path.join(aqui, archivo), "utf8");
    const lineas = fuente.split("\n");
    const culpables = lineas
      .map((linea, i) => ({ linea, n: i + 1 }))
      // Se excluye la prosa: la nota de `avanceCuota.ts` cita la operación para
      // explicar por qué se retiró, y citarla no es cometerla.
      .filter(({ linea }) => !/^\s*(\*|\/\/)/.test(linea))
      .filter(({ linea }) => linea.includes('replace(".", ",")'))
      .map(({ n, linea }) => `${archivo}:${n} ${linea.trim()}`);
    expect(culpables, culpables.join("\n")).toEqual([]);
  });
});

/**
 * **«Celda» es vocabulario de tabla estadística, y esta pantalla no la lee un
 * analista.**
 *
 * El perfil llamaba «celda sexo × facultad» al cruce que tiene cuota propia. Es
 * exacto y es como se piensa por dentro; el problema es quién abre Avance —una
 * autoridad universitaria, que no participó en el diseño muestral— y tiene que
 * ir a buscar qué es una celda para leer «23 de 30». Se dice «grupo de facultad
 * y sexo», que nombra lo mismo sin pedir nada prestado.
 *
 * El guard existe porque retirarlo a mano falló dos veces seguidas: la primera
 * pasada buscó la frase larga —«celda sexo × facultad», «celda a celda»— y dejó
 * vivos un subtítulo que decía «30 celdas», una lectura de «21 de 30 celdas
 * cumplidas» y cuatro más. **Se busca el término, no la frase.**
 *
 * `AulasControlDelLibro.tsx` queda fuera y no por descuido: ahí «celda» es una
 * celda de hoja de cálculo de verdad —«la hoja dice "…"»— y es la palabra
 * correcta para eso.
 */
describe("el perfil no publica «celda» como unidad de cuota", () => {
  const EXENTOS = new Set(["AulasControlDelLibro.tsx"]);
  /**
   * **Se busca la palabra con su determinante, no el literal.**
   *
   * La primera versión de este guard extraía los literales entre comillas y
   * plantillas, y NO MORDÍA: la leyenda que se había escapado —«si no llega al
   * final de su carril, ese grupo no cierra»— es texto plano de JSX, suelto
   * entre etiquetas y sin una sola comilla. Se comprobó reintroduciendo el
   * término y viendo el guard en verde.
   *
   * Mirar el fuente entero, en cambio, caza la prop `{ celdas }` y el import de
   * `celdasPorFacultad`, que son código y no publican nada. Lo que separa una
   * cosa de otra es que en prosa la palabra lleva delante un artículo, un
   * demostrativo o una cifra: «30 celdas», «esa celda», «Sin celdas», «Misma
   * celda». En código nunca.
   *
   * `AulasControlDelLibro.tsx` queda fuera y no por descuido: ahí «celda» es
   * una celda de hoja de cálculo de verdad y es la palabra correcta.
   */
  const EN_PROSA = /\b(?:la|las|los|una|unas|un|esa|esas|este|esta|estas|ese|cada|ninguna|ningún|ningun|otra|otras|misma|mismas|sin|de|del|en|por|\d+)\s+celdas?\b/gi;
  it.each(fuentes.filter((f) => !EXENTOS.has(f)))("%s", (archivo) => {
    // Los comentarios citan la palabra retirada para explicar por qué se fue.
    const fuente = fs
      .readFileSync(path.join(aqui, archivo), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    const culpables = [...fuente.matchAll(EN_PROSA)].map((m) => `${archivo}: …${m[0]}…`);
    expect(culpables, culpables.join("\n")).toEqual([]);
  });
});

/**
 * **Un subtítulo de panel nombra lo que hay dentro, no «filas».**
 *
 * Dos motivos, y el segundo es el que muerde.
 *
 * El primero: «filas» no dice nada. Un panel titulado «Cursos-horario con
 * brecha» con el subtítulo «98 filas» obliga a deducir que las filas son
 * cursos-horario.
 *
 * El segundo: **el payload de Monitoreo llega recortado a 500 filas** y el
 * perfil ya tiene una función para declararlo —`contadorDeCursosHorario`, que
 * escribe «se ven 500 de 1,424 cursos-horario»—. Dos paneles de Resumen la
 * usaban y la TABLA no: decía «500 filas» de un plan de 1.424, que es el mismo
 * defecto que su vecina da por resuelto —«sin decirlo la pantalla afirmaba que
 * el estudio tiene 500 aulas»—. En una tabla pesa más que en un gráfico, porque
 * quien la recorre hasta el final cree haber visto el censo completo.
 *
 * El guard mira el subtítulo y no el recorte porque el recorte no se puede leer
 * del fuente; lo que sí se puede es exigir que ningún panel resuma su contenido
 * con una palabra que no nombra su unidad.
 */
describe("ningún panel se resume en «filas»", () => {
  it.each(fuentes.filter((f) => f.endsWith(".tsx")))("%s", (archivo) => {
    const fuente = fs
      .readFileSync(path.join(aqui, archivo), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    const culpables = [...fuente.matchAll(/[^\n]{0,80}filas<\/span>/g)].map(
      (m) => `${archivo}: …${m[0].trim()}`,
    );
    expect(culpables, culpables.join("\n")).toEqual([]);
  });
});

/**
 * **Un contador que baja a uno no puede llevar el verbo en plural.**
 *
 * Medido el 2026-08-29 en `calidad/controles`: la lectura decía «**1 piden
 * revisión** · 1 advertencia · 1 correcto». Las dos vecinas concordaban con su
 * ternario y ésta no, en la misma frase. Otras dos tenían la misma forma: «1
 * faltan, en N cursos-horario» y «1 están a cinco o menos».
 *
 * El guard busca la firma exacta —una cifra en `<strong>` seguida de un verbo en
 * plural, sin ternario que lo module— porque es lo que se puede afirmar del
 * fuente. La concordancia general no se puede comprobar así; esta forma sí.
 *
 * Y la regla al repararlo: **el verbo concuerda con el número QUE SE MUESTRA**,
 * no con el valor interno. `fmtCuenta` redondea hacia arriba, así que 0,4 se
 * pinta «1» y un `valor === 1` habría dejado «1 faltan» igual.
 */
describe("los verbos concuerdan con su contador", () => {
  const VERBOS_PLURALES =
    "piden|tienen|están|estan|van|cuentan|quedan|faltan|llegan|salen|entran|siguen|caen|suman|cierran|aportan";
  it.each(fuentes.filter((f) => f.endsWith(".tsx")))("%s", (archivo) => {
    const fuente = fs
      .readFileSync(path.join(aqui, archivo), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    const culpables = [
      ...fuente.matchAll(new RegExp(`<strong>\\{[^}]{1,40}\\}</strong>\\s*(?:${VERBOS_PLURALES})\\b`, "g")),
    ].map((m) => `${archivo}: ${m[0].replace(/\s+/g, " ")}`);
    expect(culpables, culpables.join("\n")).toEqual([]);
  });
});

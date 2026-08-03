import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * ADR 0057 · Las reglas de Gonzalo, como pruebas.
 *
 * POR QUÉ EXISTE ESTE ARCHIVO
 *
 * Las mismas correcciones se repitieron varias veces en este módulo. La causa no
 * fue que las reglas estuvieran mal escritas —estaban en el ADR y en el doc del
 * loop—, sino que **nada las hacía cumplir**: los tests de cada iteración
 * confirmaban lo que se acababa de construir, no lo que estaba prohibido. Así,
 * montar la radiografía en la ruta de estudiante —contra una regla explícita—
 * dejó el gate entero en verde.
 *
 * Este archivo invierte eso: vigila las reglas por sí mismas, sobre el código
 * fuente, con independencia de qué componente se toque. Una regla sin guard es
 * una regla que se va a romper otra vez.
 *
 * Si una regla cambia, se cambia **aquí y en el ADR**, nunca sólo en el código.
 */

const raiz = new URL("../", import.meta.url);

/**
 * Lee el fuente **sin comentarios**.
 *
 * La primera versión de este guard falló contra los comentarios que explican por
 * qué se retiró «Procedencia y contrato». Un guard que se dispara con su propia
 * documentación empuja a borrar la explicación para pasar en verde, que es peor
 * que el defecto: las reglas se vigilan sobre lo que se renderiza, y las razones
 * se conservan escritas.
 */
const leer = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, raiz)), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

/**
 * Fuente sin comentarios **ni atributos `data-*`**.
 *
 * Los `data-surface-contract`, `data-qa-geometry-*` y compañía son contratos de
 * máquina que las herramientas de QA leen por nombre: cambiarlos para que un
 * guard de vocabulario pase en verde rompería esas herramientas sin mejorar una
 * sola palabra de la pantalla.
 */
const leerCopy = (rel: string) =>
  leer(rel)
    .replace(/data-[a-z-]+="[^"]*"/g, "")
    // Códigos del motor (`marginales_no_combinables`, `tipo_sesion_ausente_…`):
    // literales en snake_case, sin espacios ni mayúsculas. Son valores de
    // contrato que se comparan, no palabras que alguien lee. Traducirlos para
    // que el guard pase en verde rompería la comparación sin cambiar la
    // pantalla.
    .replace(/"[a-z0-9_]+"/g, "");

describe("ADR 0057 · regla 4 — la radiografía es de curso-horario, no de estudiante", () => {
  // «No es necesaria la radiografía [en criterios de estudiante]: la radiografía
  // es la descripción de alumnos elegibles por alguna característica de
  // curso-horario, tomando en cuenta los criterios anteriores.»
  it("los controles de criterio de estudiante no montan evidencia radiográfica", () => {
    const controles = leer("criterios/controles.tsx");
    expect(controles).not.toContain("CategoriaEvidencia");
    expect(controles).not.toContain("dominioCategorias");
    expect(controles).not.toContain("EjeCategorias");
  });

  it("la evidencia por categoría sí vive en la ruta de curso-horario", () => {
    // La contraparte de la regla: prohibirla arriba no puede dejarla sin casa.
    expect(leer("criterios/FacultadCategoriaToggles.tsx")).toContain("CategoriaEvidencia");
  });
});

describe("ADR 0057 · regla 1 — no hay sección de criterios transversales", () => {
  // «Sigues poniendo criterios generales cuando ya quedamos en que todos los
  // criterios son por facultad.» Su VALOR puede seguir siendo común —el
  // contrato no admite umbral por facultad—, pero su SITIO es el embudo de la
  // facultad, no una sección aparte que los presenta como generales.
  it("la pestaña de curso-horario no rotula un bloque «transversal»", () => {
    const tab = leer("marco/CursosHorarioMarcoTab.tsx");
    expect(tab).not.toContain("Ajustes del marco");
    expect(tab).not.toContain("Transversales a todas las facultades");
  });

  it("los criterios comunes se montan como piezas del flujo de la facultad", () => {
    const tab = leer("marco/CursosHorarioMarcoTab.tsx");
    expect(tab).toContain("slotApertura");
    expect(tab).toContain("slotCierre");
  });
});

describe("ADR 0057 · regla 2 — la matriz pertenece al Panorama", () => {
  it("la matriz se declara antes que los bloques de facultad", () => {
    const tab = leer("marco/CursosHorarioMarcoTab.tsx");
    const matriz = tab.indexOf("cmv2-chfp-matriz-title");
    const bloques = tab.indexOf("cmv2-chfp-bloques");
    expect(matriz).toBeGreaterThan(-1);
    expect(bloques).toBeGreaterThan(-1);
    expect(matriz).toBeLessThan(bloques);
  });
});

describe("ADR 0057 · regla 3 — los boxplots comparten eje y lo muestran", () => {
  it("las posiciones se calculan contra el dominio del criterio, no contra cada caja", () => {
    // F111 · El gráfico se mudó a `DistribucionCategoria` (densidad + boxplot +
    // cuantiles sobre un solo eje). La regla no cambia: **toda** posición sale
    // del dominio compartido. Si `pos()` dejara de recibirlo, cada capa se
    // normalizaría contra su propio rango y volvería el defecto que la regla 3
    // prohíbe.
    const dist = leer("criterios/DistribucionCategoria.tsx");
    expect(dist).toContain("function pos(valor: number, dom: DominioEscala)");
    expect(dist).toContain("export function dominioComun");
    // Ninguna capa puede pintar sin dominio: las tres reciben `dom`.
    for (const capa of ["Densidad", "Boxplot", "Cuantiles"]) {
      expect(dist).toMatch(new RegExp(`function ${capa}\\([^)]*dom`, "s"));
    }
  });

  it("las tres capas comparten el mismo ancho de escala", () => {
    // Medido en la app antes de la reparación: el eje medía 1.206 px y las cajas
    // 274, 263, 284 y 315. Un dominio común no sirve de nada si cada capa lo
    // proyecta sobre un ancho distinto —el mismo valor cae en un píxel diferente
    // en cada una—, así que la escala es una constante compartida y no el
    // espacio que sobre.
    const css = leer("criterios/distribucionCategoria.css");
    // `min(…, 100%)`: la escala es una constante **hasta donde cabe**. A
    // 1024×600 una caja de 260 px desbordaba 4 px en un contenedor de 256, y una
    // escala que desborda deja de ser comparable igual que una que varía.
    expect(css).toContain("width: min(var(--cmv2-cat-escala, 260px), 100%)");
    // Un solo contenedor con el ancho: las capas cuelgan de él, así que no
    // pueden divergir aunque alguien las toque por separado.
    expect((css.match(/--cmv2-cat-escala/g) ?? []).length).toBe(1);
  });

  it("la densidad sale del histograma del motor, nunca de los cuantiles", () => {
    // Entre P10 y P90 hay infinitas formas. Interpolar una es inventarla, y una
    // densidad inventada se lee con la misma confianza que una medida.
    const dist = leer("criterios/DistribucionCategoria.tsx");
    expect(dist).toContain("d.hist_breaks");
    expect(dist).toContain("d.hist_counts");
    expect(dist).toContain("counts.length !== breaks.length - 1) return null");
  });

});
describe("ADR 0057 · lenguaje y transparencia", () => {
  const superficies = [
    "marco/CursosHorarioMarcoTab.tsx",
    "marco/CriteriosRadiografiaCardDetalle.tsx",
    "criterios/CriterioCard.tsx",
    "criterios/controles.tsx",
    "criterios/FacultadCategoriaToggles.tsx",
  ];

  it("ninguna superficie de criterios esconde contenido tras un plegado", () => {
    // «Si algo está oculto es un error de diseño.»
    for (const archivo of superficies) {
      expect(leer(archivo), archivo).not.toContain("<details");
    }
  });

  it("la unidad se llama siempre «curso-horario», nunca «aula»", () => {
    // Medido: 3 «aulas» contra 60 «cursos-horario» en la misma superficie. Un
    // sinónimo suelto obliga a preguntarse si nombra otra cosa —y en este
    // módulo «aula» sí fue otra cosa en versiones anteriores—.
    const vistas = [
      "marco/AulasFinalesCard.tsx",
      "marco/FacultadDecisionBloque.tsx",
      "marco/FacultadRadiografiaCard.tsx",
    ];
    for (const archivo of vistas) {
      const textos = leer(archivo).match(/>[^<>{}]*\baulas?\b[^<>{}]*</gi) ?? [];
      expect(textos, `${archivo}: ${textos.join(" | ")}`).toHaveLength(0);
    }
  });

  it("no se usa vocabulario de método sin traducir", () => {
    // Términos exactos que no se entienden sin saberlos de antes. La advertencia
    // que llevan detrás se conserva siempre —evita cruzar dimensiones o sumar
    // columnas—; lo que cambia es que se dice en palabras del estudio.
    const jerga = [
      "marginal",
      "no aditivos",
      "el denominador",
      "del denominador",
      "downstream",
      "Dato de R",
      "Radiografía v2",
      // «frame» y «fallback» son la palabra del motor y la del programador. Se
      // buscan en construcciones inequívocamente de prosa —«el frame», «otro
      // frame»—, no la palabra suelta: `frame_hash` y `sourceFrame` son campos
      // de contrato y nombres de variable, y exigir que cambien rompería el
      // contrato sin mejorar una sola línea de la pantalla.
      "el frame",
      "otro frame",
      "del frame",
      "fallback",
    ];
    const vistas = [
      "marco/CriteriosEmbudoVivo.tsx",
      "marco/MatrizEmbudoCriterios.tsx",
      "marco/CriterioFacultadRadiografia.tsx",
      "marco/AlumnosPorChMarcoTab.tsx",
      "definicion/ReferenciaAsistenciaCard.tsx",
      "calculo/CalculoDistribucionTab.tsx",
      "calculo/CalculoCursosHorarioFacultadTab.tsx",
    ];
    // Se comprueba sobre el fuente sin comentarios: tras la traducción, estos
    // términos no aparecen en estas vistas ni en código ni en copy. Una regla
    // simple y comprobable vale más que una regex que intenta distinguir
    // etiqueta de identificador y acaba cazando ambas.
    // Sólo se mira **prosa**: literales de cadena con espacios y texto JSX. Un
    // nombre de campo (`denominador: "elegible"`) o una clave de contrato no son
    // palabras que alguien lea, y exigir que cambien rompería el contrato sin
    // mejorar la pantalla —el patrón 13 del ADR, que este guard ya tropezó dos
    // veces—.
    for (const archivo of vistas) {
      const fuente = leerCopy(archivo);
      const prosa = fuente.toLowerCase();
      for (const termino of jerga) {
        expect(prosa, `${archivo} · ${termino}`).not.toContain(termino.toLowerCase().trim());
      }
    }
  });

  it("ningún valor del motor se pinta crudo en la superficie", () => {
    // Barrido que encontró `bootstrap_percentil` y `NA` en la radiografía.
    // Renderizar `{campo}` sin traducir deja códigos de contrato en la pantalla
    // de un cliente; el motor no puede renombrarlos porque los compara por
    // nombre, así que la traducción vive aquí.
    //
    // Se vigilan los campos conocidos por su nombre: es más estable que intentar
    // adivinar por la forma del valor, y falla cuando alguien añade el campo
    // crudo a una vista nueva.
    const crudos = ["metodo_ic", "suficiencia"];
    const vistas = [
      "marco/CriterioAnclaHistorica.tsx",
      "marco/CriteriosRadiografiaCardDetalle.tsx",
      "marco/CriterioFacultadRadiografia.tsx",
    ];
    for (const archivo of vistas) {
      const fuente = leerCopy(archivo);
      for (const campo of crudos) {
        expect(fuente, `${archivo} · ${campo}`).not.toContain(`{anchor.${campo}}`);
        expect(fuente, `${archivo} · ${campo}`).not.toContain(`{cell.${campo}}`);
      }
    }
    // Y la notación de ausencia es la del usuario, no la de R.
    expect(leerCopy("marco/CriteriosRadiografiaCardDetalle.tsx")).not.toContain('"NA"');
  });

  it("no se muestra el contrato interno del motor al usuario", () => {
    for (const archivo of superficies) {
      const fuente = leer(archivo);
      expect(fuente, archivo).not.toContain("Procedencia y contrato");
      expect(fuente, archivo).not.toContain("trazabilidad completa");
    }
  });
});

describe("ADR 0057 · una sola tarjeta para todas las categorías (F112)", () => {
  /**
   * Gonzalo, al aprobar el diseño: «si este va a ser el criterio de tarjeta que
   * vamos a utilizar, tiene que estar este mismo criterio en absolutamente
   * todos los criterios, en cada una de las categorías de criterio donde haya
   * cursos-horario».
   *
   * Antes había dos tratamientos para el mismo dato: los criterios categóricos
   * con `CategoriaEvidencia`, y los numéricos y de rango con un bloque compacto
   * propio —su boxplot, su escala, su lista de diez cifras—. Dos gráficos que
   * describen lo mismo y no se parecen enseñan a desconfiar de ambos.
   */
  const SUPERFICIES_CON_CATEGORIAS = [
    "criterios/FacultadCategoriaToggles.tsx",
    "marco/CriterioFacultadRadiografia.tsx",
  ];

  for (const archivo of SUPERFICIES_CON_CATEGORIAS) {
    it(`${archivo} dibuja sus categorías con la tarjeta común`, () => {
      const fuente = leer(archivo);
      expect(fuente, archivo).toContain("<CategoriaEvidencia");
    });

    it(`${archivo} no conserva un gráfico propio en paralelo`, () => {
      // Un segundo boxplot en la misma superficie vuelve a partir el
      // tratamiento aunque la tarjeta esté presente.
      const fuente = leer(archivo);
      expect(fuente, archivo).not.toContain("<CriterioBoxplotPercentilar");
      expect(fuente, archivo).not.toContain("<BoxplotElegibles");
    });
  }

  it("ninguna superficie de criterios recorta su lista de categorías", () => {
    // Un `slice(0, N)` sobre las categorías esconde decisiones y las sustituye
    // por un contador. Medido antes de F112: se veían 4 de N segmentos.
    for (const archivo of SUPERFICIES_CON_CATEGORIAS) {
      const fuente = leer(archivo);
      expect(fuente, archivo).not.toMatch(/MAX_VISIBLE_SEGMENTS|\.slice\(0,\s*MAX/);
    }
  });

  it("el segundo boxplot del módulo comparte escala con sus hermanos", () => {
    // `BoxplotElegibles` normalizaba cada caja contra su propio [min…max]: la
    // regla 3 en la superficie donde nadie la había mirado.
    const fuente = leer("marco/BoxplotElegibles.tsx");
    expect(fuente).toContain("dominio");
    expect(fuente).toContain("boxplotPosicionesPropias(caja, dominio)");
    expect(leer("marco/TipoSesionRadiografia.tsx")).toContain("boxplotDominioComun");
  });
});

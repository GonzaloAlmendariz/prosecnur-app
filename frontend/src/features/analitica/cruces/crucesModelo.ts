// Cómo se leen las tablas cruzadas que devuelve la vista previa de Cruces
// (`POST /api/analitica/cruces/preview`).
//
// Aquí no se decide nada sobre las tablas: qué filas y columnas llevan, sus
// porcentajes, sus N, sus bases y sus letras vienen del servicio, que usa lo
// mismo que escribe el archivo. Este módulo solo las convierte en texto y
// empareja cada celda con su fila por el código que la celda trae, nunca por
// su posición ni por su rótulo. La única cuenta que hace es la proporción de la
// línea de base (casos que respondieron sobre casos de la base), como en
// Frecuencias.

import type {
  CrucesPreview,
  CrucesPreviewCelda,
  CrucesPreviewCruce,
  CrucesPreviewFilaOmitida,
  CrucesPreviewRegla,
  CrucesPreviewTabla,
  CrucesUnidad,
} from "../../../api/analitica";
import { enumerar } from "../../../lib/enumerar";
import { formatoConteo, formatoConteoDe, formatoDecimal } from "../../../lib/formatoNumero";
import type { TonoCifra } from "../CifrasPestana";
import type { ResumenSecciones } from "../estructuraDeSecciones";
import type { Lectura } from "../tablas/useLecturaPorBase";
import { porcentajeDeBase, seccionesDeLaHoja } from "../tablas/vistaPreviaModelo";

/** Cuántas tablas se piden de entrada y cuántas más cada vez (el servicio usa 20 por defecto). */
export const CRUCES_POR_PEDIDO = 20;
/** El tope del servicio. */
export const TOPE_DE_CRUCES = 200;

/** El valor del selector de columnas que muestra todas las variables de cruce, como el archivo. */
export const TODAS_LAS_VARIABLES = "";

/** El tipo de una variable del formulario en castellano; `null` si no es de selección. */
export function tipoDeVariable(tipo: string | null | undefined): string | null {
  const t = (tipo ?? "").trim().toLowerCase().split(/\s+/)[0];
  if (t === "select_one") return "Selección única";
  if (t === "select_multiple") return "Selección múltiple";
  return null;
}

/** Por variable de cruce, el rótulo de cada categoría por su código, tal como lo traen las columnas de la vista previa. */
export function etiquetasDeCategorias(preview: CrucesPreview | null): Map<string, Map<string, string>> {
  const porVariable = new Map<string, Map<string, string>>();
  for (const t of preview?.tablas ?? []) {
    for (const c of t.cruces) {
      const mapa = porVariable.get(c.variable) ?? new Map<string, string>();
      for (const col of c.columnas) if (!mapa.has(col.codigo) && col.etiqueta !== col.codigo) mapa.set(col.codigo, col.etiqueta);
      porVariable.set(c.variable, mapa);
    }
  }
  return porVariable;
}

/** La tabla es la de la variable de fila pedida. */
export function esLaTablaDe(tabla: CrucesPreviewTabla, variable: string): boolean {
  return tabla.variable === variable;
}

/** "1 encuestado", "1,281 encuestados", "7 registros". */
export function conteoEn(n: number, unidad: CrucesUnidad): string {
  return formatoConteoDe(n, unidad);
}

/** El sustantivo de la unidad en plural, para un rótulo: "encuestados", "registros". */
export function unidadEnPlural(unidad: CrucesUnidad): string {
  return `${unidad}s`;
}

/**
 * La línea de base de una tabla cruzada. Los conteos van en la fila de pie
 * (Casos, N ponderado y Base), así que aquí va la proporción sobre la base de
 * la tabla, en su unidad: "Respondió el 43.6 % de los 1,281 encuestados". Sin
 * base conocida, el conteo: "Respondieron 559 encuestados".
 */
export function textoDeBaseDeCruce(tabla: CrucesPreviewTabla): string | undefined {
  if (tabla.sin_datos) return undefined;
  const { n, de, unidad } = tabla.base;
  const multiple = tabla.tipo === "multiple";
  if (de === null || de <= 0) return `${multiple ? "Marcaron alguna opción" : "Respondieron"} ${conteoEn(n, unidad)}`;
  const deCuantos = de === 1 ? `de 1 ${unidad}` : `de los ${conteoEn(de, unidad)}`;
  return `${multiple ? "Marcó alguna opción" : "Respondió"} el ${porcentajeDeBase(n / de)} % ${deCuantos}`;
}

/** Fija los decimales de una cifra ya formateada: "17.3" con 2 es "17.30". */
function conDecimales(texto: string, digitos: number): string {
  const [entero, fraccion = ""] = texto.split(".");
  return `${entero}.${fraccion.padEnd(digitos, "0")}`;
}

/** Porcentaje de una celda como lo escribe el archivo: dos decimales fijos (0.58958 es "58.96"). */
export function porcentajeDeCelda(pct: number | null): string {
  return pct === null ? "" : conDecimales(formatoDecimal(pct * 100, 2, ""), 2);
}

/** El rótulo de la fila de los N de cada columna: con pesos es una suma de pesos. */
/**
 * El rótulo de la fila de los N de cada columna. Con pesos es una suma de
 * pesos. Sin pesos ese conteo ES la base sin ponderar, y se nombra igual que
 * la fila de base con pesos, en su unidad: "Casos" valía encuestados en una
 * tabla y registros en otra de la misma hoja.
 */
export function rotuloDeN(ponderado: boolean, unidad: CrucesUnidad): string {
  return ponderado ? "N ponderado" : rotuloDeBase(unidad);
}

/** El rótulo de la fila de bases, que solo se pinta con pesos (sin pesos la base es el mismo N). */
export function rotuloDeBase(unidad: CrucesUnidad): string {
  return `Base (${unidadEnPlural(unidad)})`;
}

/** Las celdas de una columna por el código de su fila. */
export function celdasPorFila(celdas: readonly CrucesPreviewCelda[]): Map<string, CrucesPreviewCelda> {
  return new Map(celdas.map((c) => [c.fila, c]));
}

/** Las variables de cruce que se ven: todas, como el archivo, o la elegida en el selector. */
export function crucesALaVista(tabla: CrucesPreviewTabla, elegida: string): CrucesPreviewCruce[] {
  if (elegida === TODAS_LAS_VARIABLES) return tabla.cruces;
  return tabla.cruces.filter((c) => c.variable === elegida);
}

/** Cuántas columnas de cifras lleva una tabla con lo que se ve: la del Total y las de cada variable de cruce. */
export function columnasDeCifras(cruces: readonly CrucesPreviewCruce[]): number {
  return 1 + cruces.reduce((suma, c) => suma + c.columnas.length, 0);
}

export type VariableDeCruce = { variable: string; etiqueta: string };

/**
 * Las variables de cruce de la hoja, en el orden del archivo, con el rótulo
 * que trae la primera tabla que las lleva. Las que no tienen columnas en
 * ninguna tabla no se ofrecen.
 */
export function variablesDeCruce(preview: CrucesPreview): VariableDeCruce[] {
  const etiquetas = new Map<string, string>();
  for (const tabla of preview.tablas) {
    for (const c of tabla.cruces) if (!etiquetas.has(c.variable)) etiquetas.set(c.variable, c.etiqueta);
  }
  return preview.cruces
    .filter((c) => etiquetas.has(c.variable))
    .map((c) => ({ variable: c.variable, etiqueta: etiquetas.get(c.variable) ?? c.variable }));
}

/** La elegida en el selector si sigue en la hoja; si no, la primera. */
export function cruceVigente(variables: readonly VariableDeCruce[], elegida: string | null): string {
  if (elegida === TODAS_LAS_VARIABLES) return TODAS_LAS_VARIABLES;
  if (elegida && variables.some((v) => v.variable === elegida)) return elegida;
  return variables[0]?.variable ?? TODAS_LAS_VARIABLES;
}

export type ClaseDeLetras = "letras" | "flechas" | "sin-comparar";

/**
 * Cómo se lee el texto de una celda en la subtabla de letras: letras de
 * columnas superadas, flechas frente al resto, o una marca de que no se
 * comparó (".b" base insuficiente, ".a" proporción de 0 o 100 %). El texto se
 * pinta tal cual; esto solo elige el estilo.
 */
export function claseDeLetras(letras: string | null): ClaseDeLetras | null {
  if (letras === null || letras === "") return null;
  if (letras.startsWith(".")) return "sin-comparar";
  if (/[▲▼△▽]/.test(letras)) return "flechas";
  return "letras";
}

/** Por qué una fila no sale en la tabla. */
function motivoDeOmision(motivo: string): string {
  if (motivo === "rotulo_repetido") return "repite el rótulo de otra fila";
  if (motivo === "rotulo_total_o_vacio") return "su rótulo está vacío o es Total";
  if (motivo === "especial_sin_casos") return "es un código especial sin casos";
  return "el archivo no la escribe";
}

/**
 * Una fila que el archivo no escribe. Sus casos ya cuentan en "casos sin fila"
 * (única) y en una múltiple solo queda fuera quien marcó únicamente esa
 * opción: la nota dice cuántos la eligieron, no cuántos quedan fuera.
 */
function textoDeOmitida(f: CrucesPreviewFilaOmitida, unidad: CrucesUnidad, tipo: CrucesPreviewTabla["tipo"]): string {
  const inicio = `"${f.etiqueta}" no sale como fila: ${motivoDeOmision(f.motivo)}.`;
  if (f.casos === null) return inicio;
  return tipo === "multiple"
    ? `${inicio} La marcaron ${conteoEn(f.casos, unidad)}; quien marcó solo esa opción queda fuera de la tabla.`
    : `${inicio} La eligieron ${conteoEn(f.casos, unidad)}.`;
}

/** El vacío de una tabla que existe pero nadie respondió: va en lugar de su grilla. */
export const TABLA_SIN_RESPUESTAS = "Nadie respondió esta pregunta: el archivo la escribe con ceros.";

/**
 * La nota de letras que se repite en la mayoría de las tablas. Se dice una vez
 * sobre la hoja; una tabla con otra nota la lleva en su pie.
 */
export function notaComun(tablas: readonly CrucesPreviewTabla[]): string | null {
  const veces = new Map<string, number>();
  for (const t of tablas) {
    const nota = t.significancia?.nota;
    if (nota) veces.set(nota, (veces.get(nota) ?? 0) + 1);
  }
  let mejor: string | null = null;
  let max = 0;
  for (const [nota, n] of veces) {
    if (n > max) {
      mejor = nota;
      max = n;
    }
  }
  return mejor;
}

/**
 * Lo que una tabla dice bajo sus filas, en este orden: por qué tiene ceros o
 * casos fuera, qué variable de cruce deja casos sin columna o sin letras, la
 * nota de letras si no es la común y las líneas del pie del archivo.
 */
export function notasDeLaTabla(tabla: CrucesPreviewTabla, cruces: readonly CrucesPreviewCruce[], comun: string | null): string[] {
  const unidad = tabla.base.unidad;
  const notas: string[] = [];
  const sinFila = tabla.total?.casos_sin_fila ?? 0;
  if (sinFila > 0) {
    // `casos_sin_fila` ya incluye a quienes eligieron una fila omitida: se dice, para no sumarlos dos veces.
    const conOmitidas = tabla.filas_omitidas.length > 0 ? ", contando los de las filas que no salen" : "";
    notas.push(`${conteoEn(sinFila, unidad)} con una respuesta que no es ninguna de estas filas${conOmitidas}: no cuentan en la tabla.`);
  }
  for (const f of tabla.filas_omitidas) notas.push(textoDeOmitida(f, unidad, tabla.tipo));
  for (const c of cruces) {
    const sinColumna = c.sin_columna.base_n ?? 0;
    if (sinColumna > 0) {
      const ajenos = c.sin_columna.valores_no_reconocidos;
      const detalle = ajenos > 0 ? ` (${formatoConteo(ajenos)} con un valor que no es categoría del formulario)` : "";
      notas.push(`${conteoEn(sinColumna, unidad)} sin columna en "${c.etiqueta}"${detalle}: cuentan en el Total.`);
    }
    if (c.significancia?.metodo === "cluster_robust") {
      notas.push(`Letras de "${c.etiqueta}": prueba con el encuestado como conglomerado, porque cada encuestado aporta varios registros; no sigue la regla aplicada.`);
    }
    if (c.significancia?.motivo === "letras_por_rotulo_no_calculadas") {
      notas.push(`Sin letras en "${c.etiqueta}": la base guarda el rótulo de la categoría y no su código, y la prueba compara por código.`);
    } else if (c.significancia?.metodo === "descriptivo" && c.significancia.motivo && !(tabla.significancia?.nota ?? "").includes(c.significancia.motivo)) {
      notas.push(`Sin letras en "${c.etiqueta}": ${c.significancia.motivo}`);
    }
  }
  const nota = tabla.significancia?.nota;
  if (nota && nota !== comun) notas.push(nota);
  return [...notas, ...tabla.notas];
}

/**
 * La leyenda de la hoja, dicha una vez al final: qué es cada porcentaje, el
 * redondeo del N ponderado (con pesos), qué son las flechas si alguna variable
 * de cruce a la vista se compara frente al resto y la nota de letras común.
 */
export function lineasDeLeyenda(
  cruces: readonly CrucesPreviewCruce[],
  ponderado: boolean,
  comun: string | null,
  maxLetras: number,
): string[] {
  const lineas = ["Porcentajes por columna: cada celda es el porcentaje de los casos de su columna. En las preguntas de selección múltiple suman más de 100."];
  if (ponderado) lineas.push("N ponderado redondeado a entero: las columnas pueden no sumar el Total.");
  if (cruces.some((c) => c.significancia?.modo === "frente_al_resto")) {
    lineas.push(`Con más de ${formatoConteo(maxLetras)} columnas, cada columna se compara con el resto de los casos: ▲ mayor y ▼ menor que el resto; △ y ▽, la misma diferencia, frágil.`);
  }
  if (comun) lineas.push(comun);
  return lineas;
}

/** Una variable de cruce sin comparación (`descriptivo`) no lleva letra de columna: la letra sugería una prueba. */
export function conLetraDeColumna(cruce: CrucesPreviewCruce): boolean {
  return cruce.significancia?.metodo !== "descriptivo";
}

// ---------- Regla de las letras ----------

export type FilaDeRegla = { rotulo: string; valor: string };

/**
 * La regla con que se calcularon las letras de estas tablas
 * (`significancia_regla`, la que la prueba usó de verdad), en llano.
 */
export function filasDeLaRegla(regla: CrucesPreviewRegla, ponderado: boolean): FilaDeRegla[] {
  const filas: FilaDeRegla[] = [];
  if (regla.prueba === "rao_scott") {
    filas.push({ rotulo: "Prueba", valor: `Rao-Scott por ${regla.conglomerado ?? "conglomerado"}` });
  } else if (regla.prueba === "z") {
    filas.push({ rotulo: "Prueba", valor: "z de diferencia de proporciones" });
  }
  if (regla.correccion === "bonferroni_fila") filas.push({ rotulo: "Corrección", valor: "Bonferroni dentro de cada fila" });
  else if (regla.correccion === "bh_informe") filas.push({ rotulo: "Corrección", valor: "Benjamini-Hochberg en todo el informe" });
  if (regla.alfa !== null) filas.push({ rotulo: "Nivel", valor: `p < ${formatoDecimal(regla.alfa, 3, "")}` });
  if (regla.umbral_puntos !== null) {
    filas.push({ rotulo: "Diferencia mínima", valor: regla.umbral_puntos > 0 ? `${formatoDecimal(regla.umbral_puntos, 1, "")} puntos` : "Sin mínimo" });
  }
  if (regla.base_minima !== null) {
    filas.push({ rotulo: "Base mínima", valor: `${formatoConteo(regla.base_minima)} casos sin ponderar por columna` });
  }
  if (regla.max_letras !== null) {
    filas.push({ rotulo: "Letras", valor: `Hasta ${formatoConteo(regla.max_letras)} columnas; con más, cada una frente al resto` });
  }
  // Lo que el motor saca de la prueba por su rótulo o su código (`.SIG_FUERA_DE_PRUEBA_RX`), salvo con `incluir_ns`.
  filas.push({
    rotulo: "Filas sin prueba",
    valor: regla.incluir_ns
      ? "Todas las filas entran a la prueba"
      : "No sabe, No responde, No aplica, Prefiero no responder, Otro y los códigos 90 a 99",
  });
  if (ponderado && regla.n_prueba === "pesos_llevados_a_media_1") {
    filas.push({
      rotulo: "Error estándar",
      valor: "Con los pesos llevados a media 1, sin el efecto de diseño de la ponderación: marca más diferencias que una prueba con el tamaño efectivo de muestra",
    });
  } else if (ponderado && regla.n_prueba === "linealizacion_con_pesos_y_conglomerado") {
    filas.push({ rotulo: "Error estándar", valor: "Linealizado con pesos y conglomerado" });
  }
  return filas;
}

/** "Del estudio" o "Propuesta"; sin origen conocido, nada. */
export function origenDeLaRegla(regla: CrucesPreviewRegla): string | null {
  if (regla.origen === "estudio") return "Del estudio";
  if (regla.origen === "propuesta") return "Propuesta";
  return null;
}

// ---------- Avisos ----------

export type AvisoDeCruces = { clave: string; texto: string };

/**
 * Los avisos que se dicen en otro lugar no se repiten: los de una hoja sin
 * tablas, en su vacío; el del modo no aplicado, bajo el control del modo.
 */
const DICHOS_EN_SU_LUGAR = new Set(["sin_variables_de_cruce", "base_sin_variables_de_cruce", "modo_dimensiones", "modo_configurado_no_aplicado"]);

function lista(nombres: readonly string[]): string {
  return enumerar(nombres.map((n) => `"${n}"`));
}

/** Las etiquetas de las variables de cruce de la hoja que cumplen una condición, sin repetir. */
function crucesQue(preview: CrucesPreview, cumple: (c: CrucesPreviewCruce) => boolean): string[] {
  const vistas = new Map<string, string>();
  for (const t of preview.tablas) for (const c of t.cruces) if (cumple(c) && !vistas.has(c.variable)) vistas.set(c.variable, c.etiqueta);
  return [...vistas.values()];
}

function motivoSinColumnas(motivo: string): string {
  if (motivo === "excluida") return "está excluida del análisis";
  if (motivo === "no_categorica") return "no es de selección única ni múltiple";
  if (motivo === "fuera_de_la_base") return "no está en esta base";
  if (motivo === "no_configurada") return "no está entre las variables a cruzar";
  return "el archivo no le da columnas";
}

function causaSinTablaDeCruces(motivo: string): string {
  if (motivo === "numerica") return "es numérica: el archivo la trae con su resumen y la vista previa no la muestra.";
  if (motivo === "excluida") return "está excluida del análisis.";
  if (motivo === "fuera_del_archivo") return "está en la base y no entra al archivo: su sección está oculta o su tipo no lleva tabla.";
  return "no está en la base ni en el formulario.";
}

/** Por qué la pregunta pedida aparte no tiene tabla cruzada; `null` si la tiene o no se sabe. */
export function sinTablaDeLaElegida(preview: CrucesPreview, variable: string, etiquetaDe: (variable: string) => string): string | null {
  if (preview.tablas.some((t) => esLaTablaDe(t, variable))) return null;
  const motivo = preview.sin_tabla.find((s) => s.variable === variable)?.motivo;
  return `"${etiquetaDe(variable)}" ${causaSinTablaDeCruces(motivo ?? "desconocida")}`;
}

/**
 * Los avisos del servicio dichos con su causa y con el nombre que ve el
 * usuario (la pregunta, no la columna). Cada uno sale de los campos de la
 * respuesta, no de reinterpretar el mensaje; uno que no se conoce va tal cual.
 */
export function avisosDeCruces(preview: CrucesPreview, etiquetaDe: (variable: string) => string): AvisoDeCruces[] {
  const avisos: AvisoDeCruces[] = [];
  for (const aviso of preview.avisos) {
    const codigo = aviso.codigo;
    if (DICHOS_EN_SU_LUGAR.has(codigo)) continue;
    if (codigo === "exclusion_global") {
      // El servicio ya lo dice con la categoría, la pregunta y la unidad.
      avisos.push({ clave: codigo, texto: aviso.mensaje });
    } else if (codigo === "exclusion_sin_casos") {
      for (const ex of preview.exclusiones) {
        for (const cat of ex.categorias.filter((c) => c.filas === 0)) {
          avisos.push({
            clave: `${codigo}/${ex.variable}/${cat.codigo}`,
            texto: `Excluir la categoría ${cat.codigo} de "${etiquetaDe(ex.variable)}" no quitó ningún caso: la base no tiene ese código en esa variable, o guarda el rótulo en su lugar.`,
          });
        }
      }
    } else if (codigo === "casos_sin_columna") {
      // En una variable de cruce múltiple, el motor cuenta como "valor no reconocido" a quien marcó varias
      // opciones ("1 3" no es clave de ninguna columna, reporte_cruces_tabla.R:165 y :186): su causa es otra.
      const nombres = crucesQue(preview, (c) => !c.multiple && c.sin_columna.valores_no_reconocidos > 0);
      if (nombres.length > 0) {
        avisos.push({
          clave: codigo,
          texto: `${lista(nombres)} ${nombres.length === 1 ? "trae" : "traen"} valores que no son categorías del formulario (por ejemplo, códigos y rótulos mezclados): esos casos no entran en ninguna columna y el Total sí los cuenta.`,
        });
      }
      for (const etiqueta of crucesQue(preview, (c) => c.multiple && c.sin_columna.valores_no_reconocidos > 0)) {
        avisos.push({
          clave: `${codigo}/multiple/${etiqueta}`,
          texto: `"${etiqueta}" es de selección múltiple: quien marcó varias opciones no entra en ninguna columna y el Total sí lo cuenta.`,
        });
      }
    } else if (codigo === "letras_por_rotulo_no_calculadas") {
      const nombres = crucesQue(preview, (c) => c.significancia?.motivo === "letras_por_rotulo_no_calculadas");
      avisos.push({
        clave: codigo,
        texto: `Sin letras de diferencias en ${lista(nombres)}: la base guarda el rótulo de la categoría y no su código, y la prueba compara por código. El archivo trae esas letras vacías o como base insuficiente.`,
      });
    } else if (codigo === "cruce_multiple") {
      const nombres = crucesQue(preview, (c) => c.multiple);
      avisos.push({
        clave: codigo,
        texto: `${lista(nombres)} ${nombres.length === 1 ? "es" : "son"} de selección múltiple: cada columna cuenta solo a quienes marcaron esa única opción, y quien marcó varias no entra en ninguna.`,
      });
    } else if (codigo === "cruces_sin_columnas") {
      for (const c of preview.cruces_sin_columnas) {
        avisos.push({ clave: `${codigo}/${c.variable}`, texto: `"${etiquetaDe(c.variable)}" no tiene columnas en las tablas: ${motivoSinColumnas(c.motivo)}.` });
      }
    } else if (codigo === "numericas_sin_vista_previa") {
      const numericas = preview.sin_tabla.filter((s) => s.motivo === "numerica").map((s) => etiquetaDe(s.variable));
      avisos.push({
        clave: codigo,
        texto: numericas.length === 1
          ? `El archivo trae la tabla de la pregunta numérica ${lista(numericas)}, que la vista previa no muestra.`
          : `El archivo trae las tablas de ${formatoConteo(numericas.length)} preguntas numéricas que la vista previa no muestra: ${lista(numericas)}.`,
      });
    } else if (codigo === "variables_sin_tabla") {
      for (const s of preview.sin_tabla.filter((x) => x.motivo !== "numerica")) {
        avisos.push({ clave: `${codigo}/${s.variable}`, texto: `"${etiquetaDe(s.variable)}" ${causaSinTablaDeCruces(s.motivo)}` });
      }
    } else {
      avisos.push({ clave: `${codigo}/${avisos.length}`, texto: aviso.mensaje });
    }
  }
  if (preview.ponderacion.configurada && !preview.ponderado) {
    avisos.push({ clave: "pesos", texto: "La ponderación está activada y no se aplicó: las tablas salen sin pesos. Revísala en Ponderación." });
  }
  return avisos;
}

// ---------- Vacío, banda y botón ----------

export type CausaDelVacio = { titulo: string; descripcion: string; agregarVariable: boolean };

/** Por qué la hoja no tiene tablas, y si lo que falta es una variable a cruzar. */
export function causaDelVacio(preview: CrucesPreview, resumen: ResumenSecciones): CausaDelVacio {
  const aviso = (codigo: string) => preview.avisos.find((a) => a.codigo === codigo)?.mensaje ?? null;
  const sinVariables = aviso("sin_variables_de_cruce");
  if (sinVariables) return { titulo: "Sin variables de cruce", descripcion: sinVariables, agregarVariable: true };
  const sinBase = aviso("base_sin_variables_de_cruce");
  if (sinBase) return { titulo: "Sin tablas de esta base", descripcion: sinBase, agregarVariable: false };
  const dimensiones = aviso("modo_dimensiones");
  if (dimensiones) return { titulo: "Sin vista previa", descripcion: dimensiones, agregarVariable: false };
  if (preview.total_en_archivo > 0) {
    return {
      titulo: "Sin tablas que mostrar",
      descripcion: "Las preguntas del archivo son numéricas: salen con su resumen y la vista previa no las muestra.",
      agregarVariable: false,
    };
  }
  const ocultas = resumen.modo === "declaradas" && resumen.activas === 0;
  return {
    titulo: "Sin tablas en el archivo",
    descripcion: ocultas
      ? "Todas las secciones están ocultas. Muestra alguna en la pestaña Datos."
      : "No hay preguntas que cruzar. Incluye alguna en la pestaña Datos.",
    agregarVariable: false,
  };
}

export type TextoDeCifra = { valor: string; titulo?: string; tono?: TonoCifra };

/** El rótulo de la cifra de tablas: con varias bases, la vista previa es de una. */
export function rotuloDeTablasDeCruces(lectura: Lectura<CrucesPreview>): string {
  return (lectura.datos?.base.n_bases ?? 1) > 1 ? "Tablas de esta base" : "Tablas en el archivo";
}

/** Las tablas del archivo, numéricas incluidas: `total_en_archivo`. */
export function cifraDeTablasDeCruces(lectura: Lectura<CrucesPreview>): TextoDeCifra {
  if (lectura.fase === "error") return { valor: "Sin leer", tono: "alerta", titulo: "No se pudo leer la vista previa del archivo." };
  if (lectura.datos === null) return { valor: "Leyendo" };
  return { valor: formatoConteo(lectura.datos.total_en_archivo) };
}

/** Las variables de cruce con columnas en el archivo. */
export function cifraDeVariablesDeCruce(lectura: Lectura<CrucesPreview>): TextoDeCifra {
  if (lectura.fase === "error") return { valor: "Sin leer", tono: "alerta" };
  if (lectura.datos === null) return { valor: "Leyendo" };
  const n = lectura.datos.cruces.length;
  return { valor: formatoConteo(n), tono: n === 0 ? "alerta" : undefined };
}

/** Con qué pesos salen las tablas, según la vista previa. */
export function cifraDePesosDeCruces(lectura: Lectura<CrucesPreview>): TextoDeCifra {
  if (lectura.fase === "error") return { valor: "Sin leer", tono: "alerta" };
  const p = lectura.datos;
  if (p === null) return { valor: "Leyendo" };
  if (p.ponderado) {
    const unidad = unidadEnPlural(p.casos?.unidad ?? "encuestado");
    const regla = `Porcentajes y N ponderados; las bases, en ${unidad} sin ponderar.`;
    const n = p.ponderacion.n_efectivo;
    return { valor: "Con ponderación", tono: "acento", titulo: n === null ? regla : `${regla} n efectivo: ${formatoConteo(n)}.` };
  }
  if (p.ponderacion.configurada) return { valor: "Sin aplicar", tono: "alerta", titulo: "La ponderación está activada y no se aplicó." };
  return { valor: "Sin ponderación" };
}

/**
 * Lo que se lee junto al botón de generar cuando está deshabilitado. Generar
 * con ajustes sin guardar usaría los anteriores; sin base preparada o sin
 * variables a cruzar no hay archivo.
 */
export function motivoSinGenerarCruces(
  lectura: Lectura<CrucesPreview>,
  variablesACruzar: number,
  ajustes: { sinGuardar: boolean; errorGuardado: string | null },
): string | undefined {
  if (ajustes.errorGuardado) return "Ajustes sin guardar";
  if (ajustes.sinGuardar) return "Guardando los ajustes";
  if (variablesACruzar === 0) return "Agrega al menos una variable a cruzar.";
  if (lectura.fase === "error") return lectura.codigo === "E_NO_RP_DATA" ? "Falta preparar la base." : undefined;
  if (lectura.datos === null) return "Leyendo las tablas del archivo";
  // La vista previa es de la base activa; el archivo sale de todas las que traen variables de cruce
  // (`base.bases_del_archivo`). Bloquea solo si ninguna otra base las trae.
  const datos = lectura.datos;
  const otrasConCruces = datos.base.bases_del_archivo.filter((b) => b !== datos.base.nombre).length;
  if (datos.tablas.length === 0 && datos.total_en_archivo === 0 && otrasConCruces === 0) return "El archivo no tendría tablas.";
  return undefined;
}

/** Las preguntas con tabla de la hoja, para "Ir a una pregunta". */
export function preguntasDeLaHoja(tablas: readonly CrucesPreviewTabla[]): { variable: string; codigo: string; etiqueta: string }[] {
  return tablas.map((t) => ({ variable: t.variable, codigo: t.variable, etiqueta: t.etiqueta }));
}

/** Las tablas agrupadas por sección en el orden en que llegan (la misma lectura que Frecuencias). */
export function seccionesDeCruces(tablas: readonly CrucesPreviewTabla[]) {
  return seccionesDeLaHoja(tablas);
}

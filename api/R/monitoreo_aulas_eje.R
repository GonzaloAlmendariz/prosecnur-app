# **Cuál es el eje de las cuotas. Una vez.**
#
# Hasta aquí el eje era la FACULTAD, y no porque alguien lo hubiera decidido en
# un sitio: porque cinco capas independientes —metas, avance, afijación,
# certificación y el libro— volvieron a escribir `"faculty"` cada una en su
# rincón. La aritmética nunca supo de facultades (`monitoreo_aulas_brecha_facultad()`
# recibe `(cuota, conseguidas, celdas)` y nada más), pero tres cosas sí la ataban:
# qué columna leía cada capa, cómo se llamaba su campo de salida, y algún
# vocabulario congelado con `stop()`.
#
# CCSS Perfil 2026-II lo rompió: vive dentro de UNA facultad y sus metas son por
# NIVEL CURRICULAR. Con el eje en facultad ese estudio tiene un solo estrato y
# todas las superficies caen a la vez en su caso degenerado —una fila al 100 %,
# un bloque que no se pliega, una página de PDF que se omite—. Ninguna sustituye
# el eje: lo colapsan.
#
# Así que el eje se DECLARA, y aquí se resuelve. Dos decisiones de forma que
# importan:
#
# - **`atribucion` y `fuente_valor` viajan en el eje, no en un `if`.** Son lo
#   que separa `facultad` (la respuesta hereda el valor del AULA del plan) de
#   `nivel` (lo hereda de la PERSONA, vía padrón). Un tercer eje futuro declara
#   su par y no toca ninguna capa.
# - **`monitoreo_aulas_eje_key()` es un ALIAS de `.cm_criterios_fac_key()`, no un
#   rename.** Aquélla tiene 92 llamadas en 32 archivos y arregla la «ñ»
#   (`calc_muestra_aulas_criterios.R`); renombrarla es un diff de 92 sitios sin
#   cambio de conducta. El alias cuesta dos líneas y lo que cambia es el nombre
#   por el que se LEE: en el código nuevo se escribe «clave del eje», no «clave
#   de facultad».
#
# El eje nace en `facultad`. Un estudio que no lo declare —HSVG y todo lo
# vigente— resuelve `columna = "faculty"`, `atribucion = "aula"`,
# `fuente_valor = "plan"`, que es exactamente lo que el código hacía ya sin
# saberlo. Por eso su prueba es de IDENTIDAD, no de plausibilidad.

# Los ejes declarables. Lista cerrada a propósito: un eje nuevo se agrega aquí y
# las cinco capas lo heredan sin tocarlas. `alias` es lo que se busca en el
# data.frame, no lo que se muestra.
.MONITOREO_AULAS_EJES <- list(
  facultad = list(
    clave = "facultad",
    columna = "faculty",
    alias = c("faculty", "facultad", "stratum"),
    etiqueta = "Facultad",
    etiqueta_plural = "Facultades",
    etiqueta_sin = "Sin facultad",
    # **Las dos frases con las que se NOMBRA una celda en prosa.** Declaradas y
    # no derivadas, por el mismo motivo que el plural: derivarlas de la etiqueta
    # obliga a acertar con el género del demostrativo y del artículo en cada
    # eje nuevo, y «esa nivel» aparecería en la pantalla más vista.
    #
    # `frase_celda` dice de qué celda se habla sin nombrarla («esa facultad»);
    # `frase_valor` es la plantilla que nombra un valor dentro de una oración.
    # Para facultad es `%s` a propósito: así las frases de HSVG salen byte a
    # byte como estaban.
    frase_celda = "esa facultad",
    frase_valor = "%s",
    # La respuesta hereda el valor del aula del plan a la que se atribuyó.
    atribucion = "aula",
    fuente_valor = "plan"
  ),
  # **Carrera.** Nace como dimensión del RESUMEN OPERATIVO, no como eje de
  # cuotas: CCSS Perfil 2026-II mide por nivel y describe por carrera. Se
  # declara aquí igual que las otras para que un estudio que sí quiera medir
  # por carrera no tenga que añadir nada. Su atribución es del AULA —la carrera
  # del curso-horario—, que es lo correcto para «dónde está trabajando el
  # equipo» y lo que NO hay que confundir con la carrera de la PERSONA, que sale
  # del padrón y vive en el panel referencial.
  carrera = list(
    clave = "carrera",
    columna = "program",
    alias = c("program", "carrera", "programa", "especialidad", "plan_de_estudios"),
    etiqueta = "Carrera",
    etiqueta_plural = "Carreras",
    etiqueta_sin = "Sin carrera",
    frase_celda = "esa carrera",
    frase_valor = "%s",
    atribucion = "aula",
    fuente_valor = "plan"
  ),
  nivel = list(
    clave = "nivel",
    columna = "level",
    alias = c("level", "nivel", "nivel_curricular", "ciclo"),
    etiqueta = "Nivel",
    etiqueta_plural = "Niveles",
    etiqueta_sin = "Sin nivel",
    frase_celda = "ese nivel",
    frase_valor = "nivel %s",
    # La respuesta hereda el valor de la PERSONA, resuelta por su código
    # declarado contra el padrón. Sin padrón no hay valor: la respuesta va a la
    # bolsa declarada, no a una celda inventada.
    atribucion = "persona",
    fuente_valor = "padron"
  )
)

#' El eje de cuotas del estudio, resuelto.
#'
#' @param cfg config de aulas universitarias (`cfg$aulas_universitarias`, o la
#'   config completa: se acepta cualquiera de las dos para que ninguna capa
#'   tenga que saber a qué altura la recibió).
#' @return la lista del eje. Sin declaración, el eje de siempre: `facultad`.
#' @export
monitoreo_aulas_eje <- function(cfg = list()) {
  if (!is.list(cfg)) cfg <- list()
  # La config completa trae el bloque de aulas dentro; una capa que ya lo
  # desempacó pasa el bloque pelado. Las dos entradas valen.
  aulas <- if (is.list(cfg[["aulas_universitarias"]])) cfg[["aulas_universitarias"]] else cfg
  clave <- .monitoreo_text_key(.monitoreo_scalar(aulas[["eje_cuota"]] %||% "", ""))
  if (!nzchar(clave) || is.null(.MONITOREO_AULAS_EJES[[clave]])) clave <- "facultad"
  eje <- .MONITOREO_AULAS_EJES[[clave]]
  eje$motivo <- .monitoreo_scalar(aulas[["eje_cuota_motivo"]] %||% "", "")
  eje
}

#' La columna del eje en un data.frame concreto.
#'
#' El plan, el marco y las respuestas no nombran sus columnas igual, y ninguna
#' capa debería saber cuál de los tres está mirando. Se resuelve por alias con
#' el mismo buscador que usa el resto de la familia (`.monitoreo_aulas_col`):
#' coincidencia exacta primero, normalizada después.
#'
#' @param df `data.frame` donde buscar (plan, marco o respuestas).
#' @param eje el eje resuelto por [monitoreo_aulas_eje()].
#' @return el nombre de la columna, o `""` si ninguna calza.
#' @export
monitoreo_aulas_columna_eje <- function(df, eje = NULL) {
  if (!is.list(eje) || !length(eje)) eje <- monitoreo_aulas_eje(list())
  .monitoreo_aulas_col(df, eje[["alias"]] %||% character(0))
}

#' La clave normalizada de un valor del eje.
#'
#' Alias de `.cm_criterios_fac_key()`: misma función, mismo arreglo de la «ñ»
#' —que existe porque en macOS `iconv` convierte «ñ» en «~n» y «Arte y Diseño»
#' dejaba de calzar con «ARTE Y DISENO»—, otro nombre para leerla. No se
#' renombra la original: 92 llamadas en 32 archivos por cero cambio de conducta.
#'
#' @param x valores del eje tal como vienen del plan o del marco.
#' @return las claves normalizadas.
#' @export
monitoreo_aulas_eje_key <- function(x) {
  .cm_criterios_fac_key(x)
}

#' El bloque del eje que viaja en los contratos de salida.
#'
#' Se cuelga como campo HERMANO de `facultades` en `design_targets` y en
#' `avance_cuota`, nunca en su lugar: el contrato del import está congelado
#' (`test-monitoreo-aulas-metas-diseno.R`, ADR 0079) y `facultades`,
#' `facultad` y `faculty_key` conservan sus nombres. Lo que cambia es su VALOR;
#' lo que este bloque añade es qué significan.
#'
#' Un contrato viejo sin `eje` se lee como `facultad`, que es lo que es.
#'
#' @param eje el eje resuelto por [monitoreo_aulas_eje()].
#' @return lista con la declaración del eje, apta para serializar.
#' @export
monitoreo_aulas_eje_declaracion <- function(eje = NULL) {
  if (!is.list(eje) || !length(eje)) eje <- monitoreo_aulas_eje(list())
  list(
    clave = .monitoreo_scalar(eje[["clave"]], "facultad"),
    columna = .monitoreo_scalar(eje[["columna"]], "faculty"),
    etiqueta = .monitoreo_scalar(eje[["etiqueta"]], "Facultad"),
    etiqueta_plural = .monitoreo_scalar(eje[["etiqueta_plural"]], "Facultades"),
    etiqueta_sin = .monitoreo_scalar(eje[["etiqueta_sin"]], "Sin facultad"),
    atribucion = .monitoreo_scalar(eje[["atribucion"]], "aula"),
    fuente_valor = .monitoreo_scalar(eje[["fuente_valor"]], "plan"),
    motivo = .monitoreo_scalar(eje[["motivo"]], "")
  )
}

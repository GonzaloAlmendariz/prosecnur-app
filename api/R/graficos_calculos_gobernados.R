# =============================================================================
# graficos_calculos_gobernados.R — cómo se redondea NO se decide por lámina
# =============================================================================
#
# El redondeo de porcentajes y la cantidad de decimales son decisiones de
# informe, no de gráfico: en un mazo de sesenta láminas no tiene sentido que la
# 12 redondee distinto que la 13. Hasta ahora vivían donde vive cualquier ajuste
# estético —el preset del tipo, con el override del slide pisándolo—, y esa
# cascada permitía justo lo que no debe pasar: un override guardado hace meses
# en una lámina suelta cambiándole las cifras a esa sola sin que nadie lo vea.
#
# Aquí viven las dos cosas que hacen falta para cerrar eso:
#
#   1. La CLASIFICACIÓN de qué familia admite qué. La sirve el endpoint de
#      metadata para que la pestaña «Cálculos» no tenga que duplicarla en el
#      frontend: si la verdad vive en dos sitios, en algún momento discrepan.
#   2. El SANEO de los overrides, que quita estos campos del nivel del slide
#      para que gane la configuración general.
#
# Ver `docs/qa/checklist-redondeo-decimales-2026-08-14.md` (ítems 6, 9-12).

#' Campos que gobierna la configuración general y nadie pisa por lámina.
#' @keywords internal
.CALCULOS_CAMPOS <- c(
  "metodo_redondeo",
  "decimales", "decimales_pct", "valores_decimales"
)

#' Qué familias entran en la pestaña «Cálculos» y cuáles eligen método.
#'
#' `cierra_100` es la pregunta que decide si el reparto significa algo: sin un
#' total que cerrar no hay resto que repartir, y ofrecer el método sería un
#' mando incapaz de hacer nada. Una batería de respuesta múltiple, una brecha
#' entre bases o una serie temporal caen de ese lado.
#'
#' Lo que NO está en esta lista queda fuera de la pestaña: box plot, media y
#' rango, histograma de conteos, indicador numérico, nube de palabras, mapa de
#' cobertura y las familias de dimensiones no rotulan porcentajes de una
#' distribución, aunque algunas tengan `decimales` por otros motivos.
#' @keywords internal
.PRESETS_CALCULOS <- list(
  barras_apiladas     = list(cierra_100 = TRUE),
  multi_apiladas      = list(cierra_100 = TRUE),
  barras_categoricas  = list(cierra_100 = TRUE),
  pie                 = list(cierra_100 = TRUE),
  donut               = list(cierra_100 = TRUE),
  barras_agrupadas    = list(cierra_100 = FALSE),
  barras_divergentes  = list(cierra_100 = FALSE),
  puntos_comparativos = list(cierra_100 = FALSE),
  dumbbell            = list(cierra_100 = FALSE),
  lollipop            = list(cierra_100 = FALSE),
  serie_temporal      = list(cierra_100 = FALSE)
)

#' Bloque `calculos` que acompaña a cada preset en `/presets-metadata`.
#'
#' Devuelve `NULL` para las familias que no rotulan porcentajes, y el frontend
#' las omite de la matriz. `campo_decimales` se resuelve contra los args reales
#' del preset porque el nombre cambia según la familia (`decimales`,
#' `decimales_pct`, `valores_decimales`) y esa diferencia no debería obligar al
#' frontend a conocer las tres.
#' @keywords internal
.calculos_meta_de_preset <- function(nombre, args = list()) {
  spec <- .PRESETS_CALCULOS[[nombre]]
  if (is.null(spec)) return(NULL)

  nombres_arg <- vapply(
    args,
    function(a) as.character(a$name %||% "")[1],
    character(1)
  )
  campo_dec <- intersect(
    c("decimales", "decimales_pct", "valores_decimales"),
    nombres_arg
  )

  list(
    familia_porcentaje = TRUE,
    cierra_100         = isTRUE(spec$cierra_100),
    admite_metodo      = isTRUE(spec$cierra_100) && "metodo_redondeo" %in% nombres_arg,
    campo_decimales    = if (length(campo_dec)) campo_dec[[1]] else ""
  )
}

#' Porcentaje EXACTO de cada categoría, sin redondear.
#'
#' Sustituye a `.pct_enteros_100()`, que vivía dentro de `reporte_plan_ppt.R` y
#' repartía por resto mayor **antes** de llamar al graficador. Aquello convertía
#' las frecuencias en enteros que sumaban 100 y le entregaba `pct_int / 100`, de
#' modo que cuando el graficador iba a rotular ya no quedaba decimal que
#' redondear: su método de redondeo no tenía nada que decidir, y el criterio del
#' informe lo fijaba en silencio una función del plan.
#'
#' Se descubrió al regenerar el mazo de ACRD CONTA con el motor ya unificado y
#' verlo salir idéntico a la revisión: medido sobre las cuatro bases reales,
#' `.pct_enteros_100()` reproducía la columna PPT del Excel en 62 de 63 filas.
#'
#' Ahora el plan entrega el dato y el graficador decide cómo se escribe, que es
#' donde esa decisión es visible y configurable. El reparto por resto mayor no
#' se pierde: sigue disponible como `metodo_redondeo = "reparto"`.
#'
#' @param n Frecuencias de la tabla.
#' @return Porcentajes en escala 0-100 con sus decimales; ceros si no hay masa.
#' @keywords internal
.calculos_pct_exacto <- function(n) {
  n <- suppressWarnings(as.numeric(n))
  n[is.na(n) | !is.finite(n)] <- 0
  tot <- sum(n)
  if (!is.finite(tot) || tot <= 0) return(rep(0, length(n)))
  n / tot * 100
}

#' Preset de estilo que le corresponde a un tipo de elemento del plan.
#'
#' El plan habla de `barras_apiladas`; el preset se llama igual casi siempre,
#' pero no siempre —`barras_multiapiladas` es `multi_apiladas`, `numerico` es
#' `barras_numericas`—, y ese casi es justo lo que rompe un `paste0()` ingenuo.
#' @keywords internal
.calculos_preset_de_etype <- function(etype) {
  key <- paste0("p_", as.character(etype)[1])
  if (!key %in% names(.GRAFICADOR_PRESET_KEYS)) return("")
  as.character(unname(.GRAFICADOR_PRESET_KEYS[[key]]))
}

#' Texto de la nota que declara el criterio de redondeo.
#'
#' Se redacta distinto según el método porque lo que hay que advertir es
#' distinto. Con el estándar, el lector puede sumar las cifras de una barra y
#' obtener 101: la nota existe para que eso no parezca un error. Con el reparto
#' la suma siempre cierra, y lo que conviene declarar es lo otro —que una cifra
#' puede no ser la de su propio valor—, porque es lo que no cuadra si alguien
#' compara contra una tabla.
#'
#' @param metodo Método efectivo de la familia.
#' @param decimales Resolución rotulada.
#' @return Una línea de texto, o `""` si no hay nada que declarar.
#' @keywords internal
.calculos_nota_texto <- function(metodo = "estandar", decimales = 0) {
  dec <- suppressWarnings(as.integer(decimales)[1])
  if (!is.finite(dec) || dec < 0) dec <- 0L
  unidad <- if (dec == 0L) "al entero más cercano" else
    sprintf("a %d decimal%s", dec, if (dec == 1L) "" else "es")

  if (identical(.pulso_pct_metodo(metodo), "reparto")) {
    return(paste0(
      "Los porcentajes están redondeados ", unidad,
      " repartiendo el resto para que cada barra sume exactamente 100 %."
    ))
  }
  paste0(
    "Los porcentajes están redondeados ", unidad,
    ", por lo que pueden no sumar exactamente 100 %."
  )
}

#' Inyecta la nota de redondeo en un elemento del plan, si procede.
#'
#' Condiciones, todas necesarias: el interruptor encendido en la base, que la
#' familia rotule porcentajes, y que la lámina no traiga ya una nota propia.
#'
#' Lo último importa más de lo que parece. La nota de significancia se aplica
#' con esta misma regla —solo si no hay nota— y si las dos se pisaran, la que
#' explica las letras de significancia desaparecería sin dejar rastro. Aquí se
#' **anexan**: la del analista o la de significancia primero, la del redondeo
#' después, que es el orden en que se leen.
#'
#' @param el Elemento del plan.
#' @param presets Bloques de preset resueltos.
#' @return El elemento, con `overrides$nota_pie` completado cuando corresponde.
#' @keywords internal
.calculos_aplicar_nota <- function(el, presets = list()) {
  base_args <- presets$base$args %||% list()
  if (!isTRUE(base_args$nota_redondeo)) return(el)

  preset <- .calculos_preset_de_etype(el$.element_type %||% "")
  if (!nzchar(preset) || is.null(.PRESETS_CALCULOS[[preset]])) return(el)

  args_familia <- presets[[preset]]$args %||% list()
  nota <- .calculos_nota_texto(
    args_familia$metodo_redondeo %||% "estandar",
    args_familia$decimales %||% args_familia$decimales_pct %||%
      args_familia$valores_decimales %||% 0
  )
  if (!nzchar(nota)) return(el)

  previa <- el$overrides$nota_pie %||% el$nota_pie %||% ""
  previa <- as.character(previa)[1]
  if (is.na(previa)) previa <- ""
  if (nzchar(trimws(previa))) {
    # Ya declarada: no se repite. Pasa cuando el analista escribe la suya
    # mencionando el redondeo, y dos frases sobre lo mismo al pie sobran.
    if (grepl("redondead", previa, ignore.case = TRUE)) return(el)
    nota <- paste0(trimws(previa), " ", nota)
  }

  if (is.null(el$overrides)) el$overrides <- list()
  el$overrides$nota_pie <- nota
  el
}

#' Quita del override de una lámina lo que gobierna la configuración general.
#'
#' La cascada del motor es `base` → `preset del tipo` → `override del slide`, y
#' el último gana. Para estos campos esa precedencia se invierte, y la forma más
#' barata de invertirla es que no lleguen: un override que no existe no puede
#' ganar. Se hace aquí y no en cada `.render_*` porque los puntos de merge son
#' muchos y basta olvidar uno para que una familia quede fuera del gobierno.
#'
#' Los valores viejos NO se borran del plan guardado: se ignoran al renderizar.
#' Si mañana se decide volver a permitirlos, siguen ahí.
#'
#' @param overrides Lista de overrides de un elemento.
#' @return La misma lista sin los campos gobernados.
#' @keywords internal
.calculos_sanear_overrides <- function(overrides) {
  if (is.null(overrides) || !length(overrides)) return(overrides)
  if (is.null(names(overrides))) return(overrides)
  overrides[!(names(overrides) %in% .CALCULOS_CAMPOS)]
}

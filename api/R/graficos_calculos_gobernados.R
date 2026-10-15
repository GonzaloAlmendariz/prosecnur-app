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

#' Modos de la nota de redondeo, en el orden en que los ofrece la UI.
#' @keywords internal
.CALCULOS_NOTA_MODOS <- c("nunca", "si_no_cierra", "siempre")

#' Modo efectivo de la nota de redondeo según el preset `base`.
#'
#' `nota_redondeo_modo` manda cuando trae un valor reconocible. Si falta —planes
#' guardados antes de que existiera, o un valor que no se reconoce— se deduce
#' del interruptor viejo `nota_redondeo`: encendido era «siempre» y apagado,
#' «nunca». Así un `.pulso` viejo sale igual que antes.
#'
#' @param base_args Args del preset `base`.
#' @return `"nunca"`, `"si_no_cierra"` o `"siempre"`.
#' @keywords internal
.calculos_nota_modo <- function(base_args = list()) {
  m <- suppressWarnings(as.character(base_args$nota_redondeo_modo %||% "")[1])
  m <- if (is.na(m)) "" else tolower(trimws(m))
  if (m %in% .CALCULOS_NOTA_MODOS) return(m)
  if (isTRUE(base_args$nota_redondeo)) "siempre" else "nunca"
}

#' Texto de la nota que va al pie: el propio del analista o el automático.
#'
#' `nota_redondeo_texto` vacío o ausente significa «automático». Con texto, se
#' usa tal cual: el analista lo escribió para este informe y no se le añade ni
#' se le quita nada.
#' @keywords internal
.calculos_nota_texto_efectivo <- function(base_args = list(), metodo = "estandar",
                                          decimales = 0) {
  propio <- suppressWarnings(as.character(base_args$nota_redondeo_texto %||% "")[1])
  if (!is.na(propio) && nzchar(trimws(propio))) return(trimws(propio))
  .calculos_nota_texto(metodo, decimales)
}

#' ¿Alguna cifra rotulada de este conjunto deja de sumar 100?
#'
#' Responde sobre las cifras TAL COMO SE ROTULAN: mismo método y mismos
#' decimales que el gráfico, vía `.pulso_pct_unidades()`, que es la función que
#' escribe las etiquetas. Con el reparto la suma cierra por construcción y la
#' respuesta es siempre `FALSE`.
#'
#' Un conjunto que no es una distribución —respuesta múltiple, un subconjunto de
#' opciones— no tiene un 100 que cerrar: sus proporciones no suman 1 y la
#' pregunta no aplica. Se usa la misma tolerancia (0,01) con la que categóricas
#' y torta deciden si el reparto tiene sentido.
#'
#' @param p Proporciones de UNA barra/serie (escala 0-1). Las categorías
#'   residuales que se rotulan en la barra van incluidas.
#' @param dec Decimales rotulados.
#' @param metodo Método de redondeo del gráfico.
#' @return `TRUE` si la suma rotulada difiere de 100 %.
#' @keywords internal
.calculos_no_cierra <- function(p, dec = 0, metodo = "estandar") {
  if (identical(.pulso_pct_metodo(metodo), "reparto")) return(FALSE)
  p <- suppressWarnings(as.numeric(p))
  p <- p[is.finite(p)]
  if (!length(p)) return(FALSE)
  s <- sum(p)
  if (!is.finite(s) || s <= 0 || abs(s - 1) > 0.01) return(FALSE)
  d <- suppressWarnings(as.integer(dec)[1])
  if (!is.finite(d) || d < 0) d <- 0L
  sum(.pulso_pct_unidades(p, d, "estandar")) != as.integer(100L * 10^d)
}

#' Anexa la nota de redondeo a un pie, salvo que ya hable del redondeo.
#'
#' La previa primero —la del analista, la de significancia o la Base que
#' torta y categóricas llevan en su caption—, la del redondeo después, que es
#' el orden en que se leen. Si la previa ya menciona el redondeo, o ya trae
#' este mismo texto, no se repite.
#'
#' @return El pie compuesto, o `previa` tal cual si no hay nada que anexar.
#' @keywords internal
.calculos_nota_anexar <- function(previa, nota) {
  nota <- trimws(as.character(nota %||% "")[1])
  if (is.na(nota) || !nzchar(nota)) return(previa)
  pv <- trimws(as.character(previa %||% "")[1])
  if (is.na(pv) || !nzchar(pv)) return(nota)
  if (grepl("redondead", pv, ignore.case = TRUE) || grepl(nota, pv, fixed = TRUE)) return(previa)
  paste0(pv, if (grepl("[.!?:;]$", pv)) " " else ". ", nota)
}

#' Resuelve, dentro del graficador, la nota de redondeo de una familia que cierra a 100.
#'
#' Para estas familias (`cierra_100` en `.PRESETS_CALCULOS`: apiladas,
#' multiapiladas, categóricas, torta y dona) el plan no escribe la nota en
#' `nota_pie`: deja la marca `nota_redondeo_pie` y el graficador la resuelve
#' aquí, por dos razones.
#'
#'   1. En «Sólo si una barra no suma 100 %» la decisión necesita las cifras, y
#'      el plan todavía no las tiene. El graficador ya calculó las unidades que
#'      va a rotular y sabe si alguna barra no cierra (`.calculos_no_cierra()`).
#'   2. Escrita en el plan, la nota PISABA el caption que el renderer arma
#'      después: en torta y categóricas ese caption es la Base, y la lámina
#'      salía sin Base; en multiapiladas era la nota de significancia. Aquí se
#'      anexa a lo que haya.
#'
#' @param nota_pie Pie que recibió el graficador.
#' @param marca `list(texto, solo_si_no_cierra)` dejada por `.calculos_aplicar_nota()`, o `NULL`.
#' @param no_cierra `TRUE` si alguna barra rotulada no suma 100.
#' @return El pie a dibujar.
#' @keywords internal
.calculos_nota_resolver <- function(nota_pie, marca = NULL, no_cierra = FALSE) {
  if (is.null(marca) || !is.list(marca)) return(nota_pie)
  if (isTRUE(marca$solo_si_no_cierra) && !isTRUE(no_cierra)) return(nota_pie)
  .calculos_nota_anexar(nota_pie, marca$texto)
}

#' Lleva el pie con la nota de redondeo a la lámina nativa y al Word.
#'
#' La lámina nativa y el Word no leen el caption del ggplot: leen
#' `attr(p, "note_outside")` (`.plot_note_from()`), y si no existe, la nota del
#' elemento guardado, que no tiene la de redondeo. Sin esto la nota de una
#' apilada no llegaba a ninguna lámina. Solo se marca cuando se anexó la nota:
#' en otro caso el gráfico sale exactamente como antes.
#'
#' @param obj Gráfico que devuelve el graficador.
#' @param antes Pie que recibió el graficador.
#' @param despues Pie resuelto por `.calculos_nota_resolver()`.
#' @keywords internal
.calculos_nota_al_grafico <- function(obj, antes, despues) {
  if (is.null(obj) || identical(antes, despues) || is.null(despues)) return(obj)
  attr(obj, "note_outside") <- trimws(as.character(despues)[1])
  obj
}

#' Inyecta la nota de redondeo en un elemento del plan, si procede.
#'
#' Condiciones, todas necesarias: un modo distinto de «nunca» en la base, que la
#' familia rotule porcentajes, y que la lámina no traiga ya una nota que hable
#' del redondeo. Se **anexa**, no pisa: la del analista o la de significancia
#' primero, la del redondeo después.
#'
#' Las familias que cierran a 100 no reciben la nota aquí sino una marca
#' (`overrides$nota_redondeo_pie`) que resuelve su graficador
#' (`.calculos_nota_resolver()`); en «si_no_cierra» además solo entran ellas, y
#' nunca con el reparto, que siempre cierra. Las demás familias de porcentaje
#' —agrupadas, divergentes, series…— la reciben en `nota_pie`, como antes, y
#' solo en «siempre».
#'
#' @param el Elemento del plan.
#' @param presets Bloques de preset resueltos.
#' @return El elemento, con `overrides$nota_redondeo_pie` u `overrides$nota_pie`
#'   cuando corresponde.
#' @keywords internal
.calculos_aplicar_nota <- function(el, presets = list()) {
  base_args <- presets$base$args %||% list()
  modo <- .calculos_nota_modo(base_args)
  if (identical(modo, "nunca")) return(el)

  preset <- .calculos_preset_de_etype(el$.element_type %||% "")
  spec <- if (nzchar(preset)) .PRESETS_CALCULOS[[preset]] else NULL
  if (is.null(spec)) return(el)

  args_familia <- presets[[preset]]$args %||% list()
  metodo <- args_familia$metodo_redondeo %||% "estandar"
  condicional <- identical(modo, "si_no_cierra")
  cierra <- isTRUE(spec$cierra_100)
  if (condicional && (!cierra || identical(.pulso_pct_metodo(metodo), "reparto"))) {
    return(el)
  }

  nota <- .calculos_nota_texto_efectivo(
    base_args, metodo,
    args_familia$decimales %||% args_familia$decimales_pct %||%
      args_familia$valores_decimales %||% 0
  )
  if (!nzchar(nota)) return(el)

  previa <- el$overrides$nota_pie %||% el$nota_pie %||% ""
  previa <- as.character(previa)[1]
  if (is.na(previa)) previa <- ""
  final <- .calculos_nota_anexar(previa, nota)
  # Ya declarada: no se repite. Pasa cuando el analista escribe la suya
  # mencionando el redondeo, y dos frases sobre lo mismo al pie sobran.
  if (identical(final, previa)) return(el)

  if (is.null(el$overrides)) el$overrides <- list()
  if (cierra) {
    el$overrides$nota_redondeo_pie <- list(texto = nota, solo_si_no_cierra = condicional)
  } else {
    el$overrides$nota_pie <- final
  }
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

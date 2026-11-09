# =============================================================================
# graficos_propuesta_resumen.R — la propuesta del motor para el resumen ejecutivo y el resumen de diferencias
# =============================================================================
#
# H13 del checklist de usabilidad del editor (2026-11-05). Gonzalo: «no me deja ni escoger para mí cuáles son los
# hallazgos». Con `seleccion = "auto"` el motor elige por capítulo los hallazgos de `p_slide_hallazgos` (modos «resumen»
# y «titulares») y las filas de `p_slide_resumen_diferencias`, pero el editor no tenía cómo verlos: se mostraba atenuado
# y vacío, y «Los escribo yo» arrancaba de cero.
#
# Aquí se devuelve esa propuesta en la MISMA forma del payload que el editor guarda (capítulos con sus cifras o filas),
# más campos de sólo lectura para mostrarla (la cifra y la diferencia principal). No se elige nada nuevo:
#   - hallazgos: la selección es `.halla_res_auto` (graficos_hallazgos_resumen.R) y las cifras salen de
#     `.halla_modelo` con esos capítulos puestos en manual, que es la lámina que dibujaría el motor;
#   - resumen de diferencias: el modelo `.resumen_dif_modelo` en auto ya guarda la candidata de cada fila elegida.
# Las fuentes, la regla inclusiva, los rótulos cortos y la regla de diferencias son los de la vista previa
# (`.graficos_preview_comun`, `.sig_opciones_preview`); el plan se rearma como en el job de PPT, porque la selección
# automática recorre las preguntas de TODO el informe (la vista previa sólo arma la lámina).
#
# Cada cifra o fila lleva además `clave` (sólo lectura, H14): si su pregunta está en `plan$preguntas_clave`, que la
# selección automática prefiere (graficos_preguntas_clave.R).
#
# Las respuestas (`fila`, `top2box`) vuelven con el rótulo del instrumento, el que muestra el selector de categorías
# del editor: la regla inclusiva y los rótulos cortos las convierten igual al dibujar, así que la lámina no cambia.

.PROPUESTA_TIPOS <- c("p_slide_hallazgos", "p_slide_resumen_diferencias")

#' Flecha de una diferencia: llena al 99% y hueca al 95%
#' @keywords internal
.propuesta_flecha <- function(dir, fragil) {
  if (identical(dir, "up")) (if (isTRUE(fragil)) "△" else "▲") else (if (isTRUE(fragil)) "▽" else "▼")
}

#' La diferencia principal en una línea: «Algún padre univ. 92% ▲ frente al 80% del resto» o «Sin diferencias por…»
#' @param comp Comparación de `.halla_comparacion_auto(..., principal = TRUE)`, o NULL.
#' @return `list(estado, texto)`; `estado` es «diferencia», «sin_diferencias» o «sin_prueba».
#' @keywords internal
.propuesta_diferencia <- function(comp) {
  if (is.null(comp) || identical(comp$estado, "sin_prueba")) {
    return(list(estado = "sin_prueba", texto = "No se pudo probar frente a los grupos del informe"))
  }
  pa <- comp$partes[[1]]
  texto <- if (identical(comp$estado, "diferencia")) {
    paste(c(paste(pa$texto, .propuesta_flecha(pa$dir, pa$fragil)), comp$cola), collapse = " ")
  } else pa$texto
  list(estado = comp$estado, texto = texto)
}

#' Una lámina del plan por su id (formato del editor), o NULL
#' @keywords internal
.propuesta_slide_por_id <- function(plan_slides, slide_id) {
  for (s in plan_slides %||% list()) if (identical(as.character(s$id %||% "")[1], slide_id)) return(s)
  NULL
}

#' Valida que la lámina admita propuesta: un resumen ejecutivo («resumen» o «titulares») o un resumen de diferencias
#' @keywords internal
.propuesta_validar_lamina <- function(slide) {
  slide <- as.list(slide)
  tipo <- as.character(slide$tipo %||% "")[1]
  if (is.na(tipo) || !tipo %in% .PROPUESTA_TIPOS) {
    stop_api(422, "E_PROPUESTA_TIPO", "Sólo el resumen ejecutivo y el resumen de diferencias tienen una propuesta del motor.",
             details = list(tipo = tipo))
  }
  if (identical(tipo, "p_slide_hallazgos")) {
    modo <- .dif_chr1(slide$payload$modo) %||% "cifras"
    if (!modo %in% .HALLAZGOS_MODOS_RESUMEN) {
      stop_api(422, "E_PROPUESTA_TIPO", "Los hallazgos en modo de cifras se escriben a mano: el motor sólo propone el resumen ejecutivo.",
               details = list(tipo = tipo, modo = modo))
    }
  }
  slide$payload <- as.list(slide$payload %||% list())
  slide
}

#' Prepara una lámina del editor como la convierte el job: regla inclusiva, rótulos cortos y referencias con la base
#' @keywords internal
.propuesta_preparar <- function(s, mapa, inclusivo, base) {
  if (isTRUE(inclusivo)) s <- .inclusivo_preparar_lamina(s, mapa)
  .graficos_calificar_refs_plan(list(slides = list(s)), base)$slides[[1]]
}

#' Rearma el plan del editor como lista de `ppt_slide`; una lámina que no se puede leer queda fuera, con su aviso
#' @keywords internal
.propuesta_plan_motor <- function(plan_slides, mapa, inclusivo, base, icon_registry) {
  out <- list()
  for (i in seq_along(plan_slides)) {
    s <- tryCatch(.graficos_rebuild_slide_json(.propuesta_preparar(plan_slides[[i]], mapa, inclusivo, base), icon_registry = icon_registry),
                  error = function(e) {
                    .dif_aviso("Propuesta", sprintf("la lámina %d no se pudo leer y sus preguntas no entran a la propuesta (%s).", i, conditionMessage(e)))
                    NULL
                  })
    if (!is.null(s)) out[[length(out) + 1L]] <- s
  }
  out
}

#' Traductor de rótulos al del instrumento: el rótulo convertido (inclusivo y corto) vuelve al que eligió el editor
#' @param crudas `list(data_sources, inst_sources)` sin convertir; NULL si no hubo conversión.
#' @return Función `(var, etiquetas) -> etiquetas`.
#' @keywords internal
.propuesta_traductor <- function(crudas, base, mapa, inclusivo) {
  if (!isTRUE(inclusivo) || is.null(crudas) || !base %in% names(crudas$data_sources)) return(function(var, x) x)
  conv <- .inclusivo_convertidor(mapa)
  fuente <- .sig_fuente(crudas$data_sources[[base]], crudas$inst_sources[[base]])
  cache <- list()
  function(var, x) {
    if (!length(x)) return(x)
    if (is.null(cache[[var]])) {
      ind <- tryCatch(.sig_indicadores(fuente$data, .reporte_plan_resolve_recod_var(var, fuente$data), survey = fuente$survey,
                                       orders_list = fuente$orders_list), error = function(e) NULL)
      crudos <- if (is.null(ind)) character(0) else colnames(ind$Y)
      cache[[var]] <<- stats::setNames(crudos, conv(crudos))
    }
    m <- cache[[var]]
    i <- match(x, names(m))
    ifelse(is.na(i), x, unname(m[i]))
  }
}

#' Quita los campos vacíos de un registro del payload (la API no manda `{}` en lugar de un campo ausente)
#' @keywords internal
.propuesta_compacto <- function(x) x[!vapply(x, function(v) is.null(v) || (is.atomic(v) && !length(v)), logical(1))]

# ---- Hallazgos (resumen ejecutivo) -----------------------------------------------------------------------------------

#' Hallazgos por capítulo que admite la selección automática (el mismo tope que `.halla_resumen_modelo`)
#' @keywords internal
.propuesta_halla_por_capitulo <- function(el) {
  topes <- .HALLAZGOS_RESUMEN_TOPES
  if (identical(.dif_chr1(el$modo), "titulares")) 1L else .halla_res_tope(el$max_por_capitulo, topes$auto_por_capitulo, topes$por_capitulo)
}

#' Propuesta del resumen ejecutivo: los capítulos de `.halla_res_auto` y lo que dibuja cada cifra
#' @return `list(capitulos, modelo)`: `capitulos` en la forma del payload; `modelo`, el de la lámina con ellos en manual.
#' @keywords internal
.propuesta_hallazgos <- function(el, fuente, sig, plan, traducir = function(var, x) x) {
  el$seleccion <- "auto"
  claves <- .preguntas_clave_de(sig)
  cx <- .dif_cruces(el, plan, sig, fuente)
  caps <- .halla_res_auto(fuente, sig, cx, el$tautologicos %||% list(), plan, .propuesta_halla_por_capitulo(el))
  manual <- el; manual$seleccion <- "manual"; manual$capitulos <- caps
  modelo <- .halla_modelo(manual, fuente, sig, plan)
  dibujados <- unlist(modelo$paginas, recursive = FALSE)
  k <- 0L
  capitulos <- lapply(caps, function(c) {
    d <- NULL
    if (k < length(dibujados) && identical(dibujados[[k + 1L]]$titulo, c$titulo)) { k <<- k + 1L; d <- dibujados[[k]] }
    cifras <- lapply(seq_along(c$cifras), function(j) {
      x <- c$cifras[[j]]
      var <- .sig_var_local(x$var)
      kpi <- if (!is.null(d) && j <= length(d$kpis)) d$kpis[[j]] else NULL
      dif <- .propuesta_diferencia(kpi$comparacion)
      top <- traducir(var, .dif_chr(x$top2box))
      .propuesta_compacto(list(
        var = var, fila = if (length(top)) NULL else traducir(var, .dif_chr1(x$fila)), top2box = if (length(top)) I(top) else NULL,
        texto = x$texto, comparacion = "auto",
        # Sólo lectura: lo que va a salir en la lámina, y si la pregunta es clave del estudio (H14).
        clave = var %in% claves,
        pregunta = .tarjetas_rotulo_var(var, fuente$survey), frase = kpi$texto %||% NA_character_,
        cifra = kpi$cifra %||% NA_character_, n = kpi$n %||% NA_integer_,
        diferencia = dif$texto, diferencia_estado = dif$estado))
    })
    list(titulo = c$titulo, cifras = cifras)
  })
  list(capitulos = capitulos, modelo = modelo)
}

# ---- Resumen de diferencias ------------------------------------------------------------------------------------------

#' Propuesta del resumen de diferencias: las filas que elige `.resumen_dif_modelo` en auto, con su candidata
#' @return `list(capitulos, modelo)`.
#' @keywords internal
.propuesta_resumen_dif <- function(el, fuente, sig, plan, traducir = function(var, x) x) {
  el$seleccion <- "auto"
  claves <- .preguntas_clave_de(sig)
  modelo <- .resumen_dif_modelo(el, fuente, sig, plan)
  cx <- .dif_cruces(el, plan, sig, fuente)
  capitulos <- lapply(modelo$capitulos, function(c) {
    filas <- lapply(c$filas, function(f) {
      cd <- f$candidata
      var <- .sig_var_local(cd$var)
      ce <- f$celdas
      probados <- if (is.null(ce)) character(0) else unique(ce$cruce[ce$estado %in% c("dif", "igual")])
      comp <- if (is.null(ce)) NULL else .halla_comparacion_auto(list(celdas = ce, probados = probados), cx, principal = TRUE)
      dif <- .propuesta_diferencia(comp)
      top <- traducir(var, .dif_chr(cd$top2box))
      .propuesta_compacto(list(
        var = var, fila = if (length(top)) NULL else traducir(var, .dif_chr1(cd$fila)), top2box = if (length(top)) I(top) else NULL,
        rotulo = cd$rotulo,
        # Sólo lectura: lo que va a salir en la lámina, y si la pregunta es clave del estudio (H14).
        clave = var %in% claves,
        pregunta = .tarjetas_rotulo_var(var, fuente$survey), rotulo_lamina = f$rotulo, cifra = .tarjetas_pct(f$total),
        n = f$n, diferencia = dif$texto, diferencia_estado = dif$estado))
    })
    list(titulo = c$titulo, filas = filas)
  })
  list(capitulos = capitulos, modelo = modelo)
}

# ---- Cálculo completo ------------------------------------------------------------------------------------------------

#' Propuesta del motor para una lámina de resumen, sobre fuentes y plan ya resueltos (puro respecto de la sesión)
#'
#' @param slide Lámina en el formato del editor (`id`, `tipo`, `payload`).
#' @param plan_slides Láminas del plan en el formato del editor (la selección recorre todo el informe).
#' @param data_sources,inst_sources Fuentes como las recibe el motor (ya con la regla inclusiva, si aplica).
#' @param sig_informe Regla y familia del estudio (`.sig_contexto_liviano`), o NULL para la regla de fábrica.
#' @param mapa Rótulos cortos del estudio; `inclusivo` dice si la regla inclusiva se aplica.
#' @param base Base activa con que se califican las referencias del plan.
#' @param crudas `list(data_sources, inst_sources)` sin convertir, para devolver los rótulos del instrumento.
#' @return `list(ok, tipo, slide_id, modo, base, capitulos, avisos)`.
#' @keywords internal
.propuesta_resumen_calcular <- function(slide, plan_slides, data_sources, inst_sources, sig_informe = NULL, mapa = character(0),
                                        inclusivo = TRUE, base = "", crudas = NULL, icon_registry = list()) {
  slide <- .propuesta_validar_lamina(slide)
  slide$payload$seleccion <- "auto"   # la propuesta no depende de lo que el analista ya escribió
  previa <- options(prosecnur.sig_informe = sig_informe)
  on.exit(options(previa), add = TRUE)
  # Una memoria por pedido: la selección y el modelo prueban la misma pregunta por el mismo cruce varias veces
  # (graficos_memo_evaluacion.R).
  r <- .gmemo_con(.preview_con_avisos({
    lamina <- tryCatch(.graficos_rebuild_slide_json(.propuesta_preparar(slide, mapa, inclusivo, base), icon_registry = icon_registry),
                       error = function(e) stop_api(422, "E_PROPUESTA_LAMINA_INVALIDA",
                                                    sprintf("La lámina no se pudo leer: %s", conditionMessage(e))))
    el <- lamina$slots$plot
    plan <- .propuesta_plan_motor(plan_slides, mapa, inclusivo, base, icon_registry)
    # La base de la lámina con la misma regla que el render (graficos_resumen_base.R): no la primera de la sesión.
    base_lectura <- tryCatch(.resumen_base_lamina(el, data_sources, plan),
                             error = function(e) stop_api(422, "E_PROPUESTA_LAMINA_INVALIDA",
                                                          sprintf("La lámina no se pudo leer: %s", conditionMessage(e))))
    fuente <- .sig_fuente(data_sources[[base_lectura]], inst_sources[[base_lectura]])
    fuente$base <- base_lectura
    sig <- .sig_contexto_render(fuente$data, base_lectura)   # la regla y la familia que lee el render, de su base
    traducir <- .propuesta_traductor(crudas, base_lectura, mapa, inclusivo)
    p <- if (identical(el$.element_type, "hallazgos")) .propuesta_hallazgos(el, fuente, sig, plan, traducir) else
      .propuesta_resumen_dif(el, fuente, sig, plan, traducir)
    list(capitulos = p$capitulos, base = base_lectura, modo = if (identical(el$.element_type, "hallazgos")) .dif_chr1(el$modo) else NULL)
  }))
  # Los avisos de la propuesta que piden pasar a manual no aplican aquí: el editor ya ofrece editar a partir de ella.
  avisos <- r$avisos[!grepl("el motor propone", r$avisos, fixed = TRUE)]
  out <- .propuesta_compacto(list(ok = TRUE, tipo = slide$tipo, slide_id = as.character(slide$id %||% "")[1], modo = r$valor$modo,
                                  base = r$valor$base, capitulos = r$valor$capitulos))
  out$avisos <- I(avisos)   # siempre una lista, también vacía
  out
}

# La propuesta de una lámina de la sesión (fuentes, plan, regla y preguntas clave como los lee la vista previa), su caché
# por firma y el job viven en graficos_propuesta_job.R.

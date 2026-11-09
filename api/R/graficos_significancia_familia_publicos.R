# =============================================================================
# graficos_significancia_familia_publicos.R — la familia de BH entre públicos (ADR 0138 §4)
# =============================================================================
#
# Con `correccion = "bh_informe"`, las comparaciones entre públicos forman SU PROPIA familia: todos los temas emparejados
# con escala comparable de las láminas que piden tarjetas entre públicos. Nunca se mezclan con la familia de una base
# (`.sig_familia_estudio`): no comparten objeto, ni la caché `.sig_cache`, ni se interpolan una contra la otra. Agregar
# las comparaciones entre públicos no cambia ninguna letra ya generada en una base.
#
# La familia viaja al render en el contexto del informe (`prosecnur.sig_informe`) como `familia_publicos`, junto a la
# matriz de equivalencias (`equivalencias_publicos`) que decide qué temas están declarados.

#' Elemento entre públicos de una lámina del plan con su meta entre públicos: `p_dumbbell` sin cruce, el radar por
#' públicos o el panorama (graficos_tarjetas_publicos_radar_panorama.R)
#'
#' Lee la forma del plan guardado (`payload` con `graficador` y `args`) o la ya construida (`slots$plot`).
#' @return `list(vars, corte, filtros, regla, bases, corte_etiqueta, .element_type)` o NULL si la lámina no aplica.
#' @keywords internal
.tpub_elemento_de_lamina <- function(slide) {
  meta <- slide$meta %||% (slide$payload %||% list())$meta %||% list()
  if (is.null(.tpub_opcion(meta))) return(NULL)
  rp <- .tpub_elemento_radar_panorama(slide)
  if (!is.null(rp)) return(rp)
  el <- (slide$slots %||% list())$plot
  if (is.list(el) && identical(el$.element_type, "dumbbell")) {
    if (!is.null(el$cruce)) return(NULL)
    return(list(vars = el$vars, corte = el$corte, filtros = el$filtros %||% list(), regla = el$regla, bases = el$bases,
                corte_etiqueta = .tpub_texto_o_null(el$corte_etiqueta), .element_type = "dumbbell"))
  }
  grafs <- Filter(function(z) is.list(z) && identical(as.character(z$graficador %||% "")[1], "p_dumbbell"), slide$payload %||% list())
  if (!length(grafs)) return(NULL)
  a <- grafs[[1]]$args %||% list()
  if (!is.null(a$cruce) && nzchar(trimws(as.character(a$cruce)[1]))) return(NULL)
  list(vars = a$vars, corte = a$corte, filtros = a$filtros %||% list(), regla = a$regla, bases = a$bases,
       corte_etiqueta = .tpub_texto_o_null(a$corte_etiqueta), .element_type = "dumbbell")
}

#' Temas que dibuja la lámina (regla de preguntas aplicada) y su declaración
#' @return `list(vars_render, temas)`.
#' @keywords internal
.tpub_temas_de_elemento <- function(el, sources, equiv) {
  if (identical(el$.element_type, "radar_publicos")) return(.tpub_temas_radar(el, equiv))
  if (identical(el$.element_type, "panorama")) return(.tpub_temas_panorama(el, sources, equiv))
  vars_lamina <- el$vars
  if (.dumbbell_sin_temas(vars_lamina) && !is.null(el$bases)) vars_lamina <- .dumbbell_vars_de_bases(.dumbbell_bases_contraste(el$bases))
  vars_lamina <- .dumbbell_temas_nombrar(vars_lamina, sources$inst_sources)   # H2: el par sin nombre, como al dibujar
  el_r <- el; el_r$vars <- vars_lamina
  sources["equivalencias_publicos"] <- list(equiv)   # `base$*` se empareja con ESTA matriz (graficos_dumbbell_equivalencia.R)
  if (!is.null(el$regla)) el_r <- .regla_preguntas_aplicar_render(el_r, "dumbbell", sources)$el
  vars_render <- lapply(el_r$vars %||% list(), function(x) as.character(unlist(x)))
  list(vars_render = vars_render, temas = .tpub_temas_declarados(vars_render, vars_lamina, equiv))
}

#' Láminas del plan con tarjetas entre públicos
#' @keywords internal
.tpub_laminas_del_plan <- function(plan) {
  slides <- if (is.list(plan)) plan$slides %||% plan else list()
  Filter(function(s) is.list(s) && !is.null(.tpub_elemento_de_lamina(s)), slides)
}

#' Familia de BH entre públicos de un plan (primera pasada)
#'
#' La unidad es el PAR de públicos, no el tema: el mismo par (las dos refs, los códigos del corte en cualquier orden y
#' los filtros) entra una sola vez aunque lo dibujen un radar de tres públicos y un contraste de dos, o un corte «3,4» y
#' otro «4,3». Los temas sin equivalencia, con escalas distintas o sin dos públicos comparables no entran.
#' @return `list(tabla, m)`; `tabla` de `.sig_bh_tabla()`.
#' @keywords internal
.tpub_familia_plan <- function(plan, sources, equiv, regla) {
  p <- list()
  vistos <- character(0)
  for (s in .tpub_laminas_del_plan(plan)) {
    el <- .tpub_elemento_de_lamina(s)
    tt <- tryCatch(.tpub_temas_de_elemento(el, sources, equiv)$temas, error = function(e) list())
    resto <- c(paste(sort(as.character(.radar_mb_codigos(el$corte))), collapse = ","),
               digest::digest(el$filtros %||% list(), algo = "xxhash32"))
    for (x in tt) {
      if (is.null(x$refs) || is.na(x$equivalencia)) next
      clave_tema <- paste(c(sort(paste(names(x$refs), x$refs, sep = "$")), resto), collapse = "\r")
      if (clave_tema %in% vistos) next
      vistos <- c(vistos, clave_tema)
      te <- tryCatch(.tpub_evaluar_tema(x$tema, x$refs, el$corte, sources, regla, filtros = el$filtros %||% list(),
                                        equivalencia = x$equivalencia), error = function(e) NULL)
      for (k in .tpub_pares_familia(te)) {
        clave <- paste(c(sort(paste(c(k$a, k$b), x$refs[c(k$a, k$b)], sep = "$")), resto), collapse = "\r")
        if (is.null(p[[clave]])) p[[clave]] <- k$p
      }
    }
  }
  todos <- unlist(p, use.names = FALSE)
  tabla <- .sig_bh_tabla(todos)
  list(tabla = tabla, m = tabla$m)
}

#' Pares de un tema evaluado que entran a la familia: `list(list(a, b, p))` (los de `.sig_p_para_familia`)
#' @keywords internal
.tpub_pares_familia <- function(te) {
  if (is.null(te) || !identical(te$estado, "evaluable") || is.null(te$ev$pares) || !nrow(te$ev$pares)) return(list())
  pr <- te$ev$pares
  ok <- pr$elegible & !(pr$duplicada %||% rep(FALSE, nrow(pr))) & is.finite(pr$p)
  lapply(which(ok), function(i) list(a = pr$a[i], b = pr$b[i], p = pr$p[i]))
}

#' Regla entre públicos: la guardada del estudio o, si es la propuesta, la resuelta sobre TODAS las bases
#'
#' La regla propuesta mira los datos (`.sig_regla_propuesta`): con una columna de conglomerado reconocible, Rao-Scott
#' con BH del informe; sin ella, z con Bonferroni por fila. Propuesta desde una sola base, el mismo par salía marcado o
#' no según cuál base fuera la activa (revisión del ADR 0138, P2). Aquí se propone sobre la unión de columnas de todas
#' las bases: Rao-Scott si alguna trae el conglomerado (las que no lo traen entran como muestreo aleatorio simple en
#' `.tpub_datos_base`). El resultado no depende del orden de las bases. Sólo cambian prueba, corrección, conglomerado y
#' estrato; el resto (alfa, umbral, base mínima...) es el de la regla recibida.
#' @param regla Regla de la base (`ctx$regla`); NULL: la de fábrica.
#' @param origen «estudio» (guardada: manda tal cual) o «propuesta».
#' @keywords internal
.tpub_regla_publicos <- function(regla, origen, data_sources) {
  if (!identical(origen, "propuesta") || !length(data_sources)) return(regla %||% .sig_regla_normalizar(list()))
  regla <- .sig_regla_normalizar(regla %||% list())
  columnas <- sort(unique(unlist(lapply(data_sources, function(d) if (is.data.frame(d)) names(d) else character(0)),
                                 use.names = FALSE)))
  muestra <- as.data.frame(stats::setNames(rep(list(character(0)), length(columnas)), columnas), stringsAsFactors = FALSE)
  pr <- .sig_regla_propuesta(muestra)
  for (k in c("prueba", "correccion", "conglomerado", "estrato")) regla[k] <- list(pr[[k]])
  regla
}

#' Regla entre públicos vigente en un render o en el inspector
#'
#' La del contexto del informe si ya la resolvió (`regla_publicos`); si no, la resuelve con las bases a mano. Sin
#' contexto, la regla es la propuesta. Un contexto sin `origen` se toma como regla del estudio.
#' @keywords internal
.tpub_regla_de_contexto <- function(ctx, data_sources) {
  if (!is.null(ctx$regla_publicos)) return(ctx$regla_publicos)
  origen <- if (is.null(ctx)) "propuesta" else ctx$origen %||% "estudio"
  .tpub_regla_publicos(ctx$regla, origen, data_sources)
}

#' Agrega al contexto del informe la matriz de equivalencias, la regla y la familia entre públicos
#'
#' La regla entre públicos (`regla_publicos`) se resuelve sobre todas las bases cuando la del estudio es la propuesta
#' (`.tpub_regla_publicos`); la familia de BH, sólo con `bh_informe` en esa regla.
#' @param ctx Contexto liviano (`.sig_contexto_liviano`); NULL lo deja como está.
#' @param plan Plan del pedido. @param sources `list(data_sources, inst_sources)` de TODAS las bases, o una función que
#'   las devuelve (la vista previa sólo las pide si el plan tiene láminas entre públicos).
#' @keywords internal
.tpub_en_contexto <- function(ctx, plan, sources, equiv = NULL) {
  # Sin contexto de diferencias la matriz igual viaja: el contraste empareja con ella (graficos_dumbbell_equivalencia.R).
  # `.sig_informe_vigente` exige `regla`, así que este contexto no inventa una regla de diferencias.
  if (!is.list(ctx) || !is.list(ctx$regla)) {
    if (is.null(equiv)) return(ctx)
    ctx <- if (is.list(ctx)) ctx else list()
    ctx$equivalencias_publicos <- equiv
    return(ctx)
  }
  ctx$equivalencias_publicos <- equiv
  ctx$familia_publicos <- NULL
  ctx$regla_publicos <- NULL
  if (!length(.tpub_laminas_del_plan(plan))) return(ctx)
  src <- tryCatch(if (is.function(sources)) sources() else sources, error = function(e) {
    message("[diferencias] no se pudieron leer las bases para las tarjetas entre públicos: ", conditionMessage(e))
    NULL
  })
  regla <- .tpub_regla_de_contexto(ctx, src$data_sources)
  ctx$regla_publicos <- regla
  if (identical(regla$correccion, "bh_informe") && !is.null(src)) {
    fam <- tryCatch(.tpub_familia_plan(plan, src, equiv, regla), error = function(e) {
      message("[diferencias] no se pudo calcular la familia entre públicos: ", conditionMessage(e))
      NULL
    })
    ctx$familia_publicos <- fam$tabla
  }
  ctx
}

#' Matriz de equivalencias de la sesión (o NULL), para el worker y la vista previa
#' @keywords internal
.tpub_equivalencias_sesion <- function(sid) {
  tryCatch((session_get(sid, required = FALSE) %||% list())$equivalencias_publicos, error = function(e) NULL)
}

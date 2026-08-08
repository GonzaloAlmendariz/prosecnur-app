# Registro de argumentos que el motor descarta en silencio
# ========================================================
#
# PROBLEMA. `.keep_formals()` filtra los argumentos contra los formals de la
# funcion graficadora y tira el resto SIN NINGUNA SEÑAL. Un campo mal escrito,
# uno que la cadena de whitelists no propago, o uno que la UI ofrece y el motor
# nunca implemento, se pierde sin warning, sin log y sin error: el analista
# mueve el control, el grafico no cambia, y no hay nada que mirar.
#
# La auditoria del 2026-08-08 encontro asi siete argumentos que la UI ofrece y
# el motor jamas recibe (`textos_negrita` en boxplot, media_rango y los tres
# `dim_*`; `decimales_promedio` en dos; `debug_lw` en pie). Ninguno daba error.
#
# DISEÑO. Un `message()` dentro de `.keep_formals()` seria inservible: esa
# funcion corre una vez por cada slot de cada lamina, y un mazo de 44 laminas
# emitiria cientos de lineas. En vez de eso se ACUMULA: cada descarte se anota
# en un registro, y al terminar el render se consulta el resumen. Un descarte
# repetido en 40 laminas es UNA linea del reporte, no 40.
#
# El registro es deliberadamente barato —dos vectores de texto— porque vive en
# el camino caliente del render.

.reporte_args_registro <- new.env(parent = emptyenv())

# Nombre util de la funcion que descarto.
#
# Los call sites del motor hacen `fun <- graficar_X` y despues
# `.keep_formals(fun, args)`, asi que `deparse(substitute(fun))` devuelve
# literalmente "fun" y el registro no distinguiria un graficador de otro. En vez
# de tocar los diecisiete sitios (que viven en un archivo congelado a
# crecimiento), se identifica la funcion buscandola entre las `graficar_*` del
# paquete. Se busca SIEMPRE y el deparse queda solo como ultimo recurso: hacerlo
# al reves ataba el resultado a como se llamara la variable en el caller, y
# bastaba un `fun2` para perder el nombre.
#
# El costo se paga unicamente cuando hubo un descarte —el camino normal del
# render no entra aqui— y son ~18 comparaciones de cuerpo.
.reporte_args_nombre_de_funcion <- function(fun, fallback = NULL) {
  nombre <- tryCatch({
    ns <- asNamespace("prosecnurapp")
    cuerpo <- body(fun)
    hit <- NULL
    for (nm in grep("^graficar_", ls(ns, all.names = TRUE), value = TRUE)) {
      cand <- tryCatch(get(nm, envir = ns), error = function(e) NULL)
      if (is.function(cand) && identical(body(cand), cuerpo)) { hit <- nm; break }
    }
    hit
  }, error = function(e) NULL)
  if (!is.null(nombre)) return(nombre)

  fallback <- as.character(fallback %||% "")[1]
  if (!is.na(fallback) && nzchar(fallback)) fallback else "<sin contexto>"
}

#' Limpia el registro de argumentos descartados.
#'
#' Se llama al arrancar un render para que el reporte hable de esa corrida y no
#' arrastre lo de la anterior.
#' @keywords internal
reporte_args_descartados_reset <- function() {
  assign("descartes", list(), envir = .reporte_args_registro)
  invisible(NULL)
}

# Anota los nombres descartados. `contexto` identifica a quien los descarto
# (normalmente el nombre de la funcion graficadora), porque el mismo nombre de
# argumento puede ser legitimo en un graficador e inerte en otro.
.reporte_args_anotar_descarte <- function(nombres, contexto = NULL) {
  nombres <- as.character(nombres)
  nombres <- nombres[!is.na(nombres) & nzchar(nombres)]
  if (!length(nombres)) return(invisible(NULL))

  ctx <- as.character(contexto %||% "")[1]
  if (is.na(ctx) || !nzchar(ctx)) ctx <- "<sin contexto>"

  prev <- tryCatch(get("descartes", envir = .reporte_args_registro), error = function(e) NULL)
  if (!is.list(prev)) prev <- list()

  ya <- prev[[ctx]] %||% character(0)
  prev[[ctx]] <- unique(c(ya, nombres))
  assign("descartes", prev, envir = .reporte_args_registro)
  invisible(NULL)
}

#' Resumen de los argumentos descartados en la corrida actual.
#'
#' Devuelve un data frame `(contexto, argumento)` ordenado, o un data frame de
#' cero filas si no se descarto nada. No emite nada por si mismo: el llamador
#' decide si lo imprime, lo adjunta al artefacto o lo ignora.
#' @keywords internal
reporte_args_descartados_reporte <- function() {
  prev <- tryCatch(get("descartes", envir = .reporte_args_registro), error = function(e) NULL)
  vacio <- data.frame(
    contexto = character(0), argumento = character(0),
    stringsAsFactors = FALSE
  )
  if (!is.list(prev) || !length(prev)) return(vacio)

  filas <- lapply(names(prev), function(ctx) {
    args <- as.character(prev[[ctx]])
    if (!length(args)) return(NULL)
    data.frame(contexto = ctx, argumento = args, stringsAsFactors = FALSE)
  })
  filas <- Filter(Negate(is.null), filas)
  if (!length(filas)) return(vacio)

  out <- do.call(rbind, filas)
  out <- out[order(out$contexto, out$argumento), , drop = FALSE]
  rownames(out) <- NULL
  out
}

#' Emite el resumen por `message()`, una linea por contexto.
#'
#' Pensado para el cierre de un render: es el momento en que un descarte deja de
#' ser ruido y pasa a ser informacion ("estos controles no llegaron al motor").
#' Devuelve invisible el data frame para poder encadenarlo.
#' @keywords internal
reporte_args_descartados_avisar <- function(prefijo = "Argumentos ignorados por el motor") {
  rep <- reporte_args_descartados_reporte()
  if (!nrow(rep)) return(invisible(rep))

  for (ctx in unique(rep$contexto)) {
    args <- rep$argumento[rep$contexto == ctx]
    message(prefijo, " — ", ctx, ": ", paste(args, collapse = ", "))
  }
  invisible(rep)
}

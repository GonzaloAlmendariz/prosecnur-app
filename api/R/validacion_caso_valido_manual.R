# Validación › «Qué caso cuenta» declarado a mano.
#
# El criterio de validez sólo se podía tomar de las sugerencias, que salen de lo
# que el formulario ya exigía (sus `relevant`). Un criterio que vive fuera del
# formulario no tenía cómo declararse: una marca de selección hecha en un
# script, una columna «válida» del equipo, un filtro de población. Caso que lo
# destapó (HSyVbG 2026, 2026-10-16): la base del analista trae las 3,318
# respuestas y `seleccionado` = 1 en las 2,500 de la muestra aleatoria.
#
# Dos piezas de sólo lectura: las columnas que sirven para declarar una
# condición (pocos valores distintos, cada uno con sus casos) y el efecto de un
# juego de condiciones antes de guardarlo. Declarar sigue siendo guardar la
# config operativa, como con las sugerencias.

.CASO_VALIDO_MAX_VALORES <- 20L

.caso_valido_orden_valores <- function(v) {
  num <- suppressWarnings(as.numeric(v))
  if (!anyNA(num)) order(num) else order(v)
}

#' Columnas con las que se puede declarar a mano qué caso cuenta.
#'
#' Entran las de 2 a `max_valores` valores distintos con dato; cada valor lleva
#' sus casos y, si la pregunta es de opción única del instrumento, su etiqueta.
#' Un identificador o un texto libre no entran: tienen demasiados valores.
#' @keywords internal
caso_valido_columnas_candidatas <- function(data, inst = NULL, max_valores = .CASO_VALIDO_MAX_VALORES) {
  if (!is.data.frame(data) || !ncol(data)) return(list())
  sv <- (inst %||% list())$survey
  ch <- (inst %||% list())$choices
  etiqueta_de <- function(nm) {
    if (!is.data.frame(sv) || !all(c("name", "label") %in% names(sv))) return("")
    e <- as.character(sv$label[match(nm, sv$name)])
    if (length(e) && !is.na(e)) e else ""
  }
  lista_de <- function(nm) {
    if (!is.data.frame(sv) || !all(c("name", "type") %in% names(sv))) return("")
    t <- trimws(as.character(sv$type[match(nm, sv$name)]))
    if (!length(t) || is.na(t) || !grepl("^select_one\\s", t)) return("")
    sub("^select_one\\s+", "", t)
  }
  out <- list()
  for (nm in names(data)) {
    x <- trimws(as.character(unclass(data[[nm]])))
    x <- x[!is.na(x) & nzchar(x)]
    tab <- table(x)
    if (length(tab) < 2L || length(tab) > max_valores) next
    valores <- names(tab)[.caso_valido_orden_valores(names(tab))]
    lst <- lista_de(nm)
    etiquetas <- if (nzchar(lst) && is.data.frame(ch) && all(c("list_name", "name", "label") %in% names(ch))) {
      sub_ch <- ch[as.character(ch$list_name) == lst, , drop = FALSE]
      e <- as.character(sub_ch$label[match(valores, as.character(sub_ch$name))])
      ifelse(is.na(e), "", e)
    } else rep("", length(valores))
    out[[length(out) + 1L]] <- list(
      variable = nm,
      etiqueta = etiqueta_de(nm),
      # Una marca hecha fuera (selección, filtro del equipo) no es pregunta del
      # formulario: la pantalla las ofrece primero.
      del_formulario = is.data.frame(sv) && "name" %in% names(sv) &&
        (nm %in% as.character(sv$name) || sub("[/.].*$", "", nm) %in% as.character(sv$name)),
      n_con_dato = length(x),
      valores = lapply(seq_along(valores), function(i) {
        list(valor = valores[[i]], etiqueta = etiquetas[[i]], n = as.integer(tab[[valores[[i]]]]))
      })
    )
  }
  out
}

#' Cuántos casos cuentan con unas condiciones, sin guardarlas.
#'
#' Mismo cálculo que el criterio guardado (`caso_valido_marcar()`), más las
#' variables que no están en la base: una condición sobre una columna ausente
#' no descarta a nadie y hay que decirlo.
#' @keywords internal
caso_valido_efecto <- function(data, condiciones) {
  conds <- lapply(condiciones %||% list(), function(c1) {
    list(variable = as.character(c1$variable %||% "")[1],
         operador = as.character(c1$operador %||% "==")[1],
         valores = as.list(as.character(unlist(c1$valores %||% list()))))
  })
  conds <- Filter(function(c1) nzchar(c1$variable) && length(c1$valores), conds)
  cfg <- list(caso_valido = list(enabled = TRUE, condiciones = conds))
  r <- caso_valido_resumen(data, cfg)
  r$declarado <- NULL
  r$variables_ausentes <- as.list(setdiff(vapply(conds, `[[`, "", "variable"), names(data)))
  r
}

.caso_valido_manual_datos <- function(sid, base) {
  files <- .resolve_base_files(sid, base)
  data <- .read_data_for_validation(files$data$path, files$data_ext)
  inst <- tryCatch(reporte_instrumento(path = files$xlsform$path), error = function(e) NULL)
  list(data = as.data.frame(data, check.names = FALSE), inst = inst)
}

# GET  /api/validacion/v2/caso-valido/columnas  (X-Base-Nombre) → {ok, n_total, columnas}
# POST /api/validacion/v2/caso-valido/efecto    body {condiciones} → {ok, n_total, n_validos, n_excluidos, variables_ausentes}
mount_validacion_caso_valido_manual <- function(pr) {
  pr |>
    plumber::pr_get("/api/validacion/v2/caso-valido/columnas", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      d <- .caso_valido_manual_datos(sid, .get_base_nombre(req))
      list(ok = TRUE, n_total = nrow(d$data), columnas = caso_valido_columnas_candidatas(d$data, d$inst))
    })) |>
    plumber::pr_post("/api/validacion/v2/caso-valido/efecto", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      Encoding(body_raw) <- "UTF-8"
      parsed <- if (nzchar(body_raw)) {
        tryCatch(jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
                 error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e)))
      } else list()
      d <- .caso_valido_manual_datos(sid, .get_base_nombre(req))
      c(list(ok = TRUE), caso_valido_efecto(d$data, parsed$condiciones))
    }))
}

# Analítica › cuántos casos cuentan en cada base.
#
# `.analitica_aplicar_caso_valido()` filtra la data con el criterio declarado en
# Validación y pega la traza como atributo, pero ningún payload la publicaba: el
# N de las tablas cambiaba (3,318 → 2,500 en HSyVbG 2026) sin que la pantalla
# dijera por qué. Este endpoint lo dice por base, con la misma regla
# (`caso_valido_filtrar_evaluacion()`, que no aplica un criterio que dejaría la
# base vacía).

#' Universo de análisis de una base: total, los que cuentan y con qué condiciones.
#' @keywords internal
analitica_universo_de_base <- function(data, cfg) {
  cv <- (cfg %||% list())$caso_valido %||% list()
  declarado <- isTRUE(cv$enabled) && length(cv$condiciones %||% list()) > 0L
  n <- if (is.data.frame(data)) nrow(data) else 0L
  if (!declarado) return(list(declarado = FALSE, aplicado = FALSE, n_total = n, n_validos = n, condiciones = list()))
  out <- caso_valido_filtrar_evaluacion(data, cfg)
  f <- out$filter %||% list()
  list(
    declarado = TRUE,
    aplicado = isTRUE(f$applied),
    n_total = as.integer(n),
    n_validos = as.integer(if (isTRUE(f$applied)) f$kept_rows else n),
    motivo_no_aplicado = as.character(f$motivo_no_aplicado %||% ""),
    condiciones = f$condiciones %||% list()
  )
}

# GET /api/analitica/universo → {ok, bases: [{base, declarado, aplicado, n_total, n_validos, condiciones}]}
# Sólo lee la data de las bases que declaran un criterio.
mount_analitica_universo <- function(pr) {
  pr |>
    plumber::pr_get("/api/analitica/universo", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      s <- session_get(sid)
      bases <- names(((s$estudio %||% list())$bases) %||% list())
      out <- lapply(bases, function(b) {
        meta <- s$estudio$bases[[b]]
        cfg <- tryCatch(normalize_validation_operational_config((meta$validacion %||% list())$operational_config),
                        error = function(e) NULL)
        cv <- (cfg %||% list())$caso_valido %||% list()
        if (!isTRUE(cv$enabled) || !length(cv$condiciones %||% list())) {
          return(list(base = b, declarado = FALSE))
        }
        data <- tryCatch(.caso_valido_manual_datos(sid, b)$data, error = function(e) NULL)
        if (is.null(data)) return(list(base = b, declarado = TRUE, aplicado = FALSE, error = "No se pudo leer la base."))
        c(list(base = b), analitica_universo_de_base(data, cfg))
      })
      list(ok = TRUE, bases = out)
    }))
}

#' Gráficos trabaja con el mismo universo que Analítica.
#'
#' Gráficos lee las fuentes de la sesión (`estudio_data_sources()`), que no
#' pasan por `.analitica_aplicar_caso_valido()`: con «seleccionado es 1» las
#' tablas decían 2,500 y los gráficos habrían dicho 3,318 (HSyVbG 2026). Se
#' filtra cada base con su criterio y se conservan los atributos de la fuente
#' (instrumento, normalización), que un subset de filas pierde.
#' @keywords internal
.graficos_aplicar_caso_valido <- function(sid, src) {
  s <- session_get(sid, required = FALSE)
  bases <- ((s %||% list())$estudio %||% list())$bases %||% list()
  if (!length(bases) || !length(src$data_sources)) return(src)
  for (nm in names(src$data_sources)) {
    meta <- bases[[nm]]
    dat <- src$data_sources[[nm]]
    if (is.null(meta) || !is.data.frame(dat)) next
    filtrada <- tryCatch(.analitica_aplicar_caso_valido(dat, meta), error = function(e) dat)
    if (!is.data.frame(filtrada) || nrow(filtrada) == nrow(dat)) next
    for (a in setdiff(names(attributes(dat)), c("names", "row.names", "class"))) {
      if (is.null(attr(filtrada, a, exact = TRUE))) attr(filtrada, a) <- attr(dat, a, exact = TRUE)
    }
    src$data_sources[[nm]] <- filtrada
  }
  src
}

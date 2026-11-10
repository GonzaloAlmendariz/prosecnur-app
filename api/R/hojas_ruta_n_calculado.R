# N del sorteo con la lógica «Calculado» (revisión del 10 nov 2026, diseño nacional TCD: 25 distritos en 6
# ciudades). El cálculo del tamaño devolvía N = 2,412 (402 rutas de 6), pero `n_objetivo` seguía en el 120 que
# traía la config: el endpoint de tamaño guarda la config ANTES de calcular y el N calculado nunca volvía a ella.
# Las cuotas y el sorteo leen `n_objetivo`, así que sortearon 20 UMP y dejaron distritos sin ruta mientras el botón
# «Diseño» y Muestra decían 2,412. Con la lógica «Calculado» el N es, por definición, el que sale del cálculo.

# El cálculo del tamaño con la config tal como lo hace su endpoint; NULL si no aplica o falla. Sólo con la lógica
# «Calculado» DECLARADA: una config que no trae `sample_size_mode` se normaliza a "calculator" por defecto pero
# conserva la semántica antigua de N escrito (`n_objetivo` o `n_mode = "por_distrito"`), y ese N no se pisa.
.hojas_ruta_tamano_calculado <- function(cfg, declarado = TRUE) {
  if (!isTRUE(declarado) || !identical(cfg$sample_size_mode, "calculator") || !length(unlist(cfg$territorios))) return(NULL)
  # Igual que el endpoint de tamaño: un ICC aplicado recalcula el DEFF con el k vigente (ADR 0116 §2).
  calc <- cfg
  calc$sample_size <- hojas_ruta_icc_reconciliar(calc$sample_size, .hojas_ruta_route_size(calc))
  tam <- tryCatch(hojas_ruta_sample_size_preview(calc), error = function(e) NULL)
  n <- suppressWarnings(as.integer(tam$n_used %||% NA_integer_))
  if (length(n) != 1L || is.na(n) || n <= 0L) return(NULL)
  tam
}

#' Config con el N del cálculo cuando la lógica del N es «Calculado».
#'
#' Con `sample_size_mode` distinto de "calculator" (N total o por distrito) devuelve la config intacta: ahí el N
#' lo escribe el usuario. Si el cálculo falla o no da un N positivo, también la deja como está.
#'
#' @param cfg Config ya normalizada (`hojas_ruta_integrada_normalize_config`).
#' @param declarado Si la config de entrada traía `sample_size_mode` (ver `.hojas_ruta_tamano_calculado`).
#' @return La config, con `n_objetivo` = `n_used` del cálculo del tamaño en modo "calculator".
#' @noRd
hojas_ruta_n_calculado <- function(cfg, declarado = TRUE) {
  tam <- .hojas_ruta_tamano_calculado(cfg, declarado)
  if (is.null(tam)) return(cfg)
  cfg$n_objetivo <- as.integer(tam$n_used)
  cfg
}

#' Config para repartir las cuotas con la lógica «Calculado»: el N total y el de cada distrito del cálculo.
#'
#' Con estrato por distrito, el cálculo del tamaño aplica los mínimos de cada distrito (Muestra mostraba 96
#' entrevistas en cada uno del diseño TCD) y las cuotas en modo total repartían por población sin ellos: Characato
#' salía con 1 ruta donde el diseño decía 16. El sorteo tiene que ser la muestra que se diseñó y se presentó, así que
#' las cuotas reparten por distrito lo mismo que el cálculo. Con estrato provincia (ADR 0131) el cálculo ya usa las
#' rutas de la cuota y no se toca. Sólo para calcular: no se guarda (la lógica del N sigue siendo «Calculado»).
#'
#' @param cfg Config ya normalizada.
#' @param declarado Si la config de entrada traía `sample_size_mode`.
#' @return La config con `n_mode = "por_distrito"` y `n_por_distrito` del cálculo, o con sólo el N total si el
#'   reparto del cálculo no suma el N, no cae en rutas completas o no cubre los mismos distritos.
#' @noRd
hojas_ruta_reparto_calculado <- function(cfg, declarado = TRUE) {
  tam <- .hojas_ruta_tamano_calculado(cfg, declarado)
  if (is.null(tam)) return(cfg)
  n <- as.integer(tam$n_used)
  cfg$n_objetivo <- n
  if (hojas_ruta_estrato_vigente(cfg)) return(cfg)
  por_distrito <- .hojas_ruta_n_usado_por_distrito(tam$district_rows)
  k <- .hojas_ruta_route_size(cfg)
  if (length(por_distrito) && sum(por_distrito) == n && k > 0L && all(por_distrito %% k == 0L) &&
      setequal(names(por_distrito), as.character(unlist(cfg$territorios, use.names = FALSE)))) {
    cfg$n_mode <- "por_distrito"
    cfg$n_por_distrito <- as.list(por_distrito)
  }
  cfg
}

# `district_rows` llega como data.frame o como lista de filas; devuelve el N usado con nombre de ubigeo.
.hojas_ruta_n_usado_por_distrito <- function(filas) {
  if (is.null(filas) || !length(filas)) return(integer(0))
  if (is.data.frame(filas)) {
    if (!all(c("ubigeo", "n_used") %in% names(filas))) return(integer(0))
    out <- suppressWarnings(as.integer(filas$n_used))
    names(out) <- as.character(filas$ubigeo)
  } else {
    out <- vapply(filas, function(f) suppressWarnings(as.integer(f$n_used %||% NA_integer_)), integer(1))
    names(out) <- vapply(filas, function(f) as.character(f$ubigeo %||% ""), character(1))
  }
  if (anyNA(out) || any(!nzchar(names(out)))) return(integer(0))
  out
}

#' Config normalizada para repartir cuotas y sortear: la puerta común de las cuotas, el sorteo y el envío por
#' cuotas a Material (revisión metodológica del 10 nov 2026).
#'
#' Con la lógica «Calculado» declarada aplica el N y el reparto del cálculo (`hojas_ruta_reparto_calculado`); así
#' el sorteo, su π (que con estrato provincia lee `n_objetivo`) y lo enviado a Material usan el mismo N. Una config
#' sin `sample_size_mode` conserva su N escrito y sale marcada (`hr_n_sin_modo`): el sorteo pasa su config ya
#' normalizada a las cuotas, y esa config sí trae el modo por defecto; sin la marca, las cuotas lo pisaban.
#'
#' @param config Config tal como llega (sin normalizar o ya normalizada y marcada).
#' @return La config normalizada, con el reparto del cálculo cuando corresponde.
#' @noRd
hojas_ruta_config_para_reparto <- function(config) {
  config <- config %||% list()
  declarado <- !is.null(config$sample_size_mode) && !isTRUE(attr(config, "hr_n_sin_modo"))
  cfg <- hojas_ruta_reparto_calculado(hojas_ruta_integrada_normalize_config(config), declarado)
  if (!declarado) attr(cfg, "hr_n_sin_modo") <- TRUE
  cfg
}

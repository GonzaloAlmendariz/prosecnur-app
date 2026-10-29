# No respuesta, visitas e ICC del tamaño de Hojas de ruta (ADR 0116).
#
# La no respuesta de viviendas no infla el N: dimensiona las visitas de cada ruta,
# el salto y la capacidad de la manzana. El ICC medido en un estudio se traslada al
# siguiente recalculando el DEFF con el k de la ruta nueva, nunca copiando el DEFF.
#
# El motor congelado sólo llama a `hojas_ruta_tamano_extras_normalizar()` desde
# `.hojas_ruta_normalize_sample_size()` (lista cerrada): sin eso los campos nuevos
# de `sample_size` se perderían en silencio.

HOJAS_RUTA_DEFF_FUENTES <- c("legado", "por_declarar", "manual", "icc_biblioteca")
HOJAS_RUTA_ICC_MIN_CONGLOMERADOS <- 50L
HOJAS_RUTA_VISITAS_CUANTIL <- 0.9

.hojas_ruta_te_alerta <- function(code, message, ...) c(list(level = "warn", code = code, message = message), list(...))

.hojas_ruta_te_num <- function(x, defecto = NA_real_) {
  v <- suppressWarnings(as.numeric(if (is.null(x) || !length(x)) NA else x[[1]]))
  if (is.na(v)) defecto else v
}

# ---------- Normalización (enganche en el motor) ----------

#' Campos de `sample_size` del ADR 0116.
#'
#' - `ocupacion` (e): tasa de ocupación y elegibilidad de viviendas, por defecto 1.
#' - `design_effect_fuente`: sin `sample_size` (proyecto nuevo) es `por_declarar`; con
#'   `sample_size` guardado pero sin el campo (proyecto existente) es `legado`.
#' - `icc_aplicado`: la entrada de la biblioteca copiada al aplicarla, o NULL.
hojas_ruta_tamano_extras_normalizar <- function(x = NULL) {
  nuevo <- is.null(x) || !is.list(x) || !length(x)
  fuente <- if (nuevo) "por_declarar" else as.character(x$design_effect_fuente %||% "legado")[1]
  if (is.na(fuente) || !fuente %in% HOJAS_RUTA_DEFF_FUENTES) fuente <- "legado"
  e <- .hojas_ruta_te_num(if (nuevo) NULL else x$ocupacion, 1)
  if (e > 1) e <- e / 100
  e <- min(1, max(0.05, e))
  icc <- if (nuevo) NULL else x$icc_aplicado
  if (!is.null(icc) && !isTRUE(hojas_ruta_icc_validar(icc)$ok)) icc <- NULL
  if (identical(fuente, "icc_biblioteca") && is.null(icc)) fuente <- "manual"
  list(ocupacion = e, design_effect_fuente = fuente, icc_aplicado = icc)
}

# ---------- Visitas y capacidad (ADR 0116 §1) ----------

#' Visitas esperadas para lograr k entrevistas completas: `ceil(k / (r·e))`.
hojas_ruta_visitas_por_ruta <- function(k, r, e = 1) {
  p <- max(1e-6, r * e)
  if (k <= 0) return(0L)
  as.integer(ceiling(k / p))
}

#' Visitas para cubrir el 90 % de las rutas: k más el cuantil de los fracasos de una
#' binomial negativa con probabilidad de éxito r·e; nunca menos que la media.
hojas_ruta_visitas_cap <- function(k, r, e = 1, q = HOJAS_RUTA_VISITAS_CUANTIL) {
  p <- min(1, max(1e-6, r * e))
  if (k <= 0) return(0L)
  if (p >= 1) return(as.integer(k))
  as.integer(max(hojas_ruta_visitas_por_ruta(k, r, e), k + stats::qnbinom(q, size = k, prob = p)))
}

#' Salto sobre visitas: `max(1, floor(V / v))` (el automático del motor divide por k
#' y supone respuesta total).
hojas_ruta_salto_visitas <- function(viviendas, visitas) {
  if (!is.finite(viviendas) || viviendas <= 0 || visitas <= 0) return(1L)
  as.integer(max(1, floor(viviendas / visitas)))
}

#' ¿La manzana alcanza para las visitas que harán falta? Por modo de salto.
hojas_ruta_capacidad_manzana <- function(viviendas, k, r, e = 1, modo = "auto", salto_manual = 1L) {
  v_cap <- hojas_ruta_visitas_cap(k, r, e)
  V <- max(0, .hojas_ruta_te_num(viviendas, 0))
  necesita <- if (identical(modo, "manual")) max(1, as.integer(salto_manual)) * v_cap else v_cap / max(1e-6, e)
  list(alcanza = V >= necesita - 1e-9, v_cap = v_cap, necesita = necesita)
}

#' Contactos esperados (`N / r`) y visitas planificadas (`Σ ceil(k_b / (r·e))`).
#' Con un N que no es múltiplo de k, cada distrito tiene rutas de k y una última
#' ruta con el resto.
hojas_ruta_contactos_y_visitas <- function(n_por_distrito, k, r, e = 1) {
  n <- as.numeric(unlist(n_por_distrito, use.names = FALSE))
  n <- n[is.finite(n) & n > 0]
  if (!length(n) || k <= 0) return(list(contactos_esperados = 0, visitas_planificadas = 0L))
  visitas <- sum(vapply(n, function(nd) {
    rutas <- floor(nd / k)
    resto <- nd - rutas * k
    rutas * hojas_ruta_visitas_por_ruta(k, r, e) + (if (resto > 0) hojas_ruta_visitas_por_ruta(resto, r, e) else 0L)
  }, numeric(1)))
  list(contactos_esperados = sum(n) / max(1e-6, r), visitas_planificadas = as.integer(visitas))
}

# ---------- Avisos del tamaño (ADR 0116 §1, §3) ----------

#' Avisos del ADR 0116 sobre el tamaño ya calculado.
hojas_ruta_tamano_extras_avisos <- function(sample_size, k, reemplazos_por_titular) {
  ss <- sample_size %||% list()
  deff <- .hojas_ruta_te_num(ss$design_effect, 1)
  fuente <- as.character(ss$design_effect_fuente %||% "legado")
  r <- .hojas_ruta_te_num(ss$response_rate, 0.9)
  e <- .hojas_ruta_te_num(ss$ocupacion, 1)
  avisos <- list()
  if (k > 1 && fuente %in% c("legado", "por_declarar") && deff <= 1 + 1e-9) {
    avisos[[length(avisos) + 1L]] <- .hojas_ruta_te_alerta(
      "W_DEFF_IGNORES_CLUSTERING",
      sprintf("Con %d entrevistas por ruta y DEFF 1, el tamaño ignora el conglomerado: el margen es el de un muestreo aleatorio simple.", as.integer(k))
    )
  }
  if (k > 1 && deff < 1 - 1e-9) {
    avisos[[length(avisos) + 1L]] <- .hojas_ruta_te_alerta(
      "W_DEFF_BELOW_ONE", sprintf("Un DEFF de %s con %d entrevistas por ruta supone que el conglomerado mejora la precisión.", format(deff), as.integer(k))
    )
  }
  if (as.integer(reemplazos_por_titular %||% 0L) == 0L) {
    avisos[[length(avisos) + 1L]] <- .hojas_ruta_te_alerta(
      "W_UMP_NONRESPONSE_UNCOVERED",
      "Sin reemplazos por titular, una ruta que no se puede trabajar pierde sus entrevistas: considera sumar rutas por la tasa de acceso."
    )
  }
  v <- hojas_ruta_visitas_por_ruta(k, r, e)
  if (k > 0 && v > 5 * k) {
    avisos[[length(avisos) + 1L]] <- .hojas_ruta_te_alerta(
      "W_VISITS_HIGH", sprintf("Con respuesta %s y ocupación %s, cada ruta necesita unas %d visitas para %d entrevistas.", format(r), format(e), v, as.integer(k))
    )
  }
  avisos
}

#' ¿El margen publicado incluye el conglomerado? Si no, se rotula «bajo MAS».
hojas_ruta_margen_incluye_conglomerado <- function(sample_size, k) {
  !(k > 1 && .hojas_ruta_te_num(sample_size$design_effect, 1) <= 1 + 1e-9)
}

# ---------- Biblioteca de ICC (ADR 0116 §2) ----------

#' Una entrada de la biblioteca es aplicable a Hojas de ruta si es de la misma
#' unidad (ruta) y escala (proporción), con ICC en (0, 1] y conglomerados declarados.
hojas_ruta_icc_validar <- function(entrada) {
  if (is.null(entrada) || !is.list(entrada)) return(list(ok = FALSE, motivo = "No es una entrada de la biblioteca."))
  icc <- .hojas_ruta_te_num(entrada$icc)
  conglomerados <- .hojas_ruta_te_num(entrada$conglomerados)
  unidad <- as.character(entrada$unidad_conglomerado %||% "")[1]
  escala <- as.character(entrada$escala %||% "")[1]
  if (!nzchar(unidad) || is.na(conglomerados)) return(list(ok = FALSE, motivo = "Le falta la unidad de conglomeración o el número de conglomerados."))
  if (!identical(unidad, "ruta")) return(list(ok = FALSE, motivo = sprintf("Se midió con «%s» como conglomerado; Hojas de ruta conglomera por ruta.", unidad)))
  if (!identical(escala, "proporcion")) return(list(ok = FALSE, motivo = "Se midió sobre un indicador que no es una proporción."))
  if (is.na(icc) || icc <= 0 || icc > 1) return(list(ok = FALSE, motivo = "El ICC no está entre 0 y 1: se muestra, pero no se aplica."))
  avisos <- list()
  ic <- suppressWarnings(as.numeric(unlist(entrada$icc_ic95 %||% list(), use.names = FALSE)))
  ancho <- if (length(ic) == 2L && all(is.finite(ic))) abs(diff(ic)) else NA_real_
  if (conglomerados < HOJAS_RUTA_ICC_MIN_CONGLOMERADOS || (!is.na(ancho) && ancho > icc)) {
    avisos[[1]] <- .hojas_ruta_te_alerta(
      "W_ICC_FEW_CLUSTERS",
      sprintf("El ICC de «%s» viene de %d conglomerados%s: es una estimación poco estable.", as.character(entrada$id %||% "?"), as.integer(conglomerados), if (!is.na(ancho) && ancho > icc) " y su intervalo es más ancho que el propio ICC" else "")
    )
  }
  list(ok = TRUE, motivo = "", avisos = avisos)
}

#' Aplica un ICC de la biblioteca: DEFF = 1 + (k − 1)·ICC con el k de la ruta nueva.
#' La entrada se copia en `icc_aplicado` para reconstruir el DEFF sin la biblioteca.
#' Los overrides por distrito prevalecen y se devuelven marcados.
hojas_ruta_icc_aplicar <- function(sample_size, entrada, k) {
  v <- hojas_ruta_icc_validar(entrada)
  if (!isTRUE(v$ok)) return(list(ok = FALSE, sample_size = sample_size, motivo = v$motivo, avisos = list()))
  k <- max(1L, as.integer(k))
  deff <- round(1 + (k - 1) * .hojas_ruta_te_num(entrada$icc), 4)
  ss <- sample_size
  ss$design_effect <- deff
  ss$design_effect_fuente <- "icc_biblioteca"
  ss$icc_aplicado <- c(entrada, list(k_ruta = k, deff_resultante = deff))
  list(ok = TRUE, sample_size = ss, motivo = "", avisos = v$avisos %||% list(),
       distritos_con_override = names(sample_size$design_effect_overrides %||% list()))
}

hojas_ruta_icc_biblioteca_ruta <- function() {
  file.path(tools::R_user_dir("prosecnur", "data"), "hojas_ruta", "icc.json")
}

#' Lee la biblioteca local de ICC; vacía si no existe o no se puede leer.
hojas_ruta_icc_biblioteca_leer <- function(ruta = hojas_ruta_icc_biblioteca_ruta()) {
  if (!file.exists(ruta)) return(list())
  x <- tryCatch(jsonlite::fromJSON(ruta, simplifyVector = FALSE), error = function(e) list())
  if (!is.list(x)) list() else Filter(is.list, x)
}

#' Agrega o reemplaza (por id) una entrada de la biblioteca.
hojas_ruta_icc_biblioteca_guardar <- function(entrada, ruta = hojas_ruta_icc_biblioteca_ruta()) {
  id <- as.character(entrada$id %||% "")[1]
  if (!nzchar(id)) stop_api(400, "E_BAD_REQUEST", "La entrada del ICC necesita un id.")
  actuales <- Filter(function(e) !identical(as.character(e$id %||% ""), id), hojas_ruta_icc_biblioteca_leer(ruta))
  dir.create(dirname(ruta), recursive = TRUE, showWarnings = FALSE)
  writeLines(as.character(jsonlite::toJSON(c(actuales, list(entrada)), auto_unbox = TRUE, null = "null", digits = NA, pretty = TRUE)), ruta, useBytes = TRUE)
  invisible(c(actuales, list(entrada)))
}

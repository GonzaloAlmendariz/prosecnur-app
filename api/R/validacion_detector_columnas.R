# =============================================================================
# Detector de consistencia, familia (a): columna que no se parece a sí misma
# =============================================================================
# Cuatro miradas por columna; cada una devuelve como mucho una sugerencia:
#
#   atipico    pregunta numérica con valores a más de `atipico_z` MAD escaladas
#              de la mediana, siempre que sean pocos (`atipico_max_share`).
#   digitos    columna de códigos (solo dígitos, largo dominante >= 4) donde
#              unos pocos valores tienen otra cantidad de dígitos.
#   forma      columna de identificadores o códigos con letras y dígitos donde
#              unos pocos valores no siguen la forma de la mayoría.
#   personal   datos potencialmente personales, todas las columnas en una
#              sola sugerencia; lo decide `.reconciliacion_dato_personal()`
#              (la misma función que Carga).
#
# Base de cada cifra: los casos con dato en esa columna.

.VDC_METADATOS <- c("start", "end", "today", "date", "deviceid", "subscriberid", "simserial",
                    "phonenumber", "username", "audit", "instanceid", "instanceID")

# Columnas que se miran: con formulario, sus preguntas numéricas (atípicos) y
# de texto más las columnas fuera del formulario; sin formulario, todas.
.vdc_columnas <- function(data, pregs, excluir) {
  nms <- names(data)
  fuera <- grepl("^_", nms) | grepl("/", nms, fixed = TRUE) | tolower(nms) %in% tolower(.VDC_METADATOS) |
    nms %in% excluir | startsWith(nms, ".")
  nms <- nms[!fuera]
  if (is.null(pregs)) {
    num <- nms[vapply(nms, function(v) .vdc_es_numerica(data[[v]]), logical(1))]
    return(list(numericas = num, texto = setdiff(nms, num)))
  }
  tipo <- pregs$tipo[match(nms, pregs$name)]
  list(numericas = nms[!is.na(tipo) & tipo %in% c("integer", "decimal")],
       texto = nms[is.na(tipo) | tipo %in% c("text", "barcode")])
}

.vdc_es_numerica <- function(x) {
  if (is.numeric(x)) return(TRUE)
  v <- trimws(as.character(x[.vdc_con_dato(x)]))
  length(v) > 0L && mean(!is.na(suppressWarnings(as.numeric(v)))) >= 0.95
}

.vdc_fmt_num <- function(x) {
  out <- formatC(x, format = "fg", digits = 6, big.mark = "")
  trimws(out)
}

# --- atípico -------------------------------------------------------------------

#' Atípicos de una pregunta numérica (mediana y MAD)
#' @keywords internal
.vdc_atipico <- function(data, var, pregs, especiales, u = .VDC_UMBRALES) {
  x <- suppressWarnings(as.numeric(as.character(data[[var]])))
  ok <- !is.na(x) & !as.character(x) %in% especiales
  if (sum(ok) < u$min_casos) return(NULL)
  med <- stats::median(x[ok])
  mad <- stats::mad(x[ok])
  # Con más de la mitad de los casos en un mismo valor la MAD vale 0 y
  # cualquier otro valor "estaría lejos": no se mide.
  if (!is.finite(mad) || mad <= 0) return(NULL)
  z <- abs(x - med) / mad
  lejos <- which(ok & z > u$atipico_z)
  n_ok <- sum(ok)
  if (!length(lejos) || length(lejos) > max(1, floor(u$atipico_max_share * n_ok))) return(NULL)
  q <- stats::quantile(x[ok], c(0.25, 0.75), names = FALSE, type = 7)
  valores <- sort(unique(x[lejos]))
  ref <- .vdc_pregunta_ref(pregs, var)
  k <- length(lejos)
  lim <- c(med - u$atipico_z * mad, med + u$atipico_z * mad)
  list(
    familia = "columna", tipo = "atipico", fuerte = TRUE, peso = min(9, max(z[lejos]) / 10),
    variables = list(ref),
    titulo = sprintf("Valores lejos del resto en %s", var),
    texto = sprintf("%d %s de %s %s lejos del resto (%s); la mitad central de los %d casos con dato está entre %s y %s.",
                    k, .vdc_plural(k, "valor", "valores"), var, .vdc_plural(k, "queda", "quedan"),
                    paste(.vdc_fmt_num(utils::head(valores, 5)), collapse = ", "),
                    n_ok, .vdc_fmt_num(q[1]), .vdc_fmt_num(q[2])),
    cifra = list(n_casos = k, base_n = n_ok, base = "casos con dato en la pregunta",
                 mediana = med, mad = mad, z_max = round(max(z[lejos]), 1)),
    filas = lejos,
    regla = .vdc_semilla_rango(var, lim, k, n_ok, u$atipico_z)
  )
}

.vdc_semilla_rango <- function(var, lim, k, n_ok, z) {
  mn <- floor(lim[1]); mx <- ceiling(lim[2])
  list(
    tipo = "rango_num", variables = list(var), params = list(min = mn, max = mx),
    nombre = sprintf("Valores fuera de lo habitual en %s", var),
    mensaje = sprintf("El valor queda fuera de %s a %s, donde está casi toda la base.", .vdc_fmt_num(mn), .vdc_fmt_num(mx)),
    severidad = "advertencia", activa = TRUE, hallazgo_kind = "caso_validar", origen = "sembrado",
    semilla = list(origen = "detector_consistencia", columna = var, n_casos_afectados = as.integer(k),
                   n_casos = as.integer(n_ok),
                   porque = sprintf("%d de %d casos con dato quedan a más de %s desviaciones robustas de la mediana.", k, n_ok, .vdc_fmt_num(z)))
  )
}

# --- dígitos y forma -----------------------------------------------------------

.vdc_valores_texto <- function(x) {
  v <- trimws(as.character(x))
  v[!.vdc_con_dato(x)] <- NA_character_
  # Un número leído como doble ("12345.0") vuelve a su forma entera.
  v <- sub("^([0-9]+)\\.0+$", "\\1", v)
  v
}

#' Enteros o códigos con una cantidad de dígitos distinta a la mayoría
#' @keywords internal
.vdc_digitos <- function(data, var, pregs, u = .VDC_UMBRALES) {
  v <- .vdc_valores_texto(data[[var]])
  ok <- !is.na(v)
  n_ok <- sum(ok)
  if (n_ok < u$min_casos || !all(grepl("^[0-9]+$", v[ok]))) return(NULL)
  largo <- nchar(v)
  tab <- sort(table(largo[ok]), decreasing = TRUE)
  dom <- as.integer(names(tab)[1])
  share <- as.integer(tab[1]) / n_ok
  otros <- which(ok & largo != dom)
  if (dom < u$digitos_min || share < u$forma_share || !length(otros) ||
      length(otros) > max(1, floor(u$forma_max_share * n_ok))) return(NULL)
  k <- length(otros)
  largos <- sort(unique(largo[otros]))
  list(
    familia = "columna", tipo = "digitos", fuerte = TRUE, peso = 3,
    variables = list(.vdc_pregunta_ref(pregs, var)),
    titulo = sprintf("Cantidad de dígitos distinta en %s", var),
    texto = sprintf("%d %s de %s %s %s dígitos; el resto, %d de %d casos con dato, tiene %d.",
                    k, .vdc_plural(k, "valor", "valores"), var, .vdc_plural(k, "tiene", "tienen"),
                    paste(largos, collapse = " o "), n_ok - k, n_ok, dom),
    cifra = list(n_casos = k, base_n = n_ok, base = "casos con dato en la columna", largo_dominante = dom),
    filas = otros
  )
}

# Forma de un valor: cada tramo de letras es "A"; un tramo de 1 o 2 dígitos es
# "9" (días, meses y horas se escriben con o sin cero: "1 Julio" y "13 Junio"
# tienen la misma forma) y uno de 3 o más conserva su largo ("P375" frente a
# "595"; "08.10.2026" frente a "16.10.16").
.vdc_forma_de <- function(v) {
  f <- gsub("[[:alpha:]]+", "A", v, perl = TRUE)
  f <- gsub("(?<![0-9])[0-9]{1,2}(?![0-9])", "#", f, perl = TRUE)
  f <- gsub("[0-9]", "9", f)
  gsub("#", "9", f, fixed = TRUE)
}

#' Valores con una forma distinta al patrón dominante (letras y dígitos)
#' @keywords internal
.vdc_forma <- function(data, var, pregs, u = .VDC_UMBRALES) {
  v <- .vdc_valores_texto(data[[var]])
  ok <- !is.na(v)
  n_ok <- sum(ok)
  if (n_ok < u$min_casos || all(grepl("^[0-9]+$", v[ok]))) return(NULL)
  if (length(unique(v[ok])) < u$forma_min_distintos) return(NULL)
  forma <- .vdc_forma_de(v)
  tab <- sort(table(forma[ok]), decreasing = TRUE)
  dom <- names(tab)[1]
  share <- as.integer(tab[1]) / n_ok
  # Solo códigos: la forma dominante lleva dígitos y es corta.
  if (share < u$forma_share || nchar(dom) > 20L || !grepl("9", dom, fixed = TRUE)) return(NULL)
  otros <- which(ok & forma != dom)
  if (!length(otros) || length(otros) > max(1, floor(u$forma_max_share * n_ok))) return(NULL)
  k <- length(otros)
  ejemplo <- v[ok & forma == dom][1]
  raros <- utils::head(unique(v[otros]), 3)
  list(
    familia = "columna", tipo = "forma", fuerte = TRUE, peso = 3,
    variables = list(.vdc_pregunta_ref(pregs, var)),
    titulo = sprintf("Valores con otra forma en %s", var),
    texto = sprintf("%d %s de %s no %s la forma de los demás (%s); el resto, %d de %d casos con dato, se escribe como \"%s\".",
                    k, .vdc_plural(k, "valor", "valores"), var, .vdc_plural(k, "sigue", "siguen"),
                    paste0("\"", raros, "\"", collapse = ", "), n_ok - k, n_ok, ejemplo),
    cifra = list(n_casos = k, base_n = n_ok, base = "casos con dato en la columna"),
    filas = otros
  )
}

# --- dato personal -------------------------------------------------------------

# Causa de sospecha de una columna, o NULL. La decide la función de Carga.
.vdc_personal_causa <- function(data, var) {
  x <- data[[var]]
  if (sum(.vdc_con_dato(x)) < .RECON_PERSONAL_MIN_VALORES) return(NULL)
  r <- .reconciliacion_dato_personal(var, x)
  if (isTRUE(r$sospecha)) r$causa else NULL
}

#' Una sola sugerencia con todas las columnas que parecen dato personal
#'
#' Van juntas: son una misma decisión (qué sale en la base que se entrega) y,
#' una por columna, ocuparían todo el bloque.
#' @keywords internal
.vdc_personales <- function(data, vars, pregs) {
  causas <- lapply(vars, function(v) .vdc_personal_causa(data, v))
  names(causas) <- vars
  causas <- Filter(Negate(is.null), causas)
  if (!length(causas)) return(NULL)
  k <- length(causas)
  list(
    familia = "columna", tipo = "dato_personal", fuerte = TRUE, peso = 1,
    variables = lapply(names(causas), function(v) .vdc_pregunta_ref(pregs, v)),
    titulo = if (k == 1L) sprintf("Dato potencialmente personal en %s", names(causas))
             else sprintf("Datos potencialmente personales en %d columnas", k),
    texto = paste0(paste(sprintf("%s: %s", names(causas), unlist(causas)), collapse = ". "),
                   ". Si identifica a una persona, conviene sacarlo de la base que se entrega."),
    cifra = list(n_columnas = k, base_n = nrow(data), base = "casos de la base"),
    filas = integer(0)
  )
}

#' Familia (a): columnas que no se parecen a sí mismas
#' @keywords internal
.vdc_familia_columnas <- function(data, pregs, especiales, excluir, u = .VDC_UMBRALES) {
  cols <- .vdc_columnas(data, pregs, excluir)
  out <- list()
  for (v in cols$numericas) out[[length(out) + 1L]] <- .vdc_atipico(data, v, pregs, especiales, u)
  # Un dato personal puede además tener valores con otra forma: son dos avisos distintos.
  out[[length(out) + 1L]] <- .vdc_personales(data, cols$texto, pregs)
  for (v in cols$texto) {
    s <- .vdc_digitos(data, v, pregs, u)
    if (is.null(s)) s <- .vdc_forma(data, v, pregs, u)
    out[[length(out) + 1L]] <- s
  }
  Filter(Negate(is.null), out)
}

# =============================================================================
# Sugeridas al mirar la base: fechas y horas que deben cuadrar (ítem 51,
# puntos 2 y 4)
# =============================================================================
# Proponen reglas del tipo `comparar_fechas` (validacion_regla_fechas.R). La
# lectura de cada columna y la comparación salen de `.regla_fechas_medir_tabla()`,
# la misma función que usa la regla: lo que aquí se considera "fecha legible"
# o "fin antes que inicio" es lo que la regla marcará.
#
# Fechas. Una columna es de fecha si se lee como fecha en el 90 % o más de sus
# respuestas con dato (al menos 20) y trae dos días distintos o más. Para cada
# par de columnas de fecha, sobre los casos con las dos legibles:
#   iguales  coinciden en el 90 % o más: "deben ser iguales" (duración de 0
#            días).
#   orden    no coinciden, pero la segunda es igual o posterior en el 90 % o
#            más y posterior en la mitad o más: la segunda no puede ser
#            anterior (una supervisión, un cierre).
#
# Horas. Una hora se reconoce por el contenido: una columna que se lee como
# hora (13:45, 13.45) o una hora repartida en columnas con el mismo nombre de
# base (`<base>_h` de 0 a 23, `<base>_min` de 0 a 59 y, si la hay, una columna
# a.m./p.m. con dos códigos). Cuál es el inicio y cuál el fin lo dice el nombre
# ("inicio", "fin"), que es vocabulario del oficio y no de un estudio. Con un
# inicio y un fin se proponen:
#   orden     la hora de fin no puede ser anterior a la de inicio;
#   duración  menos de un tercio o más del triple de la duración mediana.
#
# Base y cifra: ver reglas_custom_semilla_comun.R.
# =============================================================================

.SEMILLA_FECHAS_LEIDAS <- 0.9    # parte de respuestas legibles para tratar una columna como fecha u hora
.SEMILLA_FECHAS_MIN <- 20L       # respuestas legibles mínimas
.SEMILLA_FECHAS_IGUALES <- 0.9   # parte de casos con las dos fechas iguales
.SEMILLA_FECHAS_ORDEN <- 0.9     # parte de casos con la segunda igual o posterior
.SEMILLA_HORAS_DURACION <- 3     # la duración se aparta más de 3 veces de la mediana

.SEMILLA_HORA_INICIO <- "(^|[^a-z])(inicio|inicia|inicial|ini|comienzo|comienza|empieza|start|entrada)([^a-z]|$)"
.SEMILLA_HORA_FIN <- "(^|[^a-z])(fin|final|finaliza|termino|termina|end|cierre|salida)([^a-z]|$)"
.SEMILLA_HORA_SUF_H <- "[_.]?(h|hh|hr|hora|horas)$"
.SEMILLA_HORA_SUF_MIN <- "[_.]?(m|mm|mi|min|mins|minuto|minutos)$"
.SEMILLA_HORA_AMPM <- "(am_?pm|ampm|a_m_p_m|meridian)"

.semilla_nombre_norm <- function(x) tolower(iconv(as.character(x), to = "ASCII//TRANSLIT"))

# Estado de lectura de un momento de una sola columna, con el lector de la regla.
.semilla_fechas_estado <- function(data, var, unidad) {
  r <- if (identical(unidad, "fecha")) {
    list(tipo = "rango_fecha", variables = list(var), params = list())
  } else {
    m <- list(variables = list(var), partes = "una", formato = "auto")
    list(tipo = "comparar_fechas", variables = list(var, var),
         params = list(unidad = "hora", patron = "orden", inicio = m, fin = m))
  }
  .regla_fechas_medir_tabla(data, r)$a_estado
}

.semilla_fechas_legible <- function(estado) {
  con_dato <- sum(!is.na(estado) & estado != "vacia")
  leidas <- sum(!is.na(estado) & estado == "leida")
  con_dato >= .SEMILLA_FECHAS_MIN && leidas / con_dato >= .SEMILLA_FECHAS_LEIDAS
}

# Columnas de fecha por contenido, en el orden de la base.
.semilla_columnas_de_fecha <- function(data) {
  out <- character(0)
  for (v in .semilla_columnas_mirables(data)) {
    x <- data[[v]]
    if (is.numeric(x)) next
    est <- .semilla_fechas_estado(data, v, "fecha")
    if (!.semilla_fechas_legible(est)) next
    f <- .semilla_como_fecha(x)
    if (length(unique(f[!is.na(f)])) < 2L) next
    out <- c(out, v)
  }
  out
}

.semilla_momento <- function(vars, partes = "una", am = NULL, pm = NULL) {
  m <- list(variables = as.list(vars), partes = partes, formato = "auto")
  if (!is.null(am)) m$am <- as.list(am)
  if (!is.null(pm)) m$pm <- as.list(pm)
  m
}

.semilla_regla_comparar <- function(unidad, patron, ini, fin, minimo = NULL, maximo = NULL) {
  params <- list(unidad = unidad, patron = patron, inicio = ini, fin = fin, marcar_ilegibles = FALSE)
  if (!is.null(minimo)) params$minimo <- minimo
  if (!is.null(maximo)) params$maximo <- maximo
  list(tipo = "comparar_fechas", variables = as.list(c(unlist(ini$variables), unlist(fin$variables))),
       params = params)
}

.semilla_fechas_propuesta <- function(regla, nombre, mensaje, semilla) {
  c(regla, list(nombre = nombre, mensaje = mensaje, severidad = "advertencia", activa = TRUE,
                hallazgo_kind = "caso_validar", planned_action_type = "ignore_rule",
                origen = "sembrado", semilla = semilla))
}

#' Proponer fechas que deben cuadrar
#'
#' @param data data.frame de la base cargada.
#' @param survey hoja `survey`; opcional, solo para nombrar las columnas.
#' @param reglas_existentes reglas propias ya definidas en el scope.
#' @return lista de propuestas sin cifra.
#' @keywords internal
reglas_semilla_fechas_pares <- function(data, survey = NULL, reglas_existentes = list()) {
  if (!is.data.frame(data) || nrow(data) < .SEMILLA_FECHAS_MIN) return(list())
  cols <- .semilla_columnas_de_fecha(data)
  if (length(cols) < 2L) return(list())
  out <- list()
  for (i in seq_len(length(cols) - 1L)) for (j in seq(i + 1L, length(cols))) {
    a <- cols[i]; b <- cols[j]
    base <- .semilla_regla_comparar("fecha", "orden", .semilla_momento(a), .semilla_momento(b))
    d <- .regla_fechas_medir_tabla(data, base)$diferencia
    d <- d[!is.na(d)]
    n <- length(d)
    if (n < .SEMILLA_FECHAS_MIN) next
    ta <- .semilla_nombrar_var(a, survey); tb <- .semilla_nombrar_var(b, survey)
    iguales <- sum(d == 0)
    if (iguales / n >= .SEMILLA_FECHAS_IGUALES) {
      if (.semilla_ya_cubierta_conjunto(reglas_existentes, "comparar_fechas", c(a, b), "duracion")) next
      regla <- .semilla_regla_comparar("fecha", "duracion", .semilla_momento(a), .semilla_momento(b), 0, 0)
      out[[length(out) + 1L]] <- .semilla_fechas_propuesta(
        regla,
        nombre = sprintf("%s y %s deben ser iguales", ta, .semilla_en_frase(tb)),
        mensaje = sprintf("%s y %s no coinciden.", ta, .semilla_en_frase(tb)),
        semilla = list(origen = "fechas_iguales", variable = a, columnas = list(a, b),
                       n_par = n, n_iguales = as.integer(iguales),
                       porque = sprintf("%s y %s coinciden en %d de %d casos con las dos fechas legibles (%s).",
                                        a, b, iguales, n, .semilla_pct(iguales, n))))
      next
    }
    # Orden: se prueba en los dos sentidos; "fin" es la que suele ser posterior.
    for (sentido in 1:2) {
      dd <- if (sentido == 1L) d else -d
      ini <- if (sentido == 1L) a else b
      fin <- if (sentido == 1L) b else a
      ge <- sum(dd >= 0); gt <- sum(dd > 0)
      if (ge / n < .SEMILLA_FECHAS_ORDEN || gt / n < 0.5) next
      if (.semilla_ya_cubierta_conjunto(reglas_existentes, "comparar_fechas", c(a, b), "orden")) break
      ti <- .semilla_nombrar_var(ini, survey); tf <- .semilla_nombrar_var(fin, survey)
      regla <- .semilla_regla_comparar("fecha", "orden", .semilla_momento(ini), .semilla_momento(fin))
      out[[length(out) + 1L]] <- .semilla_fechas_propuesta(
        regla,
        nombre = sprintf("%s antes que %s", tf, .semilla_en_frase(ti)),
        mensaje = sprintf("%s es anterior a %s.", tf, .semilla_en_frase(ti)),
        semilla = list(origen = "fechas_orden", variable = fin, columnas = list(ini, fin),
                       n_par = n, n_en_orden = as.integer(ge),
                       porque = sprintf("%s es igual o posterior a %s en %d de %d casos con las dos fechas legibles (%s); la regla marca los que van al revés.",
                                        fin, ini, ge, n, .semilla_pct(ge, n))))
      break
    }
  }
  out
}

# --- Horas ---------------------------------------------------------------------

.semilla_entero_en <- function(x, desde, hasta) {
  v <- suppressWarnings(as.numeric(.semilla_texto(x)))
  con <- sum(!is.na(.semilla_texto(x)))
  ok <- !is.na(v) & v == round(v) & v >= desde & v <= hasta
  con >= .SEMILLA_FECHAS_MIN && sum(ok) / con >= 0.95
}

# Códigos a.m. y p.m. de una columna: por el rótulo de su lista y, sin
# formulario, por la hora mediana con que viene cada código.
.semilla_ampm_codigos <- function(data, col, hora_col, survey, choices) {
  vals <- unique(stats::na.omit(.semilla_texto(data[[col]])))
  if (length(vals) != 2L) return(NULL)
  if (is.data.frame(survey) && is.data.frame(choices) && all(c("name", "list_name") %in% names(survey))) {
    lista <- survey$list_name[match(col, survey$name)]
    if (!is.na(lista) && nzchar(lista)) {
      ch <- choices[!is.na(choices$list_name) & choices$list_name == lista, , drop = FALSE]
      lab <- .semilla_label_col(ch)
      if (!is.na(lab)) {
        r <- gsub("[^a-z]", "", tolower(as.character(ch[[lab]])))
        am <- as.character(ch$name[r == "am"]); pm <- as.character(ch$name[r == "pm"])
        if (length(am) == 1L && length(pm) == 1L) return(list(am = am, pm = pm, fuente = "formulario"))
      }
    }
  }
  h <- suppressWarnings(as.numeric(.semilla_texto(data[[hora_col]])))
  cod <- .semilla_texto(data[[col]])
  med <- vapply(vals, function(v) stats::median(h[!is.na(cod) & cod == v], na.rm = TRUE), numeric(1))
  if (anyNA(med) || med[1] == med[2]) return(NULL)
  list(am = vals[which.min(med)], pm = vals[which.max(med)], fuente = "datos")
}

# Momentos de hora presentes en la base: lista de `momento`, `nombre` (lo que
# decide inicio o fin) y `columnas`.
.semilla_momentos_hora <- function(data, survey = NULL, choices = NULL) {
  cols <- .semilla_columnas_mirables(data)
  nn <- .semilla_nombre_norm(cols)
  out <- list()
  usadas <- character(0)
  # Hora repartida: <base>_h y <base>_min, con a.m./p.m. opcional.
  es_h <- grepl(.SEMILLA_HORA_SUF_H, nn) & vapply(cols, function(v) .semilla_entero_en(data[[v]], 0, 23), logical(1))
  for (i in which(es_h)) {
    base <- sub(.SEMILLA_HORA_SUF_H, "", nn[i])
    if (!nzchar(base)) next
    j <- which(sub(.SEMILLA_HORA_SUF_MIN, "", nn) == base & grepl(.SEMILLA_HORA_SUF_MIN, nn) & seq_along(cols) != i)
    j <- j[vapply(cols[j], function(v) .semilla_entero_en(data[[v]], 0, 59), logical(1))]
    if (length(j) != 1L) next
    ap <- which(grepl(.SEMILLA_HORA_AMPM, nn))
    ap <- ap[vapply(cols[ap], function(v) length(unique(stats::na.omit(.semilla_texto(data[[v]])))) == 2L, logical(1))]
    # El a.m./p.m. va con su hora si comparte la base del nombre, o si es el único de la base.
    ap_base <- ap[startsWith(nn[ap], base)]
    if (!length(ap_base) && length(ap) == 1L) ap_base <- ap
    codigos <- if (length(ap_base) == 1L) .semilla_ampm_codigos(data, cols[ap_base], cols[i], survey, choices) else NULL
    if (!is.null(codigos)) {
      m <- .semilla_momento(c(cols[i], cols[j], cols[ap_base]), "hora_minutos_ampm", codigos$am, codigos$pm)
      usa <- c(cols[i], cols[j], cols[ap_base])
    } else {
      m <- .semilla_momento(c(cols[i], cols[j]), "hora_minutos")
      usa <- c(cols[i], cols[j])
    }
    out[[length(out) + 1L]] <- list(momento = m, nombre = base, columnas = usa,
                                    ampm = if (!is.null(codigos)) codigos else NULL)
    usadas <- c(usadas, usa)
  }
  # Hora en una sola columna.
  for (k in seq_along(cols)) {
    v <- cols[k]
    if (v %in% usadas || is.numeric(data[[v]])) next
    if (!.semilla_fechas_legible(.semilla_fechas_estado(data, v, "hora"))) next
    out[[length(out) + 1L]] <- list(momento = .semilla_momento(v), nombre = nn[k], columnas = v, ampm = NULL)
  }
  out
}

#' Proponer orden y duración entre la hora de inicio y la de fin
#'
#' @param data data.frame de la base cargada.
#' @param survey,choices hojas del formulario; opcionales.
#' @param reglas_existentes reglas propias ya definidas en el scope.
#' @return lista de propuestas sin cifra.
#' @keywords internal
reglas_semilla_horas <- function(data, survey = NULL, choices = NULL, reglas_existentes = list()) {
  if (!is.data.frame(data) || nrow(data) < .SEMILLA_FECHAS_MIN) return(list())
  momentos <- .semilla_momentos_hora(data, survey, choices)
  if (length(momentos) < 2L) return(list())
  nombres <- vapply(momentos, `[[`, character(1), "nombre")
  ini <- which(grepl(.SEMILLA_HORA_INICIO, nombres, perl = TRUE) & !grepl(.SEMILLA_HORA_FIN, nombres, perl = TRUE))
  fin <- which(grepl(.SEMILLA_HORA_FIN, nombres, perl = TRUE) & !grepl(.SEMILLA_HORA_INICIO, nombres, perl = TRUE))
  # Un solo inicio y un solo fin: con más, el nombre no alcanza para emparejarlos.
  if (length(ini) != 1L || length(fin) != 1L) return(list())
  a <- momentos[[ini]]; b <- momentos[[fin]]
  vars <- c(a$columnas, b$columnas)
  base <- .semilla_regla_comparar("hora", "orden", a$momento, b$momento)
  d <- .regla_fechas_medir_tabla(data, base)$diferencia
  d <- d[!is.na(d)]
  n <- length(d)
  if (n < .SEMILLA_FECHAS_MIN) return(list())
  en_orden <- sum(d >= 0)
  # Si el fin casi nunca queda después del inicio, el par no es de la misma
  # jornada o se lee mal: no se propone.
  if (en_orden / n < 0.8) return(list())
  ampm_txt <- if (!is.null(b$ampm)) sprintf(" (a.m. = %s, p.m. = %s)", b$ampm$am, b$ampm$pm)
              else if (!is.null(a$ampm)) sprintf(" (a.m. = %s, p.m. = %s)", a$ampm$am, a$ampm$pm) else ""
  lectura <- sprintf("Se leyó el inicio en %s y el fin en %s%s.", paste(a$columnas, collapse = ", "),
                     paste(b$columnas, collapse = ", "), ampm_txt)
  out <- list()
  if (!.semilla_ya_cubierta_conjunto(reglas_existentes, "comparar_fechas", vars, "orden")) {
    out[[length(out) + 1L]] <- .semilla_fechas_propuesta(
      base,
      nombre = "Hora de fin antes que la hora de inicio",
      mensaje = "La hora de fin es anterior a la hora de inicio.",
      semilla = list(origen = "horas_orden", variable = a$columnas[1], columnas = as.list(vars),
                     n_par = n, n_en_orden = as.integer(en_orden),
                     porque = sprintf("%s La hora de fin es igual o posterior a la de inicio en %d de %d casos con las dos legibles (%s); la regla marca los que van al revés.",
                                      lectura, en_orden, n, .semilla_pct(en_orden, n))))
  }
  if (!.semilla_ya_cubierta_conjunto(reglas_existentes, "comparar_fechas", vars, "duracion")) {
    pos <- d[d >= 0]
    med <- stats::median(pos)
    if (is.finite(med) && med >= 3) {
      minimo <- floor(med / .SEMILLA_HORAS_DURACION)
      maximo <- ceiling(med * .SEMILLA_HORAS_DURACION)
      dur <- .semilla_regla_comparar("hora", "duracion", a$momento, b$momento, minimo, maximo)
      out[[length(out) + 1L]] <- .semilla_fechas_propuesta(
        dur,
        nombre = sprintf("Duración entre la hora de inicio y la de fin fuera de %d a %d minutos", as.integer(minimo), as.integer(maximo)),
        mensaje = sprintf("La duración queda fuera de %d a %d minutos.", as.integer(minimo), as.integer(maximo)),
        semilla = list(origen = "horas_duracion", variable = a$columnas[1], columnas = as.list(vars),
                       mediana = med, minimo = minimo, maximo = maximo,
                       porque = sprintf("%s La duración mediana es de %s minutos en %d casos; la regla marca menos de un tercio (%d) o más del triple (%d), y también el fin antes que el inicio.",
                                        lectura, format(med, trim = TRUE, drop0trailing = TRUE), length(pos),
                                        as.integer(minimo), as.integer(maximo))))
    }
  }
  out
}

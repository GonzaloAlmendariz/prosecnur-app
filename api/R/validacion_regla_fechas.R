# =============================================================================
# Reglas propias de fechas y horas: "Fecha fuera del operativo" (`rango_fecha`)
# y "Dos fechas u horas que deben cuadrar" (`comparar_fechas`)
# =============================================================================
# Una fecha o una hora llega de muchas formas: texto en un formato común
# ("08.10.2026", "08/10/26", "2026-10-08", "13:45", "13.45"), una columna con
# clase de fecha, o repartida en varias preguntas (día, mes y año; hora y
# minutos; hora, minutos y a.m./p.m.). Este archivo la lee y la compara.
#
# Un "momento" es lo que se lee: sus preguntas (`variables`), cómo se reparten
# (`partes`), el formato del texto (`formato`, o "auto") y, en una hora con
# a.m./p.m., los códigos que valen a.m. y p.m. (`am`, `pm`).
#
#   partes   "una"                una pregunta con la fecha o la hora entera.
#            "dia_mes_anio"       tres preguntas, en ese orden.
#            "hora_minutos"       dos preguntas, en ese orden.
#            "hora_minutos_ampm"  tres preguntas, en ese orden.
#
# Formato "auto": cada respuesta se lee con el primer formato que le calza,
# entre los de `.REGLA_FECHAS_FORMATOS` salvo "mm/dd/aaaa" (que choca con
# "dd/mm/aaaa" y solo se usa declarado). La lectura no depende del resto de la
# columna, así que un caso se lee igual en el conteo, en la auditoría y en
# Hallazgos. Lo que se leyó con cada formato se cuenta y se dice
# (`.regla_fechas_lectura()`).
#
# Cada respuesta queda en uno de cuatro estados: "leida", "vacia" (todas sus
# preguntas vacías), "incompleta" (una de sus partes vacía) o "ilegible" (tiene
# texto y no calza con el formato, o no es una fecha u hora que exista: 31.02,
# 25:10, minutos 75). Una ilegible o incompleta no se descarta: la regla la
# marca como hallazgo, salvo `marcar_ilegibles = FALSE`. Una vacía no se marca:
# para eso está "Respuesta obligatoria".
#
# Patrones:
#   rango     (rango_fecha) la fecha leída es anterior a `min` o posterior a
#             `max` (con `inclusive = FALSE`, también igual).
#   orden     (comparar_fechas) el segundo momento (fin) es anterior al primero
#             (inicio): fin antes que inicio, supervisión antes que entrevista.
#   duracion  (comparar_fechas) fin menos inicio, en minutos (horas) o días
#             (fechas), es menor que `minimo` o mayor que `maximo`. Una
#             duración negativa que queda bajo el mínimo se nombra como "orden".
#
# Grano: fila de la tabla donde corre la regla (el caso en la principal). La
# cifra de la regla es la del motor: casos marcados sobre las filas que evalúa
# la auditoría (o las que cumplen el "Solo revisar cuando"); este archivo no
# cuenta casos, solo decide la marca de cada fila.
#
# Una sola función lee y mide (`.regla_fechas_medir()`): el texto R que va al
# plan, a la auditoría y al script de limpieza es esa misma función escrita en
# línea (deparse), y lo que muestran el conteo previo, la frase y Hallazgos
# (valor leído, formato, estado, diferencia y motivo) sale de llamarla. La
# función no lleva ningún "=" suelto (ni argumentos con nombre) ni la secuencia
# "\s": `evaluar_consistencia()` convierte "=" en "==" y duplica "\s".

# Formatos de una pregunta con la fecha entera, en el orden en que "auto" los
# prueba. El último solo se usa declarado.
.REGLA_FECHAS_FORMATOS_FECHA <- c("aaaa-mm-dd", "dd/mm/aaaa", "dd.mm.aaaa", "dd-mm-aaaa",
                                  "dd/mm/aa", "dd.mm.aa", "dd-mm-aa", "mm/dd/aaaa")
.REGLA_FECHAS_FORMATOS_HORA <- c("hh:mm", "hh.mm", "hh:mm a.m./p.m.", "aaaa-mm-dd hh:mm")
.REGLA_FECHAS_PARTES <- list(fecha = c("una", "dia_mes_anio"),
                             hora = c("una", "hora_minutos", "hora_minutos_ampm"))
.REGLA_FECHAS_N_PARTES <- c(una = 1L, dia_mes_anio = 3L, hora_minutos = 2L, hora_minutos_ampm = 3L)
.REGLA_FECHAS_PATRONES <- c("orden", "duracion")

#' Lee y mide fechas u horas fila por fila
#'
#' @param a momento de inicio (o el único, en "rango"): lista sin nombres con
#'   las columnas (lista), las partes, el formato, los códigos de a.m. y los de
#'   p.m.
#' @param b momento de fin, con la misma forma; `list()` en "rango".
#' @param unidad "fecha" u "hora".
#' @param patron "rango", "orden" o "duracion".
#' @param desde,hasta límites del rango ("aaaa-mm-dd"), o NA.
#' @param inclusivo si TRUE, un valor igual a un límite está permitido.
#' @param minimo,maximo límites de la duración (minutos u días), o NA.
#' @param ilegibles si TRUE, una respuesta ilegible o incompleta marca el caso.
#' @param zona zona horaria con que se lee un instante con desfase ("Z",
#'   "-05:00").
#' @return lista con, por fila, `a_texto`, `a_num`, `a_estado`, `a_formato`,
#'   `a_original`, lo mismo con `b_`, `diferencia` (fin menos inicio), `motivo`
#'   ("ilegible", "antes", "despues", "orden", "corta", "larga" o NA) y `marca`.
#' @keywords internal
.regla_fechas_medir <- function(a, b, unidad, patron, desde, hasta, inclusivo, minimo, maximo, ilegibles, zona) {
  limpio <- function(x) {
    if (inherits(x, "Date")) x <- format(x, "%Y-%m-%d")
    if (inherits(x, "POSIXt")) x <- format(x, "%Y-%m-%d %H:%M:%S")
    x <- if (is.factor(x)) as.character(x) else as.character(unclass(x))
    x <- trimws(x)
    x[x %in% c("", "NA")] <- NA
    x
  }
  entero <- function(x) {
    ok <- !is.na(x) & grepl("^[0-9]+([.]0+)?$", x)
    out <- rep(NA_integer_, length(x))
    out[ok] <- as.integer(sub("[.]0+$", "", x[ok]))
    out
  }
  fecha_de <- function(y, m, d) {
    s <- sprintf("%04d-%02d-%02d", y, m, d)
    s[is.na(y) | is.na(m) | is.na(d)] <- NA
    as.Date(s, "%Y-%m-%d")
  }
  minutos_de <- function(h, mi) {
    out <- h * 60L + mi
    out[is.na(h) | is.na(mi) | h < 0L | h > 23L | mi < 0L | mi > 59L] <- NA
    out
  }
  # Hora de 12 a 24 con su marca ("am", "pm" o NA). Sin marca, solo se lee la
  # hora que ya es de 24 (0 y de 13 a 23).
  a_24 <- function(h, ap) {
    out <- rep(NA_integer_, length(h))
    sin <- is.na(ap) & !is.na(h) & (h == 0L | (h >= 13L & h <= 23L))
    out[which(sin)] <- h[which(sin)]
    am <- which(!is.na(ap) & ap == "am" & !is.na(h) & h >= 1L & h <= 12L)
    out[am] <- h[am] %% 12L
    pm <- which(!is.na(ap) & ap == "pm" & !is.na(h) & h >= 1L & h <= 23L)
    out[pm] <- ifelse(h[pm] < 12L, h[pm] + 12L, h[pm])
    out
  }
  marca_ampm <- function(x, am, pm) {
    s <- tolower(gsub("[. ]", "", x))
    cod <- sub("[.]0+$", "", x)
    out <- rep(NA_character_, length(x))
    out[!is.na(x) & (s %in% c("am", "a") | cod %in% am)] <- "am"
    out[!is.na(x) & (s %in% c("pm", "p") | cod %in% pm)] <- "pm"
    out
  }
  formatos_fecha <- list(
    c("aaaa-mm-dd", "^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})([T ][0-9]{1,2}:[0-9]{2}.*)?$", "ymd"),
    c("dd/mm/aaaa", "^([0-9]{1,2})/([0-9]{1,2})/([0-9]{4})$", "dmy"),
    c("dd.mm.aaaa", "^([0-9]{1,2})[.]([0-9]{1,2})[.]([0-9]{4})$", "dmy"),
    c("dd-mm-aaaa", "^([0-9]{1,2})-([0-9]{1,2})-([0-9]{4})$", "dmy"),
    c("dd/mm/aa", "^([0-9]{1,2})/([0-9]{1,2})/([0-9]{2})$", "dmy"),
    c("dd.mm.aa", "^([0-9]{1,2})[.]([0-9]{1,2})[.]([0-9]{2})$", "dmy"),
    c("dd-mm-aa", "^([0-9]{1,2})-([0-9]{1,2})-([0-9]{2})$", "dmy"),
    c("mm/dd/aaaa", "^([0-9]{1,2})/([0-9]{1,2})/([0-9]{4})$", "mdy")
  )
  formatos_hora <- list(
    c("hh:mm", "^([0-9]{1,2}):([0-9]{2})(:[0-9]{2}([.][0-9]+)?)?$", "hm"),
    c("hh.mm", "^([0-9]{1,2})([.]([0-9]{1,2}))?$", "hpm"),
    c("hh:mm a.m./p.m.", "^([0-9]{1,2})[:.]([0-9]{2}) *([aApP])[. ]*[mM][.]?$", "ampm"),
    c("aaaa-mm-dd hh:mm", "^[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}[T ]([0-9]{1,2}):([0-9]{2})", "hm")
  )
  # Una pregunta con la fecha o la hora entera: el valor (días o minutos) y el
  # formato con que se leyó. `visto` corta en el primer formato que calza,
  # aunque la fecha no exista (31.02): no se prueba otro formato.
  leer_una <- function(x, formato) {
    n <- length(x)
    num <- rep(NA_real_, n)
    fmt <- rep(NA_character_, n)
    visto <- is.na(x)
    todos <- if (identical(unidad, "hora")) formatos_hora else formatos_fecha
    lista <- if (identical(formato, "auto")) {
      Filter(function(f) !identical(f[1], "mm/dd/aaaa"), todos)
    } else {
      Filter(function(f) identical(f[1], formato), todos)
    }
    for (f in lista) {
      i <- which(!visto)
      if (!length(i)) break
      m <- regmatches(x[i], regexec(f[2], x[i]))
      hit <- vapply(m, length, integer(1)) > 0L
      if (!any(hit)) next
      i <- i[hit]
      m <- m[hit]
      g <- function(k) vapply(m, function(z) z[k + 1L], character(1))
      if (identical(unidad, "hora")) {
        h <- as.integer(g(1))
        mi_txt <- if (identical(f[3], "hpm")) g(3) else g(2)
        mi <- ifelse(is.na(mi_txt) | mi_txt == "", 0L,
                     ifelse(nchar(mi_txt) == 1L, as.integer(mi_txt) * 10L, as.integer(mi_txt)))
        if (identical(f[3], "ampm")) h <- a_24(h, ifelse(tolower(g(3)) == "a", "am", "pm"))
        v <- as.numeric(minutos_de(h, mi))
      } else {
        if (identical(f[3], "ymd")) {
          y <- g(1); mo <- g(2); d <- g(3)
        } else if (identical(f[3], "mdy")) {
          mo <- g(1); d <- g(2); y <- g(3)
        } else {
          d <- g(1); mo <- g(2); y <- g(3)
        }
        y <- as.integer(y)
        y[!is.na(y) & y < 100L] <- y[!is.na(y) & y < 100L] + 2000L
        dd <- fecha_de(y, as.integer(mo), as.integer(d))
        if (identical(f[3], "ymd")) {
          zona_txt <- grepl("[T ][0-9]{1,2}:[0-9]{2}.*(Z|[+-][0-9]{2}:?[0-9]{2})$", x[i])
          if (any(zona_txt)) {
            s <- sub("Z$", "+0000", x[i][zona_txt])
            s <- sub("([+-][0-9]{2}):([0-9]{2})$", "\\1\\2", s)
            s <- sub(" ", "T", s)
            p <- as.POSIXct(strptime(s, "%Y-%m-%dT%H:%M:%OS%z", "UTC"))
            sin_seg <- is.na(p)
            if (any(sin_seg)) p[sin_seg] <- as.POSIXct(strptime(s[sin_seg], "%Y-%m-%dT%H:%M%z", "UTC"))
            local <- as.Date(format(p, "%Y-%m-%d", zona), "%Y-%m-%d")
            dd[zona_txt][!is.na(local)] <- local[!is.na(local)]
          }
        }
        v <- as.numeric(dd)
      }
      num[i] <- v
      fmt[i[!is.na(v)]] <- f[1]
      visto[i] <- TRUE
    }
    list(num, fmt)
  }
  # Un momento: valor, texto normalizado, estado, formato y texto original.
  leer <- function(mo) {
    cols <- lapply(mo[[1]], limpio)
    partes <- mo[[2]]
    n <- length(cols[[1]])
    vacias <- matrix(vapply(cols, is.na, logical(n)), n, length(cols))
    todas <- rowSums(vacias) == length(cols)
    original <- if (length(cols) == 1L) cols[[1]] else {
      Reduce(function(x, y) paste0(x, ", ", y), lapply(cols, function(x) ifelse(is.na(x), "", x)))
    }
    incompleta <- rep(FALSE, n)
    if (identical(partes, "una")) {
      r <- leer_una(cols[[1]], mo[[3]])
      num <- r[[1]]
      fmt <- r[[2]]
    } else if (identical(partes, "dia_mes_anio")) {
      y <- entero(cols[[3]])
      y[!is.na(y) & y < 100L] <- y[!is.na(y) & y < 100L] + 2000L
      num <- as.numeric(fecha_de(y, entero(cols[[2]]), entero(cols[[1]])))
      fmt <- ifelse(is.na(num), NA_character_, partes)
      incompleta <- !todas & rowSums(vacias) > 0L
    } else {
      h <- entero(cols[[1]])
      mi <- entero(cols[[2]])
      if (identical(partes, "hora_minutos_ampm")) {
        ap <- marca_ampm(cols[[3]], mo[[4]], mo[[5]])
        ap_mal <- !is.na(cols[[3]]) & is.na(ap)
        h24 <- a_24(h, ap)
        h24[ap_mal] <- NA
        falta_ap <- is.na(cols[[3]]) & !is.na(h) & h >= 1L & h <= 12L
        incompleta <- !todas & (is.na(cols[[1]]) | is.na(cols[[2]]) | falta_ap)
      } else {
        h24 <- h
        incompleta <- !todas & (is.na(cols[[1]]) | is.na(cols[[2]]))
      }
      num <- as.numeric(minutos_de(h24, mi))
      fmt <- ifelse(is.na(num), NA_character_, partes)
    }
    estado <- ifelse(todas, "vacia", ifelse(incompleta, "incompleta", ifelse(is.na(num), "ilegible", "leida")))
    num[estado != "leida"] <- NA
    fmt[estado != "leida"] <- NA
    texto <- if (identical(unidad, "hora")) {
      ifelse(is.na(num), NA_character_, sprintf("%02d:%02d", as.integer(num) %/% 60L, as.integer(num) %% 60L))
    } else {
      ifelse(is.na(num), NA_character_, format(as.Date(num, "1970-01-01"), "%Y-%m-%d"))
    }
    original[todas] <- NA
    list(num, texto, estado, fmt, original)
  }
  A <- leer(a)
  n <- length(A[[1]])
  B <- if (length(b)) leer(b) else rep(list(rep(NA, n)), 5L)
  limite <- function(s) {
    if (is.null(s) || !length(s) || is.na(s)) return(NA_real_)
    leer(list(list(as.character(s)), "una", "auto", character(0), character(0)))[[1]]
  }
  motivo <- rep(NA_character_, n)
  malo <- function(e) !is.na(e) & e %in% c("ilegible", "incompleta")
  mal <- malo(A[[3]])
  if (length(b)) mal <- mal | malo(B[[3]])
  if (isTRUE(ilegibles)) motivo[mal] <- "ilegible"
  la <- !is.na(A[[3]]) & A[[3]] == "leida"
  lb <- !is.na(B[[3]]) & B[[3]] == "leida"
  dif <- ifelse(la & lb, B[[1]] - A[[1]], NA_real_)
  if (identical(patron, "rango")) {
    d0 <- limite(desde)
    d1 <- limite(hasta)
    antes <- la & !is.na(d0) & (if (isTRUE(inclusivo)) A[[1]] < d0 else A[[1]] <= d0)
    despues <- la & !is.na(d1) & (if (isTRUE(inclusivo)) A[[1]] > d1 else A[[1]] >= d1)
    motivo[is.na(motivo) & antes] <- "antes"
    motivo[is.na(motivo) & despues] <- "despues"
  } else if (identical(patron, "orden")) {
    motivo[is.na(motivo) & la & lb & dif < 0] <- "orden"
  } else if (identical(patron, "duracion")) {
    corta <- la & lb & !is.na(minimo) & dif < minimo
    larga <- la & lb & !is.na(maximo) & dif > maximo
    motivo[is.na(motivo) & corta & dif < 0] <- "orden"
    motivo[is.na(motivo) & corta] <- "corta"
    motivo[is.na(motivo) & larga] <- "larga"
  } else {
    stop("patron de fechas desconocido: ", patron)
  }
  stats::setNames(
    list(A[[2]], A[[1]], A[[3]], A[[4]], A[[5]], B[[2]], B[[1]], B[[3]], B[[4]], B[[5]],
         dif, motivo, !is.na(motivo)),
    c("a_texto", "a_num", "a_estado", "a_formato", "a_original",
      "b_texto", "b_num", "b_estado", "b_formato", "b_original",
      "diferencia", "motivo", "marca")
  )
}

# --- Parámetros ---------------------------------------------------------------

.regla_fechas_tipos <- c("rango_fecha", "comparar_fechas")

.regla_fechas_es <- function(r) {
  identical(as.character((r %||% list())$tipo %||% "")[1], "rango_fecha") ||
    identical(as.character((r %||% list())$tipo %||% "")[1], "comparar_fechas")
}

.regla_fechas_num <- function(x) {
  v <- suppressWarnings(as.numeric(unlist(x, use.names = FALSE)[1]))
  if (length(v) != 1L) NA_real_ else v
}

.regla_fechas_txt <- function(x, default = NA_character_) {
  v <- trimws(calc_str(x, ""))
  if (!nzchar(v)) default else v
}

# Un momento normalizado (sin validar).
.regla_fechas_momento <- function(vars, m) {
  m <- m %||% list()
  list(
    variables = as.character(vars),
    partes = .regla_fechas_txt(m$partes, "una"),
    formato = .regla_fechas_txt(m$formato, "auto"),
    am = .regla_chr_values(m$am),
    pm = .regla_chr_values(m$pm)
  )
}

#' Parámetros normalizados de una regla de fechas
#'
#' `rango_fecha`: el momento son las `variables` de la regla, con `partes` y
#' `formato` en `params`. `comparar_fechas`: `params$inicio` y `params$fin`
#' traen cada uno sus `variables` (por nombre), `partes`, `formato`, `am` y
#' `pm`; las `variables` de la regla son las de inicio seguidas de las de fin.
#'
#' @param r regla propia.
#' @return lista con `tipo`, `unidad`, `patron`, `a`, `b` (NULL en rango),
#'   `desde`, `hasta`, `inclusivo`, `minimo`, `maximo`, `ilegibles`, `zona` y
#'   `variables`.
#' @keywords internal
.regla_fechas_params <- function(r) {
  tipo <- as.character(r$tipo %||% "")[1]
  params <- r$params %||% list()
  vars <- trimws(as.character(unlist(r$variables %||% list(), use.names = FALSE)))
  ilegibles <- isTRUE(calc_bool(params$marcar_ilegibles, TRUE))
  zona <- .regla_fechas_txt(params$timezone, "America/Lima")
  if (identical(tipo, "rango_fecha")) {
    return(list(
      tipo = tipo, unidad = "fecha", patron = "rango",
      a = .regla_fechas_momento(vars, params), b = NULL,
      desde = .regla_fechas_txt(params$min), hasta = .regla_fechas_txt(params$max),
      inclusivo = isTRUE(calc_bool(params$inclusive, TRUE)),
      minimo = NA_real_, maximo = NA_real_, ilegibles = ilegibles, zona = zona, variables = vars
    ))
  }
  ini <- params$inicio %||% list()
  fin <- params$fin %||% list()
  vars_de <- function(m) trimws(as.character(unlist(m$variables %||% list(), use.names = FALSE)))
  list(
    tipo = tipo, unidad = .regla_fechas_txt(params$unidad, "fecha"),
    patron = .regla_fechas_txt(params$patron, "orden"),
    a = .regla_fechas_momento(vars_de(ini), ini), b = .regla_fechas_momento(vars_de(fin), fin),
    desde = NA_character_, hasta = NA_character_, inclusivo = TRUE,
    minimo = .regla_fechas_num(params$minimo), maximo = .regla_fechas_num(params$maximo),
    ilegibles = ilegibles, zona = zona, variables = vars
  )
}

# Esquema de un momento.
.regla_fechas_validar_momento <- function(m, unidad, cual) {
  if (!(m$partes %in% .REGLA_FECHAS_PARTES[[unidad]])) {
    stop_api(400, "E_REGLA_FECHAS_PARTES",
             sprintf("En %s, las partes '%s' no valen para una %s. Válidas: %s.", cual, m$partes, unidad,
                     paste(.REGLA_FECHAS_PARTES[[unidad]], collapse = ", ")))
  }
  esperadas <- .REGLA_FECHAS_N_PARTES[[m$partes]]
  if (length(m$variables) != esperadas || any(is.na(m$variables) | !nzchar(m$variables))) {
    stop_api(400, "E_REGLA_FECHAS_PARTES",
             sprintf("En %s, '%s' lleva %d %s y llegaron %d.", cual, m$partes, esperadas,
                     if (esperadas == 1L) "pregunta" else "preguntas", length(m$variables)),
             details = list(partes = m$partes, esperadas = esperadas, recibidas = length(m$variables)))
  }
  if (identical(m$partes, "una")) {
    validos <- c("auto", if (identical(unidad, "hora")) .REGLA_FECHAS_FORMATOS_HORA else .REGLA_FECHAS_FORMATOS_FECHA)
    if (!(m$formato %in% validos)) {
      stop_api(400, "E_REGLA_FECHAS_FORMATO",
               sprintf("En %s, el formato '%s' no vale para una %s. Válidos: %s.", cual, m$formato, unidad,
                       paste(validos, collapse = ", ")))
    }
  }
  choque <- intersect(m$am, m$pm)
  if (length(choque)) {
    stop_api(400, "E_REGLA_FECHAS_PARTES",
             sprintf("En %s, el código %s no puede valer a.m. y p.m. a la vez.", cual, choque[1]))
  }
  invisible(TRUE)
}

#' Esquema de las reglas de fechas
#'
#' Se llama desde `.validar_regla_custom()` con la regla entera, después de las
#' validaciones de límites propias de `rango_fecha`.
#' @keywords internal
.regla_fechas_validar <- function(r) {
  p <- .regla_fechas_params(r)
  if (identical(p$tipo, "rango_fecha")) {
    .regla_fechas_validar_momento(p$a, "fecha", "la fecha")
    for (lim in c(p$desde, p$hasta)) {
      if (!is.na(lim) && !grepl("^[0-9]{4}-[0-9]{2}-[0-9]{2}$", lim)) {
        stop_api(400, "E_REGLA_FECHAS_FORMATO",
                 sprintf("El inicio y el cierre del operativo van como aaaa-mm-dd; llegó '%s'.", lim))
      }
    }
    return(invisible(TRUE))
  }
  if (!(p$unidad %in% c("fecha", "hora"))) {
    stop_api(400, "E_REGLA_FECHAS_PATRON", sprintf("Unidad '%s' no válida. Válidas: fecha, hora.", p$unidad))
  }
  if (!(p$patron %in% .REGLA_FECHAS_PATRONES)) {
    stop_api(400, "E_REGLA_FECHAS_PATRON",
             sprintf("Patrón '%s' no válido. Válidos: %s.", p$patron, paste(.REGLA_FECHAS_PATRONES, collapse = ", ")))
  }
  .regla_fechas_validar_momento(p$a, p$unidad, "el inicio")
  .regla_fechas_validar_momento(p$b, p$unidad, "el fin")
  esperadas <- c(p$a$variables, p$b$variables)
  if (!identical(p$variables, esperadas)) {
    stop_api(400, "E_REGLA_FECHAS_PARTES",
             "Las preguntas de la regla deben ser las del inicio seguidas de las del fin.",
             details = list(variables = as.list(p$variables), esperadas = as.list(esperadas)))
  }
  if (identical(p$patron, "duracion")) {
    mn <- p$minimo
    mx <- p$maximo
    crudo <- (r$params %||% list())[c("minimo", "maximo")]
    no_numero <- vapply(crudo, function(x) !is.null(x) && length(x) && !is.na(unlist(x)[1]) &&
                          nzchar(as.character(unlist(x)[1])) && is.na(.regla_fechas_num(x)), logical(1))
    if (any(no_numero)) {
      stop_api(400, "E_REGLA_FECHAS_DURACION", "El mínimo y el máximo de la duración deben ser números.")
    }
    if (is.na(mn) && is.na(mx)) {
      stop_api(400, "E_REGLA_FECHAS_DURACION", "La duración necesita un mínimo, un máximo o ambos.")
    }
    if (!is.na(mn) && !is.na(mx) && mn > mx) {
      stop_api(400, "E_REGLA_FECHAS_DURACION", "El mínimo de la duración no puede ser mayor que el máximo.",
               details = list(minimo = mn, maximo = mx))
    }
  }
  invisible(TRUE)
}

# --- Texto R y regla del motor ---------------------------------------------------

.regla_fechas_lit_momento <- function(m) {
  if (is.null(m)) return("list()")
  cols <- sprintf("list(%s)", paste(sprintf("`%s`", gsub("`", "\\\\`", m$variables)), collapse = ", "))
  sprintf("list(%s, %s, %s, %s, %s)", cols, deparse1(m$partes), deparse1(m$formato),
          deparse1(m$am), deparse1(m$pm))
}

# El texto R de la marca: la función de medida en línea aplicada a las
# columnas, por nombre.
.regla_expr_fechas <- function(r) {
  p <- .regla_fechas_params(r)
  fn <- paste(deparse(.regla_fechas_medir, width.cutoff = 500L), collapse = "\n")
  num <- function(x) if (is.na(x)) "NA" else format(x, scientific = FALSE)
  args <- c(.regla_fechas_lit_momento(p$a), .regla_fechas_lit_momento(p$b), deparse1(p$unidad),
            deparse1(p$patron), deparse1(p$desde), deparse1(p$hasta), if (p$inclusivo) "TRUE" else "FALSE",
            num(p$minimo), num(p$maximo), if (p$ilegibles) "TRUE" else "FALSE", deparse1(p$zona))
  sprintf("(%s)(%s)$marca", fn, paste(args, collapse = ", "))
}

# La regla del motor (puente de reglas propias). Todas las preguntas van en la
# regla: el motor exige que estén en la base y dice cuál falta.
.regla_fechas_rule <- function(r, gate, nombre, objetivo, severidad) {
  p <- .regla_fechas_params(r)
  out <- .rule_custom_raw_expr(
    vars = p$variables, expr = .regla_expr_fechas(r), gate = gate,
    tipo_regla = if (identical(p$tipo, "rango_fecha")) "range" else "coherence",
    nombre = nombre, objetivo = objetivo, severidad = severidad
  )
  sub <- if (identical(p$tipo, "rango_fecha")) "ventana_fecha" else paste0("fechas_", p$patron)
  out$presentation <- utils::modifyList(out$presentation %||% list(), list(subtipo_semantico = sub))
  out
}

# Mide filas sueltas de una tabla (todas, o las de `filas`) con la misma
# función que marca. Una pregunta que falta en la tabla se lee vacía; la regla
# ya la reporta como ausente en el motor.
.regla_fechas_medir_tabla <- function(df, r, filas = NULL) {
  p <- .regla_fechas_params(r)
  if (is.null(filas)) filas <- seq_len(nrow(df))
  momento <- function(m) {
    if (is.null(m)) return(list())
    cols <- lapply(m$variables, function(v) if (v %in% names(df)) df[[v]][filas] else rep(NA, length(filas)))
    list(cols, m$partes, m$formato, m$am, m$pm)
  }
  .regla_fechas_medir(momento(p$a), momento(p$b), p$unidad, p$patron, p$desde, p$hasta, p$inclusivo,
                      p$minimo, p$maximo, p$ilegibles, p$zona)
}

# --- Lectura: lo que se leyó con cada formato ---------------------------------

#' Cómo se leyeron las respuestas de una regla de fechas
#'
#' Base: todas las filas de la tabla que evalúa la auditoría (`n_filas` del
#' conteo previo), sin el filtro "Solo revisar cuando". Por momento: cuántas
#' se leyeron con cada formato, y cuántas quedaron vacías, incompletas o
#' ilegibles. Las cuatro cifras suman `n_filas`.
#'
#' @param df tabla evaluada.
#' @param r regla propia.
#' @return lista de momentos (`momento`, `variables`, `partes`, `formato`
#'   declarado, `formatos` leídos con su `n`, `n_leidas`, `n_vacias`,
#'   `n_incompletas`, `n_ilegibles`, `n_filas`).
#' @keywords internal
.regla_fechas_lectura <- function(df, r) {
  p <- .regla_fechas_params(r)
  med <- .regla_fechas_medir_tabla(df, r)
  resumen <- function(m, estado, formato, cual) {
    leidas <- formato[!is.na(estado) & estado == "leida"]
    tab <- sort(table(leidas), decreasing = TRUE)
    list(
      momento = cual, variables = as.list(m$variables), partes = m$partes, formato = m$formato,
      formatos = lapply(names(tab), function(f) list(formato = f, n = as.integer(tab[[f]]))),
      n_leidas = sum(estado == "leida", na.rm = TRUE),
      n_vacias = sum(estado == "vacia", na.rm = TRUE),
      n_incompletas = sum(estado == "incompleta", na.rm = TRUE),
      n_ilegibles = sum(estado == "ilegible", na.rm = TRUE),
      n_filas = length(estado)
    )
  }
  out <- list(resumen(p$a, med$a_estado, med$a_formato, if (is.null(p$b)) "fecha" else "inicio"))
  if (!is.null(p$b)) out[[2L]] <- resumen(p$b, med$b_estado, med$b_formato, "fin")
  out
}

# Lo medido en una fila, para el conteo previo.
.regla_fechas_resumen <- function(med, i, p) {
  lado <- function(pref) list(
    texto = med[[paste0(pref, "_texto")]][i],
    estado = med[[paste0(pref, "_estado")]][i],
    formato = med[[paste0(pref, "_formato")]][i],
    original = med[[paste0(pref, "_original")]][i]
  )
  out <- list(unidad = p$unidad, patron = p$patron, motivo = med$motivo[i], inicio = lado("a"),
              diferencia = med$diferencia[i])
  if (!is.null(p$b)) out$fin <- lado("b")
  out
}

# Un ejemplo del conteo previo: resalta las preguntas del momento que hace la
# marca (el ilegible, el que cae fuera, o los dos en orden y duración) y lleva
# lo medido.
.regla_fechas_ejemplo <- function(ejemplo, df, i, regla) {
  p <- .regla_fechas_params(regla)
  med <- .regla_fechas_medir_tabla(df, regla, i)
  mot <- med$motivo[1]
  culpables <- if (identical(mot, "ilegible")) {
    c(if (med$a_estado[1] %in% c("ilegible", "incompleta")) p$a$variables,
      if (!is.null(p$b) && med$b_estado[1] %in% c("ilegible", "incompleta")) p$b$variables)
  } else if (mot %in% c("antes", "despues")) {
    p$a$variables
  } else {
    c(p$a$variables, p$b$variables)
  }
  ejemplo$valores <- lapply(ejemplo$valores, function(v) {
    if (!identical(v$papel, "filtro")) v$falla <- v$variable %in% culpables
    v
  })
  ejemplo$fechas <- .regla_fechas_resumen(med, 1L, p)
  ejemplo
}

# --- Frase del catálogo ---------------------------------------------------------

# "08/10/2026": como se lee una fecha en es-PE.
.regla_fechas_mostrar <- function(iso) {
  d <- suppressWarnings(as.Date(as.character(iso), "%Y-%m-%d"))
  ifelse(is.na(d), as.character(iso), format(d, "%d/%m/%Y"))
}

.regla_fechas_unidad_txt <- function(unidad, valor) {
  uno <- !is.na(valor) && valor == 1
  if (identical(unidad, "hora")) if (uno) "minuto" else "minutos" else if (uno) "día" else "días"
}

# El momento en la frase: la pregunta, o "la fecha armada con D, M y A".
.vrf_fechas_momento <- function(m, unidad, ctx) {
  if (identical(m$partes, "una")) return(.vrf_q(m$variables[1], ctx))
  c(.vrf_t(if (identical(unidad, "hora")) "la hora armada con " else "la fecha armada con "),
    .vrf_lista_preguntas(m$variables, ctx))
}

#' Frase de una regla de fechas
#'
#' @param info lo que arma el catálogo (`propia` es la regla guardada).
#' @param ctx contexto de redacción.
#' @return fichas de la frase (sin el filtro).
#' @keywords internal
.vrf_frase_fechas <- function(info, ctx) {
  propia <- info$propia %||% list()
  p <- tryCatch(.regla_fechas_params(propia), error = function(e) NULL)
  incompleta <- function() {
    .vrf_marcar_incompleta(ctx)
    .vrf_t(.VRF_TEXTO_ILEGIBLE)
  }
  if (is.null(p) || !length(p$a$variables) || !nzchar(p$a$variables[1])) return(incompleta())
  out <- .vrf_t("Se marca cuando ")
  if (identical(p$tipo, "rango_fecha")) {
    if (is.na(p$desde) && is.na(p$hasta)) return(incompleta())
    out <- c(out, .vrf_fechas_momento(p$a, "fecha", ctx), .vrf_t(" "))
    if (!is.na(p$desde)) {
      out <- c(out, .vrf_t(if (p$inclusivo) "es anterior al " else "es igual o anterior al "),
               .vrf_v(.regla_fechas_mostrar(p$desde)))
    }
    if (!is.na(p$desde) && !is.na(p$hasta)) out <- c(out, .vrf_t(" o "))
    if (!is.na(p$hasta)) {
      out <- c(out, .vrf_t(if (p$inclusivo) "es posterior al " else "es igual o posterior al "),
               .vrf_v(.regla_fechas_mostrar(p$hasta)))
    }
    out <- c(out, .vrf_t("."))
    momentos <- list(p$a)
  } else {
    if (is.null(p$b) || !length(p$b$variables)) return(incompleta())
    ini <- .vrf_fechas_momento(p$a, p$unidad, ctx)
    fin <- .vrf_fechas_momento(p$b, p$unidad, ctx)
    if (identical(p$patron, "orden")) {
      out <- c(out, fin, .vrf_t(" es anterior a "), ini, .vrf_t("."))
    } else {
      if (is.na(p$minimo) && is.na(p$maximo)) return(incompleta())
      out <- c(out, .vrf_t("entre "), ini, .vrf_t(" y "), fin, .vrf_t(" pasan "))
      if (!is.na(p$minimo)) out <- c(out, .vrf_t("menos de "), .vrf_v(format(p$minimo, scientific = FALSE)))
      if (!is.na(p$minimo) && !is.na(p$maximo)) out <- c(out, .vrf_t(" o "))
      if (!is.na(p$maximo)) out <- c(out, .vrf_t("más de "), .vrf_v(format(p$maximo, scientific = FALSE)))
      ultimo <- if (!is.na(p$maximo)) p$maximo else p$minimo
      out <- c(out, .vrf_t(paste0(" ", .regla_fechas_unidad_txt(p$unidad, ultimo), ".")))
    }
    momentos <- list(p$a, p$b)
  }
  for (m in momentos) {
    if (identical(m$partes, "una") && !identical(m$formato, "auto")) {
      out <- c(out, .vrf_t(" "), .vrf_q(m$variables[1], ctx), .vrf_t(" se lee como "), .vrf_v(m$formato),
               .vrf_t("."))
    }
  }
  if (p$ilegibles) {
    armada <- any(vapply(momentos, function(m) !identical(m$partes, "una"), logical(1)))
    que <- if (identical(p$unidad, "hora")) "una hora" else "una fecha"
    out <- c(out, .vrf_t(sprintf(" También se marca %s %s.", que,
                                 if (armada) "incompleta o que no se puede leer" else "que no se puede leer")))
  }
  out
}

# Límites de una "Fecha fuera del operativo" para la ficha y el enunciado
# (antes salían del árbol `range_date`; ahora la regla es la función de medida).
.regla_fechas_limites <- function(propia) {
  p <- tryCatch(.regla_fechas_params(propia), error = function(e) NULL)
  if (is.null(p) || !identical(p$tipo, "rango_fecha")) return(NA)
  inc <- p$inclusivo
  list(tipo = "fecha", min = p$desde, max = p$hasta, inclusive = inc,
       inclusive_min = if (is.na(p$desde)) NA else inc, inclusive_max = if (is.na(p$hasta)) NA else inc,
       restriccion = NA_character_)
}

# --- Enunciado del hallazgo ------------------------------------------------------

# Contexto de fechas para el enunciado de un caso, o NULL si la regla no es de
# fechas. Una "Fecha fuera del operativo" sembrada como periodo de campo
# conserva su enunciado de procedencia.
.regla_fechas_contexto <- function(propia) {
  if (is.null(propia) || !.regla_fechas_es(propia)) return(NULL)
  if (identical(as.character((propia$semilla %||% list())$origen %||% "")[1], "periodo")) return(NULL)
  list(regla = propia)
}

.enun_fechas_rotulo <- function(m, unidad, regla) {
  rot <- vapply(m$variables, .enun_rotulo, character(1), regla = regla)
  if (identical(m$partes, "una")) return(rot[1])
  lista <- if (length(rot) == 2L) paste(rot, collapse = " y ") else
    paste0(paste(rot[-length(rot)], collapse = ", "), " y ", rot[length(rot)])
  sprintf("la %s armada con %s", unidad, lista)
}

# "13:45", "08/10/2026", o el original con su lectura: "\"15.10.28\" (15/10/2028)".
.enun_fechas_valor <- function(texto, original, m, unidad) {
  mostrado <- if (identical(unidad, "hora")) texto else .regla_fechas_mostrar(texto)
  if (identical(m$partes, "una") && !is.na(original) && !identical(original, mostrado)) {
    return(sprintf("\"%s\" (%s)", original, mostrado))
  }
  mostrado
}

#' Enunciado del caso marcado por una regla de fechas
#'
#' @param fechas contexto (`.regla_fechas_contexto()`).
#' @param valores valores del caso por pregunta.
#' @param regla contexto del enunciado (para los rótulos).
#' @return lista con `hecho`, `choque` y `medida` (lo medido en el caso).
#' @keywords internal
.regla_fechas_enunciado <- function(fechas, valores, regla = list()) {
  r <- fechas$regla
  p <- .regla_fechas_params(r)
  vars <- p$variables
  df <- as.data.frame(stats::setNames(lapply(vars, function(v) {
    x <- valores[[v]]
    if (is.null(x) || !length(x)) NA_character_ else as.character(x)[1]
  }), vars), stringsAsFactors = FALSE, check.names = FALSE)
  med <- .regla_fechas_medir_tabla(df, r, 1L)
  mot <- med$motivo[1]
  u <- p$unidad
  rot_a <- .enun_fechas_rotulo(p$a, u, regla)
  rot_b <- if (!is.null(p$b)) .enun_fechas_rotulo(p$b, u, regla) else ""
  val_a <- .enun_fechas_valor(med$a_texto[1], med$a_original[1], p$a, u)
  val_b <- if (!is.null(p$b)) .enun_fechas_valor(med$b_texto[1], med$b_original[1], p$b, u) else ""
  cantidad <- function(x) sprintf("%s %s", format(abs(x), scientific = FALSE), .regla_fechas_unidad_txt(u, abs(x)))
  out <- if (is.na(mot)) {
    list(hecho = "", choque = "")
  } else if (identical(mot, "ilegible")) {
    lado_a <- med$a_estado[1] %in% c("ilegible", "incompleta")
    m <- if (lado_a) p$a else p$b
    rot <- if (lado_a) rot_a else rot_b
    estado <- if (lado_a) med$a_estado[1] else med$b_estado[1]
    original <- if (lado_a) med$a_original[1] else med$b_original[1]
    if (identical(estado, "incompleta")) {
      list(hecho = sprintf("dejó incompleta %s", rot), choque = "")
    } else {
      como <- if (identical(m$partes, "una") && !identical(m$formato, "auto")) m$formato else
        if (identical(u, "hora")) "hora" else "fecha"
      list(hecho = sprintf("registró \"%s\" en %s", original, rot),
           choque = sprintf("que no se puede leer como %s", como))
    }
  } else if (identical(mot, "antes")) {
    list(hecho = sprintf("registró %s en %s", val_a, rot_a),
         choque = sprintf("anterior al inicio del operativo (%s)", .regla_fechas_mostrar(p$desde)))
  } else if (identical(mot, "despues")) {
    list(hecho = sprintf("registró %s en %s", val_a, rot_a),
         choque = sprintf("posterior al cierre del operativo (%s)", .regla_fechas_mostrar(p$hasta)))
  } else if (identical(mot, "orden")) {
    list(hecho = sprintf("registró %s en %s", val_b, rot_b),
         choque = sprintf("anterior a %s en %s", val_a, rot_a))
  } else {
    d <- med$diferencia[1]
    list(hecho = sprintf("pasaron %s entre %s (%s) y %s (%s)", cantidad(d), rot_a, val_a, rot_b, val_b),
         choque = if (identical(mot, "corta")) sprintf("menos que el mínimo de %s", cantidad(p$minimo))
                  else sprintf("más que el máximo de %s", cantidad(p$maximo)))
  }
  out$medida <- .regla_fechas_resumen(med, 1L, p)
  out
}

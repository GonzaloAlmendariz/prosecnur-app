# Duracion de una respuesta, para el analista de Monitoreo.
#
# Vive fuera de los motores de perfil porque el hecho es del pipeline, no del
# estudio de aulas: cualquier perfil que reciba una base con marcas de inicio y
# fin puede pedir la misma lectura. El perfil de aulas la consume aunque su
# propia base no las traiga, y por eso la funcion contesta SIEMPRE —con
# `disponible = FALSE` y su motivo— en vez de fallar: una superficie que sabe
# que no hay tiempos puede decirlo; una que no recibe nada, no.

# Columnas candidatas, en orden de preferencia. La lista es cerrada a
# proposito: un nombre que no este aqui no se adivina por parecido, porque
# `time_A_start` y compania son marcas de BLOQUE, no de la entrevista.
MONITOREO_TIEMPOS_INICIO <- c("start", "_start", "starttime", "inicio")
MONITOREO_TIEMPOS_FIN <- c("end", "_end", "endtime", "fin")

#' Que marcas de tiempo trae una base
#'
#' @param nombres Nombres de columna de la base.
#' @return Lista con `disponible`, `inicio`, `fin` y `motivo`.
monitoreo_tiempos_disponibilidad <- function(nombres) {
  nombres <- as.character(nombres %||% character(0))
  elegir <- function(cands) {
    hit <- cands[tolower(cands) %in% tolower(nombres)]
    if (length(hit)) nombres[tolower(nombres) == tolower(hit[1])][1] else NA_character_
  }
  inicio <- elegir(MONITOREO_TIEMPOS_INICIO)
  fin <- elegir(MONITOREO_TIEMPOS_FIN)
  motivo <- if (!is.na(inicio) && !is.na(fin)) {
    ""
  } else if (is.na(inicio) && is.na(fin)) {
    "La base no declara ni inicio ni fin de la entrevista."
  } else if (is.na(fin)) {
    "La base declara el inicio de la entrevista pero no su fin."
  } else {
    "La base declara el fin de la entrevista pero no su inicio."
  }
  list(
    disponible = !is.na(inicio) && !is.na(fin),
    inicio = inicio,
    fin = fin,
    motivo = motivo
  )
}

#' Instante a partir de un texto ISO 8601
#'
#' `strptime` no acepta el offset con dos puntos (`-05:00`) que escriben Kobo y
#' SurveyMonkey, y devuelve NA sin avisar. Medido en el estudio acnur_acg:
#' parsear sin normalizar daba mediana 0 min y colas en 1440 y 10080 —multiplos
#' exactos de un dia, la firma de estar comparando fechas sin hora—.
monitoreo_tiempos_instante <- function(x) {
  x <- as.character(x)
  x[!nzchar(trimws(x))] <- NA_character_
  x <- sub("([+-][0-9]{2}):([0-9]{2})$", "\\1\\2", x)
  con_zona <- grepl("([+-][0-9]{4}|Z)$", x)
  fuera <- as.POSIXct(rep(NA_real_, length(x)), origin = "1970-01-01", tz = "UTC")
  if (any(con_zona, na.rm = TRUE)) {
    fuera[which(con_zona)] <- as.POSIXct(
      sub("Z$", "+0000", x[which(con_zona)]),
      format = "%Y-%m-%dT%H:%M:%OS%z", tz = "UTC"
    )
  }
  sin_zona <- !con_zona & !is.na(x)
  if (any(sin_zona)) {
    fuera[which(sin_zona)] <- as.POSIXct(
      x[which(sin_zona)],
      format = "%Y-%m-%dT%H:%M:%OS", tz = "UTC"
    )
  }
  fuera
}

#' Duracion en minutos de cada respuesta
#'
#' @return Vector numerico con la duracion; NA donde no se puede calcular.
monitoreo_tiempos_por_respuesta <- function(df, disponibilidad = NULL) {
  disponibilidad <- disponibilidad %||% monitoreo_tiempos_disponibilidad(names(df))
  if (!isTRUE(disponibilidad$disponible)) return(numeric(0))
  inicio <- monitoreo_tiempos_instante(df[[disponibilidad$inicio]])
  fin <- monitoreo_tiempos_instante(df[[disponibilidad$fin]])
  as.numeric(difftime(fin, inicio, units = "mins"))
}

#' Como se reparten las duraciones
#'
#' No se recorta la cola ni se sustituye por un tope: se cuenta aparte. En
#' acnur_acg la mediana es 14.1 min y el maximo 10 260 —siete dias— porque hay
#' entrevistas que quedaron abiertas; taparlas con un winsorizado dejaria la
#' misma mediana y escondaria justo el caso que hay que revisar.
#'
#' @param minutos Duraciones en minutos.
#' @param cola_min Minutos por encima de los cuales una respuesta se cuenta como
#'   cola larga. Sin declarar no juzga: solo describe.
monitoreo_tiempos_resumen <- function(minutos, cola_min = NA_real_) {
  minutos <- as.numeric(minutos)
  finitos <- is.finite(minutos)
  negativas <- sum(finitos & minutos < 0)
  validas <- minutos[finitos & minutos >= 0]
  n <- length(validas)
  cuantil <- function(p) if (n) unname(round(stats::quantile(validas, p, names = FALSE), 2)) else NA_real_
  larga <- if (is.finite(cola_min) && n) sum(validas > cola_min) else NA_integer_
  list(
    n = n,
    sin_dato = sum(!finitos),
    negativas = negativas,
    minimo = cuantil(0),
    p05 = cuantil(0.05),
    p25 = cuantil(0.25),
    mediana = cuantil(0.5),
    p75 = cuantil(0.75),
    p95 = cuantil(0.95),
    maximo = cuantil(1),
    cola_min = if (is.finite(cola_min)) cola_min else NA_real_,
    cola_larga = larga
  )
}

#' Banda de la mediana por orden estadistico
#'
#' La mediana de un grupo de 20 respuestas no se puede comparar con la de otro
#' de 300 como si fueran el mismo dato. La banda sale de los ordenes
#' estadisticos —exacta, sin suponer normalidad y sin dependencias nuevas—: con
#' `n` observaciones, el intervalo va del k-esimo valor ordenado al (n-k+1), con
#' `k = qbinom(alpha/2, n, 0.5)`.
#'
#' Con menos de `minimo_n` observaciones no se devuelve banda: un intervalo
#' calculado sobre cuatro casos abarca casi todo el rango y da una precision que
#' no existe.
monitoreo_tiempos_banda_mediana <- function(x, conf = 0.95, minimo_n = 5) {
  x <- sort(as.numeric(x[is.finite(x)]))
  n <- length(x)
  if (n < minimo_n) return(list(inferior = NA_real_, superior = NA_real_, n = n))
  alpha <- 1 - conf
  k <- stats::qbinom(alpha / 2, n, 0.5)
  if (k < 1) k <- 1
  list(inferior = x[k], superior = x[n - k + 1], n = n)
}

#' Duracion por grupo, con su banda
#'
#' El grupo lo declara quien llama —aula, aplicador, jornada, distrito— porque
#' no todas las bases traen las mismas columnas: `acnur_acg` no tiene ni una de
#' aplicador (`_submitted_by` viene vacio en sus 1 283 filas) y si tiene
#' distrito y jornada. Adivinar el agrupador produciria un «por aplicador» que
#' en realidad agrupa por otra cosa.
#'
#' `destaca` es TRUE cuando la banda del grupo **no contiene** la mediana del
#' resto de la muestra: es la unica lectura que distingue una diferencia real de
#' la variacion esperable. Un grupo sin banda —pocos casos— nunca destaca, y se
#' reconoce por `n_bajo`.
monitoreo_tiempos_por_grupo <- function(minutos, grupo, conf = 0.95, minimo_n = 5) {
  minutos <- as.numeric(minutos)
  grupo <- as.character(grupo)
  if (length(grupo) != length(minutos)) {
    stop("`grupo` y `minutos` tienen que traer una entrada por respuesta")
  }
  usable <- is.finite(minutos) & minutos >= 0 & !is.na(grupo) & nzchar(grupo)
  minutos <- minutos[usable]
  grupo <- grupo[usable]
  claves <- sort(unique(grupo))
  filas <- lapply(claves, function(g) {
    dentro <- minutos[grupo == g]
    fuera <- minutos[grupo != g]
    banda <- monitoreo_tiempos_banda_mediana(dentro, conf = conf, minimo_n = minimo_n)
    referencia <- if (length(fuera)) stats::median(fuera) else NA_real_
    destaca <- is.finite(banda$inferior) && is.finite(referencia) &&
      (referencia < banda$inferior || referencia > banda$superior)
    data.frame(
      grupo = g,
      n = length(dentro),
      n_bajo = length(dentro) < minimo_n,
      mediana = round(stats::median(dentro), 2),
      banda_inf = round(banda$inferior, 2),
      banda_sup = round(banda$superior, 2),
      mediana_resto = if (is.finite(referencia)) round(referencia, 2) else NA_real_,
      destaca = destaca,
      stringsAsFactors = FALSE
    )
  })
  if (!length(filas)) {
    return(data.frame(
      grupo = character(0), n = integer(0), n_bajo = logical(0),
      mediana = numeric(0), banda_inf = numeric(0), banda_sup = numeric(0),
      mediana_resto = numeric(0), destaca = logical(0), stringsAsFactors = FALSE
    ))
  }
  fuera <- do.call(rbind, filas)
  fuera[order(fuera$mediana), , drop = FALSE]
}

# Que es un aula VALIDA en este estudio, dicho por el estudio.
#
# Hasta aqui la app no lo sabia: se lo creia al Excel. `monitoreo_aulas_control_umbral()`
# lee primero el veredicto que el equipo escribio en su hoja y, si no lo entiende,
# compara contra el umbral que la propia hoja calculo. Las dos ramas vienen del
# libro, asi que **la aplicacion no tenia criterio propio de aula valida**.
#
# Gonzalo: «ni siquiera hemos definido si un aula es valida al 70 % o no».
#
# La asimetria que lo delata: el criterio de RESPUESTA valida SI se declara en la
# app —`cfg$source_mapping$valid_filters`, y el motor lo resuelve— mientras que el
# de AULA valida no existia en ninguna parte.
#
# Esto NO reemplaza al veredicto de la hoja: lo pone al lado. El equipo decide
# con su formula y la app calcula la suya con el criterio declarado; donde las
# dos difieren, eso es lo que hay que mirar. Sustituir uno por otro seria
# cambiar de dueño la decision sin que nadie lo pida.

#' El criterio de aula valida que declara el estudio.
#'
#' @param cfg config de aulas.
#' @return `NULL` si no se declaro, o lista con `umbral` (0-1) y `exige`.
#' @export
monitoreo_aulas_criterio_aula <- function(cfg = list()) {
  decl <- cfg$aula_valida %||% list()
  if (!length(decl)) return(NULL)
  modo <- tolower(.monitoreo_scalar(decl$modo %||% decl$mode, ""))
  # **El modo que el estudio deberia usar**: cada aula contra lo que el DISEÑO
  # esperaba de ella, no contra una proporcion igual para todas.
  #
  # El calculo de muestra publica `efectivas_esperadas` por curso-horario
  # —elegibles x P(aplicada | tipo de docente) x rendimiento(tamaño), calibrado
  # con el 2025 ejecutado— y en el marco 2026 va de **5,8 a 34,8 encuestas por
  # aula**. Una vara fija ignora esa variacion entera: pide lo mismo a un aula
  # chica de docente contratado que a una grande de ordinario.
  #
  # Gonzalo: «si en un aula no se llega a lo que se esperaba, lo logico es que
  # se tenga que ir a otra aula para suplir aquello que falto».
  if (identical(modo, "esperado")) {
    alfa <- suppressWarnings(as.numeric(.monitoreo_scalar(decl$alfa %||% decl$alpha, "")))
    if (!length(alfa) || !is.finite(alfa) || alfa <= 0) return(NULL)
    if (alfa > 1) alfa <- alfa / 100
    if (alfa > 1) return(NULL)
    return(list(modo = "esperado", alfa = alfa))
  }
  umbral <- suppressWarnings(as.numeric(.monitoreo_scalar(decl$umbral %||% decl$threshold, "")))
  if (!length(umbral) || !is.finite(umbral) || umbral <= 0) return(NULL)
  # Se acepta «70» y «0.7»: el usuario escribe el porcentaje que dice en voz alta
  # y la config de otro estudio puede traer la proporcion.
  if (umbral > 1) umbral <- umbral / 100
  if (umbral > 1) return(NULL)
  exige <- tolower(.monitoreo_scalar(decl$exige %||% decl$requires, "ambos"))
  if (!exige %in% c("ambos", "asistentes", "matriculados")) exige <- "ambos"
  list(modo = "proporcion", umbral = umbral, exige = exige)
}

.mca_num <- function(valor) {
  if (is.null(valor) || !length(valor)) return(NA_real_)
  v <- suppressWarnings(as.numeric(valor[[1]]))
  if (length(v) != 1L || !is.finite(v)) NA_real_ else v
}

#' El veredicto de la app para un aula, con el criterio declarado.
#'
#' @param fila fila de «Base de control».
#' @param criterio lo que devuelve `monitoreo_aulas_criterio_aula()`.
#' @return lista con `asistentes`, `matriculados` y `efectiva` (`TRUE`/`FALSE`/`NA`).
#' @export
monitoreo_aulas_veredicto_propio <- function(fila, criterio, meta = NA_real_) {
  vacio <- list(asistentes = NA, matriculados = NA, efectiva = NA)
  if (is.null(criterio) || !is.list(fila)) return(vacio)
  enviadas <- .mca_num(fila$sent_total)
  if (!is.finite(enviadas)) return(vacio)
  if (identical(criterio$modo, "esperado")) {
    m <- .mca_num(meta)
    # Sin meta del diseño no se juzga: el aula no falla, es que no hay vara.
    # Caer aqui a una proporcion inventada seria justo lo que este modo viene a
    # quitar.
    if (!is.finite(m) || m <= 0) return(vacio)
    llega <- enviadas >= criterio$alfa * m
    return(list(asistentes = NA, matriculados = NA, efectiva = llega))
  }
  # Los dos denominadores del operativo, cada uno con su nombre en la hoja:
  # asistentes es quien estaba en el aula, matriculados es quien podia estar.
  asistentes <- .mca_num(fila$observed_students)
  matriculados <- .mca_num(fila$eligible_n)
  # Un denominador en cero no da tasa: no es que el aula falle, es que no hay
  # con que medirla. Decir FALSE ahi seria acusarla por un hueco de la hoja.
  tasa <- function(den) if (is.finite(den) && den > 0) enviadas / den else NA_real_
  cumple <- function(t) if (is.na(t)) NA else t >= criterio$umbral
  a <- cumple(tasa(asistentes))
  m <- cumple(tasa(matriculados))
  efectiva <- switch(criterio$exige,
    asistentes = a,
    matriculados = m,
    # `ambos`: si alguno queda indeterminado, la efectividad tambien —no se
    # resuelve a FALSE, que seria acusar a un aula de no llegar cuando lo que
    # pasa es que nadie la midio. Es la misma regla que ya usa `efectiva` con el
    # veredicto de la hoja.
    if (is.na(a) || is.na(m)) NA else (a && m)
  )
  list(asistentes = a, matriculados = m, efectiva = efectiva)
}

#' Donde el veredicto de la app y el de la hoja no coinciden.
#'
#' @param filas filas publicadas del control, con `cumple_total`/`cumple_poblacion`.
#' @param criterio el criterio declarado.
#' @return lista con `comparadas`, `discrepan` y las primeras filas discrepantes.
#' @export
monitoreo_aulas_contraste_veredicto <- function(filas = list(), criterio = NULL) {
  if (is.null(criterio) || !length(filas)) {
    return(list(declarado = FALSE, comparadas = 0L, discrepan = 0L, casos = list()))
  }
  comparadas <- 0L
  casos <- list()
  for (f in filas) {
    if (!is.list(f)) next
    # La meta viaja en la propia fila cuando el plan se cruzo antes; si no, el
    # modo «esperado» deja el aula sin juzgar en vez de inventarle una vara.
    propio <- monitoreo_aulas_veredicto_propio(f, criterio, .mca_num(f$expected_valid))
    hoja <- f$efectiva
    hoja <- if (is.null(hoja) || !length(hoja) || is.na(hoja[[1]])) NA else as.logical(hoja[[1]])
    # Solo se comparan las que las DOS resolvieron: una indeterminada no
    # discrepa de nada, y contarla como discrepancia inflaria el hallazgo con
    # huecos de la hoja.
    if (is.na(propio$efectiva) || is.na(hoja)) next
    comparadas <- comparadas + 1L
    if (!identical(propio$efectiva, hoja)) {
      casos[[length(casos) + 1L]] <- list(
        operational_code = .monitoreo_scalar(f$operational_code %||% "", ""),
        segun_la_app = propio$efectiva,
        segun_la_hoja = hoja
      )
    }
  }
  list(
    declarado = TRUE,
    modo = criterio$modo,
    umbral = criterio$umbral,
    alfa = criterio$alfa,
    exige = criterio$exige,
    comparadas = comparadas,
    discrepan = length(casos),
    casos = utils::head(casos, 10L)
  )
}

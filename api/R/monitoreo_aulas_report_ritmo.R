# El RITMO del campo, tal como se le cuenta a un cliente.
#
# La serie diaria ya existe: `.calad_avance_diario()` arma una fila por facultad
# y día para la hoja «Avance de campo». Pero esa tabla tiene once columnas y
# CUATRO son de rendimiento —efectivas esperadas, diferencia, las dos tasas y su
# brecha—, que son internas (Gonzalo, 2026-09-11: «lo relacionado con rendimiento
# y todo lo demás es interno, lo que a ellos les importa es el avance en sí
# mismo»). Este archivo se queda con las tres que sí son avance —día, lo que
# entró ese día y el acumulado— y las deja listas para dibujar.
#
# **Por qué el eje de días es COMÚN a todas las facultades.** Los paneles por
# facultad se leen comparándolos, y si cada uno usara sólo sus propios días, dos
# paneles contiguos tendrían escalas de tiempo distintas y la misma pendiente
# significaría cosas distintas. Un día sin aplicación es una barra en cero y una
# línea plana, que es exactamente lo que pasó; no es un hueco.

.marr_num <- function(x, default = NA_real_) {
  v <- suppressWarnings(as.numeric(x))
  if (!length(v) || !is.finite(v[[1L]])) default else v[[1L]]
}

#' Serie de avance diario lista para el PDF de cliente.
#'
#' @param diario `data.frame` de `.calad_avance_diario()` (una fila por facultad
#'   y día), o `NULL`.
#' @param facultades tabla de `.calaf_avance_por_facultad()`, de la que salen las
#'   metas de cada facultad.
#' @return `NULL` si no hay serie; si la hay, una lista con `dias` (ISO, el eje
#'   común), `dias_semana`, `total` (`data.frame` con `efectivas` y `acumulado`),
#'   `meta` y `facultades` (una entrada por facultad, en el orden de la tabla).
#' @keywords internal
monitoreo_aulas_ritmo_de_avance <- function(diario, facultades = NULL) {
  if (!is.data.frame(diario) || !nrow(diario)) return(NULL)
  necesarias <- c("Facultad", "Día", "Efectivas del día")
  if (!all(necesarias %in% names(diario))) return(NULL)

  dias <- sort(unique(as.character(diario[["Día"]])))
  if (!length(dias)) return(NULL)
  dia_semana <- vapply(dias, function(d) {
    fila <- which(as.character(diario[["Día"]]) == d)[[1L]]
    if ("Día de la semana" %in% names(diario)) {
      as.character(diario[["Día de la semana"]][[fila]])
    } else ""
  }, character(1), USE.NAMES = FALSE)

  del_dia <- vapply(seq_len(nrow(diario)), function(i) .marr_num(diario[["Efectivas del día"]][[i]], 0), numeric(1))
  fac_fila <- as.character(diario[["Facultad"]])

  serie_de <- function(filas) {
    v <- vapply(dias, function(d) {
      sel <- filas[as.character(diario[["Día"]][filas]) == d]
      if (!length(sel)) 0 else sum(del_dia[sel], na.rm = TRUE)
    }, numeric(1), USE.NAMES = FALSE)
    data.frame(dia = dias, dia_semana = dia_semana, efectivas = v,
               acumulado = cumsum(v), stringsAsFactors = FALSE)
  }

  total <- serie_de(seq_len(nrow(diario)))

  # Las metas salen de la MISMA tabla que la del PDF y la de la hoja: aquí no se
  # recalcula ninguna cuota.
  meta_de <- function(nombre) {
    if (!is.data.frame(facultades) || !nrow(facultades) || !("Facultad" %in% names(facultades))) {
      return(list(muestra = NA_real_, sobremuestra = NA_real_))
    }
    fila <- which(as.character(facultades[["Facultad"]]) == nombre)
    if (!length(fila)) return(list(muestra = NA_real_, sobremuestra = NA_real_))
    list(
      muestra = .marr_num(facultades[["Muestra"]][[fila[[1L]]]]),
      sobremuestra = if ("Sobremuestra" %in% names(facultades)) {
        .marr_num(facultades[["Sobremuestra"]][[fila[[1L]]]])
      } else NA_real_
    )
  }

  # El orden es el de la tabla de facultades —el mismo que ve en la hoja y en la
  # tabla del PDF—; las que no aparecen allí van después, por nombre.
  nombres <- unique(fac_fila)
  if (is.data.frame(facultades) && "Facultad" %in% names(facultades)) {
    orden <- as.character(facultades[["Facultad"]])
    nombres <- c(orden[orden %in% nombres], sort(setdiff(nombres, orden)))
  } else {
    nombres <- sort(nombres)
  }

  paneles <- lapply(nombres, function(nombre) {
    m <- meta_de(nombre)
    list(facultad = nombre, serie = serie_de(which(fac_fila == nombre)),
         meta = m$muestra, sobremuestra = m$sobremuestra)
  })

  suma_meta <- function(col) {
    if (!is.data.frame(facultades) || !(col %in% names(facultades))) return(NA_real_)
    v <- sum(suppressWarnings(as.numeric(facultades[[col]])), na.rm = TRUE)
    if (is.finite(v) && v > 0) v else NA_real_
  }

  list(
    dias = dias,
    dias_semana = dia_semana,
    total = total,
    meta = suma_meta("Muestra"),
    sobremuestra = suma_meta("Sobremuestra"),
    facultades = paneles
  )
}

# --- Los defectos de la portada ---------------------------------------------

#' Nombre del estudio, para el subtítulo de la portada.
#' @keywords internal
.marp_nombre_del_estudio <- function(cfg) {
  nombre <- ""
  for (k in c("study_name", "estudio", "nombre_estudio", "display_name")) {
    v <- cfg[[k]] %||% ""
    if (length(v) && nzchar(trimws(as.character(v)[[1L]]))) {
      nombre <- trimws(as.character(v)[[1L]]); break
    }
  }
  if (nzchar(nombre)) nombre else "Monitoreo de cursos-horario"
}

#' «Del 8 al 11 de septiembre de 2026», a partir del eje de días del ritmo.
#' @keywords internal
.marp_periodo_de_campo <- function(ritmo) {
  dias <- ritmo$dias %||% character(0)
  if (!length(dias)) return("")
  f <- suppressWarnings(as.Date(dias))
  f <- f[!is.na(f)]
  if (!length(f)) return("")
  desde <- min(f); hasta <- max(f)
  mes <- function(d) .marr_MESES[[as.integer(format(d, "%m"))]]
  if (identical(desde, hasta)) {
    return(sprintf("%s de %s de %s", format(desde, "%d"), mes(desde), format(desde, "%Y")))
  }
  if (identical(format(desde, "%Y-%m"), format(hasta, "%Y-%m"))) {
    sprintf("Del %s al %s de %s de %s", format(desde, "%d"), format(hasta, "%d"),
            mes(hasta), format(hasta, "%Y"))
  } else {
    sprintf("Del %s de %s al %s de %s de %s", format(desde, "%d"), mes(desde),
            format(hasta, "%d"), mes(hasta), format(hasta, "%Y"))
  }
}

.marr_MESES <- c("enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
                 "agosto", "septiembre", "octubre", "noviembre", "diciembre")

#' La fecha de corte en castellano, desde el sello ISO del snapshot.
#' @keywords internal
.marp_corte_legible <- function(synced_at) {
  txt <- trimws(as.character(synced_at %||% "")[[1L]] %||% "")
  if (!nzchar(txt) || is.na(txt)) return("")
  ts <- suppressWarnings(as.POSIXct(sub("Z$", "", txt), format = "%Y-%m-%dT%H:%M:%S", tz = "UTC"))
  if (is.na(ts)) {
    f <- suppressWarnings(as.Date(substr(txt, 1L, 10L)))
    if (is.na(f)) return("")
    return(sprintf("%s de %s de %s", format(f, "%d"), .marr_MESES[[as.integer(format(f, "%m"))]], format(f, "%Y")))
  }
  # **Sólo el día, sin la hora** (Gonzalo, 2026-09-11). La hora del sello importa
  # dentro del operativo —hay días con dos cortes— pero a quien recibe el
  # documento no le dice nada que el día no diga ya, y una portada con «11:01 h»
  # se lee como una precisión que promete más de lo que el dato tiene.
  # La zona horaria SÍ se aplica antes de quedarse con el día: un sello de las
  # 02:00 UTC es todavía la víspera en Lima, y sin convertir el corte saldría
  # fechado un día después del que fue.
  f <- as.Date(format(ts, tz = "America/Lima", usetz = FALSE))
  sprintf("%s de %s de %s", format(f, "%d"),
          .marr_MESES[[as.integer(format(f, "%m"))]], format(f, "%Y"))
}

#' Cursos-horario titulares por facultad, con el nombre de la facultad por clave.
#'
#' Sólo TITULARES: el plan lleva dentro el banco de reservas, y contarlo entero
#' multiplica por veinticinco el operativo que se está informando.
#' @keywords internal
.marp_titulares_por_facultad <- function(plan) {
  plan <- plan %||% list()
  if (!length(plan)) return(stats::setNames(numeric(0), character(0)))
  es_titular <- vapply(plan, function(u) identical(.cai_txt(u$sample_role), "titular"), logical(1))
  fac <- vapply(plan, function(u) .cai_txt(u$faculty), character(1))
  fac <- fac[es_titular]
  if (!length(fac)) return(stats::setNames(numeric(0), character(0)))
  tb <- table(fac)
  stats::setNames(as.numeric(tb), names(tb))
}

# --- El plan del documento ---------------------------------------------------
#
# Qué secciones lleva el reporte y cuántas hojas ocupa cada una. Existe por dos
# motivos que son el mismo: el folio «03 / 09» necesita el total ANTES de dibujar
# la primera página, y hasta ahora ese total se sumaba a mano en el renderizador
# —una expresión de seis sumandos que había que mantener sincronizada con el
# bucle que dibuja—. Es la duplicación que ya ha producido cuatro defectos en
# este mismo documento: un valor que gobierna el comportamiento, escrito dos
# veces, con una copia que envejece sola.
#
# Declarado aquí, además, el documento se puede COMPROBAR sin renderizarlo: un
# test afirma el plan y contrasta que el PDF salga con esas páginas. Sin esto, la
# única forma de verificar la composición era abrir el archivo y contar, que es
# lo que se ha hecho toda la tarde con runners que mueren con la sesión.

#' Secciones del reporte de avance y hojas de cada una.
#'
#' @param model salida de `build_monitoreo_aulas_report_model()`.
#' @param hojas_detalle cuántas hojas de detalle por meta (1 sin sobremuestra, 2
#'   con ella) y `paginas_detalle` cuántas páginas ocupa cada una.
#' @return `data.frame` con `seccion` y `hojas`, en el orden en que se imprimen.
#'   La portada NO entra: no lleva folio, y contarla desplazaría el numerador de
#'   todas las demás.
#' @keywords internal
monitoreo_aulas_plan_del_documento <- function(model, hojas_detalle = 1L,
                                               paginas_detalle = 1L) {
  ritmo <- model$ritmo
  hay_ritmo <- is.list(ritmo) && is.data.frame(ritmo$total) && nrow(ritmo$total) > 0L
  n_paneles <- if (hay_ritmo) length(ritmo$facultades %||% list()) else 0L
  n_fac <- if (is.data.frame(model$facultades)) nrow(model$facultades) else 0L

  secciones <- list(
    list("Resumen del avance", 1L),
    list("Ritmo del campo", if (hay_ritmo) 1L else 0L),
    list("Ritmo de cada facultad",
         if (n_paneles > 1L) .marp_rejilla_de_paneles(n_paneles)$hojas else 0L),
    list("Metas por facultad", 1L),
    list("Avance por facultad y sexo", .marp_reparto_avance(n_fac)$hojas),
    list("Detalle por facultad",
         as.integer(hojas_detalle) * as.integer(paginas_detalle))
  )
  secciones <- Filter(function(s) s[[2L]] > 0L, secciones)
  data.frame(
    seccion = vapply(secciones, function(s) s[[1L]], character(1)),
    hojas = vapply(secciones, function(s) as.integer(s[[2L]]), integer(1)),
    stringsAsFactors = FALSE
  )
}

# El documento de los aplicadores, de ida y de vuelta.
#
# `monitoreo_aulas_publicar_distribucion()` escribe la distribución a un Sheets
# que el lead crea a mano en Drive y pega en la app. Eso deja dos huecos que
# Gonzalo señaló al cerrar el día 1: **crear ese documento desde la app**, y
# **poder leerlo** para saber si lo que los veintidós están mirando sigue siendo
# el reparto vigente.
#
# El segundo importa más de lo que parece. El documento es de solo lectura para
# ellos, pero el reparto de la app cambia —una baja, un reemplazo, una cita que
# se mueve— y nada avisaba de que el Sheets compartido se había quedado atrás.
# La `huella` que la config guarda dice si el REPARTO cambió desde la última
# publicación; esto dice lo otro: qué hay de verdad en el documento remoto.

#' Crea el Sheets de la distribución, con su pestaña ya puesta.
#'
#' El scope `spreadsheets` de la conexión ya permite crear, y `drive.file` da
#' acceso a lo que la app crea: no hace falta un permiso nuevo. El documento
#' nace vacío y con la única pestaña que el motor publica, así que la primera
#' publicación no tiene que crearla.
#'
#' **No comparte el documento con nadie.** Quien lo crea es el dueño y el enlace
#' se reparte desde Drive con permiso de lectura, que es una decisión del lead
#' y no del motor: repartir accesos automáticamente sería dar acceso a datos del
#' operativo sin que nadie lo decidiera.
#'
#' @param titulo nombre del documento en Drive.
#' @return lista `{ok, spreadsheet_id, url, titulo}`.
#' @export
monitoreo_aulas_crear_distribucion <- function(titulo = "") {
  titulo <- .monitoreo_scalar(titulo, "")
  if (!nzchar(titulo)) titulo <- "Distribución de aplicadores"
  creado <- tryCatch(
    .monitoreo_google_api(
      "https://sheets.googleapis.com/v4/spreadsheets",
      method = "POST",
      body = list(
        properties = list(title = titulo, locale = "es_PE"),
        sheets = list(list(properties = list(title = .mapd_hoja())))
      )
    ),
    error = function(e) {
      stop_api(502, "E_GOOGLE_SHEETS",
               paste("No se pudo crear el Sheets de la distribución:", conditionMessage(e)))
    }
  )
  id <- .monitoreo_scalar(creado$spreadsheetId, "")
  if (!nzchar(id)) {
    stop_api(502, "E_GOOGLE_SHEETS",
             "Google creó el documento pero no devolvió su identificador.")
  }
  list(
    ok = TRUE,
    spreadsheet_id = id,
    url = paste0("https://docs.google.com/spreadsheets/d/", id, "/edit"),
    titulo = titulo
  )
}

# La clave de una cita en la hoja de los aplicadores: el curso-horario y el día.
# Un mismo curso-horario puede aparecer dos veces si se reagenda, y un mismo día
# tiene muchos; el par identifica la fila.
.madc_clave <- function(fila, col_codigo, col_fecha) {
  paste(
    trimws(as.character(fila[[col_codigo]] %||% "")),
    trimws(as.character(fila[[col_fecha]] %||% "")),
    sep = "\r"
  )
}

.madc_valores <- function(fila, n) {
  v <- as.character(unlist(fila %||% list(), use.names = FALSE))
  v <- trimws(v)
  length(v) <- n
  v[is.na(v)] <- ""
  v
}

#' Lee el Sheets de la distribución y lo compara con el reparto vigente.
#'
#' Contesta la pregunta del operativo —**¿lo que están viendo los aplicadores es
#' el reparto de ahora?**— y, cuando no lo es, dice en qué se diferencian: qué
#' citas faltan por publicar, cuáles siguen publicadas y ya no existen, y cuáles
#' cambiaron de aplicador o de hora.
#'
#' No escribe nada. Un documento que no se deja leer se declara con su error, y
#' una pestaña ajena —la vieja «Asignación de aplicadores» que quedó de la
#' primera versión— se nombra en vez de tocarse: el motor publica UNA hoja y lo
#' que alguien haya añadido no es suyo.
#'
#' @param spreadsheet_id id o enlace del documento.
#' @param filas lo que el motor publicaría AHORA (`aulas_libro_filas_plan_aplicadores()`);
#'   `NULL` cuando no hay disponibilidad y entonces sólo se lee.
#' @return lista `{ok, spreadsheet_id, url, titulo, hoja, citas_remotas, citas_ahora,
#'   coincide, faltan, sobran, cambiadas, pestanas_ajenas}`.
#' @export
monitoreo_aulas_leer_distribucion <- function(spreadsheet_id, filas = NULL) {
  id <- .monitoreo_extract_spreadsheet_id(spreadsheet_id)
  if (!nzchar(id)) {
    stop_api(400, "E_SHEETS_SPREADSHEET",
             "El enlace no parece de Google Sheets: no trae el identificador del documento.")
  }
  meta <- tryCatch(.monitoreo_sheets_metadata(id), error = function(e) {
    stop_api(502, "E_GOOGLE_SHEETS",
             paste("No se pudo leer el Sheets de la distribución:", conditionMessage(e)))
  })
  titulos <- vapply(meta$sheets %||% list(), function(h) {
    .monitoreo_scalar((h$properties %||% list())$title, "")
  }, character(1))
  hay_hoja <- .mapd_hoja() %in% titulos

  remoto <- if (!hay_hoja) list() else tryCatch(
    .cads_valores_de_pestana(id, .mapd_hoja()),
    error = function(e) list()
  )

  cab <- if (length(remoto)) .madc_valores(remoto[[1]], length(.alpa_CABECERA)) else character(0)
  # Se localiza por RÓTULO porque es lo único que el documento remoto tiene: no
  # hay spec del otro lado. Si la cabecera no trae las dos columnas clave, no se
  # compara nada y se dice —comparar por posición sobre un documento que alguien
  # pudo reordenar produciría diferencias inventadas.
  col_codigo <- which(cab == "CURSO-HORARIO")
  col_fecha <- which(cab == "FECHA")
  legible <- length(col_codigo) == 1L && length(col_fecha) == 1L

  filas_remotas <- if (length(remoto) > 1L) remoto[-1L] else list()
  n <- length(.alpa_CABECERA)
  mapa_remoto <- list()
  if (legible) {
    for (f in filas_remotas) {
      v <- .madc_valores(f, n)
      k <- .madc_clave(v, col_codigo, col_fecha)
      if (nzchar(trimws(gsub("\r", "", k)))) mapa_remoto[[k]] <- v
    }
  }

  # Lo que el motor publicaría ahora, con la MISMA clave.
  filas_ahora <- if (is.null(filas) || !length(filas)) list() else filas[-1L]
  mapa_ahora <- list()
  ic <- which(.alpa_CABECERA == "CURSO-HORARIO")
  if_ <- which(.alpa_CABECERA == "FECHA")
  for (f in filas_ahora) {
    v <- .madc_valores(f, n)
    k <- .madc_clave(v, ic, if_)
    if (nzchar(trimws(gsub("\r", "", k)))) mapa_ahora[[k]] <- v
  }

  legible_ambos <- legible && length(filas_ahora) > 0L
  # Sólo se comparan las columnas que las dos partes tienen en el mismo sitio.
  comparables <- if (legible_ambos) which(cab == .alpa_CABECERA & nzchar(cab)) else integer(0)
  dice <- function(v, i) if (i <= length(v)) v[[i]] else ""

  faltan <- character(0); sobran <- character(0); cambiadas <- list()
  if (legible_ambos) {
    faltan <- setdiff(names(mapa_ahora), names(mapa_remoto))
    sobran <- setdiff(names(mapa_remoto), names(mapa_ahora))
    for (k in intersect(names(mapa_ahora), names(mapa_remoto))) {
      a <- mapa_ahora[[k]]; b <- mapa_remoto[[k]]
      difs <- Filter(function(i) !identical(dice(a, i), dice(b, i)), comparables)
      if (length(difs)) {
        cambiadas[[length(cambiadas) + 1L]] <- list(
          curso_horario = dice(a, ic), fecha = dice(a, if_),
          campos = lapply(difs, function(i) list(
            columna = .alpa_CABECERA[[i]], publicado = dice(b, i), ahora = dice(a, i)
          ))
        )
      }
    }
  }

  legible_texto <- function(k) {
    p <- strsplit(k, "\r", fixed = TRUE)[[1]]
    sprintf("%s · %s", p[[1]], if (length(p) > 1L) p[[2]] else "")
  }

  list(
    ok = TRUE,
    spreadsheet_id = id,
    url = paste0("https://docs.google.com/spreadsheets/d/", id, "/edit"),
    titulo = .monitoreo_scalar((meta$properties %||% list())$title, ""),
    hoja = .mapd_hoja(),
    hoja_presente = hay_hoja,
    cabecera_legible = legible,
    citas_remotas = length(mapa_remoto),
    citas_ahora = length(mapa_ahora),
    coincide = legible_ambos && !length(faltan) && !length(sobran) && !length(cambiadas),
    comparado = legible_ambos,
    faltan = vapply(faltan, legible_texto, character(1), USE.NAMES = FALSE),
    sobran = vapply(sobran, legible_texto, character(1), USE.NAMES = FALSE),
    cambiadas = cambiadas,
    # Lo que hay en el documento y el motor no produce. Se nombra, no se toca.
    pestanas_ajenas = setdiff(titulos[nzchar(titulos)], .mapd_hoja())
  )
}

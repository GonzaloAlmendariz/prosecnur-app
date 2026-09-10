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

#' El código de un curso-horario, en la forma con la que el plan lo guarda.
#'
#' **El Sheets es la fuente de verdad y la app tiene que poder LEERLO.** El
#' 2026-09-10 una fila decía «CH164» y los 1 392 códigos del plan van con
#' espacio —«CH 164»—, así que la app la declaraba `desconocida`: era una aula
#' APLICADA SIN AGENDACIÓN que no contaba para ninguna cuota y nadie veía por
#' qué. Un espacio de menos no puede perder una encuesta.
#'
#' No se inventa nada aquí: `.cm_aulas_codigo_operativo()` ya sabe hacerlo —su
#' regex admite `CH164`, `CH 164` y el histórico `AULA 164`, y normalizar dos
#' veces da lo mismo—. Sólo faltaba que este ciclo lo llamara.
#' @keywords internal
.madc_codigo <- function(x) {
  crudo <- trimws(as.character(x %||% "")[1])
  if (!nzchar(crudo)) return("")
  canon <- .cm_aulas_codigo_operativo(crudo)[1]
  if (is.na(canon) || !nzchar(canon)) crudo else canon
}

#' Cuál pestaña del documento es la distribución.
#'
#' **Se localiza por su CABECERA, no por su nombre.** La app la publica como
#' «Plan del día» y el 2026-09-08 el documento del operativo tenía una sola
#' pestaña, llamada «Semana 1»: Gonzalo, «cada hoja va a ser por semana». Con la
#' búsqueda por nombre, la app leía cero citas de un documento con ochenta y
#' seis y lo declaraba vacío sin equivocarse en nada de lo que miraba. El
#' coordinador llevaba dos días escribiendo ahí.
#'
#' El nombre es una etiqueta que el equipo cambia; la cabecera es la forma del
#' documento y la escribió la app. Se prefiere la pestaña que la app publica
#' cuando existe, y si no, la primera cuya primera fila traiga las dos columnas
#' que hacen legible una distribución.
#'
#' @param id documento.
#' @param titulos títulos de sus pestañas.
#' @return el título de la pestaña, o `""` si ninguna tiene forma de distribución.
#' @keywords internal
.madc_pestana_de_la_distribucion <- function(id, titulos) {
  titulos <- titulos[nzchar(titulos)]
  if (!length(titulos)) return("")
  if (.mapd_hoja() %in% titulos) return(.mapd_hoja())
  for (t in titulos) {
    cab <- tryCatch({
      v <- .cads_valores_de_pestana(id, t)
      if (!length(v)) character(0) else .madc_valores(v[[1]], length(.alpa_CABECERA))
    }, error = function(e) character(0))
    if (length(which(cab == "CURSO-HORARIO")) == 1L && length(which(cab == "FECHA")) == 1L) {
      return(t)
    }
  }
  ""
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
  hoja <- .madc_pestana_de_la_distribucion(id, titulos)
  hay_hoja <- nzchar(hoja)

  remoto <- if (!hay_hoja) list() else tryCatch(
    .cads_valores_de_pestana(id, hoja),
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
    hoja = if (hay_hoja) hoja else .mapd_hoja(),
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
    pestanas_ajenas = setdiff(titulos[nzchar(titulos)], hoja)
  )
}

#' Toma el Sheets como fuente de verdad del reparto.
#'
#' Dictado de Gonzalo (2026-09-08): «ese excel es la fuente de verdad, la app
#' debe ser capaz de producirlo, leerlo y actualizar la distribución elaborada
#' en la app en base al sheets».
#'
#' Es el tercer movimiento del ciclo. El primero produce, el segundo compara y
#' éste **adopta**: cada fila del documento se convierte en una fijación
#' (`reparto_fijado`, código → aplicador) y el motor deja de reordenarla. Eso
#' además congela el reparto, que era el defecto de fondo: se recalculaba entero
#' en cada publicación y agendar un aula nueva movía asignaciones que las
#' veintidós personas ya habían leído.
#'
#' **Lo que no reconoce, lo declara y NO lo fija.** Un aplicador que no está en
#' el equipo o un curso-horario que no está en el plan es un tecleo, no una
#' decisión; fijarlo metería en el reparto un nombre que no existe. Se devuelven
#' aparte para que alguien los mire.
#'
#' @param filas_remotas los valores de la hoja (cabecera incluida).
#' @param plan filas del plan, para saber qué códigos existen.
#' @param roster nombres del equipo, para saber qué aplicadores existen.
#' @return lista `{fijadas, adoptadas, aplicadores_desconocidos,
#'   codigos_desconocidos, sin_aplicador}`.
#' @export
monitoreo_aulas_fijaciones_desde_distribucion <- function(filas_remotas,
                                                          plan = list(),
                                                          roster = character(0)) {
  filas <- filas_remotas %||% list()
  if (length(filas) < 2L) {
    return(list(fijadas = list(), adoptadas = 0L, aplicadores_desconocidos = character(0),
                codigos_desconocidos = character(0), sin_aplicador = character(0)))
  }
  n <- length(.alpa_CABECERA)
  cab <- .madc_valores(filas[[1L]], n)
  col_quien <- which(cab == "APLICADOR")
  col_codigo <- which(cab == "CURSO-HORARIO")
  if (length(col_quien) != 1L || length(col_codigo) != 1L) {
    stop_api(422, "E_AULAS_DISTRIBUCION_ILEGIBLE",
             paste("La hoja no trae las columnas APLICADOR y CURSO-HORARIO donde se",
                   "esperan: no se puede saber a quién asignar cada curso-horario."))
  }

  del_plan <- unique(vapply(plan %||% list(), function(u) {
    .madc_codigo(.monitoreo_scalar(u$operational_code %||% u$classroom_id, ""))
  }, character(1)))
  del_plan <- del_plan[nzchar(del_plan)]
  equipo <- unique(c(
    vapply(roster %||% character(0), function(x) aulas_nombre_aplicador(x), character(1)),
    aulas_nombre_aplicador(MONITOREO_AULAS_INTERNO_PULSO)
  ))
  equipo <- equipo[nzchar(equipo)]

  fijadas <- list()
  desconocidos <- character(0); sin_codigo <- character(0); sin_quien <- character(0)
  for (f in filas[-1L]) {
    v <- .madc_valores(f, n)
    cod <- .madc_codigo(v[[col_codigo]])
    quien <- aulas_nombre_aplicador(v[[col_quien]])
    if (!nzchar(cod)) next
    if (!nzchar(quien)) { sin_quien <- c(sin_quien, cod); next }
    if (length(del_plan) && !(cod %in% del_plan)) { sin_codigo <- c(sin_codigo, cod); next }
    if (length(equipo) && !(quien %in% equipo)) { desconocidos <- c(desconocidos, quien); next }
    fijadas[[cod]] <- quien
  }
  list(
    fijadas = fijadas,
    adoptadas = length(fijadas),
    aplicadores_desconocidos = sort(unique(desconocidos)),
    codigos_desconocidos = sort(unique(sin_codigo)),
    sin_aplicador = sort(unique(sin_quien))
  )
}

#' Completa y clasifica las filas que el equipo añadió a mano.
#'
#' Dictado de Gonzalo (2026-09-08): «debe ser capaz de leer cuando se agrega una
#' fila más y corregirla con los datos reales del CH… se hizo una reagendación y
#' tenemos que ponerla en la tabla, la vamos a agregar y vamos a poner la hora y
#' estatus REAGENDADA en un principio porque aún no se ha aplicado, y la app
#' debe ser capaz de identificarla, ponerle los datos y saber que es una
#' reagendación».
#'
#' El equipo escribe lo mínimo —el curso-horario, una hora, el estado— y esta
#' función pone el resto: el aula, la facultad, el curso, el docente y el día de
#' la semana, todo del PLAN, que es donde vive la verdad de cada curso-horario.
#' Lo que el equipo escribió NO se pisa: si tecleó una hora nueva, esa hora es la
#' reagendación y manda sobre la del plan.
#'
#' Cada fila sale clasificada:
#'
#' - `publicada` — la app ya la tenía en su reparto y coincide;
#' - `reagendada` — el equipo la marcó así, o su fecha/hora difiere del plan;
#' - `anadida` — un curso-horario que el reparto de la app no traía;
#' - `desconocida` — un código que no está en el plan: no se completa, se declara.
#'
#' @param filas_remotas los valores de la hoja (cabecera incluida).
#' @param plan filas del plan.
#' @param filas_ahora lo que el motor publicaría (para saber qué es añadido).
#' @return lista `{filas, resumen}` — `filas` con la fila completada y su
#'   clasificación, `resumen` con los conteos por clase.
#' @export
monitoreo_aulas_completar_distribucion <- function(filas_remotas, plan = list(),
                                                   filas_ahora = NULL) {
  filas <- filas_remotas %||% list()
  vacio <- list(filas = list(), resumen = list(
    publicada = 0L, reagendada = 0L, anadida = 0L, desconocida = 0L, completadas = 0L))
  if (length(filas) < 2L) return(vacio)

  n <- length(.alpa_CABECERA)
  cab <- .madc_valores(filas[[1L]], n)
  col <- function(t) { i <- which(cab == t); if (length(i) == 1L) i else NA_integer_ }
  c_cod <- col("CURSO-HORARIO")
  if (is.na(c_cod)) {
    stop_api(422, "E_AULAS_DISTRIBUCION_ILEGIBLE",
             "La hoja no trae la columna CURSO-HORARIO: no se puede saber de qué aula habla cada fila.")
  }

  # Lo que el plan sabe de cada curso-horario.
  del_plan <- list()
  unidades <- if (is.data.frame(plan)) split(plan, seq_len(nrow(plan))) else (plan %||% list())
  for (u in unidades) {
    cod <- .madc_codigo(.monitoreo_scalar(u[["operational_code"]] %||% u[["classroom_id"]], ""))
    if (!nzchar(cod) || !is.null(del_plan[[cod]])) next
    del_plan[[cod]] <- list(
      AULA = .monitoreo_scalar(u[["scheduled_venue"]] %||% u[["venue"]], ""),
      FACULTAD = .monitoreo_scalar(u[["faculty"]], ""),
      CURSO = .monitoreo_scalar(u[["course_name"]], ""),
      DOCENTE = .monitoreo_scalar(u[["teacher"]], ""),
      fecha = .monitoreo_scalar(u[["scheduled_date"]], ""),
      hora = .monitoreo_scalar(u[["scheduled_time"]], "")
    )
  }

  # Los códigos que el reparto de la app trae hoy: lo que no esté es AÑADIDO.
  publicados <- character(0)
  if (!is.null(filas_ahora) && length(filas_ahora) > 1L) {
    ia <- which(.alpa_CABECERA == "CURSO-HORARIO")[[1]]
    publicados <- unique(vapply(filas_ahora[-1L], function(f) {
      .madc_codigo(.madc_valores(f, n)[[ia]])
    }, character(1)))
  }

  salida <- list()
  conteo <- c(publicada = 0L, reagendada = 0L, anadida = 0L, desconocida = 0L)
  completadas <- 0L
  for (f in filas[-1L]) {
    v <- .madc_valores(f, n)
    cod <- .madc_codigo(v[[c_cod]])
    if (!nzchar(cod)) next
    info <- del_plan[[cod]]
    if (is.null(info)) {
      conteo[["desconocida"]] <- conteo[["desconocida"]] + 1L
      salida[[length(salida) + 1L]] <- list(
        curso_horario = cod, clase = "desconocida", completada = FALSE, fila = as.list(v)
      )
      next
    }
    antes <- v
    # **Lo que el equipo escribió NO se pisa.** Sólo se rellena lo vacío: si
    # tecleó una hora nueva, ésa es la reagendación y manda sobre el plan.
    for (t in c("AULA", "FACULTAD", "CURSO", "DOCENTE")) {
      i <- col(t)
      if (!is.na(i) && !nzchar(v[[i]]) && nzchar(info[[t]])) v[[i]] <- info[[t]]
    }
    # La fecha, y con ella el día de la semana escrito: si el equipo puso la
    # fecha nueva se respeta y el día se deriva de ELLA, no de la del plan.
    i_fecha <- col("FECHA"); i_dia <- col("DÍA")
    if (!is.na(i_fecha) && !nzchar(v[[i_fecha]]) && nzchar(info$fecha)) {
      v[[i_fecha]] <- .alpa_dia_y_fecha(info$fecha)$fecha
    }
    if (!is.na(i_dia) && !nzchar(v[[i_dia]])) {
      iso <- if (nzchar(info$fecha)) info$fecha else ""
      escrito <- .alpa_dia_y_fecha(iso)$dia
      if (nzchar(escrito)) v[[i_dia]] <- escrito
    }
    i_estado <- col("ESTADO")
    # Por el canónico y no por `toupper(trimws())`: así «APLICADA SIN
    # AGENDACION» —sin tilde, como la tecleó el equipo el 2026-09-10— es el
    # mismo estado que la «AGENDACIÓN» que la app declara. Lo que no case con
    # ninguno queda vacío y la fila se clasifica por su fecha, no por un estado
    # inventado.
    tecleado <- if (!is.na(i_estado)) v[[i_estado]] else ""
    estado <- aulas_distribucion_estado_canonico(tecleado)

    # **Reagendada**: lo dice el equipo, o lo dice la comparación con el plan.
    # Las dos vías cuentan: el estado es la intención declarada y la diferencia
    # de fecha es el hecho; exigir las dos perdería la mitad de los casos.
    corta_plan <- if (nzchar(info$fecha)) .alpa_dia_y_fecha(info$fecha)$fecha else ""
    fecha_dicha <- if (!is.na(i_fecha)) v[[i_fecha]] else ""
    movida <- nzchar(fecha_dicha) && nzchar(corta_plan) && !identical(fecha_dicha, corta_plan)
    clase <- if (identical(estado, "REAGENDADA") || movida) {
      "reagendada"
    } else if (length(publicados) && !(cod %in% publicados)) {
      "anadida"
    } else {
      "publicada"
    }
    conteo[[clase]] <- conteo[[clase]] + 1L
    cambio <- !identical(antes, v)
    if (cambio) completadas <- completadas + 1L
    salida[[length(salida) + 1L]] <- list(
      curso_horario = cod, clase = clase, completada = cambio,
      estado = estado, fila = as.list(v)
    )
  }
  list(filas = salida, resumen = c(as.list(conteo), list(completadas = completadas)))
}

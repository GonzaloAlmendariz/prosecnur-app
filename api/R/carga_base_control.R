# Lectura de la hoja «Base de control».
#
# Tercera de las tres hojas del operativo de aulas. Es el control de calidad por
# aula: cuanto se recogio contra los dos denominadores, cuantas respuestas son
# sospechosamente cortas o largas, si el aula llega al umbral, como va la cuota
# por sexo y si la aplicacion cayo en el rango horario declarado.
#
# Se llena en Excel y la app LEE.
#
# La hoja tiene DOS filas de cabecera: la 1 agrupa (INFORMACION DEL CURSO,
# CONTROL - CUENTA…) y la 2 nombra los campos. Medido sobre el estudio de 2025:
# 194 filas con dato y una cabecera INCOMPLETA — las columnas c30..c36 traen
# valores y no tienen nombre en la fila 2. No se adivinan: se cuentan y se
# reportan, porque un campo bautizado a ojo es peor que un campo ausente.
#
# Anatomia en `docs/qa/anatomia-excels-aulas-2026-08-16.md`.

BASE_CONTROL_CAMPOS <- list(
  # Identidad
  list(campo = "wave",                titulos = c("MUESTRA")),
  list(campo = "operational_code",    titulos = c("CURSO-HORARIO", "CURSO HORARIO")),
  list(campo = "course_name",         titulos = c("NOMBRE DEL CURSO")),
  list(campo = "room",                titulos = c("AULA")),
  list(campo = "schedule",            titulos = c("HORARIO")),
  list(campo = "enrolled_total",      titulos = c("MATRICULADOS TOTALES")),
  # «ELEGIBLES», no «POBLACION» (B17, dictado textual del dueño): «aqui no
  # hablamos de poblacion; matriculados totales de la DTI y matriculados
  # elegibles, que son los que cumplen los criterios». El titulo viejo queda de
  # alias de lectura para los libros vivos v3; el generador escribe el nuevo.
  list(campo = "eligible_n",          titulos = c("MATRICULADOS ELEGIBLES", "MATRICULADOS POBLACION")),
  # Campo
  list(campo = "scheduled_date",      titulos = c("FECHA AGENDADA")),
  list(campo = "scheduled_time",      titulos = c("HORA")),
  list(campo = "applied_by",          titulos = c("APLICADOR")),
  list(campo = "applied_date",        titulos = c("FECHA DE APLICACIÓN", "FECHA DE APLICACION")),
  list(campo = "applied_time",        titulos = c("HORA DE APLICACIÓN", "HORA DE APLICACION")),
  list(campo = "application_status",  titulos = c("ESTADO DE APLICACIÓN", "STATUS DE APLICACION")),
  # Control - cuenta
  list(campo = "sent_total",          titulos = c("TOTAL ENVIADAS")),
  list(campo = "sent_vs_total",       titulos = c("ENVIADAS VS MATRICULADOS", "VS TOTAL")),
  # Mismo barrido B17 que «MATRICULADOS ELEGIBLES»: el denominador de esta
  # razon son los elegibles, y el rotulo lo dice. «VS POBLACION» de alias.
  list(campo = "sent_vs_population",  titulos = c("ENVIADAS VS ELEGIBLES", "VS ELEGIBLES", "VS POBLACION")),
  # **Son los FILTROS DE VALIDACIÓN que el estudio declara en Monitoreo**, no
  # tres validadores humanos. Gonzalo lo corrigió el 2026-09-07: «responden a la
  # cantidad de filtros de validación que declaramos en monitoreo, que en este
  # caso en particular son 3». El rótulo viejo no lo decía y llevó a leerlas como
  # casillas del equipo.
  #
  # Pendiente cuando el estudio declare su criterio: que la cabecera lleve el
  # NOMBRE de cada filtro en vez del número. Hoy `criterio_validez` viene en
  # `sin_datos` porque todavía no hay base de respuestas cargada, así que
  # ponerle nombre sería inventarlo.
  list(campo = "validator_1",         titulos = c("FILTRO DE VALIDACIÓN 1", "VALIDADOR 1")),
  list(campo = "validator_2",         titulos = c("FILTRO DE VALIDACIÓN 2", "VALIDADOR 2")),
  list(campo = "validator_3",         titulos = c("FILTRO DE VALIDACIÓN 3", "VALIDADOR 3")),
  list(campo = "short_total",         titulos = c("RESPUESTAS CORTAS", "TOTAL CORTAS")),
  list(campo = "short_vs_total",      titulos = c("CORTAS VS ENVIADAS", "CORTAS VS TOTAL")),
  list(campo = "long_total",          titulos = c("RESPUESTAS LARGAS", "TOTAL LARGAS")),
  list(campo = "long_vs_total",       titulos = c("LARGAS VS ENVIADAS", "LARGAS VS TOTAL")),
  # **Lo esperado contra lo obtenido, en vez de las dos banderas del Excel viejo.**
  #
  # La hoja traia `70T` y `70P`: dos casillas de si/no que decian si el aula
  # habia llegado al 70 % sobre los matriculados y sobre la poblacion elegible.
  # Medido, ese 70 % es exactamente `expected_valid / eligible_n`, asi que las
  # dos banderas eran **ese porcentaje reducido a un si o un no** — se perdia
  # cuanto faltaba, y por tanto a que aula ir primero.
  #
  # Gonzalo, al revisar el libro: «en vez de setenta t y setenta p deberia ser
  # el porcentaje de efectivas, si ese porcentaje... cual es el esperado, cual
  # es el que se hizo, y si ese porcentaje es superior o inferior».
  #
  # Los titulos viejos se conservan como ALIAS de lectura: un libro que el
  # equipo tenga a medio llenar con la columna `70T` se sigue leyendo, aunque
  # el generador ya no la escriba.
  # `solo_lectura`: el campo sigue en la spec para que un libro viejo se lea
  # entero, pero la hoja que generamos YA NO ESCRIBE esa columna. Conservarlas
  # para leer no obliga a emitirlas: salian como cuatro columnas vacias que
  # ocupan sitio y no dicen nada, que es justo el peso muerto que la revision
  # pedia quitar.
  list(campo = "threshold_total",     titulos = c("70T"), solo_lectura = TRUE),
  list(campo = "threshold_population", titulos = c("70P"), solo_lectura = TRUE),
  list(campo = "valid_total",         titulos = c("VALIDO TOTAL"), solo_lectura = TRUE),
  list(campo = "valid_population",    titulos = c("VALIDO POBLACION"), solo_lectura = TRUE),
  # **Efectivas: la definicion es la de la PLATAFORMA.** Gonzalo: «un elegible
  # efectivo o solo efectivo es una respuesta efectiva de la plataforma, es
  # decir es una encuesta que se completa y pasa los filtros». No es lo que el
  # aplicador anota en su parte —eso es su cuenta de campo— sino la respuesta
  # que llego y paso los filtros del estudio. Por eso estas columnas las
  # escribe Prosecnur y no el equipo.
  # **Las dos expectativas, cada una con su tasa al lado.**
  #
  # Dictado de Gonzalo (2026-09-07): «poder comparar el rendimiento esperado por
  # tasa de facultad y esperado por tasa de aula, y compararlo con lo obtenido».
  # Los dos modelos ya viajaban en el plan y ninguno estaba en la hoja con su
  # nombre: la columna decía «EFECTIVAS ESPERADAS» a secas y era la del AULA.
  #
  # Medido sobre el operativo, la relación entre ambos es exacta:
  # `tasa_efectividad_aula = rendimiento_ref × factor_facultad`. Es decir, la
  # tasa del aula es la de su facultad ajustada por un factor propio del aula.
  # Para CH 72, con 53 elegibles: la facultad rinde 0,44 y el factor es 0,926,
  # de donde 0,407 y 22 encuestas; por la tasa de facultad sin ajustar serían
  # 23. Enseñar las dos permite ver si el aula rinde por encima o por debajo de
  # lo que su facultad hace de costumbre, que es lo que la pregunta pedía.
  list(campo = "tasa_facultad_ref",   titulos = c("TASA DE LA FACULTAD")),
  list(campo = "esperadas_facultad",  titulos = c("ESPERADAS POR TASA DE FACULTAD")),
  list(campo = "tasa_aula_ref",       titulos = c("TASA DEL AULA")),
  list(campo = "efectivas_esperadas", titulos = c("ESPERADAS POR TASA DEL AULA", "EFECTIVAS ESPERADAS")),
  list(campo = "efectivas_obtenidas", titulos = c("EFECTIVAS OBTENIDAS")),
  # `esperadas / elegibles` es, por definición, la tasa del aula: la misma cifra
  # dos columnas antes. Se conserva para leer libros ya emitidos y deja de
  # escribirse, que es el mismo criterio con el que se retiraron `70T` y `70P`.
  list(campo = "efectivas_pct_esperado", titulos = c("% EFECTIVAS ESPERADO"), solo_lectura = TRUE),
  list(campo = "efectivas_pct_obtenido", titulos = c("% EFECTIVAS OBTENIDO")),
  list(campo = "brecha_facultad",     titulos = c("DIFERENCIA VS TASA DE FACULTAD")),
  list(campo = "efectivas_brecha",    titulos = c("DIFERENCIA VS TASA DEL AULA", "EFECTIVAS: DIFERENCIA")),
  # **El denominador del porcentaje, a la vista y con su nombre.**
  #
  # Es `eligible_n` —el mismo numero que «MATRICULADOS POBLACION» de esta misma
  # fila—, repetido aqui a proposito para que el `% EFECTIVAS ESPERADO` se pueda
  # leer sin cruzar la hoja entera hasta las columnas de identidad.
  #
  # Se llamaba «ELEGIBLES ESPERADOS», y ese nombre prometia un pronostico
  # —cuantos elegibles esperamos— cuando lo que lleva es el padron ya conocido.
  # Costo un defecto real: el veredicto de aula valida lo tomo como meta, y usar
  # el padron como vara exige el 100 % de asistencia efectiva. Gonzalo,
  # 2026-08-24: «deberiamos tenerlo todo muy validado a lo ultimo que tenemos y
  # realmente usamos». La meta es «EFECTIVAS ESPERADAS», que esta dos columnas
  # antes. El titulo viejo queda como ALIAS de lectura: los libros ya emitidos
  # se siguen leyendo sin tocar nada.
  list(campo = "elegibles_esperados",
       titulos = c("ELEGIBLES: BASE DEL %", "ELEGIBLES ESPERADOS")),

  # Control - duracion
  list(campo = "last_response_day",   titulos = c("ÚLTIMO DÍA DE RESPUESTA", "ULTIMO DIA DE RESPUESTA")),
  # Control - cuotas
  list(campo = "observed_students",   titulos = c("ALUMNOS EN AULA", "N ASISTENTES EN AULA")),
  list(campo = "non_respondents",     titulos = c("ALUMNOS QUE NO RESPONDIERON", "N ASISTENTES QUE NO RESPONDIERON")),
  list(campo = "attendance_pct",      titulos = c("% ASISTENCIA", "ASISTENCIA")),
  list(campo = "quota_pct",           titulos = c("% DE CUOTA CUBIERTA", "CUOTA")),
  list(campo = "quota_missing",       titulos = c("FALTAN PARA LA CUOTA", "FALTANTES CUOTA")),
  # **El esperado pegado a lo obtenido**, que es como se lee: «esperaba 17
  # mujeres y consegui 14». Estaban en el bloque de CUENTA, a diez columnas de
  # su pareja, y comparar obligaba a recorrer la hoja. El esperado sale del plan
  # por AULA (`sex_top_1_n` / `sex_top_2_n`), no de la cuota por facultad.
  list(campo = "mujeres_esperadas",   titulos = c("MUJERES ESPERADAS")),
  list(campo = "women_n",             titulos = c("MUJERES OBTENIDAS", "N MUJERES")),
  list(campo = "hombres_esperados",   titulos = c("HOMBRES ESPERADOS")),
  list(campo = "men_n",               titulos = c("HOMBRES OBTENIDOS", "N HOMBRES")),
  list(campo = "women_pct",           titulos = c("% MUJERES", "MUJERES")),
  list(campo = "men_pct",             titulos = c("% HOMBRES", "HOMBRES")),
  # Control - rango horario
  list(campo = "schedule_norm",       titulos = c("HORARIO NORMALIZADO", "NORM - HORARIO")),
  list(campo = "schedule_range",      titulos = c("FRANJA HORARIA", "RANGO - HORARIO"))
)

# Los campos que son numero. El resto se conserva como texto.
.cbc_numericos <- c(
  "enrolled_total", "eligible_n", "sent_total", "sent_vs_total", "sent_vs_population",
  "validator_1", "validator_2", "validator_3", "short_total", "short_vs_total",
  "tasa_facultad_ref", "esperadas_facultad", "tasa_aula_ref", "brecha_facultad",
  "long_total", "long_vs_total", "threshold_total", "threshold_population",
  "observed_students", "non_respondents", "attendance_pct", "quota_pct",
  "quota_missing", "women_n", "men_n", "women_pct", "men_pct"
)

#' Mapea los campos nombrados de «Base de control».
#'
#' @param titulos fila 2 del libro.
#' @return lista con `mapa` (campo -> columna) y `sin_nombre` (columnas con
#'   datos que la cabecera no bautiza).
#' @export
base_control_mapa <- function(titulos) {
  claves <- .caa_key(titulos)
  mapa <- list()
  usadas <- integer(0)
  for (spec in BASE_CONTROL_CAMPOS) {
    idx <- which(claves %in% .caa_key(spec$titulos) & !(seq_along(claves) %in% usadas))
    if (length(idx)) {
      mapa[[spec$campo]] <- idx[[1]]
      usadas <- c(usadas, idx[[1]])
    }
  }
  # `.caa_key(NA)` devuelve el TEXTO "NA", que pasa `nzchar()`. Sin este filtro
  # el diagnostico decia 0 columnas sin nombre en una hoja que tiene siete.
  vacio <- !nzchar(claves) | claves %in% c("NA", "NULL") | is.na(titulos)
  list(mapa = mapa, sin_nombre = which(vacio))
}

#' Traduce «Base de control» a filas de control por aula.
#'
#' @param df cuerpo de la hoja, sin las dos filas de cabecera.
#' @param titulos fila 2 del libro.
#' @return lista con `filas` y `sin_nombre`.
#' @export
base_control_a_filas <- function(df, titulos) {
  res <- base_control_mapa(titulos)
  mapa <- res$mapa
  # **«Tienen datos» hay que comprobarlo, no decirlo.**
  #
  # El aviso publica «N columnas de la Base de control tienen datos pero su
  # cabecera esta vacia», y `base_control_mapa()` solo mira los TITULOS: una
  # columna vacia con cabecera vacia entraba en la cuenta igual que una llena.
  # Una columna del todo vacia no es un dato que se este perdiendo —es una
  # columna de sobra en la hoja— y avisar de ella manda a buscar algo que no
  # existe.
  #
  # Es el mismo defecto que este loop corrigio en tres avisos propios: el conteo
  # estaba bien y el universo mal delimitado.
  #
  # Va ANTES de la salida temprana: por ahi se devolvia `sin_nombre` sin filtrar,
  # asi que una hoja sin `CURSO-HORARIO` reconocible seguia afirmando «tienen
  # datos» sobre columnas que podian estar vacias.
  if (is.data.frame(df) && nrow(df)) {
    res$sin_nombre <- Filter(function(col) {
      if (col > ncol(df)) return(FALSE)
      any(nzchar(trimws(as.character(df[[col]]))) & !is.na(df[[col]]))
    }, res$sin_nombre)
  } else {
    # Sin cuerpo no hay datos que perder en ninguna columna.
    res$sin_nombre <- integer(0)
  }
  if (!is.data.frame(df) || !nrow(df) || is.null(mapa$operational_code)) {
    return(list(filas = list(), sin_nombre = res$sin_nombre))
  }
  filas <- list()
  for (i in seq_len(nrow(df))) {
    code <- .caa_txt(df[i, mapa$operational_code])
    if (!nzchar(code)) next
    fila <- list()
    for (nm in names(mapa)) {
      col <- mapa[[nm]]
      fila[[nm]] <- if (nm %in% .cbc_numericos) .caa_num(df[i, col]) else .caa_txt(df[i, col])
    }
    fila$classroom_id <- code
    filas[[length(filas) + 1L]] <- fila
  }
  list(filas = filas, sin_nombre = res$sin_nombre)
}

#' Lee la hoja «Base de control» de un libro.
#'
#' @param path ruta al `.xlsx`.
#' @param hoja nombre de la hoja.
#' @return lista con `filas` y `sin_nombre`.
#' @export
base_control_leer <- function(path, hoja = "Base de control") {
  if (!file.exists(path)) {
    stop_api(400, "E_BASE_CONTROL_NO_EXISTE", "No se encontro el libro de base de control.")
  }
  hojas <- tryCatch(readxl::excel_sheets(path), error = function(e) character(0))
  if (!hoja %in% hojas) {
    stop_api(
      422, "E_BASE_CONTROL_SIN_HOJA",
      sprintf("El libro no tiene una hoja '%s'.", hoja),
      details = list(hojas = as.list(hojas))
    )
  }
  crudo <- readxl::read_excel(path, sheet = hoja, col_names = FALSE, .name_repair = "minimal")
  if (nrow(crudo) < 3L) return(list(filas = list(), sin_nombre = integer(0)))
  titulos <- as.character(unlist(crudo[2, ], use.names = FALSE))
  cuerpo <- crudo[-c(1, 2), , drop = FALSE]
  base_control_a_filas(as.data.frame(cuerpo, stringsAsFactors = FALSE), titulos)
}

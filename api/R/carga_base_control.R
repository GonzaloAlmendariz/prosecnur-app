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

# **El orden de las columnas cuenta una historia, de izquierda a derecha.**
#
# Gonzalo, 2026-09-07: «noto muchísimo desorden en el orden en que se encuentran
# los encabezados, no parece seguir ningún criterio lógico en su orden». Tenía
# razón: el denominador de un porcentaje vivía a tres columnas de él y a la vez
# repetía otra columna del principio; las esperadas por sexo estaban en un
# bloque y las obtenidas en otro; el horario normalizado cerraba la hoja dentro
# del bloque de cuotas.
#
# El criterio, y la hoja se lee en ese orden:
#
#   1. EL AULA — qué es y a cuánta gente alcanza.
#   2. LA APLICACIÓN — cuándo se pactó, quién fue, cómo salió.
#   3. LO QUE ESPERÁBAMOS — las dos tasas y sus dos pronósticos.
#   4. LO QUE LLEGÓ DE LA PLATAFORMA — enviadas, filtros, efectivas.
#   5. CÓMO VAMOS — las razones y las brechas, que son lo esperado contra lo
#      que llegó y por tanto van DESPUÉS de los dos.
#
# Cada cifra queda al lado de aquello con lo que se compara: ninguna razón se
# lee cruzando la hoja.
BASE_CONTROL_CAMPOS <- list(

  # ---- 1. EL AULA ---------------------------------------------------------
  list(campo = "wave",                titulos = c("MUESTRA")),
  list(campo = "operational_code",    titulos = c("CURSO-HORARIO", "CURSO HORARIO")),
  list(campo = "course_name",         titulos = c("NOMBRE DEL CURSO")),
  # AULA es el LUGAR y HORARIO son las sesiones. Salían con el mismo texto —las
  # dos con «LUN 10:00-12:00 L321 · JUE 11:00-12:00 L306»— porque AULA escribía
  # `label`, que en este estudio es la cadena de sesiones. Dos columnas con el
  # mismo contenido son una que sobra.
  list(campo = "room",                titulos = c("AULA")),
  list(campo = "schedule",            titulos = c("HORARIO")),
  # El horario normalizado y su franja cierran el bloque del aula, que es de lo
  # que hablan. Cerraban la hoja entera, dentro del bloque de cuotas.
  list(campo = "schedule_norm",       titulos = c("HORARIO NORMALIZADO", "NORM - HORARIO")),
  list(campo = "schedule_range",      titulos = c("FRANJA HORARIA", "RANGO - HORARIO")),
  list(campo = "enrolled_total",      titulos = c("MATRICULADOS TOTALES")),
  # «ELEGIBLES», no «POBLACION» (B17, dictado textual del dueño): «aqui no
  # hablamos de poblacion; matriculados totales de la DTI y matriculados
  # elegibles, que son los que cumplen los criterios». El titulo viejo queda de
  # alias de lectura para los libros vivos v3; el generador escribe el nuevo.
  list(campo = "eligible_n",          titulos = c("MATRICULADOS ELEGIBLES", "MATRICULADOS POBLACION")),

  # ---- 2. LA APLICACIÓN ---------------------------------------------------
  list(campo = "scheduled_date",      titulos = c("FECHA AGENDADA")),
  list(campo = "scheduled_time",      titulos = c("HORA")),
  list(campo = "applied_by",          titulos = c("APLICADOR")),
  list(campo = "applied_date",        titulos = c("FECHA DE APLICACIÓN", "FECHA DE APLICACION")),
  list(campo = "applied_time",        titulos = c("HORA DE APLICACIÓN", "HORA DE APLICACION")),
  list(campo = "application_status",  titulos = c("ESTADO DE APLICACIÓN", "STATUS DE APLICACION")),
  # Cuánta gente había en el salón lo dice el PARTE; es dato de la aplicación y
  # no de las cuotas, y aquí queda al lado de quién y cuándo aplicó.
  list(campo = "observed_students",   titulos = c("ALUMNOS EN AULA", "N ASISTENTES EN AULA")),
  list(campo = "last_response_day",   titulos = c("ÚLTIMO DÍA DE RESPUESTA", "ULTIMO DIA DE RESPUESTA")),

  # ---- 3. LO QUE ESPERÁBAMOS ----------------------------------------------
  #
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
  # El esperado por sexo sale del plan POR AULA (`sex_top_1_n` / `sex_top_2_n`),
  # no de la cuota por facultad; su pareja obtenida vive en el bloque siguiente,
  # que es de donde sale.
  list(campo = "mujeres_esperadas",   titulos = c("MUJERES ESPERADAS")),
  list(campo = "hombres_esperados",   titulos = c("HOMBRES ESPERADOS")),

  # ---- 4. LO QUE LLEGÓ DE LA PLATAFORMA -----------------------------------
  #
  # **Efectivas: la definicion es la de la PLATAFORMA.** Gonzalo: «un elegible
  # efectivo o solo efectivo es una respuesta efectiva de la plataforma, es
  # decir es una encuesta que se completa y pasa los filtros». No es lo que el
  # aplicador anota en su parte —eso es su cuenta de campo— sino la respuesta
  # que llego y paso los filtros del estudio.
  #
  # El bloque entero lo escribe Prosecnur desde las respuestas sincronizadas.
  # Hasta el 2026-09-07 salía VACÍO: eran las fórmulas que el equipo tecleaba en
  # su Excel de 2025 y nadie las volvió a escribir. «Y por qué todo esto está
  # vacía».
  list(campo = "sent_total",          titulos = c("TOTAL ENVIADAS")),
  # **Son los FILTROS DE VALIDACIÓN que el estudio declara en Monitoreo**, no
  # tres validadores humanos. Gonzalo lo corrigió el 2026-09-07: «responden a la
  # cantidad de filtros de validación que declaramos en monitoreo, que en este
  # caso en particular son 3». Cada columna cuenta cuántas de las enviadas de
  # esa aula pasan ESE filtro, y su cabecera lleva el nombre de la variable
  # cuando el estudio la declara: `FILTRO: inicio/consent_1`.
  list(campo = "validator_1",         titulos = c("FILTRO DE VALIDACIÓN 1", "VALIDADOR 1")),
  list(campo = "validator_2",         titulos = c("FILTRO DE VALIDACIÓN 2", "VALIDADOR 2")),
  list(campo = "validator_3",         titulos = c("FILTRO DE VALIDACIÓN 3", "VALIDADOR 3")),
  # **«Cortas y largas» ya no existe: es efectivas y no efectivas.** Dictado de
  # Gonzalo el 2026-09-07. En 2025 el equipo clasificaba las respuestas por
  # DURACIÓN —sospechosamente cortas contra largas— porque no tenía el criterio
  # de validez de la plataforma; hoy lo tiene, y la partición que importa es la
  # que decide si la encuesta cuenta. Los cuatro campos viejos siguen abajo como
  # solo-lectura para que un libro de 2025 se lea entero.
  list(campo = "efectivas_obtenidas", titulos = c("EFECTIVAS", "EFECTIVAS OBTENIDAS")),
  list(campo = "no_efectivas",        titulos = c("NO EFECTIVAS")),
  list(campo = "women_n",             titulos = c("MUJERES OBTENIDAS", "N MUJERES")),
  list(campo = "men_n",               titulos = c("HOMBRES OBTENIDOS", "N HOMBRES")),

  # ---- 5. CÓMO VAMOS ------------------------------------------------------
  #
  # Todo lo que compara los dos bloques anteriores, y por eso va después de los
  # dos. Una razón cuyo numerador o denominador no se ha escrito todavía no se
  # puede leer.
  list(campo = "sent_vs_total",       titulos = c("ENVIADAS VS MATRICULADOS", "VS TOTAL")),
  # Mismo barrido B17 que «MATRICULADOS ELEGIBLES»: el denominador de esta
  # razon son los elegibles, y el rotulo lo dice. «VS POBLACION» de alias.
  list(campo = "sent_vs_population",  titulos = c("ENVIADAS VS ELEGIBLES", "VS ELEGIBLES", "VS POBLACION")),
  # Cuánto de lo que llegó cuenta. Es la salud del instrumento en ese salón: un
  # aula con 48 enviadas y 38 efectivas perdió diez por consentimiento o filtro.
  list(campo = "efectivas_vs_enviadas", titulos = c("% EFECTIVAS SOBRE ENVIADAS")),
  # El rótulo dice AHORA cuál es el denominador. Decía «% EFECTIVAS OBTENIDO» y
  # no se sabía si era sobre enviadas o sobre elegibles; son dos preguntas
  # distintas y la hoja ahora trae las dos, así que confundirlas ya no es una
  # ambigüedad sino un error de lectura.
  list(campo = "efectivas_pct_obtenido", titulos = c("% EFECTIVAS SOBRE ELEGIBLES", "% EFECTIVAS OBTENIDO")),
  # En encuestas y con signo: «te faltan 4» es accionable, «-13 %» no. Una
  # diferencia por cada modelo, porque un aula puede ir bien contra su propia
  # tasa y mal contra la de su facultad.
  list(campo = "brecha_facultad",     titulos = c("DIFERENCIA VS TASA DE FACULTAD")),
  list(campo = "efectivas_brecha",    titulos = c("DIFERENCIA VS TASA DEL AULA", "EFECTIVAS: DIFERENCIA")),
  list(campo = "quota_pct",           titulos = c("% DE CUOTA CUBIERTA", "CUOTA")),
  list(campo = "quota_missing",       titulos = c("FALTAN PARA LA CUOTA", "FALTANTES CUOTA")),
  list(campo = "attendance_pct",      titulos = c("% ASISTENCIA", "ASISTENCIA")),
  list(campo = "non_respondents",     titulos = c("ALUMNOS QUE NO RESPONDIERON", "N ASISTENTES QUE NO RESPONDIERON")),
  list(campo = "women_pct",           titulos = c("% MUJERES", "MUJERES")),
  list(campo = "men_pct",             titulos = c("% HOMBRES", "HOMBRES")),

  # ---- SOLO LECTURA: la hoja ya no los escribe ----------------------------
  #
  # Siguen en la spec para que un libro ya emitido se lea ENTERO, y por eso
  # conservan sus títulos; `.calg_control_escritos()` los deja fuera al generar.
  # Conservarlas para leer no obliga a emitirlas: salían como columnas vacías
  # que ocupan sitio y no dicen nada.
  #
  # `70T`/`70P` eran el 70 % reducido a dos casillas de sí/no —se perdía cuánto
  # faltaba, y por tanto a qué aula ir primero—; hoy eso lo dicen las dos
  # diferencias. `VALIDO TOTAL`/`VALIDO POBLACION` eran su veredicto.
  list(campo = "threshold_total",     titulos = c("70T"), solo_lectura = TRUE),
  list(campo = "threshold_population", titulos = c("70P"), solo_lectura = TRUE),
  list(campo = "valid_total",         titulos = c("VALIDO TOTAL"), solo_lectura = TRUE),
  list(campo = "valid_population",    titulos = c("VALIDO POBLACION"), solo_lectura = TRUE),
  # Cortas y largas: la partición por DURACIÓN de 2025, sustituida por
  # efectivas/no efectivas.
  list(campo = "short_total",         titulos = c("RESPUESTAS CORTAS", "TOTAL CORTAS"), solo_lectura = TRUE),
  list(campo = "short_vs_total",      titulos = c("CORTAS VS ENVIADAS", "CORTAS VS TOTAL"), solo_lectura = TRUE),
  list(campo = "long_total",          titulos = c("RESPUESTAS LARGAS", "TOTAL LARGAS"), solo_lectura = TRUE),
  list(campo = "long_vs_total",       titulos = c("LARGAS VS ENVIADAS", "LARGAS VS TOTAL"), solo_lectura = TRUE),
  # `esperadas / elegibles`, que es exactamente «TASA DEL AULA».
  list(campo = "efectivas_pct_esperado", titulos = c("% EFECTIVAS ESPERADO"), solo_lectura = TRUE),
  # Y `eligible_n` repetido: el mismo número que «MATRICULADOS ELEGIBLES» de
  # esta misma fila. Existía para que el porcentaje de al lado se leyera sin
  # cruzar la hoja; con el orden nuevo el porcentaje ya está junto a su
  # denominador, y una columna que repite a su vecina es justo el desorden que
  # Gonzalo señaló. El nombre viejo, «ELEGIBLES ESPERADOS», prometía además un
  # pronóstico y costó un defecto real: el veredicto de aula válida lo tomó como
  # meta, y usar el padrón como vara exige el 100 % de asistencia efectiva.
  list(campo = "elegibles_esperados",
       titulos = c("ELEGIBLES: BASE DEL %", "ELEGIBLES ESPERADOS"), solo_lectura = TRUE)
)

# Los campos que son numero. El resto se conserva como texto.
.cbc_numericos <- c(
  "enrolled_total", "eligible_n", "sent_total", "sent_vs_total", "sent_vs_population",
  "validator_1", "validator_2", "validator_3", "short_total", "short_vs_total",
  "tasa_facultad_ref", "esperadas_facultad", "tasa_aula_ref", "brecha_facultad",
  "long_total", "long_vs_total", "threshold_total", "threshold_population",
  "observed_students", "non_respondents", "attendance_pct", "quota_pct",
  "quota_missing", "women_n", "men_n", "women_pct", "men_pct",
  # Las de efectivas faltaban desde que existen: al releer el libro volvían como
  # TEXTO, y una diferencia guardada como «-11» no se compara con nada.
  "efectivas_esperadas", "efectivas_obtenidas", "no_efectivas",
  "efectivas_vs_enviadas", "efectivas_pct_obtenido", "efectivas_pct_esperado",
  "efectivas_brecha", "elegibles_esperados",
  "mujeres_esperadas", "hombres_esperados"
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

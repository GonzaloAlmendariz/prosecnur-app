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

  # ---- 1. IDENTIFICACIÓN DEL CURSO-HORARIO --------------------------------
  list(campo = "wave",                titulos = c("MUESTRA")),
  list(campo = "operational_code",    titulos = c("CURSO-HORARIO", "CURSO HORARIO")),
  list(campo = "course_name",         titulos = c("NOMBRE DEL CURSO")),
  # **FACULTAD.** No estaba, y todo el avance del estudio se mide por facultad:
  # sin ella esta hoja no se puede filtrar ni cuadrar con «Avance de campo».
  # Gonzalo, 2026-09-08, revisando la lista: «falta facultad».
  list(campo = "faculty",             titulos = c("FACULTAD")),
  # AULA es el LUGAR y HORARIO son las sesiones. Salían con el mismo texto
  # porque AULA escribía `label`, que en este estudio es la cadena de sesiones.
  list(campo = "room",                titulos = c("AULA")),
  list(campo = "schedule",            titulos = c("HORARIO")),
  # **El rango es OPERATIVO, no la franja del día.** Era «Mañana / Tarde /
  # Noche», que sólo repite la hora. Lo que el operativo distingue es si la
  # aplicación cae fuera del horario normal, porque eso cuesta permisos y gente:
  # ESPECIAL MAÑANA antes de las 8:00, REGULAR, ESPECIAL NOCHE desde las 19:00.
  # Medido sobre el plan: 0 · 95 · 11.
  list(campo = "schedule_range",      titulos = c("RANGO DE APLICACIÓN", "FRANJA HORARIA", "RANGO - HORARIO")),
  list(campo = "enrolled_total",      titulos = c("MATRICULADOS TOTALES")),
  list(campo = "eligible_n",          titulos = c("MATRICULADOS ELEGIBLES", "MATRICULADOS POBLACION")),

  # ---- 2. APLICACIÓN EN CAMPO ---------------------------------------------
  list(campo = "scheduled_date",      titulos = c("FECHA AGENDADA")),
  list(campo = "scheduled_time",      titulos = c("HORA")),
  list(campo = "applied_by",          titulos = c("APLICADOR")),
  list(campo = "applied_date",        titulos = c("FECHA DE APLICACIÓN", "FECHA DE APLICACION")),
  list(campo = "applied_time",        titulos = c("HORA DE APLICACIÓN", "HORA DE APLICACION")),
  list(campo = "application_status",  titulos = c("ESTADO DE APLICACIÓN", "STATUS DE APLICACION")),
  list(campo = "observed_students",   titulos = c("ALUMNOS EN AULA", "N ASISTENTES EN AULA")),
  # **Lo que el aplicador DECLARA al cerrar**, que es otra cuenta que la de la
  # plataforma y por eso se publica aparte: verlas juntas es el control de campo.
  list(campo = "declared_surveys",    titulos = c("ENCUESTAS APLICADAS DECLARADAS")),
  list(campo = "refusals",            titulos = c("RECHAZOS DECLARADOS")),
  list(campo = "last_response_day",   titulos = c("ÚLTIMO DÍA DE RESPUESTA", "ULTIMO DIA DE RESPUESTA")),

  # ---- 3. RENDIMIENTO ESPERADO --------------------------------------------
  #
  # Las dos varas del diseño, cada una con su tasa, su total y su reparto por
  # sexo. `tasa_efectividad_aula = rendimiento_ref × factor_facultad`: la del
  # aula es la de su facultad ajustada por el tamaño del salón, así que
  # enseñarlas juntas dice si el aula rinde por encima o por debajo de lo que su
  # facultad hace de costumbre.
  list(campo = "tasa_facultad_ref",   titulos = c("TASA DE LA FACULTAD")),
  list(campo = "esperadas_facultad",  titulos = c("ESPERADAS POR TASA DE FACULTAD")),
  list(campo = "mujeres_esperadas_facultad", titulos = c("MUJERES ESPERADAS POR TASA DE FACULTAD")),
  list(campo = "hombres_esperados_facultad", titulos = c("HOMBRES ESPERADOS POR TASA DE FACULTAD")),
  list(campo = "tasa_aula_ref",       titulos = c("TASA DEL AULA")),
  list(campo = "efectivas_esperadas", titulos = c("ESPERADAS POR TASA DEL AULA", "EFECTIVAS ESPERADAS")),
  list(campo = "mujeres_esperadas",   titulos = c("MUJERES ESPERADAS POR TASA DEL AULA", "MUJERES ESPERADAS")),
  list(campo = "hombres_esperados",   titulos = c("HOMBRES ESPERADOS POR TASA DEL AULA", "HOMBRES ESPERADOS")),

  # ---- 4. RESPUESTAS EN PLATAFORMA ----------------------------------------
  #
  # «Un elegible efectivo o sólo efectivo es una respuesta efectiva de la
  # plataforma, es decir una encuesta que se completa y pasa los filtros». No es
  # lo que el aplicador anota en su parte —eso es su cuenta de campo— sino la
  # respuesta que llegó y pasó los filtros del estudio.
  list(campo = "sent_total",          titulos = c("TOTAL ENVIADAS A PLATAFORMA", "TOTAL ENVIADAS")),
  # **Cuentan las que CAEN, no las que pasan.** Gonzalo, 2026-09-08: «son los
  # que se quedan en el filtro, no los que los pasan». Es la lectura accionable:
  # «se cayeron 4 en el consentimiento» dice dónde se pierde; «pasaron 27» no,
  # porque hay que restar mentalmente contra las enviadas. La cabecera lleva el
  # nombre de la variable cuando el estudio declara su criterio.
  list(campo = "validator_1",         titulos = c("CAEN EN EL FILTRO 1", "FILTRO DE VALIDACIÓN 1", "VALIDADOR 1")),
  list(campo = "validator_2",         titulos = c("CAEN EN EL FILTRO 2", "FILTRO DE VALIDACIÓN 2", "VALIDADOR 2")),
  list(campo = "validator_3",         titulos = c("CAEN EN EL FILTRO 3", "FILTRO DE VALIDACIÓN 3", "VALIDADOR 3")),
  list(campo = "no_efectivas",        titulos = c("NO EFECTIVAS")),
  list(campo = "efectivas_obtenidas", titulos = c("EFECTIVAS", "EFECTIVAS OBTENIDAS")),
  list(campo = "women_n",             titulos = c("MUJERES OBTENIDAS", "N MUJERES")),
  list(campo = "men_n",               titulos = c("HOMBRES OBTENIDOS", "N HOMBRES")),
  # **Cuánto tardó la encuesta, sólo sobre las EFECTIVAS.** Salen de `start` y
  # `end` de la plataforma, que traen su huso. Medido el primer día: mediana 5,6
  # min con un instrumento de ~60 preguntas, y un mínimo de 2,0 — la mínima es
  # la que enciende la alarma, y por eso va aunque las otras dos no estuvieran.
  # NO se cuenta cuántas son «cortas»: exigiría un umbral que este estudio no ha
  # declarado, y Gonzalo lo descartó explícitamente.
  list(campo = "duracion_media",      titulos = c("DURACIÓN PROMEDIO (MIN)")),
  list(campo = "duracion_min",        titulos = c("DURACIÓN MÍNIMA (MIN)")),
  list(campo = "duracion_max",        titulos = c("DURACIÓN MÁXIMA (MIN)")),

  # ---- 5. INDICADORES DE AVANCE -------------------------------------------
  #
  # Todo lo que compara los dos bloques anteriores, y por eso va después.
  list(campo = "sent_vs_total",       titulos = c("ENVIADAS VS MATRICULADOS", "VS TOTAL")),
  list(campo = "sent_vs_population",  titulos = c("ENVIADAS VS ELEGIBLES", "VS ELEGIBLES", "VS POBLACION")),
  list(campo = "efectivas_vs_enviadas", titulos = c("% DE EFECTIVAS SOBRE LO RECIBIDO", "% EFECTIVAS SOBRE ENVIADAS")),
  # **Quien estaba en el aula y no dejó encuesta, partido en DOS.** Gonzalo,
  # 2026-09-08: «alumnos que no respondieron sí, pero hay que diferenciar
  # quiénes ni siquiera escanearon el QR y los que no pasaron los filtros de
  # validación». Son dos fallas distintas y piden cosas distintas: la primera es
  # de captación en el salón —el aplicador no logró que abrieran el enlace— y la
  # segunda es del instrumento o del público. La suma de las dos con las
  # efectivas da los asistentes, así que la partición cierra.
  list(campo = "non_respondents",     titulos = c("ALUMNOS QUE NO RESPONDIERON", "N ASISTENTES QUE NO RESPONDIERON")),
  list(campo = "no_escanearon",       titulos = c("NO ESCANEARON EL QR")),
  list(campo = "attendance_pct",      titulos = c("% DE ASISTENCIA", "% ASISTENCIA", "ASISTENCIA")),
  # **La tasa obtenida y su distancia a las dos esperadas.** «Lo que me interesa
  # es qué tan lejos de la tasa estamos en base a lo que esperábamos» —y por eso
  # se fue «% de cuota cubierta»: cada aula consigue lo que consigue, no se
  # vuelve, así que «cuánto falta» ahí no es una acción, es un lamento.
  list(campo = "efectivas_pct_obtenido", titulos = c("TASA OBTENIDA", "% EFECTIVAS SOBRE ELEGIBLES", "% EFECTIVAS OBTENIDO")),
  list(campo = "brecha_tasa_facultad", titulos = c("DIFERENCIA DE TASA VS FACULTAD")),
  list(campo = "brecha_tasa_aula",    titulos = c("DIFERENCIA DE TASA VS AULA")),
  # Y las mismas dos distancias en ENCUESTAS, que es como se dimensiona lo
  # perdido: «rindió 12 puntos menos» dice el rendimiento, «fueron 9 encuestas»
  # dice el tamaño del agujero.
  list(campo = "brecha_facultad",     titulos = c("DIFERENCIA EN ENCUESTAS VS FACULTAD", "DIFERENCIA VS TASA DE FACULTAD")),
  list(campo = "efectivas_brecha",    titulos = c("DIFERENCIA EN ENCUESTAS VS AULA", "DIFERENCIA VS TASA DEL AULA", "EFECTIVAS: DIFERENCIA")),
  list(campo = "mujeres_brecha_facultad", titulos = c("MUJERES: DIFERENCIA VS FACULTAD")),
  list(campo = "mujeres_brecha_aula", titulos = c("MUJERES: DIFERENCIA VS AULA")),
  list(campo = "hombres_brecha_facultad", titulos = c("HOMBRES: DIFERENCIA VS FACULTAD")),
  list(campo = "hombres_brecha_aula", titulos = c("HOMBRES: DIFERENCIA VS AULA")),
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
  # **La cuota por aula sale de la hoja el 2026-09-08.** «No falta % de cuota
  # cubierta porque cada aula consigue lo que se consigue, no hay que volver a
  # ir ni se puede; lo que me interesa es qué tan lejos de la tasa estamos.» Una
  # columna que mide lo que ya no se puede corregir invita a una acción que no
  # existe. Se leen si un libro viejo las trae.
  list(campo = "quota_pct",           titulos = c("% DE CUOTA CUBIERTA", "CUOTA"), solo_lectura = TRUE),
  list(campo = "quota_missing",       titulos = c("FALTAN PARA LA CUOTA", "FALTANTES CUOTA"), solo_lectura = TRUE),
  # El horario normalizado repetía a HORA con otro formato; el rango de
  # aplicación, que sí dice algo, se queda en el bloque del aula.
  list(campo = "schedule_norm",       titulos = c("HORARIO NORMALIZADO", "NORM - HORARIO"), solo_lectura = TRUE),
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
  "mujeres_esperadas", "hombres_esperados",
  # Las del barrido del 2026-09-08: sin esto vuelven del libro como TEXTO y una
  # diferencia guardada como «-0.12» no se compara con nada.
  "mujeres_esperadas_facultad", "hombres_esperados_facultad",
  "declared_surveys", "refusals", "no_escanearon",
  "duracion_media", "duracion_min", "duracion_max",
  "brecha_tasa_facultad", "brecha_tasa_aula",
  "mujeres_brecha_facultad", "mujeres_brecha_aula",
  "hombres_brecha_facultad", "hombres_brecha_aula"
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

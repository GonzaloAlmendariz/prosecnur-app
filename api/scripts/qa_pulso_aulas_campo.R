# Siembra un .pulso de QA con un estudio de aulas ya en campo.
#
# Existe porque ocho reparaciones (L15-L22 del GOAL «el aula se recoge sola»)
# estaban respaldadas por simulacion y por tests, pero **nadie las habia visto
# en pantalla**. La nota del GOAL decia que era imposible sin recorrer el flujo
# entero desde Calculo de muestra, porque "la whitelist de persistencia guarda
# el plan y poco mas".
#
# Esa premisa era FALSA y comprobarla es lo que desbloqueo esto: la persistencia
# del `.pulso` es una lista NEGRA, no blanca. `build_pulso()` serializa el
# estado completo salvo los caches que `.pulso_strip_caches()` nombra uno a uno.
# El plan, la config de aulas, los partes de campo y las respuestas de
# `monitoreo_snapshot$data` viajan todos.
#
# El estudio sembrado es sintetico y esta construido para que los ocho
# fenomenos sean VISIBLES a la vez. No es una muestra realista: es un banco de
# pruebas donde cada aula existe para hacer fallar un control distinto.
#
#   Rscript api/scripts/qa_pulso_aulas_campo.R /ruta/destino.pulso

suppressWarnings(suppressMessages(pkgload::load_all("api", quiet = TRUE)))

args <- commandArgs(trailingOnly = TRUE)
destino <- args[1]
if (is.na(destino) || !nzchar(destino)) {
  destino <- file.path(tempdir(), "qa_aulas_campo.pulso")
}
# `--escala 2025` siembra el operativo entero —170 titulares y 26 reemplazos
# consumidos, la forma que el campo tuvo de verdad— en vez de las siete aulas de
# banco de pruebas. Las tablas de 196 filas son donde el recorte de columnas y el
# reparto de alto se ponen a prueba; con nueve no se ve nada de eso.
ESCALA_2025 <- any(args == "--escala") && any(args == "2025")

# El modo pequeño —sin `--escala 2025`— NO esta implementado entero: `partes`,
# `asistentes_del_parte` y `data` solo se construyen dentro de la rama grande, y
# el script moria mas abajo con «object 'aplicadas' not found» sin decir por que.
# Un fallo temprano y con nombre vale mas que uno profundo y mudo. Revivirlo
# significa escribir el equivalente pequeño de esas tres cosas.
if (!ESCALA_2025) {
  stop(paste(
    "Este generador solo esta implementado para `--escala 2025`.",
    "Uso: Rscript api/scripts/qa_pulso_aulas_campo.R <destino.pulso> --escala 2025"
  ), call. = FALSE)
}

# --- El plan -----------------------------------------------------------------
# Cinco titulares y dos reservas encadenadas. Cada aula tiene un papel:
#
#   CH 1  aplicada y completa           -> avance real, no cero (L15)
#   CH 2  5 de 30                       -> NO debe decir «cerrando» (L17)
#   CH 3  sin una sola respuesta        -> brecha entera (L18)
#   CH 4  caida, con su cadena activa   -> la cadena se ve (L19)
#   CH 5  agendada y sin campo aun      -> estado de muestra distinto del de aplicacion (L30)
# El `classroom_id` NO es el codigo operativo, y esa diferencia es la que hacia
# invisible un defecto entero. En un estudio real el aula se llama `arc232_0905`
# en el marco de la universidad y `CH 1` en el operativo; aqui valian lo mismo,
# asi que `replacement_for` —que guarda el classroom_id del titular— coincidia
# por accidente con el codigo operativo y la cadena se agrupaba bien de casualidad.
# Sobre HSVG2026, donde no coinciden, 0 de 202 apuntaban a un titular.
# El descarte por validador, con las dos invariantes del libro real.
# `.cortas` da entre 0 y ~21 % de las enviadas segun el aula (mediana ~10 %), y
# los tres validadores lo REPARTEN: su suma es exactamente `.cortas`, nunca otra
# cosa. El tercero se calcula por resta para que la identidad no dependa del
# redondeo.
.cortas <- function(enviadas, i) {
  if (!is.finite(enviadas) || enviadas <= 0) return(0L)
  as.integer(round(enviadas * (0.04 + 0.13 * ((i %% 7L) / 6))))
}
.cortas_v1 <- function(enviadas, i) as.integer(round(.cortas(enviadas, i) * 0.60))
.cortas_v2 <- function(enviadas, i) as.integer(round(.cortas(enviadas, i) * 0.25))
.cortas_v3 <- function(enviadas, i) {
  .cortas(enviadas, i) - .cortas_v1(enviadas, i) - .cortas_v2(enviadas, i)
}

.qa_classroom_id <- function(codigo) {
  limpio <- tolower(gsub("[^A-Za-z0-9]", "", codigo))
  sprintf("aul%s_%04d", limpio, abs(sum(utf8ToInt(codigo))) %% 10000)
}

aula <- function(codigo, unidad, rol, facultad, elegibles, validas_meta,
                 estado_muestra, reemplaza = NULL, orden = 1, s1 = "Mujer", s2 = "Hombre") {
  out <- list(
    classroom_id = .qa_classroom_id(codigo), collection_unit_id = unidad, operational_code = codigo,
    label = sprintf("Aula %s", codigo), course_name = sprintf("Curso %s", codigo),
    schedule = "Lun 08:00", teacher = sprintf("Docente %s", codigo),
    teacher_phone = sprintf("9%08d", abs(sum(utf8ToInt(codigo))) * 137 %% 100000000),
    teacher_email = sprintf("docente.%s@ejemplo.edu", tolower(gsub("[^A-Za-z0-9]", "", codigo))),
    sample_role = rol, wave = "M1", orden = orden,
    eligible_n = elegibles, expected_valid = validas_meta,
    faculty = facultad, stratum = facultad, level = "Pregrado",
    sample_status = estado_muestra,
    contact_attempts = if (identical(estado_muestra, "agendada")) 1L else 3L,
    contact_medium = "Correo",
    # Composicion por sexo: sin ella la seccion de cuotas sale vacia (L20).
    sex_top_1 = s1, sex_top_1_n = ceiling(elegibles * 0.55),
    sex_top_2 = s2, sex_top_2_n = elegibles - ceiling(elegibles * 0.55),
    link = sprintf("https://ee.kobotoolbox.org/x/abc123?d[collectorID]=%s", codigo)
  )
  if (!is.null(reemplaza)) {
    # Como lo escribe el motor de verdad: el CLASSROOM_ID del titular, no su
    # codigo operativo. El codigo operativo del titular viaja aparte.
    out$replacement_for <- .qa_classroom_id(reemplaza)
    out$titular_operational_code <- reemplaza
  }
  # Las reservas llegan de Calculo de muestra con su advertencia de ponderacion,
  # que es la que la app tiene que enseniar al activarlas. Sin ella el fixture no
  # produce el caso y el aviso no se puede ver en pantalla.
  if (identical(rol, "chain_reserve")) {
    out$activation_weight_status <- "reserve_conditional"
    out$analysis_weight_warning <- paste(
      "Reserva condicional: usar peso analitico final solo si se activa en campo",
      "y se ajusta no respuesta.")
  }
  out
}

plan <- list(
  aula("CH 1", "u-ch1", "titular", "Ciencias", 30, 20, "agendada", orden = 1),
  aula("CH 2", "u-ch2", "titular", "Ciencias", 30, 20, "agendada", orden = 2),
  aula("CH 3", "u-ch3", "titular", "Letras",   25, 18, "agendada", orden = 3),
  aula("CH 4", "u-ch4", "titular", "Letras",   25, 18, "reemplazada", orden = 4),
  aula("CH 5", "u-ch5", "titular", "Derecho",  40, 28, "agendada", orden = 5),
  # Cadena de cuatro: con una sola reserva no se ve si la tabla distingue el
  # orden ni el estado, que es justo lo que importa al decidir a quien activar.
  aula("R 4.1", "u-r41", "chain_reserve", "Letras", 22, 16, "reemplazada",
       reemplaza = "CH 4", orden = 6),
  aula("R 4.2", "u-r42", "chain_reserve", "Letras", 20, 14, "agendada",
       reemplaza = "CH 4", orden = 7),
  aula("R 4.3", "u-r43", "chain_reserve", "Letras", 21, 15, "en_reserva",
       reemplaza = "CH 4", orden = 8),
  aula("R 4.4", "u-r44", "chain_reserve", "Letras", 19, 13, "en_reserva",
       reemplaza = "CH 4", orden = 9),
  # El BANCO: reservas que el diseño dejo sueltas, sin colgar de ningun titular.
  # El fixture no tenia ni una y por eso las dos vistas de cadena podian contar
  # cada aula del banco como su propia cadena sin que nada se pusiera rojo. En
  # HSVG2026 son 639 contra 202 titulares, asi que no es un caso de borde.
  aula("EXTRA 1", "u-x1", "extra_reserve_pool", "Ciencias", 28, 19, "en_reserva", orden = 10),
  aula("EXTRA 2", "u-x2", "extra_reserve_pool", "Derecho",  32, 22, "en_reserva", orden = 11)
)

# --- Las respuestas ----------------------------------------------------------
# Llegan como las devuelve Kobo cuando el QR lo genero este mismo sistema: el
# aula viaja en `collectorID`, no en una columna que alguien mapeo a mano.
respuesta <- function(unidad, sexo, valida = TRUE) list(
  collectorID = unidad,
  sexo = sexo,
  `_validation_status` = if (valida) "" else "on_hold",
  `_submission_time` = "2026-08-14T10:00:00"
)

filas <- c(
  # CH 1 llega a su meta.
  lapply(seq_len(20), function(i) respuesta("u-ch1", if (i %% 2) "Mujer" else "Hombre")),
  # CH 2 con 5 de 30: el caso que antes se declaraba «cerrando».
  lapply(seq_len(5), function(i) respuesta("u-ch2", "Mujer")),
  # La reserva activada produce campo real; su titular no.
  lapply(seq_len(9), function(i) respuesta("u-r41", if (i %% 3) "Hombre" else "Mujer")),
  # Un aula que no existe en el plan: el aviso que antes nunca saltaba (L22).
  list(respuesta("u-fantasma", "Mujer"))
)

data <- do.call(rbind, lapply(filas, function(r) as.data.frame(r, stringsAsFactors = FALSE)))
names(data) <- gsub("^X_", "_", names(data))

partes <- list(
  list(operational_code = "CH 1", intento = 1L, observed_students = 22,
       refusals = 1, duplicates = 1, effective_surveys = 20,
       applicator = "Equipo A", application_status = "aplicada"),
  list(operational_code = "CH 2", intento = 1L, observed_students = 8,
       refusals = 2, duplicates = 0, effective_surveys = 5,
       applicator = "Equipo A", application_status = "aplicada"),
  # Descuadre deliberado: 12 - 1 - 0 son 11, no 9. Es el control de L33.
  list(operational_code = "R 4.1", intento = 1L, observed_students = 12,
       refusals = 1, duplicates = 0, effective_surveys = 9,
       applicator = "Equipo B", application_status = "aplicada")
)

if (ESCALA_2025) {
  # El reparto usa `length(facs)` y NO un `%% 6` a mano. Con el numero fijo, la
  # lista podia crecer a veinte y seguian saliendo seis: el fixture ignoraba en
  # silencio lo que se le añadia, que es la peor forma de no cubrir un caso.
  # VEINTE facultades, que es el techo del rango real: los estudios de este tipo
  # manejan de 11 a 20, y el estudio de 2026 trae 15. El fixture tenia SEIS, asi
  # que ninguna vista por facultad podia enseñar como se comporta a escala —ni
  # la reja de tarjetas de Extras, ni la lista de avance, ni el compacto de
  # 1024x600—. Los nombres son los reales del estudio, sin tildes por el locale
  # del generador.
  facs <- c(
    "Ciencias e Ingenieria", "Estudios Generales Letras", "Gestion",
    "Arquitectura y Urbanismo", "Educacion", "Derecho",
    "Estudios Generales Ciencias", "Arte y Diseño", "Ciencias Sociales",
    "Ciencias y Artes de la Comunicacion", "Artes Escenicas", "Psicologia",
    "Letras y Ciencias Humanas", "Ciencias Contables", "Administracion",
    "Trabajo Social", "Publicidad", "Ingenieria Industrial",
    "Ingenieria de Minas", "Ciencias de la Informacion"
  )
  # Una agenda real ocupa dos semanas de campo, no un solo «Lun 08:00» repetido
  # 196 veces. Con la fecha constante, cualquier lectura por dia sale degenerada
  # —un solo dia con todo dentro— y el fixture excluiria por construccion el
  # caso que la seccion Agenda existe para mostrar.
  # Los motivos que el equipo declara al dar de baja un aula. Son los de
  # `monitoreo_aulas_motivos_reemplazo()`: uno inventado se normaliza a «otro».
  MOTIVOS <- c("docente_no_autoriza", "aula_no_existe", "horario_cambio", "baja_asistencia")
  # **El unico dia que no se hace campo es el DOMINGO.** El sembrado saltaba dos
  # dias cada cinco —semana de lunes a viernes— y el grafico enseñaba el sabado
  # en blanco como si el operativo se parara. Gonzalo: «el unico dia que no se
  # hace campo es el domingo, solo deberia estar vacio el domingo, no haber mas
  # saltos de dias». El hueco era del fixture, no del campo.
  dias <- c("Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado")
  INICIO_DE_CAMPO <- as.Date("2026-08-10")  # lunes
  #' El n-esimo dia de campo desde el inicio, contando desde 0 y saltando domingos.
  dia_de_campo <- function(n) {
    d <- INICIO_DE_CAMPO
    quedan <- n
    while (quedan > 0L) {
      d <- d + 1L
      if (format(d, "%w") != "0") quedan <- quedan - 1L
    }
    format(d, "%Y-%m-%d")
  }
  horas <- c("08:00", "10:00", "12:00", "14:00", "16:00", "18:00")
  base <- function(cod, rol, fac, i, repl = NULL, ord = NULL, est = "agendada") {
    # El dia NO puede salir de `i %% 10` a secas: la facultad sale de `i %% 20`
    # y 10 divide a 20, asi que cada facultad caia SIEMPRE en el mismo dia. Con
    # eso, cualquier vista de ritmo por facultad enseñaba «314 encuestas en 1
    # dia» para las veinte y la tendencia era incalculable en todas —la vista
    # existia y no podia enseñar nada—. Sumando `i %/% 20L` el dia avanza dentro
    # de cada facultad y las series se reparten por el rango.
    dia_i <- 1L + ((i + (i %/% 20L)) %% 10L)
    fecha <- dia_de_campo(dia_i - 1L)
    # El nombre del dia sale de la FECHA. Con `dias[[1 + (dia_i - 1) %% 5]]` se
    # inventaba un dia de la semana que no coincidia con la fecha sembrada.
    nombre_dia <- dias[[as.integer(format(as.Date(fecha), "%w"))]]
    hora <- horas[[1L + (i %% length(horas))]]
    # `SESIONES Y AULA` del Excel es un texto DESCRIPTIVO —«LUN 08:00 A101»—, no
    # el codigo con un prefijo. Sembrandolo como «Aula CH 24» junto a la columna
    # «CH 24», la tabla de brechas ensenaba dos columnas que parecian la misma y
    # el panel se veia redundante por culpa del dato de prueba, no del producto.
    pabellon <- c("A", "H", "L", "N", "V", "Z")[[1L + (i %% 6L)]]
    # El `classroom_id` NO es el codigo operativo, y esa diferencia es la que
    # hacia invisible un defecto entero: valiendo lo mismo, `replacement_for`
    # —que guarda el classroom_id del titular— coincidia por accidente con el
    # codigo operativo y la cadena se agrupaba bien de casualidad. Sobre
    # HSVG2026, donde no coinciden, 0 de 202 apuntaban a un titular.
    o <- list(classroom_id = .qa_classroom_id(cod), operational_code = cod,
              label = sprintf("%s %s %s%d",
                              toupper(substr(nombre_dia, 1, 3)),
                              hora, pabellon, 100L + (i %% 40L)),
              course_name = paste("Curso", cod),
              scheduled_date = fecha,
              scheduled_day = nombre_dia,
              scheduled_time = hora,
              schedule = sprintf("%s %s", substr(nombre_dia, 1, 3), hora),
              teacher = paste("Docente", cod), teacher_phone = sprintf("9%08d", i * 137 %% 1e8),
              # La OBSERVACION de quien agendo, que el libro real trae en la
              # columna OBSERVACIONES y el motor deja en `replacement_note`.
              # Sembrada en 1 de cada 5: el fixture no la traia y por eso la
              # columna era INEJERCITABLE —el dato llegaba, tenia rotulo y
              # ninguna superficie lo pedia, asi que anadirlo no se habria visto—.
              # Textos del tipo que el equipo escribe de verdad: condiciones para
              # entrar al aula, no prosa.
              replacement_note = if (i %% 5L == 0L) {
                c("El docente pide llegar 10 min antes",
                  "Aula cambiada la semana pasada, confirmar al llegar",
                  "Solo permite los ultimos 15 min de clase",
                  "Coordinar con jefe de practica, no con el docente",
                  "Grupo pequeno, confirmar si vale la pena")[[1L + ((i %/% 5L) %% 5L)]]
              } else "",
              faculty = fac, stratum = fac, level = "Pregrado", sample_role = rol,
              wave = if (rol == "titular") "M1" else sprintf("M%d", (ord %||% 1) + 1),
              orden = i, eligible_n = 20 + (i %% 25), enrolled_total = 25 + (i %% 25),
              # Dos aulas SIN meta declarada. Ocurre de verdad —una reserva que
              # entra al plan sin que nadie le fije cuantas validas se le piden—
              # y con las 196 declarando meta, las dos superficies que avisan de
              # ello (`AulasAvanceEnRespuestas` y `AulasCoberturaChart`) no se
              # ven NUNCA aunque esten escritas.
              expected_valid = if (i %in% c(58L, 133L)) 0 else max(1, round((20 + (i %% 25)) * 0.7)),
              sample_status = est,
              sex_top_1 = "F", sex_top_1_n = 11 + (i %% 8),
              sex_top_2 = "M", sex_top_2_n = 9 + (i %% 6),
              link = sprintf("https://ee.kobotoolbox.org/x/abc?d[collectorID]=%s", cod))
    # Los tres estados de la ficha, que el motor DERIVA de los materiales. Con
    # enlace en todas y PDF en ninguna, el fixture sólo producía uno de los tres
    # y los otros dos no se podían ver en pantalla.
    if (i %% 11 == 0) o$link <- ""                              # sin enlace todavía
    if (i %% 5 == 0 && nzchar(o$link)) o$pdf_link <- sprintf("/fichas/%s.pdf", gsub(" ", "_", cod))
    if (!is.null(repl)) {
      # Como lo escribe el motor de verdad: el CLASSROOM_ID del titular. El
      # codigo operativo del titular viaja aparte, en su propio campo.
      o$replacement_for <- .qa_classroom_id(repl)
      o$titular_operational_code <- repl
      o$replacement_order <- ord
    }
    if (identical(rol, "chain_reserve")) {
      o$activation_weight_status <- "reserve_conditional"
      o$analysis_weight_warning <- paste(
        "Reserva condicional: usar peso analitico final solo si se activa en campo",
        "y se ajusta no respuesta.")
      # El motivo de la ACTIVACION vive en la reserva; el del REEMPLAZO, en la
      # que cayo. Sin sembrar los dos, la columna «Motivo» de la cadena sale
      # vacia y no se puede ver que cada fila lo saca de su propio campo.
      if (identical(est, "agendada")) o$activation_reason <- MOTIVOS[[1 + (i %% length(MOTIVOS))]]
    }
    # El CICLO DE CONTACTO, que es la razon de ser de la hoja «Aulas Agendadas»:
    # a quien se llama, por que medio, que dia y cuantas veces. El fixture no lo
    # sembraba a esta escala, asi que las tres columnas salian vacias y la tabla
    # —con razon— las descartaba: la dimension AGENDA se veia sin lo unico que
    # solo ella recoge. Los medios son los observados en el estudio de 2025:
    # Llamada (123) y Correo Electronico (33).
    # El medio y su desenlace, con la relacion MEDIDA en el libro real de 2025
    # (194 filas): la llamada es mayoritaria —123 contra 31— y agenda mejor,
    # 80 % contra 65 %, con 2 intentos de mediana contra 3.
    #
    # El fixture repartia 50/50 y daba EXACTAMENTE el mismo desenlace a los dos
    # —13 reemplazadas, 80 agendadas y 5 en reserva cada uno—, asi que la
    # pregunta «¿que medio agenda mejor?» no tenia respuesta posible: cualquier
    # vista habria enseñado dos columnas iguales.
    #
    # OJO con la media de intentos del libro real: sale 19,65 para el correo
    # porque la columna tiene FECHAS DE EXCEL filtradas (45909, 23252). Con los
    # valores absurdos fuera, la mediana es 2 contra 3.
    o$contact_medium <- if ((i %% 4L) == 0L) "Correo Electrónico" else "Llamada"
    o$contact_date <- format(as.Date("2026-08-03") + (i %% 5L), "%Y-%m-%d")
    # Quien costo mas intentos es a quien hay que mirar: por eso no es constante.
    # Intentos segun el medio, con las medianas del real: 2 la llamada, 3 el
    # correo, y la cola larga que el libro tambien tiene (max 7).
    o$contact_attempts <- if (identical(o$contact_medium, "Correo Electrónico")) {
      2L + (i %% 5L)
    } else {
      1L + (i %% 3L)
    }
    if (identical(est, "reemplazada")) {
      o$replacement_reason <- MOTIVOS[[1 + (i %% length(MOTIVOS))]]
      # CUANDO cayo, que es lo que permite medir a que ritmo se consume el
      # banco. El campo existe en el lector (`replaced_at`) y tiene rotulo
      # («Reemplazada el»), y el fixture no lo sembraba: sin fecha, «cuantas
      # aulas nos quedan» se puede contestar pero «cuando se acaban» no.
      # Repartidas por los primeros dias de campo, que es cuando caen de verdad:
      # un aula se cae al intentar aplicarla, no despues.
      o$replaced_at <- format(as.Date("2026-08-10") + ((i %% 6L) + (i %/% 12L)), "%Y-%m-%d")
    }
    o
  }
  plan <- c(
    lapply(1:170, function(i) base(sprintf("CH %d", i), "titular", facs[[1 + (i %% length(facs))]], i,
                                   est = if (i <= 24) "reemplazada" else "agendada")),
    lapply(1:24, function(k) base(sprintf("R %d.1", k), "chain_reserve", facs[[1 + (k %% length(facs))]],
                                  170 + k, repl = sprintf("CH %d", k), ord = 1,
                                  est = if (k <= 2) "reemplazada" else if (k %% 3 == 0) "en_reserva" else "agendada")),
    # `en_reserva` y no `agendada`: una reserva agendada YA esta en campo y no
    # esta disponible. Con todas agendadas, NINGUNA cadena tenia reserva libre y
    # activar un reemplazo devolvia siempre «cadena agotada» — el camino que la
    # accion existe para recorrer no se podia probar en pantalla.
    lapply(1:2, function(k) base(sprintf("R %d.2", k), "chain_reserve", facs[[1 + (k %% length(facs))]],
                                 194 + k, repl = sprintf("CH %d", k), ord = 2,
                                 est = "en_reserva")),
    # El BANCO: reservas sueltas que no cuelgan de ningun titular. El estudio
    # real lleva 639 contra 202 titulares, asi que no es un caso de borde; aqui
    # bastan unas pocas para que las vistas de cadena puedan ejercitarlo.
    # Cuarenta extras, dos por facultad: la reja de tarjetas de la pestaña se
    # dibuja con una por facultad, asi que con seis no se veia como se comporta
    # a veinte —que es el techo del rango real—.
    lapply(1:40, function(k) base(sprintf("EXTRA %d", k), "extra_reserve_pool",
                                  facs[[1 + (k %% length(facs))]], 210 + k, est = "en_reserva"))
  )
  aplicadas_todas <- Filter(function(r) !identical(r$sample_status, "reemplazada"), plan)
  # AULAS AGENDADAS POR DELANTE: con fecha posterior al ultimo parte y SIN parte.
  #
  # Sin ellas la zona inferida del grafico de rendimiento —la que se calcula
  # sobre la agenda— no se puede ver en pantalla: el fixture cerraba el campo
  # entero y no quedaba nada por aplicar. Es la decima vez en este loop que el
  # fixture decide lo que se puede ver.
  #
  # Se apartan una de cada nueve y se reparten en los CINCO dias de campo que
  # siguen al ultimo con parte, sin dejar ningun dia en medio: Gonzalo, «se
  # agendan varios dias de antelacion, de 4 a 6 dias». Antes arrancaba el 24/08
  # con el ultimo parte el 20/08, asi que el grafico enseñaba tres dias vacios
  # seguidos y parecia que el operativo se paraba —era el fixture, no el campo—.
  # Con esto hay facultades de las tres clases: las que con lo agendado llegan a
  # su cuota, las que no llegan, y las que no tienen nada agendado.
  por_venir_i <- which(seq_along(aplicadas_todas) %% 9L == 0L)
  aplicadas <- aplicadas_todas[setdiff(seq_along(aplicadas_todas), por_venir_i)]
  for (k in seq_along(por_venir_i)) {
    j <- por_venir_i[[k]]
    codigo <- as.character(aplicadas_todas[[j]]$operational_code)
    nueva <- dia_de_campo(9L + 1L + ((k - 1L) %% 5L))
    for (m in seq_along(plan)) {
      if (identical(as.character(plan[[m]]$operational_code), codigo)) {
        plan[[m]]$scheduled_date <- nueva
        plan[[m]]$operational_status <- "agendada"
        break
      }
    }
  }
  # Cuanta gente hubo de verdad en cada aula. Vive AQUI porque el parte de campo
  # es quien la cuenta —el aplicador, en el momento— y la Base de control la
  # copia despues. Sembrarla dos veces con formulas distintas dejaba las dos
  # hojas contando la misma aula y discrepando en las 114 comparables.
  .asistentes <- function(i, u) {
    asistencia <- if (i %% 11 == 0) 1.2 else c(0.55, 0.7, 0.85, 0.95)[[1 + (i %% 4)]]
    max(1, round(as.numeric(u$eligible_n) * asistencia))
  }
  partes <- lapply(seq_along(aplicadas), function(i) {
    u <- aplicadas[[i]]; asist <- .asistentes(i, u); rech <- i %% 3; dup <- i %% 4
    efec <- asist - rech - dup
    if (i %in% c(7L, 88L)) efec <- efec - 1
    list(operational_code = as.character(u$operational_code), intento = 1L,
         observed_students = asist, refusals = rech, duplicates = dup,
         effective_surveys = efec, applied_by = sprintf("Equipo %d", 1 + (i %% 6)),
         # El porcentaje que el equipo escribe a mano en la hoja, sobre el total
         # de matriculados. En dos aulas se siembra INCOHERENTE con los
         # asistentes que la misma fila declara: es el caso que un cuadre entre
         # las dos hojas tiene que encontrar, y sin el, cero discrepancias
         # significaria «coinciden» y no «no se comprobo».
         attendance_pct = round(asist / (as.numeric(u$eligible_n) + 10), 3) *
           (if (i %in% c(12L, 140L)) 0.5 else 1),
         # Lo que el parte DICE QUE PASO, que es su razon de ser y no se sembraba:
         # en que aula se aplico de verdad, cuando, en que estado quedo y que
         # anoto quien estuvo. Sin estos cinco, la dimension CAMPO llegaba a la
         # pantalla como pura aritmetica del cuadre.
         #
         # El aula REAL suele ser la agendada, y a veces no: es justo el dato por
         # el que existe una columna «AULA» en la hoja de campo separada de la
         # del plan. Una de cada siete se movio.
         # El aula REAL, y cuando cambia cambia de verdad: OTRO salon, no el
         # mismo con un sufijo. El fixture ponia «MIE 10:00 H131 (cambio)» sobre
         # el mismo H131, asi que comparar codigos de salon daba CERO cambios y
         # comparar cadenas enteras daba treinta falsos. Ninguna de las dos
         # sirve para el libro real, donde `AULA` es solo el codigo —«D102»— y
         # un cambio es otro salon distinto.
         actual_room = if (i %% 7 == 0) {
           sub("[A-Z][0-9]{3}$",
               sprintf("%s%d", c("A","H","L","N","V","Z")[[1L + ((i + 3L) %% 6L)]],
                       100L + ((i + 17L) %% 40L)),
               as.character(u$label))
         } else as.character(u$label),
         applied_date = as.character(u$scheduled_date %||% ""),
         applied_time = as.character(u$scheduled_time %||% ""),
         # Una de cada trece no se pudo aplicar. Con todas en «APLICADA» la
         # columna no distingue nada y da igual mostrarla que no.
         application_status = if (i %% 13 == 0) "NO APLICADA" else "APLICADA",
         field_note = if (i %% 9 == 0) "El docente pidio empezar al final de la clase" else "")
  })
  asistentes_del_parte <- stats::setNames(
    lapply(partes, function(p) p$observed_students),
    vapply(partes, function(p) as.character(p$operational_code), character(1))
  )
  # 3700 respuestas, que es a lo que llega el estudio real desde Kobo, con el
  # ancho de una base de verdad: 43 columnas, no dos.
  set.seed(1)
  n <- 3700L
  # Las respuestas iban TODAS a `CH 25`..`CH 169`, y las cadenas son `CH 1`..
  # `CH 24` con sus reservas: por construccion ninguna reserva recibia una sola
  # respuesta, asi que la vista de cadenas mostraba «0 de N» en las 24 y el caso
  # que el operativo pregunta —cual reemplazo llego a la meta— no existia en el
  # fixture. Las ultimas 92 se reparten entre tres reservas activas para que dos
  # cadenas CIERREN en su reemplazo y se pueda verificar en pantalla.
  #
  # Metas de esas tres, por `expected_valid = round(eligible * 0.7)`:
  #   R 3.1 -> 30 · R 4.1 -> 31 · R 1.2 -> 28
  cierres <- c(rep("R 3.1", 31), rep("R 4.1", 32), rep("R 1.2", 29))
  # El reparto NO es round-robin. Lo era —cada aula recibia las mismas ~25
  # respuestas— y con metas entre 14 y 31 eso dejaba solo dos resultados
  # posibles: cumplida, o entre el 51 % y el 99 %. Las bandas «1-25 %» y
  # «26-50 %» del grafico de cobertura salian VACIAS por construccion, y ese
  # grafico y el de estado partian los mismos 196 en los mismos tres grupos: uno
  # parecia repetir al otro cuando en realidad era el fixture el que no tenia
  # nada que distinguir.
  #
  # Un operativo real reparte de todo: aulas donde el docente dejo pasar cinco
  # minutos al final, aulas a medias y aulas que se pasan de su meta. El factor
  # se asigna por posicion para que sea reproducible sin depender del sorteo.
  codigos <- sprintf("CH %d", 25:169)
  elegibles <- 20 + ((25:169) %% 25)
  metas <- pmax(1, round(elegibles * 0.7))
  factor <- vapply(25:169, function(k) switch(as.character(k %% 12),
    "0" = 0.08,   # apenas se empezo
    "1" = 0.22,
    "2" = 0.45,
    "3" = 0.72,
    1.06          # el resto llega o se pasa
  ), numeric(1))
  deseado <- pmax(0L, as.integer(round(metas * factor)))
  # Se escala para que el total siga siendo exactamente 3700 con los 92 cierres
  # aparte: la escala del fixture es parte de lo que se prueba.
  restantes <- n - length(cierres)
  deseado <- as.integer(round(deseado * restantes / sum(deseado)))
  sobra <- restantes - sum(deseado)
  if (sobra != 0L) deseado[[which.max(deseado)]] <- deseado[[which.max(deseado)]] + sobra
  destinos <- c(rep(codigos, times = deseado), cierres)
  # La marca de envio es el DIA EN QUE SE APLICO ESA AULA, no una progresion.
  #
  # Antes salia de `2026-08-01 + 300s` por fila, y eso producia dos cosas que el
  # panel de ritmo dejo a la vista: trece dias practicamente identicos —287,
  # 288, 288…—, que no se parecen a ningun operativo, y un calendario del 1 al 13
  # de agosto cuando la agenda del plan va del 10 al 21. O sea, respuestas
  # llegando antes de que las aulas estuvieran agendadas.
  #
  # Una encuesta de aula se contesta EN la clase, asi que su fecha es la de la
  # sesion. Con eso el ritmo hereda la forma real de la agenda —los dias con mas
  # aulas rinden mas, y el fin de semana queda en cero— sin inventar nada.
  fecha_de_unidad <- stats::setNames(
    vapply(plan, function(u) as.character(u$scheduled_date %||% ""), character(1)),
    vapply(plan, function(u) as.character(u$operational_code %||% ""), character(1))
  )
  dia_destino <- unname(fecha_de_unidad[destinos])
  dia_destino[is.na(dia_destino) | !nzchar(dia_destino)] <- "2026-08-10"
  # Dentro del dia, repartidas por la sesion: la hora exacta no la mira nadie,
  # pero un lote entero a las 00:00 haria que cualquier lectura por hora saliera
  # degenerada.
  minuto <- (seq_len(n) * 7L) %% 300L
  data <- data.frame(
    collectorID = destinos,
    sexo = rep(c("F", "M"), length.out = n),
    `_submission_time` = format(
      as.POSIXct(paste0(dia_destino, " 08:00:00"), tz = "UTC") + (minuto * 60L),
      "%Y-%m-%dT%H:%M:%S"),
    check.names = FALSE, stringsAsFactors = FALSE)
  for (k in 1:40) data[[sprintf("p%02d", k)]] <- rep(1:5, length.out = n)
}

# «Base de control» del libro: el control de calidad que el equipo calcula en su
# Excel. Se siembra sobre las aulas que ya se aplicaron y se deja a un tercio SIN
# llenar, que es como llega un libro a mitad de operativo — y es justo el caso
# que la vista tiene que saber distinguir de un control en cero.
control <- lapply(seq_along(aplicadas), function(i) {
  u <- aplicadas[[i]]
  base <- list(
    operational_code = as.character(u$operational_code),
    classroom_id = as.character(u$operational_code),
    wave = "M1", course_name = as.character(u$course_name),
    room = as.character(u$label), schedule = as.character(u$schedule),
    enrolled_total = as.numeric(u$eligible_n) + 10,
    eligible_n = as.numeric(u$eligible_n),
    # Normalmente el mismo equipo que firmo el parte. En UNA aula se siembra
    # distinto: es una de las tres ramas del cuadre entre las dos hojas, y sin
    # ella esa rama no aparece nunca en pantalla aunque el motor la sepa hacer.
    applied_by = if (i == 61L) "Equipo 9" else sprintf("Equipo %d", 1 + (i %% 6)),
    application_status = "APLICADA"
  )
  if (i %% 3 == 0) return(base)
  # Los DOS denominadores del 70 %, y en la relacion que tienen de verdad.
  #
  # Antes 70T salia de `eligible_n + 10` y 70P de `eligible_n`, o sea el umbral
  # de asistentes por ENCIMA del de matriculados. Con esa relacion, cumplir 70T
  # implica cumplir 70P y el caso «llego al de asistentes y no al de
  # matriculados» no puede existir: las 39 aulas que cumplian uno solo eran las
  # 39 el mismo caso. Y es al reves de como ocurre — a clase va menos gente de
  # la matriculada, asi que el umbral de asistentes es normalmente el mas bajo.
  #
  # Ahora la asistencia manda: `asistentes = matriculados x asistencia`, 70T
  # sale de los asistentes y 70P de los matriculados elegibles. Una de cada
  # once tiene MAS presentes que elegibles —oyentes y alumnos de otra seccion,
  # que asisten pero no estan en el padron—: es el unico modo de que la rama
  # contraria tambien exista, y ocurre en campo.
  matriculados <- as.numeric(u$eligible_n)
  # Lo que el plan le pide a este curso. Las dos aulas sin meta declarada la
  # dejan en NA a proposito: la hoja tambien tiene celdas vacias.
  cuota_del_plan <- suppressWarnings(as.numeric(u$expected_valid %||% NA))
  # Los asistentes NO se recalculan: los conto el aplicador en el parte de
  # campo y esta hoja los copia. Dos formulas para la misma aula dejaban las
  # dos hojas discrepando en las 114 comparables, que es ruido y no senal.
  asistentes <- as.numeric(asistentes_del_parte[[as.character(u$operational_code)]] %||% matriculados)
  # Y en UNA el revisor corrigio la cuenta del aplicador. Es lo que un cuadre
  # entre las dos hojas existe para encontrar; con las 114 coincidiendo, esa
  # rama no se veria nunca. Va DESPUES de copiar del parte para que se lea que
  # es una excepcion deliberada y no otra formula paralela.
  if (i == 47L) asistentes <- asistentes - 3
  enviadas <- if (i %% 7 == 1) round(matriculados * 0.4)
              else max(1, round(asistentes * c(0.75, 0.9, 0.65)[[1 + (i %% 3)]]))
  mujeres <- floor(enviadas * 0.6)
  c(base, list(
    sent_total = enviadas,
    sent_vs_total = round(enviadas / asistentes, 3),
    sent_vs_population = round(enviadas / matriculados, 3),
    # DOS INVARIANTES del libro real, medidas sobre sus 194 filas y sin una sola
    # excepcion (2026-08-18):
    #   VALIDADOR 1 + 2 + 3 == TOTAL CORTAS        (394 = 394)
    #   CORTAS + LARGAS     == TOTAL ENVIADAS      (394 + 3 304 = 3 698)
    # O sea: toda encuesta enviada es corta o larga, y toda corta cae por UNO de
    # los tres validadores —no son tres revisores, son tres motivos de descarte—.
    # El fixture las violaba las dos: sembraba `i %% 2 / 0 / i %% 3` contra un
    # `short_total = i %% 4` sin relacion, y `validator_2` era SIEMPRE cero. Con
    # eso, cualquier lectura sobre los validadores habria sido falsa y ninguna
    # comprobacion la habria pillado.
    # Proporciones tomadas del real: 10,7 % de descarte, repartido 60/25/15.
    validator_1 = .cortas_v1(enviadas, i), validator_2 = .cortas_v2(enviadas, i),
    validator_3 = .cortas_v3(enviadas, i),
    short_total = .cortas(enviadas, i),
    short_vs_total = round(.cortas(enviadas, i) / max(enviadas, 1), 3),
    long_total = enviadas - .cortas(enviadas, i),
    long_vs_total = round((enviadas - .cortas(enviadas, i)) / max(enviadas, 1), 3),
    threshold_total = round(0.7 * asistentes),
    threshold_population = round(0.7 * matriculados),
    valid_total = if (enviadas >= 0.7 * asistentes) 1 else 0,
    valid_population = if (enviadas >= 0.7 * matriculados) 1 else 0,
    # «Control - duracion» se deja SIN LLENAR entero, que es como llega un
    # libro a media faena: el equipo cierra Cuenta primero y el ultimo dia de
    # respuesta lo anota al final. Sin esto, los cuatro grupos venian llenos y
    # la linea «Sin llenar en el libro: …» no aparecia nunca.
    last_response_day = "",
    observed_students = asistentes,
    non_respondents = i %% 5,
    attendance_pct = round(asistentes / as.numeric(base$enrolled_total), 3),
    # La CUOTA es lo que el plan pide de ese curso (`expected_valid`), NO sus
    # matriculados elegibles. Sembrandola sobre `eligible_n` salia exactamente
    # la misma division que `sent_vs_population` —que ya es enviadas sobre
    # matriculados—, y las dos columnas coincidian en las 210 filas: ninguna
    # sesion podia ver que miden cosas distintas. Es la novena vez en este loop
    # que el fixture decide lo que se puede ver.
    quota_pct = if (is.na(cuota_del_plan) || cuota_del_plan <= 0) NA_real_
                else round(enviadas / cuota_del_plan, 3),
    quota_missing = if (is.na(cuota_del_plan)) NA_real_
                    else max(0, cuota_del_plan - enviadas),
    women_n = mujeres, men_n = enviadas - mujeres,
    women_pct = round(mujeres / max(enviadas, 1), 3),
    men_pct = round((enviadas - mujeres) / max(enviadas, 1), 3),
    schedule_norm = as.character(u$scheduled_time %||% "08:00"),
    schedule_range = if (i %% 7 == 0) "FUERA DE RANGO" else "EN RANGO"
  ))
})

sid <- session_create()
session_set(sid, "monitoreo_aulas_plan", plan)
session_set(sid, "monitoreo_aulas_control", control)
# El recibo del libro, como lo deja `aulas_libro_importar_en_sesion`. Sin el, la
# tarjeta del libro en Fuentes no existe en el fixture y no habria como verla.
# Se declara «Base de control» presente y las 7 columnas sin nombre del 2025.
libro_recibo <- list(
  importado_en = "2026-08-17T09:30:00Z",
  hojas_ausentes = list(),
  control_sin_nombre = as.list(seq_len(7L)),
  resumen = list(unidades = length(plan), titulares = 170L,
                 partes_de_campo = length(partes), filas_de_control = length(control))
)
session_set(sid, "monitoreo_aulas_libro", libro_recibo)
session_set(sid, "monitoreo_aulas_partes_campo", partes)
session_set(sid, "monitoreo_config", monitoreo_normalize_config(list(
  monitoreo_profile = list(family = "aulas_universitarias", variant = "multi_actor",
                           status = "active", route_selected = TRUE),
  aulas_universitarias = list(
    enabled = TRUE, plan = plan, partes_campo = partes, control = control, libro = libro_recibo,
    # SIN `status_var`: es lo que hace hoy un estudio real de Kobo recien
    # conectado. Declararlo apuntando a `_validation_status` descarta TODAS las
    # respuestas, porque Kobo deja esa columna vacia mientras nadie las revisa
    # a mano —y "" no esta entre los estados validos. Es la otra cara de L12.
    source_mapping = list(collector_var = "collectorID"),
    # Siete columnas huerfanas, como las que trae la Base de control del estudio
    # de 2025: tienen datos y su cabecera esta vacia en la hoja.
    control_sin_nombre = 7L
  )
)))
session_set(sid, "monitoreo_snapshot", list(
  synced_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
  data = data
))
session_set(sid, "monitoreo_sources", list(list(
  id = "src-kobo-aulas", kind = "kobo", label = "Aplicacion en aulas",
  role = "principal", status = "ready"
)))

invisible(capture.output(build_pulso(sid, destino, project_name = "QA aulas en campo")))

tablero <- monitoreo_aulas_dashboard(plan, data, monitoreo_aulas_normalize_config(list(
  enabled = TRUE, plan = plan, partes_campo = partes, control = control, libro = libro_recibo,
  source_mapping = list(collector_var = "collectorID"),
  control_sin_nombre = 7L
)))

cat(sprintf("proyecto: %s (%.1f KB)\n", destino, file.size(destino) / 1024))
cat(sprintf("aulas: %s · respuestas sembradas: %s\n", length(plan), nrow(data)))
k <- tablero$kpis %||% list()
cat(sprintf("KPI aulas aplicadas: %s · validas: %s\n",
            k$aulas_aplicadas %||% 0L, k$respuestas_validas %||% 0L))
seccion <- function(titulo, filas, campos) {
  cat(sprintf("\n%s (%s)\n", titulo, length(filas)))
  for (r in utils::head(filas, 8)) {
    cat("  ", paste(vapply(campos, function(k) sprintf("%s=%s", k, r[[k]] %||% "-"), character(1)),
                    collapse = " · "), "\n", sep = "")
  }
}
# `application_state` vive en `course_status`, NO en `agenda`: la agenda es el
# plan con sus contadores, y el estado de aplicacion es un derivado aparte.
# Mirarlo en la lista equivocada devuelve vacio y parece un defecto.
seccion("Estado de aplicacion por aula", tablero$course_status %||% list(),
        c("operational_code", "respuestas_validas", "expected_valid", "brecha", "application_state"))
seccion("Avance por estrato", tablero$avance_por_estrato %||% list(),
        c("stratum", "aulas", "respuestas_validas", "brecha"))
seccion("Reemplazos", tablero$reemplazos %||% list(),
        c("operational_code", "replacement_for", "sample_role"))
seccion("Cuotas sexo x facultad", tablero$cuotas_sexo_facultad %||% tablero$quotas_sex_faculty %||% list(),
        c("faculty", "sex", "target", "observed", "status"))
cat("\nControles\n")
for (r in (tablero$validation %||% list())) {
  cat(sprintf("  [%s] %s — %s\n", r$status %||% "?", r$check %||% "?", r$detail %||% ""))
}

# Lo que la PLATAFORMA sabe de cada aula, y quién cuenta como aplicada.
#
# Primer día de campo de HSVG2026 (2026-09-07). El bloque de conteo de la «Base
# de control» salía vacío —eran fórmulas del Excel de 2025—, la tarjeta de la
# app decía «1 aula aplicada» con ocho produciendo encuestas, y el avance por
# facultad enseñaba «Aulas aplicadas: 0» en las quince. Las tres cifras
# preguntan lo mismo y ahora tienen una sola respuesta.

.mcc_plan <- function() list(
  list(operational_code = "CH 1", classroom_id = "1iee12_0521",
       sample_role = "titular", faculty = "Ciencias", eligible_n = 30,
       enrolled_total = 32, scheduled_date = "2026-09-07", expected_valid = 16),
  list(operational_code = "CH 2", classroom_id = "1let44_0002",
       sample_role = "titular", faculty = "Letras", eligible_n = 20,
       enrolled_total = 22, scheduled_date = "2026-09-07", expected_valid = 12)
)

# El QR de HSVG2026 viaja con el CÓDIGO OPERATIVO, no con `classroom_id`: es la
# clave que rompió el reparto por sexo por facultad.
.mcc_respuestas <- function() data.frame(
  collectorID = c(rep("CH 1", 6), "CH 2", "CAPACITACION", "PRUEBA_2026"),
  consent = c("1", "1", "1", "1", "2", "1", "1", "1", "1"),
  filtro  = c("1", "1", "1", "1", "1", "2", "1", "1", "1"),
  sexo    = c("1", "1", "2", "2", "1", "1", "1", "1", "2"),
  `_submission_time` = c("2026-09-07T10:00:00", "2026-09-07T10:05:00",
                         "2026-09-08T09:00:00", "2026-09-07T10:20:00",
                         "2026-09-07T10:30:00", "2026-09-07T10:40:00",
                         "2026-09-07T11:00:00", "2026-09-06T08:00:00",
                         "2026-09-06T08:10:00"),
  check.names = FALSE, stringsAsFactors = FALSE
)

.mcc_cfg <- function(...) monitoreo_aulas_normalize_config(utils::modifyList(list(
  source_mapping = list(
    valid_filters = list(list(var = "consent", values = "1"),
                         list(var = "filtro", values = "1")),
    sex_var = "sexo", sex_female_values = list("1"), sex_male_values = list("2"),
    descartes = list(list(var = "collectorID",
                          values = c("CAPACITACION", "PRUEBA_2026")))
  )
), list(...)))

test_that("los conteos por aula separan lo enviado de lo efectivo", {
  ct <- monitoreo_aulas_conteos_control(.mcc_plan(), .mcc_respuestas(), .mcc_cfg())
  expect_equal(unname(ct$enviadas[["CH 1"]]), 6)
  # De las seis, una no consiente y otra no pasa el filtro.
  expect_equal(unname(ct$efectivas[["CH 1"]]), 4)
  expect_equal(unname(ct$no_efectivas[["CH 1"]]), 2)
  # El ÚLTIMO día con respuesta, no el primero: la columna pregunta hasta
  # cuándo siguió entrando gente.
  expect_identical(unname(ct$ultimo_dia[["CH 1"]]), "2026-09-08")
})

test_that("cada filtro se cuenta por separado y su cabecera dice cuál es", {
  ct <- monitoreo_aulas_conteos_control(.mcc_plan(), .mcc_respuestas(), .mcc_cfg())
  expect_length(ct$filtros, 2L)
  # **Cuenta las que CAEN, no las que pasan.** Gonzalo, 2026-09-08: «son los que
  # se quedan en el filtro, no los que los pasan». «Se cayó 1 en el
  # consentimiento» dice dónde se pierde; «pasaron 5» obliga a restar contra las
  # enviadas para saber lo mismo.
  #
  # Y por separado, no acumulado: acumulándolos, el último repetiría a las no
  # efectivas y los otros no dirían dónde cae cada respuesta.
  expect_equal(unname(ct$filtros[[1]]$conteo[["CH 1"]]), 1)  # una no consiente
  expect_equal(unname(ct$filtros[[2]]$conteo[["CH 1"]]), 1)  # otra no pasa filtro
  # El nombre de la variable va entre paréntesis y NO sustituye al rótulo: es
  # un documento formal, no una hoja de depuración.
  expect_identical(ct$filtros[[1]]$titulo, "FILTRO DE VALIDACIÓN 1 (consent)")
})

test_that("lo declarado como descarte no cuenta aunque la encuesta esté completa", {
  # El QR de capacitación y el de prueba producen envíos REALES que pasan todos
  # los filtros —son encuestas bien llenadas— y no son del operativo. 26 de
  # CAPACITACION y 9 de PRUEBA_2026 el primer día de HSVG2026.
  d <- .mcc_respuestas()
  con <- prosecnurapp:::.monitoreo_aulas_valid_response(d, .mcc_cfg())
  expect_equal(sum(con), 5L)
  # Sin declararlos, las dos de capacitación contarían: el descarte es una
  # DECLARACIÓN del estudio, no una heurística sobre el nombre del colector.
  # (`modifyList` no borra con una lista vacía —sólo modifica lo que la lista
  # nueva nombra—, así que el config sin descartes se arma entero.)
  cfg_sin <- .mcc_cfg()
  cfg_sin$source_mapping$descartes <- list()
  sin <- prosecnurapp:::.monitoreo_aulas_valid_response(d, cfg_sin)
  expect_equal(sum(sin), 7L)
})

test_that("un aula con respuestas está aplicada aunque nadie escriba su parte", {
  plan <- .mcc_plan()
  ef <- c("CH 1" = 4, "CH 2" = 0)
  apl <- monitoreo_aulas_aula_aplicada(plan, partes = list(), efectivas = ef)
  expect_identical(apl, c(TRUE, FALSE))
  # El parte manda cuando existe Y ESTÁ FIRMADO: es el veredicto de quien
  # estuvo ahí, y una firma es lo que dice que alguien estuvo.
  #
  # Cambio deliberado del 2026-09-18. Gonzalo: «la fuente de verdad es Kobo
  # —y es la fuente de verdad la que cuenta las efectivas siempre en TODA LA
  # APP—, el parte de la ficha solo reporta lo que los aplicadores ven»; «me
  # preocupa que hayan pensado que se aplicó CH 3 cuando jamás se aplicó».
  # Medido ese día sobre HSVG2026: de 150 partes sólo CUATRO no traen ni fecha
  # ni aplicador, y de ellos los dos que pierden la marca son justo los dos que
  # no se aplicaron —CH 3, y CH 131 cuya nota dice «Se utilizó el reemplazo
  # R131.1»—. Los otros dos tienen 11 respuestas en Kobo y siguen contando.
  apl2 <- monitoreo_aulas_aula_aplicada(
    plan, partes = list(list(operational_code = "CH 2", estado = "APLICADA",
                             applied_date = "2026-09-15")),
    efectivas = ef)
  expect_identical(apl2, c(TRUE, TRUE))
  # Sin firma y sin respuestas, no: un acta que nadie firmó no prueba la visita.
  sin_firma <- monitoreo_aulas_aula_aplicada(
    plan, partes = list(list(operational_code = "CH 2", estado = "APLICADA")),
    efectivas = ef)
  expect_identical(sin_firma, c(TRUE, FALSE))
  # Y sin ninguna de las dos, no se declara aplicada: cero respuestas y «no
  # sabemos» son la misma noticia aquí, y ninguna dice que alguien fue.
  expect_identical(
    monitoreo_aulas_aula_aplicada(plan, partes = list(), efectivas = NULL),
    c(FALSE, FALSE)
  )
})

test_that("el avance por facultad cuenta aulas aplicadas y reparte por sexo", {
  cfg <- .mcc_cfg()
  d <- .mcc_respuestas()
  plan <- .mcc_plan()
  ef <- monitoreo_aulas_efectivas_por_aula(plan, d, cfg)
  cuotas <- list(
    meta_diseno = 100, meta_operativa = 150,
    facultades = list(
      list(facultad = "Ciencias", cuota = 40, cuota_sexo = list(F = 20, M = 20)),
      list(facultad = "Letras", cuota = 30, cuota_sexo = list(F = 15, M = 15))
    )
  )
  f <- prosecnurapp:::.calaf_avance_por_facultad(
    plan, efectivas = ef, cuotas = cuotas, responses = d,
    validas = prosecnurapp:::.monitoreo_aulas_valid_response(d, cfg),
    cfg = cfg)
  ciencias <- f[f$Facultad == "Ciencias", , drop = FALSE]
  # **Aplicadas: 1, no 0.** El eje era `operational_status` —el del CIRCUITO,
  # que el libro nunca mueve a «aplicada»— y la columna salía en cero en las
  # quince facultades con ocho aulas produciendo.
  expect_equal(ciencias[["Aulas aplicadas"]], 1L)
  # Las columnas se llaman «Efectivas» desde el dictado de Gonzalo del
  # 2026-09-08 (antes «Conseguidas»); el dato es el mismo.
  expect_equal(ciencias[["Efectivas"]], 4)
  # **Y el reparto por sexo existe.** Se cruzaba por `classroom_id` mientras el
  # QR de este estudio viaja con el código operativo, así que ninguna respuesta
  # encontraba su facultad. De las cuatro efectivas de CH 1, dos y dos.
  expect_equal(ciencias[["Efectivas mujeres"]], 2)
  expect_equal(ciencias[["Efectivas hombres"]], 2)
  # La facultad sin respuestas dice CERO, no «no sabemos»: la variable de sexo
  # está declarada y el cruce corrió.
  letras <- f[f$Facultad == "Letras", , drop = FALSE]
  expect_equal(letras[["Efectivas mujeres"]], 1)
})

# ---------------------------------------------------------------------------
# **La hora del aula es la LOCAL, y con UTC un aula de la tarde cambia de día.**
#
# La «Base de control» decía «HORA DE APLICACIÓN 16:33» para un curso-horario
# agendado a las 11:30 am: Kobo publica `_submission_time` en UTC y toda la
# lectura temporal del perfil lo prefería. Este operativo agenda hasta las 19:30
# de Lima —00:30 UTC del día siguiente—, así que la fecha también se corría.
# ---------------------------------------------------------------------------

test_that("manda la marca que trae su huso, no la del servidor", {
  d <- data.frame(
    collectorID = c("CH 1", "CH 1"),
    # 19:30 de Lima el día 7 son las 00:30 UTC del 8.
    start = c("2026-09-07T19:32:10.001-05:00", "2026-09-07T19:41:02.500-05:00"),
    `_submission_time` = c("2026-09-08T00:32:11", "2026-09-08T00:41:03"),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  ct <- monitoreo_aulas_conteos_control(
    list(list(operational_code = "CH 1", classroom_id = "CH 1",
              sample_role = "titular", eligible_n = 30)),
    d, monitoreo_aulas_normalize_config(list()))
  # El DÍA es el 7, la jornada en que se aplicó, no el 8 del servidor.
  expect_identical(unname(ct$primer_dia[["CH 1"]]), "2026-09-07")
  expect_identical(unname(ct$ultimo_dia[["CH 1"]]), "2026-09-07")
  # Y la hora es la del salón.
  expect_identical(unname(ct$primera_hora[["CH 1"]]), "19:32")
})

test_that("sin columna con huso se lee la del servidor, y no se rompe", {
  # Un export que sólo trae `_submission_time` se sigue leyendo: la preferencia
  # es un orden, no una exigencia.
  d <- data.frame(
    collectorID = "CH 1",
    `_submission_time` = "2026-09-07T14:05:00",
    check.names = FALSE, stringsAsFactors = FALSE
  )
  ct <- monitoreo_aulas_conteos_control(
    list(list(operational_code = "CH 1", classroom_id = "CH 1",
              sample_role = "titular", eligible_n = 30)),
    d, monitoreo_aulas_normalize_config(list()))
  expect_identical(unname(ct$primer_dia[["CH 1"]]), "2026-09-07")
  expect_identical(unname(ct$primera_hora[["CH 1"]]), "14:05")
})

test_that("sin parte, el bloque de campo lo llenan el reparto y la plataforma", {
  # «¿Y por qué así sigue vacío?» — ocho cursos-horario aplicados y un parte de
  # nueve filas. Quién iba lo dice el REPARTO y cuándo empezó lo dicen las
  # respuestas; ALUMNOS EN AULA se queda vacía porque sólo lo sabe quien estuvo.
  plan <- list(list(operational_code = "CH 1", classroom_id = "CH 1",
                    sample_role = "titular", eligible_n = 30, enrolled_total = 32,
                    scheduled_date = "2026-09-07", expected_valid = 16))
  d <- data.frame(
    collectorID = c("CH 1", "CH 1"),
    start = c("2026-09-07T11:33:00-05:00", "2026-09-07T11:44:00-05:00"),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  cfg <- monitoreo_aulas_normalize_config(list())
  h <- aulas_libro_hoja_control(
    plan, control = list(), efectivas = c(`CH 1` = 2), partes = list(),
    conteos = monitoreo_aulas_conteos_control(plan, d, cfg), cfg = cfg,
    asignados = list(`CH 1` = "Aguilar Cuya, Renzo"))
  hdr <- as.character(unlist(h[2, ], use.names = FALSE))
  fila <- as.character(unlist(h[3, ], use.names = FALSE))
  de <- function(t) fila[[which(hdr == t)[[1]]]]
  expect_identical(de("APLICADOR"), "Aguilar Cuya, Renzo")
  expect_identical(de("FECHA DE APLICACIÓN"), "2026-09-07")
  expect_identical(de("HORA DE APLICACIÓN"), "11:33")
  expect_identical(de("ESTADO DE APLICACIÓN"), "EN APLICACIÓN")
  # Nadie puede saber cuánta gente había: se queda vacía en vez de inventarse.
  expect_identical(de("ALUMNOS EN AULA"), "")
})

test_that("y cuando hay parte, manda el parte", {
  # Quien fue de verdad puede no ser quien estaba asignado, y la hoja cuenta lo
  # ocurrido, no lo planeado. Misma precedencia que el «Plan del día».
  plan <- list(list(operational_code = "CH 1", classroom_id = "CH 1",
                    sample_role = "titular", eligible_n = 30, enrolled_total = 32))
  d <- data.frame(collectorID = "CH 1", start = "2026-09-07T11:33:00-05:00",
                  check.names = FALSE, stringsAsFactors = FALSE)
  cfg <- monitoreo_aulas_normalize_config(list())
  h <- aulas_libro_hoja_control(
    plan, control = list(), efectivas = c(`CH 1` = 1),
    partes = list(list(operational_code = "CH 1", aplicador = "Quien fue de verdad",
                       fecha = "2026-09-07", hora = "11:25", estado = "APLICADA",
                       asistentes = 41)),
    conteos = monitoreo_aulas_conteos_control(plan, d, cfg), cfg = cfg,
    asignados = list(`CH 1` = "Quien estaba asignado"))
  hdr <- as.character(unlist(h[2, ], use.names = FALSE))
  fila <- as.character(unlist(h[3, ], use.names = FALSE))
  de <- function(t) fila[[which(hdr == t)[[1]]]]
  expect_identical(de("APLICADOR"), "Quien fue de verdad")
  expect_identical(de("HORA DE APLICACIÓN"), "11:25")
  expect_identical(de("ESTADO DE APLICACIÓN"), "APLICADA")
  expect_identical(de("ALUMNOS EN AULA"), "41")
})

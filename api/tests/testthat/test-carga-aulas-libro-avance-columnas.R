# =============================================================================
# El vocabulario de «Avance de campo»: una lista, tres consumidores
# =============================================================================
#
# `carga_aulas_libro_avance_columnas.R` declara los rótulos de las cinco tablas
# y la naturaleza de cada uno. Lo leen TRES sitios —el writer del xlsx, el
# renderer del Sheets y el formateador de la pestaña— y de ahí el riesgo que
# esta suite cubre: que la lista y el modelo se separen sin que nada avise.
#
# Es el modo de fallo más caro de este libro. En un solo día costó seis anclas
# mudas: `pon()` dejó de escribir cuatro columnas al renombrarlas, dos estilos
# quedaron fijados a una posición, y un techo de 188 aulas salió publicado como
# «18800,0 %» porque una columna nueva corrió el índice del porcentaje. Ninguno
# de los seis dio error: todos siguieron en verde escribiendo en el sitio
# equivocado.

.calac_ind <- function() {
  plan <- list(
    list(operational_code = "CH 1", classroom_id = "A1", sample_role = "titular",
         faculty = "Letras", eligible_n = 30, expected_valid = 20,
         rendimiento_ref = 0.6, scheduled_time = "10:00"),
    list(operational_code = "CH 2", classroom_id = "A2", sample_role = "titular",
         faculty = "Letras", eligible_n = 30, expected_valid = 20,
         rendimiento_ref = 0.6, scheduled_time = "19:30")
  )
  resp <- data.frame(
    collectorID = c("CH 1", "CH 1", "CH 2"),
    `_submission_time` = c("2026-08-10T09:00:00", "2026-08-10T10:00:00",
                           "2026-08-11T09:00:00"),
    sexo = c("Mujer", "Hombre", "Mujer"),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  aulas_libro_indicadores(
    plan, efectivas = c(`CH 1` = 18, `CH 2` = 12), responses = resp,
    validas = c(TRUE, TRUE, TRUE),
    cuotas = list(meta_diseno = 40, meta_operativa = 60,
                  facultades = list(list(facultad = "Letras", cuota = 40,
                                         cuota_sexo = list(F = 20, M = 20)))),
    cfg = list(source_mapping = list(collector_var = "collectorID")),
    asignados = list(`CH 1` = "Equipo A", `CH 2` = "Equipo A")
  )
}

test_that("las cinco tablas del vocabulario existen en el modelo, con SUS columnas", {
  ind <- .calac_ind()
  expect_setequal(names(AULAS_AVANCE_CABECERAS),
                  c("general", "facultad", "rendimiento", "aplicador", "diario"))
  for (clave in names(AULAS_AVANCE_CABECERAS)) {
    campo <- AULAS_AVANCE_CAMPOS[[clave]]
    tabla <- ind[[campo]]
    expect_true(is.data.frame(tabla) && nrow(tabla) > 0L,
                info = sprintf("el modelo no trae «%s» (campo `%s`)", clave, campo))
    expect_identical(names(tabla), AULAS_AVANCE_CABECERAS[[clave]],
                     info = sprintf("las columnas de «%s» no son las del vocabulario", clave))
  }
})

test_that("el campo del modelo de cada tabla se declara, no se adivina", {
  # `ind[["facultad"]]` devuelve NULL sin avisar —la clave es singular y el
  # campo plural— y con eso el ancho de la hoja del xlsx salió de 10 columnas
  # en vez de 17: todas las bandas de sección y todas las notas se quedaron
  # cortas, y la hoja seguía escribiéndose sin error.
  expect_setequal(names(AULAS_AVANCE_CAMPOS), names(AULAS_AVANCE_CABECERAS))
  ind <- .calac_ind()
  for (campo in AULAS_AVANCE_CAMPOS) {
    expect_true(campo %in% names(ind),
                info = sprintf("`%s` no es un campo del modelo", campo))
  }
})

test_that("cada tabla tiene su título de bloque y ninguno se repite", {
  expect_setequal(names(AULAS_AVANCE_TITULOS), names(AULAS_AVANCE_CABECERAS))
  expect_length(unique(unname(AULAS_AVANCE_TITULOS)), 5L)
})

test_that("ningún rótulo lleva «(%)»: el porcentaje es formato de celda", {
  # Gonzalo, 2026-09-08: «el (%) significa que va en porcentaje, no que les
  # pongas "(%)" al titulo».
  rotulos <- c(unlist(AULAS_AVANCE_CABECERAS, use.names = FALSE),
               AULAS_AVANCE_FILAS_GENERAL)
  expect_false(any(grepl("%", rotulos, fixed = TRUE)))
})

test_that("«tasa de facultad» se escribe con su nombre completo", {
  # Gonzalo, el mismo día: «la "tasa de facultad" es en realidad la "Tasa de
  # rendimiento de la facultad" y debe tener ese nombre».
  tasas <- grep("^Tasa", unlist(AULAS_AVANCE_CABECERAS, use.names = FALSE), value = TRUE)
  expect_gte(length(tasas), 4L)
  expect_true(all(grepl("rendimiento", tasas)))
})

test_that("la naturaleza de un rótulo se decide POR TABLA, no en una lista plana", {
  # Las dos tablas tienen su «Efectivas esperadas» y su diferencia, y no son la
  # misma unidad: puntos porcentuales en «Diferencia de tasa», encuestas en
  # «Diferencia de efectivas». Cuando las dos se llamaban «Diferencia» y la
  # lista era plana, el −35 encuestas de un martes salía como «−3 500,0 %».
  expect_true(prosecnurapp:::.calac_es_proporcion("Diferencia de tasa", "rendimiento"))
  expect_true(prosecnurapp:::.calac_es_proporcion("Diferencia de tasa", "diario"))
  expect_false(prosecnurapp:::.calac_es_proporcion("Diferencia de efectivas", "diario"))
  expect_false(prosecnurapp:::.calac_es_proporcion("Efectivas esperadas", "rendimiento"))
  # Y toda proporción declarada pertenece a la cabecera (o a las filas) de SU
  # tabla: una entrada huérfana no pintaría nada y nadie lo notaría.
  for (clave in names(AULAS_AVANCE_PROPORCIONES)) {
    universo <- if (identical(clave, "general")) {
      AULAS_AVANCE_FILAS_GENERAL
    } else {
      AULAS_AVANCE_CABECERAS[[clave]]
    }
    huerfanas <- setdiff(AULAS_AVANCE_PROPORCIONES[[clave]], universo)
    expect_length(huerfanas, 0L)
  }
})

test_that("todo rótulo de diferencia o de faltantes existe en alguna tabla", {
  universo <- c(unlist(AULAS_AVANCE_CABECERAS, use.names = FALSE),
                AULAS_AVANCE_FILAS_GENERAL)
  for (lista in list(AULAS_AVANCE_DIFERENCIAS, AULAS_AVANCE_FALTAN_MUESTRA,
                     AULAS_AVANCE_FALTAN_SOBREMUESTRA)) {
    expect_length(setdiff(lista, universo), 0L)
  }
  # Y las dos familias de faltantes no se solapan: una celda no puede pintarse
  # a la vez de verde por la muestra y de celeste por la sobremuestra.
  expect_length(intersect(AULAS_AVANCE_FALTAN_MUESTRA,
                          AULAS_AVANCE_FALTAN_SOBREMUESTRA), 0L)
})

test_that("una cabecera se reconoce por la fila ENTERA, no por su primera celda", {
  # Cuatro de las cinco tablas empiezan por «Facultad» desde el 2026-09-08.
  for (clave in names(AULAS_AVANCE_CABECERAS)) {
    expect_identical(
      prosecnurapp:::.calac_tabla_de_cabecera(AULAS_AVANCE_CABECERAS[[clave]]), clave)
  }
  expect_identical(prosecnurapp:::.calac_tabla_de_cabecera(c("Facultad", "otra cosa")), "")
  expect_identical(prosecnurapp:::.calac_tabla_de_cabecera(character(0)), "")
  # Una fila con celdas vacías al final sigue siendo su cabecera: el renderer
  # rellena a lo ancho de la hoja y la cabecera más corta viaja con cola.
  expect_identical(
    prosecnurapp:::.calac_tabla_de_cabecera(c(AULAS_AVANCE_CABECERAS$general, "", "")),
    "general")
})

test_that("la tasa esperada de una facultad es UNA, y es la misma en las tres tablas", {
  # **No es el promedio de las tasas de sus aulas.** `rendimiento_ref` viaja por
  # AULA —sale de los tramos de elegibles— y dentro de una facultad va de 44 % a
  # 80 %. Se vio publicado el 2026-09-08: la columna «Tasa de rendimiento
  # esperada EN FACULTAD» daba 69,0 % a una persona y 55,0 % a la de al lado en
  # la misma facultad. Es la razón de los agregados: lo que el diseño espera de
  # esa facultad entre los elegibles que pone.
  plan <- list(
    list(operational_code = "CH 1", classroom_id = "A1", sample_role = "titular",
         faculty = "Letras", eligible_n = 100, expected_valid = 60,
         rendimiento_ref = 0.6, scheduled_time = "10:00"),
    # Un aula chica con una tasa muy distinta: promediar 0.6 y 0.9 daría 0.75,
    # y la vara real de la facultad es 70/110 = 63,6 %.
    list(operational_code = "CH 2", classroom_id = "A2", sample_role = "titular",
         faculty = "Letras", eligible_n = 10, expected_valid = 9,
         rendimiento_ref = 0.9, scheduled_time = "10:00")
  )
  resp <- data.frame(
    collectorID = rep("CH 1", 30),
    `_submission_time` = rep("2026-09-07T10:00:00", 30),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  ind <- aulas_libro_indicadores(
    plan, efectivas = c(`CH 1` = 30), responses = resp, validas = rep(TRUE, 30),
    cuotas = list(meta_diseno = 100,
                  facultades = list(list(facultad = "Letras", cuota = 100))),
    cfg = list(source_mapping = list(collector_var = "collectorID")),
    asignados = list(`CH 1` = "PEREZ GOMEZ, ANA", `CH 2` = "LOPEZ RUIZ, JOSE"))

  esperada <- 69 / 110
  expect_equal(ind$rendimiento[["Tasa de rendimiento de la facultad esperada"]], esperada)
  # La misma cifra para TODA la facultad en la tabla de aplicadores: la columna
  # promete una vara de facultad, no la media de las aulas de cada quien.
  expect_equal(unique(ind$aplicadores[["Tasa de rendimiento esperada en facultad"]]), esperada)
  expect_equal(unique(ind$diario[["Tasa de rendimiento de la facultad esperada"]]), esperada)
  # Y no es el promedio de las tasas por aula, que daría 0.75.
  expect_false(isTRUE(all.equal(esperada, 0.75)))
})

test_that("el avance diario se ordena por DÍA y dentro por facultad", {
  # Gonzalo, 2026-09-08, viendo la tabla publicada: «esto debe estar ordenado
  # por día y luego por facultad». Se calcula por facultad —el acumulado corre
  # dentro de cada una— pero no se lee así: quien abre la tabla mira la jornada
  # de ayer entera, no el historial de una facultad.
  plan <- list(
    list(operational_code = "CH 1", classroom_id = "A1", sample_role = "titular",
         faculty = "Zeta", eligible_n = 40, expected_valid = 24),
    list(operational_code = "CH 2", classroom_id = "A2", sample_role = "titular",
         faculty = "Alfa", eligible_n = 40, expected_valid = 24)
  )
  resp <- data.frame(
    collectorID = c("CH 1", "CH 2", "CH 1", "CH 2"),
    `_submission_time` = c("2026-09-07T10:00:00", "2026-09-07T11:00:00",
                           "2026-09-08T10:00:00", "2026-09-08T11:00:00"),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  ind <- aulas_libro_indicadores(
    plan, efectivas = c(`CH 1` = 2, `CH 2` = 2), responses = resp,
    validas = rep(TRUE, 4),
    cuotas = list(meta_diseno = 100, facultades = list(
      list(facultad = "Zeta", cuota = 50), list(facultad = "Alfa", cuota = 50))),
    cfg = list(source_mapping = list(collector_var = "collectorID")))
  d <- ind$diario
  expect_identical(d[["Día"]], c("2026-09-07", "2026-09-07", "2026-09-08", "2026-09-08"))
  expect_identical(d$Facultad, c("Alfa", "Zeta", "Alfa", "Zeta"))
  # Y el acumulado sigue siendo el de CADA facultad, no el del orden de lectura:
  # reordenar es presentación y no puede tocar el cálculo.
  expect_identical(d[["Efectivas acumuladas"]], c(1, 1, 2, 2))
})

test_that("una cabecera larga hace crecer su fila: WRAP reparte, no estira", {
  # Se vio publicado el 2026-09-08: «Tasa de rendimiento de la facultad
  # esperada» salía como «Tasa de / rendimiento de la» y el resto cortado,
  # porque `wrapStrategy = WRAP` reparte el texto en líneas pero deja la fila
  # con su alto por defecto.
  anchos <- rep(120L, 3L)
  corta <- prosecnurapp:::.maaf_alto_de_cabecera(c("Día", "Total", "Aulas"), anchos)
  larga <- prosecnirapp <- prosecnurapp:::.maaf_alto_de_cabecera(
    c("Facultad", "Tasa de rendimiento de la facultad esperada", "Aulas"), anchos)
  expect_gt(larga, corta)
  expect_lte(larga, 120L)
  expect_gte(corta, 30L)
})

test_that("la portada dice la HORA de la última actualización, y sale del estado", {
  # Gonzalo, 2026-09-08: «aquí está el día pero falta la hora última de
  # actualización». La marca es `synced_at` del estado y NUNCA el reloj: dos
  # publicaciones sin sincronizar escriben la misma celda, y el motor
  # batch+hash no reescribe la pestaña por eso.
  ind <- .calac_ind()
  linea <- function(actualizado) {
    as.character(aulas_libro_hoja_avance(
      ind, fecha = as.Date("2026-09-08"), actualizado = actualizado)[[2]][[1]])
  }
  # Mismo día que el corte: basta la hora, en hora local de Lima.
  expect_match(linea("2026-09-08T19:16:22Z"), "^Al 08/09/2026 · datos de plataforma actualizados a las [0-9]{2}:[0-9]{2}$")
  # Otro día: se dice entero, que es justo la noticia (los datos son de ayer).
  expect_match(linea("2026-09-07T22:05:00Z"), "actualizados el 07/09/2026 [0-9]{2}:[0-9]{2}$")
  # Sin marca, la portada es la de siempre: no se inventa una hora.
  expect_identical(linea(""), "Al 08/09/2026")
  # Y el renderer sigue sin consultar el reloj en su cuerpo.
  cuerpo <- paste(deparse(body(aulas_libro_hoja_avance)), collapse = " ")
  expect_false(grepl("Sys.Date|Sys.time", cuerpo))
})

test_that("los tres rangos de aplicación usan los cortes que dictó Gonzalo: 9:00 y 18:00", {
  # Textual, 2026-09-08 por la tarde: «Es el horario de inicio de aplicación, no
  # el que viene a oficina o en el que sale de oficina, sino el de aplicación.
  # El regular es de 9am a 6pm; antes es especial mañana y después es especial
  # noche.» Los cortes que había (8:00 y 19:00) los había deducido yo del plan.
  rango <- function(h) prosecnurapp:::.calg_rango_de_aplicacion(h)
  expect_identical(rango("08:59"), "Especial mañana")
  expect_identical(rango("09:00"), "Regular")
  expect_identical(rango("17:59"), "Regular")
  expect_identical(rango("18:00"), "Especial noche")
  expect_identical(rango("19:30"), "Especial noche")
  # Sin hora no se clasifica: inventar un rango pondría una aula en un tramo
  # que no le toca y la Base de control lo publica como dato.
  expect_identical(rango(""), "")
})

test_that("«Aulas adicionales solicitadas» suma las activadas y las que el equipo ya agendó", {
  # Gonzalo, 2026-09-08: «cualquier aula pedida de más sobre el plan original,
  # venga del banco o la haya conseguido el equipo por su cuenta». Las dos
  # listas son disjuntas —el libro se queda con las activadas y el banco con el
  # resto— así que sumarlas no duplica.
  plan <- list(
    list(operational_code = "CH 1", classroom_id = "A1", sample_role = "titular",
         faculty = "Letras", eligible_n = 40, expected_valid = 24),
    # Una extra ACTIVADA: tiene efectivas, así que entró al libro.
    list(operational_code = "EX 1", classroom_id = "E1",
         sample_role = "extra_reserve_pool", faculty = "Letras",
         eligible_n = 40, expected_valid = 24)
  )
  # Y dos del banco sin activar: una que el equipo YA AGENDÓ en la hoja
  # «(Extra)» y otra que nadie tocó. La segunda está disponible, no solicitada.
  banco <- list(
    list(operational_code = "EX 2", sample_role = "extra_reserve_pool",
         faculty = "Letras", scheduled_date = "2026-09-10"),
    list(operational_code = "EX 3", sample_role = "extra_reserve_pool",
         faculty = "Letras")
  )
  ind <- aulas_libro_indicadores(plan, efectivas = c(`CH 1` = 12, `EX 1` = 8),
                                 extras = banco)
  expect_equal(ind$rendimiento[["Aulas adicionales solicitadas hasta el momento"]], 2L)
  # Sin banco, sólo las activadas: el argumento es opcional y no cambia nada más.
  sin <- aulas_libro_indicadores(plan, efectivas = c(`CH 1` = 12, `EX 1` = 8))
  expect_equal(sin$rendimiento[["Aulas adicionales solicitadas hasta el momento"]], 1L)
})

test_that("las «Efectivas esperadas» del día salen de las aulas YA APLICADAS ese día", {
  # Gonzalo, 2026-09-08, viendo la tabla publicada: «las efectivas esperadas son
  # las de los cursos-horario que ya se han aplicado en el día, no todas las
  # planificadas del día, ¿verdad? porque lo segundo no sería justo».
  #
  # Esta columna se midió sobre las AGENDADAS durante un rato, por una respuesta
  # suya que llegó por otra vía. El test existe para que no vuelva: comparar las
  # efectivas de un día contra la meta de todo lo agendado castiga a la facultad
  # por las aulas a las que todavía no ha ido.
  plan <- list(
    list(operational_code = "CH 1", classroom_id = "A1", sample_role = "titular",
         faculty = "Letras", eligible_n = 40, expected_valid = 24,
         scheduled_date = "2026-09-07"),
    # Agendada el mismo lunes y NO aplicada: su meta no entra en las esperadas
    # del lunes.
    list(operational_code = "CH 2", classroom_id = "A2", sample_role = "titular",
         faculty = "Letras", eligible_n = 40, expected_valid = 30,
         scheduled_date = "2026-09-07")
  )
  resp <- data.frame(
    collectorID = rep("CH 1", 10),
    `_submission_time` = rep("2026-09-07T10:00:00", 10),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  ind <- aulas_libro_indicadores(
    plan, efectivas = c(`CH 1` = 10), responses = resp, validas = rep(TRUE, 10),
    cuotas = list(meta_diseno = 100, facultades = list(list(facultad = "Letras", cuota = 100))),
    cfg = list(source_mapping = list(collector_var = "collectorID")))
  d <- ind$diario
  expect_equal(nrow(d), 1L)
  lunes <- d[d[["Día"]] == "2026-09-07", ]
  # 24, la meta de la única aula aplicada. Con las agendadas serían 54.
  expect_equal(lunes[["Efectivas esperadas"]], 24)
  expect_equal(lunes[["Efectivas del día"]], 10)
  expect_equal(lunes[["Diferencia de efectivas"]], -14)
  # Y la tasa del día se mide sobre los elegibles de esa misma aula, no de las
  # dos: 10 de 40, no 10 de 80.
  expect_equal(lunes[["Tasa de rendimiento de la facultad obtenida"]], 0.25)
  expect_equal(lunes[["Diferencia de tasa"]],
               0.25 - lunes[["Tasa de rendimiento de la facultad esperada"]])
})

test_that("un AVANCE se pinta como un depósito que se llena, nunca en rojo", {
  # Gonzalo pidió primero «de rojo hasta verde y luego celeste» y se corrigió él
  # mismo en el mensaje siguiente: «quizás otra forma de mostrarlo, porque rojo
  # da a entender que es algo malo cuando puede ser sólo que recién esté
  # empezando». Un 19,8 % en el día 2 de tres semanas no es malo, es el día 2.
  # El rojo se queda donde sí hay veredicto: la diferencia contra lo esperado.
  expect_length(intersect(AULAS_AVANCE_AVANCES, AULAS_AVANCE_DIFERENCIAS), 0L)
  rango <- list(sheetId = 1L, startRowIndex = 0L, endRowIndex = 1L,
                startColumnIndex = 1L, endColumnIndex = 2L)
  g <- prosecnurapp:::.maaf_regla_deposito(rango)$addConditionalFormatRule$rule$gradientRule
  # Los dos extremos son la VARA (0 y 100 %), no el rango de los datos: con
  # MIN/MAX un avance del 3 % saldría verde por ser el mayor de una columna que
  # va toda por debajo.
  expect_identical(g$minpoint$value, "0")
  expect_identical(g$maxpoint$value, "1")
  expect_null(g$midpoint)
  # Y el extremo vacío no es rojo: es más claro que oscuro en los tres canales.
  expect_gt(g$minpoint$color$red, 0.9)
  expect_gt(g$minpoint$color$green, 0.9)
  expect_gt(g$minpoint$color$blue, 0.9)
  # El lleno es verde: más verde que rojo.
  expect_gt(g$maxpoint$color$green, g$maxpoint$color$red)
})

test_that("ninguna nota de la hoja lleva em dash", {
  # Gonzalo, 2026-09-08, por segunda vez: «ya te he dicho mil veces que no uses
  # em dashes». El «—» de una celda sin dato es otra cosa y se conserva: ahí es
  # el vacío declarado, no puntuación.
  ind <- .calac_ind()
  filas <- aulas_libro_hoja_avance(ind, fecha = as.Date("2026-09-08"))
  textos <- unlist(lapply(filas, function(f) {
    v <- vapply(f, function(x) if (is.character(x)) x else "", character(1))
    v[nchar(v) > 12L]
  }), use.names = FALSE)
  expect_gt(length(textos), 0L)
  con_guion <- grep(" — ", textos, value = TRUE)
  expect_length(con_guion, 0L)
})

test_that("«Efectivas esperadas» significa lo mismo en las dos tablas que la publican", {
  # Rendimiento por facultad y Avance diario tienen las dos una columna
  # «Efectivas esperadas». Si una sumara las metas de las aulas y la otra
  # aplicara la tasa de la facultad a sus elegibles, serían dos definiciones
  # bajo la misma cabecera: la avería que este libro ya pagó con «Diferencia».
  #
  # Las dos suman `expected_valid`, que además es la misma cifra que la Base de
  # control publica aula por aula.
  plan <- list(
    list(operational_code = "CH 1", classroom_id = "A1", sample_role = "titular",
         faculty = "Letras", eligible_n = 100, expected_valid = 60,
         scheduled_date = "2026-09-07"),
    # Un aula con un factor propio muy distinto del de su facultad: es donde las
    # dos definiciones se separan.
    list(operational_code = "CH 2", classroom_id = "A2", sample_role = "titular",
         faculty = "Letras", eligible_n = 100, expected_valid = 20,
         scheduled_date = "2026-09-08")
  )
  resp <- data.frame(
    collectorID = rep("CH 1", 40),
    `_submission_time` = rep("2026-09-07T10:00:00", 40),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  ind <- aulas_libro_indicadores(
    plan, efectivas = c(`CH 1` = 40), responses = resp, validas = rep(TRUE, 40),
    cuotas = list(meta_diseno = 200, facultades = list(list(facultad = "Letras", cuota = 200))),
    cfg = list(source_mapping = list(collector_var = "collectorID")))

  # Sólo CH 1 está aplicada: 60, su propia meta. La tasa de la facultad es
  # 80/200 = 40 %, que sobre sus 100 elegibles daría 40: la otra definición.
  expect_equal(ind$rendimiento[["Efectivas esperadas"]], 60)
  expect_equal(ind$rendimiento[["Efectivas obtenidas"]], 40)
  expect_equal(ind$rendimiento[["Diferencia de efectivas"]], -20)
  # Y el avance diario dice lo mismo para el mismo día.
  lunes <- ind$diario[ind$diario[["Día"]] == "2026-09-07", ]
  expect_equal(lunes[["Efectivas esperadas"]], 60)
  expect_equal(lunes[["Diferencia de efectivas"]], -20)
  # La tasa de la facultad no se pierde: sigue en su columna.
  expect_equal(ind$rendimiento[["Tasa de rendimiento de la facultad esperada"]], 0.4)
})

test_that("una facultad donde aún no se ha ido calla, en vez de decir «0 de —»", {
  # «0 obtenidas de —» se lee como si la facultad hubiera ido y no hubiera
  # sacado nada. Lo que pasa es que todavía no ha ido, y eso ya lo dice la
  # columna «Aulas aplicadas» con su cero.
  plan <- list(
    list(operational_code = "CH 1", classroom_id = "A1", sample_role = "titular",
         faculty = "Sin visitar", eligible_n = 40, expected_valid = 24)
  )
  r <- aulas_libro_indicadores(plan, efectivas = c(`CH 9` = 0))$rendimiento
  expect_equal(r[["Aulas aplicadas"]], 0L)
  for (col in c("Efectivas esperadas", "Efectivas obtenidas", "Diferencia de efectivas",
                "Tasa de rendimiento de la facultad obtenida", "Diferencia de tasa")) {
    expect_true(is.na(r[[col]]), info = col)
  }
  # La tasa ESPERADA sí se sabe: sale del diseño, no del campo.
  expect_equal(r[["Tasa de rendimiento de la facultad esperada"]], 0.6)
})

test_that("el libro se ordena por CURSO-HORARIO y de forma NUMÉRICA", {
  # Gonzalo, 2026-09-08: «tanto aulas agendadas como aulas aplicadas siguen el
  # orden por CH; la app lo construye así para luego que los responsables lo
  # editan a mano y la app debe poder leerlo así».
  #
  # Iba en el orden del PLAN —agrupado por facultad y dentro por el sorteo— y
  # sobre el libro real daba «CH 1..9, CH 15, CH 23, CH 14, CH 11...». La razón
  # que había para no ordenar era buena: `split()` ordena alfabéticamente y
  # daría «CH 1, CH 10, CH 100». La respuesta es ordenar por la clave NATURAL,
  # no renunciar al orden.
  u <- function(cod, rol = "titular", tit = cod, orden = NA) list(
    operational_code = cod, classroom_id = cod, sample_role = rol,
    titular_operational_code = tit, replacement_order = orden, faculty = "F")
  plan <- list(
    u("CH 10"), u("R 10.2", "chain_reserve", "CH 10", 2), u("R 10.1", "chain_reserve", "CH 10", 1),
    u("CH 2"), u("CH 100"), u("CH 1"), u("CH 20")
  )
  g <- prosecnurapp:::.calg_grupos_cadena(plan)
  expect_identical(names(g), c("CH 1", "CH 2", "CH 10", "CH 20", "CH 100"))
  # Y dentro de la cadena, el titular primero y las reservas por su orden.
  codigos <- vapply(g[["CH 10"]], function(x) x$operational_code, character(1))
  expect_identical(codigos, c("CH 10", "R 10.1", "R 10.2"))
})

test_that("la fecha vuelve a la hoja como la escribe el equipo, no en ISO", {
  # El plan guarda ISO —el avance diario ordena por esa fecha— y el agendador
  # teclea dd/mm/aaaa. Regenerar la hoja con el ISO le cambiaría la forma a sus
  # 125 filas sin que nadie lo pidiera.
  f <- prosecnurapp:::.calg_fecha_txt
  expect_identical(f("2026-09-10"), "10/09/2026")
  # Idempotente: lo que ya está en el formato del equipo no se toca.
  expect_identical(f("10/09/2026"), "10/09/2026")
  # Y lo que no es una fecha se deja intacto: puede ser una nota o una celda a
  # medio llenar, y reescribirla sería inventar.
  expect_identical(f("por confirmar"), "por confirmar")
  expect_identical(f(""), "")
})

test_that("«ficha» significa UNA cosa en el libro: el papel por curso-horario", {
  # Dictado de Gonzalo (2026-09-09): «la ficha es solo una por CH… es si el
  # coordinador de campo registró manualmente lo que el aplicador llenó en su
  # ficha en papel y el coordinador lo ingresa al sheets de registro de campo
  # aulas aplicadas».
  #
  # «Producción por aplicador» llamaba «Fichas …» a lo que cuenta encuestas
  # efectivas —decenas por aula—, mientras el resto del libro usaba «ficha» en
  # el sentido de él («ENLACE DE LA FICHA», «FICHA QR»). Publicado, «Fichas en
  # la base: 27» junto a «Aulas aplicadas: 3» decía veintisiete fichas de tres
  # aulas. Este guard existe para que el nombre no vuelva.
  todas <- unlist(AULAS_AVANCE_CABECERAS, use.names = FALSE)
  con_ficha <- grep("[Ff]icha", todas, value = TRUE)
  expect_length(con_ficha, 0L)
  # Y lo que cuentan esas tres columnas se llama como en sus tablas hermanas.
  expect_true(all(c("Efectivas esperadas", "Efectivas en la base",
                    "Efectivas faltantes") %in% AULAS_AVANCE_CABECERAS$aplicador))
})

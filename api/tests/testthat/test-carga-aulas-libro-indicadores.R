# La hoja «Avance de campo».
# A13a (2026-08-31): era «Cómo va el campo»; Gonzalo: «es AVANCE» — el pin del
# nombre se actualiza deliberadamente, la semántica de cada test no cambia.
#
# Gonzalo: «podria tener una pestaña u hoja con indicadores, pero deben ser
# indicadores UTILES para el campo y para el analista, como la produccion, el
# avance diario, como vamos con la meta».
#
# Es una hoja que no se llena, como las dos retiradas, y la diferencia esta en
# el contenido: «Resumen» contaba lo que ya se sabia al planificar; esto cuenta
# lo que cambia mientras el campo corre.

.ci_plan <- function() list(
  list(operational_code = "CH 1", sample_role = "titular", faculty = "Letras",
       eligible_n = 30, expected_valid = 20),
  list(operational_code = "CH 2", sample_role = "titular", faculty = "Letras",
       eligible_n = 30, expected_valid = 20),
  # Una reserva: no suma meta propia, la cadena espera lo del titular.
  list(operational_code = "R 2.1", sample_role = "chain_reserve",
       titular_operational_code = "CH 2", faculty = "Letras",
       eligible_n = 28, expected_valid = 20)
)

# Desde el 2026-09-08 el avance diario es POR FACULTAD, así que cada respuesta
# tiene que poder encontrar su aula: sin la clave del colector no hay cruce y la
# tabla entera desaparece.
.ci_respuestas <- function() data.frame(
  collectorID = c("CH 1", "CH 1", "CH 2", "CH 1", "CH 2"),
  `_submission_time` = c("2026-08-10T09:00:00", "2026-08-10T10:00:00",
                         "2026-08-11T09:00:00", "2026-08-11T11:00:00",
                         "2026-08-11T12:00:00"),
  sexo = c("Mujer", "Hombre", "Mujer", "Hombre", "Prefiero no decir"),
  check.names = FALSE, stringsAsFactors = FALSE
)

.ci_cfg <- function() list(source_mapping = list(collector_var = "collectorID"))

# La cuota de Letras, para que «Faltantes para la meta» del diario exista: se
# mide contra la MUESTRA de la facultad y sin diseño no hay contra qué medirla.
.ci_cuotas <- function(cuota = 40) list(
  meta_diseno = cuota,
  facultades = list(list(facultad = "Letras", cuota = cuota))
)

test_that("la meta se cuenta sobre TITULARES, no sobre la cadena entera", {
  # Una reserva solo entra si su titular cae: sumar su meta daria un objetivo
  # que nadie va a recoger. Con las tres unidades serian 60.
  ind <- aulas_libro_indicadores(.ci_plan(), efectivas = c(`CH 1` = 18, `CH 2` = 12))
  expect_equal(ind$meta$meta_total, 40)
  expect_equal(ind$meta$logrado, 30)
  expect_equal(ind$meta$falta, 10)
  expect_equal(round(ind$meta$avance, 3), 0.75)
})

test_that("«aulas que llegaron a SU meta» no es lo mismo que el avance global", {
  # Se puede ir al 75 % global con ninguna aula cerrada, y eso cambia a quien
  # se empuja: el numero de la izquierda no dice cuantas aulas quedan a medias.
  ind <- aulas_libro_indicadores(.ci_plan(), efectivas = c(`CH 1` = 20, `CH 2` = 10))
  expect_equal(ind$meta$logrado, 30)
  expect_equal(ind$meta$aulas_cerradas, 1L)
})

test_that("sin efectivas leidas no hay avance, y no es cero", {
  ind <- aulas_libro_indicadores(.ci_plan(), efectivas = NULL)
  expect_true(is.na(ind$meta$avance))
  expect_true(is.na(ind$meta$logrado))
  # Pero la meta si se sabe: viene del plan.
  expect_equal(ind$meta$meta_total, 40)
})

test_that("la serie diaria cuenta EFECTIVAS y cuadra con el logrado", {
  # Contando todas las respuestas, la serie acumulaba 3 700 mientras el logrado
  # eran 2 220, y «falta para la meta» acababa diciendo 47 cuando faltaban
  # 1 527: dos cifras distintas bajo la misma tabla.
  ind <- aulas_libro_indicadores(.ci_plan(), efectivas = c(`CH 1` = 4),
                                 responses = .ci_respuestas(),
                                 validas = c(TRUE, TRUE, TRUE, TRUE, FALSE),
                                 cuotas = .ci_cuotas(), cfg = .ci_cfg())
  # Una fila por FACULTAD y día; aquí hay una sola facultad y dos jornadas.
  expect_equal(nrow(ind$diario), 2L)
  expect_identical(unique(ind$diario$Facultad), "Letras")
  expect_equal(ind$diario[["Efectivas del día"]], c(2, 2))
  expect_equal(utils::tail(ind$diario[["Efectivas acumuladas"]], 1), 4)
  # El acumulado final es el logrado: si no cuadran, una de las dos miente.
  expect_equal(as.numeric(utils::tail(ind$diario[["Efectivas acumuladas"]], 1)),
               as.numeric(ind$meta$logrado))
})

test_that("el avance diario separa las facultades: un buen martes no tapa un martes perdido", {
  # La serie era una fila por jornada del estudio entero, y con quince cuotas
  # que no se compensan entre sí (ADR 0079) esa fila no permitía decidir nada:
  # un martes de 300 efectivas puede ser excelente en una facultad y perdido en
  # otra, y la suma dice «300».
  plan <- c(.ci_plan(), list(
    list(operational_code = "CH 9", sample_role = "titular", faculty = "Derecho",
         eligible_n = 30, expected_valid = 20)))
  resp <- data.frame(
    collectorID = c("CH 1", "CH 1", "CH 9"),
    `_submission_time` = c("2026-08-10T09:00:00", "2026-08-11T09:00:00",
                           "2026-08-11T10:00:00"),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  cuotas <- list(meta_diseno = 60, facultades = list(
    list(facultad = "Letras", cuota = 40), list(facultad = "Derecho", cuota = 20)))
  ind <- aulas_libro_indicadores(plan, efectivas = c(`CH 1` = 2, `CH 9` = 1),
                                 responses = resp, validas = rep(TRUE, 3),
                                 cuotas = cuotas, cfg = .ci_cfg())
  d <- ind$diario
  expect_setequal(unique(d$Facultad), c("Letras", "Derecho"))
  # El martes de Derecho existe como fila propia, con SU acumulado y SU meta.
  fila <- d[d$Facultad == "Derecho" & d[["Día"]] == "2026-08-11", ]
  expect_equal(nrow(fila), 1L)
  expect_equal(fila[["Efectivas del día"]], 1)
  expect_equal(fila[["Faltantes para la meta"]], 19)
  # Y el día de la semana sale en castellano SIN pasar por el locale: `%A` da
  # «Tuesday» en un contenedor sin locale español y ya costó una tanda de rojos.
  expect_identical(fila[["Día de la semana"]], "martes")
})

test_that("la producción por aplicador es una fila por PERSONA EN CADA FACULTAD", {
  # La columna que Gonzalo puso primera es «Facultad», y las dos de tasa son
  # «esperada en facultad» y «obtenida»: comparar la producción de alguien con
  # su vara exige saber de qué facultad se habla, porque cada una tiene la suya.
  plan <- c(.ci_plan(), list(
    list(operational_code = "CH 9", sample_role = "titular", faculty = "Derecho",
         eligible_n = 30, expected_valid = 20, rendimiento_ref = 0.4)))
  asignados <- list(`CH 1` = "Equipo A", `CH 2` = "Equipo B", `R 2.1` = "Equipo B",
                    `CH 9` = "Equipo B")
  ind <- aulas_libro_indicadores(
    plan, efectivas = c(`CH 1` = 20, `CH 2` = 8, `R 2.1` = 6, `CH 9` = 9),
    partes = list(), asignados = asignados)
  a <- ind$aplicadores
  expect_identical(names(a), AULAS_AVANCE_CABECERAS$aplicador)
  # Equipo B cubre dos facultades: dos filas, no una media de las dos varas.
  b <- a[a$Aplicador == "Equipo B", ]
  expect_equal(nrow(b), 2L)
  expect_setequal(b$Facultad, c("Letras", "Derecho"))
  # Y el nombre se escribe como se escribe un nombre, nunca crudo.
  expect_true(all(a$Aplicador == vapply(a$Aplicador, aulas_nombre_aplicador, character(1))))
})

test_that("dentro de cada facultad abre quien dejó más fichas sin recoger", {
  # El campo pregunta a quién empujar, no quién es el mejor.
  asignados <- list(`CH 1` = "Equipo A", `CH 2` = "Equipo B", `R 2.1` = "Equipo B")
  ind <- aulas_libro_indicadores(
    .ci_plan(), efectivas = c(`CH 1` = 20, `CH 2` = 8, `R 2.1` = 6),
    partes = list(), asignados = asignados)
  a <- ind$aplicadores
  expect_identical(a$Aplicador[[1]], "Equipo B")
  # Equipo B: dos aulas aplicadas, 14 fichas en la base, y de 40 esperadas le
  # faltan 26 — sin compensar entre aulas (12 + 14).
  expect_equal(a[["Aulas aplicadas"]][[1]], 2L)
  expect_equal(a[["Efectivas en la base"]][[1]], 14)
  expect_equal(a[["Efectivas faltantes"]][[1]], 26)
  # Equipo A se pasó de la meta de su aula: cero faltantes, nunca negativo.
  expect_equal(a[["Efectivas faltantes"]][[2]], 0)
})

test_that("un aplicador que todavía no recibe nada aparece, no desaparece", {
  # **Sale del reparto, no del parte.** Antes la fila existía sólo si alguien
  # había rendido parte, así que quien salió esta mañana y todavía no tiene
  # respuestas no aparecía — justo a quien hay que mirar.
  asignados <- list(`CH 1` = "Equipo A", `CH 2` = "Equipo B")
  ind <- aulas_libro_indicadores(.ci_plan(), efectivas = c(`CH 1` = 20),
                                 partes = list(), asignados = asignados)
  b <- ind$aplicadores[ind$aplicadores$Aplicador == "Equipo B", ]
  expect_equal(nrow(b), 1L)
  expect_equal(b[["Aulas aplicadas"]], 0L)
  # Pero SÍ dice cuántas le tocan, que es lo que distingue a quien va retrasado
  # de quien no tiene nada que hacer todavía. Sin esta columna las dos filas
  # eran idénticas, y la hoja tenía 58 así de 72.
  expect_equal(b[["Aulas asignadas"]], 1L)
  # **Y las tres cifras de fichas callan, no dicen cero.** Un «0 en la base, 0
  # faltantes» se lee como que fue y no sacó nada. Antes esta línea pinaba el
  # cero; el 2026-09-08 pasa a callar, por la misma razón por la que la tasa de
  # la línea siguiente ya callaba.
  expect_true(is.na(b[["Efectivas esperadas"]]))
  expect_true(is.na(b[["Efectivas en la base"]]))
  expect_true(is.na(b[["Efectivas faltantes"]]))
  # Sin aula aplicada no hay denominador: la tasa calla en vez de decir cero.
  expect_true(is.na(b[["Tasa de rendimiento obtenida"]]))
  # Y la brecha calla con ella: un cero diría «va justo», que es lo contrario
  # de «todavía no le ha tocado ir».
  expect_true(is.na(b[["Diferencia de tasa"]]))
})

test_that("la brecha de tasa se dice, no se deja para restar de cabeza", {
  # Dictado sobre esta tabla: «mejorar la tabla de Producción por aplicador para
  # que sea más entendible». Sus dos hermanas ya traen la diferencia pegada a
  # las dos tasas; aquí había que restar. Va ENTRE sus dos términos y las
  # columnas de rango, no al final: «no pongas las metas todas al final».
  cabecera <- AULAS_AVANCE_CABECERAS$aplicador
  i <- which(cabecera == "Tasa de rendimiento obtenida")
  expect_length(i, 1L)
  expect_equal(cabecera[[i + 1L]], "Diferencia de tasa")
  # Y se pinta como proporción, no como un número suelto: sin esto un −0,08
  # saldría «-0,08» donde la hermana dice «-8,0 %».
  expect_true("Diferencia de tasa" %in% AULAS_AVANCE_PROPORCIONES$aplicador)

  # Y vale lo que promete el rótulo: obtenida menos esperada, con su signo.
  plan <- list(
    list(operational_code = "CH 1", sample_role = "titular", faculty = "Letras",
         eligible_n = 100, expected_valid = 50, scheduled_time = "10:00"),
    list(operational_code = "CH 2", sample_role = "titular", faculty = "Letras",
         eligible_n = 100, expected_valid = 50, scheduled_time = "10:00")
  )
  # CH 1 la aplicó Equipo A y sacó 30 de 100 elegibles: 30 % obtenido contra el
  # 50 % que la facultad espera de sus aulas.
  ind <- prosecnurapp:::.calaa_produccion_por_aplicador(
    plan, efectivas = c("CH 1" = 30), partes = list(),
    asignados = list("CH 1" = "Equipo A", "CH 2" = "Equipo B"))
  a <- ind[ind$Aplicador == "Equipo A", ]
  expect_equal(a[["Tasa de rendimiento obtenida"]], 0.30)
  expect_equal(a[["Tasa de rendimiento esperada en facultad"]], 0.50)
  expect_equal(a[["Diferencia de tasa"]], -0.20)
})

test_that("los tres rangos de aplicación salen de la misma función que la Base de control", {
  # Sin una sola definición habría dos «especial noche» y sólo una publicada.
  plan <- list(
    list(operational_code = "CH 1", sample_role = "titular", faculty = "Letras",
         eligible_n = 30, expected_valid = 20, scheduled_time = "07:30"),
    list(operational_code = "CH 2", sample_role = "titular", faculty = "Letras",
         eligible_n = 30, expected_valid = 20, scheduled_time = "10:00"),
    list(operational_code = "CH 3", sample_role = "titular", faculty = "Letras",
         eligible_n = 30, expected_valid = 20, scheduled_time = "19:30")
  )
  ind <- aulas_libro_indicadores(
    plan, efectivas = c(`CH 1` = 5, `CH 2` = 5, `CH 3` = 5),
    asignados = list(`CH 1` = "Equipo A", `CH 2` = "Equipo A", `CH 3` = "Equipo A"))
  a <- ind$aplicadores
  expect_equal(a[["Aplicaciones especial mañana"]][[1]], 1L)
  expect_equal(a[["Aplicaciones regulares"]][[1]], 1L)
  expect_equal(a[["Aplicaciones especial noche"]][[1]], 1L)
})

test_that("el rendimiento por facultad separa «no se ha ido» de «rinde por debajo»", {
  # «Avance por facultad» dice cuánto falta para la cuota; esta tabla dice por
  # qué, y las dos causas piden cosas distintas: ir, o pedir aulas adicionales.
  plan <- list(
    list(operational_code = "CH 1", sample_role = "titular", faculty = "Letras",
         eligible_n = 40, expected_valid = 24, rendimiento_ref = 0.6),
    list(operational_code = "CH 2", sample_role = "titular", faculty = "Letras",
         eligible_n = 40, expected_valid = 24, rendimiento_ref = 0.6),
    # Un extra ACTIVADO: es un aula que se le pidió a la facultad. Una reserva
    # de CADENA, en cambio, reemplaza a un titular que cayó y no es un aula más.
    list(operational_code = "EX 1", sample_role = "extra_reserve_pool",
         faculty = "Letras", eligible_n = 40, expected_valid = 24,
         rendimiento_ref = 0.6)
  )
  ind <- aulas_libro_indicadores(plan, efectivas = c(`CH 1` = 12, `EX 1` = 8))
  r <- ind$rendimiento
  expect_identical(names(r), AULAS_AVANCE_CABECERAS$rendimiento)
  expect_equal(r[["Aulas planificadas"]], 2L)   # los titulares
  expect_equal(r[["Aulas aplicadas"]], 2L)      # CH 1 y EX 1 tienen efectivas
  expect_equal(r[["Aulas adicionales solicitadas hasta el momento"]], 1L)
  expect_equal(r[["Tasa de rendimiento de la facultad esperada"]], 0.6)
  # El denominador son los elegibles de las aulas YA APLICADAS (80), no los del
  # plan entero: con el plan entero la tasa del día 1 saldría cerca de cero en
  # las quince facultades y no diría nada sobre cómo rinden las aulas visitadas.
  expect_equal(r[["Tasa de rendimiento de la facultad obtenida"]], 20 / 80)
  expect_equal(r[["Diferencia de tasa"]], 20 / 80 - 0.6)
})

test_that("la hoja va la ULTIMA: el libro lo abre quien agenda", {
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.ci_plan(), libro, efectivas = c(`CH 1` = 18))
  hojas <- openxlsx::getSheetNames(libro)
  # Antes de «Listas», que es la oculta, y de «Avance de agendación», que entró
  # detrás el 2026-09-09. Se ancla por POSICIÓN RELATIVA a las dos y no por un
  # índice contado desde el final: la próxima hoja que entre no puede volver a
  # romper este pin.
  expect_identical(hojas[[which(hojas == "Avance de campo") + 1L]], "Avance de agendación")
  expect_identical(hojas[[length(hojas)]], "Listas")
  expect_identical(hoja_activa_de(libro), "Aulas Agendadas")
})

test_that("el avance se ENSEÑA como porcentaje, no como 0.59", {
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.ci_plan(), libro, efectivas = c(`CH 1` = 18, `CH 2` = 12))
  # `skipEmptyRows = FALSE`: por defecto `read.xlsx` se salta las filas en
  # blanco, y esta hoja tiene una entre el pie y la primera seccion, asi que el
  # indice de la tabla no era el numero de fila del Excel.
  d <- suppressWarnings(openxlsx::read.xlsx(libro, sheet = "Avance de campo",
                                            colNames = FALSE, skipEmptyRows = FALSE))
  fila <- which(as.character(d[[1]]) == "Avance")
  expect_length(fila, 1L)
  expect_identical(formato_de_celda(libro, "Avance de campo", 2, fila), "0.0%")
})

# --- A9-B6: sin decimales sobre personas/encuestas ---------------------------
#
# Visto en el libro real: «Encuestas de la meta | 3157.8». `cifra_limpia` hace
# `round(x, 1)` y deja el decimal en la CELDA — el valor, no solo su formato.
# Media encuesta no existe. Regla congelada (checklist 2026-08-31, A9-B6):
#   · la META al entero mas proximo — mitades hacia arriba: floor(x + 0.5),
#     NO el round() banquero de R;
#   · lo CONSEGUIDO hacia ABAJO — no se declara cubierto lo que no se consiguio;
#   · lo que FALTA hacia ARRIBA — con 1851 no se cierra una falta de 1851,5;
#   · tasas y promedios conservan su decimal («Media por aula», «Avance»).

# `expected_valid` llega fraccionario del calculo (eligible_n x rendimiento x
# factor): 1578.9 x 2 = 3157.8, la cifra vista en el libro.
.ci_plan_fraccionario <- function() list(
  list(operational_code = "CH 1", sample_role = "titular", faculty = "Letras",
       eligible_n = 30, expected_valid = 1578.9),
  list(operational_code = "CH 2", sample_role = "titular", faculty = "Letras",
       eligible_n = 30, expected_valid = 1578.9)
)

# Logrado fraccionario: 1200.4 + 105.9 = 1306.3, la cifra vista en la UI. El
# escritor no controla que le llega; el contrato es de la celda que produce.
.ci_efectivas_fraccionarias <- function() c(`CH 1` = 1200.4, `CH 2` = 105.9)

# La hoja del escritor, leida de vuelta: el contrato vive en la CELDA del xlsx,
# no en el modelo (el motor sigue calculando con la fraccion).
.ci_hoja_escrita <- function(ind) {
  libro <- withr::local_tempfile(fileext = ".xlsx", .local_envir = parent.frame())
  wb <- openxlsx::createWorkbook()
  aulas_libro_escribir_indicadores(wb, ind)
  openxlsx::saveWorkbook(wb, libro, overwrite = TRUE)
  suppressWarnings(openxlsx::read.xlsx(libro, sheet = "Avance de campo",
                                       colNames = FALSE, skipEmptyRows = FALSE))
}

test_that("A9-B6: el bloque de meta escribe enteros — meta al mas proximo, logrado abajo, falta arriba", {
  ind <- aulas_libro_indicadores(.ci_plan_fraccionario(),
                                 efectivas = .ci_efectivas_fraccionarias())
  d <- .ci_hoja_escrita(ind)
  celda <- function(etq) {
    fila <- which(as.character(d[[1]]) == etq)
    expect_length(fila, 1L)
    suppressWarnings(as.numeric(d[[2]][[fila]]))
  }
  # 3157.8 -> 3158 (mas proximo, mitades hacia arriba).
  expect_equal(celda("Encuestas de la meta"), 3158)
  # 1306.3 -> 1306 (hacia abajo: la 1307 no se consiguio).
  expect_equal(celda("Efectivas conseguidas"), 1306)
  # 3157.8 - 1306.3 = 1851.5 -> 1852 (hacia arriba: con 1851 no se cierra).
  expect_equal(celda("Faltan"), 1852)
})

test_that("A9-B6: el avance diario no publica decimales sobre encuestas", {
  # Con la meta fraccionaria, la resta contra el acumulado arrastraba el decimal
  # a la columna: 3157.8 - 4 = 3153.8 respuestas por recoger. El numFmt lo tapa
  # en pantalla, pero el VALOR queda sucio y sale en cuanto alguien copia,
  # ordena o suma la celda.
  ind <- aulas_libro_indicadores(.ci_plan_fraccionario(),
                                 efectivas = .ci_efectivas_fraccionarias(),
                                 responses = .ci_respuestas(),
                                 validas = c(TRUE, TRUE, TRUE, TRUE, FALSE),
                                 cuotas = .ci_cuotas(3158), cfg = .ci_cfg())
  d <- .ci_hoja_escrita(ind)
  # La columna por NOMBRE, no por índice: la cabecera de la tabla la declara.
  fila_cab <- which(as.character(d[[1]]) == "Facultad" &
                      as.character(d[[2]]) == "Día")
  expect_length(fila_cab, 1L)
  col_falta <- which(as.character(unlist(d[fila_cab, ])) == "Faltantes para la meta")
  expect_length(col_falta, 1L)
  fila_dia <- which(as.character(d[[2]]) == "2026-08-11")
  expect_length(fila_dia, 1L)
  expect_equal(suppressWarnings(as.numeric(d[[col_falta]][[fila_dia]])), 3154)
})

test_that("A9-B6: una TASA conserva su decimal — es una razón, no un conteo", {
  # Pin de conservación: la regla de enteros es de los CONTEOS de personas. Un
  # arreglo que aplane también las razones repetiría el defecto ya documentado
  # («23 %» entre 20,5 % y 23,8 %).
  plan <- list(
    list(operational_code = "CH 1", sample_role = "titular", faculty = "Letras",
         eligible_n = 40, expected_valid = 24, rendimiento_ref = 0.6),
    list(operational_code = "CH 2", sample_role = "titular", faculty = "Letras",
         eligible_n = 40, expected_valid = 24, rendimiento_ref = 0.6)
  )
  ind <- aulas_libro_indicadores(
    plan, efectivas = c(`CH 1` = 8, `CH 2` = 5),
    asignados = list(`CH 1` = "Equipo Unico", `CH 2` = "Equipo Unico"))
  d <- .ci_hoja_escrita(ind)
  fila_cab <- which(as.character(d[[1]]) == "Facultad" &
                      as.character(d[[2]]) == "Aplicador")
  expect_length(fila_cab, 1L)
  col_tasa <- which(as.character(unlist(d[fila_cab, ])) == "Tasa de rendimiento obtenida")
  expect_length(col_tasa, 1L)
  fila_apl <- which(as.character(d[[2]]) == "Equipo Unico")
  expect_length(fila_apl, 1L)
  # 13 efectivas sobre 80 elegibles: la tasa ES 0,1625 y lo dice.
  expect_equal(suppressWarnings(as.numeric(d[[col_tasa]][[fila_apl]])), 0.1625)
})

test_that("el semáforo no tapa el número", {
  # Con el navy del libro, la cifra quedaba en negro sobre azul oscuro y no se
  # leía: el color ayuda a barrer la tabla de un vistazo, pero el dato es el
  # número. Se vio en el PDF de la hoja, con las databar; desde el 2026-09-08 el
  # color lo ponen las reglas del semáforo y la regla de luminancia es la misma.
  for (hex in c(prosecnurapp:::.CAI_VERDE_META, prosecnurapp:::.CAI_CELESTE_SOBRE,
                prosecnurapp:::.CAI_ESCALA_DIF)) {
    lum <- mean(grDevices::col2rgb(hex)[, 1])
    # Por debajo de 190 el texto negro deja de leerse encima.
    expect_gt(lum, 165)
  }
})

test_that("el porcentaje es formato de CELDA y ninguna cabecera lleva «(%)»", {
  # Gonzalo, 2026-09-08: «los que tienen un (%) no se pone en el titulo, es el
  # formato de la celda».
  rotulos <- c(unlist(AULAS_AVANCE_CABECERAS, use.names = FALSE),
               AULAS_AVANCE_FILAS_GENERAL)
  expect_false(any(grepl("%", rotulos, fixed = TRUE)))

  plan <- list(
    list(operational_code = "CH 1", sample_role = "titular", faculty = "Letras",
         eligible_n = 40, expected_valid = 24, rendimiento_ref = 0.6))
  ind <- aulas_libro_indicadores(plan, efectivas = c(`CH 1` = 12))
  libro <- withr::local_tempfile(fileext = ".xlsx")
  wb <- openxlsx::createWorkbook()
  aulas_libro_escribir_indicadores(wb, ind)
  openxlsx::saveWorkbook(wb, libro, overwrite = TRUE)
  d <- suppressWarnings(openxlsx::read.xlsx(libro, sheet = "Avance de campo",
                                            colNames = FALSE, skipEmptyRows = FALSE))
  fila_cab <- which(as.character(d[[1]]) == "Facultad" &
                      as.character(d[[2]]) == "Aulas aplicadas")
  expect_length(fila_cab, 1L)
  col <- which(as.character(unlist(d[fila_cab, ])) ==
                 "Tasa de rendimiento de la facultad obtenida")
  expect_length(col, 1L)
  expect_identical(formato_de_celda(libro, "Avance de campo", col, fila_cab + 1L), "0.0%")
})

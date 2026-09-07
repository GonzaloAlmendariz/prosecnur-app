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

.ci_respuestas <- function() data.frame(
  `_submission_time` = c("2026-08-10T09:00:00", "2026-08-10T10:00:00",
                         "2026-08-11T09:00:00", "2026-08-11T11:00:00",
                         "2026-08-11T12:00:00"),
  sexo = c("Mujer", "Hombre", "Mujer", "Hombre", "Prefiero no decir"),
  check.names = FALSE, stringsAsFactors = FALSE
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
  r <- .ci_respuestas()
  validas <- c(TRUE, TRUE, TRUE, TRUE, FALSE)
  ind <- aulas_libro_indicadores(.ci_plan(), efectivas = c(`CH 1` = 4),
                                 responses = r, validas = validas)
  expect_equal(nrow(ind$diario), 2L)
  expect_equal(ind$diario$`Efectivas del dia`, c(2L, 2L))
  expect_equal(utils::tail(ind$diario$`Efectivas acumuladas`, 1), 4L)
  # El acumulado final es el logrado: si no cuadran, una de las dos miente.
  expect_equal(as.numeric(utils::tail(ind$diario$`Efectivas acumuladas`, 1)),
               as.numeric(ind$meta$logrado))
})

test_that("la produccion por aplicador abre por el que va mas flojo", {
  # El campo pregunta a quien empujar, no quien es el mejor.
  #
  # La tabla mide con la PLATAFORMA desde el 2026-09-07: la cuenta del parte
  # llega al cerrar y en la primera semana casi no existe —ese día la hoja
  # enseñaba UNA fila con ocho cursos-horario aplicados y seis aplicadores en
  # la calle—. La atribución sale del reparto, así que un aplicador aparece en
  # cuanto sale a su primer curso-horario.
  asignados <- list(`CH 1` = "Equipo A", `CH 2` = "Equipo B", `R 2.1` = "Equipo B")
  ind <- aulas_libro_indicadores(
    .ci_plan(), efectivas = c(`CH 1` = 20, `CH 2` = 8, `R 2.1` = 6),
    partes = list(), asignados = asignados)
  expect_identical(ind$aplicadores$Aplicador[[1]], "Equipo B")
  expect_equal(ind$aplicadores$`Media por curso-horario`[[1]], 7)
  expect_equal(ind$aplicadores$`Con respuestas`[[1]], 2)
  expect_equal(ind$aplicadores$`Cursos-horario asignados`[[1]], 2L)
})

test_that("un aplicador que todavia no recibe nada abre la tabla, no desaparece", {
  # **Sale del reparto, no del parte.** Antes la fila existía sólo si alguien
  # había rendido parte, así que quien salió esta mañana y todavía no tiene
  # respuestas no aparecía — justo a quien hay que mirar.
  asignados <- list(`CH 1` = "Equipo A", `CH 2` = "Equipo B")
  ind <- aulas_libro_indicadores(.ci_plan(), efectivas = c(`CH 1` = 20),
                                 partes = list(), asignados = asignados)
  expect_identical(ind$aplicadores$Aplicador[[1]], "Equipo B")
  expect_equal(ind$aplicadores$`Con respuestas`[[1]], 0)
  expect_true(is.na(ind$aplicadores$`Media por curso-horario`[[1]]))
})

test_that("la cuenta del parte y la de plataforma se publican juntas, no mezcladas", {
  # Son dos medidas del mismo trabajo —lo que el aplicador contó al cerrar y lo
  # que llegó a la plataforma— y verlas juntas es el control que la hoja da.
  # Mezclarlas perdería de cuál viene cada número.
  ind <- aulas_libro_indicadores(
    .ci_plan(), efectivas = c(`CH 1` = 34, `CH 2` = 38),
    partes = list(list(operational_code = "CH 1", applied_by = "Equipo A",
                       effective_surveys = 34)),
    asignados = list(`CH 1` = "Equipo A", `CH 2` = "Equipo A"))
  a <- ind$aplicadores
  expect_equal(a$`Efectivas en plataforma`[[1]], 72)
  # S14b (dictado 2026-09-07): la columna se llamaba «Efectivas declaradas»;
  # el conteo del parte son encuestas aplicadas, las efectivas las da la app.
  expect_equal(a$`Encuestas aplicadas (parte)`[[1]], 34)
  expect_equal(a$`Partes rendidos`[[1]], 1L)
})

test_that("la hoja va la ULTIMA: el libro lo abre quien agenda", {
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.ci_plan(), libro, efectivas = c(`CH 1` = 18))
  hojas <- openxlsx::getSheetNames(libro)
  # Antes de «Listas», que es la oculta.
  expect_identical(hojas[[length(hojas) - 1L]], "Avance de campo")
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

test_that("A9-B6: «Falta para la meta» del diario tambien sube al entero", {
  # Con la meta fraccionaria, la resta contra el acumulado entero arrastra el
  # decimal a la columna: 3157.8 - 4 = 3153.8 respuestas por recoger. El numFmt
  # `#,##0` lo tapa en pantalla, pero el VALOR queda sucio — mismo motivo por el
  # que `cifra_limpia` redondea el valor y no solo su formato.
  ind <- aulas_libro_indicadores(.ci_plan_fraccionario(),
                                 efectivas = .ci_efectivas_fraccionarias(),
                                 responses = .ci_respuestas(),
                                 validas = c(TRUE, TRUE, TRUE, TRUE, FALSE))
  d <- .ci_hoja_escrita(ind)
  # La columna por NOMBRE, no por indice: la cabecera de la tabla la declara.
  fila_cab <- which(as.character(d[[1]]) == "Dia")
  expect_length(fila_cab, 1L)
  col_falta <- which(as.character(unlist(d[fila_cab, ])) == "Falta para la meta")
  expect_length(col_falta, 1L)
  fila_dia <- which(as.character(d[[1]]) == "2026-08-11")
  expect_length(fila_dia, 1L)
  expect_equal(suppressWarnings(as.numeric(d[[col_falta]][[fila_dia]])), 3154)
})

test_that("A9-B6: «Media por aula» conserva su decimal — es un promedio, no un conteo", {
  # Pin de conservacion (hoy verde): la regla de enteros es de los CONTEOS de
  # personas. Un arreglo que aplane tambien los promedios repetiria el defecto
  # ya documentado en el estilo `promedio` («23» entre 20.5 y 23.8).
  ind <- aulas_libro_indicadores(
    .ci_plan_fraccionario(), efectivas = c(`CH 1` = 8, `CH 2` = 5),
    partes = list(),
    asignados = list(`CH 1` = "Equipo Unico", `CH 2` = "Equipo Unico"))
  d <- .ci_hoja_escrita(ind)
  fila_cab <- which(as.character(d[[1]]) == "Aplicador")
  expect_length(fila_cab, 1L)
  col_media <- which(as.character(unlist(d[fila_cab, ])) == "Media por curso-horario")
  expect_length(col_media, 1L)
  fila_apl <- which(as.character(d[[1]]) == "Equipo Unico")
  expect_length(fila_apl, 1L)
  # 13 efectivas en 2 aulas: la media ES 6.5 y lo dice.
  expect_equal(suppressWarnings(as.numeric(d[[col_media]][[fila_apl]])), 6.5)
})

test_that("las barras no tapan el numero", {
  # Con el navy del libro, la cifra quedaba en negro sobre azul oscuro y no se
  # leia: la barra ayuda a comparar de un vistazo, pero el numero es el dato.
  # Visto en el PDF de la hoja.
  libro <- withr::local_tempfile(fileext = ".xlsx")
  partes <- list(
    list(operational_code = "CH 1", applied_by = "Equipo A", effective_surveys = 20),
    list(operational_code = "CH 2", applied_by = "Equipo B", effective_surveys = 8)
  )
  aulas_libro_generar(.ci_plan(), libro, partes = partes,
                      efectivas = c(`CH 1` = 18, `CH 2` = 12))
  colores <- colores_databar_de(libro, "Avance de campo")
  expect_gt(length(colores), 0L)
  for (hex in colores) {
    lum <- mean(grDevices::col2rgb(paste0("#", substr(hex, 3, 8)))[, 1])
    # Por debajo de 190 el texto negro deja de leerse encima.
    expect_gt(lum, 190)
  }
})

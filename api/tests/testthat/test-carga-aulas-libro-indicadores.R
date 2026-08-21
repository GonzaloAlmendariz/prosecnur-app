# La hoja «Cómo va el campo».
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
  partes <- list(
    list(operational_code = "CH 1", applied_by = "Equipo A", effective_surveys = 20),
    list(operational_code = "CH 2", applied_by = "Equipo B", effective_surveys = 8),
    list(operational_code = "R 2.1", applied_by = "Equipo B", effective_surveys = 6)
  )
  ind <- aulas_libro_indicadores(.ci_plan(), efectivas = NULL, partes = partes)
  expect_identical(ind$aplicadores$Aplicador[[1]], "Equipo B")
  expect_equal(ind$aplicadores$`Media por aula`[[1]], 7)
  expect_equal(ind$aplicadores$Aulas[[1]], 2L)
})

test_that("la hoja va la ULTIMA: el libro lo abre quien agenda", {
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.ci_plan(), libro, efectivas = c(`CH 1` = 18))
  hojas <- openxlsx::getSheetNames(libro)
  # Antes de «Listas», que es la oculta.
  expect_identical(hojas[[length(hojas) - 1L]], "Cómo va el campo")
  expect_identical(hoja_activa_de(libro), "Aulas Agendadas")
})

test_that("el avance se ENSEÑA como porcentaje, no como 0.59", {
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.ci_plan(), libro, efectivas = c(`CH 1` = 18, `CH 2` = 12))
  # `skipEmptyRows = FALSE`: por defecto `read.xlsx` se salta las filas en
  # blanco, y esta hoja tiene una entre el pie y la primera seccion, asi que el
  # indice de la tabla no era el numero de fila del Excel.
  d <- suppressWarnings(openxlsx::read.xlsx(libro, sheet = "Cómo va el campo",
                                            colNames = FALSE, skipEmptyRows = FALSE))
  fila <- which(as.character(d[[1]]) == "Avance")
  expect_length(fila, 1L)
  expect_identical(formato_de_celda(libro, "Cómo va el campo", 2, fila), "0.0%")
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
  colores <- colores_databar_de(libro, "Cómo va el campo")
  expect_gt(length(colores), 0L)
  for (hex in colores) {
    lum <- mean(grDevices::col2rgb(paste0("#", substr(hex, 3, 8)))[, 1])
    # Por debajo de 190 el texto negro deja de leerse encima.
    expect_gt(lum, 190)
  }
})

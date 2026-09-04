# **El encabezado dice de qué sirve cada columna, por color.**
#
# Dictado 2026-09-04: «en Aulas Aplicadas Campo tiene que haber paleta de
# colores para los encabezados en función de la función que tenga… se tiene que
# distinguir lo que viene de la agenda de lo que es genuinamente de campo, lo
# que se debe llenar manualmente de lo que se llena en automático».
#
# El contraste se MIDE, como en `test-carga-aulas-libro-color-eslabon.R`: pinear
# un hex sólo congela lo que hoy hay escrito, y lo que la hoja promete es que su
# cabecera se pueda LEER.

.tcf_luminancia <- function(hex) {
  canal <- grDevices::col2rgb(hex)[, 1] / 255
  lineal <- ifelse(canal <= 0.03928, canal / 12.92, ((canal + 0.055) / 1.055)^2.4)
  sum(c(0.2126, 0.7152, 0.0722) * lineal)
}

.tcf_contraste <- function(a, b) {
  la <- .tcf_luminancia(a); lb <- .tcf_luminancia(b)
  (max(la, lb) + 0.05) / (min(la, lb) + 0.05)
}

test_that("las cuatro funciones se leen: texto normal sobre su fondo", {
  for (nombre in names(AULAS_LIBRO_FUNCION_COLUMNA)) {
    spec <- AULAS_LIBRO_FUNCION_COLUMNA[[nombre]]
    # 4.5 es el umbral de texto normal; la cabecera va en negrita, así que el
    # margen es real y no el 3.0 de texto grande con el que se conforma la
    # banda de eslabón.
    expect_gte(.tcf_contraste(spec$fill, spec$texto), 4.5)
  }
})

test_that("las cuatro se distinguen ENTRE SÍ, que es de lo que va la paleta", {
  fondos <- vapply(AULAS_LIBRO_FUNCION_COLUMNA, function(s) s$fill, character(1))
  distancia <- function(a, b) sum(abs(grDevices::col2rgb(a)[, 1] - grDevices::col2rgb(b)[, 1]))
  pares <- utils::combn(fondos, 2)
  for (i in seq_len(ncol(pares))) {
    expect_gte(distancia(pares[1, i], pares[2, i]), 24)
  }
})

test_that("la cabecera de «lo pone la app» habla igual que sus celdas de abajo", {
  # El gris de las columnas de la app ya existía en las filas de DATOS
  # (`#F2F4F7` con texto `#5B6472`). Que la cabecera use el mismo par es lo que
  # hace que la columna se lea entera como un bloque, y no como dos cosas.
  expect_equal(AULAS_LIBRO_FUNCION_COLUMNA$app$fill, "#F2F4F7")
  expect_equal(AULAS_LIBRO_FUNCION_COLUMNA$app$texto, "#5B6472")
})

test_that("cada columna del bloque cae en su función, y el reparto se repite por eslabón", {
  agenda <- c("A1", "A2", "A3")
  campo <- c("MATRICULADOS TOTAL DTI", "MATRICULADOS ELEGIBLES", "APLICADOR",
             "% ASISTENCIA", "OBSERVACIONES SOBRE APLICACIONES")
  # Bloque = 1 (ID MATCH) + 3 agenda + 5 campo = 9 columnas.
  tramos <- aulas_libro_funciones_de_columna(agenda, campo, bloques = 2L)
  por <- setNames(lapply(tramos, function(t) t$cols), vapply(tramos, function(t) t$funcion, character(1)))

  # ID MATCH (1) y los dos denominadores (5 y 6) son de la app, y otro tanto
  # nueve columnas más allá en el segundo bloque.
  expect_equal(por$app, c(1L, 5L, 6L, 10L, 14L, 15L))
  # El eco de la agenda: las tres de en medio.
  expect_equal(por$agenda, c(2L, 3L, 4L, 11L, 12L, 13L))
  # `% ASISTENCIA` sale de una fórmula, no del aplicador.
  expect_equal(por$calculada, c(8L, 17L))
  # Y lo que se teclea en campo: aplicador y observaciones.
  expect_equal(por$campo, c(7L, 9L, 16L, 18L))
})

test_that("el reparto se hace por NOMBRE, así que reordenar los títulos no mueve el color", {
  agenda <- c("A1")
  # `% ASISTENCIA` cambia de sitio; su columna nueva tiene que seguir siendo la
  # calculada. Pinear posiciones era exactamente el defecto que esto evita.
  campo <- c("% ASISTENCIA", "APLICADOR", "MATRICULADOS ELEGIBLES")
  tramos <- aulas_libro_funciones_de_columna(agenda, campo, bloques = 1L)
  por <- setNames(lapply(tramos, function(t) t$cols), vapply(tramos, function(t) t$funcion, character(1)))
  expect_equal(por$calculada, 3L)
  expect_equal(por$campo, 4L)
  expect_equal(por$app, c(1L, 5L))
})

test_that("una función sin columnas no produce tramo vacío", {
  tramos <- aulas_libro_funciones_de_columna(c("A1"), c("APLICADOR"), bloques = 1L)
  funciones <- vapply(tramos, function(t) t$funcion, character(1))
  # Sin denominadores ni calculadas, sólo quedan app (el ID MATCH), agenda y campo.
  expect_false("calculada" %in% funciones)
  expect_setequal(funciones, c("app", "agenda", "campo"))
})

test_that("sobre los títulos REALES, cada columna del bloque cae en una sola función", {
  # La invariante que importa: ninguna columna se queda sin color y ninguna
  # recibe dos. Con los títulos de verdad, que son los que se van a pintar.
  agenda <- .calg_titulos_agenda()
  campo <- .calg_titulos_campo()
  ancho <- 1L + length(agenda) + length(campo)
  tramos <- aulas_libro_funciones_de_columna(agenda, campo, bloques = 3L)
  todas <- unlist(lapply(tramos, function(t) t$cols))
  expect_equal(sort(todas), seq_len(ancho * 3L))
  expect_equal(anyDuplicated(todas), 0L)
})

test_that("«% ASISTENCIA» es calculada y «STATUS DE APLICACIÓN» se llena en campo", {
  # Los dos casos que el dictado nombra: lo que se llena a mano frente a lo que
  # sale solo. Si alguien mueve uno de bando, aquí se ve.
  agenda <- .calg_titulos_agenda()
  campo <- .calg_titulos_campo()
  tramos <- aulas_libro_funciones_de_columna(agenda, campo, bloques = 1L)
  por <- stats::setNames(lapply(tramos, function(t) t$cols),
                         vapply(tramos, function(t) t$funcion, character(1)))
  base <- 1L + length(agenda)
  expect_true((base + which(campo == "% ASISTENCIA")) %in% por$calculada)
  expect_true((base + which(campo == "STATUS DE APLICACIÓN")) %in% por$campo)
  expect_true((base + which(campo == "MATRICULADOS TOTAL DTI")) %in% por$app)
  # Y el eco de la agenda incluye STATUS MUESTRA, que se decide en la otra hoja.
  expect_true((1L + which(agenda == "STATUS MUESTRA")) %in% por$agenda)
})

# ── Los tres estados de la cadena y la columna que los completa ───────────────
#
# Dictado 2026-09-04: «los estatus de aplicación deberían contemplar estatus
# como Reemplazada por para A y Complementado con para B», con «Reforzado con»
# para C, «y debemos tener una columna adicional con algo así como AULA
# UTILIZADA que le diga al usuario cuál fue el reemplazo que usamos, al lado de
# status muestra».

test_that("el desplegable de aplicación distingue las tres situaciones", {
  expect_true(all(c("APLICADA", "NO APLICADA") %in% AULAS_LIBRO_STATUS_APLICACION))
  # A, B y C. Los tres terminan en preposición porque piden AULA UTILIZADA.
  expect_true("REEMPLAZADA POR" %in% AULAS_LIBRO_STATUS_APLICACION)
  expect_true("COMPLEMENTADA CON" %in% AULAS_LIBRO_STATUS_APLICACION)
  expect_true("REFORZADA CON" %in% AULAS_LIBRO_STATUS_APLICACION)
})

test_that("AULA UTILIZADA va PEGADA a STATUS MUESTRA, que es donde se lee", {
  titulos <- .calg_titulos_agenda()
  i <- which(titulos == "STATUS MUESTRA")
  expect_length(i, 1L)
  expect_equal(titulos[[i + 1L]], "AULA UTILIZADA")
})

test_that("AULA UTILIZADA la escribe la app, no la persona: va en el gris", {
  # Si entrara en los campos de la persona, su celda saldría blanca —«escribe
  # aquí»— y diría lo contrario de lo que es.
  expect_false("aula_utilizada" %in% AULAS_LIBRO_CAMPOS_DE_LA_PERSONA)
})

test_that("el titular sabe qué reserva ocupó su lugar", {
  plan <- list(
    list(operational_code = "CH 1", classroom_id = "aula_1", sample_role = "titular"),
    list(operational_code = "R 1.1", classroom_id = "aula_2", sample_role = "chain_reserve",
         replacement_for = "aula_1")
  )
  out <- aulas_libro_anotar_aula_utilizada(plan)
  expect_equal(out[[1]]$aula_utilizada, "R 1.1")
  # La reserva no se anota a sí misma: ella ES la usada.
  expect_null(out[[2]]$aula_utilizada)
})

test_that("si entraron VARIAS se listan todas: esconder la segunda mentiría", {
  # Es el caso B/C, donde el titular no sale y pueden sumarse dos reservas.
  plan <- list(
    list(operational_code = "CH 1", classroom_id = "aula_1", sample_role = "titular"),
    list(operational_code = "R 1.1", classroom_id = "aula_2", replacement_for = "aula_1"),
    list(operational_code = "R 1.2", classroom_id = "aula_3", replacement_for = "aula_1")
  )
  expect_equal(aulas_libro_anotar_aula_utilizada(plan)[[1]]$aula_utilizada, "R 1.1, R 1.2")
})

test_that("lo ya escrito en el libro manda: la app no lo pisa", {
  plan <- list(
    list(operational_code = "CH 1", classroom_id = "aula_1", aula_utilizada = "R 9.9"),
    list(operational_code = "R 1.1", classroom_id = "aula_2", replacement_for = "aula_1")
  )
  expect_equal(aulas_libro_anotar_aula_utilizada(plan)[[1]]$aula_utilizada, "R 9.9")
})

test_that("un plan sin ningún reemplazo activado sale intacto", {
  plan <- list(list(operational_code = "CH 1", classroom_id = "aula_1"))
  expect_identical(aulas_libro_anotar_aula_utilizada(plan), plan)
  expect_identical(aulas_libro_anotar_aula_utilizada(list()), list())
})

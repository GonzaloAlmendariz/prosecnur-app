# La escala que no cabe se parte en dos laminas.
#
# El umbral se cuenta en BARRAS (premisa x publico), no en premisas: cuatro
# premisas por cuatro publicos son dieciseis barras y ninguna de las cuatro
# parece excesiva vista de a una.
#
# El fixture reproduce la forma REAL del plan —`vars` agrupada por premisa, con
# una variable por publico dentro—, no una lista plana de nombres compuestos.
# La primera version de este test construia esa lista plana y pasaba en verde
# sin tocar el codigo que de verdad corre.

.el_escala <- function(n_grupos, n_publicos) {
  vars <- list()
  titulos <- list()
  publicos <- c("docentes", "estudiantes", "egresados", "administrativos",
                "postulantes", "empleadores")
  for (g in seq_len(n_grupos)) {
    nm <- paste0("tema_", g)
    titulos[[nm]] <- paste("Premisa", g)
    vars[[nm]] <- lapply(seq_len(n_publicos), function(p) {
      paste0(publicos[[((p - 1L) %% length(publicos)) + 1L]], "$p", g, "_", p)
    })
  }
  structure(
    list(.element_type = "barras_multiapiladas", modo = "var_cruce",
         vars = vars, titulos_grupo = titulos),
    class = c("ppt_element", "list")
  )
}

.slide_con <- function(el, titulo = "BIENESTAR UNIVERSITARIO") {
  list(title = titulo, slots = list(title = titulo, grafico = el))
}

.els_de <- function(slide) {
  out <- list()
  for (item in slide$slots %||% list()) {
    if (inherits(item, "ppt_element")) out[[length(out) + 1L]] <- item
  }
  out
}

.barras_de <- function(slide) length(unlist(slide$slots$grafico$vars, use.names = FALSE))

test_that("el fixture tiene la forma anidada del plan real", {
  el <- .el_escala(4, 4)
  expect_length(el$vars, 4L)
  expect_true(all(vapply(el$vars, is.list, logical(1))))
  expect_identical(.particion_n_barras(el), 16L)
})

test_that("una escala que cabe no se toca", {
  # 4 premisas x 2 publicos = 8 barras, por debajo del maximo de 9.
  plan <- list(.slide_con(.el_escala(4, 2)))
  out <- .plan_particionar_escalas(plan, .els_de)

  expect_length(out, 1L)
  expect_identical(out[[1]]$title, "BIENESTAR UNIVERSITARIO")
  expect_identical(.barras_de(out[[1]]), 8L)
})

test_that("una escala excedida se parte y ninguna parte supera el maximo", {
  # 4 premisas x 4 publicos = 16 barras.
  plan <- list(.slide_con(.el_escala(4, 4)))
  out <- .plan_particionar_escalas(plan, .els_de)

  expect_gt(length(out), 1L)
  for (s in out) expect_lte(.barras_de(s), 9L)

  # Ninguna barra se pierde ni se duplica por el camino.
  todas <- unlist(lapply(out, function(s) unlist(s$slots$grafico$vars, use.names = FALSE)))
  expect_length(todas, 16L)
  expect_length(unique(todas), 16L)
})

test_that("un grupo nunca se parte entre dos laminas", {
  plan <- list(.slide_con(.el_escala(4, 4)))
  out <- .plan_particionar_escalas(plan, .els_de)

  # Cada premisa viaja entera: sus cuatro publicos juntos en una sola lamina.
  for (s in out) {
    for (g in names(s$slots$grafico$vars)) {
      expect_length(s$slots$grafico$vars[[g]], 4L)
    }
    # Y el titulo de cada grupo sigue apareado con sus variables.
    expect_identical(names(s$slots$grafico$titulos_grupo), names(s$slots$grafico$vars))
  }

  todos <- unlist(lapply(out, function(s) names(s$slots$grafico$vars)), use.names = FALSE)
  expect_length(unique(todos), length(todos))
})

test_that("los grupos desiguales se cuentan por sus barras reales", {
  # Una premisa preguntada solo a estudiantes trae una sola variable: contar
  # premisas x publicos daria un total que no existe.
  el <- .el_escala(4, 4)
  el$vars$tema_3 <- el$vars$tema_3[1]
  expect_identical(.particion_n_barras(el), 13L)

  out <- .plan_particionar_escalas(list(.slide_con(el)), .els_de)
  expect_gt(length(out), 1L)
  for (s in out) expect_lte(.barras_de(s), 9L)
  expect_identical(sum(vapply(out, .barras_de, integer(1))), 13L)
})

test_that("solo la continuacion lleva la marca en el titulo", {
  plan <- list(.slide_con(.el_escala(4, 4)))
  out <- .plan_particionar_escalas(plan, .els_de)

  expect_identical(out[[1]]$title, "BIENESTAR UNIVERSITARIO")
  expect_identical(out[[1]]$slots$title, "BIENESTAR UNIVERSITARIO")
  for (s in out[-1]) {
    expect_match(s$title, "\\(cont\\.\\)$")
    expect_match(s$slots$title, "\\(cont\\.\\)$")
  }
})

test_that("la marca llega a la forma de slide que usa el motor", {
  # El motor no pasa `payload`: sus laminas son `.slide_type`/`title`/`slots`/
  # `meta`, y el titulo que se dibuja sale de `title`. Los slots se llaman
  # `plot`, no `grafico`.
  el <- .el_escala(4, 4)
  slide <- list(
    .slide_type = "grafico_1",
    title = "BIENESTAR UNIVERSITARIO",
    slots = list(title = "BIENESTAR UNIVERSITARIO", subtitle = NULL,
                 plot = el, base = "n = 412", footer = NULL),
    meta = list()
  )
  out <- .plan_particionar_escalas(list(slide), .els_de)

  expect_gt(length(out), 1L)
  expect_identical(out[[1]]$title, "BIENESTAR UNIVERSITARIO")
  for (s in out[-1]) expect_match(s$title, "\\(cont\\.\\)$")
  # El resto de la lamina viaja intacto en las continuaciones.
  for (s in out) {
    expect_identical(s$.slide_type, "grafico_1")
    expect_identical(s$slots$base, "n = 412")
  }
})

test_that("marcar dos veces no duplica el sufijo", {
  expect_identical(.particion_titulo_cont("X (cont.)"), "X (cont.)")
  expect_identical(.particion_titulo_cont("X"), "X (cont.)")
  expect_null(.particion_titulo_cont(NULL))
})

test_that("una lamina de dos graficos se deja intacta", {
  # Partirla plantea que hacer con el grafico que si cabia; adivinar dejaria un
  # hueco o lo duplicaria.
  slide <- .slide_con(.el_escala(4, 4))
  slide$slots$otro <- .el_escala(2, 1)
  out <- .plan_particionar_escalas(list(slide), .els_de)

  expect_length(out, 1L)
  expect_identical(.barras_de(out[[1]]), 16L)
})

test_that("un grupo que por si solo excede el maximo viaja en su tanda", {
  # 2 premisas x 12 publicos: ninguna tanda puede bajar de 12, pero cada
  # premisa sigue viajando entera y sola.
  plan <- list(.slide_con(.el_escala(2, 12)))
  out <- .plan_particionar_escalas(plan, .els_de)

  expect_length(out, 2L)
  for (s in out) expect_length(s$slots$grafico$vars, 1L)
})

test_that("no se parte si titulos_grupo y vars no van a la par", {
  # Subsetear uno de los dos los desalinearia y la lamina saldria con la
  # premisa equivocada sobre cada bloque.
  el <- .el_escala(4, 4)
  el$titulos_grupo <- el$titulos_grupo[1:2]
  expect_null(.particion_tam_grupos(el))

  out <- .plan_particionar_escalas(list(.slide_con(el)), .els_de)
  expect_length(out, 1L)
})

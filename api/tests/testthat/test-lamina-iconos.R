source("setup-load-all.R")

# F6.0b.5: la biblioteca completa del recetario viaja en el paquete y el editor puede ver qué ícono elige el motor y por qué.

test_that("viajan los 124 íconos en navy y blanco, 21 en coral y 1 en verde", {
  cat <- .lam_iconos_catalogo()
  expect_length(cat$colores$navy, 124L); expect_length(cat$colores$blanco, 124L)
  expect_length(cat$colores$coral, 21L); expect_length(cat$colores$verde, 1L)
  usados <- unique(unlist(lapply(.LAM_ICONOS_REGLAS, function(d) c(d$defecto, vapply(d$reglas, `[`, "", 2)))))
  expect_length(setdiff(usados, cat$colores$navy), 0L)          # todo ícono que el motor elige existe en el paquete
})

test_that("la elección dice el ícono, la palabra que casó y el motivo; sin palabra va el de por defecto", {
  e <- .lam_icono_elegir("Perfil del encuestado", "capitulo")
  expect_identical(e$icono, "users"); expect_identical(e$palabra, "perfil")
  expect_match(e$motivo, "«perfil» en «Perfil del encuestado»", fixed = TRUE)
  expect_identical(.lam_icono_elegir("Investigación, desarrollo e innovación (I+D+i)", "capitulo")$icono, "flask-conical")
  expect_identical(.lam_icono_elegir("Docentes", "actor")$icono, "presentation")
  expect_identical(.lam_icono_elegir("Margen de error", "ficha")$icono, "gauge")
  d <- .lam_icono_elegir("Otra cosa", "capitulo")
  expect_identical(d$icono, "list-checks"); expect_true(is.na(d$palabra))
})

test_that("las funciones de siempre siguen devolviendo lo mismo (delegan en la elección con motivo)", {
  expect_identical(.lam_icono_capitulo("Cuerpo académico"), "presentation")
  expect_identical(.lam_icono_actor("Egresados"), "briefcase")
  expect_identical(.lam_icono_ficha("Fecha de aplicación"), "calendar-days")
})

test_that("el catálogo entrega las imágenes pedidas como data URI y rechaza un color desconocido", {
  u <- .lam_iconos_data_uri("coral", c("diana-flecha", "no-existe"))
  expect_named(u, "diana-flecha")
  expect_match(u[["diana-flecha"]], "^data:image/png;base64,")
  expect_error(.lam_iconos_data_uri("rojo"))
})

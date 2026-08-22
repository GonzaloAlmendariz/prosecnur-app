# Guardian de una averia que ya paso TRES veces en este mismo camino: el backend
# calcula un dato y el camino hacia la UI no lo emite, asi que la cifra muere sin
# que nadie lo note.
#
#   `reservas`        el backend lo contaba y el tipo del front no lo declaraba
#   `teacher_phone`   la spec lo declaraba y el registro del lector no lo emitia
#   `fusion`          el importador lo calculaba y la respuesta del router no lo pasaba
#
# Las tres se encontraron de casualidad, mirando otra cosa. Este test las caza
# antes: compara lo que `aulas_libro_importar()` DEVUELVE DE VERDAD —ejecutandolo,
# no leyendo su codigo— contra lo que el endpoint de importacion nombra.
#
# Un campo que no debe viajar se declara abajo con su motivo. La lista de
# excepciones es la parte que hay que defender al crecer: si alguien agrega un
# campo ahi sin motivo, este test deja de servir.

# Datos grandes que viajan por `state`, no por la respuesta del import: mandarlos
# dos veces duplicaria el payload del plan entero en cada importacion.
.EMITE_APARTE <- c("plan", "partes", "control")

test_that("el endpoint de importacion emite todo lo que el importador calcula", {
  skip_if_not_installed("openxlsx")

  unidades <- list(
    list(operational_code = "CH 1", sample_role = "titular",
         titular_operational_code = "CH 1", teacher = "Docente Uno",
         course_name = "Curso Uno", faculty = "SOCIALES", eligible_n = 40),
    list(operational_code = "R 1.1", sample_role = "chain_reserve",
         titular_operational_code = "CH 1", replacement_order = 1,
         teacher = "Docente Dos", course_name = "Curso Dos",
         faculty = "SOCIALES", eligible_n = 30)
  )
  path <- file.path(tempdir(), "libro_contrato_router.xlsx")
  aulas_libro_generar(unidades, path)
  out <- aulas_libro_importar(path)

  producidos <- setdiff(names(out), .EMITE_APARTE)
  expect_gt(length(producidos), 0L)

  # El cuerpo del endpoint de importacion, no el router entero: otro endpoint
  # puede nombrar el mismo campo y taparia el hueco.
  fuente <- readLines("../../R/router_monitoreo.R", warn = FALSE)
  ini <- grep("aulas/importar-libro", fuente, fixed = TRUE)
  expect_length(ini, 1L)
  fin <- grep("^\\s*plumber::pr_post\\(", fuente)
  fin <- fin[fin > ini]
  fin <- if (length(fin)) fin[[1]] else length(fuente)
  cuerpo <- paste(fuente[ini:fin], collapse = "\n")

  # `fusion` solo se calcula cuando habia plan previo, asi que no esta en `out`
  # de una importacion limpia: se exige aparte.
  faltan <- producidos[!vapply(
    producidos,
    function(campo) grepl(paste0("\\b", campo, "\\s*="), cuerpo),
    logical(1)
  )]
  expect_identical(
    faltan, character(0),
    info = paste0(
      "El importador calcula estos campos y el endpoint no los emite: ",
      paste(faltan, collapse = ", "),
      ". Si alguno no debe viajar, decláralo en .EMITE_APARTE con su motivo."
    )
  )
})

test_that("la fusion con el plan previo viaja en la respuesta", {
  # No aparece en una importacion limpia —solo se calcula cuando ya habia plan—,
  # asi que el test de arriba no la ve. Es justamente el campo que se perdio.
  fuente <- paste(readLines("../../R/router_monitoreo.R", warn = FALSE), collapse = "\n")
  expect_match(fuente, "fusion\\s*=\\s*out\\$fusion")
})

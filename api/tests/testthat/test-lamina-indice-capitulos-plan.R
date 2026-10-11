test_that("un índice sin capítulos toma los capítulos del informe, no la lámina de la plantilla", {
  plan <- list(
    list(.slide_type = "index", slots = list(title = "ÍNDICE")),
    list(.slide_type = "section", slots = list(title = "Perfil del encuestado")),
    list(.slide_type = "section", slots = list(title = "Detalle"), meta = list(nivel = "subcapitulo")),
    list(.slide_type = "p_grafico", slots = list(title = "x")),
    list(.slide_type = "section", title = "Gestión"),
    list(.slide_type = "section", slots = list(title = "  "))
  )
  caps <- .lam_indice_capitulos_del_plan(plan)
  expect_identical(caps, c("Perfil del encuestado", "Gestión"))
  expect_true(.lam_indice_cabe(caps))
  expect_identical(.lam_indice_capitulos_del_plan(list()), character(0))
})

test_that("un índice con sus campos en texto vacío también toma los capítulos (así llegan desde la app)", {
  slots <- list(secciones = "", subindices = "")
  expect_false(any(nzchar(trimws(unlist(slots$subindices %||% character(0))))))
})

test_that("los capítulos largos de un informe real caben en el índice del recetario a dos líneas", {
  caps <- c("PERFIL DEL ENCUESTADO", "CARACTERISTICA INSTITUCIONALES", "DESARROLLO DE POLÍTICAS INSTITUCIONALES",
            "ESTRUCTURA ORGANIZACIONAL, ADMINISTRATIVA Y FINANCIERA", "CUERPO ACADÉMICO", "ESTUDIANTES Y GRADUADOS",
            "INFRAESTRUCTURA, INSTALACIONES Y RECURSOS DE APOYO", "CARACTERÍSTICAS DEL PERFIL DE EGRESO",
            "ESTRUCTURA CURRICULAR", "VINCULACIÓN CON EL MEDIO Y DESARROLLO SOSTENIBLE", "INTERNALIZACIÓN INTEGRAL",
            "INVESTIGACIÓN, DESARROLLO E INNOVACIÓN (I+D+i)", "INTEGRIDAD Y TRANSPARENCIA")
  expect_true(.lam_indice_cabe(caps))
  f <- .lam_indice_filas(caps, .lam_indice_geo(length(caps), 0))
  expect_gte(f$fs, 10.5)
  expect_lte(sum(f$alto), 6.95 - 1.75 + 1e-6)
  # Un título que ni a dos líneas cabe sigue cayendo a la ruta anterior.
  expect_false(.lam_indice_cabe(strrep("PALABRA LARGUÍSIMA ", 30)))
})

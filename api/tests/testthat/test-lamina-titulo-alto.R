# Un título de cuatro líneas montaba su última línea sobre el rótulo de la primera premisa (mazo de Arte y Diseño,
# 2026-10-12): la caja del título no se ajusta y la zona de datos no se movía.

largo <- paste("La Facultad de Arte y Diseño fomenta la participación de los(as) estudiantes en el medio profesional",
               "o laboral, a través de proyectos, experiencias preprofesionales, exposiciones artísticas, voluntariados",
               "y redes colaborativas.")

test_that("hasta tres líneas el título no mueve la zona de datos; con cuatro la baja", {
  expect_identical(.lam_titulo_desplazo("¿Cuál es su género?"), 0)
  tres <- "Los cursos y actividades asociados a la malla curricular contribuyen al desarrollo de las competencias de salida de Formación General."
  expect_identical(.lam_titulo_desplazo(tres), 0)
  expect_gt(.lam_lineas_tinta(largo, 10.4, .std_pt("titulo"), TRUE), 3L)
  expect_gt(.lam_titulo_desplazo(largo), 0.3)
})

test_that("la zona de datos sólo baja mientras se compone esa lámina", {
  y0 <- .std_geom("zona_datos_y0")
  dentro <- .lam_con_titulo(largo, .std_geom("zona_datos_y0"))
  expect_equal(dentro, y0 + .lam_titulo_desplazo(largo))
  expect_identical(.std_geom("zona_datos_y0"), y0)
})

test_that("en la lámina exportada el gráfico empieza bajo la última línea del título", {
  espec <- list(tipo = "escala")
  premisas <- list(list(texto = "La Facultad fomenta la participación", filas = 1L))
  # La comprobación de punta a punta: componer y medir la primera forma del bloque contra el fondo del título.
  skip_if_not(exists(".lam_laminas_escala"))
  local_mocked_bindings(
    .lam_escala_premisas = function(espec) premisas,
    .lam_escala_modo_filas = function(espec) FALSE,
    .lam_escala_partir = function(p) list(p),
    .lam_bloque_escala = function(lz, espec, premisas, solo = TRUE, ...) {
      assign("y_bloque", .std_geom("zona_datos_y0"), envir = globalenv()); invisible(lz)
    }
  )
  doc <- officer::read_pptx()
  r <- .lam_laminas_escala(doc, espec, titulo = largo, layout = "Title and Content", master = "Office Theme")
  fondo_titulo <- .std_geom("titulo_y") + 0.11 + .lam_lineas_tinta(largo, 10.4, .std_pt("titulo"), TRUE) * .std_pt("titulo") * 1.2 / 72
  expect_gt(get("y_bloque", envir = globalenv()), fondo_titulo)
  rm("y_bloque", envir = globalenv())
})

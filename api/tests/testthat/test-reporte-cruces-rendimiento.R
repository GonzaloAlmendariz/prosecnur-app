# Las tablas de cruces no se vuelven cuadráticas con el número de variables.
# HSyVbG 2026 (2026-10-21, H16): 331 variables en una hoja no terminaban en 81
# minutos porque openxlsx recorre todos los estilos previos en cada escritura.

.crr_fixture <- function(n_vars) {
  set.seed(1)
  nombres <- sprintf("p%02d", seq_len(n_vars))
  data <- as.data.frame(c(
    setNames(lapply(nombres, function(v) as.character(sample(1:4, 60, TRUE))), nombres),
    list(seg = as.character(sample(1:3, 60, TRUE)))
  ), stringsAsFactors = FALSE)
  instrumento <- list(
    survey = data.frame(name = c(nombres, "seg"),
                        type = c(rep("select_one esc", n_vars), "select_one grupo"),
                        list_name = c(rep("esc", n_vars), "grupo"),
                        label = c(paste("Pregunta", nombres), "Segmento"), stringsAsFactors = FALSE),
    choices = data.frame(list_name = c(rep("esc", 4), rep("grupo", 3)),
                         name = c(1:4, 1:3), label = c(paste("Opción", 1:4), paste("Grupo", 1:3)),
                         stringsAsFactors = FALSE)
  )
  list(data = data, instrumento = instrumento, secciones = list(General = nombres))
}

# Mayor cantidad de objetos de estilo que openxlsx tiene a la vista al cerrar
# cada tabla: es lo que recorre en cada addStyle(stack = TRUE) y writeData.
.crr_max_estilos_visibles <- function(n_vars) {
  fx <- .crr_fixture(n_vars)
  visto <- 0L
  archivar <- get(".xlsx_archivar_estilos", envir = asNamespace("prosecnurapp"))
  testthat::local_mocked_bindings(.xlsx_archivar_estilos = function(wb, archivo) {
    visto <<- max(visto, length(wb$styleObjects))
    archivar(wb, archivo)
  })
  out <- tempfile(fileext = ".xlsx")
  on.exit(unlink(out), add = TRUE)
  suppressMessages(reporte_cruces(data = fx$data, instrumento = fx$instrumento,
                                  SECCIONES = fx$secciones, cruces = "seg",
                                  path_xlsx = out, show_sig = TRUE))
  visto
}

test_that("los estilos a la vista de openxlsx no crecen con el número de variables", {
  pocos <- .crr_max_estilos_visibles(3)
  muchos <- .crr_max_estilos_visibles(12)
  expect_gt(pocos, 0L)
  # Con el archivado cada tabla sólo ve sus propios estilos (más los del título
  # de sección en la primera). Sin él, 12 variables ven ~4 veces lo de 3.
  expect_lte(muchos, pocos)
})

test_that("archivar los estilos no cambia el libro que se graba", {
  fx <- .crr_fixture(6)
  escribir <- function(path) suppressMessages(reporte_cruces(
    data = fx$data, instrumento = fx$instrumento, SECCIONES = fx$secciones,
    cruces = "seg", path_xlsx = path, show_sig = TRUE))
  con <- tempfile(fileext = ".xlsx"); sin <- tempfile(fileext = ".xlsx")
  on.exit(unlink(c(con, sin)), add = TRUE)
  escribir(con)
  local({
    testthat::local_mocked_bindings(.xlsx_archivar_estilos = function(wb, archivo) invisible(wb),
                                    .xlsx_restaurar_estilos = function(wb, archivo) invisible(wb))
    escribir(sin)
  })
  leer <- function(path, parte) {
    d <- tempfile(); on.exit(unlink(d, recursive = TRUE))
    utils::unzip(path, files = parte, exdir = d)
    readLines(file.path(d, parte), warn = FALSE, encoding = "UTF-8")
  }
  for (parte in c("xl/worksheets/sheet1.xml", "xl/styles.xml")) {
    expect_identical(leer(con, parte), leer(sin, parte), info = parte)
  }
})

# Planner › Equipo en Excel (figura vg-planner): la plantilla con la lista
# vigente y su lectura de vuelta, que es pura (guarda el PUT del equipo).

source("setup-load-all.R")

.pex_sesion <- function(envir = parent.frame()) {
  sid <- session_create()
  withr::defer(session_delete(sid), envir = envir)
  sid
}

.pex_declarar <- function(sid, tipos = c("territorial", "telefonico")) {
  .planner_declarar(sid, "perfiles", lapply(tipos, function(t) list(tipo = t)), 0L)
  .planner_declarar(sid, "equipo", list(code_format = "PXXX", personas = list(
    list(codigo = "P001", nombre = "Encuestador Ejemplo Uno", rol = "encuestador", perfiles = list("territorial")),
    list(codigo = "T01", nombre = "Operadora Ejemplo Dos", rol = "operador", perfiles = list("telefonico")),
    list(codigo = "S01", nombre = "Supervisor Ejemplo Tres", rol = "supervisor", perfiles = list("territorial", "telefonico"),
         activo = FALSE)
  )), 1L)
}

.pex_descargar <- function(sid) {
  r <- .planner_equipo_excel(sid)
  list(r = r, ruta = session_get(sid)$files[[r$file_id]]$path)
}

.pex_huella <- function(sid) {
  s <- .session_env[[sid]]
  s$last_access <- NULL
  s$files <- NULL
  digest::digest(s)
}

test_that("la plantilla trae la lista vigente y vuelve igual si nadie la toca", {
  sid <- .pex_sesion()
  .pex_declarar(sid)
  d <- .pex_descargar(sid)
  expect_equal(d$r$personas, 3L)
  expect_true(file.exists(d$ruta))
  expect_true(all(c("Equipo", "Listas") %in% openxlsx::getSheetNames(d$ruta)))
  antes <- .pex_huella(sid)
  leido <- .planner_equipo_importar(sid, file_raw = readBin(d$ruta, "raw", file.size(d$ruta)))
  expect_length(leido$problemas, 0L)
  vigente <- .planner_payload(session_get(sid))$planner$equipo$personas
  expect_equal(lapply(leido$personas, function(p) p[c("codigo", "nombre", "rol", "activo")]),
               lapply(vigente, function(p) p[c("codigo", "nombre", "rol", "activo")]))
  expect_equal(lapply(leido$personas, function(p) unlist(p$perfiles)), lapply(vigente, function(p) unlist(p$perfiles)))
  # Leer no escribe nada.
  expect_identical(.pex_huella(sid), antes)
})

test_that("una lista llenada a mano se lee con rótulos, y lo que no se entiende se dice por fila", {
  sid <- .pex_sesion()
  .pex_declarar(sid)
  ruta <- withr::local_tempfile(fileext = ".xlsx")
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "Hoja1")
  openxlsx::writeData(wb, "Hoja1", "Equipo del operativo", startRow = 1)
  openxlsx::writeData(wb, "Hoja1", data.frame(
    `Código` = c("P010", "P011", "P010", "", "P012", "P013"),
    Nombre = c("Ana Ejemplo", "Beto Ejemplo", "Ana Repetida", "", "", "Ceci Ejemplo"),
    Rol = c("encuestadora", "Supervisor", "Encuestador", "", "", "Operador"),
    Perfiles = c("Territorial presencial", "telefónico, territorial", "", "", "", "Aulas universitarias"),
    Activo = c("Sí", "No", "Sí", "", "", ""),
    check.names = FALSE), startRow = 3)
  openxlsx::saveWorkbook(wb, ruta)
  leido <- .planner_equipo_importar(sid, file_raw = readBin(ruta, "raw", file.size(ruta)))
  expect_equal(vapply(leido$personas, `[[`, "", "codigo"), c("P010", "P011", "P013"))
  expect_equal(vapply(leido$personas, `[[`, "", "rol"), c("encuestador", "supervisor", "operador"))
  expect_equal(unlist(leido$personas[[2]]$perfiles), c("telefonico", "territorial"))
  expect_false(leido$personas[[2]]$activo)
  expect_true(leido$personas[[3]]$activo)
  # Aulas no es un perfil del estudio: se ignora y se dice.
  expect_length(leido$personas[[3]]$perfiles, 0L)
  motivos <- vapply(leido$problemas, `[[`, "", "motivo")
  filas <- vapply(leido$problemas, `[[`, 0, "fila")
  expect_match(motivos, "encuestadora", all = FALSE)
  expect_match(motivos, "P010 aparece dos veces", all = FALSE)
  expect_match(motivos, "P012 no tiene nombre", all = FALSE)
  expect_match(motivos, "no declara Aulas universitarias", all = FALSE)
  expect_true(all(filas >= 4))
  # Lo leído se puede declarar tal cual.
  expect_no_error(.planner_declarar(sid, "equipo", list(code_format = "PXXX", personas = leido$personas), 2L))
})

test_that("con un solo perfil, la celda vacía va a ese perfil", {
  sid <- .pex_sesion()
  .planner_declarar(sid, "perfiles", list(list(tipo = "aulas")), 0L)
  ruta <- withr::local_tempfile(fileext = ".xlsx")
  openxlsx::write.xlsx(data.frame(Nombre = "Aplicadora Ejemplo", Rol = "Aplicador"), ruta)
  leido <- .planner_equipo_importar(sid, file_raw = readBin(ruta, "raw", file.size(ruta)))
  expect_equal(unlist(leido$personas[[1]]$perfiles), "aulas")
  expect_equal(leido$personas[[1]]$codigo, "")
})

test_that("un archivo que no es la plantilla se rechaza con un error claro", {
  sid <- .pex_sesion()
  err <- tryCatch(.planner_equipo_importar(sid, file_raw = NULL), error = identity)
  expect_equal(err$code, "E_PLANNER_INVALIDO")
  ruta <- withr::local_tempfile(fileext = ".xlsx")
  openxlsx::write.xlsx(data.frame(Manzana = 1:3), ruta)
  err <- tryCatch(.planner_equipo_importar(sid, file_raw = readBin(ruta, "raw", file.size(ruta))), error = identity)
  expect_equal(err$code, "E_PLANNER_INVALIDO")
  expect_match(conditionMessage(err), "Nombre")
})

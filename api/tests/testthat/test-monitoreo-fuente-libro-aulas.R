# El libro operativo como FUENTE de Monitoreo.
#
# Es el mismo papel que cumple el Excel de barrido en telefonico: una hoja que
# la app genera, alguien llena y el motor consulta para decidir. Sin esto el
# libro seria un import suelto y no una fuente del estudio.

.mfl_fuentes <- function() list(
  list(id = "libro", kind = "aulas_libro", role = "agendamiento", label = "Libro operativo"),
  list(id = "campo", kind = "google_sheets", role = "parte_campo",
       spreadsheet_id = "abc", sheet_name = "Aulas Aplicadas"),
  list(id = "ctrl", kind = "google_sheets", role = "control",
       spreadsheet_id = "abc", sheet_name = "Base de control"),
  list(id = "kobo1", kind = "kobo", role = "respuestas", asset_uid = "aX")
)

test_that("los tres roles del libro sobreviven a la normalizacion", {
  n <- monitoreo_normalize_sources(.mfl_fuentes())
  roles <- vapply(n, function(s) s$role, character(1))

  # El control: el vocabulario esta escrito DOS veces —el `switch` y el
  # guardian `.monitoreo_allowed_source_roles()`—. Anadirlo solo en uno hacia
  # que el rol se reescribiera a "respuestas" en silencio.
  expect_identical(roles, c("agendamiento", "parte_campo", "control", "respuestas"))
})

test_that("el libro cuenta como fuente de avance en aulas", {
  n <- monitoreo_normalize_sources(.mfl_fuentes())
  av <- monitoreo_fuentes_avance(n, "aulas_universitarias")
  expect_length(av, 4L)
})

test_that("registrar el libro no cambia lo que cuenta en los otros modos", {
  n <- monitoreo_normalize_sources(.mfl_fuentes())
  # Telefonico sigue mirando su barrido y sus respuestas, no el libro de aulas.
  tel <- monitoreo_fuentes_avance(n, "telefonico")
  expect_identical(vapply(tel, function(s) s$id, character(1)), "kobo1")
  acr <- monitoreo_fuentes_avance(n, "acreditacion")
  expect_identical(vapply(acr, function(s) s$id, character(1)), "kobo1")
})

test_that("el libro en Drive llega como google_sheets con el mismo rol", {
  # Gonzalo lo describio asi: un solo Sheet con tres pestanas. El rol es el
  # mismo; solo cambia por donde entra.
  n <- monitoreo_normalize_sources(list(
    list(id = "drive", kind = "google_sheets", role = "agenda",
         spreadsheet_id = "abc", sheet_name = "Aulas Agendadas")
  ))
  expect_identical(n[[1]]$role, "agendamiento")
  expect_length(monitoreo_fuentes_avance(n, "aulas_universitarias"), 1L)
})

test_that("el rol del parte NO puede llamarse «campo»", {
  # `.monitoreo_safe_name("")` devuelve literalmente "campo" como relleno de lo
  # vacio. Un rol llamado asi es indistinguible de la ausencia de rol: al
  # declararlo valido, TODA fuente sin rol —de telefonico y de acreditacion
  # tambien— pasaba a ser "campo" en silencio.
  expect_identical(.monitoreo_safe_name(""), "campo")
  expect_false("campo" %in% .monitoreo_allowed_source_roles())
  expect_true("parte_campo" %in% .monitoreo_allowed_source_roles())

  # El control: una fuente sin rol sigue cayendo a su default de siempre.
  sin_rol <- monitoreo_normalize_sources(list(list(id = "vieja", kind = "kobo", role = "")))
  expect_identical(sin_rol[[1]]$role, "respuestas")
})

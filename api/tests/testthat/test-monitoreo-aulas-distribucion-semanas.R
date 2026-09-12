
# --- quién NO sale esta semana ------------------------------------------------
#
# Gonzalo, 2026-09-12: «no sé si esta distribución la puede hacer la app
# tomando lo que hemos hecho, porque yo le he dicho: mira, tengo esta lista,
# quiero que me generes esto para esta semana». Elegir la semana ya se podía
# (el rango de despliegue, B75) y la pestaña se nombra sola; lo que faltaba era
# la LISTA: dejar a alguien fuera exigía editar el archivo de disponibilidad y
# volver a cargarlo. El operativo pierde y gana gente cada semana —la 1 salió
# con 19 y la 2 con 17—, así que no es un caso raro.

.tds_disp <- function(nombre) list(
  nombre = nombre,
  dias = stats::setNames(rep(list(list(list(inicio = "08:00", fin = "20:00"))), 6L),
                         c("lunes", "martes", "miercoles", "jueves", "viernes", "sabado")))

test_that("sin lista de fuera, la oferta vuelve intacta", {
  disp <- list(.tds_disp("Ana Prueba"), .tds_disp("Berta Ficticia"))
  expect_identical(monitoreo_aulas_disponibilidad_sin(disp, NULL), disp)
  expect_identical(monitoreo_aulas_disponibilidad_sin(disp, character(0)), disp)
  expect_identical(monitoreo_aulas_disponibilidad_sin(disp, c("", "  ")), disp)
})

test_that("quien está fuera no sale, y da igual cómo se teclee su nombre", {
  disp <- list(.tds_disp("Aquino Dulanto, Alejandro"), .tds_disp("Ana Prueba"))
  # Sin coma, en mayúsculas y sin tilde: es la misma persona. Comparar el texto
  # tal cual dejaría fuera a nadie, que es peor que no tener la función.
  quedan <- monitoreo_aulas_disponibilidad_sin(disp, "AQUINO DULANTO ALEJANDRO")
  expect_length(quedan, 1L)
  expect_identical(quedan[[1]]$nombre, "Ana Prueba")
})

test_that("el reparto reparte entre los que SÍ salen, sin dejar huecos", {
  # Citas ESCALONADAS: una sola persona puede con las cuatro, así que quitar a
  # la otra no descubre ninguna. (El reparto es `concentrado` por defecto: con
  # horas que no se solapan carga a una y no reparte por repartir.)
  plan <- lapply(1:4, function(i) list(
    operational_code = sprintf("CH %d", i), sample_role = "titular",
    operational_status = "agendada", scheduled_date = "2026-09-08",
    scheduled_time = sprintf("%02d:00", 8 + i)))
  disp <- list(.tds_disp("Ana Prueba"), .tds_disp("Berta Ficticia"))
  quienes <- function(rep) sort(unique(unlist(lapply(rep$dias, function(d) {
    vapply(d$asignaciones, function(a) as.character(a$aplicador), character(1))
  }))))

  sin_ana <- monitoreo_aulas_reparto_de_config(
    plan, disp, list(reparto_fuera = "Ana Prueba"))
  expect_identical(quienes(sin_ana), "Berta Ficticia")
  asignadas <- sum(vapply(sin_ana$dias, function(d) length(d$asignaciones), integer(1)))
  expect_equal(asignadas, 4L)
  descubiertas <- sum(vapply(sin_ana$dias, function(d) length(d$no_cubiertos %||% list()), integer(1)))
  expect_equal(descubiertas, 0L)
})

test_that("si al quitar a alguien un aula se queda sin nadie, SE DECLARA", {
  # Dos citas a la MISMA hora: hacen falta dos personas. Quitar a una deja una
  # aula descubierta, y eso tiene que salir en `no_cubiertos` — desaparecer en
  # silencio mandaría a nadie a un aula que el equipo cree cubierta.
  plan <- list(
    list(operational_code = "CH 1", sample_role = "titular",
         operational_status = "agendada", scheduled_date = "2026-09-08",
         scheduled_time = "09:00"),
    list(operational_code = "CH 2", sample_role = "titular",
         operational_status = "agendada", scheduled_date = "2026-09-08",
         scheduled_time = "09:00"))
  disp <- list(.tds_disp("Ana Prueba"), .tds_disp("Berta Ficticia"))

  con_dos <- monitoreo_aulas_reparto_de_config(plan, disp, list())
  expect_equal(sum(vapply(con_dos$dias, function(d) length(d$asignaciones), integer(1))), 2L)

  con_una <- monitoreo_aulas_reparto_de_config(
    plan, disp, list(reparto_fuera = "Berta Ficticia"))
  expect_equal(sum(vapply(con_una$dias, function(d) length(d$asignaciones), integer(1))), 1L)
  descubiertas <- unlist(lapply(con_una$dias, function(d) d$no_cubiertos %||% list()))
  expect_length(descubiertas, 1L)
})

test_that("la config guarda la lista y descarta la basura", {
  cfg <- monitoreo_aulas_normalize_config(list(
    reparto_fuera = c("Ana Prueba", "", "  ", "Ana Prueba", "Berta Ficticia")))
  expect_identical(cfg$reparto_fuera, c("Ana Prueba", "Berta Ficticia"))
  # Sin la clave, no se inventa una lista vacía que parezca una decisión.
  expect_null(monitoreo_aulas_normalize_config(list())$reparto_fuera)
})

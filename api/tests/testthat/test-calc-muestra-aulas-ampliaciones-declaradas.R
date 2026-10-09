universo_demo <- function() data.frame(
  classroom_id = paste0("A", 1:5),
  faculty = c("ARQ", "ARQ", "ARQ", "DER", "ARQ"),
  session_type = c("TALLER", "TALLER", "LABORATORIO", "TALLER", "TALLER"),
  eligible_n = c(20, 30, 40, 50, 25),
  exclude_reason = c("session_type", "session_type", "session_type", "session_type", "min_eligible"),
  stringsAsFactors = FALSE
)

test_that("aplica varias declaraciones y devuelve un acta por cada una", {
  r <- calc_muestra_aulas_ampliaciones_declaradas(universo_demo(), list(
    list(facultad = "ARQ", criterio = "session_type", categorias = "taller"),
    list(facultad = "DER", criterio = "session_type", categorias = "taller")
  ))
  expect_equal(sort(r$aulas$classroom_id), c("A1", "A2", "A4"))
  expect_length(r$actas, 2L)
  expect_equal(r$actas[[1]]$aulas, 2L)
  expect_equal(r$actas[[2]]$aulas, 1L)
})

test_that("una declaracion que no admite nada tambien deja acta", {
  # Auditable: hay que poder ver que se declaro y no anadio nada, en vez de que
  # desaparezca sin rastro.
  r <- calc_muestra_aulas_ampliaciones_declaradas(universo_demo(), list(
    list(facultad = "PSICOLOGIA", criterio = "session_type", categorias = "taller")
  ))
  expect_equal(nrow(r$aulas), 0L)
  expect_length(r$actas, 1L)
  expect_equal(r$actas[[1]]$estado, "ninguna_admisible")
})

test_that("un aula que calza en dos declaraciones entra UNA vez", {
  # Duplicarla la contaria dos veces en cualquier suma de elegibles aguas abajo.
  r <- calc_muestra_aulas_ampliaciones_declaradas(universo_demo(), list(
    list(facultad = "ARQ", criterio = "session_type", categorias = "taller"),
    list(facultad = "ARQ", criterio = "session_type")
  ))
  expect_equal(sum(r$aulas$classroom_id == "A1"), 1L)
})

test_that("sin declaraciones no anade nada y no revienta", {
  r <- calc_muestra_aulas_ampliaciones_declaradas(universo_demo(), list())
  expect_equal(nrow(r$aulas), 0L)
  expect_length(r$actas, 0L)
})

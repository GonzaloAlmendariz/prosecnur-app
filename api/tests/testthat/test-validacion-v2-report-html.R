# =============================================================================
# Tests para build_report_html (Sprint 5 — stretch)
# =============================================================================
# Genera el reporte HTML autocontenido que se exporta desde el Limpieza.
# Estos tests validan que el HTML producido sea sintácticamente correcto
# (doctype, head/body), incluya las secciones esperadas, escape HTML
# malicioso (XSS), y maneje el scope vacío sin crashear.

test_that("build_report_html con scope vacío produce HTML completo", {
  html <- build_report_html(list())
  expect_true(grepl("^<!doctype html>", html, ignore.case = TRUE))
  expect_true(grepl("<html lang=\"es\">", html, fixed = TRUE))
  expect_true(grepl("<title>Reporte de validación</title>", html, fixed = TRUE))
  expect_true(grepl("</html>", html, fixed = TRUE))
  # Secciones base siempre presentes
  expect_true(grepl("Progreso", html))
  expect_true(grepl("Indicadores principales", html))
})

test_that("build_report_html incluye nombre de base y estudio cuando se pasan", {
  html <- build_report_html(
    list(),
    base_nombre = "docentes",
    estudio_nombre = "Acreditación PUCP"
  )
  expect_true(grepl("docentes", html, fixed = TRUE))
  expect_true(grepl("Acreditación PUCP", html, fixed = TRUE))
})

test_that("build_report_html refleja top reglas cuando hay evaluación", {
  scope <- list(
    plan_result = list(plan = tibble::tibble(ID = c("R1", "R2"))),
    evaluacion = list(resumen = tibble::tibble(
      id_regla = c("R1", "R2"),
      nombre_regla = c("Regla Alpha", "Regla Beta"),
      n_inconsistencias = c(42L, 8L)
    ))
  )
  html <- build_report_html(scope)
  expect_true(grepl("Regla Alpha", html, fixed = TRUE))
  expect_true(grepl("Regla Beta", html, fixed = TRUE))
  expect_true(grepl("42", html, fixed = TRUE))
})

test_that("build_report_html muestra reglas custom con badge Activa/Ignorada", {
  scope <- list(reglas_custom = list(
    list(id = "rc1", nombre = "Edad válida", tipo = "rango_num",
          activa = TRUE, mensaje = "Edad fuera de rango"),
    list(id = "rc2", nombre = "DNI único", tipo = "duplicados",
          activa = FALSE)
  ))
  html <- build_report_html(scope)
  expect_true(grepl("Edad válida", html, fixed = TRUE))
  expect_true(grepl("DNI único", html, fixed = TRUE))
  expect_true(grepl("Activa", html, fixed = TRUE))
  expect_true(grepl("Ignorada", html, fixed = TRUE))
})

test_that("build_report_html escapa HTML malicioso en nombres (XSS)", {
  scope <- list(reglas_custom = list(
    list(id = "x", nombre = "<script>alert(1)</script>",
          tipo = "no_nulo", activa = TRUE)
  ))
  html <- build_report_html(scope)
  # El script crudo NO debe aparecer — debe quedar escapado.
  expect_false(grepl("<script>alert", html, fixed = TRUE))
  expect_true(grepl("&lt;script&gt;", html, fixed = TRUE))
})

test_that("build_report_html es autocontenido (sin hrefs ni srcs externos)", {
  scope <- list(
    plan_result = list(plan = tibble::tibble(ID = "R1")),
    evaluacion = list(resumen = tibble::tibble(
      id_regla = "R1", nombre_regla = "X", n_inconsistencias = 1L
    ))
  )
  html <- build_report_html(scope)
  # No debe haber referencias a http(s), CDNs, ni <link rel="stylesheet">
  # a archivos externos. El objetivo del export es que funcione offline.
  expect_false(grepl("<link[^>]+rel=[\"']stylesheet[\"'][^>]+href=[\"']http", html, perl = TRUE))
  expect_false(grepl("<script[^>]+src=[\"']http", html, perl = TRUE))
  expect_false(grepl("@import[^;]+http", html, perl = TRUE))
})

test_that("build_report_html progreso refleja los 3 flags correctamente", {
  scope_all <- list(
    plan_result = list(plan = tibble::tibble(ID = "R1")),
    evaluacion = list(resumen = tibble::tibble(
      id_regla = "R1", nombre_regla = "X", n_inconsistencias = 0L
    )),
    reglas_custom = list(list(id = "rc", activa = TRUE))
  )
  html_all <- build_report_html(scope_all)
  # Check-mark unicode en HTML: &#10003; o ✓
  expect_true(grepl("done", html_all, fixed = TRUE))

  # Con scope vacío, todos deberían estar en "pending"
  html_empty <- build_report_html(list())
  expect_true(grepl("pending", html_empty, fixed = TRUE))
})

test_that("build_report_html renderiza decisiones con columna status sin crashear", {
  scope <- list(
    limpieza_draft = list(
      list(
        id = "D1",
        source_id = "RC_002",
        source_type = "custom_rule",
        scope = "variable",
        target_variable = "p7",
        target_case_ids = list(),
        action_type = "complete_select_multiple_hierarchy",
        action_params = list(hierarchy_map = list(`3` = c("2", "1"))),
        rationale = "Completar jerarquía",
        status = "ready"
      )
    )
  )

  html <- build_report_html(scope)
  expect_true(grepl("RC_002", html, fixed = TRUE))
  expect_true(grepl("Lista", html, fixed = TRUE))
})

test_that("reporte residual tolera metadatos anidados de tamanos distintos", {
  limpieza_payload <- list(
    before_after_preview = list(
      residual_final = list(list(
        id_regla = "R_DEGREE_YEAR",
        nombre_regla = "Anio de titulo coherente con egreso",
        n_inconsistencias = 3L,
        porcentaje = 12.5,
        variable_roles = list(
          target = "p8",
          compare = "p5",
          drivers = "p7",
          gate = "p7",
          all = c("p5", "p7", "p8"),
          labels = list(p5 = "Anio de egreso", p8 = "Anio del titulo"),
          tables = list(p5 = "principal", p8 = "principal")
        ),
        presentation = list(
          nombre_humano = "Anio de titulo coherente con egreso",
          nombre_tecnico = "coh_p8_degree_year",
          objetivo = "Evitar titulos anteriores al egreso",
          detalle_condicion = "Si p7 es 1, p8 debe ser mayor o igual que p5",
          subtipo_semantico = "if_then",
          gate_humano = "Tiene titulo"
        )
      ))
    )
  )

  html <- .report_residual_table(limpieza_payload)

  expect_true(grepl("R_DEGREE_YEAR", html, fixed = TRUE))
  expect_true(grepl("Anio de titulo coherente con egreso", html, fixed = TRUE))
  expect_true(grepl(">3<", html, fixed = TRUE))
})

# ---- QA visual del cierre de limpieza (ADR 0133, 2026-11-10) -----------------
#
# Un cierre de acnur_acg sin inconsistencias imprimía en "Reglas con más casos"
# nueve filas `NA | NA | —`: las reglas que el motor no pudo evaluar traen
# `n_inconsistencias = NA`, y filtrar con `x > 0L` indexa con NA y fabrica una
# fila vacía por cada una.

.rvh_resumen_sin_casos <- function() {
  tibble::tibble(
    id_regla = sprintf("R%02d", 1:10),
    nombre_regla = sprintf("Regla %02d", 1:10),
    n_inconsistencias = c(0L, rep(NA_integer_, 9L))
  )
}

.rvh_seccion <- function(html, titulo) {
  desde <- regexpr(paste0("<h2>", titulo, "</h2>"), html, fixed = TRUE)
  expect_true(desde > 0L, info = titulo)
  resto <- substring(html, desde + attr(desde, "match.length"))
  hasta <- regexpr("<h2>", resto, fixed = TRUE)
  if (hasta > 0L) substring(resto, 1L, hasta - 1L) else resto
}

test_that("las reglas sin conteo no fabrican filas NA en la tabla de reglas con más casos", {
  scope <- list(evaluacion = list(resumen = .rvh_resumen_sin_casos()))
  seccion <- .rvh_seccion(build_report_html(scope, limpieza_payload = list()), "Reglas con más casos")
  expect_false(grepl("<tr><td", seccion, fixed = TRUE))
  expect_false(grepl(">NA<", seccion, fixed = TRUE))
  expect_true(grepl("Ninguna regla evaluada arroja inconsistencias.", seccion, fixed = TRUE))
  # Las nueve no se descartan en silencio: el reporte dice cuántas y por qué.
  expect_true(grepl("9 reglas no se pudieron evaluar", seccion, fixed = TRUE))
})

test_that("con reglas con casos y reglas sin conteo, la tabla lista solo las que tienen casos", {
  resumen <- .rvh_resumen_sin_casos()
  resumen$n_inconsistencias[2] <- 7L
  seccion <- .rvh_seccion(
    build_report_html(list(evaluacion = list(resumen = resumen)), limpieza_payload = list()),
    "Reglas con más casos"
  )
  expect_identical(lengths(regmatches(seccion, gregexpr("<tr><td", seccion, fixed = TRUE))), 1L)
  expect_true(grepl("Regla 02", seccion, fixed = TRUE))
  expect_false(grepl(">NA<", seccion, fixed = TRUE))
  expect_true(grepl("8 reglas no se pudieron evaluar", seccion, fixed = TRUE))
})

test_that("una sola regla sin conteo concuerda en singular", {
  resumen <- tibble::tibble(id_regla = c("R1", "R2"), nombre_regla = c("A", "B"),
                            n_inconsistencias = c(3L, NA_integer_))
  seccion <- .rvh_seccion(
    build_report_html(list(evaluacion = list(resumen = resumen)), limpieza_payload = list()),
    "Reglas con más casos"
  )
  expect_true(grepl("1 regla no se pudo evaluar", seccion, fixed = TRUE))
})

test_that("los encabezados del reporte están en castellano, sin nombres de columna del motor", {
  scope <- list(
    plan_result = list(plan = tibble::tibble(ID = "R1")),
    evaluacion = list(resumen = tibble::tibble(id_regla = "R1", nombre_regla = "X", n_inconsistencias = 2L)),
    reglas_custom = list(list(id = "rc", nombre = "Edad", tipo = "rango_num", activa = TRUE)),
    limpieza_draft = list(list(
      id = "D1", source_id = "RC_002", source_type = "custom_rule", scope = "variable",
      target_variable = "p7", target_case_ids = list(), action_type = "exclude_cases",
      action_params = list(), rationale = "Fuera del marco", status = "ready"
    ))
  )
  payload <- list(
    summary = list(total_reglas_con_casos = 1L),
    decision_draft = scope$limpieza_draft,
    before_after_preview = list(
      before = list(total_inconsistencias = 2L), after = list(total_inconsistencias = 0L),
      residual_final = list(list(id_regla = "R1", nombre_regla = "X", n_inconsistencias = 0L, porcentaje = 0))
    )
  )
  html <- build_report_html(scope, limpieza_payload = payload)
  expect_false(grepl("Decision maker", html, fixed = TRUE))
  expect_true(grepl("<h2>Resumen de decisiones</h2>", html, fixed = TRUE))
  titulos <- regmatches(html, gregexpr("<(h2|th)[^>]*>[^<]*</(h2|th)>", html))[[1]]
  titulos <- gsub("<[^>]+>", "", titulos)
  internos <- c("id_regla", "nombre_regla", "n_inconsistencias", "porcentaje", "source_id",
                "action_type", "target_variable", "status", "rationale", "id")
  expect_identical(intersect(titulos, internos), character(0))
  expect_false(any(grepl("\\b(Top|custom|maker)\\b", titulos, ignore.case = TRUE)), info = paste(titulos, collapse = " | "))
  expect_false(grepl("Reglas custom", html, fixed = TRUE))
  # La acción y el estado se leen en palabras del oficio, no con el código del motor.
  decisiones <- .rvh_seccion(html, "Decisiones registradas")
  expect_true(grepl("Excluir registros", decisiones, fixed = TRUE))
  expect_true(grepl("Lista", decisiones, fixed = TRUE))
  expect_false(grepl("exclude_cases|>ready<", decisiones))
})

test_that("una celda sin dato queda vacía, sin raya", {
  scope <- list(reglas_custom = list(list(id = "rc", activa = TRUE)))
  payload <- list(summary = list(total_reglas_con_casos = NA_integer_),
                  kpis = list(list(title = "Total inconsistencias", meta = list(value = NA))))
  html <- build_report_html(scope, limpieza_payload = payload)
  expect_false(grepl("—", html, fixed = TRUE))
})

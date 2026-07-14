# Enumeración del "Tipo de docente" en la suite de criterios del marco
# universitario (.cm_criterios_enum_teacher): la variable solo debe exponerse
# como jerarquía cuando existe una jerarquía REAL (varios detalles compartiendo
# prefijo). Si la columna de la base no trae delimitador de nivel reconocible,
# cada valor sería su propio grupo con un único hijo idéntico -> jerarquía
# degenerada que el frontend pintaba como niveles ficticios. En ese caso debe
# colapsar a lista PLANA de categorías (kind "flat"), sin grupos degenerados.

.teacher_meta <- function() list(scope = "aula", kind = "hierarchical", label = "Tipo de docente")

# --- (a) Sin delimitador de jerarquía -> plano, sin grupos degenerados -------

test_that("tipo de docente sin delimitador colapsa a lista plana", {
  sets <- c("ORDINARIO PRINCIPAL", "CONTRATADO", "ORDINARIO PRINCIPAL",
            "JEFE DE PRACTICA", "CONTRATADO", "ORDINARIO-PRINCIPAL")
  out <- .cm_criterios_enum_teacher(.teacher_meta(), sets, "tipo_docente")

  expect_identical(out$kind, "flat")
  expect_null(out$groups)
  expect_true(!is.null(out$categories) && length(out$categories) >= 1L)
  expect_identical(out$id, "teacher_type")
  expect_identical(out$mappedColumn, "tipo_docente")

  cats <- stats::setNames(
    vapply(out$categories, function(c) c$aulas, integer(1)),
    vapply(out$categories, function(c) c$key, character(1))
  )
  # "CONTRATADO" aparece en 2 aulas; "ORDINARIO PRINCIPAL"/"ORDINARIO-PRINCIPAL"
  # (guion sin espacios NO es delimitador) normalizan al mismo text_key -> una
  # sola categoría plana con 3 aulas; "JEFE DE PRACTICA" en 1.
  expect_identical(unname(cats["contratado"]), 2L)
  expect_identical(unname(cats["ordinario_principal"]), 3L)
  expect_true("jefe_de_practica" %in% names(cats))
  # Ninguna categoría plana arrastra estructura de hijos.
  expect_true(all(vapply(out$categories, function(c) is.null(c$children), logical(1))))
})

# --- (b) Jerarquía real -> se preserva con grupos de >=2 hijos ---------------

test_that("tipo de docente con jerarquia real preserva grupos y multiples hijos", {
  sets <- c("DOCENTE ORDINARIO - PRINCIPAL", "DOCENTE ORDINARIO - ASOCIADO",
            "DOCENTE ORDINARIO - AUXILIAR", "DOCENTE CONTRATADO - CONTRATADO",
            "DOCENTE ORDINARIO - PRINCIPAL")
  out <- .cm_criterios_enum_teacher(.teacher_meta(), sets, "tipo_docente")

  expect_identical(out$kind, "hierarchical")
  expect_null(out$categories)
  grupos <- stats::setNames(out$groups, vapply(out$groups, function(g) g$key, character(1)))
  expect_true("docente_ordinario" %in% names(grupos))
  expect_true("docente_contratado" %in% names(grupos))

  ordinario <- grupos[["docente_ordinario"]]
  hijos <- vapply(ordinario$children, function(c) c$key, character(1))
  expect_true(all(c("docente_ordinario_principal", "docente_ordinario_asociado",
                    "docente_ordinario_auxiliar") %in% hijos))
  # El grupo ordinario aparece en 4 aulas: principal (sets 1 y 5), asociado
  # (set 2) y auxiliar (set 3). Cada set es un aula; el dedup es intra-set.
  expect_identical(ordinario$aulas, 4L)
})

# --- (c) Delimitador " / " tambien reconocido como jerarquia -----------------

test_that("delimitador barra con espacios funciona como jerarquia", {
  sets <- c("ORDINARIO / PRINCIPAL", "ORDINARIO / ASOCIADO", "CONTRATADO / TC")
  out <- .cm_criterios_enum_teacher(.teacher_meta(), sets, "tipo_docente")
  expect_identical(out$kind, "hierarchical")
  grupos <- vapply(out$groups, function(g) g$key, character(1))
  expect_true("ordinario" %in% grupos)
  ordinario <- Filter(function(g) g$key == "ordinario", out$groups)[[1]]
  expect_identical(length(ordinario$children), 2L)
})

# --- (d) Cada grupo con exactamente un hijo -> plano -------------------------

test_that("grupos con un unico hijo (sin prefijo compartido) colapsan a plano", {
  # Delimitador presente pero cada prefijo es unico: no hay jerarquia real.
  sets <- c("ORDINARIO - PRINCIPAL", "CONTRATADO - TC")
  out <- .cm_criterios_enum_teacher(.teacher_meta(), sets, "tipo_docente")
  expect_identical(out$kind, "flat")
  expect_null(out$groups)
  labels <- vapply(out$categories, function(c) c$label, character(1))
  expect_true(all(c("ORDINARIO - PRINCIPAL", "CONTRATADO - TC") %in% labels))
})

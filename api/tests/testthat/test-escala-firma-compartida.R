source("setup-load-all.R")

# La regla de «misma escala» vivia dos veces: normalizada en equivalencias y
# cruda en Graficos. En el mismo proyecto el mazo agrupaba dos variables en un
# bloque —misma escala— y el validador del plan declaraba «estas preguntas no
# comparten una escala compatible» y BLOQUEABA el export de un mazo que el motor
# renderiza bien. Medido en Acreditacion Contabilidad: 30 errores sobre 44
# laminas, todos por lo mismo.

.ef_inst <- function(labels) {
  list(
    survey = data.frame(type = "select_one lk", name = "p1", label = "P",
                        stringsAsFactors = FALSE),
    choices = data.frame(list_name = "lk", name = as.character(seq_along(labels)),
                         label = labels, stringsAsFactors = FALSE)
  )
}

test_that("la caja y los espacios de una opcion no cambian la escala", {
  a <- .escala_firma(c("1", "2"), c("Totalmente en Desacuerdo", "De acuerdo"))
  b <- .escala_firma(c("1", "2"), c("totalmente en desacuerdo", "  De   acuerdo "))
  expect_equal(a, b)

  # El CODIGO si se compara literal: ahi un 1 contra un 2 cambia lo que la barra
  # significa.
  expect_false(identical(a, .escala_firma(c("1", "3"), c("Totalmente en Desacuerdo", "De acuerdo"))))
})

test_that("Graficos y Equivalencias dan la MISMA firma para la misma escala", {
  # Es la aserción que impide que vuelvan a divergir.
  labels_a <- c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "SIN INF")
  labels_b <- c("Totalmente en Desacuerdo", "En Desacuerdo", "De Acuerdo", "SIN INF")

  equiv_a <- .equiv_firma_escala(.ef_inst(labels_a), "p1")
  equiv_b <- .equiv_firma_escala(.ef_inst(labels_b), "p1")
  expect_equal(equiv_a, equiv_b)

  graf_a <- .graficos_choices_for_list(.ef_inst(labels_a)$choices, "lk")$signature
  graf_b <- .graficos_choices_for_list(.ef_inst(labels_b)$choices, "lk")$signature
  expect_equal(graf_a, graf_b)

  # Y las dos superficies coinciden entre si, no solo consigo mismas.
  expect_equal(equiv_a, graf_a)
})

test_that("la etiqueta que se MUESTRA conserva su caja original", {
  # Solo la firma normaliza: el analista lee «Totalmente en Desacuerdo» tal como
  # lo escribio el cuestionario.
  meta <- .graficos_choices_for_list(.ef_inst(c("Totalmente en Desacuerdo", "De acuerdo"))$choices, "lk")
  expect_equal(meta$items[[1]]$label, "Totalmente en Desacuerdo")
  expect_match(meta$signature, "totalmente en desacuerdo", fixed = TRUE)
})

test_that("una escala vacia no produce firma", {
  expect_equal(.escala_firma(character(0), character(0)), "")
})

# ADR 0096 decisión 4: el bloqueo del consolidado usaba una TERCERA regla
# —`codigo=etiqueta` literal en `.graficos_consolidado_scale_spec`— y rechazaba lo
# que la matriz aprueba (56 de 58 temas en ACRD Conta difieren sólo en la caja).

.ef_ctx <- function(labels, codigos = as.character(seq_along(labels))) {
  inst <- .ef_inst(labels)
  inst$choices$name <- codigos
  inst$survey$list_name <- "lk"
  dat <- data.frame(p1 = codigos[1], stringsAsFactors = FALSE)
  .graficos_consolidado_ref_context("a$p1", list(data_sources = list(a = dat), inst_sources = list(a = inst)))
}

test_that("R5: el bloqueo del consolidado firma con .escala_firma, igual que la matriz", {
  labels_a <- c("Totalmente en desacuerdo", "De acuerdo")
  labels_b <- c("Totalmente en Desacuerdo", "  De   acuerdo ")
  firma_a <- .graficos_consolidado_scale_spec(.ef_ctx(labels_a))$signature
  firma_b <- .graficos_consolidado_scale_spec(.ef_ctx(labels_b))$signature
  expect_identical(firma_a, firma_b)
  # Y es la misma firma que calcula Equivalencias para esa variable.
  expect_identical(firma_a, .equiv_firma_escala(.ef_inst(labels_a), "p1"))
  # El código sigue comparándose literal: «1» y «01» son escalas distintas.
  firma_c <- .graficos_consolidado_scale_spec(.ef_ctx(labels_a, codigos = c("01", "02")))$signature
  expect_false(identical(firma_a, firma_c))
})

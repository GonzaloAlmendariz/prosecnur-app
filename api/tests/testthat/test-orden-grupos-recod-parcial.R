# Regresión B0a (CCSS Perfil 2026-II): un `grupos_recod` PARCIAL desordenaba la recodificada.
#
# El editor de Codificación persiste sólo los grupos que el analista tocó. `.apply_grupos_recod_orden()` ponía esos
# códigos a la cabeza y dejaba el resto detrás, así que en Frecuencias y Cruces A1 salía «Décimo ciclo, No sabe,
# Sexto…Noveno, Otro» y en B14 el 99 quedaba a mitad de lista. Una lista parcial reordena sólo lo que nombra, en las
# posiciones que esos códigos ya ocupaban; los especiales [80,100) van al final de la lista COMPLETA.

inst_recod <- function(var, names, labels = paste0("L", names), type = "select_one") {
  list(
    survey = data.frame(
      type = c(paste(type, paste0("lst_", var)), paste(type, paste0("lst_", var, "_recod"))),
      name = c(var, paste0(var, "_recod")),
      list_name = c(paste0("lst_", var), paste0("lst_", var, "_recod")),
      stringsAsFactors = FALSE, check.names = FALSE
    ),
    orders_list = stats::setNames(list(list(names = names, labels = labels, label = var)), paste0(var, "_recod"))
  )
}

grupos <- function(...) lapply(c(...), function(code) list(codigo = code, etiqueta = code))

test_that("una lista parcial que ya respeta el instrumento no mueve nada (A1)", {
  inst <- inst_recod("A1", c("6", "7", "8", "9", "70", "10", "98"))
  por_parent <- prosecnurapp:::.orden_grupos_recod_por_parent(list(A1 = grupos("10", "98")))
  out <- prosecnurapp:::.apply_grupos_recod_orden(inst, por_parent)
  expect_equal(out$orders_list$A1_recod$names, c("6", "7", "8", "9", "70", "10", "98"))
  expect_equal(out$orders_list$A1_recod$labels, paste0("L", c("6", "7", "8", "9", "70", "10", "98")))
})

test_that("un especial de la lista parcial queda al final de la lista completa (B14, E2)", {
  inst <- inst_recod("B14", c("1", "2", "3", "80", "4", "99"))
  por_parent <- prosecnurapp:::.orden_grupos_recod_por_parent(list(B14 = grupos("1", "2", "80", "99")))
  out <- prosecnurapp:::.apply_grupos_recod_orden(inst, por_parent)
  expect_equal(out$orders_list$B14_recod$names, c("1", "2", "3", "4", "80", "99"))

  inst <- inst_recod("E2", c("1", "2", "3", "4", "5", "99"))
  out <- prosecnurapp:::.apply_grupos_recod_orden(inst, prosecnurapp:::.orden_grupos_recod_por_parent(list(E2 = grupos("4", "99"))))
  expect_equal(out$orders_list$E2_recod$names, c("1", "2", "3", "4", "5", "99"))
})

test_that("lo que la lista nombra se reordena entre sí sin arrastrar al resto", {
  inst <- inst_recod("B3", c("1", "2", "3", "4", "5"))
  out <- prosecnurapp:::.apply_grupos_recod_orden(inst, prosecnurapp:::.orden_grupos_recod_por_parent(list(B3 = grupos("4", "2"))))
  # 2 y 4 intercambian sus lugares; 1, 3 y 5 no se mueven.
  expect_equal(out$orders_list$B3_recod$names, c("1", "4", "3", "2", "5"))
  expect_equal(out$orders_list$B3_recod$labels[match("4", out$orders_list$B3_recod$names)], "L4")
})

test_that("una lista completa sigue mandando entera (flechas sobre todos los grupos)", {
  inst <- inst_recod("p9", c("1", "2", "3"), type = "select_multiple")
  out <- prosecnurapp:::.apply_grupos_recod_orden(inst, prosecnurapp:::.orden_grupos_recod_por_parent(list(p9 = grupos("3", "1", "2"))))
  expect_equal(out$orders_list$p9_recod$names, c("3", "1", "2"))
})

# Regresión: el orden de las flechas de Codificación no puede meter los
# valores especiales en medio del catálogo.
#
# El editor agrega cada categoría nueva al FINAL del array de grupos, o sea
# después del "Otros" (96) y del "Ninguno" (97). `.apply_grupos_recod_orden()`
# propagaba ese orden tal cual al libro de códigos y a la BBDD, pisando la regla
# que `.add_recoded_q()` ya aplica al construir la lista.
#
# Medido en ACNUR V3: `UNCHR_improving_recod` salía 1,2,3,4,5,6,97,96,7,8 —con
# "Mayor difusión" y "Apoyo en cobertura de trámites" detrás de los especiales—
# en vez de 1,2,3,4,5,6,7,8,97,96.

test_that(".orden_especiales_al_final mueve 80-100 al final conservando el resto", {
  f <- prosecnurapp:::.orden_especiales_al_final
  expect_equal(f(c("1","2","96","97","7","8")), c("1","2","7","8","96","97"))
  # El orden relativo entre especiales es del analista y se respeta.
  expect_equal(f(c("1","97","96","7")), c("1","7","97","96"))
  # Sin especiales, o sólo especiales, no se toca nada.
  expect_equal(f(c("3","1","2")), c("3","1","2"))
  expect_equal(f(c("96","97")), c("96","97"))
  # Códigos no numéricos no se reordenan.
  expect_equal(f(c("a","b","96")), c("a","b","96"))
  expect_equal(f(character(0)), character(0))
  expect_equal(f("96"), "96")
})

test_that("el orden del editor no deja categorías nuevas detrás de los especiales", {
  inst <- list(
    survey = data.frame(
      type = c("select_multiple lst_p9", "select_multiple lst_p9_recod"),
      name = c("p9", "p9_recod"),
      list_name = c("lst_p9", "lst_p9_recod"),
      stringsAsFactors = FALSE, check.names = FALSE
    ),
    orders_list = list(
      p9_recod = list(
        names = c("1", "2", "7", "8", "96", "97"),
        labels = c("Uno", "Dos", "Difusión", "Trámites", "Otros", "Ninguno"),
        label = "¿Qué mejorarías?"
      )
    )
  )
  # Tal como lo persiste el editor: las categorías nuevas al final del array.
  grupos_recod <- list(p9 = list(
    list(codigo = "1", etiqueta = "Uno"), list(codigo = "2", etiqueta = "Dos"),
    list(codigo = "97", etiqueta = "Ninguno"), list(codigo = "96", etiqueta = "Otros"),
    list(codigo = "7", etiqueta = "Difusión"), list(codigo = "8", etiqueta = "Trámites")
  ))
  por_parent <- prosecnurapp:::.orden_grupos_recod_por_parent(grupos_recod)
  expect_equal(por_parent$p9, c("1", "2", "97", "96", "7", "8"))

  out <- prosecnurapp:::.apply_grupos_recod_orden(inst, por_parent)
  codes <- out$orders_list$p9_recod$names
  expect_equal(codes, c("1", "2", "7", "8", "97", "96"))

  # Y la etiqueta sigue pegada a su código después del reordenamiento.
  expect_equal(out$orders_list$p9_recod$labels[match("7", codes)], "Difusión")
  expect_equal(out$orders_list$p9_recod$labels[match("96", codes)], "Otros")
})

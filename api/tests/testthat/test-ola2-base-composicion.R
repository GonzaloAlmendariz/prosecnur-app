# Ola 2, G8 / Q2 (captura «I. Cuatro gráficos con exclusión»): el pie decía «Base: 113 docentes», la base de la apilada
# que excluye un grupo, mientras las categóricas de abajo decían «115 respuestas»; y el pie no decía «Excluye el grupo…».
# La escala con cruce no trae un n por gráfico, la compuerta veía «misma base» y la base automática salía del primero.
#
# Regla del motor (lamina_mixtas_base_principal.R): el pie lleva la base principal (la de mayor n) del mismo público y
# cada panel cuyo n difiere dice el suyo; el n de cada gráfico es el de su «Base:» (casos válidos del gráfico). La nota
# de grupos excluidos va al pie.
# Q5: varias bases de públicos distintos se escriben en una sola frase, «Base: 115 docentes y 279 estudiantes».

test_that("G8/Q2: con bases distintas el pie lleva la principal y el panel que difiere dice la suya", {
  skip_if_not_installed("officer")
  pth <- .ola2_lamina_i()
  cajas <- .ola2_cajas(pth, 1L)
  pie <- cajas$texto[startsWith(cajas$texto, "Base:")]
  expect_identical(length(pie), 1L)
  expect_match(pie, "^Base: 77\\b")
  expect_false(grepl("Base: 64", pie, fixed = TRUE))
  expect_match(pie, "Excluye el grupo Derecho", fixed = TRUE)
  # La apilada que excluye Derecho tiene 64 casos válidos (77 menos los 13 de Derecho): su panel lo dice.
  expect_true("64 respuestas" %in% cajas$texto)
  expect_false("77 respuestas" %in% cajas$texto)
})

test_that("G8/Q2: en la lámina de dos gráficos la exclusión también llega al pie", {
  skip_if_not_installed("officer")
  fx <- .ola2_familias()
  t2 <- list(top2box_labels = c("De acuerdo", "Totalmente de acuerdo"))
  pth <- .ola2_pptx(fx, list(p_slide_2_graficos(
    titulo = "Dos con exclusión",
    izquierda = p_barras_apiladas(var = "doc$q19", cruces = "doc$cat6", overrides = t2, excluir_grupos = list("Derecho")),
    derecha = p_barras_agrupadas(var = "doc$sx"))))
  cajas <- .ola2_cajas(pth, 1L)
  pie <- cajas$texto[startsWith(cajas$texto, "Base:")]
  expect_identical(pie, "Base: 77. Excluye el grupo Derecho.")   # A6 (ola 4): cierra con punto
  expect_true("64 respuestas" %in% cajas$texto)
})

test_that("Q5: las bases de varios públicos se escriben en una sola frase", {
  expect_identical(.lam_bases_unir(c("Base: 115 docentes", "Base: 279 estudiantes")), "Base: 115 docentes y 279 estudiantes")
  expect_identical(.lam_bases_unir(c("Base: 115 docentes", "Base: 279 estudiantes", "Base: 40 administrativos")),
                   "Base: 115 docentes, 279 estudiantes y 40 administrativos")
  expect_identical(.lam_bases_unir("Base: 115 docentes"), "Base: 115 docentes")
  # Con otra oración dentro, se juntan como antes.
  expect_identical(.lam_bases_unir(c("Base: 115 docentes. Excluye el grupo A", "Base: 279 estudiantes")),
                   "Base: 115 docentes. Excluye el grupo A. Base: 279 estudiantes")
})

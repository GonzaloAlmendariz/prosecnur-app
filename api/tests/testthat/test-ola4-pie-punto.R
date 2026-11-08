# Ola 4, A6: el pie que junta oraciones cierra con punto, como los demás pies de la lámina. En la «I. Cuatro gráficos con
# exclusión» salía «Base: 115 docentes. Excluye el grupo Principal. Diferencias entre los grupos mostrados», sin punto.

test_that("el pie que une oraciones cierra con punto y un rótulo suelto queda como llegó", {
  expect_identical(.lam_unir_base("Base: 115 docentes", "Excluye el grupo Principal.", "Diferencias entre los grupos mostrados."),
                   "Base: 115 docentes. Excluye el grupo Principal. Diferencias entre los grupos mostrados.")
  expect_identical(.lam_unir_base("Base: 115 docentes", "Excluye el grupo Principal"),
                   "Base: 115 docentes. Excluye el grupo Principal.")
  expect_identical(.lam_unir_base("Base: 115 docentes"), "Base: 115 docentes")          # rótulo suelto: sin punto añadido
  expect_identical(.lam_unir_base("Excluye el grupo Otro."), "Excluye el grupo Otro.")  # el que ya lo traía lo conserva
  expect_identical(.lam_unir_base("Base: 5..", NULL, "", "Nota. "), "Base: 5. Nota.")    # sin dobles puntos
  expect_identical(.lam_unir_base(NULL, ""), "")
  expect_identical(.lam_con_punto("Base: 5. Nota."), "Base: 5. Nota.")                  # quien cierra no duplica el punto
  expect_identical(.lam_con_punto(""), "")
})

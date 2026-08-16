# La cifra de la columna extra no puede ser la letra más pequeña de la lámina.
#
# `size_barra_extra` es el N que la columna de totales repite por barra: en una
# lámina de perfil aparece catorce veces. Su default de firma era 9 pt mientras
# el resto del gráfico iba a 14, y sumaba 123 textos pequeños en el mazo — el
# residuo de tipografía que quedó abierto tras corregir el de apiladas.
#
# Es el mismo fallo dos veces: los presets declaran estos tamaños, pero esa capa
# sólo llega si el proyecto la trae en su config; cuando no, manda la firma.

test_that("el default de la cifra extra no baja del cuerpo minimo", {
  # 12 pt es el cuerpo mínimo medido sobre el entregable aprobado.
  expect_gte(eval(formals(graficar_barras_agrupadas)$size_barra_extra), 12)
})

test_that("apiladas y agrupadas no se contradicen entre si", {
  # Dos graficadores que comparten lámina no pueden escribir la misma cifra con
  # cuerpos distintos.
  expect_identical(
    eval(formals(graficar_barras_agrupadas)$size_barra_extra),
    eval(formals(graficar_barras_apiladas)$size_barra_extra)
  )
})

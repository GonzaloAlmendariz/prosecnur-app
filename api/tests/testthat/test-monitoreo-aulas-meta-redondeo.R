# La meta del aula es un valor ESPERADO con decimales; lo obtenido son personas.
# Comparar `obtenidas >= meta` con la meta cruda parece «no redondear» y no lo es:
# con un entero a la izquierda, `17 >= 17,4` es identico a `17 >= 18`. Es un techo
# implicito que nadie decidio y que exige a cada aula rendir por encima de su
# propia media —cuando por construccion la mitad cae por debajo—.
#
# Medido sobre las 194 aulas aplicadas de 2025: 191 de 194 metas no son enteras,
# y el criterio crudo declara 103 aulas conformes donde el redondeo a la mas
# cercana declara 113. Diez aulas acusadas de no llegar habiendo llegado; entre
# ellas una que obtuvo 19 contra una meta de 19,02.
#
# La media vuelta va ARRIBA y por eso NO se usa `round()`: R redondea al par
# (`round(16.5)` es 16, `round(17.5)` es 18, `round(0.5)` es 0), asi que la mitad
# de los empates caeria hacia abajo sin avisar. Va `floor(meta + 0.5)`.

test_that("la meta se compara redondeada, no cruda: el decimal no es un techo", {
  # 17,4 -> 17. Un aula que entrego 17 entrego lo que se esperaba de ella.
  expect_true(monitoreo_aulas_control_meta(
    list(expected_valid = 17.4, efectivas_obtenidas = 17)))
  # 17,6 -> 18. Con 17 no llega, y eso si es un veredicto.
  expect_false(monitoreo_aulas_control_meta(
    list(expected_valid = 17.6, efectivas_obtenidas = 17)))
})

test_that("el empate exacto sube: `floor(meta + 0,5)`, nunca `round()`", {
  # El caso que separa las dos implementaciones. `round(16.5)` en R es 16, asi
  # que con `round()` un aula de 16 pasaria; con la media vuelta arriba, no.
  expect_false(monitoreo_aulas_control_meta(
    list(expected_valid = 16.5, efectivas_obtenidas = 16)))
  expect_true(monitoreo_aulas_control_meta(
    list(expected_valid = 16.5, efectivas_obtenidas = 17)))
  # La contraparte impar, donde `round()` y la media vuelta arriba coinciden:
  # sirve para que el test no pase por accidente si alguien vuelve a `round()`.
  expect_false(monitoreo_aulas_control_meta(
    list(expected_valid = 17.5, efectivas_obtenidas = 17)))
})

test_that("una meta que se muestra entera no suspende por dos centesimas", {
  # Caso real de 2025: la superficie mostraba «19,0» y el aula entrego 19.
  expect_true(monitoreo_aulas_control_meta(
    list(expected_valid = 19.02, efectivas_obtenidas = 19)))
})

test_that("el redondeo no toca las ramas ya declaradas de la meta", {
  # Sin meta utilizable no hay veredicto: no se resuelve a FALSE.
  expect_true(is.na(monitoreo_aulas_control_meta(
    list(efectivas_obtenidas = 10))))
  expect_true(is.na(monitoreo_aulas_control_meta(
    list(expected_valid = 0, efectivas_obtenidas = 10))))
  # Sin conteo tampoco.
  expect_true(is.na(monitoreo_aulas_control_meta(
    list(expected_valid = 12.1))))
  # `efectivas_esperadas` sigue siendo el respaldo de `expected_valid`, y se
  # redondea igual: 12,1 -> 12.
  expect_true(monitoreo_aulas_control_meta(
    list(efectivas_esperadas = 12.1, efectivas_obtenidas = 12)))
  # La cascada de lo conseguido no cambia: enviadas cuando no hay efectivas.
  expect_true(monitoreo_aulas_control_meta(
    list(expected_valid = 12.1, sent_total = 12)))
})

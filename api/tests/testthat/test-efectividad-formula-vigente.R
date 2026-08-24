# La fórmula del esperado, fijada — para que la vía retirada no vuelva.
#
# Gonzalo, 2026-08-24: «esa otra fórmula que me enviaste me preocupa un poco que
# siga allí cuando ya tenemos una más fina y ajustada. Creo que deberíamos
# tenerlo todo muy validado a lo último que tenemos y realmente usamos».
#
# La vigente (V7) es:
#
#     efectivas_esperadas = eligible_n × rendimiento_ref(tramo de tamaño) × factor_facultad
#
# La retirada multiplicaba además por `p_aplicada_ref` (tipo de docente). Ese
# campo se sigue calculando A PROPÓSITO —presupuesto de visitas y cadena de
# reemplazos: un docente decide SI el aula entra, no cuánto rinde adentro— y por
# eso no basta con borrarlo: hay que fijar que NO participa del esperado.
#
# Medido el 2026-08-24 sobre el marco simulado de 2.616 cursos-horario: 2.616 de
# 2.616 cuadran sin `p_aplicada_ref`, 0 de 2.616 con él. Estos tests hacen que un
# regreso a la fórmula vieja se caiga aquí en vez de aparecer en una pantalla.

.eff_frame <- function() data.frame(
  faculty = c("DERECHO", "DERECHO", "GESTIÓN", "GESTIÓN"),
  eligible_n = c(40, 12, 40, 12),
  # Dos tipos de docente con p distinta dentro de la MISMA facultad y el MISMO
  # tramo: si la p entrara en la cuenta, estas filas divergirían.
  teacher_type = c("ORDINARIO - PRINCIPAL", "CONTRATADO", "ORDINARIO - PRINCIPAL", "CONTRATADO"),
  included = TRUE,
  stringsAsFactors = FALSE
)

test_that("el esperado es elegibles x rendimiento x factor de facultad, y NADA mas", {
  an <- prosecnurapp:::.cm_aulas_efectividad_anotar(.eff_frame())
  el <- as.numeric(an$eligible_n)
  r  <- as.numeric(an$rendimiento_ref)
  f  <- as.numeric(an$factor_facultad)
  expect_equal(as.numeric(an$efectivas_esperadas), round(el * r * f, 1))
})

test_that("`p_aplicada_ref` se calcula pero NO entra en el esperado", {
  an <- prosecnurapp:::.cm_aulas_efectividad_anotar(.eff_frame())
  p <- as.numeric(an$p_aplicada_ref)
  # Se sigue escribiendo: es dato operativo y lo consumen presupuesto y cadena.
  expect_true(all(is.finite(p)))
  # Y varía por tipo de docente, que es justo lo que la haría visible si entrara.
  expect_gt(length(unique(p)), 1)
  # La cuenta con la p dentro NO reproduce el esperado publicado.
  con_p <- round(as.numeric(an$eligible_n) * as.numeric(an$rendimiento_ref) *
                   p * as.numeric(an$factor_facultad), 1)
  expect_false(isTRUE(all.equal(as.numeric(an$efectivas_esperadas), con_p)))
})

test_that("dos aulas iguales con docente distinto esperan lo MISMO", {
  # El caso que separa las dos fórmulas en una sola comparación: mismo padrón,
  # misma facultad, mismo tramo de tamaño, distinto tipo de docente.
  an <- prosecnurapp:::.cm_aulas_efectividad_anotar(data.frame(
    faculty = c("DERECHO", "DERECHO"),
    eligible_n = c(40, 40),
    teacher_type = c("ORDINARIO - PRINCIPAL", "CONTRATADO"),
    included = TRUE, stringsAsFactors = FALSE
  ))
  expect_equal(an$efectivas_esperadas[[1]], an$efectivas_esperadas[[2]])
  # Y su p SÍ difiere: la diferencia existe, simplemente no toca la efectividad.
  expect_false(isTRUE(all.equal(an$p_aplicada_ref[[1]], an$p_aplicada_ref[[2]])))
})

test_that("`tasa_efectividad_aula` es rendimiento x factor, sin la p", {
  an <- prosecnurapp:::.cm_aulas_efectividad_anotar(.eff_frame())
  expect_equal(as.numeric(an$tasa_efectividad_aula),
               round(as.numeric(an$rendimiento_ref) * as.numeric(an$factor_facultad), 3))
})

test_that("la tasa por facultad se deriva de las mismas dos piezas", {
  # `calc_muestra_aulas_tasas_facultad` es el número que dimensiona
  # (cupos = cuota / (estadístico × tasa)) y lo que enseña la UI como
  # «composición × razón O/E». Un dueño: se deriva del frame anotado.
  an <- prosecnurapp:::.cm_aulas_efectividad_anotar(.eff_frame())
  tasas <- calc_muestra_aulas_tasas_facultad(an)
  expect_gt(length(tasas), 0)
  for (t in tasas) {
    # tasa = mix × factor_residual, la identidad que la pantalla publica.
    expect_equal(round(t$rendimiento_mix * t$factor_residual, 4), t$tasa, tolerance = 1e-4)
    idx <- toupper(trimws(an$faculty)) == t$facultad
    # Y coincide con Σesperadas / Σelegibles de esa facultad: la tasa que se
    # enseña es la misma con la que se dimensiona.
    esperado <- sum(as.numeric(an$efectivas_esperadas)[idx]) / sum(as.numeric(an$eligible_n)[idx])
    expect_equal(t$tasa, round(esperado, 4), tolerance = 1e-3)
  }
})

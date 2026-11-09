source("setup-load-all.R")

# O2 y O3 (Gonzalo, 2026-11-09, su resumen de Arte revisado a mano). O2: el área del gráfico manda y la columna de
# rótulos tiene un tope de la casa, tomado de las cajas que él dejó (lamina_rotulos_tope.R); los rótulos se parten en
# dos líneas (tres o cuatro si hace falta), nunca "…". O3: el contraste de dos grupos baja sus filas hasta el pie.

.rt_par <- function(rot) {
  n <- length(rot)
  d <- data.frame(eje = rep(rot, 2), grupo = rep(c("Estudiantes", "Docentes"), each = n), valor = c(seq(62, 94, length.out = n), seq(43, 83, length.out = n)),
                  n_casos = rep(c(279, 115), each = n))
  .espec_contraste(d, base_en = "nota")
}
.rt_comunes <- c("Reglamentos se aplican correctamente", "Docentes de FG se mantienen actualizados", "Docentes de FG son reconocidos en su medio",
                 "Servicio de salud", "La FAD fomenta responsabilidad social", "Dotación de recursos suficiente",
                 "Investigación-creación docente relevante", "Infraestructura adecuada a la FG", "Ética, ciudadanía y conciencia ambiental",
                 "La infraestructura de la Unidad es adecuada y se encuentra en buenas condiciones.", "Autoridades deciden según los propósitos",
                 "Pensamiento crítico y creativo", "Comunicación eficaz")

test_that("O2: el tope de la casa es 0.28 del ancho útil en la escala y también 0.28 en el contraste", {
  util <- .std_geom("ancho") - .std_geom("margen_izq") - .std_geom("margen_der")
  expect_equal(.lam_rotulos_tope("escala"), 0.28 * util)
  expect_equal(.lam_rotulos_tope("contraste"), 0.28 * util)
  expect_lt(abs(.lam_rotulos_tope("escala") - 3.54), 0.2)        # la caja de "Sin información" en su versión
  expect_lt(abs(.lam_rotulos_tope("contraste") - 3.56), 0.2)     # la de "Dedicación", que él dejó sin tocar
})

test_that("O2: en el contraste la columna no pasa del tope; lo que no cabe en una línea se parte, sin puntos suspensivos", {
  ge <- .lam_contraste_geom(.rt_par(.rt_comunes), titulo = "Preguntas comunes a docentes y estudiantes")
  expect_true(ge$cabe)
  expect_lte(ge$m$wrot, .lam_rotulos_tope("contraste") + 1e-9)
  lin <- vapply(.rt_comunes, .lam_rotulo_lineas, 0L, w = ge$m$wrot, size = ge$size)
  expect_identical(unname(lin[c("Servicio de salud", "Comunicación eficaz")]), c(1L, 1L))
  expect_false(any(grepl("…", ge$textos, fixed = TRUE)))
  # Un rótulo va en una línea sólo si cabe en el tope.
  una_en_tope <- vapply(.rt_comunes, function(t) .lam_rotulo_lineas(t, .lam_rotulos_tope("contraste"), ge$size) == 1L, TRUE)
  expect_true(all(lin[!una_en_tope] >= 2L))
})

test_that("O2: en la escala del resumen la columna no pasa del tope y el área de barras gana el resto", {
  rot <- c("Reglamentos se aplican correctamente (Doc.)", "Investigación-creación docente suficiente (Doc.)",
           "Evaluación de la gestión de autoridades (Adm.)", "Bibliografía de FG actualizada (Doc.)",
           "Los administrativos de la Unidad participamos de actividades de responsabilidad social universitaria de la Universidad. (Adm.)",
           "Servicio de salud (Est.)")
  d <- data.frame(item = rot, p1 = 3, p2 = 14, p3 = 40, p4 = 15, p9 = 28)
  p <- graficar_barras_divergentes(d, var_categoria = "item", cols_porcentaje = c("p1", "p2", "p3", "p4", "p9"),
                                   etiquetas_grupos = c(p1 = "Totalmente en desacuerdo", p2 = "En desacuerdo", p3 = "De acuerdo",
                                                        p4 = "Totalmente de acuerdo", p9 = "Sin información"),
                                   n_negativas = 2, estilo = "resumen")
  ge <- .lam_div_resumen_geom(attr(p, "pulso_espec"), titulo = "Preguntas con mayor proporción de Sin información")
  expect_lte(ge$wq, .lam_rotulos_tope("escala") + 1e-9)
  expect_gte(max(ge$n_lineas), 2L)
  expect_false(any(grepl("…", ge$textos, fixed = TRUE)))
})

test_that("O3: el contraste de dos grupos baja sus filas hasta el pie con el mismo hueco entre ellas", {
  rot <- c("Laboratorios y talleres suficientes", "Satisfacción con capacitaciones", "Equipo de protección adecuado", "Planificación interna de la FAD",
           "Laboratorios con equipos actualizados", "Talleres y maquinaria actualizados", "Programas de ayuda al trabajador")
  ge <- .lam_contraste_geom(.rt_par(rot), titulo = "Diferencias por pertenencia", sub = "ADMINISTRATIVOS")
  expect_true(ge$cabe)
  disponible <- ge$zona1 - ge$zona0 - ge$cab
  expect_equal(sum(ge$alturas), disponible, tolerance = 0.02)     # antes 7 x 0.5 in y una pulgada libre bajo el gráfico
  expect_lt(diff(range(ge$alturas)), 1e-6)                        # rótulos de una línea: el mismo paso
})

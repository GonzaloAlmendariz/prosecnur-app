# Conglomerados y dominios independientes en Muestra general (L20 del loop de
# mejoras, 2026-09-27). Se ofrecen para dimensionar el n, pero Selección los
# rechazaba con «no selecciona unidades con probabilidad conocida», falso: son
# probabilísticos y se sortean desde el modo de aulas. El mensaje dice eso.

test_that("L20: sortear un conglomerado en Muestra general dice dónde se sortea, no que no tiene π", {
  marco <- data.frame(codigo = sprintf("A%03d", 1:200))
  for (tec in c("prob_conglomerado_multietapico", "prob_estratificado_independiente")) {
    comp <- calc_muestra_normalize_componente(list(id = "c1", actor = "Aulas", tecnica = tec,
      marco = list(universo_bruto = 200L, marco_validado = 200L, marco_contactable = 200L, estado = "validado")))
    est <- calc_muestra_normalize_estudio(list(componentes = list(comp)))
    dec <- calc_muestra_general_declarar_marco(est, NULL, "c1", marco, "f1", columnas = list(id = "codigo"))
    err <- tryCatch(calc_muestra_general_seleccionar(dec$estudio, dec$estado, "c1", marco, semilla = 1L),
                    api_error = function(e) e)
    expect_s3_class(err, "api_error")
    msg <- conditionMessage(err)
    expect_false(grepl("probabilidad conocida", msg, fixed = TRUE), info = tec)
    expect_match(msg, "modo de aulas", fixed = TRUE)
  }
})

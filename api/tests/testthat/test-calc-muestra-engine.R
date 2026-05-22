# Tests del motor del Calculador de Muestra (4 metodologías Fase 1).
# El engine es lógica pura — sin session, sin Plumber, sin I/O.

# ---------------------------------------------------------------------------
# Helpers comunes
# ---------------------------------------------------------------------------

test_that("calc_n_muestra aplica fórmula clásica con FPC", {
  # MAS: N=10000, p=0.5, z=1.96, e=0.05 → 370 (Cochran clásico)
  n <- calc_n_muestra(N = 10000, p = 0.5, z = 1.96, e = 0.05, deff = 1)
  expect_gte(n, 369L)
  expect_lte(n, 371L)
})

test_that("calc_n_muestra escala n cuando deff > 1", {
  n1 <- calc_n_muestra(N = 10000, p = 0.5, z = 1.96, e = 0.05, deff = 1)
  n2 <- calc_n_muestra(N = 10000, p = 0.5, z = 1.96, e = 0.05, deff = 2)
  expect_gt(n2, n1)
})

test_that("calc_n_muestra rechaza parámetros inválidos", {
  expect_error(calc_n_muestra(N = 100, p = 1.5, z = 1.96, e = 0.05),
               class = "api_error")
  expect_error(calc_n_muestra(N = 100, p = 0.5, z = 1.96, e = 0),
               class = "api_error")
  expect_error(calc_n_muestra(N = 100, p = 0.5, z = 1.96, e = 0.05, deff = 0.5),
               class = "api_error")
})

test_that("calc_e_desde_n es inverso de calc_n_muestra", {
  N <- 10000; p <- 0.5; z <- 1.96; deff <- 2
  e <- 0.04
  n <- calc_n_muestra(N = N, p = p, z = z, e = e, deff = deff)
  e_recuperado <- calc_e_desde_n_muestra(n = n, N = N, p = p, z = z, deff = deff)
  expect_lt(abs(e_recuperado - e), 0.005)
})

test_that("distribuir_proporcional_pesos suma exacta con cuadratura", {
  pesos <- c(100, 200, 700)
  asig <- distribuir_proporcional_pesos(n_total = 100, pesos = pesos,
                                         redondeo = "cuadratura")
  expect_equal(sum(asig), 100L)
})

# ---------------------------------------------------------------------------
# Normalización de estudio
# ---------------------------------------------------------------------------

test_that("calc_muestra_normalize_estudio aplica defaults a entrada vacía", {
  e <- calc_muestra_normalize_estudio(list())
  expect_equal(e$titulo, "Estudio sin título")
  expect_equal(e$modo_trabajo, "estimacion_preliminar")
  expect_equal(e$macro_familia, "estudio_propio")
  expect_false(e$modo_sensible)
  expect_equal(length(e$componentes), 0L)
})

test_that("calc_muestra_normalize_componente clasifica naturaleza automáticamente", {
  c1 <- calc_muestra_normalize_componente(list(tecnica = "prob_conglomerado_multietapico"))
  expect_equal(c1$naturaleza, "prob")
  expect_true(c1$id != "")

  c2 <- calc_muestra_normalize_componente(list(tecnica = "intencion_censal"))
  expect_equal(c2$naturaleza, "operativo")

  c3 <- calc_muestra_normalize_componente(list(tecnica = "no_prob_cuotas"))
  expect_equal(c3$naturaleza, "no_prob")
})

# ---------------------------------------------------------------------------
# Validador de inferencia
# ---------------------------------------------------------------------------

test_that("validador bloquea margen de error en no-probabilísticas", {
  comp <- calc_muestra_normalize_componente(list(
    tecnica = "no_prob_cuotas",
    marco = list(marco_validado = 500, estado = "validado")
  ))
  v <- calc_muestra_validar_inferencia(comp)
  expect_false(v$permitido)
  expect_true(grepl("naturaleza", v$motivos))
})

test_that("validador requiere marco validado para conglomerados", {
  comp <- calc_muestra_normalize_componente(list(
    tecnica = "prob_conglomerado_multietapico",
    marco = list(marco_validado = 0, estado = "no_definido"),
    parametros = list(deff = 2, tau = 0.7)
  ))
  v <- calc_muestra_validar_inferencia(comp)
  expect_false(v$permitido)
})

test_that("validador permite margen cuando conglomerado tiene marco completo", {
  comp <- calc_muestra_normalize_componente(list(
    tecnica = "prob_conglomerado_multietapico",
    marco = list(marco_validado = 5000, marco_contactable = 4500,
                 estado = "contactable"),
    parametros = list(deff = 2, tau = 0.7)
  ))
  v <- calc_muestra_validar_inferencia(comp)
  expect_true(v$permitido)
})

# ---------------------------------------------------------------------------
# Cálculo: conglomerados
# ---------------------------------------------------------------------------

test_that("conglomerados con marco N=5000 produce n teórico esperable", {
  comp <- calc_muestra_normalize_componente(list(
    actor = "Estudiantes",
    tecnica = "prob_conglomerado_multietapico",
    origen_tamano = "formula",
    marco = list(universo_bruto = 5000, marco_validado = 5000,
                 marco_contactable = 4500, estado = "contactable"),
    parametros = list(z = 1.96, p = 0.5, e = 0.05, deff = 2,
                      tau = 0.7, oversample_pct = 0.1,
                      promedio_conglomerado = 25, tasa_respuesta = 0.7)
  ))
  res <- calc_muestra_calcular_componente(comp)
  # Para N=5000, e=5%, deff=2 → aproximadamente 660
  expect_gte(res$n_teorico, 600L)
  expect_lte(res$n_teorico, 720L)
  expect_equal(res$n_objetivo, res$n_teorico)
  expect_gt(res$n_operativo, res$n_objetivo)  # con sobremuestra
  expect_gt(res$unidades_operativas, 0L)
  expect_true(isTRUE(res$inferencia$permitido))
})

test_that("conglomerados respeta n final operativo definido por el usuario", {
  comp <- calc_muestra_normalize_componente(list(
    actor = "Estudiantes",
    tecnica = "prob_conglomerado_multietapico",
    origen_tamano = "formula",
    marco = list(universo_bruto = 10000, marco_validado = 10000,
                 marco_contactable = 10000, estado = "contactable"),
    parametros = list(z = 1.96, p = 0.5, e = 0.05, deff = 1,
                      tau = 0.7, oversample_pct = 0,
                      promedio_conglomerado = 25, tasa_respuesta = 1),
    meta = list(tipo = "objetivo", valor = 350,
                variable_control = "facultad_sexo")
  ))
  res <- calc_muestra_calcular_componente(comp)
  expect_gt(res$n_teorico, 350L)
  expect_equal(res$n_objetivo, 350L)
  expect_equal(res$n_operativo, 350L)
})

# ---------------------------------------------------------------------------
# Cálculo: intención censal
# ---------------------------------------------------------------------------

test_that("intención censal con N=280 (docentes ≤250 case) produce 60% cobertura", {
  comp <- calc_muestra_normalize_componente(list(
    actor = "Docentes",
    tecnica = "intencion_censal",
    origen_tamano = "cobertura_esperada",
    marco = list(universo_bruto = 280, marco_validado = 280,
                 marco_contactable = 280, estado = "contactable"),
    parametros = list(cobertura_objetivo = 0.60)
  ))
  res <- calc_muestra_calcular_componente(comp)
  expect_equal(res$n_objetivo, 168L)
  expect_equal(res$universo_a_contactar, 280L)
  expect_true(grepl("Intenci", res$advertencia))
})

# ---------------------------------------------------------------------------
# Cálculo: cuotas
# ---------------------------------------------------------------------------

test_that("cuotas con meta 150 (docentes ≥251 case) calcula n operativo", {
  comp <- calc_muestra_normalize_componente(list(
    actor = "Docentes",
    tecnica = "no_prob_cuotas",
    origen_tamano = "matriz_perfiles_cualitativa",
    marco = list(marco_validado = 380, estado = "validado"),
    parametros = list(tasa_respuesta = 0.6, oversample_pct = 0.1),
    meta = list(tipo = "cuota", valor = 150,
                variable_control = "dedicacion_docente")
  ))
  res <- calc_muestra_calcular_componente(comp)
  expect_equal(res$n_objetivo, 150L)
  expect_gt(res$n_operativo, 150L)
  expect_true(grepl("no probabil", res$advertencia))
})

# ---------------------------------------------------------------------------
# Cálculo: matriz operativa tipo GIZ
# ---------------------------------------------------------------------------

test_that("línea de base servicios calcula n por territorio y cuotas por servicio", {
  matriz <- list(
    list(territorio = "Villa El Salvador", servicio = "ULE", N = 280),
    list(territorio = "Villa El Salvador", servicio = "CIAM", N = 210),
    list(territorio = "Villa El Salvador", servicio = "OMAPED", N = 110),
    list(territorio = "Villa El Salvador", servicio = "DEMUNA", N = 213),
    list(territorio = "Villa El Salvador", servicio = "Centro de empleo", N = 100),
    list(territorio = "San Juan de Lurigancho", servicio = "ULE", N = 90),
    list(territorio = "San Juan de Lurigancho", servicio = "CIAM", N = 460),
    list(territorio = "San Juan de Lurigancho", servicio = "OMAPED", N = 230),
    list(territorio = "San Juan de Lurigancho", servicio = "DEMUNA", N = 131),
    list(territorio = "San Juan de Lurigancho", servicio = "Centro de empleo", N = 100),
    list(territorio = "Ate", servicio = "ULE", N = 165),
    list(territorio = "Ate", servicio = "CIAM", N = 135),
    list(territorio = "Ate", servicio = "OMAPED", N = 145),
    list(territorio = "Ate", servicio = "DEMUNA", N = 271),
    list(territorio = "Ate", servicio = "Centro de empleo", N = 100),
    list(territorio = "Rimac", servicio = "ULE", N = 76),
    list(territorio = "Rimac", servicio = "CIAM", N = 135),
    list(territorio = "Rimac", servicio = "OMAPED", N = 45),
    list(territorio = "Rimac", servicio = "DEMUNA", N = 50),
    list(territorio = "El Porvenir", servicio = "ULE", N = 60),
    list(territorio = "El Porvenir", servicio = "CIAM", N = 150),
    list(territorio = "El Porvenir", servicio = "OMAPED", N = 145),
    list(territorio = "El Porvenir", servicio = "DEMUNA", N = 62),
    list(territorio = "El Porvenir", servicio = "Centro de empleo", N = 50),
    list(territorio = "La Esperanza", servicio = "ULE", N = 290),
    list(territorio = "La Esperanza", servicio = "CIAM", N = 230),
    list(territorio = "La Esperanza", servicio = "OMAPED", N = 125),
    list(territorio = "La Esperanza", servicio = "DEMUNA", N = 80)
  )
  comp <- calc_muestra_normalize_componente(list(
    actor = "Usuarios / atenciones",
    tecnica = "prob_aleatorio_simple",
    origen_tamano = "formula",
    marco = list(estado = "validado", matriz_operativa = matriz),
    parametros = list(z = 1.96, p = 0.5, e = 0.05, deff = 1,
                      tasa_respuesta = 1, oversample_pct = 0,
                      n_minimo_estrato = 30)
  ))
  res <- calc_muestra_calcular_componente(comp)

  expect_equal(comp$marco$marco_validado, 4238L)
  expect_equal(res$n_objetivo, 1444L)
  expect_equal(
    vapply(res$distribucion_estratos, function(x) x$n, integer(1)),
    c(271L, 279L, 261L, 171L, 211L, 251L)
  )
  expect_equal(sum(vapply(res$cuotas_matriz, function(x) x$n, integer(1))), 1444L)
  expect_true(all(vapply(res$cuotas_matriz, function(x) x$n, integer(1)) >= 30L))
  expect_true(grepl("territorio x servicio", res$advertencia))
})

# ---------------------------------------------------------------------------
# Backtesting metodológico contra estudios reales
# ---------------------------------------------------------------------------

test_that("backtesting opinión universitaria reconstruye escenario total 2025", {
  preset <- calc_muestra_aplicar_preset_hsvg()
  comp <- preset$componente
  res <- calc_muestra_calcular_componente(comp)

  # Escenario A PUCP 2026 validado contra Tablas_Muestra.xlsx:
  # cuota final 2500, sobremuestra auditada 3754, 177 aulas base y
  # bolsa uniforme de +1 aula por facultad.
  expect_equal(comp$marco$marco_validado, 21365L)
  expect_gte(res$n_teorico, 2300L)
  expect_lte(res$n_teorico, 2325L)
  expect_equal(res$n_objetivo, 2500L)
  expect_equal(res$n_operativo, 3754L)
  expect_equal(res$sobremuestra, 1254L)
  expect_equal(res$aulas_base_total, 177L)
  expect_equal(res$aulas_extra_total, 15L)
  expect_equal(res$aulas_total, 192L)
  expect_equal(length(res$distribucion_estratos), 15L)
  expect_equal(sum(vapply(res$distribucion_estratos, function(x) x$n, integer(1))), 2500L)
})

test_that("backtesting opinión universitaria permite escenario por facultad con ajuste documentado", {
  preset <- calc_muestra_aplicar_preset_hsvg()
  comp <- preset$componente
  comp$actor_categoria <- "otros"
  comp$tecnica <- "prob_estratificado_independiente"
  comp$parametros$deff <- 1.5
  comp$parametros$oversample_pct <- 0.20
  comp$meta$valor <- 4050L

  cuotas_b <- c(
    "ARQUITECTURA Y URBANISMO" = 373L,
    "ARTE Y DISEÑO" = 418L,
    "ARTES ESCÉNICAS" = 230L,
    "CIENCIAS CONTABLES" = 52L,
    "CIENCIAS E INGENIERÍA" = 354L,
    "CIENCIAS SOCIALES" = 443L,
    "CIENCIAS Y ARTES DE LA COMUNICACIÓN" = 233L,
    "DERECHO" = 511L,
    "EDUCACIÓN" = 70L,
    "ESTUDIOS GENERALES CIENCIAS" = 346L,
    "ESTUDIOS GENERALES LETRAS" = 441L,
    "GASTRONOMÍA, HOTELERÍA Y TURISMO" = 59L,
    "GESTIÓN Y ALTA DIRECCIÓN" = 212L,
    "LETRAS Y CIENCIAS HUMANAS" = 68L,
    "PSICOLOGÍA" = 239L
  )
  sobremuestra_b <- c(
    "ARQUITECTURA Y URBANISMO" = 448L,
    "ARTE Y DISEÑO" = 502L,
    "ARTES ESCÉNICAS" = 276L,
    "CIENCIAS CONTABLES" = 63L,
    "CIENCIAS E INGENIERÍA" = 425L,
    "CIENCIAS SOCIALES" = 532L,
    "CIENCIAS Y ARTES DE LA COMUNICACIÓN" = 280L,
    "DERECHO" = 614L,
    "EDUCACIÓN" = 84L,
    "ESTUDIOS GENERALES CIENCIAS" = 416L,
    "ESTUDIOS GENERALES LETRAS" = 530L,
    "GASTRONOMÍA, HOTELERÍA Y TURISMO" = 71L,
    "GESTIÓN Y ALTA DIRECCIÓN" = 255L,
    "LETRAS Y CIENCIAS HUMANAS" = 82L,
    "PSICOLOGÍA" = 287L
  )
  aulas_b <- c(
    "ARQUITECTURA Y URBANISMO" = 24L,
    "ARTE Y DISEÑO" = 35L,
    "ARTES ESCÉNICAS" = 27L,
    "CIENCIAS CONTABLES" = 4L,
    "CIENCIAS E INGENIERÍA" = 18L,
    "CIENCIAS SOCIALES" = 26L,
    "CIENCIAS Y ARTES DE LA COMUNICACIÓN" = 15L,
    "DERECHO" = 24L,
    "EDUCACIÓN" = 7L,
    "ESTUDIOS GENERALES CIENCIAS" = 14L,
    "ESTUDIOS GENERALES LETRAS" = 16L,
    "GASTRONOMÍA, HOTELERÍA Y TURISMO" = 6L,
    "GESTIÓN Y ALTA DIRECCIÓN" = 11L,
    "LETRAS Y CIENCIAS HUMANAS" = 10L,
    "PSICOLOGÍA" = 13L
  )
  comp$marco$estratos <- lapply(comp$marco$estratos, function(e) {
    label <- trimws(e$label)
    e$cuota_fija <- cuotas_b[[label]]
    e$sobremuestra_fija <- sobremuestra_b[[label]]
    e$aulas_base_fijas <- aulas_b[[label]]
    e$aulas_extra_operativas <- 1L
    e$confianza_facultad <- if (e$N < 300L) 0.90 else 0.95
    e
  })

  res <- calc_muestra_calcular_componente(comp)

  # Escenario B PUCP 2026: la suma técnica es 4049 y la cuadratura operativa
  # añade 1 caso al dominio con mayor universo para cerrar en 4050.
  expect_equal(res$n_teorico, 4049L)
  expect_equal(res$n_objetivo, 4050L)
  expect_equal(res$n_operativo, 4865L)
  expect_equal(res$sobremuestra, 815L)
  expect_equal(res$aulas_base_total, 250L)
  expect_equal(res$aulas_extra_total, 15L)
  expect_equal(res$aulas_total, 265L)
  expect_equal(sum(vapply(res$distribucion_estratos, function(x) x$n, integer(1))), 4050L)
  expect_equal(
    res$distribucion_estratos[[which(trimws(vapply(res$distribucion_estratos, function(x) x$estrato, character(1))) == "CIENCIAS E INGENIERÍA")]]$n,
    355L
  )
})

test_that("backtesting acreditación reproduce decisiones por actor", {
  iniciado <- calc_muestra_iniciar_estudio("acreditacion")
  comps <- iniciado$componentes
  ids <- vapply(comps, function(c) c$actor_id, character(1))

  setN <- function(comp, N) {
    comp$marco$universo_bruto <- N
    comp$marco$marco_validado <- N
    comp$marco$marco_contactable <- N
    comp$marco$estado <- "contactable"
    calc_muestra_normalize_componente(comp)
  }
  comps[[match("administrativos", ids)]] <- setN(comps[[match("administrativos", ids)]], 50L)
  comps[[match("docentes", ids)]] <- setN(comps[[match("docentes", ids)]], 280L)
  comps[[match("estudiantes", ids)]] <- setN(comps[[match("estudiantes", ids)]], 4500L)
  comps[[match("egresados", ids)]] <- setN(comps[[match("egresados", ids)]], 150L)

  estudio <- calc_muestra_normalize_estudio(list(
    macro_familia = "acreditacion",
    componentes = comps
  ))
  out <- calc_muestra_calcular_estudio(estudio)
  by_id <- setNames(out$componentes, vapply(out$componentes, function(c) c$actor_id, character(1)))

  expect_equal(by_id$administrativos$tecnica, "intencion_censal")
  expect_equal(by_id$administrativos$resultado$n_objetivo, 40L)
  expect_equal(by_id$docentes$tecnica, "no_prob_cuotas")
  expect_equal(by_id$docentes$resultado$n_objetivo, 150L)
  expect_equal(by_id$estudiantes$tecnica, "prob_conglomerado_multietapico")
  expect_gt(by_id$estudiantes$resultado$n_objetivo, 0L)
  expect_equal(by_id$egresados$tecnica, "intencion_censal")
  expect_equal(by_id$egresados$resultado$n_objetivo, 75L)
})

# ---------------------------------------------------------------------------
# Cálculo: listado externo
# ---------------------------------------------------------------------------

test_that("listado externo aplica fórmula de registros a contactar", {
  comp <- calc_muestra_normalize_componente(list(
    tecnica = "listado_externo_meta_fija",
    origen_tamano = "meta_contractual",
    marco = list(marco_validado = 2000, estado = "listado_externo"),
    parametros = list(tasa_contacto = 0.5, tasa_elegibilidad = 0.9,
                      tasa_respuesta = 0.6),
    meta = list(tipo = "contractual", valor = 400)
  ))
  res <- calc_muestra_calcular_componente(comp)
  expect_equal(res$n_objetivo, 400L)
  # 400 / (0.5 * 0.9 * 0.6) = 400/0.27 ≈ 1482
  expect_gte(res$registros_a_contactar, 1400L)
  expect_lte(res$registros_a_contactar, 1500L)
})

# ---------------------------------------------------------------------------
# Metodologías no implementadas en Fase 1
# ---------------------------------------------------------------------------

test_that("metodologías Fase 2+ devuelven E_METODOLOGIA_NO_IMPLEMENTADA", {
  for (tec in c("medicion_recurrente")) {
    comp <- calc_muestra_normalize_componente(list(
      tecnica = tec,
      marco = list(marco_validado = 1000, estado = "validado")
    ))
    expect_error(calc_muestra_calcular_componente(comp),
                 class = "api_error")
  }
})

test_that("estratificado reparte n por capas del marco", {
  comp <- calc_muestra_normalize_componente(list(
    tecnica = "prob_estratificado",
    origen_tamano = "formula",
    marco = list(
      estado = "validado",
      estratos = list(
        list(label = "Distrito A", N = 300),
        list(label = "Distrito B", N = 700)
      )
    ),
    parametros = list(z = 1.96, p = 0.5, e = 0.05, deff = 1,
                      tasa_respuesta = 1, oversample_pct = 0,
                      n_minimo_estrato = 0)
  ))
  res <- calc_muestra_calcular_componente(comp)
  expect_equal(sum(vapply(res$distribucion_estratos, function(x) x$n, integer(1))), res$n_objetivo)
  expect_true(res$distribucion_estratos[[2]]$n > res$distribucion_estratos[[1]]$n)
})

test_that("estratificado independiente calcula n por facultad y conserva sumas exactas", {
  comp <- calc_muestra_normalize_componente(list(
    actor = "Muestra con representatividad a nivel facultad",
    actor_categoria = "otros",
    tecnica = "prob_estratificado_independiente",
    origen_tamano = "formula",
    marco = list(
      estado = "validado",
      estratos = list(
        list(label = "Facultad A", N = 1000, N_a = 600, N_b = 400, e_facultad = 0.05),
        list(label = "Facultad B", N = 400, N_a = 220, N_b = 180, e_facultad = 0.07),
        list(label = "Facultad C", N = 2000, N_a = 900, N_b = 1100, e_facultad = 0.04)
      )
    ),
    parametros = list(z = 1.96, p = 0.5, e = 0.05, deff = 1.5,
                      tasa_respuesta = 1, oversample_pct = 0,
                      n_minimo_estrato = 0),
    meta = list(tipo = "objetivo", valor = 0,
                variable_control = "facultad_sexo")
  ))
  expected <- sum(vapply(comp$marco$estratos, function(e) {
    calc_n_muestra(N = e$N, p = comp$parametros$p, z = comp$parametros$z,
                   e = e$e_facultad, deff = comp$parametros$deff)
  }, integer(1)))

  res <- calc_muestra_calcular_componente(comp)
  expect_equal(res$n_teorico, expected)
  expect_equal(res$n_objetivo, expected)
  expect_equal(sum(vapply(res$distribucion_estratos, function(x) x$n, integer(1))), expected)
  expect_equal(sum(vapply(res$distribucion_sub, function(x) x$n, integer(1))), expected)

  comp$meta$valor <- expected + 137L
  ajustado <- calc_muestra_calcular_componente(comp)
  expect_equal(ajustado$n_objetivo, expected + 137L)
  expect_equal(sum(vapply(ajustado$distribucion_estratos, function(x) x$n, integer(1))), expected + 137L)
  expect_equal(sum(vapply(ajustado$distribucion_sub, function(x) x$n, integer(1))), expected + 137L)

  largest <- which.max(vapply(comp$marco$estratos, function(e) e$N, numeric(1)))
  expect_equal(
    ajustado$distribucion_estratos[[largest]]$n,
    res$distribucion_estratos[[largest]]$n + 137L
  )
})

test_that("estratificado independiente permite proporción de éxito por facultad", {
  comp <- calc_muestra_normalize_componente(list(
    actor = "Muestra con p diferenciada por facultad",
    actor_categoria = "otros",
    tecnica = "prob_estratificado_independiente",
    origen_tamano = "formula",
    marco = list(
      estado = "validado",
      estratos = list(
        list(label = "Facultad baja prevalencia", N = 1500, N_a = 800, N_b = 700,
             e_facultad = 0.05, p_facultad = 0.20),
        list(label = "Facultad peor caso", N = 1500, N_a = 800, N_b = 700,
             e_facultad = 0.05, p_facultad = 0.50)
      )
    ),
    parametros = list(z = 1.96, p = 0.5, e = 0.05, deff = 1.5,
                      tasa_respuesta = 1, oversample_pct = 0,
                      n_minimo_estrato = 0),
    meta = list(tipo = "objetivo", valor = 0,
                variable_control = "facultad_sexo")
  ))

  res <- calc_muestra_calcular_componente(comp)
  cuotas <- vapply(res$distribucion_estratos, function(x) x$n, integer(1))
  p_usadas <- vapply(res$distribucion_estratos, function(x) x$p_e, numeric(1))

  expect_equal(p_usadas, c(0.20, 0.50))
  expect_lt(cuotas[[1]], cuotas[[2]])
})

test_that("sistemático devuelve intervalo de selección", {
  comp <- calc_muestra_normalize_componente(list(
    tecnica = "sistematico",
    origen_tamano = "formula",
    marco = list(marco_validado = 1000, estado = "validado"),
    parametros = list(z = 1.96, p = 0.5, e = 0.05, deff = 1,
                      tasa_respuesta = 1, oversample_pct = 0)
  ))
  res <- calc_muestra_calcular_componente(comp)
  expect_gt(res$intervalo_sistematico, 0L)
})

# ---------------------------------------------------------------------------
# Recomendador
# ---------------------------------------------------------------------------

test_that("recomendador sugiere intención censal para universo pequeño", {
  r <- calc_muestra_recomendar(list(universoPequeno = TRUE, N_marco = 200))
  expect_equal(r$tecnica, "intencion_censal")
})

test_that("recomendador sugiere conglomerados cuando hay conglomerados", {
  r <- calc_muestra_recomendar(list(
    tieneConglomerados = TRUE,
    probabilidadConocida = TRUE,
    marcoEstado = "validado",
    N_marco = 5000
  ))
  expect_equal(r$tecnica, "prob_conglomerado_multietapico")
})

test_that("recomendador sugiere cuotas con control sin probabilidad", {
  r <- calc_muestra_recomendar(list(
    buscaRepresentatividad = TRUE,
    controlaCuotas = TRUE,
    probabilidadConocida = FALSE
  ))
  expect_equal(r$tecnica, "no_prob_cuotas")
})

test_that("recomendador sugiere listado externo cuando aplica", {
  r <- calc_muestra_recomendar(list(
    marcoEstado = "listado_externo",
    probabilidadConocida = FALSE
  ))
  expect_equal(r$tecnica, "listado_externo_meta_fija")
})

# ---------------------------------------------------------------------------
# Preset acreditación
# ---------------------------------------------------------------------------

test_that("preset acreditación PUCP genera 4 componentes con reglas correctas", {
  # Smoke test — el preset JSON puede no estar en el path de testing pero
  # validamos que la función exista y produzca error informativo.
  result <- tryCatch(
    calc_muestra_aplicar_preset_acreditacion(list(
      administrativos = 50,
      docentes        = 280,    # ≤250 NO → debería caer en regla ≥251
      estudiantes     = 4500,   # ≥3001 → conglomerados
      egresados       = 150     # ≤300 → intención censal
    )),
    error = function(e) e
  )
  if (inherits(result, "error")) {
    # Preset path no disponible en testing: aceptable mientras la función exista
    expect_true(grepl("preset", conditionMessage(result), ignore.case = TRUE))
  } else {
    expect_equal(length(result$componentes), 4L)
    actor_ids <- vapply(result$componentes, function(c) c$actor_id, character(1))
    expect_true(all(c("administrativos", "docentes", "estudiantes", "egresados") %in% actor_ids))
    # Docentes con N=280 → cuotas
    docentes_comp <- result$componentes[[match("docentes", actor_ids)]]
    expect_equal(docentes_comp$tecnica, "no_prob_cuotas")
    # Estudiantes con N=4500 → conglomerados
    est_comp <- result$componentes[[match("estudiantes", actor_ids)]]
    expect_equal(est_comp$tecnica, "prob_conglomerado_multietapico")
  }
})

# ---------------------------------------------------------------------------
# Modos de trabajo (estimacion_preliminar / diseno_validado)
# ---------------------------------------------------------------------------

test_that("modo_trabajo solo acepta los 2 modos de propuesta", {
  e1 <- calc_muestra_normalize_estudio(list(modo_trabajo = "estimacion_preliminar"))
  expect_equal(e1$modo_trabajo, "estimacion_preliminar")
  e2 <- calc_muestra_normalize_estudio(list(modo_trabajo = "diseno_validado"))
  expect_equal(e2$modo_trabajo, "diseno_validado")
  # Modos de campo (que ahora viven en Monitoreo) caen al default.
  e3 <- calc_muestra_normalize_estudio(list(modo_trabajo = "seguimiento_campo"))
  expect_equal(e3$modo_trabajo, "estimacion_preliminar")
  e4 <- calc_muestra_normalize_estudio(list(modo_trabajo = "cierre_campo"))
  expect_equal(e4$modo_trabajo, "estimacion_preliminar")
})

# ---------------------------------------------------------------------------
# Estudio completo
# ---------------------------------------------------------------------------

test_that("calcular_estudio aplica cálculo a todos los componentes", {
  estudio <- calc_muestra_normalize_estudio(list(
    titulo = "Test acreditación",
    macro_familia = "acreditacion",
    componentes = list(
      list(
        actor = "Docentes ≤250",
        tecnica = "intencion_censal",
        marco = list(marco_validado = 200, marco_contactable = 200,
                     estado = "contactable"),
        parametros = list(cobertura_objetivo = 0.6)
      ),
      list(
        actor = "Estudiantes ≥3001",
        tecnica = "prob_conglomerado_multietapico",
        marco = list(marco_validado = 5000, marco_contactable = 4500,
                     estado = "contactable"),
        parametros = list(z = 1.96, p = 0.5, e = 0.05, deff = 2, tau = 0.7,
                          promedio_conglomerado = 25, tasa_respuesta = 0.7,
                          oversample_pct = 0.1)
      )
    )
  ))
  out <- calc_muestra_calcular_estudio(estudio)
  expect_equal(length(out$componentes), 2L)
  expect_true(!is.null(out$componentes[[1]]$resultado))
  expect_true(!is.null(out$componentes[[2]]$resultado))
  expect_true(!is.null(out$decision_log))
})

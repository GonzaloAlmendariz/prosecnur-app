# Marco elegible de Hojas de ruta (ADR 0115): normalización, filtro y resumen.

me_frame <- function() {
  data.frame(
    ubigeo = c("150101", "150101", "150101", "150101", "150102", "150102"),
    distrito = c("LIMA", "LIMA", "LIMA", "LIMA", "ANCON", "ANCON"),
    zona = c("00100", "00100", "00200", "00200", "00100", "00100"),
    id_manzana = c("m1", "m2", "m3", "m4", "m5", "m6"),
    viviendas = c(40, 0, 0, 12, 30, 5),
    poblacion = c(150, 0, 0, 45, 100, 0),
    match_level = c("cartografia_key", "sin_conteo_redatam", "cartografia_key", "cartografia_key", "cartografia_key", "cartografia_key"),
    stringsAsFactors = FALSE
  )
}

# Puntos interiores inyectados: m1 dentro del área, m4 sobre su borde, m6 sin geometría.
me_puntos <- data.frame(
  id_manzana = c("m1", "m2", "m3", "m4", "m5"),
  lon = c(-77.005, -77.020, -77.030, -77.000, -77.100),
  lat = c(-12.055, -12.055, -12.070, -12.055, -11.800),
  nse_nivel = c("3 Medio", "4 Medio bajo", "4 Medio bajo", "2 Medio alto", "5 Bajo"),
  stringsAsFactors = FALSE
)

# Reemplazo plano: modifyList mezclaría las listas de vértices en vez de reemplazarlas.
me_area <- function(...) {
  a <- list(
    id = "a1", motivo = "no_residencial", detalle = "Zona industrial",
    poligono = list(c(-77.010, -12.050), c(-77.000, -12.050), c(-77.000, -12.060), c(-77.010, -12.060))
  )
  cambios <- list(...)
  a[names(cambios)] <- cambios
  a
}

test_that("sin la clave la corrida es legacy y su marco no cambia", {
  me <- hojas_ruta_marco_elegible_normalizar(NULL)
  expect_false(me$declarado)
  expect_identical(me$minimo_viviendas, 0L)
  expect_length(me$areas_excluidas, 0)
  r <- hojas_ruta_marco_elegible_aplicar(me_frame(), me)
  expect_identical(r$frame, me_frame())
})

test_that("mínimo 0 y lista de áreas vacía dejan el marco idéntico", {
  me <- hojas_ruta_marco_elegible_normalizar(list(minimo_viviendas = 0, areas_excluidas = list()))
  expect_true(me$declarado)
  expect_identical(hojas_ruta_marco_elegible_aplicar(me_frame(), me)$frame, me_frame())
})

test_that("un mínimo inválido cae al de corridas nuevas con aviso", {
  me <- hojas_ruta_marco_elegible_normalizar(list(minimo_viviendas = -3))
  expect_identical(me$minimo_viviendas, 1L)
  expect_identical(attr(me, "alertas")[[1]]$code, "W_ELIGIBILITY_MINIMUM_INVALID")
})

test_that("las áreas se validan: motivo cerrado, detalle con «otro», evidencia con inseguridad", {
  me <- hojas_ruta_marco_elegible_normalizar(list(areas_excluidas = list(
    me_area(id = "x", motivo = "basural"),
    me_area(id = "o", motivo = "otro", detalle = ""),
    me_area(id = "s", motivo = "inseguridad"),
    me_area(id = "ok", motivo = "inseguridad", fuente = "Supervisión 2025", fecha_evidencia = "2025-11-14")
  )))
  expect_identical(vapply(me$areas_excluidas, `[[`, character(1), "id"), "ok")
  codigos <- vapply(attr(me, "alertas"), `[[`, character(1), "code")
  expect_identical(codigos, rep("W_EXCLUDED_AREA_DISCARDED", 3))
})

test_that("el polígono se canoniza: cerrado, a 1e-6, y con lon/lat corregido si venía invertido", {
  me <- hojas_ruta_marco_elegible_normalizar(list(areas_excluidas = list(
    me_area(poligono = list(c(-12.05, -77.0100000004), c(-12.05, -77.0), c(-12.06, -77.0)))
  )))
  pol <- me$areas_excluidas[[1]]$poligono
  expect_length(pol, 4)
  expect_identical(pol[[1]], pol[[4]])
  expect_identical(pol[[1]], c(-77.01, -12.05))
  expect_identical(attr(me, "alertas")[[1]]$code, "W_EXCLUDED_AREA_SWAPPED")
})

test_that("un polígono con menos de tres vértices se descarta y uno fuera de Lima avisa", {
  me <- hojas_ruta_marco_elegible_normalizar(list(areas_excluidas = list(
    me_area(id = "corto", poligono = list(c(-77.01, -12.05), c(-77.00, -12.05))),
    me_area(id = "lejos", poligono = list(c(-70, -15), c(-69.9, -15), c(-69.9, -15.1)))
  )))
  expect_identical(vapply(me$areas_excluidas, `[[`, character(1), "id"), "lejos")
  expect_setequal(vapply(attr(me, "alertas"), `[[`, character(1), "code"), c("W_EXCLUDED_AREA_DISCARDED", "W_EXCLUDED_AREA_OUTSIDE"))
})

test_that("precedencia área > mínimo, borde excluye y sin geometría se queda", {
  me <- hojas_ruta_marco_elegible_normalizar(list(minimo_viviendas = 1, areas_excluidas = list(me_area())))
  r <- hojas_ruta_marco_elegible_aplicar(me_frame(), me, puntos = me_puntos)
  expect_identical(r$criterio, c("area", "minimo", "minimo", "area", "elegible", "elegible"))
  expect_identical(r$frame$id_manzana, c("m5", "m6"))
  lima <- r$por_distrito[[1]]
  expect_identical(lima$excluida_area$manzanas, 2L)
  expect_identical(lima$excluida_minimo$manzanas, 2L)
  # m2 es cero por falta de conteo; m3 es cero censal.
  expect_identical(lima$excluida_minimo_sin_conteo, 1L)
  ancon <- r$por_distrito[[2]]
  expect_identical(ancon$sin_geometria, 1L)
})

test_that("conservación: elegibles más excluidas es el marco, por distrito y por zona, sin tolerancia", {
  me <- hojas_ruta_marco_elegible_normalizar(list(minimo_viviendas = 1, areas_excluidas = list(me_area())))
  r <- hojas_ruta_marco_elegible_aplicar(me_frame(), me, puntos = me_puntos)
  for (fila in c(r$por_distrito, r$por_zona)) {
    for (k in c("manzanas", "viviendas", "poblacion")) {
      expect_identical(fila$elegible[[k]] + fila$excluida_area[[k]] + fila$excluida_minimo[[k]], fila$total[[k]])
    }
  }
  expect_length(r$por_zona, 3)
})

test_that("la cobertura es NA cuando el distrito no tiene población, no una división por cero", {
  f <- me_frame()
  f$poblacion[f$ubigeo == "150102"] <- 0
  r <- hojas_ruta_marco_elegible_aplicar(f, hojas_ruta_marco_elegible_normalizar(list(minimo_viviendas = 1)))
  expect_true(is.na(r$por_distrito[[2]]$cobertura_poblacion))
  expect_equal(r$por_distrito[[1]]$cobertura_poblacion, 1)
})

test_that("el punto interior cae dentro aunque la manzana sea cóncava", {
  # Una «U»: el centroide de área cae en el hueco.
  u <- rbind(c(0, 0), c(3, 0), c(3, 3), c(2, 3), c(2, 1), c(1, 1), c(1, 3), c(0, 3), c(0, 0))
  p <- hojas_ruta_marco_elegible_punto_interior(u)
  expect_true(.hojas_ruta_me_punto_en_anillo(p[1], p[2], u))
  expect_false(.hojas_ruta_me_en_borde(p[1], p[2], u))
  cuadrado <- rbind(c(0, 0), c(2, 0), c(2, 2), c(0, 2))
  expect_equal(hojas_ruta_marco_elegible_punto_interior(cuadrado), c(1, 1))
})

# ---------- Enganches en el motor (ADR 0115 §2) ----------

test_that("el normalizador del motor conserva marco_elegible y es idempotente", {
  cfg <- hojas_ruta_integrada_normalize_config(list(territorios = list("150102"), marco_elegible = list(minimo_viviendas = 3)))
  expect_true(cfg$marco_elegible$declarado)
  expect_identical(cfg$marco_elegible$minimo_viviendas, 3L)
  otra <- hojas_ruta_integrada_normalize_config(cfg)
  expect_identical(otra$marco_elegible[c("declarado", "minimo_viviendas", "areas_excluidas")], cfg$marco_elegible[c("declarado", "minimo_viviendas", "areas_excluidas")])
  legacy <- hojas_ruta_integrada_normalize_config(hojas_ruta_integrada_normalize_config(list(territorios = list("150102"))))
  expect_false(legacy$marco_elegible$declarado)
  expect_identical(legacy$marco_elegible$minimo_viviendas, 0L)
})

test_that("una corrida legacy sortea sobre el mismo marco de siempre; el mínimo 1 saca sólo las manzanas sin viviendas", {
  completo <- hojas_ruta_inei_frame("current")
  completo <- completo[completo$ubigeo %in% "150102", , drop = FALSE]
  legacy <- .hojas_ruta_filter_frame(list(territorios = list("150102")))
  expect_identical(legacy, completo)
  con_minimo <- .hojas_ruta_filter_frame(list(territorios = list("150102"), marco_elegible = list(minimo_viviendas = 1)))
  expect_identical(nrow(con_minimo), sum(as.numeric(completo$viviendas) >= 1))
  expect_true(all(as.numeric(con_minimo$viviendas) >= 1))
})

# ---------- Reparto, vista previa y posproceso (ADR 0115 §3, §5) ----------

me_cfg_ancon <- function(...) {
  base <- list(territorios = list("150102"), n_objetivo = 80, sample_size_mode = "external_total", n_mode = "total",
               entrevistas_por_manzana = 8, max_per_manzana = 8, seed = 2017, replacements_per_titular = 1,
               marco_elegible = list(minimo_viviendas = 1))
  cambios <- list(...)
  base[names(cambios)] <- cambios
  base
}
me_sin_puntos <- data.frame(id_manzana = character(0), lon = numeric(0), lat = numeric(0), nse_nivel = character(0))

test_that("paridad: la vista previa reparte por zona exactamente las titulares que sortea el motor", {
  cfg <- me_cfg_ancon()
  s <- hojas_ruta_sample_preview_integrado(cfg)
  b <- .hojas_ruta_rows_df(s$blocks)
  sorteadas <- table(as.character(b$zona))
  p <- hojas_ruta_marco_elegible_preview(cfg, puntos = me_sin_puntos)
  previstas <- unlist(lapply(p$capacidad, function(z) stats::setNames(min(z$rutas, z$manzanas), z$zona)))
  expect_identical(as.integer(sorteadas[names(previstas)]), as.integer(previstas))
  expect_identical(sum(previstas), as.integer(s$n_blocks))
  # Con el mínimo activo ninguna titular cae en una manzana sin viviendas.
  expect_true(all(as.numeric(b$viviendas) >= 1))
})

test_that("un distrito sin manzanas elegibles no pierde sus entrevistas en silencio", {
  s <- hojas_ruta_sample_preview_integrado(me_cfg_ancon())
  vacio <- me_cfg_ancon(marco_elegible = list(minimo_viviendas = 1e6))
  p <- hojas_ruta_marco_elegible_preview(vacio, puntos = me_sin_puntos)
  expect_true("W_ZONE_SHORT_BEFORE_DRAW" %in% vapply(p$alerts, `[[`, character(1), "code"))
  comp <- hojas_ruta_marco_elegible_completar(s, vacio)
  e <- Filter(function(a) identical(a$code, "E_UNASSIGNED_INTERVIEWS"), comp$alerts)
  expect_length(e, 1)
  expect_match(e[[1]]$message, "^80 entrevista")
  expect_identical(e[[1]]$sin_manzanas_elegibles[[1]]$causa, "distrito_sin_manzanas")
})

test_that("el posproceso deja lo necesario para reconstruir π por zona y verificar el marco", {
  cfg <- me_cfg_ancon()
  comp <- hojas_ruta_marco_elegible_completar(hojas_ruta_sample_preview_integrado(cfg), cfg)
  me <- comp$marco_elegible
  expect_identical(me$criterios$minimo_viviendas, 1L)
  con_sorteo <- Filter(function(z) z$sorteadas > 0L, me$zonas)
  expect_identical(sum(vapply(con_sorteo, `[[`, integer(1), "sorteadas")), as.integer(comp$n_blocks))
  pis <- unlist(lapply(con_sorteo, function(z) vapply(z$seleccionadas, `[[`, numeric(1), "pi")))
  expect_true(all(pis > 0 & pis <= 1))
  expect_match(me$hash_marco, "^[0-9a-f]{64}$")
  # La misma config da los mismos hashes: el marco elegible es reproducible.
  otra <- hojas_ruta_marco_elegible_completar(hojas_ruta_sample_preview_integrado(cfg), cfg)$marco_elegible
  expect_identical(otra$hash_criterios, me$hash_criterios)
  expect_identical(otra$hash_elegibles_por_distrito, me$hash_elegibles_por_distrito)
})

# ---------- HTTP (ADR 0115 §3) ----------

test_that("POST /api/hojas-ruta/marco-elegible/preview está montado, pide distritos y no guarda nada", {
  expect_true(grepl("mount_hojas_ruta_marco_elegible(pr)", paste(deparse(body(build_plumber_app)), collapse = " "), fixed = TRUE))
  pr <- mount_hojas_ruta_marco_elegible(plumber::pr())
  ep <- Find(function(e) identical(e$verbs, "POST"), unlist(pr$endpoints, recursive = FALSE))
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  llamar <- function(body) ep$getFunc()(
    req = list(HTTP_X_PULSO_SESSION = sid, bodyRaw = charToRaw(enc2utf8(jsonlite::toJSON(body, auto_unbox = TRUE, null = "null")))),
    res = plumber:::PlumberResponse$new()
  )
  sin <- llamar(list(config = list(territorios = list())))
  expect_identical(sin$error$code %||% sin$code %||% "", "E_NO_TERRITORY")
  ok <- llamar(list(config = me_cfg_ancon(marco_elegible = list(minimo_viviendas = 1e6))))
  expect_true(isTRUE(ok$ok))
  expect_identical(ok$marco_elegible$minimo_viviendas, 1000000L)
  expect_true("W_ZONE_SHORT_BEFORE_DRAW" %in% vapply(ok$alerts, `[[`, character(1), "code"))
  expect_null(session_get(sid)$hojas_ruta_workspace_outputs$sample)
})

# ---------- Revisión de la implementación (D1, D2) ----------

test_that("π sigue la regla del sorteo: censo de zona, igual probabilidad en sistemático, medida ≤ 0 pesa 1", {
  df_z <- data.frame(id_manzana = c("a", "b", "c", "d"), viviendas = c(30, 10, 0, NA), stringsAsFactors = FALSE)
  censo <- .hojas_ruta_me_pi(df_z, c("a", "b", "c", "d"), "viviendas", "pps")
  expect_identical(censo$regla_pi, "censo_de_la_zona")
  expect_true(all(vapply(censo$seleccionadas, `[[`, numeric(1), "pi") == 1))
  sis <- .hojas_ruta_me_pi(df_z, c("a", "c"), "viviendas", "sistematico")
  expect_identical(vapply(sis$seleccionadas, `[[`, numeric(1), "pi"), c(0.5, 0.5))
  pps <- .hojas_ruta_me_pi(df_z, c("b", "c"), "viviendas", "pps")
  expect_true(pps$medida_ajustada)
  expect_identical(pps$medida_total, 42)
  # La manzana sin viviendas se sorteó con peso 1: su π no es 0.
  expect_equal(vapply(pps$seleccionadas, `[[`, numeric(1), "pi"), c(2 * 10 / 42, 2 * 1 / 42))
})

test_that("los reemplazos puntuales salen del marco con el que se sorteó, y avisan si cambió", {
  muestra <- list(marco_elegible = list(criterios = list(declarado = TRUE, minimo_viviendas = 1L, areas_excluidas = list())))
  cfg <- hojas_ruta_integrada_normalize_config(me_cfg_ancon(marco_elegible = list(minimo_viviendas = 5)))
  r <- hojas_ruta_marco_elegible_de_la_muestra(cfg, muestra)
  expect_identical(r$config$marco_elegible$minimo_viviendas, 1L)
  expect_identical(r$alertas[[1]]$code, "W_ELIGIBILITY_DIFFERS_FROM_SAMPLE")
  igual <- hojas_ruta_marco_elegible_de_la_muestra(hojas_ruta_integrada_normalize_config(me_cfg_ancon()), muestra)
  expect_length(igual$alertas, 0)
  sin <- hojas_ruta_marco_elegible_de_la_muestra(cfg, list())
  expect_identical(sin$config$marco_elegible$minimo_viviendas, 5L)
})

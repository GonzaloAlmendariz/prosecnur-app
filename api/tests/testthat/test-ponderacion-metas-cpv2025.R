# Metas de calibración desde el CPV 2025 (ADR 0131 paso 5): agregación al
# ámbito pedido, grupos de edad del analista, nivel educativo agrupado y la
# declaración de fuente y universo (población censada, sin omisión).

d <- .pond_cpv_datos()
uno <- d$distritos$ubigeo[[1]]
prov <- d$distritos$provincia_codigo[[1]]
suma_edad <- function(ubigeos, min = 18L, max = 124L) {
  e <- d$edad
  sum(e$poblacion[e$ubigeo %in% ubigeos & e$edad >= min & e$edad <= max])
}
margen <- function(res, var) Filter(function(m) identical(m$variable, var), res$margenes)[[1]]
pob <- function(m) vapply(m$categorias, `[[`, numeric(1), "poblacion")

test_that("por defecto: todo el conjunto, 18 a más, sexo, edad y educación cuadran", {
  res <- ponderacion_cpv2025_metas(list())
  expect_true(res$ok)
  expect_identical(res$ambito$nivel, "conjunto")
  expect_equal(res$ambito$n_distritos, nrow(d$distritos))
  expect_equal(res$total, suma_edad(d$distritos$ubigeo))
  expect_setequal(vapply(res$margenes, `[[`, character(1), "variable"), c("sexo", "edad", "educacion"))
  for (v in c("sexo", "edad", "educacion")) expect_equal(sum(pob(margen(res, v))), res$total)
  expect_match(res$universo, "censada")
  expect_match(res$universo, "omisión")
  expect_match(res$fuente, "CPV 2025")
})

test_that("un distrito: el total es el de ese distrito y el sexo es el del archivo", {
  res <- ponderacion_cpv2025_metas(list(distritos = list(uno)))
  expect_identical(res$ambito$nivel, "distritos")
  expect_equal(res$total, suma_edad(uno))
  sx <- margen(res, "sexo")
  e <- d$edad[d$edad$ubigeo == uno & d$edad$edad >= 18, ]
  expect_equal(pob(sx)[[1]], sum(e$poblacion[e$sexo == "Hombre"]))
})

test_that("provincia: suma sus distritos y desagrega por distrito", {
  res <- ponderacion_cpv2025_metas(list(provincias = list(prov), desagregacion = "distrito"))
  ub <- d$distritos$ubigeo[d$distritos$provincia_codigo == prov]
  expect_equal(res$total, suma_edad(ub))
  dist <- margen(res, "distrito")
  expect_length(dist$categorias, length(ub))
  expect_equal(sum(pob(dist)), res$total)
})

test_that("grupos de edad del analista: cada grupo suma sus edades simples", {
  res <- ponderacion_cpv2025_metas(list(
    distritos = list(uno),
    grupos_edad = list(list(etiqueta = "Jóvenes", min = 18, max = 29),
                       list(etiqueta = "Adultos", min = 30, max = NULL))
  ))
  ed <- margen(res, "edad")
  expect_equal(vapply(ed$categorias, `[[`, character(1), "codigo"), c("Jóvenes", "Adultos"))
  expect_equal(pob(ed), c(suma_edad(uno, 18, 29), suma_edad(uno, 30)))
  expect_equal(sum(pob(margen(res, "educacion"))), res$total)
})

test_that("grupos que cortan un quinquenio o bajan de 18: sin educación y con aviso", {
  corta <- ponderacion_cpv2025_metas(list(grupos_edad = list(list(min = 18, max = 22))))
  expect_false("educacion" %in% vapply(corta$margenes, `[[`, character(1), "variable"))
  expect_true("educacion_no_disponible" %in% vapply(corta$avisos, `[[`, character(1), "code"))
  menores <- ponderacion_cpv2025_metas(list(grupos_edad = list(list(min = 15, max = NULL))))
  expect_match(menores$avisos[[1]]$message, "menores de 18")
  expect_equal(menores$total, suma_edad(d$distritos$ubigeo, 15))
})

test_that("agrupaciones del nivel educativo", {
  tres <- margen(ponderacion_cpv2025_metas(list(agrupacion_educacion = "3_grupos")), "educacion")
  trece <- margen(ponderacion_cpv2025_metas(list(agrupacion_educacion = "13_niveles")), "educacion")
  expect_length(tres$categorias, 3)
  expect_length(trece$categorias, 13)
  expect_equal(sum(pob(tres)), sum(pob(trece)))
})

test_that("errores declarados: ámbito desconocido y grupos inválidos", {
  expect_error(ponderacion_cpv2025_metas(list(distritos = list("999999"))),
               class = "api_error")
  e <- tryCatch(ponderacion_cpv2025_metas(list(distritos = list("999999"))), api_error = function(e) e)
  expect_identical(e$code, "E_PONDERACION_CPV_AMBITO_DESCONOCIDO")
  e2 <- tryCatch(ponderacion_cpv2025_metas(list(grupos_edad = list(list(min = 18, max = 40), list(min = 30, max = 50)))),
                 api_error = function(e) e)
  expect_identical(e2$code, "E_PONDERACION_CPV_GRUPOS_EDAD_INVALIDOS")
})

test_that("las metas del CPV calibran en el motor y expanden a la población censada", {
  res <- ponderacion_cpv2025_metas(list(distritos = list(uno)))
  sx <- margen(res, "sexo")
  set.seed(1)
  data <- data.frame(sexo = sample(c("1", "2"), 200, TRUE, prob = c(0.3, 0.7)))
  targets <- stats::setNames(pob(sx), c("1", "2"))
  out <- ponderacion_compute(data, list(enabled = TRUE, escala = "expansion",
                                        rake = list(margins = list(list(var = "sexo", targets = targets)))))
  expect_equal(sum(out$peso), res$total)
  expect_equal(sum(out$peso[data$sexo == "1"]) / res$total, unname(targets[[1]] / sum(targets)), tolerance = 1e-6)
})

test_that("distritos: el GET trae nombres y población para elegir el ámbito", {
  r <- ponderacion_cpv2025_distritos()
  expect_true(all(nzchar(r$distritos$distrito)))
  expect_true(all(r$distritos$poblacion_18 > 0))
  expect_equal(sum(r$provincias$n_distritos), nrow(r$distritos))
  expect_match(r$universo, "omisión")
})

test_that("contrato HTTP: rutas montadas, null del grupo abierto y escalares de largo 1", {
  fuente <- paste(deparse(body(build_plumber_app)), collapse = " ")
  expect_match(fuente, "mount_ponderacion_metas_cpv2025(pr)", fixed = TRUE)
  pr <- mount_ponderacion_metas_cpv2025(plumber::pr_set_serializer(plumber::pr(), .api_serializer()))
  rutas <- vapply(pr$endpoints[[1]], function(e) paste(e$verbs, e$path), character(1))
  expect_true(all(c("GET /api/analitica/ponderacion/cpv2025/distritos",
                    "POST /api/analitica/ponderacion/cpv2025/metas") %in% rutas))
  llamar <- function(metodo, ruta, cuerpo = "", tipo = "application/json") {
    bytes <- charToRaw(enc2utf8(cuerpo))
    req <- new.env()
    req$REQUEST_METHOD <- metodo
    req$PATH_INFO <- ruta
    req$QUERY_STRING <- ""
    req$CONTENT_TYPE <- tipo
    req$rook.input <- list(read = function(...) bytes, rewind = function() invisible(0L),
                           read_lines = function(...) rawToChar(bytes))
    pr$call(req)
  }

  g <- llamar("GET", "/api/analitica/ponderacion/cpv2025/distritos")
  expect_identical(as.integer(g$status), 200L)
  jg <- jsonlite::fromJSON(g$body, simplifyVector = FALSE)
  expect_length(jg$distritos, nrow(d$distritos))
  abierto <- jg$grupos_edad_default[[length(jg$grupos_edad_default)]]
  expect_null(abierto$max)

  p <- llamar("POST", "/api/analitica/ponderacion/cpv2025/metas",
              sprintf('{"distritos":["%s"],"grupos_edad":[{"etiqueta":"18+","min":18,"max":null}]}', uno))
  expect_identical(as.integer(p$status), 200L)
  jp <- jsonlite::fromJSON(p$body, simplifyVector = FALSE)
  expect_equal(jp$total, suma_edad(uno))
  # Un ubigeo solo viaja como escalar: el normalizador del front lo acepta.
  expect_identical(unlist(jp$ambito$ubigeos), uno)

  # Un cuerpo que no es JSON lo rechaza el parser de Plumber antes del handler
  # (igual que en las demás rutas POST); el E_BAD_JSON del router cubre sólo
  # el caso en que el cuerpo llega crudo. No se fija aquí: es del framework.
})

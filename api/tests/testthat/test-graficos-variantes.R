source("setup-load-all.R")

# ADR 0139 (decisión 2): las variantes son entradas del catálogo de gráficos con args fijos sobre un graficador del
# registro. Se versionan en inst/catalogos/graficos_tipos.json (test-graficos-tipos-catalogo.R vigila que el archivo
# no se desvíe del metadata) y viajan en /api/graficos/registry.

.gv_ruta <- function() {
  cands <- c(file.path(.app_api_dir(), "inst", "catalogos", "graficos_tipos.json"),
             file.path("..", "..", "inst", "catalogos", "graficos_tipos.json"))
  hit <- cands[file.exists(cands)][1]
  if (is.na(hit)) cands[[1]] else hit
}

# Args de datos mínimos para que el constructor arme el elemento; los fijos de la variante van encima.
.gv_datos <- list(
  "p_dumbbell:contraste" = list(vars = list(Confianza = c("doc$p1", "est$p1")), corte = "4"),
  "p_dumbbell:aperturas" = list(vars = list(Confianza = "est$p1"), corte = "4", cruce = "est$sexo", grupos = c("1", "2")),
  "p_barras_divergentes:escala_sin_informacion" = list(vars = "p1"),
  "p_cobertura:categorias" = list(variable = "sexo")   # ADR 0140
)

# Aplica la variante como lo hará el selector: quita `args_quitar`, pone `args_fijos` y un `NA` es «va nulo».
.gv_aplicar <- function(v, args) {
  args[intersect(names(args), v$args_quitar)] <- NULL
  for (k in names(v$args_fijos)) {
    val <- v$args_fijos[[k]]
    if (length(val) == 1L && is.na(val)) args[k] <- list(NULL) else args[[k]] <- val
  }
  args
}

test_that("cada variante es válida: su graficador existe, su familia está en el selector y sus campos están completos", {
  vs <- .graficos_variantes()
  expect_length(vs, 4L)
  ids <- vapply(vs, `[[`, "", "id")
  expect_identical(ids, c("p_dumbbell:contraste", "p_dumbbell:aperturas", "p_barras_divergentes:escala_sin_informacion",
                          "p_cobertura:categorias"))
  expect_false(anyDuplicated(ids) > 0)
  for (v in vs) {
    expect_true(v$graficador %in% names(.GRAFICADORES_META), info = v$id)
    expect_identical(sub(":.*$", "", v$id), v$graficador)
    expect_true(v$familia %in% names(.GRAFICOS_FAMILIAS_EDITOR), info = v$id)
    expect_true(nzchar(v$nombre) && nzchar(v$descripcion) && nzchar(v$icono), info = v$id)
    expect_false(grepl("[«»]", v$nombre), info = v$id)
    # Los args fijos y los que se quitan son formales del graficador (y no nombres que el constructor ignore).
    formales <- names(formals(get(v$graficador)))
    expect_true(all(names(v$args_fijos) %in% formales), info = v$id)
    expect_true(all(v$args_quitar %in% formales), info = v$id)
  }
  nombres <- vapply(vs, `[[`, "", "nombre")
  expect_identical(nombres[1:2], c("Contraste de públicos", "Aperturas por grupo"))
})

test_that("el constructor del graficador acepta los args fijos de cada variante y arma la lámina en estilo resumen", {
  for (v in .graficos_variantes()) {
    # Llega desde otra variante (el par del contraste y su `cruce: null`); los datos se eligen después, en Datos.
    previo <- if (identical(v$graficador, "p_dumbbell")) list(estilo = "recetario", bases = c("doc", "est"), cruce = NULL)
              else if (identical(v$graficador, "p_cobertura")) list(universos = "Docentes: 10", metas = "Docentes: 60%")   # la versión por públicos
              else list(estilo = "recetario")
    args <- .gv_aplicar(v, previo)
    expect_false("bases" %in% names(args) && "bases" %in% v$args_quitar)
    args <- utils::modifyList(args, .gv_datos[[v$id]])
    el <- expect_no_error(do.call(get(v$graficador), args))
    expect_s3_class(el, "ppt_element")
    # La cobertura por categorías (ADR 0140) se reconoce por su `modo`; las demás, por el estilo resumen.
    if (identical(v$graficador, "p_cobertura")) expect_identical(el$modo, "categorias", info = v$id)
    else expect_identical(el$overrides$estilo, "resumen", info = v$id)
    # Y la lámina armada se reconoce como la misma variante.
    expect_identical(.graficos_variante_de(v$graficador, args), v$id, info = v$id)
  }
})

test_that("un plan guardado con estilo resumen se rotula como su variante sin tocarlo", {
  # Contraste: `cruce: null` declarado (lo que escribe la tarjeta), o sin cruce y con preguntas por base.
  expect_identical(.graficos_variante_de("p_dumbbell", list(estilo = "resumen", cruce = NULL)), "p_dumbbell:contraste")
  expect_identical(.graficos_variante_de("p_dumbbell", list(estilo = "resumen", vars = list(T1 = c("a$p1", "b$p1")))),
                   "p_dumbbell:contraste")
  json <- jsonlite::fromJSON('{"estilo":"resumen","cruce":null,"bases":["doc","est"]}', simplifyVector = FALSE)
  expect_identical(.graficos_variante_de("p_dumbbell", json), "p_dumbbell:contraste")
  # Aperturas: cruce con texto, o recién elegida sin cruce ni preguntas por base.
  expect_identical(.graficos_variante_de("p_dumbbell", list(estilo = "resumen", cruce = "est$sexo")), "p_dumbbell:aperturas")
  expect_identical(.graficos_variante_de("p_dumbbell", list(estilo = "resumen")), "p_dumbbell:aperturas")
  # `$cruce` haría partial matching con un arg `cruce_x`; la lectura es exacta.
  expect_identical(.graficos_variante_de("p_dumbbell", list(estilo = "resumen", cruce_x = "a", vars = list(T = c("a$1", "b$1")))),
                   "p_dumbbell:contraste")
  expect_identical(.graficos_variante_de("p_barras_divergentes", list(estilo = "resumen", vars = "p1")),
                   "p_barras_divergentes:escala_sin_informacion")
  # Sin estilo resumen es el tipo base; un graficador sin variantes no tiene ninguna.
  expect_identical(.graficos_variante_de("p_dumbbell", list(cruce = "est$sexo")), NA_character_)
  expect_identical(.graficos_variante_de("p_barras_divergentes", list(estilo = "recetario")), NA_character_)
  expect_identical(.graficos_variante_de("p_radar", list(estilo = "resumen")), NA_character_)
  expect_identical(.graficos_variante_de(NULL, NULL), NA_character_)
  # Leer no muta: los args siguen idénticos.
  args <- list(estilo = "resumen", cruce = NULL)
  antes <- args
  .graficos_variante_de("p_dumbbell", args)
  expect_identical(args, antes)
})

test_that("el JSON versionado trae las variantes, los nombres, las familias y las ranuras del registro", {
  j <- jsonlite::fromJSON(.gv_ruta(), simplifyVector = FALSE)
  expect_identical(vapply(j$variantes, `[[`, "", "id"), .graficos_variantes_ids())
  contraste <- j$variantes[[1]]
  expect_true("cruce" %in% names(contraste$args_fijos))
  expect_null(contraste$args_fijos$cruce)                       # `null` en el JSON
  expect_identical(unlist(j$variantes[[2]]$args_quitar), c("cruce", "bases"))
  expect_identical(j$variantes[[3]]$args_quitar, list())        # arreglo vacío, no objeto
  expect_identical(vapply(j$familias_editor, `[[`, "", "id"), names(.GRAFICOS_FAMILIAS_EDITOR))
  expect_length(j$graficadores, 31L)
  titulos <- vapply(j$graficadores, function(g) as.character(g$titulo_humano), "")
  esperados <- vapply(names(.GRAFICADORES_META), function(nm) as.character(.GRAFICADORES_META[[nm]]$titulo_humano), "")
  expect_identical(unname(titulos), unname(esperados))
  expect_true(all(nzchar(titulos)))
  por <- setNames(j$slides, vapply(j$slides, `[[`, "", "name"))
  expect_identical(vapply(por$p_slide_1_grafico$ranuras, `[[`, "", "name"), .slide_slots("p_slide_1_grafico"))
  expect_identical(por$p_slide_portada$ranuras, list())
})

test_that("el payload de /api/graficos/registry incluye las variantes sin quitar lo que ya servía", {
  p <- .graficos_registry_payload()
  expect_true(all(c("slides", "graficadores", "familias_editor", "retirados", "variantes") %in% names(p)))
  expect_identical(vapply(p$variantes, `[[`, "", "id"), .graficos_variantes_ids())
})

test_that("GET /api/graficos/registry sirve las variantes por el wire", {
  srv <- http_contract_server()
  r <- http_get(srv, "/api/graficos/registry")
  expect_identical(r$status, 200L)
  ids <- vapply(r$json$variantes, function(v) as.character(v$id), "")
  expect_identical(ids, .graficos_variantes_ids())
  expect_true("cruce" %in% names(r$json$variantes[[1]]$args_fijos))
  expect_length(r$json$graficadores, 31L)
})

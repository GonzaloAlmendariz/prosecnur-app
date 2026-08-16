source("setup-load-all.R")
if (!exists("http_contract_server", mode = "function")) {
  source("helper-http-contract.R")
}

.l7_slide <- function(matrix, tipo) {
  tipos <- vapply(matrix$slides, `[[`, character(1), "tipo")
  matrix$slides[[match(tipo, tipos)]]
}

.l7_region <- function(slide, payload_key) {
  payloads <- vapply(slide$regions, `[[`, character(1), "payload_key")
  slide$regions[[match(payload_key, payloads)]]
}

.l7_centroid <- function(region) {
  c(
    x = region$rect$x + region$rect$width / 2,
    y = region$rect$y + region$rect$height / 2
  )
}

.l7_assert_family <- function(matrix, family) {
  if (identical(family, "portada")) {
    slide <- .l7_slide(matrix, "p_slide_portada")
    date <- .l7_region(slide, "fecha")
    subtext <- .l7_region(slide, "subtexto")
    if (isTRUE(date$visible) || isTRUE(subtext$visible)) stop("portada hidden")
    return(invisible(TRUE))
  }
  if (identical(family, "objetivo")) {
    slide <- .l7_slide(matrix, "p_slide_objetivo_icono")
    text <- .l7_region(slide, "texto")
    icon <- .l7_region(slide, "icono")
    if (!isTRUE(text$visible) || !isTRUE(icon$visible) || !identical(icon$role, "icon")) {
      stop("objetivo útil")
    }
    return(invisible(TRUE))
  }
  if (identical(family, "top_two")) {
    slide <- .l7_slide(matrix, "p_slide_top_two_box")
    payloads <- vapply(slide$regions, `[[`, character(1), "payload_key")
    if (!identical(slide$render_key, "top_two_box") ||
        !identical(payloads, c("titulo", "texto", "diagrama")) ||
        !all(vapply(slide$regions, `[[`, logical(1), "visible"))) {
      stop("top_two explícito")
    }
    return(invisible(TRUE))
  }
  if (identical(family, "texto")) {
    slide <- .l7_slide(matrix, "p_slide_texto")
    text <- .l7_region(slide, "texto")
    if (!isTRUE(text$visible) || text$rect$width <= 0.5 || text$rect$height <= 0.2) {
      stop("texto útil")
    }
    return(invisible(TRUE))
  }
  if (identical(family, "splits")) {
    specs <- list(
      p_slide_grafico_texto_derecha = c(text = "texto", charts = "grafico", side = "right"),
      p_slide_grafico_texto_izquierda = c(text = "texto", charts = "grafico", side = "left"),
      p_slide_2_graficos_texto_derecha = c(text = "texto", charts = "grafico_1", side = "right"),
      p_slide_2_graficos_texto_izquierda = c(text = "texto", charts = "grafico_1", side = "left")
    )
    for (tipo in names(specs)) {
      slide <- .l7_slide(matrix, tipo)
      text <- .l7_region(slide, specs[[tipo]][["text"]])
      chart <- .l7_region(slide, specs[[tipo]][["charts"]])
      text_xy <- .l7_centroid(text)
      chart_xy <- .l7_centroid(chart)
      correct_side <- if (identical(specs[[tipo]][["side"]], "right")) {
        text_xy[["x"]] > chart_xy[["x"]]
      } else {
        text_xy[["x"]] < chart_xy[["x"]]
      }
      if (!isTRUE(text$visible) || text$rect$height < 0.4 || text_xy[["y"]] > 0.8 || !correct_side) {
        stop("split panel lateral")
      }
    }
    return(invisible(TRUE))
  }
  if (identical(family, "poblaciones")) {
    expected <- list(
      p_slide_2_graficos_poblacion = c("izquierda", "derecha", "icono"),
      p_slide_4_graficos_poblacion = c(
        "superior_izquierda", "superior_derecha", "inferior_izquierda",
        "inferior_derecha", "icono"
      ),
      p_slide_5_graficos_poblacion = c(
        "grafico_superior_1", "grafico_superior_2", "grafico_superior_3",
        "grafico_inferior_1", "grafico_inferior_2", "icono"
      ),
      p_slide_6_graficos_poblacion = c(
        "grafico_superior_1", "grafico_superior_2", "grafico_superior_3",
        "grafico_inferior_1", "grafico_inferior_2", "grafico_inferior_3", "icono"
      )
    )
    for (tipo in names(expected)) {
      slide <- .l7_slide(matrix, tipo)
      visible <- slide$regions[vapply(slide$regions, `[[`, logical(1), "visible")]
      payloads <- vapply(visible, `[[`, character(1), "payload_key")
      if (!all(expected[[tipo]] %in% payloads)) stop("población keys")
      icon <- .l7_region(slide, "icono")
      if (!isTRUE(icon$visible) || !identical(icon$role, "icon")) stop("población icono")
    }
    pop2 <- .l7_slide(matrix, "p_slide_2_graficos_poblacion")
    if (!(.l7_centroid(.l7_region(pop2, "izquierda"))[["x"]] <
          .l7_centroid(.l7_region(pop2, "icono"))[["x"]] &&
          .l7_centroid(.l7_region(pop2, "icono"))[["x"]] <
          .l7_centroid(.l7_region(pop2, "derecha"))[["x"]])) {
      stop("población orden")
    }
    for (n in c(5L, 6L)) {
      slide <- .l7_slide(matrix, paste0("p_slide_", n, "_graficos_poblacion"))
      top <- vapply(1:3, function(i) {
        .l7_centroid(.l7_region(slide, paste0("grafico_superior_", i)))[["x"]]
      }, numeric(1))
      if (is.unsorted(top, strictly = TRUE)) stop("población orden")
    }
    return(invisible(TRUE))
  }
  stop("familia desconocida")
}

test_that("matriz ACNUR v2 acredita 32 tipos, 18 layouts y wire path-free", {
  skip_if_not_installed("officer")
  matrix <- .graficos_slide_layout_matrix(template_id = "acnur_16_9")

  expect_identical(
    names(matrix),
    c("schema", "contract_version", "template", "canvas", "slides")
  )
  expect_identical(matrix$schema, "graficos.slide_layout_matrix/v2")
  expect_identical(matrix$contract_version, 2L)
  expect_identical(names(matrix$template), c("id", "fingerprint", "identity_source"))
  expect_identical(matrix$template$id, "acnur_16_9")
  expect_identical(matrix$template$identity_source, "template_id")
  expect_match(matrix$template$fingerprint, "^[0-9a-f]{64}$")
  expect_identical(length(matrix$slides), 32L)
  expect_identical(length(unique(vapply(matrix$slides, `[[`, character(1), "layout"))), 29L)

  tipos <- vapply(matrix$slides, `[[`, character(1), "tipo")
  expect_setequal(tipos, names(.SLIDES_META))
  for (slide in matrix$slides) {
    meta <- .SLIDES_META[[slide$tipo]]
    expect_identical(slide$render_key, meta$render_key, label = slide$tipo)
    expect_identical(slide$layout, meta$blueprint$ppt_layout, label = slide$tipo)
    expect_identical(
      names(slide),
      c("tipo", "render_key", "layout", "regions", "diagnostics"),
      label = slide$tipo
    )
    for (region in slide$regions) {
      expect_identical(
        names(region),
        c("key", "payload_key", "role", "visible", "rect", "geometry_source"),
        label = paste(slide$tipo, region$key)
      )
      values <- unlist(region$rect, use.names = FALSE)
      expect_true(all(is.finite(values)), label = paste(slide$tipo, region$key))
      expect_true(all(values >= 0 & values <= 1), label = paste(slide$tipo, region$key))
      expect_lte(region$rect$x + region$rect$width, 1 + 1e-8)
      expect_lte(region$rect$y + region$rect$height, 1 + 1e-8)
      if (isTRUE(region$visible)) {
        expect_gt(region$rect$width * region$rect$height, 0)
      }
    }
  }

  wire <- jsonlite::toJSON(matrix, auto_unbox = TRUE, null = "null")
  expect_false(grepl("template_path|[.]pptx|/Users/|\\\\Users\\\\|\"sid\"|secret", wire, ignore.case = TRUE))
})

test_that("identidad por defecto es genérica y determinista, nunca inferida del path", {
  skip_if_not_installed("officer")
  first <- .graficos_slide_layout_matrix()
  second <- .graficos_slide_layout_matrix()

  expect_identical(first$template$id, "generic_16_9")
  expect_identical(first$template$identity_source, "default")
  expect_identical(first$template$fingerprint, second$template$fingerprint)
})

test_that("identity_source reconoce ids explícitos dentro de config", {
  skip_if_not_installed("officer")
  by_template <- .graficos_resolve_slide_layout_contract(
    config = list(scope_rules = list(global = list(template_id = "acnur_16_9")))
  )
  by_profile <- .graficos_resolve_slide_layout_contract(
    config = list(scope_rules = list(global = list(profile_id = "acnur_kobo_cruncher_plus")))
  )

  expect_identical(by_template$template$id, "acnur_16_9")
  expect_identical(by_template$template$identity_source, "template_id")
  expect_identical(by_profile$template$id, "acnur_16_9")
  expect_identical(by_profile$template$identity_source, "profile_id")
})

test_that("identidad query explícita domina el par heredado de config", {
  skip_if_not_installed("officer")
  contradictory <- list(
    scope_rules = list(
      global = list(
        profile_id = "legacy_profile",
        template_id = "generic_16_9"
      )
    )
  )

  by_profile <- .graficos_slide_layout_matrix(
    profile_id = "acnur_kobo_cruncher_plus",
    config = contradictory
  )
  by_template <- .graficos_slide_layout_matrix(
    profile_id = "acnur_kobo_cruncher_plus",
    template_id = "generic_16_9",
    config = contradictory
  )

  expect_identical(by_profile$template$id, "acnur_16_9")
  expect_identical(by_profile$template$identity_source, "profile_id")
  expect_identical(by_template$template$id, "generic_16_9")
  expect_identical(by_template$template$identity_source, "template_id")
})

test_that("oracle pre-L7 conserva Graficos2 como primera opción de slide_1", {
  skip_if_not_installed("officer")
  template <- .graficos_resolve_template_pptx(template_id = "generic_16_9")
  available <- officer::layout_summary(officer::read_pptx(template))$layout
  pre_l7_renderer_oracle <- c("Graficos2", "Graficos")
  expected <- pre_l7_renderer_oracle[pre_l7_renderer_oracle %in% available][[1]]

  expect_identical(expected, "Graficos2")
  expect_identical(
    .SLIDES_META$p_slide_1_grafico$blueprint$ppt_layout,
    expected
  )
  matrix <- .graficos_slide_layout_matrix(template_id = "generic_16_9")
  slide <- .l7_slide(matrix, "p_slide_1_grafico")
  expect_identical(slide$layout, expected)

  resolved <- .graficos_resolve_slide_layout_contract(template_id = "generic_16_9")
  expect_identical(attr(resolved, "ppt_contract")$slide_1$layout, expected)
})

test_that("aliases compatibles resuelven 32 de 32 dentro del mismo master", {
  preferred <- vapply(
    .SLIDES_META,
    function(meta) as.character(meta$blueprint$ppt_layout)[1],
    character(1)
  )
  aliases_only <- unname(preferred)
  aliases_only[aliases_only == "Graficos2"] <- "Graficos"
  aliases_only[aliases_only == "Title and Content"] <- "General Objective"
  target_layouts <- unique(aliases_only)
  layout_info <- rbind(
    data.frame(layout = target_layouts, master = "Target Master", stringsAsFactors = FALSE),
    data.frame(
      layout = c("Graficos2", "Title and Content"),
      master = "Other Master",
      stringsAsFactors = FALSE
    )
  )

  selected <- vapply(
    preferred,
    .ppt_slide_template_select_layout,
    character(1),
    layout_info = layout_info,
    master = "Target Master"
  )
  diagnostics <- ifelse(is.na(selected), "layout_missing", "")
  expect_identical(length(selected), 32L)
  expect_false(any(diagnostics == "layout_missing"))
  expect_identical(unname(selected[["p_slide_1_grafico"]]), "Graficos")
  expect_true(all(selected[preferred == "Title and Content"] == "General Objective"))

  with_primary <- rbind(
    data.frame(
      layout = c("Graficos2", "Title and Content"),
      master = "Target Master",
      stringsAsFactors = FALSE
    ),
    layout_info
  )
  expect_identical(
    .ppt_slide_template_select_layout("Graficos2", with_primary, "Target Master"),
    "Graficos2"
  )
  expect_identical(
    .ppt_slide_template_select_layout("Title and Content", with_primary, "Target Master"),
    "Title and Content"
  )
})

test_that("selector conserva fallback tipado cuando falta el type_idx exacto", {
  props <- data.frame(
    type = c("body", "body", "pic"),
    type_idx = c(2L, 3L, 1L),
    stringsAsFactors = FALSE
  )

  fallback <- .ppt_slide_template_select_placeholder(
    props,
    list(type = "body", type_idx = 99L)
  )
  exact <- .ppt_slide_template_select_placeholder(
    props,
    list(type = "body", type_idx = 3L)
  )

  expect_identical(fallback$type_idx[[1]], 2L)
  expect_identical(exact$type_idx[[1]], 3L)
  expect_null(
    .ppt_slide_template_select_placeholder(
      props,
      list(type = "title", type_idx = 1L)
    )
  )
})

test_that("seis familias mutantes fallan por la divergencia causal", {
  skip_if_not_installed("officer")
  matrix <- .graficos_slide_layout_matrix(template_id = "acnur_16_9")
  families <- c("portada", "objetivo", "top_two", "texto", "splits", "poblaciones")
  for (family in families) expect_no_error(.l7_assert_family(matrix, family))

  mutant <- matrix
  .l7_region_index <- function(slide, payload) {
    match(payload, vapply(slide$regions, `[[`, character(1), "payload_key"))
  }
  .l7_slide_index <- function(tipo) {
    match(tipo, vapply(mutant$slides, `[[`, character(1), "tipo"))
  }

  i <- .l7_slide_index("p_slide_portada")
  j <- .l7_region_index(mutant$slides[[i]], "fecha")
  mutant$slides[[i]]$regions[[j]]$visible <- TRUE
  expect_error(.l7_assert_family(mutant, "portada"), "portada hidden")

  mutant <- matrix
  i <- match("p_slide_objetivo_icono", vapply(mutant$slides, `[[`, character(1), "tipo"))
  j <- .l7_region_index(mutant$slides[[i]], "icono")
  mutant$slides[[i]]$regions[[j]]$role <- "shape"
  expect_error(.l7_assert_family(mutant, "objetivo"), "objetivo útil")

  mutant <- matrix
  i <- match("p_slide_top_two_box", vapply(mutant$slides, `[[`, character(1), "tipo"))
  mutant$slides[[i]]$render_key <- "unknown_tipo"
  expect_error(.l7_assert_family(mutant, "top_two"), "top_two explícito")

  mutant <- matrix
  i <- match("p_slide_texto", vapply(mutant$slides, `[[`, character(1), "tipo"))
  j <- .l7_region_index(mutant$slides[[i]], "texto")
  mutant$slides[[i]]$regions[[j]]$visible <- FALSE
  expect_error(.l7_assert_family(mutant, "texto"), "texto útil")

  mutant <- matrix
  i <- match("p_slide_grafico_texto_derecha", vapply(mutant$slides, `[[`, character(1), "tipo"))
  j <- .l7_region_index(mutant$slides[[i]], "texto")
  mutant$slides[[i]]$regions[[j]]$rect$y <- 0.92
  mutant$slides[[i]]$regions[[j]]$rect$height <- 0.04
  expect_error(.l7_assert_family(mutant, "splits"), "split panel lateral")

  mutant <- matrix
  i <- match("p_slide_2_graficos_poblacion", vapply(mutant$slides, `[[`, character(1), "tipo"))
  j <- .l7_region_index(mutant$slides[[i]], "icono")
  mutant$slides[[i]]$regions[[j]]$payload_key <- "icon"
  expect_error(.l7_assert_family(mutant, "poblaciones"), "población keys")
})

test_that("objetivo ACNUR usa body 1 texto y body 2 icono del resolver", {
  skip_if_not_installed("officer")
  path <- file.path("..", "..", "inst", "plantillas", "plantilla_acnur_16_9.pptx")
  resolved <- .ppt_resolve_slide_template_contract(
    officer::read_pptx(path),
    presets = list(base = list(args = list())),
    template_id = "acnur_16_9",
    identity_source = "template_id"
  )
  contract <- attr(resolved, "ppt_contract")$objetivo_icono
  expect_identical(contract$slots$text$type_idx, 1L)
  expect_identical(contract$slots$icon$type_idx, 2L)
})

test_that("registry serializa render_key declarativo para los 32 tipos", {
  registry <- .graficos_registry_payload()
  slides <- registry$slides
  expect_identical(length(slides), 32L)
  keys <- vapply(slides, `[[`, character(1), "render_key")
  expect_identical(
    keys,
    unname(vapply(.SLIDES_META, `[[`, character(1), "render_key"))
  )
})

test_that("GET slide-layout-matrix monta y sirve el contrato v2 explícito", {
  skip_if_not_installed("plumber")
  skip_if_not_installed("officer")

  pr <- mount_graficos(plumber::pr())
  endpoints <- unlist(pr$endpoints, recursive = FALSE)
  paths <- vapply(endpoints, function(endpoint) endpoint$path, character(1))
  index <- which(paths == "/api/graficos/slide-layout-matrix")
  expect_length(index, 1L)
  expect_true("GET" %in% endpoints[[index]]$verbs)

  req <- new.env(parent = emptyenv())
  req$argsQuery <- list(template_id = "acnur_16_9")
  res <- new.env(parent = emptyenv())
  res$status <- 200L
  res$setHeader <- function(...) invisible(NULL)
  payload <- endpoints[[index]]$getFunc()(req, res)

  expect_identical(res$status, 200L)
  expect_identical(payload$schema, "graficos.slide_layout_matrix/v2")
  expect_identical(payload$contract_version, 2L)
  expect_identical(payload$template$id, "acnur_16_9")
  expect_identical(payload$template$identity_source, "template_id")
  expect_identical(length(payload$slides), 32L)
})

test_that("HTTP real absorbe query params y conserva req$argsQuery como autoridad", {
  .http_contract_skip_if_unavailable()
  srv <- http_contract_server()

  matrix <- http_get(
    srv,
    paste0(
      "/api/graficos/slide-layout-matrix?",
      "template_id=acnur_16_9&profile_id=legacy_profile&scope=active"
    )
  )
  expect_identical(matrix$status, 200L)
  expect_null(matrix$json$error)
  expect_identical(matrix$json$schema, "graficos.slide_layout_matrix/v2")
  expect_identical(length(matrix$json$slides), 32L)
  expect_identical(matrix$json$template$id, "acnur_16_9")
  expect_identical(matrix$json$template$identity_source, "template_id")

  preview <- http_get(
    srv,
    paste0(
      "/api/graficos/slide-layout-preview?",
      "tipo=p_slide_1_grafico&template_id=acnur_16_9&",
      "profile_id=legacy_profile&scope=active"
    )
  )
  expect_identical(preview$status, 200L)
  expect_null(preview$json$error)
  expect_true(isTRUE(preview$json$ok))
  expect_identical(preview$json$tipo, "p_slide_1_grafico")
  expect_identical(preview$json$template_id, "acnur_16_9")
  expect_identical(preview$json$source, "template")
})

test_that("GET matrix separa scope efectivo, identidad y precedencia de query", {
  skip_if_not_installed("plumber")
  skip_if_not_installed("officer")
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  with_height <- function(config, height) {
    config$presets$base <- config$presets$base %||% list()
    config$presets$base$args <- config$presets$base$args %||% list()
    config$presets$base$args$slide_title_height <- height
    config
  }
  active_config <- with_height(.graficos_default_config(sid), 0.45)
  active_config$template_id <- NULL
  active_config$templateId <- "generic_16_9"
  consolidated_config <- with_height(.graficos_default_config(sid), 1.15)
  consolidated_config$profile_id <- NULL
  consolidated_config$profileId <- "acnur_kobo_cruncher_plus"

  state <- session_get(sid)
  state$graficos_config <- active_config
  state$graficos_consolidado_draft <- list(
    schema = .GRAFICOS_CONSOLIDADO_DRAFT_SCHEMA,
    revision = 1L,
    config = consolidated_config
  )
  .session_env[[sid]] <- state

  pr <- mount_graficos(plumber::pr())
  endpoints <- unlist(pr$endpoints, recursive = FALSE)
  paths <- vapply(endpoints, function(endpoint) endpoint$path, character(1))
  endpoint <- endpoints[[which(paths == "/api/graficos/slide-layout-matrix")]]
  request <- function(query) {
    req <- new.env(parent = emptyenv())
    req$argsQuery <- query
    req$HTTP_X_PULSO_SESSION <- sid
    res <- new.env(parent = emptyenv())
    res$status <- 200L
    res$setHeader <- function(...) invisible(NULL)
    endpoint$getFunc()(req, res)
  }

  active <- request(list(scope = "active"))
  consolidated <- request(list(scope = "consolidated"))
  expect_identical(active$template$id, "generic_16_9")
  expect_identical(active$template$identity_source, "template_id")
  expect_identical(consolidated$template$id, "acnur_16_9")
  expect_identical(consolidated$template$identity_source, "profile_id")

  active_same_template <- request(list(scope = "active", template_id = "generic_16_9"))
  consolidated_same_template <- request(list(scope = "consolidated", template_id = "generic_16_9"))
  expect_false(identical(
    active_same_template$template$fingerprint,
    consolidated_same_template$template$fingerprint
  ))

  camel_query <- request(list(scope = "active", templateId = "acnur_16_9"))
  expect_identical(camel_query$template$id, "acnur_16_9")
  expect_identical(camel_query$template$identity_source, "template_id")
  profile_query <- request(list(
    scope = "active",
    profile_id = "acnur_kobo_cruncher_plus"
  ))
  expect_identical(profile_query$template$id, "acnur_16_9")
  expect_identical(profile_query$template$identity_source, "profile_id")
  snake_wins <- request(list(
    scope = "consolidated",
    template_id = "generic_16_9",
    templateId = "acnur_16_9"
  ))
  expect_identical(snake_wins$template$id, "generic_16_9")
  expect_identical(snake_wins$template$identity_source, "template_id")
  invalid_scope <- request(list(scope = "legacy"))
  expect_identical(invalid_scope$error$code, "E_BAD_SLIDE_LAYOUT_SCOPE")
  expect_match(invalid_scope$error$message, "scope debe ser")
})

.l7_sentinel_plan <- function() {
  blank <- p_ggplot_raw(
    ggplot2::ggplot(data.frame(x = 1, y = 1), ggplot2::aes(x, y)) +
      ggplot2::geom_blank() +
      ggplot2::theme_void()
  )
  icon <- p_ggplot_raw(
    ggplot2::ggplot(data.frame(x = 1, y = 1, label = "L7-ICON-SENTINEL"),
                    ggplot2::aes(x, y, label = label)) +
      ggplot2::geom_text() +
      ggplot2::theme_void()
  )
  list(
    p_slide_portada(
      "L7-S01-portada", "L7 portada subtítulo",
      fecha = "L7-HIDDEN-DATE", subtexto = "L7-HIDDEN-SUBTEXT"
    ),
    p_slide_indice("L7-S02-indice", secciones = c("Uno", "Dos")),
    p_slide_top_two_box("L7-S03-top-two", texto = "L7-TOP-TWO-TEXT"),
    p_slide_redondeo("L7-S04-redondeo", texto = "L7-REDONDEO-TEXT"),
    p_slide_seccion("L7-S05-seccion"),
    p_slide_objetivo_icono(icon, "L7-OBJECTIVE-TEXT", "L7-S06-objetivo"),
    p_slide_texto("L7-S07-texto", "L7-TEXT-BODY"),
    p_slide_tabla_tecnica(
      "L7-S08-tabla",
      data.frame(criterio = "L7-TABLE-KEY", detalle = "L7-TABLE-VALUE")
    ),
    p_slide_1_grafico(blank, titulo = "L7-S09-un-grafico"),
    p_slide_1_grafico_narrativo(blank, "L7-NARRATIVE-ONE", "L7-S10-narrativo"),
    p_slide_grafico_texto_derecha(blank, "L7-SPLIT-R-TEXT", "L7-S11-split-right"),
    p_slide_grafico_texto_izquierda(blank, "L7-SPLIT-L-TEXT", "L7-S12-split-left"),
    p_slide_2_graficos(blank, blank, titulo = "L7-S13-dos-graficos"),
    p_slide_2_graficos_narrativo(blank, blank, "L7-NARRATIVE-TWO", "L7-S14-dos-narrativo"),
    p_slide_2_graficos_texto_izquierda(
      blank, blank, "L7-SPLIT-2L-TEXT", "L7-S15-dos-texto-left"
    ),
    p_slide_2_graficos_texto_derecha(
      blank, blank, "L7-SPLIT-2R-TEXT", "L7-S16-dos-texto-right"
    ),
    p_slide_4_graficos(blank, blank, blank, blank, titulo = "L7-S17-cuatro"),
    p_slide_2_graficos_poblacion(
      blank, blank, "L7-S18-poblacion-dos", "L7-POP-TWO-TEXT", icon
    ),
    p_slide_3_graficos_poblacion_tira(
      blank, blank, blank, "L7-S19-poblacion-tira", icono = icon
    ),
    p_slide_3_graficos_poblacion_corona(
      blank, blank, blank, "L7-S20-poblacion-corona", icono = icon
    ),
    p_slide_3_graficos_poblacion_cifras(
      blank, blank, blank, blank, blank, "L7-S21-poblacion-cifras", icono = icon
    ),
    p_slide_cifras_y_graficos(
      blank, blank, blank, blank, blank, "L7-S22-cifras-banda"
    ),
    p_slide_3_graficos_2mas1(
      blank, blank, blank, "L7-S23-graficos-2mas1"
    ),
    p_slide_3_graficos_1mas2(
      blank, blank, blank, "L7-S24-graficos-1mas2"
    ),
    p_slide_3_graficos_fila(
      blank, blank, blank, "L7-S25-graficos-fila"
    ),
    p_slide_3_graficos_1arriba(
      blank, blank, blank, "L7-S26-graficos-1arriba"
    ),
    p_slide_2_graficos_vertical(
      blank, blank, "L7-S27-graficos-vertical"
    ),
    p_slide_2_graficos_asimetrico(
      blank, blank, "L7-S28-graficos-asimetrico"
    ),
    p_slide_3_graficos_poblacion(
      blank, blank, blank, "L7-S29-poblacion-tres", icon
    ),
    p_slide_4_graficos_poblacion(
      blank, blank, blank, blank, "L7-S30-poblacion-cuatro", icon
    ),
    p_slide_5_graficos_poblacion(
      blank, blank, blank, blank, blank, "L7-S31-poblacion-cinco", icono = icon
    ),
    p_slide_6_graficos_poblacion(
      blank, blank, blank, blank, blank, blank,
      "L7-S32-poblacion-seis", icono = icon
    )
  )
}

test_that("renderer ACNUR consume el mismo objeto v2 en un deck de 32 sentinelas", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")
  skip_if_not_installed("ggplot2")

  template <- file.path("..", "..", "inst", "plantillas", "plantilla_acnur_16_9.pptx")
  output <- tempfile(fileext = ".pptx")
  presets <- p_presets()
  data <- data.frame(x = 1)
  instrument <- list(
    survey = data.frame(
      name = "x", type = "integer", list_name = NA_character_,
      stringsAsFactors = FALSE
    ),
    choices = NULL,
    orders_list = NULL
  )
  rendered <- reporte_ppt_plan(
    data = data,
    instrumento = instrument,
    path_ppt = output,
    presets = presets,
    plan = .l7_sentinel_plan(),
    template_pptx = template,
    template_id = "acnur_16_9",
    mensajes_progreso = FALSE
  )
  matrix <- .graficos_slide_layout_matrix(
    template_id = "acnur_16_9",
    presets = presets
  )

  expect_true(file.exists(output))
  expect_identical(rendered$slide_layout_contract$contract_version, 2L)
  expect_identical(
    .ppt_slide_layout_matrix_payload(rendered$slide_layout_contract),
    matrix
  )

  doc <- officer::read_pptx(output)
  expect_identical(length(doc$slide$names()), 32L)
  layout_meta <- doc$slideLayouts$get_metadata()
  actual_layouts <- vapply(seq_len(32L), function(i) {
    rel <- doc$slide$get_slide(i)$get_metadata()$layout_file[[1]]
    filename <- basename(rel)
    as.character(layout_meta$name[match(filename, layout_meta$filename)])
  }, character(1))
  expect_identical(actual_layouts, vapply(matrix$slides, `[[`, character(1), "layout"))

  summary <- officer::pptx_summary(doc)
  sentinels <- sprintf("L7-S%02d-", seq_len(32L))
  for (i in seq_len(21L)) {
    slide_text <- paste(summary$text[summary$slide_id == i], collapse = " ")
    expect_match(slide_text, sentinels[[i]], fixed = TRUE, label = paste("slide", i))
  }
  all_text <- paste(summary$text, collapse = " ")
  expect_false(grepl("L7-HIDDEN-DATE|L7-HIDDEN-SUBTEXT", all_text))
  expect_match(all_text, "L7-OBJECTIVE-TEXT", fixed = TRUE)
  expect_match(all_text, "L7-TOP-TWO-TEXT", fixed = TRUE)
  expect_match(all_text, "L7-TEXT-BODY", fixed = TRUE)
  expect_match(all_text, "L7-SPLIT-R-TEXT", fixed = TRUE)
  expect_match(all_text, "L7-SPLIT-L-TEXT", fixed = TRUE)
  expect_match(all_text, "L7-SPLIT-2L-TEXT", fixed = TRUE)
  expect_match(all_text, "L7-SPLIT-2R-TEXT", fixed = TRUE)
  expect_match(all_text, "L7-ICON-SENTINEL", fixed = TRUE)
})

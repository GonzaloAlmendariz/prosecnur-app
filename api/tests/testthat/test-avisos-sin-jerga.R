# Los avisos de Gráficos que llegan al analista no exponen ids, nombres de funciones o tipos internos, nombres de
# argumentos ni valores de enum crudos (A8, unidad B-g). Casos reales del panel Avisos de Láminas:
#   «"Objetivo con icono" (slide 1pkxbl): …», «Lamina degradada a canvas 'Sin datos'…», «El ícono '318ecf24-…'»,
#   «La lámina 'p_slide_objetivo_icono'», «escala_valor = "proporcion_100"».
# Un aviso nombra la lámina por su número y título, el tipo y el espacio como el selector, y dice la acción en llano.
# Lo estructurado (slide_id, code) para «Ir a la lámina» viaja aparte, no en el texto.

.UUID_TEST <- "318ecf24-5b1a-4c2e-9f1d-0a1b2c3d4e5f"

# Los textos con jerga, según el contrato del paquete (`.aviso_tiene_jerga`, graficos_avisos_texto.R): uuid, tipos o
# funciones internas, «canvas», «slide», «ADR n», códigos `methodology_*` y nombres con guion bajo fuera de «…»/“…”.
.jerga_en <- function(textos) as.character(textos)[.aviso_tiene_jerga(textos)]

# Lo que un bloque emite por el canal sellado de avisos (jobs.R), sin el sello.
.avisos_de <- function(expr) {
  msgs <- character(0)
  withCallingHandlers(
    suppressWarnings(expr),
    message = function(m) {
      txt <- conditionMessage(m)
      if (grepl(.PULSO_AVISO_SELLO, txt, fixed = TRUE)) {
        msgs <<- c(msgs, trimws(sub(paste0(".*\\", .PULSO_AVISO_SELLO), "", txt)))
      }
      invokeRestart("muffleMessage")
    }
  )
  msgs
}


test_that("el detector de jerga reconoce los casos reales y respeta lo que el analista escribió", {
  viejos <- c("\"Objetivo con icono\" (slide 1pkxbl): el ícono referenciado ya no existe en el catálogo",
              "Lamina degradada a canvas 'Sin datos': x", paste0("El ícono '", .UUID_TEST, "' no está disponible"),
              "La lámina 'p_slide_objetivo_icono' necesita un ícono", "Declara `escala_valor = \"proporcion_100\"`",
              "Usa estandar, resto_mayor o ambos", "methodology_zero_denominator: x", "slide[9]: x")
  expect_true(all(.aviso_tiene_jerga(viejos)))
  expect_false(any(.aviso_tiene_jerga(c("Lámina 3 · “PERFIL_2026”: crea «p3_recod»", "El radar recibió valores de hasta 98.1"))))
  expect_identical(.aviso_motivo("No se pudo renderizar `icono`"), "")
  expect_identical(.aviso_motivo("la variable P7 no existe."), " Motivo: la variable P7 no existe.")
})

test_that("el detector de jerga reconoce el voseo y no el español neutro (mutantes del verificador de B-g)", {
  # Los dos mutantes que sobrevivían: router_graficos.R, avisos del ícono.
  mutantes <- c("Lámina 4: su ícono ya no está en el catálogo de íconos y sale sin él. Subilo de nuevo en Configuración global > Íconos.",
                "Lámina 3: necesita un ícono y no había ninguno disponible: se usó el integrado. Elegí un PNG en Configuración global > Íconos.")
  expect_true(all(.aviso_tiene_jerga(mutantes)))
  voseo <- c("Revisá la base", "Volvé a intentar", "Fijate en el filtro", "Probá con otra", "Cargá el archivo", "Usá otro",
             "Subí uno nuevo o elige otro.", "Elegilo en el editor", "Poné un título", "Tramificala en Codificación")
  expect_true(all(.aviso_tiene_voseo(voseo)))
  neutro <- c("Aquí está así", "Leí el plan", "Ayer subí el archivo y lo elegí", "Lo creé, usé el mismo y andé bien",
              "Súbelo de nuevo", "Elige un PNG", "Revisa la base", "Vuelve a intentar", "Fíjate en el filtro",
              "se usará la variable original", "Ponlo así", "fijamente", "Tramifícala en Codificación",
              "Motivo: la variable P7 no existe.", "Elige redondeo estándar, reparto a 100 % o ambos.")
  expect_false(any(.aviso_tiene_voseo(neutro)))
})

test_that("el rótulo de una lámina es número + título, como la numera la UI", {
  expect_identical(.aviso_lamina(3, "Perfil del docente"), "Lámina 3 · “Perfil del docente”")
  expect_identical(.aviso_lamina(3, ""), "Lámina 3")
  expect_identical(.aviso_lamina(3, "Bienestar (cont.)"), "Lámina 3 · “Bienestar”")
  expect_identical(.aviso_lamina(2, "X", base = "docentes"), "Lámina 2 de «docentes» · “X”")
  expect_identical(.aviso_lamina(NULL, "X"), "La lámina “X”")
  expect_identical(.aviso_lamina(), "Una lámina sin título")
})

test_that("tipos y espacios se nombran como el selector, no por su nombre interno", {
  expect_identical(.aviso_tipo_lamina("p_slide_objetivo_icono"), "Objetivo con ícono")
  expect_false(grepl("p_slide", .aviso_tipo_lamina("p_slide_que_no_existe"), fixed = TRUE))
  expect_identical(.aviso_espacio("p_slide_4_graficos", "inferior_derecha"), "Inferior derecha")
  expect_identical(.aviso_espacio(NULL, "superior_izquierda"), "Superior izquierda")
  expect_false(grepl("_", .aviso_tipo_grafico("p_barras_apiladas"), fixed = TRUE))
  expect_identical(.aviso_variable("egresados$p12"), "«p12» de la base «egresados»")
})

test_that("el ícono que falta no expone su id y nombra la lámina", {
  av <- .avisos_de(.aviso_con_lamina(4, "Objetivo general", .graficos_rebuild_icon(.UUID_TEST, list())))
  expect_length(av, 1L)
  expect_match(av, "^Lámina 4 · “Objetivo general”: su ícono ya no está en el catálogo")
  expect_false(grepl(.UUID_TEST, av, fixed = TRUE))
  expect_length(.jerga_en(av), 0L)
  # Sin lámina en curso, una frase completa (y tampoco el id).
  sin <- .avisos_de(.graficos_rebuild_icon(.UUID_TEST, list()))
  expect_match(sin, "^Un ícono elegido para una lámina ya no está en el catálogo")
  expect_length(.jerga_en(sin), 0L)
})

test_that("el ícono que perdió su PNG se nombra como en el catálogo, no por su id", {
  cfg <- list(iconos = list(list(id = .UUID_TEST, nombre = "Perfil", path = file.path(tempdir(), "no-existe-jamas.png"))))
  reg <- .graficos_icon_registry(NULL, cfg)
  expect_identical(unname(attr(reg, "nombres")[[.UUID_TEST]]), "Perfil")
  av <- .avisos_de(.aviso_con_lamina(5, "Perfil del docente", .graficos_rebuild_icon(.UUID_TEST, reg)))
  expect_identical(av, paste0("Lámina 5 · “Perfil del docente”: su ícono «Perfil» ya no está en el catálogo de íconos y sale sin él. ",
                              "Vuelve a subirlo en Configuración global > Íconos si lo necesitas."))
  expect_length(.jerga_en(av), 0L)
})

test_that("la lámina que exige ícono se nombra por su tipo visible, no por la función", {
  fn <- p_slide_objetivo_icono
  av <- .avisos_de(.aviso_con_lamina(2, "Objetivo", .graficos_normalize_payload_icon(list(texto = "x"), fn, "p_slide_objetivo_icono")))
  expect_match(av, "^Lámina 2 · “Objetivo”: necesita un ícono")
  expect_length(.jerga_en(av), 0L)
  sin <- .avisos_de(.graficos_normalize_payload_icon(list(texto = "x"), fn, "p_slide_objetivo_icono"))
  expect_true(grepl("«Objetivo con ícono»", sin, fixed = TRUE))
  expect_false(grepl("p_slide_objetivo_icono", sin, fixed = TRUE))
})

test_that("el validador del plan rotula por número y título, y nombra el espacio vacío", {
  plan <- list(slides = list(
    list(id = "1pkxbl", tipo = "p_slide_4_graficos", payload = list(
      titulo = "Perfil del estudiante",
      superior_izquierda = list(graficador = "p_barras_agrupadas", args = list(var = "estudiantes$p5", overrides = list(titulo = "Sexo"))),
      superior_derecha = list(graficador = "p_barras_agrupadas", args = list(var = "estudiantes$p6", overrides = list(titulo = "Nivel"))),
      inferior_izquierda = list(graficador = "p_barras_agrupadas", args = list(var = "estudiantes$p5")),
      inferior_derecha = list())),
    list(id = "zz9", tipo = "p_slide_1_grafico", payload = list(grafico = list(graficador = "p_no_existe", args = list())))
  ))
  v <- .validar_plan_json(plan)
  textos <- c(v$warnings, v$errors)
  expect_true(any(grepl("^Lámina 1 · “Perfil del estudiante”: el espacio «Inferior derecha» está sin gráfico$", v$warnings)))
  expect_true(any(grepl("^Lámina 1 · “Perfil del estudiante”: «p5» de la base «estudiantes» se grafica dos veces", v$warnings)))
  expect_true(any(grepl("^Lámina 2: el espacio «Gráfico principal» usa un tipo de gráfico que esta versión no reconoce", v$errors)))
  expect_false(any(grepl("1pkxbl|zz9|p_no_existe|inferior_derecha|slide\\[", textos)))
  expect_length(.jerga_en(textos), 0L)
  expect_identical(.validar_plan_json(list(slides = list()))$errors, "El plan no tiene láminas.")
})

test_that("la degradación a «Sin datos» nombra la lámina en curso y deja el detalle técnico en el log", {
  e <- .lam_avisos_estado
  viejo <- e$rotulo
  on.exit(e$rotulo <- viejo, add = TRUE)
  e$rotulo <- list(numero = 7L, titulo = "Bienestar universitario")
  av <- .avisos_de(.plan_canvas_render_nulo("No se pudo renderizar `icono` en `p_slide_objetivo_icono()`."))
  expect_identical(av, "Lámina 7 · “Bienestar universitario”: un gráfico no se pudo dibujar y su espacio sale con «Sin datos».")
  # El warning (log del job) conserva el detalle técnico para depurar.
  expect_warning(suppressMessages(.plan_canvas_render_nulo("detalle `x`")), "detalle `x`", fixed = TRUE)
  av2 <- .avisos_de(.plan_elemento_degradado("En `p_slide_1_grafico()`, `grafico` debe ser `ppt_element`."))
  expect_match(av2, "^Lámina 7 · “Bienestar universitario”: un gráfico quedó incompleto en el plan")
  falla <- function(el) stop(structure(class = c("pulso_slide_render_error", "error", "condition"),
                                       list(message = "la variable no está en la base", call = NULL)))
  av3 <- .avisos_de(.plan_render_element_degradable(falla, structure(list(.element_type = "barras_apiladas"), class = c("ppt_element", "list"))))
  expect_match(av3, "^Lámina 7 · “Bienestar universitario”: no se pudo dibujar y sale con «Sin datos»\\. Motivo: la variable no está en la base\\.$")
  expect_length(.jerga_en(c(av, av2, av3)), 0L)
})

test_that("el detalle técnico queda en el stderr del proceso (el `.err` del job) y no en el aviso", {
  # Bloqueante 1 del verificador de B-g: el renderer se traga los `warning()`, así que el `conditionMessage()` callado en
  # el aviso tenía que ir a algún log. En un proceso aparte, como el worker callr, con el stderr a un archivo: la
  # variable inexistente y el id del ícono están en el stderr con su prefijo, y los avisos sellados no los nombran.
  skip_if_not_installed("callr")
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")
  err <- withr::local_tempfile(fileext = ".err")
  raiz <- normalizePath(testthat::test_path("..", ".."))
  callr::r(function(raiz, uuid) {
    suppressMessages(pkgload::load_all(raiz, quiet = TRUE))
    data <- data.frame(p1 = c("si", "no", "si"), stringsAsFactors = FALSE)   # el fixture de test-reporte-plan-condiciones.R
    inst <- list(survey = data.frame(name = "p1", type = "select_one lst_sino", list_name = "lst_sino", stringsAsFactors = FALSE),
                 choices = data.frame(list_name = "lst_sino", name = c("si", "no"), label = c("Sí", "No"), stringsAsFactors = FALSE),
                 orders_list = NULL)
    plan <- list(diapo_001 = p_slide_1_grafico(grafico = p_barras_apiladas("var_fantasma"), titulo = "Rota"),
                 diapo_002 = p_slide_1_grafico(grafico = p_barras_apiladas("p1")))
    suppressWarnings(reporte_ppt_plan(data = data, instrumento = inst, plan = plan, presets = p_presets(),
                                      path_ppt = tempfile(fileext = ".pptx"), mensajes_progreso = FALSE))
    .aviso_con_lamina(3, "Objetivo", .graficos_rebuild_icon(uuid, list()))
    invisible(NULL)
  }, args = list(raiz = raiz, uuid = .UUID_TEST), stderr = err, stdout = NULL)
  lineas <- readLines(err, warn = FALSE, encoding = "UTF-8")
  detalle <- grep(.AVISO_DETALLE_SELLO, lineas, fixed = TRUE, value = TRUE)
  avisos <- trimws(sub(paste0(".*\\", .PULSO_AVISO_SELLO), "", grep(.PULSO_AVISO_SELLO, lineas, fixed = TRUE, value = TRUE)))
  expect_true(any(grepl("var_fantasma", detalle, fixed = TRUE)))
  expect_true(any(grepl(.UUID_TEST, detalle, fixed = TRUE)))
  expect_true(any(grepl("^Lámina 1 · “Rota”: no se pudo dibujar", avisos)))
  expect_false(any(grepl("var_fantasma", avisos, fixed = TRUE)))
  expect_false(any(grepl(.UUID_TEST, avisos, fixed = TRUE)))
  # El prefijo del detalle no es el sello: `.pulso_avisos_de_job()` no lo recoge.
  expect_false(any(grepl(.PULSO_AVISO_SELLO, detalle, fixed = TRUE)))
})

test_that("los avisos numeran por la posición en el plan, no en el PPTX (particiones y «Otros» no corren el número)", {
  pieza <- function(id) structure(list(title = "Bienestar"), pulso_particion = list(id = id, titulo = "Bienestar", barras = 14L, techo = 7L))
  plan <- list(list(title = "Portada"), pieza("p2"), pieza("p2"), list(title = "Otros", meta = list(auto_otros = TRUE)),
               list(title = "Satisfacción"))
  expect_identical(vapply(seq_along(plan), function(i) .lam_posicion_usuario(plan, i), 1L), c(1L, 2L, 2L, 2L, 3L))
  # Con un PPTX que ya lleva 40 diapositivas, la lámina 5 del plan sigue siendo la 3 del usuario.
  e <- .lam_avisos_estado
  rotulos <- local({
    out <- character(0)
    for (i in seq_along(plan)) {
      .lam_avisos_paso(plan, i, as.list(seq_len(40L + i)))
      out <- c(out, .aviso_lamina_en_curso())
    }
    cierre <- .avisos_de(.lam_avisos_cierre(plan, NULL))
    c(out, cierre)
  })
  expect_match(rotulos[6], "^Lámina 2 · “Bienestar”: salió en 2 partes")   # el de líneas, con el mismo número
  expect_identical(rotulos[5], "Lámina 3 · “Satisfacción”")
  expect_identical(rotulos[3], "Lámina 2 · “Bienestar”")
  expect_null(e$rotulo)
})

test_that("el radar no pide declarar un argumento ni un valor crudo", {
  d <- data.frame(eje = c("A", "B", "C"), grupo = "G", valor = c(90.8, 95.1, 98.1))
  av <- .avisos_de(graficar_radar(d, escala_valor = "proporcion_1"))
  expect_true(any(grepl("declara la escala de valores como porcentaje (0 a 100)", av, fixed = TRUE)))
  expect_false(any(grepl("escala_valor|proporcion_100", av)))
  expect_length(.jerga_en(av), 0L)
})

test_that("el radar entre públicos no se nombra por su tipo interno", {
  bajo <- data.frame(eje = factor(c("A", "B")), grupo = factor(c("g", "g")), valor = c(42.3, 98.0), n = c(51L, 51L))
  av <- .avisos_de(.radar_mb_piso(bajo, 50))
  expect_match(av, "^Radar entre públicos: el eje ahora arranca en 35 y no en 50")
  expect_length(.jerga_en(av), 0L)
})

test_that("la lámina de redondeo no enseña valores de enum", {
  av <- .avisos_de(.lam_redondeo_metodo(list(metodo = "xyz")))
  expect_false(any(grepl("resto_mayor|estandar»|xyz", av)))
  expect_true(any(grepl("«Explicación del redondeo»", av, fixed = TRUE)))
  expect_length(.jerga_en(av), 0L)
})

test_that("el ajuste al estándar nombra lo que cambió, no la clave ni el ADR", {
  av <- .avisos_de(.std_imponer_base(list(base = list(size_titulo_slide = 99)), avisar = TRUE))
  expect_true(any(grepl("tamaño del título", av, fixed = TRUE)))
  expect_false(any(grepl("size_titulo_slide|ADR", av)))
  expect_length(.jerga_en(av), 0L)
})

test_that("los avisos de metodología del consolidado no llevan su código interno", {
  reglas <- list(list(ref = "egresados$p12", source = "egresados", variable = "p12", zero_denominator = "report_na_with_warning",
                      eligible_if = "", exclude_empty = TRUE, exclusions = list()))
  av <- .graficos_consolidado_denominator_warnings(list(data_sources = list(egresados = data.frame(p12 = c(NA, NA)))), reglas)
  expect_identical(av, "«p12» de la base «egresados» no tiene casos válidos después de aplicar la elegibilidad y las exclusiones: se reporta como sin dato.")
  expect_length(.jerga_en(av), 0L)
})

test_that("contrato estático: ningún literal de `.pulso_aviso()` del área de Gráficos trae jerga", {
  # Barre los literales que el código entrega por el canal sellado. Los `%s` se quitan: el valor que entra ahí lo
  # cubren los tests de cada aviso. Si un aviso nuevo nombra un argumento o un tipo interno, este test lo detecta.
  raiz <- testthat::test_path("..", "..", "R")
  skip_if_not(dir.exists(raiz), "sin fuentes del paquete")
  archivos <- list.files(raiz, pattern = "^(graficos_|graficador_|lamina_|reporte_plan_|reporte_word_|estandar_|router_graficos).*\\.R$", full.names = TRUE)
  literales <- unlist(lapply(archivos, function(f) {
    pd <- utils::getParseData(parse(f, keep.source = TRUE), includeText = TRUE)
    llamadas <- pd$parent[pd$token == "SYMBOL_FUNCTION_CALL" & pd$text == ".pulso_aviso"]
    if (!length(llamadas)) return(character(0))
    ids_expr <- pd$parent[pd$id %in% llamadas]
    unlist(lapply(ids_expr, function(id) {
      hijos <- function(x) { h <- pd$id[pd$parent %in% x]; if (length(h)) c(h, hijos(h)) else h }
      sub <- pd[pd$id %in% hijos(id) & pd$token == "STR_CONST", , drop = FALSE]
      vapply(sub$text, function(t) eval(parse(text = t)), character(1), USE.NAMES = FALSE)
    }))
  }))
  expect_gt(length(literales), 10L)
  literales <- gsub("%[-0-9.]*[sdf]", "X", literales)
  expect_identical(.jerga_en(literales), character(0))
})

test_that("contrato sobre el proyecto de referencia: los avisos del plan de acrconta_mazo no traen jerga", {
  pulso <- system.file("reference_projects", "acrconta_mazo", "acrconta_mazo.pulso", package = "prosecnurapp")
  if (!nzchar(pulso)) pulso <- testthat::test_path("..", "..", "inst", "reference_projects", "acrconta_mazo", "acrconta_mazo.pulso")
  skip_if_not(file.exists(pulso), "sin el proyecto de referencia acrconta_mazo")
  copia <- withr::local_tempdir()
  file.copy(pulso, file.path(copia, "ref.pulso"))
  utils::unzip(file.path(copia, "ref.pulso"), files = "state.rds", exdir = copia)
  s <- readRDS(file.path(copia, "state.rds"))
  cfg <- s$graficos_config
  plan <- cfg$plan
  slides <- plan$slides %||% list()
  skip_if(!length(slides), "el plan de referencia está vacío")

  v <- .validar_plan_json(plan)
  migracion <- attr(.normalize_plan(plan, avisar = TRUE), "avisos_migracion") %||% character(0)
  estilo <- .avisos_de(.std_imponer_base(cfg$presets, avisar = TRUE))
  # Cada lámina se arma como en el job, con su número de contexto y SIN catálogo de íconos: los íconos del proyecto
  # salen como faltantes, que es justo el caso de «El ícono '318ecf24-…'».
  armado <- unlist(lapply(seq_along(slides), function(i) {
    .avisos_de(tryCatch(.aviso_con_lamina(i, .aviso_titulo_payload(slides[[i]]), .graficos_rebuild_slide_json(slides[[i]], icon_registry = list())),
                        error = function(e) NULL))
  }))
  textos <- unique(c(v$warnings, v$errors, migracion, estilo, armado))
  expect_identical(.jerga_en(textos), character(0))
  # Los ids de las láminas nunca aparecen en el texto (viajan aparte, para «Ir a la lámina»).
  ids <- vapply(slides, function(x) as.character(x$id %||% "")[1], "")
  ids <- ids[!is.na(ids) & nchar(ids) >= 4L]
  if (length(textos) && length(ids)) {
    expect_false(any(vapply(ids, function(id) any(grepl(id, textos, fixed = TRUE)), logical(1))))
  }
})

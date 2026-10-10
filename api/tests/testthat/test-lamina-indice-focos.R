# Índice con íconos «de foco» por el motor nativo (F6.4: «en especial para láminas que lo usan como el de los íconos del
# índice»). Los ajustes `iconos_focos…` de la ruta anterior (cinco focos fijos de la plantilla) se traducen a la
# composición del recetario (31-50): un ícono navy por capítulo en la lista; lo que no tiene equivalente se avisa.

.focos_mazo <- function(plan) {
  df <- data.frame(p = rep(c("a", "b"), 10))
  inst <- list(survey = data.frame(name = "p", type = "select_one l", list_name = "l", label = "P"),
               choices = data.frame(list_name = "l", name = c("a", "b"), label = c("Sí", "No")), orders_list = NULL)
  out <- tempfile(fileext = ".pptx"); avisos <- character(0)
  withCallingHandlers(
    suppressWarnings(reporte_ppt_plan(data = df, instrumento = inst, plan = plan, path_ppt = out, mensajes_progreso = FALSE)),
    message = function(m) { avisos <<- c(avisos, conditionMessage(m)); invokeRestart("muffleMessage") })
  dir <- tempfile(); utils::unzip(out, exdir = dir)
  laminas <- lapply(seq_len(length(officer::read_pptx(out))), function(k) {
    xml <- paste(readLines(file.path(dir, sprintf("ppt/slides/slide%d.xml", k)), warn = FALSE, encoding = "UTF-8"), collapse = "\n")
    rels <- xml2::read_xml(file.path(dir, sprintf("ppt/slides/_rels/slide%d.xml.rels", k)))
    rid <- xml2::xml_attr(xml2::xml_children(rels), "Id"); tgt <- xml2::xml_attr(xml2::xml_children(rels), "Target")
    x <- xml2::read_xml(xml)
    pics <- xml2::xml_find_all(x, "//p:pic")
    md5 <- vapply(pics, function(p) {
      e <- xml2::xml_attr(xml2::xml_find_first(p, ".//a:blip"), "embed")
      unname(tools::md5sum(normalizePath(file.path(dir, "ppt/slides", tgt[match(e, rid)]))))
    }, "")
    list(xml = xml, x = x, pic_nombre = xml2::xml_attr(xml2::xml_find_first(pics, ".//p:cNvPr"), "name"), pic_md5 = md5)
  })
  list(laminas = laminas, avisos = grep("[PULSO-AVISO]", avisos, fixed = TRUE, value = TRUE))
}
.focos_icono_md5 <- function(n) unname(tools::md5sum(system.file("ppt_assets", "iconos_recetario", "navy", paste0(n, ".png"), package = "prosecnurapp")))
.focos_ilu_md5 <- function(g) unname(tools::md5sum(system.file("ppt_assets", "indice_geometria", paste0(g, ".png"), package = "prosecnurapp")))
.focos_txt <- function(x, n) xml2::xml_text(xml2::xml_find_all(x, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", n)))

c5 <- c("Perfil del encuestado", "Características institucionales", "Cuerpo académico", "Características del perfil de egreso", "Estudiantes y graduados")

test_that("un índice con iconos_focos sale nativo: grupo prosecnur:indice, un ícono del usuario por capítulo y sin focos de imagen", {
  m <- .focos_mazo(list(p_slide_indice("Índice", secciones = c5, iconos_focos = c("target", "clipboard-list", "", "chart-column", "lightbulb"))))
  l <- m$laminas[[1]]
  expect_identical(.pptx_lamina_estado(l$xml), "estructura")
  expect_true("prosecnur:indice" %in% xml2::xml_attr(xml2::xml_find_all(l$x, "//p:cNvPr"), "name"))
  expect_identical(.focos_txt(l$x, "indice:capitulo"), c5)                      # los títulos del plan, tal cual
  expect_identical(.focos_txt(l$x, "indice:numero"), as.character(1:5))
  expect_true(all(l$pic_nombre %in% c("indice:ilustracion", "indice:icono")))  # ni focos de la plantilla ni dibujo ggplot
  expect_false(any(grepl("bulb", l$pic_nombre, ignore.case = TRUE)))
  ic <- l$pic_md5[l$pic_nombre == "indice:icono"]
  # Los elegidos se respetan; el vacío (capítulo 3) toma la elección automática del motor.
  expect_identical(ic, .focos_icono_md5(c("target", "clipboard-list", .lam_icono_capitulo(c5[3]), "chart-column", "lightbulb")))
  # El foco es un círculo con su ícono: la composición equivalente del recetario es «círculos» (41).
  expect_identical(l$pic_md5[l$pic_nombre == "indice:ilustracion"], .focos_ilu_md5("circulos"))
  expect_length(m$avisos, 0L)
})

test_that("un ícono del usuario que no existe no se reemplaza en silencio: aviso con su nombre y la elección automática", {
  m <- .focos_mazo(list(p_slide_indice("Índice", secciones = c5[1:3], iconos_focos = c("no-existe", "building-2", "presentation"))))
  l <- m$laminas[[1]]
  expect_identical(.pptx_lamina_estado(l$xml), "estructura")
  expect_identical(l$pic_md5[l$pic_nombre == "indice:icono"], .focos_icono_md5(c(.lam_icono_capitulo(c5[1]), "building-2", "presentation")))
  expect_true(any(grepl("no-existe", m$avisos, fixed = TRUE) & grepl(c5[1], m$avisos, fixed = TRUE)))
})

test_that("los ajustes del foco sin equivalente en el recetario se avisan por nombre y la lámina sigue nativa", {
  m <- .focos_mazo(list(p_slide_indice("Índice", secciones = c5[1:3], iconos_focos = c("target", "", ""),
                                       iconos_focos_fill = c("#EFD25E", "#E4A34C", "#9688D3"), iconos_focos_diametro_cm = 2.5,
                                       iconos_focos_icon_scale = 0.6)))
  l <- m$laminas[[1]]
  expect_identical(.pptx_lamina_estado(l$xml), "estructura")
  av <- paste(m$avisos, collapse = "\n")
  for (k in c("iconos_focos_fill", "iconos_focos_diametro_cm", "iconos_focos_icon_scale")) expect_match(av, k, fixed = TRUE)
})

test_that("mostrar_iconos_focos = FALSE quita los íconos; una composición declarada manda; «focos» explícito conserva su ruta", {
  m <- .focos_mazo(list(
    a = p_slide_indice("Índice", secciones = c5[1:3], iconos_focos = c("target", "", ""), mostrar_iconos_focos = FALSE),
    b = p_slide_indice("Índice", secciones = c5[1:3], iconos_focos = c("target", "", ""), meta = list(composicion = "bloques")),
    c = p_slide_indice("Índice", secciones = c5[1:3], meta = list(composicion = "focos"))))
  la <- m$laminas[[1]]; lb <- m$laminas[[2]]; lc <- m$laminas[[3]]
  expect_identical(.pptx_lamina_estado(la$xml), "estructura")
  expect_false("indice:icono" %in% la$pic_nombre)
  expect_identical(lb$pic_md5[lb$pic_nombre == "indice:ilustracion"], .focos_ilu_md5("bloques"))
  expect_identical(lb$pic_md5[lb$pic_nombre == "indice:icono"][1], .focos_icono_md5("target"))
  expect_false("prosecnur:indice" %in% xml2::xml_attr(xml2::xml_find_all(lc$x, "//p:cNvPr"), "name"))
})

test_that("sin ajustes de focos el índice nativo queda como estaba (arcos y elección automática)", {
  m <- .focos_mazo(list(p_slide_indice("Índice", secciones = c5, iconos_focos = "")))
  l <- m$laminas[[1]]
  expect_identical(l$pic_md5[l$pic_nombre == "indice:ilustracion"], .focos_ilu_md5("arcos"))
  expect_identical(l$pic_md5[l$pic_nombre == "indice:icono"], .focos_icono_md5(vapply(c5, .lam_icono_capitulo, "", USE.NAMES = FALSE)))
  expect_length(m$avisos, 0L)
})

test_that("los nombres del catálogo anterior, como los manda la app (uno por línea), van por su equivalente o en navy", {
  m <- .focos_mazo(list(p_slide_indice("Índice", secciones = c5,
                                       iconos_focos = "target-arrow\nclipboard-list\ncircle-user-round\nchart-column\nartificial-intelligence")))
  l <- m$laminas[[1]]
  expect_identical(.pptx_lamina_estado(l$xml), "estructura")
  ic <- l$pic_md5[l$pic_nombre == "indice:icono"]
  expect_length(ic, 5L)
  expect_identical(ic[1:4], .focos_icono_md5(c("diana-flecha", "clipboard-list", "user-round", "chart-column")))
  # Sin equivalente en el recetario: el mismo dibujo del usuario, repintado en el navy de la lista (no blanco, no otro).
  expect_false(ic[5] %in% .focos_icono_md5(.lam_iconos_catalogo()$nombres))
  navy <- png::readPNG(.lam_icono_navy_desde(system.file("ppt_assets", "indice_icons", "artificial-intelligence.png", package = "prosecnurapp")))
  opaco <- navy[, , 4] > 0.5
  expect_equal(round(255 * c(mean(navy[, , 1][opaco]), mean(navy[, , 2][opaco]), mean(navy[, , 3][opaco]))), c(8, 31, 92))
  expect_length(m$avisos, 0L)
})

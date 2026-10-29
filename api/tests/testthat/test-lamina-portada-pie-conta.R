# Checklist Arte vs Conta (2026-10-29), ítems 24, 26 y 28: «Base:» en peso normal donde la pone Conta, la portada de
# plantilla con el título azul y el encargo antes que la fecha, y la contraportada al final del mazo.

.pc_mazo <- function(plan) {
  df <- data.frame(p = rep(c("a", "b"), 10))
  inst <- list(survey = data.frame(name = "p", type = "select_one l", list_name = "l", label = "P"),
               choices = data.frame(list_name = "l", name = c("a", "b"), label = c("Sí", "No")), orders_list = NULL)
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = df, instrumento = inst, plan = plan, path_ppt = out, mensajes_progreso = FALSE)))
  lapply(seq_len(length(officer::read_pptx(out))), function(k) xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", k))))
}
.pc_sp <- function(x, n) xml2::xml_find_first(x, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", n))
.pc_off <- function(sp) {
  off <- xml2::xml_find_first(sp, "./p:spPr/a:xfrm/a:off")
  c(x = as.numeric(xml2::xml_attr(off, "x")), y = as.numeric(xml2::xml_attr(off, "y"))) / 914400
}
.pc_titulo_largo <- paste(rep("ESTUDIO DE OPINIÓN SOBRE EL SERVICIO EDUCATIVO OFRECIDO EN LA ETAPA DE FORMACIÓN GENERAL", 3), collapse = " ")

test_that("«Base:» va a 10 pt sin negrita en la caja de Conta (0,35/7,06) y el folio en su misma línea", {
  skip_if_not_installed("officer")
  doc <- officer::add_slide(officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp")),
                            layout = "Graficos", master = "Office Theme")
  doc <- .lam_pie(doc, "Base: 279 estudiantes", 6L)
  x <- doc$slide$get_slide(doc$cursor)$get()
  base <- .pc_sp(x, "Base lamina"); folio <- .pc_sp(x, "Folio lamina")
  expect_equal(unname(.pc_off(base)), c(0.35, 7.06), tolerance = 0.005)
  rpr <- xml2::xml_find_first(base, ".//a:rPr")
  expect_identical(xml2::xml_attr(rpr, "b"), "0")
  expect_identical(xml2::xml_attr(rpr, "sz"), as.character(round(.std_pt("base") * 100)))
  expect_equal(unname(.pc_off(folio))[2], .std_comp("pie", "base_y"), tolerance = 0.005)   # ítem 23: el folio se queda, en la línea de «Base:»
  # La caja de la base no se sale de la lámina (7,5 in) ni se cruza con la del folio.
  e <- xml2::xml_find_first(base, "./p:spPr/a:xfrm/a:ext")
  ext <- as.numeric(c(xml2::xml_attr(e, "cx"), xml2::xml_attr(e, "cy"))) / 914400
  expect_lte(.std_comp("pie", "base_y") + ext[2], 7.5)
  expect_lte(.std_comp("pie", "base_x") + ext[1], unname(.pc_off(folio))[1])
  # La nota de significancia y la zona de datos siguen midiendo contra `base_y`: la base sólo baja.
  expect_gte(.std_comp("pie", "base_y"), .std_geom("base_y"))
})

test_that("la portada de plantilla lleva el título azul y el encargo (18 pt) arriba de la fecha, como Conta", {
  skip_if_not_installed("officer")
  lam <- .pc_mazo(list(a = p_slide_portada(.pc_titulo_largo, "Informe consolidado", fecha = "Octubre, 2026",
                                           subtexto = "Por encargo de la Facultad de Arte y Diseño PUCP")))
  x <- lam[[1]]
  expect_false("prosecnur:portada" %in% xml2::xml_attr(xml2::xml_find_all(x, "//p:cNvPr"), "name"))   # va por la plantilla
  tit <- xml2::xml_find_first(x, "//p:sp[.//p:ph[@type='ctrTitle']]//a:rPr//a:srgbClr")
  expect_identical(xml2::xml_attr(tit, "val"), .lam_hex(.std_color("azul")))
  fecha <- xml2::xml_find_first(x, "//p:sp[.//p:ph[@type='dt']]")
  enc <- xml2::xml_find_first(x, "//p:sp[.//p:ph[@type='body' and @idx='12']]")
  expect_identical(xml2::xml_text(enc), "Por encargo de la Facultad de Arte y Diseño PUCP")
  expect_identical(xml2::xml_text(fecha), "Octubre, 2026")
  expect_lt(.pc_off(enc)[["y"]], .pc_off(fecha)[["y"]])                            # el orden de Conta
  expect_equal(unname(.pc_off(enc)), unname(.lam_portada_caja("encargo")[c("left", "top")]), tolerance = 0.005)
  expect_equal(unname(.pc_off(fecha)), unname(.lam_portada_caja("fecha")[c("left", "top")]), tolerance = 0.005)
  expect_identical(xml2::xml_attr(xml2::xml_find_first(enc, ".//a:rPr"), "sz"), "1800")
  expect_identical(xml2::xml_attr(xml2::xml_find_first(enc, ".//a:pPr"), "algn"), "ctr")
  expect_identical(xml2::xml_attr(xml2::xml_find_first(fecha, ".//a:pPr"), "algn"), "r")      # la fecha, a la derecha de su caja
  expect_identical(xml2::xml_attr(xml2::xml_find_first(fecha, ".//a:rPr"), "sz"), "1800")
})

test_that("fuera de la plantilla de PULSO la portada conserva su color y sus slots", {
  expect_identical(.lam_portada_titulo_color_defecto(TRUE, "/x/plantilla_acnur_16_9.pptx"), .std_color("coral"))
  expect_identical(.lam_portada_titulo_color_defecto(FALSE, "/x/plantilla_16_9.pptx"), .std_color("coral"))   # títulos de lámina
  expect_identical(.lam_portada_titulo_color_defecto(TRUE, "/x/plantilla_16_9.pptx"), .std_color("azul"))
  spec <- list(type = "dt", type_idx = 1)
  expect_identical(.lam_portada_slot_plantilla(spec, "date", "/x/plantilla_acnur_16_9.pptx"), spec)
  expect_identical(.lam_portada_encargo_valor("Por encargo", "/x/plantilla_acnur_16_9.pptx"), "Por encargo")
  expect_identical(.lam_portada_fecha_valor("Octubre", "/x/plantilla_acnur_16_9.pptx"), "Octubre")
})

test_that("la contraportada cierra el mazo con el logo del layout y el contacto al pie (ítem 28)", {
  skip_if_not_installed("officer")
  lam <- .pc_mazo(list(a = p_slide_texto("x", texto = "y"), b = p_slide_cierre("contraportada")))
  x <- lam[[length(lam)]]
  nombres <- xml2::xml_attr(xml2::xml_find_all(x, "//p:cNvPr"), "name")
  expect_true(all(c("cierre:correo", "cierre:direccion", "cierre:web") %in% nombres))
  expect_identical(xml2::xml_text(.pc_sp(x, "cierre:correo")), "pulsopucp@pucp.edu.pe")
})

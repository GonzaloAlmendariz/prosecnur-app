# Geometria de pagina del .docx del formulario en papel (§17 del GOAL).
#
# El ancho util de cada tramo salia de una constante, `.FORM_WORD_USABLE_IN =
# (11906 - 680 * 2) / 1440`, escrita a mano en paralelo a los margenes que
# `.form_word_section_prop()` emite en el `sectPr`. Eran DOS fuentes del mismo
# numero: cambiar un margen en la seccion dejaba las tablas dimensionadas para
# la caja vieja, y nada avisaba. Aqui hay UNA geometria: la seccion la emite
# (`pgSz` + `pgMar` + `cols`) y el ancho util se DERIVA de ella — pagina menos
# margenes, y en una seccion de dos columnas, (util - medianil) / 2.
#
# Con la geometria actual la salida es identica byte a byte en el
# `document.xml` (comprobado sobre los fixtures de test-xlsform-formulario-word.R
# y sobre hsvg2026/acnur_pdm/ops_salud, columnas 1 y 2): este archivo cambia de
# donde sale el numero, no el numero.

# Geometria de la seccion, en twips (1/1440 in). La pagina es el A4 vertical que
# `officer::page_size()` emite por defecto (`<w:pgSz w:w="11906" w:h="16838">`).
# Margenes de la referencia: left/right 680, top 420, bottom 700, header 397,
# footer 250. Medianil de dos columnas: 425 (`<w:cols w:space="425"/>` del
# instrumento de referencia).
.form_word_geometria <- function() {
  ps <- officer::page_size(orient = "portrait")
  list(
    page_size = ps,
    page_w_tw = round(ps$width * 1440),
    page_h_tw = round(ps$height * 1440),
    mar_tw = c(top = 420, bottom = 700, left = 680, right = 680,
               header = 397, footer = 250, gutter = 0),
    col_space_tw = 425
  )
}

# `page_margins` del `sectPr`, en pulgadas, desde la geometria.
.form_word_geom_page_mar <- function(geom = .form_word_geometria()) {
  m <- geom$mar_tw / 1440
  officer::page_mar(top = m[["top"]], bottom = m[["bottom"]],
                    left = m[["left"]], right = m[["right"]],
                    header = m[["header"]], footer = m[["footer"]],
                    gutter = m[["gutter"]])
}

# Ancho util (pulg) de UNA columna de una seccion con `columns` columnas: pagina
# menos margenes laterales y, con dos columnas, menos el medianil y a la mitad.
.form_word_ancho_util_in <- function(columns = 1L, geom = .form_word_geometria()) {
  caja <- (geom$page_w_tw - geom$mar_tw[["left"]] - geom$mar_tw[["right"]]) / 1440
  if (identical(as.integer(columns %||% 1L), 2L)) {
    (caja - geom$col_space_tw / 1440) / 2
  } else {
    caja
  }
}

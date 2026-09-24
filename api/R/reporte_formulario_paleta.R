# Paleta LOCAL y monocroma del motor de formulario en papel.
#
# Por que no se toca `pulso_pdf_theme.R`: ese theme lo comparten el codebook, el
# PDF de monitoreo telefonico y los de Hojas de ruta, que son entregables de
# PANTALLA y de presentacion, donde el navy de Pulso es correcto. El formulario
# no: es un insumo de campo que se IMPRIME por cientos y se FOTOCOPIA. La escala
# de grises no es una excepcion a la identidad, es la identidad aplicada a un
# medio sin color.
#
# Valores medidos sobre el instrumento de referencia (Ser Adolescente): texto
# `000000` en sus 224 ocurrencias de color, rellenos F2F2F2 (656 usos), E8E8E8
# (125) y D9D9D9 (19), bordes A6A6A6 (2 666). Los mismos que usa el renderer
# Word (`reporte_formulario_word.R`), para que los dos formatos salgan iguales.
#
# Ver docs/qa/goal-formulario-replica-ser-adolescente-2026-09-24.md

.FORM_PDF_GRIS <- list(
  tinta  = "#000000",   # TODO el texto
  linea  = "#A6A6A6",   # rejilla y reglas
  banda  = "#D9D9D9",   # banda de seccion y cabecera de matriz
  zebra  = "#F2F2F2",   # relleno suave de fila alterna
  papel  = "#FFFFFF"
)

# Devuelve los tokens del theme compartido con TODO lo cromatico sustituido por
# su equivalente en gris. Se parte del theme para no perder claves que el motor
# pueda leer (si manana el theme anade una, aqui sale en gris por defecto y no
# como NULL, que reventaria el dibujo).
.form_pdf_tokens <- function() {
  tk <- pulso_pdf_tokens()
  g <- .FORM_PDF_GRIS
  # Texto y acentos -> negro. La jerarquia la llevan cuerpo y peso, no el color.
  for (k in c("navy", "ink", "soft", "faint", "sobre_navy_tenue",
              "sexo_h", "sexo_m", "success", "warn", "danger")) {
    if (!is.null(tk[[k]])) tk[[k]] <- g$tinta
  }
  # La banda de seccion deja de ser navy solido con texto reversado: es una caja
  # gris con texto negro. 88% de tinta a todo el ancho por ejemplar era caro en
  # toner y lo primero que se empasta al fotocopiar.
  tk$sobre_navy <- g$tinta
  for (k in c("rule", "line", "tbl_frame", "tbl_div")) {
    if (!is.null(tk[[k]])) tk[[k]] <- g$linea
  }
  tk$tbl_header <- g$banda
  tk$tbl_zebra <- g$zebra
  tk$canvas <- g$papel
  tk$surface <- g$papel
  tk
}

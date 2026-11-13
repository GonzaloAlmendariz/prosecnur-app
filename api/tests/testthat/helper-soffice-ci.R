# LibreOffice instalado que no convierte: salto sólo en el CI, con el motivo y lo que escribió LibreOffice.
#
# En el runner de Linux (run 43464962736, LibreOffice 24.2 de apt) toda conversión a PDF salió sin archivo, con
# cualquier plazo, en las vistas previas de láminas y en los visores de Word. Fuera del CI este helper no salta nada:
# una conversión que falla en una Mac o en Windows hace fallar el test.

.soffice_sonda <- new.env(parent = emptyenv())

soffice_sonda_conversion <- function() {
  if (is.null(.soffice_sonda$info)) {
    doc <- officer::add_slide(officer::read_pptx(), layout = "Title and Content", master = "Office Theme")
    doc <- officer::ph_with(doc, "Sonda", location = officer::ph_location_type(type = "title"))
    pptx <- tempfile(fileext = ".pptx")
    print(doc, target = pptx)
    .soffice_sonda$info <- .pptx_to_pdf_soffice_info(pptx, tempfile("sonda_soffice_"), timeout = 90)
    unlink(pptx)
  }
  .soffice_sonda$info
}

skip_si_soffice_no_convierte_en_ci <- function() {
  if (!identical(Sys.getenv("CI"), "true") || !nzchar(.soffice_cmd())) return(invisible(TRUE))
  testthat::skip_if_not_installed("officer")
  info <- soffice_sonda_conversion()
  testthat::skip_if(
    is.null(info$pdf),
    paste0(
      "LibreOffice está instalado pero no convierte a PDF en este runner (motivo ", info$motivo, ", ",
      round(info$segundos, 1), " s): ", paste(info$salida, collapse = " | ")
    )
  )
  invisible(TRUE)
}

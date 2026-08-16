#' Saneo del OOXML antes de entregar un .pptx
#'
#' PowerPoint abria el mazo con «PowerPoint found a problem with content» y lo
#' reparaba ELIMINANDO contenido. LibreOffice no se quejaba, asi que toda la
#' validacion visual se hizo sobre un archivo que el cliente abre roto.
#'
#' La causa: `officer` escribe las fuentes de un `a:rPr` en el orden
#' `latin, cs, ea, sym`, y el esquema (ECMA-376, CT_TextCharacterProperties)
#' fija `latin, ea, cs, sym`. El XML esta bien formado —por eso ningun validador
#' generico lo detectaba— pero incumple la secuencia, y PowerPoint es estricto
#' donde LibreOffice es permisivo. El entregable aprobado tiene cero de estos;
#' el mazo del motor tenia 159.
#'
#' Se corrige al escribir el archivo y no en el render: el orden lo emite la
#' libreria, no el motor, asi que atajarlo en cada `fp_text` seria perseguir
#' cada punto de llamada. Aqui se corrige una vez, para todo lo que salga.
#'
#' @name reporte_ppt_saneo_ooxml
NULL


# Orden que el esquema exige para los tipos de letra dentro de un rPr.
.OOXML_ORDEN_FUENTES <- c("latin", "ea", "cs", "sym")

# Elementos de propiedades de texto que llevan esos hijos.
.OOXML_TAGS_RPR <- c("a:rPr", "a:defRPr", "a:endParaRPr")


#' Patron de un bloque de propiedades de texto, sin cruzar fronteras
#'
#' La apertura NO puede ser autocerrada (`<a:rPr/>` es legitimo y frecuente) y
#' el interior no puede contener otro `rPr`. Con un `.*?` a secas, un `<a:rPr/>`
#' vacio hacia que la captura se comiera hasta el cierre del SIGUIENTE bloque:
#' dos bloques correctos parecian uno desordenado —68 falsos positivos sobre el
#' entregable aprobado, que tiene cero— y el saneo habria reordenado elementos
#' de un bloque dentro de otro.
#'
#' @keywords internal
.ooxml_patron_bloque <- function(tag) {
  sprintf("(<%s\\b[^>]*(?<!/)>)((?:(?!</?%s[ />]).)*)(</%s>)", tag, tag, tag)
}


#' Reordena los tipos de letra de un bloque de propiedades de texto
#'
#' Trabaja sobre el contenido de UN `a:rPr`. Los cuatro elementos son vacios y
#' autocerrados, asi que se extraen y se reinsertan en la posicion del primero,
#' ya ordenados; el resto del bloque no se toca.
#'
#' @param interior Contenido entre `<a:rPr ...>` y `</a:rPr>`.
#' @return El mismo contenido con las fuentes en orden, o sin cambios si no hay
#'   nada que reordenar.
#' @keywords internal
.ooxml_ordenar_fuentes <- function(interior) {
  if (!is.character(interior) || length(interior) != 1L || is.na(interior)) {
    return(interior)
  }
  patron <- "<a:(latin|ea|cs|sym)\\b[^>]*/>"
  m <- gregexpr(patron, interior, perl = TRUE)[[1]]
  if (length(m) < 2L || m[[1]] == -1L) return(interior)

  trozos <- regmatches(interior, gregexpr(patron, interior, perl = TRUE))[[1]]
  nombres <- sub("^<a:([a-z]+).*$", "\\1", trozos)
  orden <- order(match(nombres, .OOXML_ORDEN_FUENTES))
  if (identical(orden, seq_along(trozos))) return(interior)

  # Se sustituyen en bloque: cada hueco recibe el elemento que le toca por
  # orden, de modo que el numero de elementos y el resto del texto no cambian.
  regmatches(interior, gregexpr(patron, interior, perl = TRUE)) <- list(trozos[orden])
  interior
}


#' Sanea el texto XML de una parte del paquete
#'
#' @param xml Texto XML completo de una parte.
#' @return El XML saneado.
#' @keywords internal
.ooxml_sanear_texto <- function(xml) {
  if (!is.character(xml) || length(xml) != 1L || is.na(xml)) return(xml)
  for (tag in .OOXML_TAGS_RPR) {
    patron <- .ooxml_patron_bloque(tag)
    m <- gregexpr(patron, xml, perl = TRUE)[[1]]
    if (m[[1]] == -1L) next
    bloques <- regmatches(xml, gregexpr(patron, xml, perl = TRUE))[[1]]
    nuevos <- vapply(bloques, function(b) {
      apertura <- sub(sprintf("^(<%s\\b[^>]*>).*$", tag), "\\1", b)
      cierre <- sprintf("</%s>", tag)
      interior <- substr(b, nchar(apertura) + 1L, nchar(b) - nchar(cierre))
      paste0(apertura, .ooxml_ordenar_fuentes(interior), cierre)
    }, character(1), USE.NAMES = FALSE)
    if (!identical(bloques, nuevos)) {
      regmatches(xml, gregexpr(patron, xml, perl = TRUE)) <- list(nuevos)
    }
  }
  xml
}


#' Cuenta las violaciones de orden que quedan en un .pptx
#'
#' Sirve de verificacion: despues de sanear tiene que dar cero, y el entregable
#' aprobado da cero.
#'
#' @param path Ruta al .pptx.
#' @return Numero de bloques con las fuentes fuera de orden.
#' @export
ppt_contar_fuentes_desordenadas <- function(path) {
  if (!file.exists(path)) return(NA_integer_)
  dir <- file.path(tempdir(), paste0("ooxml_check_", basename(tempfile(""))))
  on.exit(unlink(dir, recursive = TRUE), add = TRUE)
  utils::unzip(path, exdir = dir)

  partes <- list.files(dir, pattern = "\\.xml$", recursive = TRUE, full.names = TRUE)
  total <- 0L
  for (p in partes) {
    xml <- paste(readLines(p, warn = FALSE, encoding = "UTF-8"), collapse = "")
    for (tag in .OOXML_TAGS_RPR) {
      patron <- .ooxml_patron_bloque(tag)
      bloques <- regmatches(xml, gregexpr(patron, xml, perl = TRUE))[[1]]
      for (b in bloques) {
        trozos <- regmatches(b, gregexpr("<a:(latin|ea|cs|sym)\\b[^>]*/>", b, perl = TRUE))[[1]]
        if (length(trozos) < 2L) next
        nombres <- sub("^<a:([a-z]+).*$", "\\1", trozos)
        pos <- match(nombres, .OOXML_ORDEN_FUENTES)
        if (is.unsorted(pos)) total <- total + 1L
      }
    }
  }
  total
}


#' Sanea un .pptx ya escrito, en su sitio
#'
#' Degrada sin romper: si algo falla, el archivo original se queda como estaba.
#' Un mazo con el orden mal se abre —PowerPoint lo repara— y uno que no se
#' puede reescribir no se abre en absoluto.
#'
#' @param path Ruta al .pptx a sanear.
#' @return `TRUE` si se reescribio, `FALSE` si no hizo falta o no se pudo.
#' @export
ppt_sanear_ooxml <- function(path) {
  if (!is.character(path) || length(path) != 1L || !file.exists(path)) return(FALSE)

  tryCatch({
    dir <- file.path(tempdir(), paste0("ooxml_fix_", basename(tempfile(""))))
    on.exit(unlink(dir, recursive = TRUE), add = TRUE)
    # El ORDEN de las entradas del zip se conserva: PowerPoint espera
    # `[Content_Types].xml` al principio y rechaza el paquete si se reordena.
    # Con las entradas en orden alfabetico el archivo era XML valido, zip
    # integro... y PowerPoint no lo abria en absoluto.
    orden <- utils::unzip(path, list = TRUE)$Name
    utils::unzip(path, exdir = dir)

    partes <- list.files(dir, pattern = "\\.xml$", recursive = TRUE, full.names = TRUE)
    tocadas <- 0L
    for (p in partes) {
      xml <- paste(readLines(p, warn = FALSE, encoding = "UTF-8"), collapse = "")
      nuevo <- .ooxml_sanear_texto(xml)
      if (!identical(xml, nuevo)) {
        con <- file(p, open = "wb")
        writeBin(charToRaw(nuevo), con)
        close(con)
        tocadas <- tocadas + 1L
      }
    }
    if (tocadas == 0L) return(FALSE)

    # Se rearma el zip desde el directorio: `zip()` con rutas relativas para que
    # las partes conserven su ruta dentro del paquete.
    tmp_zip <- tempfile(fileext = ".pptx")
    wd <- getwd()
    on.exit(setwd(wd), add = TRUE)
    setwd(dir)
    archivos <- orden[file.exists(orden)]
    sueltos <- setdiff(
      list.files(".", recursive = TRUE, all.files = TRUE, no.. = TRUE),
      archivos
    )
    # `zip::zip` marca las entradas con data descriptor (flag 2056) y PowerPoint
    # rechaza el paquete entero: no lo abre ni reparandolo. El binario `zip` del
    # sistema escribe cabeceras completas, que es lo que espera.
    utils::zip(tmp_zip, c(archivos, sueltos), flags = "-q -X -D")
    setwd(wd)

    if (!file.exists(tmp_zip) || file.size(tmp_zip) < file.size(path) * 0.5) {
      return(FALSE)
    }
    file.copy(tmp_zip, path, overwrite = TRUE)
    TRUE
  }, error = function(e) FALSE)
}

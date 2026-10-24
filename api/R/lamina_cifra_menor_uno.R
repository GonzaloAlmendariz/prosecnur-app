# lamina_cifra_menor_uno.R — U5 (CCSS Perfil 2026, lámina 8): una cifra nativa que redondea a 0 con casos detrás.
#
# «Prefiero no responder» con 1 caso de 397 salía «0%» en la dona nativa, junto a «1 de 397 respuestas»: el lector lee
# que no hay nadie y al lado que hay uno. Una cifra que redondea a cero con casos se escribe «<1%» (o «<0.1%» con un
# decimal); sin casos sigue «0%». Sólo cambia el texto de la cifra: `valores`, casos, orden y base no se tocan.

#' Reescribe «0%» como «<1%» donde hay casos
#' @param cifras Cifras ya redondeadas («0%», «0.0%», «0% A»...).
#' @param casos Casos sin ponderar de cada cifra (mismo largo); sin casos no se reescribe nada.
#' @keywords internal
.lam_cifras_menor_uno <- function(cifras, casos) {
  cf <- as.character(cifras)
  n <- suppressWarnings(as.numeric(casos))
  if (!length(cf) || length(n) != length(cf)) return(cifras)
  m <- regmatches(cf, regexec("^0([.,])?(0*)(\\s?%)(.*)$", cf))
  for (i in seq_along(cf)) {
    p <- m[[i]]
    if (length(p) != 5L || is.na(n[i]) || !is.finite(n[i]) || n[i] <= 0) next
    dec <- if (nzchar(p[2])) paste0("0", p[2], strrep("0", max(0L, nchar(p[3]) - 1L)), "1") else "1"   # «0.0%» → «<0.1%»
    cf[i] <- paste0("<", dec, p[4], p[5])
  }
  cf
}

#' La espec categórica o circular con sus cifras de cero con casos en «<1%»
#' @keywords internal
.lam_espec_menor_uno <- function(espec) {
  if (!is.list(espec) || is.null(espec$cifras) || !espec$tipo %in% c("categorica", "pie")) return(espec)
  espec$cifras <- .lam_cifras_menor_uno(espec$cifras, .espec_casos(espec))
  espec
}

# lamina_grilla_bases_por_grafico.R — una lámina de varios gráficos no rotula como de todos una base que es de uno
#
# Ola 2, G8 / Q2 (captura «I. Cuatro gráficos con exclusión»): el pie decía «Base: 113 docentes» —la base de la apilada
# que excluye un grupo, la primera de la lámina— mientras las dos categóricas de abajo decían «115 respuestas». La
# compuerta que decide si las bases difieren (`.lam_grilla_bases_difieren`) sólo leía el n de la especificación, y una
# escala con cruce no lo trae (cada fila es un grupo): veía 115 y 115, concluía «misma base» y la base automática salía
# del primer gráfico. Además la nota «Excluye el grupo Principal.» del gráfico (`note_outside`) no llegaba al pie.
#
# Regla (la del motor, lamina_mixtas_base_principal.R, revisión v7.23 ítem 5): el n de cada gráfico es el de su «Base:»
# (casos válidos del gráfico, la misma cuenta que el pie de su lámina de un gráfico). Si difieren y los gráficos son del
# mismo público, el pie lleva la principal (la de mayor n) y cada panel cuyo n difiere dice su «N respuestas»; las notas
# de grupos excluidos van al pie.

#' n de la «Base:» de cada gráfico de la lámina (NA en las cifras y donde no se puede leer)
#' @param base_auto `function(els)` que arma la base automática del motor para una lista de elementos.
#' @return `list(frase, n)`, un elemento por gráfico.
#' @keywords internal
.lam_grilla_bases_por_grafico <- function(els, especs, base_auto) {
  k <- seq_along(especs)
  frase <- vapply(k, function(i) {
    e <- especs[[i]]
    if (is.null(e) || .lam_es_cifra(e) || i > length(els)) return(NA_character_)
    b <- tryCatch(base_auto(list(els[[i]])), error = function(err) NULL)
    if (is.null(b) || !length(b) || is.na(b[1]) || !nzchar(trimws(b[1]))) NA_character_ else trimws(as.character(b[1]))
  }, "")
  n <- vapply(k, function(i) {
    nb <- if (is.na(frase[i])) NA_real_ else .lam_base_principal_n(frase[i])
    if (is.finite(nb)) return(nb)
    e <- especs[[i]]
    if (is.null(e) || .lam_es_cifra(e)) NA_real_ else suppressWarnings(as.numeric(.espec_n_base(e))[1])
  }, 0)
  list(frase = frase, n = n)
}

#' Las notas de grupos excluidos de los gráficos (`note_outside` que empiezan con «Excluye»), sin repetir
#' @keywords internal
.lam_grilla_notas_exclusion <- function(rendered) {
  notas <- unlist(lapply(rendered, function(p) {
    x <- trimws(as.character(attr(p, "note_outside", exact = TRUE) %||% "")[1])
    if (is.na(x) || !grepl("Excluye", x, fixed = TRUE)) NULL else sub("^.*?(Excluye)", "\\1", x, perl = TRUE)
  }))
  unique(notas)
}

#' Los gráficos con el n de su base en la especificación cuando ésta no lo trae (escala con cruce), para que el panel
#' pueda decir su «N respuestas»
#' @keywords internal
.lam_grilla_con_n_panel <- function(rendered, n) {
  for (i in seq_along(rendered)) {
    e <- attr(rendered[[i]], "pulso_espec", exact = TRUE)
    if (is.null(e) || !identical(e$tipo, "escala") || i > length(n) || !is.finite(n[i])) next
    if (is.finite(suppressWarnings(as.numeric(.espec_n_base(e))[1]))) next
    e$n_base_casos <- n[i]
    attr(rendered[[i]], "pulso_espec") <- e
  }
  rendered
}

#' Une las bases de varios públicos en una sola frase: «Base: 115 docentes y 279 estudiantes» (Q5, ola 2)
#'
#' Sólo cuando todas son frases «Base: …» sin otra oración dentro; si no, se juntan como antes, con punto.
#' @keywords internal
.lam_bases_unir <- function(bases) {
  bases <- trimws(as.character(bases[!is.na(bases) & nzchar(trimws(bases))]))
  if (!length(bases)) return(NULL)
  resto <- sub("^Base:\\s*", "", sub("[.]\\s*$", "", bases))
  simples <- grepl("^Base:", bases) & !grepl("[.]", resto)
  if (length(bases) < 2L || !all(simples)) return(paste(bases, collapse = ". "))
  paste0("Base: ", .excluir_grupos_enumerar(resto))
}

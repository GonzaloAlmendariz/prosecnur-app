# =============================================================================
# estilo_negrita.R — negrita por elemento del informe entero (O8a, Identidad › Letra)
# =============================================================================
#
# Decisión de Gonzalo (2026-10-15, O8 de docs/qa/checklist-revamp-informe-graficos-2026-10-14.md): qué va en negrita se
# elige una vez para todo el informe, en la lámina nativa y en las figuras del Word. Contrato congelado:
#
#   estilo_cliente.letra.negrita = { titulos: bool, preguntas: bool, categorias: "mayor" | "todas" | "ninguna",
#                                    cifras: bool, box: bool, leyenda: bool, base: bool }
#
# Cada clave es opcional y su ausencia es lo de hoy. El valor por defecto NO es «negrita sí» en todas partes: hoy cada pieza
# trae su propia negrita (el subtítulo va plano, la categoría mayor en negrita y las demás no). Por eso la regla es:
#
# - Un rol con su valor por defecto (o ausente) deja la negrita que la pieza trae de fábrica: el informe sale idéntico.
# - Un rol que se aparta de su defecto la fuerza: `titulos = FALSE` quita la negrita a todos los títulos; `leyenda = TRUE`
#   la pone en toda la leyenda; `categorias = "todas"` / `"ninguna"` la pone o la quita a todas las categorías, y
#   `"mayor"` (el defecto) deja destacada sólo la mayor, como hoy.
#
# Transporte: el router resuelve el estilo (graficos_estilo_cliente.R) y el worker fija `options(prosecnur.negrita = .)`
# con `on.exit`; sin la opción todo sale como siempre. La lámina lo aplica en UN punto (`.lam_txt`, por el `nombre` de la
# pieza → rol, `.lam_rol_negrita`) y el Word en sus figuras con `.word_cara()`.

#' Valores por defecto de la negrita por elemento: lo que el informe hace hoy
#' @keywords internal
.NEGRITA_DEFECTO <- list(titulos = TRUE, preguntas = TRUE, categorias = "mayor", cifras = TRUE, box = TRUE, leyenda = FALSE,
                         base = TRUE)

#' Valores admitidos de `negrita.categorias`
#' @keywords internal
.NEGRITA_CATEGORIAS <- c("mayor", "todas", "ninguna")

#' Modos de la leyenda (O8b): `estilo_cliente.letra.leyenda`
#' @keywords internal
.LEYENDA_MODOS <- c("automatica", "una_fila", "dos_filas")

#' Valida `letra.negrita` y `letra.leyenda` (O8); lanza `E_BAD_ESTILO_CLIENTE` con lo que llegó
#'
#' Una clave desconocida dentro de `negrita` se conserva sin interpretar, como en el resto de `estilo_cliente` (§1).
#' @param l `estilo_cliente.letra` ya como lista.
#' @keywords internal
.negrita_validar_letra <- function(l) {
  if (!is.null(l$negrita)) {
    n <- .as_json_list(l$negrita)
    if (!.graficos_is_obj(n)) .ec_bad("«letra.negrita» debe ser un objeto.")
    for (k in intersect(names(n), names(.NEGRITA_DEFECTO))) {
      v <- n[[k]]
      if (is.null(v)) next
      if (identical(k, "categorias")) {
        if (!.ec_txt(v) %in% .NEGRITA_CATEGORIAS) {
          .ec_bad("«letra.negrita.categorias» debe ser ", paste(.NEGRITA_CATEGORIAS, collapse = ", "), "; llegó «", .ec_txt(v), "».")
        }
      } else if (!(is.logical(unlist(v)) && length(unlist(v)) == 1L && !is.na(unlist(v)))) {
        .ec_bad("«letra.negrita.", k, "» debe ser true o false.")
      }
    }
  }
  if (!is.null(l$leyenda) && !.ec_txt(l$leyenda) %in% .LEYENDA_MODOS) {
    .ec_bad("«letra.leyenda» debe ser ", paste(.LEYENDA_MODOS, collapse = ", "), "; llegó «", .ec_txt(l$leyenda), "».")
  }
  invisible(l)
}

#' Sólo lo que la negrita y la leyenda deciden distinto del defecto (ADR 0094: se guarda la diferencia)
#' @return `list(negrita = list(...)?, leyenda = chr?)` sin lo que coincide con el defecto.
#' @keywords internal
.negrita_solo_decisiones <- function(l) {
  out <- list()
  n <- .as_json_list(l$negrita)
  if (.graficos_is_obj(n) && length(n)) {
    keep <- list()
    for (k in names(n)) {
      v <- n[[k]]
      if (is.null(v)) next
      if (k %in% names(.NEGRITA_DEFECTO)) {
        v <- if (identical(k, "categorias")) .ec_txt(v) else isTRUE(unlist(v))
        if (identical(v, .NEGRITA_DEFECTO[[k]])) next
      }
      keep[[k]] <- v
    }
    if (length(keep)) out$negrita <- keep
  }
  ley <- .ec_txt(l$leyenda)
  if (nzchar(ley) && !identical(ley, "automatica")) out$leyenda <- ley
  out
}

#' Lo que el worker necesita de la negrita y la leyenda: sólo los roles que se apartan del defecto y el modo no automático
#' @return `list(negrita = list(rol = valor), leyenda = "una_fila")` sin lo vacío.
#' @keywords internal
.negrita_resolver <- function(letra) {
  letra <- .as_json_list(letra) %||% list()
  d <- tryCatch(.negrita_solo_decisiones(letra), error = function(e) list())   # ya validado: sólo por si llega crudo
  if (length(d$negrita)) d$negrita <- d$negrita[intersect(names(d$negrita), names(.NEGRITA_DEFECTO))]
  if (!length(d$negrita)) d$negrita <- NULL
  d
}

#' Negrita efectiva de una pieza de rol `rol` cuya negrita de fábrica es `defecto`
#'
#' Sin la opción `prosecnur.negrita` (o con el valor por defecto del rol) devuelve `defecto` tal cual: el informe sale como
#' hoy. Vectorizado en `defecto` (la categoría mayor viene como vector de la figura).
#' @param rol Uno de `names(.NEGRITA_DEFECTO)`.
#' @param defecto Negrita que la pieza trae de fábrica (lógico, escalar o vector).
#' @keywords internal
.std_negrita <- function(rol, defecto) {
  v <- (getOption("prosecnur.negrita") %||% list())[[rol]]
  if (is.null(v)) return(defecto)
  if (identical(rol, "categorias")) {
    v <- as.character(v)[1]
    if (identical(v, "todas")) return(rep(TRUE, length(defecto)))
    if (identical(v, "ninguna")) return(rep(FALSE, length(defecto)))
    return(defecto)
  }
  v <- isTRUE(as.logical(v)[1])
  if (identical(v, .NEGRITA_DEFECTO[[rol]])) defecto else rep(v, length(defecto))
}

#' ¿El rol va en negrita en TODAS sus piezas por decisión del usuario? Para medir el texto con la negrita que va a llevar
#'
#' Con el defecto devuelve `FALSE` y la medida es la de siempre (la categoría mayor ya se medía sin negrita).
#' @keywords internal
.std_negrita_forzada <- function(rol) isTRUE(all(.std_negrita(rol, FALSE)))

#' Modo de la leyenda vigente (`prosecnur.leyenda`), `"automatica"` si no se pidió otro
#' @keywords internal
.std_leyenda_modo <- function() {
  m <- as.character(getOption("prosecnur.leyenda") %||% "automatica")[1]
  if (m %in% .LEYENDA_MODOS) m else "automatica"
}

# ---- lámina nativa ------------------------------------------------------------------------------------------------------

#' Rol de negrita de una pieza de la lámina, por el `nombre` que le da el motor (`.lam_txt(..., nombre = )`)
#'
#' Una sola tabla para las ~270 llamadas de `lamina_*.R` (auditadas con el parser de R el 2026-10-15). Un nombre que no
#' cae en ningún rol (encabezados de columna, ejes, rótulos del mapa, narrativa) conserva su negrita de fábrica.
#' Precedencia: box antes que cifras (`box:cifra` es del box) y base antes que categorías (`:casos`).
#' @return El rol o `NA_character_`.
#' @keywords internal
.lam_rol_negrita <- function(nombre) {
  n <- as.character(nombre %||% "")[1]
  if (is.na(n) || !nzchar(n)) return(NA_character_)
  if (n %in% c("Titulo lamina", "Antetitulo lamina", "Subtitulo lamina", "objetivo:titulo") ||
      grepl("^(portada|seccion|indice|cierre):", n)) return("titulos")
  if (n %in% c("pregunta", "panel:pregunta", "premisa", "bloque:titulo", "divergentes:afirmacion")) return("preguntas")
  if (grepl("^(box2?|ttb):", n)) return("box")
  if (startsWith(n, "leyenda:")) return("leyenda")
  if (n %in% c("Base lamina", "panel:base", "n", "premisa:n", "respuestas", "ranking:respuestas", "otros:n") ||
      grepl(":casos$", n)) return("base")
  if (n %in% c("cifra", "cifra_fuera", "cifra:valor") ||
      grepl(":cifra(2|_a|_b|_inicial|_final|_sin_inf)?$", n) ||
      grepl("^divergentes:total_(acuerdo|desacuerdo)$", n)) return("cifras")
  if (n %in% c("rotulo", "actor", "escala:rotulo_fila", "comparativo:fila", "redondeo:categoria", "calor:fila", "ranking:palabra") ||
      grepl("^(dicotomia|circular|lollipop|dona|torta|numerico|boxplot|media_rango|pesas):rotulo$", n)) return("categorias")
  NA_character_
}

#' Negrita de una pieza de la lámina: la de fábrica (`bold`) salvo que el rol de su nombre la fuerce
#' @keywords internal
.lam_negrita <- function(nombre, bold) {
  if (is.null(getOption("prosecnur.negrita"))) return(bold)   # camino de siempre: ni se clasifica
  rol <- .lam_rol_negrita(nombre)
  if (is.na(rol)) bold else .std_negrita(rol, bold)
}

# ---- Word ---------------------------------------------------------------------------------------------------------------

#' `fontface` de un texto de figura Word de rol `rol` (`"bold"` / `"plain"`), con la negrita de fábrica `defecto`
#' @keywords internal
.word_cara <- function(rol, defecto = TRUE) ifelse(.std_negrita(rol, defecto), "bold", "plain")

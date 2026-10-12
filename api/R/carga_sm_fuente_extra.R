# carga_sm_fuente_extra.R — la fuente secundaria de una base trae preguntas que la base no tiene (F2b, Gonzalo
# 2026-10-11: «cuando a una base complementaria le agregan una variable adicional de identificación que la anterior
# base no requería porque era un recopilador por correo»).
#
# ADR 0099 (enmienda 2026-10-11): al AGREGAR una fuente a una base, sus preguntas sin par no se descartan. Antes de
# unirla, el formulario de la base se EXTIENDE con esas preguntas (copiadas del formulario que SurveyMonkey genera
# para la fuente, con sus opciones). Así la alineación por clave (etiqueta @@ escala) las encuentra en la base: en las
# filas de esa fuente llevan su respuesta y en las de las demás fuentes quedan vacías. La regla 3 del ADR sigue
# valiendo para el refresh de rutina: lo que no está en la base no entra; lo que cambia es que agregar una fuente
# declara sus preguntas nuevas en la base.

.carga_sm_col <- function(df, nm) if (nm %in% names(df)) as.character(df[[nm]]) else rep(NA_character_, NROW(df))

#' Une dos hojas con columnas distintas (las que falten quedan vacías)
#' @keywords internal
.carga_sm_bind_hojas <- function(a, b) {
  a <- as.data.frame(a, stringsAsFactors = FALSE, check.names = FALSE)
  b <- as.data.frame(b, stringsAsFactors = FALSE, check.names = FALSE)
  if (!NROW(b)) return(a)
  cols <- union(names(a), names(b))
  for (nm in setdiff(cols, names(a))) a[[nm]] <- rep(NA_character_, NROW(a))
  for (nm in setdiff(cols, names(b))) b[[nm]] <- rep(NA_character_, NROW(b))
  rbind(a[, cols, drop = FALSE], b[, cols, drop = FALSE])
}

#' El formulario de la base con las preguntas `extra` de la fuente al final, con nombres que no chocan
#'
#' @param base_form,fuente_form `list(survey, choices, settings)` (modelo XLSForm).
#' @param extra Nombres de variable EN LA FUENTE de las preguntas sin par.
#' @return `list(form, agregadas)`: el formulario extendido y un data.frame `fuente → base` con la etiqueta.
#' @keywords internal
.carga_sm_form_con_extra <- function(base_form, fuente_form, extra) {
  sv_b <- as.data.frame(base_form$survey, stringsAsFactors = FALSE, check.names = FALSE)
  sv_f <- as.data.frame(fuente_form$survey, stringsAsFactors = FALSE, check.names = FALSE)
  ch_b <- as.data.frame(base_form$choices %||% data.frame(), stringsAsFactors = FALSE, check.names = FALSE)
  ch_f <- as.data.frame(fuente_form$choices %||% data.frame(), stringsAsFactors = FALSE, check.names = FALSE)
  usados <- .carga_sm_col(sv_b, "name")
  listas_b <- unique(.carga_sm_col(ch_b, "list_name"))
  firma_lista <- function(ch, ln) {
    sel <- .carga_sm_col(ch, "list_name") == ln
    paste(.carga_sm_col(ch, "name")[sel], collapse = "|")
  }
  etiqueta_de <- function(fila) {
    cols <- grep("^label", names(fila), value = TRUE)
    for (c in cols) { x <- as.character(fila[[c]])[1]; if (!is.na(x) && nzchar(x)) return(x) }
    ""
  }
  libre <- function(nm) { nuevo <- nm; k <- 2L; while (nuevo %in% usados) { nuevo <- paste0(nm, "_f", k); k <- k + 1L }; nuevo }

  filas <- list(); opciones <- list(); agregadas <- list()
  for (v in extra) {
    i <- which(.carga_sm_col(sv_f, "name") == v)[1]
    if (is.na(i)) next
    nuevo <- libre(v)
    usados <- c(usados, nuevo)
    fila <- sv_f[i, , drop = FALSE]
    fila$name <- nuevo
    tipo <- as.character(fila$type)[1]
    m <- regmatches(tipo, regexec("^(select_one|select_multiple)\\s+(\\S+)(.*)$", tipo))[[1]]
    if (length(m) == 4L) {
      ln <- m[3]
      ln_nuevo <- ln
      if (ln %in% listas_b && !identical(firma_lista(ch_b, ln), firma_lista(ch_f, ln))) ln_nuevo <- paste0(ln, "_", nuevo)
      if (!(ln_nuevo %in% listas_b)) {
        op <- ch_f[.carga_sm_col(ch_f, "list_name") == ln, , drop = FALSE]
        op$list_name <- rep(ln_nuevo, NROW(op))
        opciones[[length(opciones) + 1L]] <- op
        listas_b <- c(listas_b, ln_nuevo)
      }
      fila$type <- paste0(m[2], " ", ln_nuevo, m[4])
    }
    filas[[length(filas) + 1L]] <- fila
    agregadas[[length(agregadas) + 1L]] <- data.frame(fuente = v, base = nuevo, etiqueta = etiqueta_de(fila),
                                                       stringsAsFactors = FALSE)
    # El «Otro (especifique)» viaja con su pregunta.
    j <- which(.carga_sm_col(sv_f, "name") == paste0(v, "_other"))[1]
    if (!is.na(j)) {
      otro <- sv_f[j, , drop = FALSE]
      otro$name <- libre(paste0(nuevo, "_other"))
      usados <- c(usados, otro$name)
      filas[[length(filas) + 1L]] <- otro
    }
  }
  form <- base_form
  for (f in filas) sv_b <- .carga_sm_bind_hojas(sv_b, f)
  for (o in opciones) ch_b <- .carga_sm_bind_hojas(ch_b, o)
  form$survey <- sv_b
  form$choices <- ch_b
  list(
    form = form,
    agregadas = if (length(agregadas)) do.call(rbind, agregadas) else data.frame(fuente = character(), base = character(), etiqueta = character())
  )
}

#' Lee un XLSForm a modelo `list(survey, choices, settings)`
#' @keywords internal
.carga_sm_leer_form <- function(path) {
  hojas <- openxlsx::getSheetNames(path)
  leer <- function(h) if (h %in% hojas) openxlsx::read.xlsx(path, sheet = h, colNames = TRUE, check.names = FALSE, sep.names = " ") else data.frame()
  list(survey = leer("survey"), choices = leer("choices"), settings = leer("settings"))
}

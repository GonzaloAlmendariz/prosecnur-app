# Ordenamiento de dummies de select_multiple para la vista "Base final" y el
# libro de códigos.
#
# Problema: las columnas dummy 0/1 de un select_multiple (`P.1`, `P.2`, …) se
# generan en la codificación en un orden arbitrario (p.ej. 2, 96, 7, 1, 5, …),
# no en el orden de la lista de opciones del XLSForm. Como todos los consumidores
# (base-sheet, codebook, frecuencias, …) preservan `names(data)`, ese desorden se
# arrastra a los entregables.
#
# Solución: reordenar, por cada select_multiple del instrumento, su bloque de
# dummies siguiendo el ORDEN DE LA LISTA DE OPCIONES (código de choice). No se
# cambia contenido ni cantidad de columnas: cada bloque se reubica completo en la
# posición de su primer miembro, como hace `reporte_data()` en su sección 7b. Se
# preserva el invariante madre↔dummies (las madres no se tocan) y no se ensucian
# los duplicados de madre con prefijo de grupo (p.ej. `d.d1_information`), que no
# matchean el prefijo `<parent>.` del bloque.

# ¿El código es un VALOR ESPECIAL? Estándar de valores especiales del proyecto
# (90 No aplica/perdido · 94 NS/NR · 95 No piensa votar · 96 Blanco/Viciado/Otro ·
# 97 No votó · 98 No sabe · 99 No responde): los códigos numéricos en el rango
# [80, 100) son valores especiales y, por defecto, van SIEMPRE al final del bloque
# de dummies, sin importar dónde los declare la lista del instrumento (a veces el
# 96 queda declarado a media lista y las categorías nuevas se agregan después).
# Sufijos no numéricos (`_otro`, `_text`) NO son especiales por esta regla.
.analitica_code_is_special <- function(code) {
  n <- suppressWarnings(as.numeric(as.character(code)))
  !is.na(n) && n >= 80 && n < 100
}

# Extrae el sufijo de código de un nombre de dummy (`<parent>.96` → "96",
# `<parent>___96` → "96", `<parent>.10` → "10", `<parent>___otro` → "otro").
# Toma lo que sigue al último separador de dummy (`___`, `.` o `/`); robusto a
# parents con `_` (p.ej. `D1_information_recod`).
.analitica_dummy_code_suffix <- function(col) {
  sub("^.*(?:___|[./])", "", as.character(col), perl = TRUE)
}

# Devuelve `data` con los bloques de dummies de cada select_multiple ordenados
# por el orden de choices del instrumento. Los dummies presentes que no
# corresponden a ninguna choice (códigos especiales no listados, `_otro`, …) se
# conservan al final del bloque en su orden actual.
.analitica_order_sm_dummy_cols <- function(data, inst) {
  if (!is.data.frame(data) || !length(names(data))) return(data)

  cat <- .analitica_catalogo(inst)
  if (nrow(cat) == 0L || !all(c("name", "tipo") %in% names(cat))) return(data)
  parents <- cat$name[cat$tipo == "select_multiple"]
  parents <- unique(parents[!is.na(parents) & nzchar(parents)])
  if (!length(parents)) return(data)

  # Preservar atributos top-level (instrumento_reporte, var_peso, …) que el
  # subsetting por columnas `[` descarta.
  top_attrs <- attributes(data)
  keep_attrs <- setdiff(names(top_attrs), c("names", "row.names", "class"))

  # Override de orden de categorías que el usuario fijó con las flechas en la UI
  # (`orden_categorias` → `orders_list`, keyed por variable con fallback a
  # list_name; cada entrada trae `$names` = códigos en el orden elegido). Si existe,
  # MANDA sobre el orden de choices del instrumento — así 96/"Otro" queda al final
  # si el usuario lo puso al final, incluso en la recodificada.
  orders_list <- (attr(data, "instrumento_reporte", exact = TRUE) %||% list())$orders_list %||%
    (inst %||% list())$orders_list %||% list()

  for (parent in parents) {
    current <- .analitica_data_dummy_cols_for_parent(names(data), parent)
    if (length(current) <= 1L) next

    ln <- .analitica_list_name_for_var(inst, parent)
    ord_entry <- orders_list[[parent]] %||%
      (if (nzchar(ln)) orders_list[[ln]] else NULL)
    override_codes <- as.character(ord_entry$names %||% character(0))
    override_codes <- override_codes[!is.na(override_codes) & nzchar(override_codes)]

    if (length(override_codes)) {
      codes <- override_codes
    } else {
      choices <- if (nzchar(ln)) .choices_desde_instrumento(inst, ln) else NULL
      codes <- if (!is.null(choices) && nrow(choices)) as.character(choices$name) else character(0)
      codes <- codes[!is.na(codes) & nzchar(codes)]
    }
    if (!length(codes)) next

    ordered <- character(0)
    for (code in codes) {
      col <- .analitica_find_dummy_col(current, parent, code)
      if (!is.na(col) && nzchar(col) && col %in% current && !col %in% ordered) {
        ordered <- c(ordered, col)
      }
    }
    # Dummies presentes que no matchean ninguna choice (códigos recodificados
    # ausentes del instrumento, `_otro`, …): al final del bloque. Si todos sus
    # sufijos son numéricos, se ordenan ascendentemente para que queden prolijos.
    leftover <- setdiff(current, ordered)
    if (length(leftover) > 1L) {
      suf <- suppressWarnings(as.numeric(sub(".*\\.", "", leftover)))
      if (!any(is.na(suf))) leftover <- leftover[order(suf)]
    }
    ordered <- c(ordered, leftover)

    # Pase FINAL (estándar de valores especiales): mover al final del bloque,
    # preservando su orden relativo, todos los dummies cuyo código sea especial
    # [80,100). Se aplica sobre el `ordered` ya resuelto (choices/override +
    # leftover), así que es robusto incluso cuando el usuario fijó 96 al final con
    # las flechas ANTES de que existieran las categorías nuevas (9-12): esas
    # entran como leftover y sin este pase quedarían DESPUÉS del 96.
    if (length(ordered) > 1L) {
      is_special <- vapply(
        .analitica_dummy_code_suffix(ordered),
        .analitica_code_is_special, logical(1), USE.NAMES = FALSE
      )
      if (any(is_special) && !all(is_special)) {
        ordered <- c(ordered[!is_special], ordered[is_special])
      }
    }

    # Salvaguardas: no perder/duplicar columnas y no trabajar de más.
    if (length(ordered) != length(current)) next
    if (identical(ordered, current)) next

    # Reinsertar el bloque completo en la posición de su primer miembro.
    cols_old <- names(data)
    cols_new <- character(0)
    inserted <- FALSE
    for (nm in cols_old) {
      if (nm %in% ordered) {
        if (!inserted) {
          cols_new <- c(cols_new, ordered)
          inserted <- TRUE
        }
        # duplicados del bloque ya insertado: saltar
      } else {
        cols_new <- c(cols_new, nm)
      }
    }
    if (length(cols_new) == length(cols_old)) {
      data <- data[, cols_new, drop = FALSE]
    }
  }

  for (nm in keep_attrs) attr(data, nm) <- top_attrs[[nm]]
  data
}

# Reordena las columnas de `data` al ORDEN CANÓNICO del instrumento (recorriendo
# `inst$survey$name`). Motivo: al codificar, los bloques de dummies de un
# select_multiple (`D1_information.1`, …, `D1_information.96`) se apendean al FINAL
# de la base y, como la columna madre plana `D1_information` ya no existe, nunca
# vuelven a su sección del survey. `.analitica_order_sm_dummy_cols` solo ordena
# DENTRO del bloque; este helper reubica el BLOQUE ENTERO a la posición que el
# parent ocupa en el instrumento.
#
# Contrato:
#   - Recorre `inst$survey$name` en orden. Para cada nombre:
#       * si es parent de select_multiple: emite la madre plana `<parent>` (si
#         existe) seguida de su bloque `<parent>.*` completo, preservando el
#         orden interno que dejó `.analitica_order_sm_dummy_cols`.
#       * si no, emite la columna si existe.
#   - Columnas de `data` que NO están en el survey (derivadas `kobo_*`, metadata
#     `_uuid`/`_submission_time`/`start`/`end`/`today`, tags internos, …) van al
#     FINAL, en su orden original. No se pierde ni se duplica ninguna columna.
#   - Guardrails idénticos a los helpers hermanos: preserva atributos top-level;
#     si el set objetivo ≠ set actual (perdería/duplicaría), devuelve `data` sin
#     tocar; no-op si `identical(objetivo, actual)`. Idempotente y no-op sin
#     `inst$survey`.
.analitica_order_by_instrument <- function(data, inst) {
  if (!is.data.frame(data) || !length(names(data))) return(data)
  survey <- (inst %||% list())$survey
  if (is.null(survey) || !("name" %in% names(survey))) return(data)
  sv <- as.character(survey$name)
  sv <- sv[!is.na(sv) & nzchar(sv)]
  if (!length(sv)) return(data)

  cat <- .analitica_catalogo(inst)
  sm_parents <- if (nrow(cat) && all(c("name", "tipo") %in% names(cat))) {
    unique(cat$name[cat$tipo == "select_multiple"])
  } else character(0)
  sm_parents <- sm_parents[!is.na(sm_parents) & nzchar(sm_parents)]

  cols <- names(data)
  target <- character(0)
  consumed <- stats::setNames(rep(FALSE, length(cols)), cols)

  emit <- function(nm) {
    if (nm %in% cols && isFALSE(consumed[[nm]])) {
      target[[length(target) + 1L]] <<- nm
      consumed[[nm]] <<- TRUE
    }
  }

  for (nm in sv) {
    if (nm %in% sm_parents) {
      # Madre plana primero (si sobrevivió), luego el bloque de dummies completo
      # en su orden actual (ya ordenado por choices por el helper hermano).
      emit(nm)
      block <- .analitica_data_dummy_cols_for_parent(cols, nm)
      for (b in block) emit(b)
    } else {
      emit(nm)
    }
  }

  # Columnas no cubiertas por el survey: al final, en su orden original.
  leftover <- cols[!vapply(cols, function(c) isTRUE(consumed[[c]]), logical(1))]
  target <- c(unlist(target, use.names = FALSE), leftover)

  # Salvaguardas: no perder/duplicar columnas y no trabajar de más.
  if (length(target) != length(cols) || !setequal(target, cols)) return(data)
  if (identical(target, cols)) return(data)

  top_attrs <- attributes(data)
  keep_attrs <- setdiff(names(top_attrs), c("names", "row.names", "class"))
  data <- data[, target, drop = FALSE]
  for (nm in keep_attrs) attr(data, nm) <- top_attrs[[nm]]
  data
}

# Restaura el case de las columnas al del `survey` del instrumento. La
# codificación deja los nombres y dummies en minúscula (`d1_information.1`,
# `d1_information_recod.2`) mientras el survey usa el case original
# (`D1_information`). Frecuencias y cruces buscan las columnas/dummies
# case-sensitive contra el survey, así que sin este alineamiento SALTAN los
# select_multiple y sus recodificadas (no aparecen en las tablas). Renombra
# `<stem>` y `<stem>.<code>` al case del survey cuando coinciden case-insensitive;
# no toca duplicados con prefijo de grupo (`d.d1_information`, cuyo stem no
# matchea ninguna variable del survey) ni pisa una columna ya existente.
.analitica_restore_survey_case <- function(data, inst) {
  if (!is.data.frame(data) || !length(names(data))) return(data)
  survey <- (inst %||% list())$survey
  if (is.null(survey) || !("name" %in% names(survey))) return(data)
  sv <- as.character(survey$name)
  sv <- sv[!is.na(sv) & nzchar(sv)]
  if (!length(sv)) return(data)
  canon <- sv[!duplicated(tolower(sv))]
  canon_lower <- tolower(canon)
  lookup <- function(x) { idx <- match(tolower(x), canon_lower); if (is.na(idx)) NULL else canon[idx] }

  cur <- names(data)
  new <- cur
  for (i in seq_along(cur)) {
    col <- cur[i]
    proposed <- NULL
    # dummy `<stem>.<code>`: recasear el stem si matchea un nombre del survey.
    m <- regmatches(col, regexec("^(.+)\\.([^.]+)$", col))[[1]]
    if (length(m) == 3L) {
      hit <- lookup(m[[2]])
      if (!is.null(hit) && !identical(m[[2]], hit)) proposed <- paste0(hit, ".", m[[3]])
    }
    # columna plana: recasear si matchea (case-insensitive) un nombre del survey.
    if (is.null(proposed)) {
      hit <- lookup(col)
      if (!is.null(hit) && !identical(col, hit)) proposed <- hit
    }
    if (!is.null(proposed) && !(proposed %in% cur) && !(proposed %in% new[-i])) {
      new[i] <- proposed
    }
  }
  if (!identical(new, cur)) names(data) <- new
  data
}

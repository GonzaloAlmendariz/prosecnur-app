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

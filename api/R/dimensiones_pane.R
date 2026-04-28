# ============================================================
# Helpers para el tab "Dimensiones" del módulo Analítica.
#
# Detección, validación, persistencia y construcción de dimensiones
# (recodificación 0-100 + sub-índices + índices jerárquicos), apoyándose
# en las funciones públicas del paquete prosecnur:
#   - reporte_dimensiones()           : recodifica items a 0-100.
#   - subindice() / indice()          : constructores.
#   - reporte_dimensiones_indices()   : promedia jerárquicamente.
#   - reporte_dimensiones_config()    : catálogo + semáforo.
#
# Convención de naming:
#   - "subindice" en el dominio R == "bloque" en la UI (mismo concepto).
#     La UI llama "bloque" porque es más intuitivo para usuarios sin
#     familiaridad con jerga estadística; la API conserva ambos términos
#     (alias) para no forzar al usuario a aprender la terminología R.
# ============================================================

# Listas de respuestas que típicamente representan escalas ordinales
# evaluativas (susceptibles de recodificarse a 0-100). Tomado del qmd
# canónico GIZ; cualquier proyecto puede ampliar/reducir esto desde la UI.
.dimensiones_listas_objetivo_default <- function() {
  c(
    "satisfaccion", "acuerdo", "oportunidad", "info_disponible",
    "flex_horario", "canales", "prioridad", "acceso_local", "senal",
    "si_parcial_no", "si_masmenos_no", "equip",
    "si_nosabe", "parcialnosabe", "masmenosnosabe",
    "recomendable", "recuerda_parcialnosabe", "recuerda_masmenosnosabe",
    "si_no"
  )
}

# Default config que la UI hidrata si el proyecto no tiene config previa.
# Mismo patrón que `.analitica_default_config()` en router_analitica.R.
.dimensiones_default_config <- function() {
  list(
    listas_objetivo = as.list(.dimensiones_listas_objetivo_default()),
    excluir_vars = list("consent"),
    orden_por_lista = list(),
    codigos_missing = as.list(c("75", "88", "90")),
    codigos_no_aplica = list(),
    prefijo = "r100_",
    subcriterios = list(),
    subindices = list(),
    indices = list(),
    semaforo = list(
      cortes = as.list(c(60L, 80L)),
      colores = list(rojo = "#D84B55", ambar = "#E0B44C", verde = "#3A9A5B")
    ),
    radar = list(
      paleta = "okabe_ito",
      min_ejes = 3L
    ),
    labels_indices = list(),
    labels_subindices = list()
  )
}

# Detecta variables select_one cuyo list_name coincide con las listas
# objetivo configuradas. Es la lógica del qmd línea 620-625, expuesta
# como helper reutilizable.
#
# Para cada lista detectada incluye también las CHOICES (código + label
# humano + orden alfanumérico tentativo). Esto alimenta al Step 2 del
# wizard, que deja al usuario:
#   - Reordenar los códigos para definir la dirección 0-100 ascendente.
#   - Marcar códigos especiales (missing / no aplica) por lista.
.dimensiones_detectar_escalas <- function(rp_inst, listas_objetivo = NULL) {
  defaults <- .dimensiones_listas_objetivo_default()
  if (is.null(listas_objetivo) || !length(listas_objetivo)) {
    listas_objetivo <- defaults
  }
  listas_objetivo <- as.character(unlist(listas_objetivo))

  sv <- rp_inst$survey
  if (is.null(sv) || !nrow(sv)) return(list())

  # Resolver list_name por fila del survey: preferimos `survey$list_name`
  # cuando está poblado (parsers modernos), si está vacío caemos al parse
  # del campo `type` ("select_one foo" → "foo"). Sin esto, instrumentos
  # cuyo parser dejó list_name como NA aparecían sin escalas.
  tipos <- as.character(sv$type %||% "")
  is_so <- grepl("^select_one(\\s|$)", tipos)
  list_names_attr <- as.character(sv$list_name %||% "")
  list_names_parsed <- trimws(sub("^\\S+\\s*", "", tipos))
  list_names <- ifelse(
    !is.na(list_names_attr) & nzchar(list_names_attr),
    list_names_attr,
    list_names_parsed
  )

  ch <- rp_inst$choices
  has_choices <- is.data.frame(ch) && all(c("list_name", "name") %in% names(ch))

  # Resolver columna de label en las choices (label, label::Spanish, etc.).
  choices_label_col <- NA_character_
  if (has_choices) {
    cands <- grep("^label", tolower(names(ch)), value = TRUE)
    if (length(cands) > 0L) {
      sp <- grep("spanish|español", tolower(cands))
      pick <- if (length(sp) > 0L) cands[sp[1]] else cands[1]
      # Match al nombre real (case-sensitive del data.frame).
      orig <- names(ch)[match(pick, tolower(names(ch)))]
      choices_label_col <- orig
    }
  }

  # Devolvemos TODAS las listas select_one del instrumento, no solo las
  # que coincidan con el whitelist evaluativo estándar. La UI marca con
  # `es_default_evaluativa = TRUE` las que sí coinciden (para que Step 2
  # las pre-active automáticamente) y permite al usuario activar las
  # otras manualmente. Esto evita que estudios con nombres custom
  # ("calidad_servicio_5pts", "satis_likert") aparezcan vacíos.
  listas_inst <- unique(list_names[is_so & !is.na(list_names) & nzchar(list_names)])
  todas <- unique(c(listas_inst, listas_objetivo))

  out <- list()
  for (lista in todas) {
    keep <- is_so & list_names == lista
    if (!any(keep)) next
    vars <- unique(as.character(sv$name[keep]))
    vars <- vars[!is.na(vars) & nzchar(vars)]
    if (!length(vars)) next

    choices_lista <- list()
    if (has_choices) {
      idx <- which(as.character(ch$list_name) == lista)
      if (length(idx)) {
        codes <- as.character(ch$name[idx])
        labels <- if (!is.na(choices_label_col)) as.character(ch[[choices_label_col]][idx])
                  else codes
        labels[is.na(labels)] <- ""
        Encoding(labels) <- "UTF-8"
        # Orden tentativo: numérico ascendente cuando los códigos son
        # numéricos, si no alfabético. NO impone semántica — el usuario
        # decide la dirección 0→100 en el wizard.
        orden_num <- suppressWarnings(as.numeric(codes))
        orden_idx <- if (all(!is.na(orden_num))) order(orden_num) else order(codes)
        codes <- codes[orden_idx]
        labels <- labels[orden_idx]
        choices_lista <- lapply(seq_along(codes), function(k) {
          list(code = codes[k], label = labels[k])
        })
      }
    }

    out[[lista]] <- list(
      list_name = lista,
      n = length(vars),
      vars = as.list(vars),
      choices = choices_lista,
      es_default_evaluativa = lista %in% defaults
    )
  }
  out
}

# Sugiere bloques iniciales a partir de los `begin_group/end_group` del
# XLSForm. Heurística: cada grupo cuyas vars son select_one en alguna
# de las listas evaluativas → un bloque candidato con el label del grupo
# como etiqueta. Pensado para el Step 3 del wizard (botón "Sugerir
# desde el instrumento") cuando el usuario arranca desde cero.
.dimensiones_sugerir_bloques <- function(rp_inst, listas_objetivo = NULL) {
  if (is.null(listas_objetivo) || !length(listas_objetivo)) {
    listas_objetivo <- .dimensiones_listas_objetivo_default()
  }
  listas_objetivo <- as.character(unlist(listas_objetivo))

  sv <- rp_inst$survey
  if (is.null(sv) || !nrow(sv)) return(list())

  # Resolver labels en español (igual que .detect_secciones_analitica
  # usa `survey_raw$label::Spanish` cuando existe).
  label_raw <- rep("", nrow(sv))
  if (!is.null(rp_inst$survey_raw)) {
    lab_idx <- grep("^label", tolower(names(rp_inst$survey_raw)))
    if (length(lab_idx) > 0L) {
      sp_idx <- grep("spanish|español", tolower(names(rp_inst$survey_raw)[lab_idx]))
      pick <- if (length(sp_idx) > 0L) lab_idx[sp_idx[1]] else lab_idx[1]
      lab_col <- as.character(rp_inst$survey_raw[[pick]])
      if (length(lab_col) == nrow(sv)) label_raw <- lab_col
    }
  }
  if (all(label_raw == "") && "label" %in% names(sv)) label_raw <- as.character(sv$label)
  label_raw[is.na(label_raw)] <- ""
  Encoding(label_raw) <- "UTF-8"

  is_so <- grepl("^select_one(\\s|$)", as.character(sv$type %||% ""))
  list_names <- as.character(sv$list_name %||% "")
  es_evaluativa <- is_so & list_names %in% listas_objetivo

  # Walk del survey: stack de groups activos. Para cada variable
  # evaluativa, anota el group más interno actual.
  stack_name <- character(0)
  stack_label <- character(0)
  por_grupo <- list()  # nombre_grupo -> list(label, vars)

  for (i in seq_len(nrow(sv))) {
    t <- as.character(sv$type[i] %||% "")
    nm <- as.character(sv$name[i] %||% "")
    lb <- label_raw[i]
    if (t == "begin_group" || t == "begin_repeat") {
      stack_name <- c(stack_name, nm)
      stack_label <- c(stack_label, if (nzchar(lb)) lb else nm)
    } else if (t == "end_group" || t == "end_repeat") {
      if (length(stack_name) > 0L) {
        stack_name <- stack_name[-length(stack_name)]
        stack_label <- stack_label[-length(stack_label)]
      }
    } else if (es_evaluativa[i] && nzchar(nm)) {
      grupo_id <- if (length(stack_name) > 0L) stack_name[length(stack_name)] else "general"
      grupo_lb <- if (length(stack_label) > 0L) stack_label[length(stack_label)] else "General"
      if (is.null(por_grupo[[grupo_id]])) {
        por_grupo[[grupo_id]] <- list(label = grupo_lb, vars = character(0))
      }
      por_grupo[[grupo_id]]$vars <- c(por_grupo[[grupo_id]]$vars, nm)
    }
  }

  # Filtrar grupos con al menos 2 vars (los singleton no son "bloques temáticos").
  bloques <- list()
  for (id in names(por_grupo)) {
    g <- por_grupo[[id]]
    if (length(g$vars) < 2L) next
    bloques[[length(bloques) + 1L]] <- list(
      nombre = id,
      etiqueta = g$label,
      vars = as.list(unique(g$vars))
    )
  }
  bloques
}

# Cruza un JSON tipo `dimensiones_giz.analitica.json` contra el
# instrumento del proyecto activo y reporta coincidencias / faltantes.
# Pensado para el flujo "Confirmar contra instrumento" del Step 1: el
# usuario sube un JSON y el wizard muestra qué piezas se aplicarán y
# cuáles requieren intervención.
#
# Input esperado (subset relevante):
#   { config: {
#       dimensiones: {
#         listas_objetivo: [...],
#         subindices: [{nombre, etiqueta, vars: [...]}, ...],
#         indices: [{nombre, etiqueta, subindices: [...]}, ...]
#       } } }
#
# Output:
#   list(
#     listas = list(coincidentes = c(...), faltantes = c(...)),
#     subindices = list(<nombre>, ok = TRUE/FALSE,
#                       vars_ok = c(...), vars_faltantes = c(...)),
#     indices = list(<nombre>, ok = TRUE/FALSE,
#                    subindices_ok = c(...), subindices_faltantes = c(...)),
#     resumen = list(n_listas_ok, n_listas_faltantes,
#                    n_vars_ok, n_vars_faltantes,
#                    n_subindices_ok_completos, n_subindices_parciales,
#                    n_indices_ok_completos, n_indices_parciales)
#   )
.dimensiones_validar_contra_instrumento <- function(json_config, rp_inst) {
  cfg <- json_config$config %||% json_config
  dim <- cfg$dimensiones %||% list()
  if (!length(dim)) {
    stop_api(400, "E_JSON_SIN_DIMENSIONES",
      "El JSON no contiene la sección `config.dimensiones`. ¿Es un export válido de Analítica?")
  }

  sv <- rp_inst$survey
  if (is.null(sv) || !nrow(sv)) {
    stop_api(409, "E_NO_INSTRUMENTO",
      "No hay instrumento cargado para validar.")
  }

  # ---------- Listas evaluativas ----------
  # "Coincidentes" = listas que el JSON nombra Y que el instrumento usa.
  # "No usadas en este estudio" = listas declaradas en el JSON que tu
  # instrumento no referencia. NO es un error — simplemente no aplica
  # para este instrumento. La etiqueta UI lo refleja como informativo.
  listas_json <- as.character(unlist(dim$listas_objetivo %||% list()))
  listas_inst <- unique(as.character(sv$list_name %||% character(0)))
  listas_inst <- listas_inst[!is.na(listas_inst) & nzchar(listas_inst)]
  listas_ok <- intersect(listas_json, listas_inst)
  listas_no_usadas <- setdiff(listas_json, listas_inst)

  # ---------- Variables del instrumento ----------
  vars_inst <- as.character(sv$name %||% character(0))
  vars_inst <- vars_inst[!is.na(vars_inst) & nzchar(vars_inst)]
  vars_inst_set <- unique(vars_inst)

  prefijo <- as.character(dim$prefijo %||% "r100_")[1]
  if (!nzchar(prefijo)) prefijo <- "r100_"

  # ---------- Subcriterios promediados ----------
  # Vars como `r100_p17_prom` no existen en el XLSForm: son derivadas que
  # el pipeline crea promediando varias vars crudas (p17 + p17.1). Las
  # reconocemos pre-computando un set de "subcriterios resolubles" — los
  # que cuyas fuentes existen completamente en el instrumento.
  # Cada subcriterio tiene una `etiqueta` humana ("Diligencia", "Confort",
  # …) que usamos en UI y como label de la columna generada al construir.
  subcriterios_json <- dim$subcriterios %||% list()
  subcriterios_resueltos <- character(0)
  subcriterios_meta <- list()  # nombre_sin_prefijo -> list(etiqueta, fuente, ok)
  for (sc in subcriterios_json) {
    nombre_raw <- sub(paste0("^", prefijo), "", as.character(sc$nombre %||% ""))
    if (!nzchar(nombre_raw)) next
    etiqueta <- as.character(sc$etiqueta %||% "")
    if (!nzchar(etiqueta)) etiqueta <- nombre_raw
    fuente_raw <- sub(paste0("^", prefijo), "",
                      as.character(unlist(sc$fuente %||% list())))
    fuente_ok <- length(fuente_raw) > 0L && all(fuente_raw %in% vars_inst_set)
    subcriterios_meta[[nombre_raw]] <- list(
      etiqueta = etiqueta,
      fuente = as.list(fuente_raw),
      ok = fuente_ok
    )
    if (fuente_ok) subcriterios_resueltos <- c(subcriterios_resueltos, nombre_raw)
  }

  # Una var del JSON está disponible si:
  #   • Existe directo en el instrumento (preferido), O
  #   • Es un subcriterio cuyas fuentes están completas.
  resolver_var <- function(v) {
    crudo <- sub(paste0("^", prefijo), "", as.character(v))
    es_directo <- crudo %in% vars_inst_set
    es_derivado <- crudo %in% subcriterios_resueltos
    list(
      crudo = crudo,
      presente = es_directo || es_derivado,
      tipo = if (es_directo) "directo"
             else if (es_derivado) "derivado"
             else if (crudo %in% names(subcriterios_meta)) "derivado_incompleto"
             else "ausente"
    )
  }

  subindices_json <- dim$subindices %||% list()
  subindices_out <- vector("list", length(subindices_json))
  for (i in seq_along(subindices_json)) {
    s <- subindices_json[[i]]
    vars_json <- as.character(unlist(s$vars %||% list()))
    chequeos <- lapply(vars_json, resolver_var)
    crudos <- vapply(chequeos, function(x) x$crudo, character(1))
    presentes <- vapply(chequeos, function(x) x$presente, logical(1))
    subindices_out[[i]] <- list(
      nombre = as.character(s$nombre %||% ""),
      etiqueta = as.character(s$etiqueta %||% s$nombre %||% ""),
      vars_solicitadas = as.list(crudos),
      vars_ok = as.list(crudos[presentes]),
      vars_faltantes = as.list(crudos[!presentes]),
      ok = all(presentes) && length(presentes) > 0L,
      n_solicitadas = length(presentes),
      n_ok = sum(presentes)
    )
  }

  # Índices: cada uno referencia sub-índices definidos arriba.
  nombres_subindices <- vapply(subindices_out, function(x) x$nombre, character(1))
  subindices_ok_set <- nombres_subindices[
    vapply(subindices_out, function(x) x$ok, logical(1))
  ]
  indices_json <- dim$indices %||% list()
  indices_out <- vector("list", length(indices_json))
  for (i in seq_along(indices_json)) {
    idx <- indices_json[[i]]
    subs_solicitados <- as.character(unlist(idx$subindices %||% list()))
    presentes <- subs_solicitados %in% subindices_ok_set
    indices_out[[i]] <- list(
      nombre = as.character(idx$nombre %||% ""),
      etiqueta = as.character(idx$etiqueta %||% idx$nombre %||% ""),
      subindices_solicitados = as.list(subs_solicitados),
      subindices_ok = as.list(subs_solicitados[presentes]),
      subindices_faltantes = as.list(subs_solicitados[!presentes]),
      ok = all(presentes) && length(presentes) > 0L
    )
  }

  total_vars_ok <- sum(vapply(subindices_out, function(x) x$n_ok, integer(1)))
  total_vars_solicitadas <- sum(vapply(subindices_out, function(x) x$n_solicitadas, integer(1)))

  # Reporte de subcriterios para que la UI pueda explicar al usuario qué
  # vars derivadas se materializarán al construir.
  subcriterios_out <- lapply(names(subcriterios_meta), function(nm) {
    m <- subcriterios_meta[[nm]]
    list(
      nombre = nm,
      etiqueta = as.character(m$etiqueta %||% nm),
      fuente = m$fuente,
      ok = isTRUE(m$ok),
      vars_fuente_faltantes = if (isTRUE(m$ok)) list()
                              else as.list(setdiff(unlist(m$fuente), vars_inst_set))
    )
  })

  list(
    listas = list(
      coincidentes = as.list(listas_ok),
      no_usadas = as.list(listas_no_usadas)
    ),
    subindices = subindices_out,
    indices = indices_out,
    subcriterios = subcriterios_out,
    resumen = list(
      n_listas_ok = length(listas_ok),
      n_listas_no_usadas = length(listas_no_usadas),
      n_vars_ok = total_vars_ok,
      n_vars_faltantes = total_vars_solicitadas - total_vars_ok,
      n_subindices_completos = sum(vapply(subindices_out, function(x) x$ok, logical(1))),
      n_subindices_parciales = sum(vapply(subindices_out, function(x) !x$ok && x$n_ok > 0L, logical(1))),
      n_indices_completos = sum(vapply(indices_out, function(x) x$ok, logical(1))),
      n_indices_parciales = sum(vapply(indices_out, function(x) !x$ok && length(x$subindices_ok) > 0L, logical(1))),
      n_subcriterios_resueltos = sum(vapply(subcriterios_out, function(x) x$ok, logical(1))),
      n_subcriterios_incompletos = sum(vapply(subcriterios_out, function(x) !x$ok, logical(1)))
    )
  )
}

# Detecta si la base ya tiene columnas r100_* / sub_* / idx_*, lo que
# indica que el proyecto ya pasó por una recodificación + construcción
# de dimensiones (típico cuando se carga una base derivada del qmd).
# Si lee atributos `dimensiones_config` o `indices_meta`, los expone para
# que la UI pueda hidratar la config sin rehacer el trabajo.
.dimensiones_detectar_base_existente <- function(rp_data) {
  cols <- names(rp_data)
  vars_r100 <- grep("^r100_", cols, value = TRUE)
  vars_sub  <- grep("^sub_",  cols, value = TRUE)
  vars_idx  <- grep("^idx_",  cols, value = TRUE)

  has_dim <- length(vars_r100) > 0L || length(vars_idx) > 0L
  if (!has_dim) {
    return(list(detected = FALSE))
  }

  cfg_attr <- attr(rp_data, "dimensiones_config", exact = TRUE)
  meta_attr <- attr(rp_data, "indices_meta", exact = TRUE)

  list(
    detected = TRUE,
    n_r100 = length(vars_r100),
    n_sub = length(vars_sub),
    n_idx = length(vars_idx),
    vars_r100 = as.list(vars_r100),
    vars_sub = as.list(vars_sub),
    vars_idx = as.list(vars_idx),
    has_config_attr = !is.null(cfg_attr),
    has_indices_meta = !is.null(meta_attr)
  )
}

# Convierte la sub-config de subindices (lista de objetos plain JSON)
# a una lista de objetos `subindice()` listos para
# reporte_dimensiones_indices(). Devuelve `NULL` si no hay nada.
.dimensiones_build_subindices <- function(cfg_subindices) {
  if (!length(cfg_subindices)) return(NULL)
  out <- vector("list", length(cfg_subindices))
  for (i in seq_along(cfg_subindices)) {
    s <- cfg_subindices[[i]]
    nombre <- as.character(s$nombre %||% "")
    etiqueta <- as.character(s$etiqueta %||% nombre)
    vars <- as.character(unlist(s$vars %||% list()))
    if (!nzchar(nombre) || !length(vars)) {
      stop_api(422, "E_DIM_SUBINDICE_INVALIDO",
        sprintf("Sub-índice (bloque) #%d inválido: requiere `nombre` y al menos una variable.", i))
    }
    out[[i]] <- subindice(nombre = nombre, etiqueta = etiqueta, vars = vars)
  }
  out
}

.dimensiones_build_indices <- function(cfg_indices) {
  if (!length(cfg_indices)) return(NULL)
  out <- vector("list", length(cfg_indices))
  for (i in seq_along(cfg_indices)) {
    idx <- cfg_indices[[i]]
    nombre <- as.character(idx$nombre %||% "")
    etiqueta <- as.character(idx$etiqueta %||% nombre)
    subs <- as.character(unlist(idx$subindices %||% list()))
    if (!nzchar(nombre) || !length(subs)) {
      stop_api(422, "E_DIM_INDICE_INVALIDO",
        sprintf("Índice #%d inválido: requiere `nombre` y al menos un sub-índice.", i))
    }
    out[[i]] <- indice(nombre = nombre, etiqueta = etiqueta, subindices = subs)
  }
  out
}

# Aplica subcriterios promediados (ej. r100_p17_prom = mean(r100_p17, r100_p17.1)).
# Mismo patrón que `agregar_subcriterios_promedio()` del qmd. Si el subcriterio
# tiene `etiqueta`, la fijamos como `attr(col, "label")` para que aparezca con
# nombre humano en preview/cobertura/dashboard.
.dimensiones_aplicar_subcriterios <- function(data, cfg_subcriterios) {
  if (!length(cfg_subcriterios)) return(data)
  for (sc in cfg_subcriterios) {
    nuevo <- as.character(sc$nombre %||% "")
    etiqueta <- as.character(sc$etiqueta %||% "")
    fuente <- as.character(unlist(sc$fuente %||% list()))
    if (!nzchar(nuevo) || !length(fuente)) next
    fuente <- intersect(fuente, names(data))
    if (!length(fuente)) next
    mat <- vapply(fuente, function(v) suppressWarnings(as.numeric(data[[v]])), numeric(nrow(data)))
    if (is.null(dim(mat))) mat <- matrix(mat, ncol = 1L)
    nuevo_col <- rowMeans(mat, na.rm = TRUE)
    nuevo_col[apply(is.na(mat), 1, all)] <- NA_real_
    data[[nuevo]] <- nuevo_col
    attr(data[[nuevo]], "measure") <- "continuous"
    if (nzchar(etiqueta)) attr(data[[nuevo]], "label") <- etiqueta
  }
  data
}

# Orquesta la pipeline completa: recodifica items 0-100 → aplica
# subcriterios promediados → calcula sub-índices → calcula índices →
# arma config (etiquetas + semáforo). Devuelve la data enriquecida +
# metadata que la UI expone como preview.
.dimensiones_construir <- function(rp_data, rp_inst, cfg) {
  prefijo <- as.character(cfg$prefijo %||% "r100_")[1]
  if (!nzchar(prefijo)) prefijo <- "r100_"

  vars_recodificar <- as.character(unlist(cfg$vars_recodificar %||% list()))
  if (!length(vars_recodificar)) {
    # Auto: aplicar la lógica de detección sobre `listas_objetivo`.
    detect <- .dimensiones_detectar_escalas(rp_inst, cfg$listas_objetivo)
    vars_recodificar <- unique(unlist(lapply(detect, function(d) unlist(d$vars))))
  }
  vars_recodificar <- vars_recodificar[vars_recodificar %in% names(rp_data)]

  excluir <- as.character(unlist(cfg$excluir_vars %||% list()))
  if (length(excluir)) vars_recodificar <- setdiff(vars_recodificar, excluir)

  if (!length(vars_recodificar)) {
    stop_api(422, "E_DIM_SIN_VARS",
      "No hay variables candidatas para recodificar a 0-100. Marca al menos una lista objetivo o pásalas explícitamente.")
  }

  orden_por_lista <- cfg$orden_por_lista %||% list()
  # Asegurar que los valores son vectores character (vienen como list desde JSON).
  orden_por_lista <- lapply(orden_por_lista, function(v) as.character(unlist(v)))

  cod_missing <- cfg$codigos_missing %||% list()
  if (is.list(cod_missing) && is.null(names(cod_missing))) {
    cod_missing <- as.character(unlist(cod_missing))
  } else if (is.list(cod_missing)) {
    cod_missing <- lapply(cod_missing, function(v) as.character(unlist(v)))
  }

  cod_na <- cfg$codigos_no_aplica %||% list()
  if (is.list(cod_na) && is.null(names(cod_na))) {
    cod_na <- as.character(unlist(cod_na))
  } else if (is.list(cod_na)) {
    cod_na <- lapply(cod_na, function(v) as.character(unlist(v)))
  }

  data_rec <- reporte_dimensiones(
    data = rp_data,
    instrumento = rp_inst,
    vars = vars_recodificar,
    excluir_vars = excluir,
    orden_por_lista = orden_por_lista,
    codigos_missing = cod_missing,
    codigos_no_aplica = cod_na,
    prefijo = prefijo,
    reemplazar = FALSE,
    verbose = FALSE
  )

  data_rec <- .dimensiones_aplicar_subcriterios(data_rec, cfg$subcriterios %||% list())

  subs <- .dimensiones_build_subindices(cfg$subindices %||% list())
  if (is.null(subs)) {
    stop_api(422, "E_DIM_SIN_SUBINDICES",
      "Define al menos un sub-índice (bloque) para construir las dimensiones.")
  }
  idxs <- .dimensiones_build_indices(cfg$indices %||% list())

  data_dim <- reporte_dimensiones_indices(
    data = data_rec,
    subindices = subs,
    indices = idxs,
    verbose = FALSE
  )

  # Aplicar etiquetas humanas cortas por variable individual. Equivale al
  # bloque `aplicar_labels_indicadores()` del qmd canónico (líneas 781-808).
  # Las llaves son los nombres de columnas tras la recodificación
  # (típicamente con prefijo r100_); los valores son labels para gráficos.
  labels_indicadores <- cfg$labels_indicadores %||% list()
  if (is.list(labels_indicadores) && length(labels_indicadores)) {
    for (nm in names(labels_indicadores)) {
      lbl <- as.character(labels_indicadores[[nm]] %||% "")
      if (!nzchar(lbl)) next
      if (nm %in% names(data_dim)) {
        attr(data_dim[[nm]], "label") <- lbl
      }
    }
  }

  semaforo_cortes <- as.numeric(unlist(cfg$semaforo$cortes %||% c(60, 80)))
  if (length(semaforo_cortes) < 2L) semaforo_cortes <- c(60, 80)
  semaforo_colores <- cfg$semaforo$colores %||% list()
  semaforo_colores <- c(
    rojo  = as.character(semaforo_colores$rojo  %||% "#D84B55"),
    ambar = as.character(semaforo_colores$ambar %||% "#E0B44C"),
    verde = as.character(semaforo_colores$verde %||% "#3A9A5B")
  )

  labels_indices <- cfg$labels_indices %||% list()
  labels_indices <- vapply(labels_indices, as.character, character(1))
  labels_subindices <- cfg$labels_subindices %||% list()
  labels_subindices <- vapply(labels_subindices, as.character, character(1))

  paleta_radar <- as.character(cfg$radar$paleta %||% "okabe_ito")
  if (!paleta_radar %in% c("okabe_ito", "ipe")) paleta_radar <- "okabe_ito"

  dim_cfg <- reporte_dimensiones_config(
    data = data_dim,
    labels_indices = if (length(labels_indices)) labels_indices else NULL,
    labels_subindices = if (length(labels_subindices)) labels_subindices else NULL,
    semaforo_cortes = semaforo_cortes,
    semaforo_colores = semaforo_colores,
    paleta_radar = paleta_radar,
    radar_min_ejes = as.integer(cfg$radar$min_ejes %||% 3L)
  )

  list(
    data_dim = data_dim,
    dim_cfg = dim_cfg,
    vars_r100 = grep(paste0("^", prefijo), names(data_dim), value = TRUE),
    vars_sub = grep("^sub_", names(data_dim), value = TRUE),
    vars_idx = grep("^idx_", names(data_dim), value = TRUE),
    n_filas = nrow(data_dim)
  )
}

# Construye un preview compacto de la base de dimensiones para que la
# UI muestre primeras N filas (por seguridad — sin microdatos sensibles
# por default) y stats de cobertura por índice/subíndice.
.dimensiones_preview <- function(data_dim, max_rows = 10L) {
  cols_dim <- c(
    grep("^idx_", names(data_dim), value = TRUE),
    grep("^sub_", names(data_dim), value = TRUE)
  )
  if (!length(cols_dim)) return(list(filas = list(), cobertura = list()))

  head_df <- head(data_dim[, cols_dim, drop = FALSE], max_rows)
  filas <- lapply(seq_len(nrow(head_df)), function(i) {
    setNames(
      lapply(cols_dim, function(c) {
        v <- head_df[[c]][i]
        if (is.na(v)) NA else round(as.numeric(v), 2)
      }),
      cols_dim
    )
  })

  cobertura <- lapply(cols_dim, function(c) {
    v <- suppressWarnings(as.numeric(data_dim[[c]]))
    n <- length(v)
    n_ok <- sum(!is.na(v))
    list(
      var = c,
      n = n,
      n_validos = n_ok,
      pct_validos = if (n) round(100 * n_ok / n, 1) else 0,
      media = if (n_ok) round(mean(v, na.rm = TRUE), 2) else NA,
      sd = if (n_ok > 1L) round(stats::sd(v, na.rm = TRUE), 2) else NA
    )
  })

  list(filas = filas, cobertura = cobertura, columnas = as.list(cols_dim))
}

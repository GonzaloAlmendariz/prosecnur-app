# =============================================================================
# Catálogo de reglas de una base (M3 de Validación)
# =============================================================================
# GET /api/validacion/v2/reglas/catalogo[?variable=][&base_nombre=]. Solo lee.
#
# Una fila por regla de la base:
#   - del formulario: el plan que se leyó del XLSForm (incluye las que salen de
#     los cálculos y de los grupos repetidos);
#   - del operativo: los controles de periodo de campo y de respuestas casi
#     iguales (ids `OP_*`, que viven en el mismo plan);
#   - propias: las que escribió el equipo (`scope$reglas_custom`), activas o no;
#   - y, sin evaluar, lo que el formulario pide y el motor no pudo convertir en
#     regla (expresiones que dependen de un listado externo y expresiones que no
#     se pudieron traducir). No se descartan en silencio: salen con su causa.
#
# Base de lectura: la que resuelve `.resolve_base_nombre()` para la base pedida
# (la base activa si no se pide ninguna). No se escribe nada en ninguna base.
#
# El nombre y la frase de cada regla salen de validacion_reglas_frase.R y la
# base de la última auditoría de validacion_reglas_base.R. Este catálogo
# publica la narrativa nueva en sus propios campos: `nombre_regla` del resumen
# y de la cola de limpieza siguen como estaban.
#
# Id de cada fila: `id` es único en el catálogo y estable entre lecturas; es el
# id del motor salvo que dos reglas lo compartan, y entonces se le suma la tabla
# (`<id>@<tabla>`) o una huella de la regla. `id_motor` es el que usan la
# auditoría, la cola y PATCH /instrumento/regla/<id>/activa.

.VRC_ORDEN_ORIGEN <- c("formulario", "operativo", "propia")

# --- Lectura de la base ------------------------------------------------------

# Formulario de la base con las etiquetas corregidas del proyecto. Sin
# formulario no se cae el catálogo: las etiquetas salen de las reglas y se avisa.
.vrc_instrumento <- function(sid, base_eff) {
  s <- session_get(sid)
  meta <- if (!is.null(base_eff)) {
    fid <- s$estudio$bases[[base_eff]]$xlsform_file_id %||% NULL
    if (is.null(fid)) NULL else get_file(sid, fid)
  } else {
    # Sesión heredada sin estudio: el último formulario cargado, si hay.
    tryCatch(.require_xlsform(sid), api_error = function(e) NULL)
  }
  if (is.null(meta) || is.null(meta$path) || !file.exists(meta$path)) {
    return(list(inst = NULL, aviso = list(codigo = "sin_formulario",
      texto = "La base no tiene formulario cargado: las etiquetas salen de las reglas.")))
  }
  inst <- tryCatch(leer_xlsform_limpieza(meta$path, verbose = FALSE), error = function(e) e)
  if (inherits(inst, "error")) {
    return(list(inst = NULL, aviso = list(codigo = "formulario_ilegible",
      texto = "El formulario de la base no se pudo leer: las etiquetas salen de las reglas.")))
  }
  list(inst = .validacion_apply_label_overrides(sid, inst), aviso = NULL)
}

# Reglas del plan del formulario, como las arma la auditoría
# (`.validacion_auditoria_reglas()`), sin el plan compilado.
.vrc_reglas_plan <- function(base_eff, scope) {
  pr <- scope$plan_result
  if (is.null(pr)) return(list())
  bundle <- pr$bundle %||% validation_bundle_from_plan_df(
    pr$plan, existing_bundle = NULL, compatibility = validation_profile_for_base(base_eff))
  bundle$rules %||% list()
}

# --- Clasificación -----------------------------------------------------------

.vrc_origen <- function(rule, ids_propias) {
  id <- as.character(rule$id %||% "")
  if (id %in% ids_propias) return("propia")
  if (startsWith(id, "OP_")) return("operativo")
  "formulario"
}

.vrc_raw_origenes <- function(rule) {
  o <- unique(c(.ast_raw_origins(rule$predicate), .ast_raw_origins(rule$gate)))
  setdiff(o, "legacy_r_expr")
}

.vrc_familia <- function(rule, origen, categoria_plan = NA_character_, propia = NULL) {
  tipo <- as.character(rule$tipo_regla %||% "")
  if (identical(origen, "propia")) return(as.character(propia$tipo %||% tipo))
  if (identical(origen, "operativo")) {
    return(switch(as.character(rule$id), OP_field_period = "periodo", OP_duplicates = "casi_iguales", tipo))
  }
  sub <- as.character((rule$presentation %||% list())$subtipo_semantico %||% "")
  if (identical(tipo, "odk_raw")) {
    origen_raw <- paste(.ast_raw_origins(rule$predicate), collapse = " ")
    return(if (grepl("relevant", origen_raw, fixed = TRUE)) "salto" else "restriccion")
  }
  if (identical(categoria_plan, "Filtro de opciones")) return("filtro_opciones")
  switch(tipo,
    required = "obligatoria",
    skip = "salto",
    constraint = , range = , catalog = , select_multiple_cardinality = "restriccion",
    calculate_check = "calculo",
    repeat_length = "grupo_repetido",
    coherence = , duplicate = if (identical(sub, "relacional")) "grupo_repetido" else "restriccion",
    tipo
  )
}

.vrc_clase <- function(hallazgo_kind) {
  if (identical(hallazgo_kind, "caso_validar")) "caso_a_revisar" else "inconsistencia"
}

# Lo que la auditoría no evaluará, sabido sin auditar.
.vrc_causa_estatica <- function(rule, excluidas) {
  target <- .validacion_rule_target_vars(rule)
  if (length(intersect(target, excluidas))) return("variable_excluida")
  raw <- .vrc_raw_origenes(rule)
  if ("pulldata" %in% raw) return("listado_externo")
  if (length(raw)) return("expresion_no_leida")
  NA_character_
}

# Causa de la última auditoría para una regla que no quedó evaluada.
.vrc_causa_auditoria <- function(estado, issue) {
  estado <- as.character(estado %||% NA_character_)[1]
  issue <- as.character(issue %||% NA_character_)[1]
  if (identical(issue, "compatible_missing_columns")) return("pregunta_ausente")
  if (identical(estado, "correcta")) return(NA_character_)
  switch(.vrc_o(issue, "sin_issue"),
    missing_columns = "pregunta_ausente",
    domain_mismatch = "valor_desalineado",
    missing_collection_date = "sin_fecha_encuesta",
    requires_external_dataset = "listado_externo",
    odk_raw = "expresion_no_leida",
    sin_datos_repeat = "grupo_sin_registros",
    missing_data_table = , repeat_length_pending = "tabla_ausente",
    compile_error = , parse_error = , runtime_error = , type_mismatch = ,
    runtime_skip = , cross_table_ambiguous = "error_al_evaluar",
    if (identical(estado, "incorrecta_ejecucion")) "error_al_evaluar" else .vrc_o(issue, "sin_causa")
  )
}

# Primer valor de `x`, o `y` si es NULL, vacío o NA.
.vrc_o <- function(x, y) if (is.null(x) || !length(x) || is.na(x[1])) y else x

# --- Partes de la frase y de la ficha ---------------------------------------

# El predicado sin la parte "la pregunta tiene respuesta" de una restricción.
.vrc_cuerpo <- function(rule, familia) {
  pred <- rule$predicate
  target <- as.character((rule$variable_roles %||% list())$target %||% rule$primary_var %||% "")[1]
  if (familia %in% c("restriccion", "filtro_opciones") && is_ast(pred) &&
      identical(ast_op(pred), "and") && nzchar(target)) {
    args <- pred$args
    quitar <- vapply(args, function(a) {
      is_ast(a) && identical(ast_op(a), "not") && is_ast(a$arg) &&
        identical(ast_op(a$arg), "is_missing") && identical(as.character(a$arg$var), target)
    }, logical(1))
    if (any(quitar) && any(!quitar)) return(ast_normalize(ast_and(args[!quitar])))
  }
  pred
}

.vrc_buscar_rango <- function(x) {
  if (!is_ast(x)) return(NULL)
  if (ast_op(x) %in% c("range_numeric", "range_date")) return(x)
  hijos <- c(x$args %||% list(), if (is_ast(x$arg)) list(x$arg) else list())
  for (h in hijos) {
    r <- .vrc_buscar_rango(h)
    if (!is.null(r)) return(r)
  }
  NULL
}

.vrc_limites <- function(cuerpo, familia, ctx) {
  if (!(familia %in% c("restriccion", "filtro_opciones", "periodo", "rango_num", "rango_fecha"))) return(NA)
  # Una expresión que el motor no leyó no tiene límites que publicar: la
  # expresión cruda va en `expresion_formulario`.
  if (length(setdiff(.ast_raw_origins(cuerpo), "legacy_r_expr"))) return(NA)
  r <- .vrc_buscar_rango(cuerpo)
  num <- function(v) if (is.null(v) || !length(v) || is.na(v[1])) NA else v[1]
  texto <- .vrf_texto_plano(.vrf_cond(cuerpo, .vrf_contexto_regla(ctx)))
  list(
    tipo = if (is.null(r)) NA_character_ else if (identical(ast_op(r), "range_date")) "fecha" else "numero",
    min = if (is.null(r)) NA else as.character(num(r$min)),
    max = if (is.null(r)) NA else as.character(num(r$max)),
    inclusive = if (is.null(r)) NA else isTRUE(r$inclusive),
    restriccion = texto
  )
}

.vrc_expresion <- function(rule, familia, target, survey) {
  if (identical(as.character(rule$tipo_regla), "odk_raw") && is_ast(rule$predicate)) {
    return(as.character(rule$predicate$expression %||% NA_character_))
  }
  campo <- switch(familia, salto = "relevant", obligatoria = "relevant", restriccion = "constraint",
                  filtro_opciones = "choice_filter", calculo = "calculation", NULL)
  if (is.null(campo) || !is.data.frame(survey) || !(campo %in% names(survey))) return(NA_character_)
  i <- match(target, as.character(survey$name))
  if (is.na(i)) return(NA_character_)
  v <- as.character(survey[[campo]][i])
  if (is.na(v) || !nzchar(trimws(v))) NA_character_ else trimws(v)
}

.vrc_variables <- function(rule, target) {
  roles <- rule$variable_roles %||% list()
  v <- .validacion_chr_vec(c(target, roles$compare, roles$gate, roles$drivers, rule$variables))
  v[grepl("^[A-Za-z_][A-Za-z0-9_.-]*$", v)]
}

# --- Filas -------------------------------------------------------------------

.vrc_fila <- function(rule, origen, familia, ctx, contexto) {
  rctx <- .vrf_contexto_regla(ctx, rule)
  target <- as.character((rule$variable_roles %||% list())$target %||% rule$primary_var %||% "")[1]
  propia <- contexto$propia
  sub <- as.character((rule$presentation %||% list())$subtipo_semantico %||% "")
  direccion <- if (identical(as.character(rule$tipo_regla), "skip") && sub %in% c("debe", "nodebe")) sub else NA_character_
  cuerpo <- .vrc_cuerpo(rule, familia)
  cond_salto <- if (identical(familia, "salto") && !is.na(direccion)) .vrb_condicion_salto(rule$predicate, target, direccion) else NULL
  limites <- .vrc_limites(cuerpo, familia, ctx)
  info <- list(origen = origen, familia = familia, direccion = direccion, target = target,
               tabla = .normalize_rule_table(rule$tabla), condicion = cond_salto, cuerpo = cuerpo,
               filtro = rule$gate, limites = limites, propia = propia,
               sin_evaluar_expresion = identical(as.character(rule$tipo_regla), "odk_raw") &&
                 length(.vrc_raw_origenes(rule)) > 0L)
  frase <- .vrf_frase(info, rctx)
  kind <- if (identical(origen, "propia")) as.character(propia$hallazgo_kind %||% "caso_validar") else "inconsistencia_xlsform"
  list(
    id = as.character(rule$id),
    id_motor = as.character(rule$id),
    origen = origen,
    familia = familia,
    familia_nombre = .vrf_nombre_familia(origen, familia),
    nombre = .vrf_nombre(info, rctx),
    frase = frase,
    frase_completa = !isTRUE(rctx$estado$incompleta),
    clase = .vrc_clase(kind),
    hallazgo_kind = kind,
    tratamiento_previsto = if (identical(origen, "propia")) {
      list(accion = .regla_tratamiento(propia), alcance = .regla_alcance_tratamiento(propia))
    } else list(accion = NA_character_, alcance = NA_character_),
    activa = contexto$activa,
    motivo_desactivada = contexto$motivo %||% NA_character_,
    se_puede_desactivar = TRUE,
    variable_revisada = if (nzchar(target)) target else NA_character_,
    variables = as.list(.vrc_variables(rule, target)),
    tabla = info$tabla,
    expresion_formulario = .vrc_expresion(rule, familia, target, contexto$survey),
    direccion = direccion,
    pareja = NA_character_,
    estado_evaluacion = "evaluada",
    causa_codigo = NA_character_,
    causa = NA_character_,
    ultima_auditoria = NA,
    limites = limites
  )
}

# Lo que el formulario pide y no llegó a ser regla. `field` es "relevant" o
# "constraint"; `causa` el código de `.VRF_CAUSAS`.
.vrc_fila_sin_regla <- function(entrada, causa, ctx) {
  row <- as.character(entrada$row_name %||% "")
  field <- as.character(entrada$field %||% "")
  familia <- if (identical(field, "relevant")) "salto" else "restriccion"
  q <- .vrf_q(row, ctx)
  que <- if (identical(causa, "listado_externo")) " depende de un listado externo que la base no trae."
         else " tiene una condición del formulario que no se pudo convertir en regla."
  list(
    id = sprintf("sin_regla:%s:%s", field, row),
    id_motor = NA_character_,
    origen = "formulario",
    familia = familia,
    familia_nombre = .vrf_nombre_familia("formulario", familia),
    nombre = sprintf("%s de %s", if (identical(familia, "salto")) "Salto" else "Restricción",
                     .vrf_comillas(.vrf_etiqueta(row, ctx))),
    frase = .vrf_compactar(c(q, .vrf_t(que))),
    frase_completa = TRUE,
    clase = "inconsistencia",
    hallazgo_kind = "inconsistencia_xlsform",
    tratamiento_previsto = list(accion = NA_character_, alcance = NA_character_),
    activa = TRUE,
    motivo_desactivada = NA_character_,
    se_puede_desactivar = FALSE,
    variable_revisada = row,
    variables = as.list(row),
    tabla = "principal",
    expresion_formulario = as.character(entrada$expression %||% NA_character_),
    direccion = NA_character_,
    pareja = NA_character_,
    estado_evaluacion = "sin_evaluar",
    causa_codigo = causa,
    causa = .vrf_causa(causa),
    ultima_auditoria = NA,
    limites = NA
  )
}

# Parejas de un salto: "debe" y "no debe" de la misma pregunta en la misma
# tabla. Se cruzan por código de pregunta y tabla, nunca por nombre.
.vrc_parejas <- function(filas) {
  llave <- vapply(filas, function(f) {
    if (is.na(f$direccion)) return(NA_character_)
    paste(f$tabla, f$variable_revisada, sep = "\r")
  }, character(1))
  for (k in unique(llave[!is.na(llave)])) {
    i <- which(llave == k)
    dirs <- vapply(filas[i], `[[`, "", "direccion")
    if (length(i) == 2L && setequal(dirs, c("debe", "nodebe"))) {
      filas[[i[1]]]$pareja <- filas[[i[2]]]$id
      filas[[i[2]]]$pareja <- filas[[i[1]]]$id
    }
  }
  filas
}

# Un id por fila. Si el motor repite uno, la fila suma su tabla y, si aún se
# repite, la huella de la regla (contenido, no posición).
.vrc_ids_unicos <- function(filas, reglas) {
  ids <- vapply(filas, `[[`, "", "id")
  dup <- ids %in% ids[duplicated(ids)]
  if (!any(dup)) return(filas)
  for (i in which(dup)) filas[[i]]$id <- paste0(ids[i], "@", filas[[i]]$tabla)
  ids <- vapply(filas, `[[`, "", "id")
  dup <- ids %in% ids[duplicated(ids)]
  for (i in which(dup)) {
    h <- if (!is.null(reglas[[i]])) substr(.validacion_huella_regla(reglas[[i]]), 1, 8) else as.character(i)
    filas[[i]]$id <- paste0(ids[i], "#", h)
  }
  filas
}

# --- Última auditoría --------------------------------------------------------

.vrc_auditoria <- function(filas, reglas, scope, sid, base_eff) {
  ev <- scope$evaluacion
  avisos <- list()
  if (is.null(ev) || !is.data.frame(ev$resumen)) return(list(filas = filas, avisos = avisos))
  res <- ev$resumen
  ids_res <- as.character(res$id_regla)
  repetidos <- unique(ids_res[duplicated(ids_res)])
  motor <- vapply(filas, function(f) .vrc_o(f$id_motor, ""), character(1))
  fuera <- setdiff(unique(ids_res), motor)
  if (length(fuera)) {
    avisos[[length(avisos) + 1L]] <- list(codigo = "auditoria_con_reglas_fuera",
      texto = sprintf("La última auditoría tiene %d %s que no %s entre las vigentes: vuelve a auditar.",
                      length(fuera), if (length(fuera) == 1L) "regla" else "reglas",
                      if (length(fuera) == 1L) "está" else "están"),
      ids = as.list(sort(fuera)))
  }
  cola <- .limpieza_build_decision_queue(scope, scope$limpieza_draft %||% list())
  decididos <- stats::setNames(vapply(cola, function(q) as.integer(q$n_casos_cubiertos %||% 0L), integer(1)),
                               vapply(cola, function(q) as.character(q$source_id), character(1)))
  auditadas <- stats::setNames(ev$bundle$rules %||% list(),
                               vapply(ev$bundle$rules %||% list(), function(r) as.character(r$id), character(1)))
  a_contar <- list()
  for (i in seq_along(filas)) {
    f <- filas[[i]]
    id <- f$id_motor
    if (is.na(id) || !(id %in% ids_res) || id %in% repetidos || is.null(auditadas[[id]])) next
    a_contar[[length(a_contar) + 1L]] <- list(id = id, rule = auditadas[[id]],
                                              propia = if (identical(f$origen, "propia")) reglas[[i]]$propia else NULL)
  }
  bases <- .vrb_bases(ev, a_contar,
                      exclusiones = .validacion_mb_collection_exclusions_for_base(sid, base_eff),
                      compat = validation_profile_for_base(base_eff))
  sin_base <- character(0); indeterminadas <- character(0)
  for (i in seq_along(filas)) {
    f <- filas[[i]]
    id <- f$id_motor
    if (is.na(id) || !(id %in% ids_res)) next
    if (id %in% repetidos) {
      avisos[[length(avisos) + 1L]] <- list(codigo = "auditoria_id_repetido",
        texto = sprintf("La regla %s aparece dos veces en la última auditoría: su resultado no se puede leer.", f$nombre),
        ids = list(f$id))
      next
    }
    k <- match(id, ids_res)
    causa <- .vrc_causa_auditoria(res$estado_dinamico[k], res$issue_code[k])
    if (!is.na(causa)) {
      if (identical(f$estado_evaluacion, "evaluada")) {
        filas[[i]]$estado_evaluacion <- "sin_evaluar"
        filas[[i]]$causa_codigo <- causa
        filas[[i]]$causa <- .vrf_causa(causa)
      }
      next
    }
    b <- bases[[id]] %||% list(n_base = NA_integer_, n_base_indeterminada = NA_integer_, tipo = NA_character_,
                               tabla = f$tabla)
    n_casos <- as.integer(res$n_inconsistencias[k])
    n_base <- b$n_base
    if (!is.na(n_base) && !is.na(n_casos) && n_casos > n_base) {
      avisos[[length(avisos) + 1L]] <- list(codigo = "base_menor_que_casos",
        texto = sprintf("La base de %s salió menor que sus casos: no se publica.", f$nombre), ids = list(f$id))
      n_base <- NA_integer_
    }
    tipo_regla <- as.character(auditadas[[id]]$tipo_regla %||% "")
    filas[[i]]$ultima_auditoria <- list(
      n_casos = n_casos,
      n_base = n_base,
      n_base_indeterminada = b$n_base_indeterminada,
      base_tipo = b$tipo,
      base_definicion = if (is.na(n_base)) NA_character_ else .vrb_base_texto(b$tipo, tipo_regla, b$tabla),
      porcentaje = if (!is.na(n_base) && n_base > 0L && !is.na(n_casos)) n_casos / n_base else NA_real_,
      nivel = if (identical(b$tabla, "principal")) "caso" else "registro",
      tabla = b$tabla,
      n_decididos = if (id %in% names(decididos)) unname(decididos[[id]]) else 0L
    )
    if (is.na(n_base)) sin_base <- c(sin_base, f$id)
    if (isTRUE(b$n_base_indeterminada > 0L)) indeterminadas <- c(indeterminadas, f$id)
  }
  if (length(indeterminadas)) {
    avisos[[length(avisos) + 1L]] <- list(codigo = "base_indeterminada",
      texto = sprintf("En %d %s la condición no se pudo evaluar en algunas filas: esas filas no cuentan en la base ni en los casos.",
                      length(indeterminadas), if (length(indeterminadas) == 1L) "regla" else "reglas"),
      ids = as.list(indeterminadas))
  }
  if (length(sin_base)) {
    avisos[[length(avisos) + 1L]] <- list(codigo = "base_sin_contar",
      texto = sprintf("%d %s de la última auditoría no %s base contada: su porcentaje no se publica.",
                      length(sin_base), if (length(sin_base) == 1L) "regla" else "reglas",
                      if (length(sin_base) == 1L) "tiene" else "tienen"),
      ids = as.list(sin_base))
  }
  list(filas = filas, avisos = avisos)
}

# --- Cuentas -----------------------------------------------------------------

.vrc_familias <- function(filas) {
  if (!length(filas)) return(list())
  origen <- vapply(filas, `[[`, "", "origen")
  familia <- vapply(filas, `[[`, "", "familia")
  activa <- vapply(filas, function(f) isTRUE(f$activa), logical(1))
  sin <- vapply(filas, function(f) identical(f$estado_evaluacion, "sin_evaluar"), logical(1))
  out <- list()
  for (o in .VRC_ORDEN_ORIGEN) {
    orden <- names(.VRF_FAMILIAS[[o]])
    fams <- unique(familia[origen == o])
    fams <- c(intersect(orden, fams), sort(setdiff(fams, orden)))
    for (fm in fams) {
      m <- origen == o & familia == fm
      out[[length(out) + 1L]] <- list(origen = o, familia = fm, nombre = .vrf_nombre_familia(o, fm),
                                      n = sum(m), n_activas = sum(m & activa), n_sin_evaluar = sum(m & sin))
    }
  }
  out
}

# --- Motor -------------------------------------------------------------------

#' Catálogo de reglas de una base
#'
#' @param sid sesión.
#' @param base base pedida (NULL = base activa). Solo se lee.
#' @param variable código de una pregunta: deja las reglas que la leen.
#' @return lista con `reglas`, `familias`, `n_total`, `n_activas`,
#'   `n_sin_evaluar`, `por_origen` y `avisos`. Ver CONTRATO_VALIDACION_M3.
#' @keywords internal
validacion_reglas_catalogo <- function(sid, base = NULL, variable = NULL) {
  base_eff <- .validacion_auditoria_base(sid, base)
  scope <- .get_base_scope(sid, base_eff)
  lectura <- .vrc_instrumento(sid, base_eff)
  ctx <- .vrf_contexto(lectura$inst)
  survey <- if (is.list(lectura$inst)) lectura$inst$survey else NULL
  avisos <- if (is.null(lectura$aviso)) list() else list(lectura$aviso)

  plan <- .vrc_reglas_plan(base_eff, scope)
  categorias <- {
    p <- scope$plan_result$plan
    if (is.data.frame(p) && all(c("ID", "Categoría") %in% names(p))) {
      stats::setNames(as.character(p[["Categoría"]]), as.character(p$ID))
    } else character(0)
  }
  propias <- scope$reglas_custom %||% list()
  ids_propias <- vapply(propias, function(r) as.character(r$id %||% ""), character(1))
  desactivadas <- .validacion_chr_vec(scope$reglas_desactivadas)
  motivos <- scope$reglas_desactivadas_motivo
  if (!is.list(motivos)) motivos <- list()
  excluidas <- .validacion_chr_vec(scope$variables_excluidas)

  filas <- list(); reglas <- list()
  agregar <- function(fila, rule = NULL, propia = NULL) {
    filas[[length(filas) + 1L]] <<- fila
    reglas[[length(reglas) + 1L]] <<- list(rule = rule, propia = propia)
  }
  for (rule in plan) {
    origen <- .vrc_origen(rule, ids_propias)
    id <- as.character(rule$id)
    familia <- .vrc_familia(rule, origen, .vrc_o(unname(categorias[id]), NA_character_))
    fila <- .vrc_fila(rule, origen, familia, ctx, list(
      activa = !(id %in% desactivadas),
      motivo = as.character((motivos[[id]] %||% list())$motivo %||% NA_character_),
      survey = survey))
    causa <- .vrc_causa_estatica(rule, excluidas)
    if (!is.na(causa)) {
      fila$estado_evaluacion <- "sin_evaluar"; fila$causa_codigo <- causa; fila$causa <- .vrf_causa(causa)
    }
    agregar(fila, rule)
  }
  for (p in propias) {
    # Una regla propia que el puente no traduce no tumba el catálogo: sale sin
    # evaluar con su causa (la auditoría, en cambio, se detiene y la nombra).
    rule <- tryCatch(bridge_regla_custom(p), error = function(e) e)
    if (inherits(rule, "error")) {
      fila <- .vrc_fila_sin_regla(list(row_name = .validacion_chr_vec(p$variables)[1] %||% "",
                                       field = "constraint", expression = NA_character_),
                                  "regla_no_traducible", ctx)
      fila$id <- fila$id_motor <- as.character(p$id %||% "")
      fila$origen <- "propia"; fila$familia <- as.character(p$tipo %||% "")
      fila$familia_nombre <- .vrf_nombre_familia("propia", fila$familia)
      fila$nombre <- as.character(p$nombre %||% p$id %||% "")
      fila$activa <- isTRUE(p$activa); fila$se_puede_desactivar <- TRUE
      fila$frase <- .vrf_t("La regla no se puede escribir porque no se pudo traducir al motor.")
      fila$hallazgo_kind <- as.character(p$hallazgo_kind %||% "caso_validar")
      fila$clase <- .vrc_clase(fila$hallazgo_kind)
      agregar(fila, NULL, p)
      next
    }
    fila <- .vrc_fila(rule, "propia", .vrc_familia(rule, "propia", propia = p), ctx,
                      list(activa = isTRUE(p$activa), motivo = NA_character_, survey = survey, propia = p))
    causa <- .vrc_causa_estatica(rule, excluidas)
    if (!is.na(causa)) {
      fila$estado_evaluacion <- "sin_evaluar"; fila$causa_codigo <- causa; fila$causa <- .vrf_causa(causa)
    }
    agregar(fila, rule, p)
  }
  # Lo que el motor no convirtió en regla. Las expresiones complejas que sí
  # quedaron como regla en modo experto ya están arriba y no se repiten.
  bundle <- scope$plan_result$bundle %||% list()
  for (d in bundle$discarded %||% list()) {
    if (identical(as.character(d$origin %||% ""), "pulldata")) agregar(.vrc_fila_sin_regla(d, "listado_externo", ctx))
  }
  for (u in bundle$unsupported %||% list()) agregar(.vrc_fila_sin_regla(u, "expresion_no_traducida", ctx))

  filas <- .vrc_ids_unicos(filas, lapply(reglas, `[[`, "rule"))
  filas <- .vrc_parejas(filas)
  aud <- .vrc_auditoria(filas, reglas, scope, sid, base_eff)
  filas <- aud$filas
  avisos <- c(avisos, aud$avisos)

  variable <- trimws(as.character(variable %||% ""))[1]
  if (!is.na(variable) && nzchar(variable)) {
    lee <- vapply(filas, function(f) variable %in% unlist(f$variables), logical(1))
    en_formulario <- is.data.frame(survey) && variable %in% as.character(survey$name)
    if (!any(lee) && !en_formulario) {
      avisos[[length(avisos) + 1L]] <- list(codigo = "variable_desconocida",
        texto = sprintf("La pregunta \"%s\" no está en el formulario ni en ninguna regla.", variable))
    }
    filas <- filas[lee]
  } else variable <- NA_character_

  origenes <- vapply(filas, `[[`, "", "origen")
  list(
    ok = TRUE,
    base_nombre = base_eff %||% NA_character_,
    variable = variable,
    plan_construido = !is.null(scope$plan_result),
    auditada_en = (scope$evaluacion %||% list())$auditada_en %||% NA_character_,
    n_total = length(filas),
    n_activas = sum(vapply(filas, function(f) isTRUE(f$activa), logical(1))),
    n_sin_evaluar = sum(vapply(filas, function(f) identical(f$estado_evaluacion, "sin_evaluar"), logical(1))),
    por_origen = lapply(stats::setNames(.VRC_ORDEN_ORIGEN, .VRC_ORDEN_ORIGEN), function(o) sum(origenes == o)),
    familias = .vrc_familias(filas),
    reglas = filas,
    avisos = avisos
  )
}

# collection_territorial_estado.R — el Estado que campo declara en el Excel de asignación
# (checklist-formatos-campo C7; recomendación P3 del plan conjunto, aprobada por Gonzalo).
#
# Campo anota en el Excel, por UMP, el Estado («Pendiente», «En campo», «Finalizada»,
# «Reemplazada», «Anulada») y las fechas de salida y de entrega. Material lo lee al subir
# el archivo (collection_territorial_excel.R), lo guarda junto a la asignación con la
# huella de la muestra y lo publica aquí, de solo lectura, para Monitoreo.
#
# Es lo DECLARADO por campo, no el avance: el avance sigue saliendo de Kobo. Monitoreo
# lo cruza como contraste y sólo cuando `stale` y `desactualizada` son FALSE.

# Fecha de una celda: serial de Excel, Date, «dd/mm/aaaa» o «aaaa-mm-dd». NA si no es fecha.
.mte_fecha <- function(x) {
  if (is.null(x) || !length(x)) return(NA_character_)
  v <- x[[1]]
  if (inherits(v, "Date")) return(format(v, "%Y-%m-%d"))
  if (is.numeric(v)) return(if (is.na(v) || v < 1 || v > 80000) NA_character_ else format(as.Date(v, origin = "1899-12-30"), "%Y-%m-%d"))
  t <- trimws(as.character(v))
  if (is.na(t) || !nzchar(t)) return(NA_character_)
  if (grepl("^[0-9]+(\\.[0-9]+)?$", t)) return(.mte_fecha(as.numeric(t)))
  for (f in c("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%y")) {
    d <- suppressWarnings(as.Date(t, format = f))
    if (!is.na(d) && as.integer(format(d, "%Y")) >= 2000L) return(format(d, "%Y-%m-%d"))
  }
  NA_character_
}

# El Estado de una celda contra la lista del Excel, sin distinguir tildes ni mayúsculas.
.mte_estado <- function(x) {
  t <- trimws(as.character(if (is.null(x) || !length(x)) "" else x[[1]]))
  if (is.na(t) || !nzchar(t)) return("")
  hit <- match(.mtx_normalizar_nombre(t), .mtx_normalizar_nombre(.MTX_ESTADOS))
  if (is.na(hit)) NA_character_ else .MTX_ESTADOS[[hit]]
}

# Lo guardado, limpio: sólo UMP con algo declarado y con forma.
.mte_limpiar <- function(estados) {
  filas <- Filter(is.list, estados %||% list())
  out <- lapply(filas, function(e) {
    id <- .hojas_ruta_envio_chr(e$id_manzana)
    est <- .hojas_ruta_envio_chr(e$estado_declarado)
    fs <- .hojas_ruta_envio_chr(e$fecha_salida); fe <- .hojas_ruta_envio_chr(e$fecha_entrega)
    if (!nzchar(id) || !(est %in% c("", .MTX_ESTADOS))) return(NULL)
    # P2: conteos por código de resultado, enteros desde cero; lo demás se descarta.
    cr <- if (is.list(e$conteos)) e$conteos else list()
    conteos <- list()
    for (k in names(cr)) {
      v <- suppressWarnings(as.integer(unlist(cr[[k]])[1]))
      if (grepl("^[0-9]+$", k) && !is.na(v) && v >= 0L) conteos[[k]] <- v
    }
    # Registro del coordinador (§1C): efectivas por celda, visita, reemplazo y supervisión.
    enteros <- function(x) {
      x <- if (is.list(x)) x else list()
      out <- list()
      for (k in names(x)) { v <- suppressWarnings(as.integer(unlist(x[[k]])[1])); if (nzchar(k) && !is.na(v) && v >= 0L) out[[k]] <- v }
      out
    }
    ef <- if (is.list(e$efectivas)) e$efectivas else list()
    efectivas <- list(sexo = enteros(ef$sexo), edad = enteros(ef$edad))
    fv <- .hojas_ruta_envio_chr(e$fecha_visita)
    sr <- .hojas_ruta_envio_chr(e$se_reemplaza); if (!sr %in% .MTR_SI_NO) sr <- ""
    sup <- enteros(e$supervision); sup <- sup[intersect(names(sup), c("aprobadas", "no_aprobadas"))]
    tr <- suppressWarnings(as.integer(unlist(e$total_reportado)[1])); if (length(tr) != 1L || is.na(tr) || tr < 0L) tr <- NA_integer_
    hay_registro <- length(efectivas$sexo) || length(efectivas$edad) || nzchar(fv) || nzchar(sr) || length(sup) || !is.na(tr)
    if (!nzchar(est) && !nzchar(fs) && !nzchar(fe) && !length(conteos) && !hay_registro) return(NULL)
    list(id_manzana = id, estado_declarado = est, fecha_salida = fs, fecha_entrega = fe, conteos = conteos,
         efectivas = efectivas, fecha_visita = fv, se_reemplaza = sr, supervision = sup, total_reportado = tr)
  })
  Filter(Negate(is.null), out)
}

#' El Estado declarado por campo en el Excel de asignación, por UMP (lectura pura, C7).
#' Una UMP sin nada declarado sale con campos vacíos; el código es el asignado
#' (heredado de su titular en un reemplazo).
#' @keywords internal
collection_territorial_estado_get <- function(sid, campaign_id = NULL) {
  s <- session_get(sid)
  asig <- collection_territorial_asignacion_get(sid, campaign_id)
  g <- .mta_guardada(s)
  propia <- identical(g$campaign_id, asig$campaign_id) && identical(g$fase, asig$fase)
  declarado <- if (propia) g$estados else list()
  de_id <- stats::setNames(declarado, vapply(declarado, `[[`, "", "id_manzana"))
  codigo_de <- stats::setNames(vapply(asig$asignacion, `[[`, "", "codigo"), vapply(asig$asignacion, `[[`, "", "id_manzana"))
  envio <- .mcamp_territorial_envio(s, asig$fase)
  unidades <- lapply(.mta_unidades(envio), function(u) {
    d <- de_id[[u$unit_id]] %||% list()
    list(id_manzana = u$unit_id, label = u$label, role = u$role,
         codigo = unname(codigo_de[u$unit_id]) %||% "",
         estado_declarado = d$estado_declarado %||% "", fecha_salida = d$fecha_salida %||% "", fecha_entrega = d$fecha_entrega %||% "",
         # P2: totales de la hoja de consolidados transcritos por campo, por código.
         conteos = if (length(d$conteos)) d$conteos else structure(list(), names = character(0)),
         # Registro del coordinador: lo declarado por celda de cuota y la supervisión que
         # anotó campo. Monitoreo lo cruza con Kobo; aquí no se calcula Estado ni avance.
         efectivas = list(sexo = if (length(d$efectivas$sexo)) d$efectivas$sexo else structure(list(), names = character(0)),
                          edad = if (length(d$efectivas$edad)) d$efectivas$edad else structure(list(), names = character(0))),
         fecha_visita = d$fecha_visita %||% "", se_reemplaza = d$se_reemplaza %||% "",
         supervision = if (length(d$supervision)) d$supervision else structure(list(), names = character(0)),
         # Conveniencia (1A): el total que reporta coordinación, al lado del declarado por celda.
         total_reportado = if (is.null(d$total_reportado) || is.na(d$total_reportado)) NULL else d$total_reportado)
  })
  for (i in seq_along(unidades)) if (is.na(unidades[[i]]$codigo)) unidades[[i]]$codigo <- ""
  list(ok = TRUE, campaign_id = asig$campaign_id, fase = asig$fase,
       fuente = "excel_asignacion", es_avance = FALSE,
       # Variante del territorial con que se armó el Registro (conveniencia / ump_aleatoria).
       variante = .mtr_variante(s),
       sample_fingerprint = asig$sample_fingerprint, stale = asig$stale, desactualizada = asig$desactualizada,
       leido_at = if (propia && length(declarado)) g$estados_at else NA_character_,
       declaradas = length(declarado),
       # P2: el catálogo de códigos con que se leen los conteos (collection_territorial_formatos.R).
       codigos = lapply(collection_territorial_formatos_get(sid, asig$campaign_id)$codigos, function(k) k[c("codigo", "rotulo", "grupo")]),
       unidades = unidades)
}

# =============================================================================
# Planner: lo declarado y la deducción interna del modo (ADR 0123 §5)
# =============================================================================
#
# El Planner va primero: lo que muestra es sólo lo que el estudio DECLARÓ. Un
# proyecto sin declaración abre vacío; no se siembra nombre, perfiles, equipo,
# códigos, insumos, etapa ni ventana desde módulos posteriores.
#
# La única excepción, declarada y acotada: mientras el estudio no declare sus
# perfiles, el MODO de cada módulo se sigue deduciendo de lo que esos módulos
# ya guardan (decisión de Gonzalo, 1/11). Medido en los proyectos de referencia,
# sin esa deducción hsvg2026 perdía el modo aulas de Monitoreo y acnur_acg
# abría Cálculo en un diseño de aulas que no usa. La deducción sólo alimenta
# `/api/planner/modos` y a quien ya pide los perfiles para fijar un modo
# (`.planner_payload_perfiles`); nunca se muestra en el Planner.
#
# Precedencia de la deducción (ADR 0122 §7, de más fuerte a más débil):
#   1. familia CRUDA de Monitoreo con `route_selected = TRUE` (la normalizada
#      convierte cualquier familia desconocida en acreditación);
#   2. tipos de las campañas de Material;
#   3. `macro_familia` de Cálculo con `workspace.frame_mode` declarado;
#   4. `macro_familia` sin marco (débil: sólo propone si no hay nada más).
# Gana la fuente más fuerte que diga algo.
#
# Todo aquí es LECTURA PURA: ninguna función escribe en la sesión ni marca el
# proyecto como modificado.

.PLANNER_FAMILIA_A_PERFIL <- c(
  territorial = "territorial",
  aulas_universitarias = "aulas",
  telefonico = "telefonico",
  acreditacion = "acreditacion"
)

.PLANNER_MACRO_A_PERFIL <- c(
  acreditacion = "acreditacion",
  encuesta_estudiantes = "aulas",
  hsvg_universitario = "aulas",
  territorial = "territorial",
  listado_telefonico = "telefonico"
)

.planner_aviso <- function(codigo, mensaje, fuente = NULL) {
  list(codigo = codigo, mensaje = mensaje, fuente = fuente)
}

.planner_chr1 <- function(x) {
  if (is.null(x) || !length(x)) return("")
  v <- as.character(unlist(x, use.names = FALSE)[1])
  if (is.na(v)) "" else trimws(v)
}

# Cada fuente devuelve los tipos de perfil que dice, o NULL si no dice nada.
.planner_fuente_monitoreo <- function(s) {
  perfil <- (s[["monitoreo_config"]] %||% list())$monitoreo_profile
  if (!is.list(perfil) || !isTRUE(perfil$route_selected)) return(NULL)
  tipo <- unname(.PLANNER_FAMILIA_A_PERFIL[.planner_chr1(perfil$family)])
  if (length(tipo) != 1L || is.na(tipo)) NULL else tipo
}

.planner_fuente_material <- function(s) {
  campanas <- (s[["material_campaigns"]] %||% list())$campaigns
  if (!is.list(campanas) || !length(campanas)) return(NULL)
  tipos <- vapply(campanas, function(c) .planner_chr1(c$type), "")
  tipos <- unique(tipos[tipos %in% c("aulas", "territorial")])
  if (length(tipos)) tipos else NULL
}

.planner_fuente_calc <- function(s, con_marco) {
  est <- s[["calc_muestra_estudio"]]
  if (!is.list(est)) return(NULL)
  macro <- .planner_chr1(est$macro_familia)
  marco <- .planner_chr1((est$workspace %||% list())$frame_mode)
  if (!nzchar(macro) || !identical(nzchar(marco), con_marco)) return(NULL)
  tipo <- unname(.PLANNER_MACRO_A_PERFIL[macro])
  if (is.na(tipo)) NULL else tipo
}

.planner_tipo_de_calc <- function(s) {
  est <- s[["calc_muestra_estudio"]]
  if (!is.list(est)) return("")
  tipo <- unname(.PLANNER_MACRO_A_PERFIL[.planner_chr1(est$macro_familia)])
  if (is.na(tipo)) "" else tipo
}

#' Los perfiles que se deducen para fijar el modo de cada módulo. Sólo modo:
#' sin poblaciones ni avisos, porque nada de esto se muestra (ADR 0123 §5).
#' @keywords internal
.planner_deducir_perfiles <- function(s) {
  fuentes <- Filter(Negate(is.null), list(
    .planner_fuente_monitoreo(s),
    .planner_fuente_material(s),
    .planner_fuente_calc(s, con_marco = TRUE),
    .planner_fuente_calc(s, con_marco = FALSE)
  ))
  if (!length(fuentes)) return(list())
  tipo_calc <- .planner_tipo_de_calc(s)
  marco <- .planner_chr1(((s[["calc_muestra_estudio"]] %||% list())$workspace %||% list())$frame_mode)
  # ADR 0124: un estudio, un tipo; si la fuente ganadora dice dos, manda el primero.
  lapply(fuentes[[1]][1], function(tipo) {
    .planner_norm_perfil(list(
      tipo = tipo,
      # Un territorial de antes se deduce como UMP aleatoria: es la única
      # variante que la app sabía operar (Hojas de ruta).
      seleccion = if (identical(tipo, "aulas")) {
        if (identical(marco, "marco_disponible")) "marco" else "conglomerados"
      } else NULL,
      diseno = if (identical(tipo, "territorial")) "hojas-ruta" else if (identical(tipo, tipo_calc)) "calc-muestra" else "cliente"
    ))
  })
}

#' Los perfiles que fijan los modos: los declarados o, mientras no haya, los
#' deducidos. No se muestran en el Planner (para eso, `.planner_payload`).
#' @keywords internal
.planner_payload_perfiles <- function(s) {
  decl <- .planner_leer(s)$secciones$perfiles
  if (!is.null(decl)) decl$valor else .planner_deducir_perfiles(s)
}

#' La identidad del estudio, sólo si se declaró. Lectura pura y liviana: no
#' arma el payload entero (el Home la pide en cada carga). Sin declarar, cada
#' lector usa lo suyo (el Home, el nombre del archivo; Cálculo, su título).
#' @keywords internal
.planner_identidad <- function(s) {
  decl <- .planner_leer(s)$secciones$estudio
  if (!is.null(decl)) return(c(decl$valor, list(origen = "declarado")))
  c(.planner_norm_estudio(list()), list(origen = "vacio"))
}

#' Los catálogos de códigos declarados en el Planner antes del ADR 0123. Son de
#' Material; aquí sólo se leen como respaldo. Lectura pura.
#' @keywords internal
.planner_codigos <- function(s) {
  guardado <- .planner_leer(s)
  decl <- guardado$secciones$codigos
  valor <- if (!is.null(decl)) decl$valor else .planner_norm_codigos(list())
  c(list(ok = TRUE, origen = if (is.null(decl)) "vacio" else "declarado", revision = guardado$revision), valor)
}

# Los archivos del proyecto (`files/`), para registrar un insumo sin moverlo:
# el insumo guarda el `file_id` y el archivo se queda donde está.
.planner_archivos <- function(s) {
  files <- s[["files"]]
  if (!is.list(files) || !length(files)) return(list())
  out <- lapply(names(files), function(id) {
    f <- files[[id]]
    if (!is.list(f)) return(NULL)
    list(file_id = .planner_chr1(f$file_id %||% id), nombre = .planner_chr1(f$original_name %||% f$name),
         tipo = .planner_chr1(f$kind), subido_en = substr(.planner_chr1(f$uploaded_at), 1L, 10L))
  })
  Filter(function(f) !is.null(f) && nzchar(f$file_id), out)
}

# Cada insumo dice a qué archivo apunta y si sigue en el proyecto. Se resuelve
# al leer: el nombre del archivo no se copia al Planner.
.planner_insumos_con_archivo <- function(insumos, archivos) {
  por_id <- stats::setNames(archivos, vapply(archivos, `[[`, "", "file_id"))
  lapply(insumos, function(k) {
    a <- if (nzchar(k$archivo %||% "")) por_id[[k$archivo]] else NULL
    c(k, list(archivo_nombre = if (is.null(a)) "" else a$nombre,
              archivo_estado = if (!nzchar(k$archivo %||% "")) "externo" else if (is.null(a)) "falta" else "en_proyecto"))
  })
}

#' Payload completo del Planner: sólo lo declarado. Una sección sin declarar
#' viene vacía y con `origen = "vacio"`. Lectura pura (ADR 0123 §5).
#' @keywords internal
.planner_payload <- function(s) {
  guardado <- .planner_leer(s)
  decl <- guardado$secciones
  valor_de <- function(k, vacio) if (!is.null(decl[[k]])) decl[[k]]$valor else vacio
  valores <- list(
    estudio = valor_de("estudio", .planner_norm_estudio(list())),
    perfiles = valor_de("perfiles", list()),
    equipo = valor_de("equipo", .planner_norm_equipo(list())),
    codigos = valor_de("codigos", .planner_norm_codigos(list())),
    insumos = .planner_insumos_con_archivo(valor_de("insumos", list()), .planner_archivos(s)),
    etapa = valor_de("etapa", list(valor = NA_character_)),
    ventana = valor_de("ventana", list(inicio = "", fin = ""))
  )
  origen <- lapply(stats::setNames(PLANNER_SECCIONES, PLANNER_SECCIONES), function(k) {
    if (!is.null(decl[[k]])) "declarado" else "vacio"
  })
  list(
    ok = TRUE,
    schema = PLANNER_SCHEMA,
    revision = guardado$revision,
    planner = valores,
    origen = origen,
    declarado_en = lapply(decl, `[[`, "declarado_en"),
    escribibles = as.list(PLANNER_SECCIONES_ESCRIBIBLES),
    archivos = .planner_archivos(s),
    avisos = .pulso_version_avisos_planner(s[["id"]]),
    conflictos = list()
  )
}

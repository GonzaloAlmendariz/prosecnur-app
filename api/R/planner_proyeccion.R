# =============================================================================
# Planner: proyección desde los lugares viejos (ADR 0122 §7)
# =============================================================================
#
# Lo que el estudio todavía no declaró en el Planner se lee de donde vivía
# antes. Todo aquí es LECTURA PURA: ninguna función escribe en la sesión ni
# marca el proyecto como modificado, y ninguna llama a algo que lo haga. Si una
# fuente vieja falta, la sección sale vacía y lo dice; no se inventa.
#
# Precedencia del perfil (de más fuerte a más débil, §7):
#   1. familia CRUDA de Monitoreo con `route_selected = TRUE` (la normalizada
#      convierte cualquier familia desconocida en acreditación);
#   2. tipos de las campañas de Material;
#   3. `macro_familia` de Cálculo con `workspace.frame_mode` declarado;
#   4. `macro_familia` sin marco (débil: sólo propone si no hay nada más).
# Gana la fuente más fuerte que diga algo. Una más débil que la contradice no
# abre conflicto, pero tampoco se calla: queda como aviso con su origen.

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

.PLANNER_ETIQUETA_FUENTE <- c(
  monitoreo = "Monitoreo",
  material = "Material de campo",
  calc_marco = "Cálculo de muestra",
  calc = "Cálculo de muestra"
)

.planner_aviso <- function(codigo, mensaje, fuente = NULL) {
  list(codigo = codigo, mensaje = mensaje, fuente = fuente)
}

.planner_chr1 <- function(x) {
  if (is.null(x) || !length(x)) return("")
  v <- as.character(unlist(x, use.names = FALSE)[1])
  if (is.na(v)) "" else trimws(v)
}

# Cada fuente devuelve list(tipos, sin_equivalente) o NULL si no dice nada.
.planner_fuente_monitoreo <- function(s) {
  perfil <- (s[["monitoreo_config"]] %||% list())$monitoreo_profile
  if (!is.list(perfil) || !isTRUE(perfil$route_selected)) return(NULL)
  familia <- .planner_chr1(perfil$family)
  if (!nzchar(familia)) return(NULL)
  tipo <- unname(.PLANNER_FAMILIA_A_PERFIL[familia])
  if (is.na(tipo)) return(list(tipos = character(0), sin_equivalente = familia))
  list(tipos = tipo, sin_equivalente = NULL)
}

.planner_fuente_material <- function(s) {
  campanas <- (s[["material_campaigns"]] %||% list())$campaigns
  if (!is.list(campanas) || !length(campanas)) return(NULL)
  tipos <- vapply(campanas, function(c) .planner_chr1(c$type), "")
  tipos <- unique(tipos[tipos %in% c("aulas", "territorial")])
  if (!length(tipos)) return(NULL)
  list(tipos = tipos, sin_equivalente = NULL)
}

.planner_fuente_calc <- function(s, con_marco) {
  est <- s[["calc_muestra_estudio"]]
  if (!is.list(est)) return(NULL)
  macro <- .planner_chr1(est$macro_familia)
  marco <- .planner_chr1((est$workspace %||% list())$frame_mode)
  if (!nzchar(macro) || !identical(nzchar(marco), con_marco)) return(NULL)
  tipo <- unname(.PLANNER_MACRO_A_PERFIL[macro])
  if (is.na(tipo)) return(list(tipos = character(0), sin_equivalente = macro))
  list(tipos = tipo, sin_equivalente = NULL)
}

.planner_tipo_de_calc <- function(s) {
  est <- s[["calc_muestra_estudio"]]
  if (!is.list(est)) return("")
  tipo <- unname(.PLANNER_MACRO_A_PERFIL[.planner_chr1(est$macro_familia)])
  if (is.na(tipo)) "" else tipo
}

.planner_poblaciones_proyectadas <- function(s, tipo) {
  perfil_mon <- (s[["monitoreo_config"]] %||% list())$monitoreo_profile
  unidades <- if (is.list(perfil_mon)) perfil_mon$units else NULL
  bases <- names((s[["estudio"]] %||% list())$bases %||% list())
  rep <- NULL
  if (identical(tipo, "aulas")) {
    rep <- tryCatch(monitoreo_aulas_representatividad_declarada(s[["monitoreo_config"]] %||% list()),
                    error = function(e) NULL)
  }
  if (is.list(unidades) && length(unidades) > 1L) {
    return(lapply(seq_along(unidades), function(i) {
      u <- unidades[[i]]
      etiqueta <- .planner_chr1(u$label %||% u$nombre %||% u$name %||% u$id)
      list(id = .planner_chr1(u$id %||% u$key %||% etiqueta), etiqueta = etiqueta, bases = list())
    }))
  }
  if (length(bases) > 1L) {
    return(lapply(bases, function(b) list(id = b, etiqueta = b, bases = list(b))))
  }
  list(list(id = "principal", etiqueta = if (identical(tipo, "aulas")) "Estudiantes" else "Población",
            bases = as.list(bases), representatividad = rep))
}

.planner_proyectar_perfiles <- function(s) {
  fuentes <- list(
    monitoreo = .planner_fuente_monitoreo(s),
    material = .planner_fuente_material(s),
    calc_marco = .planner_fuente_calc(s, con_marco = TRUE),
    calc = .planner_fuente_calc(s, con_marco = FALSE)
  )
  fuentes <- Filter(Negate(is.null), fuentes)
  avisos <- list(); conflictos <- list()
  for (nombre in names(fuentes)) {
    sin <- fuentes[[nombre]]$sin_equivalente
    if (!is.null(sin)) {
      conflictos[[length(conflictos) + 1L]] <- .planner_aviso(
        "perfil_sin_equivalente",
        sprintf("%s usa un tipo de estudio que el Planner no tiene: declara el perfil de recojo.",
                .PLANNER_ETIQUETA_FUENTE[[nombre]]),
        fuente = nombre)
    }
  }
  con_tipos <- Filter(function(f) length(f$tipos) > 0L, fuentes)
  if (!length(con_tipos)) {
    bases <- names((s[["estudio"]] %||% list())$bases %||% list())
    if (length(bases) > 1L) {
      avisos[[length(avisos) + 1L]] <- .planner_aviso(
        "bases_sin_perfil",
        sprintf("El estudio tiene %d bases y ningún perfil declarado: al declararlo, cada base puede ser una población.",
                length(bases)))
    }
    return(list(perfiles = list(), avisos = avisos, conflictos = conflictos))
  }
  ganadora <- names(con_tipos)[[1]]
  tipos <- con_tipos[[ganadora]]$tipos
  for (nombre in setdiff(names(con_tipos), ganadora)) {
    extra <- setdiff(con_tipos[[nombre]]$tipos, tipos)
    if (length(extra)) {
      avisos[[length(avisos) + 1L]] <- .planner_aviso(
        "fuente_contradice",
        sprintf("%s tiene un diseño de %s que el perfil proyectado no usa.",
                .PLANNER_ETIQUETA_FUENTE[[nombre]], paste(extra, collapse = " y ")),
        fuente = nombre)
    }
  }
  tipo_calc <- .planner_tipo_de_calc(s)
  marco <- .planner_chr1(((s[["calc_muestra_estudio"]] %||% list())$workspace %||% list())$frame_mode)
  perfiles <- lapply(tipos, function(tipo) {
    diseno <- if (identical(tipo, "territorial")) "hojas-ruta" else if (identical(tipo, tipo_calc)) "calc-muestra" else "cliente"
    .planner_norm_perfil(list(
      tipo = tipo,
      seleccion = if (identical(tipo, "aulas") && identical(marco, "marco_disponible")) "marco" else "conglomerados",
      diseno = diseno,
      poblaciones = .planner_poblaciones_proyectadas(s, tipo)
    ))
  })
  list(perfiles = perfiles, avisos = avisos, conflictos = conflictos, fuente = ganadora)
}

# La identidad vive hoy en cuatro lugares: el contenedor de Procesamiento
# (`estudio$nombre`), Cálculo de muestra (`titulo`, `contexto$cliente`) y el
# Dashboard (`titulo`, `cliente`). Se siembra en ese orden, que es el que ya
# usaba el Home (.diseno_protocol_summary). El código no existía en ninguno.
# Rótulos por defecto que escriben otros módulos cuando nadie puso nombre
# (Cálculo guarda «Estudio sin título»): no son un nombre.
.PLANNER_NOMBRES_VACIOS <- c("Estudio sin título", "Estudio sin titulo", "Proyecto sin titulo", "Proyecto sin título")

.planner_nombre_real <- function(...) {
  for (x in list(...)) {
    v <- .planner_chr1(x)
    if (nzchar(v) && !v %in% .PLANNER_NOMBRES_VACIOS) return(v)
  }
  ""
}

.planner_proyectar_estudio <- function(s) {
  calc <- s[["calc_muestra_estudio"]] %||% list()
  dash <- s[["dashboard_config"]] %||% list()
  .planner_norm_estudio(list(
    nombre = .planner_nombre_real((s[["estudio"]] %||% list())$nombre, calc$titulo, dash$titulo),
    cliente = .planner_chr1((calc$contexto %||% list())$cliente %||% dash$cliente)
  ))
}

#' La identidad del estudio, declarada o sembrada. Lectura pura y liviana: no
#' arma el payload entero (el Home la pide en cada carga).
#' @keywords internal
.planner_identidad <- function(s) {
  decl <- .planner_leer(s)$secciones$estudio
  if (!is.null(decl)) return(c(decl$valor, list(origen = "declarado")))
  c(.planner_proyectar_estudio(s), list(origen = "proyectado"))
}

# El equipo proyectado nunca trae el DNI: la lista vieja lo tiene, el Planner no
# lo guarda como campo (ADR 0122 §10).
.planner_proyectar_equipo <- function(s) {
  roster <- (((s[["monitoreo_config"]] %||% list())$territorial) %||% list())$enumerator_roster
  personas <- list()
  code_format <- ""
  if (is.list(roster)) {
    code_format <- .planner_chr1(roster$code_format)
    for (a in .planner_registros(roster$assignments, PLANNER_MAX_PERSONAS)) {
      personas[[length(personas) + 1L]] <- list(
        codigo = .planner_chr1(a$codigo_pulso %||% a$codigo), nombre = .planner_chr1(a$nombre),
        rol = "encuestador", perfiles = list("territorial"), activo = TRUE)
    }
  }
  disp <- s[["monitoreo_aulas_disponibilidad"]]
  aplicadores <- if (is.list(disp) && is.list(disp$aplicadores)) disp$aplicadores else disp
  for (a in .planner_registros(aplicadores, PLANNER_MAX_PERSONAS)) {
    nombre <- .planner_chr1(a$nombre)
    if (!nzchar(nombre)) next
    personas[[length(personas) + 1L]] <- list(
      codigo = "", nombre = nombre, rol = "aplicador", perfiles = list("aulas"), activo = TRUE)
  }
  .planner_norm_equipo(list(code_format = code_format, personas = personas))
}

# Los códigos nacieron en Material y se mudan al Planner (fase P3). Se
# siembran de ahí, sin escribir y sin cambiar Material:
# - resultado de la visita: el catálogo de las hojas de ruteo (D1), 1 a 8 con
#   8 = efectiva, y 99; con los rótulos que el estudio ya ajustó;
# - status del barrido: el catálogo de la campaña telefónica si lo personalizó,
#   o los 14 Status del RMS con su clase (.MBP_STATUS).
# Los rótulos del núcleo quedan editables en el Planner (decisión K1 del
# informe de brechas); el grupo no, porque es el significado del código.
.planner_proyectar_codigos <- function(s, perfiles) {
  tipos <- vapply(perfiles, `[[`, "", "tipo")
  resultado <- list()
  if ("territorial" %in% tipos || is.list(s[["material_territorial_formatos"]])) {
    campana <- .planner_chr1((s[["material_territorial_formatos"]] %||% list())$campaign_id)
    g <- tryCatch(.mtf_guardado(s, campana), error = function(e) NULL)
    if (is.list(g)) resultado <- tryCatch(.mtf_catalogo(g), error = function(e) list())
  }
  barrido <- list()
  tel <- s[["material_telefonica_config"]]
  campanas <- vapply(((s[["material_campaigns"]] %||% list())$campaigns) %||% list(),
                     function(c) .planner_chr1(c$tipo %||% c$type), "")
  if ("telefonico" %in% tipos || is.list(tel) || "telefonica" %in% campanas) {
    propio <- if (is.list(tel)) tel$status else NULL
    barrido <- if (is.list(propio) && length(propio)) propio else tryCatch(.MBP_STATUS, error = function(e) list())
  }
  .planner_norm_codigos(list(version = 1L, resultado = resultado, status_barrido = barrido))
}

#' Los catálogos de códigos del estudio, declarados o sembrados. Lectura pura.
#' @keywords internal
.planner_codigos <- function(s) {
  guardado <- .planner_leer(s)
  decl <- guardado$secciones$codigos
  valor <- if (!is.null(decl)) decl$valor else .planner_proyectar_codigos(s, .planner_payload_perfiles(s))
  c(list(ok = TRUE, origen = if (is.null(decl)) "proyectado" else "declarado", revision = guardado$revision), valor)
}

.planner_payload_perfiles <- function(s) {
  decl <- .planner_leer(s)$secciones$perfiles
  if (!is.null(decl)) decl$valor else .planner_proyectar_perfiles(s)$perfiles
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

.planner_proyectar_insumos <- function(s) {
  insumos <- list()
  # Las bases que Cálculo de muestra leyó como marco: casi siempre las entrega
  # el cliente. `source_bindings` es una lista (una por hoja); un archivo con
  # dos hojas es un solo insumo, con el nombre de su primera vinculación.
  bindings <- (((s[["calc_muestra_estudio"]] %||% list())$workspace %||% list())$source_bindings) %||% list()
  if (is.list(bindings) && !is.null(bindings$file_id)) bindings <- list(bindings)
  archivos <- .planner_archivos(s)
  vistos <- character(0)
  for (b in Filter(is.list, bindings)) {
    marco_id <- .planner_chr1(b$file_id)
    if (!nzchar(marco_id) || marco_id %in% vistos) next
    vistos <- c(vistos, marco_id)
    archivo <- Filter(function(f) identical(f$file_id, marco_id), archivos)
    etiqueta <- .planner_chr1(b$label)
    insumos[[length(insumos) + 1L]] <- list(
      id = paste0("marco-", .planner_id(b$id %||% marco_id, as.character(length(vistos)))), tipo = "marco",
      etiqueta = if (nzchar(etiqueta)) etiqueta else if (length(archivo)) archivo[[1]]$nombre else "Marco muestral",
      archivo = marco_id, origen = "Cálculo de muestra",
      registrado_en = if (length(archivo)) archivo[[1]]$subido_en else "")
  }
  if (!is.null(s[["monitoreo_aulas_padron"]])) {
    insumos[[length(insumos) + 1L]] <- list(id = "padron-aulas", tipo = "padron", etiqueta = "Padrón de la población",
                                            origen = "Monitoreo › Insumos")
  }
  .planner_norm_insumos(insumos)
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

# La etapa sembrada desde lo que dicen hoy Hojas de ruta y Monitoreo: si
# coinciden (o sólo uno dice algo), ésa; si discrepan, ninguna y un conflicto.
.planner_proyectar_etapa <- function(s) {
  fuentes <- .planner_etapas_declaradas(s)
  valores <- unique(vapply(fuentes, `[[`, "", "etapa"))
  if (length(valores) == 1L) return(list(etapa = list(valor = valores[[1]]), conflictos = list()))
  conflictos <- if (length(valores) > 1L) list(.planner_aviso(
    "etapa_sin_acuerdo",
    sprintf("Hojas de ruta dice que el estudio está en %s y Monitoreo, en %s: declara la etapa en Cronograma.",
            fuentes$hojas_ruta$etapa, fuentes$monitoreo$etapa))) else list()
  list(etapa = list(valor = NA_character_), conflictos = conflictos)
}

#' Payload completo del Planner: lo declarado gana; lo demás se proyecta.
#' Lectura pura (ADR 0122 §2).
#' @keywords internal
.planner_payload <- function(s) {
  guardado <- .planner_leer(s)
  decl <- guardado$secciones
  proy_perfiles <- .planner_proyectar_perfiles(s)
  perfiles <- if (!is.null(decl$perfiles)) decl$perfiles$valor else proy_perfiles$perfiles
  valores <- list(
    estudio = if (!is.null(decl$estudio)) decl$estudio$valor else .planner_proyectar_estudio(s),
    perfiles = perfiles,
    equipo = if (!is.null(decl$equipo)) decl$equipo$valor else .planner_proyectar_equipo(s),
    codigos = if (!is.null(decl$codigos)) decl$codigos$valor else .planner_proyectar_codigos(s, perfiles),
    insumos = .planner_insumos_con_archivo(
      if (!is.null(decl$insumos)) decl$insumos$valor else .planner_proyectar_insumos(s), .planner_archivos(s)),
    etapa = if (!is.null(decl$etapa)) decl$etapa$valor else .planner_proyectar_etapa(s)$etapa
  )
  origen <- lapply(stats::setNames(PLANNER_SECCIONES, PLANNER_SECCIONES), function(k) {
    if (!is.null(decl[[k]])) "declarado" else "proyectado"
  })
  declarado_en <- lapply(decl, `[[`, "declarado_en")
  # Avisos y conflictos de la proyección sólo valen mientras los perfiles no se declaren.
  if (!is.null(decl$perfiles)) proy_perfiles$avisos <- list()
  if (!is.null(decl$perfiles)) proy_perfiles$conflictos <- list()
  # La etapa: si Hojas de ruta y Monitoreo no coinciden y el Planner todavía no
  # la declara, es un conflicto que resuelve el usuario; el Planner no elige.
  if (is.null(decl$etapa)) proy_perfiles$conflictos <- c(proy_perfiles$conflictos, .planner_proyectar_etapa(s)$conflictos)
  list(
    ok = TRUE,
    schema = PLANNER_SCHEMA,
    revision = guardado$revision,
    planner = valores,
    origen = origen,
    declarado_en = declarado_en,
    escribibles = as.list(PLANNER_SECCIONES_ESCRIBIBLES),
    archivos = .planner_archivos(s),
    avisos = c(.pulso_version_avisos_planner(s[["id"]]), proy_perfiles$avisos),
    conflictos = proy_perfiles$conflictos
  )
}

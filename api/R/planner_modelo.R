# =============================================================================
# Planner: el estudio declarado una sola vez (ADR 0122)
# =============================================================================
#
# La clave `planner` (schema `planner/v1`) guarda SÓLO lo que el equipo declaró,
# sección por sección. Lo que todavía no se declaró viene vacío (ADR 0123 §5);
# el modo de cada módulo se deduce aparte, sin mostrarse (planner_proyeccion.R).
# Un .pulso anterior abre igual que antes y no queda marcado como modificado.
#
# Dueño único de la clave: este archivo y router_planner.R. Ningún otro módulo
# la escribe.
#
# Vocabulario de los códigos: el mismo que ya usa Material
# (`material_territorial_formatos/v1`: codigo, rotulo, grupo), para que la
# mudanza de la fase P3 no tenga que traducir nada.

PLANNER_SCHEMA <- "planner/v1"
PLANNER_SECCIONES <- c("estudio", "perfiles", "equipo", "codigos", "insumos", "etapa", "ventana")
PLANNER_SECCIONES_ESCRIBIBLES <- c("estudio", "perfiles", "etapa", "ventana")
# Secciones que salieron del Planner (ADR 0123 §2): el equipo es de Monitoreo,
# los códigos de Material y los insumos del cliente no se registran. Se siguen
# normalizando porque Material lee equipo y códigos como respaldo en los .pulso
# que los declararon (hasta la fase Q6), y el anonimizador sigue cubriendo
# `planner$equipo$personas` mientras existan. El valor dice dónde viven ahora.
PLANNER_SECCIONES_LECTURA <- c(equipo = "Monitoreo", codigos = "Material de campo", insumos = "")
# Etapa operativa del estudio (Meta B, 2026-10-31, con el ADR 0122 ratificado:
# «el Planner dice qué fase está activa»). Hojas de ruta y Monitoreo la leen
# del Planner en una fase posterior; hasta entonces el Planner muestra lo que
# cada uno dice todavía (planner_calendario.R).
PLANNER_ETAPAS <- c("piloto", "campo")
# Ventana de campo (decisión de Gonzalo vía Meta B, 2026-10-31): el Planner la
# declara como PROPUESTA. Monitoreo no la adopta sola: muestra la discrepancia
# con la suya y ofrece «Alinear la ventana» con un clic, como con la etapa.
PLANNER_TIPOS_PERFIL <- c("territorial", "aulas", "telefonico", "acreditacion")
PLANNER_SELECCION_AULAS <- c("conglomerados", "marco")
# Gonzalo: «una cosa es el territorial con conveniencia y otra el territorial
# por UMP aleatoria que hace hoja de ruta» (acogida vs Ser Adolescente). Sólo
# la UMP aleatoria pasa por Hojas de ruta; la de conveniencia o cuotas se
# diseña con las cuotas del Planner, sin sorteo.
PLANNER_SELECCION_TERRITORIAL <- c("ump_aleatoria", "conveniencia")
PLANNER_DISENO <- c("calc-muestra", "hojas-ruta", "cliente", "cuotas")
PLANNER_CANALES <- c("presencial", "telefono", "correo", "qr")
PLANNER_ROLES <- c("encuestador", "aplicador", "supervisor", "operador")
# Cada catálogo tiene su vocabulario de grupos: el de la visita es el de las
# hojas de ruteo y consolidados de Material (D1); el del barrido, las cinco
# clases del Status del RMS (collection_barrido_plantilla.R, .MBP_CLASES).
PLANNER_GRUPOS_CODIGO <- c("efectiva", "no_aplicada", "manzana", "otro")
PLANNER_CLASES_BARRIDO <- c("efectiva", "pendiente", "no_contacto", "rechazo", "invalido")
PLANNER_TIPOS_INSUMO <- c("padron", "listado", "marco", "otro")
PLANNER_MAX_POBLACIONES <- 12L
PLANNER_MAX_PERSONAS <- 500L
PLANNER_MAX_CODIGOS <- 40L
PLANNER_MAX_INSUMOS <- 60L

.planner_canales_por_tipo <- function(tipo) {
  switch(tipo,
         territorial = list("presencial"),
         aulas = list("presencial", "qr"),
         telefonico = list("telefono"),
         acreditacion = list("correo"),
         list())
}

# ADR 0124: quién diseña la muestra sale del tipo (la variante territorial la
# ajusta .planner_norm_perfil): aulas, Cálculo; telefónico, la lista del cliente;
# acreditación, Monitoreo con porcentajes, así que Cálculo no participa.
.planner_diseno_por_tipo <- function(tipo) {
  switch(tipo, territorial = "hojas-ruta", aulas = "calc-muestra", "cliente")
}

.planner_id <- function(x, default = "") {
  v <- tolower(.bit_texto(x, 60L))
  v <- iconv(v, from = "UTF-8", to = "ASCII//TRANSLIT", sub = "")
  v <- gsub("[^a-z0-9]+", "-", v %||% "")
  v <- gsub("^-+|-+$", "", v)
  if (nzchar(v)) v else default
}

.planner_lista_enum <- function(x, opts) {
  if (is.null(x)) return(list())
  v <- unique(as.character(unlist(x, use.names = FALSE)))
  as.list(v[v %in% opts])
}

.planner_registros <- function(x, max_items) {
  if (is.data.frame(x)) x <- lapply(seq_len(nrow(x)), function(i) as.list(x[i, , drop = FALSE]))
  if (!is.list(x)) return(list())
  utils::head(Filter(is.list, unname(x)), max_items)
}

# --- Normalizadores por sección (tolerantes: leen cualquier forma) -----------

.planner_norm_estudio <- function(x) {
  x <- if (is.list(x)) x else list()
  list(
    nombre = .bit_texto(x$nombre, 160L),
    codigo = .bit_texto(x$codigo, 40L),
    cliente = .bit_texto(x$cliente, 160L),
    # ADR 0123 §1: el objetivo en una línea. No se publica (§7, planner_publico.R).
    objetivo = .bit_texto(x$objetivo, 240L)
  )
}

.planner_norm_poblacion <- function(x, i) {
  rep <- x$representatividad
  # La declaración del Planner es universo + variables; las celdas son del
  # diseñador (Cálculo u Hojas de ruta) y nunca se guardan aquí (ADR 0122 §3).
  if (is.list(rep)) {
    rep$celdas <- NULL
    rep$origen <- NULL
    rep$schema <- "representatividad_v1"
  } else {
    rep <- NULL
  }
  etiqueta <- .bit_texto(x$etiqueta, 80L)
  list(
    id = .planner_id(x$id %||% etiqueta, paste0("poblacion-", i)),
    etiqueta = if (nzchar(etiqueta)) etiqueta else "Población",
    bases = as.list(unique(vapply(as.list(unlist(x$bases %||% list())), .bit_texto, "", max_chars = 80L))),
    representatividad = rep
  )
}

.planner_norm_perfil <- function(x) {
  tipo <- calc_enum(x$tipo, PLANNER_TIPOS_PERFIL, "")
  if (!nzchar(tipo)) return(NULL)
  pobl <- .planner_registros(x$poblaciones, PLANNER_MAX_POBLACIONES)
  pobl <- lapply(seq_along(pobl), function(i) .planner_norm_poblacion(pobl[[i]], i))
  if (!length(pobl)) pobl <- list(.planner_norm_poblacion(list(id = "principal"), 1L))
  canales <- .planner_lista_enum(x$canales, PLANNER_CANALES)
  seleccion <- switch(tipo,
                      aulas = calc_enum(x$seleccion, PLANNER_SELECCION_AULAS, "conglomerados"),
                      territorial = calc_enum(x$seleccion, PLANNER_SELECCION_TERRITORIAL, "ump_aleatoria"),
                      NULL)
  list(
    tipo = tipo,
    seleccion = seleccion,
    diseno = if (identical(tipo, "territorial")) {
      if (identical(seleccion, "conveniencia")) "cuotas" else "hojas-ruta"
    } else {
      calc_enum(x$diseno, setdiff(PLANNER_DISENO, "cuotas"), .planner_diseno_por_tipo(tipo))
    },
    canales = if (length(canales)) canales else .planner_canales_por_tipo(tipo),
    poblaciones = pobl
  )
}

.planner_norm_perfiles <- function(x) {
  perfiles <- Filter(Negate(is.null), lapply(.planner_registros(x, length(PLANNER_TIPOS_PERFIL) * 2L), .planner_norm_perfil))
  # A lo más uno por tipo (ADR 0122 §8). Leer es tolerante: gana el primero.
  # Escribir no lo es: `.planner_validar_perfiles` rechaza el duplicado.
  tipos <- vapply(perfiles, `[[`, "", "tipo")
  perfiles[!duplicated(tipos)]
}

.planner_norm_equipo <- function(x) {
  x <- if (is.list(x)) x else list()
  personas <- lapply(.planner_registros(x$personas, PLANNER_MAX_PERSONAS), function(p) {
    list(
      codigo = .bit_texto(p$codigo, 40L),
      nombre = .bit_texto(p$nombre, 120L),
      rol = calc_enum(p$rol, PLANNER_ROLES, "encuestador"),
      perfiles = .planner_lista_enum(p$perfiles, PLANNER_TIPOS_PERFIL),
      activo = calc_bool(p$activo, TRUE)
    )
  })
  list(
    schema = "planner_equipo/v1",
    code_format = .bit_texto(x$code_format, 40L),
    personas = Filter(function(p) nzchar(p$codigo) || nzchar(p$nombre), personas)
  )
}

.planner_norm_codigo <- function(k, grupos = PLANNER_GRUPOS_CODIGO, defecto = "otro") {
  # Los Status del barrido llevan códigos de texto («numero_incorrecto»).
  codigo <- .bit_texto(k$codigo, 40L)
  if (!nzchar(codigo)) return(NULL)
  retirado <- suppressWarnings(as.integer(k$retirado_en_version %||% NA))
  if (!length(retirado)) retirado <- NA_integer_
  # La UI pide retirar con `retirar: true`; la versión la pone el servidor.
  if (calc_bool(k$retirar, FALSE) && (is.na(retirado) || retirado <= 0L)) retirado <- .Machine$integer.max
  list(
    codigo = codigo,
    rotulo = .bit_texto(k$rotulo %||% k$status, 60L),
    grupo = calc_enum(k$grupo %||% k$clase, grupos, defecto),
    retirado_en_version = if (!is.na(retirado) && retirado > 0L) retirado else NULL
  )
}

.planner_norm_catalogo <- function(x, grupos = PLANNER_GRUPOS_CODIGO, defecto = "otro") {
  out <- Filter(Negate(is.null), lapply(.planner_registros(x, PLANNER_MAX_CODIGOS), .planner_norm_codigo,
                                        grupos = grupos, defecto = defecto))
  out[!duplicated(vapply(out, `[[`, "", "codigo"))]
}

.planner_norm_codigos <- function(x) {
  x <- if (is.list(x)) x else list()
  list(
    version = calc_int(x$version, 1L, min = 1L),
    resultado = .planner_norm_catalogo(x$resultado),
    status_barrido = .planner_norm_catalogo(x$status_barrido, PLANNER_CLASES_BARRIDO, "pendiente")
  )
}

.planner_norm_insumos <- function(x) {
  out <- lapply(.planner_registros(x, PLANNER_MAX_INSUMOS), function(k) {
    etiqueta <- .bit_texto(k$etiqueta, 120L)
    list(
      id = .planner_id(k$id %||% etiqueta, ""),
      tipo = calc_enum(k$tipo, PLANNER_TIPOS_INSUMO, "otro"),
      etiqueta = etiqueta,
      archivo = .bit_texto(k$archivo, 240L),
      origen = .bit_texto(k$origen, 160L),
      registrado_en = .bit_texto(k$registrado_en, 40L)
    )
  })
  out <- Filter(function(k) nzchar(k$id), out)
  out[!duplicated(vapply(out, `[[`, "", "id"))]
}

.planner_norm_etapa <- function(x) {
  x <- if (is.list(x)) x else list(valor = x)
  list(valor = calc_enum(x$valor, PLANNER_ETAPAS, NA_character_))
}

.planner_validar_etapa <- function(valor) {
  etapa <- .planner_norm_etapa(valor)
  if (is.na(etapa$valor)) .planner_invalido("La etapa del estudio es piloto o campo.")
  etapa
}

# Fechas ISO (AAAA-MM-DD); lo que no lo es queda vacío.
.planner_norm_ventana <- function(x) {
  x <- if (is.list(x)) x else list()
  dia <- function(v) {
    v <- substr(.bit_texto(v, 40L), 1L, 10L)
    if (grepl("^\\d{4}-\\d{2}-\\d{2}$", v) && !is.na(as.Date(v, format = "%Y-%m-%d"))) v else ""
  }
  list(inicio = dia(x$inicio), fin = dia(x$fin))
}

.planner_validar_ventana <- function(valor) {
  v <- .planner_norm_ventana(valor)
  if (!nzchar(v$inicio) || !nzchar(v$fin)) .planner_invalido("La ventana de campo necesita un día de inicio y uno de fin.")
  if (v$fin < v$inicio) .planner_invalido("La ventana de campo no puede terminar antes de empezar.")
  v
}

.planner_normalizar_seccion <- function(seccion, valor) {
  switch(seccion,
         etapa = .planner_norm_etapa(valor),
         ventana = .planner_norm_ventana(valor),
         estudio = .planner_norm_estudio(valor),
         perfiles = .planner_norm_perfiles(valor),
         equipo = .planner_norm_equipo(valor),
         codigos = .planner_norm_codigos(valor),
         insumos = .planner_norm_insumos(valor))
}

#' Normaliza la clave `planner` tal como vive en la sesión. Idempotente.
#'
#' Forma persistida (la del ADR 0122 §6, la que leen el anonimizador y el gate
#' de datos personales): plana, una clave por sección declarada
#' (`planner$equipo$personas`) y `declarado_en` con la fecha de cada una. Una
#' sección ausente es una sección no declarada. Devuelve la vista interna
#' (`secciones[[k]]$valor`); `.planner_a_persistir` la vuelve a aplanar.
#' Una clave ausente o ajena es un Planner vacío en la revisión 0.
#' @keywords internal
.planner_normalizar <- function(x) {
  if (!is.list(x) || !identical(.bit_texto(x$schema, 40L), PLANNER_SCHEMA)) {
    return(list(schema = PLANNER_SCHEMA, revision = 0L, secciones = list()))
  }
  fechas <- if (is.list(x$declarado_en)) x$declarado_en else list()
  secciones <- list()
  for (seccion in PLANNER_SECCIONES) {
    valor <- x[[seccion]]
    if (is.null(valor)) next
    secciones[[seccion]] <- list(
      valor = .planner_normalizar_seccion(seccion, valor),
      declarado_en = .bit_texto(fechas[[seccion]], 40L)
    )
  }
  list(schema = PLANNER_SCHEMA, revision = calc_int(x$revision, 0L, min = 0L), secciones = secciones)
}

.planner_a_persistir <- function(p) {
  out <- list(schema = PLANNER_SCHEMA, revision = p$revision,
              declarado_en = lapply(p$secciones, `[[`, "declarado_en"))
  for (seccion in names(p$secciones)) out[[seccion]] <- p$secciones[[seccion]]$valor
  out
}

.planner_leer <- function(s) .planner_normalizar(s[["planner"]] %||% NULL)

# --- Validación estricta de escritura -----------------------------------------

.planner_invalido <- function(mensaje, ...) {
  stop_api(400, "E_PLANNER_INVALIDO", mensaje, details = list(...))
}

.planner_validar_perfiles <- function(valor) {
  crudos <- .planner_registros(valor, 50L)
  tipos <- vapply(crudos, function(p) .bit_texto(p$tipo, 40L), "")
  desconocidos <- setdiff(tipos, PLANNER_TIPOS_PERFIL)
  if (length(desconocidos)) {
    .planner_invalido("Hay un perfil de recojo que el Planner no conoce.", tipos = as.list(desconocidos))
  }
  if (length(tipos) > 1L) {
    .planner_invalido("Un estudio tiene un solo tipo: dos operativos distintos son dos estudios (ADR 0124).",
                      tipos = as.list(tipos))
  }
  perfiles <- .planner_norm_perfiles(valor)
  con_calc <- vapply(perfiles, function(p) identical(p$diseno, "calc-muestra"), logical(1))
  if (sum(con_calc) > 1L) {
    .planner_invalido("Sólo un perfil puede diseñar su muestra en Cálculo de muestra.",
                      perfiles = as.list(vapply(perfiles[con_calc], `[[`, "", "tipo")))
  }
  for (p in perfiles) {
    ids <- vapply(p$poblaciones, `[[`, "", "id")
    if (anyDuplicated(ids)) {
      .planner_invalido("Dos poblaciones del mismo perfil tienen el mismo nombre.", perfil = p$tipo)
    }
  }
  perfiles
}

# ADR 0123 §2: la pantalla de perfiles no muestra la representatividad (es de
# Cálculo y aquí sólo queda de respaldo) y puede no mandar los canales o las
# bases. Lo que el cliente no manda se conserva del valor previo, en vez de que
# el normalizador lo borre o ponga los canales por defecto; la representatividad
# que llegue del cliente se ignora.
.planner_conservar_perfiles <- function(limpios, crudo, previos) {
  previos <- previos %||% list()
  crudos <- .planner_registros(crudo, 50L)
  lapply(seq_along(limpios), function(i) {
    p <- limpios[[i]]
    antes <- Filter(function(x) identical(x$tipo, p$tipo), previos)
    antes <- if (length(antes)) antes[[1]] else NULL
    mando <- if (i <= length(crudos)) crudos[[i]] else list()
    if (!is.null(antes) && is.null(mando$canales)) p$canales <- antes$canales
    pobl_antes <- if (is.null(antes)) list() else stats::setNames(antes$poblaciones, vapply(antes$poblaciones, `[[`, "", "id"))
    mando_pobl <- .planner_registros(mando$poblaciones, PLANNER_MAX_POBLACIONES)
    p$poblaciones <- lapply(seq_along(p$poblaciones), function(j) {
      x <- p$poblaciones[[j]]
      vieja <- pobl_antes[[x$id]]
      x$representatividad <- if (is.null(vieja)) NULL else vieja$representatividad
      cruda <- if (j <= length(mando_pobl)) mando_pobl[[j]] else list()
      if (!is.null(vieja) && is.null(cruda$bases)) x$bases <- vieja$bases
      x
    })
    p
  })
}

# --- Escritura -----------------------------------------------------------------

#' Declara una sección del Planner. Exige la revisión vigente y la sube en uno.
#' @keywords internal
.planner_declarar <- function(sid, seccion, valor, expected_revision) {
  if (!seccion %in% PLANNER_SECCIONES) {
    stop_api(404, "E_PLANNER_SECCION", "El Planner no tiene esa sección.", details = list(seccion = seccion))
  }
  if (seccion %in% names(PLANNER_SECCIONES_LECTURA)) {
    modulo <- PLANNER_SECCIONES_LECTURA[[seccion]]
    stop_api(409, "E_PLANNER_SECCION_RETIRADA",
             if (nzchar(modulo)) sprintf("Esa sección ya no se declara en el Planner: vive en %s.", modulo)
             else "Esa sección ya no se declara en el Planner: los insumos del cliente no se registran.",
             details = list(seccion = seccion, modulo = modulo))
  }
  if (!seccion %in% PLANNER_SECCIONES_ESCRIBIBLES) {
    stop_api(409, "E_PLANNER_SECCION_PENDIENTE",
             "Esta sección todavía no se declara desde el Planner.", details = list(seccion = seccion))
  }
  s <- session_get(sid)
  actual <- .planner_leer(s)
  esperado <- suppressWarnings(as.integer(expected_revision %||% NA))
  if (!length(esperado) || is.na(esperado) || !identical(esperado, actual$revision)) {
    stop_api(409, "E_PLANNER_DESACTUALIZADO",
             "El Planner cambió desde que lo abriste. Vuelve a cargarlo antes de guardar.",
             details = list(expected_revision = esperado, current_revision = actual$revision))
  }
  limpio <- switch(seccion,
                   perfiles = .planner_conservar_perfiles(.planner_validar_perfiles(valor), valor,
                                                          actual$secciones$perfiles$valor),
                   etapa = .planner_validar_etapa(valor),
                   ventana = .planner_validar_ventana(valor),
                   .planner_normalizar_seccion(seccion, valor))
  actual$secciones[[seccion]] <- list(valor = limpio, declarado_en = .bit_now_iso())
  actual$revision <- actual$revision + 1L
  session_set(sid, "planner", .planner_a_persistir(actual))
  invisible(actual)
}


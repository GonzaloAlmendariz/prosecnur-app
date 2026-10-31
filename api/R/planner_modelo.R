# =============================================================================
# Planner: el estudio declarado una sola vez (ADR 0122)
# =============================================================================
#
# La clave `planner` (schema `planner/v1`) guarda SÓLO lo que el equipo declaró,
# sección por sección. Lo que todavía no se declaró se proyecta al leer desde
# los lugares viejos (planner_proyeccion.R) y nunca se escribe por proyectarlo:
# así un .pulso anterior abre igual que antes y no queda marcado como
# modificado.
#
# Dueño único de la clave: este archivo y router_planner.R. Ningún otro módulo
# la escribe; la única excepción declarada es `.planner_declarar_representatividad`,
# que es la puerta por la que la F4 del ADR 0121 declara universo y variables.
#
# Vocabulario de los códigos: el mismo que ya usa Material
# (`material_territorial_formatos/v1`: codigo, rotulo, grupo), para que la
# mudanza de la fase P3 no tenga que traducir nada.

PLANNER_SCHEMA <- "planner/v1"
PLANNER_SECCIONES <- c("estudio", "perfiles", "equipo", "codigos", "insumos")
# Equipo se escribe desde que el anonimizador y el gate de datos personales
# cubren `planner$equipo$personas` (ec07d41d0; ADR 0122 §10). Si se agrega a
# las personas otro campo con datos personales, hay que avisar al anonimizador.
PLANNER_SECCIONES_ESCRIBIBLES <- c("estudio", "perfiles", "equipo", "codigos", "insumos")
PLANNER_TIPOS_PERFIL <- c("territorial", "aulas", "telefonico", "acreditacion")
PLANNER_SELECCION_AULAS <- c("conglomerados", "marco")
PLANNER_DISENO <- c("calc-muestra", "hojas-ruta", "cliente")
PLANNER_CANALES <- c("presencial", "telefono", "correo", "qr")
PLANNER_ROLES <- c("encuestador", "aplicador", "supervisor", "operador")
PLANNER_GRUPOS_CODIGO <- c("efectiva", "no_aplicada", "manzana", "otro")
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

.planner_diseno_por_tipo <- function(tipo) {
  if (identical(tipo, "territorial")) "hojas-ruta" else "calc-muestra"
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
    cliente = .bit_texto(x$cliente, 160L)
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
  list(
    tipo = tipo,
    seleccion = if (identical(tipo, "aulas")) calc_enum(x$seleccion, PLANNER_SELECCION_AULAS, "conglomerados") else NULL,
    diseno = if (identical(tipo, "territorial")) "hojas-ruta" else calc_enum(x$diseno, PLANNER_DISENO, .planner_diseno_por_tipo(tipo)),
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

.planner_norm_codigo <- function(k) {
  codigo <- .bit_texto(k$codigo, 8L)
  if (!nzchar(codigo)) return(NULL)
  retirado <- suppressWarnings(as.integer(k$retirado_en_version %||% NA))
  if (!length(retirado)) retirado <- NA_integer_
  # La UI pide retirar con `retirar: true`; la versión la pone el servidor.
  if (calc_bool(k$retirar, FALSE) && (is.na(retirado) || retirado <= 0L)) retirado <- .Machine$integer.max
  list(
    codigo = codigo,
    rotulo = .bit_texto(k$rotulo, 60L),
    grupo = calc_enum(k$grupo, PLANNER_GRUPOS_CODIGO, "otro"),
    retirado_en_version = if (!is.na(retirado) && retirado > 0L) retirado else NULL
  )
}

.planner_norm_catalogo <- function(x) {
  out <- Filter(Negate(is.null), lapply(.planner_registros(x, PLANNER_MAX_CODIGOS), .planner_norm_codigo))
  out[!duplicated(vapply(out, `[[`, "", "codigo"))]
}

.planner_norm_codigos <- function(x) {
  x <- if (is.list(x)) x else list()
  list(
    version = calc_int(x$version, 1L, min = 1L),
    resultado = .planner_norm_catalogo(x$resultado),
    status_barrido = .planner_norm_catalogo(x$status_barrido)
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

.planner_normalizar_seccion <- function(seccion, valor) {
  switch(seccion,
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
  if (anyDuplicated(tipos)) {
    .planner_invalido("Cada perfil de recojo se declara una sola vez: dos operativos del mismo tipo son dos estudios.",
                      tipo = tipos[duplicated(tipos)][[1]])
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

# Un código identifica a una sola persona: dos con el mismo código harían que
# Material asigne y Monitoreo atribuya a la persona equivocada. El código puede
# faltar (aplicadores de aulas que todavía no lo tienen); el nombre no.
.planner_validar_equipo <- function(valor) {
  equipo <- .planner_norm_equipo(valor)
  sin_nombre <- vapply(equipo$personas, function(p) !nzchar(p$nombre), logical(1))
  if (any(sin_nombre)) {
    .planner_invalido("Cada persona del equipo necesita un nombre.",
                      codigos = as.list(vapply(equipo$personas[sin_nombre], `[[`, "", "codigo")))
  }
  codigos <- vapply(equipo$personas, `[[`, "", "codigo")
  codigos <- codigos[nzchar(codigos)]
  if (anyDuplicated(codigos)) {
    .planner_invalido("Dos personas del equipo tienen el mismo código.", codigo = codigos[duplicated(codigos)][[1]])
  }
  equipo
}

# El catálogo sólo agrega (ADR 0122 §6): un código no se borra ni cambia de
# grupo; se retira. El rótulo sí se puede corregir. La versión la sube el
# servidor cuando cambia qué códigos se ofrecen.
.planner_validar_catalogo <- function(nuevo, previo, nombre) {
  previos <- stats::setNames(previo, vapply(previo, `[[`, "", "codigo"))
  codigos_nuevos <- vapply(nuevo, `[[`, "", "codigo")
  faltan <- setdiff(names(previos), codigos_nuevos)
  if (length(faltan)) {
    .planner_invalido("Un código del estudio no se borra: se retira, y se sigue leyendo en lo que ya volvió de campo.",
                      catalogo = nombre, codigos = as.list(faltan))
  }
  for (k in nuevo) {
    p <- previos[[k$codigo]]
    if (!is.null(p) && !identical(p$grupo, k$grupo)) {
      .planner_invalido("Un código no cambia de significado: retíralo y agrega uno nuevo.",
                        catalogo = nombre, codigo = k$codigo)
    }
    if (!is.null(p$retirado_en_version) && is.null(k$retirado_en_version)) {
      .planner_invalido("Un código retirado no vuelve: agrega uno nuevo.", catalogo = nombre, codigo = k$codigo)
    }
  }
  invisible(TRUE)
}

.planner_ofrecidos <- function(catalogo) {
  sort(vapply(Filter(function(k) is.null(k$retirado_en_version), catalogo), `[[`, "", "codigo"))
}

.planner_validar_codigos <- function(valor, previo) {
  nuevo <- .planner_norm_codigos(valor)
  previo <- previo %||% list(version = 1L, resultado = list(), status_barrido = list())
  .planner_validar_catalogo(nuevo$resultado, previo$resultado, "resultado")
  .planner_validar_catalogo(nuevo$status_barrido, previo$status_barrido, "status_barrido")
  cambio <- !identical(.planner_ofrecidos(nuevo$resultado), .planner_ofrecidos(previo$resultado)) ||
    !identical(.planner_ofrecidos(nuevo$status_barrido), .planner_ofrecidos(previo$status_barrido))
  version <- as.integer(previo$version %||% 1L)
  # La primera declaración es la versión 1; desde ahí, cada cambio en lo que se
  # ofrece sube una.
  version_nueva <- if (cambio && length(previo$resultado) + length(previo$status_barrido)) version + 1L else version
  # Un retiro sella con la versión en la que dejó de ofrecerse, y ese sello no
  # se reescribe después.
  sellar <- function(cat, prev) {
    prev <- stats::setNames(prev, vapply(prev, `[[`, "", "codigo"))
    lapply(cat, function(k) {
      anterior <- prev[[k$codigo]]$retirado_en_version
      if (!is.null(anterior)) {
        k$retirado_en_version <- anterior
      } else if (!is.null(k$retirado_en_version)) {
        k$retirado_en_version <- version_nueva
      }
      k
    })
  }
  nuevo$resultado <- sellar(nuevo$resultado, previo$resultado)
  nuevo$status_barrido <- sellar(nuevo$status_barrido, previo$status_barrido)
  nuevo$version <- version_nueva
  nuevo
}

# --- Escritura -----------------------------------------------------------------

#' Declara una sección del Planner. Exige la revisión vigente y la sube en uno.
#' @keywords internal
.planner_declarar <- function(sid, seccion, valor, expected_revision) {
  if (!seccion %in% PLANNER_SECCIONES) {
    stop_api(404, "E_PLANNER_SECCION", "El Planner no tiene esa sección.", details = list(seccion = seccion))
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
                   perfiles = .planner_validar_perfiles(valor),
                   equipo = .planner_validar_equipo(valor),
                   codigos = .planner_validar_codigos(valor, actual$secciones$codigos$valor),
                   .planner_normalizar_seccion(seccion, valor))
  actual$secciones[[seccion]] <- list(valor = limpio, declarado_en = .bit_now_iso())
  actual$revision <- actual$revision + 1L
  session_set(sid, "planner", .planner_a_persistir(actual))
  invisible(actual)
}

#' Puerta de la F4 del ADR 0121: declara universo y variables de una población.
#'
#' Las celdas se descartan (son del diseñador). Si los perfiles todavía no se
#' declararon, se declaran con lo proyectado más esta representatividad.
#' @keywords internal
.planner_declarar_representatividad <- function(sid, tipo, poblacion_id, bloque, expected_revision) {
  s <- session_get(sid)
  perfiles <- .planner_payload(s)$planner$perfiles
  i <- which(vapply(perfiles, `[[`, "", "tipo") == tipo)
  if (!length(i)) {
    stop_api(409, "E_PLANNER_SECCION_PENDIENTE", "El estudio no declara ese perfil de recojo.",
             details = list(tipo = tipo))
  }
  pobl <- perfiles[[i]]$poblaciones
  j <- which(vapply(pobl, `[[`, "", "id") == poblacion_id)
  if (!length(j)) {
    stop_api(409, "E_PLANNER_SECCION_PENDIENTE", "El perfil no declara esa población.",
             details = list(tipo = tipo, poblacion = poblacion_id))
  }
  perfiles[[i]]$poblaciones[[j]]$representatividad <- bloque
  .planner_declarar(sid, "perfiles", perfiles, expected_revision)
}

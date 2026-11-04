# =============================================================================
# Metas de calibración desde el CPV 2025 (ADR 0131 paso 5).
#
# Lee los márgenes distritales que publica el INEI en REDATAM (base CPV2025DI)
# y los agrega al ámbito que pide el analista: unos distritos, unas provincias o
# todo el conjunto. Devuelve, por variable, la población de cada categoría del
# censo; el mapeo a las categorías de la base lo hace la UI y el motor de
# ponderación recibe conteos (`targets`).
#
#   - sexo y grupos de edad: cpv2025_edad_simple_distrito.csv.gz (edad simple
#     × sexo, todas las edades), con los grupos que define el analista;
#   - nivel educativo: cpv2025_margenes_distrito.csv.gz (sexo × quinquenio ×
#     13 niveles, 18 años a más), agrupado según una agrupación declarada.
#
# Universo: población CENSADA. No incluye la omisión censal estimada por el
# INEI (unos 1,45 millones en el país), así que N̂ de una expansión con estas
# metas es la población censada, no la población estimada.
# =============================================================================

PONDERACION_CPV2025_FUENTE <- "INEI, Censos Nacionales 2025 (CPV 2025), REDATAM base CPV2025DI"

# Agrupaciones del nivel educativo (códigos S5_P13 del INEI, 1-13). Básica
# especial (5) va con «Hasta primaria» y la superior incompleta con su rama.
PONDERACION_CPV2025_EDUCACION <- list(
  "4_grupos" = list(
    list(codigo = "hasta_primaria", etiqueta = "Hasta primaria", niveles = c(1L, 2L, 3L, 5L)),
    list(codigo = "secundaria", etiqueta = "Secundaria", niveles = 4L),
    list(codigo = "superior_no_universitaria", etiqueta = "Superior no universitaria", niveles = 6:7),
    list(codigo = "superior_universitaria", etiqueta = "Superior universitaria o posgrado", niveles = 8:13)
  ),
  "3_grupos" = list(
    list(codigo = "hasta_primaria", etiqueta = "Hasta primaria", niveles = c(1L, 2L, 3L, 5L)),
    list(codigo = "secundaria", etiqueta = "Secundaria", niveles = 4L),
    list(codigo = "superior", etiqueta = "Superior o posgrado", niveles = 6:13)
  ),
  "13_niveles" = NULL # se arma con los rótulos del archivo
)

PONDERACION_CPV2025_GRUPOS_EDAD_DEFAULT <- list(
  list(etiqueta = "18 a 24", min = 18L, max = 24L),
  list(etiqueta = "25 a 34", min = 25L, max = 34L),
  list(etiqueta = "35 a 44", min = 35L, max = 44L),
  list(etiqueta = "45 a 54", min = 45L, max = 54L),
  list(etiqueta = "55 a 64", min = 55L, max = 64L),
  list(etiqueta = "65 a más", min = 65L, max = NA_integer_)
)

.pond_cpv_cache <- new.env(parent = emptyenv())

.pond_cpv_path <- function(archivo) {
  .hojas_ruta_inst_path("hojas_ruta", archivo)
}

# Lee los dos archivos y el nomenclátor (una vez por proceso).
.pond_cpv_datos <- function() {
  if (!is.null(.pond_cpv_cache$datos)) return(.pond_cpv_cache$datos)
  leer <- function(archivo) {
    p <- .pond_cpv_path(archivo)
    if (!file.exists(p)) {
      stop_api(500, "E_PONDERACION_CPV_SIN_DATOS",
               sprintf("No se encontró el archivo del CPV 2025 '%s' en el paquete.", archivo))
    }
    utils::read.csv(p, colClasses = c(ubigeo = "character"), stringsAsFactors = FALSE,
                    encoding = "UTF-8")
  }
  edad <- leer("cpv2025_edad_simple_distrito.csv.gz")
  marg <- leer("cpv2025_margenes_distrito.csv.gz")
  # Nombres: el CPV 2025 de REDATAM no los trae; salen del nomenclátor 2017
  # que ya usa Hojas de ruta (los 164 ubigeos están en uno de los dos).
  nom_cols <- c("ubigeo", "departamento", "provincia", "distrito")
  nombres <- tryCatch({
    a <- leer("inei2017_ciudades_edad_simple_distrito.csv.gz")[, nom_cols]
    b <- leer("inei2017_lima_callao_edad_simple_distrito.csv")[, nom_cols]
    unique(rbind(a, b))
  }, error = function(e) data.frame(ubigeo = character(0), departamento = character(0),
                                    provincia = character(0), distrito = character(0)))
  nombres <- nombres[!duplicated(nombres$ubigeo), , drop = FALSE]
  ubigeos <- sort(unique(edad$ubigeo))
  nom <- nombres[match(ubigeos, nombres$ubigeo), , drop = FALSE]
  titulo <- function(x) {
    x <- tolower(as.character(x))
    gsub("(^|[ (])([[:alpha:]])", "\\1\\U\\2", x, perl = TRUE)
  }
  pob18 <- tapply(marg$poblacion, marg$ubigeo, sum)
  pob <- tapply(edad$poblacion, edad$ubigeo, sum)
  distritos <- data.frame(
    ubigeo = ubigeos,
    provincia_codigo = substr(ubigeos, 1, 4),
    departamento = titulo(ifelse(is.na(nom$departamento), "", nom$departamento)),
    provincia = titulo(ifelse(is.na(nom$provincia), "", nom$provincia)),
    distrito = titulo(ifelse(is.na(nom$distrito), ubigeos, nom$distrito)),
    poblacion = as.numeric(pob[ubigeos]),
    poblacion_18 = as.numeric(pob18[ubigeos]),
    stringsAsFactors = FALSE
  )
  niveles <- unique(marg[, c("nivel_codigo", "nivel_educativo")])
  niveles <- niveles[order(niveles$nivel_codigo), , drop = FALSE]
  datos <- list(
    edad = edad, marg = marg, distritos = distritos, niveles = niveles,
    consultado = as.character(marg$consultado[[1]] %||% ""),
    universo_educacion = as.character(marg$universo[[1]] %||% "")
  )
  .pond_cpv_cache$datos <- datos
  datos
}

# GET de apoyo: los distritos que cubre el archivo, agrupados por provincia.
ponderacion_cpv2025_distritos <- function() {
  d <- .pond_cpv_datos()
  dd <- d$distritos
  prov <- unique(dd[, c("provincia_codigo", "departamento", "provincia")])
  prov$n_distritos <- as.integer(table(dd$provincia_codigo)[prov$provincia_codigo])
  list(
    fuente = PONDERACION_CPV2025_FUENTE,
    universo = "Población censada (no incluye la omisión censal estimada)",
    consultado = d$consultado,
    distritos = dd,
    provincias = prov,
    agrupaciones_educacion = list(
      list(codigo = "4_grupos", etiqueta = "4 grupos"),
      list(codigo = "3_grupos", etiqueta = "3 grupos"),
      list(codigo = "13_niveles", etiqueta = "13 niveles del censo")
    ),
    grupos_edad_default = PONDERACION_CPV2025_GRUPOS_EDAD_DEFAULT
  )
}

.pond_cpv_chr <- function(x) {
  x <- unlist(x %||% character(0), use.names = FALSE)
  x <- trimws(as.character(x))
  unique(x[!is.na(x) & nzchar(x)])
}

# Grupos de edad declarados → data.frame(etiqueta, min, max) validado.
.pond_cpv_grupos_edad <- function(grupos) {
  if (!length(grupos)) grupos <- PONDERACION_CPV2025_GRUPOS_EDAD_DEFAULT
  num <- function(v) {
    v <- if (is.null(v) || !length(v)) NA else v[[1]]
    if (is.null(v)) NA_integer_ else suppressWarnings(as.integer(v))
  }
  g <- data.frame(
    etiqueta = vapply(grupos, function(x) trimws(as.character(x$etiqueta %||% "")[1]), character(1)),
    min = vapply(grupos, function(x) num(x$min), integer(1)),
    max = vapply(grupos, function(x) num(x$max), integer(1)),
    stringsAsFactors = FALSE
  )
  vacia <- !nzchar(g$etiqueta)
  g$etiqueta[vacia] <- ifelse(is.na(g$max[vacia]), sprintf("%s a más", g$min[vacia]),
                              sprintf("%s a %s", g$min[vacia], g$max[vacia]))
  malo <- function(msg) {
    stop_api(422, "E_PONDERACION_CPV_GRUPOS_EDAD_INVALIDOS", msg,
             details = list(grupos_edad = grupos))
  }
  if (any(is.na(g$min) | g$min < 0)) malo("Cada grupo de edad necesita una edad mínima (0 o más).")
  if (any(!is.na(g$max) & g$max < g$min)) malo("Un grupo de edad tiene la edad máxima menor que la mínima.")
  if (anyDuplicated(g$etiqueta)) malo("Dos grupos de edad tienen el mismo rótulo.")
  g <- g[order(g$min), , drop = FALSE]
  if (nrow(g) > 1) {
    fin <- ifelse(is.na(g$max), Inf, g$max)
    if (any(utils::head(fin, -1) >= utils::tail(g$min, -1))) {
      malo("Los grupos de edad se superponen: cada edad va en un solo grupo.")
    }
  }
  g
}

# Edades (0..124) que cubren los grupos.
.pond_cpv_edades <- function(g, edad_max = 124L) {
  sort(unique(unlist(lapply(seq_len(nrow(g)), function(i) {
    hi <- if (is.na(g$max[i])) edad_max else min(g$max[i], edad_max)
    if (hi < g$min[i]) integer(0) else seq.int(g$min[i], hi)
  }))))
}

# Ámbito: distritos explícitos, o provincias, o todo el conjunto.
.pond_cpv_ambito <- function(d, distritos, provincias) {
  todos <- d$distritos$ubigeo
  if (length(distritos)) {
    faltan <- setdiff(distritos, todos)
    if (length(faltan)) {
      stop_api(422, "E_PONDERACION_CPV_AMBITO_DESCONOCIDO",
               sprintf("El CPV 2025 de la app no trae estos distritos: %s.", paste(faltan, collapse = ", ")),
               details = list(distritos = faltan))
    }
    return(list(nivel = "distritos", ubigeos = distritos))
  }
  if (length(provincias)) {
    faltan <- setdiff(provincias, d$distritos$provincia_codigo)
    if (length(faltan)) {
      stop_api(422, "E_PONDERACION_CPV_AMBITO_DESCONOCIDO",
               sprintf("El CPV 2025 de la app no trae estas provincias: %s.", paste(faltan, collapse = ", ")),
               details = list(provincias = faltan))
    }
    return(list(nivel = "provincias", ubigeos = todos[d$distritos$provincia_codigo %in% provincias]))
  }
  list(nivel = "conjunto", ubigeos = todos)
}

.pond_cpv_margen <- function(variable, etiqueta, codigos, etiquetas, poblacion) {
  list(
    variable = variable,
    etiqueta = etiqueta,
    total = sum(poblacion),
    categorias = lapply(seq_along(codigos), function(i) {
      list(codigo = codigos[[i]], etiqueta = etiquetas[[i]], poblacion = as.numeric(poblacion[[i]]))
    })
  )
}

# POST: márgenes del CPV 2025 en el ámbito pedido. Parámetros (todos opcionales):
#   distritos: ubigeos · provincias: códigos de 4 dígitos (sin ambos: todo el conjunto)
#   grupos_edad: [{etiqueta, min, max|null}] · agrupacion_educacion: "4_grupos"|"3_grupos"|"13_niveles"
#   desagregacion: "ninguna"|"distrito"|"provincia" (agrega un margen geográfico)
ponderacion_cpv2025_metas <- function(params = list()) {
  params <- params %||% list()
  d <- .pond_cpv_datos()
  amb <- .pond_cpv_ambito(d, .pond_cpv_chr(params$distritos), .pond_cpv_chr(params$provincias))
  g <- .pond_cpv_grupos_edad(params$grupos_edad)
  edades <- .pond_cpv_edades(g)
  avisos <- list()

  e <- d$edad[d$edad$ubigeo %in% amb$ubigeos & d$edad$edad %in% edades, , drop = FALSE]
  total <- sum(e$poblacion)

  margenes <- list()
  sx <- tapply(e$poblacion, e$sexo, sum)
  sx_cod <- intersect(c("Hombre", "Mujer"), names(sx))
  margenes[[length(margenes) + 1L]] <- .pond_cpv_margen("sexo", "Sexo", sx_cod, sx_cod, as.numeric(sx[sx_cod]))

  pob_grupo <- vapply(seq_len(nrow(g)), function(i) {
    hi <- if (is.na(g$max[i])) Inf else g$max[i]
    sum(e$poblacion[e$edad >= g$min[i] & e$edad <= hi])
  }, numeric(1))
  margenes[[length(margenes) + 1L]] <- .pond_cpv_margen("edad", "Grupo de edad", g$etiqueta, g$etiqueta, pob_grupo)

  # Nivel educativo: el cuadro es 18+ por quinquenio. Solo se puede si las
  # edades pedidas son una unión de quinquenios enteros desde los 18.
  agr <- as.character(params$agrupacion_educacion %||% "4_grupos")[1]
  if (!agr %in% names(PONDERACION_CPV2025_EDUCACION)) agr <- "4_grupos"
  bins <- unique(d$marg[, c("edad_min", "edad_max")])
  bin_hi <- ifelse(is.na(bins$edad_max), 124L, bins$edad_max)
  dentro <- vapply(seq_len(nrow(bins)), function(i) {
    r <- seq.int(bins$edad_min[i], bin_hi[i])
    if (all(r %in% edades)) "si" else if (any(r %in% edades)) "parcial" else "no"
  }, character(1))
  fuera_18 <- any(edades < 18L)
  if (fuera_18 || any(dentro == "parcial")) {
    corte <- if (fuera_18) {
      "incluyen menores de 18 años y el cuadro del nivel educativo es de 18 a más"
    } else {
      "cortan un quinquenio del cuadro del nivel educativo (18-19, 20-24, 25-29, …, 85 a más)"
    }
    avisos[[length(avisos) + 1L]] <- list(
      level = "info", code = "educacion_no_disponible",
      message = sprintf("Sin margen de nivel educativo: los grupos de edad %s.", corte)
    )
  } else {
    bins_si <- bins[dentro == "si", , drop = FALSE]
    m <- d$marg[d$marg$ubigeo %in% amb$ubigeos &
                  paste(d$marg$edad_min, d$marg$edad_max) %in% paste(bins_si$edad_min, bins_si$edad_max), , drop = FALSE]
    grupos_ed <- PONDERACION_CPV2025_EDUCACION[[agr]] %||% lapply(seq_len(nrow(d$niveles)), function(i) {
      list(codigo = as.character(d$niveles$nivel_codigo[i]), etiqueta = d$niveles$nivel_educativo[i],
           niveles = d$niveles$nivel_codigo[i])
    })
    pob_ed <- vapply(grupos_ed, function(x) sum(m$poblacion[m$nivel_codigo %in% x$niveles]), numeric(1))
    margenes[[length(margenes) + 1L]] <- .pond_cpv_margen(
      "educacion", "Nivel educativo",
      vapply(grupos_ed, `[[`, character(1), "codigo"),
      vapply(grupos_ed, `[[`, character(1), "etiqueta"), pob_ed
    )
    dif <- sum(pob_ed) - total
    if (abs(dif) > 0) {
      avisos[[length(avisos) + 1L]] <- list(
        level = "warn", code = "totales_inconsistentes",
        message = sprintf("El cuadro del nivel educativo suma %s y el de edad %s en el mismo ámbito (diferencia %s): son dos consultas distintas a REDATAM.",
                          format(sum(pob_ed), big.mark = ","), format(total, big.mark = ","),
                          format(dif, big.mark = ","))
      )
    }
  }

  desag <- as.character(params$desagregacion %||% "ninguna")[1]
  dd <- d$distritos[d$distritos$ubigeo %in% amb$ubigeos, , drop = FALSE]
  if (identical(desag, "distrito")) {
    pob <- tapply(e$poblacion, e$ubigeo, sum)
    margenes[[length(margenes) + 1L]] <- .pond_cpv_margen(
      "distrito", "Distrito", dd$ubigeo, dd$distrito, as.numeric(pob[dd$ubigeo] %||% 0)
    )
  } else if (identical(desag, "provincia")) {
    pob <- tapply(e$poblacion, substr(e$ubigeo, 1, 4), sum)
    pv <- unique(dd[, c("provincia_codigo", "provincia")])
    margenes[[length(margenes) + 1L]] <- .pond_cpv_margen(
      "provincia", "Provincia", pv$provincia_codigo, pv$provincia, as.numeric(pob[pv$provincia_codigo])
    )
  } else {
    desag <- "ninguna"
  }

  rango <- if (is.na(max(g$max))) sprintf("%d años a más", min(g$min)) else sprintf("%d a %d años", min(g$min), max(g$max, na.rm = TRUE))
  list(
    ok = TRUE,
    fuente = PONDERACION_CPV2025_FUENTE,
    universo = sprintf("Población censada de %s; no incluye la omisión censal estimada", rango),
    consultado = d$consultado,
    ambito = list(
      nivel = amb$nivel,
      n_distritos = length(amb$ubigeos),
      ubigeos = amb$ubigeos,
      provincias = unique(dd$provincia_codigo)
    ),
    grupos_edad = lapply(seq_len(nrow(g)), function(i) {
      list(etiqueta = g$etiqueta[i], min = g$min[i], max = if (is.na(g$max[i])) NULL else g$max[i])
    }),
    agrupacion_educacion = agr,
    desagregacion = desag,
    total = total,
    margenes = margenes,
    avisos = avisos
  )
}

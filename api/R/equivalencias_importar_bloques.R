# Importador de la matriz de correspondencias por bloques (contrato E4-E7, R3)
# ===========================================================================
#
# La matriz que los equipos escriben para una serie de mediciones no es una
# tabla de una fila por pregunta: es un documento por BLOQUES. HSyVbG PUCP
# 2022-2026 (hoja «Matriz de correspondencias», 100 bloques):
#
#   A: ID (S-04)   B: eje   C: nombre / rótulo de fila   D..H: un año por columna
#   I: nivel de comparabilidad   J: observación
#
#   S-04 | 2. Sociodemográficas | Orientación sexual | | | ... | Parcialmente comparable | obs
#        |                      | N.º de pregunta    | P4 | P4 | ...
#        |                      | Enunciado          | ...
#        |                      | Variable en la base de datos | P5 | P6 | orientacion_sexual | P4 | (pendiente)
#        |                      | Heterosexual       | Heterosexual [6] | ... | Heterosexual [1]
#        |                      | Homosexual — gay   | Hombre homosexual [1] | ... | Homosexual (gay/lesbiana) [2] — fusionadas
#
# Las filas de categoría dicen «etiqueta [código]» por año; «—» o vacío es que
# ese año no existía. Marcas como «≈», «— fusionadas» o «[ESPECIFICA]» se
# ignoran: el código es el primer número entre corchetes.
#
# Qué produce: filas de la matriz de equivalencias (ADR 0062) con `id`,
# `seccion` (= eje), `etiqueta_estandar` (= nombre del bloque), `variables`
# por base y `armonizacion` (ver equivalencias_armonizacion.R). Las columnas de
# año se atan a bases del estudio por `mapa_periodos` {"2024": "<base>"}; los
# años sin base se ignoran.
#
# Qué valida: cada «[código]» contra la lista de opciones de la variable en el
# instrumento de la base (rp_inst_sources). Un código inexistente o una
# etiqueta distinta no aborta: se reporta por fila. La guía de la matriz manda
# recodificar por etiqueta; la advertencia es lo que lo hace verificable.
#
# Decisiones:
#   - Código armonizado = orden 1..n de las categorías del bloque; una categoría
#     cuyo código es el MISMO especial 80-99 en todas las bases lo conserva y va
#     al final (invariante de valores especiales).
#   - Fusión: si una base usa el mismo código en dos categorías del bloque
#     («Homosexual (gay/lesbiana) [2]» en las filas gay y lesbiana), esas
#     categorías se funden en UNA de la escala para todas las bases; si no, el
#     mapa tendría un código con dos destinos y la serie no compararía lo mismo.
#   - Categorías que no existen en ninguna base mapeada no entran a la escala.
#   - Variable «(pendiente)», un rango («P14 a P49») o algo que no es una sola
#     variable deja esa base sin variable y advierte; el mapa de la base se
#     guarda igual (sale del cuestionario) para cuando se complete la variable.

.EQUIV_BLOQUES_HOJA <- "Matriz de correspondencias"
.EQUIV_BLOQUES_NO_COMPARABLE <- "no_comparable"

.equiv_bloques_txt <- function(x) {
  x <- as.character(x)
  x[is.na(x)] <- ""
  x <- gsub("[ \\s]+", " ", x, perl = TRUE)
  trimws(x)
}

# «—», «–», «-» (solos o seguidos de una nota) o vacío: ese año no existía.
.equiv_bloques_es_ausente <- function(x) {
  x <- .equiv_bloques_txt(x)
  !nzchar(x) | grepl("^[—–-]+(\\s|$)", x, perl = TRUE)
}

# Una celda de categoría: código = primer número entre corchetes; etiqueta = lo
# que va antes. «Otros [10] [ESPECIFICA]» -> 10 «Otros»; «No [2] → FINALIZAR»
# -> 2 «No»; «____ años cumplidos [18 o más años]» -> sin código.
.equiv_bloques_celda <- function(x) {
  x <- .equiv_bloques_txt(x)
  if (.equiv_bloques_es_ausente(x)) return(list(existe = FALSE, codigo = NA_character_, etiqueta = ""))
  m <- regexpr("\\[\\s*-?[0-9]+\\s*\\]", x, perl = TRUE)
  if (m < 0) return(list(existe = TRUE, codigo = NA_character_, etiqueta = x))
  codigo <- gsub("[^0-9-]", "", regmatches(x, m))
  etiqueta <- substr(x, 1L, m - 1L)
  etiqueta <- trimws(gsub("\\s+", " ", gsub("≈", " ", etiqueta)))
  list(existe = TRUE, codigo = .codif_agrupar_codigo_chr(codigo), etiqueta = etiqueta)
}

# Celda de «Variable en la base de datos».
.equiv_bloques_variable <- function(x) {
  x <- .equiv_bloques_txt(x)
  if (.equiv_bloques_es_ausente(x)) return(list(estado = "ausente", variable = "", texto = x))
  if (grepl("pendiente", x, ignore.case = TRUE)) return(list(estado = "pendiente", variable = "", texto = x))
  if (grepl("^[A-Za-z][A-Za-z0-9_.]*$", x)) {
    return(list(estado = "ok", variable = .equiv_var_canonica(x), texto = x))
  }
  list(estado = "multiple", variable = "", texto = x)
}

.equiv_bloques_invalida <- function(msg, details = NULL) {
  stop_api(400, "E_EQUIV_BLOQUES_FORMATO", msg, details)
}

# Encabezado: la primera fila cuya columna A dice «ID». Los años se reconocen
# por su texto (19xx/20xx); nivel y observación por nombre, con I/J de reserva.
.equiv_bloques_encabezado <- function(m) {
  col_a <- .equiv_norm_col(m[, 1])
  fila <- which(col_a == "id")[1]
  if (is.na(fila)) {
    .equiv_bloques_invalida(
      "La hoja no tiene la fila de títulos con «ID» en la columna A; no es una matriz por bloques.")
  }
  tit <- .equiv_bloques_txt(m[fila, ])
  es_anio <- grepl("^(19|20)[0-9]{2}$", tit)
  if (!any(es_anio)) {
    .equiv_bloques_invalida("La fila de títulos no trae columnas de año (2024, 2025, ...).")
  }
  norm <- .equiv_norm_col(tit)
  col_nivel <- which(grepl("nivel", norm) & grepl("comparab", norm))[1]
  if (is.na(col_nivel)) col_nivel <- 9L
  col_obs <- which(startsWith(norm, "observacion"))[1]
  if (is.na(col_obs)) col_obs <- 10L
  list(fila = fila, anios = stats::setNames(which(es_anio), tit[es_anio]),
       col_nivel = col_nivel, col_obs = col_obs)
}

.equiv_bloques_tipo_fila <- function(rotulo) {
  r <- .equiv_norm_col(rotulo)
  if (grepl("^n.*_de_pregunta$", r) || r %in% c("n_de_pregunta", "no_de_pregunta", "numero_de_pregunta")) {
    return("numero")
  }
  if (r == "enunciado") return("enunciado")
  if (startsWith(r, "variable_en_la_base")) return("variable")
  "categoria"
}

# Matriz de texto -> bloques. Puro: no conoce la sesión.
.equiv_bloques_parsear <- function(m) {
  m <- as.matrix(m)
  storage.mode(m) <- "character"
  if (ncol(m) < 3L) .equiv_bloques_invalida("La hoja tiene menos de tres columnas.")
  enc <- .equiv_bloques_encabezado(m)
  celda <- function(i, j) if (j <= ncol(m)) .equiv_bloques_txt(m[i, j]) else ""
  anios <- names(enc$anios)

  bloques <- list()
  actual <- NULL
  cerrar <- function() if (!is.null(actual)) bloques[[length(bloques) + 1L]] <<- actual
  if (enc$fila < nrow(m)) for (i in seq.int(enc$fila + 1L, nrow(m))) {
    id <- celda(i, 1L)
    if (nzchar(id)) {
      cerrar()
      actual <- list(
        id = id, eje = celda(i, 2L), nombre = celda(i, 3L),
        nivel = celda(i, enc$col_nivel), observacion = celda(i, enc$col_obs),
        numero = list(), enunciado = list(), variable = list(), categorias = list()
      )
      next
    }
    if (is.null(actual)) next
    rotulo <- celda(i, 3L)
    valores <- stats::setNames(vapply(enc$anios, function(j) celda(i, j), character(1)), anios)
    if (!nzchar(rotulo) && !any(nzchar(valores))) next
    tipo <- .equiv_bloques_tipo_fila(rotulo)
    if (tipo == "categoria") {
      actual$categorias[[length(actual$categorias) + 1L]] <- list(etiqueta = rotulo, celdas = as.list(valores))
    } else {
      actual[[tipo]] <- as.list(valores)
    }
  }
  cerrar()
  list(anios = anios, bloques = bloques)
}

# Funde categorías que una base nombra con el mismo código (union-find simple).
.equiv_bloques_grupos <- function(cats, bases) {
  n <- length(cats)
  grupo <- seq_len(n)
  raiz <- function(k) { while (grupo[k] != k) k <- grupo[k]; k }
  fusiones <- list()
  for (b in bases) {
    cods <- vapply(cats, function(c) c$codigos[[b]] %||% NA_character_, character(1))
    for (cd in unique(cods[!is.na(cods)])) {
      idx <- which(cods == cd)
      if (length(idx) < 2L) next
      r <- raiz(idx[1])
      for (k in idx[-1]) grupo[raiz(k)] <- r
      fusiones[[length(fusiones) + 1L]] <- list(base = b, codigo = cd, filas = idx)
    }
  }
  list(grupo = vapply(seq_len(n), raiz, integer(1)), fusiones = fusiones)
}

.equiv_bloques_es_especial <- function(cd) {
  v <- suppressWarnings(as.numeric(cd))
  !is.na(v) & v >= 80 & v < 100
}

# «Otro», «Otros», «Otra», «Otro (especifique)»: la categoría residual. No es
# un año aunque su código no sea especial (S-08 real: «Otros [10]»).
.equiv_bloques_es_residual <- function(x) {
  r <- .equiv_norm_col(x)
  r %in% c("otro", "otros", "otra") | startsWith(r, "otro")
}

.equiv_bloques_es_anio <- function(x) grepl("^(19|20)[0-9]{2}$", trimws(as.character(x)))

# ¿Todas las categorías no especiales del bloque son años de 4 dígitos? Mira
# las etiquetas por base («2023 [5]»), que son las que el cuestionario
# ofrecía. Si una categoría no trae etiqueta en ninguna base, su rótulo de
# fila. No cuentan las especiales 80-99 ni la residual («Otros [10]»): ni una
# ni otra es una cohorte. Hacen falta dos categorías.
.equiv_bloques_es_cohorte <- function(cats) {
  sust <- Filter(function(c) {
    if (all(vapply(unlist(c$codigos), .equiv_bloques_es_especial, logical(1)))) return(FALSE)
    etqs <- c(c$etiqueta, unlist(c$etiquetas, use.names = FALSE))
    !any(.equiv_bloques_es_residual(etqs[nzchar(trimws(etqs))]))
  }, cats)
  if (length(sust) < 2L) return(FALSE)
  all(vapply(sust, function(c) {
    etqs <- unlist(c$etiquetas, use.names = FALSE)
    etqs <- etqs[nzchar(trimws(etqs))]
    if (!length(etqs)) etqs <- c$etiqueta
    length(etqs) > 0L && all(.equiv_bloques_es_anio(etqs))
  }, logical(1)))
}

# En un bloque de cohorte, ¿la base guarda el año COMO código (2017…2025)
# mientras la matriz nombra posiciones (1..n)? Entonces el mapa por código de
# la matriz no casa con ningún dato de esa base. Devuelve los años-código de la
# base, o NULL si no aplica. Basta con que la mayoría de opciones sean años:
# la lista real trae además «Otro [88]» y un «Selecciona una respuesta [0]».
.equiv_bloques_codigos_anio <- function(variable, codigos_matriz, inst) {
  if (is.null(variable) || !nzchar(variable) || is.null(inst)) return(NULL)
  opciones <- .equiv_escala_opciones(inst, variable)
  if (!length(opciones)) return(NULL)
  cods <- vapply(opciones, function(o) .codif_agrupar_codigo_chr(o$codigo), character(1))
  anios <- cods[.equiv_bloques_es_anio(cods)]
  if (length(anios) < 2L || length(anios) * 2L <= length(cods)) return(NULL)
  if (any(.equiv_bloques_es_anio(codigos_matriz))) return(NULL)
  sort(as.integer(anios))
}

# Enunciado de la fila: el de la base mapeada más reciente que lo trae; si
# ninguna, el primero no vacío de la hoja. Sin marcas de la matriz.
.equiv_bloques_enunciado <- function(enunciados, anios_mapeados) {
  limpiar <- function(x) {
    x <- gsub("≈", " ", .equiv_bloques_txt(x))
    x <- gsub("\\[[A-ZÁÉÍÓÚÑ ]+\\]", " ", x, perl = TRUE)
    trimws(gsub("\\s+", " ", x))
  }
  orden <- c(rev(sort(anios_mapeados)), names(enunciados))
  for (a in unique(orden)) {
    x <- enunciados[[a]] %||% ""
    if (.equiv_bloques_es_ausente(x)) next
    x <- limpiar(x)
    if (nzchar(x)) return(x)
  }
  ""
}

# Un bloque -> fila de la matriz + advertencias. `periodos` es el mapa_periodos
# ya validado (año -> base) y `inst_por_base` los instrumentos de la sesión.
.equiv_bloques_a_fila <- function(bloque, periodos, inst_por_base) {
  adv <- list()
  avisar <- function(base, tipo, mensaje) {
    adv[[length(adv) + 1L]] <<- list(id = bloque$id, base = base, tipo = tipo, mensaje = mensaje)
  }
  bases <- unname(periodos)
  anio_de <- stats::setNames(names(periodos), bases)

  # Variables por base.
  variables <- list()
  for (b in bases) {
    v <- .equiv_bloques_variable(bloque$variable[[anio_de[[b]]]] %||% "")
    if (v$estado == "ok") {
      inst <- inst_por_base[[b]]
      nombres <- as.character(((inst %||% list())$survey %||% list(name = character(0)))$name)
      if (is.null(inst)) {
        variables[[b]] <- v$variable
        avisar(b, "sin_instrumento", sprintf(
          "La base «%s» no tiene instrumento cargado: «%s» no se pudo comprobar.", b, v$variable))
      } else if (!v$variable %in% nombres) {
        avisar(b, "variable_inexistente", sprintf(
          "La variable «%s» no existe en la base «%s»; la fila queda sin variable para esa base.",
          v$variable, b))
      } else {
        variables[[b]] <- v$variable
      }
    } else if (v$estado == "pendiente") {
      avisar(b, "variable_pendiente", sprintf(
        "La matriz deja la variable de %s como «%s»; complétala en la matriz de la app.",
        anio_de[[b]], v$texto))
    } else if (v$estado == "multiple") {
      avisar(b, "variable_no_unica", sprintf(
        "«%s» no es una sola variable; la fila queda sin variable para «%s».", v$texto, b))
    }
  }

  # Categorías con código en al menos una base mapeada.
  cats <- list()
  for (c in bloque$categorias) {
    codigos <- list()
    etiquetas <- list()
    for (b in bases) {
      p <- .equiv_bloques_celda(c$celdas[[anio_de[[b]]]] %||% "")
      if (p$existe && !is.na(p$codigo)) {
        codigos[[b]] <- p$codigo
        etiquetas[[b]] <- p$etiqueta
      }
    }
    if (!length(codigos)) next
    cats[[length(cats) + 1L]] <- list(etiqueta = gsub("\\s+", " ", c$etiqueta),
                                      codigos = codigos, etiquetas = etiquetas)
  }

  # Año de ingreso, años de estudio y similares (R4b, punto 6): si las
  # categorías con código del bloque son años de calendario, el mismo rótulo
  # no es la misma cohorte en otra medición («2023» es primer año en 2024 y
  # segundo en 2025). Ese bloque se armoniza por base y A MANO, relativo al año
  # de medición (primer año, segundo año…), con el mapa de cada base declarado
  # en la matriz de la app. El importador no lo infiere: sólo avisa. Las
  # categorías cuyos códigos son todos especiales 80-99 («Otro», «No responde»)
  # no cuentan para decidir.
  if (.equiv_bloques_es_cohorte(cats)) {
    avisar("", "cohorte_por_etiqueta", sprintf(
      "Las categorías de «%s» son años de calendario: el mismo año no es la misma cohorte en otra medición. Declara el mapa de cada base a mano, relativo al año de medición.",
      bloque$nombre))
    for (b in bases) {
      cods_m <- unlist(lapply(cats, function(c) c$codigos[[b]]), use.names = FALSE)
      anios <- .equiv_bloques_codigos_anio(variables[[b]], cods_m, inst_por_base[[b]])
      if (is.null(anios)) next
      avisar(b, "cohorte_codigo_anio", sprintf(
        "La base «%s» guarda el año como código (%d…%d); la matriz usa posiciones. Declara el mapa de esta fila a mano.",
        b, min(anios), max(anios)))
    }
  }

  armonizacion <- NULL
  if (!length(cats)) {
    if (length(bloque$categorias)) {
      avisar("", "sin_codigos", "El bloque no declara categorías con «[código]»; se importa sin armonización.")
    }
  } else {
    gr <- .equiv_bloques_grupos(cats, bases)
    for (f in gr$fusiones) {
      avisar(f$base, "fusion", sprintf(
        "El código [%s] de «%s» agrupa %s; se funden en una sola categoría de la escala.",
        f$codigo, f$base,
        paste0("«", vapply(cats[f$filas], function(c) c$etiqueta, character(1)), "»", collapse = " y ")))
    }
    raices <- unique(gr$grupo)
    # Código armonizado por grupo: si en ALGUNA base la categoría usa un especial
    # 80-99 («Otro», «No sé», «No responde»), la escala conserva el especial más
    # frecuente entre bases. Así la no respuesta de 2022 codificada [0] no entra
    # como categoría válida en los denominadores del comparativo. Si dos grupos
    # piden el mismo especial, el segundo cae al orden.
    especial <- vapply(raices, function(r) {
      cds <- unlist(lapply(cats[gr$grupo == r], function(c) unlist(c$codigos)))
      esp <- cds[vapply(cds, .equiv_bloques_es_especial, logical(1))]
      if (!length(esp)) return(NA_character_)
      names(sort(table(esp), decreasing = TRUE))[1]
    }, character(1))
    especial[duplicated(especial) & !is.na(especial)] <- NA_character_
    usados <- especial[!is.na(especial)]
    siguiente <- 0L
    codigo_de <- character(length(raices))
    for (k in seq_along(raices)) {
      if (!is.na(especial[k])) { codigo_de[k] <- especial[k]; next }
      repeat { siguiente <- siguiente + 1L; if (!as.character(siguiente) %in% usados) break }
      codigo_de[k] <- as.character(siguiente)
    }
    etiqueta_de <- vapply(seq_along(raices), function(k) {
      miembros <- which(gr$grupo == raices[k])
      if (length(miembros) == 1L) return(cats[[miembros]]$etiqueta)
      # Fundidas: el rótulo de la base que las funde dice qué son juntas.
      for (b in bases) {
        cds <- vapply(cats[miembros], function(c) c$codigos[[b]] %||% NA_character_, character(1))
        if (sum(!is.na(cds)) >= 2L && length(unique(cds[!is.na(cds)])) == 1L) {
          return(cats[[miembros[which(!is.na(cds))[1]]]]$etiquetas[[b]])
        }
      }
      paste(vapply(cats[miembros], function(c) c$etiqueta, character(1)), collapse = " / ")
    }, character(1))
    orden <- order(!is.na(especial), suppressWarnings(as.numeric(codigo_de)))
    escala <- lapply(orden, function(k) list(codigo = codigo_de[k], etiqueta = etiqueta_de[k]))

    comparable <- !identical(.equiv_norm_col(bloque$nivel), .EQUIV_BLOQUES_NO_COMPARABLE)
    nota <- .equiv_bloques_txt(bloque$observacion)
    por_base <- list()
    for (b in bases) {
      mapa <- .equiv_armon_mapa_vacio()
      etq <- list()
      for (k in seq_along(raices)) {
        for (c in cats[gr$grupo == raices[k]]) {
          cd <- c$codigos[[b]]
          if (is.null(cd)) next
          mapa[[cd]] <- codigo_de[k]
          etq[[cd]] <- c$etiquetas[[b]]
        }
      }
      if (!length(mapa)) next
      entrada <- list(comparable = comparable, mapa = mapa)
      if (nzchar(nota)) entrada$nota <- nota
      por_base[[b]] <- entrada
      adv <- c(adv, .equiv_bloques_validar_codigos(bloque$id, b, variables[[b]], etq, inst_por_base[[b]]))
    }
    armonizacion <- list(escala = escala, por_base = por_base)
  }

  fila <- list(
    id = bloque$id,
    seccion = bloque$eje,
    etiqueta_estandar = bloque$nombre,
    variables = variables,
    diapositiva = "",
    enunciado = .equiv_bloques_enunciado(bloque$enunciado, names(periodos)),
    grafico = "", corte = "", estilo = "",
    cantidad = length(variables)
  )
  if (!is.null(armonizacion)) fila$armonizacion <- armonizacion
  list(fila = fila, advertencias = adv)
}

# Cada «[código]» de la matriz contra la lista de la variable en el instrumento.
.equiv_bloques_validar_codigos <- function(id, base, variable, etiquetas, inst) {
  out <- list()
  if (is.null(variable) || !nzchar(variable) || is.null(inst)) return(out)
  avisar <- function(tipo, mensaje) {
    out[[length(out) + 1L]] <<- list(id = id, base = base, tipo = tipo, mensaje = mensaje)
  }
  opciones <- .equiv_escala_opciones(inst, variable)
  if (!length(opciones)) {
    avisar("sin_lista", sprintf(
      "«%s» no tiene lista de opciones en la base «%s»; sus códigos no se pudieron comprobar.",
      variable, base))
    return(out)
  }
  cods <- vapply(opciones, function(o) .codif_agrupar_codigo_chr(o$codigo), character(1))
  etqs <- vapply(opciones, function(o) o$etiqueta, character(1))
  for (cd in names(etiquetas)) {
    i <- match(cd, cods)
    if (is.na(i)) {
      avisar("codigo_inexistente", sprintf(
        "«%s [%s]» no existe en «%s» de la base «%s».", etiquetas[[cd]], cd, variable, base))
    } else if (nzchar(trimws(etiquetas[[cd]] %||% "")) &&
               !identical(.normalize_text(etiquetas[[cd]]), .normalize_text(etqs[i]))) {
      # Una celda sólo «[2]» (escala 1-5 con los extremos rotulados) no dice
      # ninguna etiqueta: no hay con qué comparar.
      avisar("etiqueta_distinta", sprintf(
        "[%s] dice «%s» en la matriz y «%s» en la base «%s».", cd, etiquetas[[cd]], etqs[i], base))
    }
  }
  sin_mapa <- cods[!cods %in% names(etiquetas)]
  if (length(sin_mapa)) {
    avisar("codigo_sin_mapa", sprintf(
      "Códigos de «%s» en la base «%s» que la matriz no nombra: %s.",
      variable, base, paste(sprintf("[%s] %s", sin_mapa, etqs[match(sin_mapa, cods)]), collapse = ", ")))
  }
  out
}

# Valida mapa_periodos {"2024": "<base>"} contra los años de la hoja y las
# bases del estudio. Devuelve el vector año -> base, en orden de año.
.equiv_bloques_periodos <- function(mapa_periodos, anios, bases) {
  if (is.null(mapa_periodos) || !length(mapa_periodos) || is.null(names(mapa_periodos))) {
    stop_api(400, "E_EQUIV_BLOQUES_PERIODOS",
             "Body debe incluir 'mapa_periodos' {\"<año>\": \"<base>\"} con al menos un año.")
  }
  p <- vapply(mapa_periodos, function(x) .equiv_armon_chr(x, ""), character(1))
  p <- p[nzchar(p)]
  if (!length(p)) {
    stop_api(400, "E_EQUIV_BLOQUES_PERIODOS", "'mapa_periodos' no asigna ninguna base.")
  }
  sin_col <- setdiff(names(p), anios)
  if (length(sin_col)) {
    stop_api(400, "E_EQUIV_BLOQUES_PERIODOS",
             sprintf("La hoja no tiene columna para: %s. Años disponibles: %s.",
                     paste(sin_col, collapse = ", "), paste(anios, collapse = ", ")),
             list(anios = anios))
  }
  fuera <- setdiff(unname(p), bases)
  if (length(fuera)) {
    stop_api(400, "E_EQUIV_BLOQUES_PERIODOS",
             sprintf("Bases que no existen en el estudio: %s.", paste(fuera, collapse = ", ")),
             list(bases = bases))
  }
  if (any(duplicated(unname(p)))) {
    stop_api(400, "E_EQUIV_BLOQUES_PERIODOS", "Dos años apuntan a la misma base.")
  }
  p[order(names(p))]
}

# Motor puro sobre la matriz ya leída.
.equiv_bloques_importar_matriz <- function(m, mapa_periodos, inst_por_base) {
  parsed <- .equiv_bloques_parsear(m)
  periodos <- .equiv_bloques_periodos(mapa_periodos, parsed$anios, names(inst_por_base))
  filas <- list()
  advertencias <- list()
  sin_variables <- character(0)
  for (bl in parsed$bloques) {
    r <- .equiv_bloques_a_fila(bl, periodos, inst_por_base)
    advertencias <- c(advertencias, r$advertencias)
    if (!length(r$fila$variables)) {
      sin_variables <- c(sin_variables, bl$id)
      advertencias[[length(advertencias) + 1L]] <- list(
        id = bl$id, base = "", tipo = "sin_variables",
        mensaje = "Ninguna base mapeada tiene una variable utilizable; el bloque no se importa.")
      next
    }
    filas[[length(filas) + 1L]] <- r$fila
  }
  por_base <- lapply(stats::setNames(unname(periodos), unname(periodos)), function(b) {
    list(anio = names(periodos)[periodos == b],
         n_variables = sum(vapply(filas, function(f) !is.null(f$variables[[b]]), logical(1))),
         n_pendientes = sum(vapply(advertencias, function(a) identical(a$base, b) &&
                                     identical(a$tipo, "variable_pendiente"), logical(1))),
         n_codigos_inexistentes = sum(vapply(advertencias, function(a) identical(a$base, b) &&
                                               identical(a$tipo, "codigo_inexistente"), logical(1))))
  })
  list(
    periodos = periodos,
    filas = filas,
    advertencias = advertencias,
    resumen = list(
      n_bloques = length(parsed$bloques),
      n_filas = length(filas),
      n_sin_variables = length(sin_variables),
      bloques_sin_variables = sin_variables,
      n_con_armonizacion = sum(vapply(filas, function(f) !is.null(f$armonizacion), logical(1))),
      n_advertencias = length(advertencias),
      por_base = por_base
    )
  )
}

# Fusiona con la matriz vigente por `id` y, si no, por etiqueta estándar. No
# borra filas propias del usuario; en una fila que casa, las variables y la
# armonización importadas pisan SOLO las bases que el import trae.
.equiv_bloques_fusionar <- function(existentes, nuevas) {
  existentes <- existentes %||% list()
  ids <- vapply(existentes, function(f) .equiv_armon_chr(f$id, ""), character(1))
  etqs <- .equiv_norm_col(vapply(existentes, function(f) .equiv_armon_chr(f$etiqueta_estandar, ""), character(1)))
  n_nuevas <- 0L
  n_actualizadas <- 0L
  for (f in nuevas) {
    j <- which(nzchar(ids) & ids == f$id)[1]
    if (is.na(j)) {
      e <- .equiv_norm_col(f$etiqueta_estandar)
      j <- which(!nzchar(ids) & nzchar(etqs) & etqs == e)[1]
    }
    if (is.na(j)) {
      existentes[[length(existentes) + 1L]] <- f
      ids <- c(ids, f$id)
      etqs <- c(etqs, .equiv_norm_col(f$etiqueta_estandar))
      n_nuevas <- n_nuevas + 1L
      next
    }
    prev <- existentes[[j]]
    vars <- prev$variables %||% list()
    for (b in names(f$variables)) vars[[b]] <- f$variables[[b]]
    prev$variables <- vars
    prev$cantidad <- length(vars)
    prev$id <- f$id
    if (!nzchar(.equiv_armon_chr(prev$seccion, ""))) prev$seccion <- f$seccion
    if (!nzchar(.equiv_armon_chr(prev$enunciado, ""))) prev$enunciado <- f$enunciado %||% ""
    if (!is.null(f$armonizacion)) {
      arm <- prev$armonizacion
      if (is.null(arm)) {
        arm <- f$armonizacion
      } else {
        arm$escala <- f$armonizacion$escala
        pb <- arm$por_base %||% list()
        for (b in names(f$armonizacion$por_base)) pb[[b]] <- f$armonizacion$por_base[[b]]
        arm$por_base <- pb
      }
      prev$armonizacion <- arm
    }
    existentes[[j]] <- prev
    ids[j] <- f$id
    n_actualizadas <- n_actualizadas + 1L
  }
  list(filas = existentes, nuevas = n_nuevas, actualizadas = n_actualizadas)
}

.equiv_bloques_leer <- function(path, hoja = NULL) {
  if (!requireNamespace("readxl", quietly = TRUE)) {
    stop_api(500, "E_EQUIV_SIN_READXL", "El paquete R 'readxl' no está instalado.")
  }
  hojas <- readxl::excel_sheets(path)
  hoja_sel <- .equiv_armon_chr(hoja, "")
  if (!nzchar(hoja_sel)) hoja_sel <- if (.EQUIV_BLOQUES_HOJA %in% hojas) .EQUIV_BLOQUES_HOJA else hojas[1]
  if (!hoja_sel %in% hojas) {
    stop_api(400, "E_EQUIV_HOJA_NO_ENCONTRADA",
             sprintf("La hoja '%s' no existe en el archivo. Disponibles: %s.",
                     hoja_sel, paste(hojas, collapse = ", ")))
  }
  df <- readxl::read_excel(path, sheet = hoja_sel, col_names = FALSE, col_types = "text",
                           .name_repair = "minimal")
  list(hoja = hoja_sel, matriz = as.matrix(as.data.frame(df, stringsAsFactors = FALSE)))
}

#' Importa la matriz por bloques del archivo `file_id`.
#'
#' @param modo "previsualizar" (no toca la sesión) o "aplicar" (fusiona con la
#'   matriz vigente y la guarda por la misma vía que el editor).
#' @keywords internal
equiv_bloques_importar <- function(sid, file_id, mapa_periodos, modo = "previsualizar", hoja = NULL) {
  s <- session_get(sid)
  meta <- s$files[[as.character(file_id %||% "")]]
  if (is.null(meta) || is.null(meta$path) || !file.exists(meta$path)) {
    stop_api(404, "E_EQUIV_ARCHIVO_NO_ENCONTRADO",
             "No se encontró el archivo de la matriz en el almacén de la sesión.")
  }
  leido <- .equiv_bloques_leer(meta$path, hoja)
  inst_por_base <- .equiv_inst_por_base(sid)
  res <- .equiv_bloques_importar_matriz(leido$matriz, mapa_periodos, inst_por_base)

  previo <- .equiv_get(sid)
  fusion <- .equiv_bloques_fusionar(previo$filas, res$filas)
  res$resumen$hoja <- leido$hoja
  res$resumen$nuevas <- fusion$nuevas
  res$resumen$actualizadas <- fusion$actualizadas
  out <- list(
    modo = modo,
    filas_importadas = res$filas,
    advertencias = res$advertencias,
    resumen = res$resumen
  )
  if (!identical(modo, "aplicar")) return(out)

  # El orden de la serie: el vigente, más las bases nuevas en orden de año.
  periodos <- unique(c(as.character(unlist(previo$armonizacion_periodos %||% character(0))),
                       unname(res$periodos)))
  guardado <- .equiv_guardar_declaracion(sid, fusion$filas, armonizacion_periodos = periodos)
  c(out, guardado)
}

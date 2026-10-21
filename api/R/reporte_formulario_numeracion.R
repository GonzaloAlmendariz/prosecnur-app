# Motor del formulario en papel — numeracion de las preguntas.
#
# Item 39 (tercera tanda) con la regla vigente de
# `docs/qa/reglas-papel-numeracion-saltos-2026-10-15.md` §39. Antes cada fila
# tomaba el numero de su nombre si era mayor que el ultimo (`censo_2025` se
# imprimia como pregunta 2025; 33 de 44 instrumentos del corpus con huecos). Ahora
# se decide UNA vez por instrumento:
#
#   - `paper_number` manda siempre; `-` es «sin numero».
#   - El esquema DERIVADO del nombre (`p14_1` -> 14.1, `A6_1` -> A6.1,
#     `P7_1_A` -> 7.1a) se usa solo si cumple TODAS las condiciones de la regla
#     (inyectivo, una familia de prefijo, creciente por modulo, plausible,
#     cobertura >= 90 %, faltantes <= 10 %). Si falla una: secuencial, con un
#     aviso que dice cual y con su ejemplo.
#   - En secuencial, todo numero que no coincide con su variable lleva `[var]`.
#   - Una matriz consume UN numero X y sus filas son X.1..X.k, con o sin tenor.
#   - Las filas de control y el «Especifique» en linea no consumen numero.

.FORM_NUM_COBERTURA <- 0.90
.FORM_NUM_FALTANTES <- 0.10

# Esquema derivado de un nombre de variable. NULL si no lo sigue.
.form_num_derivar <- function(name) {
  nm <- trimws(.form_pdf_chr(name))
  if (!nzchar(nm)) return(NULL)
  familia <- ""; modulo <- ""; resto <- nm
  g <- regmatches(nm, regexec("^(?i)(pregunta|preg|p|q)[_.-]?(?=[0-9])", nm, perl = TRUE))[[1]]
  if (length(g)) {
    familia <- tolower(g[2]); resto <- substring(nm, nchar(g[1]) + 1L)
  } else {
    m <- regmatches(nm, regexec("^([A-Za-z]{1,3})[_.-]?(?=[0-9])", nm, perl = TRUE))[[1]]
    if (length(m)) {
      familia <- "modulo"; modulo <- m[2]; resto <- substring(nm, nchar(m[1]) + 1L)
    } else if (!grepl("^[0-9]", nm)) {
      return(NULL)
    }
  }
  p <- regmatches(resto, regexec("^0*([0-9]+)((?:[_.-][0-9]+)*)(?:[_.-]?([A-Za-z]))?$", resto, perl = TRUE))[[1]]
  if (!length(p)) return(NULL)
  N <- suppressWarnings(as.numeric(p[2]))
  subs <- if (nzchar(p[3])) as.integer(strsplit(substring(p[3], 2L), "[_.-]")[[1]]) else integer(0)
  letra <- tolower(p[4])
  etiqueta <- paste0(modulo, format(N, scientific = FALSE),
                     if (length(subs)) paste0(".", paste(subs, collapse = ".")) else "", letra)
  list(familia = familia, modulo = modulo, N = N, subs = subs, letra = letra, etiqueta = etiqueta)
}

.form_num_tupla_menor <- function(a, b) {
  # TRUE si la tupla a es estrictamente menor que b (orden numerico).
  x <- c(a$N, a$subs, if (nzchar(a$letra)) utf8ToInt(a$letra) else 0)
  y <- c(b$N, b$subs, if (nzchar(b$letra)) utf8ToInt(b$letra) else 0)
  k <- max(length(x), length(y)); x <- c(x, rep(-1, k - length(x))); y <- c(y, rep(-1, k - length(y)))
  d <- which(x != y)
  length(d) > 0 && x[d[1]] < y[d[1]]
}

# Unidades numerables en orden de impresion: list(filas, matriz (key o ""),
# explicito). Una matriz es UNA unidad con sus filas.
.form_num_unidades <- function(survey, matrix_keys, rol) {
  n <- nrow(survey)
  out <- list(); i <- 1L
  while (i <= n) {
    key <- matrix_keys[i]
    if (nzchar(key)) {
      j <- i
      while (j + 1L <= n && identical(matrix_keys[j + 1L], key)) j <- j + 1L
      out[[length(out) + 1L]] <- list(filas = seq.int(i, j), matriz = key)
      i <- j + 1L
      next
    }
    if (identical(rol[i], "pregunta")) out[[length(out) + 1L]] <- list(filas = i, matriz = "")
    i <- i + 1L
  }
  out
}

# Decide el esquema y numera. Devuelve list(numeros = etiqueta por fila de la
# unidad (1a fila de la matriz para la matriz), items = etiqueta de cada fila de
# matriz, tags = `[var]` por fila, modo, avisos).
.form_pdf_numeracion <- function(survey, matrix_keys, rol) {
  n <- nrow(survey)
  numeros <- rep("", n); items <- rep("", n); tags <- rep("", n)
  unidades <- .form_num_unidades(survey, matrix_keys, rol)
  avisos <- character(0)
  if (!length(unidades)) return(list(numeros = numeros, items = items, tags = tags,
                                     modo = "secuencial", avisos = avisos))
  explicito <- vapply(unidades, function(u) .form_pdf_clean_text(survey$paper_number[u$filas[1]]), character(1))
  nombres <- as.character(survey$name)
  der_fila <- lapply(nombres, .form_num_derivar)

  # Derivado de cada unidad (sin las que traen paper_number).
  der_u <- lapply(seq_along(unidades), function(k) {
    u <- unidades[[k]]
    if (nzchar(explicito[k])) return(NULL)
    if (!nzchar(u$matriz)) return(der_fila[[u$filas]])
    ds <- der_fila[u$filas]
    if (any(vapply(ds, is.null, logical(1)))) return(NULL)
    mods <- unique(vapply(ds, `[[`, "", "modulo")); Ns <- unique(vapply(ds, `[[`, 0, "N"))
    fams <- unique(vapply(ds, `[[`, "", "familia"))
    if (length(mods) != 1L || length(Ns) != 1L || length(fams) != 1L) return(NULL)
    if (!all(vapply(ds, function(d) length(d$subs) > 0L || nzchar(d$letra), logical(1)))) return(NULL)
    list(familia = fams, modulo = mods, N = Ns, subs = integer(0), letra = "",
         etiqueta = paste0(mods, format(Ns, scientific = FALSE)))
  })
  libres <- which(!nzchar(explicito))
  derivables <- libres[!vapply(der_u[libres], is.null, logical(1))]
  # Un «Pxx_otro» que acompaña a una pregunta numerada no es una pregunta suelta
  # sin esquema: se cuelga de ella con letra («23a»). No entra en la cobertura
  # (HSyVbG 2026: 17 campos «_otro» dejaban la cobertura en 81 % y el papel
  # salía numerado 1, 2, 3 en vez de con los códigos de la base).
  satelite <- vapply(libres, function(k) {
    nm <- nombres[unidades[[k]]$filas[1]]
    base <- sub("_(otro|otra|otros|otras|esp|especifique|especifica)$", "", nm, ignore.case = TRUE)
    !identical(base, nm) && !is.null(.form_num_derivar(base))
  }, logical(1))
  total <- length(libres) - sum(satelite & vapply(der_u[libres], is.null, logical(1)))

  falla <- ""
  if (!total) {
    falla <- "sin preguntas que numerar"
  } else if (length(derivables) / total < .FORM_NUM_COBERTURA) {
    sin <- libres[vapply(der_u[libres], is.null, logical(1))]
    falla <- sprintf("solo %d de %d preguntas siguen el esquema de su nombre (p. ej. `%s`)",
                     length(derivables), total, nombres[unidades[[sin[1]]]$filas[1]])
  }
  if (!nzchar(falla)) {
    ets <- vapply(der_u[derivables], `[[`, "", "etiqueta")
    ets_items <- unlist(lapply(derivables, function(k) {
      u <- unidades[[k]]
      if (nzchar(u$matriz)) vapply(der_fila[u$filas], `[[`, "", "etiqueta") else character(0)
    }))
    todas <- c(ets, ets_items)
    fams <- unique(vapply(der_u[derivables], `[[`, "", "familia"))
    Ns <- vapply(der_u[derivables], `[[`, 0, "N")
    if (anyDuplicated(todas)) {
      falla <- sprintf("dos variables dan el mismo numero (%s)", todas[anyDuplicated(todas)])
    } else if (length(fams) > 1L) {
      falla <- sprintf("mezcla prefijos (%s)", paste(fams, collapse = ", "))
    } else if (any(Ns >= 1000) || any(Ns > 3 * total)) {
      k <- derivables[which(Ns >= 1000 | Ns > 3 * total)[1]]
      falla <- sprintf("`%s` daria el numero %s, que no es plausible",
                       nombres[unidades[[k]]$filas[1]], der_u[[k]]$etiqueta)
    } else {
      ultimo <- list()
      for (k in derivables) {
        d <- der_u[[k]]; md <- d$modulo
        prev <- ultimo[[if (nzchar(md)) md else "."]]
        if (!is.null(prev) && .form_num_tupla_menor(d, prev$d)) {
          falla <- sprintf("no es creciente (%s -> %s)", prev$nombre, nombres[unidades[[k]]$filas[1]])
          break
        }
        ultimo[[if (nzchar(md)) md else "."]] <- list(d = d, nombre = nombres[unidades[[k]]$filas[1]])
      }
    }
    if (!nzchar(falla)) {
      faltan <- character(0)
      mods <- vapply(der_u[derivables], `[[`, "", "modulo")
      for (md in unique(mods)) {
        usados <- sort(unique(Ns[mods == md]))
        f <- setdiff(seq_len(max(usados)), usados)
        if (length(f)) faltan <- c(faltan, paste0(md, f))
      }
      if (length(faltan) > .FORM_NUM_FALTANTES * total) {
        falla <- sprintf("le faltan %d numeros (%s%s)", length(faltan),
                         paste(utils::head(faltan, 6), collapse = ", "), if (length(faltan) > 6) ", ..." else "")
      } else if (length(faltan)) {
        avisos <- c(avisos, sprintf(
          "Numeracion tomada de los nombres de variable; faltan %d numero(s): %s.",
          length(faltan), paste(faltan, collapse = ", ")))
      }
    }
  }

  modo <- if (nzchar(falla)) "secuencial" else "derivado"
  if (identical(modo, "secuencial") && total) {
    avisos <- c(avisos, sprintf(
      "Numeracion secuencial: no se usa la de los nombres de variable porque %s.", falla))
  }

  ultimo_num <- 0L; ultima_et <- ""; extra <- 0L
  for (k in seq_along(unidades)) {
    u <- unidades[[k]]; f1 <- u$filas[1]
    if (identical(explicito[k], "-")) next
    if (nzchar(explicito[k])) {
      X <- explicito[k]
      ne <- suppressWarnings(as.integer(X)); if (!is.na(ne)) ultimo_num <- max(ultimo_num, ne)
    } else if (identical(modo, "derivado") && !is.null(der_u[[k]])) {
      X <- der_u[[k]]$etiqueta; extra <- 0L
    } else if (identical(modo, "derivado")) {
      # Unidad que no sigue el esquema (<= 10 %): se cuelga de la anterior con
      # letra («5a»), que es la forma del esquema para una sub-pregunta. Antes
      # del primer numero derivado no hay de donde colgarla: va sin numero, con
      # su `[var]`.
      if (!nzchar(ultima_et)) {
        if (!nzchar(u$matriz)) tags[f1] <- nombres[f1]
        next
      }
      extra <- extra + 1L
      X <- paste0(ultima_et, letters[min(extra, 26L)])
    } else {
      ultimo_num <- ultimo_num + 1L
      X <- as.character(ultimo_num)
    }
    ultima_et <- if (nzchar(explicito[k]) || is.null(der_u[[k]]) || !identical(modo, "derivado")) ultima_et else X
    numeros[f1] <- X
    if (nzchar(u$matriz)) {
      for (jj in seq_along(u$filas)) {
        r <- u$filas[jj]
        d <- der_fila[[r]]
        # §39.6: las filas son X.1..X.k siempre; el esquema derivado solo da X.
        items[r] <- paste0(X, ".", jj)
        if (is.null(d) || !identical(d$etiqueta, items[r])) tags[r] <- nombres[r]
      }
    } else {
      d <- der_fila[[f1]]
      if (is.null(d) || !identical(d$etiqueta, X)) tags[f1] <- nombres[f1]
    }
  }
  list(numeros = numeros, items = items, tags = tags, modo = modo, avisos = avisos)
}

# Como se nombra una pregunta en un salto o una condicion: «P7», «P7.2»; si el
# numero ya empieza con letra de modulo, tal cual («A6.1»).
.form_num_ref <- function(et) {
  et <- .form_pdf_chr(et)
  if (!nzchar(et)) return("")
  if (grepl("^[A-Za-z]", et)) et else paste0("P", et)
}

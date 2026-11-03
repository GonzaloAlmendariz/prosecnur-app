# Prueba bajo diseño para la diferencia de dos proporciones (ADR 0126 §2, decisión D2)
# ===================================================================================
#
# Las láminas y las tablas de cruces comparaban grupos con una prueba z de muestreo aleatorio simple. En un estudio
# encuestado por aulas, quienes comparten un aula responden más parecido entre sí que dos estudiantes al azar, y esa z
# marca diferencias que el diseño no sostiene (dictamen CCSS 2026-II §4: con deff de hasta 2.6 en los temas de carrera).
#
# Aquí vive la prueba de diseño, en R base y sin `survey`:
#
# - cada proporción de grupo es un estimador de razón de dominio, p_g = Σ w·y·1[g] / Σ w·1[g];
# - su varianza se linealiza: el aporte de cada caso es u = w·1[g]·(y − p_g) / W_g, se suma por conglomerado y se
#   toma la varianza entre conglomerados dentro de cada estrato (último conglomerado, con reemplazo, sin fpc);
# - la covarianza entre dos grupos sale de la misma suma, porque un aula puede tener casos de los dos;
# - la diferencia se contrasta con una t de (conglomerados − estratos) grados de libertad.
#
# Es lo que da `svyby(~y, ~g, svydesign(ids = ~aula, strata = ~estrato, weights = ~w), svymean, covmat = TRUE)` con
# `svycontrast`, y es la corrección de primer orden de Rao-Scott para la tabla de 2×2 del par. El test
# `test-graficos-significancia-diseno.R` lo compara contra `survey`, que solo está en Suggests.
#
# Lo que NO hace este archivo: decidir qué fila se prueba, qué grupo es elegible ni qué se marca. Eso es la regla
# (`graficos_significancia_regla.R`) y el veredicto (`graficos_significancia_veredicto.R`).

#' Conglomerado último de cada caso: el vacío pasa a ser su propio conglomerado
#'
#' Es la convención de los scripts del plan de análisis (`seg_<i>`). Un caso sin aula no puede compartir varianza con
#' nadie, y tratarlo como un aula de un caso es lo conservador.
#' @keywords internal
.sig_conglomerado_ultimo <- function(cluster, n) {
  if (is.null(cluster)) return(paste0(".caso_", seq_len(n)))
  cl <- trimws(as.character(cluster))
  vacio <- is.na(cl) | !nzchar(cl) | cl %in% c("NA", "NaN")
  cl[vacio] <- paste0(".caso_", which(vacio))
  cl
}

#' Matriz de varianzas y covarianzas linealizada de los totales por conglomerado
#'
#' `U` tiene una fila por conglomerado y una columna por estimador. `estrato_cl` es el estrato de cada conglomerado.
#' Un estrato con un solo conglomerado se centra en la media de todos los conglomerados (`survey.lonely.psu = "adjust"`),
#' que es lo que usó el dictamen para el estrato 5 de CCSS.
#' @keywords internal
.sig_vcov_conglomerados <- function(U, estrato_cl) {
  U <- as.matrix(U)
  K <- ncol(U)
  V <- matrix(0, K, K)
  centro_global <- colMeans(U)
  for (h in unique(estrato_cl)) {
    Uh <- U[estrato_cl == h, , drop = FALSE]
    nh <- nrow(Uh)
    centro <- if (nh >= 2L) colMeans(Uh) else centro_global
    D <- Uh - rep(centro, each = nh)
    V <- V + (if (nh >= 2L) nh / (nh - 1) else 1) * crossprod(D)
  }
  V
}

#' Contrastes de proporciones entre todos los pares de grupos, por fila
#'
#' @param Y Matriz casos × filas con 1/0, y `NA` donde el caso no está en la base de esa fila.
#' @param g Grupo de cada caso (código). `grupos` fija su orden: el de las letras A, B, C...
#' @param cluster,estrato Conglomerado y estrato de cada caso. Sin `cluster`, cada caso es su propio conglomerado y la
#'   prueba coincide con la de muestreo aleatorio simple con reemplazo.
#' @param w Peso de cada caso (1 si falta).
#' @param prueba `"rao_scott"` (varianza del diseño) o `"z"` (la de las tablas de siempre: proporción combinada).
#' @return `list(celdas, pares, gl, conglomerados)`. `celdas` tiene una fila por (fila, grupo) con la proporción, la base
#'   en casos y los conglomerados con casos. `pares` una fila por (fila, a, b) con a el de mayor proporción.
#' @keywords internal
.sig_contrastes <- function(Y, g, grupos = NULL, cluster = NULL, estrato = NULL, w = NULL,
                            prueba = c("rao_scott", "z")) {
  prueba <- match.arg(prueba)
  Y <- as.matrix(Y)
  storage.mode(Y) <- "double"
  n <- nrow(Y)
  filas <- colnames(Y) %||% paste0("fila", seq_len(ncol(Y)))
  g <- as.character(g)
  if (is.null(grupos)) grupos <- unique(g[!is.na(g) & nzchar(g)])
  grupos <- as.character(grupos)
  w <- if (is.null(w)) rep(1, n) else suppressWarnings(as.numeric(w))
  w[!is.finite(w) | w < 0] <- 0

  cl <- .sig_conglomerado_ultimo(if (identical(prueba, "z")) NULL else cluster, n)
  st <- if (is.null(estrato)) rep("1", n) else {
    s <- trimws(as.character(estrato)); s[is.na(s) | !nzchar(s)] <- ".sin_estrato"; s
  }
  cl_niveles <- unique(cl)
  # Un conglomerado pertenece a un solo estrato; si los datos dicen otra cosa, manda el primero que aparece.
  estrato_cl <- st[match(cl_niveles, cl)]
  gl <- length(cl_niveles) - length(unique(estrato_cl))

  K <- length(grupos)
  celdas <- list()
  pares <- list()
  for (k in seq_along(filas)) {
    y <- Y[, k]
    en_base <- !is.na(y) & w > 0
    I <- vapply(grupos, function(gr) as.numeric(en_base & !is.na(g) & g == gr), numeric(n))
    if (!is.matrix(I)) I <- matrix(I, nrow = n)
    Wg <- colSums(I * w)
    yy <- ifelse(en_base, y, 0)
    p <- ifelse(Wg > 0, colSums(I * w * yy) / Wg, NA_real_)
    n_casos <- colSums(I)
    cl_con_casos <- vapply(seq_len(K), function(j) length(unique(cl[I[, j] > 0])), integer(1))
    celdas[[k]] <- list(fila = rep(filas[[k]], K), grupo = grupos, p = unname(p), n = unname(n_casos),
                        n_ponderado = unname(Wg), conglomerados = cl_con_casos)

    V <- NULL
    if (identical(prueba, "rao_scott")) {
      u <- I * w * outer(yy, ifelse(is.finite(p), p, 0), "-")
      u <- u / rep(ifelse(Wg > 0, Wg, 1), each = n)
      u[I == 0] <- 0
      U <- rowsum(u, cl, reorder = FALSE)
      U <- U[match(cl_niveles, rownames(U)), , drop = FALSE]
      U[is.na(U)] <- 0
      V <- .sig_vcov_conglomerados(U, estrato_cl)
    }
    if (K < 2L) next
    for (i in seq_len(K - 1L)) for (j in (i + 1L):K) {
      if (!is.finite(p[[i]]) || !is.finite(p[[j]]) || Wg[[i]] <= 0 || Wg[[j]] <= 0) next
      a <- if (p[[i]] >= p[[j]]) i else j
      b <- if (a == i) j else i
      dif <- p[[a]] - p[[b]]
      var_mas <- p[[a]] * (1 - p[[a]]) / Wg[[a]] + p[[b]] * (1 - p[[b]]) / Wg[[b]]
      if (identical(prueba, "rao_scott")) {
        v <- V[a, a] + V[b, b] - 2 * V[a, b]
        se <- sqrt(max(v, 0))
        estad <- if (se > 0) dif / se else NA_real_
        pv <- if (se > 0) 2 * stats::pt(-abs(estad), df = max(gl, 1L)) else if (dif == 0) 1 else NA_real_
        q <- stats::qt(0.975, df = max(gl, 1L))
        deff <- if (var_mas > 0) v / var_mas else NA_real_
      } else {
        # La z de las tablas de siempre (`comparar_columnas_sig`): proporción combinada en el error estándar.
        ppool <- (p[[a]] * Wg[[a]] + p[[b]] * Wg[[b]]) / (Wg[[a]] + Wg[[b]])
        se0 <- sqrt(ppool * (1 - ppool) * (1 / Wg[[a]] + 1 / Wg[[b]]))
        estad <- if (se0 > 0) dif / se0 else NA_real_
        pv <- if (se0 > 0) 2 * stats::pnorm(-abs(estad)) else if (dif == 0) 1 else NA_real_
        # Como en la tabla: una columna en 0% o 100% queda fuera de la prueba («.a»).
        if (p[[a]] >= 1 || p[[b]] <= 0) pv <- NA_real_
        se <- sqrt(var_mas)
        q <- stats::qnorm(0.975)
        deff <- NA_real_
      }
      # Una lista de vectores por par y un solo data.frame al final: crear uno por par era la mitad del costo.
      pares[[length(pares) + 1L]] <- list(
        fila = filas[[k]], a = grupos[[a]], b = grupos[[b]], p_a = p[[a]], p_b = p[[b]], dif = dif,
        se = se, estadistico = estad, p = pv, deff = deff, ic_lo = dif - q * se, ic_hi = dif + q * se,
        n_a = n_casos[[a]], n_b = n_casos[[b]], cl_a = cl_con_casos[[a]], cl_b = cl_con_casos[[b]]
      )
    }
  }
  vacio_pares <- data.frame(fila = character(), a = character(), b = character(), p_a = numeric(), p_b = numeric(),
                            dif = numeric(), se = numeric(), estadistico = numeric(), p = numeric(), deff = numeric(),
                            ic_lo = numeric(), ic_hi = numeric(), n_a = numeric(), n_b = numeric(),
                            cl_a = integer(), cl_b = integer(), stringsAsFactors = FALSE)
  list(
    celdas = if (length(celdas)) {
      as.data.frame(lapply(stats::setNames(names(celdas[[1]]), names(celdas[[1]])),
                           function(cn) unlist(lapply(celdas, `[[`, cn), use.names = FALSE)), stringsAsFactors = FALSE)
    } else NULL,
    pares = if (length(pares)) {
      cols <- names(pares[[1]])
      as.data.frame(stats::setNames(lapply(cols, function(cn) unlist(lapply(pares, `[[`, cn), use.names = FALSE)), cols),
                    stringsAsFactors = FALSE)
    } else vacio_pares,
    gl = as.integer(gl),
    conglomerados = length(cl_niveles),
    prueba = prueba
  )
}

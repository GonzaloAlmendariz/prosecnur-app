# =============================================================================
# graficos_cifras_detalle.R — el detalle de las cifras de un gráfico categórico, apilado o divergente
# =============================================================================
#
# El inspector de la tarjeta del gráfico muestra, al lado de cada control, la cifra antes y después («Base 412 → 380»,
# «Sí 58% → 63%»). Esas cifras tienen que ser las de la lámina: se LEEN de la especificación que la dibuja
# (`attr(p, "pulso_espec")`), renderizada con el motor del export, sus pesos, filtros, universo y exclusiones. Nunca se
# aproximan con el conteo de `/api/graficos/categorias` (n / total, sin pesos ni filtros).
#
# Formas que se leen (la `version` de la especificación):
#   categorica/1    p_barras_categoricas, p_barras_agrupadas de una serie: una fila («total»).
#   escala/1        p_barras_apiladas, p_barras_multiapiladas: una fila por barra, en el orden de la lámina.
#   divergentes/1   p_barras_divergentes: una fila por pregunta, con sus lados.
#   agrupadas_cruce/1  p_barras_agrupadas con «Dividir por» (forma `categorica`): una fila por grupo con su n, leída de
#                   lo que el render deja en el gráfico (`pulso_barras_series`, `pulso_barras_bases`). Esa lámina no
#                   publica especificación con varias series, así que sus filas no traen cifras por categoría.
#
# Reglas (las de la lámina, ADR 0093):
#   - `valor` de una categoría es la cifra rotulada (su redondeo y sus decimales); `texto`, la cifra tal cual se lee
#     («43% (12)», «21,6% a»); `proporcion`, la exacta (0 a 1) que se redondeó.
#   - La caja (Top Two Box) es la SUMA DE LAS CIFRAS ROTULADAS de sus categorías (lámina 19), nunca con los especiales
#     (SIN INF, 90-99). La de la lámina sale de su especificación; con `caja` en el pedido se suma la de esas categorías.
#   - `sumas`: la suma de lo rotulado y la que daría cada método de redondeo (`estandar`: desde 0,5 sube; `reparto`:
#     resto mayor, que cierra en 100). En una categórica que no cierra a 100 (respuesta múltiple) el reparto no aplica.
#   - Los lados de la divergente suman sus cifras rotuladas; «Sin información» va aparte.
#
# Una categoría se identifica por su rótulo en la lámina (`clave`): las columnas internas (`pct_1`, `niv_2`) se corren
# cuando se excluye una opción, el rótulo no. Una fila, por su rótulo (`total` en la categórica).

.CIFRAS_DETALLE_GRAFICADORES <- c("p_barras_categoricas", "p_barras_agrupadas", "p_barras_apiladas",
                                  "p_barras_multiapiladas", "p_barras_divergentes")
.CIFRAS_DETALLE_FORMAS <- c("categorica", "escala", "divergentes")
.CIFRAS_DETALLE_CAJA_TOPE <- 50L

#' Las categorías de la caja pedida, validadas: `character()` sin caja
#' @keywords internal
.cifras_detalle_caja <- function(caja) {
  if (is.null(caja)) return(character(0))
  if (!is.atomic(caja) && !is.list(caja)) stop_api(400, "E_CIFRAS_INVALIDO", "`caja` debe ser una lista de rótulos.")
  if (is.list(caja) && any(lengths(caja) != 1L)) stop_api(400, "E_CIFRAS_INVALIDO", "`caja` debe ser una lista de rótulos.")
  x <- trimws(as.character(unlist(caja, use.names = FALSE)))
  x <- unique(x[!is.na(x) & nzchar(x)])
  if (length(x) > .CIFRAS_DETALLE_CAJA_TOPE) {
    stop_api(400, "E_CIFRAS_INVALIDO", sprintf("`caja` admite hasta %d categorías.", .CIFRAS_DETALLE_CAJA_TOPE))
  }
  x
}

#' Un número para el JSON: `NA` (se escribe `null`) si no es finito
#' @keywords internal
.cifras_det_num <- function(x) {
  x <- suppressWarnings(as.numeric(x)[1])
  if (length(x) && is.finite(x)) x else NA_real_
}

#' Una cifra `{valor, texto}` desde unidades del redondeo (`unidades / 10^dec` por ciento)
#' @keywords internal
.cifras_det_cifra <- function(unidades, dec, texto = NULL) {
  u <- suppressWarnings(as.numeric(unidades)[1])
  if (!length(u) || !is.finite(u)) return(list(valor = NA_real_, texto = ""))
  list(valor = u / 10^dec, texto = texto %||% .pulso_fmt_pct_unidades(u, dec))
}

#' La base `{n_ponderado, n_casos}` de una fila
#' @keywords internal
.cifras_det_base <- function(n, n_casos) list(n_ponderado = .cifras_det_num(n), n_casos = .cifras_det_num(n_casos))

#' La base común de varias filas (o `NA` en el campo si difieren)
#' @keywords internal
.cifras_det_base_comun <- function(bases, texto) {
  comun <- function(campo) {
    v <- vapply(bases, function(b) b[[campo]], numeric(1))
    if (length(v) && all(is.finite(v)) && all(abs(v - v[1]) < 1e-9)) v[1] else NA_real_
  }
  list(n_ponderado = comun("n_ponderado"), n_casos = comun("n_casos"), texto = texto)
}

#' La cifra rotulada como número: el primer «12,5%» del texto (con «(n)» o letras al lado), o `NA`
#' @keywords internal
.cifras_det_parse_pct <- function(texto) {
  texto <- as.character(texto); texto[is.na(texto)] <- ""
  r <- regexpr("-?[0-9]+([.,][0-9]+)?(?=\\s*%)", texto, perl = TRUE)
  out <- rep(NA_real_, length(texto))
  out[r > 0] <- suppressWarnings(as.numeric(sub(",", ".", regmatches(texto, r), fixed = TRUE)))
  out
}

#' Decimales con que se rotula: los de la especificación o, si no los declara, los más largos de los textos
#' @keywords internal
.cifras_det_decimales <- function(espec, textos) {
  d <- suppressWarnings(as.integer(espec$redondeo$decimales %||% espec$decimales %||% NA)[1])
  if (length(d) && is.finite(d) && d >= 0L) return(d)
  m <- regmatches(textos, regexpr("[.,][0-9]+(?=\\s*%)", textos, perl = TRUE))
  if (!length(m)) 0L else max(nchar(m) - 1L)
}

#' La suma de lo rotulado y la de cada método de redondeo
#'
#' @param p Proporciones exactas (0 a 1) de la fila.
#' @param u_lamina Unidades rotuladas (`valor * 10^dec`).
#' @param normalizada Si la fila es una distribución (escala, divergente): el redondeo del motor va sobre `p / sum(p)`.
#'   En una categórica, `estandar` redondea cada cifra sola y `reparto` aplica sólo si la serie cierra a 100.
#' @keywords internal
.cifras_det_sumas <- function(p, u_lamina, dec, normalizada) {
  p <- suppressWarnings(as.numeric(p)); p[!is.finite(p)] <- 0
  s <- sum(p)
  cierra <- isTRUE(normalizada) || (s > 0 && abs(s - 1) <= 0.01)
  u_est <- if (isTRUE(normalizada)) .pulso_pct_unidades(p, dec, "estandar") else floor(p * 100 * 10^dec + 0.5)
  u_rep <- if (cierra) .pulso_pct_unidades(p, dec, "reparto") else u_est
  list(lamina = .cifras_det_cifra(sum(u_lamina), dec),
       estandar = .cifras_det_cifra(sum(u_est), dec),
       reparto = c(.cifras_det_cifra(sum(u_rep), dec), list(aplica = cierra)))
}

#' La caja de lo pedido: la suma de las cifras rotuladas de esas categorías, sin especiales; `NA` si ninguna está
#' @keywords internal
.cifras_det_caja_pedida <- function(caja, rotulos, unidades, especial, dec) {
  if (!length(caja)) return(NA)
  j <- which(rotulos %in% caja & !especial)
  if (!length(j)) return(NA)
  c(list(rotulo = "Caja pedida", categorias = as.list(rotulos[j])), .cifras_det_cifra(sum(unidades[j]), dec),
    list(origen = "pedido"))
}

#' Las categorías de la especificación como JSON
#' @keywords internal
.cifras_det_categorias <- function(rotulos, especial, lado = NULL) {
  lapply(seq_along(rotulos), function(j) list(clave = rotulos[j], rotulo = rotulos[j], especial = isTRUE(especial[j]),
                                              lado = if (is.null(lado)) NA_character_ else lado[j]))
}

#' Los valores de una fila: `[{categoria, texto, valor, proporcion}]`
#' @keywords internal
.cifras_det_valores <- function(rotulos, textos, unidades, p, dec) {
  lapply(seq_along(rotulos), function(j) list(categoria = rotulos[j], texto = as.character(textos[j]),
                                              valor = .cifras_det_num(unidades[j] / 10^dec), proporcion = .cifras_det_num(p[j])))
}

#' El detalle de una categórica (`categorica/1`)
#' @keywords internal
.cifras_detalle_categorica <- function(esp, base_texto, caja) {
  rot <- as.character(esp$rotulos); txt <- as.character(esp$cifras)
  dec <- .cifras_det_decimales(esp, txt)
  u <- round(.cifras_det_parse_pct(txt) * 10^dec)
  p <- suppressWarnings(as.numeric(esp$valores))
  n <- suppressWarnings(as.numeric(esp$n))
  # Base ponderada: la que declara el graficador o la de la serie (n de una categoría sobre su proporción).
  k <- which(is.finite(p) & p > 0 & is.finite(n))
  n_pond <- esp$n_base_pond %||% if (length(k)) n[k[which.max(p[k])]] / p[k[which.max(p[k])]] else NA_real_
  base <- .cifras_det_base(n_pond, esp$n_base_casos)
  especial <- rep(FALSE, length(rot))   # la categórica no separa especiales: todas sus categorías cuentan en la caja
  fila <- list(clave = "total", rotulo = "Total", es_total = FALSE, base = base,
               valores = .cifras_det_valores(rot, txt, u, p, dec),
               sumas = .cifras_det_sumas(p, u, dec, normalizada = FALSE),
               caja = .cifras_det_caja_pedida(caja, rot, u, especial, dec), lados = NA)
  list(forma = "categorica", version = as.character(esp$version %||% "")[1],
       base = c(base, list(texto = base_texto)),
       redondeo = list(metodo = .pulso_pct_metodo(esp$redondeo$metodo %||% "estandar"), decimales = dec),
       categorias = .cifras_det_categorias(rot, especial), filas = list(fila))
}

#' El detalle de una escala (`escala/1`), con las filas en el orden de la lámina
#' @keywords internal
.cifras_detalle_escala <- function(esp, base_texto, caja) {
  cat_df <- esp$categorias; rot <- as.character(cat_df$rotulo); especial <- as.logical(cat_df$especial)
  dec <- as.integer(esp$redondeo$decimales %||% 0L); U <- esp$unidades; P <- esp$proporciones
  filas <- esp$filas; orden <- esp$orden$aplicado %||% seq_len(nrow(filas))
  box <- esp$box
  out <- lapply(orden, function(i) {
    base <- .cifras_det_base(filas$n[i], .espec_casos(filas)[i])
    caja_lam <- if (!is.null(box$unidades) && length(box$cols)) {
      c(list(rotulo = as.character(box$rotulo %||% ""), categorias = as.list(rot[match(box$cols, cat_df$col)])),
        .cifras_det_cifra(box$unidades[i], dec, as.character(box$cifras[i])), list(origen = "lamina"))
    } else NA
    pedida <- .cifras_det_caja_pedida(caja, rot, U[i, ], especial, dec)
    list(clave = as.character(filas$id[i]), rotulo = as.character(filas$rotulo[i]), es_total = isTRUE(filas$es_total[i]),
         base = base, valores = .cifras_det_valores(rot, esp$cifras[i, ], U[i, ], if (is.null(P)) rep(NA_real_, length(rot)) else P[i, ], dec),
         sumas = if (is.null(P)) NA else .cifras_det_sumas(P[i, ], U[i, ], dec, normalizada = TRUE),
         caja = if (length(caja)) pedida else caja_lam, lados = NA)
  })
  list(forma = "escala", version = as.character(esp$version %||% "")[1],
       base = .cifras_det_base_comun(lapply(out, `[[`, "base"), base_texto),
       redondeo = list(metodo = .pulso_pct_metodo(esp$redondeo$metodo), decimales = dec),
       categorias = .cifras_det_categorias(rot, especial), filas = out)
}

#' El detalle de unas divergentes (`divergentes/1`): los lados negativo, neutro y positivo y «Sin información»
#' @keywords internal
.cifras_detalle_divergentes <- function(esp, base_texto, caja) {
  cat_df <- esp$categorias; rot <- as.character(cat_df$rotulo); lado <- as.character(cat_df$lado)
  especial <- lado == "sin_inf"; dec <- as.integer(esp$decimales %||% 0L); U <- esp$unidades; P <- esp$proporciones
  suma_lado <- function(i, l) sum(U[i, lado == l, drop = TRUE])
  out <- lapply(seq_along(esp$filas), function(i) {
    base <- .cifras_det_base(esp$n[i] %||% NA_real_, esp$n_casos[i] %||% NA_real_)
    lados <- list(negativo = .cifras_det_cifra(esp$total_neg[i], dec, as.character(esp$cifras_neg[i])),
                  neutro = .cifras_det_cifra(suma_lado(i, "neu"), dec),
                  positivo = .cifras_det_cifra(esp$total_pos[i], dec, as.character(esp$cifras_pos[i])),
                  sin_informacion = .cifras_det_cifra(suma_lado(i, "sin_inf"), dec))
    # El lado de acuerdo es el Top Two Box de la lámina (recetario_m3a.R:50-77).
    caja_lam <- c(list(rotulo = "Acuerdo", categorias = as.list(rot[lado == "pos"])), lados$positivo, list(origen = "lamina"))
    list(clave = as.character(esp$filas[i]), rotulo = as.character(esp$filas[i]), es_total = FALSE, base = base,
         valores = .cifras_det_valores(rot, esp$cifras[i, ], U[i, ], if (is.null(P)) rep(NA_real_, length(rot)) else P[i, ], dec),
         sumas = if (is.null(P)) NA else .cifras_det_sumas(P[i, ], U[i, ], dec, normalizada = TRUE),
         caja = if (length(caja)) .cifras_det_caja_pedida(caja, rot, U[i, ], especial, dec) else caja_lam, lados = lados)
  })
  list(forma = "divergentes", version = as.character(esp$version %||% "")[1],
       base = .cifras_det_base_comun(lapply(out, `[[`, "base"), base_texto),
       redondeo = list(metodo = "estandar", decimales = dec),
       categorias = .cifras_det_categorias(rot, especial, lado), filas = out)
}

#' El detalle de las cifras de una especificación; `NULL` si su forma no lo publica
#'
#' @param espec La especificación (`attr(p, "pulso_espec")`).
#' @param base_texto La «Base: N» que escribe la lámina (render_meta o la nota de la especificación).
#' @param caja Rótulos de las categorías de una caja pedida (`.cifras_detalle_caja`).
#' @keywords internal
.cifras_detalle <- function(espec, base_texto = "", caja = character(0)) {
  if (!is.list(espec)) return(NULL)
  tipo <- as.character(espec$tipo %||% "")[1]
  if (!tipo %in% .CIFRAS_DETALLE_FORMAS) return(NULL)
  base_texto <- as.character(base_texto %||% "")[1]
  if (is.na(base_texto) || !nzchar(base_texto)) {
    nota <- as.character(espec$nota %||% "")[1]
    base_texto <- if (!is.na(nota) && grepl("^Base", nota)) nota else ""
  }
  switch(tipo, categorica = .cifras_detalle_categorica(espec, base_texto, caja),
         escala = .cifras_detalle_escala(espec, base_texto, caja),
         divergentes = .cifras_detalle_divergentes(espec, base_texto, caja))
}

#' El detalle de una agrupada con cruce (`agrupadas_cruce/1`): una fila por grupo, con su n
#'
#' La agrupada con varias series no publica especificación (`pulso_espec` sólo existe con una serie) y su lámina sale
#' como imagen. Lo que el render sí deja en el gráfico son los grupos que dibujó, en su orden (`pulso_barras_series`),
#' y los casos de cada uno (`pulso_barras_bases`, `group_totals_casos` de `.render_barras_agrupadas`): con ellos el
#' inspector muestra cada grupo con su n y su «pocos casos», ya con los filtros y los grupos excluidos. No hay cifras
#' por categoría ni base ponderada por grupo: no se recalculan aparte (la regla de este archivo), así que `valores` va
#' vacío y `n_ponderado` en `NA`.
#' @param p Gráfico renderizado. @param base_texto La «Base: N» de la lámina.
#' @return El detalle, o `NULL` si el gráfico no trae al menos dos grupos.
#' @keywords internal
.cifras_detalle_agrupadas_cruce <- function(p, base_texto = "") {
  series <- as.character(attr(p, "pulso_barras_series", exact = TRUE) %||% character(0))
  bases <- attr(p, "pulso_barras_bases", exact = TRUE)
  if (length(series) < 2L || is.null(attr(p, "pulso_barras_cruce", exact = TRUE))) return(NULL)
  # Por posición: el render llena series y bases en el mismo recorrido de grupos, y dos grupos con el mismo rótulo
  # (recodificados a un mismo texto) tomarían por nombre el n del primero. Si los largos no casan, por nombre y se avisa.
  n <- if (!is.null(bases) && length(bases) == length(series)) {
    vapply(seq_along(series), function(i) .cifras_det_num(bases[[i]]), numeric(1))
  } else {
    if (!is.null(bases)) .pulso_aviso("La agrupada con cruce no publica un n por cada grupo; el detalle los busca por rótulo.")
    vapply(series, function(s) if (!is.null(bases) && s %in% names(bases)) .cifras_det_num(bases[[s]]) else NA_real_, numeric(1))
  }
  filas <- lapply(seq_along(series), function(i) {
    s <- series[[i]]
    list(clave = s, rotulo = s, es_total = FALSE, base = .cifras_det_base(NA_real_, n[[i]]), valores = list(),
         sumas = NA, caja = NA, lados = NA)
  })
  base_texto <- as.character(base_texto %||% "")[1]
  list(forma = "categorica", version = "agrupadas_cruce/1",
       base = .cifras_det_base_comun(lapply(filas, `[[`, "base"), if (is.na(base_texto)) "" else base_texto),
       redondeo = list(metodo = "estandar", decimales = 0L), categorias = list(), filas = filas)
}

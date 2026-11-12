# =============================================================================
# Validación: detector de consistencia (ítem 31 del checklist del practicante)
# =============================================================================
# Sugerencias para que el analista revise, no reglas. Mira la base y devuelve
# pocas observaciones, las más fuertes, cada una con su frase, su cifra y su
# base. Tres familias, una función cada una:
#
#   (a) columna que no se parece a sí misma  validacion_detector_columnas.R
#       atípicos numéricos, enteros con otra cantidad de dígitos, valores con
#       otra forma y datos potencialmente personales.
#   (b) combinación implausible entre preguntas  validacion_detector_combinaciones.R
#       la menor frecuencia o cantidad declarada junto con muchas opciones
#       marcadas en una múltiple; y celdas raras en los pares que el analista pida.
#   (c) concentración por recopilador  `.vdc_concentracion()` (este archivo)
#       si los casos de una sugerencia de (a) o (b) se acumulan en una persona
#       de campo frente a lo que esa persona pesa en el total.
#
# Unidad de análisis: la fila de la base (un caso). Base de toda cifra: los
# casos con dato en las preguntas que la sugerencia mira; cada sugerencia
# declara su base en `cifra`. No hay ponderación: son conteos de filas.
#
# Una sugerencia se publica si es fuerte por sí misma (atípico, forma o dígitos
# dentro de los umbrales; combinación rara frente al resto) o si sus casos se
# concentran en un recopilador. Una combinación que no es rara y no se
# concentra no se publica: es un patrón del estudio, no una rareza.

#' Umbrales del detector de consistencia
#'
#' Una sola fuente: el motor y el payload (`umbrales`) leen esta lista.
#' @keywords internal
.VDC_UMBRALES <- list(
  min_casos = 20L,           # casos con dato para mirar una columna o un par
  atipico_z = 5,             # distancia a la mediana en MAD escaladas (1.4826)
  atipico_max_share = 0.02,  # si más del 2 % queda lejos es cola larga, no atípico
  forma_share = 0.9,         # la forma dominante cubre al menos el 90 % de los valores
  forma_max_share = 0.05,    # y la minoría no pasa del 5 %
  forma_min_distintos = 10L, # columnas de identificadores o códigos, no categorías
  digitos_min = 4L,          # largo dominante mínimo para comparar dígitos
  muchas_min = 3L,           # "muchas opciones": más de la mitad y al menos 3
  rareza_razon = 0.25,       # observados como mucho el 25 % de los esperados
  rareza_p = 0.01,           # cola inferior de Poisson con media = esperados
  rareza_esperado_min = 5,   # sin al menos 5 esperados no se habla de rareza
  conc_min_casos = 3L,       # casos mínimos de una persona para hablar de concentración
  conc_share = 0.5,          # la persona reúne al menos la mitad de los casos
  conc_razon = 2,            # y al menos el doble de lo que pesa en el total
  conc_p = 0.01,             # binomial unilateral, Bonferroni por número de recopiladores
  max_sugerencias = 8L,
  max_casos = 200L           # casos por sugerencia que viajan al cliente
)

# --- Rótulos y formato -------------------------------------------------------

.vdc_rotulo <- function(x) {
  out <- gsub("<[^>]+>", "", as.character(x %||% ""))
  out <- .dim_label_limpio(out)
  out[is.na(out)] <- ""
  out
}

.vdc_pct <- function(k, n) {
  if (!is.finite(n) || n <= 0) return("")
  paste0(formatC(100 * k / n, format = "f", digits = 1), " %")
}

.vdc_plural <- function(n, uno, varios) if (identical(as.integer(n), 1L)) uno else varios

# Valor con dato: ni NA ni texto vacío.
.vdc_con_dato <- function(x) {
  v <- trimws(as.character(x))
  !is.na(x) & !is.na(v) & nzchar(v) & v != "NA"
}

# --- Lectura del formulario --------------------------------------------------

#' Preguntas del formulario con su tipo, lista y rótulo limpio
#' @keywords internal
.vdc_preguntas <- function(survey) {
  if (!is.data.frame(survey) || !nrow(survey) || !"name" %in% names(survey)) return(NULL)
  tipo <- if ("type_base" %in% names(survey)) as.character(survey$type_base)
          else vapply(as.character(survey$type), .type_base, character(1))
  lista <- if ("list_name" %in% names(survey)) as.character(survey$list_name)
           else sub("^\\S+\\s+", "", ifelse(grepl("^select_", as.character(survey$type)), as.character(survey$type), NA_character_))
  rot <- if ("label" %in% names(survey)) .vdc_rotulo(survey$label) else rep("", nrow(survey))
  # Sección (begin_group) a la que pertenece la pregunta; NA si el formulario no agrupa.
  grupo <- if ("group_name" %in% names(survey)) as.character(survey$group_name) else rep(NA_character_, nrow(survey))
  out <- data.frame(name = as.character(survey$name), tipo = tolower(tipo), lista = lista,
                    rotulo = rot, grupo = grupo, stringsAsFactors = FALSE)
  out[!is.na(out$name) & nzchar(out$name), , drop = FALSE]
}

#' Opciones de una lista del formulario: código y rótulo
#' @keywords internal
.vdc_opciones <- function(choices, lista) {
  if (!is.data.frame(choices) || !nrow(choices) || is.na(lista)) return(NULL)
  ch <- choices[as.character(choices$list_name) == lista & !is.na(choices$name), , drop = FALSE]
  if (!nrow(ch)) return(NULL)
  data.frame(codigo = as.character(ch$name),
             rotulo = if ("label" %in% names(ch)) .vdc_rotulo(ch$label) else as.character(ch$name),
             stringsAsFactors = FALSE)
}

# Opciones de cierre: no son contenido sino salida de la pregunta ("Otro",
# "Ninguno", "No sabe"). No cuentan como opción marcada ni como nivel.
.VDC_CIERRE <- "^(otr[oa]s?|ningun[oa]?|no sabe|no responde|no precisa|prefiere no|prefiero no|ns|nr|ns/nr)\\b"

.vdc_es_cierre <- function(rotulo, codigo, especiales) {
  r <- tolower(trimws(as.character(rotulo)))
  grepl(.VDC_CIERRE, r, perl = TRUE) | as.character(codigo) %in% as.character(especiales)
}

# Nombre que ve el usuario en una frase: el `name` de la pregunta (lo que se
# ve en las fichas de Validación). El rótulo completo viaja aparte.
.vdc_pregunta_ref <- function(pregs, var) {
  rot <- if (!is.null(pregs)) pregs$rotulo[match(var, pregs$name)] else NA_character_
  list(variable = var, rotulo = if (is.na(rot) || !nzchar(rot)) NA_character_ else rot)
}

# --- (c) Concentración por recopilador ----------------------------------------

#' ¿Los casos de una sugerencia se concentran en un recopilador?
#'
#' Prueba binomial unilateral: con `m` casos marcados y una persona que hizo la
#' fracción `p` de las encuestas, ¿qué tan probable es que reúna `x` o más?
#' Se corrige por el número de recopiladores (Bonferroni). Base: las filas con
#' recopilador declarado; los casos sin recopilador no entran en el conteo.
#'
#' @param filas índices (1-based) de los casos de la sugerencia.
#' @param grupo vector con el recopilador de cada fila de la base, o NULL.
#' @param variable nombre de la columna del recopilador (para la frase).
#' @return lista `estado` ("sin_rol", "pocos_casos", "repartida", "concentrada"),
#'   `texto` y, si hay persona destacada, sus cifras.
#' @keywords internal
.vdc_concentracion <- function(filas, grupo, variable = NA_character_, u = .VDC_UMBRALES) {
  if (is.null(grupo)) {
    return(list(estado = "sin_rol",
                texto = "Sin un recopilador declarado no se mide si estos casos se concentran en una persona de campo."))
  }
  g <- trimws(as.character(grupo))
  ok <- .vdc_con_dato(grupo)
  n_total <- sum(ok)
  gm <- g[filas][ok[filas]]
  m <- length(gm)
  if (n_total == 0L || m < u$conc_min_casos) {
    return(list(estado = "pocos_casos", n_casos = m,
                texto = sprintf("Con %d %s no se mide si se concentran en una persona de campo.",
                                m, .vdc_plural(m, "caso", "casos"))))
  }
  tot <- table(g[ok])
  sub <- table(gm)
  k <- length(tot)
  cand <- lapply(names(sub), function(r) {
    x <- as.integer(sub[[r]]); n_r <- as.integer(tot[[r]]); p_r <- n_r / n_total
    p <- stats::pbinom(x - 1L, m, p_r, lower.tail = FALSE)
    list(recopilador = r, x = x, n_r = n_r, p_r = p_r, p_ajustado = min(1, k * p))
  })
  mejor <- cand[[which.min(vapply(cand, `[[`, numeric(1), "p_ajustado"))]]
  share <- mejor$x / m
  concentrada <- mejor$x >= u$conc_min_casos && share >= u$conc_share &&
    share / mejor$p_r >= u$conc_razon && mejor$p_ajustado < u$conc_p
  base <- list(variable = variable, recopilador = mejor$recopilador, n_casos_recopilador = mejor$x,
               n_casos = m, n_encuestas_recopilador = mejor$n_r, n_encuestas = n_total,
               n_recopiladores = k, p_ajustado = signif(mejor$p_ajustado, 3))
  if (!concentrada) {
    return(c(list(estado = "repartida",
                  texto = sprintf("Los %d casos se reparten entre %d %s; ninguno reúne más de lo que pesa en el total.",
                                  m, length(sub), .vdc_plural(length(sub), "recopilador", "recopiladores"))),
             base))
  }
  c(list(estado = "concentrada",
         texto = sprintf("%d de los %d casos (%s) son de %s, que hizo %d de las %d encuestas (%s).",
                         mejor$x, m, .vdc_pct(mejor$x, m), mejor$recopilador,
                         mejor$n_r, n_total, .vdc_pct(mejor$n_r, n_total))),
    base)
}

# --- Casos que viajan al cliente ----------------------------------------------

.vdc_casos <- function(data, filas, variables, fila_origen, grupo, u = .VDC_UMBRALES) {
  filas <- utils::head(filas, u$max_casos)
  vars <- intersect(unique(variables), names(data))
  lapply(filas, function(i) {
    vals <- lapply(vars, function(v) {
      x <- data[[v]][i]
      if (is.na(x)) NA_character_ else as.character(x)
    })
    names(vals) <- vars
    list(fila = as.integer(fila_origen[i]),
         recopilador = if (is.null(grupo) || is.na(grupo[i])) NA_character_ else as.character(grupo[i]),
         valores = vals)
  })
}

# --- Orquestador ---------------------------------------------------------------

#' Detector de consistencia: sugerencias para que el analista revise
#'
#' @param data data.frame de la base (una fila por caso).
#' @param survey,choices hojas del formulario (o NULL: se mira solo la data).
#' @param recopilador nombre de la columna del recopilador declarado, o NA.
#' @param fila_origen número de fila de cada caso en la base cargada (NULL: 1..n).
#' @param especiales códigos especiales declarados por el estudio (no son valores).
#' @param pares lista de pares `c(a, b)` de preguntas que el analista pide cruzar.
#' @param excluir columnas que no se miran (roles del operativo, metadatos).
#' @return lista `n_total`, `recopilador`, `umbrales`, `sugerencias` (las más
#'   fuertes, hasta `max_sugerencias`), `n_candidatas` y `avisos`.
#' @keywords internal
validacion_detector_consistencia <- function(data, survey = NULL, choices = NULL,
                                             recopilador = NA_character_, fila_origen = NULL,
                                             especiales = character(0), pares = list(),
                                             excluir = character(0), u = .VDC_UMBRALES) {
  data <- as.data.frame(data, check.names = FALSE, stringsAsFactors = FALSE)
  n <- nrow(data)
  if (is.null(fila_origen) || length(fila_origen) != n) fila_origen <- seq_len(n)
  rec <- as.character(recopilador %||% NA_character_)[1]
  avisos <- list()
  if (!is.na(rec) && nzchar(rec) && !rec %in% names(data)) {
    avisos[[length(avisos) + 1L]] <- list(
      codigo = "recopilador_sin_columna",
      texto = sprintf("El recopilador declarado (%s) no es una columna de esta base: no se mide la concentración por persona.", rec))
    rec <- NA_character_
  }
  tiene_rol <- !is.na(rec) && nzchar(rec)
  grupo <- if (tiene_rol) data[[rec]] else NULL
  if (!tiene_rol) {
    avisos[[length(avisos) + 1L]] <- list(
      codigo = "sin_recopilador",
      texto = "No hay un recopilador declarado: las sugerencias no dicen si sus casos se concentran en una persona de campo.")
  }
  pregs <- .vdc_preguntas(survey)
  especiales <- as.character(unlist(especiales %||% character(0)))
  excluir <- unique(c(excluir, if (tiene_rol) rec))

  cands <- c(
    .vdc_familia_columnas(data, pregs, especiales, excluir, u),
    .vdc_familia_combinaciones(data, pregs, choices, especiales, pares, u)
  )
  sugerencias <- lapply(cands, function(s) {
    s$concentracion <- if (length(s$filas)) .vdc_concentracion(s$filas, grupo, rec, u) else NULL
    s
  })
  publicables <- Filter(function(s) isTRUE(s$fuerte) || identical(s$concentracion$estado, "concentrada"), sugerencias)
  orden <- order(-vapply(publicables, .vdc_puntaje, numeric(1)))
  publicables <- publicables[orden]
  elegidas <- utils::head(publicables, u$max_sugerencias)
  salida <- lapply(seq_along(elegidas), function(i) {
    s <- elegidas[[i]]
    vars <- unlist(lapply(s$variables, `[[`, "variable"))
    list(
      id = sprintf("SC_%02d", i),
      familia = s$familia,
      tipo = s$tipo,
      titulo = s$titulo,
      texto = s$texto,
      variables = s$variables,
      cifra = s$cifra,
      concentracion = s$concentracion,
      casos = if (length(s$filas)) .vdc_casos(data, s$filas, c(vars, if (tiene_rol) rec), fila_origen, grupo, u) else list(),
      regla = s$regla %||% NULL
    )
  })
  list(
    n_total = n,
    recopilador = if (tiene_rol) .vdc_pregunta_ref(pregs, rec) else NULL,
    umbrales = u,
    n_candidatas = length(publicables),
    sugerencias = salida,
    avisos = avisos
  )
}

# Orden: primero lo que se concentra en una persona (la señal más grave), luego
# las combinaciones raras por su cola de Poisson, y al final las columnas.
.vdc_puntaje <- function(s) {
  conc <- s$concentracion
  if (identical(conc$estado, "concentrada")) return(1000 - log10(max(conc$p_ajustado, 1e-300)))
  p <- s$cifra$p_rareza %||% NA_real_
  if (isTRUE(s$fuerte) && is.finite(p)) return(500 - log10(max(p, 1e-300)))
  10 + (s$peso %||% 0)
}

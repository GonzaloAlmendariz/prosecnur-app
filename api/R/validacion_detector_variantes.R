# =============================================================================
# Detector de consistencia, familia (a): un mismo valor escrito de otra forma
# =============================================================================
# En una columna de texto, dos respuestas que solo difieren en mayúsculas,
# tildes, signos o espacios ("COMAs" y "COMAS", "Rimac" y "RÍMAC") son el
# mismo valor. El catálogo de ubigeos y "Valor distinto al habitual en su
# grupo" las comparan normalizadas a propósito, así que no las marcan; para
# un tabulado o un cruce, en cambio, son dos categorías. Esta mirada las
# muestra: el valor cuya escritura no es la más común de su grupo.
#
# Grupo: las respuestas con la misma forma normalizada
# (`catalogo_ubigeo_normalizar()`, la de las reglas). Forma más común: la de
# `.regla_moda_forma()`, la misma que nombra el valor en la regla de moda.
# Se mira un grupo con 3 respuestas o más cuya forma más común reúne al menos
# 2 de cada 3, en columnas que se repiten (no más de un valor distinto por cada
# dos casos con dato). Base de la cifra: los casos con dato en la columna.
#
# Es una sugerencia fuerte, como "Valores con otra forma", si las variantes no
# pasan del 5 % de los casos con dato (`forma_max_share`): con más, la columna
# se digita sin un criterio de escritura y avisar caso por caso no ayuda.

.VDC_VARIANTE_MIN_GRUPO <- 3L
.VDC_VARIANTE_APOYO <- 2 / 3
.VDC_VARIANTE_DISTINTOS <- 0.5

#' Valores escritos distinto de la forma más común de su grupo
#' @keywords internal
.vdc_variantes <- function(data, var, pregs, u = .VDC_UMBRALES) {
  x <- data[[var]]
  if (is.numeric(x)) return(NULL)
  v <- .vdc_valores_texto(x)
  ok <- !is.na(v)
  n_ok <- sum(ok)
  if (n_ok < u$min_casos || all(grepl("^[0-9]+$", v[ok]))) return(NULL)
  # Texto casi único (direcciones, referencias, nombres): no es una categoría
  # que se tabule, y dos escrituras parecidas ahí no son el mismo valor.
  if (length(unique(v[ok])) > .VDC_VARIANTE_DISTINTOS * n_ok) return(NULL)
  clave <- catalogo_ubigeo_normalizar(v)
  clave[!ok] <- NA_character_
  forma <- .regla_moda_forma(clave, v)
  n_clave <- table(clave[!is.na(clave)])
  n_forma <- vapply(names(forma), function(k) sum(!is.na(clave) & clave == k & v == forma[[k]]), integer(1))
  grupos_ok <- names(forma)[as.integer(n_clave[names(forma)]) >= .VDC_VARIANTE_MIN_GRUPO &
                              n_forma / as.integer(n_clave[names(forma)]) >= .VDC_VARIANTE_APOYO]
  if (!length(grupos_ok)) return(NULL)
  esperada <- unname(forma[clave])
  filas <- which(!is.na(clave) & clave %in% grupos_ok & v != esperada)
  if (!length(filas)) return(NULL)
  k <- length(filas)
  if (k > max(1, floor(u$forma_max_share * n_ok))) return(NULL)
  pares <- unique(data.frame(v = v[filas], f = esperada[filas], stringsAsFactors = FALSE))
  ej <- utils::head(pares, 3L)
  ej_txt <- vapply(seq_len(nrow(ej)), function(i) {
    sprintf("\"%s\" (%d) frente a \"%s\" (%d)", ej$v[i], sum(v[filas] == ej$v[i]), ej$f[i],
            sum(!is.na(v) & v == ej$f[i]))
  }, character(1))
  list(
    familia = "columna", tipo = "variante", fuerte = TRUE, peso = 2,
    variables = list(.vdc_pregunta_ref(pregs, var)),
    titulo = sprintf("Un mismo valor escrito de otra forma en %s", var),
    texto = sprintf("%d %s de %s solo %s de la escritura más común en mayúsculas, tildes, signos o espacios: %s. En un tabulado saldrían como valores distintos.",
                    k, .vdc_plural(k, "caso", "casos"), var, .vdc_plural(k, "difiere", "difieren"),
                    paste(ej_txt, collapse = "; ")),
    cifra = list(n_casos = k, base_n = n_ok, base = "casos con dato en la columna",
                 n_variantes = nrow(pares)),
    filas = filas
  )
}

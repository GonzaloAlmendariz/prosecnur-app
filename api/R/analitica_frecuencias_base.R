# Base de cada tabla de la vista previa de Frecuencias, en casos sin ponderar.
#
# Regla I1 (docs/qa/contrato-base-sin-ponderar-graficos-f6-2026-10-11.md, §0 y
# §2.7): la base es un número entero de casos con respuesta válida, SIN
# ponderar; lo ponderado son los porcentajes y los estadísticos. Las filas, el
# Total y el resumen de la vista previa siguen siendo los del archivo (sumas de
# peso); aquí solo se cuentan casos.
#
# Unidad: la fila de la base que entra a las tablas, con el universo de análisis
# ya aplicado. Un caso cuenta si su peso es mayor que cero; el peso es el mismo
# vector que usa el motor del archivo (`.peso_vec()`: NA y no finitos valen 0,
# sin columna `peso` todos valen 1).
#
# Ninguna cifra se recalcula aquí: la base de una tabla categórica es la columna
# `n_casos` de la fila Total que ya calcula `freq_table_spss(casos = TRUE)` sobre
# las MISMAS filas que suman el Total del archivo. En una múltiple esa cifra son
# las personas con al menos una marca y peso > 0 (un caso que marcó dos opciones
# cuenta una vez), no la suma de las opciones; por eso se lee de la fila Total y
# nunca se suma por filas, que además pueden juntarse al limpiar rótulos.

# Casos que cuentan con peso > 0. Es `base.de` de toda tabla y `casos.con_peso`.
.frecuencias_base_con_peso <- function(data) {
  as.integer(sum(.peso_vec(data) > 0))
}

# Casos sin ponderar del denominador de una tabla categórica: quienes
# respondieron (única) o marcaron al menos una opción (múltiple), con peso > 0.
# Sale de la última fila de `freq_table_spss()`, que es siempre el Total que
# esa función agrega al final (no se busca por rótulo: una opción puede
# llamarse "Total"). Sin respuestas, la tabla viene vacía y la base es 0.
.frecuencias_base_categorica <- function(data, var, survey = NULL, sm_vars_force = NULL,
                                         orders_list = NULL, mostrar_todo = FALSE,
                                         codigos_solo_si_presentes = NULL) {
  tab <- freq_table_spss(
    data, var,
    survey = survey,
    sm_vars_force = sm_vars_force,
    orders_list = orders_list,
    mostrar_todo = mostrar_todo,
    codigos_solo_si_presentes = codigos_solo_si_presentes,
    casos = TRUE
  )
  if (!nrow(tab)) return(0L)
  as.integer(tab$n_casos[[nrow(tab)]])
}

# Casos sin ponderar del denominador de una numérica: "Casos válidos" del
# resumen del archivo (valor numérico y peso > 0), que ya es un conteo.
.frecuencias_base_numerica <- function(tabn) {
  if (!nrow(tabn)) return(0L)
  as.integer(tabn$valor[[1]])
}

# Escala de los pesos aplicados: "normalizada" (media 1, las sumas se leen en
# casos de la muestra) o "expansion" (suman la población). `NA` si no hay
# ponderación aplicada o si los pesos vienen tal cual de una columna de la base,
# porque entonces la app no fijó su escala y no se puede declarar ninguna.
# Fuente: el estado de la corrida (`estado$escala`, ponderacion_analitica.R);
# cuando el estado se derivó sin ese dato (bases hijas que heredan el peso), la
# config de la base dice si se pidió expansión, y el motor no aplica una
# expansión pedida sin producirla (falla con E_*).
.frecuencias_base_escala <- function(estado, pond) {
  if (!is.list(estado) || !identical(as.character(estado$status %||% "")[1], "aplicada")) {
    return(NA_character_)
  }
  if (identical(as.character(estado$modo %||% "")[1], "columna")) return(NA_character_)
  pedida <- tolower(as.character(.analitica_ponderacion_scalar((pond %||% list())$escala, "")))
  if (identical(as.character(estado$escala %||% "")[1], "expansion") || identical(pedida, "expansion")) {
    return("expansion")
  }
  "normalizada"
}

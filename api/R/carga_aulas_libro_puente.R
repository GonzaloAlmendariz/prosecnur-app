# El puente plataforma/parte de la hoja «Avance de campo» — B7.3 (choque 5 del
# censo `docs/qa/censo-cuatro-cifras-2026-09-01.md`).
#
# En la hoja conviven dos familias de «efectivas» con casi el mismo nombre: las
# del bloque de meta y el diario (cifra de PLATAFORMA) y las «Efectivas
# declaradas» de la produccion por aplicador (cifra del PARTE). La nota que las
# distinguia solo existia dentro de `if (sin_dato)`: cuando faltaban los datos
# la hoja explicaba la distincion, y cuando las dos familias estaban presentes
# —que es cuando de verdad chocan— no decia nada y quien leia elegia cual creer.
#
# Este helper es la UNICA implementacion del puente con-datos y de su decision,
# para los dos renderers (`aulas_libro_escribir_indicadores` en el xlsx,
# `aulas_libro_hoja_avance` en Sheets):
#
#   · el TEXTO vive aqui una sola vez — el contrato exige que el equipo que
#     descarga el xlsx y el que mira la pestaña reciban la MISMA explicacion,
#     y dos literales gemelos en dos archivos es exactamente como se separan;
#   · la CONDICION tambien: puente solo cuando estan LAS DOS familias
#     (plataforma completa Y partes con filas). Con `sin_dato > 0` devuelve
#     NULL — ese caso ya lo sirve la nota historica de cada renderer («se
#     llenan al cargar la base de respuestas»), que se conserva tal cual — y
#     con plataforma sola sin partes tambien: no hay choque que explicar, y el
#     pin de test-carga-aulas-libro-indicadores-forma.R exige esa ausencia.
#     Tener el guard aqui y no repetido en cada llamador evita que las dos
#     capas lean la regla distinto.
#
# El texto nombra ambas fuentes en UNA celda (el detector del test es
# semantico: «plataforma» + «\bparte» juntas) y dice POR QUE pueden no cuadrar
# —el parte es lo declarado al cerrar el aula; la plataforma, lo ya recibido
# como efectiva— sin repetir la causal del caso vacio, que con la base cargada
# seria falsa.

# El puente cuando las dos familias estan presentes, o NULL cuando no toca.
# `sin_dato` es el contador de huecos del bloque de meta del renderer que
# llama; `aplicadores` es la tabla del modelo de `aulas_libro_indicadores()`.
.calap_puente_con_datos <- function(sin_dato, aplicadores) {
  if (isTRUE(sin_dato > 0L)) return(NULL)
  if (!is.data.frame(aplicadores) || !nrow(aplicadores)) return(NULL)
  paste0(
    "La meta y el avance diario se miden en la plataforma; la producción por ",
    "aplicador, en el parte de campo. Pueden no cuadrar: el parte recoge lo ",
    "que cada aplicador declara al cerrar el aula, y la plataforma cuenta ",
    "solo las respuestas que ya llegaron como efectivas."
  )
}

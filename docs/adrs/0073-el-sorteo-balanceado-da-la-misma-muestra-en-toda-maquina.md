# ADR 0073 — El sorteo balanceado da la misma muestra en toda máquina

- **Estado**: aceptada
- **Implementación**: completa
- **Fecha**: 2026-08-11
- **Contexto previo**: ADR 0066 (la probabilidad publicada es la del sorteo ejecutado), ADR 0019 (monitoreo de aulas). Este ADR es la condición que faltaba para que la promesa del 0066 se sostenga fuera de la máquina donde se sorteó.
- **Origen**: el gate del corte 0.8.0. `backend-r` falló en el runner Linux con el golden de simulación de reemplazos mientras la misma suite pasaba en macOS.

## Contexto

La selección de aulas sortea por el método del cubo (Deville-Tillé), vía
`sampling::samplecube`. En cada paso, la fase de vuelo necesita un vector **no
nulo del núcleo** de la matriz de balance, y lo obtiene con
`svd(X1)$u[, p + 1]`.

Cualquier vector del núcleo sirve: la matemática del método no distingue entre
`u` y `-u`, ni entre dos vectores que difieran en la decimoquinta cifra. Pero
esa indiferencia matemática no es indiferencia operativa. La dirección del paso
decide **qué unidad se satura primero**, y por lo tanto qué aulas entran a la
muestra. Los vectores singulares están definidos salvo signo, LAPACK no
especifica cuál devuelve, y cada implementación de BLAS elige el suyo:
Accelerate en macOS, OpenBLAS en el runner de Linux.

Medido el 2026-08-11 sobre el fixture golden de simulación, con la misma
semilla, el mismo R 4.5.1 y el mismo `sampling` 2.11:

| Entorno | Titulares sorteados |
|---|---|
| macOS (Accelerate) | `A11 A3 A4 A9` |
| Linux CI (OpenBLAS) | `A1 A11 A3 A7` |
| macOS con el signo del svd invertido a mano | `A11 A2 A3 A8` |

Tres muestras distintas del mismo diseño. El defecto no es del CI: Prosecnur se
distribuye en Windows y macOS, así que dos investigadores con el mismo proyecto
y la misma semilla obtenían muestras distintas. Una selección que no se puede
reproducir no se puede defender ante un comité, y el ADR 0066 promete
justamente que la probabilidad publicada describe el sorteo ejecutado.

El defecto sobrevivió a varias corridas verdes porque el único guardián era un
golden, y un golden solo sabe decir «distinto». Cada plataforma lo regeneraba a
su favor: `ed66b082` lo regeneró en macOS con un gate parcial declarado en su
propio mensaje («2510 PASS R, 21 archivos»), y nunca corrió en Linux.

## Decision

El método no cambia: se le quita la ambigüedad.

La fase de vuelo y el aterrizaje del cubo pasan a resolverse con
`.cm_aulas_svd_canonico()` (`api/R/calc_muestra_aulas_cube_determinista.R`), que
envuelve `base::svd` y

1. **fija el signo** de cada vector singular con una regla del repositorio: la
   primera componente significativa, recorriendo en orden de índice, es
   positiva. `v` acompaña a `u` para no romper `x = u d v'`;
2. **recorta el ruido** redondeando a `CM_AULAS_CUBE_DIGITS = 12` cifras.

La tolerancia cae en una ventana estrecha por los dos lados. Más fina que
`1e-15` dejaría pasar el ruido entre implementaciones de LAPACK, que es lo que
se quiere matar. Más gruesa que `1e-11` chocaría con el `EPS` que usa `sampling`
para decidir si un `pik` ya llegó a 0 o a 1, y dejaría componentes que deberían
estar fijadas viviendo como todavía fraccionarias, alargando la fase de vuelo y
empujando al aterrizaje casos que no le tocaban.

El estimador, las probabilidades de inclusión y el balance no cambian. Cambia
**cuál** de los vectores igualmente válidos del núcleo se toma, que es lo que
estaba quedando al azar de la biblioteca de álgebra lineal de cada máquina.

La envoltura se acopla a la estructura interna de `sampling` de forma
deliberada y acotada: si el paquete deja de exportar `fastflightcube` o
`samplecube`, o de resolver `svd` por búsqueda léxica,
`.cm_aulas_cube_determinista()` devuelve `NULL` y quien llama decide. Nunca se
sortea a medias.

## Consecuencias

- El mismo proyecto con la misma semilla produce la misma muestra en macOS,
  Windows y Linux.
- **Las selecciones ejecutadas antes de este ADR no son reproducibles.** Un
  estudio ya entregado conserva su muestra y sus probabilidades, que siguen
  siendo válidas: el método del cubo garantiza los `pik` sea cual sea el vector
  del núcleo elegido. Lo que no se puede es re-ejecutar el sorteo y esperar la
  misma muestra. Si hay que reproducir una selección anterior, se parte del plan
  guardado en el `.pulso`, no de volver a sortear.
- El golden `simulacion.rds` se regeneró. Los de `cadenas` y `escala` no
  cambiaron.
- Un golden deja de ser el único guardián de esta propiedad: la invariante se
  prueba por su causa.

## Cumplimiento

- `api/tests/testthat/test-calc-muestra-aulas-cube-reproducible.R` sustituye
  `base::svd` por uno que devuelve el signo contrario, que es igual de válido, y
  exige que la selección, las probabilidades publicadas y la cadena de
  reemplazos no cambien. Comprueba además la premisa: si el fixture dejara de
  sortear por cubo, el test lo dice en vez de pasar sin ejercer nada.
- Verificado RED→GREEN el 2026-08-11: con el camino anterior
  (`sampling::samplecube` directo) las dos plataformas simuladas dan
  `A3 A4 A2 …` y `A2 A3 A4 …`; con la envoltura, idénticas.
- `api/tests/testthat/test-calc-muestra-aulas.R` conserva los tres goldens de
  caracterización.

## Notas

Regla general que deja este caso: **un golden no puede ser el único guardián de
una invariante de reproducibilidad**. Solo sabe decir «distinto», no «por qué»,
y cuando el defecto depende de la máquina, cada plataforma lo regenera a su
favor y el rojo se vuelve un trámite. La invariante hay que probarla por su
causa: perturbando aquello que no debería importar y exigiendo que el resultado
no se mueva.

El mismo patrón vive en cualquier motor que dependa de álgebra lineal para
tomar una decisión discreta. `local_pivotal_balanceado` (BalancedSampling)
resuelve por otra vía y no está cubierto por este ADR; si algún día pasa a ser
un motor por defecto, necesita su propia prueba de reproducibilidad.

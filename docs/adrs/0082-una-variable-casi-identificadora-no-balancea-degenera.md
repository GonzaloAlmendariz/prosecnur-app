# ADR 0082 — Una variable casi identificadora no balancea: degenera el sorteo

- **Estado**: aceptada
- **Fecha**: 2026-08-26
- **Contexto**: certificación de cobertura por facultad del estudio HSVG PUCP
  2026-2 sobre `HSVG26ULT.pulso` (universo 5.269 cursos-horario, marco incluido
  1.512 tras la exclusión DAA). Dos facultades —Gestión y Alta Dirección,
  Psicología— llevaban ~55 minutos sin completar su certificación mientras el
  resto terminaba en minutos, y el usuario preguntó si el sorteo era correcto.

## Contexto

El motor de aulas sortea cursos-horario por el método del cubo
(`cube_balanceado` → `.cm_aulas_pick_cube` → `.cm_aulas_samplecube_estable`,
que envuelve `sampling::samplecube` con una SVD canónica por el ADR 0073). El
cubo balancea sobre la matriz que arma `.cm_aulas_balance_matrix` a partir de
`selector$balance_vars`, cuyo valor por defecto era
`c("faculty", "sex_top_1", "size_group", "program", "level")`.

La certificación (`calc_muestra_aulas_certeza`) busca el mínimo número de aulas
que alcanza la cuota con probabilidad ≥ 95%, evaluando hasta
`.CM_CERTEZA_MAX_EVALUACIONES = 16` candidatos, cada uno con `corridas`
sorteos completos. El costo total es, por lo tanto,
`candidatos × corridas × costo_por_sorteo`.

## El hecho que lo motiva

`program` no es una categoría: es **casi un identificador**. Medido sobre el
marco incluido de HSVG 2026-2:

| Facultad | Aulas | Niveles de `program` |
|---|---|---|
| Ciencias e Ingeniería | 417 | 304 |
| Derecho | 293 | 175 |
| EE.GG. Letras | 148 | 105 |
| Gestión y Alta Dirección | 49 | 34 |
| Letras y Ciencias Humanas | 14 | 13 |
| Ciencias Contables | 10 | 9 |

Cada nivel se vuelve una columna dummy, así que la matriz de balanceo crece
hasta rozar —o superar— el número de unidades del estrato: 44 columnas para
49 aulas en Gestión, **62 columnas para 60 aulas** en Ciencias Sociales, 315
para 417 en Ciencias e Ingeniería.

Con `p ≈ N` el cubo queda **degenerado**. La fase de vuelo sólo puede volver
enteras `N − p` unidades; el resto cae a la fase de aterrizaje, cuyo costo es
`2^q` con `q` unidades no enteras. Y ahí aparece el defecto que no avisa:
`sampling::landingcube` construye `matrix(0, cc, N)` con `cc = 2^q`, y con
`q ≥ 31` **desborda el entero de R**. El síntoma literal es un warning
—`NAs introduced by coercion to integer range`— que ningún gate mira, y el
sorteo continúa como si nada.

Es decir: el sorteo «balanceado» no estaba balanceando por nada interpretable,
y en los estratos donde el aterrizaje desbordaba, lo hacía sobre una matriz con
NA. El síntoma visible fue la lentitud; el defecto real era la validez.

Medición controlada, un sorteo con la misma semilla, con y sin `program`:

| Facultad | N | Sortea | Columnas | Con `program` | Columnas | Sin `program` |
|---|---|---|---|---|---|---|
| Gestión | 49 | 7 | 44 | > 25 s | 11 | 0,12 s |
| Psicología | 54 | 7 | 39 | > 25 s | 8 | 0,01 s |
| Artes Escénicas | 58 | 8 | 51 | 0,39 s | 12 | 0,03 s |
| Ciencias Sociales | 60 | 8 | 62 | 0,28 s | 12 | 0,02 s |
| Derecho | 293 | 37 | 186 | 1,68 s | 12 | 0,09 s |
| Ciencias e Ingeniería | 417 | 53 | 315 | 6,86 s | 12 | 0,22 s |

Sacar `program` baja las columnas a 8–12 y el sorteo a centésimas: entre 200×
y 2.000×. La certificación completa de Gestión, que no terminaba en horas,
pasó a **19 s con 300 corridas**.

## Decisión

**1 · Una variable sólo balancea si el sorteo puede efectivamente balancearla.**
Con `k` unidades a sortear y `L` niveles, balancear exige `L ≪ k`. Pedirle al
cubo que balancee 304 programas eligiendo 53 aulas no es una restricción
ambiciosa: es una restricción imposible, y el motor la acata degenerándose.
`program` sale de `balance_vars` por defecto. Quedan `faculty`, `sex_top_1`,
`size_group` y `level`, que son las que el sorteo sí puede honrar.

**2 · Esto no pierde balanceo: elimina balanceo falso.** El diseño previo no
estaba equilibrando por programa —no podía—; estaba pagando el costo de
pretenderlo y comprometiendo la fase de aterrizaje a cambio de nada.

**3 · La matriz de balanceo se acota contra el estrato, no contra el marco.**
El defecto no lo causa el tamaño del marco: Derecho con 293 aulas tarda 1,68 s
y Artes Escénicas con 58 tarda 0,39 s. Lo causa la razón entre columnas y
unidades **dentro del estrato que se sortea**. Cualquier variable casi
identificadora futura reproduce el problema, así que la guarda se pone sobre la
razón `p/N`, no sobre una lista negra de nombres.

**4 · El desborde del aterrizaje no puede seguir siendo silencioso.** Un sorteo
producido sobre una matriz con NA debe fallar declarándolo, nunca devolver una
selección de aspecto normal. Es el mismo principio del ADR sobre descartes
silenciosos: reparar la causa no basta si el detector sigue ciego.

**5 · El presupuesto de corridas se escala por costo de búsqueda, no por
tamaño de marco.** `.cm_certeza_corridas` hoy recorta con
`if (n_aulas <= 60L) return(pedidas)`, de modo que los estratos chicos corren
las corridas completas y los grandes se recortan a 40. Está calibrado en el eje
equivocado: el costo lo manda `candidatos × corridas × costo_por_sorteo`, y el
costo por sorteo depende de la geometría de la matriz, no del `N`.

## Consecuencias

- **Toda certificación anterior a esta decisión es inválida** y debe rehacerse:
  se calculó con el cubo degenerado. Para HSVG 2026-2 eso incluye el reparto de
  159 aulas certificadas y el 19 de Derecho.
- El presupuesto liberado se reinvierte en precisión: con el sorteo 200× más
  barato, las 15 facultades admiten 1.000 corridas por candidato, lo que baja
  el error estándar de una probabilidad cercana a 0,95 de ±1,26 pp a ±0,69 pp.
  Subir de ahí rinde poco: a 2.000 corridas el error es ±0,49 pp, ya por debajo
  de la incertidumbre de τ, que es un supuesto de campo.
- Los estudios con `.pulso` guardados antes de esta fecha conservan
  `program` en `balance_vars`; al reabrirlos hay que reconfigurarlo.

## Alternativas descartadas

- **Bajar las corridas para que termine.** Trata el síntoma. El sorteo seguiría
  degenerado y el resultado seguiría apoyado en el aterrizaje desbordado.
- **Agrupar `program` en categorías.** Defendible en abstracto, pero exige una
  taxonomía de programas que hoy no existe y que sería una decisión sustantiva
  del estudio, no del motor. Si aparece esa taxonomía, entra como variable
  propia con pocos niveles.
- **Cambiar a `BalancedSampling::lcube`,** que es C++ y está instalado. No
  arregla la degeneración —`p ≈ N` sigue siendo un diseño sin grados de
  libertad— y rompería la reproducibilidad entre plataformas del ADR 0073.

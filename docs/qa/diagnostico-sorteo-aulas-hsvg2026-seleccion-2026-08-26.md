# Diagnóstico del sorteo de aulas — HSVG PUCP 2026-2

Tipo: Diagnóstico QA
Estado: En curso
Fecha: 2026-08-26
Autoridad: Evidencia de QA; no reemplaza un ADR

**Proyecto**: `HSVG26ULT.pulso` (universo 5.269
cursos-horario, marco incluido 1.512 tras la exclusión DAA) · **Estado**: sorteo elegido y validado

Documento vivo. Registra el recorrido completo del diagnóstico, incluidas las
hipótesis que resultaron falsas, porque descartarlas costó trabajo y volver a
levantarlas costaría el mismo.

---

## La pregunta que lo inicia

Durante la certificación de cobertura por facultad, dos facultades —Gestión y
Alta Dirección, Psicología— llevaban ~55 minutos sin completar mientras el
resto terminaba en minutos. Gonzalo lo planteó así:

> «me hace cuestionar si el sorteo que estás haciendo de Montecarlo es como
> correcto»

La pregunta era correcta. La respuesta resultó ser sí, pero no por donde
parecía.

---

## Recorrido de hipótesis

| # | Hipótesis | Cómo se probó | Veredicto |
|---|---|---|---|
| H1 | El algoritmo de Monte Carlo está mal | Lectura del motor + medición de un sorteo aislado | **Falsa** — el algoritmo es correcto |
| H2 | Otra sesión borró código del paquete | `grep` de la función ausente, luego `du -k` del archivo | **Falsa** — ver H3 |
| H3 | iCloud está vaciando archivos | `du -k` (0K con tamaño lógico correcto) + `brctl download` | **Cierta** — causa de 6 síntomas |
| H4 | El costo lo manda el tamaño del marco (≤60) | Cronómetro por facultad | **Falsa** — Derecho con 293 tarda 1,68 s |
| H5 | El recorte de corridas está mal calibrado | Lectura de `.cm_certeza_corridas` | **Cierta, pero agravante** |
| H6 | `program` degenera la matriz de balanceo | Conteo de columnas + sorteo con y sin | **Cierta — causa raíz** |

---

## H3 · iCloud vaciaba los archivos

`~/Documents/` está en iCloud Drive con «Optimizar almacenamiento». iCloud saca
el contenido de los archivos y deja la metadata: `ls` muestra el tamaño
correcto, `du -k` dice **0K**, y **cualquier lectura devuelve vacío sin error**.

Un solo origen produjo seis síntomas que parecían seis bugs distintos:

1. Jobs de certeza muriendo con `could not find function ".slide_names"`
2. `could not find function "collection_state_migrate_legacy"`
3. `pkgload::load_all` muriendo al cargar el paquete
4. `zip error: Cannot open zip file ... HSVG26ULT.pulso`
5. `git worktree add` con `fatal: mmap failed: Operation timed out`
6. `git grep` colgándose

**Medido**: 145 de los 436 `.R` de `api/R` desalojados; **12.487** objetos de
`.git/objects` (de 1,1 GB); el `.pulso` del estudio; la fuente de verdad de la
DAA.

**Error propio que hay que dejar escrito**: llegué a afirmar que la sesión
`rescate/graficos-lote-nueve` había borrado `.slide_names`, porque un `grep`
sobre el archivo devolvía 0 coincidencias. Tras `brctl download`, la función
aparecía en la línea 5254 del mismo archivo. **Un `grep` que devuelve 0 sobre
un archivo en iCloud no prueba ausencia.** La acusación era falsa y el árbol de
esa sesión estaba limpio.

**Remedio aplicado**: motor y `.pulso` copiados a disco local fuera de iCloud;
backend en 8791 desde esa copia. **Remedio de fondo pendiente** (lo hace el
usuario): apagar «Optimizar almacenamiento del Mac».

Efecto colateral medido: `pkgload::load_all` pasó de **>4 minutos** a **3,4
segundos**. La lentitud era iCloud bloqueando cada lectura de archivo.

---

## H4 · La hipótesis del marco pequeño, que era falsa

Las tres facultades que se colgaban tenían marco ≤ 60 (Gestión 49, Psicología
54, Artes Escénicas 58) y el motor recorta corridas con
`if (n_aulas <= 60L) return(pedidas)`. La coincidencia era perfecta y la
conclusión, equivocada.

El cronómetro por facultad la tumbó:

| Facultad | Marco | Sortea | 1 sorteo |
|---|---|---|---|
| C. Contables | 10 | 2 | 0,18 s |
| Gestión | 49 | 7 | **> 30 s** |
| Psicología | 54 | 7 | **> 30 s** |
| Artes Escénicas | 58 | 8 | 0,41 s |
| Derecho | 293 | 37 | 1,62 s |
| C. e Ingeniería | 417 | 53 | 6,86 s |

Artes Escénicas tiene marco 58 y es rápida; Derecho tiene 293 y es rápida.
El marco no era la variable.

---

## H6 · `program` degeneraba el cubo — causa raíz

`selector$balance_vars` incluía `program`, que **no es una categoría sino casi
un identificador**:

| Facultad | Aulas | Niveles de `program` |
|---|---|---|
| C. e Ingeniería | 417 | 304 |
| Derecho | 293 | 175 |
| Gestión | 49 | 34 |
| Letras y CC.HH. | 14 | 13 |
| C. Contables | 10 | 9 |

Cada nivel es una columna dummy, así que la matriz de balanceo llegaba a rozar
o superar el número de unidades: 44 columnas para 49 aulas, **62 para 60**, 315
para 417.

Con `p ≈ N` la fase de vuelo del cubo se queda sin grados de libertad y vuelca
casi todo a la fase de aterrizaje, cuyo costo es `2^q`.
`sampling::landingcube` construye `matrix(0, cc, N)` con `cc = 2^q`, y con
`q ≥ 31` **desborda el entero de R**. Síntoma literal:

```
Warning message:
In matrix(0, cc, N) : NAs introduced by coercion to integer range
```

Ningún gate mira ese warning y el sorteo continúa. **El problema visible era la
lentitud; el problema real era la validez**: el sorteo «balanceado» no
balanceaba por nada interpretable y, donde el aterrizaje desbordaba, operaba
sobre una matriz con NA.

Medición con y sin `program`, misma semilla:

| Facultad | Columnas con | Tiempo con | Columnas sin | Tiempo sin |
|---|---|---|---|---|
| Gestión | 44 | > 25 s | 11 | 0,12 s |
| Psicología | 39 | > 25 s | 8 | 0,01 s |
| Derecho | 186 | 1,68 s | 12 | 0,09 s |
| C. e Ingeniería | 315 | 6,86 s | 12 | 0,22 s |

Entre 200× y 2.000×. Decisión y consecuencias en **ADR 0082**.

---

## Validación de que el cubo volvió a balancear

Correr rápido no prueba sortear bien. Se midió, con 300 sorteos por facultad,
la distancia entre la distribución de `level` sorteada y la del marco
(distancia de variación total: 0 = balanceo perfecto; un SRS sin balancear da
0,05–0,15):

| Facultad | Media alumnos | CV | NA/err | Solape | **BAL** |
|---|---|---|---|---|---|
| Arquitectura | 125 | 16,8% | 0 | 1,1% | 0,068 |
| Gestión | 219 | 5,5% | 0 | 12,0% | 0,032 |
| Psicología | 151 | 4,4% | 0 | 9,2% | 0,026 |
| C. Sociales | 216 | 5,6% | 0 | 6,8% | 0,021 |
| Derecho | 1.176 | 2,0% | 0 | 22,7% | 0,011 |
| C. e Ingeniería | 1.539 | 2,3% | 0 | 16,6% | 0,010 |

**Cero NA y cero errores en 1.800 sorteos.** Arquitectura sale en 0,068 por
límite aritmético, no por defecto: con 3 aulas no se pueden balancear 9 niveles
de curso. Es también la de mayor variabilidad (CV 16,8% contra 2,0% en
Derecho).

---

## Certificación de las 15 facultades

Dos corridas independientes con el motor arreglado, nivel 0,95.

| Facultad | Marco | Cuota | Fórmula | 1.000 corr. | 300 corr. | P(fórmula) | **Final** |
|---|---|---|---|---|---|---|---|
| C. e Ingeniería | 417 | 528 | 37 | 34 | 34 | 100% | **37** |
| EE.GG. Ciencias | 143 | 403 | 22 | 22 | 22 | 96% | **22** |
| EE.GG. Letras | 148 | 397 | 18 | 20 | 20 | **2%** | **20** ⬆ |
| Derecho | 293 | 363 | 16 | 18 | 19 | **0%** | **18 ó 19** |
| Arte y Diseño | 110 | 119 | 15 | 13 | 13 | 100% | **15** |
| C. Sociales | 60 | 149 | 12 | 12 | 12 | 98% | **12** |
| Arquitectura | 20 | 125 | 8 | 7 | 7 | 100% | **8** |
| Artes Escénicas | 58 | 64 | 8 | 8 | 8 | 99% | **8** |
| C. y Artes Comun. | 98 | 84 | 7 | 7 | 7 | 99% | **7** |
| Gestión | 49 | 105 | 6 | 7 | 7 | 80% | **7** ⬆ |
| Psicología | 54 | 75 | 5 | 6 | 6 | 67% | **6** ⬆ |
| Letras y CC.HH. | 14 | 23 | 3 | 4 | 4 | 93% | **4** ⬆ |
| Educación | 17 | 24 | 3 | 3 | 3 | 100% | **3** |
| Gastronomía | 21 | 21 | 3 | 3 | 3 | 100% | **3** |
| C. Contables | 10 | 20 | 2 | 3 | 3 | 82% | **3** ⬆ |

**Fórmula 165 · certificadas 167 · final 173 ó 174.** Techo operativo 190–195.

Curvas de probabilidad relevantes (1.000 corridas):

```
DERECHO         16: 0%   17: 28%   18: 95%
EE.GG. LETRAS   18: 2%   19: 60%   20: 99%
PSICOLOGÍA       5: 67%   6: 100%
GESTIÓN          6: 80%   7: 100%
C. CONTABLES     2: 82%   3: 100%
```

**Derecho con la fórmula sola no alcanzaba su cuota ni una vez en mil
sorteos.** Es la facultad de 22,7% de solape: la fórmula le pide 363 alumnos
contando repetidos, y los repetidos no son alumnos nuevos.

### Regla de reparto (decisión de Gonzalo, 2026-08-26)

```
aulas_final[f] = max(aulas_formula[f], aulas_certeza[f])
```

Nunca por debajo de la fórmula, aunque la certificación diga que sobra. El
motivo: la certificación vale **bajo el τ declarado**, y τ es un supuesto de
campo con mucha más incertidumbre que el ±0,69 pp del Monte Carlo. Medido
antes: con τ un 5% más bajo, EE.GG. Ciencias queda 4 alumnos corta. El margen
sobrante es lo único que protege si τ resulta optimista.

Segunda mitad de la decisión: **el reparto queda ajustable desde la UI en todo
momento**. Fijarlo ahora no puede cerrarlo.

### Derecho en el filo

Es la única discrepancia entre las dos corridas, y ninguna está equivocada: a
18 aulas la probabilidad midió **exactamente 95%**, con ±0,69 pp de error a
1.000 corridas y ±1,26 pp a 300. Una cifra decidida por el ruido de la
simulación no está decidida.

Se está midiendo 17/18/19/20 con **2.000 corridas por punto** e intervalo de
confianza. **Regla declarada antes de ver el resultado**: si el IC95 de 18 no
queda enteramente por encima de 0,95, va 19.

---

## Derecho, resuelto: 19 aulas

Medición a **2.000 corridas por punto**, con la regla declarada antes de mirar
(«si el IC95 de 18 no queda enteramente por encima de 0,95, va 19»):

| Aulas | P | IC 95% | Rend. medio | P05 |
|---|---|---|---|---|
| 17 | 28,0% | [26,0 – 29,9] | 358 | 343 |
| **18** | **93,0%** | **[91,9 – 94,2]** | 376 | **361** |
| **19** | **99,9%** | [99,8 – 100] | 394 | **378** |
| 20 | 100% | — | 412 | 395 |

El intervalo de 18 queda **entero por debajo del 95%**. Confirmación
independiente: la cuota es 363 y con 18 aulas el percentil 5 del rendimiento es
**361** — en el 5% peor de los sorteos falta por dos alumnos. Con 19 el P05
sube a 378. **Va 19.** El 95% que midió la corrida de 1.000 fue una muestra
afortunada; la corrida de 300, que pedía 19, tenía razón.

## Reparto aplicado — 174 aulas

Escrito en `aulas_base_fijas` del componente de facultad
(`prob_estratificado_independiente`) vía `POST /api/calc-muestra/componente`,
verificado releyendo el estado.

Derecho 19 · EE.GG. Letras 20 · Gestión 7 · Psicología 6 · Letras y CC.HH. 4 ·
C. Contables 3 (las seis que suben) · C. e Ingeniería 37 · EE.GG. Ciencias 22 ·
Arte y Diseño 15 · C. Sociales 12 · Arquitectura 8 · Artes Escénicas 8 ·
C. y Artes Comun. 7 · Educación 3 · Gastronomía 3.

**165 fórmula → 174 final.** Techo operativo 190–195: quedan 16–21 para
reemplazos.

## Los 50 sorteos y el elegido

Semillas declaradas `101 × (1..50)`, criterio léxico declarado de antemano.

**Hallazgo del conjunto, más valioso que el ganador: sólo 43 de los 50 (86%)
cierran las 15 facultades.** No contradice la certificación — cada facultad
tiene ≥95% por separado, pero la probabilidad conjunta es el producto, y con 15
facultades sale ~86%. Esto le da a la rerandomización un argumento más fuerte
del que tenía: no es optimizar al margen, es **convertir un 86% de que todo
salga bien en la certeza de que este sorteo concreto cumple en las quince**.

Distribución de los 50: cobertura mínima 0,982–1,074 (mediana 1,029); solape
10,1%–14,0% (mediana 12,2%).

**Elegido: semilla 707.** Cobertura mínima 1,074 — el máximo de los 50, así que
el criterio resolvió en el paso 2 y nunca llegó al desempate por solape.
Honestidad debida: **707 no es bueno en solape** (13,0%; sólo el 14% de los
sorteos tiene más). Es el orden léxico funcionando como se declaró — proteger a
la facultad más débil pesa más que reducir repetidos. Un alumno repetido cuesta
una encuesta; una facultad corta cuesta el resultado de esa facultad.

174 aulas · 5.493 estudiantes únicos · 2.829 esperados efectivos · cuota 2.500 ·
cobertura global 1,13 · facultad más ajustada Derecho con 1,07.

### Validación del sorteo elegido

Balanceo (distancia a la distribución del marco): `sex_top_1` 0,026 ·
`size_group` 0,041 · `level` 0,101 · `faculty` 0,172.

El 0,172 de `faculty` **es esperado y no es un defecto**: el diseño
sobremuestrea deliberadamente a las facultades chicas para que cada una alcance
su cuota. Si la distribución de aulas por facultad se pareciera a la del marco,
las chicas no llegarían nunca. Es representatividad por facultad, no
proporcionalidad.

Tamaño de aula, marco contra sorteadas: p25 22/22, mediana 35/36, p75 44/45,
máximo 91/91. **Sin sesgo de tamaño** — que era el riesgo del criterio por
cobertura.

Concentración: **166 docentes distintos en 174 aulas** (8 repetidos, ninguno con
más de 2) y 167 programas distintos. Ningún profesor carga media muestra.

**Hallazgo operativo**: 7 aulas comparten el bloque horario `0201` y otras 7 el
`0202`. No es un problema de muestreo sino de logística: exige siete equipos
simultáneos en esos bloques. Debe verlo quien arme el cronograma de campo.

Integridad: 174 aulas únicas, 0 duplicadas, 0 identificadores nulos. Solape
global 13,2% (5.493 únicos de 6.325 elegibles); la diferencia con el 13,0% por
facultad son **9 alumnos que aparecen en aulas de dos facultades distintas**.

## Cuántos sorteos comparar, y qué significa apretar el criterio

Con el cubo arreglado un sorteo completo de las 15 facultades cuesta **~1
segundo**, así que el costo dejó de ser el límite: 50 sorteos son menos de un
minuto. El límite pasa a ser metodológico.

Elegir el mejor de `N` sorteos equivale a aceptar el **mejor 1/N** de la
distribución de aleatorización: con 5 se toma el 20% superior; con 50, el 2%.
Sigue siendo rerandomización válida mientras el criterio esté declarado antes y
se aplique mecánicamente — la literatura (Morgan & Rubin 2012) trabaja con
tasas de aceptación de 1/1000 y menores, así que 1/50 es conservador.

Lo que cambia al apretar es que la muestra elegida se parece cada vez menos a
un sorteo cualquiera, y la inferencia debería condicionarse al conjunto
aceptado. En este caso el efecto va a favor de la prudencia: **la
rerandomización reduce la varianza**, así que los errores estándar clásicos
quedan conservadores, no optimistas.

Salvedad propia de nuestro criterio, que conviene dejar dicha y no asumida:
seleccionar por cobertura equivale a preferir sorteos que cayeron en aulas más
llenas. Eso es eficiencia operativa, no sesgo de opinión — no hay razón para
que el tamaño del aula correlacione con lo que se responde sobre hostigamiento
o violencia de género. Si alguna vez se sospechara lo contrario, el criterio
tendría que revisarse.

**Decidido: 50 sorteos, semillas declaradas `101 × (1..50)`**, mismo criterio
léxico de tres pasos. Se reportan los 50, no sólo el elegido.

## Defecto encontrado al guardar: certificar y sortear leen configs distintas

Al intentar sortear por el camino de la app apareció un defecto de contrato que
importa más que el trámite que lo destapó. **Dos endpoints leen la
configuración en orden opuesto:**

```r
# /aulas/certeza      (router_calc_muestra.R:1052)
base_config <- s$calc_muestra_aulas_config %||% frame$config %||% list()
# /aulas/seleccionar  (router_calc_muestra.R:1106)
base_config <- frame$config %||% s$calc_muestra_aulas_config %||% list()
```

La certificación toma **la config de sesión primero**; la selección toma **la
copia congelada dentro del marco**. Consecuencia: se puede certificar con una
configuración y sortear con otra, sin aviso.

**No es hipotético — estaba activo en este proyecto.** Medido:

| Origen | `balance_vars` |
|---|---|
| Copia congelada del marco | `faculty, sex_top_1, size_group, **program**, level` |
| Config de sesión (ya arreglada) | `faculty, sex_top_1, size_group, level` |

El marco tenía congelado el `program` que degenera el cubo (ADR 0082). **Un
sorteo lanzado sin pasar `config` explícita en el body habría salido del cubo
roto, pese a que toda la certificación se hizo con el arreglado.** El endpoint
acepta `body$config` con precedencia, y así se resolvió.

**Pendiente de ADR**: un marco congela su config al construirse, y eso es
correcto para trazabilidad; lo que no es correcto es que dos endpoints del
mismo flujo elijan fuentes distintas en silencio. O ambos leen lo mismo, o la
divergencia se declara en pantalla.

### Trampa asociada, para no repetirla

`POST /aulas/seleccionar` rebotaba con 409
`E_CALC_MUESTRA_ALUMNOS_CH_DECISION` («decision_stale») aunque la decisión de
alumnos por CH y el marco tenían **el mismo `frame_hash`**. La guarda
(`.cm_aulas_assert_decision_vigente`) compara la decisión del **estudio**
contra la de la **config que recibe el endpoint** — y esa era la congelada del
marco. Resellar la decisión por `/marco/config` y por `/estudio` no servía de
nada: la comparación nunca miraba esas copias.

## El sorteo local no servía para guardar: se rehace por la app

Los 50 sorteos locales validaron el reparto pero **no eran guardables**: viven
en un `.rds` del scratchpad y la app no puede reproducirlos. Escribirlos al
`.pulso` daría 174 aulas sin origen verificable. Se rehace todo por
`POST /api/calc-muestra/aulas/seleccionar`, que ancla la selección a una
semilla del selector y la vuelve reproducible por cualquiera que abra el
proyecto.

### Segundo defecto: `aulas_base_fijas` no gobierna la selección

Con el reparto certificado escrito en el estudio y `n_aulas = 174`, la app
sorteó 174 aulas **repartidas a su manera**:

| Facultad | Certificado | Sorteado |
|---|---|---|
| Derecho | 19 | **35** |
| Arte y Diseño | 15 | **4** |
| EE.GG. Letras | 20 | 26 |
| Psicología | 6 | 2 |

El total cuadraba y el reparto por facultad se perdía. Arte y Diseño habría ido
a campo con 4 aulas donde la certificación pide 15. **`aulas_base_fijas`
gobierna el cálculo del estudio pero no la afijación del sorteo.**

**La capacidad existe y no estaba conectada**: `selector$faculty_targets`
(`calc_muestra_aulas_afijacion.R:46`). Sin ese campo,
`.cm_aulas_quota_estratos` cae a `.cm_aulas_quota_by_stratum`, que reparte
proporcional a la masa de elegibles. Con él, el n de cada facultad manda y
dentro reparte por sexo × tamaño. Fijado con el reparto certificado, las 15
facultades cuadran exactamente.

**Pendiente de ADR**: certificar por facultad y sortear sin `faculty_targets`
produce un sorteo que ignora la certificación, en silencio y con el total
cuadrando. O la afijación se deriva del reparto fijado, o la ausencia se
declara en pantalla.

## Cuota de sexo: la pregunta correcta no es la brecha

`sexo_por_facultad` (tolerancia 2,5 pp) marcó **8 de 15 facultades fuera**,
en ambas direcciones — de −7,3 pp (Artes Escénicas) a +11,0 pp (Letras y
CC.HH.). Las brechas grandes están donde hay pocas aulas: con 3 o 4 aulas no
se acierta una proporción con precisión de 2,5 puntos.

**Pero la brecha no es el criterio operativo.** Una proporción distinta la
corrige la ponderación; una celda que no alcanza no la corrige nada. La
pregunta que decide es si los **absolutos** llegan: mujeres esperadas ≥ cuota
de mujeres, y lo mismo para hombres, en cada facultad.

Medido sobre el sorteo de semilla 101: **las 30 celdas facultad × sexo
alcanzan.** Celda más ajustada EE.GG. Letras hombres con 1,041; le sigue
Psicología hombres con 1,04. Artes Escénicas, con −7,3 pp de brecha, cubre
1,58 en mujeres y 2,13 en hombres.

Salvedad: la brecha no es gratis aunque no sea grave — obliga a la ponderación
a corregir más e infla algo el efecto de diseño de esa facultad.

### Criterio declarado para los 50 sorteos por la app

Declarado **antes** de correrlos, y más fuerte que el de la tanda local:

1. **Filtro duro**: cobertura ≥ 1 en las 30 celdas facultad × sexo.
2. **Maximizar la cobertura mínima** entre esas 30 celdas.
3. Menor solape.

Semillas `101 × (1..50)`.

**Dato temprano que cambia la lectura de la rerandomización**: las semillas
404, 505 y 606 dan **29 de 30 celdas**, fallando siempre en la misma —hombres
de EE.GG. Letras, con 0,926 a 0,966—. La semilla 101 con 30/30 no es lo
típico. Acá elegir entre sorteos no optimiza al margen: **evita un sorteo que
no cierra.**

## Métricas a reportar del ganador

Tres granos —curso-horario, facultad, total— y por cada uno matriculados,
elegibles y esperados desagregados por sexo (`<scratchpad>/metricas.R`, deja
CSV por curso-horario con identificador, curso, facultad, nivel, horario y
docente).

Ejemplo sobre el sorteo 101: matriculados 6.356 (3.142 M / 3.214 H), elegibles
6.113 (3.017 / 3.096), esperados 3.173 (1.615 / 1.555). 49,4% de mujeres entre
elegibles, 50,9% entre esperados. Por curso-horario: elegibles 10–91 (mediana
33), esperados 7–50 (mediana 19).

**Al reportar hay que distinguir asiento de persona**: los 6.113 elegibles son
asientos; los estudiantes únicos son 5.825. Para el operativo mandan los
asientos —hay que aplicar en cada aula—; para la muestra mandan los únicos.

## ✅ CHECKLIST DE VERIFICACIÓN DE LA SELECCIÓN

Un ítem por criterio exigido. **Estado medido sobre el sorteo de semilla 101**;
los marcados «rehacer» deben volver a correrse sobre el ganador de los 50,
porque son propiedades del sorteo concreto, no del diseño.

### Cuotas y reparto

- [x] **Cuota de facultad alcanzada en las 15** — cobertura mínima 1,07
      (Derecho). `metricas.R` · `riesgo.R`
- [x] **Cuota de sexo alcanzada en las 30 celdas facultad × sexo** — 0 celdas
      por debajo de 1. Mínima 1,041 (EE.GG. Letras hombres). `riesgo.R` · rehacer
- [x] **El reparto certificado por facultad se respeta** — las 15 cuadran
      exactamente tras fijar `selector$faculty_targets`. Sin ese campo el
      sorteo lo ignoraba en silencio
- [x] **Total dentro del techo operativo** — 174 titulares + 15 extra
      operativas = 189, techo 190–195

### Integridad del marco

- [x] **Ninguna aula de la DAA entre los titulares** — 0 de 174
- [x] **Ninguna aula de la DAA en las cadenas de reemplazo** — 0 de 1.259
- [x] **Ninguna aula de la DAA en el pool de extras** — 0 de 79
- [x] **Ninguna aula de la DAA en el marco incluido** — 0 de 1.512
- [x] **Los tres conjuntos suman el marco** — 174 + 1.259 + 79 = 1.512, sin
      aulas sin clasificar
- [x] **Sin duplicados ni identificadores nulos** — 174 únicas, 0 NA

### Operativa de campo

- [x] **Ningún docente aparece en dos aulas titulares** — 174 docentes
      distintos en 174 aulas. `verifica.R` · rehacer
- [x] **Todas las aulas son presenciales** — 174 de 174, ninguna
      semipresencial ni virtual
- [ ] **Ningún reemplazo comparte docente con su titular** — **7 de 1.259
      lo hacen** (0,6%). Si el aula cae porque el docente no colaboró, su
      reemplazo con el mismo docente probablemente caiga igual. Mapear para
      que campo salte al segundo eslabón
- [ ] **Concentración horaria** — 7 aulas en el bloque `0201` y 7 en `0202`
      exigen siete equipos simultáneos. No es defecto de muestreo; debe verlo
      quien arme el cronograma
- [ ] **Aula atípica** — una de 91 elegibles en Arquitectura contra una media
      de 43 en esa facultad. Necesita más tiempo y más encuestadores

### Calidad estadística

- [x] **El cubo balancea de verdad** — `sex_top_1` 0,026 · `size_group` 0,041
      · `level` 0,101. Un SRS sin balancear daría 0,05–0,15
- [x] **`faculty` 0,172 es esperado, no defecto** — el diseño sobremuestrea
      facultades chicas para que cada una alcance su cuota
- [x] **Sin sesgo de tamaño de aula** — marco p25 22 / mediana 35 / max 91;
      sorteadas 22 / 36 / 91
- [x] **Sin sesgo hacia aulas fáciles** — efectividad mediana 0,55 en las
      sorteadas contra 0,56 en el marco. Era el riesgo del criterio por
      cobertura y no se materializó
- [x] **Dominancia de facultad por encima del umbral** — mínimo 0,83 contra
      un umbral de 0,70
- [x] **Cero NA en los sorteos** — 0 en 1.800 sorteos de validación, tras
      arreglar el desborde del aterrizaje del cubo
- [x] **Sensibilidad a τ medida** — τ va de 0,409 a 0,800 por facultad. Todo
      cierra hasta τ×1,00; a τ×0,95 caen 2 celdas; a τ×0,90 caen 4. La celda
      más frágil aguanta −3,9%

### Operativa de campo — añadidos del 2026-08-26 (tarde)

- [x] **Traslape de docentes con TITULARES de la DAA** — **6 de 174 (3,4%)**:
      CH 34, 42, 54, 90, 124, 155. Conflicto real: a esos docentes se les pedirá
      ceder clase dos veces, y la DAA aplica del 31 de agosto al 11 de setiembre
- [x] **Traslape con COMPLEMENTARIAS de la DAA** — 5 de 174 (2,9%). Hipotético:
      esas aulas de la DAA solo se visitan si falla su titular
- [x] **Los 11 afectados tienen reemplazo de nivel 1 limpio** — ninguno de los
      once primeros reemplazos tiene docente en la DAA. El problema tiene salida
      inmediata sin bajar en la cadena
- [x] **El traslape es lo que da el azar, no un defecto** — la DAA involucra 178
      docentes de unos 2.546 del marco (7%); nuestro 6,3% coincide
- [ ] **Profundidad de cadena insuficiente en tres facultades** —
      **Arquitectura 1,5 reemplazos por titular y se agota en el nivel 2**;
      Ciencias Contables 2,3; Letras y CC.HH. 2,5. El resto ≥4,0
- [x] **Impacto de la exclusión DAA por facultad, medido** — la exclusión quitó
      120 aulas del marco (1.632 → 1.512, 7,4%) pero **no golpeó a las
      facultades chicas**: Gastronomía perdió 8,7%, y Ciencias Contables y
      Letras y CC.HH. **cero**. La golpeada fue **Arquitectura: 41,2%**, de 34
      aulas a 20, y por eso sortea el 40% de su marco y le quedó la cadena más
      corta del estudio. Con sus 34 originales tendría ~3,2 reemplazos por
      titular en vez de 1,5

### El entregable

`HSVG2026_matriz_seleccion_202.xlsx` — 12 hojas: Por curso-horario (174×36) ·
Por facultad y total (16×21, con cuotas globales y por sexo) · Reemplazo 1 a 5
y Reemplazos 6 a 11 · Cadenas por facultad · Validaciones (35) · Diccionario ·
Los 50 sorteos. Encabezados coloreados por tipo de dato y ordenada por código
operativo CH 1–174.

**La numeración CH tiene criterio y es jerárquica**: facultad de mayor a menor
→ estrato (facultad / sexo dominante / grupo de tamaño) → orden de sorteo. Un
tramo consecutivo de CH es la misma facultad y el mismo tipo de aula, así que
se puede repartir por tramos a los equipos.

**Contactos recuperados del catálogo original** (no estaban en el marco):
nombre 174/174, correo PUCP 174/174, teléfono 170/174, más el correo Ágora
propio de cada aula. La unión exigió minusculizar clave **y** horario —
`1civ64_08a1` contra `08A1` dejaba 7 aulas sin match.

**τ y efectividad son cosas distintas y ahora están separadas**: τ es una
constante por facultad (0,409–0,800) que usa el diseño y la certificación; la
efectividad estimada del aula es por aula (0,379–0,800). Coinciden en el total
—3.175 contra 3.150, 0,8%— pero difieren aula por aula.

### Pendientes

- [ ] **Ganador de los 50 sorteos** — criterio declarado antes de correr
- [ ] **Rehacer sobre el ganador** las verificaciones marcadas «rehacer»
- [ ] **Cadenas de reemplazo**: profundidad, calidad y equivalencia con su
      titular. Sin analizar todavía
- [ ] **Reemplazos vs bolsa de extras** contrastado con el documento
      metodológico — son cosas distintas y hay que usar los nombres del
      documento, no los míos
- [ ] **Métricas por sexo en tres granos** (curso-horario, facultad, total):
      matriculados, elegibles y esperados. `metricas.R` listo, falta correrlo
      sobre el ganador
- [ ] **Guardar la selección en el `.pulso`**
- [ ] **Exportar el libro de aulas**
- [ ] **Verificar en pantalla** que el reparto sigue ajustable por facultad
      desde la UI — Gonzalo reportó que no le dejaba aumentar aulas

## La selección definitiva — semilla 202

Los 50 sorteos por la app terminaron. **25 de 50 cerraron las 30 celdas
facultad × sexo**, cobertura mínima de 0,872 a 1,079 y **mediana 0,998** — es
decir, **el sorteo típico NO cierra**. Elegir entre sorteos no optimizó al
margen: evitó una probabilidad del 50% de ir a campo con una celda corta.

Ganó la **semilla 202** en el paso 2 del criterio (mayor cobertura mínima) y
también habría ganado el desempate por solape.

174 titulares · 1.259 en cadenas · 79 en pool · 5.406 estudiantes únicos ·
solape 11,4%. Las 15 facultades cuadran exactamente con el reparto certificado.

**Las dos celdas más frágiles mejoraron respecto de la primera semilla:**

| Celda | Semilla 101 | Semilla 202 |
|---|---|---|
| EE.GG. Letras · hombres | 1,041 (+6 alumnos) | **1,079** (+12) |
| Psicología · hombres | 1,042 (+1 alumno) | **1,163** (+3) |
| Celdas bajo 1,10 | 4 | **2** |
| Tolerancia a τ | −3,9% | **−7,3%** |

### Métricas de la selección

| | Total | Mujeres | Hombres |
|---|---|---|---|
| Matriculados | 6.376 | 3.148 | 3.226 |
| Elegibles | 6.119 | 3.015 | 3.104 |
| Esperados | 3.168 | 1.609 | 1.564 |

Cuota 2.500 · cobertura global 1,27 · 49,3% de mujeres entre elegibles.
**6.119 son asientos; los estudiantes únicos son 5.406.**

### Sensibilidad a τ, medida por celda

τ no es 50% parejo: va de **0,409 (EE.GG. Ciencias) a 0,800 (Letras y CC.HH.)**
por facultad, y las celdas frágiles lo son porque su τ ya es el más bajo.

```
τ × 1,15 → todo cierra        τ × 0,95 →  2 celdas cortas
τ × 1,00 → todo cierra        τ × 0,90 →  4 celdas cortas
                              τ × 0,85 →  9 celdas cortas
```

El τ usado **ya es más conservador que la efectividad medida por aula**
(mediana 0,55 en el marco contra τ de 0,419 en EE.GG. Letras): lleva un factor
residual que castiga por adelantado.

## Qué hacer si una celda de sexo no llegara

Medido sobre el marco, y **la respuesta es distinta por facultad**:

- **EE.GG. Letras**: sus aulas de mayoría masculina rinden **30,9 hombres por
  aula contra 19,8** en las de mayoría femenina. Pero redistribuir NO sirve:
  mover 2 aulas sube hombres a 1,12 y **baja mujeres a 1,03**, así que el
  mínimo empeora. El problema no es el reparto por sexo sino que 20 aulas son
  justas para esa facultad (426 esperados contra cuota 397, 7% de holgura).
- **Psicología**: sus 54 aulas del marco son **todas de mayoría femenina**. No
  hay a dónde redistribuir; la única palanca es un aula más.

**Recomendación registrada: +1 aula a EE.GG. Letras y +1 a Psicología (176 en
total).** No compra el resultado, compra margen — y el margen es lo que protege
si τ resulta optimista.

**Hueco metodológico que esto destapa: certificamos contra la cuota de
facultad, no contra las subcuotas de sexo.** Las celdas de sexo son más
exigentes que el total.

### Sobre elegir un aula a dedo del pool

Gonzalo planteó tomar un aula con muchos hombres de la reserva. Elegir **la
unidad** rompe el diseño (π = 1 para ella, desconocida para el resto). Elegir
**el estrato** y sortear dentro es afijación desproporcionada, práctica
estándar. Y si se quiere una unidad concreta, la forma defendible es declararla
**unidad de certeza** con una regla reproducible («el aula de mayoría masculina
con más hombres elegibles de EE.GG. Letras»), que es un estrato de tamaño 1 con
π = 1 y peso 1. Lo que no se sostiene es mirar el marco y señalar.

## Verificaciones sobre el ganador

- **Docentes: 174 distintos en 174 aulas titulares, cero repetidos.** Y contando
  **codocencia** —24 aulas tienen entre 2 y 5 docentes, 203 pares aula-docente—
  **sigue habiendo cero repeticiones**. La garantía es más fuerte de lo que
  parecía. El sorteo local sí repetía 8 docentes: el motor de la app aplica una
  restricción de unicidad que la versión casera no tenía.
- **DAA: cero coincidencias** en titulares, cadenas, pool y marco.
- **Traslape de DOCENTES con la DAA**, separado por condición:
  **6 de 174 (3,4%) con un titular de la DAA** (CH 34, 42, 54, 90, 124, 155) —
  conflicto real, porque la DAA aplica del 31 de agosto al 11 de setiembre—;
  5 más (2,9%) solo con complementarias, que puede que nunca se visiten.
  **Los 11 tienen su reemplazo de nivel 1 con docente limpio.** El 6,3% total
  es lo que da el azar: la DAA involucra 178 docentes de ~2.546 (7%).

## Cursos compartidos entre facultades — el riesgo de Ramiro y Magallanes

**Nuestra selección tiene MÁS cursos compartidos que el marco: 55% contra 43%**
sirven dos o más especialidades. No es un error: los compartidos son más
grandes y el cubo selecciona proporcional al tamaño.

**Pero servir varias especialidades no es servir varias facultades.** Con la
dominancia de facultad —el share de alumnos que pertenecen a la facultad
atribuida—:

```
mínimo 0,809 · p25 1,000 · mediana 1,000
aulas puras (dominancia 1,00): 137 de 174 (79%)
dominancia < 0,90: 10 aulas · < 0,80: ninguna
```

**El umbral declarado del diseño es 0,70.** De 6.119 elegibles, solo **94
(1,5%)** pertenecen a otra facultad que la atribuida a su aula. El peor caso
tiene 7 de 37.

Concentración: EE.GG. Letras aporta 13 de las 37 aulas mixtas pero solo 4,3% de
sus alumnos vienen de fuera; **EE.GG. Ciencias tiene una sola aula mixta y un
alumno**. Las que más porcentaje pierden son Contables y Letras y CC.HH. con
8,3%, sobre bases de 60 y 48 alumnos.

**Los reemplazos son más mixtos que los titulares**: 39 de 1.259 bajo 0,90, y
los cuatro peores de toda la selección son reemplazos (tres clavados en 0,800).
`R 68.1` tiene 62 elegibles con 12 de otra facultad.

## Dimensión del filtro del marco

El filtro lleva 5.269 cursos-horario a 1.512: **excluye el 71%**.

| Criterio | Aulas que menciona | % universo |
|---|---|---|
| `min_eligible` | 1.910 | 36,2% |
| `c7_prevalencia` | 1.693 | 32,1% |
| `min_eligible_per_class` | 871 | 16,5% |
| `condicion_curso` | 751 | 14,3% |
| `c8_facultad` | 705 | 13,4% |
| `modality` | 639 | 12,1% |
| `session_type` | 533 | 10,1% |
| `course_level` | 373 | 7,1% |
| `teacher_type` | 330 | 6,3% |
| `faculty_curso` | 197 | 3,7% |
| `particularidad_manual` (DAA) | 120 | 2,3% |

**1.431 de las 3.757 excluidas lo son por un solo criterio** — son las
recuperables si se afloja ese criterio:

| Criterio único | Aulas | Elegibles | Media |
|---|---|---|---|
| `c7_prevalencia` | 299 | 9.656 | 32,3 |
| `condicion_curso` | 254 | 6.762 | 26,6 |
| `c8_facultad` | 197 | 6.076 | 30,8 |
| `min_eligible` | 379 | 2.138 | **5,6** |
| `course_level` | **16** | 1.071 | **66,9** |

**`min_eligible` saca más aulas que nadie pero aporta 5,6 elegibles cada una**:
aflojarlo devuelve aulas diminutas que encarecen el operativo sin mover la
cuota. Los tres primeros son la conversación real: devolverían 750 aulas con
22.494 elegibles. Y `course_level` merece mirarse una por una: solo 16 aulas
pero **con 67 elegibles de media**, las más grandes del descarte.

**Impacto desigual por facultad**: Letras y CC.HH. conserva el **8%** de su
universo y Artes Escénicas el 13%, contra 49% de Derecho. Escuela de Posgrado
queda en **cero de 683** — correcto para un estudio de pregrado, pero conviene
decirlo en la metodología.

## Impacto de la exclusión DAA por facultad

La exclusión quitó 120 aulas (1.632 → 1.512, 7,4%) y **no golpeó a las
facultades chicas**, contra lo que se temía:

| Facultad | Antes | Quita | Ahora | % perdido |
|---|---|---|---|---|
| **Arquitectura** | 34 | **14** | 20 | **41,2%** |
| C. Sociales | 72 | 12 | 60 | 16,7% |
| Gastronomía | 23 | 2 | 21 | 8,7% |
| **C. Contables** | 10 | **0** | 10 | **0%** |
| **Letras y CC.HH.** | 14 | **0** | 14 | **0%** |

**Arquitectura sortea 8 de 20: toca el 40% de su marco.** Eso explica de golpe
cuatro anomalías que veníamos viendo por separado — su CV del 16,8%, su peor
balanceo por nivel (0,368), su cadena de solo 1,5 reemplazos por titular y su
25% de reemplazos con el mismo nivel. Con sus 34 aulas originales tendría ~3,2
reemplazos por titular.

## Cadenas de reemplazo

| Facultad | Sortea | Marco | Fracción | Reemplazos/titular | Nivel máx |
|---|---|---|---|---|---|
| **Arquitectura** | 8 | 20 | **40%** | **1,5** | **2** |
| C. Contables | 3 | 10 | 30% | 2,3 | 3 |
| Letras y CC.HH. | 4 | 14 | 29% | 2,5 | 3 |
| Derecho | 19 | 293 | 6,5% | 11,0 | 11 |

Los 174 titulares tienen su reemplazo de nivel 1, pero **en Arquitectura, si
caen dos aulas de la misma cadena no hay a dónde ir**.

### Equivalencia de los reemplazos

`equivalence_level` clasifica: `misma_celda` 1.029 (82%), `celda_equivalente`
187 (15%), `misma_facultad` 43 (3,4%).

```
misma facultad         100%   ← ningún reemplazo cruza de facultad
mismo estrato           81%
mismo NIVEL DE CURSO    77%   ← incidental, NO es criterio
```

**El nivel de curso no está garantizado.** Por facultad va de **100% en EE.GG.
Letras** (trivial: su marco tiene un solo nivel) a **25% en Arquitectura**. Eso
degrada la representatividad por nivel cuando se activan reemplazos en campo, y
de forma no controlada.

## Representatividad por nivel de estudio — más débil que la propuesta

La propuesta técnica especifica **selección sistemática ordenada por nivel**
(estratificación implícita). Nosotros balanceamos `level` en el cubo. Medido, la
propuesta habría hecho mejor trabajo:

```
distancia global (TVD): 0,1115   ← un SRS da 0,05–0,15
Nivel 3: +5,0 pp   Nivel 8: −5,1 pp   Nivel 9: −3,5 pp
```

Dentro de facultad: Contables 0,490 (3 aulas, 4 niveles), Arquitectura 0,368
(8 aulas, 9 niveles), **EE.GG. Letras 0,000** (un solo nivel).

**Hay que separar dos cosas**: que 3 aulas no puedan cubrir 4 niveles es
aritmética, no método — ningún motor lo arregla. Donde sí perdemos algo real es
en Ciencias e Ingeniería (37 aulas, 6 niveles, TVD 0,106), la única facultad
grande donde la sistemática habría sido mejor.

**Recomendación: posestratificar por nivel en la ponderación.** Corrige el
sesgo del diseño y además absorbe el que introduzca el operativo al activar
reemplazos. Se aparta de la propuesta y por eso conviene que quede escrito.

## Comparación con la propuesta técnica

Escenario 1 de la propuesta (referencial, población 2025-2) contra el diseño
ejecutado (2026-2):

**Totales: 2.500 contra 2.499 encuestas · 174 contra 177 aulas.** Por sexo:
1.254 M / 1.246 H contra 1.232 / 1.267.

Mayores diferencias de cuota: Derecho +16, C. y Artes Comun. −13, EE.GG.
Ciencias +10, Gestión −10, Gastronomía +6. **Son cambios de matrícula entre
años, no de método** — ambas reparten proporcional a la población.

Las de aulas sí son de método: C. e Ingeniería **+4** (la certificación exigió
más por su solape alto), Arquitectura y Artes Escénicas **−3** cada una.

**El diseño ejecutado valida la propuesta técnica**: si hubiera errado por
mucho habría que explicar por qué se cotizó una cosa y se hizo otra.

Pendiente: la propuesta preveía **3.754 de sobremuestra** repartida por
facultad. Hoy hay 15 aulas extra operativas más las cadenas; cuando se defina
la sobremuestra, esa columna es la referencia.

## Entregables

En `~/Documents/Pulso/HSTVG2026/` — **ninguno entra al repositorio, todos
contienen datos de cliente**:

- **`HSVG26ULT.pulso`** (12.158.921 bytes) — proyecto con la selección dentro,
  reproducible desde la semilla 202
- **`HSVG2026_matriz_seleccion_202.xlsx`** — 15 hojas: Por curso-horario
  (174×36) · Por facultad y total (con cuotas globales y por sexo) · Criterios
  por facultad (38 columnas, con glosario como tabla aparte debajo de los
  datos) · Complejidad de facultad (1.433 filas, titulares y reemplazos) ·
  Cadenas por facultad · Reemplazo 1 a 5 y Reemplazos 6 a 11 · Vs propuesta
  técnica · Validaciones (35) · Diccionario · Los 50 sorteos
- **`HSVG2026_base_contactos_202.xlsx`** — base interna: 1.279 docentes,
  18.881 alumnos de la selección y los 29.027 del universo PUCP
- **`HSVG2026_contactos_OIGD.xlsx`** — **base para el externo**, minimizada:
  1.332 docentes (código, nombre, tipo, correo PUCP, correo externo, teléfono)
  y 18.935 alumnos (código, nombre, correo, facultad, especialidad). Alcance el
  **marco**, no la selección, y **sin ninguna referencia a códigos CH ni al
  sorteo** — el marco define quién puede ser sorteado y nuestra selección
  concreta no es asunto del externo
- `HSVG26ULT_trabajo_calc_muestra_aulas_seleccion_26_08_26.xlsx` — libro nativo
  de la app, 9 hojas
- `libro_aulas_202.csv` · `pool_extras_202.csv`

### Cobertura de contacto

Docentes del marco (1.332): correo PUCP **100%**, teléfono 97,6%, correo
externo 82,9%; **los 1.332 tienen al menos un correo**. Alumnos: `CORREPUCP`
con **100%** de cobertura — la base de la DAA no trae teléfono ni correo
alterno de alumnos.

### Trampa de unión con el catálogo

El `classroom_id` de la app minusculiza **clave y horario**; unir solo por
clave dejaba 7 aulas sin match (`1civ64_08a1` contra `08A1`). Con la corrección
se recuperan los 174. Los contactos del docente **no estaban en el marco**: hay
que ir al catálogo original, que vive dentro del `.pulso`, no suelto en la
carpeta del estudio.

### τ y efectividad son dos cosas

`τ` es una **constante por facultad** (0,409–0,800) que usa el diseño y la
certificación. La **efectividad estimada del aula** es por aula (0,379–0,800),
calculada con el histórico de cada curso. Verificado:
`efectivas_esperadas = elegibles × efectividad_del_aula`. Coinciden en el total
—**3.175 con τ contra 3.150 por aula, 0,8%**— pero difieren aula por aula.

### La numeración CH tiene criterio

`CH 1` a `CH 174`, jerárquica: **facultad de mayor a menor → estrato (facultad /
sexo dominante / grupo de tamaño) → orden de sorteo**. Un tramo consecutivo de
CH es la misma facultad y el mismo tipo de aula, así que se puede repartir por
tramos a los equipos de campo. `operational_sequence` coincide con ese número.
Los reemplazos usan `R n.m` — `R 3.1` es el primer reemplazo del `CH 3`.

## ¿La selección reproduce la distribución de cada facultad?

Pregunta planteada por Gonzalo: si dentro de cada facultad la muestra respeta
la composición del marco en **sexo**, **grupo de tamaño** y **nivel del aula**.
Medido con la distancia de variación total ponderada por elegibles, entre el
marco de la facultad y sus aulas sorteadas. Cero sería una réplica exacta;
se clasifica como *reproduce* hasta 0,05, *parcial* hasta 0,15, y *no
reproduce* por encima.

**La respuesta es distinta para cada variable:**

| Variable | Mediana | Reproduce | Parcial | No reproduce |
|---|---|---|---|---|
| **Sexo dominante** | **0,047** | **8 de 15** | 3 | 4 |
| **Grupo de tamaño** | 0,089 | 4 | 5 | 6 |
| **Nivel del curso** | **0,225** | **1** | 4 | **10 de 15** |

En sexo la selección **sí reproduce** la composición del marco en la mayoría de
facultades. En tamaño lo hace parcialmente. En nivel **no la reproduce**, y esto
confirma desde otro ángulo la debilidad ya registrada en la sección de
representatividad por nivel.

### La causa es aritmética y se mide con un solo indicador

Lo que decide no es la facultad ni el método, sino **cuántas aulas hay por cada
categoría que se debe cubrir**:

```
C. e Ingeniería      6,2 aulas por nivel  →  0,106   parcial
EE.GG. Ciencias      5,5                  →  0,077   parcial
Derecho              3,2                  →  0,085   parcial
C. Sociales          2,0                  →  0,140   parcial
Arte y Diseño        1,5                  →  0,232   no reproduce
Arquitectura         0,9                  →  0,368   no reproduce
Contables            0,8                  →  0,490   no reproduce
Gastronomía          0,6                  →  0,191   no reproduce
```

**Por debajo de una aula por categoría, reproducir la distribución es imposible
por construcción**: no hay forma de repartir 3 aulas entre 4 niveles de manera
proporcional. La correlación entre número de aulas sorteadas y distancia en
nivel es **−0,69**; en tamaño −0,32 y en sexo −0,24, que es justamente el orden
inverso al número de categorías que cada variable exige cubrir (nivel tiene
hasta 10 categorías, tamaño 4, sexo 2).

**EE.GG. Letras es el caso límite en el otro extremo**: su marco tiene **un solo
nivel**, así que su distancia en nivel es exactamente 0,000. No es mérito del
sorteo, es que no había nada que repartir.

### Tabla completa

| Facultad | Aulas | Sexo | Tamaño | Nivel | Aulas por nivel |
|---|---|---|---|---|---|
| CIENCIAS E INGENIERIA | 37 | 0.019 reproduce | 0.075 parcial | 0.106 parcial | 6.2 |
| ESTUDIOS GENERALES CIENCIAS | 22 | 0.047 reproduce | 0.015 reproduce | 0.077 parcial | 5.5 |
| ESTUDIOS GENERALES LETRAS | 20 | 0.074 parcial | 0.077 parcial | 0.000 reproduce | 20.0 |
| DERECHO | 19 | 0.102 parcial | 0.040 reproduce | 0.085 parcial | 3.2 |
| ARTE Y DISEÑO | 15 | 0.000 reproduce | 0.162 **no** | 0.232 **no** | 1.5 |
| CIENCIAS SOCIALES | 12 | 0.013 reproduce | 0.230 **no** | 0.140 parcial | 2.0 |
| ARQUITECTURA Y URBANISMO | 8 | 0.037 reproduce | 0.089 parcial | 0.368 **no** | 0.9 |
| ARTES ESCÉNICAS | 8 | 0.168 **no** | 0.440 **no** | 0.328 **no** | 1.1 |
| CIENCIAS Y ARTES DE LA COMUN. | 7 | 0.201 **no** | 0.081 parcial | 0.199 **no** | 1.2 |
| GESTIÓN Y ALTA DIRECCIÓN | 7 | 0.281 **no** | 0.394 **no** | 0.345 **no** | 1.4 |
| PSICOLOGÍA | 6 | 0.000 reproduce | 0.043 reproduce | 0.225 **no** | 1.2 |
| LETRAS Y CIENCIAS HUMANAS | 4 | 0.027 reproduce | 0.000 reproduce | 0.296 **no** | 0.8 |
| GASTRONOMÍA, HOTELERÍA Y TURISMO | 3 | 0.058 parcial | 0.205 **no** | 0.191 **no** | 0.6 |
| EDUCACION | 3 | 0.000 reproduce | 0.297 **no** | 0.347 **no** | 0.8 |
| CIENCIAS CONTABLES | 3 | 0.179 **no** | 0.102 parcial | 0.490 **no** | 0.8 |

### Qué se concluye

1. **Sexo queda cubierto por el diseño.** Es además la variable con cuota
   propia y filtro duro, así que está protegida dos veces: por el balanceo del
   cubo y por el criterio de aceptación de los 50 sorteos.
2. **Tamaño queda parcialmente cubierto**, y es aceptable: el tamaño del aula
   entra además por la probabilidad proporcional, así que su efecto sobre las
   estimaciones ya está en los pesos.
3. **Nivel no queda cubierto y hay que corregirlo en la ponderación.** La
   posestratificación por nivel ya estaba prevista por la medición global
   (TVD 0,1115); este análisis por facultad muestra que el problema se
   concentra en las facultades pequeñas y que en ellas la corrección será más
   fuerte. Conviene verificar que los pesos resultantes no se disparen: una
   celda con una sola aula puede recibir un peso muy alto.

**Pendiente derivado:** al calcular la ponderación, revisar el rango de los
pesos por nivel en Contables, Educación, Gastronomía y Letras y Ciencias
Humanas, que son las cuatro con menos de una aula por nivel.

## Errores de método propios

- **Acusar a otra sesión de borrar código** a partir de un `grep` vacío sobre un
  archivo desalojado por iCloud. La función estaba en su sitio.
- **Correr las dos certificaciones en paralelo invalidó la comparación de
  tiempos.** 8 núcleos, carga 4,7–6,3, tres procesos de R: la corrida local
  pagó 3× por sorteo (0,19 s contra 0,06 s en Ciencias e Ingeniería, con los
  mismos 5 candidatos). La comparación de *resultados* sigue siendo válida; la
  de tiempos no. Para cronometrar, una sola cosa a la vez.
- **Concluir sobre el marco ≤ 60** a partir de una coincidencia perfecta entre
  tres casos y un umbral del código, sin cronometrar primero.

---

## Abierto

- Derecho: 18 ó 19, pendiente de la medición a 2.000 corridas.
- Aplicar el reparto (`aulas_base_fijas` en el componente `-fac`, endpoint
  `POST /api/calc-muestra/componente`).
- Cinco sorteos de cubo con semillas declaradas 101/202/303/404/505 y criterio
  declarado por adelantado (rerandomización, Morgan & Rubin 2012): alcanzar
  cuota en las 15 → mayor cobertura mínima → menor solape.
- Verificar en pantalla que el reparto sigue siendo ajustable por facultad. El
  ±1 existe en el código (`estratosConAjusteAula`, cableado en
  `UniversidadDesk.tsx:542,552`), pero Gonzalo reportó no poder aumentar aulas
  en la interfaz.
- Pendientes de ADR recogidos en **ADR 0082**: tope de niveles para variables
  de balanceo; `.cm_certeza_corridas` escalando por costo de búsqueda; el
  desborde del aterrizaje avisando en vez de producir NA en silencio.

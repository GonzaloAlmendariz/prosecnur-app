# La tasa de la facultad frente a la tasa del aula

Fecha: 2026-08-28. Medido sobre `HSVG26ULT2.pulso`, segundo sorteo de HSVG
PUCP 2026: 174 aulas titulares sobre un marco de 1.392 cursos-horario.

El estudio calcula cuántas encuestas espera de un aula con dos tasas distintas,
y hasta esta revisión ninguna superficie decía cuál era cuál ni por qué
diferían. La matriz de selección usaba una, la aplicación usaba la otra, y sus
nombres eran `Esperados (tau)` y `Esperados (efectividad del aula)`, que no le
dicen a nadie qué separa a una de otra.

Este documento explica qué es cada una, de dónde sale, en qué se diferencian
medido sobre el marco entero, y qué se decidió.

## 1. Qué es cada tasa

Ambas responden la misma pregunta, qué fracción de los elegibles de un aula
termina siendo una encuesta válida, y ambas se construyen con las mismas dos
piezas.

**Los insumos, los dos de 2025.** El estudio anterior aplicó 194 aulas. De ahí
salen:

- **El rendimiento por tamaño.** Las 194 aulas agrupadas por número de
  elegibles, sin distinguir facultad. Da cinco tasas: 0,80 hasta 15 elegibles,
  0,69 de 16 a 25, 0,56 de 26 a 35, 0,55 de 36 a 50, y 0,44 por encima de 50.
  Un aula chica entrega cuatro de cada cinco elegibles; una de sesenta, menos
  de la mitad.
- **El ajuste de la facultad.** La razón entre lo que una facultad rindió de
  verdad y lo que su mezcla de tamaños predecía. Va de 0,861 en Estudios
  Generales Ciencias a 1,014 en Derecho, y vale exactamente 1,000 en nueve de
  las quince, porque con menos de doce aulas aplicadas en 2025 el cociente no
  mide nada y se prefiere no ajustar.

**Y las dos tasas se arman así:**

```
Tasa de la facultad  =  rendimiento medio de su marco      ×  ajuste de la facultad
Tasa del aula        =  rendimiento del tamaño de ESA aula ×  ajuste de la facultad
```

Comparten el ajuste. Lo único que cambia es el primer factor: el promedio
ponderado del marco de la facultad frente al tramo de tamaño del aula concreta.

## 2. El hallazgo estructural: una es el promedio de la otra

Esto es lo que ordena todo lo demás, y no se había escrito en ninguna parte.

**La tasa de la facultad es literalmente la media de las tasas de sus aulas**,
ponderada por elegibles sobre su marco. Verificado en las quince facultades:

| Facultad | Tasa publicada | Media de las tasas de aula |
|---|---:|---:|
| Ciencias Contables | 0,6453 | 0,6453 |
| Letras y Ciencias Humanas | 0,8000 | 0,8000 |
| Estudios Generales Ciencias | 0,4087 | 0,4087 |
| Estudios Generales Letras | 0,4195 | 0,4188 |
| Ciencias e Ingeniería | 0,5297 | 0,5286 |

Siete de las quince coinciden con menos de 0,002 de diferencia. **No son dos
estimaciones rivales: una es el promedio de la otra.** De ahí se siguen dos
consecuencias que conviene tener presentes.

**Ninguna puede ser sistemáticamente más cauta que la otra.** Un promedio no
puede serlo respecto de sus componentes. Si el conjunto que se evalúa reproduce
la mezcla de tamaños del marco de su facultad, las dos dan idéntico resultado:
es una identidad, no una aproximación.

**Y la diferencia entre ambas solo aparece cuando el conjunto está sesgado**
hacia aulas más grandes o más chicas que el promedio de su facultad.

## 3. La evidencia sobre las 1.392 aulas del marco

Comparando aula por aula sobre el marco completo, no solo sobre las 174
sorteadas:

```
la tasa de la FACULTAD asume más     906 aulas    65,1 %
la tasa del AULA asume más           467 aulas    33,5 %
prácticamente iguales                 19 aulas     1,4 %
```

En dos de cada tres aulas la tasa de facultad es la más optimista. Pero el
efecto agregado se cancela casi por completo:

```
encuestas esperadas con la tasa de la facultad   25.670
encuestas esperadas con la tasa del aula         25.651
diferencia neta                                     −19    (−0,07 %)
diferencia ABSOLUTA acumulada                     1.484
```

Diecinueve encuestas de diferencia neta sobre más de veinticinco mil, y mil
cuatrocientas ochenta y cuatro de diferencia absoluta. Se mueve muchísimo, en
sentidos opuestos, y casi todo se compensa.

## 4. El patrón: la diferencia es una función del tamaño

Es el resultado más limpio de esta revisión.

| Tramo | Aulas | El aula asume más | La facultad asume más | Dif. media en encuestas |
|---|---:|---:|---:|---:|
| hasta 15 | 124 | **114** | **0** | +1,11 |
| 16 a 25 | 338 | 275 | 63 | +1,14 |
| 26 a 35 | 228 | 17 | 202 | −0,56 |
| 36 a 50 | 481 | 61 | 420 | −0,22 |
| más de 50 | 221 | **0** | **221** | −1,38 |

**Monótono y sin excepciones en los extremos.** En las 124 aulas de hasta
quince elegibles, la tasa de facultad no gana en ninguna. En las 221 de más de
cincuenta, gana en todas.

El mecanismo es directo: la tasa de la facultad le presta a un aula de catorce
personas el rendimiento medio de una facultad cuyas aulas rondan las treinta y
cinco, y le hace lo mismo al revés a una de sesenta. La correlación entre el
tamaño del aula relativo a su facultad y la diferencia entre las dos tasas es
de **−0,859**.

**Y por facultad, la diferencia depende de cuán heterogéneas sean sus aulas:**

```
ESTUDIOS GENERALES CIENCIAS    2,26 encuestas de diferencia absoluta media
EDUCACIÓN                      2,12
CIENCIAS SOCIALES              1,49
CIENCIAS CONTABLES             1,43
...
DERECHO                        0,56
LETRAS Y CIENCIAS HUMANAS      0,00
```

Letras y Ciencias Humanas da exactamente cero, y es el control que confirma el
mecanismo: sus diez aulas caben todas en un mismo tramo de tamaño, así que las
dos tasas son el mismo número. Donde no hay dispersión de tamaños no hay nada
que discutir.

Las mayores diferencias individuales están todas en aulas grandes:

| Facultad | Elegibles | Tasa facultad | Tasa aula | Esp. facultad | Esp. aula | Dif. |
|---|---:|---:|---:|---:|---:|---:|
| Arte y Diseño | 53 | 0,604 | 0,380 | 32 | 20 | −12 |
| Artes Escénicas | 39 | 0,740 | 0,550 | 29 | 21 | −7 |
| Ciencias e Ingeniería | 59 | 0,530 | 0,408 | 31 | 24 | −7 |

Doce encuestas de diferencia en una sola aula. Ninguna de las diferencias
mayores cae en un aula chica, porque desde cualquier tasa de facultad el rango
de tasas por tamaño es más ancho hacia abajo que hacia arriba.

## 5. Cuál predice mejor: ninguna, con la evidencia disponible

Validación cruzada dejando cada aula fuera, sobre los datos reales de 2025:

```
diferencia de error medio    0,158 encuestas
IC 95 %                      [−0,276 , +0,593]
t pareado                    p = 0,473
Wilcoxon                     p = 0,515
acierta mejor en             89 de 169 casos (53 %)
```

La diferencia no sobrevive al contraste, y por tamaño de aula tampoco: p =
0,225, 0,308 y 0,548 en los tres tramos. Con esta potencia el mínimo detectable
son 0,43 encuestas y lo observado es 0,16.

Un aula produce en promedio 19,5 encuestas y cualquiera de las dos tasas se
equivoca en unas 5,6, es decir un 29 %. La elección de tasa cabe seis veces
dentro del error que ninguna resuelve.

**Corolario para el ADR: el argumento a favor de la tasa del aula no puede ser
que predice mejor, porque no está demostrado.** El argumento válido es
estructural: sobre un aula suelta, la tasa de la facultad no responde la
pregunta que se le hace, porque le asigna a una de catorce elegibles el mismo
rendimiento por persona que a una de cincuenta.

Una medición paralela, sobre los 194 escalones aplicados en vez de las 169
cadenas, sí encuentra significancia contra la tasa global (p = 0,003) y
borderline contra la tasa de facultad (p = 0,093, Wilcoxon 0,044). La unidad de
análisis correcta es el escalón, así que ese resultado manda sobre el de arriba
para la comparación contra la tasa global; contra la de facultad sigue sin ser
concluyente.

## 6. Dónde se usa cada una

| Uso | Qué usaba | Grano correcto |
|---|---|---|
| Cuántas aulas sortear por facultad | tasa de la facultad | facultad, correcto |
| Simulación de certeza | tasa de la facultad | en revisión |
| Encuestas esperadas por aula, en el motor | tasa del aula | aula, correcto |
| Encuestas esperadas por aula, en la matriz entregada | **tasa de la facultad** | **estaba mal** |
| Cobertura de cuota por sexo | tasa de la facultad | en revisión |

**El desacuerdo entre el motor y el entregable es el que originó esta
revisión.** El motor calcula `efectivas_esperadas` como elegibles por la tasa
del aula, verificado en 157 de 174; la matriz de selección lo calculaba con la
tasa de la facultad, en 174 de 174. Sobre el total la diferencia son siete
encuestas y por eso pasó inadvertida durante todo el estudio; sobre un aula
concreta llega a doce.

## 7. Qué se decidió

**Se conserva la tasa de la facultad para dimensionar y para medir cuotas.** Es
el compromiso con el que se pactó el diseño, y no puede depender de qué aulas
salgan sorteadas.

**La matriz de selección se alineó con el motor** y ahora publica los dos
pronósticos, con nombres que dicen de qué depende cada uno: `Esperadas según la
facultad` y `Esperadas según el aula`. Mostrar ambos no es indecisión: como
ninguna gana contra los datos, ocultar cualquiera de las dos pierde
información, y juntas permiten distinguir un aula que rindió mal de un aula que
simplemente es más grande que el promedio de su facultad.

**Y el vocabulario quedó fijado así:**

| Concepto | Nombre |
|---|---|
| Las cinco tasas de 2025 por tramo | Rendimiento por tamaño |
| La razón entre lo observado y lo predicho | Ajuste de la facultad |
| El promedio ponderado sobre el marco | Tasa de la facultad |
| La tasa del tramo de un aula, por su ajuste | Tasa del aula |
| Elegibles por la tasa de la facultad | Esperadas según la facultad |
| Elegibles por la tasa del aula | Esperadas según el aula |

Los nombres viejos, `tau` y `efectividad estimada del aula`, se retiran: se
leen como sinónimos y no lo son.

## 8. Para dimensionar la muestra, las dos dan lo mismo

La pregunta se midió de verdad: cuántas aulas certifica cada facultad con una
vara y con la otra, sobre las quince, con sorteos pareados de mil corridas y
con la estratificación del diseño.

**Catorce de las quince facultades dan el mismo número.** Solo Arte y Diseño
difiere, y por una. Y en el total, que el diseño calcula como
`max(fórmula, certeza)` facultad por facultad:

```
Σ max(fórmula, certeza) con la tasa de la facultad   172
Σ max(fórmula, certeza) con la tasa del aula         172
```

Exactamente el mismo número. **La elección de vara no mueve el
dimensionamiento**, y eso cierra el argumento que quedaba: no se puede
defender la tasa del aula diciendo que dimensiona mejor, porque no lo hace.

### El mínimo certificado, facultad por facultad

Con la tasa limpia de traslape, que es la convención correcta:

| Facultad | Fórmula | Asignadas hoy | Con tasa de facultad | Con tasa del aula |
|---|---:|---:|---:|---:|
| Arquitectura y Urbanismo | 8 | 8 | 7 | 7 |
| Arte y Diseño | 15 | 15 | 10 | **11** |
| Artes Escénicas | 8 | 8 | 5 | 5 |
| Ciencias Contables | 2 | 3 | 2 | 2 |
| Ciencias e Ingeniería | 37 | 37 | 30 | 30 |
| Ciencias Sociales | 12 | 12 | 11 | 11 |
| Ciencias y Artes de la Comun. | 7 | 7 | 6 | 6 |
| Derecho | 16 | 19 | 18 | 18 |
| Educación | 3 | 3 | 2 | 2 |
| Estudios Generales Ciencias | 22 | 22 | **23** | **23** |
| Estudios Generales Letras | 18 | 20 | **21** | **21** |
| Gastronomía, Hotelería y Turismo | 3 | 3 | 3 | 3 |
| Gestión y Alta Dirección | 6 | 7 | 7 | 7 |
| Letras y Ciencias Humanas | 3 | 4 | 3 | 3 |
| Psicología | 5 | 6 | 5 | 5 |

Arte y Diseño es la única que difiere, y por una.

### Los agregados, y por qué no se leen de la columna

| | Tasa de facultad, cruda | Tasa del aula, cruda | Tasa de facultad, limpia | Tasa del aula, limpia |
|---|---:|---:|---:|---:|
| Σ certeza | 167 | 166 | 153 | 154 |
| Σ max(fórmula, certeza) | 177 | 176 | **172** | **172** |
| Más una aula operativa en Derecho | 178 | 177 | 173 | 173 |

Referencias: la fórmula sola da **165** y las asignadas hoy son **174**. La
reconstrucción del número vigente cuadra exacto: `max(fórmula, certeza del
simulador colapsado)` da 173, más una aula operativa en Derecho, 174.

Tres cosas que esa tabla esconde si se lee rápido:

**La suma de la columna de certeza no es un total de diseño.** El diseño toma
el máximo entre fórmula y certeza en cada facultad y después suma. Por eso
catorce aulas de caída en la Σ certeza se convierten en una sola en el total:
`max()` absorbe las bajas y solo deja pasar las subidas.

**El 167 a 153 de la Σ certeza es casi todo la limpieza de traslape, no la
estratificación.** Con la estratificación corregida y sin limpiar la tasa, la
suma también da 167, el mismo número que la corrida guardada pero con una
composición muy distinta. Esa coincidencia engaña si no se abre.

**La convención de traslape vale cinco aulas en el total** (177 contra 172),
más que la elección de vara, que vale cero.

## 9. Lo que sí mueve el dimensionamiento es otra cosa

La simulación de certeza reescribe `rows$stratum` con la facultad antes de
sortear, y el motor sortea por `stratum`. Como el diseño declara
`strata_cols = faculty, sex_top_1, size_group`, la simulación **pierde dos de
los tres ejes, incluido el de tamaño**, y deja al muestreo proporcional
concentrarse en aulas grandes, que es justo lo que la estratificación por
tamaño le prohíbe.

Medido sobre Estudios Generales Letras con sus veinte aulas:

```
simulador colapsado, el que corre    media 416,0    P(cumple) 0,988
simulador estratificado, el diseño   media 369,5    P(cumple) 0,000
la selección REAL de esas 20 aulas   378,6
```

El que reproduce la realidad es el que la certeza no corre.

Corregida la estratificación, **dos facultades quedan cortas por una aula con
cualquiera de las dos varas**: Estudios Generales Ciencias necesitaría 23 en
vez de 22, y Estudios Generales Letras 21 en vez de 20. Tres bajan una
(Contables, Letras y Ciencias Humanas, Psicología), pero **las subidas no se
pagan con las bajas**: la cuota es por facultad y no se compensa entre ellas.

No es casualidad que sean las dos de Estudios Generales. Son las de tasa más
baja (0,409 y 0,419) y las de aulas más grandes, o sea las que el simulador
colapsado más favorecía.

El colapso es deliberado y tiene su razón: sin él, `n_aulas` se repartiría
entre estratos y dejaría de significar «el candidato». Lo que no estaba medido
es su costo. El efecto es inflar a la vez la media y la dispersión, con la
desviación creciendo entre 1,22 y 1,48 veces, porque deja al muestreo
proporcional concentrarse en aulas grandes.

### Cómo se midió

Sorteos pareados: un solo evaluador sortea una vez por candidato y publica los
dos rendimientos sobre el mismo conjunto, con las semillas en función del
estrato y del número de aulas, de modo que ambos brazos ven exactamente los
mismos sorteos y la diferencia no puede venir del azar. Mil corridas escaladas
por tamaño de marco, `cube_balanceado`, semilla y configuración del estudio,
y búsqueda monótona del mínimo con probabilidad de cumplir por encima de 0,95
arrancando en la fórmula.

## 10. Para elegir entre sorteos, tampoco cambia el ganador

El barrido que eligió la semilla 202 entre cincuenta candidatas calculaba su
criterio, la cobertura mínima entre las 30 celdas de sexo, con la tasa de la
facultad. Se rehizo con las dos varas, corriendo el pipeline completo sobre las
cincuenta semillas.

```
la 202 queda primera con la tasa de la facultad     min 1,0741
la 202 queda primera con la tasa del aula           min 1,1053
correlación de orden entre ambos rankings           0,906
```

**La decisión que salió a campo era robusta a la vara.** Pero el ordenamiento
sí se mueve: la 4444, que quedaba cuarta, cae al puesto once. Si la 202 no
hubiera estado en el juego, la ganadora habría dependido de con qué vara se
midió.

Y lo que más cambia no es el podio sino el filtro: **treinta candidatas cierran
las 30 celdas con la vara vieja y treinta y ocho con la nueva.** Ocho
selecciones válidas que el criterio descartaba.

El argumento de magnitud lo cierra: el desplazamiento entre varas tiene una
desviación de 0,0201 mientras el barrido separaba a la 4444 de la 202 por
0,0027. **El criterio discriminaba en milésimas y las varas difieren en
centésimas.**

Una salvedad que hay que declarar: esta reejecución **no reproduce los niveles
absolutos del barrido original** y la causa no está identificada. La comparación
entre varas dentro de una misma definición se sostiene; las cifras absolutas de
cobertura mínima no deben citarse hasta cuadrar esa diferencia.

## 11. El control que valida cualquier reescritura futura

Letras y Ciencias Humanas tiene sus diez aulas del marco en un solo tramo de
tamaño. Como las dos tasas comparten el ajuste de facultad y solo difieren en
el primer factor, **para esa facultad son literalmente el mismo número**, y
cualquier cálculo que las haga divergir tiene un defecto por construcción.

Sirvió dos veces en esta revisión, por caminos independientes. En la
comparación aula por aula da exactamente 0,00 de diferencia absoluta media,
la única de las quince. Y en la certificación, el brazo con el error de netos
daba 28,2 contra 28,7 donde tenía que dar lo mismo; corregido da 28,2 contra
28,2 con probabilidades de 0,997 idénticas al último decimal.

**Ese es el caso con el que hay que escribir la regresión** si alguna vez se
reescriben las tasas: no hace falta conocer el valor correcto, basta con que
las dos columnas coincidan donde tienen que coincidir.

## 12. Los números que se descartaron en el camino

Esta revisión se hizo en paralelo entre dos sesiones midiendo lo mismo por
caminos distintos, y cinco afirmaciones se cayeron al contrastarlas. Quedan
registradas porque las cinco eran plausibles y ninguna se habría detectado con
una sola medición.

| Se afirmó | Es | Por qué |
|---|---|---|
| La tasa del aula sube el total de 174 a 175 | Empatan, 172 y 172 | Medido sobre el simulador con los estratos colapsados |
| La tasa del aula ahorra nueve aulas | Ahorra cero | Uso de la columna de netos por estrato fuera de su alcance |
| Estudios Generales Letras cierra con 20 usando la tasa del aula | Necesita 21 con las dos | El mismo error de netos |
| La brecha entre las dos varas de cobertura son 365 encuestas | Unas 150 | Doble descuento del traslape |
| La diferencia entre tasas no es significativa, p = 0,473 | p = 0,003 contra la tasa global | Medido sobre cadenas en vez de escalones |

Las dos primeras y la tercera vienen del mismo mecanismo, que conviene nombrar
porque es reutilizable: **un acotamiento válido que caduca cuando cambia lo que
lo hacía válido, y nada avisa.** La columna de netos por estrato era exacta
mientras el simulador colapsaba los estratos a la facultad, y dejó de serlo al
corregir la estratificación, que es una reparación en otro archivo. Con el
error, la sobrecuenta iba de 2,07 % en Letras y Ciencias Humanas a 11,11 % en
Ciencias Sociales, del mismo tamaño que las diferencias que se querían medir.

La quinta es del mismo tipo en el otro sentido: la cadena era la unidad
correcta para lo que se medía al principio y dejó de serlo al comparar
pronosticadores por aula, porque una cadena agrega varios escalones y los
clasifica en un tramo de tamaño que no les toca.

## 13. Qué se sostiene y qué no

**Se sostiene:**

- La tasa de la facultad es la media ponderada de las tasas de sus aulas, con
  siete de quince coincidiendo a menos de 0,002.
- El patrón por tamaño, monótono y sin excepciones en los extremos: 0 de 124 en
  el tramo chico contra 221 de 221 en el grande.
- Las dos varas dimensionan igual: catorce de quince facultades, y 172 en el
  total con ambas.
- La simulación de certeza colapsa los estratos, verificado en el código y
  medido, con validación contra la selección real.
- Estudios Generales Ciencias y Estudios Generales Letras quedan cortas por una
  aula, con cualquier vara.
- En el barrido, la semilla 202 gana con las dos varas, y el filtro pasa de 30
  a 38 candidatas que cierran las treinta celdas.

**No se sostiene todavía, y hay que declararlo así al citarlo:**

- Los niveles absolutos de la reejecución del barrido no reproducen los del
  barrido original. Quedan descartadas tres causas: la fuente de cuota (las 30
  celdas son idénticas en los dos marcos y suman 2.500 en ambos), el marco (la
  cobertura no se mueve entre ULT1 y ULT2, aunque el solape sí encaja con ULT2
  y confirma que el barrido corrió sobre ese marco) y la fuente de la tasa (usar
  la derivada del marco en vez de la sellada mueve menos de una milésima). Queda
  por revisar la definición de cobertura por celda y la configuración del sorteo
  del barrido original. El desajuste no es un factor constante: 0,6 % para la
  semilla 202 y 3,1 % para la 4444, e invierte el orden entre ambas. Solo la
  comparación entre varas dentro de una misma definición es utilizable.
- **Hay dos tasas de facultad conviviendo.** La sellada en `aulas_por_estrato` y
  la derivada del marco por `calc_muestra_aulas_tasas_facultad` difieren en ocho
  de las quince facultades, hasta un 4,19 % en Gastronomía. La sellada no sale
  de la mezcla de tamaños de ninguno de los dos marcos, ni el de 1.512 ni el de
  1.392: coincide con siete facultades en ambos casos, y las que más difieren
  son precisamente las de factor de facultad 1,000, donde la tasa debería ser la
  mezcla pura. Si una superficie lee la sellada y otra la derivada, publican
  tasas distintas para la misma facultad. No se persiguió.
- El factor de limpieza del traslape se aplica **por facultad como proxy**. El
  correcto sería por tramo de tamaño, y no se puede derivar de lo sellado: los
  embudos van por facultad y los escalones de las cadenas no traen el conteo de
  repetidos.
- La procedencia de las cinco tasas embebidas sigue sin explicar. El
  desalineamiento de bins aporta 0,8 de los 6,4 puntos de optimismo, y el
  propio archivo se contradice: el encabezado las atribuye a la base de 2025 y
  el bloque de las piernas dice que son «de otra ola».

## 14. Lo que queda abierto

Tres cosas, ninguna urgente para el operativo en curso, todas registradas en
`auditoria-motor-aulas-2026-08-28.md`:

**La simulación de certeza colapsa los estratos** y por eso no sortea como
sortea el estudio. Es el problema de primer orden en la cadena de
dimensionamiento, por encima de qué tasa use.

**Los tramos no son monótonos.** Un aula de 26 elegibles espera un 16 % menos
que una de 25, y 190 de las 1.392 aulas del marco están a un elegible de un
borde. La solución evaluada es una curva continua, que empata en precisión con
los tramos pero elimina las inversiones.

**El eje de sexo aplana la tasa** que el eje de aula ya compuso, y la
composición por sexo covaría con el tamaño en siete de doce facultades, con
signo variable. Cambiarlo es de una línea, pero conviene hacerlo junto con la
curva continua y no antes.

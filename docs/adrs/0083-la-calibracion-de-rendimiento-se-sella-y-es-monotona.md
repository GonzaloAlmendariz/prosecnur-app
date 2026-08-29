# ADR 0083 — La calibración de rendimiento se sella, y su forma es monótona

- **Estado**: Aceptado
- **Implementación**: Pendiente — decisión tomada, código no escrito
- **Ámbito**: Cálculo de muestra · dimensionamiento de cursos-horario ·
  `calc_muestra_aulas_efectividad.R` · config del estudio
- **Fecha**: 2026-08-28 · **Ratificado**: 2026-08-28 (Gonzalo, encargo de cerrar
  la decisión abierta del trabajo 2 de
  `docs/qa/plan-dos-tasas-en-monitoreo-2026-08-28.md`)
- **Relación**: obedece el límite del
  [ADR 0066](0066-la-probabilidad-publicada-es-la-del-sorteo-ejecutado.md) —lo
  publicado es lo del sorteo ejecutado, así que nada de aquí redimensiona un
  estudio en curso—; usa el vocabulario de las dos varas que fijó
  [ADR 0082](0082-la-tau-del-diseno-es-un-supuesto-fechado-y-el-campo-lo-contrasta.md)
  y hereda de él la disciplina de que **un supuesto se publica con su
  procedencia y su fecha, nunca desnudo**.

## Contexto

El dimensionamiento compone la tasa del aula como `rendimiento(tamaño) ×
factor_residual(facultad)`. El `rendimiento(tamaño)` son hoy cinco escalones. El
trabajo 2 del plan quedó abierto con tres opciones: dejar el valor único,
publicar un rango, o pasar a una curva continua.

Al medir para decidir aparecieron dos hechos, y **el primero no estaba en el
plan**.

### Hecho 1 — El estudio en curso corre sobre un respaldo que nunca declaró

En el `.pulso` del sorteo vigente (HSVG26ULT2, sello 2026-08-27):

- `calc_muestra_aulas_config$efectividad$rendimiento_tramos` es **NULL**.
- Las tres piernas del rendimiento —asistencia, respuesta, validez— están
  **vacías en las 1.392 aulas** del marco (cero valores finitos).

Es decir, el estudio no corre sobre los tramos sellados que documenta la tabla
de piernas de `calc_muestra_aulas_efectividad.R` (0,809 · 0,642 · 0,566 · 0,500
· 0,409), sino sobre **la calibración embebida de respaldo** que el código lleva
escrita a mano:

```
≤15: 0,80 · 16–25: 0,69 · 26–35: 0,56 · 36–50: 0,55 · >50: 0,44
```

Recuperado del propio marco, sin suponerlo, y con una prueba que no depende de
adivinar el factor. En EE.GG. Letras, con 148 aulas de 16 a 72 elegibles, la
tasa del aula toma cuatro valores: **0,639 · 0,518 · 0,509 · 0,407**. Dentro de
una facultad el factor residual es constante, así que basta preguntar qué juego
de tramos admite **un solo factor** que reproduzca los cuatro bajo el redondeo a
tres decimales con que el motor los publica:

| Juego de tramos | ¿Factor único compatible? |
|---|---|
| Respaldo embebido (0,69 · 0,56 · 0,55 · 0,44) | **Sí**, con factor en [0,92536 · 0,92589) |
| Tabla de piernas (0,642 · 0,566 · 0,500 · 0,409) | **No**: los intervalos son disjuntos |

El factor que la app publica para esa facultad es 0,926, dentro del intervalo
que exige el respaldo. La tabla de piernas queda descartada por imposibilidad,
no por parecido.

Esto es el «lector sin escritor» que `auditoria-motor-aulas-2026-08-28.md`
registró como hallazgo, confirmado sobre el estudio real. **Ninguna superficie
dice que la calibración vigente es un respaldo.** El estudio se defiende ante
terceros citando una calibración de 2025 y está corriendo sobre otra.

### Hecho 2 — El escalón invierte, y está medido

Con las tasas que el estudio **realmente** usa:

| Borde | Espera en n | Espera en n+1 | Caída | Tamaños menores que esperan más |
|---|---:|---:|---:|---:|
| 15 → 16 | 12,00 | 11,04 | 8,0 % | 2 (14 y 15) |
| 25 → 26 | 17,25 | 14,56 | **15,6 %** | 4 (22 a 25) |
| 35 → 36 | 19,60 | 19,80 | −1,0 % | ninguno |
| 50 → 51 | 27,50 | 22,44 | **18,4 %** | **10 (41 a 50)** |

Sobre el marco de ULT2, medido directamente:

- **190 de 1.392 aulas** incluidas están a un elegible de un borde (13,6 %).
- **3.727 de 123.688 pares de la misma facultad** están invertidos: la más
  grande espera menos que la más chica (3,0 %; el denominador excluye empates
  de tamaño, que no pueden invertirse).
- De los **174 titulares** sorteados, 16 están a un elegible de un borde y 28
  caen en el tramo `>50`, donde el escalón vale 18,4 %.

La inversión es indefendible porque contradice la premisa del propio
instrumento. El documento metodológico publica que las aulas chicas rinden más,
y el instrumento responde que un aula de 51 elegibles rendirá menos encuestas
que una de 41.

### Hecho 3 — La curva ya se ajustó, y su argumento no es la precisión

En validación cruzada la curva continua **no mejora la precisión**: empata con
los tramos (p = 0,47), salvo una variante quasibinomial que gana 0,150
encuestas (p = 0,012). Lo que sí hace es **eliminar las inversiones de raíz**,
por ser monótona creciente en encuestas esperadas.

El argumento para la curva es la monotonicidad. Decir que es la precisión sería
vender lo que la medición no dio.

### La restricción que decide el diseño

La calibración **es dato del estudio, no código**: `.cm_efectividad_rendimiento()`
lee los tramos de la config y sólo cae al respaldo si no hay sello. Y el `.pulso`
**no lleva con qué reajustar la curva**: la referencia de asistencia que viaja
dentro tiene tres dimensiones —rango horario, facultad, tipo de sesión— y
**ninguna de tamaño**, ni las 194 aulas individuales de 2025.

Por lo tanto la curva no puede ser algo que la app calcule sola. Tiene que
llegar como llega hoy la calibración: sellada, fechada y con procedencia.

## Decisión

**La calibración de rendimiento se sella siempre, y cuando se sella su forma es
una función monótona. Un estudio corre con lo que selló, y nada se le cambia por
detrás.**

### 1. Sellar es obligatorio; el respaldo deja de ser invisible

Un estudio que hoy no tiene `rendimiento_tramos` **escribe el respaldo en su
config** en el momento en que lo usa por primera vez, con `fuente =
"calibracion_embebida"`, su periodo y la fecha. Deja de ser una rama silenciosa
del código y pasa a ser un dato del estudio, igual que cualquier otra
calibración.

Esto se hace **antes** que la curva y es independiente de ella. Es la parte que
repara el hecho 1, y sin ella el resto es peligroso: cambiar el respaldo del
código movería en silencio los números de todo estudio que nunca selló.

### 2. La forma sellada admite curva, y la curva es la que se ofrece por defecto

El esquema de la config admite dos formas: los cinco escalones —que se siguen
leyendo, porque hay estudios sellados con ellos— y una función monótona. Para
un estudio **nuevo** la forma ofrecida es la curva.

### 3. El sello es estructural, no una política que haya que recordar

Un estudio sellado con escalones **sigue con escalones para siempre**, porque el
motor evalúa lo que el estudio selló y no lo que el código prefiere hoy. No hay
migración, no hay recálculo retroactivo, no hay una fecha de corte que alguien
tenga que vigilar.

**HSVG2026 termina con 0,80 · 0,69 · 0,56 · 0,55 · 0,44.** Lo único que cambia
para él es que esos cinco números pasan a estar escritos en su config, con su
procedencia declarada, en vez de venir de una rama del código que ninguna
pantalla nombra. Ni una sola cifra del sorteo, del dimensionamiento ni de las
metas por aula se mueve. Es lo que exige el ADR 0066.

### 4. El rango se pospone, con una condición nombrada

No se publica un rango hoy. Ninguna de las dos tasas modela la dispersión de un
aula alrededor de su tramo, y un rango construido sin eso estaría absorbiendo un
defecto del instrumento en vez de medir incertidumbre.

**Qué lo habilita, dicho para que no haya que volver a discutirlo:** los
residuos de la curva contra el campo observado. Cuando HSVG2026 cierre, sus
aulas aplicadas dan una segunda medición independiente de la de 2025, y la
distribución de esos residuos por tamaño **es** la dispersión que hoy falta.
Antes de eso, no; el rango se construye sobre la curva, nunca sobre los
escalones, porque sobre escalones estaría midiendo el escalón.

### 5. El invariante, que es lo que la guarda

Cada pieza nueva necesita su invariante estructural, no su test de valor. El de
aquí se cumple por construcción y se comprueba sobre el marco entero:

> **Para dos aulas de la misma facultad, la que tiene más elegibles no puede
> esperar menos encuestas.**

Se verifica sobre todos los pares de la misma facultad del marco, no sobre una
muestra. Hoy ese invariante **falla en 3.727 pares** y ése es exactamente el
número que la curva lleva a cero.

Y un segundo invariante, que es el que protege el sello:

> **Un estudio sellado con escalones produce, después del cambio, los mismos
> `efectivas_esperadas` que producía antes.**

Para HSVG2026 eso es la suma **3.157,8** sobre los 174 titulares, que es la
cifra publicada. Si el cambio la mueve, el cambio está mal.

## Consecuencias

**Lo que se gana.** El instrumento deja de contradecir su propia premisa. La
calibración deja de ser invisible. Y los dos invariantes convierten en
comprobable lo que hoy son tres hallazgos de auditoría.

**Lo que cuesta.** Un esquema de config con dos formas en vez de una, y el
respaldo escrito en cada estudio que no lo tenía. La segunda parte toca estudios
existentes al abrirlos, así que el invariante 2 no es opcional: es lo único que
distingue «declarar lo que ya corría» de «cambiar lo que corría».

**Lo que NO se decide aquí.** De dónde sale la curva de un estudio nuevo. Este
ADR dice que la forma sellada puede ser una curva y que el motor la evalúa; de
dónde viene el ajuste —qué campo, qué periodo, quién lo firma— es la misma
pregunta que ya tiene abierta la calibración embebida, cuya procedencia el
propio archivo se contradice al declarar
(`auditoria-motor-aulas-2026-08-28.md`). Se resuelve para las dos a la vez o no
se resuelve.

**Lo que se corrigió al medir esto.** El primer pase de esta decisión calculó
los bordes con los tramos de la tabla de piernas (0,809 · 0,642 · …) y concluyó
que el 15,6 % del borde 25→26 «en realidad» pertenecía al borde 50→51. Era falso:
esos tramos no son los que el estudio corre. La cifra que el documento de las
dos tasas venía publicando era correcta, y quien la revise contra el `.pulso`
llegará al mismo 15,6 %. **Dos juegos de tramos conviven en el mismo archivo y
sólo uno está en uso**, que es otra forma del mismo defecto que este ADR repara.

## Cómo reproducir las cifras de este ADR

Todas salen del `.pulso` del sorteo vigente, que **no vive en el repo** (lleva
datos de cliente):
`~/Documents/Pulso/HSTVG2026/Segundo sorteo 27 agosto/HSVG26ULT2.pulso`.

Se descomprime y se lee `state.rds`. Los tres puntos de entrada:

- `state$calc_muestra_aulas_config$efectividad$rendimiento_tramos` → NULL es el
  hecho 1.
- `state$calc_muestra_aulas_frame$aula_frame` filtrado por `included == TRUE`
  → 1.392 aulas, con `eligible_n`, `tasa_efectividad_aula` y
  `efectivas_esperadas`. Las tres piernas (`tasa_asistencia_aula`,
  `tasa_respuesta_aula`, `tasa_validez_aula`) tienen cero valores finitos.
- `state$calc_muestra_aulas_selection$selection` filtrado por `sample_role ==
  "titular"` → 174 filas, elegibles de 10 a 72, `sum(efectivas_esperadas)` =
  3.157,8.

La inversión se cuenta sobre pares de la **misma facultad** con tamaños
distintos: `sign(Δelegibles) != sign(Δesperadas)`. La prueba del juego de
tramos se hace por intervalos: para cada tramo, el conjunto de factores `f` que
cumplen `round(r × f, 3)` igual al valor observado; si la intersección de los
cuatro es vacía, ese juego queda descartado.

Un `.pulso` es una foto de cuando se guardó. Si la fecha de `saved_at` del
manifiesto no es 2026-08-27, las cifras de arriba no tienen por qué coincidir y
lo que hay que revisar primero es de qué sorteo se está hablando.

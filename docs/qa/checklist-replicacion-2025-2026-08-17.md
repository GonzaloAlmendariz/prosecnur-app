# Replicar 2025 con el motor de 2026 — doc vivo

**Encargo de Gonzalo (2026-08-17)**: analizar en estricta profundidad qué aulas
seleccionó el estudio 2025 por facultad y con qué criterios; y si aplicando esos
mismos criterios con el motor actual y el mismo cálculo de alumnos por
curso-horario por facultad —**mín(mediana, media)**— llegaríamos a los mismos
cursos-horario elegibles, los mismos alumnos elegibles, las mismas aulas
requeridas por facultad y una selección con las mismas características.

**Fuente**: `~/Documents/Pulso/HSTVG2026/Historico 2025/` (se lee, no se copia
al repo). Seis libros; los que sostienen este análisis son
`Hostigamiento PUCP 2025_BD Aulas Agendadas-6.xlsx` (marco sorteado, 1.097),
`HSVBG2025_base_historica_aulas_ADR0060.xlsx` (diseño, metas por facultad y base
de 1.012 candidatos) y `HSVBG2025_base_aplicabilidad_cursos_horario.xlsx`.

## Tablero

| # | Paso | Estado |
|---|---|---|
| R1 | Qué aulas seleccionó 2025, por facultad | ☑ |
| R2 | Con qué criterios | ☑ |
| R3 | Qué parámetros de diseño usó | ☑ |
| R4 | **Por qué ~130 y no ~170: el `est` de 2025 ya lleva el factor que llamamos τ** | ☑ |
| R4b | La plantilla de Kamila: 189 objetivo / 203 a visitar, sobre la MISMA base | ☑ |
| R5 | **Las 1.097 no son el marco, son lo sorteado; el marco eran ~2.931** | ☑ |
| R6 | Nuestro embudo contra el de 2025: 2.420 comunes, 511 explicadas | ☑ |
| R7 | Aulas por facultad: **motor 478 vs plantilla 189** | ☑ medido, explicado a medias |
| R9 | Por qué el universo de aulas por facultad no se parece | abierto |
| R10 | **La vara de 170–210 aulas: sólo p25 la cumple (193)** | ☑ medido |
| R11 | **Comparativo histórico por facultad, de números y de MÉTODO** | ☑ |
| R8 | Características de la selección, 2025 vs 2026 | pendiente |
| S1 | **Criterio de nivel declarado POR FACULTAD (12 rangos + 3 exentas), marco 2.426 idéntico al bloque** | ☑ 2026-08-18 |
| S2 | **La config no sobrevivía: R y UI hablaban shapes distintos de courseLevelRanges** | ☑ reparado `4a1d1266` |
| S2b | La copia de sesión de `alumnos_por_ch_decision` queda en centinela; la decisión VIVE en el estudio | ☑ diagnosticado, deuda menor |
| S3 | Coincidencia sin gráficos: reutilizar los bloques del histórico | pendiente |

## R1 · Las 170 aulas titulares de 2025, por facultad

El libro de aulas agendadas trae **1.097 filas** = el marco. La columna `muestra`
las reparte en olas: **Muestra 01 = 170 titulares**, Muestra 02–12 = las cadenas
de reemplazo, y **85 aulas nunca seleccionadas**.

| Facultad | Titulares | Elegibles cubiertos | Mediana por aula | En el marco |
|---|---:|---:|---:|---:|
| CIENCIAS E INGENIERIA | 39 | 1.150 | 28,0 | 271 |
| ESTUDIOS GENERALES CIENCIAS | 25 | 1.046 | 39,0 | 80 |
| ESTUDIOS GENERALES LETRAS | 19 | 841 | 48,0 | 135 |
| DERECHO | 16 | 622 | 41,0 | 203 |
| CIENCIAS SOCIALES | 15 | 439 | 30,0 | 79 |
| CIENCIAS Y ARTES DE LA COMUN. | 10 | 220 | 24,0 | 76 |
| ARTE Y DISEÑO | 9 | 165 | 18,0 | 34 |
| ARTES ESCÉNICAS | 7 | 111 | 15,0 | 44 |
| ARQUITECTURA Y URBANISMO | 6 | 193 | 34,5 | 31 |
| GESTIÓN Y ALTA DIRECCIÓN | 6 | 190 | 33,0 | 40 |
| PSICOLOGÍA | 6 | 145 | 24,5 | 45 |
| EDUCACION | 4 | 65 | 14,0 | 14 |
| LETRAS Y CIENCIAS HUMANAS | 4 | 53 | 12,5 | 12 |
| CIENCIAS CONTABLES | 2 | 54 | 27,0 | 13 |
| GASTRONOMÍA, HOTELERÍA Y TURISMO | 2 | 34 | 17,0 | 20 |
| **Total** | **170** | **5.328** | | **1.097** |

Las quince facultades reciben al menos dos titulares. La cadena de reemplazo no
es pareja: las 170 tienen reserva 1, 2 y 3; a partir de ahí se adelgaza —128,
128, 107, 53, 18, 18, 18, 16, 16—, así que **sólo 16 estratos llegaron a la
reserva 11**. Es la medida empírica que faltaba para M10.

## R2 · Los criterios que caracterizaron esas aulas

Medido sobre las 1.097 del marco y sobre las 170 titulares:

- **Modalidad: PRESENCIAL en el 100 %** (1.097 de 1.097).
- **Tipo de curso: TEÓRICO en el 100 %** — la etiqueta es
  `TEORICO(TEORICO-PRACTICO,TEORICO-LABORATORIO)`, así que entran teórico puro,
  teórico-práctico y teórico-laboratorio, y quedan fuera taller, laboratorio
  puro, seminario y práctica.
- **Tipo de docente: sólo dos** — `DOCENTE CONTRATADO - CONTRATADO` (902) y
  `DOCENTE ORDINARIO - PRINCIPAL` (195). Ningún auxiliar, asociado ni jefe de
  práctica. En las titulares, 145 y 25.
- **Nivel del curso: 0, 2, 3, 4, 5, 6, 7, 8, 9, 10 — el nivel 1 no aparece**, ni
  en las 1.097 ni en las 170.
- **Condición de matrícula: la columna viene vacía** en las 170.

**Población**: `poblacion_elegible = matriculados_total − excluidos_1er_ciclo`,
comprobado fila a fila en las 1.012 (TRUE en todas). En el libro de aulas
agendadas, `matriculados_poblacion` es exactamente esa misma cifra (1.012 de
1.012 coinciden). Se excluyeron **3.877 matrículas de primer ciclo** de 35.847,
dejando 31.970.

### Contradicción a resolver con Gonzalo

El propio diseño dice, textual: «el 1er ciclo se excluye **en el cuestionario, no
en la base**». Pero la base sí lo descuenta: hay una columna
`excluidos_1er_ciclo` y la población elegible de cada aula la resta. Además no
hay ni un curso de nivel 1 en el marco.

Son cosas distintas —el ciclo del ALUMNO y el nivel del CURSO— y por eso pueden
convivir, pero el resultado práctico es que en 2025 el primer ciclo **sí** salió
del denominador. Esto toca directamente H3 y la capa del criterio `level`, que
hoy nace en `instrumento` (no recorta el marco). Cuál de las dos lecturas es la
que quieres para 2026 es decisión tuya, no del loop.

## R3 · El diseño 2025, tal como está declarado

| Concepto | Valor |
|---|---|
| Población objetivo | 22.234 personas únicas (pregrado · regular · edad ≥ 18) |
| Confianza · p · e · deff | 95 % · 0,30 · 2,46 % · **2,0** |
| n de fórmula | ≈ 2.381 |
| **Muestra de diseño** | **2.500** (fijada, no despejada) |
| Ratio de sobremuestra | **× 1,5** → **3.750** |
| Afijación | proporcional por facultad × sexo |
| Marco de aulas | **1.097** (presenciales, tipo teórico) |
| Método | sistemático, k = N/n, con un aleatorio por aula |
| **Regla de aulas** | **aulas = CEIL(sobremuestra / estudiantes_por_aula)**, con **estudiantes_por_aula = mín(mediana, media) de elegibles** |
| Aulas titulares | **170** · elegibles en ellas **5.328** |
| Tasa de respuesta implícita | 70,4 % (3.750 / 5.328) — el propio libro advierte que **el «70 % por aula» NO es del diseño** |
| Traslape del marco | **1,55 aulas por alumno** (34.541 elegibles sumados ÷ 22.234 personas) |
| Ejecución | 194 aulas aplicadas · 169/170 estratos resueltos · **3.303 efectivas** |

## R4 · La regla declarada NO reproduce las 170 · **hallazgo**

Aplicando literalmente `CEIL(sobremuestra / mín(mediana, media))` sobre el marco
de 1.097, con la población elegible de cada aula:

| Facultad | mediana | media | mín | Sobremuestra | 2025 real | Replicado | Δ |
|---|---:|---:|---:|---:|---:|---:|---:|
| CIENCIAS E INGENIERIA | 32,0 | 31,1 | 31,1 | 784 | 39 | 26 | **−13** |
| EG CIENCIAS | 38,0 | 40,6 | 38,0 | 636 | 25 | 17 | **−8** |
| EG LETRAS | 46,0 | 41,4 | 41,4 | 652 | 19 | 16 | −3 |
| DERECHO | 41,0 | 37,2 | 37,2 | 429 | 16 | 12 | −4 |
| CIENCIAS SOCIALES | 28,0 | 26,8 | 26,8 | 222 | 15 | 9 | **−6** |
| CIENCIAS Y ARTES COMUN. | 22,0 | 20,8 | 20,8 | 143 | 10 | 7 | −3 |
| ARTE Y DISEÑO | 18,5 | 22,5 | 18,5 | 175 | 9 | 10 | +1 |
| ARTES ESCÉNICAS | 14,0 | 17,6 | 14,0 | 105 | 7 | 8 | +1 |
| ARQUITECTURA | 32,0 | 37,8 | 32,0 | 184 | 6 | 6 | **0** |
| GESTIÓN | 34,5 | 32,0 | 32,0 | 171 | 6 | 6 | **0** |
| PSICOLOGÍA | 24,0 | 22,1 | 22,1 | 116 | 6 | 6 | **0** |
| EDUCACION | 14,5 | 16,0 | 14,5 | 39 | 4 | 3 | −1 |
| LETRAS Y CIENCIAS HUMANAS | 13,0 | 12,9 | 12,9 | 38 | 4 | 3 | −1 |
| CIENCIAS CONTABLES | 27,0 | 25,2 | 25,2 | 32 | 2 | 2 | **0** |
| GASTRONOMÍA | 18,0 | 17,5 | 17,5 | 24 | 2 | 2 | **0** |
| **Total** | | | | **3.750** | **170** | **133** | **−37** |

**Exactas 5 de 15**, y las cinco son facultades chicas. Las grandes se quedan
cortas y el desvío no es un factor constante: 1,50 en Ciencias e Ingeniería,
1,67 en Ciencias Sociales, 1,19 en EE.GG. Letras. Un coeficiente único no lo
explica.

Falta un ingrediente que el diseño no declara. Descartado ya: no es el
denominador —`matriculados_poblacion` y `poblacion_elegible` son la misma cifra,
comprobado en las 1.012— ni un error de emparejamiento de facultades (la primera
corrida truncaba los nombres a 14 caracteres y fundía las dos de Estudios
Generales; corregido).

Hipótesis por probar, en orden:
1. **El universo del estadístico no es el marco.** Si mín(mediana, media) se
   calculó sobre el catálogo completo de cursos-horario del semestre —no sobre
   las 1.097 ya filtradas— las facultades grandes tendrían aulas más chicas y
   pedirían más. Explicaría por qué el desvío crece con el tamaño de la facultad.
2. **Un factor de asistencia por aula.** Con 0,70 las cifras se acercan (39→36,
   25→24, 16→17) pero tampoco cierran, y el propio libro advierte que ese 70 %
   no es del diseño.
3. **Un piso operativo por facultad** que levante a las chicas y no toque a las
   grandes — pero las chicas son justo las que ya cuadran.

**R7 queda bloqueado hasta cerrar esto**: comparar las aulas por facultad de 2026
contra las de 2025 exige saber qué regla produjo realmente las 170.

## Contraste con el motor de hoy

Nuestro motor usa `aulas_base = ⌈cuota / (avg_conglomerado × τ)⌉` con **τ = 0,53**.
La regla de 2025 es `CEIL(sobremuestra / est)` = `CEIL(1,5 × cuota / est)`.

Para el mismo `est`, el motor de hoy pide **1/0,53 ÷ 1,5 = 1,26 veces** más aulas
que la regla declarada de 2025 — y resulta que 170/133 = **1,28**. La coincidencia
es notable y merece comprobarse: puede que τ = 0,53 ya esté absorbiendo el
ingrediente que falta en el papel de 2025.

## Corrección de Gonzalo (2026-08-17) — todo corre sobre la MISMA base

Textual: «todo lo que ahorita se llama 2026 igual sólo se está basando en la base
del 2025, porque todavía no nos dan la base de 2026 como tal. Servía como un
referente sobre cómo lo haríamos este año, mas no es la base de 2026, **por lo
que si seguimos los mismos criterios en principio debería coincidir con la de
2025**».

Eso convierte las tres cifras en directamente comparables, y la pregunta deja de
ser «por qué difieren dos años» para ser **por qué difieren tres lecturas del
mismo dato**:

| | Población | Aulas del marco | Aulas titulares |
|---|---:|---:|---:|
| Estudio 2025, ejecutado | 22.234 | **1.097** | **170** |
| Plantilla de Kamila | 21.365 | 1.270 | 189 objetivo / 203 a visitar |
| Nuestro motor | 21.365 | **2.468** | 177 (universidad) / 478 (por facultad) |

**La divergencia que manda es el marco: 1.097 contra 2.468.**

### Lo medido sobre esa divergencia

Cruzando nuestras 5.263 aulas contra el catálogo completo de 23.133 —join por
`Curso-Horario` normalizado a mayúsculas sin separadores; con el id crudo cruzan
**0**, con el normalizado **5.262 de 5.263**:

- Presenciales: **4.624**. Presenciales **y** teóricas: **3.699**.
- **Las 2.468 incluidas de hoy son TODAS presenciales y teóricas.** Así que el
  filtro de tipo de curso no es lo que nos separa de las 1.097: 2025 aplicó algo
  más que recortó 3.699 → 1.097, y eso sigue **abierto**.
- Pista: 2025 cubría 34.541 elegibles-plaza sobre 22.234 personas, **1,55 aulas
  por alumno**; nosotros cubrimos 83.917 sobre 21.365, **3,93 aulas por alumno**.
  Nuestro marco solapa dos veces y media más, con un tamaño medio de aula
  parecido (31,5 contra 34). Apunta a una de-duplicación por curso o por alumno
  que 2025 hizo y nosotros no.

### Dos defectos de mapeo, encontrados de paso

1. **`session_type` no se mapea nunca.** El catálogo trae `Tipo de curso` con
   TEORICO 16.973, LABORATORIO 2.523, TALLER 2.117, SEMINARIO 928, ACTIVIDAD 180,
   ASESORÍA 166, ARTISTICO 106, CURSO DE INVESTIGACIÓN 96 y TRABAJO DE TESIS 36.
   Nuestro `mapping$session_type` busca `session_type, tipo_sesion, tipo_clase,
   actividad` — **ninguno es «Tipo de curso»**—, así que la columna llega vacía en
   las 5.263 y el criterio de tipo de curso **no se puede declarar**, aunque hoy
   no cambie el resultado. Es el criterio que en 2025 definía el marco.
2. **`teacher_type_top` contiene nombres de docente**, no tipos: los valores más
   frecuentes son apellidos. El catálogo tiene `Tipo de docente` como columna 19.
3. Además, **ESCUELA DE POSGRADO conserva 2 aulas incluidas** pese a la exclusión
   por facultad.

## R5 · **Las 1.097 no son el marco: son lo sorteado** · resuelto

El diseño 2025 llama «Marco de aulas 1.097» a lo que en realidad es el **pool
sorteado** —170 titulares + 1.012 candidatos en cadena + 85 nunca seleccionadas—.
El universo elegible del que salieron es mucho mayor.

La prueba es la tasa de paso por facultad. Partiendo del catálogo de
**5.262 cursos-horario únicos** (las 23.133 filas del libro son sesiones, no
aulas), el pool que cumple los criterios de 2025 es de **3.046**, y de ahí
entraron 1.097. Si un criterio los separara, la tasa variaría por facultad; es
**uniforme**:

| Facultad | En el pool | Dentro de las 1.097 | % |
|---|---:|---:|---:|
| CIENCIAS E INGENIERIA | 655 | 231 | 35 |
| EG LETRAS | 470 | 181 | 39 |
| DERECHO | 395 | 184 | 47 |
| EG CIENCIAS | 352 | 111 | 32 |
| **ESCUELA DE ESTUDIOS ESPECIALES** | **179** | **61** | **34** |
| CIENCIAS Y ARTES COMUN. | 168 | 63 | 38 |
| CIENCIAS SOCIALES | 139 | 52 | 37 |
| ARTES ESCÉNICAS | 115 | 43 | 37 |
| **ESCUELA DE POSGRADO** | **115** | **0** | **0** |
| GESTIÓN | 101 | 26 | 26 |
| PSICOLOGÍA | 90 | 39 | 43 |
| ARTE Y DISEÑO | 83 | 33 | 40 |
| ARQUITECTURA | 64 | 29 | 45 |
| LETRAS Y CIENCIAS HUMANAS | 40 | 9 | 22 |
| GASTRONOMÍA | 33 | 17 | 52 |
| EDUCACION | 25 | 8 | 32 |
| CONTABLES | 16 | 8 | 50 |
| CONSORCIO DE UNIVERSIDADES | 6 | 2 | 33 |
| **Total** | **3.046** | **1.097** | **36** |

Entre 26 % y 52 % en todas —dispersión de sorteo— **salvo ESCUELA DE POSGRADO,
que pasa 0 de 115**. Ésa sí es una exclusión declarada.

### Los criterios de 2025, ahora exactos

Aplicados al catálogo de 5.262, reproducen un universo del mismo orden que el
nuestro:

| Paso | Aulas |
|---|---:|
| Catálogo de cursos-horario únicos | 5.262 |
| + presencial | 4.624 |
| + tipo teórico | 3.699 |
| + **nivel del curso fuera de {1, 11, 12}** | 3.539 |
| + **matriculados ≥ 10** | 3.046 |
| + sin ESCUELA DE POSGRADO | **2.931** |
| *(nuestro marco incluido hoy)* | *2.468* |

- **Nivel 1: 119 en el pool, 0 en las 1.097.** Los niveles 11 y 12 (41 aulas)
  tampoco entran. El nivel 1 del CURSO sí se excluyó del marco.
- **Matriculados**: dentro el mínimo es 10 y fuera es 1; mediana 34 contra 25.
- El **tipo de docente NO es criterio**: entre las 1.097 hay 12 asociados,
  7 auxiliares, 35 jefes de práctica y 1 visitante. (El libro de 2025 sólo
  publica dos categorías para esas mismas aulas: sus dos fuentes discrepan.)
- La **condición del curso** viene vacía en el 98 % del catálogo.

### Contradicción con un criterio que ya implementamos

Gonzalo indicó que «posgrado y escuela de estudios especiales se excluyen por
completo», y así está hoy en `excluded_faculties`. Pero **2025 excluyó sólo
Posgrado**: la ESCUELA DE ESTUDIOS ESPECIALES aportó **61 aulas** al pool
sorteado, al mismo 34 % que las demás. Si el criterio de 2026 debe coincidir con
2025, esa segunda exclusión sobra; si es una decisión nueva, entonces la
comparación con 2025 no puede cerrar por ahí. **Es decisión de Gonzalo.**

### Lo que sigue sin cerrar

Con el marco corregido a 2.931 la regla `CEIL(sobremuestra / mín(mediana, media))`
sigue dando **126 aulas contra las 170 reales**, exactas en 5 de 15. R4 continúa
abierto: ni el marco de 1.097 ni el de 2.931 lo explican.

## R10 · La vara de 170–210 aulas · **sólo p25 la cumple**

**Encargo de Gonzalo (2026-08-17), textual**: «teniendo todos estos criterios, lo
normal es que salgan entre **ciento setenta a doscientos diez aulas**, en
principio no más. Eso es lo primero que quiero comprobar ahora que se puede
hacer, y que la interfaz muestra también».

Medido sobre el proyecto real con la cuota de universidad (2.500) y el
estadístico **truncado hacia abajo**, como pide: `aulas = ⌈cuota / (⌊est⌋ × τ)⌉`
con τ = 0,53.

| Facultad | Disponibles | Elegibles | Cuota | media | mediana | mín(md,me) | p25 | → media | → mediana | → mín | → **p25** |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| CIENCIAS E INGENIERIA | 849 | 592 | 530 | 32 | 32 | 32 | 24 | 32 | 32 | 32 | **42** |
| EG CIENCIAS | 496 | 319 | 393 | 40 | 40 | 40 | 27 | 19 | 19 | 19 | **28** |
| EG LETRAS | 482 | 330 | 389 | 43 | 46 | 43 | 34 | 18 | 16 | 18 | **22** |
| DERECHO | 575 | 440 | 347 | 38 | 41 | 38 | 37 | 18 | 16 | 18 | **18** |
| CIENCIAS SOCIALES | 236 | 169 | 151 | 27 | 28 | 27 | 21 | 11 | 11 | 11 | **14** |
| ARQUITECTURA | 144 | 56 | 126 | 35 | 28 | 28 | 22 | 7 | 9 | 9 | **11** |
| ARTE Y DISEÑO | 320 | 63 | 119 | 24 | 21 | 21 | 18 | 10 | 11 | 11 | **13** |
| GESTIÓN | 184 | 119 | 115 | 33 | 36 | 33 | 29 | 7 | 7 | 7 | **8** |
| CIENCIAS Y ARTES COMUN. | 210 | 162 | 97 | 21 | 22 | 21 | 20 | 9 | 9 | 9 | **10** |
| PSICOLOGÍA | 131 | 100 | 79 | 24 | 25 | 24 | 23 | 7 | 6 | 7 | **7** |
| ARTES ESCÉNICAS | 454 | 45 | 69 | 20 | 17 | 17 | 16 | 7 | 8 | 8 | **9** |
| LETRAS Y CIENCIAS HUMANAS | 149 | 16 | 26 | 16 | 16 | 16 | 15 | 4 | 4 | 4 | **4** |
| EDUCACION | 73 | 19 | 23 | 23 | 23 | 23 | 17 | 2 | 2 | 2 | **3** |
| CONTABLES | 44 | 19 | 21 | 27 | 27 | 27 | 23 | 2 | 2 | 2 | **2** |
| GASTRONOMÍA | 54 | 17 | 15 | 20 | 19 | 19 | 18 | 2 | 2 | 2 | **2** |
| **Total** | | | **2.500** | | | | | **155** | **154** | **159** | **193** |

**Respuesta**: con los criterios de hoy la vara **sí se puede cumplir, pero sólo
con p25 (193 aulas)**. Los otros tres métodos se quedan cortos —media 155,
mediana 154, mín(mediana, media) **159**—, por debajo del piso de 170. La
elección de método no es un detalle: mueve el total un **21 %**.

ESCUELA DE POSGRADO aparte: **852 aulas disponibles y 2 elegibles**, o sea la
exclusión por facultad sigue dejando pasar dos.

### Lo que falta para cumplir el encargo completo

Gonzalo pidió cinco cosas explícitas «tanto en la interfaz usuaria como ahora»:

1. **Aulas disponibles por facultad** — el motor las tiene; la UI no las publica
   junto a las elegibles.
2. **Aulas elegibles por facultad** — se ven en el marco, pero no al lado de las
   disponibles ni del resto de la cadena.
3. **Cuántos hombres y mujeres por facultad** — existe en `distribucion_sub`;
   sin superficie propia (es la deuda de UI ya anotada).
4. **Tabla comparativa de métodos** para elegir el estadístico — **no existe ni
   en el motor ni en la UI**. Es la tabla de arriba y hay que construirla.
5. **Aulas requeridas con el estadístico truncado y entero** — el truncado lo
   apliqué yo a mano en esta medición; **queda por verificar si el motor trunca
   o redondea**, y forzarlo si no.

Y dos criterios que él considera de distinto rango:

- **Generales para todas las facultades**: presencialidad y **tipo de docente**.
  Retiro mi recomendación anterior de quitar el criterio de tipo de docente: lo
  que hay que arreglar es que hoy guarda **nombres** en 4.979 de 5.263 aulas.
- **Variables por facultad**: el **tipo de sesión**, porque en Arquitectura y
  Arte y Diseño el taller concentra más clases y más alumnos, y hay que quedarse
  con los cursos con más probabilidad de tener alumnos presentes. Ese mecanismo
  **ya existe** —`exceptions` por facultad con `add`/`replace`, cerrado en E11
  (`505c5043`)— y ahora se puede declarar de verdad porque `session_type` ya se
  lee (`98784020`).
- **Descarte fino curso-horario a curso-horario** —los talleres de tesis, que son
  presenciales pero difusos—: por comprobar si existe como superficie.

## R11 · Comparativo histórico por facultad — de NÚMEROS y de MÉTODO

**Encargo de Gonzalo (2026-08-17), textual**: las fichas por facultad «son
información fundamental» y hay que llevarlas a la UI, pero **antes** de
implementarlas hay que complementarlas «con el comparativo histórico del estudio
pasado, porque nos permite ver si estos criterios daban lo mismo ese año (o si se
aplicaron los mismos criterios también). **Es un comparativo no sólo de números
sino de método**».

### El método, criterio a criterio

Esta tabla es la que faltaba: sin ella una diferencia de aulas parece un error
del motor cuando es una decisión distinta.

| Decisión | 2025 ejecutado | 2026 hoy | ¿Coinciden? |
|---|---|---|---|
| Modalidad | presencial, 100 % del pool | presencial | **sí** |
| Tipo de curso | teórico, 100 % del pool | teórico | **sí**, pero recién declarable (`98784020`) |
| Tipo de docente | **NO fue criterio**: en las 1.097 hay 12 asociados, 7 auxiliares, 35 jefes de práctica y 1 visitante | criterio **general** por decisión de Gonzalo | **no** |
| Nivel / ciclo | del **CURSO**, fuera de {1, 11, 12} | del **ALUMNO**, capa marco | **no** — y es lo que hunde a EE.GG. Letras |
| Mínimo por aula | **matriculados ≥ 10** | **elegibles ≥ 15**, y ahora declarable por facultad | **no** — 449 aulas de diferencia |
| Posgrado | excluido | 0 aulas incluidas, pero **`excluded_faculties` está vacío**: sale por rebote, no declarado (H11) | de hecho sí, de derecho no |
| Estudios Especiales | **incluida**, 61 aulas al pool | **excluida** por decisión de 2026 | **no**, deliberado |
| Estadístico por CH | mín(mediana, media) **con el factor de respuesta ya dentro** | **p25** con τ = 0,53 **fuera** | equivalente en forma, distinto en valor |
| n de diseño | 2.500 **fijada** (fórmula 2.381) | 2.500 **fijada** (fórmula 2.304) | **sí**, mismo redondeo hacia arriba |
| Sobremuestra | ×1,5 = 3.750 | ×1,5 = 3.750 | **sí** |
| Selección | **sistemático, k = N/n** | **cube balanceado** (`balanced_probability`) | **no** |
| Reservas | Titular + hasta 11, pero **sólo 16 estratos de 170 llegaron a la 11** | 11 pedidas a todas por igual | **no** — es M10 |

### ¿2025 aplicó criterios distintos POR FACULTAD?

Gonzalo, textual: «esta tabla que me muestras es general, y los criterios no son
generales, son por facultad». Medido sobre el pool de 2025, facultad a facultad:

| Facultad | Sorteadas | Universo | Piso real | Bajo el piso | % perdido |
|---|---:|---:|---:|---:|---:|
| CIENCIAS E INGENIERIA | 231 | 697 | 10 | 42 | 6 |
| DERECHO | 184 | 399 | 11 | 5 | 1 |
| EG LETRAS | 181 | 478 | 11 | 10 | 2 |
| EG CIENCIAS | 111 | 354 | 11 | 2 | 1 |
| CIENCIAS Y ARTES COMUN. | 63 | 178 | 13 | 15 | 8 |
| ESTUDIOS ESPECIALES | 61 | 199 | 12 | 28 | 14 |
| CIENCIAS SOCIALES | 52 | 148 | 10 | 9 | 6 |
| **ARTES ESCÉNICAS** | 43 | 323 | 10 | **208** | **64** |
| PSICOLOGÍA | 39 | 92 | 11 | 2 | 2 |
| ARTE Y DISEÑO | 33 | 90 | 10 | 7 | 8 |
| ARQUITECTURA | 29 | 66 | 16 | 5 | 8 |
| GESTIÓN | 26 | 103 | 19 | 9 | 9 |
| **GASTRONOMÍA** | 17 | 51 | 10 | 18 | **35** |
| **LETRAS Y CIENCIAS HUMANAS** | 9 | 85 | 10 | **45** | **53** |
| CONTABLES | 8 | 16 | 21 | 2 | 12 |
| **EDUCACION** | 8 | 39 | 11 | 15 | **38** |
| CONSORCIO DE UNIVERSIDADES | 2 | 7 | 21 | 1 | 14 |

`piso real` = el aula más pequeña que entró · `bajo el piso` = aulas del universo
comparable por debajo de ese piso que nunca entraron.

**Conclusión, y hay que decirla con cuidado.** El piso *declarado* de 2025 parece
haber sido **uno solo: 10**. Once de diecisiete facultades tienen su aula más
chica entre 10 y 13, y las cuatro que aparecen más arriba —Arquitectura 16,
Gestión 19, Contables 21, Consorcio 21— tienen muy pocas aulas por debajo (5, 9,
2 y 1) sobre 29, 26, 8 y 2 sorteadas: **es compatible con el azar del sorteo, no
con un umbral propio**. Un piso alto observado en una facultad chica no prueba
un criterio; probarlo exigiría el papel de 2025, que no lo declara.

**Pero el dato que importa es el otro, y respalda la decisión de Gonzalo**: un
piso general de 10 tiene un efecto **radicalmente distinto** en cada facultad. Se
lleva el **64 %** del universo de Artes Escénicas, el **53 %** de Letras y
Ciencias Humanas, el **38 %** de Educación y el **35 %** de Gastronomía — contra
el **1 %** de Derecho y EE.GG. Ciencias. La misma regla arrasa a unas y no toca a
otras. Ésa es la razón operativa de que el mínimo tenga que declararse por
facultad, y no una preferencia de estilo.

**Tipo de sesión**: en 2025 el pool es teórico al **100 % en todas las
facultades**, así que ahí **no hubo excepciones por facultad**. La necesidad de
abrir taller en Arquitectura y Arte y Diseño es una decisión **nueva** de 2026,
no una réplica.

### Los números, quince filas

`cuo` = cuota · `pool25` = aulas del sorteo 2025 · `elig26` = aulas que pasan los
criterios hoy · `med25` = mediana de elegibles en las titulares de 2025 ·
`p25` = primer cuartil de hoy · `tit` = aulas titulares.

| Facultad | cuo 25 | cuo 26 | pool 25 | elig 26 | med 25 | p25 26 | tit 25 | tit 26 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| CIENCIAS E INGENIERIA | 523 | 530 | 271 | 571 | 28,0 | 24 | 39 | 42 |
| EG CIENCIAS | 424 | 393 | 80 | 278 | 39,0 | 24 | 25 | 31 |
| **EG LETRAS** | 435 | 389 | 135 | **12** | 48,0 | 15 | 19 | **49** |
| DERECHO | 286 | 347 | 203 | 422 | 41,0 | 35 | 16 | 19 |
| CIENCIAS SOCIALES | 148 | 151 | 79 | 145 | 30,0 | 20 | 15 | 15 |
| ARQUITECTURA | 123 | 126 | 31 | 50 | 34,5 | 24 | 6 | 10 |
| ARTE Y DISEÑO | 117 | 119 | 34 | 55 | 18,0 | 17 | 9 | 14 |
| GESTIÓN | 114 | 115 | 40 | 102 | 33,0 | 26 | 6 | 9 |
| CIENCIAS Y ARTES COMUN. | 95 | 97 | 76 | 150 | 24,0 | 20 | 10 | 10 |
| PSICOLOGÍA | 77 | 79 | 45 | 87 | 24,5 | 23 | 6 | 7 |
| ARTES ESCÉNICAS | 70 | 69 | 44 | 38 | 15,0 | 15 | 7 | 9 |
| LETRAS Y CIENCIAS HUMANAS | 25 | 26 | 12 | 12 | 12,5 | 15 | 4 | 4 |
| EDUCACION | 26 | 23 | 14 | 13 | 14,0 | 19 | 4 | 3 |
| CONTABLES | 21 | 21 | 13 | 15 | 27,0 | 22 | 2 | 2 |
| GASTRONOMÍA | 16 | 15 | 20 | 11 | 17,0 | 15 | 2 | 2 |
| **Total** | **2.500** | **2.500** | **1.097** | **1.961** | | | **170** | **226** |

**Lo que dice la comparación.** El reparto de la cuota es casi el mismo —las dos
suman 2.500 y trece de quince facultades quedan a ±5— así que **la afijación
proporcional por facultad × sexo reproduce 2025 sin tocar nada**. Las tres que se
mueven son EE.GG. Letras (435 → 389), EE.GG. Ciencias (424 → 393) y Derecho
(286 → 347), y salen de que la población de cada facultad cambió entre semestres,
no del método.

En titulares, **170 contra 226**. Pero 49 de esos 226 son EE.GG. Letras con un
marco de 12 aulas: **sin esa fila el total es 177**, dentro de la vara de 170–210
y a siete aulas de las 170 de 2025. La diferencia real del recorrido no es el
cálculo: es el criterio de primer ciclo.

### La ficha por facultad, seis pasos

Es lo que hay que llevar a la UI, con la columna de 2025 al lado de cada paso.
Medida para LETRAS Y CIENCIAS HUMANAS sobre el marco reconstruido:

1. **Población** — N = 225 alumnos únicos (97 hombres, 128 mujeres).
2. **Muestra** — cuota 26 (11 H, 15 M) · sobremuestra ×1,5 = 39.
3. **Aulas del marco** — 149 en el catálogo → **12 pasan los criterios**.
4. **Alumnos por curso-horario** — p25 = 15 · mediana 16 · mín(md,me) 16 · 198
   plazas.
5. **Aulas necesarias** — **4** con τ sobre la cuota; **3** contra la sobremuestra
   sin τ. *(Los dos caminos son defendibles y dan distinto: hay que fijar cuál es
   el oficial.)*
6. **Margen** — 12 − 4 = 8 sobrantes → **2 reservas por titular**.

Contraste: CIENCIAS E INGENIERIA da 42 titulares y **12 reservas** por titular;
EE.GG. LETRAS necesitaría 49 y tiene 12 aulas, **−37**: no le alcanza ni para los
titulares.

## R6 · Nuestro embudo contra el de 2025 · las 511 que faltan, explicadas

Reconstruido el embudo de 2025 sobre el catálogo y cruzado con nuestro marco:
**2.420 aulas están en los dos**, 511 nos faltan y 48 nos sobran.

| Facultad (del curso) | 2025 | Nuestro | Ambos | Faltan | Sobran |
|---|---:|---:|---:|---:|---:|
| CIENCIAS E INGENIERIA | 655 | 550 | 550 | 105 | 0 |
| EG LETRAS | 470 | 369 | 369 | 101 | 0 |
| DERECHO | 395 | 396 | 381 | 14 | 15 |
| EG CIENCIAS | 352 | 343 | 318 | 34 | 25 |
| ESCUELA DE ESTUDIOS ESPECIALES | 179 | 135 | 135 | 44 | 0 |
| CIENCIAS Y ARTES COMUN. | 168 | 150 | 150 | 18 | 0 |
| CIENCIAS SOCIALES | 139 | 115 | 115 | 24 | 0 |
| ARTES ESCÉNICAS | 115 | 49 | 49 | 66 | 0 |
| GESTIÓN | 101 | 94 | 94 | 7 | 0 |
| PSICOLOGÍA | 90 | 82 | 82 | 8 | 0 |
| ARTE Y DISEÑO | 83 | 60 | 60 | 23 | 0 |
| ARQUITECTURA | 64 | 58 | 53 | 11 | 5 |
| LETRAS Y CIENCIAS HUMANAS | 40 | 14 | 14 | 26 | 0 |
| GASTRONOMÍA | 33 | 20 | 20 | 13 | 0 |
| EDUCACION | 25 | 10 | 10 | 15 | 0 |
| CONTABLES | 16 | 14 | 14 | 2 | 0 |
| CONSORCIO DE UNIVERSIDADES | 6 | 6 | 6 | 0 | 0 |
| **Total** | **2.931** | **2.465** | **2.420** | **511** | **45** |

**Las 511 tienen dos causas y ninguna es un misterio**, leídas del propio
`exclude_reason`:

- **449 por el mínimo de elegibles**: nuestro `min_eligible_per_class` es **15** y
  2025 usó **matriculados ≥ 10**. De ellas, **308 caen justo en la franja 10–14**.
- **80 por el criterio de tipo de docente**, que **2025 no tenía**.

Las 45 que nos sobran son de Derecho, EE.GG. Ciencias y Arquitectura, y salen de
que nuestro marco atribuye la facultad por otra vía (R9).

## R4 · **Por qué salen ~130 y no ~170** · mecanismo identificado

La regla declarada es `CEIL(sobremuestra / estudiantes_por_aula)`. Aplicándola
con el mín(mediana, media) **crudo** de elegibles salen 133 (marco de 1.097) o
126 (marco de 2.931). Faltan ~40.

La plantilla de Kamila permite ver por qué, porque tiene las dos cifras juntas:
su `Aulas_objetivo` por facultad y los `Alumnos_elegibles` reales de las aulas
que eligió. El `est` que su propia regla usa es **la mitad** de los elegibles que
esas aulas tienen de verdad:

| Facultad | Objetivo | Sobremuestra | est implícito | Elegibles reales por aula | **Factor** |
|---|---:|---:|---:|---:|---:|
| CIENCIAS E INGENIERIA | 37 | 792 | 21,4 | 41,0 | **0,52** |
| DERECHO | 21 | 521 | 24,8 | 42,7 | **0,58** |
| EG LETRAS | 24 | 584 | 24,3 | 54,4 | **0,45** |
| EG CIENCIAS | 21 | 589 | 28,0 | 57,3 | **0,49** |
| ARQUITECTURA | 11 | 190 | 17,3 | 45,6 | 0,38 |
| CIENCIAS Y ARTES COMUN. | 10 | 146 | 14,6 | 26,2 | **0,56** |
| CIENCIAS SOCIALES | 13 | 226 | 17,4 | 39,9 | 0,44 |
| PSICOLOGÍA | 7 | 118 | 16,9 | 25,0 | 0,68 |

**Mediana ≈ 0,5 — y nuestro τ es 0,53.** Es decir: el `estudiantes_por_aula` de
la regla de 2025 **ya lleva dentro un factor de respuesta/asistencia**, y nuestro
motor lo saca fuera y lo llama τ. Mi replicación daba 133 porque aplicaba la
regla con la cifra bruta, sin ese factor. **La fórmula del motor y la de 2025 son
la misma**; lo que cambia es dónde vive el factor.

Queda una diferencia real que no es de fórmula: **la selección ejecutada supera
al objetivo calculado, y más en las facultades grandes.** En la propia plantilla
de Kamila, sobre la misma base: 200 titulares elegidos contra 189 de objetivo, y
por facultad Derecho **33 contra 21**, Ciencias e Ingeniería **42 contra 37**,
mientras Arte y Diseño se queda en **5 contra 14** y Educación en **2 contra 6**.
Su hoja nombra parte del mecanismo: hay una etapa marcada
**«censo: pool < objetivo»** —cuando el pool de una facultad no alcanza el
objetivo se toman todas— que produce 21 titulares y 63 reemplazos.

## R4b · La plantilla de cálculo de Kamila

`~/Documents/Pulso/HSTVG2026/Informe completo - Kamila/Calculos Muestrales.xlsx`
es la plantilla de dimensionamiento hecha a mano con la metodología de 2025 para
planificar 2026 — **sobre la misma base de 2025**, según la corrección de arriba.
Lo confirma su hoja `1_Parametros`:
población total **21.365**, que es exactamente nuestra cifra; y su hoja
`4_Muestra_Aulas` reproduce las quince facultades con las mismas poblaciones por
sexo que mide nuestro motor (Arquitectura 744 M / 336 H, Arte y Diseño 792 / 229,
Ciencias e Ingeniería 1.127 / 3.385, Derecho 1.933 / 1.036, EE.GG. Ciencias
951 / 2.404, EE.GG. Letras 1.932 / 1.395 — coincidencia exacta en las quince).

**De aquí salen las «~190 aulas»**: `Aulas_objetivo` suma **189** y
`Aulas_a_visitar` suma **203**, contra las **170** que ejecutó 2025 sobre el
mismo dato. Tres lecturas del mismo semestre que deberían coincidir.

| Facultad | Población | Muestra | Sobremuestra | Aulas del universo | **Objetivo** | **A visitar** | est implícito | **Motor hoy** |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| CIENCIAS E INGENIERIA | 4.512 | 528 | 792 | 104 | 37 | 38 | 21,4 | 49 |
| EG LETRAS | 3.327 | 389 | 584 | 444 | 24 | 25 | 24,3 | 47 |
| DERECHO | 2.969 | 347 | 521 | 112 | 21 | 22 | 24,8 | 46 |
| EG CIENCIAS | 3.355 | 392 | 589 | 355 | 21 | 22 | 28,0 | 47 |
| ARTE Y DISEÑO | 1.021 | 120 | 179 | 15 | 14 | 15 | 12,8 | 35 |
| CIENCIAS SOCIALES | 1.287 | 151 | 226 | 27 | 13 | 14 | 17,4 | 38 |
| ARQUITECTURA | 1.080 | 126 | 190 | 34 | 11 | 12 | 17,3 | 36 |
| CIENCIAS Y ARTES COMUN. | 832 | 97 | 146 | 45 | 10 | 11 | 14,6 | 33 |
| GESTIÓN | 986 | 115 | 173 | 16 | 8 | 9 | 21,6 | 35 |
| ARTES ESCÉNICAS | 590 | 69 | 104 | 27 | 7 | 8 | 14,9 | 28 |
| PSICOLOGÍA | 673 | 79 | 118 | 28 | 7 | 8 | 16,9 | 30 |
| EDUCACION | 197 | 24 | 35 | 6 | 6 | 6 | 5,8 | 14 |
| LETRAS Y CIENCIAS HUMANAS | 225 | 26 | 39 | 42 | 5 | 6 | 7,8 | 16 |
| CONTABLES | 183 | 21 | 32 | 7 | 3 | 4 | 10,7 | 14 |
| GASTRONOMÍA | 128 | 16 | 22 | 8 | 2 | 3 | 11,0 | 10 |
| **Total** | **21.365** | **2.500** | **3.750** | **1.270** | **189** | **203** | | **478** |

### Las dos divergencias que esto destapa

**1. El motor pide 478 aulas donde la plantilla pide 189** — dos veces y media.
No es un error de ninguno de los dos: son **dos diseños distintos**. La plantilla
reparte **un solo n de universidad (2.500) proporcionalmente** entre las quince
facultades; nuestro componente «por facultad» dimensiona **cada facultad como
estrato propio con su propio margen de error**, y por eso su n sube a 4.986.
El componente de universidad de nuestro motor, que sí es comparable, pide
**177 aulas base** contra las 189 de la plantilla — 6 % de diferencia.

**2. El universo de aulas por facultad no se parece.** La plantilla cuenta 1.270
aulas y nosotros 2.468 incluidas, pero lo llamativo no es el total sino el
reparto: para la plantilla, EE.GG. Letras y EE.GG. Ciencias son el **63 %** del
universo (444 y 355); para nuestro marco son el 26 % (330 y 319), y mandan
Ciencias e Ingeniería (592) y Derecho (440). Al revés en las chicas: Gestión
tiene 16 aulas para la plantilla y 119 para nosotros; Letras y Ciencias Humanas
42 para la plantilla y 16 para nosotros. **Es un problema de atribución de
facultad, no de filtros**, y es lo siguiente que hay que explicar.

El estadístico implícito de la plantilla —sobremuestra ÷ objetivo— queda en
0,5–0,7 veces la mediana de nuestro marco, lo que encaja con que el
mín(mediana, media) se calculara sobre un conjunto de aulas más grande y con
secciones más pequeñas.

### Y aparece el catálogo completo

`Informe completo - Kamila/Muestreo Hostigamiento.xlsx` trae la hoja
`CURSO Y HORARIO` con **23.133 cursos-horario** —el catálogo sin filtrar— y
`MATRICULADO` con **136.284 filas**, que es exactamente el número de matrículas
de nuestro marco. Con eso se puede reconstruir el embudo completo y comprobar
qué recorta cada criterio, que es lo que R5 y R6 necesitan.

## R6 — el estadístico por facultad. CERRADO

La comparación con 2025 se rescató del propio `.pulso` de Gonzalo (`73f3a0f8`):
la dimensión `facultad` de su referencia de asistencia guarda las aulas medidas
y sus matriculados, y de ahí sale el **alumnos por curso-horario de 2025**. Al
enfrentarlo con nuestro marco aparecieron cuatro divergencias grandes. Ninguna
era un defecto del motor: **eran dos errores de comparación míos**.

### Primer error: su media contra nuestra mediana

2025 publica `matriculados ÷ aulas medidas`, que es una **media**. Yo lo
comparaba contra nuestra **mediana**. Con media contra media, dos de las cuatro
divergencias se caen solas:

| Facultad | 2025 | nuestra mediana | Δ | nuestra media | Δ |
|---|---|---|---|---|---|
| ARQUITECTURA | 38,1 | 28,0 | −10,1 | 35,2 | **−2,9** |
| ARTE Y DISEÑO | 27,2 | 21,0 | −6,2 | 24,7 | **−2,5** |

### Segundo error: sus matriculados contra nuestros elegibles

Quedaban los dos Estudios Generales, y la explicación es que 2025 promedia
**matriculados** mientras nosotros promediamos **elegibles** —que descuentan el
traslape—. Medido en las quince facultades, desvío medio absoluto contra 2025:

- sobre **matriculados**: **2,41** alumnos por aula (sesgo +1,27)
- sobre **elegibles**: 3,12 (sesgo −2,51)

EE.GG. Ciencias pasa de −19,0 a **−4,2** y EE.GG. Letras de −11,5 a **+1,8**.

El ajuste no es uniforme: en las facultades chicas —EDUCACIÓN +7,7, GASTRONOMÍA
+6,1 sobre matriculados— el que acierta es el de elegibles. Es coherente: donde
casi no hay traslape ambas cifras convergen, y donde lo hay, 2025 estaba
contando gente que ya no era encuestable. **No es que un estimador sea el
correcto: son dos magnitudes distintas**, y el de 2025 es optimista en las
facultades grandes.

### Lo que queda dicho para R4

2025 dimensionó sobre matriculados y nosotros sobre elegibles. Con la misma
cuota, elegibles siempre exige MÁS aulas — que es la dirección exacta del
478 contra 189.

## El primer cuartil da 193 aulas

Gonzalo: «usamos por defecto el primer cuartil, lo cual no me parece una mala
indicación, tengo entendido que nos da aproximadamente 194 cursos-horario».
Medido sobre su marco, con cuota proporcional de 2.500 y τ = 0,53:

| Estadístico | Aulas |
|---|---|
| **p25** | **193** |
| mín(mediana, media) | 159 |
| media | 155 |
| mediana | 154 |

Su cifra era exacta, y 193 cae dentro de la banda que él fijó —«entre 170 y 210,
en principio no más»—, junto a las **194 aulas aplicadas** de 2025 y a las
**203 a visitar** de la plantilla de Kamila. Los otros tres estadísticos se
quedan cortos.

Por facultad, contra el objetivo de la plantilla de Kamila:

| Facultad | p25 | aulas p25 | Kamila |
|---|---|---|---|
| CIENCIAS E INGENIERIA | 24 | 42 | 37 |
| EE.GG. CIENCIAS | 27 | 28 | 21 |
| EE.GG. LETRAS | 34 | 22 | 24 |
| DERECHO | 37 | 18 | 21 |
| CIENCIAS SOCIALES | 21 | 14 | 13 |
| ARTE Y DISEÑO | 18 | 13 | 14 |
| ARQUITECTURA | 22 | 11 | 11 |
| CIENCIAS Y ARTES COMUN. | 20 | 10 | 10 |
| ARTES ESCÉNICAS | 16 | 9 | 7 |
| GESTIÓN | 29 | 8 | 8 |
| PSICOLOGÍA | 23 | 7 | 7 |
| LETRAS Y C. HUMANAS | 15 | 4 | 5 |
| EDUCACIÓN | 17 | 3 | 6 |
| CONTABLES | 23 | 2 | 3 |
| GASTRONOMÍA | 18 | 2 | 2 |
| **TOTAL** | | **193** | **189** |

Once de quince quedan a una aula o menos. Las que se separan son EE.GG. Ciencias
(+7), CIENCIAS E INGENIERIA (+5) y EDUCACIÓN (−3).

**PENDIENTE**: comprobar qué estadístico usa hoy el motor por defecto. Las
cifras del recorrido —avg 28 en el componente universidad y avg 20 en el de
facultad— no son p25, así que o el default es otro o la configuración vigente lo
sobreescribe.

## R16 — la vara definitiva de Gonzalo, y qué falta para cumplirla

Textual: «para mi proyecto yo necesito aplicar los mismos criterios que en 2025
en prácticamente todo, con la diferencia del cálculo de alumnos elegibles por
curso-horario, que sí usamos el primer cuartil».

Eso deja de ser una comparación y pasa a ser una **configuración objetivo**.
Medida contra lo que su proyecto tiene hoy:

| Decisión | 2025 | Su proyecto hoy | ¿Coincide? |
|---|---|---|---|
| Estadístico por curso-horario | mín(mediana, media) | media | **p25 — la diferencia querida** |
| Muestra n | 2.500 fijada | — | por fijar |
| Sobremuestra | ×1,5 (50 %) | 20 % | **no** |
| p | 0,30 | 0,5 | **no** |
| Error e | 2,46 % | 5 % | **no** |
| deff | 2,0 | 1,5 | **no** |
| Método de selección | sistemático k = N/n | cube balanceado | **no** |
| Presencial | sí | sí | sí |
| Tipo de sesión teórico | sí | **imposible: columna vacía** | **bloqueado** |
| Nivel del curso fuera de {1,11,12} | sí | no recorta el marco | **no** |
| Matriculados ≥ 10 | sí | mínimo de elegibles 15 | **no** |
| Sin posgrado | sí | sí | sí |
| Tipo de docente | **no fue criterio** | contratado/ordinario | **no** |

### El bloqueo: el criterio que definía el marco de 2025 no se puede declarar

Al reconstruir el embudo de 2025 sobre su marco, el paso de «teórico» da **cero
aulas**. No es que no haya teóricos: `session_type` llega **vacía en las 5.263
filas**. Su `.pulso` tiene congelado el mapeo viejo —`session_type, tipo_sesion,
tipo_clase, actividad`— y el catálogo trae la columna **`Tipo de curso`**.

Es exactamente la causa raíz reparada en `9125e39f`: el `.pulso` guarda la lista
de candidatos por defecto del motor **como si fuera un mapeo del usuario**, así
que ampliar los defaults nunca alcanzaba a los proyectos ya creados.

**Verificado que la reparación lo desbloquea**: `.cm_aulas_mapeo_es_copia_de_defaults`
devuelve `TRUE` para los dos mapeos guardados de su proyecto, y
`.cm_aulas_config_mapping` con las columnas del catálogo real resuelve
`session_type → …, tipo_curso, tipo_de_curso, tipo de curso`. **Falta
reconstruir el marco** para que la columna se pueble.

Segundo mapeo tomado: `teacher_type` trae **nombres de docente** en 4.979 de
5.263 filas. Como en 2025 el tipo de docente **no fue criterio**, esto no bloquea
la replicación, pero sí invalida cualquier filtro por tipo de docente mientras
siga así.

### Embudo medido sobre su marco, hasta donde se puede

| Paso | 2025 | Su marco hoy |
|---|---|---|
| catálogo | 5.262 | 5.263 |
| presencial | 4.624 | 5.136 |
| + teórico | 3.699 | **0 — columna vacía** |

La diferencia en presencial —5.136 contra 4.624— también pide explicación: 2025
excluía más modalidades de las que excluimos hoy.

## R17 — el marco reconstruido, y las 195 aulas. DESBLOQUEADO

Reconstruido el marco en el duplicado con el código actual: **`session_type`
pasó de 0 a 5.263 de 5.263** filas con dato —TEORICO 4.265, TALLER 315,
SEMINARIO 273, LABORATORIO 205, CURSO DE INVESTIGACIÓN 65, ASESORÍA 62,
ACTIVIDAD 34, ARTISTICO 22—. La reparación `9125e39f` sí alcanza a un proyecto
ya creado en cuanto se reconstruye el marco. El marco vigente pasó de 2.468 a
**2.364** cursos-horario elegibles.

### El embudo de 2025, ahora comparable paso a paso

| Paso | 2025 | Nosotros | Δ |
|---|---|---|---|
| catálogo | 5.262 | 5.263 | +1 |
| presencial | 4.624 | 5.136 | **+512** |
| + teórico | 3.699 | 4.151 | +452 |
| + nivel fuera de {1,11,12} | 3.539 | 3.361 | −178 |
| + matriculados ≥ 10 | 3.046 | 2.716 | −330 |
| + sin posgrado | 2.931 | 2.519 | −412 |

La primera diferencia se explica sola: nuestro filtro deja pasar
**SEMIPRESENCIAL** (219 aulas). Con presencial estricto quedan 4.917, a 293 de
2025. El resto de la brecha viaja arrastrada desde ahí.

### Con los criterios de 2025 y p25: **195 aulas**

Cuota proporcional de 2.500 con sobremuestra ×1,5, y la regla de 2025
—`CEIL(sobremuestra / estadístico)`, **sin τ**—:

| Facultad | elegibles | p25 | cuota | aulas |
|---|---|---|---|---|
| CIENCIAS E INGENIERIA | 697 | 20 | 792 | 40 |
| EE.GG. LETRAS | **20** | 17 | 584 | **35 — no alcanzan** |
| EE.GG. CIENCIAS | 300 | 26 | 589 | 23 |
| DERECHO | 423 | 31 | 521 | 17 |
| CIENCIAS SOCIALES | 198 | 18 | 226 | 13 |
| ARTE Y DISEÑO | 92 | 14 | 179 | 13 |
| ARQUITECTURA | 60 | 20 | 190 | 10 |
| ARTES ESCÉNICAS | 115 | 11 | 104 | 10 |
| GESTIÓN | 151 | 24 | 173 | 8 |
| CIENCIAS Y ARTES COMUN. | 185 | 19 | 146 | 8 |
| PSICOLOGÍA | 114 | 23 | 118 | 6 |
| LETRAS Y C. HUMANAS | 52 | 11 | 39 | 4 |
| EDUCACIÓN | 49 | 11 | 35 | 4 |
| CONTABLES | 37 | 20 | 32 | 2 |
| GASTRONOMÍA | 22 | 12 | 22 | 2 |
| **TOTAL** | | | | **195** |

**195** contra las **194 aulas aplicadas** de 2025 y las **203 a visitar** de la
plantilla de Kamila, dentro de la banda que fijó Gonzalo. La misma cuenta **con
τ = 0,53 da 360**, muy fuera de banda: para replicar 2025 hay que usar su regla,
sin τ.

### Lo único que no cierra: EE.GG. LETRAS

Con el criterio de nivel de 2025 le quedan **20 aulas elegibles** y necesita
**35**. Es exactamente la decisión que Gonzalo tiene pendiente sobre el primer
ciclo, y ahora tiene su cifra: no es que el marco quede chico, es que **esa
facultad se queda sin marco**.

Estado guardado en `scratchpad/HSVG2026_marco2025.pulso`.

## R20 — configuración objetivo aplicada, y el criterio de nivel no obedece

Aplicada entera sobre el duplicado por API (`POST /api/calc-muestra/marco/construir`
con el config mutado) y reconstruido el marco. Resultado: **2.015 aulas
incluidas**.

| Decisión | Estado |
|---|---|
| Presencial estricto | **ya se cumplía** — las incluidas son 100 % PRESENCIAL |
| Teórico | **ya se cumplía** — 100 % TEORICO |
| Matriculados ≥ 10 | aplicado (`min_eligible_per_class` 15 → 10) |
| Tipo de docente fuera | aplicado — ya no aparece en ninguna razón de exclusión |
| Estadístico p25 | sellado, método aplicado P25 en el total y en las 15 |
| Nivel exento en los dos EE.GG. | **declarado y NO obedecido** |

### El defecto: dos universos de «facultad» con el mismo nombre

La configuración llegó intacta al motor —`estudios_generales_letras:
[{min: 1, max: 99}]`— y aun así EE.GG. LETRAS quedó con **63 de 482** aulas, con
`course_level` como razón en 316 de ellas. De sus aulas de nivel 1, **44 entraron
y 411 salieron**.

La causa: la excepción se declara contra la facultad **del aula** —la que la UI
muestra, modal de su alumnado— pero `.cm_criterios_eval_course_ranges` la evalúa
contra los pares **(facultad del CURSO en el catálogo, nivel)**. Un curso de
Estudios Generales está catalogado bajo la facultad de destino del alumno, así
que el rango que rige no es el de EE.GG. sino el de esa otra facultad, donde el
nivel 1 no pasa. Las 44 que sí entraron son las que conservan un par con EE.GG.
LETRAS como facultad del curso.

**Y hay una segunda trampa encima**: cuando ninguno de los pares de un aula
figura en `courseLevelRanges`, el evaluador devuelve `FALSE` — la excluye. No
declarar una facultad no significa «aquí no aplica»: significa «fuera». Un
nombre mal escrito en la configuración borra una facultad entera en silencio.

### Lo que falta para poder decir lo que Gonzalo quiere

«En los estudios generales letras y ciencias no debería tenerlos» es una regla
sobre la facultad **del aula**, y hoy el criterio de nivel sólo sabe hablar de la
facultad **del curso**. El `op = "exenta"` de `81d84306` resuelve el caso de los
criterios flat/jerárquicos, pero `course_level` es `kind = "range"` y no pasa por
ahí. Falta que la exención valga también para el rango, y decidido contra la
facultad del aula.

## R21 — la exención funciona: 176 aulas con la configuración objetivo. MEDIDO

Reparado el defecto (`46f7c206`) y reconstruido el marco en el duplicado con la
configuración objetivo completa. **Las quince facultades llegan al motor** —antes
guardaba trece— y la exención se aplica:

| | antes | ahora |
|---|---|---|
| EE.GG. LETRAS | 60 | **379** |
| EE.GG. CIENCIAS | 23 | **344** |
| marco total | 1.721 | **2.361** |

### Aulas por facultad, con p25 y la regla de 2025

| Facultad | elegibles | p25 | cuota | aulas | Kamila |
|---|---|---|---|---|---|
| CIENCIAS E INGENIERIA | 573 | 22 | 792 | 36 | 37 |
| EE.GG. LETRAS | 379 | 24 | 584 | 25 | 24 |
| EE.GG. CIENCIAS | 344 | 26 | 589 | 23 | 21 |
| DERECHO | 339 | 37 | 521 | 15 | 21 |
| CIENCIAS SOCIALES | 122 | 19 | 226 | 12 | 13 |
| ARTE Y DISEÑO | 64 | 15 | 179 | 12 | 14 |
| ARQUITECTURA | 37 | 20 | 190 | 10 | 11 |
| ARTES ESCÉNICAS | 90 | 11 | 104 | 10 | 7 |
| GESTIÓN | 83 | 23 | 173 | 8 | 8 |
| CIENCIAS Y ARTES COMUN. | 140 | 19 | 146 | 8 | 10 |
| PSICOLOGÍA | 89 | 23 | 118 | 6 | 7 |
| LETRAS Y C. HUMANAS | 34 | 11 | 39 | 4 | 5 |
| EDUCACIÓN | 28 | 13 | 35 | 3 | 6 |
| CONTABLES | 18 | 21 | 32 | 2 | 3 |
| GASTRONOMÍA | 20 | 15 | 22 | 2 | 2 |
| **TOTAL** | | | | **176** | **189** |

**176 aulas**, dentro de la banda «entre 170 y 210» que fijó Gonzalo. Ninguna
facultad se queda sin marco y ninguna pide más aulas de las que tiene. Trece de
quince quedan a dos aulas o menos del objetivo de la plantilla de Kamila; se
separan DERECHO (−6) y EDUCACIÓN (−3), y ARTES ESCÉNICAS pide 3 más.

EE.GG. LETRAS pasa a **25 aulas contra las 24 de Kamila** — la facultad que sin
la exención se quedaba sin marco es ahora la que mejor coincide.

### Lo que queda fuera de la cuenta

- **ESCUELA DE ESTUDIOS ESPECIALES** sigue colándose con 1 aula pese a mandar
  `excluded_faculties`: esa clave también se pierde en el camino, probablemente
  por una causa parecida a la del marcador de exención.
- El cálculo usa la cuota proporcional de 2.500 con sobremuestra ×1,5 y la regla
  de 2025 **sin τ**; los parámetros del componente siguen en τ = 0,53,
  sobremuestra 20 %, p 0,5 y deff 1,5.

## R22 — `excluded_faculties` no alcanza a la etiqueta del aula. CONFIRMADO

Con `ESCUELA DE ESTUDIOS ESPECIALES` y `ESCUELA DE POSGRADO` en la lista
—verificado que **la lista sí se guarda** en el config del motor— el aula
`soc254_0731` (curso «Cultura y sociedad», programa de movilidad estudiantil
internacional) **sigue dentro del marco** con 12 elegibles.

Confirmado con una marca: se mandó `min_eligible_per_class = 11` junto con las
exclusiones, la marca llegó al config y el marco bajó de 2.361 a **2.317**. El
frame se rehizo de verdad, así que no es una lectura de un estado viejo — que es
el error que cometí dos veces antes en esta misma sesión.

El filtro `.cm_aulas_facultad_excluida()` opera sobre la facultad **del alumno**;
la etiqueta `faculty` del aula es otra cosa. Es el mismo patrón que ya nos costó
el criterio de nivel: **la facultad del ALUMNO, la del CURSO y la del AULA son
tres cosas distintas con el mismo nombre**, y cada regla tiene que declarar cuál
usa. «Esta unidad no participa del estudio» es una afirmación sobre la unidad,
no sólo sobre sus matriculados.

Escribí el filtro por etiqueta y lo **reverti**: su mutante sobrevive —en un
fixture sin catálogo los alumnos de esa facultad ya la excluyen por la vía de
siempre, y con catálogo no conseguí que la etiqueta del aula difiera de la modal
de sus alumnos—. Queda pendiente reponerlo con una prueba que reproduzca el caso.

Sí quedaron tres tests que fijan lo que hoy funciona (`67b9abdc`), incluido el
control sin el cual el primero pasaría sin medir nada.

### Estado del marco con la configuración objetivo

2.317 aulas (con el mínimo en 11 de la prueba). Aulas con p25 y la regla de 2025:

| Facultad | elegibles | p25 | aulas |
|---|---|---|---|
| CIENCIAS E INGENIERIA | 570 | 22 | 36 |
| EE.GG. CIENCIAS | 341 | 26 | 23 |
| EE.GG. LETRAS | 368 | 28 | 21 |
| DERECHO | 339 | 37 | 15 |
| CIENCIAS SOCIALES | 119 | 19 | 12 |
| ARTE Y DISEÑO | 59 | 16 | 12 |
| ARQUITECTURA | 37 | 20 | 10 |
| ARTES ESCÉNICAS | 81 | 12 | 9 |
| GESTIÓN | 83 | 23 | 8 |
| CIENCIAS Y ARTES COMUN. | 138 | 19 | 8 |
| PSICOLOGÍA | 88 | 23 | 6 |
| LETRAS Y C. HUMANAS | 32 | 12 | 4 |
| EDUCACIÓN | 25 | 14 | 3 |
| CONTABLES | 18 | 21 | 2 |
| GASTRONOMÍA | 18 | 15 | 2 |
| **TOTAL** | | | **171** |

**171 aulas**, dentro de la banda. Con el mínimo en 10 —el de 2025— eran 176.

## R23 — la etiqueta se repara y la configuración objetivo cierra en 177 aulas

`excluded_faculties` **no estaba roto**. Fui a la base de matrícula y el aula
`soc254_0731` tiene 23 alumnos: **11 de CIENCIAS SOCIALES, 11 de ESCUELA DE
ESTUDIOS ESPECIALES y 1 de EE.GG. LETRAS**. Con la unidad excluida, sus once
dejan de ser elegibles y el aula entra con los doce restantes — exactamente los
doce que se veían—. El aula es legítima: hay doce personas encuestables.

Lo que estaba mal era la **etiqueta**, que salía de los 23 matriculados; el
empate 11–11 la rotulaba con la facultad que el diseño acababa de sacar. Ahora
sale de los **elegibles** (`6789d49e`). No cambia qué aulas entran —ni una— pero
sí a qué facultad se atribuyen, que es de lo que cuelgan las cuotas.

Estuve a punto de «arreglarlo» excluyendo el aula por su etiqueta: habría
borrado un aula con doce alumnos encuestables. El mutante que sobrevivió fue lo
que impidió commitearlo.

### La duda de Gonzalo sobre Estudios Generales

«¿Están en estudios generales estos estudiantes? Porque si siguen en estudios
generales son estudiantes de generales, no de la facultad a la que van luego».
Verificado: **la base ya lo distingue**. 9.734 alumnos figuran con Facultad =
Estudios Generales aunque su carrera de destino esté declarada (1.682 Derecho,
1.019 Ingeniería Civil, 964 Informática). Los once de este caso tienen Facultad =
CIENCIAS SOCIALES y carrera Sociología: ya salieron de generales. La atribución
es por facultad **actual**, que es la correcta.

### Configuración objetivo completa: 177 aulas

Marco de **2.362** aulas, con las quince facultades declaradas, las dos escuelas
excluidas y el mínimo en 10. **Ninguna aula rotulada con una facultad excluida.**

| Facultad | elegibles | p25 | aulas | Kamila |
|---|---|---|---|---|
| CIENCIAS E INGENIERIA | 573 | 22 | 36 | 37 |
| EE.GG. CIENCIAS | 345 | 26 | 23 | 21 |
| EE.GG. LETRAS | 377 | 26 | 23 | 24 |
| DERECHO | 339 | 37 | 15 | 21 |
| CIENCIAS SOCIALES | 123 | 18 | 13 | 13 |
| ARQUITECTURA | 38 | 16 | 12 | 11 |
| ARTE Y DISEÑO | 64 | 15 | 12 | 14 |
| ARTES ESCÉNICAS | 90 | 11 | 10 | 7 |
| GESTIÓN | 83 | 23 | 8 | 8 |
| CIENCIAS Y ARTES COMUN. | 140 | 19 | 8 | 10 |
| PSICOLOGÍA | 89 | 23 | 6 | 7 |
| LETRAS Y C. HUMANAS | 34 | 11 | 4 | 5 |
| EDUCACIÓN | 28 | 13 | 3 | 6 |
| CONTABLES | 18 | 21 | 2 | 3 |
| GASTRONOMÍA | 21 | 15 | 2 | 2 |
| **TOTAL** | | | **177** | **189** |

**177 aulas**, dentro de la banda «entre 170 y 210». Doce de quince quedan a dos
aulas o menos del objetivo de la plantilla de Kamila; se separan DERECHO (−6),
EDUCACIÓN (−3) y ARTES ESCÉNICAS (+3).

## R24 — contra lo que 2025 REALMENTE hizo

La plantilla de Kamila es un objetivo de diseño; 2025 declaró **170 titulares** y
terminó **aplicando 194 aulas**. Ésas son las tres varas, y conviene mirarlas
juntas:

| Facultad | realizadas | titulares | nosotros | Kamila | Δ real | Δ titul |
|---|---|---|---|---|---|---|
| CIENCIAS E INGENIERIA | 40 | 39 | 36 | 37 | −4 | −3 |
| EE.GG. CIENCIAS | 26 | 25 | 23 | 21 | −3 | −2 |
| EE.GG. LETRAS | 23 | 19 | 23 | 24 | **0** | +4 |
| CIENCIAS SOCIALES | 17 | 15 | 13 | 13 | −4 | −2 |
| DERECHO | 16 | 16 | 15 | 21 | **−1** | −1 |
| ARTE Y DISEÑO | 12 | 9 | 12 | 14 | **0** | +3 |
| CIENCIAS Y ARTES COMUN. | 11 | 10 | 8 | 10 | −3 | −2 |
| ARTES ESCÉNICAS | 11 | 7 | 10 | 7 | **−1** | +3 |
| GESTIÓN | 9 | 6 | 8 | 8 | −1 | +2 |
| ARQUITECTURA | 7 | 6 | 12 | 11 | **+5** | +6 |
| EDUCACIÓN | 7 | 4 | 3 | 6 | −4 | −1 |
| PSICOLOGÍA | 6 | 6 | 6 | 7 | **0** | 0 |
| LETRAS Y C. HUMANAS | 4 | 4 | 4 | 5 | **0** | 0 |
| GASTRONOMÍA | 3 | 2 | 2 | 2 | −1 | 0 |
| CONTABLES | 2 | 2 | 2 | 3 | **0** | 0 |
| **TOTAL** | **194** | **170** | **177** | **189** | **−17** | **+7** |

Nuestras 177 caen **entre los 170 titulares y las 194 realizadas**. Desvío medio
absoluto por facultad: **1,80 aulas** contra las realizadas y **1,93** contra los
titulares; nueve y diez facultades respectivamente quedan a dos aulas o menos.

### Dos lecturas que cambian el diagnóstico anterior

**DERECHO deja de ser un problema.** Contra la plantilla parecía un −6 (15 frente
a 21), pero 2025 declaró 16 titulares y aplicó 16: nuestra cifra es −1. El
desajuste estaba en el objetivo de la plantilla, no en el motor.

**ARQUITECTURA es la única que se pasa de verdad.** Pedimos 12 donde 2025 aplicó
7, y la plantilla preveía 11. Su p25 cayó a 16 en el marco reconstruido —era 20
antes de la exención—, y con una cuota de 190 eso empuja las aulas hacia arriba.
Es el único caso donde nuestra cuenta se separa de las tres referencias a la vez.

EDUCACIÓN sigue corta (3 contra 7 realizadas, 4 titulares) y tiene sólo 28 aulas
elegibles: ahí el límite es el marco, no la regla.

## R28 — Coincidencia, llena y funcionando

Corrido el cálculo en el duplicado, la pestaña deja de estar a medias.

**Lo que rige para todas las facultades**

| Decisión | Este estudio | Estudio anterior | ¿Igual? |
|---|---|---|---|
| Muestra de diseño | 2.500 | sin referencia | — |
| Estadístico por curso-horario | media | sin referencia | — |
| Sobremuestra | 20 % | sin referencia | — |
| Factor de asistencia (τ) | 0,53 | sin referencia | — |
| Efecto de diseño | 1,5 | sin referencia | — |
| Método de selección | cube balanceado | sin referencia | — |
| Aulas del marco | 2.364 | sin referencia | — |
| **Aulas a visitar** | **153** | **194** | **no** |
| Aulas agendadas con reemplazos | — | 1.012 | — |
| Encuestas válidas logradas | — | 3.303 | — |
| Asistencia observada | — | 69,7 % | — |

**Una ficha, entera** (DERECHO: «necesita 18 · tiene 423 · 22 reservas por
titular de 11»):

| Paso | Este estudio | Anterior | Δ |
|---|---|---|---|
| 1 Población | 2.969 | — | — |
| 2 Muestra | 347 | — | — |
| 3 Aulas que pasan los criterios | 423 de 575 | — | — |
| 4 Alumnos por curso-horario | 38 | 40 | −2 |
| **5 Aulas necesarias** | **18** | **16** | **+2** |
| 6 Aulas que sobran | 405 | — | — |

Los pasos 4 y 5 comparan de verdad: el estadístico contra el de 2025 y las aulas
contra las que se aplicaron. Los pasos 1, 2, 3 y 6 quedan sin columna anterior
porque el histórico del proyecto no guarda población ni cuota por facultad — sólo
lo ejecutado.

### Una discrepancia que el motor destapa solo

El total dice **153 aulas a visitar** mientras mi cuenta manual con p25 daba
**177**. No es un error de ninguna de las dos: el motor sigue aplicando su
configuración vigente —`estadistico_conglomerado = "media"` y τ = 0,53— mientras
mi cuenta usa p25 y la regla de 2025 sin τ. La tarjeta lo enseña sin que nadie
lo pregunte: «Estadístico por curso-horario: media» en la fila de arriba.

Es exactamente para lo que sirve la pestaña.

## R29 — con p25 el motor da 193 aulas contra las 194 de 2025

La discrepancia de 153 contra 177 se cerró, y no era un defecto: el motor
dimensionaba con **media** porque la decisión de «Alumnos por CH» nunca se había
sellado en ese proyecto.

Primer intento fallido, anotado para no repetirlo: escribí `p25` en
`parametros.estadistico_conglomerado` de los dos componentes, el endpoint
devolvió 200 y el valor volvió a salir «media». La causa está en el propio
motor y es deliberada: al sellar la decisión, `calc_muestra_alumnos_por_ch.R`
resuelve el estadístico **por estrato**, escribe el valor ya calculado y deja el
parámetro en «media» a propósito. El estadístico no se configura en el
componente; se sella en la decisión del marco.

Sellada p25 y recalculado, el componente de universidad da **193 aulas**:

| Facultad | motor con p25 | aplicadas 2025 | Δ |
|---|---|---|---|
| CIENCIAS E INGENIERIA | 42 | 40 | +2 |
| EE.GG. CIENCIAS | 28 | 26 | +2 |
| EE.GG. LETRAS | 22 | 23 | −1 |
| DERECHO | 18 | 16 | +2 |
| CIENCIAS SOCIALES | 14 | 17 | −3 |
| ARTE Y DISEÑO | 13 | 12 | +1 |
| ARQUITECTURA | 11 | 7 | +4 |
| CIENCIAS Y ARTES COMUN. | 10 | 11 | −1 |
| ARTES ESCÉNICAS | 9 | 11 | −2 |
| GESTIÓN | 8 | 9 | −1 |
| PSICOLOGÍA | 7 | 6 | +1 |
| LETRAS Y C. HUMANAS | 4 | 4 | 0 |
| EDUCACIÓN | 3 | 7 | −4 |
| GASTRONOMÍA | 2 | 3 | −1 |
| CONTABLES | 2 | 2 | 0 |
| **TOTAL** | **193** | **194** | **−1** |

**193 contra 194.** Desvío medio absoluto por facultad: **1,67 aulas**, el mejor
de todas las comparaciones hechas. Y el motor llega ahí aplicando τ = 0,53,
mientras mi cuenta manual daba 177 sin τ: sus p25 por facultad no son los míos
—usa interpolación (23,75; 22,5; 17,5) y su propio conjunto—, y la diferencia se
compensa con τ.

### Un defecto que esto destapó

Con p25 sellado y 193 aulas en pantalla, la tarjeta seguía diciendo «Estadístico
por curso-horario: **media**». Leía el parámetro del componente, que el motor
deja en «media» a propósito. Ahora la **decisión sellada manda** y la tarjeta
dice «primer cuartil (p25)».

## R30 — cursos-horario elegibles por facultad, y los talleres de tesis

### Nuestro marco contra el de 2025, facultad por facultad

El marco elegible de 2025 —tras presencial, teórico, nivel y matriculados ≥ 10—
tenía 2.746 aulas en estas quince facultades. El nuestro tiene 2.364: **el 86 %**.
Pero el promedio esconde lo que importa:

| Facultad | nuestro | 2025 | Δ | % |
|---|---|---|---|---|
| CIENCIAS E INGENIERIA | 571 | 655 | −84 | 87 % |
| DERECHO | 423 | 395 | **+28** | 107 % |
| EE.GG. LETRAS | 330 | 470 | −140 | **70 %** |
| EE.GG. CIENCIAS | 319 | 352 | −33 | 91 % |
| CIENCIAS Y ARTES COMUN. | 157 | 168 | −11 | 93 % |
| CIENCIAS SOCIALES | 150 | 139 | **+11** | 108 % |
| GESTIÓN | 102 | 101 | +1 | 101 % |
| PSICOLOGÍA | 89 | 90 | −1 | 99 % |
| ARTE Y DISEÑO | 62 | 83 | −21 | 75 % |
| ARQUITECTURA | 52 | 64 | −12 | 81 % |
| ARTES ESCÉNICAS | 44 | 115 | −71 | **38 %** |
| EDUCACIÓN | 19 | 25 | −6 | 76 % |
| GASTRONOMÍA | 16 | 33 | −17 | **48 %** |
| LETRAS Y C. HUMANAS | 15 | 40 | −25 | **38 %** |
| CONTABLES | 15 | 16 | −1 | 94 % |
| **TOTAL** | **2.364** | **2.746** | −382 | 86 % |

Seis facultades quedan al 99–108 % —ahí el marco se reprodujo—. Las que se
desploman son **ARTES ESCÉNICAS y LETRAS Y CIENCIAS HUMANAS (38 %)**,
**GASTRONOMÍA (48 %)** y **EE.GG. LETRAS (70 %)**, y son justo las que tienen
pocas aulas: perder veinte allí cambia el estudio, perder ochenta en Ciencias e
Ingeniería no.

### ¿2025 filtró los talleres de tesis a mano? NO, según sus propios datos

| | pool sorteado (1.097) | aplicadas (194) | tasa |
|---|---|---|---|
| TRABAJO DE TESIS | 2 | **0** | 0 % |
| TALLER … | 31 | 4 | 13 % |
| INVESTIGACIÓN … | 52 | 12 | 23 % |
| PROYECTO … | 39 | 6 | 15 % |
| SEMINARIO … | 1 | 0 | 0 % |
| *base de comparación* | | | *17,7 %* |

Los talleres de tesis **entraron al sorteo de 2025**: no hubo filtro en el marco.
Las dos que salieron sorteadas no llegaron a aplicarse, pero con dos casos eso es
indistinguible del azar —con una tasa base del 17,7 %, que ninguna de las dos
caiga es lo más probable—. Los talleres pasan al 13 % y los cursos de
investigación al 23 %: nada que sugiera un descarte deliberado.

### Qué costaría filtrarlos hoy

En nuestro marco, por nombre de curso (con solapamientos):

| Patrón | aulas | mediana de elegibles | media |
|---|---|---|---|
| INVESTIGACIÓN… | 103 | 25 | 36 |
| PROYECTO… | 66 | 28 | 32 |
| TALLER… | 64 | **20** | 21 |
| TESIS | 20 | 26 | 26 |
| SEMINARIO… | 9 | 33 | 52 |
| ASESORÍA… | 2 | 156 | 153 |
| *marco entero* | 2.364 | **33** | |

El dato matiza la intuición: **las de tesis no son marginales** —mediana de 26
elegibles contra 33 del marco—, y las verdaderamente pequeñas son los talleres
(mediana 20). Las muy chicas ya salieron por el mínimo de matriculados.

Así que excluirlas no es una decisión de tamaño sino de **criterio**: si en un
taller de tesis la dinámica no es de clase y aplicar allí no tiene sentido, se
excluye por eso, no porque haya poca gente. Es de Gonzalo.

## R31 — el criterio que se lleva Artes Escénicas y Letras es EL MÍNIMO

Razones de exclusión en las cuatro facultades que no se reprodujeron (un aula
puede caer por varias):

| Facultad | catálogo | incluidas | mínimo de elegibles | matriculados | modalidad | tipo de sesión |
|---|---|---|---|---|---|---|
| ARTES ESCÉNICAS | 454 | 44 | **405** | 390 | 117 | 10 |
| LETRAS Y C. HUMANAS | 149 | 15 | **131** | 121 | — | 47 |
| GASTRONOMÍA | 54 | 16 | **36** | 30 | — | 10 |
| EE.GG. LETRAS | 482 | 330 | **134** | 9 | — | 58 |

No es el nivel del curso, ni el tipo de sesión, ni la modalidad: es **el umbral
de tamaño**, y arrastra por sí solo el 89 % de las exclusiones de Artes
Escénicas.

### Son dos diferencias con 2025, no una

2025 pedía **matriculados ≥ 10**. Nosotros pedimos **elegibles ≥ 15** — un
umbral más alto **y** sobre otra magnitud, porque los elegibles descuentan el
traslape. Aplicando el criterio literal de 2025 sobre las aulas que ya pasan
todo lo demás:

| Facultad | hoy | con matriculados ≥ 10 | 2025 | % |
|---|---|---|---|---|
| ARTES ESCÉNICAS | 44 | **112** | 115 | 97 % |
| CIENCIAS E INGENIERIA | 571 | 629 | 655 | 96 % |
| EE.GG. LETRAS | 330 | 419 | 470 | 89 % |
| CIENCIAS Y ARTES COMUN. | 157 | 173 | 168 | 103 % |
| ARTE Y DISEÑO | 62 | 87 | 83 | 105 % |
| GESTIÓN | 102 | 107 | 101 | 106 % |
| EE.GG. CIENCIAS | 319 | 377 | 352 | 107 % |
| PSICOLOGÍA | 89 | 97 | 90 | 108 % |
| ARQUITECTURA | 52 | 71 | 64 | 111 % |
| CONTABLES | 15 | 18 | 16 | 113 % |
| DERECHO | 423 | 450 | 395 | 114 % |
| LETRAS Y C. HUMANAS | 15 | **48** | 40 | 120 % |
| CIENCIAS SOCIALES | 150 | 170 | 139 | 122 % |
| EDUCACIÓN | 19 | 42 | 25 | 168 % |
| GASTRONOMÍA | 16 | 24 | 33 | **73 %** |
| **TOTAL** | **2.364** | **2.824** | **2.746** | **103 %** |

**Artes Escénicas pasa de 44 a 112 contra sus 115.** Letras y Ciencias Humanas
de 15 a 48. El marco entero pasa del 86 % al 103 % del de 2025, y trece de
quince facultades caen en la banda 89–122 %.

La única que sigue corta es **GASTRONOMÍA (24 contra 33)** y la que más se pasa
es **EDUCACIÓN (42 contra 25)**: ésas ya no se explican por el umbral.

### La decisión, que es de Gonzalo

Bajar el mínimo a 10 y medirlo sobre matriculados **reproduce el marco de 2025**,
pero mete al sorteo aulas con menos de quince personas encuestables. Subirlo
protege el rendimiento de cada visita a costa de un marco más chico y más
sesgado hacia las facultades grandes. Él ya dijo que el mínimo **depende de cada
facultad**; esto le da la cifra por facultad para decidirlo.

## R32 — mínimos de elegibles calibrados por facultad

Gonzalo, textual: «no te digo que repliquemos exactamente el criterio del año
pasado, que era mínimo de matriculados. Nosotros tenemos un criterio que yo
considero mejor, que es el mínimo de alumnos elegibles, pero sí tratemos de
diferenciar mínimos más o menos agresivos por facultades pequeñas, de tal forma
que no perdamos tantos alumnos y que nos garantice números bastante parecidos de
cursos-horario elegibles por facultad».

Es un problema de calibración: conservar la magnitud —elegibles— y mover el
umbral facultad por facultad.

### El umbral que igualaría a 2025 en cada facultad

| Facultad | 2025 | hoy (15) | umbral que iguala | conteo |
|---|---|---|---|---|
| ARTES ESCÉNICAS | 115 | 44 | **9** | 116 |
| LETRAS Y C. HUMANAS | 40 | 15 | **11** | 39 |
| ARQUITECTURA | 64 | 52 | **10** | 64 |
| ARTE Y DISEÑO | 83 | 62 | **9** | 85 |
| CIENCIAS Y ARTES COMUN. | 168 | 157 | **12** | 168 |
| EDUCACIÓN | 25 | 19 | **13** | 23 |
| CONTABLES | 16 | 15 | **14** | 16 |
| PSICOLOGÍA | 90 | 89 | 16 | 89 |
| GESTIÓN | 101 | 102 | 19 | 101 |
| CIENCIAS SOCIALES | 139 | 150 | **17** | 137 |
| DERECHO | 395 | 423 | **20** | 402 |
| EE.GG. CIENCIAS | 352 | 319 | 9 | 328 |
| CIENCIAS E INGENIERIA | 655 | 571 | 5 | 656 |
| EE.GG. LETRAS | 470 | 330 | 5 | 397 |
| GASTRONOMÍA | 33 | 16 | 5 | 34 |

**Las tres últimas avisan de otra cosa.** Ciencias e Ingeniería, EE.GG. Letras y
Gastronomía sólo alcanzan su cifra de 2025 bajando a **5 elegibles**, y aun así
EE.GG. Letras se queda en 397 de 470. Ahí no falta laxitud: falta marco por otro
motivo, y bajar el umbral sería comprar aulas de cinco personas.

### Propuesta: 15 por defecto, relajado hasta 10 donde escasea, subido donde sobra

Con piso en **10** —por debajo entran aulas sin masa para encuestar—:

| Facultad | umbral | hoy | propuesta | 2025 | % | p25 resultante |
|---|---|---|---|---|---|---|
| CIENCIAS E INGENIERIA | 15 | 571 | 571 | 655 | 87 % | 24 |
| EE.GG. LETRAS | 15 | 330 | 330 | 470 | 70 % | 34 |
| DERECHO | **20** | 423 | 402 | 395 | 102 % | 38 |
| EE.GG. CIENCIAS | 15 | 319 | 319 | 352 | 91 % | 27 |
| CIENCIAS Y ARTES COMUN. | **12** | 157 | 168 | 168 | 100 % | 19 |
| CIENCIAS SOCIALES | **17** | 150 | 137 | 139 | 99 % | 23 |
| ARTES ESCÉNICAS | **10** | 44 | 103 | 115 | 90 % | 11 |
| GESTIÓN | 15 | 102 | 102 | 101 | 101 % | 29 |
| PSICOLOGÍA | 15 | 89 | 89 | 90 | 99 % | 23 |
| ARTE Y DISEÑO | **10** | 62 | 80 | 83 | 96 % | 15 |
| ARQUITECTURA | **10** | 52 | 64 | 64 | 100 % | 16 |
| LETRAS Y C. HUMANAS | **10** | 15 | 43 | 40 | 108 % | 11 |
| GASTRONOMÍA | **10** | 16 | 20 | 33 | 61 % | 15 |
| EDUCACIÓN | **13** | 19 | 23 | 25 | 92 % | 15 |
| CONTABLES | **14** | 15 | 16 | 16 | 100 % | 21 |
| **TOTAL** | | **2.364** | **2.467** | **2.746** | **90 %** | |

Diez de quince facultades quedan entre 90 y 108 % de 2025, contra las seis de
antes. **Artes Escénicas pasa de 44 a 103 aulas y Letras de 15 a 43.** El marco
gana 103 aulas y **1.060 alumnos elegibles** (de 80.835 a 81.895).

### Lo que la propuesta NO arregla, y hay que decirlo

- **EE.GG. LETRAS (70 %)** y **CIENCIAS E INGENIERIA (87 %)** no mejoran: su
  umbral se queda en 15 porque relajarlo no las acerca sin bajar a 5.
- **GASTRONOMÍA (61 %)** es la peor incluso relajada: con 54 aulas en catálogo y
  20 sobre el umbral de 10, su marco es real y pequeño.
- El p25 resultante baja donde se relaja —11 en Artes Escénicas y en Letras,
  contra 33 del marco entero—, y el p25 es el estadístico que dimensiona: **más
  aulas elegibles con p25 más bajo significa más aulas a visitar en esa
  facultad**. Es el precio y hay que mirarlo junto a la cuota.

## R33 — mínimos por facultad aplicados: 2.466 aulas de marco y 202 a visitar

Aplicada la escala en el duplicado. Dos cosas que sólo se ven al aplicarla:

**Había un segundo umbral escondido.** Con `minEligible.byFaculty` puesto pero
`enrolled_total ≥ 15` intacto, Artes Escénicas subió de 44 a 57 en vez de a 103:
las aulas que el mínimo relajado dejaba entrar seguían cayendo por matriculados.
Bajado ese umbral a 10 —el de 2025—, el marco llega a **2.466 aulas**, contra las
2.467 previstas contando sobre el frame.

**Y el criterio de matriculados es ahora redundante**: con estos umbrales,
**ninguna aula del marco cae sólo por matriculados** (0 de 5.263). Es geometría,
no casualidad: los elegibles nunca superan a los matriculados —comprobado, 0
casos—, así que exigir 15 elegibles ya implica 15 matriculados. El umbral de
matriculados sólo muerde cuando el de elegibles baja por debajo de él.

### Aulas a visitar, con p25 sellado

| Facultad | p25 | aulas | aplicadas 2025 | Δ |
|---|---|---|---|---|
| CIENCIAS E INGENIERIA | 24 | 42 | 40 | +2 |
| EE.GG. CIENCIAS | 27 | 28 | 26 | +2 |
| EE.GG. LETRAS | 34 | 22 | 23 | −1 |
| DERECHO | 38 | 18 | 16 | +2 |
| ARQUITECTURA | 16 | **15** | 7 | **+8** |
| ARTE Y DISEÑO | 15 | 15 | 12 | +3 |
| CIENCIAS SOCIALES | 22,5 | 13 | 17 | −4 |
| ARTES ESCÉNICAS | 11 | 12 | 11 | +1 |
| CIENCIAS Y ARTES COMUN. | 19,75 | 10 | 11 | −1 |
| GESTIÓN | 29 | 8 | 9 | −1 |
| PSICOLOGÍA | 23 | 7 | 6 | +1 |
| LETRAS Y C. HUMANAS | 11 | 5 | 4 | +1 |
| EDUCACIÓN | 15,25 | 3 | 7 | −4 |
| GASTRONOMÍA | 15 | 2 | 3 | −1 |
| CONTABLES | 22,5 | 2 | 2 | 0 |
| **TOTAL** | | **202** | **194** | **+8** |

**202 aulas**, dentro de la banda de 170–210. Once de quince facultades quedan a
dos aulas o menos de lo que 2025 aplicó.

### El precio se materializó, y es de una sola facultad

El saldo neto por relajar el mínimo es **+9 aulas** sobre las 193 anteriores, y
casi todo viene de **ARQUITECTURA: de 11 a 15**, porque su p25 bajó a 16 al
entrar aulas más chicas. Artes Escénicas, en cambio, pasó de 9 a 12 acercándose a
sus 11 reales, y Letras de 4 a 5 con 4 reales.

Es exactamente el efecto anticipado —más aulas elegibles con p25 más bajo piden
más visitas— pero concentrado donde el marco era más escaso. Arquitectura ya era
la única facultad que se pasaba de las tres varas antes de tocar nada.

## R34 — el umbral invisible, y los talleres por facultad

### El segundo criterio no estaba en ninguna pantalla

Gonzalo: «me comentas de que aquí hay un umbral de matriculados ≥ 15, pero el que
yo recuerde eso no se debió aplicar en ningún curso-horario porque ya teníamos el
criterio de elegibles».

Tenía razón. La UI tiene su tarjeta de **mínimo de elegibles con overrides por
facultad**, pero el mínimo de **matriculados** no aparece en ninguna parte. Y
mientras el de elegibles sea el mayor, no recorta nada —los elegibles nunca
superan a los matriculados—, así que su ausencia no se nota. En cuanto una
facultad baja por debajo de él, manda en silencio: Artes Escénicas con mínimo 10
y matriculados en 15 subió a 57 en vez de a las 103 prometidas.

Reparado con un aviso que sólo aparece cuando de verdad tapa, nombra las
facultades afectadas y dice cuál de los dos recorta allí. Tres mutantes: avisar
siempre, ignorar el umbral general de las que heredan, y perder el orden por
agresividad.

### Los talleres, medidos por facultad

Gonzalo: «en 2025, en arquitectura se aplicaron talleres, porque eran tipos de
cursos-horario que tenían bastantes alumnos y que en otras facultades no era así.
Ésa es una de las razones por las cuales los criterios siempre son a nivel de
facultad».

**En el pool de 2025 no hay ni un aula de tipo TALLER**: las 1.097 son
`TEORICO(TEORICO-PRACTICO, TEORICO-LABORATORIO)`. Los 31 «talleres» de ese pool
lo son por el nombre del curso, y están en DERECHO (9), GESTIÓN (7), CIENCIAS Y
ARTES (6), CIENCIAS E INGENIERIA (4), EE.GG. LETRAS (4) y EDUCACIÓN (1) — no en
Arquitectura ni en Arte y Diseño.

Pero la intuición de fondo sí se sostiene, y con fuerza. En nuestro catálogo hay
**315 aulas de tipo TALLER** y se concentran justo donde él decía:

| Facultad | talleres | mediana de matriculados |
|---|---|---|
| **ARTE Y DISEÑO** | **186** | 18 |
| **ARQUITECTURA** | **58** | 19 |
| EE.GG. LETRAS | 27 | 24 |
| ARTES ESCÉNICAS | 14 | 14 |
| ESCUELA DE POSGRADO | 8 | 6 |
| PSICOLOGÍA | 7 | 25 |

Y no son marginales: 18–19 matriculados de mediana, comparable a las teóricas de
esas mismas facultades. Si el criterio de tipo de sesión admitiera TALLER allí
—que es exactamente lo que permite `op: "add"` por facultad—:

| Excepción | entrarían | hoy tiene | p25 de las nuevas |
|---|---|---|---|
| ARTE Y DISEÑO + taller | **147** | 79 | 13 |
| ARQUITECTURA + taller | **52** | 64 | 15 |
| EE.GG. CIENCIAS + laboratorio | 26 | 320 | 32 |
| DERECHO + seminario | 25 | 404 | 20 |
| CIENCIAS E INGENIERIA + laboratorio | 18 | 571 | 17 |
| ARTES ESCÉNICAS + taller | 0 | 103 | — |

Arte y Diseño casi triplicaría su marco y Arquitectura lo duplicaría. Es la
decisión más grande que queda abierta, y es de facultad, no general — que es
justo el argumento de Gonzalo.

**Ojo con el precio, ya conocido**: el p25 de las nuevas es 13 en Arte y Diseño,
por debajo de su p25 actual de 15, así que su estadístico bajaría y pediría más
aulas. En EE.GG. Ciencias pasa lo contrario: las de laboratorio tienen p25 32
contra su 27 actual y lo subirían.

## R35 — criterio por criterio contra 2025

Lo que Gonzalo llamó «un comparativo no sólo de números sino de método». Todo
verificado contra las 1.097 aulas de su pool sorteado, no contra el diseño en
papel.

| # | Criterio | 2025 | Nosotros | ¿Igual? |
|---|---|---|---|---|
| 1 | Modalidad | presencial — **1.097 de 1.097** | presencial estricto | **sí** |
| 2 | Tipo de sesión | teórico — **1.097 de 1.097** | teórico | **sí** |
| 3 | Nivel del curso | sin 1, 11 ni 12; **sí admite el 0** (135 aulas) | 2–10, con los dos EE.GG. exentos | **no** — decisión suya |
| 4 | Mínimo por aula | **≥ 10 sobre `matriculados_poblacion`**, no sobre el total | ≥ 15 elegibles, 10–20 por facultad | **no** — decisión suya |
| 5 | Posgrado | excluido | excluido **+ Estudios Especiales** | más estricto |
| 6 | Tipo de docente | su pool sólo trae *contratado* (902) y *ordinario-principal* (195) | sin filtro | **ambiguo** — ver abajo |
| 7 | Condición del curso | columna **vacía** en su pool | no se usa | sin dato |
| 8 | Estadístico | mín(mediana, media) | **p25** | **no** — decisión suya |
| 9 | Sobremuestra | ×1,5 | 20 % | **no** — pendiente |
| 10 | Método de selección | sistemático k = N/n | cube balanceado | **no** |
| 11 | Factor de asistencia | **sin τ** | τ = 0,53 | **no** |

### Tres matices que cambian la lectura

**El mínimo de 2025 no era sobre matriculados brutos.** Su libro trae dos
columnas: `matriculados_total` (mediana 34) y `matriculados_poblacion` (mediana
30), y el mínimo de 10 aplica sobre la **segunda** — su valor mínimo en el pool
es exactamente 10. O sea que ya descontaban algo antes de contar, igual que
nosotros descontamos el traslape. Su criterio y el nuestro están más cerca de lo
que parecía: la diferencia es cuánto se descuenta y dónde se pone el corte.

**El nivel 0.** El pool de 2025 tiene 135 aulas de nivel 0 y nuestro rango 2–10
las dejaría fuera. En nuestro catálogo sólo hay **17**, todas de EE.GG. LETRAS y
10 ya incluidas por la exención. La diferencia 135 → 17 no es de criterio: es que
la codificación del nivel cambió entre semestres.

**El tipo de docente sigue sin resolverse.** Su pool tiene exactamente las dos
categorías que nosotros usábamos como filtro —contratado y ordinario— lo cual es
compatible con que sí filtraran. Pero otra fuente del mismo estudio atribuye a
esas mismas aulas asociados, auxiliares y jefes de práctica. **Dos fuentes del
mismo año se contradicen**, así que no se puede afirmar ni lo uno ni lo otro. Lo
dejamos sin filtro, que es la opción que no inventa.

### Dónde estamos

Coinciden los dos criterios que definen el universo —presencial y teórico— y
ésos son los que más recortan. Las cinco diferencias restantes son decisiones
deliberadas de Gonzalo (nivel con exención, mínimo sobre elegibles, exclusión de
Estudios Especiales, p25) o decisiones pendientes (sobremuestra, método de
selección, τ).

## R37 — el libro histórico llena la columna; el binding estaba vacío

Gonzalo: «si ya este excel es capaz precisamente de tener toda esta información,
¿por qué en Coincidencia sigue saliendo sin referencia? En todo caso hay que
corregirlo ahora».

La causa era simple: **el libro nunca se cargó como archivo en el proyecto**. Su
binding `referencia_asistencia` tiene `file_id` vacío, y la referencia que había
llegó por otra vía sin el bloque de diseño.

Cargado en el duplicado, la tarjeta compara de verdad — «Comparado con 2025-2:
**6 de 7 decisiones cambiaron**»:

| Decisión | Este estudio | 2025-2 | ¿Igual? |
|---|---|---|---|
| Muestra de diseño | 2.500 | 2500 | **sí** |
| Sobremuestra | 20 % | 1,5 | no |
| Factor de asistencia (τ) | 0,53 | 0,7038 | no |
| Efecto de diseño | 1,5 | 2 | no |
| Método de selección | cube balanceado | Sistemático sobre el marco | no |
| Aulas del marco | 2.466 | 1.097 | no |
| Aulas a visitar | 202 | 170 | no |
| Aulas efectivamente aplicadas | — | 194 | — |
| Aulas agendadas con reemplazos | — | 1.012 | — |
| Encuestas válidas logradas | — | 3.303 | — |
| Asistencia observada | — | 69,7 % | — |

Y al cargarlo aparecieron dos huecos nuevos: el libro **sustituía** al rescate y
se perdían las 1.012 agendadas y el 69,7 %, que la hoja `diseno` no recoge. Ahora
se fusionan —el libro manda, el rescate rellena— y sólo queda sin referencia el
**estadístico**, que el libro no declara.

## R38 — la condición del curso, por facultad

Gonzalo me corrigió: «entiendo que en estudios generales ese criterio esté
corrupto, pero en el resto de facultades no lo está (…) ¿por qué sería un
problema que una facultad tenga ese criterio corrupto si las demás no lo
tienen?». Mi objeción había sido generalista, que es justo lo que él critica.

Medido, y el problema es aún más acotado de lo que ninguno de los dos pensaba:

| Facultad | incluidas | con OBLIGATORIO | % | categorías dominantes |
|---|---|---|---|---|
| EDUCACIÓN · GASTRONOMÍA · CONTABLES | 22 · 20 · 15 | 22 · 20 · 15 | **100 %** | OBLIGATORIO |
| PSICOLOGÍA | 89 | 82 | 92 % | OBLIGATORIO |
| **EE.GG. CIENCIAS** | 320 | 290 | **91 %** | OBLIGATORIO |
| DERECHO | 404 | 354 | 88 % | OBLIGATORIO |
| CIENCIAS E INGENIERIA | 571 | 493 | 86 % | OBLIGATORIO |
| LETRAS Y C. HUMANAS · ARTE Y DISEÑO · ARTES ESCÉNICAS | 41 · 79 · 103 | 35 · 66 · 87 | 84–85 % | OBLIGATORIO |
| CIENCIAS Y ARTES COMUN. | 168 | 137 | 82 % | OBLIGATORIO |
| GESTIÓN | 102 | 77 | 75 % | OBLIGATORIO |
| ARQUITECTURA | 64 | 45 | 70 % | OBLIGATORIO |
| CIENCIAS SOCIALES | 139 | 95 | 68 % | OBLIGATORIO |
| **EE.GG. LETRAS** | 329 | **18** | **5 %** | ESTRATEGIAS PARA LA INVESTIGACIÓN, REQUISITO PARA EGRESO DE EEGG, ARTES |

**Sólo EE.GG. LETRAS tiene el campo corrupto.** EE.GG. Ciencias, que yo daba por
perdida junto a ella, tiene 91 % de OBLIGATORIO. Las catorce restantes lo usan
como condición de verdad.

### Aplicado: exigir obligatorio con EE.GG. LETRAS exenta

Marco: **2.466 → 2.134** aulas (−332). EE.GG. LETRAS conserva sus 329 gracias a
la exención. Y las aulas a visitar:

| Facultad | p25 | aulas | aplicadas 2025 | Δ |
|---|---|---|---|---|
| CIENCIAS E INGENIERIA | 24 | 42 | 40 | +2 |
| EE.GG. CIENCIAS | 27 | 28 | 26 | +2 |
| EE.GG. LETRAS | 34 | 22 | 23 | −1 |
| DERECHO | 38,5 | 18 | 16 | +2 |
| ARQUITECTURA | 16 | 15 | 7 | +8 |
| ARTE Y DISEÑO | 15,25 | 15 | 12 | +3 |
| CIENCIAS SOCIALES | 22,5 | 13 | 17 | −4 |
| ARTES ESCÉNICAS | 11 | 12 | 11 | +1 |
| CIENCIAS Y ARTES COMUN. | 19 | 10 | 11 | −1 |
| GESTIÓN | 27 | 9 | 9 | **0** |
| PSICOLOGÍA | 23 | 7 | 6 | +1 |
| LETRAS Y C. HUMANAS | 11 | 5 | 4 | +1 |
| EDUCACIÓN | 15,25 | 3 | 7 | −4 |
| CONTABLES | 22,5 | 2 | 2 | **0** |
| GASTRONOMÍA | 15 | 2 | 3 | −1 |
| **TOTAL** | | **203** | **194** | **+9** |

Quitar 332 aulas del marco casi no mueve las aulas a visitar —de 202 a 203—
porque el p25 apenas cambia: las no obligatorias no eran sistemáticamente más
grandes ni más chicas. **El criterio depura el marco sin encarecer el trabajo de
campo**, que es el mejor resultado posible para un filtro de este tipo.

## R39 — el ciclo 0 era la marca de EE.GG. Letras, y explica la exención

En el pool de 2025 hay 135 aulas de nivel 0. Medido:

| | |
|---|---|
| Facultad de esas 135 | **EE.GG. LETRAS, las 135** |
| Nivel 0 en cualquier otra facultad | **0 aulas** |
| Niveles de EE.GG. LETRAS en el pool | **sólo el 0** — no hay ninguna otra |
| Niveles de EE.GG. CIENCIAS en el pool | 2 (42), 3 (19), 4 (19) |
| Matriculados de las de nivel 0 | mediana **46**, de 10 a 65 |

Sus cursos son los típicos de estudios generales: Argumentación (15),
Investigación Académica (12), Historia del Perú (8), Narrativa, Ética, Lógica,
Lenguaje y Sociedad, Temas de Filosofía Antigua. Y sus alumnos vienen de las
carreras de destino —Gestión 22, Comunicación Audiovisual 15, Economía 14,
Contabilidad 12—, coherente con lo ya verificado: en Estudios Generales el
alumno figura con su facultad actual aunque su carrera esté declarada.

**El «nivel 0» no era un ciclo: era la marca de que el curso es de Estudios
Generales Letras y no pertenece a la malla de una especialidad.**

### Por qué esto valida la exención

En 2025, el criterio «fuera los niveles 1, 11 y 12» **no tocaba a EE.GG. Letras**
porque toda esa facultad estaba en 0. En nuestra base los mismos cursos están
codificados como **nivel 1** —455 de sus 482 aulas, el 94 %— así que el mismo
criterio, aplicado literalmente, la aniquila.

De las 135 de 2025 sólo quedan **17 en nivel 0** en nuestro catálogo, todas de
EE.GG. LETRAS: el resto migró al 1.

Así que la exención de los dos EE.GG. **no es una desviación del criterio de
2025: es lo que hace falta para que el criterio signifique lo mismo**. Sin ella
estaríamos aplicando la misma regla sobre una codificación distinta y obteniendo
el resultado contrario.

Para EE.GG. CIENCIAS el efecto es menor —en 2025 sus cursos ya tenían niveles 2 a
4, y hoy sólo el 24 % de sus aulas son nivel 1— pero la exención es igual de
coherente.

### Lo que queda por decidir

Nuestro rango es 2–10 y deja fuera el 0. Con la exención de EE.GG. da lo mismo
—esas 17 aulas ya pasan por exentas— pero si alguna vez se retira la exención, el
rango debería ser **0–10** para no perder los cursos sin ciclo. Es una línea de
defensa barata.

## R40 — el nivel del curso NO se está leyendo del curso. DEFECTO ABIERTO

Gonzalo, textual: «no entiendo, ¿por qué una característica migra? Si EE.GG.
Letras tenía ciclo 0 en la base debería quedarse como 0, ¿no? El criterio por
facultad se mueve, no editamos la data real».

Tenía razón y mi explicación anterior era falsa: **nada migra**. Fui al catálogo
del propio proyecto —la hoja `CURSO Y HORARIO` que el `.pulso` guarda— y dice
**0**.

### La prueba, con un aula concreta

| | |
|---|---|
| Aula | `PSI125-0201` — NEUROCIENCIAS, EE.GG. LETRAS |
| «Nivel del curso» en el catálogo | **0** |
| `course_level_num` en nuestro frame | **1** |
| `level_reference` que publica el motor | **«curso»** |

El motor afirma que ese nivel viene del curso, y no viene: el catálogo dice 0.

### Y no es un caso suelto

| | |
|---|---|
| Aulas donde `course_level_num` == `level` (el ciclo del ALUMNO) | **5.251 de 5.263** |
| EE.GG. LETRAS en el catálogo, por nivel del curso | **473 en 0, 295 sin dato, ninguna en 1** |
| EE.GG. LETRAS en nuestro frame | **450 en nivel 1**, 17 en 0 |
| `level_reference` = «curso» | 5.167 aulas |

Las dos columnas son el mismo dato en el 99,8 % de las aulas. **El criterio de
nivel del curso está operando sobre el ciclo del ALUMNO** mientras declara que
usa el del curso.

### Por qué importa tanto

Es el criterio que motivó la exención de los Estudios Generales. Si el nivel
correcto de EE.GG. LETRAS es 0 —como dice el catálogo y como decía 2025—, esa
facultad **nunca debió caer** por el criterio «fuera 1, 11 y 12», y la exención
que le pusimos estaría tapando un defecto de lectura en vez de una diferencia de
codificación. Lo que escribí en R39 —«la codificación cambió entre semestres»— es
incorrecto: la codificación es la misma, la lectura no.

También explica el nivel 0 «desaparecido»: no desapareció, se sobrescribió.

### Lo que falta

Encontrar dónde se pierde. Pistas: el catálogo trae la misma aula repetida con
facultades distintas y con 0 y NA mezclados —`PSI125-0201` aparece bajo EE.GG.
LETRAS, ARTES ESCÉNICAS y CONSORCIO—, así que la moda por clave
(`.cm_catalogo_modal_by_key`) y el fallback de `pick_num` en
`.cm_criterios_valores_aula` son los dos sitios donde mirar. `.cm_criterios_parse_nivel("0")`
devuelve 0 correctamente, así que el parseo no es.

**No se toca nada hasta encontrarlo**: cambiar el rango a 0–10 o quitar la
exención sobre una lectura equivocada arreglaría el síntoma y escondería la
causa.

## Reglas de este análisis

- Las fuentes del cliente se leen; no se copian al repo ni se modifican.
- Cada paso se cierra con cifras y con su desglose por facultad, nunca con un
  agregado.
- Lo que no cierra se marca como no cerrado, con las hipótesis que quedan.
- Sólo Gonzalo da el análisis por terminado.

## S1 · El criterio de nivel, declarado POR FACULTAD · ☑ 2026-08-18

Declarado con las etiquetas EXACTAS del marco: rangos `[{0,0},{2,10}]` (fuera
de 1, 11 y 12) en las 12 facultades donde el criterio recorta algo — CIENCIAS
E INGENIERIA (4), DERECHO (47), ESTUDIOS GENERALES CIENCIAS (97), ARTES
ESCÉNICAS (19), ARTE Y DISEÑO (10), CIENCIAS SOCIALES (3), CIENCIAS Y ARTES
DE LA COMUN. (1), LETRAS Y CIENCIAS HUMANAS (1), ARQUITECTURA Y URBANISMO
(27), PSICOLOGÍA (2), EDUCACION (6), GASTRONOMÍA, HOTELERÍA Y TURISMO (3) — y
`exenta` en las 3 donde no hay nada que recortar o Gonzalo lo pidió textual:
ESTUDIOS GENERALES LETRAS (1 aula de 481, «no tendría que hacer ningún tipo de
filtro»), GESTIÓN Y ALTA DIRECCIÓN (0) y CIENCIAS CONTABLES (0). ESCUELA DE
POSGRADO y ESCUELA DE ESTUDIOS ESPECIALES quedan FUERA del mapa (el mapa es
whitelist de unidades objetivo: ausente = excluida).

**Resultado: marco 2.426 de 5.263 — IDÉNTICO al de la aplicación en bloque,
facultad por facultad.** La única aula que la exención de EGL salva del filtro
de nivel cae igual por otros criterios. La declaración por facultad no mueve
el número: deja la ficha honesta, que es lo que exige la vara 3.

Nota: el hallazgo (b) del encargo quedó OBSOLETO — `session_type` ya viene
poblado (4.265 TEORICO(...), 315 TALLER, 273 SEMINARIO, 205 LABORATORIO…) y
el criterio está declarado (include teórico) y excluyendo cientos de aulas.
Lo que sigue vivo de esa familia es (c): la excepción de TALLER en Artes y
Arquitectura, que hoy NO está declarada (el include teórico rige global).

## S2 · La config no sobrevivía al `.pulso` · ☑ reparado `4a1d1266`

**Dónde vivía**: no era la whitelist de persistencia (la clave es
literal/persistible en `session_schema.R`) — el `state.rds` ya llegaba vacío
al guardado. La causa: **R y la UI hablan shapes distintos de
`courseLevelRanges`**. R emite `Array<{min,max}>` con etiquetas del marco; el
TS lo declara `Array<[min,max]>` y lo indexa por slug.
`.cm_criterios_normalize_rangos` solo leía `$min/$max`: todo par posicional
daba NA y se descartaba EN SILENCIO (medido: las tres variantes de parseo →
0 facultades sobreviven; el shape canónico → sobrevive). En sentido inverso
la UI hacía `r[0]` sobre `{min,max}` y mostraba undefined. Ciclo completo del
síntoma: el analista aplica rangos por API → la UI no los ve → cualquier
re-post de la UI los borra → el guardado persiste `[]` → al reabrir no están.
Seis consumidores del defecto (UI de criterios, criteriosImpacto, POST de
config, persistencia, cascada/radiografía, presets).

Reparado en ambos lados (lector tolerante en R; embudo `rangosNivel.ts` en
TS con clave canónica y exención legible). Evidencia: 15 tests R + 10 vitest,
tres mutantes muertos, y el ciclo aplicar→guardar→releer verificado sobre el
`.pulso` de trabajo: las 15 facultades vuelven intactas (12 rangos + 3
`[{exenta:TRUE}]`).

**S2b — la decisión NO se pierde**: `alumnos_por_ch_decision` confirmada
(p25, sellada 2026-08-18T01:24Z) vive en `calc_muestra_estudio$workspace$
aulas_config` y el resello de `.cm_criterios_frame_guardar` la mantiene al
reconstruir. Lo que queda en centinela vacío es la COPIA de sesión
(`calc_muestra_aulas_config`), que nadie mantiene: deuda de duplicación
confusa (R19 se explica por esto), no pérdida de trabajo. El assert
`E_CALC_MUESTRA_ALUMNOS_CH_DECISION` falla cerrado, como debe.

## S3 · Coincidencia gana el embudo comparado · ◐ 2026-08-18, commit `cdc9f7d7`

Primera pieza entregada: **el embudo comparado 2025↔hoy facultad por
facultad** (`salidas/EmbudoComparadoFacultades.tsx` + modelo puro + css),
montado en Coincidencia entre los criterios y las fichas. Lenguaje visual del
histórico (TooltipGrafico compartido, barras a escala común, ausencia dicha
con palabras). Verificado en vivo: 15 filas, paso Muestra (DERECHO +61,
EGL −46), y la banda superior ya muestra **202 a visitar contra 170 de 2025**
— VARA 2 en rango.

**S4 · HALLAZGO QUE LO LIMITA — el siguiente ítem**: el selector de pasos
sólo ofrece «2. Muestra» porque `referencia_criterios.por_facultad` trae
únicamente `cuota`: `poblacion`, `aulas_sorteadas`, `aulas_titulares`,
`aulas_aplicadas` y `alumnos_por_ch` llegan **NA en las 15 filas**, aunque
esos números existen medidos (titulares 39|25|19|16… y las celdas de
`referencia_asistencia`). El loader que arma `referencia_criterios` nunca los
puebla. Repararlo enciende de golpe los pasos 1, 3, 4 y 5 del embudo
comparado y la columna «antes» de las fichas — un fix, seis consumidores.

## S4 · La referencia por facultad, rescatada entera · ☑ 2026-08-18, commit `1080c916`

Dos descartes en serie: la fusión libro↔rescate sólo unía `general` (el
`por_facultad` del rescate se perdía entero), y dentro del rescate los dos
pisos eran excluyentes — con `cuotas` presente, la dimensión `facultad`
(matriculados/k → `alumnos_por_ch`, `aulas_aplicadas`, `asistentes`) no se
leía nunca. Una sola política en las tres costuras
(`.cm_ref_crit_rellenar_filas`): la base manda campo a campo, el relleno
cubre NA, las facultades son las de la base, NA jamás degrada a 0.

**Medido en vivo**: `por_facultad` pasó de 1 campo poblado a **6 de 8 en las
15 filas**; el embudo comparado pasó de un paso a **cuatro** (Muestra ·
Aulas que pasan · Alumnos por CH · Aulas necesarias). El paso 4 ya enseña la
diferencia metodológica declarada: DERECHO 38 hoy (p25) vs 40 (media 2025),
EGL 34 vs 55. Siguen NA con honestidad: `aulas_titulares` (viviría en
`cadenas_reemplazo` de la asistencia, extracción futura) y `poblacion`
(sólo el libro la sabría).

**Nota del loop (2026-08-18)**: el reloj real de la sesión es la
task-notification de un `sleep` en background; ni cron ni ScheduleWakeup
disparan aquí (16+4 aceptados, 0 ticks). Memoria
`feedback_reloj_del_loop_tarea_de_fondo` actualizada con el protocolo.

## (c) · Talleres en Artes y Arquitectura, declarados donde muerden · ☑ 2026-08-18

Textual de Gonzalo: «en 2025, en Artes y en Arquitectura se aplicaron
talleres, porque eran tipos de cursos-horario que tenían bastantes alumnos…
más que servir a nivel numérico son una cuestión de criterio».

**Medición previa (vara 3), TALLER por facultad** (talleres | caen SÓLO por
tipo de sesión | mediana alumnos): ARTE Y DISEÑO 186|146|18 · ARQUITECTURA
58|46|19 · EE.GG. LETRAS 27|2|24 · **ARTES ESCÉNICAS 14|0|12 (mediana 1
elegible: declararla ahí no recorta nada)** · PSICOLOGÍA 7|4|25 · resto ≤4.
«Artes y Arquitectura» = Arte y Diseño + Arquitectura, y la medición lo
confirma: bastantes alumnos (medianas 18–19) y volumen real.

**Declarado**: `byVariable.session_type.exceptions` con `op:"add"` y
categoría `taller` SÓLO en ARTE Y DISEÑO y ARQUITECTURA Y URBANISMO.
**Resultado medido**: A&D 78→222 (+144), ARQ 55→100 (+45), **las otras
quince filas +0 exactas**. Marco 2.426→**2.615** de 5.263. La decisión p25
se reselló sola contra el frame nuevo (`8f676b56…`). Config guardada en la
copia de trabajo; la ficha de cada facultad declara «session_type: además
taller». Sin cambios de código: fue configuración + medición.

## R4 · El origen de las 170 — acorralado con las metas exactas · ◐ 2026-08-18

**Fuente nueva decisiva**: `HSVBG2025_base_historica_aulas_ADR0060.xlsx` hoja
«0 · Metas por facultad» trae las QUINCE sobremuestras exactas de 2025 (suman
3.750) y los titulares reales (suman 170). Con ellas la regla documentada
(«aulas = CEIL(sobremuestra / mín(mediana, media) de elegibles)», hoja
«0 · Diseño 2025») reproduce EXACTO en seis facultades (ARQ 6, GES 6, PSI 6,
CONT 2, GAS 2 y ±1 en A&D/AE/EDU/LyCH) y falla SOLO en las grandes:
**C&I 26 vs 39 (−13) · EGC 17 vs 25 (−8) · CCSS 9 vs 15 (−6) · DERECHO 12
vs 16 (−4) · EGL 16 vs 19 (−3)**. Total fórmula ~126–133 vs 170.

**Pista con número**: el traslape 2025 documentado es 1,55 aulas/alumno, y
mín(mediana,media) de C&I ÷ 1,55 = 31,1/1,55 = **20,1 = exactamente el
divisor implícito de C&I** (784/39). Hipótesis falsable: `estudiantes_por_
aula` se calculó sobre elegibles SIN traslape (únicos por aula), y el
traslape varía por facultad (ARQ mono-carrera ~1,0 → reproduce exacto; las
grandes con cross-listing alto → déficit grande). SIGUIENTE PASO: derivar
elegibles únicos por aula desde la base alumno×curso (136.284 filas, misma
base 2025) por facultad y re-correr la regla. Alternativa si no cuadra:
engorde operativo en agenda (las metas citan «BD Agenda - Matriz» como
fuente, no una fórmula).

Descartado además hoy: divisor sobre MATRICULADOS TOTAL DTI, CEIL por celda
facultad×sexo (aporta ≤+1), cobertura constante de elegibles (los ratios
van de 0,94 a 1,98). Trampa de cruce: «CIENCIAS Y ARTES DE LA COMUN.» vs
«…COMUNICACIÓN» no casan con la normalización simple.

## R4 · La hipótesis del traslape, refutada — R4 pasa a BLOQUEADO · 2026-08-18

**La prueba**: se reprodujo la definición de elegible 2025 al alumno
(pregrado + 18 + condición regular = 34.541 EXACTO contra el marco,
correlación 1, diferencia mediana 0 por aula) y se corrió la regla con
elegibles ÚNICOS por facultad. **Refutada por exceso: total 246 vs 170**
(DERECHO +21, C&I +14, EGL +10). El «20,1 = 31,1/1,55» de C&I era
coincidencia: su traslape real por facultad es 2,08 (el 1,55 es global) —
un número que calza no es un mecanismo.

**Dónde queda R4**: la regla documentada con sobremuestras exactas da 133 y
reproduce EXACTO las facultades chicas (ARQ, GES, PSI, CONT, GAS, ±1 en
cuatro más); los únicos dan 246; 2025 aplicó 170, en medio, con los deltas
concentrados en las grandes y SIN mecanismo constante (probados y
descartados: total DTI, celda×sexo, cobertura constante, únicos,
traslape global). La fuente misma de las metas cita «BD Agenda - Matriz»
—la agenda ejecutada—, no una fórmula.

**BLOQUEADO — pregunta para Gonzalo**: ¿los titulares de las facultades
grandes de 2025 (C&I 39, EGC 25, EGL 19, DERECHO 16, CCSS 15) se ajustaron
a mano en el agendamiento por encima de la fórmula (~133 → 170)? Si la
respuesta es sí, R4 se cierra como «fórmula + engorde operativo» y el motor
NO debe imitar el engorde: la vara es su propia fórmula con p25 (hoy 202 a
visitar, dentro del rango 170–210 de la vara 2). Si es no, falta una fuente
que no está en Historico 2025/ ni en la plantilla de Kamila.

## (f) · Las tres capacidades YA tienen consumidor — hallazgo stale · ☑ 2026-08-18

Medido antes de construir nada (el grep original buscaba los nombres
snake_case de R; los consumidores usan camelCase): **`margen`** →
`fichaFacultadModel` → `FichaPorFacultadCard` (reservas por titular) +
`criteriosGeneralesModel` · **`sin_decision`** → `SinDecisionAlumnosChAviso`
montado dos veces en `CalculoCursosHorarioFacultadTab` + tipado en el API ·
**`sexo_por_facultad`** → `UniversidadDesk` → `AulasSeleccionTab` →
`SexoPorFacultadCard`, con normalizador y schema propios. Nada que
construir; construirlo habría duplicado superficies.

## S4b · Los titulares por facultad, desde las cadenas · ☑ 2026-08-18, commit `30c0a1df`

Tercer piso del rescate: el conteo de cadenas por facultad reproduce EXACTO
las quince metas del histórico (170/170). La referencia por facultad queda
**7 de 8 campos poblados en las 15 filas** — de 1 campo hace dos ticks a 7.
Sólo `poblacion` sigue NA (vive únicamente en el libro externo).

## R8 · Características de la selección — la mitad 2025, medida · ◐ 2026-08-18

**Perfil de los 170 titulares 2025** (de «Muestra - Full Data», muestra = M01):
- **Tipo: los 170 son TEÓRICOS.** Los talleres de Artes/Arquitectura de los
  que habló Gonzalo NO estaban en el marco 2025 ni en sus titulares:
  entraron como **aulas adicionales en campo** (la hoja «aulas adicionales»
  trae 26, con TÉCNICA DE DANZA, mecánica, etc.). Nuestra decisión (c) de
  declararlos EN el marco para A&D/ARQ es más limpia metodológicamente y es
  la «cuestión de criterio» pedida — pero que quede dicho: 2025 los sumó por
  fuera, no por diseño.
- **Nivel**: 0×19 · 2×23 · 3×9 · 4×10 · 5×28 · 6×33 · 7×16 · 8×25 · 9×5 · 10×2.
- **Tamaño (elegibles/aula)**: min 10 · p25 20 · mediana 29 · media 31,3 · p75 41 · max 64.
- **Por facultad (titulares | mediana tamaño | % nivel≤4)**: C&I 39|28|0% ·
  EGC 25|39|100% · EGL 19|48|100% · DERECHO 16|41|0% · CCSS 15|30|0% ·
  CyA 10|24|0% · A&D 9|18|44% · AE 7|15|71% · ARQ 6|34,5|50% · GES 6|33|0% ·
  PSI 6|24,5|0% · EDU 4|14|75% · LyCH 4|12,5|0% · CONT 2|27|0% · GAS 2|17|100%.

**Falta la mitad HOY**: la sesión no tiene selección vigente y lanzarla a
ciegas usaría `selector.n_aulas = 30` (stale) con `simulation_runs = 500`
(la trampa de ~80 min). SIGUIENTE PASO: leer cómo `calc_muestra_aulas_
seleccionar` dimensiona (¿usa el margen por estrato o `n_aulas`?), correr
con `simulation_runs = 0` y el tamaño del diseño (202), y comparar perfil
contra la tabla de arriba, quince filas.

## R8 · La selección del motor, medida — y el DEFECTO DE FONDO del reparto · 2026-08-18

**La corrida** (cube_balanceado, semilla 20260619, MC apagado —el MC sólo
estima π, no cambia el sorteo—, n=202 del diseño, decisión p25 vigente):
202 titulares M1 en ~30 s. Perfil global: 194 teóricos + **8 talleres (6 en
A&D, 2 en ARQ — la excepción (c) funcionando en la selección)**; tamaños
p25 25 · mediana 38 · media 37,3 (2025: mediana 29 · media 31,3 — el p25 y
los talleres suben el tamaño típico del aula seleccionada).

**EL HALLAZGO — la selección ignora la afijación de su propio diseño.** El
cálculo publica `aulas_base` POR FACULTAD (las 202 = C&I 42 · EGC 28 ·
EGL 22 · DERECHO 18 · ARQ 15 · A&D 15 · CCSS 13 · AE 12 · CyA 10 · GES 8 ·
PSI 7 · LyCH 5 · EDU 3 · CONT 2 · GAS 2), pero `.cm_aulas_quota_by_stratum`
(calc_muestra_aulas.R:1570) reparte `n_aulas` proporcional a la MASA DE
ELEGIBLES del estrato (faculty×sex×size_group) y la afijación nunca llega al
selector. Resultado medido: **DERECHO diseño 18 → sorteo 36 (+18) · EGL 22
→ 31 (+9) · ARQ 15 → 7 (−8) · A&D 15 → 9 (−6) · AE 12 → 7 (−5) · CCSS 13
→ 8 (−5). Desvío absoluto 68 de 202 (34 %).**

**Esto explica (d)**: «ARQUITECTURA pide 15 y 2025 aplicó 7» — nuestro motor
también le da 7, porque igual que 2025 sigue la masa de elegibles y no la
afijación. Y reencuadra R7 (motor 478 vs plantilla): son dos repartos, no
sólo dos totales. Consumidores del defecto: la selección, las cadenas de
reemplazo (dimensionadas sobre el reparto torcido), la entrega a campo y el
cumplimiento de cuotas por facultad (a DERECHO le sobrarían aulas mientras
ARQ no llega a su cuota).

**FIX PROPUESTO (siguiente)**: la afijación del diseño viaja a la selección
— archivo nuevo (`calc_muestra_aulas_afijacion.R`; el engine está congelado
a crecimiento) con una cuota en dos niveles: primero POR FACULTAD según
`aulas_base` del estudio, luego dentro de la facultad por masa de elegibles
(sex×size). Sin targets declarados, comportamiento actual intacto. Test con
las quince filas del diseño + mutante que anule el primer nivel.

## AFIJACIÓN · El diseño viaja a la selección · ☑ 2026-08-18, commit `a8d329c6`

`calc_muestra_aulas_afijacion.R` (archivo nuevo; el engine está congelado):
`selector$faculty_targets` activa el reparto en dos niveles — la facultad
respeta su target capado a lo disponible, dentro va por masa como siempre;
sin targets, byte-idéntico al histórico; estrato que cruce facultades falla
FUERTE. Suite nueva de 16 (incluye end-to-end construir→seleccionar y el
guard del normalizador contra el patrón S2); mutante del nivel facultad
muere con 10 rojos; los 140 de aulas y los 45 de criterio-por-facultad
siguen verdes.

**Verificado en vivo sobre HSVG2026**: selección con los 15 `aulas_base` del
diseño como targets → **desvío absoluto 0 en las quince filas** (antes 68 de
202): C&I 42 · EGC 28 · EGL 22 · DERECHO 18 · ARQ 15 · A&D 15 · CCSS 13 ·
AE 12 · CyA 10 · GES 8 · PSI 7 · LyCH 5 · EDU 3 · CONT 2 · GAS 2 = 202.
**(d) queda RESUELTO por construcción**: ARQ recibe sus 15, sostenibles
porque los talleres (c) le dieron 100 elegibles. Config guardada en la
copia. PENDIENTE UI (siguiente): el frontend aún no declara los targets al
seleccionar — cablear `faculty_targets` desde el margen del estudio para que
el analista no dependa de un POST manual; y el audit de congelados sigue
rojo por +72 PREVIOS a este trabajo (decisión de línea base para el curador).

## AFIJACIÓN UI · El circuito cerrado · ☑ 2026-08-18, commit `f76eee01`

`aulas/afijacionTargets.ts` arma `faculty_targets` desde los estratos que R
publicó (`margen.aulas_requeridas` con fallback a `aulas_base`, null nunca
degrada a 0) y los DOS `onSelectMethod` del Desk pasan por el wrapper. El
analista que aprieta «seleccionar» en la UI ahora obtiene el reparto del
diseño sin saber que existe un mapa de targets. 7 vitest + mutante muerto +
224 del área verdes + tsc limpio.

## S3 · Paso 7 en la ficha y el embudo: titulares seleccionados vs 2025 · ◐→ ☑ 2026-08-18, commit `35b6bbe5`

Un cambio en `fichaFacultadModel` (paso 7, hoy = M1 del sorteo vigente,
antes = titulares 2025 de las cadenas) alimenta la tabla de fichas Y el
selector del embudo comparado. Verificado en vivo: ARQ 15 vs 6 (+9),
DERECHO 18 vs 16 (+2), C&I 42 vs 39 (+3) — la selección afijada contra el
2025 real, quince filas. Con esto Coincidencia tiene: criterios generales y
del marco, embudo comparado con CINCO pasos (2, 3, 4, 5 y 7) y las fichas.
Queda opcional la dispersión de tamaños (estilo `DispersionTasa`); el resto
del S3 original está cubierto.

## R8 · Re-perfil con el reparto corregido — CERRADO · ☑ 2026-08-18

Con la afijación, la selección del motor calca el perfil 2025 facultad por
facultad: medianas de tamaño DERECHO 41 vs 41 · A&D 18 vs 18 · GES 33 vs 33
· CCSS 30 vs 30 · PSI 24 vs 24,5 · ARQ 36 vs 34,5 · EGL 46,5 vs 48; global
mediana 32,5 vs 29 (el p25 y los talleres del marco suben levemente el
tamaño típico). 17 talleres en M1, SOLO en ARQ (8) y A&D (9) — donde se
declararon. **El motor selecciona aulas que se parecen a las de 2025, en las
proporciones del diseño.**

**Barrido de cierre del día**: 493 tests R en las ocho suites del área +
1.502 vitest en los 174 archivos de calcMuestra + tsc, TODO VERDE; el
working tree sólo carga cambios ajenos. Los diez commits del día conviven.
**Dispersión de tamaños (opcional de S3): descartada con criterio** — las
fichas y los cinco pasos comparables ya cuentan esa historia; construir más
sin feedback de Gonzalo sería adorno (memoria: nada «por las dudas»).

**SIGUIENTE FRENTE**: los REEMPLAZOS. El diseño publica `aulas_reemplazo`
por estrato (C&I 42+? · …) y las cadenas se construyen por equivalencia —
medir si el dimensionamiento de reservas por facultad respeta el diseño o
arrastra la familia del defecto de afijación.

## REEMPLAZOS · Las cadenas heredan la afijación — sin defecto · ☑ 2026-08-18

Medido antes de tocar (la premisa podía ser falsa, y lo era): las cadenas se
construyen POR TITULAR (una por estrato M1), así que el reparto por facultad
se hereda de la selección afijada automáticamente. Profundidad: mínimo
pedido 1 por titular → **0 de 202 titulares por debajo**; 119/202 con las 11
olas completas; los más cortos (profundidad 1–3: 23 titulares, en facultades
chicas) dentro de contrato. El `aulas_reemplazo` del diseño (104) es otro
concepto —extra operativas del cálculo— y las reservas reales (1.774 M2+ +
639 extra) lo exceden en todas las facultades, consistente con los 1.012
candidatos de 2025. NADA QUE REPARAR — el fix de afijación no se propaga
porque no hace falta.

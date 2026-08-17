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
| R9 | Por qué el universo de aulas por facultad no se parece | **abierto — lo siguiente** |
| R8 | Características de la selección, 2025 vs 2026 | pendiente |

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

## Reglas de este análisis

- Las fuentes del cliente se leen; no se copian al repo ni se modifican.
- Cada paso se cierra con cifras y con su desglose por facultad, nunca con un
  agregado.
- Lo que no cierra se marca como no cerrado, con las hipótesis que quedan.
- Sólo Gonzalo da el análisis por terminado.

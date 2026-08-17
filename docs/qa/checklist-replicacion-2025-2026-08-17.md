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
| R4 | ¿La regla declarada reproduce sus propias 170 aulas? | **✗ NO — 133 de 170** |
| R5 | Marco 2026 con los criterios de 2025 | pendiente |
| R6 | Alumnos elegibles por CH por facultad, 2025 vs 2026 | pendiente |
| R7 | Aulas requeridas por facultad, 2025 vs 2026 | **bloqueado por R4** |
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

## Reglas de este análisis

- Las fuentes del cliente se leen; no se copian al repo ni se modifican.
- Cada paso se cierra con cifras y con su desglose por facultad, nunca con un
  agregado.
- Lo que no cierra se marca como no cerrado, con las hipótesis que quedan.
- Sólo Gonzalo da el análisis por terminado.

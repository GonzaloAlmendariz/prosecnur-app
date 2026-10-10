# Suficiencia por facultad — HSVG 2026 sobre ULT2, con lo aprendido de 2025

Tipo: Análisis de suficiencia
Estado: Vigente
Fecha: 2026-08-28
Autoridad: Evidencia de QA; no reemplaza un ADR

Sorteo vigente: **ULT2** (`sel_aulas_20260827160944_f5c12730`,
semilla 202, sellado 27/08 21:10) · Fuentes: `HSVG26ULT2.pulso`,
`Hostigamiento PUCP 2025_BD Aulas Agendadas-6.xlsx`,
`HSVG2026_comparacion_ULT1_vs_ULT2_27_08_26.xlsx`.

La pregunta que este documento contesta no es «cuántas aulas se cayeron el año
pasado», sino la que pidió Gonzalo: **con las aulas que tengo agendadas en cada
facultad y la tasa de efectividad que supongo, ¿llego a la cuota?** La caída deja
de ser un parámetro de planificación en cuanto se llama al 100 % de titulares
antes de que abra el campo; lo que queda es una pregunta de suficiencia.

---

## 1. Qué pasó de verdad en 2025

### 1.1 El criterio operativo era el 70 %, y no se cumplió

El libro de 2025 trae en «Tabla - Resumen» una columna literal: **`70% POBLACIÓN`**,
al lado de `ENCUESTAS VALIDAS` y `FALTANTES CUOTA`. Ése era el listón por aula.

| | 2025 |
|---|---|
| aulas con datos | 145 |
| **llegaron al 70 % de su población** | **45 (31 %)** |
| no llegaron | **100 (69 %)** |
| rendimiento mediano real | **55,6 %** de la población |
| media | 59,0 % · rango 10 % – 129 % |

**El 70 % fue la excepción.** Dos de cada tres aulas quedaron por debajo, y el aula
mediana rindió 55,6 %. Un listón que falla el 69 % de las veces no es un umbral
de alarma: es un pronóstico equivocado, y dispara reemplazos que no siempre
hacían falta.

### 1.2 «Reemplazo» cubría dos operaciones distintas

De los 170 titulares:

| | n |
|---|---|
| el titular **no se aplicó** y entró otro en su lugar — *sustitución* | **21** |
| el titular **sí se aplicó** y además entró otro — *refuerzo* | **25** |
| se aplicó solo | 124 |

Las 19 marcadas «EN RESERVA 1» **se aplicaron y además consumieron reserva**: son
refuerzo puro. Mezclarlas con las sustituciones es lo que hace que la «tasa de
caída» no se pueda definir: son dos preguntas con dos denominadores.

- **Sustitución** responde a «el aula no ocurrió» → 21/170 = **12,4 %**.
- **Refuerzo** responde a «el aula ocurrió pero rindió poco» → y eso es el 69 %
  que no llegó al 70 %.

### 1.3 El resultado global de 2025, para calibrar expectativas

De la hoja «Progreso General»:

| | 2025 |
|---|---|
| MUESTRA | **2.500** |
| SOBREMUESTRA | **3.750** |
| aulas | 170 |
| logrado | **3.304** |
| sobre la muestra | **132 %** |
| sobre la sobremuestra | **88 %** |

Son **las mismas dos varas de 2026**. En 2025 se superó la muestra con holgura y
se quedó cerca de la sobremuestra — con 170 aulas y un rendimiento mediano del
55,6 %.

### 1.4 Lo que se pudo haber hecho mejor

- **El listón del 70 % estaba mal puesto.** Calibrado sobre el rendimiento real
  habría estado en ~56 %, y entonces «no llegó a lo esperado» habría señalado a
  las aulas de verdad flojas en vez de a dos tercios del operativo.
- **El motivo del reemplazo no se registró como dato.** Las `OBSERVACIONES` son
  texto libre sobre el contacto («no contesta», «casilla de voz»), no sobre por
  qué se repuso un aula. Hoy el motivo sólo se puede inferir del comportamiento.
- **El libro no distingue sustitución de refuerzo.** Ambas cosas consumen reserva
  y ambas aparecen igual, lo que impide medir cualquiera de las dos.
- **`FECHA.DE.LLAMADA` registra cuándo se logró contactar, no cuándo se decidió
  llamar.** Los llamados «tarde» son en realidad los difíciles de alcanzar: 88 %
  de ellos necesitó más de un intento, contra 41 % de los tempranos. Leerlo como
  una decisión del equipo invierte la causa.

---

## 2. El diseño de 2026 ya aprendió lo principal

**No supone una tasa plana: supone una por facultad, y cada una calza con su
propia historia.** Decir «el diseño supone 55,7 %» —como escribí primero— es el
mismo error que reportar el rendimiento global: la mediana esconde que en 2025
la facultad fue de **41,1 % a 91,2 %**, un factor de 2,2×.

| facultad | supone 2026 | rindió 2025 | delta |
|---|---:|---:|---:|
| ESTUDIOS GENERALES CIENCIAS | 41,3 % | 41,1 % | **−0,2** |
| ESTUDIOS GENERALES LETRAS | 43,1 % | 46,3 % | +3,2 |
| CIENCIAS E INGENIERIA | 52,7 % | 51,9 % | −0,8 |
| CIENCIAS SOCIALES | 53,2 % | 52,2 % | −1,0 |
| ARTE Y DISEÑO | 56,7 % | 58,2 % | +1,4 |
| DERECHO | 57,0 % | 58,1 % | +1,0 |
| PSICOLOGÍA | 68,9 % | 69,7 % | +0,7 |
| LETRAS Y CIENCIAS HUMANAS | 80,0 % | 77,4 % | −2,6 |

Las divergencias grandes están **sólo donde 2025 tenía dos a seis aulas** —
Gastronomía +22,2 (n=2), Arquitectura +20,2 (n=6), Contables +14,5 (n=2)—, o sea
donde el ruidoso es el dato histórico, no el supuesto. Y todas van en dirección
conservadora: el diseño espera menos de lo que 2025 entregó.

Con el rendimiento de 2025, **ninguna facultad se queda corta en valor
esperado**. El riesgo no está en la media: está en la varianza (§ 3.5).

---

## 3. Suficiencia por facultad — ULT2

Cuota del escenario activo (2.500 repartidos por facultad y sexo) contra lo que
el diseño espera cosechar de los titulares.

| facultad | tit | cuota | esperado | holgura | reservas | prof. | extra |
|---|---:|---:|---:|---:|---:|---:|---:|
| ESTUDIOS GENERALES LETRAS | 20 | 397 | 441 | **+11 %** | 128 | 6,4 | 0 |
| ESTUDIOS GENERALES CIENCIAS | 22 | 403 | 469 | **+16 %** | 121 | 5,5 | 0 |
| DERECHO | 19 | 363 | 424 | **+17 %** | 209 | 11,0 | 42 |
| PSICOLOGÍA | 6 | 75 | 95 | +27 % | 48 | 8,0 | 0 |
| CIENCIAS Y ARTES DE LA COMUN. | 7 | 84 | 107 | +27 % | 77 | 11,0 | 3 |
| GESTIÓN Y ALTA DIRECCIÓN | 7 | 105 | 134 | +28 % | 42 | 6,0 | 0 |
| CIENCIAS E INGENIERIA | 37 | 528 | 675 | +28 % | 314 | 8,5 | 0 |
| CIENCIAS SOCIALES | 12 | 149 | 193 | +29 % | 45 | **3,8** | 0 |
| ARQUITECTURA Y URBANISMO | 8 | 125 | 165 | +32 % | 11 | **1,4** | 0 |
| ARTE Y DISEÑO | 15 | 119 | 184 | +55 % | 83 | 5,5 | 0 |
| LETRAS Y CIENCIAS HUMANAS | 4 | 23 | 37 | +60 % | 6 | **1,5** | 0 |
| ARTES ESCÉNICAS | 8 | 64 | 104 | +63 % | 50 | 6,2 | 0 |
| CIENCIAS CONTABLES | 3 | 20 | 38 | +92 % | 7 | **2,3** | 0 |
| GASTRONOMÍA, HOTELERÍA Y TURISMO | 3 | 21 | 41 | +94 % | 18 | 6,0 | 0 |
| EDUCACION | 3 | 24 | 50 | +107 % | 14 | 4,7 | 0 |
| **TOTAL** | **174** | **2.500** | **3.158** | **+26 %** | **1.173** | **6,7** | **45** |

### 3.1 Las tres facultades más grandes son las de margen más fino

Estudios Generales Letras (+11 %), Estudios Generales Ciencias (+16 %) y Derecho
(+17 %) suman **61 de 174 aulas y 1.163 de los 2.500** — **el 47 % del estudio
descansa sobre los tres márgenes más estrechos**. Si el rendimiento cae unos
pocos puntos por debajo del supuesto, fallan éstas primero y arrastran casi la
mitad de la muestra.

### 3.2 Los extras existen sólo en dos facultades

**42 de los 45 extras están en DERECHO** y 3 en Comunicaciones. **Trece de las
quince facultades no tienen ninguno** — y no es de este sorteo: en ULT1 pasaba
lo mismo (65 en Derecho, 14 en Comunicaciones, cero en el resto).

Esto choca de frente con la función que se les pide: «me faltan hombres aquí,
mujeres allá, uso un extra». **Para trece facultades esa palanca no existe.** Si
a Arte y Diseño le falta cierre por sexo, no hay extra que activar.

### 3.3 La profundidad de reserva incumple su propio objetivo

`objective.reserve_depth_target = 6`. Contra eso:

- **Arquitectura y Urbanismo: 1,4** (11 reservas para 8 titulares) y cero extras.
- **Letras y Ciencias Humanas: 1,5** (6 reservas para 4 titulares) y cero extras.
- **Ciencias Contables: 2,3** · **Ciencias Sociales: 3,8**.

Frente a Derecho y Comunicaciones con **11,0**. La reserva no está donde el
riesgo está: está donde el marco tenía sobrante.

### 3.4 El cruce que importa

Combinando margen y profundidad, el riesgo no está donde parece:

- **Margen fino pero bien surtidas** — EEGG Letras (+11 %, prof. 6,4) y EEGG
  Ciencias (+16 %, prof. 5,5): si cae un aula, hay con qué reponerla.
- **Margen holgado pero desnudas** — Arquitectura (+32 %, prof. **1,4**) y Letras
  y CCHH (+60 %, prof. **1,5**): el margen las protege de un rendimiento bajo,
  pero **no de una caída**. Dos aulas caídas en Arquitectura y no hay reposición.
- **La peor combinación** es Ciencias Sociales: +29 % de margen con profundidad
  3,8 y sin extras.

---

## 3.5 La dispersión también es por facultad, y sólo 5 la tienen estimable

Corrección de Gonzalo aplicada al segundo nivel: si la media del rendimiento es
por facultad, la **dispersión** también, y usar una σ global repite el error.

De las 15 facultades, sólo **5 tenían 10 o más aulas en 2025**, que es lo mínimo
para que su propia σ signifique algo. En las otras diez la incertidumbre sobre
la σ misma va de ±5 a ±17 pp — la σ de 3,4 % de Gastronomía sale de **dos**
aulas y la de 36,5 % de Educación, de cuatro. **Ahí se usa la global y se dice.**

| facultad | n 2025 | σ propia | ± de la σ | P(no llegar) global | **P propia** |
|---|---:|---:|---:|---:|---:|
| DERECHO | 12 | **14,3 %** | ±3 pp | 7,5 % | **0,7 %** |
| ESTUDIOS GENERALES LETRAS | 17 | **18,9 %** | ±3 pp | 22,9 % | **16,7 %** |
| ESTUDIOS GENERALES CIENCIAS | 22 | 24,9 % | ±4 pp | 14,2 % | 14,6 % |
| CIENCIAS SOCIALES | 12 | 24,3 % | ±5 pp | 4,9 % | 4,8 % |
| CIENCIAS E INGENIERIA | 28 | 24,7 % | ±3 pp | 0,3 % | 0,3 % |

**La σ global sobreestimaba el riesgo de Derecho diez veces.** Es la facultad
más consistente del estudio (σ 14,3 contra 24,5 global) y el promedio la
castigaba por la varianza de otras.

**Estudios Generales Letras sigue primera aun con su σ más baja**: su problema no
es la dispersión sino el margen de +11 %, que es menor que un error estándar.
Ninguna σ razonable lo arregla; lo arregla tener más aulas o aceptar el riesgo.

**Consecuencia para la superficie**: el riesgo por facultad se puede publicar con
σ propia sólo en cinco casos. En los otros diez hay que decir que se usa la
dispersión global, porque presentar una σ de dos aulas como si fuera propia sería
inventar precisión.

## 4. Qué tiene que contestar Monitoreo

De la doctrina de Gonzalo —llamar al 100 % de titulares antes de que abra el
campo, y a reemplazos y extras con la mayor anticipación posible— se sigue que la
alerta debe cambiar de forma:

**Hoy dice**: «pide 12 aulas en Gestión» — un número derivado de una tasa de
caída histórica que no se reproduce.

**Debe decir**: «en Gestión, con lo agendado llegas a la cuota el N % de las
veces; activando *k* reservas subes al M %». Y por sexo, porque la brecha casi
siempre es de un lado (medido: en las ocho facultades con más brecha falta más
mujer que hombre, hasta 53 contra 20).

Ingredientes que ya existen en el payload y no se usan para esto:
`efectivas_esperadas`, `rendimiento_ref`, `factor_facultad`,
`tasa_efectividad_aula` por aula, y la cuota por facultad y sexo del componente
activo.

Lo que falta declarar: **la dispersión del rendimiento**. El diseño trae la
media (55,7 %) pero no su varianza, y sin ella no hay probabilidad que calcular.
2025 da la evidencia para estimarla: rango observado 10 %–129 % sobre 145 aulas.

---

## 5. Pendientes que salen de este análisis

| # | Qué | Estado |
|---|---|---|
| S1 | **Los extras sólo existen en 2 de 15 facultades** — la palanca de cierre por sexo no existe para trece | ☐ |
| S2 | **La profundidad de reserva incumple su objetivo (6) en 4 facultades**, con Arquitectura en 1,4 | ☐ |
| S3 | **El 47 % de la muestra descansa en los tres márgenes más finos** | ☐ |
| S4 | **La dispersión del rendimiento no está declarada**, y sin ella no hay cálculo de probabilidad | ☐ |
| S5 | **El motivo del reemplazo no se registra como dato** — hoy sólo se infiere | ☐ |
| S6 | **El libro no distingue sustitución de refuerzo**, y son operaciones distintas | ☐ |
| S7 | **El componente activo declara 165 aulas y el sorteo tiene 174** — confirmado también en ULT2 | ☐ |

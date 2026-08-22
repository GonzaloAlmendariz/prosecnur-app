# Implicancias de retirar del marco los cursos-horario del estudio IAGen

Doc vivo. Abierto el 2026-08-22.

La Dirección de Asuntos Académicos aplicará su propia encuesta, correspondiente a un
estudio sobre inteligencia artificial generativa, en aulas de pregrado **entre el 31 de
agosto y el 11 de setiembre**, antes de nuestro levantamiento. El Director instruyó
retirar de nuestro marco los cursos-horario de su lista **antes de seleccionar**.

Este documento dimensiona qué perdemos con ese retiro, para poder decidir con cifras y no
con impresión. **No** propone la decisión: la registra y la mide.

## 1. Lo que se retira

De los **160 cursos-horario** de la lista de la DAA, **134 caen dentro de nuestro marco
elegible** de 2 616. Los otros 26 ya estaban fuera por nuestros propios criterios.

| Facultad | Aulas retiradas | Alumnos elegibles | Aulas que quedan | Necesarias (titulares + cadenas) | Holgura |
|---|---|---|---|---|---|
| CIENCIAS SOCIALES | 17 | 556 | 123 | 36 | +87 |
| DERECHO | 17 | 641 | 394 | 48 | +346 |
| ESTUDIOS GENERALES LETRAS | 16 | 673 | 315 | 104 | +211 |
| CIENCIAS E INGENIERIA | 14 | 465 | 564 | 120 | +444 |
| CIENCIAS Y ARTES DE LA COMUN. | 11 | 239 | 148 | 32 | +116 |
| PSICOLOGÍA | 10 | 240 | 74 | 18 | +56 |
| ARQUITECTURA Y URBANISMO | 9 | 251 | 71 | 44 | +27 |
| ARTES ESCÉNICAS | 9 | 153 | 83 | 45 | +38 |
| ESTUDIOS GENERALES CIENCIAS | 9 | 389 | 305 | 90 | +215 |
| GESTIÓN Y ALTA DIRECCIÓN | 8 | 238 | 89 | 35 | +54 |
| ARTE Y DISEÑO | 7 | 107 | 221 | 70 | +151 |
| CIENCIAS CONTABLES | 2 | 54 | 11 | 8 | +3 |
| EDUCACION | 2 | 81 | 25 | 15 | +10 |
| LETRAS Y CIENCIAS HUMANAS | 2 | 32 | 26 | 9 | +17 |
| GASTRONOMÍA, HOTELERÍA Y TURISMO | 1 | 57 | 33 | 12 | +21 |

**Total: 134 aulas (5,1 % del marco) y 4 176 alumnos elegibles (4,9 %).**

La lista aula por aula está en `aulas_retiradas.csv`, con código, curso, facultad,
elegibles y tramo de tamaño. **No lleva el nombre del docente**: son datos personales de
terceros y este documento se versiona. La versión con docente vive fuera del repositorio,
junto al inventario de la DAA.

## 2. Ninguna facultad se queda sin capacidad

La columna de holgura compara las aulas que quedan contra las que hace falta para sostener
los titulares de esa facultad **y sus cadenas de reemplazo completas**.

**Ciencias Contables es la más ajustada** y aun así le sobran 3 aulas: necesita 8 (2
titulares con profundidad 3) y le quedan 11. Su cupo por titular baja de 6,5 a 5,5 aulas
disponibles, que sigue siendo suficiente.

Ninguna facultad queda por debajo de lo que necesita.

## 3. La efectividad esperada no empeora

Las aulas de la DAA son **ligeramente más pequeñas** que el resto del marco: media de 31,2
alumnos elegibles contra 33,0, mediana de 28 contra 32. Como las aulas pequeñas rinden una
fracción mayor de sus elegibles, retirarlas deja un marco con proporcionalmente más aulas
de alto rendimiento.

| Facultad | Efectividad antes | Después | Cambio |
|---|---|---|---|
| GASTRONOMÍA, HOTELERÍA Y TURISMO | 0,6464 | 0,6679 | +3,3 % |
| EDUCACION | 0,6225 | 0,6411 | +3,0 % |
| CIENCIAS CONTABLES | 0,6131 | 0,6243 | +1,8 % |
| CIENCIAS SOCIALES | 0,5498 | 0,5543 | +0,8 % |
| ARTES ESCÉNICAS | 0,7069 | 0,7102 | +0,5 % |
| GESTIÓN Y ALTA DIRECCIÓN | 0,5382 | 0,5364 | −0,3 % |
| ARTE Y DISEÑO | 0,6197 | 0,6188 | −0,1 % |

El mayor cambio es **+3,3 % en Gastronomía**, a favor. El peor cambio en contra es
**−0,3 % en Gestión**, despreciable. Para las ocho facultades restantes el cambio está por
debajo de una décima de punto porcentual.

## 4. Lo que el retiro NO resuelve

### 4.1. El docente ya fue contactado aunque el aula sea otra

Retirar un curso-horario evita coincidir en ese salón, pero **no evita volver a tocar la
puerta del mismo docente**. La lista de la DAA involucra a **207 docentes**, y muchos
dictan más de un curso en el semestre.

Sobre la selección vigente:

- **20 de 190 titulares (10,5 %)** tienen un docente que ya figura en la lista de la DAA.
- De esos, **12 son aulas que el retiro elimina**, así que se resuelven solos.
- **8 quedan**: el aula no está en la lista, pero su docente sí.
- En las cadenas, **60 de 496 reservas (12,1 %)** están en la misma situación.

Los ocho titulares afectados solo por el docente:

| Código | Facultad | Elegibles |
|---|---|---|
| CH 9 | ARQUITECTURA Y URBANISMO | 21 |
| CH 18 | ARTE Y DISEÑO | 18 |
| CH 88 | CIENCIAS SOCIALES | 39 |
| CH 124 | ESTUDIOS GENERALES CIENCIAS | 64 |
| CH 118 | ESTUDIOS GENERALES CIENCIAS | 51 |
| CH 136 | ESTUDIOS GENERALES CIENCIAS | 29 |
| CH 151 | ESTUDIOS GENERALES LETRAS | 51 |
| CH 169 | ESTUDIOS GENERALES LETRAS | 16 |

Concentrados en **Estudios Generales Ciencias (3)** y **Estudios Generales Letras (2)**.

**Implicancia operativa**: a esos ocho docentes se les pedirá ceder una sesión de clase
pocos días después de haber cedido otra. No es un problema de diseño muestral sino de
gestión de campo, y conviene que Monitoreo lo sepa antes de coordinar: el riesgo no es
sesgo sino rechazo, y un rechazo consume la cadena de reemplazos.

**Lo que no está medido**: cuánto baja la probabilidad de aceptación de un docente ya
solicitado. No hay dato histórico para estimarlo, así que aquí se declara como riesgo y no
se cuantifica.

### 4.2. El estudiante ya respondió otra encuesta

Es el traslape que ningún criterio de aulas resuelve, porque ocurre en las personas y no en
los salones. **4 457 estudiantes, el 17,3 % del pregrado de las 15 facultades**, están
matriculados en al menos un curso de la lista de la DAA. Aun retirando esas aulas, el
**18,2 %** de los alcanzables por el marco restante ya habrá respondido su encuesta.

Y es muy desigual por facultad:

| Facultad | Ya expuestos |
|---|---|
| Ciencias Contables | 44 % |
| Ciencias Sociales | 41 % |
| Psicología | 37 % |
| Ciencias e Ingeniería | 11 % |
| Estudios Generales Ciencias | 10,5 % |

**Implicancia metodológica**: si la fatiga de encuesta reduce la respuesta, la pérdida no
será aleatoria sino que se concentrará en las facultades más expuestas. Eso es sesgo de
composición, no solo pérdida de tamaño, y la ponderación por probabilidad de selección no
lo corrige por sí sola.

## 5. Conclusión

**El retiro es viable y barato.** Cuesta el 5 % del marco, ninguna facultad pierde la
capacidad de sostener su muestra y sus reemplazos, y la efectividad esperada no baja.

**Lo caro es lo que queda fuera de su alcance**: ocho docentes a los que habrá que volver
con una segunda solicitud, y una exposición previa de los estudiantes que es tres o cuatro
veces mayor en unas facultades que en otras.

## 6. Decisiones pendientes

1. **Aplicar el retiro y volver a sortear.** El sorteo vigente se hizo sobre el marco
   completo y toca aulas de la lista.
2. **Qué hacer con los ocho titulares cuyo docente ya fue contactado.** Se pueden dejar y
   avisar a campo, o tratarlos como riesgo y priorizar su cadena de reemplazos.
3. **Si compensar o solo declarar** la exposición desigual de estudiantes por facultad.

## Fuentes

- Lista de la DAA: `Cursos_horario_Estudio IAGen_DAA_2026_info a OIGD.docx` (DAA / OGCE).
- Inventario cruzado: `HSTVG2026/Inventario_cursos_horario_IAGen_2026-2.xlsx`.
- Análisis previo del traslape: `docs/qa/traslape-iagen-hsvg-2026-08-21.md`.
- Marco y selección: `HSVG2026_definitivo.pulso` (2026-08-22).
- Listas generadas por este análisis: `aulas_retiradas.csv`, `titulares_docente_daa.csv`.

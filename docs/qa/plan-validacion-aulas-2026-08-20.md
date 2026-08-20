# Plan de 25 ticks — Monitoreo de aulas: Validación como instrumento

Encargo de Gonzalo, 2026-08-20: «necesitas diseñar desde ya un plan de
aproximadamente veinticinco ticks, porque lo que tienes que hacer es amplio y
creo que no lo estás planificando con ese nivel de largo plazo».

## La tesis que ordena el plan

**Validación es el instrumento de dos personas y hoy sólo sirve a una.**

- **El jefe de campo** entra por lo que sus aplicadores reportan del aula: qué
  encontraron, cuánto rindió cada uno, qué observaciones dejaron.
- **El analista** entra por lo que hay en plataforma: si coincide con lo que se
  vio en el aula, si el aula cumplió lo esperado, cuántas respuestas pasan la
  cadena de filtros, cuánto duran, y qué respuestas abiertas huelen mal.

Hoy la sección tiene dos pestañas —controles derivados y la hoja del equipo— y
las dos son del analista. El registro de campo acaba de entrar (`e310512c`).

## Estado de partida, medido

| | |
|---|---|
| Registro de campo | ya es la primera pestaña de Validación |
| Producción por aplicador | existe, pero enterrada como 4.º de 9 paneles en Avance › Rendimiento |
| Observaciones de los aplicadores | se escriben y **no se leen en ninguna pantalla** |
| Control de tiempos | **no existe**; el Excel anterior sí lo tenía |
| Calidad de texto abierto | **no existe en ningún perfil de Monitoreo** |
| Base de control | sin formato: 26 columnas crudas del Excel |
| Criterio de aula válida | declarable desde ayer; falta que juzgue y se vea |
| Agenda | tabla literal de 12 columnas, sin filtro por facultad |
| Reemplazo | sólo se activa dentro del formulario de un aula |

## Los 25 ticks

### A. Validación para el jefe de campo (T1–T6)

- **T1** — Las observaciones de campo a pantalla: hoy se escriben y nadie las
  lee. ~17 de 152 partes las traen en el corte.
- **T2** — Producción por aplicador **dentro de Validación**, no enterrada en
  Avance: efectivas por aula, y con su banda —con 6 equipos y 152 aulas las
  diferencias pequeñas son ruido—.
- **T3** — Calidad del trabajo por aplicador: rechazos, duplicados y descuadres
  del parte agregados por responsable. Hoy existen por aula y nadie los cruza.
- **T4** — Avance por facultad dentro de Validación, con el foco ya existente.
- **T5** — El parte de campo y la plataforma, cara a cara por aula: lo que el
  aplicador declaró contra lo que llegó. El motor ya cruza las dos hojas; falta
  el cruce con las respuestas.
- **T6** — Cierre de la sección: qué decide el jefe de campo aquí y qué no.

### B. Control de tiempos (T7–T11)

> **T7 ☑ MEDIDO (2026-08-20).** La base del estudio de aulas trae **43 columnas
> y UNA sola de tiempo**: `_submission_time`. **No hay `start` ni `end`**, así
> que no hay duración por respuesta. Y la ventana por aula que sí se puede
> calcular sale **constante: mediana 293 min y máximo 293**, porque el fixture
> siembra los tiempos con un patrón fijo — no distingue señal.
>
> **Dónde SÍ se puede construir y verificar**: el proyecto de referencia
> `acnur_acg` trae `start`, `end` y `_submission_time` sobre 1 732 respuestas.
> La lógica se escribe y se prueba contra él; en aulas la superficie **dirá que
> este estudio no trae tiempos** en vez de no existir, para que funcione sola el
> día que llegue un XLSForm que los declare.

- **T7** — ~~Medir qué trae la base.~~ Hecho: ver arriba.
- **T8** — Duración por respuesta: distribución, mediana y cola.
- **T9** — Duración por aula y por aplicador: dónde se responde demasiado rápido.
- **T10** — Umbral de sospecha declarable, con la misma doctrina que
  `aula_valida`: sin declarar, no juzga.
- **T11** — El tiempo en la ficha del aula, junto a su veredicto.

### C. Calidad de las respuestas abiertas (T12–T17)

Capacidad nueva que **no existe en ningún perfil** y que Gonzalo quiere
extensible a todos los monitoreos.

> **T12 ☑ MEDIDO (2026-08-20).** La base del estudio de aulas **no tiene ni una
> pregunta de texto abierto**: de sus 43 columnas, sólo tres son de texto
> —`_submission_time`, `collectorID` y `sexo`— y el `.pulso` **no trae
> instrumento**. Aquí no hay nada que inventariar.
>
> **Dónde SÍ**: `acnur_acg` trae **~22 columnas de texto abierto y su
> instrumento**; `acnur_pdm` ~14 y `acrconta` ~11. La capacidad se construye
> contra `acnur_acg` —que es además el que permite verificar las señales— y se
> hereda por contrato, que es lo que Gonzalo pidió.

- **T12** — ~~Inventario.~~ Hecho: ver arriba.
- **T13** — Señales objetivas por respuesta: longitud, repetición literal,
  teclado seguido, una sola palabra, copia entre casos.
- **T14** — Vista de lectura: leer muchas respuestas rápido, agrupadas por
  señal. **Es un visualizador, no un diagnóstico automático.**
- **T15** — Por aplicador y por aula: quién concentra las respuestas malas.
- **T16** — Marcar casos para invalidar, con su trazabilidad.
- **T17** — Pestaña propia en Validación y contrato para que otros perfiles la
  hereden.

### D. Indicadores por aula (T18–T21)

- **T18** — El criterio de aula válida juzga de verdad: veredicto propio contra
  el de la hoja, con el contraste ya escrito.
- **T19** — La cadena de filtros por aula: cuántas respuestas caen en cada
  filtro declarado. Hoy sólo hay el total.
- **T20** — Ficha de aula: un aula, todo lo suyo —lo esperado, lo conseguido, el
  parte, los tiempos, las abiertas—.
- **T21** — «Si no llegó a lo suyo, ¿de dónde se saca?»: enlazar el déficit del
  aula con el banco y la cola de cierre.

### E. Forma y arquitectura (T22–T25)

- **T22** — Base de control con formato: 26 columnas crudas es lo más literal
  que queda del Excel.
- **T23** — Agenda deja de ser la traducción de 12 columnas: filtro por facultad
  y lo que decide quien llama.
- **T24** — El reemplazo, alcanzable sin entrar al formulario de un aula.
- **T25** — Pasada de forma sobre Validación entera, con el gate visual en los
  dos viewports.

## Lo aprendido al medir (2026-08-20)

**Los dos bloques que parecían más ambiciosos no estaban bloqueados: estaban en
otro proyecto.** Medir antes de construir ahorró diseñar cinco ticks contra una
base sin `start`/`end` y seis contra una sin preguntas abiertas — y encontró
dónde sí se pueden verificar.

De ahí una regla que este plan adopta: **cuando el fixture del perfil no sostiene
una capacidad, buscar en los proyectos de referencia antes de declararla
bloqueada.** Hay cinco y no todos traen lo mismo.

Y la contraria, igual de importante: **una capacidad verificada contra otro
proyecto no está verificada en éste.** En aulas, las dos superficies tendrán que
decir «este estudio no trae eso» — que es información, no un hueco.

## Reglas de este plan

1. **Primero la finalidad, después el píxel.** Cada superficie declara a quién
   sirve y qué decide.
2. **Medir antes de diseñar.** Varios ticks empiezan por comprobar si el dato
   existe; si no, es deuda declarada y no se fabrica.
3. **Nada de fallbacks callados.** Sin vara, «sin juzgar».
4. El orden es una propuesta, no un contrato: Gonzalo puede reordenar.

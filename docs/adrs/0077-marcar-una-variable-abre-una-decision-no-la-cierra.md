# ADR 0077 — Marcar una variable abre una decisión, no la cierra

- **Estado**: Propuesto
- **Implementación**: No iniciada
- **Ámbito**: Codificación · gate de avance a Analítica · vocabulario de decisiones
- **Fecha**: 2026-08-15
- **Relación**: aplica a Codificación la misma regla que
  [ADR 0075](0075-una-base-validada-es-una-base-sin-hallazgos-sin-decidir.md)
  fijó para Validación.

## Contexto

En Codificación, **marcar** una variable declara la intención de codificarla.
Nada más ocurre después si el analista no crea las categorías: el módulo aplica,
entrega, y la variable sale sin recodificar sin que nadie lo diga.

### El estado con que llegó ACNUR V3

```
variables marcadas para codificar:     9
variables con categorías definidas:    3
```

Seis marcadas sin categorías, y dentro de esas seis conviven **tres situaciones
que hoy se ven exactamente igual**:

| Situación | Ejemplo en ACNUR V3 | Qué es |
|---|---|---|
| Marcada, sin respuestas que codificar | `ExpSatisfaction_why`, `RecomendSatisfaction_text` (0 respuestas) | Nada que hacer, y está bien |
| Marcada, con respuestas, sin categorías | `MesesReva` (87), `NowSalary` (16), `PastSalary` (4), `GeneralSatisfaction_why` (1) | Trabajo pendiente que nadie vio |
| Catálogo creado, respuestas sin asignar | `Sos_desarrollo`: 6 opciones declaradas, **12 respuestas abiertas, 0 asignadas** | Trabajo empezado y abandonado |

El tercer caso entra por otra puerta y conviene no confundirlas: `Sos_desarrollo`
**no está marcada**. Las preguntas cerradas con «Otro (especificar)» las detecta
el módulo solo, sin que nadie las declare. Así que el pendiente puede nacer de
una intención declarada a mano o de una detección automática, y el contador
tiene que ver las dos.

Las tres se presentan como «marcada sin grupos». El módulo no distingue entre
«no hay nada que hacer» y «nadie lo hizo», que es la misma confusión que el
ADR 0075 resolvió para Validación.

### La decisión legítima que hoy no se puede expresar

Al revisar este entregable decidimos **no categorizar** `NowSalary` ni
`PastSalary`: la primera tiene 16 respuestas y la segunda 4, y ninguna soporta
tramos que se puedan cruzar. Es una decisión metodológica correcta y deliberada.

No tiene dónde vivir. La próxima persona que abra el proyecto verá dos
variables marcadas sin categorías y **no podrá distinguir nuestra decisión de un
olvido**. La única salida disponible hoy sería desmarcarlas, que borra la
intención y con ella el rastro de que alguien lo evaluó.

Es el mismo hueco que el ADR 0075 nombró para Validación: «conservar es una
decisión válida y se registra». Acá falta el equivalente.

## Decisión

**Una codificación está completa cuando no le quedan variables marcadas sin
decidir.** No cuando todas las marcadas tienen categorías.

1. **Marcar declara una intención y abre una decisión.** Cerrarla exige una de
   cuatro, y cualquiera de las cuatro la cierra:
   - **categorizar** — crear las categorías y asignar las respuestas;
   - **no categorizar, con motivo** — la variable se entrega sin recodificar y
     el motivo queda escrito;
   - **desmarcar** — la intención se retira, y eso también es una decisión que
     se registra;
   - **sin material** — no hay respuestas que codificar. Es la única que **se
     cierra sola**, porque no hay nada que decidir.

2. **«No categorizar» es una decisión de primera clase.** Se registra con su
   motivo, viaja en el `.pulso` y se puede reportar. Un `n` insuficiente, una
   variable que se analiza como continua o una que el cliente pidió cruda son
   razones legítimas, y el proyecto debe conservarlas.

3. **Un catálogo con respuestas sin asignar está sin decidir.** Crear las
   categorías no cierra nada por sí solo: lo que cierra es que cada respuesta
   tenga destino, aunque ese destino sea «Otros».

4. **El estado se comunica como número accionable.** «Te quedan 3 variables
   marcadas sin decidir», con cuántas respuestas tiene cada una. No un semáforo
   ni un porcentaje de avance.

5. **Aplicar con pendientes advierte y no bloquea.** Al aplicar, el módulo
   declara qué variables se van a entregar sin recodificar. Bloquear repetiría
   el error que el 0075 corrigió: un gate que se satisface apagando la
   verificación no es un gate, y aquí desmarcar sería el equivalente de apagarla.

## Consecuencias

**Para el analista.** El pendiente se ve. Hoy la única forma de descubrir que
seis variables declaradas no produjeron nada es abrir la base entregada y
buscar las columnas `_recod` que faltan.

**Para el proyecto.** Conserva el porqué. Que `NowSalary` no esté categorizada
deja de ser un vacío y pasa a ser «no se categorizó por n insuficiente», que es
información metodológica que hoy se pierde entre sesiones y entre personas.

**Para el entregable.** El libro de códigos puede declarar qué variables se
decidieron no categorizar y con qué motivo, en vez de que su ausencia se lea
como un olvido del equipo.

**Costo: distinguir «sin material» exige mirar la data, no solo el estado.** El
módulo tiene que contar respuestas por variable para saber si una marcada sin
categorías es un pendiente o un cierre automático. Es la misma lectura que ya
hace el codificador para mostrar la lista de respuestas, pero hoy no alimenta
ningún contador.

**Riesgo: convertirlo en gate bloqueante.** Si «no le quedan variables sin
decidir» pasa a impedir el avance, el atajo será desmarcar todo, y el módulo
quedará peor que ahora: sin intención declarada y sin rastro de que alguien
miró. La advertencia debe informar, no frenar.

**Lo que no cambia.** Marcar sigue siendo libre y reversible, y una variable sin
marcar no entra en ningún conteo. La decisión solo aplica a lo que alguien
declaró que iba a codificar.

## Cumplimiento

- **Invariante 1 — el pendiente se cuenta.** Una variable marcada, con
  respuestas y sin categorías aparece en el contador de pendientes. Verificable
  con el estado inicial de ACNUR V3: de las 9 marcadas debía reportar **4
  pendientes** —`MesesReva` (87 respuestas), `NowSalary` (16), `PastSalary` (4)
  y `GeneralSatisfaction_why` (1)— y no 6.
- **Invariante 2 — sin material no es pendiente.** Una marcada con cero
  respuestas no aparece en el contador. `ExpSatisfaction_why` y
  `RecomendSatisfaction_text` no deben contarse nunca.
- **Invariante 3 — el catálogo a medias cuenta.** `Sos_desarrollo` con seis
  opciones y doce respuestas sin asignar aparece como pendiente, no como
  resuelto por tener grupos.
- **Invariante 4 — la decisión sobrevive.** «No categorizar» con su motivo se
  guarda en el `.pulso` y se recupera al reabrir el proyecto.
- **Invariante 5 — aplicar deja constancia.** La respuesta de
  `/api/codificacion/aplicar` declara qué variables se aplicaron sin
  recodificar, y ese dato queda disponible para el libro de códigos.

## Notas

Medición de partida, `ACNUR V3` (PDM Medios de Vida 2026, 103 casos):

```
marcadas                              9
  con categorías                      3   ContextProfesion, reva_sit_why, psico_empleador_why
  pendientes (con respuestas)         4   MesesReva 87 · NowSalary 16 · PastSalary 4 · GeneralSatisfaction_why 1
  cierre automático (sin respuestas)  2   ExpSatisfaction_why, RecomendSatisfaction_text
detectadas automáticamente
  con catálogo a medias               1   Sos_desarrollo: 12 respuestas, 0 asignadas
```

Ninguna de las cinco pendientes avisó nada al aplicar, y todas se entregaron sin
recodificar en la primera versión del entregable.

La cuarta, `Sos_desarrollo`, es el caso más elocuente: tenía su catálogo
completo con las seis opciones del instrumento y **ninguna de sus doce
respuestas abiertas asignada**. Visto desde el estado, parecía trabajo hecho.

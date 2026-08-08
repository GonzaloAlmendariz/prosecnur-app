# ADR 0067 — La selección de aulas se puede contar como una película, y cada cuadro es un hecho

- **Estado**: aceptada
- **Implementación**: no iniciada (este ADR habilita y gobierna; la construcción es un trabajo de la Rama 2 con su propio QA)
- **Fecha**: 2026-08-07
- **Contexto previo**: ADR 0044 (direcciones canónicas), ADR 0057 (tarjeta de categoría), ADR 0058 (matriz de cascada — el orden del motor manda), ADR 0060 (vocabulario del embudo), **ADR 0066 (la probabilidad publicada es la del sorteo ejecutado — este ADR es su extensión narrativa)**.

## Contexto

La selección de aulas es el acto más delicado del módulo: de ella dependen la
representatividad de la muestra y la defensa del diseño ante un comité. Hoy su
resultado se entrega como tablas y fichas (Titulares, Sustento), correctas pero
mudas sobre el **proceso**: cómo el marco se volvió embudo, el embudo estratos,
los estratos cuotas, las cuotas probabilidades y las probabilidades un sorteo
con titulares y cadenas de reemplazo. Quien no diseñó el motor no puede *ver*
que el procedimiento fue limpio; solo puede creer en la tabla final.

Existe además la materia prima exacta para contarlo: el motor ya persiste el
`selection_run_id`, la semilla, el engine efectivo, las π por aula, el orden de
selección del descuento secuencial (`discount_step`, netos «al momento de su
selección»), los ajustes de tamaño divulgados (`size_adjustment`), las olas
M1–M12 y las advertencias metodológicas. Un relato animado no necesita inventar
nada: necesita **reproducir** lo que el motor ya declaró.

El riesgo que este ADR gobierna es el opuesto: que la animación se vuelva
decoración — dados que giran, barajas que se mezclan, aleatoriedad teatral que
*no corresponde* al mecanismo ejecutado. Eso violaría el espíritu del ADR 0066
en la capa visual: mostraría un sorteo que no ocurrió.

## Decisión

Se autoriza una superficie de reproducción — **el Relato de la selección** —
que narra de forma animada y cinemática el proceso de selección de aulas,
con lente por facultad. Sus reglas:

### 1. Cada cuadro es un hecho del sorteo ejecutado

El relato se alimenta **exclusivamente** de la corrida real persistida
(`selection_run_id` + frame): π publicadas, orden de selección, pasos del
descuento, certezas, ajustes divulgados, olas y advertencias. Corolarios:

- **El relato nunca re-sortea.** No hay `Math.random()` narrativo, no hay
  «simulación visual» de un azar distinto del ejecutado. Si se anima la
  incertidumbre de un aula antes de resolverse, la resolución mostrada es la
  real y su π aparece al lado.
- **Una certeza entra sin sorteo, y se dice.** Un aula con π = 1 no participa
  de ninguna animación de azar: entra declarada como certeza.
- **Lo que no dejó rastro no se dramatiza.** Si un paso del proceso no tiene
  dato auditable (p. ej. una corrida vieja sin `discount_step`), el relato
  declara el hueco («esta corrida no registró el orden del sorteo») en vez de
  inventar una secuencia plausible.
- **El orden de las escenas es el orden del motor** (ADR 0058): marco →
  criterios/embudo → estratificación y cuotas → probabilidades → sorteo →
  titulares y cadenas → pesos. La superficie no reordena por estética.

### 2. El lente es la facultad

El relato completo cubre el estudio; el **foco por facultad** es la vista de
trabajo: qué aporta esa facultad al marco, qué le quitó cada criterio, qué
cuota le tocó y por qué, qué aulas entraron con qué π, y qué cadena de
reemplazos la respalda. El foco se publica en la dirección (`foco=<facultad>`),
así el relato de una facultad concreta es enlazable y compartible.

### 3. Dirección canónica y navegación v3

El relato vive como **pestaña `aulas-relato` de la sección Selección** del modo
`opinion-universitaria`, declarada en el catálogo de navegación
(`lib/navegacion/catalogos/calcMuestra.ts`), nunca como overlay suelto ni
duplicando navegación:

```
/calc-muestra?modo=opinion-universitaria&seccion=aulas&pestana=aulas-relato&foco=<facultad>
```

El deep-link + `selection_run_id` hacen el relato **reproducible**: dos
personas que abren la misma dirección ven la misma película, cuadro a cuadro.

### 4. Gramática cinemática

- **Escenas, no scroll**: el relato avanza por escenas discretas con línea de
  tiempo visible; controles de reproducir / pausar / anterior / siguiente /
  arrastrar (scrub). El usuario siempre sabe en qué escena está y cuántas hay.
- **Las transiciones significan.** Entrar al bombo, salir por un criterio
  (con el criterio nombrado), quedar de titular, quedar de reserva M2–M12:
  cada movimiento visual corresponde a un evento del dato y lleva su cifra al
  lado (π al entrar, neto del descuento en su paso, causa de exclusión).
- **Duración acotada**: el relato de una facultad se reproduce completo en
  ≤ 60 segundos; el del estudio completo, en ≤ 3 minutos. La densidad se
  resuelve agregando (p. ej. «42 aulas salen por el criterio de nivel» como un
  solo movimiento), nunca acelerando hasta lo ilegible.
- **Cero prosa que no sea dato** (mandato S3 del loop de superficie): la
  narración escrita de cada escena dice números y causas, no afordancias.

### 5. Accesibilidad y degradación

- **`prefers-reduced-motion` es de primera clase**: degrada a un modo
  paso-a-paso estático (las mismas escenas, mismos datos, sin movimiento). El
  contenido completo del relato debe poder *leerse* sin animación — la
  animación es una forma de presentación, jamás la única portadora del dato.
- Controles operables por teclado; el scrub tiene equivalente discreto.
- El relato corre sobre datos **ya calculados** (la selección persistida): no
  dispara jobs, no recalcula, no bloquea el hilo de Plumber.

### 6. Contrato de Superficie

- **C1**: se declara superficie de reproducción («relato de la corrida
  `<selection_run_id>`»), con su geometría declarada.
- **C2/C3**: sin selección persistida, el vacío nombra la pieza que falta y
  dirige a Selección (resolutor común `aulasSurfaceState`, al que se agrega la
  etapa `relato`); un marco enorme no rompe el marco visual (agregación).
- **C4**: todo alcanzable — escenas, foco por facultad y controles.
- **C5**: el relato entrega lo que su función promete: es el **sustento
  narrado**. Los números que muestra son los mismos de Sustento y Titulares
  (mismo `selection_run_id`); divergir en una cifra es un defecto, no un
  matiz. `revisor-metodologico` revisa C5 en su construcción.

### 7. Fuera de alcance de este ADR

- Exportar el relato como video/GIF o incluirlo en entregables de oficina
  (decisión futura; hoy el entregable es el deep-link reproducible).
- Animar la **comparación de métodos** (sus π son referenciales — ADR 0066);
  el relato narra únicamente la corrida seleccionada.
- Cualquier narración de datos de campo (eso pertenece a Monitoreo).

## Consecuencias

- La pestaña nueva entra al catálogo v3 y al QA contract (`data-audit-ready`);
  la matriz de viewports estándar aplica (1710×1107 … 1024×600).
- El motor no cambia: todo lo que el relato necesita ya se publica. Si durante
  la construcción faltara un dato de auditoría, el camino correcto es
  publicarlo desde el motor con su test — nunca derivarlo en el cliente
  (regla del veto I20, que este ADR hereda).
- La construcción es trabajo de la Rama 2 (revamp-visual + `emil-design-eng`
  para las microinteracciones + `qa-visual-desktop` + `revisor-metodologico`
  para C5), con los motion tokens de la identidad (`branding/`).
- Corridas viejas sin auditoría fina (sin `discount_step`/`size_adjustment`)
  reproducen un relato más grueso con sus huecos declarados.

## Cumplimiento

1. **Cero azar decorativo**: test de contrato que verifica que el código del
   relato no usa `Math.random()` ni genera orden de eventos propio — el orden
   viene del dato (`discount_step`/`orden`/olas) o se declara ausente.
2. **Paridad de cifras con Sustento**: test que compara los números publicados
   por el relato contra la selección persistida del mismo `selection_run_id`.
3. **Reduced motion**: test del modo estático (mismas escenas y datos con
   `prefers-reduced-motion`).
4. **Dirección canónica**: la pestaña resuelve por
   `modo/seccion/pestana/foco`; ningún alias nuevo se escribe (ADR 0044).
5. **Vacíos gobernados**: la etapa `relato` entra al resolutor común de la
   sección Selección (`aulasSurfaceState`), no a un `EmptyState` suelto.

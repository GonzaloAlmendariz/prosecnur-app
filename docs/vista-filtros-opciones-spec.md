# Vista «Filtros de opciones» — plan de diseño

**Estado:** propuesta (no implementada)
**Ámbito:** editor XLSForm de Prosecnur — vista dedicada, independiente del *Mapa de lógica*
**Fecha:** 2026-07-16

---

## 1. Propósito y alcance

Muchos instrumentos condicionan las **opciones** de una pregunta a lo que la persona
respondió antes. En el estudio HSyVbG PUCP, la pregunta «¿Cuál de estas formas de
violencia te afectó en mayor medida?» (P21) no ofrece las siete formas posibles: ofrece
únicamente las que la persona indicó haber vivido en las preguntas previas (P14–P20). En
la nomenclatura XLSForm esto es un `choice_filter`; para quien diseña el estudio es, más
llanamente, una **lógica de gatillo**: una respuesta previa habilita una opción posterior.

Esta lógica hoy existe, se lee y se valida en el backend, pero no se explica en ninguna
parte de forma legible. El *Mapa de lógica* representa bien los saltos de visibilidad
(`relevant`) entre preguntas, pero mezclar en él las cascadas de opciones lo vuelve
denso y confunde dos ideas distintas —"qué preguntas aparecen" frente a "qué opciones
aparecen"—. Por eso esta vista es **separada**: el *Mapa de lógica* conserva su propósito;
los filtros de opciones tienen el suyo.

El alcance es una vista **de solo lectura y explicativa**. No sustituye al editor de
`choice_filter` (que seguirá viviendo en el panel de la pregunta); su función es que
cualquier persona —metodóloga, coordinadora, revisora— entienda de un vistazo qué
condiciona a qué, sin leer una sola fórmula.

## 2. Principio rector

**El lenguaje humano precede al meta-texto.** La vista se construye sobre las *etiquetas*
de las preguntas y de las opciones, redactadas como las lee el encuestado. Los códigos
(`P21`, `expresion_vbg`), las columnas de filtro (`filter_P14`) y la expresión cruda
(`filter_P14=${P14} or …`) son información de segundo plano: existen, se pueden consultar,
pero nunca encabezan ni compiten con el texto humano. Todo lo técnico se ofrece detrás de
un gesto explícito ("ver regla técnica"), en tipografía atenuada.

Este principio es la prueba de diseño de toda la vista: si una pantalla obliga a leer un
código para entender la idea, está mal resuelta.

## 3. Vocabulario

| Concepto | Cómo se nombra en la vista | Término técnico (atenuado) |
|----------|----------------------------|----------------------------|
| La vista | **Filtros de opciones** | `choice_filter` |
| La relación | «se habilita según» / «depende de» | expresión de filtro |
| La pregunta que condiciona | **antecedente** (la respuesta previa) | variable `${…}` |
| La opción condicionada | **opción habilitada** | fila de `choices` con columna filtro |

El término «gatillo» es útil como intuición interna, pero en pantalla se prefiere la
lectura causal serena: *tal respuesta previa habilita tal opción*.

## 4. Ubicación

Entrada propia en el menú de vistas del editor (junto a *Mapa de lógica*), como overlay a
pantalla completa. Nunca como segunda barra dentro del editor: es una vista hermana, no un
nivel de navegación nuevo. Respeta la jerarquía canónica (Módulo → Sección → Pestaña) sin
introducir un cuarto nivel.

## 5. Modelo conceptual

La lógica de gatillo se lee como una relación **antecedente → opción habilitada**:

> *Si la persona respondió [antecedente], entonces puede elegir [opción].*

La vista traduce cada filtro a esa oración. En el caso de HSyVbG la correspondencia es
uno a uno y transparente, porque cada forma de violencia listada en P21 corresponde a una
pregunta previa concreta:

| Si la persona reportó… (antecedente) | …puede elegir esta forma (opción habilitada) |
|--------------------------------------|----------------------------------------------|
| «Alguien te tocó, manoseó o besó sin que lo desearas» | «Contacto físico sexual no deseado» |
| «Alguien te obligó a mantener relaciones sexuales mediante la fuerza» | «Relación sexual forzada» |

*(Las etiquetas de la derecha son ilustrativas: se toman literalmente de la lista de
opciones del instrumento; no se redactan ni se resumen con criterio propio.)*

Esa tabla es el corazón de la vista. No hay fórmula a la vista, no hay código: hay dos
frases humanas y una relación entre ellas.

## 6. Anatomía de la vista

Una pila vertical de **fichas**, una por cada pregunta que filtra sus opciones. Cada ficha
tiene cuatro estratos, de lo humano a lo técnico:

1. **Contexto** — la sección a la que pertenece («Violencia basada en género»), como
   antetítulo discreto. Orienta sin gritar.
2. **La pregunta** — su etiqueta completa, tal como la lee el encuestado. Es el título de
   la ficha. El código de la pregunta, si se muestra, va detrás de la etiqueta, atenuado.
3. **La explicación en una frase** — redactada en lenguaje natural:
   *«Solo se ofrecen las formas de violencia que la persona indicó haber vivido en las
   preguntas anteriores.»* Esta frase se genera a partir de la estructura, pero se lee como
   la escribiría una persona; se cuida que no suene a plantilla ni a texto de máquina.
4. **La correspondencia** — la tabla antecedente → opción de la sección 5, que es donde el
   lector realmente entiende el filtro.

Al pie, un único gesto opcional: **«Ver regla técnica»**, plegado por defecto. Al abrirlo
aparece la expresión cruda (`filter_P14=${P14} or …`) y los códigos, en monoespaciado
tenue. Es el guiño al especialista, no el contenido principal.

## 7. Jerarquía tipográfica

La jerarquía visual *es* el principio rector hecho forma:

- Etiquetas de pregunta y de opción: color y peso de texto primario.
- Frase explicativa: texto secundario, tamaño de lectura cómoda.
- Códigos, columnas de filtro y expresión: monoespaciado, atenuado, menor, y siempre
  detrás de un desplegable. Nunca en el primer plano de la ficha.

Si alguien mira la vista de reojo, debe llevarse la idea (qué habilita qué) sin haber
leído un solo carácter técnico.

## 8. Micro-interacciones

- **Resaltar la pareja**: al pasar el cursor sobre una fila de la correspondencia, se
  enfatiza el par antecedente↔opción, para leer el vínculo sin ambigüedad.
- **Saltar al antecedente**: al hacer clic sobre un antecedente, la vista puede llevar a
  esa pregunta en el editor (deep-link), cerrando el lazo entre explicación y edición.
- **Regla técnica**: desplegable perezoso; no carga peso visual hasta que se pide.

Sobrias y escasas a propósito: la vista informa, no anima.

## 9. Estados y casos límite

- **Filtro simple** (`region=${region}`): no hay matriz uno a uno. La ficha se reduce a una
  sola frase: *«Las opciones se limitan según la respuesta de "¿En qué región naciste?".»*
  Se prioriza igualmente la etiqueta del antecedente.
- **Correspondencia no inferible**: cuando la relación opción↔antecedente no es uno a uno o
  no puede deducirse con certeza, la ficha no inventa parejas. Enuncia los antecedentes en
  lenguaje humano y, para el detalle exacto, remite a la regla técnica. Es preferible decir
  menos con certeza que insinuar una correspondencia falsa.
- **Instrumento sin filtros**: estado vacío con sentido, no una pantalla en blanco:
  *«Este instrumento no condiciona opciones según respuestas previas.»* Explica la ausencia
  en lugar de aparentar un error.

## 10. Accesibilidad y contrato de QA

- La correspondencia se estructura como tabla semántica (encabezados «antecedente» y
  «opción habilitada»), legible por lector de pantalla y por teclado.
- El énfasis nunca se apoya solo en color: la pareja resaltada usa también peso o contorno.
- La vista registra su *readiness* en el contrato de QA visual (`data-audit-ready`) cuando
  las fichas terminaron de componerse, para que la auditoría la capture de forma estable.

## 11. Reutilización y reversión

- **Se revierte** la integración de las cascadas de `choice_filter` dentro del *Mapa de
  lógica*: ese mapa vuelve a representar solo `relevant`. Los dos conceptos quedan
  separados, como pide la dirección.
- **Se reutiliza** la lógica ya escrita para extraer las variables `${…}` de un filtro y
  resolver sus etiquetas humanas; esa pieza migra del grafo a esta vista.
- No hay cambios de backend: la estructura del instrumento ya está parseada en el cliente,
  y el `choice_filter_summary` del backend (antecedentes y columnas por pregunta) queda
  disponible como respaldo si se quisiera enriquecer la vista más adelante.

## 12. No-objetivos

- No es un editor: no se crean ni modifican filtros aquí (eso sigue en el panel de la
  pregunta).
- No es un grafo: evita deliberadamente la metáfora de nodos y aristas, que es la del
  *Mapa de lógica*.
- No redacta ni resume etiquetas: muestra las del instrumento tal cual; no interpreta el
  contenido de las preguntas.

## 13. Criterio de aceptación

La vista está bien resuelta si una persona ajena al XLSForm, al abrirla, puede explicar en
voz alta qué condiciona a qué **sin leer ningún código ni fórmula** —solo las etiquetas y
las frases—. Ese es el examen, y es el que este plan se compromete a pasar.

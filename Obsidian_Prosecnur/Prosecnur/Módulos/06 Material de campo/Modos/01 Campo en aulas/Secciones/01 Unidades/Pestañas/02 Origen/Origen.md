---
tipo: pestana
padres:
  - "[[Unidades]]"
orden: 2
documentacion: parcial
ruta_app: "/material-campo?modo=aulas&seccion=unidades&pestana=origen"
nodo: "material-campo/aulas/unidades/origen"
tags:
  - Pestaña
fuentes:
  - "frontend/src/features/recopiladores/OrigenSection.tsx"
  - "frontend/src/features/recopiladores/origen.ts"
  - "frontend/src/api/recopiladores.ts"
  - "api/R/collection_origen.R"
---

# Origen

> De qué fuente salen las unidades del plan, si la lista sigue al día con ella y qué cambió.

Material de campo no decide las unidades: las toma de Cálculo de muestra (o de la agenda de Monitoreo, cuando es la que manda) y las cita con una huella. Esta pestaña compara el plan guardado con lo que la fuente daría hoy, sin escribir nada.

## Qué se ve

| Elemento | Qué dice |
|---|---|
| De dónde salen | La fuente, cuántas unidades trae, de qué sorteo es y si el plan está vigente. |
| Diferencias | Unidades que entran, que salen, datos que cambiaron (aula, horario, curso…) y cambios de rol. El docente se marca como cambiado sin mostrar a quién. |
| Conexión | Qué entrega la fuente, la huella del plan y la fecha del sorteo, el recuadro «Al día con la fuente» o «La fuente cambió», y qué pasa del otro lado. |

## La acción

«Actualizar desde la fuente» abre el diálogo `?panel=rehacer-plan`, que primero previsualiza: cuántas unidades entran, salen y cambian, y qué fichas, archivos y despliegue se descartan. Sólo escribe al confirmar, con la huella de la fuente que se revisó; si la fuente cambió en medio, se releen las diferencias.

Si la agenda de Monitoreo es anterior a la selección vigente, la acción queda deshabilitada: hay que actualizar Monitoreo primero.

## Del otro lado

Cálculo de muestra › Entrega › Pase a Monitoreo avisa si Material de campo tiene un plan de otro sorteo y enlaza aquí.

## Ubicación en la jerarquía

- Padre: [[Unidades]].

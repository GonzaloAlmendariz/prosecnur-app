---
tipo: seccion
padres:
  - "[[Hojas de ruta]]"
orden: 2
documentacion: parcial
ruta_app: "/hojas-ruta?seccion=poblacion"
tags:
  - Seccion
fuentes:
  - "frontend/src/features/hojasRuta/HojasRutaPage.tsx"
  - "api/R/hojas_ruta_engine.R"
---

# Población

> Define el universo de referencia dentro del territorio confirmado.

## Objetivo

Establecer la población sobre la que se calculará y distribuirá la muestra.

## Antes de empezar

Confirma primero los distritos y el marco territorial.

## Mapa de la pantalla

```mermaid
flowchart LR
  N1["Territorio confirmado"] --> N2["Ámbito poblacional"]
  N2["Ámbito poblacional"] --> N3["Edad y sexo"]
  N3["Edad y sexo"] --> N4["Población de referencia"]
```

## Elementos de la pantalla

| Elemento | Para qué sirve | Qué cambia o produce |
|---|---|---|
| Territorio confirmado | Aporta distritos y cobertura. | Restringe los cálculos a los ámbitos ya validados. |
| Ámbito poblacional | Delimita el universo elegible. | Define qué residentes forman parte del denominador. |
| Edad y sexo | Permiten segmentar la referencia cuando corresponde. | Recalcula totales cuando se aplican categorías demográficas. |
| Población de referencia | Alimenta el cálculo muestral. | Guarda el total y sus desagregaciones para distribuir la muestra. |

## Cómo se usa

1. Revisa la población disponible para los distritos seleccionados.
2. Define los criterios demográficos que delimitan el universo.
3. Confirma la población y verifica que los totales sean plausibles antes de avanzar.

## Resultado y siguiente paso

Queda definido el denominador de referencia para calcular la muestra.

## Estados, alertas y límites

- Los totales dependen del marco y año territorial seleccionados.
- Una delimitación demográfica demasiado estrecha puede dejar celdas sin base suficiente.
- Modificar el universo obliga a revisar la muestra y sus cuotas.

## Cómo interpretar lo que ves

El total depende del territorio, el ámbito y los filtros demográficos. Lee el número general junto con sus desagregaciones: las categorías incluidas deben explicar el denominador utilizado. Un filtro visible cambia el universo aunque el mapa no cambie. Esta pantalla define población de referencia; no aprueba todavía el número de entrevistas.

## Ejemplo guiado

**Situación inicial.** El territorio contiene tres distritos, pero el estudio incluye sólo personas de 18 años o más.

**Acciones.** Confirma los tres distritos, selecciona el ámbito pertinente y aplica el rango desde 18 años. Compara el total filtrado con los subtotales por distrito y sexo.

**Resultado observable.** La población excluye menores, los subtotales distritales suman el universo mostrado y Muestra recibe ese mismo denominador.

## Si algo no coincide

Si aparecen zonas no previstas, vuelve a Territorio. Si los subtotales no suman, comprueba filtros superpuestos, categorías sin dato y cobertura censal. No ajustes el total manualmente para igualarlo a una meta: corrige el universo o la fuente que produce la diferencia.

## Ubicación en la jerarquía

- Padre: [[Hojas de ruta]].

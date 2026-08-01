---
tipo: pestana
padres: ["[[Marco]]"]
orden: 6
documentacion: parcial
ruta_app: "/calc-muestra?modo=opinion-universitaria&seccion=marco&pestana=def-consistencia"
nodo: "calc-muestra/opinion-universitaria/marco/def-consistencia"
tags:
  - Pestaña
fuentes: ["frontend/src/features/calcMuestra/universidad/marco/MarcoConsistenciaTab.tsx"]
---
# Consistencia de fuentes
> En la UI: **Consistencia**. Comprueba el enlace entre estudiantes y cursos-horario.
## Objetivo
Comprobar al cierre de Marco las claves faltantes, huérfanos y duplicados que comprometen el frame vigente.
## Antes de empezar
- Haber mapeado las variables, construido un marco vigente y revisado su cobertura.
## Mapa de la pantalla
```mermaid
flowchart LR
    A[Cobertura revisada] --> B[Claves de enlace]
    B --> C[Diagnóstico]
    C --> D{Consistente}
    D -->|Sí| E[Diseño]
    D -->|No| F[Corregir fuentes y reconstruir]
```
## Elementos de la pantalla
| Elemento | Para qué sirve | Qué cambia o produce |
|---|---|---|
| Claves | Muestra columnas de relación | Define el enlace evaluado |
| Conteos | Resume filas y unidades únicas | Detecta desbalances |
| Incidencias | Lista huérfanos y duplicados | Señala correcciones necesarias |
## Cómo se usa
1. Revisa las claves propuestas o mapeadas.
2. Compara conteos de ambas fuentes.
3. Resuelve huérfanos y duplicados.
4. Continúa en Diseño universitario solo cuando el estado de la conciliación esté acreditado.
## Resultado y siguiente paso
- Conciliación evaluada; continúa a Diseño solo cuando el estado esté acreditado.
## Estados, alertas y límites
- La consistencia se evalúa al construir o reconstruir el marco y debe resolverse antes de continuar a Diseño.
- Un diagnóstico rojo exige corregir las fuentes y reconstruir antes de diseñar.

## Cómo interpretar lo que ves

Una fuente cargada todavía no forma un marco: debe tener rol, periodo, llave y columnas asignadas. La consistencia se evalúa sobre la relación estudiante–curso-horario, no sólo sobre el número de filas. En **Consistencia de fuentes**, **Claves** fija la entrada o decisión inicial y **Incidencias** muestra el producto que debe ser coherente con ella. Conserva la relación entre el estudiante, el curso-horario y la facultad; una coincidencia en el total no compensa una ruptura en esas unidades.

## Ejemplo guiado

**Caso hipotético.** La matrícula contiene 8 420 estudiantes; 8 301 encuentran curso-horario y 119 quedan sin coincidencia. Además, 14 claves aparecen duplicadas en programación.

**Lectura.** Usa **Claves** para comparar formato y unicidad, confirma los **Conteos** a ambos lados y agrupa las **Incidencias** en ausentes, duplicadas o inválidas. No compenses pérdidas añadiendo filas manuales.

**Cierre.** La conciliación declara 8 301 enlaces válidos y conserva 133 problemas trazables para corregir en la fuente.

## Si algo no coincide

Si los totales coinciden pero las llaves no, no declares consistencia; revisa tipos, espacios, duplicados y periodo académico en ambas fuentes. Registra los valores observados en **Claves** y **Incidencias**, junto con la versión del marco y los parámetros activos. No corrijas una tabla o salida por separado: vuelve a la entrada causal y recalcula lo que dependa de ella.

## Ubicación en la jerarquía

- Padre: [[Marco]].

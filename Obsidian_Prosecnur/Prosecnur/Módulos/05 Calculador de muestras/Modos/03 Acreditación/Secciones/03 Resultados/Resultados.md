---
tipo: seccion
ruta_app: "/calc-muestra?modo=acreditacion&seccion=resultados"
nodo: "calc-muestra/acreditacion/resultados"
padres: ["[[Acreditación]]"]
orden: 3
documentacion: parcial
tags:
  - Seccion
fuentes:
  - "frontend/src/features/calcMuestra/CalcMuestraPage.tsx"
  - "api/R/calc_muestra_engine.R"
  - "api/R/reporte_calc_muestra.R"
---
# Resultados
> Calcula metas por actor y presenta el cierre metodológico del conjunto de componentes institucionales.
## Objetivo
Validar que cada actor recibe una meta coherente con su población, canal y requisito de acreditación.
## Antes de empezar
- Completar actores y contexto.
- Resolver componentes sin marco, meta o técnica compatible.
## Mapa de la pantalla
```mermaid
flowchart LR
    A[Componentes] --> B[Calcular actores]
    B --> C[Meta por actor]
    C --> D[Distribución]
    D --> E[Reporte metodológico]
```
## Elementos de la pantalla
| Elemento | Para qué sirve | Qué cambia o produce |
|---|---|---|
| Calcular actores | Ejecuta todos los componentes | Genera resultados comparables |
| Tarjetas por actor | Resume población, técnica y meta | Facilita la revisión |
| Distribución | Desglosa metas por estrato o programa | Produce cuotas operativas |
| Alertas | Señala mínimos, topes o cobertura | Previene cierres inviables |
| Reporte | Documenta supuestos y resultados | Deja evidencia del diseño |
## Cómo se usa
1. Ejecuta el cálculo conjunto de actores.
2. Revisa tamaño y técnica de cada componente.
3. Verifica distribuciones, pisos y totales.
4. Genera el reporte cuando todas las metas estén aprobadas.
## Resultado y siguiente paso
- Metas por actor validadas; el siguiente paso es incorporarlas al plan de recolección de acreditación.
## Estados, alertas y límites
- Un actor fallido no debe ocultarse detrás del total del estudio.
- Metas de cuota se interpretan distinto de tamaños inferenciales.
- Cambiar cualquier componente exige recalcular el conjunto y su reporte.

## Cómo interpretar lo que ves

El cierre debe mostrar metas y supuestos por actor además del conjunto institucional. Un total agregado no reemplaza la lectura separada de componentes con canales y poblaciones diferentes. En **Resultados de acreditación muestral**, **Calcular actores** fija la entrada o decisión inicial y **Reporte** muestra el producto que debe ser coherente con ella. Conserva la relación entre el actor, el componente, el canal y su población; una coincidencia en el total no compensa una ruptura en esas unidades.

## Ejemplo guiado

**Lectura institucional hipotética.** El total supera 1 000 casos, pero Docentes queda por debajo de su piso mientras Estudiantes sobrecumple ampliamente.

**Evaluación.** Usa **Calcular actores**, examina **Tarjetas por actor** y su **Distribución**. Resuelve **Alertas** sin compensar una brecha con el exceso de otro componente.

**Reporte final.** Metas, límites y supuestos visibles por actor, acompañados por un agregado que conserva esas diferencias.

## Si algo no coincide

Si el agregado no coincide con la suma de componentes, revisa actores inactivos, redondeos y topes antes de publicar. Registra los valores observados en **Calcular actores** y **Reporte**, junto con la versión del marco y los parámetros activos. No corrijas una tabla o salida por separado: vuelve a la entrada causal y recalcula lo que dependa de ella.

## Ubicación en la jerarquía

- Padre: [[Acreditación]].



---
tipo: pestana
padres: ["[[Selección]]"]
orden: 3
documentacion: parcial
ruta_app: "/calc-muestra?modo=opinion-universitaria&seccion=aulas&pestana=metodo"
nodo: "calc-muestra/opinion-universitaria/aulas/metodo"
tags:
  - Pestaña
fuentes:
  - "frontend/src/features/calcMuestra/universidad/aulas/AulasMetodoTab.tsx"
---
# Comparar métodos
> Evalúa cuatro selectores probabilísticos o auditables y recomienda uno con métricas del marco vigente.
## Objetivo
Escoger el método de selección que mejor equilibra probabilidades, perfil y restricciones operativas.
## Antes de empezar
- Congelar el marco de cursos-horario.
- Fijar el objetivo, la semilla y el número de corridas de auditoría.
## Mapa de la pantalla
```mermaid
flowchart LR
    A[Marco + objetivo] --> B[Cuatro métodos]
    B --> C[Métricas comparables]
    C --> D[Recomendación]
    D --> E[Método activo]
```
## Elementos de la pantalla
| Elemento | Para qué sirve | Qué cambia o produce |
|---|---|---|
| Sistemático PPS | Selecciona con salto e inclusión proporcional al tamaño | Produce una línea base probabilística |
| Cubo balanceado | Fuerza balance sobre variables del marco | Reduce brechas de perfil |
| Pivotal local balanceado | Conserva probabilidades en duelos locales | Controla balance y dispersión |
| Pool controlado | Elige entre candidatas y penaliza repetidos | Requiere probabilidad estimada por simulación |
| Métricas | Compara ajuste, repetidos, pesos y estabilidad | Sustenta la recomendación |
## Cómo se usa
1. Ejecuta el comparador con el marco y objetivo vigentes.
2. Lee el propósito, fórmula y métricas de cada método.
3. Contrasta la recomendación con las restricciones del estudio.
4. Activa el método elegido y registra la decisión.
## Resultado y siguiente paso
- Método activo y justificable; continúa con Simulación.
## Estados, alertas y límites
- Una comparación anterior no vale si cambian marco u objetivo.
- Pool controlado altera probabilidades de diseño y exige auditoría Monte Carlo.
- La recomendación es técnica; no reemplaza la revisión metodológica.

## Cómo interpretar lo que ves

Los métodos deben compararse sobre el mismo marco, objetivo y semilla de referencia. Ajuste, repetición, dispersión de pesos y balance responden a riesgos distintos; la recomendación debe explicitar cuál se prioriza. En **Comparar métodos**, **Sistemático PPS** fija la entrada o decisión inicial y **Métricas** muestra el producto que debe ser coherente con ella. Conserva la relación entre el estudiante, el curso-horario y la facultad; una coincidencia en el total no compensa una ruptura en esas unidades.

## Ejemplo guiado

**Dilema.** PPS mantiene probabilidades proporcionales; cubo mejora balance por facultad; pivotal reduce proximidad; pool controlado disminuye repeticiones, pero exige estimación por simulación.

**Comparación.** Ejecuta los cuatro selectores sobre el mismo marco y objetivo. Lee **Métricas** de ajuste, pesos, balance y estabilidad, y registra qué riesgo prioriza el estudio.

**Elección.** Un método activo con justificación técnica explícita; la recomendación no se acepta automáticamente si contradice una restricción operativa documentada.

## Si algo no coincide

Si las métricas cambian entre ejecuciones, confirma marco, objetivo y semilla; Pool controlado requiere además suficientes simulaciones para estimar inclusión. Registra los valores observados en **Sistemático PPS** y **Métricas**, junto con la versión del marco y los parámetros activos. No corrijas una tabla o salida por separado: vuelve a la entrada causal y recalcula lo que dependa de ella.

## Ubicación en la jerarquía

- Padre: [[Selección]].



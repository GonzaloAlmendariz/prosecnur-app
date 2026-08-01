---
tipo: pestana
padres: ["[[Selección]]"]
orden: 3
documentacion: parcial
ruta_app: "/calc-muestra?modo=opinion-universitaria&seccion=aulas&pestana=laboratorio"
nodo: "calc-muestra/opinion-universitaria/aulas/laboratorio"
tags:
  - Pestaña
fuentes:
  - "frontend/src/features/calcMuestra/universidad/aulas/AulasSimulacionTab.tsx"
---
# Simulación
> Repite el selector para estimar estabilidad, probabilidades de inclusión y dispersión de pesos.
## Objetivo
Comprobar que el método elegido produce resultados estables y probabilidades defendibles.
## Antes de empezar
- Comparar métodos con una semilla y número de corridas definidos.
- Tener un objetivo viable respecto del marco disponible.
## Mapa de la pantalla
```mermaid
flowchart LR
    A[Método activo] --> B[Corridas repetidas]
    B --> C[Frecuencia de inclusión]
    C --> D[Pesos y n efectivo]
    D --> E[Diagnóstico de estabilidad]
```
## Elementos de la pantalla
| Elemento | Para qué sirve | Qué cambia o produce |
|---|---|---|
| Resumen por método | Compara resultados de corridas | Confirma la recomendación |
| Histograma de inclusión | Muestra frecuencia Monte Carlo por curso-horario | Estima probabilidades empíricas |
| CV de pesos | Mide dispersión de ponderadores | Advierte inestabilidad |
| n efectivo | Contrasta información efectiva y n nominal | Cuantifica pérdida por pesos desiguales |
| Puntaje de estabilidad | Resume la regularidad del diseño | Facilita el diagnóstico |
## Cómo se usa
1. Ejecuta suficientes corridas para el método elegido.
2. Revisa la distribución de probabilidades de inclusión.
3. Contrasta n efectivo, n nominal y CV de pesos.
4. Ajusta el objetivo o método si la estabilidad es insuficiente.
## Resultado y siguiente paso
- Evidencia de estabilidad y probabilidades; continúa con Cursos-horario titulares.
## Estados, alertas y límites
- Sin corridas no existen probabilidades Monte Carlo por unidad.
- Un CV alto reduce el n efectivo aunque el número nominal no cambie.
- La simulación diagnostica el selector; no corrige por sí sola un marco deficiente.

## Cómo interpretar lo que ves

La simulación no elige la muestra final: estima estabilidad, frecuencia de inclusión y comportamiento de pesos al repetir el selector. Pocas corridas pueden producir probabilidades inestables. En **Simulación**, **Resumen por método** fija la entrada o decisión inicial y **Puntaje de estabilidad** muestra el producto que debe ser coherente con ella. Conserva la relación entre el estudiante, el curso-horario y la facultad; una coincidencia en el total no compensa una ruptura en esas unidades.

## Ejemplo guiado

**Hallazgo Monte Carlo hipotético.** Tras 1 000 corridas, tres cursos tienen inclusión cercana a 0,95 y varios quedan por debajo de 0,05; el CV de pesos aumenta.

**Exploración.** Revisa **Histograma de inclusión**, **CV de pesos** y **n efectivo**; localiza las unidades extremas y relaciona el patrón con tamaño o restricciones. Usa **Puntaje de estabilidad** como síntesis, no como sustituto del diagnóstico.

**Resultado.** Una evaluación de estabilidad que decide si el selector puede generar titulares o necesita ajustes previos.

## Si algo no coincide

Si una unidad elegible mantiene probabilidad cero, revisa su tamaño, estrato, restricciones y presencia en el marco congelado. Registra los valores observados en **Resumen por método** y **Puntaje de estabilidad**, junto con la versión del marco y los parámetros activos. No corrijas una tabla o salida por separado: vuelve a la entrada causal y recalcula lo que dependa de ella.

## Ubicación en la jerarquía

- Padre: [[Selección]].

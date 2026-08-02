---
tipo: pestana
padres: ["[[Cálculo]]"]
orden: 3
documentacion: parcial
ruta_app: "/calc-muestra?modo=opinion-universitaria&seccion=calculo&pestana=calculo-ch-facultad"
nodo: "calc-muestra/opinion-universitaria/calculo/calculo-ch-facultad"
tags:
  - Pestaña
fuentes:
  - "frontend/src/features/calcMuestra/universidad/calculo/CalculoCursosHorarioFacultadTab.tsx"
  - "frontend/src/features/calcMuestra/universidad/calculo/cursosHorarioResultadoModel.ts"
---
# Cursos-horario por facultad
> Proyecta las cuotas y los cursos-horario ya calculados por R con la decisión firmada de Marco.
## Objetivo
Revisar y confirmar las unidades operativas por facultad sin volver a derivar alumnos por CH ni aulas en React.
## Antes de empezar
- Tener Alumnos por CH confirmado para el marco vigente y una propuesta recalculada.
## Mapa de la pantalla
```mermaid
flowchart LR
    A[Decisión firmada en Marco] --> B[Resultado R por facultad]
    B --> C[Titulares y reservas]
    C --> D[Confirmar plan]
```
## Elementos de la pantalla
| Elemento | Para qué sirve | Qué cambia o produce |
|---|---|---|
| Cuota | Muestra entrevistas objetivo | Punto de partida por facultad |
| Método R | Expone media, mediana o P25 efectivo | Audita el divisor decidido en Marco |
| CH publicados | Muestra titulares, reservas y total | Fija el plan que pasa a Selección |
## Cómo se usa
1. Revisa cuota, método R y alumnos por CH de cada facultad.
2. Comprueba titulares, reservas y total publicados.
3. Si el divisor no representa la distribución, vuelve a Marco > Alumnos por CH.
4. Confirma el plan y abre Distribución.
## Resultado y siguiente paso
- Meta de cursos-horario por facultad; sigue Distribución.
## Estados, alertas y límites
- Esta pestaña no calcula medias, medianas, percentiles ni techos.
- Una firma stale oculta el plan hasta recalcularlo.

## Cómo interpretar lo que ves

El tamaño total, las cuotas de estudiantes y el número de cursos-horario responden a escalas diferentes. Revisa fórmula y supuestos antes de comparar propuestas, y comprueba cómo la distribución conserva facultad y sexo. En **Cursos-horario por facultad**, **Cuota** fija la entrada o decisión inicial y **CH definitivos** muestra el producto que debe ser coherente con ella. Conserva la relación entre el estudiante, el curso-horario y la facultad; una coincidencia en el total no compensa una ruptura en esas unidades.

## Ejemplo guiado

**Conversión hipotética.** Medicina requiere 120 estudiantes y sus cursos observados promedian 30 elegibles; cuatro unidades bastarían en teoría, pero una tiene sólo 12.

**Cálculo operativo.** Parte de **Cuota**, revisa **Rendimiento CH** real y redondea considerando tamaños heterogéneos y reservas. No dividas por un promedio institucional que oculte la facultad.

**Resultado.** **CH definitivos** muestra cuántos cursos titulares necesita cada facultad para aproximar la cuota estudiantil sin prometer una cobertura imposible.

## Si algo no coincide

Si la suma de cuotas no coincide con el tamaño objetivo, revisa redondeos, mínimos y topes; no ajustes manualmente la última facultad sin registrar el criterio. Registra los valores observados en **Cuota** y **CH definitivos**, junto con la versión del marco y los parámetros activos. No corrijas una tabla o salida por separado: vuelve a la entrada causal y recalcula lo que dependa de ella.

## Ubicación en la jerarquía

- Padre: [[Cálculo]].

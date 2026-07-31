---
tipo: pestana
padres: ["[[Analítica]]"]
orden: 7
documentacion: parcial
ruta_app: "/analitica?pestana=multibase"
nodo: "procesamiento/analitica/multibase"
tags:
  - Pestaña
fuentes:
  - "frontend/src/features/analitica/panes/MultibaseTablasPane.tsx"
  - "api/R/analitica_multibase.R"
  - "docs/arquitectura-multi-base.md"
---

# Tablas multibase

> Empaqueta tablas comparables de varias bases del modo multibase clásico.

## Objetivo

Producir salidas coordinadas por origen o globales sin fingir que todas las filas forman una sola base.

## Antes de empezar

- Tener un multibase clásico con dos o más bases disponibles.
- Confirmar compatibilidad de variables, etiquetas y denominadores.

## Mapa de la pantalla

```mermaid
flowchart LR
    A[Bases disponibles] --> B[Elegir variables]
    B --> C[Configurar origen y porcentajes]
    C --> D[Generar por base]
    D --> E[Empaquetar salidas]
```

## Elementos de la pantalla

| Elemento | Para qué sirve | Qué cambia o produce |
|---|---|---|
| Bases/orígenes | Define participantes | Acota el paquete |
| Configuración global | Activa porcentajes y secciones | Homogeneiza presentación |
| Configuración por origen | Ajusta cada base | Conserva diferencias necesarias |
| Generación | Produce tablas separadas | Crea archivos agrupados sin fusionar filas |

## Cómo se usa

1. Selecciona bases y variables comparables.
2. Configura porcentajes y secciones globales o por origen.
3. Revisa que cada tabla mantenga su denominador.
4. Genera el paquete.

## Resultado y siguiente paso

- Reportes agrupados por base/origen.
- Continúa en Gráficos cuando quieras componer un informe.

## Estados, alertas y límites

- La pestaña se oculta en hermanas independientes, que trabajan por `active_base`.
- Empaquetar no apila filas ni armoniza variables incompatibles.
- Cada base conserva sus pesos y códigos especiales.

## Cómo interpretar lo que ves

Las tablas multibase comparan resultados sin fusionar bases. Cada columna debe conservar actor, universo, denominador y peso propios; comparar no autoriza promediar escalas incompatibles. Lee primero el nombre del origen y su N, después el porcentaje: dos valores parecidos pueden representar poblaciones y precisiones muy distintas. Una ausencia puede significar que la variable no existe en ese origen, no que su resultado sea cero.

## Ejemplo guiado

**Situación inicial.** Estudiantes y docentes responden la misma escala de satisfacción y se quiere una tabla lado a lado.

**Acciones.** Selecciona la variable equivalente en cada base, confirma etiquetas y escalas, y genera columnas separadas. Revisa N y peso por actor.

**Resultado observable.** La tabla presenta dos distribuciones comparables con denominadores explícitos y sin apilar filas.

## Si algo no coincide

Si una escala usa códigos distintos, armoniza la presentación o no compares. Si aparece un único N, revisa la configuración. No calcules un total conjunto entre actores independientes.

## Ubicación en la jerarquía

- Padre: [[Analítica]].

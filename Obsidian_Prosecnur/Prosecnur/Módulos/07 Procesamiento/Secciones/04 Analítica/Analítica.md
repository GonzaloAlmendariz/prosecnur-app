---
tipo: seccion
padres: ["[[Procesamiento]]"]
orden: 4
documentacion: parcial
ruta_app: "/analitica"
tags:
  - Seccion
fuentes: ["frontend/src/features/analitica/AnaliticaPage.tsx", "frontend/src/api/analitica.ts"]
---

# Analítica

> Configura las bases y produce tablas, pesos, cruces, fichas y dimensiones para el análisis y los reportes.

## Propósito de la sección

Analítica prepara datos y configuraciones para producir resultados interpretables. Las pestañas no son una secuencia rígida: algunas verifican insumos, otras construyen transformaciones y otras generan salidas. El hilo común es declarar base, universo, denominador, peso y reglas de presentación.

## Antes de recorrerla

La base debe estar validada y la codificación requerida aplicada. Confirma active_base, variables y códigos. Para comparaciones, verifica que escalas y universos sean compatibles. Los pesos se recomputan desde configuración y no se editan como dato.

## Mapa de trabajo

```mermaid
flowchart LR
  A[Preparar datos] --> B[Configurar análisis]
  B --> C[Generar tablas]
  C --> D[Documentar y exportar]
```

## Guía de destinos

| Destino | Cuándo entrar | Qué hacer allí | Qué deja listo |
|---|---|---|---|
| [[Datos analíticos]] | Al verificar insumos | Revisar variables, tipos y universo | Datos listos para configurar |
| [[Base final analítica]] | Al preparar una entrega tabular | Seleccionar columnas y generar | Una base reproducible |
| [[Libro de códigos]] | Para explicar variables | Revisar etiquetas, categorías y especiales | Un diccionario entregable |
| [[Bases e instrumentos analíticos]] | En estudios multibase | Comprobar pares y base activa | Contexto analítico separado |
| [[Ponderación]] | Cuando el diseño requiere ajustes | Configurar, calcular y diagnosticar pesos | Pesos y diagnósticos |
| [[Frecuencias]] | Para distribuciones simples | Elegir universo, variable y peso | Tablas univariadas |
| [[Tablas multibase]] | Para comparar actores o bases | Alinear escalas y separar denominadores | Columnas comparables |
| [[Base panel]] | Con observaciones repetidas | Definir clave, ola y procedencia | Una estructura longitudinal |
| [[Ficha técnica]] | Para documentar el estudio | Contrastar diseño, N, campo y pesos | Síntesis metodológica |
| [[Cruces]] | Para relacionar variables | Definir filas, columnas y porcentajes | Tablas bivariadas |
| [[Orden de categorías]] | Cuando la lectura exige secuencia | Ordenar presentación sin recodificar | Categorías legibles |
| [[Dimensiones analíticas]] | Al construir indicadores compuestos | Agrupar, orientar y revisar cobertura | Una dimensión documentada |

## Recorrido recomendado

Empieza comprobando datos y pares. Configura pesos, orden y dimensiones antes de producir las tablas que dependen de ellos. Genera base final, libro y ficha cuando el estado analítico esté estable. En multibase, conserva denominadores por actor.

## Cómo interpretar el avance

Una salida calculada sólo es válida si declara universo y configuración. Revisa N, n efectivo, especiales y filtros. Las comparaciones no autorizan fusionar bases ni promediar denominadores.

## Resultado

Quedan bases, metadatos, pesos y tablas trazables para alimentar Gráficos o entregas analíticas.

## Ubicación en la jerarquía

- Padre: [[Procesamiento]].

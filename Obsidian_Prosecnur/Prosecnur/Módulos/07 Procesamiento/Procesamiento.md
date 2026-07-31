---
tipo: modulo
padres: ["[[Prosecnur]]"]
orden: 7
documentacion: parcial
ruta_app: "/procesamiento"
tags:
  - Módulo
fuentes:
  - "frontend/src/lib/modules.ts"
  - "docs/adrs/0040-flujo-acreditacion-formularios-monitoreo-procesamiento-ppt.md"
---

# Procesamiento

> Prepara los datos del estudio desde su ingreso hasta los reportes editables.

## Propósito del módulo

Procesamiento convierte instrumento y respuestas en datos revisados, transformaciones trazables y reportes editables. Las secciones forman una secuencia de dependencias: organizar el ingreso, evaluar calidad, codificar respuestas abiertas, preparar análisis y componer salidas. Visitar una sección no la completa; cada paso debe dejar un estado utilizable para el siguiente.

## Antes de recorrerlo

Necesitas al menos un par instrumento–respuestas identificado. En estudios multibase, confirma cuál base está activa y si las bases son integradas o hermanas independientes. Conserva códigos y textos originales: las correcciones y transformaciones deben poder reconstruirse.

## Mapa del flujo

```mermaid
flowchart LR
  A[Carga] --> B[Validación]
  B --> C[Codificación]
  C --> D[Analítica]
  D --> E[Gráficos]
```

## Guía de destinos

| Destino | Cuándo entrar | Qué hacer allí | Qué deja listo |
|---|---|---|---|
| [[Carga]] | Al incorporar o reorganizar datos | Definir topología, publicar fuentes y revisar estructura | Bases identificadas y utilizables |
| [[Validación]] | Con una base materializada | Explorar, ejecutar reglas y resolver incidencias | Una base cerrada con decisiones registradas |
| [[Codificación]] | Cuando existen respuestas abiertas | Preparar esquemas, asignar códigos y revisar matrices | Variables codificadas sin perder texto |
| [[Analítica]] | Tras validar y codificar | Configurar pesos, tablas, cruces y dimensiones | Insumos analíticos reproducibles |
| [[Gráficos]] | Con resultados interpretables | Diseñar láminas, revisar preview y exportar | PPTX o DOCX editable |

## Recorrido recomendado

Avanza en orden y vuelve a la fuente cuando detectes un problema. Si cambian datos o instrumento, reabre las comprobaciones dependientes. En hermanas independientes, repite cierres y configuraciones por active_base antes de consolidar resultados.

## Cómo interpretar el avance

Un archivo cargado no es una base validada; cero reglas pendientes no implica codificación aplicada; una tabla calculada no equivale a una narrativa revisada. Interpreta cada estado por el artefacto y la decisión que deja persistidos.

## Resultado

El estudio conserva un camino auditable desde los insumos hasta tablas y reportes, sin mezclar bases ni ocultar excepciones.

## Ubicación en la jerarquía

- Padre: [[Prosecnur]].

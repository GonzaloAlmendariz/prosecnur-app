---
tipo: seccion
padres:
  - "[[Hojas de ruta]]"
orden: 3
documentacion: parcial
ruta_app: "/hojas-ruta?seccion=muestra"
tags:
  - Seccion
fuentes:
  - "frontend/src/features/hojasRuta/HojasRutaPage.tsx"
  - "api/R/hojas_ruta_engine.R"
  - "frontend/src/features/hojasRuta/configSnapshot.ts"
---

# Muestra

> Calcula y aprueba el tamaño muestral, su fase, método, semilla, cuotas y política de reemplazos.

## Objetivo

Obtener una asignación reproducible y operativamente viable para el trabajo de campo.

## Antes de empezar

Confirma territorio y población; define si la corrida corresponde a piloto o campo real.

## Mapa de la pantalla

```mermaid
flowchart LR
  N1["Población"] --> N2["N recomendado y aprobado"]
  N2["N recomendado y aprobado"] --> N3["Fase"]
  N3["Fase"] --> N4["Método y semilla"]
  N4["Método y semilla"] --> N5["Reemplazos"]
  N5["Reemplazos"] --> N6["Cuotas confirmadas"]
```

## Elementos de la pantalla

| Elemento | Para qué sirve | Qué cambia o produce |
|---|---|---|
| Población | Aporta el universo de cálculo. | Establece el denominador usado para calcular y asignar N. |
| N recomendado y aprobado | Distingue sugerencia técnica y decisión final. | Conserva por separado cálculo y decisión metodológica. |
| Fase | Separa piloto de campo real. | Evita confundir una prueba con la selección definitiva. |
| Método y semilla | Controlan la selección reproducible. | Permiten repetir la corrida si no cambian marco ni parámetros. |
| Reemplazos | Fijan cantidad y regla territorial. | Crea reservas sin aumentar la meta de entrevistas. |
| Cuotas confirmadas | Distribuyen la muestra aprobada. | Asigna N entre celdas y verifica que la suma sea exacta. |

## Cómo se usa

1. Revisa el tamaño recomendado y registra el tamaño aprobado.
2. Selecciona la fase, el método y una semilla; conserva también el marco y la configuración de la corrida.
3. Define cuántos reemplazos se permiten y si deben provenir de la misma zona o de otra.
4. Confirma las cuotas y examina celdas vacías, redondeos y diferencias con el total aprobado.

## Resultado y siguiente paso

La corrida deja cuotas y reglas listas para seleccionar manzanas.

## Estados, alertas y límites

- Piloto y campo real son fases distintas; la política del estudio puede excluir del campo real las UMP usadas en piloto.
- La semilla por sí sola no reproduce una selección: también deben conservarse método, configuración y marco.
- Cero reemplazos desactiva la generación de reservas territoriales.
- Cambiar N, fase, método, semilla o política de reemplazos invalida resultados dependientes.

## Cómo interpretar lo que ves

Distingue recomendación, aprobación y selección. El N recomendado responde a parámetros; el aprobado registra la decisión. Fase, método y semilla describen la corrida que producirá unidades. Las cuotas son consistentes cuando suman exactamente el N aprobado y pertenecen al universo definido. Los reemplazos son reservas, no entrevistas adicionales.

## Ejemplo guiado

**Situación inicial.** El cálculo recomienda 380 entrevistas y se aprueban 400 para tres distritos de tamaños distintos.

**Acciones.** Registra 400 como N aprobado, selecciona fase de campo, método y semilla. Distribuye cuotas y revisa el total; define dos reemplazos por titular con la regla prevista.

**Resultado observable.** Las cuotas suman 400, la corrida conserva método y semilla y las reservas aparecen separadas del N efectivo.

## Si algo no coincide

Si la suma es 399 o 401, no avances: revisa redondeo y celdas hasta recuperar N. Si la misma semilla produce otra selección, comprueba cambios en población, método o parámetros. Una diferencia entre N recomendado y aprobado debe quedar visible como decisión; no la ocultes alterando el cálculo.

## Ubicación en la jerarquía

- Padre: [[Hojas de ruta]].

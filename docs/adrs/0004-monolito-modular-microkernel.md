# ADR 0004: Monolito modular con orientacion microkernel

Estado: Aceptado

Fecha: 2026-05-31

## Contexto

Prosecnur combina muchos dominios metodologicos: carga, formularios,
SurveyMonkey/Kobo, validacion, limpieza, codificacion, analitica, reportes,
graficos, dashboards, rutas, muestra y monitoreo. Todos corren en una misma
maquina y comparten sesion, archivos y motor R.

Una arquitectura de microservicios agregaria despliegues, red, autenticacion
entre servicios y observabilidad distribuida. Para una app local de escritorio,
ese costo no compensa. Una aplicacion sin fronteras internas, en cambio, corre
el riesgo de convertirse en una gran bola de barro.

## Decision

Prosecnur adopta un monolito modular local con orientacion microkernel. El
nucleo contiene sesion, `.pulso`, archivos, jobs, secretos, logs, errores, API
base y ejecucion del motor R. Los dominios metodologicos viven como modulos con
contratos explicitos encima de ese nucleo.

La escalabilidad esperada es local y operacional: soportar proyectos mas
grandes, mas bases, mas entregables y dashboards publicados sin convertir la app
principal en servicios remotos. Para eso, los modulos deben usar jobs, caches
regenerables, limites explicitos y carga progresiva cuando el volumen pueda
bloquear la sesion local.

## Consecuencias

Se gana instalacion simple, baja latencia local, depuracion directa y coherencia
entre flujos metodologicos.

Se sacrifica despliegue independiente por modulo y escalado horizontal por
servicio. La mantenibilidad depende de respetar fronteras internas, porque el
runtime no impone aislamiento fuerte.

La escalabilidad se desplaza desde infraestructura cloud hacia disciplina de
producto local: diseno de memoria, jobs, previews, `.pulso` liviano y contratos
entre modulos.

## Cumplimiento

- Los routers deben mantener prefijos de dominio claros.
- El frontend debe preferir carpetas `frontend/src/features/<dominio>`.
- El nucleo no debe absorber reglas especificas de validacion, codificacion,
  analitica, graficos, rutas, muestra o monitoreo.
- Rutas con trabajo pesado deben declarar estrategia de escala local: job,
  paginacion/lazy loading, limite explicito, cache regenerable o archivo
  descargable.
- Dependencias nuevas entre modulos deben documentar contrato y, si son
  estructurales, ADR.

## Notas

La guia canonica define el contrato de nucleo y modulos:
[`docs/arquitectura-prosecnur.md`](../arquitectura-prosecnur.md).

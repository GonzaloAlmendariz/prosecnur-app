# ADR 0018: Paquete compartible de planes de Graficos

Estado: Aceptado

Fecha: 2026-06-19

## Contexto

Los proyectos multibase pueden compartir el mismo instrumento, pero construir un
plan de PPT/Word en Graficos consume tiempo. Un usuario necesita exportar ese
plan desde un `.pulso` y aplicarlo en otro proyecto compatible, por ejemplo un
`ING_ALL.pulso` con las mismas carreras e instrumentos equivalentes.

El intercambio debe ser local y portable. No debe arrastrar data, XLSForms, SAV,
PPTX/DOCX generados ni secretos. Tambien debe ser auditable, porque al importar
se reemplaza configuracion persistida de Graficos por base.

## Decision

Graficos expone un paquete `.pulso-graficos.zip` con:

- `manifest.json`, con version, origen, conteos, variables de referencia y assets;
- `config.json`, con configuracion normalizada `graficos/4`;
- `files/`, solo para assets auxiliares referenciados por el plan.

La importacion se divide en inspeccion y aplicacion:

- `POST /api/graficos/share/inspect` guarda el ZIP como archivo temporal de
  sesion, calcula compatibilidad por base y no modifica el plan.
- `POST /api/graficos/share/import` vuelve a inspeccionar y reemplaza solo la
  configuracion de Graficos de las bases seleccionadas.
- Si una base no tiene variables requeridas por un slide, se omite ese slide
  para esa base y se reportan codigo y etiqueta.

El `.pulso` destino persiste una auditoria compacta
`graficos_share_snapshot/1`; el paquete ZIP no se agrega como input canonico del
proyecto.

## Consecuencias

El flujo permite reutilizar planes entre proyectos compatibles sin exponer datos
ni instrumentos. La compatibilidad se decide contra el XLSForm/data ya abierto en
el proyecto destino y puede variar por carrera.

El costo es mantener un contrato de paquete adicional y una logica de
adaptacion de variables/assets. La UI debe seguir mostrando una previsualizacion
antes de aplicar para evitar reemplazos opacos.

## Cumplimiento

- Tests R verifican exportacion, inspeccion, omision de slides por variable
  faltante, importacion por base e invalidacion de PPT/Word.
- Tests frontend verifican el cliente API de exportar, inspeccionar e importar.
- El paquete no debe contener `state.rds`, data, XLSForms, SAV ni entregables
  generados.

## Notas

Relacionado con ADR 0002 (`.pulso` portable) y ADR 0013 (importacion offline
SurveyMonkey contra bases existentes).

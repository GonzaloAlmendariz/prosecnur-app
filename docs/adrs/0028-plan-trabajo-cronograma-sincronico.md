# ADR 0028: Plan de trabajo como cronograma sincronico

Estado: Reemplazado por 0029

Fecha: 2026-06-29

> Nota (2026-07-09): ADR 0029 fusiona el cronograma dentro del modulo
> **Bitacora** (pestana Cronograma + Calendario) y agrega creacion/eliminacion
> manual de actividades. Los contratos de `plan_trabajo` se conservan.

## Contexto

Enciclopedia quedo como biblioteca metodologica read-only y Diseno del estudio
como expediente/bitacora viva. Eso no cubre una necesidad operativa distinta:
los proyectos reales se gestionan con cronogramas Excel que declaran fases,
actividades, responsables, productos, hitos y ventanas esperadas de campo,
analisis y entrega.

Si ese cronograma solo se resume en una bitacora, los modulos operativos quedan
desconectados del plan. Si el cronograma manda de forma unilateral a Monitoreo
o Reportes, se crea acoplamiento informal y riesgo de mutar estados de campo sin
evidencia.

## Decision

Prosecnur agrega el modulo **Plan de trabajo**. Su responsabilidad es modelar la
verdad planificada del proyecto:

- importar cronogramas Excel con grillas de dias/semanas;
- normalizar actividades, fases, responsables, productos, hitos y ventanas;
- permitir edicion controlada del plan normalizado;
- exportar un XLSX profesional del plan;
- exponer contratos de sincronizacion hacia otros modulos.

La sincronizacion es bidireccional por contrato, no por escritura directa:

```text
Plan de trabajo -> expectativas planificadas
Modulos operativos -> evidencia ejecutada
Comparacion -> desviaciones, riesgos e hitos cumplidos
```

El estado propio inicial es `plan_trabajo` en la sesion/proyecto `.pulso`.
Los endpoints iniciales son:

- `GET /api/plan-trabajo/state`;
- `POST /api/plan-trabajo/import`;
- `POST /api/plan-trabajo/tasks/<id>`;
- `POST /api/plan-trabajo/export`;
- `DELETE /api/plan-trabajo`.

La biblioteca de Enciclopedia permanece disponible en `/api/enciclopedia/*` y
`frontend/src/features/enciclopedia`, pero no es el modulo operativo principal.
Diseno del estudio puede leer Plan de trabajo como fuente transversal y mostrar
su estado en el expediente.

## Consecuencias

Beneficios:

- El analista puede convertir cronogramas existentes en estado operativo local.
- Monitoreo puede comparar sus ventanas reales contra ventanas planificadas sin
  depender de texto manual.
- Reportes y entregables pueden leer hitos pendientes o cumplidos.
- Diseno del estudio gana evidencia temporal sin volverse motor de campo.

Costos y riesgos:

- El parser de cronogramas debe degradar con cuidado porque los Excel de origen
  no comparten siempre la misma plantilla.
- El plan agrega estado persistente nuevo en `.pulso`.
- La sincronizacion debe mantenerse como contrato explicito; Plan de trabajo no
  debe mutar Monitoreo, Reportes, Carga, Validacion ni Muestra.

## Cumplimiento

- `plan_trabajo` debe guardar solo estado normalizado liviano, no el XLSX fuente
  como cache pesada ni entregables finales.
- Los archivos importados via upload siguen el file store local de la sesion.
- Los XLSX exportados son entregables descargables fuera del `.pulso`.
- Los modulos consumidores deben leer expectativas mediante endpoint/helper
  documentado, y devolver evidencia real mediante sus propios contratos.
- Cambios que permitan a Plan de trabajo escribir directamente en otro modulo
  requieren una ADR nueva o actualizacion explicita de esta decision.

# ADR 0027: Diseno del estudio como expediente y bitacora viva

Estado: Reemplazado por 0029

Fecha: 2026-06-28

> Nota (2026-07-09): ADR 0029 fusiona el cronograma dentro del modulo, lo
> renombra a **Bitacora**, retira Expediente/Fuentes/Biblioteca y mueve el
> agregador de estado por modulo a `GET /api/project/overview`.

## Contexto

La Enciclopedia metodologica era util como consulta read-only, pero Prosecnur
crecio hacia una aplicacion que carga datos, valida, codifica, calcula muestra,
prepara rutas, emite fichas, monitorea campo y produce entregables. En ese
contexto, un modulo principal de consulta ya no refleja el trabajo real del
analista.

El producto necesita una superficie profesional que muestre que va pasando en
cada modulo, consolide evidencia metodologica y permita redactar notas,
decisiones, riesgos, bloqueos y avances del proyecto. Esa superficie debe ser
trazable y persistente sin invadir la responsabilidad de los modulos fuente.

## Decision

El modulo principal pasa a ser **Diseno del estudio**. Su responsabilidad es
componer un expediente metodologico vivo desde contratos de sesion de los demas
modulos y mantener una bitacora propia redactada por el usuario.

El contrato inicial queda asi:

- endpoint read-only `/api/diseno-estudio/state` para protocolo, completitud,
  fuentes, decisiones, riesgos, proximos pasos, biblioteca y timeline;
- endpoint mutable `/api/diseno-estudio/bitacora` para crear o actualizar
  entradas de bitacora;
- endpoint mutable `/api/diseno-estudio/bitacora/<id>` para eliminar entradas;
- estado persistente propio `diseno_estudio_bitacora` en `.pulso`;
- biblioteca metodologica read-only conservada en `/api/enciclopedia/*` y
  `frontend/src/features/enciclopedia`.

Diseno del estudio puede leer estado estable de Carga, Validacion,
Codificacion, Analitica, Graficos, Dashboard, Calculo de muestra, Hojas de
ruta, Recopiladores y Monitoreo. No puede modificar esos estados ni actuar como
backend canonico de campo, limpieza, codificacion, muestra o monitoreo.

## Consecuencias

Beneficios:

- El analista obtiene una bitacora viva del proyecto en vez de una referencia
  metodologica pasiva.
- La ficha tecnica y los entregables pueden apoyarse en evidencia transversal
  sin duplicar trabajo manual.
- El modulo muestra riesgos de completitud y proximos pasos desde el estado real
  del proyecto.
- La biblioteca metodologica sigue disponible como apoyo contextual.

Costos y riesgos:

- Diseno del estudio conoce varias estructuras de sesion y debe degradar con
  cuidado cuando un modulo cambie.
- La bitacora agrega estado persistente nuevo en `.pulso`.
- Si se abusa del modulo, podria volverse un acoplamiento informal entre
  dominios.

## Cumplimiento

- El endpoint de estado no debe serializar datos crudos, mapas pesados,
  secretos ni entregables finales.
- Las mutaciones del modulo deben limitarse a `diseno_estudio_bitacora`.
- Tests focales deben cubrir composicion de estado y persistencia de bitacora.
- La UI debe mantener la biblioteca metodologica como referencia secundaria, no
  como modulo principal.
- Cambios que permitan escribir en otros modulos desde Diseno del estudio
  requieren nuevo ADR o actualizacion explicita de este.

## Notas

Relaciona y actualiza ADR 0006 sobre modulos por dominio y ADR 0020 sobre ficha
tecnica desde contextos metodologicos.

ADR 0028 agrega Plan de trabajo como modulo operativo de cronogramas. Diseno
del estudio conserva la bitacora y el expediente; Plan de trabajo queda a cargo
de la verdad planificada y la comparacion sincronica con evidencia ejecutada.

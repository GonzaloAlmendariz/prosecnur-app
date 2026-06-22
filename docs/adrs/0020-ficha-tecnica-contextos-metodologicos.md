# ADR 0020: Ficha tecnica desde contextos metodologicos

Estado: Aceptado

Fecha: 2026-06-22

## Contexto

Los entregables analiticos necesitan fichas tecnicas profesionales que expliquen
el diseno del estudio con el mismo nivel de detalle que los modulos de campo y
muestra ya producen internamente. Hojas de Ruta conserva seleccion de manzanas,
rutas, reemplazos, cuotas y distribucion territorial. Calculo de Muestra conserva
componentes, tecnicas, marcos, parametros, n objetivo, n operativo y
distribuciones por estrato. Si la ficha tecnica obliga a escribir esa informacion
a mano, Prosecnur pierde trazabilidad y reproducibilidad.

La decision es arquitectonicamente significativa porque crea una dependencia de
Reportes/Analitica hacia fuentes metodologicas de otros modulos. Esa dependencia
debe ser explicita y de solo lectura para no mezclar responsabilidades.

## Decision

El motor de ficha tecnica opera como compositor metodologico de solo lectura.
Puede tomar un contexto de proyecto o `.pulso` completo y extraer, cuando
existan, contextos de Hojas de Ruta, Calculo de Muestra u otros modulos
auxiliares versionados.

La prioridad de composicion es:

- Hojas de Ruta domina el procedimiento operativo de campo cuando existe,
  porque contiene seleccion territorial, rutas, reemplazos y trazabilidad de
  campo.
- Calculo de Muestra aporta marco, tamano, parametros, componentes, tablas de
  calculo y anexos de distribucion cuando Hojas de Ruta no cubre esos campos o
  cuando complementa el tamano muestral.
- Los valores escritos explicitamente por la configuracion `ficha_tecnica`
  prevalecen sobre textos inferidos.

La ficha puede producir texto narrativo, tablas insertadas dentro de campos y
anexos tabulares. Los modulos fuente no generan el Word directamente: entregan
estado metodologico; Reportes/Analitica decide como presentarlo.

## Consecuencias

Beneficios:

- Las fichas tecnicas pueden alcanzar nivel academico y operativo alto sin
  hardcodear un proyecto especifico.
- La informacion metodologica se mantiene trazable al modulo que la produjo.
- La misma estructura permite paneles, estudios territoriales, aulas, encuestas
  con componentes mixtos y futuros modulos auxiliares.

Costos y riesgos:

- El compositor debe conocer estructuras estables de varios modulos.
- Si un modulo cambia su estado sin compatibilidad, la ficha puede perder
  detalle o caer en textos genericos.
- Las tablas largas requieren verificacion visual del Word para evitar cortes o
  documentos demasiado densos.

## Cumplimiento

- Tests de ficha tecnica deben cubrir Hojas de Ruta y Calculo de Muestra como
  fuentes de contexto.
- El motor debe respetar prioridad: configuracion explicita > Hojas de Ruta para
  campo > Calculo de Muestra para calculo y componentes.
- Todo DOCX final generado o modificado debe renderizarse y revisarse
  visualmente antes de entregarse.
- Nuevos modulos auxiliares que alimenten la ficha deben exponer contexto
  metodologico de solo lectura, no escribir directamente el documento.

## Notas

Relacionado con ADR 0006 sobre modulos por dominio, ADR 0017 sobre Base panel en
Analitica y ADR 0019 sobre separacion entre seleccion muestral y monitoreo de
campo.

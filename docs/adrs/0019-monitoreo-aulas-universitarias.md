# ADR 0019: Monitoreo de aulas universitarias

Estado: Aceptado

Fecha: 2026-06-19

## Contexto

La encuesta a estudiantes HSTVG2026 exige un flujo mas complejo que los
monitoreos de acreditacion o territorial: el diseno muestral parte de una base
institucional de estudiantes y cursos, selecciona aulas como conglomerados y
luego requiere operar agenda, links/QR, reemplazos, avance y cierre de campo.

HSTVG2026 no debe quedar hardcodeado. El caso representa una familia
metodologica generica: encuestas a estudiantes universitarios aplicadas en
aulas. La arquitectura debe soportar base madre `estudiante x curso_horario` o
dos bases institucionales equivalentes, normalmente entregadas por DTI u otra
unidad de sistemas.

Tambien hay una restriccion de privacidad: las respuestas pueden ser anonimas.
Prosecnur no debe exigir `student_id` en la respuesta ni reconstruir identidad
estudiantil desde plataforma. El control de estudiantes repetidos se hace en el
marco institucional usado para diseno, no en la base anonima de respuestas.

## Decision

Se crea una tercera familia activa de Monitoreo:

- `MonitoreoProfile.family = "aulas_universitarias"`.
- Familia de publicacion interna: `university_classroom_fieldwork`.
- Ruta de UI: `Monitoreo de aulas universitarias`.

La frontera funcional queda asi:

- `calc-muestra` construye la poblacion objetivo, audita exclusiones, colapsa
  el marco a `curso_horario`, calcula escenarios, selecciona aulas titulares y
  reservas, registra semilla, hash de marco y bitacora metodologica.
- `Monitoreo de aulas universitarias` importa `selection_run_id`, controla
  agenda, links/QR, estados de aula, reemplazos, avance, brechas, validacion,
  consultas y cierre operativo.

El selector recomendado en `calc-muestra` usa muestreo estratificado de
conglomerados con PPS sobre elegibles efectivos. Cuando se aplica optimizacion
operativa, debe registrar advertencias y, cuando se solicite, estimar
probabilidades por simulacion Monte Carlo. El selector debe penalizar alumnos
repetidos entre aulas y balancear cuotas por dominio, sexo, facultad, programa,
nivel u otras variables disponibles.

Persistencia:

- `monitoreo_config$aulas_universitarias`: configuracion canonica del perfil.
- `monitoreo_aulas_plan`: plan operativo de aulas titulares y reservas.
- `monitoreo_aulas_snapshot`: snapshot compacto de avance y dashboard.
- `monitoreo_aulas_publication`: metadata de publicacion Sheets.

Los caches grandes regenerables no forman parte del contrato `.pulso`. El
proyecto conserva plan, estados, mapeos, hashes, semillas, bitacora y snapshots
compactos; no debe persistir listas extensas de identificadores estudiantiles
si no son necesarias para reabrir el monitoreo.

Monitoreo de aulas universitarias publica solo Google Sheets, siguiendo ADR
0016. El workbook cliente debe ser agregado y sin PII. El workbook interno
puede contener agenda operativa, collectors, links y trazabilidad de aula, pero
no debe exigir PII innecesaria.

## Consecuencias

Beneficios:

- HSTVG2026 queda soportado como caso de alta complejidad sin condicionales por
  cliente o universidad.
- La seleccion muestral y el seguimiento de campo quedan separados, auditables
  y reusables.
- El flujo anonimo es viable: las respuestas se agregan por aula, collector,
  link, codigo de aula o fecha cuando existan.

Costos y riesgos:

- El selector balanceado es mas exigente que un sistematico simple; requiere
  bitacora, semillas y advertencias cuando la optimizacion modifica
  probabilidades.
- Si DTI entrega dos bases incompletas o con llaves inconsistentes, el marco
  debe detenerse con auditoria de exclusiones antes de seleccionar aulas.
- La publicacion Sheets necesita separar con cuidado agenda interna y reporte
  cliente para no exponer PII o informacion operativa sensible.

## Cumplimiento

- Tests de `calc-muestra` comparan base madre vs dos bases y verifican que
  producen el mismo marco de aulas.
- Tests de `calc-muestra` verifican que la seleccion no sobrerrepresenta aulas
  grandes por filas alumno-curso y reduce alumnos repetidos frente a un
  sistematico puro cuando existe solapamiento.
- Tests de Monitoreo verifican que `aulas_universitarias` se importa desde
  `selection_run_id` sin pasar por acreditacion.
- Tests de Monitoreo verifican estados de agenda, reemplazos y brechas.
- Tests de respuestas anonimas verifican agregacion por aula/collector/link sin
  `student_id`.
- Tests de publicacion Sheets verifican que cliente no expone PII e interno
  conserva trazabilidad operativa.
- Tests de reapertura `.pulso` verifican preservacion de plan, estados,
  semillas, hashes y regeneracion de caches.

## Notas

Relacionado con [ADR 0010](0010-monitoreo-centro-control-operativo-sheets.md),
[ADR 0011](0011-cache-persistida-mapas-monitoreo-territorial.md) y
[ADR 0016](0016-monitoreo-solo-google-sheets.md).

# Checklist — Sistema Pabellón a todo Monitoreo de aulas (B33)

Tipo: Checklist de encargo delegado
Estado: Histórico
Consolidado en: [Pendientes al cierre del loop de mejora visual](pendientes-cierre-loop-2026-09-03.md)
Fecha: 2026-09-02
Autoridad: Encargo B33; el cierre total lo da Gonzalo

Estado al abrir: **en curso** · Abierto: 2026-09-02 · Encargo delegado de B33
(`checklist-operativo-aulas-2026-08-31.md`); el cierre total lo da Gonzalo. B33 quedó CONFORME por Gonzalo según el
acta de cierre del 2026-09-03.

Dictado (2026-09-02, textual): «Me encanta lo que has hecho añadiendo cuadros
jerárquicos, boxes de colores distinguibles — eso debe tener un nombre y debe
aplicarse a todo el resto de Monitoreo de aulas». Nombre acuñado: **Sistema
Pabellón**.

## El sistema (aprobado en B31 con «fenomenal»)

1. **Chips de identidad con color determinista**: el pabellón/aula como
   recuadro cuyo color deriva de la LETRA (`tonoDePabellon`, 8 tonos cíclicos);
   la hora/ventana como chip sobrio; fecha y momento como badges neutros.
2. **Jerarquía escaneable**: código operativo fuerte primero, docente en su
   peso, chips alineados como fila de badges.
3. **Listas completas, cero techos**: jamás «…y N más»; se organiza, no se
   esconde.
4. Tokens `--pulso-*`, contraste AA, dark por tokens, a11y.

**Criterio de sobriedad**: un solo componente de chip por tipo, cero variantes
ad-hoc. En tablas densas el chip va en las columnas de identidad (lugar, hora,
«Sesiones y aula»), no en todas; las fechas de tabla quedan en texto.

## Territorio y frontera

La sesión de la oleada de cuadros (B31) tiene EN VUELO, sin commitear:
`AulasCargaDeCampo.*`, `AulasMapaDeHoras.*`, `AulasSeccionModelo.tsx`,
`aulasCargaDeCampo.css`, `aulasPresentation.ts`, `candidatosDeReemplazo.*`,
`cargaDeCampo.*`, `frontend/src/api/monitoreo.ts`, más los archivos nuevos
`chipDePabellon.ts` y `AulasChips.tsx`. **Nada de eso se toca aquí.** El módulo
compartido de esta sesión clona el contrato exacto de ese paquete (mismos
nombres de componente y de clase CSS) para que la unificación posterior sea un
cambio de import y un borrado de duplicado.

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| P0 | **Módulo compartido del sistema**: helpers puros (`letraDePabellon`, `tonoDePabellon` — mismo contrato que el `chipDePabellon.ts` en vuelo—, parser de «LUN 16:00 A206»), componentes `ChipLugar`/`ChipHora`/`ChipDato` y hoja propia (aulasMonitoreo.css está congelada). Test de determinismo. | `sistemaPabellon.ts` · `AulasSistemaPabellon.tsx` · `sistemaPabellon.css` | ☑ `1ed167f6` — 18 tests |
| P1 | **Tablas del perfil**: el `DataTable` compartido pinta chips en columnas de identidad — lugar (`venue`, `actual_room`, `room`, `scheduled_venue`), hora (`scheduled_time`, `applied_time`, `schedule`, `sesiones_dia_hora`) y «Sesiones y aula» (`label`) parseado en chip de hora + chip de pabellón. Cubre Agenda, Consultas (cadena/brechas/partes), Avance y Base de control sin tocar la sección Modelo. | `AulasMonitoreoPage.tsx` (celda del DataTable) | ☑ `c90a1c33` — rojo→verde 4/4 |
| P2 | **Cursos-horario vencidos sin aplicar** (Avance/resumen): la lista de pendientes pinta la sesión como par de chips (hora + pabellón) con el Excel entero en el title; fecha y días quedan en su peso. | `AulasFrenteDelOperativo.tsx` | ☑ `94b2ef44` |
| P3 | **Cola de contacto** (Modelo/contacto): la celda «Día y hora» de las citas fijadas lleva la hora como chip. Hallazgo lateral derivado a chip de tarea: el panel esconde la tabla de citas cuando no queda cola. | `AulasColaDeContacto.tsx` | ☑ `6a7cbbf2` |
| P4 | **Ficha del curso-horario** (Calidad): la ficha aprende lugar y hora del plan (`fichaDeAula.ts`, el acordado B30 gana al catálogo) y los pinta como fila de chips; el estado deja la clave cruda («agendada»→«Agendado»). | `fichaDeAula.ts` · `AulasFichaDeAula.tsx` | ☑ `0f713fcc` |
| P5 | **Registro de campo** (Calidad/registro): el contexto del aula activa gana la fila de chips — lugar, facultad, fecha, hora. La lista de 196 no se chipifica (densidad). | `RegistroDeCampo.tsx` | ☑ `5f956653` |
| P6 | **Popover de reemplazo**: cada candidato pinta su aula como chip de pabellón y su sesión como chip de hora; docente y elegibles en su peso. Cae un «Aula …» visible (ADR 0060). | `AulasPopoverReemplazo.tsx` | ☑ `b85fbfd9` |
| P7 | **Techos revocados en Observaciones de campo**: fuera el «y N más» de los códigos (lista completa como badges) y fuera el tope de 12 observaciones (la sección scrollea). | `AulasObservacionesDeCampo.tsx` | ☑ `541bf314` |
| P7b | **Techos revocados en las listas de CHs de Calidad**: «los diez más baratos; quedan N más» y «las diez de mayor diferencia» pierden la tijera; el ORDEN (la priorización) se conserva y ahora se dice. Los resúmenes por facultad conservan su top-N declarado: priorizan comparaciones, no esconden identidad. | `AulasLoQueFalta.tsx` · `AulasParteContraPlataforma.tsx` | ☑ `97f42def` |
| P8 | **Unificación con el paquete de Carga** (aterrizó en `1406ce3c`/`d59cb6e2`): las tres vistas de Carga importan del módulo compartido; `AulasChips.tsx`, `chipDePabellon.ts` (contrato preservado íntegro) y el bloque duplicado de `aulasCargaDeCampo.css` retirados. Coordinado por mensaje con la sesión de Carga: ella no reintroduce nada. | los tres componentes de Carga | ☑ `97645adf` — 44/44 |
| P9 | **Canon B34 — facultad en los boxes** (dictado llegado vía la sesión de Carga, referencia `d59cb6e2`): badge sobrio de facultad en registro y popover; orden canónico lugar→facultad→fecha→hora en las tres filas; la ficha la dice en su cabecera. | `RegistroDeCampo.tsx` · `AulasPopoverReemplazo.tsx` · `AulasFichaDeAula.tsx` | ☑ `9f24b08b` |
| P10 | **Gate**: tras P0–P9 y el rebase sobre main, vitest del perfil **203 archivos / 2.240 tests PASS** (piso al arrancar: 188/2.140 con 1 rojo preexistente de `scheduled_venue`, resuelto por el aterrizaje de B31) · tsc 0 · ui-quick-check de las 6 vistas tocadas × 2 viewports con `HSVG26ULT2.pulso` real: **ok=true, 12 capturas, 62 grupos de geometría, 0 issues/scrollJails/coverage-misses** (reporte `tmp/visual-qa/quick/2026-09-03T01-05-36-601Z/`; capturas «antes» desde main en el scratchpad de la sesión; par antes/después de la ficha entregado a Gonzalo) · **verificador APROBADO** con mutaciones de control (rojo verificado y revertido en `identidadEnCelda` y en el techo de Observaciones). Pendiente heredado que NO es de este diff: `--audit` en rojo por dos congelados crecidos en main pre-fork, corregidos en main por `31f04410` — se cierra al integrar. | esta sesión | ☑ |

## Notas de lo aprendido

- El paquete de B31 **no ha aterrizado**: `chipDePabellon.ts` / `AulasChips.tsx`
  existen sólo en el árbol sin commitear del checkout principal. El contrato se
  clonó leyéndolos en solo lectura (tonos = índices, la paleta vive en la hoja
  sobre `--pulso-accent-*` + 2 tokens de módulo, con `color-mix` para AA).
- La tabla de la Agenda vive en `AulasSeccionModelo` (territorio del writer),
  pero sus celdas las pinta el `DataTable` de `AulasMonitoreoPage`: interceptar
  ahí cubre la Agenda sin tocar el archivo en vuelo.
- `label` («Sesiones y aula») sólo se chipifica cuando trae el patrón
  descriptivo del equipo (día + hora + aula): en planes del sorteo esa columna
  trae el código académico (`urb209_0601`, 193/193 medido el 08-23) y un código
  no es un lugar — mismo criterio que `soloElAula`.

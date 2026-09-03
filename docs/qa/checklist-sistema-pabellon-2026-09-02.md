# Checklist — Sistema Pabellón a todo Monitoreo de aulas (B33)

Estado: **en curso** · Abierto: 2026-09-02 · Encargo delegado de B33
(`checklist-operativo-aulas-2026-08-31.md`); el cierre total lo da Gonzalo.

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
| P0 | **Módulo compartido del sistema**: helpers puros (`letraDePabellon`, `tonoDePabellon` — mismo contrato que el `chipDePabellon.ts` en vuelo—, parser de «LUN 16:00 A206»), componentes `ChipLugar`/`ChipHora`/`ChipDato` y hoja propia (aulasMonitoreo.css está congelada). Test de determinismo. | `sistemaPabellon.ts` · `AulasSistemaPabellon.tsx` · `sistemaPabellon.css` | ☐ |
| P1 | **Tablas del perfil**: el `DataTable` compartido pinta chips en columnas de identidad — lugar (`venue`, `actual_room`, `room`, `scheduled_venue`), hora (`scheduled_time`, `applied_time`, `schedule`, `sesiones_dia_hora`) y «Sesiones y aula» (`label`) parseado en chip de hora + chip de pabellón. Cubre Agenda, Consultas (cadena/brechas/partes), Avance y Base de control sin tocar la sección Modelo. | `AulasMonitoreoPage.tsx` (celda del DataTable) | ☐ |
| P2 | **Cursos-horario vencidos sin aplicar** (Avance/resumen): la lista de pendientes pinta el aula como chip de pabellón y la hora como chip; fecha y días quedan en su peso. | `AulasFrenteDelOperativo.tsx` | ☐ |
| P3 | **Cola de contacto** (Modelo/contacto): la celda «Día y hora» de las citas fijadas lleva la hora como chip. | `AulasColaDeContacto.tsx` | ☐ |
| P4 | **Ficha del curso-horario** (Calidad): la ficha aprende lugar y hora del plan (`fichaDeAula.ts`) y su pie los pinta como chips junto a la fecha. | `fichaDeAula.ts` · `AulasFichaDeAula.tsx` | ☐ |
| P5 | **Registro de campo** (Calidad/registro): el contexto del aula activa gana la fila de chips — lugar, hora, fecha agendada. La lista de 196 no se chipifica (densidad). | `RegistroDeCampo.tsx` | ☐ |
| P6 | **Popover de reemplazo**: cada candidato pinta su aula como chip de pabellón y su sesión como chip de hora; docente y elegibles en su peso. | `AulasPopoverReemplazo.tsx` | ☐ |
| P7 | **Techos revocados en Observaciones de campo**: fuera el «y N más» de los códigos (lista completa como badges) y fuera el tope de 12 observaciones (la sección scrollea). | `AulasObservacionesDeCampo.tsx` | ☐ |
| P8 | **Unificación con el paquete de Carga**: cuando aterrice el commit de B31, `AulasChips.tsx` y el bloque de chips de `aulasCargaDeCampo.css` se retiran y las cuatro vistas de Carga importan del módulo compartido. | los tres componentes de Carga | ☐ BLOQUEADO hasta que aterrice |
| P9 | **Gate**: suites del perfil (medir el piso vigente al arrancar), tsc 0, ui-quick-check de vistas tocadas (1440x1000 y 1024x600, `--require-geometry --fail-on-issues`), capturas antes/después con `HSVG26ULT2.pulso` (copia), verificador. | esta sesión | ☐ |

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

# ADR 0133: Entregables, un registro, un nombre y una carpeta

Estado: Aceptado. Las decisiones de nombre y ubicación las tomó Gonzalo sobre el prototipo el 2026-11-07.

Fecha: 2026-11-07

Relación: censo en `docs/qa/censo-descargas-2026-11-07.md`; plan y estado vivo en
`docs/qa/checklist-descargas-unificadas-2026-11-07.md` (fase 2). Mantiene el contrato del `.pulso`: los entregables no
viven dentro del proyecto, se escriben al lado ([ADR 0005](0005-secretos-fuera-del-proyecto.md) sigue rigiendo los
secretos). La espera y la superficie del resultado en el front son la fase 4 y no se deciden aquí.

## Contexto

El censo encontró 148 archivos distintos que la app entrega, registrados por once funciones distintas
(`.register_output_file`, `.limpieza_register_download`, `.cmail_register_artifact`, `.lam_registrar`, …) más
escrituras directas en `s$files`. Conviven diez patrones de nombre y seis formatos de fecha; 96 archivos usan
`.export_filename()` y 52 arman su nombre por su cuenta. El mismo archivo cae en seis destinos según el módulo: la
carpeta de descargas, un diálogo de Electron que se abre solo, la raíz del proyecto, el portapapeles, una pestaña o un
servicio externo. La mayoría de los usuarios trabaja en Windows.

## Decisión

### 1. Un registro

Todo archivo que la app entrega al usuario se registra con `entregable_registrar()` (`api/R/entregables_registro.R`).
Los registradores existentes quedan como envoltorios finos que delegan en él, sin lógica de nombre propia. El meta
que devuelve conserva los campos actuales (`file_id`, `kind`, `original_name`, `path`, `size`, `ext`,
`uploaded_at`) y agrega:

- `modulo`: carpeta de módulo del §3.
- `rotulo`: nombre del entregable en palabras («Frecuencias», «Reporte de avance para el cliente»).
- `guardado_en`: ruta absoluta donde quedó la copia junto al proyecto, o `NULL`.
- `aviso_guardado`: por qué no se guardó la copia, o `NULL`.

### 2. Un catálogo

`api/R/entregables_catalogo.R` declara, por `kind`, el rótulo, el módulo, si el nombre lleva la base y si se guarda
junto al proyecto (`guardar`). Las vistas previas y miniaturas se registran con `guardar = FALSE`: se sirven, pero no
se copian. Un `kind` literal que se pase al registro sin entrada en el catálogo es un error de contrato que vigila un
test; en ejecución cae al rótulo derivado del `kind` y no se guarda.

### 3. Un nombre

`entregable_nombre(sid, rotulo, ext, base = NULL, detalle = NULL, fecha = Sys.Date())` arma

```
<Estudio>_<Entregable>[_<Base>][_<Detalle>]_<dd_mm_yy>.<ext>
HSVG2026_Frecuencias_por_base_07_11_26.xlsx
HSVG2026_Hoja_de_ruta_Brena_Z003_Mz045A_07_11_26.pdf
```

- **Estudio**: el código de la Ficha del estudio (`.planner_identidad(s)$codigo`); si no se declaró, el nombre del
  archivo `.pulso`; si no hay proyecto, `Prosecnur`.
- **Entregable**: el rótulo del catálogo, con la primera letra en mayúscula y las palabras unidas por `_`.
- **Base**: solo si la sesión tiene más de una base y el catálogo dice que el entregable es por base.
- **Detalle**: solo en salidas por unidad (zona, manzana, aula, lámina, envío).
- **Fecha**: `dd_mm_yy`, la que ya usa `.export_filename()`.
- Tildes y ñ se transliteran (`Breña` → `Brena`); todo carácter fuera de `[A-Za-z0-9]` pasa a `_`, sin `_` repetidos
  ni en los bordes. Eso deja fuera por construcción los caracteres que Windows prohíbe.
- El nombre sin extensión no pasa de 80 caracteres: se recorta primero el detalle y luego el rótulo; el estudio y la
  fecha no se recortan.
- `.export_filename()` pasa a ser un envoltorio de `entregable_nombre()`.

### 4. Una carpeta

Con un proyecto guardado (`s$project_path`) y fuera del modo público, `entregable_registrar()` copia el archivo, sin
diálogo, a

```
<carpeta del .pulso>\Entregables\<Módulo>\<nombre>
```

con estas carpetas de módulo: `Cálculo de muestra`, `Formularios`, `Hojas de ruta`, `Material de campo`, `Monitoreo`,
`Procesamiento`, `Dashboard` y `Proyecto`.

- **Nunca se sobrescribe.** Si el nombre ya existe (comparando sin distinguir mayúsculas, como Windows), se agrega
  `_2`, `_3`… antes de la extensión. En Windows, sobrescribir además falla si el archivo está abierto en Excel.
- **Ruta larga.** Si la ruta completa pasa de 240 caracteres no se copia y `aviso_guardado` lo dice; el archivo se
  sigue sirviendo por la descarga.
- **Una copia fallida no hace fallar la generación**: queda en `aviso_guardado`.
- Sin proyecto guardado, en el navegador y en modo público no se copia nada: el archivo llega por la descarga con el
  mismo nombre.

### 5. Guardar junto al proyecto a mano

`/api/fs/save-to-project` deja de rechazar tildes, espacios y nombres de más de 80 caracteres: limpia el nombre con
las reglas del §3, acepta como `subdir` las carpetas `Entregables` y `Entregables/<Módulo>` y, ante un nombre
repetido sin `overwrite`, agrega `_2` en vez de responder 409.

## Consecuencias

- El nombre de un mismo entregable deja de depender del módulo que lo generó, y los nombres repetidos para contenidos
  distintos se resuelven con rótulos distintos en el catálogo (el ZIP de CSV y el de Excel, las vistas previas).
- El usuario de escritorio encuentra todo lo generado en una carpeta conocida, junto al estudio.
- Mientras el front no adopte la tarjeta de la fase 4, los flujos que hoy guardan a mano en la raíz del proyecto
  (Editor XLSForm, Correos «Junto al proyecto», `SaveEntregableButton`) o abren el diálogo de Electron solos
  (`GenerateFooter`, menú Exportar de Gráficos) duplicarían el archivo. El catálogo marca esos `kind` con
  `guardar = FALSE` hasta que su flujo migre, y el diálogo automático se omite cuando el meta trae `guardado_en`.
- Los archivos de resultado de un job que no pasan por `s$files` (`/api/jobs/<id>/result`) siguen nombrándose por el
  job; se alinean cuando su flujo migre.
- Con más de una base, solo se copia el ZIP que las reúne; los archivos por base se sirven pero no se copian.
- Solo se copia lo que el usuario pidió descargar. Mientras su flujo no migre (fase 5), van con `guardar = FALSE` el
  XLSForm que «Subir Kobo» registra en Ocurrencias, los archivos de la limpieza que la UI no ofrece y las piezas sueltas
  de la entrega a procesamiento (el ZIP que las contiene sí se copia).

## Cumplimiento

- `api/tests/testthat/test-entregables-nombre.R`: la regla de nombre del §3.
- `api/tests/testthat/test-entregables-registro.R`: el registro y la copia del §1 y §4 (colisión `_2`, ruta larga,
  modo público, `guardar = FALSE`, copia fallida).
- `api/tests/testthat/test-entregables-catalogo.R` (transversal en `scripts/gate-area.R`): todo `kind` literal de
  `api/R` tiene entrada en el catálogo y los módulos son los ocho del §4.
- `api/tests/testthat/test-entregables-respuesta.R`: las respuestas traen `modulo`, `rotulo`, `guardado_en` y
  `aviso_guardado`, y en multibase solo se copia el ZIP.
- `api/tests/testthat/test-fs-save-to-project-entregables.R`: el §5.
- `frontend/src/features/analitica/GenerateFooter.guardado.test.tsx` y
  `frontend/src/features/graficos/ExportarInformeMenu.guardado.test.tsx`: con `guardado_en` no se abre el diálogo de
  Electron.

## Notas

- En `api/R/xlsform_impreso.R`, `guardado_en` es una fecha y hora de otro objeto; no confundir con el campo del meta
  de este ADR.
- Pendiente de verificar en Windows real: el separador `\`, el límite de 240 caracteres y la colisión con un archivo
  abierto en Excel.

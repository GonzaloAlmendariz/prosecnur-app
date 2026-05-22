# Plan de monitoreo digital

Este modulo usa datos sincronizados desde KoboToolbox y SurveyMonkey. No depende de hojas de ruta: las cuotas, variables de control, reglas de calidad y supervision viven en la configuracion propia de monitoreo.

El plan actual queda integrado con una segunda capa de trabajo: monitoreo transversal para cualquier estudio y monitoreo multi-componente para acreditaciones u otros estudios con actores, metas y disenos diferenciados.

## Alcance transversal actual

Monitoreo mantiene el flujo operativo general:

- Fuentes: KoboToolbox y SurveyMonkey.
- Configuracion: metas, cuotas, variables de control, campos criticos, estados validos y reglas de calidad.
- Tablero: KPIs, avance de metas, produccion, inconsistencias y muestra de supervision.
- Persistencia: fuentes normalizadas, snapshot de datos y configuracion dentro del proyecto; tokens cifrados fuera del `.pulso`.
- Exportacion: reporte XLSX de seguimiento y supervision.

Esta capa sirve para cualquier levantamiento, aun cuando no venga del calculador de muestra.

## Capa multi-componente para acreditaciones

La capa de acreditaciones se activa cuando el estudio viene de `/calc-muestra` o cuando la configuracion de monitoreo declara componentes por actor. No reemplaza el monitoreo transversal: lo extiende con metas, estados de cumplimiento, benchmarks y cierre metodologico.

Flujo canonico:

```text
1. /calc-muestra: estimacion_preliminar
2. /calc-muestra: diseno_validado
3. /monitoreo:    seguimiento_campo
4. /monitoreo:    cierre_campo
```

`estimacion_preliminar` y `diseno_validado` pertenecen al calculador. `seguimiento_campo` y `cierre_campo` pertenecen a Monitoreo.

### Integracion con calc-muestra

El estudio validado del calculador debe importarse a Monitoreo con su `id`, titulo, contexto y componentes. Cada componente conserva su diseno original y aporta su meta final como denominador del seguimiento.

La importacion debe portar la accion del evaluador de muestra. Monitoreo no debe asumir que todos los estudios llegan con una muestra estadistica calculada: algunos llegan con marco de cobertura por actor, otros con cuotas operativas y otros con componentes mixtos. Los casos que ya traen base/listado/muestra/meta cerrada no pasan por el calculador de propuestas. La referencia canonica esta en `docs/tipos-estudio-2024-2026.md` y en `api/inst/catalogos/catalogo_tipos_estudio.json`.

Monitoreo agrega, sin modificar el diseno original:

- `modo_trabajo`: `seguimiento_campo` o `cierre_campo`.
- `seguimiento_por_componente`: avance operativo por componente.
- `n_efectivo`, fecha de actualizacion y notas de campo.
- Intentos por canal y tasa de contacto efectiva.
- Estado de cumplimiento y brechas.
- Bolsa operativa para conglomerados.
- Progreso de subcuotas para disenos por cuotas.

UI esperada:

- Desde `/calc-muestra`, en modo `diseno_validado`, CTA `Iniciar seguimiento en Monitoreo`.
- Desde `/monitoreo`, enlace inverso `Ver diseno metodologico` cuando el estudio fue creado desde el calculador.

### Datos requeridos por componente

Cuando hay marco, Monitoreo debe pedir estos campos al iniciar el seguimiento:

| Campo | Definicion |
|---|---|
| `universo_bruto` | Todos los registros declarados o recibidos. |
| `marco_actualizado` | Registros elegibles despues de limpieza y rol unico. |
| `marco_contactable` | Subconjunto con canal util, como telefono o correo. |
| `meta_efectiva` | Casos objetivo segun el diseno validado. |
| `tasa_respuesta_esperada` | Tasa esperada por canal y actor. |

El reporte debe indicar sobre cual nivel del marco se calculo la meta.

### Estados de cumplimiento

Monitoreo debe portar la regla del calculador como `monitoreo_estado_cumplimiento(n_efectivo, n_objetivo)`:

| Estado | Condicion | Comportamiento |
|---|---|---|
| `sin_objetivo` | Meta ausente o menor/igual a cero. | No bloquear; exigir completar meta antes del cierre metodologico. |
| `cumple_meta` | `n_efectivo >= n_objetivo`. | Reportar cobertura lograda y permitir cierre normal. |
| `brecha_menor_documentada` | Brecha porcentual menor a 5%. | Permitir cierre con justificacion y advertencia metodologica. |
| `brecha_relevante` | Incumplimiento mayor o actor critico sin cobertura. | Exigir plan de refuerzo o aprobacion metodologica antes de cerrar. |

Minimos transversales:

- `n >= 30` para analisis estadistico valido.
- `n >= 30` por grupo para cruces.
- Si `N < 30` y no hay cobertura total, clasificar como sondeo.

Estos minimos deben disparar alertas cuando un actor o grupo cae bajo umbral.

### Benchmarks internos de acreditacion

Los benchmarks historicos de acreditacion son referencia interna para alertas y no deben exponerse en reportes publicos.

| Actor | Rango observado | Promedio | Mediana | Lectura operativa |
|---|---:|---:|---:|---|
| Estudiantes | 58% a 97% | 71.3% | 69% | Meta 60% realista; puede caer en bases grandes o campos complejos. |
| Docentes | 66% a 100% | 89.3% | 98.5% | Regla 60% o 150 validada; pocas brechas. |
| Egresados | 62% a 75% | 68.2% | 67% | Regla 50% o 150 conservadora; canal telefonico puede superar metas. |
| Administrativos | 64% a 100% | 94.6% | 97% | Meta 80% razonable; alerta si la carrera no moviliza respuestas. |

Alerta sugerida: comparar la cobertura actual contra la mediana historica del actor y marcar desviaciones relevantes, por ejemplo 15 puntos porcentuales por debajo.

### Cuadro maestro por actor y umbral

Monitoreo debe reutilizar el preset `acreditacion_pucp` para saber que tipo de seguimiento corresponde por actor.

| Actor | Umbral | Tecnica | Variable de control | Habilita margen |
|---|---:|---|---|---|
| Administrativos | Todos | Intencion censal | Condicion laboral | No |
| Docentes | <=250 | Intencion censal | Dedicacion docente | No |
| Docentes | >=251 | Cuotas, minimo 150 | Dedicacion docente | No |
| Estudiantes | <=3000 | Intencion censal | Nivel curricular | No |
| Estudiantes | >=3001 | Conglomerados | Nivel curricular/ciclo | Si, si hay cursos-horario |
| Egresados | <=300 | Intencion censal | Ciclo de egreso | No |
| Egresados | >=301 | Cuotas, minimo 150 | Ciclo de egreso | No |

### Multi-canal y bolsa operativa

El seguimiento debe permitir fases multi-canal secuenciales:

```text
correo -> recordatorio correo -> WhatsApp/SMS -> llamada -> presencial
```

Por unidad se debe registrar canal, intentos, resultado y fecha. El tablero debe reportar tasa de contacto por canal y tasa de respuesta efectiva.

Para conglomerados, la bolsa operativa distingue unidades `M1` titulares de reemplazos `M2..Mn`. Activar un reemplazo es una decision operativa y debe registrarse con fecha y motivo. Esto no debe mezclarse con sobremuestra estadistica.

## Vista de producto

La pagina `Monitoreo de campo` debe conservar el tablero transversal y agregar una vista o tab `Acreditacion multi-actor` cuando existan componentes.

Vista global del estudio:

- Cards por actor con `n_efectivo / n_objetivo`, barra de progreso, estado, cobertura versus benchmark interno y ultima actualizacion.
- Banner de alertas de bloqueo para actores criticos sin cobertura o brechas relevantes.
- Accion `Marcar cierre de campo`, habilitada solo cuando no hay brechas relevantes sin plan de refuerzo.

Vista por componente:

- Encabezado con tecnica, marco de tres niveles, meta y estado.
- Tabla multi-canal con intentos y tasa de respuesta efectiva por canal.
- Bitacora de campo con notas y timestamp.
- Bolsa operativa para conglomerados.
- Subcuotas para disenos por cuotas.
- Modal `Registrar avance` con `n_efectivo`, intentos por canal y notas.

## API y motor

Endpoints actuales:

- `GET /api/monitoreo/state`
- `POST /api/monitoreo/demo`
- `POST /api/monitoreo/source`
- `POST /api/monitoreo/config`
- `POST /api/monitoreo/sync`
- `POST /api/monitoreo/supervision/sample`
- `POST /api/monitoreo/export`

Extensiones propuestas:

- `POST /api/monitoreo/import-from-calc-muestra`: crea o abre un estudio de monitoreo desde un diseno validado.
- `POST /api/monitoreo/acreditacion/seguimiento`: actualiza `n_efectivo`, intentos por canal y notas por componente.
- `POST /api/monitoreo/cierre`: transiciona a `cierre_campo` y bloquea si hay brechas relevantes sin plan de refuerzo.

Motor R:

- Portar `calc_muestra_estado_cumplimiento()` a `monitoreo_engine.R` como `monitoreo_estado_cumplimiento()`.
- Normalizar `seguimiento_por_componente` dentro de la configuracion de monitoreo.
- Construir alertas de minimo estadistico, brecha de meta y desviacion contra benchmark interno.
- Mantener compatibilidad con tableros transversales sin componentes.

## Reporte de cierre

El cierre de campo debe generar un reporte Quarto con:

1. Cumplimiento por actor.
2. Notas de campo agregadas.
3. Acciones recomendadas por estado.
4. Brechas documentadas y justificacion.
5. Confidencialidad, anonimizacion y restricciones de uso.

La plantilla anterior `api/inst/plantillas/calc_muestra/reporte_cierre.qmd` fue retirada del calculador porque pertenece a Monitoreo. Para implementarla, recuperar el contenido desde el historial git anterior al refactor del 2026-05-17 y adaptarlo al namespace `monitoreo_*`.

## Probar sin API

1. Abrir `Monitoreo de campo`.
2. Presionar `Cargar demo`.
3. Revisar KPIs, avance de metas, produccion, inconsistencias y muestra de supervision.
4. Ajustar variables/metas si se quiere probar otra configuracion.
5. Exportar el reporte para validar el XLSX de salida.

La demo crea datos ficticios con dos fuentes simuladas, campos criticos vacios, duplicados, estados invalidos y duraciones atipicas. No usa internet, tokens ni credenciales reales.

Cuando se agregue la capa multi-componente, la demo debe incluir al menos un estudio de acreditacion con administrativos, docentes, estudiantes y egresados.

## KoboToolbox

1. En Kobo, abrir el proyecto/formulario publicado.
2. Copiar el `asset_uid` desde la URL o desde la configuracion del proyecto.
3. Crear o copiar el token de API de la cuenta Kobo.
4. En Prosecnur, abrir `Monitoreo de campo`.
5. Elegir `KoboToolbox`.
6. Pegar `Asset UID`, `Token` y `Base URL`.
7. Usar `https://kf.kobotoolbox.org` salvo que la organizacion use otro servidor Kobo.
8. Guardar la fuente.
9. Presionar `Sincronizar`.
10. Mapear enumerador, fecha, estado, duracion, ID, contacto, variables de control y campos criticos.

Notas:

- La app consume Kobo API v2: `/api/v2/assets/{uid}/data/`.
- El token se guarda cifrado en secrets y no se guarda dentro del `.pulso`.
- El snapshot normalizado y la configuracion si se guardan en `.pulso`.

## SurveyMonkey

1. Primero guardar el token en el editor XLSForm si aun no existe.
2. Confirmar que el token/app tiene scope `responses_read_detail`.
3. Copiar el `Survey ID` desde SurveyMonkey o desde el listado de surveys del editor XLSForm.
4. En Prosecnur, abrir `Monitoreo de campo`.
5. Elegir `SurveyMonkey`.
6. Pegar el `Survey ID`.
7. Dejar el token vacio si ya fue guardado en el editor XLSForm.
8. Guardar la fuente.
9. Si aparece aviso de scope, regenerar o autorizar el token con acceso a respuestas.
10. Presionar `Sincronizar`.
11. Mapear variables de control, campos criticos, estados validos y metas.

Notas:

- Monitoreo reutiliza el `sm_token` cifrado existente del editor XLSForm.
- La estructura del survey se usa para aplanar respuestas a columnas monitoreables.
- La descarga usa SurveyMonkey API v3: `GET /surveys/{id}/responses/bulk`.

## Variables sugeridas

- Enumerador: usuario, entrevistador, encuestador o metadata equivalente.
- Fecha: fecha de envio, modificacion o finalizacion.
- Estado: campo de validacion o estado de respuesta.
- Duracion: segundos totales o diferencia entre inicio y fin.
- ID: uuid, response id o submission id.
- Contacto: telefono o campo usado para supervision.
- Variables de control: distrito, zona, sexo, edad, cuota u otra dimension de meta.
- Campos criticos: consentimiento, telefono, identificadores, filtros principales.

Para acreditacion multi-componente, agregar:

- Actor/componente: administrativos, docentes, estudiantes, egresados u otro actor definido.
- Nivel de marco: universo bruto, marco actualizado y marco contactable.
- Meta efectiva y tasa de respuesta esperada.
- Canal operativo: correo, WhatsApp/SMS, telefono o presencial.
- Estado de bolsa operativa cuando aplique.
- Celda de subcuota cuando aplique.

## Calidad y supervision

El tablero marca:

- Estados invalidos.
- Duraciones demasiado cortas o largas.
- Campos criticos vacios.
- IDs duplicados.

La muestra de supervision usa una seleccion aleatoria reproducible con semilla. Las entrevistas con mas riesgo tienen mayor probabilidad de entrar en la muestra.

Para acreditaciones, el tablero tambien debe marcar:

- Brechas relevantes por actor.
- Brechas menores que requieren justificacion.
- Actores bajo minimo estadistico.
- Subcuotas vacias o parciales.
- Reemplazos activados sin motivo documentado.
- Cobertura muy por debajo del benchmark interno.

## Fases de implementacion

Fase A, MVP:

- Portar `monitoreo_estado_cumplimiento()`.
- Agregar importacion desde calc-muestra.
- Agregar endpoint de seguimiento por componente.
- Crear tab `Acreditacion multi-actor` con cards, barras y badges.
- Agregar CTA desde `/calc-muestra` a `/monitoreo`.

Fase B, enriquecimiento:

- Registrar intentos por canal y tasas efectivas.
- Agregar bolsa operativa para conglomerados.
- Agregar subcuotas para disenos por cuotas.
- Mostrar benchmark interno comparado en cada actor.

Fase C, cierre:

- Agregar endpoint de cierre con bloqueo metodologico.
- Restaurar plantilla Quarto de cierre en Monitoreo.
- Registrar plan de refuerzo y aprobacion metodologica.

## Casos de uso de referencia

| Codigo | Estudio | Necesidad de monitoreo |
|---|---|---|
| ACR-DER-2025 | Acreditacion Derecho | Cuatro actores con tecnicas distintas; requiere tablero multi-actor. |
| ACR-EDU-2025 | Acreditacion Educacion | Intencion censal multi-actor con cuotas. |
| ACR-ING-2026 | Acreditacion Ingenieria | Alertas por brecha de egresados y seguimiento por canal. |
| HSVG-PUCP-2024/2026 | HSVG anual | Conglomerados con bolsa operativa de aulas y reemplazos. |
| ACN-PDM-2024, ACN-CBI-2024 | Series ACNUR | Listado externo con meta fija y multi-canal telefonico. |
| ECHO-PADF-2024 | Medicion recurrente | Comparacion entre olas y ajuste de meta por ola. |

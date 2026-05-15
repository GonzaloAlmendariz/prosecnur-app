# Monitoreo digital desde Kobo y SurveyMonkey

Este modulo usa datos sincronizados desde KoboToolbox y SurveyMonkey. No depende de hojas de ruta: las cuotas, variables de control, reglas de calidad y supervision viven en la configuracion propia de monitoreo.

## Probar sin API

1. Abrir `Monitoreo de campo`.
2. Presionar `Cargar demo`.
3. Revisar KPIs, avance de metas, produccion, inconsistencias y muestra de supervision.
4. Ajustar variables/metas si se quiere probar otra configuracion.
5. Exportar el reporte para validar el XLSX de salida.

La demo crea datos ficticios con dos fuentes simuladas, campos criticos vacios, duplicados, estados invalidos y duraciones atipicas. No usa internet, tokens ni credenciales reales.

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

## Calidad y supervision

El tablero marca:

- Estados invalidos.
- Duraciones demasiado cortas o largas.
- Campos criticos vacios.
- IDs duplicados.

La muestra de supervision usa una seleccion aleatoria reproducible con semilla. Las entrevistas con mas riesgo tienen mayor probabilidad de entrar en la muestra.

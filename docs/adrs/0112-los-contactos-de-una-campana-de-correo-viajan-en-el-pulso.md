# ADR 0112: Los contactos de una campaña de correo viajan en el `.pulso`

Estado: Aceptado

Implementacion: En curso

Fecha: 2026-10-22

Fecha de decision: 2026-10-22 (Gonzalo: «me parece que la lista de contacto sí se debe guardar en el .pulso»; y «para
campañas por correo debe haber una vista que muestre los contactos y las podamos ver como un dashboard por tipo de
perfil y todo en base a variables de control que podemos seleccionar de forma profesional»)

Reemplaza: —

Enmienda: [ADR 0110](0110-material-de-campo-se-conecta-y-escribe-correos-para-mailchimp.md) «Consecuencias» (la
audiencia nunca dentro del `.pulso`; la vista de Destinatarios no muestra correos), «Cumplimiento» (ningún correo
personal entra al `.pulso`) y la «Implementación de E1f» en «Datos personales», «`.pulso`» y «Destinatarios» (purga al
pasar a SurveyMonkey).

Extiende: [ADR 0111](0111-material-de-campo-se-organiza-por-campanas-tipadas.md) (la campaña de correo gana la pestaña
Contactos).

## Contexto

La lista de contactos de una campaña vivía solo en el directorio temporal de la sesión: al cerrar la app desaparecía y
para exportar o mandar un recordatorio había que volver a importarla. Eso rompe tres cosas:

- **El enlace personal.** El recordatorio de Mailchimp se cruza con SurveyMonkey por la variable `t` del enlace
  (`collection_mail_mailchimp.R`). En la prueba de Acreditación institucional PUCP ese token se generó fuera de la app.
  Si la app lo genera y la lista se borra al cerrar, el token se pierde y el cruce también.
- **La continuidad de la campaña.** Invitación, recordatorios y cierre ocurren en días distintos, con la app cerrada
  entre medio.
- **La lectura del avance.** No se puede ver quién está en la lista, ni por perfil, ni quién respondió.

## Decisión

### 1. Persistencia

- Los contactos de cada campaña de correo se guardan en el `.pulso` como un insumo más, en
  `files/contactos/<campaign_id>.rds`, con su entrada en `manifest.json` marcada `sensitivity: personal_data`. No van
  en `state.rds`.
- Lo que se guarda: las filas importadas tal como quedaron limpias, el mapeo, el nombre y la huella del archivo de
  origen, la fecha de importación, el token de cada persona y la marca de quién respondió (§3).
- Al abrir el proyecto se restauran en la sesión. Guardar sigue siendo explícito (`project_dirty`): importar, cambiar el
  mapeo, generar enlaces o actualizar quién respondió marcan el proyecto como modificado.
- Ya no se purgan solos: ni al pasar una campaña a SurveyMonkey ni al exportar. Se borran solo con la acción explícita
  «Quitar los contactos de esta campaña» (DELETE existente). La purga de la sesión reemplazada por `open in_place` se
  mantiene: esa sesión se descarta entera.

### 2. Enlace personal a la encuesta

- En la campaña se declara el enlace del recopilador (SurveyMonkey web, `https://`). La app genera para cada contacto
  efectivo un token aleatorio de 10 caracteres `[A-Za-z0-9]`, único en la campaña, y arma el campo
  `enlace_encuesta` = enlace + `?t=` o `&t=` + token. El rótulo visible es «Enlace a la encuesta».
- El token es de la persona (indexado por correo normalizado): reimportar la lista conserva el token de quien ya
  estaba y genera uno nuevo solo para quien entra. Cambiar el enlace del recopilador conserva los tokens.
- El campo sale en `audiencia.csv` como cualquier otro y lo lee el cruce de §3 sin cambios de formato (`?t=`).

### 3. Quién respondió

- «Actualizar quién respondió» guarda, además de etiquetar en Mailchimp, la marca `respondio` (y la fecha de la
  lectura) en cada contacto cuyo token aparece en SurveyMonkey. Sin clave de Mailchimp, la lectura puede correr solo
  para marcar.

### 4. Pestaña Contactos (vista y tablero por perfil)

- Dirección: `/material-campo?modo=correo&campana=<id>&seccion=correo&pestana=contactos`.
- **Lista**: los contactos con su correo, nombre, columnas importadas, estado (efectivo, sin correo, correo inválido,
  repetido), si tiene enlace y si respondió; búsqueda, filtros y paginación en el backend.
- **Tablero por perfil**: la persona elige qué columnas son **variables de control** (carrera, sexo, sede, año de
  egreso…). La elección es de la campaña y viaja en el estado (solo nombres de columna, sin datos personales). Para
  cada variable: contactos efectivos por categoría, con frecuencia y porcentaje, y —si ya se leyó quién respondió—
  respondieron y tasa de respuesta. Un cruce de dos variables. Los filtros por categoría se aplican a todo el tablero y
  a la lista.
- El porcentaje va siempre con su frecuencia y su base (efectivos de ese corte).

### 5. Resguardos

- El anonimizador (`api/scripts/pulso_anonimizar.R`) vacía `files/contactos/` y el gate de PII de los proyectos de
  referencia lo verifica.
- Al guardar un proyecto con contactos, la barra lo dice en una línea («Este proyecto lleva los contactos de N
  campañas»).
- El modo público no expone ninguna ruta de contactos.
- La vista previa, el `manifest.json` del ZIP y los logs siguen sin correos. Las capturas de QA usan listas sintéticas.

## Consecuencias

- Quien recibe el `.pulso` recibe los contactos. Compartir el proyecto pasa a ser compartir datos personales; por eso el
  aviso al guardar y la acción de quitar.
- El `.pulso` crece con la lista (tope de importación vigente: 10 MB y 50.000 filas por campaña).
- Las pruebas que exigían «ningún correo en el `.pulso`» pasan a exigir que los correos estén **solo** en
  `files/contactos/` y nunca en `state.rds`, en la vista previa, en el manifest del ZIP ni en los logs.

## Cumplimiento

- Ida y vuelta: importar → guardar → abrir en otra sesión devuelve las mismas filas, mapeo, tokens y marcas.
- Reimportar conserva los tokens de quien ya estaba; ningún token se repite en la campaña.
- `state.rds` no contiene correos (scan del estado); `files/contactos/` sí y solo ahí.
- El anonimizador deja `files/contactos/` vacío.
- Los agregados del tablero cuadran: la suma por categoría (incluido «Sin dato») es igual a los efectivos del corte.

# Guia practica de XLSForm para KoboToolbox

Material de apoyo para usar junto con `clase-kobo-xlsforms.qmd`.

## Lectura rapida de una fila

Lee cada fila de `survey` en este orden:

1. `type`: que control vera la persona en campo.
2. `name`: que columna saldra en la base exportada.
3. `label` y `hint`: que texto orienta la captura.
4. `relevant`, `calculation` o `choice_filter`: que logica activa la fila.
5. `required`, `constraint` y `constraint_message`: que calidad minima exige.

## Tipos de variables

| Tipo | Uso recomendado | Cuidado principal |
|---|---|---|
| `text` | Codigos, DNI, telefono, nombres, direcciones | Agregar regex si el formato importa. |
| `integer` | Conteos, edad, numero de miembros | Definir rangos razonables. |
| `decimal` | Pesos, montos, medidas | Revisar separador decimal esperado. |
| `date` | Fechas de entrevista o evento | Validar rangos si hay ventana de campo. |
| `select_one lista` | Una categoria cerrada | Crear la lista en `choices`. |
| `select_multiple lista` | Varias categorias posibles | Usar `selected()` en la logica. |
| `calculate` | Valores derivados o controles internos | Revisar que las variables usadas existan antes. |
| `begin_group` | Bloques relacionados | Cerrar siempre con `end_group`. |
| `begin_repeat` | Personas, bienes, eventos o visitas repetidas | Definir bien que representa cada repeticion. |
| `geopoint` | Ubicacion GPS | Probar precision y permisos del dispositivo. |
| `image`, `audio`, `video`, `file` | Evidencia de campo | Acordar tamano, privacidad y uso operativo. |

## Columnas clave en `survey`

| Columna | Pregunta de diseno |
|---|---|
| `type` | Que tipo de respuesta necesito capturar? |
| `name` | Como se llamara la variable en la base? |
| `label` | Que texto vera la persona? |
| `hint` | Que ayuda breve evita dudas? |
| `required` | Esta respuesta es obligatoria por una razon operativa? |
| `relevant` | Cuando debe aparecer esta pregunta? |
| `constraint` | Que respuestas se aceptan? |
| `constraint_message` | Como se corrige una respuesta invalida? |
| `calculation` | Que valor se deriva de respuestas previas? |
| `appearance` | Que control visual facilita la captura? |
| `choice_filter` | Que opciones se muestran segun una respuesta previa? |

## Columnas clave en `choices`

| Columna | Uso |
|---|---|
| `list_name` | Nombre de la lista conectada con `select_one` o `select_multiple`. |
| `name` | Codigo que queda guardado en la base. |
| `label` | Texto visible en el formulario. |
| Columnas auxiliares | Campos para filtros, como `region`, `distrito` o `tipo_actor`. |

## Patrones de logica

```text
${edad} >= 18
${consentimiento} = 'yes'
. >= 0 and . <= 120
${ninos} <= ${total_personas}
selected(${servicios}, 'agua')
if(${edad} < 18, 'menor', 'adulto')
regex(., '^[0-9]{8}$')
```

## Regex frecuentes

| Necesidad | Patron |
|---|---|
| DNI de 8 digitos | `regex(., '^[0-9]{8}$')` |
| Telefono de 9 digitos | `regex(., '^[0-9]{9}$')` |
| Codigo `VIS-2026-001` | `regex(., '^VIS-[0-9]{4}-[0-9]{3}$')` |
| Tres letras y cuatro numeros | `regex(., '^[A-Z]{3}-[0-9]{4}$')` |
| Alfanumerico de 4 a 10 caracteres | `regex(., '^[A-Za-z0-9]{4,10}$')` |

Usa `^` y `$` para validar el texto completo. Sin anclas, el patron puede aparecer dentro de una respuesta mas larga.

## Ejercicio 1: leer una fila

```text
type,name,label,relevant,constraint,constraint_message
integer,total_hogar,Total de personas,,. >= 1 and . <= 20,Ingrese un total entre 1 y 20.
integer,total_ninos,Total de ninos,,. <= ${total_hogar},Los ninos no pueden superar el total.
select_multiple servicios,servicios,Servicios del hogar,,,
text,servicio_otro,Especifique otro,selected(${servicios}, 'otro'),,
```

Preguntas:

- Que variables se guardan?
- Que regla protege la consistencia del hogar?
- Cuando aparece `servicio_otro`?

Respuesta esperada:

- Se guardan `total_hogar`, `total_ninos`, `servicios` y `servicio_otro`.
- `total_ninos` no puede superar `total_hogar`.
- `servicio_otro` aparece si `servicios` incluye `otro`.

## Ejercicio 2: corregir `choices`

Fragmento con fallas:

```text
survey
select_one distrito,distrito,Distrito
select_multiple servicios,servicios,Servicios

choices
list_name,name,label
distritos,ate,Ate
servicios,agua potable,Agua potable
```

Correccion:

```text
choices
list_name,name,label
distrito,ate,Ate
servicios,agua_potable,Agua potable
```

La lista se llama `distrito`, igual que en `select_one distrito`. En seleccion multiple, el codigo `agua_potable` evita espacios.

## Ejercicio 3: completar restricciones

Completa `constraint` y `constraint_message`:

```text
type,name,label,constraint,constraint_message
text,dni,DNI,?,?
integer,edad,Edad,?,?
text,codigo_visita,Codigo de visita,?,?
```

Respuesta posible:

```text
text,dni,DNI,regex(., '^[0-9]{8}$'),Ingrese 8 digitos.
integer,edad,Edad,. >= 0 and . <= 120,Ingrese una edad entre 0 y 120.
text,codigo_visita,Codigo de visita,regex(., '^VIS-[0-9]{4}-[0-9]{3}$'),Use el formato VIS-2026-001.
```

## Checklist antes de desplegar

- `survey`, `choices` y `settings` estan presentes.
- Cada `name` en `survey` es unico.
- Cada lista usada por `select_one` o `select_multiple` existe en `choices`.
- Los codigos `name` de `choices` no tienen espacios.
- Las preguntas obligatorias tienen sentido operativo.
- Cada `constraint` importante tiene `constraint_message`.
- Las regex usan `^` y `$` cuando el formato debe ser exacto.
- Se probaron respuestas validas e invalidas.
- Se reviso una exportacion de prueba para confirmar nombres y valores.


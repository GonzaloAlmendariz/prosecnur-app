# ACRDCONTA: preflight tecnico y metodologico de logica

Tipo: Fuente histórica QA
Estado: Histórico
Fecha: 2026-07-20
Autoridad: Evidencia histórica fechada; no certifica el producto actual
Consolidado en: [Síntesis de Carga y acreditación](../historico/carga-acreditacion-2026-07.md)

Fecha: 2026-07-20

Fuente auditada:
`<ruta de trabajo local>`

SHA-256:
`312a86e991d84a8e40d26d2cadb919e5f617a206335073c32fc18820d48c4432`

Copia corregida recomendada para continuar:
`<ruta de trabajo local>`

SHA-256:
`474524ea2719836a2a8a5aa4972a9e0edc3f77faf92f660b037abf0b315d7261`

## Resultado ejecutivo

Los cuatro workbooks son estructuralmente validos: no presentan nombres
duplicados, catalogos ausentes, bloques desbalanceados, referencias a variables
inexistentes ni expresiones ODK degradadas. Sin embargo, esa validez no acredita
la logica de aplicacion. Los instrumentos recuperados contienen muy pocas
condiciones `relevant` y no modelan el cierre por rechazo del consentimiento.

Por tanto, no es metodologicamente correcto confirmar ni publicar las revisiones
solo porque el validador tecnico no emite advertencias.

## Estado reproducible de publicacion

| Actor | Form ID | Content SHA-256 | Blockers | Warnings |
|---|---|---|---:|---:|
| Administrativos | `acrdconta_administrativos` | `15f390e6251921e0abfe67073292b72487dfdbfa13d99c219aced53cdf9f57a5` | 1 | 0 |
| Estudiantes | `acrdconta_estudiantes` | `187e2a330d765ebffbc54814ec21e90bda2d2211256925473a8231ab38185c10` | 1 | 0 |
| Docentes | `acrdconta_docentes` | `6153cdf51fba55f87b94f1fd42a522ddb39a3c717ff0dff1f2da9e9388d0f5ab` | 1 | 0 |
| Egresados | `acrdconta_egresados` | `24861af83add8417aff62f6113413110782f1134bd08306d42c0bc58d5781fd1` | 1 | 0 |

En los cuatro casos el unico bloqueo efectivo es
`logic_pending_manual_confirmation`; `can_publish=false` y no existe revision
publicada. El texto `missing_form_id_until_logic_confirmed` conservado en
`source.publication_guard` es historico: los cuatro `form_id` ya existen y no es
el motivo tecnico actual.

## Cobertura de logica persistida

| Actor | Filas survey | Filas respondibles | Required | Relevant | Constraint | Calculation | Choice filter |
|---|---:|---:|---:|---:|---:|---:|---:|
| Administrativos | 65 | 35 | 34 | 0 | 3 | 0 | 0 |
| Estudiantes | 138 | 87 | 86 | 0 | 3 | 0 | 0 |
| Docentes | 166 | 100 | 98 | 1 | 2 | 0 | 0 |
| Egresados | 136 | 76 | 74 | 1 | 3 | 0 | 0 |

Las unicas condiciones de visibilidad presentes son:

- Docentes: `p6_other` cuando `${p6} = '2'`;
- Egresados: `p5_other` cuando `${p5} = '6'`.

Los constraints presentes cubren correo y edad en los cuatro actores, anos de
trabajo en Administrativos, codigo de ocho digitos en Estudiantes e ingreso
numerico auxiliar en Egresados. No existe una formula calculada ni un filtro de
catalogo.

## Bloqueos metodologicos comunes

1. `p1` pregunta por consentimiento y ofrece `Si/No`, pero ninguna pregunta o
   grupo posterior depende de `${p1}`. Debe definirse el cierre o exclusión al
   rechazar antes de confirmar cualquier actor.
   El snapshot aporta evidencia operativa adicional: existen 12 respuestas
   `completed` con `p1=No`, distribuidas entre las siete fuentes, que solo
   contienen una o dos preguntas no vacias. SurveyMonkey si ejecuto una salida
   temprana que la traduccion XLSForm no conserva.
2. SurveyMonkey no aporto de forma completa reglas de display/skip. La ausencia
   de `relevant` no demuestra que el cuestionario original fuera lineal.
3. Casi todas las preguntas son obligatorias. Debe comprobarse que esa
   obligatoriedad corresponde al instrumento aplicado y no a una traduccion
   incompleta de la API.
4. Los valores especiales (`SIN INF`, rechazo, no aplica, no respuesta y Otro)
   deben conservar codigos distintos y denominadores trazables.

## Decisiones especificas

### Administrativos

- resolver el cierre por rechazo de consentimiento;
- confirmar que no existen saltos ni display logic adicionales;
- confirmar los rangos de edad (18-99) y anos en la Unidad (1-99).

### Estudiantes

- resolver el cierre por rechazo de consentimiento;
- confirmar que no existen saltos ni display logic adicionales;
- confirmar el rango de edad (18-99) y el codigo de ocho digitos;
- la exportacion local de respuestas no acredita estas reglas.

### Docentes

- resolver el cierre por rechazo de consentimiento;
- confirmar la unica regla presente para `Otro`;
- aprobar o corregir el mapa de la variante personalizada: 37 preguntas
  emparejadas y `Indique su codigo PUCP` sin par canonico;
- su auditoria de variante conserva `positional_ok=false`, 27 bloqueos y 9
  revisiones pendientes; el encabezado coincidente no acredita por si solo
  tipos, listas, codigos, required ni relevant;
- confirmar si la edad maxima 90 y la obligatoriedad casi total son reglas del
  instrumento aplicado.

### Egresados

- resolver el cierre por rechazo de consentimiento;
- `p8` (ano del titulo) no depende de `p7` (cuenta con titulo) y no valida que
  el ano sea igual o posterior al egreso. Las guias telefonicas exigen revisar
  ambas condiciones;
- `p11` (relacion del trabajo) y `p12` (ingreso) no dependen de `p10`
  (trabaja actualmente). Debe definirse el flujo de empleabilidad;
- el canonico no ofrece `Prefiero no responder` en ingreso. Una guia indica
  usar esa categoria solo ante insistencia; la otra ordena registrar el tramo
  inferior. El conflicto debe resolverse expresamente y nunca mediante
  imputacion silenciosa;
- confirmar la regla excluyente de `No me encuentro laborando` frente a otras
  actividades y la opcionalidad del telefono del empleador;
- aprobar o corregir los mapas: web 33/33; personalizada 33/34, con
  `Indique su codigo PUCP` sin par canonico.
- las auditorias conservan 3 bloqueos en web y 22 bloqueos + 12 revisiones en
  personalizada; ninguna debe considerarse resuelta por coincidencia textual.

## Brecha de gate detectada

El gate inicial solo observaba `source$logic_status` en el nivel superior. Si
una persona confirmaba ese estado, `source$variants[*].review_status` y sus
auditorias podian quedar pendientes sin impedir la publicacion. Esta brecha debe
repararse antes de usar la accion de confirmacion con Docentes o Egresados:

- la confirmacion conjunta debe sellar cada variante actual con el hash del
  workbook y el hash de su definicion;
- una variante pendiente debe producir
  `logic_variant_pending_manual_confirmation`;
- cambiar luego el workbook o la definicion debe producir
  `logic_variant_confirmation_stale`;
- confirmar no debe publicar ni borrar la auditoria historica.

## Gate de salida

La revision puede confirmarse por actor solo cuando:

- cada decision anterior tenga una regla aprobada y representada en el XLSForm;
- el validador vuelva a emitir cero blockers tecnicos y cero warnings;
- el content SHA-256 revisado coincida con el enviado a la confirmacion;
- la confirmacion no publique automaticamente;
- la revision inmutable se publique despues y quede fijada en el plan de
  ingreso correcto.

Hasta entonces permanecen prohibidos la publicacion, el intake real y la
promocion de las 410 encuestas efectivas.

## Iteraciones ejecutadas

### Gate de variantes

- baseline: 91 expectativas focales verdes, pero sin cobertura de variantes;
- regresion 1: 3 fallos causales demostraron que una variante pendiente podia
  quedar publicable y que confirmar no sellaba sus hashes;
- reparacion 1: sellado por hash y blockers pending/stale;
- regresion 2: el proyecto real demostro que limitar el gate a
  `survey_source/v1` dejaba fuera `acreditacion_actor_instrument_draft/v1`;
- reparacion 2: el gate depende de `logic_status` explicito y conserva
  compatibilidad solo cuando ese estado no existe;
- resultado final: 103 expectativas XLSForm y 139 de portabilidad verdes;
  1304 pruebas frontend y typecheck verdes. Confirmar sella variantes y no
  publica; cambiar workbook o definicion vuelve stale.

### Correccion acreditada de consentimiento

Se genero la copia `ACRDCONTA-preflight-logica.pulso` sin sobrescribir las dos
copias anteriores. Solo se incorporo la condicion `${p1} = '1'` en el correo
posterior al consentimiento y en los grupos siguientes:

| Actor | Guardas incorporadas | Content SHA-256 resultante |
|---|---:|---|
| Administrativos | 11 | `cfc82abf10b0e05572c919d9aad3855d096742282a344e3a504b608d395f9d9b` |
| Estudiantes | 17 | `6eb12b1bf58cc0dd73899c96bb7e0e5c9fedad409ceab16f9db48183c3a142e6` |
| Docentes | 23 | `46d39d9f3e89f030eed1e66a09dd7e89b16e205b7e33f4e9248add1e7fc62e8a` |
| Egresados | 22 | `8b09e1dfec0f6e46dbce7603c2e484b561dd01f8f1117fcbe07853c5394e114a` |

El round-trip conserva cuatro formularios, cero revisiones, cero bases, cero
intake, `dirty=false`, cero warnings y un unico blocker por actor:
`logic_pending_manual_confirmation`. La seleccion oficial de Monitoreo es
identica a la copia anterior: 519 en rollup, 410 efectivas, 109 excluidas y
15/52/178/165 por actor; el cache persistido tambien es identico.

## Propuesta metodologica v3

Proyecto recomendado para la siguiente revision:
`<ruta de trabajo local>`

SHA-256:
`5ef298077892ba624bbb8ad86e0996015e56be557916b0d3fc6ac37173799e64`

La v3 conserva la salida por consentimiento e incorpora, todavia como propuesta
pendiente de confirmacion:

- Estudiantes `p4`: texto con regex de ocho digitos para preservar ceros
  iniciales; se declara trace-only y excluido de indicadores;
- Egresados `p8`: visible solo si `p7=1`;
- Egresados `p11` y `p12`: visibles solo si `p10=1`;
- Egresados `p12`: `99 = Prefiero no responder`, sin imputar el tramo inferior;
- Egresados `p35`: opcional; `p34-p36` quedan como metadatos operativos
  excluidos de indicadores;
- codigos PUCP adicionales de variantes personalizados: trace-only, anclados a
  `survey_id + definition_sha256 + p3 + posicion`, sin desplazar el instrumento;
- provenance con rutas y SHA-256 de las fuentes, hashes de workbook y decisiones
  tipadas.

El contrato machine-readable de `p12` declara:

- `analysis_excluded_codes.p12 = 99`;
- elegibilidad `${p10} = '1'`;
- exclusion de `99` y vacio del denominador valido;
- denominador cero como `NA` con advertencia;
- `excluir_opciones = 99 / Prefiero no responder` para el plan PPT.

Casos sinteticos verificados: cuatro elegibles con dos respuestas validas,
`99` y vacio excluidos; escenario sin elegibles produce denominador cero y
`NA`; el filtro del DSL PPT elimina la no respuesta y recalcula la base valida.

La v3 abre con cuatro formularios bloqueados, `can_publish=false`, cero warnings,
cero revisiones/bases/intake y `dirty=false`. Snapshot, cache y seleccion son
identicos a la preflight: 519/410/109 y 15/52/178/165.

## Propuesta metodologica v4

Proyecto recomendado para la revision humana:
`<ruta de trabajo local>`

SHA-256:
`a8ee9739e101926d3c8a3ee473ff7d9e0eba314d51f808c7910931fa2fe26d05`

La v4 no altera los cuatro workbooks de la v3. Conserva sus hashes de
contenido y agrega evidencia documental y trazabilidad de la propuesta:

- fija como padre el SHA-256 de la v3
  (`5ef298077892ba624bbb8ad86e0996015e56be557916b0d3fc6ac37173799e64`);
- registra las dos rutas recibidas de `Preguntas_Estudio de Contabilidad.docx`;
  ambas tienen SHA-256
  `e75dc56290bd4c9c9dcc855ec23e766c5b3704b759aeccc32aa08d4b703b4fdb`
  y se declaran duplicadas para contar como una sola fuente sustantiva;
- explicita cuatro decisiones aun no aprobadas: paridad completa de variantes,
  flujo conocer/usar/satisfaccion de servicios, anos de `p8` fuera de
  2021-2026 y confirmacion humana final;
- deja registrado el contrato consumidor ya implementado para release,
  Analitica y PPT conjunto, sin copiar rutas de evidencia a los reportes.

Round-trip verificado: cuatro formularios, los mismos cuatro hashes de workbook,
cero revisiones/bases/intake, `project_dirty=false`, cero nombres de secretos y
cero warnings. Los cuatro siguen `blocked` unicamente por
`logic_pending_manual_confirmation`; no se confirmo ni publico ninguno.
Snapshot, cache y seleccion permanecen identicos a la v3: 519 casos, 410
efectivos, 109 excluidos y 15/52/178/165 por actor.

## Resolucion metodologica v5.1

Proyecto recomendado para confirmar y publicar en una copia posterior:
`<ruta de trabajo local>`

SHA-256:
`eaea064910ce7e339edf87a8eee03fa42130270b1d747d6a60ebc3567ec27f9e`

La instruccion de continuar las fases restantes se aplico como autorizacion para
fijar una politica canonica local, sin escribir en SurveyMonkey: cada XLSForm
por actor gobierna todas sus variantes normalizadas. Las diferencias de canal
se limitan al codigo PUCP de traza y, en Egresados telefonico, a `p34-p36`
operativos fuera de indicadores.

Decisiones resueltas:

- servicios: `usa` es visible y obligatorio solo cuando `conoce=Si`;
  `satisfaccion` solo cuando `usa=Si`. En las nueve combinaciones observadas no
  hubo respuestas fuera de esos universos;
- titulacion: `p8` incorpora `Otro año (especifique)` y `p8_other`; `p5_other`
  y `p8_other` son enteros obligatorios en su universo, con rango 1900-2026;
- la regla `año de titulo >= año de egreso` se registra como validacion tipada
  posterior a la materializacion, evitando una expresion XLSForm no parseable;
- se conservan las decisiones v3 para consentimiento, empleabilidad, ingreso
  rechazado, identificadores trace-only y metadatos telefonicos.

Round-trip independiente: cuatro formularios, cero revisiones, bases e intake,
`project_dirty=false`, cero warnings y un unico blocker por actor:
`logic_pending_manual_confirmation`. Hashes de contenido:

| Actor | Content SHA-256 |
|---|---|
| Administrativos | `cfc82abf10b0e05572c919d9aad3855d096742282a344e3a504b608d395f9d9b` |
| Estudiantes | `6a23ee691a8d6b51cf01981a100fee168314d1e86019b053ed8b157e84c6b8aa` |
| Docentes | `46d39d9f3e89f030eed1e66a09dd7e89b16e205b7e33f4e9248add1e7fc62e8a` |
| Egresados | `c2441415fdc09dbe6627cdc6bc9925d199c61e3e62824328fe642dd751974592` |

El corte sigue intacto: 519 casos, 410 efectivos, 109 excluidos y
15/52/178/165 por actor. El original conserva SHA-256
`24d97e7dc355565d8bc190a419de1470df01d1e4611a513c7025526a36a226c0`.

### Bloqueo tecnico descubierto antes de publicar

Un dry-run sin mutaciones encontro que el handoff concatenaba todas las fuentes
de un actor y aplicaba el alias posicional `qN -> pN` una sola vez. En variantes
personalizadas esto podia promover `Indique su codigo PUCP` como `p3` edad y
dejaba 27/82/55/74 variables canonicas ausentes. La publicacion y promocion
quedan detenidas hasta que el handoff:

1. separe por `.source_id` y resuelva su `survey_id`;
2. exija el mapa de variante confirmado y sellado por hashes;
3. mapee matrices por etiqueta normalizada sin ambiguedad;
4. excluya identificadores `monitoring_trace_only` del contrato analitico;
5. falle cerrado ante fuente, mapa o sello desconocido;
6. demuestre en el proyecto real compatibilidad de las cuatro bases antes de
   cualquier mutacion.

## Cierre del bloqueo y evidencia de procesamiento v7

El bloqueo se cerro con un mapeador source-aware que separa las filas por
`.source_id`, resuelve `survey_id`, exige una variante confirmada y sellada,
mapea matrices por slug seguro y conserva `person_code` solo como traza. El
preview real quedo `ready`, con cuatro entradas compatibles y cero variables
canonicas ausentes.

Resultado ejecutado en
`<ruta de trabajo local>`:

| Actor | Filas | Reglas | No soportadas | Inconsistencias |
|---|---:|---:|---:|---:|
| Administrativos | 15 | 105 | 0 | 0 |
| Docentes | 52 | 298 | 0 | 0 |
| Egresados | 178 | 232 | 0 | 0 |
| Estudiantes | 165 | 261 | 0 | 0 |

Las cuatro bases completaron codificacion identidad, preparacion, frecuencias,
cruces, cierre de limpieza y release independiente. El PPT conjunto de 94
laminas y cuatro comparaciones fue generado con manifiesto de releases. Los
SHA-256 finales son `1b217a...d0bfe` para v7, `0319d5...91e9e` para el PPT y
`85e842...78227` para el manifiesto. El original sigue en
`24d97e...226c0`.

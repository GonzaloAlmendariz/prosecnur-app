# Checklist — la cadena operativa de aulas, de punta a punta

**Encargo (textual):** «tenemos que testear que podemos generar desde cero las
aprox 190 aulas, con algunos adicionales si no se cubre derecho por ejemplo, y
luego poner a prueba que podemos usar esas mismas titulares, reemplazos y extras
para validar de una forma cómoda su transición a Monitoreo y Recopiladores con
una UI consistente, inteligente, elegante y profesional que responda a las
necesidades de los actores involucrados con profesionalismo, elementos visuales,
diagramas, explicaciones inteligentes y mostrando la información necesaria
ordenada de forma correcta y con la correcta jerarquía.»

**Norte de cada iteración**, en sus palabras: *generar → transitar → UI a la
altura*. No es un detalle de una tanda: es el objetivo de todas.

---

## La cadena, verificada en la app

| # | Eslabón | Estado | Evidencia |
|---|---|---|---|
| 1 | Sorteo de 193 titulares | ☑ | 193 · 507 reservas · 1 916 extras · `sel_aulas_20260822204345` |
| 2 | → Monitoreo | ☑ | 700 unidades, `desfasado: false` |
| 3 | → Recopiladores | ☑ | 2 616 = 193 + 507 + 1 916, tras reparar el reseed |
| 4 | → Libro de agendación | ☑ | 700 filas = 193 + 507, con desglose declarado |
| 5 | → Fichas QR | ☑ | el atajo aterriza en el editor de fichas |

## Las veinticuatro reparaciones

| # | Qué estaba mal | Commit |
|---|---|---|
| 1 | «Rehacer el plan» respondía 200 y no rehacía nada | `639b9c3e` |
| 2 | El plan no decía de qué facultades es | `01e92bb1` |
| 3 | La tabla no traía curso, docente ni elegibles | `b5d6e0fc` |
| 4 | Accesos hablaba de «unidades» y dejaba 484 px en blanco | `0cc3577e` |
| 5 | Cuatro columnas de doce eran tautologías, y tapaban el correo | `46f4ec7a` |
| 6 | La cadena de reemplazos, con 146 saltos hacia atrás | `5077dc47` |
| 7 | «Libro de 700 aulas» prometía 700 visitas | `302decbc` |
| 8 | «Abrir fichas QR» llevaba al plan de recolección | `fde1385d` |
| 9 | El guardián de jerga no miraba el copy de estados | `17fb38a3` |
| 10 | El extractor no tenía pruebas propias | `dcf04163` |
| 11 | CI rojo por dos congelados ajenos | `46e2b329` |
| 12 | El resumen del plan no decía si hay con qué reemplazar | `22661e9d` |
| 13 | «2109» y «2,109» en la misma pantalla | `036c0fe2` |
| 14 | «576,5 respuestas faltan» | `06f233c4` |
| 15 | La TERCERA lista sin orden de cadena, con su guardián | `02094a77` |
| 16 | `fmt` significaba tres cosas distintas según el archivo | `bedcd231` |
| 17 | El proyecto escondía su propio trabajo en el homepage | `7846c956` |
| 18 | La tarjeta de Recopiladores decía el mismo número tres veces | `f80609ae` |
| 19 | La tarjeta de Monitoreo decía «Sin fuentes» y «conectado» a la vez | `f7079672` |
| 20 | «190» y «193» en la misma pantalla sin decir cuál es cuál | `27d7ba99` |
| 21 | «Fichas 0» no decía de cuántas | `c703dc4d` |
| 22 | «500 de 2 616» se leía como progreso y era un recorte | `919f5f4c` |
| 23 | «reservas del banco» nombraba dos conjuntos distintos | `8531b05c` |
| 24 | «2 109 en juego» sobre un operativo de 193 visitas | `3d6f20cf` |

## La línea papel → Excel → app, verificada de punta a punta

Gonzalo, textual: «esto lo van a llenar los aplicadores en papel una vez que
vayan al aula… ese papel se le da al jefe de campo, y el jefe de campo lo llena
en el Excel, para que luego ese Excel sea leído por la aplicación y actualizado
el monitoreo».

Probada el 2026-08-23 con el proyecto de 193, llenando tres partes en la hoja
«Aulas Aplicadas (Campo)» como los transcribiría el jefe de campo:

| Eslabón | Estado | Evidencia |
|---|---|---|
| Ficha de papel pide las 9 casillas | ☑ | cada casilla existe como columna del libro (test de correspondencia) |
| Libro generado del plan real | ☑ | 5 hojas, 700 unidades, 193 filas de control |
| Jefe de campo transcribe | ☑ | 3 partes escritos en las columnas 24–34 del bloque 1 |
| App lee el Excel | ☑ | los 3 llegan con sus 14 campos: `observed_students`, `effective_surveys`, `actual_room`… |
| Llegan a la sesión y a la config | ☑ | `monitoreo_aulas_partes_campo` = 3 y `config.aulas_universitarias.partes_campo` = 3 |
| El dashboard los publica | ☑ | `partes_campo` con 13 campos por parte, incluidos `esperado`, `diferencia`, `cuadra` |
| Reconciliación aritmética | ☑ | `monitoreo_aulas_reconciliacion_partes` corre; 0 descuadres con partes que cuadran |
| **El avance NO se mueve** | ⚠ | `aulas_aplicadas` sigue en 0 con 3 partes «Aplicada» |

El último renglón **no es un defecto encontrado, es una decisión de diseño que
hay que confirmar**. `aulas_aplicadas` cuenta `operational_status` del plan, y
ese lo llena el **registro de campo de la app**, no el parte del libro. Está
documentado en el propio código: «el parte de campo y el control son medidas
distintas del mismo aula y mezclarlas perdería de cuál viene cada número».

La pregunta para Gonzalo: al importar el libro con partes «Aplicada», ¿debe
moverse el avance de Monitoreo, o el avance es sólo del registro de la app y el
parte se queda como control de calidad? Cambiar esto cambia qué significa el
número de avance, así que no se toca sin que lo decida él.

## Recorrido visual de la app — 2026-08-23

Todos los tabs abiertos con captura sobre el proyecto de 193 con partes dentro.
Verde = mirado y sin defecto; el resto, con su commit.

| Módulo · tab | Qué salió |
|---|---|
| Monitoreo · Fuentes | «Libro del operativo · Sin importar» con el libro importado — `33e7046e` · «Aplicadas en campo · con parte de campo» — `33e7046e` |
| Monitoreo · Agenda | «Sesiones y aula» enseñaba el código del curso — `c58a0a4c` |
| Monitoreo · Validación | «700 de 700 sin registrar» bajo «3 con parte» — `875b518d` |
| Monitoreo · Consultas | un aula cancelada y una sin asistentes salían iguales — `946e043d` |
| Monitoreo · Avance | «3.491» y «3.492» del mismo objetivo — `8ab0d702` |
| Recopiladores · Plan | ☑ sin defecto |
| Recopiladores · Accesos | vacío de 706 px para 40 caracteres — `8c15112f` |
| Recopiladores · Materiales | «0 de 193» y el botón crea 2.616 — `4b68f525` · botones apagados sin decir por qué + CSS huérfano — `802b0a18` |
| Recopiladores · Entrega | ☑ sin defecto — el aviso ámbar y el botón bloqueado ya están bien |
| Homepage | «ficha» con dos significados — `dd3aa05f` · la tarjeta no veía su snapshot — `c5dfab50` |
| Cálculo · Coincidencia | «190» y «Total 193» sin decir qué cuenta cada uno — `2679d1c3` |
| Cálculo · Tablas | **la tabla de cuotas por sexo, invertida** — `9b87c54a` · 3 fallbacks más — `d59230de` |
| Chrome | el chip de estado se veía como un botón — `ed6566da` |

**El más grave**: la tabla de cuotas por facultad y sexo —la que se marca
«Incluir en reporte»— tenía las dos columnas intercambiadas. `sub_a` es la
categoría de sexo **más frecuente**, no «mujeres», y cuatro superficies lo
asumían fijo. Se detectó contrastando contra el marco: Ciencias e Ingeniería
tiene 535 aulas de mayoría masculina y la tabla le daba «398 mujeres».

### Verificaciones negativas del recorrido

| Qué se buscó | Resultado |
|---|---|
| «Cómo se está trabajando» duplicado en Avance y Validación | Deliberado y documentado. Casi lo «arreglo». |
| Navegación rota (`ir()` devolvía `false`) | Era mi dirección: la sección es `modelo` y «Agenda» su pestaña. |
| El vacío estirado en Monitoreo | Cero casos: era de Recopiladores. |
| El gráfico de barras por sexo | Usa la vía de población, que sí lee el sexo real. Correcto. |
| El «0 %» de un aula cancelada | Venía de mi propio fixture, no del motor. |
| 150 clases sin regla CSS | Verificadas 6: dos defectos, una de componente muerto, tres no llegan al DOM. Herramienta, no gate. |

### Deuda medida y no tocada

- **28 componentes que nadie importa**, entre ellos `EnumeradoresPane.tsx` (801
  líneas), `SurveyMonkeyMultibaseWizard.tsx` (463), `DefinicionGlobal.tsx` (351).
  Borrar exige doble confirmación.
- **2.168 de las 2.616 aulas tienen meta fraccionaria** (21,7 · 22,5 · 37,2).
  Redondear por aula subiría la meta del estudio en 1.112 respuestas: decisión
  metodológica.

## Lo que espera decisión tuya

| Tema | Por qué está bloqueado |
|---|---|
| **Hilo conceptual de Monitoreo** | Cálculo tiene «Universo → elegibles → operación → aulas». Qué hilo une las cinco secciones de Monitoreo es una decisión de dominio, no de UI. |
| **Vista por rol** (agendador / jefe de campo / analista) | Propuesta en `docs/qa/roles-del-operativo-de-aulas-2026-08-22.md`. Cambia la navegación del módulo. |
| **Diagramación de la ficha** | Compactar el `field_grid` rompe `test-collection-render-ficha.R:271`, que defiende lo contrario a propósito. |

## Deuda anotada, sin abrir

- **Veinte archivos del perfil de aulas** definen su propio `const fmt = (n) =>
  n.toLocaleString("es-PE")` mientras el compartido vive en `kpisDeAulas.ts`.
  Contra la regla de micro-helpers de la casa.
- La ficha imprime «Rol» y «Muestra» entre sus campos: en una ficha de titular
  son las mismas tautologías que se quitaron de la tabla de Agenda, pero en una
  de reserva sí informan. Hay que decidirlo por tipo de ficha, no en bloque.

## Verificaciones negativas — buscado y NO hay defecto

Valen tanto como los hallazgos: evitan que la próxima sesión vuelva a mirar.

| Qué se buscó | Resultado |
|---|---|
| Una **cuarta lista** sin orden de cadena | No la hay. `AulasControlDelLibro` es la única candidata y sus filas vienen del libro importado, no del plan. |
| **Datos del dashboard sin consumidor** | 29 de los 30 campos del payload se consumen. El único suelto, `criterio_aula`, no es brecha: el frontend calcula el mismo contraste con `contrasteDeValidadores`, y sobre el mismo universo —`control_calidad` viaja sin tope—. Queda la duplicación, no comprobable sin un libro llenado. |
| **Coherencia numérica de Recopiladores** | Limpia. Las cuatro secciones hablan del mismo denominador (193) y sus cifras coinciden con la verdad medida en R. |
| Los cuatro «—» de **Entrega** | Correctos: no hay entrega, así que no hay datos de entrega, y el aviso ya dice por qué. |

## Qué hace bueno al módulo referente

Medido en Cálculo de muestra, para poder trasladarlo:

1. **Rastro conceptual declarado arriba** — «Universo → elegibles → operación → aulas».
2. **Cada KPI con su procedencia** debajo de la cifra, no sólo el número.
3. **Diagrama de pasos con «Estás aquí»**.
4. **Mapa del recorrido con las mermas**: 137 919 → 109 737 (−28 182 excluidas) → 21 920 → 2 500 → 193.

El 4 es el que falta llevar, y es el que depende de decidir el hilo de Monitoreo.

## Cuatro trampas que costaron tiempo y se repiten

1. **Un punto entre dígitos no es un decimal.** «R 152.3» es la reserva 3 de la
   cadena 152. Cazó dos veces en la misma sesión: al filtrar accesos a propiedad
   en el extractor de texto y al barrer decimales en Avance.
2. **Al cambiar lo que se cuenta hay que revisar quién lo cuenta.** «Libro de
   2616 aulas» se arregló ajustando el total y el rótulo siguió diciendo
   «aulas»; las columnas de rol se quedaron cuando la agenda pasó a listar sólo
   titulares. Y pasó **dentro de la misma sesión**: al descontar el banco del
   denominador de «en juego», el numerador se quedó atrás y la pantalla dijo
   «2 109 de 193».
3. **Grep del consumidor, conclusión sobre el productor.** Tres veces esta
   sesión. La última: dije que el payload no traía el desglose por rol tras
   mirar sólo `kpis`; el motor lo contaba, el router lo emitía y el tipo lo
   declaraba. La pregunta que lo desarma: *¿comprobé que nadie lo produce, o
   sólo que este de acá no lo recibe?*
4. **Un test que lee el código en vez de la pantalla se cree lo que el código
   diga.** Un guardián buscó una frase vieja en el fuente y la encontró en el
   comentario que la citaba como evidencia.

## Gate al cierre

`tsc` limpio · **5 712+** tests de frontend (713 archivos) · **902** en el perfil
de aulas · **38** archivos de R entre `carga-aulas` y `collection` ·
`sync-agentic-os --audit` y `--check` en verde · 60 tests del sincronizador.

Y la cadena entera, revalidada tras veinte commits: sorteo 2 616 → Monitoreo
2 616 (193 titulares, no desfasado) → Recopiladores 2 616 = 193 + 507 + 1 916 →
libro 700 = 193 + 507, cuadra.

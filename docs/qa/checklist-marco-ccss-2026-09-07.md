# Checklist — bases de CCSS Perfil listas para reproducir el marco de HSVG2026

**Fecha:** 2026-09-07 · **Pedido:** armar dos bases (alumnos y cursos-horario) desde
la extracción 212139, cruzadas con la 207915, para comprobar si aplicándoles las
condiciones de HSVG2026 se llega al mismo marco previo a la selección.

**Marco de referencia:** 1.512 curso-horario = `libro_aulas_202.csv` (174) +
`pool_extras_202.csv` (1.338), en `~/Documents/Pulso/HSTVG2026/`. Clave
`curso_horario` con forma `1arc01_0501`.

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| 1 | Base de **alumnos** armada, filtrada al horario principal | `CCSSPerfil/CCSS2026_base_alumnos_marco_07_09_26.xlsx` | **hecho** — 120.250 filas · 25.329 alumnos · 4.349 curso-horario · 0 duplicados |
| 2 | Base de **cursos-horario** armada | `CCSSPerfil/CCSS2026_base_cursos_horario_07_09_26.xlsx` | **hecho** — 10.700 filas · 6.053 curso-horario |
| 3 | Cruce: **condición de matrícula** desde 207915 | col. `CONDICION_MATRICULA` + `ORIGEN_CRUCE` | **hecho** — 127.666 filas (99,9 %) |
| 4 | Cruce: **correo PUCP del estudiante** | col. `CORREO_PUCP` | **hecho** — 99,9 % |
| 5 | Cruce: **correo Ágora** y tipo de horario principal | col. `CORREO_AGORA`, `TIPOHORARIO_PRINCIPAL` | **hecho** — 127.224 de 127.791 con referencia; 567 por fallback T |
| 6 | Excluir **lo de la DAA** | hoja «Excluidos» de ambos libros | **hecho** — 182 de 182 curso-horario |
| 7 | Excluir **las que no tienen información de DTI** | hoja «Excluidos» de ambos libros | **hecho** — 65 de 65 curso-horario |
| 8 | Comparar el marco reproducido contra las 1.512 de HSVG | corrida de verificación | **hecho** — 1.447/1.447 presentes (100 %); 92,3 % de los conteos de elegibles idénticos |
| 9 | No volver a los **curso-horario del operativo de HSVG** | col. `OPERATIVO_HSVG` + hoja «Excluidos» | **hecho** — 1.392 de ULT2 (174 titulares + 1.173 cadena + 45 reserva); procedencia confirmada, ULT1 descartado sin impacto |
| 10 | **Marco con el detalle de los descuentos y su porqué** | `CCSS2026_marco_muestral_descuentos_12_09_26.xlsx`, hoja «1 Embudo» | **hecho** — 1.354 → 799 personas · 287 → 155 aulas |
| 11 | **Traslape docente** de la DAA y de HSVG (sorteo 2) | mismo libro, hojas «4 Traslape docente» y «5 Docente unico» | **hecho** — 51 aulas marcadas con quién las contactó y por qué curso; NO se descuenta |
| 12 | El estrato es la **carrera**, no la facultad | hoja «2 Elegibles por carrera» | **hecho** — y destapa el problema: Antropología 23, Sociología 17 |

## Lo aprendido que no hay que reinvestigar

- **La identidad del aula es `curso × sección × horario`** (`calc_muestra_aulas.R:1016`).
  La 212139 no trae sección, así que sin filtrar el tipo de horario el 83,2 % de sus
  filas son el mismo alumno repetido y el 51 % de las claves mezclan teoría con
  práctica. Filtrando al horario principal: 0 duplicados.
- **`indicaprinci='1'` no es «teoría»**: de las 22.058 filas del catálogo 207915,
  18.002 son `T`, 1.748 `L`, 1.663 `P`, 642 `A`, 3 `G`. El tipo va embebido en el
  `CORREOAGORA` (`20260200` + clavecurso + **tipohorario** + horario), y de ahí se
  reconstruye el filtro que la consulta 212139 perdió.
- **`CONDICION` de la 212139 es la beca**, no la condición de matrícula. Esta última
  sólo existe en la 207915.
- Cobertura del cruce medida sobre los 822 elegibles de CCSS: 821 (99,9 %) con
  condición y correo; 276 de 280 aulas (99 %) con `CORREOAGORA`.

## Ítems bloqueados

- Ninguno por ahora. Si al comparar el marco aparecen diferencias atribuibles a la
  configuración de criterios por facultad (las 30 etiquetas de condición del curso de
  EEGG Letras, nivel del curso, tipo de docente), eso se resuelve en la app, no en la
  base: se anota aquí antes de tocar nada.

## Resultado de la comparación (ítem 8)

Marco de HSVG: 1.512 curso-horario. Descontando los 65 sin salón —que el pedido
manda quitar— quedan **1.447 comparables**, y los 1.447 están en las dos bases
nuevas. Ninguno se perdió.

Sobre el conteo de elegibles por aula (pregrado · regular · 18+), contra la columna
`elegibles` de `libro_aulas_202.csv` + `pool_extras_202.csv`:

| | aulas | % |
|---|---|---|
| conteo idéntico | 1.336 | 92,3 % |
| dentro de ±1 | 1.425 | 98,5 % |
| dentro de ±2 | 1.442 | 99,7 % |
| dentro de ±5 | 1.447 | 100 % |

Total: 50.609 elegibles en HSVG contra 50.686 en la base nueva, **+77 (+0,15 %)**.
La diferencia es matrícula de tres semanas, no método.

## Dos errores propios corregidos durante el ejercicio

- **La clave se normalizó a medias.** `curso` en minúsculas pero `horario` no, y el
  marco de HSVG usa la clave entera en minúscula. Efecto: 84 aulas del marco daban
  «ausentes» —las 84 con letra en el horario, `08a1`, `p801`— y las exclusiones
  cuadraban 176/182 y 52/65 en vez de 182 y 65.
- **El fallback exigía la letra `C` exacta.** Dejaba fuera 5 talleres de Arte y Diseño
  (sesión `A`, que el criterio de HSVG admite en esa facultad) y 2 curso-horario con
  sesión `C1`. Corregido aquí y también en el motor
  (`.cm_aulas_sesiones_prioridad` reconoce el prefijo `C`).

## Ítem 9 — por qué se excluyó la cadena entera

«Ya fuimos» pide la lista de aulas efectivamente visitadas, y **esa lista no está en
lo que hay en disco**. El `.pulso` más reciente del operativo
(`HSVG26ULT2_kobo (respaldo 2026-09-07 15-40).pulso`) trae un snapshot de Kobo del
**02/09**, truncado a 500 de 1.392 cursos, y en él las 1.392 figuran
`planificada` / `sin_contactar`: cero respuestas, cero `collector_id`, cero fechas
agendadas. El estado vivo está en el Sheets del operativo, no aquí.

Ante eso se excluyó **todo lo comprometido**, que es robusto a no conocer el estado:
si HSVG puede aún caer en esa aula, CCSS no va. Costo medido sobre el marco de CCSS:

| Criterio | Aulas que chocan | Marco restante | Elegibles |
|---|---|---|---|
| sólo los 174 titulares | 12 | 253 aulas | 799 de 799 |
| **toda la cadena (1.392)** | 52 | **213 aulas** | **768 de 799** |

Con el criterio duro quedan 213 aulas para elegir ~35, y las 35 mayores alcanzan 599
elegibles: 67 % de tasa de respuesta para las 400 encuestas. Holgado.

**Es reversible.** La columna `OPERATIVO_HSVG` conserva el rol de cada exclusión
(`titular` / `chain_reserve` / `extra_reserve_pool`). Para relajar el criterio a sólo
los titulares, se devuelven desde «Excluidos» las filas cuyo rol no sea `titular`.

**Queda abierto:** si el Sheets del operativo dice qué aulas ya se aplicaron, la
exclusión puede acotarse a esas más las que sigan en juego, y el marco sube hacia las
253 aulas.


---

# Segunda tanda — 2026-09-12

## Ítems 10 y 11 — el embudo y el traslape docente

Entregable: `CCSSPerfil/CCSS2026_marco_muestral_descuentos_12_09_26.xlsx`, cuatro
hojas (embudo · elegibles por carrera · marco de aulas · traslape docente).

**Personas:** 1.354 matriculados de la facultad → 822 en nivel 6–9 (−532) → 822 con
18+ (no retira a nadie) → **799 regulares** (−23 reincorporaciones, dato que sólo
existe gracias al cruce con la DTI 207915).

**Aulas:** 287 con algún elegible → 259 presenciales (−28) → 228 de curso teórico
(−31) → 207 sin las de la DAA (−21) → 207 sin las que no tienen salón (0, ninguna
caía aquí) → **155 sin las del operativo HSVG** (−52).

**Traslape docente** (nivel que faltaba: el docente del aula dicta OTRO curso ya
tomado). 222 docentes comprometidos con la DAA, 1.308 con HSVG ULT2, 82 con ambos.
De las 155 aulas del marco, **51 tienen traslape docente**: 38 por HSVG, 8 por ambos,
5 por la DAA. Va **marcado, no descontado**, igual que la columna «TRASLAPE DAA» del
libro operativo, que es informativa y de ida.

## Ítem 12 — el estrato es la carrera, y ahí aparece el problema

| Carrera | Elegibles | En el marco | Sin traslape docente |
|---|---|---|---|
| Economía | 358 | 335 | 311 |
| Relaciones Internacionales | 174 | 158 | **82** |
| Ciencia Política y Gobierno | 130 | 122 | 90 |
| Finanzas | 97 | 91 | 87 |
| **Antropología** | **23** | 23 | 23 |
| **Sociología** | **17** | 17 | 16 |
| TOTAL | 799 | 746 | 609 |

Dos cosas que exigen decisión antes de sortear:

1. **Antropología y Sociología no admiten muestreo.** 23 y 17 elegibles: aun
   censándolas enteras aportan 40 personas. Con 400 encuestas repartidas en seis
   estratos no hay diseño probabilístico que las sostenga.
2. **El traslape docente no se descuenta.** Lo aclaró Gonzalo el 12/09: sirve para
   saber que a ese docente ya lo contactó otro estudio y cuál —no para sacarlo del
   marco—. Lo único que actúa sobre la selección es la unicidad de docente, abajo.


## Corrección del 12/09 — qué es y qué no es el traslape docente

Se armó primero como un descuento candidato («excluirlas dejaría 104 aulas y 609
elegibles»). No es eso. Son dos cosas separadas:

**El traslape es información de contacto.** Las 51 aulas cuyo docente ya fue
contactado por la DAA o por HSVG siguen enteras en el marco y en el sorteo. El dato
existe para saber, al llamar, que es la segunda vez que se habla con esa persona y
por qué estudio fue la primera. Hoja «4 Traslape docente»: docente, a qué estudio y
por qué curso-horario. Va de ida, como la columna «TRASLAPE DAA» del libro operativo.

**Lo que sí actúa sobre la selección es la unicidad de docente**, y ya está en el
motor: `calc_muestra_aulas_docente_unico.R`, activa por defecto
(`selector$docente_unico = TRUE`), del pedido textual del 2026-08-18 —«un mismo
docente, por más que sean dos cursos horarios diferentes, no sea seleccionado de
forma repetida»—. Repara después del sorteo, sólo sobre titulares (M1), dedup global
y no por estrato, conservando el aula del estrato con menos alternativas.

En el marco de CCSS: 178 docentes para 155 aulas, y **43 docentes dictan más de un
aula** (27 dictan 2, 13 dictan 3, 3 dictan 4), cubriendo 105 de las 155. La regla va
a tener trabajo. El chequeo de ahogo que se hizo para HSVG, rehecho con el estrato en
carrera:

| Estrato | Aulas | Docentes distintos | Cuota aprox. | ¿Alcanza? |
|---|---|---|---|---|
| Economía | 52 | 55 | 16 | sí |
| Relaciones Internacionales | 27 | 41 | 7 | sí |
| Ciencia Política y Gobierno | 39 | 50 | 6 | sí |
| Finanzas | 15 | 15 | 4 | sí |
| Antropología | 14 | 17 | 1 | sí |
| Sociología | 8 | 12 | 1 | sí |

Ningún estrato se ahoga: la restricción es viable tal cual.

---

# Tercera tanda — 2026-09-15 · accesos Kobo y fichas

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| 13 | Configurar el acceso Kobo del formulario del estudio | `.pulso` → Recopiladores > Accesos > Canales | **hecho** — adapter `kobo_existing_v1`, perfil `pulsoeu_b87d662e` (PULSOEU, servidor EU), asset `aCvY5n9SLYdnpjsWw4doFa` |
| 14 | Resolver la URL de captura real (no la administrativa) | `deployment__links$single_url` del asset | **hecho** — `https://ee-eu.kobotoolbox.org/single/henYTZFJ` |
| 15 | Preparar los 155 accesos con su identificador | Recopiladores > Accesos > Vinculación | **hecho** — 50 titulares + 105 reemplazos, 155 payloads distintos |
| 16 | Generar las fichas QR **con el preset de campo** | `CCSSPerfil/CCSS2026_fichas_recopiladores_15_09_26.zip` | **hecho** — 155 fichas de 2 páginas (ficha + croquis) + `accesos.tsv`, 15,8 MB, sha256 `cadae7b4…` |
| 17 | Enlace suelto de piloto | `CCSSPerfil/CCSS2026_ficha_PILOTO_15_09_26.pdf` · `_qr.png` · `_qr.svg` | **hecho** — código `PILOTO`, ficha de prueba fuera del plan, más el QR suelto |
| 18 | **El formulario no tiene el campo `collectorID`** | XLSForm del asset `aCvY5n9SLYdnpjsWw4doFa` | **bloqueado** — sin ese nodo ninguna respuesta queda identificada; ver abajo |
| 19 | Distinguir respuestas de aula de las de la campaña de sensibilización | mismo campo del ítem 18 | **bloqueado** — se resuelve con el mismo nodo, con otro valor |

## Ítem 18 — el campo que falta, y por qué es de ida

El enlace que sale de la app es el estándar de 2026:

```
https://ee-eu.kobotoolbox.org/single/henYTZFJ?d%5B/aCvY5n9SLYdnpjsWw4doFa/collectorID%5D=CH%201
```

Mismo patrón que HSVG2026, donde el campo se declara así en el XLSForm:

| type | name | label |
|---|---|---|
| `hidden` | `collectorID` | Collector ID |

En el XML que Enketo sirve hoy para CCSS hay **212 nodos y ninguno se llama
`collectorID`** (comprobado contra `GET /api/v2/assets/<uid>.xml`, no contra el
borrador). Enketo ignora en silencio un `d[...]` cuyo nodo no existe: el
formulario abre, la persona responde, y la respuesta llega **sin aula**.

No se recupera después: no hay nada en la respuesta que permita reconstruir de
qué curso-horario vino. Por eso el ítem está bloqueado y no pendiente.

**Los PDFs ya generados siguen sirviendo.** El enlace de Enketo (`henYTZFJ`) no
cambia al volver a desplegar el asset, así que agregar la fila y redesplegar no
obliga a reimprimir: los 155 QR quedan válidos tal como están.

## Ítem 19 — el mismo nodo resuelve las dos cosas

Con `collectorID` en el formulario, el valor distingue el origen sin agregar
preguntas: `CH 1`–`CH 50` y `R n.k` para las aulas, `PILOTO` para el piloto, y
un valor propio para la campaña de sensibilización. Es la decisión que quedaba
abierta desde el 12/09.

## Un bug de la app que salió en el camino

Entrar a Materiales cerraba el proyecto. El GET de `materials/pruebas` era la
única llamada del cliente de Recopiladores sin `{ headers: headers() }`: viajaba
sin `X-Pulso-Session`, el backend contestaba `E_NO_SESSION` y `handle()` trata
ese código como sid inválido —borra el sid y emite `pulso:session-lost`—. Como
la dispara el `useEffect` de montaje de la sección, el ciclo se repetía.
Corregido y con regresión en `frontend/src/api/materialPruebasLlevaSesion.test.ts`
(commit `1f75fd04`).

## Dos observaciones de interfaz, sin bloquear

- El paquete agrupa por **facultad** (`Fichas/CIENCIAS SOCIALES/Titulares/…`) y
  los campos de la ficha rotulan «Escuela». En este estudio el estrato es la
  carrera; conviene que ambos lo digan.
- El contador de la tarjeta dice «1 de 155» con las 155 fichas hechas: cuenta
  instancias, no fichas, y una instancia lleva las 155 unidades dentro.


---

# Cuarta tanda — 2026-09-15 · la plantilla era la equivocada

La primera corrida salió con `ficha_aplicacion_a4_v1`, el **builtin del grid**:
título arriba a la izquierda, QR mediano, rejilla de rótulos claros, y rotulaba
«Escuela». No es el formato del operativo.

**El estándar es `ficha_campo_qr_a4_v1`** —QR grande arriba, título `CH n · aula`
centrado debajo, formulario de campo en dos columnas a mitad de hoja, enlace al
pie, logo— y trae **verso de croquis del campus** con el pabellón resaltado. Lo
verifiqué contra `Fichas QR Completo/` del segundo sorteo de HSVG2026, no contra
la memoria: misma retícula, mismos catorce rótulos.

Por qué salió mal: la ficha de prueba y el paquete usan **la plantilla de la
sesión**, y sin un `PUT /api/recopiladores/material-template` la sesión arranca
con el builtin del grid. Está anotado en la memoria del lote de HSVG y no lo
apliqué. Corregido instalando la plantilla que devuelve
`collection_material_field_sheet_template()` (revisión 5 del proyecto).

Los 155 enlaces **no cambiaron**: el set de `qr_payload` del `accesos.tsv` es
idéntico al de la corrida anterior. Lo que cambió es el papel.

## Lo que queda abierto sobre el enlace

El enlace de HSVG lleva `returnUrl=https%3A%2F%2Fpulso.pucp.edu.pe%2Fnoticias%2Fenlace`;
el de CCSS **no lleva ninguno**, porque el campo Return URL quedó vacío. Sin él,
al enviar la respuesta Enketo muestra su propia pantalla de agradecimiento en vez
de la página de PULSO. Es un campo y una regeneración; no se toca sin que Gonzalo
diga qué URL va.

## Sobre el QR suelto del piloto

`CCSS2026_PILOTO_qr.png` (1200 px) y `.svg` (vectorial) salen de
`collection_qr_matrix()`, el mismo generador que dibuja el QR de cada ficha, con
los mismos parámetros del preset (`correction = "M"`, `quiet_zone = 4`): 49×49
módulos. **No pude decodificarlo en esta máquina** —no hay `zbarimg` ni `pyzbar`
ni un encoder independiente con el que cruzar— así que la comprobación de que
abre y de que el valor llega es escanearlo, que es para lo que existe el piloto.
Y hoy el valor NO va a llegar: el formulario sigue sin el campo `collectorID`
(ítem 18).

# Contrato — orden de categorías por gráfico (D8, F6)

Fecha: 2026-10-10. Estado: **aprobado por el lead** (81075745a, con el cambio de §4 sobre residuales en
`personalizado`).
Decisión de Gonzalo (textual, D8): «ambas opciones deben ser posibles e incluso debe permitir orden personalizado».
Principio vigente: «el recetario siempre manda». Por eso el orden por defecto es el que dibuja el recetario para ese dato.

## 1. Clave y forma

La clave va en los `args` del gráfico, al lado de `var`, y **no** dentro de `overrides`. Motivo: `overrides` se funde con
los argumentos del graficador, y `graficar_barras_numericas` ya tiene un formal `orden_categorias` con otros valores.

```json
"grafico": {
  "graficador": "p_barras_categoricas",
  "args": {
    "var": "p7",
    "orden_categorias": { "modo": "personalizado", "lista": ["3", "1", "2"], "invertir": false }
  }
}
```

| Campo | Tipo | Por defecto | Regla |
|---|---|---|---|
| `modo` | `"recetario"` \| `"frecuencia"` \| `"instrumento"` \| `"personalizado"` | `"recetario"` | Un modo desconocido no rompe el export: se usa `recetario` y el motor avisa. Por HTTP, `/validar` y los exports lo informan en `warnings`. |
| `lista` | arreglo de **códigos de respuesta** (texto: `"1"`, `"0"`, `"NS"`) | `[]` | Sólo se lee con `personalizado`. Nunca etiquetas: la etiqueta es para mostrarse y puede cambiar (memoria «emparejar por la etiqueta que se muestra»). |
| `invertir` | booleano | `false` | Invierte el orden de lectura que resulta del modo (§4). |

Ausente, `null` o `{}` equivalen a `{ "modo": "recetario" }`.

**Graficadores a los que aplica:** `p_barras_categoricas`, `p_barras_agrupadas` (las categorías de `var`; las series del
cruce siguen su propio orden), `p_pie` y `p_donut`. En escalas (`p_barras_apiladas`, `p_barras_multiapiladas`) **no
aplica**: las categorías son los niveles de la escala y siempre van en el orden de la escala. Ahí la clave se ignora con
aviso. El orden de las filas (D1, Top Two Box) es otra cosa (§4).

## 2. Qué dibuja `recetario` (verificado contra recetario-moderna.pptx)

| Dato | Orden | Evidencia |
|---|---|---|
| Lista ordinal (la que Analítica declara ordinal o la heurística `.orden_categorias_ordinal_auto`) | Instrumento | p68 «Nivel curricular» (Quinto…Décimo ciclo); p152 «¿Cuánto tiempo le tomó…?» (Menos de 2 meses → Más de un año); p160/p162 «Rango de edades» y «Máximo grado» |
| Dos categorías (dicotomía) | Instrumento | p69/p70 (Sí, No); p160/p164 (Masculino, Femenino) |
| Nominal de más de dos categorías | Frecuencia, de mayor a menor | p152 «Sector en el que trabaja» (Privado 46 %, Público 27 %, …, Otro al final) |
| Opción múltiple (ranking) | Frecuencia, de mayor a menor | p73 «Qué podría mejorar la carrera» |
| Residuales («Otro», «Otros», «No sabe», «Ninguna», «Ninguno», «Prefiero no») | **Siempre al final** en los modos automáticos; en `personalizado` manda la lista (§4) | p152 (Otro), p162 («Otro (especifique)» al final aunque el instrumento lo ponga segundo) |

La población (p160) queda cubierta por estas reglas: sus variables son ordinales o dicotomías. No hay una regla aparte
por tipo de lámina. Sin verificar: en p162, «Departamento académico» (nominal) da el mismo orden por frecuencia que por
instrumento, así que esa página no distingue los dos modos.

**Ordinal efectivo.** Decide en este orden:
1. La marca de Analítica, en los dos sentidos: una lista marcada «no ordinal» es nominal y una marcada ordinal es
   ordinal. La ruta de Gráficos la recibe en `inst$listas_nominales` e `inst$listas_ordinales`, que estampa
   `.graficos_apply_orden_categorias_sources`.
2. Sin marca, la heurística compartida `.orden_categorias_ordinal_auto`.
3. Si con eso no es ordinal, las **pistas de orden** de las etiquetas (`.goc_pistas_orden`):
   - al menos la mitad lleva cifras (rangos, años, «Menos de 2 meses»);
   - o hay dos o más grados académicos («Bachiller», «Magíster», «Doctor»);
   - o hay dos o más ordinales en palabras («Quinto ciclo»);
   - o hay dos o más palabras de gradación.

   Motivo, medido en acrconta: la heurística compartida exige códigos crecientes y dejaba fuera los rangos de edad
   recodificados antes del 11-08 (D5), los años de egreso y los grados. Con sólo esa heurística, 6 láminas de perfil
   cambiaban de orden contra lo que dibuja el recetario (p160, p162). Con las pistas, 0.

## 3. Precedencia: quién decide el orden de un gráfico

1. `args.orden_categorias` con un modo distinto de `recetario`.
2. Si el modo es `recetario` (o falta) y el gráfico trae un orden heredado explícito, ese orden se respeta tal cual. Son
   los controles anteriores: `overrides.orden_barras`, `overrides.ordenar_categorias` u `overrides.orden_categorias_manual`
   (por etiqueta). Así un `.pulso` existente no cambia lo que su analista eligió.
3. El preset global del graficador (Configuración global › Estilo), **sólo si difiere del de fábrica**: el de fábrica
   (`orden_barras = "instrumento"`, `ordenar_categorias = "ninguno"`) viaja guardado en todo `.pulso` y no es una
   decisión del analista.
4. La regla del recetario (§2).

No hay herencia desde la lámina ni desde el plan: hoy no existe ese patrón para los argumentos de un gráfico. El nivel
compartido es el preset global (paso 3).

**Cambio de salida declarado:** con la regla del recetario, las nominales de más de dos categorías que hoy salen en orden
del instrumento pasan a salir por frecuencia, salvo que su `.pulso` haya fijado otro orden (pasos 1–3). Las cifras, bases
y denominadores no cambian; sólo cambia el orden. Se mide en acrconta y se reporta (ver la entrega).

## 4. Modos, `invertir`, residuales y su relación con D1/D9

| Modo | Orden resultante (antes de los residuales) | Con `invertir` |
|---|---|---|
| `instrumento` | El de `orders_list[[var]]`, que ya incluye el orden por lista de Analítica | El inverso |
| `frecuencia` | Mayor a menor; los empates quedan en orden del instrumento | Menor a mayor |
| `personalizado` | Los códigos de `lista` en su orden (residuales incluidos, donde los ponga). Luego las no listadas en orden del instrumento y, al final, las residuales no listadas | La parte listada al revés; las no listadas, detrás como siempre |
| `recetario` | El modo que le toca al dato (§2) | El inverso de ese modo |

«Antes de los residuales» en esta tabla vale para `recetario`, `frecuencia` e `instrumento`.

- **Residuales:** en `recetario`, `frecuencia` e `instrumento`, después de resolver el modo (e `invertir`), las
  categorías residuales van al final en su orden relativo. En `personalizado` **manda el analista**: un residual va donde
  la `lista` lo ponga. Sólo un residual que no está en la `lista` va al final de todo, después de las demás no listadas.
  `invertir` en `personalizado` invierte la parte listada (residuales listados incluidos); las no listadas siguen detrás,
  igual que sin `invertir`. La regla de reconocimiento es la
  vigente (`.CATEGORIAS_RESIDUALES`); D15 decidirá si se cierra (decisión del lead: D15 trata del reconocimiento, no de
  prohibir mover «Otro»).
- **Personalizado incompleto:**
  - Una categoría del instrumento que falta en `lista` (nueva, o que el analista no listó) va al final, en orden del
    instrumento; si además es residual, va después de las demás no listadas. Avisa: «“<pregunta>”: N categorías no estaban en el orden personalizado y van
    al final: <etiquetas>».
  - Un código de `lista` que ya no está en el instrumento se ignora y avisa: «“<pregunta>”: el orden personalizado nombra
    códigos que la pregunta no tiene: <códigos>».
  - Una categoría sin respuestas (0 %) sigue la regla vigente: no se dibuja.
- **D9 («invertir orden»):** en estos graficadores, `invertir` **es** la semántica que D9 propone («invertir el orden de
  lectura», falso por defecto). Los `invertir_barras` e `invertir_segmentos` de las escalas no se tocan; su migración
  queda para el ADR de D9.
- **D1 (multilistas por Top Two Box):** ordena **filas** (premisas) de una escala. `orden_categorias` ordena
  **categorías** de una nominal. No se cruzan: en una escala la clave se ignora (§1) y las filas siguen D1.

## 5. Misma espec en PPT nativo, ruta anterior y Word

El motor resuelve `orden_categorias` **antes** de dibujar (`.plan_orden_categorias`, archivo nuevo
`api/R/graficos_orden_categorias.R`). Lo traduce a los argumentos que el graficador ya entiende:

- categóricas y agrupadas: `orden_barras` ∈ {instrumento, mayor_menor, menor_mayor, manual} y `orden_categorias_manual`;
- pie y dona: `ordenar_categorias` ∈ {ninguno, desc, asc, manual} y `orden_categorias_manual`.

El graficador arma una sola espec (`pulso_espec`). De ella leen la lámina nativa, el ggplot de la ruta anterior y el Word
(`reporte_word_plan` reusa `reporte_ppt_plan(solo_lista = TRUE)`). Por eso el orden es el mismo en los tres.

Sin verificar: con `frecuencia` en la **ruta anterior** de las categóricas, el ggplot no fuerza los residuales al final
(sólo lo hace la espec). La lámina nativa y el Word sí lo hacen. En `personalizado` la espec no mueve residuales: respeta la
lista.

## 6. Persistencia

- `orden_categorias` vive dentro de `plan.slides[].payload.<slot>.args`, que se guarda tal cual en la config de Gráficos
  y en el `state.rds` del `.pulso`. **No** es un campo nuevo de primer nivel de la config, así que no cruza las cuatro
  whitelists de `KNOWN_KEYS` (memoria «Whitelists de la cadena graficos config»).
- **Frontend:** verificar que `metadataSanitizers.ts`, el normalizador del plan y el inspector no descarten la clave
  dentro de `args`. Es la misma clase de fuga.
- **Normalizador R:** `.graficos_orden_cat_normalizar()` produce siempre `{modo, lista, invertir}` con tipos fijos. Es
  idempotente. Hay test de ida y vuelta por `.normalize_plan` y por guardar y cargar el `.pulso`.

## 7. Lo que el frontend necesita: `GET /api/graficos/categorias`

Es un endpoint nuevo: ninguno de los existentes entrega código, etiqueta y frecuencia por pregunta.

`GET /api/graficos/categorias?var=<referencia>&scope=<|consolidado>`, con el header `X-Pulso-Session`. `var` acepta `p7` o
`docentes$p7`; una referencia sin base se resuelve contra la **base activa** de la sesión (en el consolidado,
contra la primera). El frontend debería mandar siempre la calificada (`base$var`).

```json
{
  "var": "p7", "base": "docentes", "pregunta": "Departamento académico al que pertenece:",
  "list_name": "lst_p7", "ordinal": false, "tipo": "select_one", "modo_recetario": "frecuencia",
  "categorias": [
    { "codigo": "1", "etiqueta": "Departamento de Ciencias Contables", "n": 46, "pct": 0.885, "residual": false },
    { "codigo": "0", "etiqueta": "Otro (especifique)", "n": 2, "pct": 0.038, "residual": true }
  ],
  "orden": { "recetario": ["1", "2", "3", "0"], "instrumento": ["1", "2", "3", "0"], "frecuencia": ["1", "2", "3", "0"] }
}
```

- `categorias` va en orden del instrumento. `n` y `pct` son sin filtros de lámina: son la referencia para ordenar, no la
  cifra que se dibuja.
- `orden.*` ya trae los residuales al final. Es lo que dibujaría cada modo sin `invertir`.
- **Errores:**
  - 400 `E_BAD_CATEGORIAS_VAR`: falta `var`.
  - 404 `E_CATEGORIAS_VAR_NO_EXISTE`: la variable no está en la base.
  - 409 `E_CATEGORIAS_SIN_LISTA`: la variable no tiene lista de opciones.
  - 409 `E_NO_VALID_RP_DATA`: sin fuente procesada; mismo código que `/preview-slide`.

## 8. Tests que fijan el contrato (backend)

- Cada modo en una categórica nominal, verificado en el XML de la lámina nativa.
- `recetario` por tipo de dato: ordinal, dicotomía y nominal de más de dos.
- `personalizado` con una categoría faltante y con un código que ya no existe, con sus avisos.
- Residuales al final en los modos automáticos, también con `invertir`; en `personalizado`, donde los ponga la lista,
  y los no listados al final de todo.
- Precedencia frente al orden heredado y al preset global distinto del de fábrica.
- Word igual a PPT: la espec del Word con el mismo orden.
- Escala: la clave se ignora con aviso.
- Normalizador idempotente y ida y vuelta por `.normalize_plan` y `.pulso`.
- Contrato HTTP de `/api/graficos/categorias` y de `/preview-slide` con `orden_categorias`.

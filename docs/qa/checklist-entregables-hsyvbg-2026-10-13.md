# Checklist: el motor genera los entregables de HSyVBG 2026 (2026-10-13)

Origen: maqueta «HSyVBG PUCP 2026_Lista y formato de entregables.xlsx» (carpeta
`01_Estudios/2026_PUCP_HSyVbG/Entregables 2026/`), aprobada por la OIGD el
2026-10-09. Diagnóstico de brechas del 2026-10-10: las tablas anuales están casi
cubiertas; los comparativos 2024-2026 no existen en el motor. Gonzalo pidió seguir
la ruta recomendada («hazlo así»): primero el punto 1, luego 2 y 3.

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| 1a | Fuente configurable («Fuente: Pulso PUCP 2026.») | motor + config `notas.fuente` + Analítica | hecho y verificado (1435d38c6) |
| 1b | Línea «Base: …» por pregunta, con texto por defecto | motor + config + Analítica | hecho y verificado (1435d38c6) |
| 1c | Notas por variable de cruce | motor (cruces) + Analítica | hecho y verificado (1435d38c6) |
| 1d | Aviso automático de base reducida | motor (cruces) + Analítica | hecho y verificado (1435d38c6) |
| 1e | Nota de significancia con la redacción de la maqueta | motor | hecho y verificado (1435d38c6, 41d6c7f78) |
| 1f | «Agrupar categorías» en Codificación, crea `<var>_recod` o `<var>_agrup` | Codificación (motor + UI) | hecho y verificado (ecba8c17c, 23ba9d819) |
| 2 | Armonización en la app: base .sav sin XLSForm (R1), peso por columna y por base (R2), armonización en la matriz de equivalencias e importador de bloques (R3) | Carga, Ponderación, Equivalencias | hecho y verificado (55ba17126, d316123ee, d9cac8fdf, 95899f3cf) |
| 3a | Comparativo simple (años en columnas, sin Total combinado, n.c., n.a.) | motor + pestaña «Comparativos» | hecho y verificado (10f2ab416, 7b79bf9ba, 9bb20d390, 72434515b) |
| 3b | Comparativo de cruces (Respuesta × Año, letras por año, n.a.) | motor + pestaña «Comparativos» | hecho y verificado (10f2ab416, 7b79bf9ba, 57b36023a, 72434515b) |
| E8 | Prueba de punta a punta con las bases reales 2024-2026 | proyecto (copia) | hecha: cifras 2024 y 2025 idénticas a la maqueta |
| P1 | Completar en la matriz las 94 variables 2026 «(pendiente)» y corregir sus errores (ver Observaciones_Matriz) | proyecto | pendiente (equipo del proyecto) |
| P2 | Armonizar a mano S-05 lugar de nacimiento y los cruces (agrupar por base) | proyecto | pendiente (equipo del proyecto) |
| P3 | Configurar notas al pie del proyecto (fuente 2026, base, notas de cruce) | proyecto | pendiente (equipo del proyecto) |
| m1 | Subtabla de letras puede partirse entre páginas al imprimir | motor | pendiente menor |
| m2 | Rótulos de pregunta en Carga › Revisión salen con nombre técnico cuando el XLSForm solo trae `label::<idioma>` | lector XLSForm | bloqueado: decisión con nucleo-metodologico (afecta validación y codificación) |
| m3 | Panel y tablas multibase sin notas al pie configurables | motor | pendiente menor |
| m4 | `importar-bloques` sin modo «detectar años»; preview de ponderación ignora modo columna | motor | pendiente menor |

## Contrato congelado para 1a–1e

Config de Analítica, bloque nuevo compartido por frecuencias y cruces:

```json
"notas": {
  "fuente": "Pulso PUCP",
  "base_defecto": "",
  "base_por_pregunta": { "<variable>": "<texto>" },
  "por_cruce": { "<variable de cruce>": "<texto>" },
  "base_reducida": { "activo": false, "umbral": 30 }
}
```

Reglas de render:

- Frecuencias: «Fuente: {fuente}» en su línea. Si hay base (la de la pregunta o, si
  no, la por defecto), una línea «Base: {texto}».
- Cruces: una línea «Fuente: {fuente}. Base: {texto}. Porcentajes por columna.»
  (se agrega el punto si la fuente no termina en él; «Base…» y «Porcentajes…» solo
  si hay base). Debajo, una línea por cada variable del banner que tenga nota en
  `por_cruce`, en el orden del banner. Debajo, si `base_reducida.activo`, una línea
  con las columnas cuyo número de casos válidos SIN ponderar es menor que el umbral.
- Sin config `notas` el resultado es el de hoy («Fuente: Pulso PUCP»), salvo la nota
  de significancia (1e), que cambia para todos.
- Cambiar `notas` invalida frecuencias y cruces ya generados.

## Aprendido (para no reinvestigar)

- El peso se lee siempre de la columna `peso` (`reporte_cruces.R:79-86`,
  `reporte_frecuencias.R:135`). La base 2026 no debe traer una columna con ese nombre.
- La multibase actual suma un Total combinado que no se puede quitar
  (`analitica_multibase.R:701-704`) y empareja solo por nombre de variable. No sirve
  para 3a sin un writer nuevo.
- La matriz de equivalencias (`equivalencias_publicos.R`) relaciona preguntas con
  nombres distintos entre bases, pero no recodifica códigos.
- Codificación solo crea `_recod` por tramos numéricos o asignando el texto de
  «Otro». Agrupar códigos existentes no existe (`router_codificacion.R:1470-1477`).

## Diseño de 1f (investigación del 2026-10-13)

- Base a extender: la ruta `integer` (reglas por grupo, catálogo solo con códigos
  nuevos, `.add_recoded_q(copy_from_original = FALSE)`). No el modo «padre» de
  select_one: su catálogo arrastra el original y `.pulso_repair_parent_recod_columns`
  (`project_pulso.R:1379+`) lo pisa al abrir el proyecto.
- Hallazgo: hoy, en una select_one sin texto, agrupar códigos en la pantalla no tiene
  efecto (el puente compara solo textos, `router_codificacion.R:1456-1477`).
- Spec nueva en `codif_por_base[[base]]$agrupaciones[[parent]]`:
  `{parent, target, text_col, codigo_otro, categorias: [{codigo, etiqueta, codigos[],
  rango{min,max}, otros_textos[], otros_numerico, otros_resto, resto}]}`.
  Orden: si el valor es `codigo_otro` con texto, primero `otros_textos`, luego
  `otros_numerico` con rango, luego `otros_resto`; si no, `codigos` o `rango`, luego
  `resto`; si nada calza, NA.
- Archivos: nuevo `api/R/codificacion_agrupar.R` (función pura), endpoints en
  `router_codificacion.R`, paso en `ppra_adaptar_data` después de INTEGER,
  `codificacion_aplicar_instrumento.R`, `codificacion_config_json.R`,
  `graficos_recod_gate.R`, exclusión en `project_pulso.R`; frontend
  `AgruparCategoriasCodificador.tsx`, `api/codificacion.ts`, selector en
  `CodificarWizard.tsx:317` y `PreguntaDetalle.tsx:119`.
- Riesgos: choque de nombre si la variable ya tiene `_recod` por «Otro» (target
  configurable), invalidación de Analítica solo al reaplicar.

## Datos del proyecto real (sesión de procesamiento, 2026-10-13)

- `.pulso` candidato: `01_Estudios/2026_PUCP_HSyVbG/Procesamiento/Hostigamiento_Recodificacion.pulso`
  con `HOSTIGAMIENTO_LIMPIO.xlsx` (3 318 filas, 262 columnas). Si es el de los
  entregables lo decide Gonzalo.
- La base limpia no trae columna `peso` (ni weight, pond, factor): sale sin ponderar.
- P4 y P8 ya tienen catálogo de «Otro» en Codificación sin aplicar (P4 agrega
  4 Pansexual/Queer y 5 Asexual/Arromántico; P8 manda los años de «Otro» a 88 y tiene
  un código «1» vacío que sobra). P5 no tiene. Ese catálogo reserva `<var>_recod`, así
  que la agrupación de 1f usa otro nombre (`<var>_agrup`).
- Pendiente de Gonzalo: cómo conviven Limpieza hecha fuera y Codificación ya hecha.

## Pendientes menores de 1a–1e (verificador, 2026-10-13)

- QA visual de «Notas al pie» en Frecuencias y Cruces (plegada y abierta, 1440x1000 y 1024x600).
- Panel (`analitica_panel.R`) y tablas multibase (`analitica_multibase.R`) siguen con «Fuente: Pulso PUCP» fijo. Entra con E5.
- Sin test de router para la invalidación por `notas`. Un proyecto viejo se invalida una vez al primer guardado.
- Código muerto: `.notas_pie_lineas_frecuencias` y `letras_map_text` en `reporte_cruces.R`.

## Contrato E4-E7: armonizar mediciones en la app (congelado 2026-10-13)

Ruta elegida por Gonzalo: «hazlo así en la app». La armonización vive en la matriz
de equivalencias (ADR 0062), no en un script. Cuatro rebanadas, cada una con su test:

- **R1 · Base .sav sin XLSForm.** `POST /api/estudio/base-sav {data_file_id, nombre}`
  sintetiza survey/choices desde las etiquetas del .sav (`.panel_infer_type`,
  `.panel_choice_rows_from_labels`, `.bases_label_pairs`), lo guarda como archivo
  `xlsform` y registra la base con `estudio_add_base`. Archivo nuevo
  `api/R/carga_sav_sin_xlsform.R`. Debe sobrevivir a guardar y reabrir el .pulso.
- **R2 · Peso por columna y por base.** En `analitica_config_por_base[[b]]$ponderacion`:
  `{"enabled": true, "modo": "columna", "peso_columna": "factor_ponderacion"}`. Dentro
  de `.analitica_ponderacion_apply`: `data$peso <- as.numeric(data[[peso_columna]])`.
  `.analitica_ponderacion_apply_sources` resuelve la config de CADA base
  (`.analitica_cfg_para_base`). Sello «columna» en `reporte_ponderacion_sello.R`.
  2026 queda `enabled: false`.
- **R3 · Armonización en la fila de la matriz.** Campo opcional:
  `"armonizacion": {"escala": [{"codigo","etiqueta"}], "por_base": {"<base>":
  {"comparable": bool, "nota"?: str, "mapa": {"<cód base>": "<cód armonizado>"}}}}`.
  Mapa vacío es identidad. Se aplica con `codif_agrupar_df` (los 80-99 sin mapear quedan
  NA). Tocar `.equiv_guardar_declaracion` (hoy descarta campos desconocidos),
  `.equiv_importar_desde_file` (conservar por `variables`), `.equiv_declaracion_revision`.
  Orden de períodos a nivel de estudio: `"armonizacion_periodos": ["2024","2025","2026"]`.
  UI: `ArmonizacionFilaEditor.tsx` en `features/carga` reutilizando `agruparCategoriasModel`.
- **R4 · Entregables.** `api/R/analitica_armonizada.R`: apila las bases con columna
  `periodo` y aplica mapas. Writer comparativo simple (períodos en columnas, N y %, sin
  Total combinado, «n.c.») y comparativo de cruces (Respuesta × período en filas, letras
  con `comparar_columnas_sig` dentro de cada período, «n.a.»). Las variables de cruce se
  armonizan con agrupaciones 1f por base. Endpoints `POST /api/analitica/armonizada/
  frecuencias` y `/cruces` (jobs). Pestaña en Analítica. Notas al pie con el bloque
  `notas` de 1a-1d.

## Matriz del proyecto: `Matriz_HSyVbG_PUCP_2022-2026.xlsx` (revisada 2026-10-13)

Ruta: `01_Estudios/2026_PUCP_HSyVbG/Procesamiento/`. Hoja «Matriz de correspondencias»:
100 bloques (28 plenamente comparables, 62 parcialmente, 10 no comparables). Cada bloque:
fila con ID (S-04, T-01, A-03, con sufijo -HS/-VB) y nivel de comparabilidad, luego
«N.º de pregunta», «Enunciado», «Variable en la base de datos» y una fila por categoría
armonizada con «etiqueta [código]» por año; «—» = no existe ese año. Regla de la guía:
recodificar por etiqueta, nunca por código ni posición (casos A-03/A-04, RC-01…RC-04,
RI-03, CO-01, CO-03, AP-10, AP-11, A-01, A-02).

- Es la fuente natural de R3: un importador de este formato llena `variables`,
  `armonizacion.escala`, `por_base[*].mapa` (desde «[código]») y `comparable`/`nota`.
  Se importa a la matriz de la app y desde ahí se edita.
- La columna 2026 sale del cuestionario, no de la base: 94 de 100 bloques tienen
  «(pendiente)» en «Variable en la base de datos». Hay que llenarla con la base 2026
  (renumeración P9 a P66 conocida).
- **Error encontrado:** S-05 Lugar de nacimiento dice que 2025 no tenía «Fuera del país».
  La base 2025 sí lo tiene: P5 código 27 «Fuera del país», 37 casos. Solo 2024 no lo
  tenía. Corregir antes de importar (y avisar: la matriz la compartió Nadia, OIGD).

## R4b: correcciones metodológicas al comparativo (revisor-metodologico, 2026-10-13: RECHAZADO)

Backend de R4 commiteado en 10f2ab416 (verificador APROBADO en contrato y formato). El
revisor metodológico lo rechazó por cifras que pueden salir mal sin aviso. Pendiente
como R4b, antes de dar los comparativos por buenos:

1. **Misma fuente que Analítica.** `.armz_preparar` lee `rp_data_sources`
   (`.equiv_armon_datos_base`). Debe usar la ruta de Analítica (`.load_rp_sources` +
   `.analitica_apply_data_review` por base, fuente «adaptados» con `_recod`/`_agrup`).
   Invariante: N sin ponderar del comparativo = denominador de la tabla anual del mismo
   año y variable cuando el mapa es total. Sin esto un cruce `P8_agrup` falla.
2. **Ponderación declarada por base.** Una columna `peso` sin declaración no debe
   ponderar el comparativo: 409 `E_ARMONIZADA_PESO_NO_DECLARADO` o modo explícito. El pie
   dice cómo se ponderó cada año.
3. **Casos sin mapa visibles.** `n_sin_mapa` (sustantivos) y `n_especial_sin_mapa` por
   pregunta y año en el manifest; con sustantivos sin mapa, aviso o error.
4. **Categoría no ofrecida ese año** (sin origen en el mapa): marca estructural distinta
   de «0 %» (por acordar con la maqueta, p. ej. «—») y nota al pie.
5. **«n.a.» separado de defectos.** N==0 con valores no NA en la original es mapa roto
   (409), no «n.a.». Rechazar variables `select_multiple`.
6. **Año de ingreso / años de estudio** se armoniza relativo al año de medición, con mapa
   por base declarado a mano. El importador avisa si las etiquetas de un bloque son años.
7. Menores: `N_sin_peso` debe contar `w > 0`; probar `haven_labelled` y factor;
   verificar `sum(w)/n` (2025 suma 2 500 con n = 2 471, +1,2 %) y declarar «N ponderado,
   sin corrección por efecto de diseño» en el pie.
8. Notas de la maqueta que el esquema no expresa: nota libre por pregunta («En cada
   medición la pregunta se refiere al año…») y nota de segmentos; redacción agrupada de
   bases reducidas; saltos de página para no partir tablas.

Datos medidos: 2024 n = 2 267, suma de pesos 2 267,97, deff 1,03. 2025 n = 2 471, suma
2 500, deff 1,001.

## E8: prueba de punta a punta con los datos reales (2026-10-13)

Motor vía `load_all` sobre copias: .pulso 2026 (3 318 casos, sin peso), .sav 2024
(2 267, factor_ponderacion, suma 2 267,97) y .sav 2025 (2 471, suma 2 500), matriz real
importada (100 bloques, 78 filas, 73 con armonización). PV-01 (P11/P11/P12) y S-05 lugar
de nacimiento completadas a mano.

- **Cifras 2024 y 2025 idénticas a la maqueta** (diferencias de 1e-11 a 1e-13), en el
  simple y en cruces, incluidas las letras. 2026 sin peso: Sí 919 (27,70 %), No 2 160
  (65,10 %), No sé 239 (7,20 %).
- Defectos del importador encontrados (en corrección): falsos positivos de
  `etiqueta_distinta` con celdas «[n]» sin rótulo, detector de cohorte que no salta con
  «Otros [10]» y años guardados como código en 2025, enunciado descartado, numeración del
  eje en el título de sección.
- Configuración pendiente del proyecto: 94 variables 2026 «(pendiente)» en la matriz,
  S-05 sin códigos, notas al pie (fuente 2026, base) sin configurar.
- Decisión pendiente de Gonzalo: «—» (opción no ofrecida) frente a «n.a.» de la maqueta
  para «Fuera del país» en 2024.

## Ronda de claridad de la UI (pedido de Gonzalo, 2026-10-13)

Textual: «Debe seguir mejorando, además no especificas qué es armonizar, debe estar claro
y recuerda que las columnas pueden ser más de 3 o puede haber bases con nombres
diferentes».

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| U1 | Explicar qué es armonizar, en palabras simples y con un ejemplo, donde aparece (Equivalencias, editor de armonización, chip «Armonizada», pestaña Comparativos) | frontend carga + analítica | hecho y verificado (cb1a1ea90) |
| U2 | Funcionar con más de 3 bases: tabla de equivalencias, orden de la serie, editor de armonización, rótulos y tarjetas de Comparativos (probar con 4 y con 7 bases) | frontend | hecho y verificado (cb1a1ea90) |
| U3 | Bases con nombres que no son años (docentes, estudiantes…): rótulos por defecto, textos que no digan «año» si no lo son, encabezado «Año» del XLSX | frontend + motor (`reporte_comparativo.R`) | hecho y verificado (cb1a1ea90, 8732b5428) |
| U4 | Tarjetas de Comparativos más legibles con 74 preguntas (jerarquía, búsqueda o filtro por sección) | frontend analítica | hecho y verificado (cb1a1ea90) |
| U5 | No hay lugar visible para ver ni editar `variables_excluidas` (DefinicionGlobal no está montado). Analítica › Datos dice «265/265 incluidas» con 2 excluidas | frontend analítica | hecho y verificado (644c39c44) |
| U6 | El Codebook muestra «Excluidas 0» unos 15 s con la readiness ya en verde y luego pasa a 2 | frontend analítica | hecho y verificado (644c39c44) |

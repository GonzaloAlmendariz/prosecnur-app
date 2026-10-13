# Checklist: el motor genera los entregables de HSyVBG 2026 (2026-10-13)

Origen: maqueta «HSyVBG PUCP 2026_Lista y formato de entregables.xlsx» (carpeta
`01_Estudios/2026_PUCP_HSyVbG/Entregables 2026/`), aprobada por la OIGD el
2026-10-09. Diagnóstico de brechas del 2026-10-10: las tablas anuales están casi
cubiertas; los comparativos 2024-2026 no existen en el motor. Gonzalo pidió seguir
la ruta recomendada («hazlo así»): primero el punto 1, luego 2 y 3.

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| 1a | Texto de fuente configurable («Fuente: Pulso PUCP 2026.») en frecuencias y cruces | motor (`reporte_notas_pie.R`, `reporte_frecuencias.R`, `reporte_cruces.R`), config `notas.fuente`, UI Analítica | hecho y verificado (commit 1435d38c6), falta QA visual de la sección |
| 1b | Línea «Base: …» por pregunta, con un texto por defecto | motor + config `notas.base_defecto`, `notas.base_por_pregunta` + UI | hecho y verificado (commit 1435d38c6), falta QA visual de la sección |
| 1c | Notas por variable de cruce (lugar de nacimiento, discapacidad con cita de P10) | motor (cruces) + config `notas.por_cruce` + UI | hecho y verificado (commit 1435d38c6), falta QA visual de la sección |
| 1d | Aviso automático de base reducida (casos sin ponderar bajo un umbral) | motor (cruces) + config `notas.base_reducida` + UI | hecho y verificado (commit 1435d38c6), falta QA visual de la sección |
| 1e | Nota de significancia con la redacción de la maqueta (sin «Letras por estrato» ni «Fuente») | motor (`reporte_cruces.R`) | hecho y verificado (commit 1435d38c6), falta QA visual de la sección |
| 1f | «Agrupar categorías» en Codificación que cree `<var>_recod` (orientación, lugar de nacimiento, año de ingreso con «Otro») | Codificación (motor + UI) | diseño listo (ver abajo), espera la oleada 2 |
| 2 | Base armonizada 2024-2026: año, peso por año (1 en 2026), 7 cruces armonizados, mapa de preguntas y códigos, tabla de comparabilidad (n.c./n.a.) | script del proyecto (parte de `segmentos_cruce_2024_2025.R`) + matriz de equivalencias | pendiente |
| 3a | Writer «comparativo simple»: años en columnas, sin Total combinado, «n.c.» por año | motor, archivo nuevo | pendiente |
| 3b | Writer «comparativo de cruces»: Respuesta × Año en filas, letras dentro de cada año, «n.a.» | motor, archivo nuevo | pendiente |

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

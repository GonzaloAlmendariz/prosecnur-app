# ADR 0106 — Cada base declara sus variables propias: columnas que trae y variables que se calculan en ella

- **Estado**: Propuesto — pedido de Gonzalo del 2026-10-15 («¿qué pasa si Ulises ya tiene la base lista limpia y
  codificada con los 2500 casos aleatorios, y con los indicadores creados ahí mismo, la app es capaz de reconocerlo?
  ¿hace falta que el XLSForm también tome en cuenta estos indicadores?»; «la base 2024 y 2025 ya tiene los indicadores
  pero la del 2026 aún no, ¿se pueden armar?»). Respuesta: «Hazlo».
- **Ámbito**: Carga (por base), Analítica, Codificación, Equivalencias
- **Fecha**: 2026-10-15
- **Relación**: continúa [ADR 0100](0100-la-base-limpiada-fuera-entra-declarada-y-la-codificacion-depende-del-texto.md)
  (la base preparada fuera entra declarada) y [ADR 0105](0105-la-matriz-declara-indicadores-compuestos.md) (indicador
  compuesto, que hoy vive sólo en los comparativos). Checklist: `docs/qa/checklist-matriz-equivalencias-oigd-2026-10-15.md` (G2, G4, G5).

## Contexto

La app sólo analiza lo que declara el instrumento (XLSForm) de cada base. Medido en HSyVbG:

- Las columnas de la data que el XLSForm no declara (`P12_R`, `facultad`, `indice_vbg`, `P23_recod`…) se conservan en
  la data pero no aparecen en Analítica (`.variables_desde_instrumento`), ni en Codificación, ni en el buscador de
  Equivalencias. La única forma de verlas es cargar el `.sav` sin XLSForm, y entonces se pierde el instrumento real.
- No hay forma de crear en una base una variable a partir de varias preguntas: «Agrupar» de Codificación parte de una
  sola, y el indicador compuesto (ADR 0105) sólo existe en memoria dentro de los comparativos.
- Una base que ya viene codificada se puede volver a codificar: Codificación reescribe `<var>_recod` sin avisar.
- La carga manual rechaza una base a la que el procesamiento externo le quitó preguntas (`E_DATA_XLSFORM_INCOMPATIBLE`).

## Decisión

1. **Columnas propias de la base.** La app detecta, por base, las columnas de la data que el instrumento no declara
   (sin contar las dummies de una opción múltiple que ya pliega el normalizador ni los metadatos). La persona puede
   **declararlas**: entran al instrumento adaptado de esa base como pregunta (nombre, etiqueta, tipo y, si es
   categórica, lista de opciones). En un `.sav` la etiqueta y las opciones salen del archivo; en un Excel se proponen
   los valores observados y la persona escribe las etiquetas. Una columna declarada es analizable como cualquier
   pregunta (Analítica, exportes, buscador de Equivalencias). El XLSForm original no se edita a mano.
2. **Variables calculadas en la base.** Una base puede declarar variables que se calculan a partir de otras de la misma
   base, con dos reglas: `alguna` (vale 1 si alguna de las variables tiene uno de los códigos indicados; mismo valor por
   caso que el ADR 0105: 1 / 0 / NA, especiales 80–99) y `recodificar` (una variable con un mapa de códigos a una escala
   nueva, varios códigos a uno). La declaración vive en la base, el valor se calcula al leer la base (la data original
   no se reescribe) y la variable entra al instrumento adaptado con su escala. Sirve en frecuencias, cruces, exportes y
   en la matriz de equivalencias como cualquier pregunta.
3. **Base ya codificada.** Una base se puede marcar «ya viene codificada». Mientras lo esté, Codificación no aplica
   sobre ella (responde 409 con un mensaje que lo explica) y la UI lo dice en vez de ofrecer aplicar.
4. **Preguntas retiradas en carga manual.** Una base a la que le faltan preguntas del instrumento ya no se rechaza: se
   carga, y las preguntas que faltan quedan como variables retiradas pendientes de motivo en la declaración de origen
   externo (ADR 0100), visibles en Carga.
5. **Persistencia.** Las columnas declaradas, las variables calculadas y la marca «ya codificada» viajan en el `.pulso`
   dentro de la meta de la base. El instrumento adaptado se reconstruye desde el instrumento original más esas
   declaraciones, de modo que reabrir el proyecto da lo mismo.

## Contrato (API)

- `GET /api/carga/base-variables?base=<b>` →
  `{ base, ya_codificada, extras: [{ name, label, tipo, opciones: [{codigo, etiqueta}], n_validos, declarada }],
     calculadas: [{ nombre, etiqueta, regla, variables, codigos?, mapa?, escala }],
     retiradas: [name] }`
- `POST /api/carga/base-variables/declarar` `{ base, declarar: [{ name, label, tipo, opciones? }], quitar?: [name] }`
- `POST /api/carga/base-variables/calculada` `{ base, nombre, etiqueta, regla: "alguna"|"recodificar", variables,
  codigos?, mapa?, escala }` (crea o reemplaza por `nombre`); `DELETE …/calculada?base=&nombre=`
- `POST /api/carga/base-variables/codificada` `{ base, ya_codificada: bool }`
- Errores con `stop_api` y códigos `E_BASE_VARIABLE_*` registrados; `E_CODIF_BASE_YA_CODIFICADA` en Codificación.

## Consecuencias

- La base preparada fuera entra tal cual y lo que trae de más se vuelve analizable sin tocar el XLSForm.
- 2026 puede tener las mismas variables derivadas que 2024 y 2025, calculadas en la app y reproducibles.
- El instrumento de una base deja de ser sólo el XLSForm: es el XLSForm más lo que la base declara. Toda vista que
  liste variables debe leer el instrumento adaptado.

## Cumplimiento

- testthat del detector, de la declaración, del cálculo (`alguna` y `recodificar`), de la persistencia ida y vuelta por
  `.pulso`, del bloqueo de Codificación y de la carga con preguntas retiradas; `make gate-area` del área carga/analítica.
- Vitest de los modelos y paneles nuevos; `make gate-front AREA=carga`.

## Notas

- **Qué retiradas salen del instrumento de la base.** No todas las declaradas. Salen las que registró la carga manual
  (la base llegó sin esa columna; la lista vive en `estudio$bases[[b]]$retiradas_carga_manual`, fuera del bloque
  `origen_externo`, para que sobreviva a que se redeclare el origen externo) y las de motivo `metadato` o
  `no_va_al_cliente`, que ya se excluían de los entregables. Una retirada de motivo `otra` declarada antes sigue siendo
  una pregunta del instrumento: si la base no trae su columna, se lee vacía en vez de tumbar la lectura. Toda retirada
  vigente se informa igual en `retiradas`. Un `relevant` de otra pregunta que cite una retirada no rompe la lectura.
- **Motivo `pendiente`.** Es el motivo que pone la carga manual a una pregunta faltante que no es metadato. Entra al
  vocabulario de motivos (`.ORIGEN_EXTERNO_MOTIVOS_VARIABLE`), no excluye de los entregables y el informe de
  metodología lo nombra «pendiente de motivo».
- **Privacidad del detector.** Los valores observados sólo se proponen como opciones en columnas numéricas o de texto
  categórico. Una columna de texto (sin etiquetas de valor de `.sav`) con más valores distintos que la mitad de sus
  casos válidos, o con algún valor de más de 40 caracteres, se propone como `text` sin opciones: nombres, correos y
  comentarios no viajan a la meta de la base ni al `.pulso`. Un `.sav` con etiquetas de valor sigue proponiendo sus
  etiquetas.
- **`alguna` sobre una opción múltiple.** Antes de evaluar, una celda con varios códigos («2 1») se reduce a uno: el
  primero que cuenta como «sí»; si no hay, el primero válido no especial; si no, el primero. Así «98 99» (sólo
  especiales) vale NA, mientras que el indicador compuesto del ADR 0105, que mira la celda entera, le da 0.

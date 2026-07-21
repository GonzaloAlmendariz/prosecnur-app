# ACRDCONTA: checklist de revision de logica

Fecha de preparacion: 2026-07-20

Proyecto de trabajo recomendado:
`/Users/gonzaloalmendariz/Documents/Pulso/pruebas-monitoreo/ACRDCONTA-reglas-resueltas-v5-1.pulso`

SHA-256 de entrada:
`eaea064910ce7e339edf87a8eee03fa42130270b1d747d6a60ebc3567ec27f9e`

Preflight complementario:
[auditoria tecnica y metodologica de logica](acrdconta_preflight_logica.md).

Este checklist es el punto de control humano entre los borradores recuperados
de SurveyMonkey y su publicacion como revisiones inmutables. Revisar y guardar
un formulario no equivale a publicarlo. La accion `Confirmar logica revisada`
debe ejecutarse solo despues de comprobar el instrumento completo; queda ligada
al hash actual y se invalida ante cualquier edicion posterior.

## Estado de entrada

| Actor | Entry ID | Form ID estable | Survey canonico | Variantes | Estado |
|---|---|---|---:|---:|---|
| Administrativos | `acrconta-administrativos` | `acrdconta_administrativos` | `527239231` | 0 | Logica pendiente |
| Estudiantes | `acrconta-estudiantes` | `acrdconta_estudiantes` | `527327742` | 0 | Logica pendiente |
| Docentes | `acrconta-docentes` | `acrdconta_docentes` | `422402983` | 1 | Logica y mapa pendientes |
| Egresados | `acrconta-egresados` | `acrdconta_egresados` | `527574340` | 2 | Logica y mapas pendientes |

Todos deben conservar `logic_pending_manual_confirmation` hasta terminar su
revision. No debe existir ninguna revision publicada, base de Procesamiento o
plan de intake durante este control.

La salida por `p1=No` ya fue incorporada como correccion acreditada por el
comportamiento de las siete fuentes. Debe verificarse, pero no volver a
eliminarse salvo evidencia metodologica contraria.

La v5.1 contiene las reglas resueltas de titulacion, empleo, ingreso, codigo
PUCP, metadatos telefonicos y servicios. La politica aprobada para continuar es
que el XLSForm canonico de cada actor gobierna sus variantes normalizadas; los
codigos personalizados permanecen exclusivamente como traza.

## Revision comun a los cuatro instrumentos

Para cada tarjeta, abrir el formulario y comprobar:

- texto, orden y agrupacion de todas las preguntas;
- nombres XLSForm estables y unicos;
- listas, codigos y etiquetas de respuesta;
- obligatoriedad real por pregunta y por canal;
- expresiones `relevant`, saltos, cierres y preguntas mostradas condicionalmente;
- restricciones, rangos y mensajes de validacion;
- tratamiento de `Otro`, no respuesta, rechazo y valores faltantes;
- que identificadores operativos o PII no se conviertan en variables analiticas
  compartidas por accidente;
- que la version abierta corresponda al actor indicado en la tarjeta;
- que no haya hallazgos bloqueantes antes de confirmar.

Secuencia por instrumento:

1. revisar el contenido completo;
2. corregir cualquier divergencia en el Editor;
3. guardar y volver a revisar si cambio el hash;
4. ejecutar `Confirmar logica revisada`;
5. comprobar que la confirmacion no publico automaticamente;
6. publicar la revision inmutable solo cuando el estado quede publicable.

## Administrativos

- Survey canonico: `527239231`, 15 preguntas remotas.
- Sin variantes de canal registradas.
- Confirmar que el instrumento completo aplica al universo administrativo y
  que no falta una variante operacional fuera de Monitoreo.

## Estudiantes

- Survey canonico: `527327742`, 30 preguntas remotas.
- Sin variantes de canal registradas.
- La hoja local de respuestas es evidencia auxiliar, no fuente de logica. No
  inferir saltos ni obligatoriedad a partir de valores observados.

## Docentes

- Survey canonico web: `422402983`, 37 preguntas remotas.
- Variante personalizada: `422658144`, 38 preguntas.
- El borrador propone 37 correspondencias exactas. Revisarlas y decidir el
  tratamiento de la pregunta adicional `Indique su codigo PUCP`.
- Confirmar expresamente que la variante personalizada comparte la misma
  logica analitica o registrar las diferencias antes de aprobar el mapa.

## Egresados

- Survey canonico telefonico: `527574340`, 36 preguntas remotas.
- Variante web: `422387259`, 33 preguntas, con 33 correspondencias exactas
  propuestas.
- Variante personalizada: `422879074`, 34 preguntas, con 33 correspondencias
  exactas propuestas y la pregunta adicional `Indique su codigo PUCP`.
- Revisar de forma explicita las reglas de ano de egreso/titulacion, funciones
  laborales, empleabilidad y los saltos asociados.
- Resolver el conflicto de fuentes auxiliares para ingreso rechazado: conservar
  `Prefiero no responder` como categoria o aplicar otra regla aprobada. No
  imputar automaticamente el tramo inferior.
- No propagar reglas de la guia telefonica a web o personalizado sin comprobar
  cada variante.

## Gate antes de promover desde Monitoreo

Solo despues de publicar las cuatro revisiones:

- crear el plan de ingreso con una revision por actor;
- previsualizar el mismo corte reconciliado de Monitoreo;
- exigir 519 casos en el rollup, 410 efectivos y 109 excluidos;
- exigir 15 Administrativos, 52 Docentes, 178 Egresados y 165 Estudiantes;
- comparar el checksum de seleccion con
  `6815b98da07c5d5da80f5f774efbf2bf685a1834cf571a2b3b534fa9faa2a9b3`;
- promover las cuatro bases de forma atomica; si una falla, no materializar
  ninguna.

Adicionalmente, el preview debe acreditar un mapeo por `.source_id -> survey_id`
y variante sellada. No se acepta el alias posicional global `qN -> pN`, porque
en los canales personalizados puede confundir el codigo PUCP con una variable
canonica. Toda fuente, matriz o sello desconocido bloquea el batch completo.

Despues del handoff, Validacion, Codificacion, Analitica y sus releases siguen
siendo independientes por actor. El informe compartido se compone en el visor
segmentado de bases usando solo releases aprobadas; no fusiona filas y puede
incluir barras multiapiladas en un unico PPT.

## Resultado de aplicacion

- [x] Cuatro revisiones publicadas e inmutables.
- [x] Cuatro instrumentos vinculados al plan multibase.
- [x] Corte de Monitoreo reproducido: 519/410/109 y 15/52/178/165.
- [x] Mapeo por fuente/variante sellada; cero alias posicional global.
- [x] Codificacion independiente aplicada en las cuatro bases.
- [x] Analitica independiente con exclusiones PII y cruces por genero.
- [x] Validacion post-codificacion: 896 reglas totales, cero no soportadas y
  cero inconsistencias.
- [x] Cuatro releases metodologicas aprobadas y fijadas por fingerprint.
- [x] PPT compartido de 94 laminas con cuatro comparaciones multiapiladas.
- [x] Manifiesto con revision, filas, release e input fingerprint por actor.
- [x] OOXML, render PDF 94/94 e inspeccion visual representativa aprobados.
- [x] `ACRDCONTA.pulso` original preservado por SHA-256.

Artefactos finales:

- `ACRDCONTA-procesado-v7.pulso` —
  `1b217a33beb4fcf3e7f9296cb803a3018df48111d9f3c9a92c9fbb53e27d0bfe`;
- `ACRDCONTA-informe-consolidado-v7.pptx` —
  `0319d59c1dc41057f2f50a6d954d577701c6f918f5963b66e131bd3cda991e9e`;
- `ACRDCONTA-informe-consolidado-v7-manifest.json` —
  `85e8427bbee6df0cc96ac9765c5e7052fb20d26dc3a27be323b9805b17378227`.

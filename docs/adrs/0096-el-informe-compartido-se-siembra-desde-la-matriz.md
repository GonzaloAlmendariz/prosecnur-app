# ADR 0096 — El informe compartido se siembra y se propone desde la matriz de equivalencias

- **Estado**: Aceptada (decisión 27 de Gonzalo, opción A, 2026-10-11)
- **Fecha**: 2026-10-11
- **Ámbito**: Procesamiento › Gráficos › informe compartido (`scope=consolidado`) y Láminas; Carga › Equivalencias
  (revisión de la declaración); persistencia `.pulso` sin cambio de `format_version` (A7 de la Meta A)
- **Relación**: enmienda el ADR 0040 (§6 firma de escala y §6.1 derivación del plan sugerido) y el ADR 0063
  (decisiones 1 y 7, Consecuencias «La propuesta envejece» y Notas); aplica la invalidación del ADR 0062
  («inferir equivalencia entre públicos por similitud de etiquetas»; «comparar variables de bases distintas sin
  declaración previa»); reutiliza la regla de escala del ADR 0064 (`escala_firma.R`). Contrato operativo:
  `docs/qa/contrato-consolidado-laminas-f6-2026-10-11.md`.

## Contexto

El informe compartido (`graficos_consolidado_draft/v1`, ADR 0040 §6.1) se siembra con el plan que el preflight deriva
cuando el borrador no tiene láminas. Esa derivación llama a `.graficos_suggested_plan`, que en estudios multiactor
empareja variables de bases distintas por **etiqueta normalizada + firma de escala**
(`.graficos_multisource_comparison_candidates`, `graficos_plan_coverage.R`): toma la primera variable de cada fuente y
arma hasta cuatro láminas «Comparativo por actor». Es exactamente lo que el ADR 0062 invalida: el emparejamiento por
parecido de etiqueta produce comparaciones plausibles y falsas.

La matriz de equivalencias (`s$equivalencias_publicos`, ADR 0062) ya alimenta `/plan/sugerido` con
`fuente:"equivalencias"` (ADR 0063), pero sólo en el alcance de la base activa. Además se midieron cinco incoherencias
(estudio de la decisión 17, 2026-10-11):

1. El generador recorre todas las bases, también las que no tienen release aprobada, y el preflight rechaza esas
   referencias.
2. La matriz compara escalas con `.escala_firma` (normaliza caja y espacios); el bloqueo del consolidado compara
   `codigo=etiqueta` literal (`.graficos_consolidado_scale_spec`) y bloquea lo que la matriz aprueba (en ACRD Conta, 56
   de 58 temas difieren sólo en la caja).
3. La revisión de la declaración (`.equiv_declaracion_revision`) no incluye `sugerida` ni `estilo` y no ve cambios en
   las listas de opciones.
4. Ni la siembra ni «Armar desde…» graban `equivalencias_revision` en el informe compartido: el aviso de desfase queda
   mudo.
5. El aviso de desfase sólo vive en el editor anterior, no en Láminas.

Mientras tanto, «Armar desde…» quedó deshabilitado con motivo en el informe compartido (decisión 17).

## Decisión

1. **El informe compartido propone desde la matriz.** `POST /api/graficos/plan/sugerido` acepta `scope:"consolidado"`
   en la raíz del cuerpo, igual que `/plan/coverage`. En ese alcance el bloque comparativo sale de
   `.graficos_plan_desde_equivalencias` (el mismo generador; ADR 0063: «un segundo generador queda invalidado»); la
   configuración es la del cuerpo, en forma portable, y **nunca** se mezcla con la de la base activa (ADR 0040 §6.1).
   Con `config.fuente = "equivalencias"` devuelve sólo el bloque de la matriz; sin fuente, la propuesta compuesta (3).
2. **Sólo participan las bases con release aprobada y vigente** (`.processing_release_catalog`, `approved == TRUE`).
   Una fila de la matriz pierde las bases sin release; si le quedan menos de dos públicos sale a `fuera` con motivo
   `release_no_aprobada` (nunca se degrada en silencio a una lámina de un público); si le quedan dos o más pero menos de
   los declarados entra y se reporta en `cobertura_reducida`. Las bases fuera se reportan en `bases_excluidas`. Aprobar
   releases sigue siendo gate de generación, no de autoría.
3. **La siembra es la propuesta compuesta y es la misma que deriva el preflight.** Con el borrador vacío, el preflight
   (y con él la siembra de Láminas y el job `/consolidado/ppt`) deriva su plan de la misma función que `/plan/sugerido`
   con `scope:"consolidado"`: el bloque de la matriz (`origen = "equivalencias"`) en lugar de la antigua sección
   comparativa, más las láminas por fuente del generador genérico sin las referencias ya consumidas. El preflight
   devuelve además un bloque aditivo `equivalencias` con la revisión vigente y los avisos.
4. **Firma de escala única.** El bloqueo de escalas del consolidado calcula la firma con `.escala_firma` sobre los
   niveles de la variable resuelta (recodificada incluida) y recorre los `bloques` de `multilista` con grano de bloque.
   Enmienda el ADR 0040 §6: «firma `codigo=etiqueta`» se lee «firma de `.escala_firma`». El código sigue comparándose
   literal; el motor no cambia. El generador consolidado excluye a `fuera` (`escala_incompatible`) toda lámina que el
   bloqueo rechazaría: **lo que se propone no se bloquea por escala**.
5. **La revisión de la declaración describe todo lo que cambia el mazo**: entran `sugerida`, `estilo` y una huella de
   listas (la `.equiv_firma_escala` de cada variable declarada en su base). Los tres productores (Carga,
   `/plan/sugerido`, preflight) pasan los instrumentos. El valor lleva prefijo `r2:`; una revisión guardada sin prefijo
   se informa como «revisión anterior», no como desfase. Cambiar sólo la caja de una opción no mueve la huella.
6. **Aplicar graba la revisión, en los dos alcances.** Siembra, «Reemplazar», «Fusionar» y «Sincronizar» guardan
   `equivalencias_revision` cada vez que lo aplicado trae láminas de la matriz (`revisionAlAplicar`, disparado por
   `contiene_equivalencias`). En el compartido, «Sincronizar» reemplaza sólo las láminas `origen = "equivalencias"`.
7. **La heurística por etiqueta se retira de todo generador de plan** (`.graficos_multisource_comparison_candidates`,
   `.graficos_multisource_comparison_slides` y su uso en `.graficos_suggested_plan`). Sin matriz declarada, o con la
   pestaña no disponible, el compartido se siembra **sin láminas comparativas** y lo dice (`sin_matriz` /
   `matriz_no_disponible`). La retirada vale también para el plan por base, donde la heurística corría en perfiles de
   acreditación e `independent_siblings`: el ADR 0062 la invalida en toda superficie que produzca un entregable. No
   queda como respaldo; reabrirla exige enmendar este ADR. *(El alcance al plan por base queda sujeto a confirmación
   de Gonzalo; si se acota al consolidado se retira esta frase y el test R12 del contrato.)*
8. **El desfase se ve en Láminas.** El estado de la declaración aplicada (al día, desfasada, retirada, revisión
   anterior, sin mazo derivado) se calcula en un solo lugar del frontend y lo consumen el editor anterior y «Avisos del
   informe» de Láminas, junto con los avisos de la siembra.
9. **«Armar desde…» se habilita en el informe compartido** al integrarse esto, y se retira el motivo provisional de la
   decisión 17.

## Consecuencias

- **Persistencia**: sin cambio de `format_version` ni claves nuevas; sólo cambia el valor derivado de la revisión
  (prefijo `r2:`). Los proyectos se abren sin migración.
- **Borradores ya sembrados con la heurística** no se tocan (ADR 0063, decisión 1). Las notas de versión piden revisar
  las láminas «Comparativo por actor: …» de informes compartidos guardados antes de esta versión.
- **Planes por base multiactor** dejan de traer comparativos por etiqueta en «Armar desde…»; se proponen desde la
  matriz. Va en las notas de versión.
- **Gate más permisivo sólo donde la escala es la misma**: diferencias de caja o espacios dejan de bloquear; de código,
  siguen bloqueando.
- Errores nuevos: `E_GRAFICOS_PLAN_SCOPE` (400) y `E_GRAFICOS_CONSOLIDADO_NO_APLICA` (409).
- Sin secretos, rutas ni red nuevas; `/plan/sugerido` no persiste ni marca `project_dirty`.

## Abiertas

- Reordenar filas dentro de una diapositiva cambia el mazo pero no la revisión.
- Las fuentes del consolidado no aplican las etiquetas curadas de `analitica_config_por_base` (ADR 0062, regla 5).
- La revisión no se ata a la release; lo mitiga el gate `processing_release_not_approved` del preflight.

## Cumplimiento

- `scope:"consolidado"` no lee ni escribe la config de la base activa, no cambia `active_base`, no marca el proyecto
  sucio y no avanza la revisión del borrador.
- Una base sin release aprobada no aparece en las referencias propuestas y se lista en `bases_excluidas`.
- Sin matriz, ninguna lámina propuesta o sembrada compara variables de dos bases, aunque haya etiquetas idénticas.
- La siembra del preflight y `/plan/sugerido` consolidado devuelven el mismo plan para el mismo estado.
- Escalas que difieren sólo en caja no bloquean; con códigos distintos sí, también dentro de un bloque `multilista`.
- Ninguna lámina propuesta recibe un bloqueo de escala en el preflight.
- La revisión cambia con `sugerida`, `estilo` o la lista de opciones; no con la caja ni con la fecha de importación;
  los cuatro productores devuelven el mismo valor.
- `equivalencias_revision` sobrevive al ciclo borrador → `.pulso` → reapertura.
- Verificación en vivo sobre un proyecto temporal `independent_siblings` rehecho desde los `.sav` de acrconta_mazo, sin
  commitear (decisión 19).

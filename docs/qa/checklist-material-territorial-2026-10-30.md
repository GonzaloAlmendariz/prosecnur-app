# Checklist: UI de Material de campo territorial

Fecha: 2026-10-30. Loop de Hojas de ruta, reorientado por Gonzalo: «la UI de hojas de ruta y la UI de material de
campo para ruta aún le falta muchísimo trabajo». Vara: que un analista lo use para preparar el campo territorial y
que sea intuitivo, dinámico y presentable.

Proyecto: acnur_acg (`outputs/reference-runs/acnur_acg-20261028-131642/acnur_acg.pulso`). La muestra se volvió a
sortear con el método vigente y se envió **sólo en la sesión**: no se guardó el `.pulso`.

| # | Hallazgo | Dónde vive | Gravedad | Estado |
|---|---|---|---|---|
| M1 | Enviar la muestra no creaba la campaña territorial: «Abrir en Material de campo» caía en «Todavía no hay campañas», con un aviso que decía «La campaña territorial nace al enviar la muestra» justo después de enviarla | `hojasRuta/mapa/seleccion/SalidasPanel.tsx`, `campanaTerritorial.ts` (nuevo), `recopiladores/campanas/MaterialCampoShell.tsx` | **bloquea** | ☑ (este commit) al enviar o reenviar, si el proyecto no tiene su campaña territorial se crea («Campaña territorial»); si alguien llega con la muestra enviada y sin campaña, el aviso dice «falta crear su campaña territorial» con «Crear la campaña». Verificado en vivo |
| M2 | El envío tarda más de 20 s y sólo dice «Enviando…», sin progreso ni qué está pasando | `SalidasPanel.tsx` / `POST /api/hojas-ruta/envio` | confunde | ☐ medir dónde se va el tiempo |
| M3 | Unidades apila los 6 distritos en tarjetas de ~2.800 px cada una (25 titulares + 25 reemplazos), en una grilla de 3 × 2: San Juan de Lurigancho empieza a 3.013 px; no hay vista general ni forma de ir a un distrito | `recopiladores/territorial/` (Unidades) | **confunde** | ☑ (este commit) franja de distritos arriba (titulares, reemplazos y rutas por revisar; «Todos» y la búsqueda muestran todos) que elige el distrito a la vista; el de la UMP enfocada se elige solo. El panel pasa de 5.651 a ~1.750 px y cualquier distrito queda a un clic |
| M4 | Las rutas con problemas no se distinguen: UMP 13 «5 viv.» para 8 encuestas, UMP 16 «1,716 viv.» (condominio), titulares sin viviendas; la revisión contra el marco de Selección no llega a Material | Unidades; revisión en `hojasRuta/seleccion/revisionMarco.ts` | confunde | ☑ (este commit) `revisionUnidades.ts` lleva las unidades a `revisarSeleccion`/`estadosPorTitular` de Hojas de ruta (mismo criterio, con la respuesta y la ocupación del estudio): «sin viviendas», «no alcanza», «sin margen», «muy grande», «sin reemplazo» en cada UMP; la cabecera dice «16 rutas por revisar» |
| M5 | Cada UMP es una línea corrida «Zona 00300 · Mz 0140 · encuestas 1–8 · 164 viv.» que se parte en dos; sin columnas, comparar viviendas o rangos entre rutas es leer párrafos | Unidades | confunde | ☑ (este commit) tabla del kit (`PulsoTable`, el contrato L28 prohíbe tablas a mano) con UMP · Zona · Manzana · Encuestas · Viviendas · Estado · Hoja; el reemplazo va debajo de su titular, con sangría; la fila elegida va en `?foco=` |
| M6 | Material no tiene mapa: el analista no ve dónde están las rutas que va a imprimir (Hojas de ruta sí) | Unidades | mejora | ☐ evaluar después de M3–M5: enlace a la UMP en el lienzo de Hojas (`/hojas-ruta?seccion=seleccion&foco=<id>`) o un mapa propio |

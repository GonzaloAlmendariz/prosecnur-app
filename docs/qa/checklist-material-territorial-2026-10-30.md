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

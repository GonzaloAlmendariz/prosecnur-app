# Prosecnur 0.6.2 · monitoreo telefónico medido contra campo

- Monitoreo telefónico: una hoja de barrido que trae varios actores en una sola columna vuelve a repartir el universo entre ellos. Antes no atribuía las filas a ninguno y los dos actores quedaban en universo 0.
- Monitoreo telefónico: el botón Avance vuelve a leer las hojas de Google. Se caían del refresco, así que el barrido quedaba sin actualizar y el estudio entero se mostraba sin base, con universo 0 y brechas «S/M», igual que uno recién conectado.
- Monitoreo telefónico: las metas de cuota se escriben completas y se confirman al final. Cada tecla guardaba y recalculaba, de modo que teclear «80» dejaba sedimentado el «8» del camino y borrar el campo lo devolvía a 0. Ahora los cambios se acumulan en un borrador, una franja dice cuántos esperan confirmación, y el recálculo ocurre una sola vez. Descartar vuelve a lo guardado.
- Monitoreo telefónico: el equipo se cuenta por personas y no por asignaciones, tanto en los estados por encuestador como en las tarjetas de producción. Quien cubría dos componentes aparecía dos veces, así que un equipo de cuatro se reportaba como ocho y una carga pareja de 46, 46, 45 y 46 se leía como 40 y 6. Los porcentajes se recalculan sobre los totales de cada persona, no se promedian entre sus filas.
- Fuentes: el catálogo de formularios de Kobo consulta el servidor de la cuenta conectada. Con una cuenta en servidor propio el token viajaba al servidor público y volvía un error de credenciales, cuando lo que estaba mal era la dirección.

Los instalables no están firmados: Windows mostrará el aviso de SmartScreen y
macOS pedirá abrir desde el menú contextual la primera vez. En macOS la
actualización es manual, descargando el DMG; en Windows el actualizador
automático sigue funcionando.

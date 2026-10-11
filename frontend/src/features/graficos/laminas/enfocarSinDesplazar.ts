// Enfocar sin mover el desplazamiento: dentro de la pestaña Láminas, `focus()` a secas corre el contenedor que tiene el
// scroll (`.pulso-f6-laminas`, 250 px a 1024×600; verificador frontend-3) para traer el elemento a la vista.

type Enfocable = { focus: (opciones?: FocusOptions) => void };

export function enfocarSinDesplazar(el: Enfocable | null | undefined): boolean {
  if (!el) return false;
  el.focus({ preventScroll: true });
  return true;
}

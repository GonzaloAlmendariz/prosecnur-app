// Los formularios del editor del proyecto, para "Usar el formulario del editor"
// en Carga. Si la lista no se puede leer, la opción no aparece y la subida del
// archivo sigue igual: no es un error que deba ver quien carga.
import { useEffect, useState } from "react";
import { apiXlsformFormsList } from "../../../../api/xlsformEditor";
import { formulariosDelEditor, type FormularioDelEditor } from "./formularioDelEditorModelo";

export function useFormulariosDelEditor(): FormularioDelEditor[] {
  const [formularios, setFormularios] = useState<FormularioDelEditor[]>([]);
  useEffect(() => {
    let vivo = true;
    apiXlsformFormsList()
      .then((r) => { if (vivo) setFormularios(formulariosDelEditor(r.forms)); })
      .catch(() => { if (vivo) setFormularios([]); });
    return () => { vivo = false; };
  }, []);
  return formularios;
}

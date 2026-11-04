import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Dialog } from "../../components/Dialog";
import { MANIFIESTO_NAVEGACION } from "../../lib/navegacion/manifiesto";
import { buscarEnPaleta } from "../../lib/navegacion/paleta";
import { panelAbiertoEn, searchConPanel } from "../../lib/navegacion/paneles";
import { conModificador, nombreDeAtajo } from "../../lib/teclado";
import { CornerDownLeft, Search } from "../../vendor/lucide-react";
import { PANEL_ATAJOS_APP, PANEL_PALETA } from "./panelesHome";
import { AtajosDeLaApp } from "./AtajosDeLaApp";
import { destinoDeAtajo, estaEscribiendo } from "./atajosDeModulos";
import { useProjectModules } from "../project/ProjectModulesContext";
import "./paleta-de-comandos.css";

// Paleta de comandos (L30): ⌘K en macOS, Ctrl+K en Windows. Vive en el Layout,
// como el selector de módulos, y se abre sobre la ruta actual. Elegir una vista
// navega a su dirección canónica; la lista sale del manifiesto de navegación,
// así que una vista nueva aparece aquí sin registrarla en otro lado.

const LIMITE = 12;

export function PaletaDeComandosHost() {
  const location = useLocation();
  const navigate = useNavigate();
  const abierta = panelAbiertoEn(location.search, PANEL_PALETA);
  const { addedSlugs } = useProjectModules();

  useEffect(() => {
    function alTeclear(evento: globalThis.KeyboardEvent) {
      // «?» (Mayús + /) fuera de un campo: la ayuda de atajos de la app. Gráficos tiene la suya y la atiende primero.
      if (evento.key === "?" && !evento.metaKey && !evento.ctrlKey && !evento.altKey) {
        if (estaEscribiendo(evento.target) || evento.defaultPrevented) return;
        queueMicrotask(() => {
          if (evento.defaultPrevented || panelAbiertoEn(window.location.search, PANEL_ATAJOS_APP)) return;
          navigate({ pathname: location.pathname, search: searchConPanel(location.search, PANEL_ATAJOS_APP) }, { replace: true });
        });
        return;
      }
      if (!conModificador(evento) || evento.altKey || evento.shiftKey || evento.defaultPrevented) return;
      // ⌘1…8: el módulo N del dock. Escribiendo en un campo no, y una vista que ya usa ⌘N (la Estructura de
      // Gráficos con ⌘1) lo atiende primero.
      const modulo = destinoDeAtajo(evento.key, addedSlugs);
      if (modulo) {
        if (estaEscribiendo(evento.target)) return;
        // Se decide al terminar la ronda de listeners: si una vista también escucha ⌘N en window (Gráficos con
        // ⌘1), gana ella sin importar quién se registró antes.
        queueMicrotask(() => {
          if (!evento.defaultPrevented) navigate(modulo.to);
        });
        return;
      }
      if (evento.key.toLowerCase() !== "k") return;
      // Un editor que ya usa ⌘K (el enlace en el editor de correos) lo atiende primero: no se le pisa.
      if (evento.defaultPrevented) return;
      evento.preventDefault();
      if (panelAbiertoEn(window.location.search, PANEL_PALETA)) return;
      navigate({ pathname: location.pathname, search: searchConPanel(location.search, PANEL_PALETA) }, { replace: true });
    }
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [addedSlugs, location.pathname, location.search, navigate]);

  const atajosAbiertos = panelAbiertoEn(location.search, PANEL_ATAJOS_APP);
  return (
    <>
      {abierta ? <PaletaDeComandos /> : null}
      {atajosAbiertos ? <AtajosDeLaApp /> : null}
    </>
  );
}

function PaletaDeComandos() {
  const navigate = useNavigate();
  const [consulta, setConsulta] = useState("");
  const [activo, setActivo] = useState(0);
  const resultados = useMemo(() => buscarEnPaleta(MANIFIESTO_NAVEGACION, consulta, LIMITE), [consulta]);
  const indice = Math.min(activo, Math.max(0, resultados.length - 1));

  function ir(href: string) {
    // La dirección de destino no lleva `?panel=paleta`: navegar ya la cierra.
    navigate(href);
  }

  function alTeclearEnBusqueda(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      setActivo((i) => Math.min(i + 1, resultados.length - 1));
    } else if (evento.key === "ArrowUp") {
      evento.preventDefault();
      setActivo((i) => Math.max(i - 1, 0));
    } else if (evento.key === "Enter" && resultados[indice]) {
      evento.preventDefault();
      ir(resultados[indice].href);
    }
  }

  return (
    <Dialog
      panel={PANEL_PALETA}
      size="md"
      title="Ir a una vista"
      icon={<Search size={16} aria-hidden="true" />}
      footerHint={<span>↑↓ elige, <CornerDownLeft size={11} aria-hidden="true" /> abre, Esc cierra y {nombreDeAtajo("K")} la abre desde cualquier pantalla</span>}
      className="pulso-paleta"
    >
      <input
        className="pulso-paleta-busqueda"
        type="search"
        autoFocus
        placeholder="Módulo, sección o pestaña"
        aria-label="Buscar una vista"
        aria-controls="pulso-paleta-lista"
        aria-activedescendant={resultados[indice] ? `pulso-paleta-${indice}` : undefined}
        value={consulta}
        onChange={(evento) => {
          setConsulta(evento.target.value);
          setActivo(0);
        }}
        onKeyDown={alTeclearEnBusqueda}
      />
      {resultados.length === 0 ? (
        <p className="pulso-paleta-vacio">Ninguna vista con «{consulta}».</p>
      ) : (
        <ul className="pulso-paleta-lista" id="pulso-paleta-lista" role="listbox" aria-label="Vistas">
          {resultados.map((resultado, i) => (
            <li
              key={resultado.clave}
              id={`pulso-paleta-${i}`}
              role="option"
              aria-selected={i === indice}
              className="pulso-paleta-item"
              onMouseEnter={() => setActivo(i)}
              onClick={() => ir(resultado.href)}
            >
              <span className="pulso-paleta-item-nombre">{resultado.label}</span>
              {resultado.ruta && <span className="pulso-paleta-item-ruta">{resultado.ruta}</span>}
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}

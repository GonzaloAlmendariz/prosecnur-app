import { useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import * as Popover from "@radix-ui/react-popover";
import {
  Check,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
} from "../vendor/lucide-react";
import {
  moduleChromeVars,
  type ActiveProsecnurModuleMeta,
  type ProsecnurNavigationLeafMeta,
} from "../lib/modules";
import { BrandMark } from "./BrandMark";
import "./sidebar-v3.css";

type ModuleHrefResolver = (href: string) => string;

export type ModuleSwitcherGridProps = {
  modules: readonly ActiveProsecnurModuleMeta[];
  activeModule?: ActiveProsecnurModuleMeta;
  addedSlugs: readonly string[];
  getHref: ModuleHrefResolver;
  onNavigate?: () => void;
};

export function ModuleSwitcherGrid({
  modules,
  activeModule,
  addedSlugs,
  getHref,
  onNavigate,
}: ModuleSwitcherGridProps) {
  return (
    <nav
      className="pulso-sidebar-module-grid-wrap"
      aria-label="Módulos de Prosecnur"
    >
      <ul className="pulso-sidebar-module-grid">
        {modules.map((module) => {
          const Icon = module.icon;
          const isCurrent = module.slug === activeModule?.slug;
          const isAdded = addedSlugs.includes(module.slug);
          return (
            <li key={module.slug}>
              <Link
                to={getHref(module.to)}
                aria-current={isCurrent ? "page" : undefined}
                className={[
                  "pulso-sidebar-module-option",
                  isCurrent ? "is-current" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={moduleChromeVars(module)}
                onClick={onNavigate}
              >
                <span
                  className="pulso-sidebar-module-option-icon"
                  aria-hidden="true"
                >
                  <Icon size={18} strokeWidth={1.8} />
                </span>
                <span className="pulso-sidebar-module-option-copy">
                  <strong>{module.shortLabel}</strong>
                  <small>{isAdded ? "En el proyecto" : "Disponible"}</small>
                </span>
                {isAdded ? (
                  <Check
                    className="pulso-sidebar-module-option-check"
                    size={13}
                    aria-hidden="true"
                  />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export type AppSidebarProps = {
  modules: readonly ActiveProsecnurModuleMeta[];
  activeModule?: ActiveProsecnurModuleMeta;
  addedSlugs: readonly string[];
  globalItems: readonly ProsecnurNavigationLeafMeta[];
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onManageModules: (returnFocusTo?: HTMLElement | null) => void;
  getHref: ModuleHrefResolver;
};

export function AppSidebar({
  modules,
  activeModule,
  addedSlugs,
  globalItems,
  collapsed,
  onCollapsedChange,
  onManageModules,
  getHref,
}: AppSidebarProps) {
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const contextTriggerRef = useRef<HTMLButtonElement>(null);
  const activeTitle = activeModule?.shortLabel ?? "Prosecnur";

  function openManager() {
    setSwitcherOpen(false);
    onManageModules(contextTriggerRef.current);
  }

  return (
    <aside
      className={[
        "pulso-sidebar-v3",
        collapsed
          ? "pulso-sidebar-v3--collapsed"
          : "pulso-sidebar-v3--expanded",
      ].join(" ")}
      data-sidebar-state={collapsed ? "collapsed" : "expanded"}
      data-audit-ready="sidebar-v3-foundation"
      aria-label="Navegación principal"
    >
      <div className="pulso-sidebar-v3-header">
        <Popover.Root open={switcherOpen} onOpenChange={setSwitcherOpen}>
          <Popover.Trigger asChild>
            <button
              ref={contextTriggerRef}
              type="button"
              className="pulso-sidebar-context-trigger"
              aria-label={`Módulo actual: ${activeTitle}. Cambiar módulo`}
              title={collapsed ? `Módulo actual: ${activeTitle}` : undefined}
            >
              <BrandMark className="pulso-sidebar-brand-mark" />
              <span className="pulso-sidebar-context-copy">
                <strong>{activeTitle}</strong>
                <small>
                  {activeModule ? "Módulo activo" : "Mission control"}
                </small>
              </span>
              <ChevronDown
                className="pulso-sidebar-context-chevron"
                size={15}
                strokeWidth={2}
                aria-hidden="true"
              />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              className="pulso-sidebar-switcher-popover"
              side="right"
              align="start"
              sideOffset={8}
              collisionPadding={10}
              aria-label="Cambiar módulo"
              onCloseAutoFocus={(event) => {
                if (!contextTriggerRef.current?.isConnected) return;
                event.preventDefault();
                contextTriggerRef.current.focus();
              }}
            >
              <div className="pulso-sidebar-switcher-head">
                <div>
                  <strong>Cambiar módulo</strong>
                  <span>Ocho herramientas, ocho acentos</span>
                </div>
                <NavLink
                  to={getHref("/")}
                  className="pulso-sidebar-home-link"
                  onClick={() => setSwitcherOpen(false)}
                >
                  Inicio
                </NavLink>
              </div>
              <ModuleSwitcherGrid
                modules={modules}
                activeModule={activeModule}
                addedSlugs={addedSlugs}
                getHref={getHref}
                onNavigate={() => setSwitcherOpen(false)}
              />
              <button
                type="button"
                className="pulso-sidebar-manage-from-popover"
                onClick={openManager}
              >
                <Plus size={15} aria-hidden="true" />
                Agregar módulo
              </button>
              <Popover.Arrow className="pulso-sidebar-switcher-arrow" />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>

      <nav
        className="pulso-sidebar-v3-navigation"
        aria-label={
          activeModule
            ? `Navegación de ${activeModule.shortLabel}`
            : "Navegación del proyecto"
        }
      >
        <span className="pulso-sr-only">
          Las secciones se incorporan por módulo en las siguientes iteraciones.
        </span>
      </nav>

      <div className="pulso-sidebar-v3-footer">
        <button
          type="button"
          className="pulso-sidebar-utility"
          onClick={(event) => onManageModules(event.currentTarget)}
          title={collapsed ? "Módulos del proyecto" : undefined}
        >
          <Plus size={17} strokeWidth={1.8} aria-hidden="true" />
          <span className="pulso-sidebar-utility-copy">
            Módulos del proyecto
          </span>
        </button>
        {globalItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.id}
              to={getHref(item.to)}
              className="pulso-sidebar-utility"
              title={collapsed ? item.shortLabel ?? item.label : undefined}
            >
              <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
              <span className="pulso-sidebar-utility-copy">
                {item.shortLabel ?? item.label}
              </span>
            </NavLink>
          );
        })}
        <button
          type="button"
          className="pulso-sidebar-utility"
          onClick={() => onCollapsedChange(!collapsed)}
          aria-label={collapsed ? "Expandir sidebar" : "Contraer sidebar"}
          title={collapsed ? "Expandir sidebar" : undefined}
        >
          {collapsed ? (
            <PanelLeftOpen size={17} strokeWidth={1.8} aria-hidden="true" />
          ) : (
            <PanelLeftClose size={17} strokeWidth={1.8} aria-hidden="true" />
          )}
          <span className="pulso-sidebar-utility-copy">
            {collapsed ? "Expandir sidebar" : "Contraer sidebar"}
          </span>
        </button>
      </div>
    </aside>
  );
}

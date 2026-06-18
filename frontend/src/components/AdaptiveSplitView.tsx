import {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";

type AdaptiveSplitViewProps = {
  rail: ReactNode;
  children: ReactNode;
  ariaLabel: string;
  variant?: "workbench" | "three-pane";
  railLabel?: string;
  className?: string;
};

type ClassableElement = ReactElement<{
  className?: string;
  "aria-label"?: string;
}>;

function mergeClassName(...classes: Array<string | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function withAdaptiveClass(
  node: ReactNode,
  adaptiveClass: string,
  fallbackTag: "aside" | "div",
  ariaLabel?: string,
): ReactNode {
  if (isValidElement(node)) {
    const element = node as ClassableElement;
    if (typeof element.type === "string") {
      const nextProps: { className: string; "aria-label"?: string } = {
        className: mergeClassName(adaptiveClass, element.props.className),
      };
      if (ariaLabel && !element.props["aria-label"]) nextProps["aria-label"] = ariaLabel;
      return cloneElement(element, nextProps);
    }
  }

  const Tag = fallbackTag;
  return (
    <Tag className={adaptiveClass} aria-label={ariaLabel}>
      {node}
    </Tag>
  );
}

function withAdaptiveMain(children: ReactNode): ReactNode {
  if (Children.count(children) === 1) {
    return withAdaptiveClass(Children.only(children), "pulso-adaptive-main", "div");
  }
  return <div className="pulso-adaptive-main">{children}</div>;
}

export function AdaptiveSplitView({
  rail,
  children,
  ariaLabel,
  variant = "workbench",
  railLabel,
  className,
}: AdaptiveSplitViewProps) {
  const classes = mergeClassName(
    "pulso-adaptive-split",
    `pulso-adaptive-split--${variant}`,
    className,
  );

  return (
    <section className={classes} aria-label={ariaLabel}>
      {withAdaptiveClass(rail, "pulso-adaptive-rail", "div", railLabel)}
      {withAdaptiveMain(children)}
    </section>
  );
}

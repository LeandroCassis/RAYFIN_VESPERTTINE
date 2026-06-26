//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { ReactNode } from "react";

import type { DrilldownApi } from "@/hooks/use-drilldown";
import { cn } from "@/lib/utils";

import { ChevronRightIcon } from "./icons";

export interface DrilldownBreadcrumbProps {
    /** The drilldown returned by `useDrilldown`. */
    drilldown: DrilldownApi;
    /** Root crumb label shown before any drill (default `"All"`). */
    rootLabel?: ReactNode;
    /** Optional formatter for each drilled value crumb. */
    formatValue?: (value: string | number, level: number) => ReactNode;
    className?: string;
}

/**
 * Breadcrumb trail for a chart drilldown. The root and every completed level
 * are clickable (jumping back up via `drillTo`); the deepest crumb is the
 * current position. Renders nothing extra when no drill is active beyond the
 * root, so it's safe to always mount above a drillable chart.
 *
 * @example
 * ```tsx
 * const drill = useDrilldown("geo", [
 *   { field: "Geography[Country]" },
 *   { field: "Geography[City]" },
 * ]);
 *
 * <DrilldownBreadcrumb drilldown={drill} rootLabel="All regions" />
 * <BarChartCard xKey={drill.xKey} onSelect={drill.drillInto} data={rows} series={series} />
 * ```
 */
export function DrilldownBreadcrumb({
    drilldown,
    rootLabel = "All",
    formatValue,
    className,
}: DrilldownBreadcrumbProps) {
    const { path, drillTo } = drilldown;

    return (
        <nav
            aria-label="Drilldown breadcrumb"
            className={cn(
                "flex flex-wrap items-center gap-1 text-sm text-muted-foreground",
                className,
            )}
        >
            <Crumb
                active={path.length === 0}
                onClick={path.length === 0 ? undefined : () => drillTo(0)}
            >
                {rootLabel}
            </Crumb>
            {path.map((value, index) => {
                const isLast = index === path.length - 1;
                return (
                    <span key={index} className="flex items-center gap-1">
                        <ChevronRightIcon
                            size={14}
                            className="text-foreground-muted"
                        />
                        <Crumb
                            active={isLast}
                            onClick={isLast ? undefined : () => drillTo(index + 1)}
                        >
                            {formatValue ? formatValue(value, index) : String(value)}
                        </Crumb>
                    </span>
                );
            })}
        </nav>
    );
}

function Crumb({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick?: () => void;
    children: ReactNode;
}) {
    if (active || !onClick) {
        return (
            <span
                aria-current={active ? "page" : undefined}
                className="rounded-md px-1.5 py-0.5 font-medium text-foreground"
            >
                {children}
            </span>
        );
    }
    return (
        <button
            type="button"
            onClick={onClick}
            className="rounded-md px-1.5 py-0.5 font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
            {children}
        </button>
    );
}

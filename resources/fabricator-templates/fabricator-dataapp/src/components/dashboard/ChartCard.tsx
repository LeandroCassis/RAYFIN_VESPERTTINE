//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { CSSProperties, ReactNode } from "react";

import type { ChartSpec } from "envy";

import { cn } from "@/lib/utils";

import { Chart } from "./Chart";
import {
    DEFAULT_ASPECT,
    MAX_CHART_HEIGHT,
    MIN_CHART_HEIGHT,
    TileBody,
} from "./states";

/** Props shared by every card shell (title, header slot, query state). */
export interface ChartCardCommonProps {
    /** Card title (rendered in the display font). */
    title?: ReactNode;
    /** Optional one-line subtitle under the title. */
    subtitle?: ReactNode;
    /** Right-aligned header slot — filters, a legend, a menu, etc. */
    action?: ReactNode;
    className?: string;
    /** Render the loading skeleton. */
    loading?: boolean;
    /** Render the error tile when set (non-null). */
    error?: unknown;
    /** Message for the empty (no-rows) state. */
    emptyMessage?: ReactNode;
    /** Retry handler shown on the error tile. */
    onRetry?: () => void;
}

export interface ChartCardProps extends ChartCardCommonProps {
    /**
     * The Envy chart spec to render — the common case. Author one JSON object
     * (see the `visuals` skill / Envy spec reference) and pass it here; the card
     * owns the loading / empty / error states and bridges the app theme.
     */
    spec?: ChartSpec;
    /** Fixed body height in px. Omit for responsive aspect-based height. */
    height?: number;
    /** Force the empty state (defaults to detecting an empty `spec.data`). */
    isEmpty?: boolean;
    /** Optional footer (separated by a hairline rule). */
    footer?: ReactNode;
    /** Extra classes for the body wrapper. */
    bodyClassName?: string;
    /** Arbitrary content (e.g. a `DataGrid`) when not using `spec`. */
    children?: ReactNode;
}

const RESPONSIVE_BODY_STYLE: CSSProperties = {
    aspectRatio: String(DEFAULT_ASPECT),
    minHeight: MIN_CHART_HEIGHT,
    maxHeight: MAX_CHART_HEIGHT,
};

/** True when a spec carries an explicitly empty `data` array. */
function specIsEmpty(spec: ChartSpec): boolean {
    const data = (spec as { data?: unknown }).data;
    return Array.isArray(data) && data.length === 0;
}

/**
 * Titled card shell around a chart or content. Provides the kit's signature
 * look — rounded-2xl, hairline border, no shadow, generous padding.
 *
 * Two modes:
 *  - **Spec mode** (the common case): pass `spec` (+ `loading` / `error` /
 *    `data`-driven empty). The card renders an Envy `<Chart>` and the matching
 *    state tile for you.
 *  - **Children mode**: pass arbitrary `children` (e.g. a Fabric `DataGrid`)
 *    and own the body yourself.
 *
 * @example
 * ```tsx
 * <ChartCard
 *   title="Revenue"
 *   subtitle="Last 12 months"
 *   loading={isLoading}
 *   error={error}
 *   spec={{
 *     type: "line",
 *     data: toChartData(data),
 *     encoding: { x: { field: "month", type: "temporal" }, y: { field: "revenue" } },
 *   }}
 * />
 * ```
 */
export function ChartCard({
    title,
    subtitle,
    action,
    footer,
    className,
    bodyClassName,
    spec,
    height,
    loading,
    error,
    isEmpty,
    emptyMessage,
    onRetry,
    children,
}: ChartCardProps) {
    const hasHeader = title != null || subtitle != null || action != null;
    const empty = isEmpty ?? (spec != null && specIsEmpty(spec));
    const bodyStyle = height != null ? { height } : RESPONSIVE_BODY_STYLE;

    return (
        <section
            className={cn(
                "flex min-w-0 flex-col gap-4 rounded-2xl border border-border bg-card p-5",
                className,
            )}
        >
            {hasHeader && (
                <header className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        {title != null && (
                            <h3 className="truncate font-display text-[15px] font-semibold tracking-tight text-foreground">
                                {title}
                            </h3>
                        )}
                        {subtitle != null && (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {subtitle}
                            </p>
                        )}
                    </div>
                    {action != null && <div className="shrink-0">{action}</div>}
                </header>
            )}
            <div className={cn("min-w-0", bodyClassName)}>
                {spec != null ? (
                    <TileBody
                        loading={loading}
                        error={error}
                        isEmpty={empty}
                        height={height}
                        emptyMessage={emptyMessage}
                        onRetry={onRetry}
                    >
                        <div style={bodyStyle}>
                            <Chart spec={spec} />
                        </div>
                    </TileBody>
                ) : (
                    children
                )}
            </div>
            {footer != null && (
                <footer className="border-t border-border pt-3 text-xs text-muted-foreground">
                    {footer}
                </footer>
            )}
        </section>
    );
}

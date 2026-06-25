//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface PageShellProps {
    /** Dashboard title (rendered in the display font). */
    title?: ReactNode;
    /** One-line subtitle under the title. */
    subtitle?: ReactNode;
    /** Right side of the sticky header — e.g. `<ThemeToggle />`, filters. */
    actions?: ReactNode;
    children: ReactNode;
    className?: string;
    /** Max content width utility (default `"max-w-7xl"`). */
    maxWidth?: string;
}

/**
 * Full-page dashboard frame: a sticky, blurred header (title / subtitle /
 * actions) over a centered, max-width content column. Compose `Section`,
 * `KpiGrid`, and `ChartGrid` inside it.
 *
 * @example
 * ```tsx
 * <PageShell title="Sales overview" subtitle="FY24" actions={<ThemeToggle />}>
 *   <KpiGrid>{kpis}</KpiGrid>
 *   <ChartGrid>{charts}</ChartGrid>
 * </PageShell>
 * ```
 */
export function PageShell({
    title,
    subtitle,
    actions,
    children,
    className,
    maxWidth = "max-w-7xl",
}: PageShellProps) {
    return (
        <div className="min-h-screen bg-background text-foreground">
            <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
                <div
                    className={cn(
                        "mx-auto flex items-center justify-between gap-4 px-6 py-4",
                        maxWidth,
                    )}
                >
                    <div className="min-w-0">
                        {title != null && (
                            <h1 className="truncate font-display text-xl font-semibold tracking-tight text-foreground">
                                {title}
                            </h1>
                        )}
                        {subtitle != null && (
                            <p className="truncate text-sm text-muted-foreground">
                                {subtitle}
                            </p>
                        )}
                    </div>
                    {actions != null && (
                        <div className="flex shrink-0 items-center gap-2">
                            {actions}
                        </div>
                    )}
                </div>
            </header>
            <main
                className={cn(
                    "mx-auto flex flex-col gap-6 px-6 py-6",
                    maxWidth,
                    className,
                )}
            >
                {children}
            </main>
        </div>
    );
}

/** Responsive grid for a row of KPI cards (1 → 2 → 4 columns). */
export function KpiGrid({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4",
                className,
            )}
        >
            {children}
        </div>
    );
}

/** Responsive grid for chart cards (1 → 2 columns). */
export function ChartGrid({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn("grid grid-cols-1 gap-4 lg:grid-cols-2", className)}
        >
            {children}
        </div>
    );
}

export interface SectionProps {
    title?: ReactNode;
    subtitle?: ReactNode;
    /** Right-aligned slot (filters, a link). */
    action?: ReactNode;
    children: ReactNode;
    className?: string;
}

/** Titled grouping of dashboard content with an optional action slot. */
export function Section({
    title,
    subtitle,
    action,
    children,
    className,
}: SectionProps) {
    const hasHeader = title != null || subtitle != null || action != null;
    return (
        <section className={cn("flex flex-col gap-4", className)}>
            {hasHeader && (
                <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0">
                        {title != null && (
                            <h2 className="font-display text-base font-semibold tracking-tight text-foreground">
                                {title}
                            </h2>
                        )}
                        {subtitle != null && (
                            <p className="text-sm text-muted-foreground">
                                {subtitle}
                            </p>
                        )}
                    </div>
                    {action != null && <div className="shrink-0">{action}</div>}
                </div>
            )}
            {children}
        </section>
    );
}

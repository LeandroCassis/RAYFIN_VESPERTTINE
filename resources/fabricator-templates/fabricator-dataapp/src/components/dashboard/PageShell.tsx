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

/** Fluid auto-fit grid for a row of KPI cards. */
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
                "grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))]",
                className,
            )}
        >
            {children}
        </div>
    );
}

/** Fluid auto-fit grid for chart cards. */
export function ChartGrid({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                "grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(380px,100%),1fr))]",
                className,
            )}
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

/* --------------------------------- Bento -------------------------------- */

// Static class maps so Tailwind's content scanner sees every span utility.
const COL_SPAN: Record<number, string> = {
    1: "lg:col-span-1",
    2: "lg:col-span-2",
    3: "lg:col-span-3",
    4: "lg:col-span-4",
    5: "lg:col-span-5",
    6: "lg:col-span-6",
    7: "lg:col-span-7",
    8: "lg:col-span-8",
    9: "lg:col-span-9",
    10: "lg:col-span-10",
    11: "lg:col-span-11",
    12: "lg:col-span-12",
};

const ROW_SPAN: Record<number, string> = {
    1: "lg:row-span-1",
    2: "lg:row-span-2",
    3: "lg:row-span-3",
};

/**
 * Non-uniform "bento" grid for varied, editorial dashboard layouts — a wide
 * hero chart beside a stack of KPIs, a tall trend next to short tiles. A
 * 12-column grid on `lg` that collapses to one column on small screens. Place
 * {@link BentoItem}s inside and set each one's `colSpan` / `rowSpan`.
 *
 * @example
 * ```tsx
 * <BentoGrid>
 *   <BentoItem colSpan={8} rowSpan={2}>
 *     <ChartCard title="Revenue" className="h-full" spec={revenueSpec} />
 *   </BentoItem>
 *   <BentoItem colSpan={4}><KpiCard label="MRR" … /></BentoItem>
 *   <BentoItem colSpan={4}><KpiCard label="Churn" … /></BentoItem>
 * </BentoGrid>
 * ```
 */
export function BentoGrid({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12 lg:auto-rows-[minmax(0,auto)]",
                className,
            )}
        >
            {children}
        </div>
    );
}

export interface BentoItemProps {
    /** Columns to span on `lg` (1–12, default 4). Full width on small screens. */
    colSpan?: number;
    /** Rows to span on `lg` (1–3, default 1) for taller tiles. */
    rowSpan?: number;
    children: ReactNode;
    className?: string;
}

/**
 * A cell in a {@link BentoGrid}. Spans `colSpan` of 12 columns (and optional
 * `rowSpan`) on `lg`; stacks full-width on small screens. Add `className="h-full"`
 * on the card inside to fill a multi-row tile.
 */
export function BentoItem({
    colSpan = 4,
    rowSpan = 1,
    children,
    className,
}: BentoItemProps) {
    const col = COL_SPAN[Math.min(12, Math.max(1, Math.round(colSpan)))];
    const row = ROW_SPAN[Math.min(3, Math.max(1, Math.round(rowSpan)))];
    return (
        <div className={cn("flex min-w-0 flex-col", col, row, className)}>
            {children}
        </div>
    );
}

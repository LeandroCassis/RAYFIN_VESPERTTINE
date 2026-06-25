//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface ChartCardProps {
    /** Card title (rendered in the display font). */
    title?: ReactNode;
    /** Optional one-line subtitle under the title. */
    subtitle?: ReactNode;
    /** Right-aligned header slot — filters, a legend, a menu, etc. */
    action?: ReactNode;
    /** Optional footer (separated by a hairline rule). */
    footer?: ReactNode;
    className?: string;
    /** Extra classes for the body wrapper (e.g. fixed height). */
    bodyClassName?: string;
    children: ReactNode;
}

/**
 * Titled card shell that wraps any chart or content. Provides the kit's
 * signature look — rounded-2xl, hairline border, no shadow, generous
 * padding. Compose it with a chart, a `DataGrid`, or arbitrary content.
 *
 * @example
 * ```tsx
 * <ChartCard title="Revenue" subtitle="Last 12 months" action={<FilterChips … />}>
 *   <LineChart … />
 * </ChartCard>
 * ```
 */
export function ChartCard({
    title,
    subtitle,
    action,
    footer,
    className,
    bodyClassName,
    children,
}: ChartCardProps) {
    const hasHeader = title != null || subtitle != null || action != null;
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
            <div className={cn("min-w-0", bodyClassName)}>{children}</div>
            {footer != null && (
                <footer className="border-t border-border pt-3 text-xs text-muted-foreground">
                    {footer}
                </footer>
            )}
        </section>
    );
}

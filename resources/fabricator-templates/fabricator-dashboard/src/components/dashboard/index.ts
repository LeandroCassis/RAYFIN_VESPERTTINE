//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

/**
 * Dashboard kit — a deliberately small, spec-first component library.
 *
 * The whole path: get rows (inline array or a DAX result via `toChartData`),
 * author one Graphein `ChartSpec`, drop it into `<ChartCard spec={…} />`. The
 * card owns loading / empty / error and bridges the app theme. KPIs use
 * `<KpiCard>`; layout is `PageShell` + `DashboardGrid` + `Tile` + `StatStrip`.
 *
 *   import {
 *     PageShell, DashboardGrid, Tile, StatStrip, Stat,
 *     ChartCard, KpiCard, ThemeToggle,
 *     toChartData, validateSpec, type ChartSpec,
 *   } from "@/components/dashboard";
 */

/* ------------------------------- Layout -------------------------------- */
export { AppShell, PageShell, Section } from "./AppShell";
export type { AppShellProps, PageShellProps, SectionProps } from "./AppShell";
export { DashboardGrid, Tile, StatStrip, Stat } from "./grid";
export type { TileProps, TileSize, StatProps } from "./grid";
export { Card } from "./Card";
export type { CardProps, CardVariant } from "./Card";
export { ThemeToggle } from "./ThemeToggle";

/* -------------------------------- Cards -------------------------------- */
export { ChartCard } from "./ChartCard";
export type { ChartCardProps } from "./ChartCard";
export { KpiCard } from "./KpiCard";
export type { KpiCardProps } from "./KpiCard";

/* --------------------------- Graphein runtime -------------------------- */
export { Chart } from "./Chart";
export type { ChartProps } from "./Chart";
export { useChart } from "./use-chart";
export type { UseChartOptions } from "./use-chart";
export { useGrapheinTheme, readGrapheinTheme } from "@/lib/graphein-theme";
export { validateSpec } from "graphein";
export type { ChartSpec, ChartInstance } from "graphein";

/* -------------------------------- States ------------------------------- */
export { EmptyTile, ErrorTile, ChartSkeleton, KpiSkeleton, TileBody } from "./states";

/* -------------------------------- Icons -------------------------------- */
export { SunIcon, MoonIcon, ArrowUpRightIcon, ArrowDownRightIcon, AlertTriangleIcon, InboxIcon } from "./icons";
export type { IconProps } from "./icons";

/* --------------------------- Helpers + mapping ------------------------- */
export { formatNumber, formatCompact, formatPercent, formatDelta, formatRatio, formatCurrency, formatDate, resolveFormat } from "@/lib/format";
export type { ValueFormat } from "@/lib/format";
export { seriesColor, roleColor, resolveColor, cssVar } from "@/lib/chartTokens";
export type { ChartRole } from "@/lib/chartTokens";
export { toChartData } from "@/lib/to-chart-data";
export type { ToChartDataOptions } from "@/lib/to-chart-data";

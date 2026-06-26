//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

/**
 * Dashboard kit — the pick-&-choose component library.
 *
 * Compose dashboards by importing these components and passing data; you
 * should rarely hand-write SVG or raw JSX. Charts are fully custom (D3 math +
 * SVG, no charting library), slicers + chart clicks share one filter model,
 * and every component reads each other's JSDoc (and the `visuals` skill
 * catalog) for a copy-paste snippet.
 *
 *   import {
 *     PageShell, BentoGrid, BentoItem, KpiGrid, ChartGrid,
 *     KpiCard, LineChartCard, BarChartCard, ComboChartCard, DataTableCard,
 *     FilterStateProvider, FilterBar, DropdownSlicer, useCrossFilter,
 *     pivotChartData, deriveKpi, ThemeToggle,
 *   } from "@/components/dashboard";
 */

/* ------------------------------- Layout -------------------------------- */
export {
    PageShell,
    KpiGrid,
    ChartGrid,
    Section,
    BentoGrid,
    BentoItem,
} from "./PageShell";
export type { PageShellProps, SectionProps, BentoItemProps } from "./PageShell";
export { ThemeToggle } from "./ThemeToggle";
export {
    SegmentedControl,
    FilterChips,
} from "./controls";
export type {
    SegmentedControlProps,
    SegmentedOption,
    FilterChipsProps,
    FilterChipOption,
} from "./controls";

/* -------------------------------- Cards -------------------------------- */
export { ChartCard } from "./ChartCard";
export type { ChartCardProps } from "./ChartCard";
export { KpiCard } from "./KpiCard";
export type { KpiCardProps } from "./KpiCard";
export { DataTableCard } from "./DataTableCard";
export type { DataTableCardProps } from "./DataTableCard";

/* -------------------------------- Charts ------------------------------- */
export { Sparkline } from "./Sparkline";
export type { SparklineProps } from "./Sparkline";
export { LineChartCard } from "./LineChartCard";
export type { LineChartCardProps } from "./LineChartCard";
export { AreaChartCard } from "./AreaChartCard";
export type { AreaChartCardProps } from "./AreaChartCard";
export { BarChartCard } from "./BarChartCard";
export type { BarChartCardProps } from "./BarChartCard";
export { DonutChartCard, PieChartCard } from "./DonutChartCard";
export type { DonutChartCardProps } from "./DonutChartCard";
export { ComboChartCard } from "./ComboChartCard";
export type { ComboChartCardProps } from "./ComboChartCard";
export { ScatterChartCard } from "./ScatterChartCard";
export type { ScatterChartCardProps } from "./ScatterChartCard";
export { GaugeCard } from "./GaugeCard";
export type { GaugeCardProps } from "./GaugeCard";
export { FunnelChartCard } from "./FunnelChartCard";
export type { FunnelChartCardProps } from "./FunnelChartCard";
export { BulletChartCard, ProgressBar } from "./BulletChartCard";
export type { BulletChartCardProps, ProgressBarProps } from "./BulletChartCard";
export { ChartTooltip } from "./ChartTooltip";
export type { ChartTooltipProps } from "./ChartTooltip";
export { AnimatedNumber } from "./AnimatedNumber";
export type { AnimatedNumberProps } from "./AnimatedNumber";
export type {
    SeriesConfig,
    ChartCardCommonProps,
    CartesianChartProps,
} from "./cartesian";

/* --------------------- Responsive frame + legend ----------------------- */
export {
    ChartFrame,
    DEFAULT_ASPECT,
    MIN_CHART_HEIGHT,
    MAX_CHART_HEIGHT,
} from "./ChartFrame";
export type {
    ChartFrameProps,
    LegendItem,
    LegendPlacement,
} from "./ChartFrame";

/* -------------------------------- States ------------------------------- */
export {
    ChartSkeleton,
    KpiSkeleton,
    EmptyTile,
    ErrorTile,
    TileBody,
} from "./states";
export type {
    ChartSkeletonProps,
    EmptyTileProps,
    ErrorTileProps,
    TileBodyProps,
} from "./states";

/* -------------------------------- Icons -------------------------------- */
export {
    SunIcon,
    MoonIcon,
    ArrowUpRightIcon,
    ArrowDownRightIcon,
    ChevronRightIcon,
    ChevronDownIcon,
    AlertTriangleIcon,
    InboxIcon,
} from "./icons";
export type { IconProps } from "./icons";

/* ----------------------- Filters + slicers ----------------------------- */
export {
    FilterStateProvider,
    useFilterState,
    fieldShortName,
    parseField,
} from "./filters/filter-state";
export type {
    FilterField,
    FilterSelection,
    FilterStateApi,
} from "./filters/filter-state";
export { Popover } from "./filters/Popover";
export type { PopoverProps } from "./filters/Popover";
export { DropdownSlicer } from "./filters/DropdownSlicer";
export type { DropdownSlicerProps } from "./filters/DropdownSlicer";
export { ListSlicer } from "./filters/ListSlicer";
export type { ListSlicerProps } from "./filters/ListSlicer";
export { SearchSlicer } from "./filters/SearchSlicer";
export type { SearchSlicerProps } from "./filters/SearchSlicer";
export { DateRangeSlicer } from "./filters/DateRangeSlicer";
export type { DateRangeSlicerProps } from "./filters/DateRangeSlicer";
export { RangeSlicer } from "./filters/RangeSlicer";
export type { RangeSlicerProps } from "./filters/RangeSlicer";
export { FilterBar } from "./filters/FilterBar";
export type { FilterBarProps } from "./filters/FilterBar";

/* --------------- Coordinated interactions (Tableau-like) --------------- */
export { DrilldownBreadcrumb } from "./DrilldownBreadcrumb";
export type { DrilldownBreadcrumbProps } from "./DrilldownBreadcrumb";
export { useCrossFilter } from "@/hooks/use-cross-filter";
export type { CrossFilterProps } from "@/hooks/use-cross-filter";
export { useDrilldown } from "@/hooks/use-drilldown";
export type { DrilldownApi, DrilldownLevel } from "@/hooks/use-drilldown";
export { useSlicerOptions } from "@/hooks/use-slicer-options";
export type {
    SlicerOption,
    UseSlicerOptionsResult,
} from "@/hooks/use-slicer-options";

/* ----------------- Filter application (client + DAX) ------------------- */
export { applyFilters, matchesSelection } from "@/lib/apply-filters";
export type { ApplyFiltersOptions } from "@/lib/apply-filters";
export {
    toDaxFilters,
    daxEscape,
    daxValueList,
    daxDateLiteral,
} from "@/lib/dax-filters";
export type { DaxFilters } from "@/lib/dax-filters";
export { quoteFieldRef } from "@/lib/filter-field";
export type { ParsedFilterField } from "@/lib/filter-field";

/* --------------------- Custom chart core (advanced) -------------------- */
export { useChartSize } from "./charts/useChartSize";
export type { ChartSize, Margin, MarkInteraction } from "./charts/types";

/* --------------------------- Helpers (re-exports) ---------------------- */
export {
    formatNumber,
    formatCompact,
    formatPercent,
    formatDelta,
    formatRatio,
    formatCurrency,
    formatDate,
    resolveFormat,
} from "@/lib/format";
export type { ValueFormat } from "@/lib/format";
export {
    seriesColor,
    roleColor,
    resolveColor,
    cssVar,
    useChartTheme,
} from "@/lib/chartTokens";
export type { ChartRole, ChartTheme } from "@/lib/chartTokens";
export { useCssTheme } from "@/lib/use-css-theme";
export { toDataTable } from "@/lib/to-data-table";
export type { ColumnMetadataMap } from "@/lib/to-data-table";
export { toChartData } from "@/lib/to-chart-data";
export type { ToChartDataOptions } from "@/lib/to-chart-data";
export { isDateLike, inferXFormat, autoAxisWidth } from "@/lib/auto-format";
export type { AutoAxisWidthOptions } from "@/lib/auto-format";

/* ----------------------- Data mapping (DAX → cards) -------------------- */
export { pivotChartData } from "@/lib/pivot-chart-data";
export type {
    PivotChartDataOptions,
    PivotChartDataResult,
    PivotSeries,
} from "@/lib/pivot-chart-data";
export { topN } from "@/lib/top-n";
export type { TopNOptions } from "@/lib/top-n";
export { deriveKpi } from "@/lib/derive-kpi";
export type { DeriveKpiOptions, DerivedKpi } from "@/lib/derive-kpi";
export { warnMissingKeys } from "@/lib/validate";

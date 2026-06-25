//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import {
    CartesianGrid,
    Scatter,
    ScatterChart,
    Tooltip,
    XAxis,
    YAxis,
    ZAxis,
} from "recharts";

import {
    axisProps,
    gridProps,
    resolveColor,
    seriesColor,
    useChartTheme,
} from "@/lib/chartTokens";
import { autoAxisWidth } from "@/lib/auto-format";
import { resolveFormat, type ValueFormat } from "@/lib/format";
import { cn } from "@/lib/utils";
import { warnMissingKeys } from "@/lib/validate";

import { ChartCard } from "./ChartCard";
import { ChartFrame, type LegendPlacement } from "./ChartFrame";
import { type ChartCardCommonProps, type SeriesConfig } from "./cartesian";
import { TileBody } from "./states";

export interface ScatterChartCardProps extends ChartCardCommonProps {
    /** Row objects — one per point, carrying numeric X/Y and optional size/category. */
    data?: Array<Record<string, unknown>>;
    /** Numeric property used for the X axis. */
    xKey: string;
    /** Numeric property used for the Y axis. */
    yKey: string;
    /** Optional numeric measure that drives bubble area. */
    sizeKey?: string;
    /** Optional category key that splits points into colored groups. */
    series?: string;
    /** X-axis + tooltip value format (default `"number"`). */
    xFormat?: ValueFormat;
    /** Y-axis + tooltip value format (default `"number"`). */
    valueFormat?: ValueFormat;
    /** Tooltip label for the size measure (defaults to `sizeKey`). */
    sizeName?: string;
    /** Fixed pixel height; omit for responsive aspect height (default). */
    height?: number;
    /** Width/height ratio used when `height` is unset. */
    aspect?: number;
    /** Where the legend sits relative to the plot (default `"top"`). */
    legendPlacement?: LegendPlacement;
    /** Toggle the gridlines (default true). */
    showGrid?: boolean;
    /** Toggle the legend (default: on when `series` is provided). */
    showLegend?: boolean;
}

type ScatterPoint = Record<string, unknown>;

interface ScatterTooltipEntry {
    name?: number | string;
    value?: number | string | ReadonlyArray<number | string>;
    color?: string;
    dataKey?: number | string;
    payload?: Record<string, unknown>;
}

interface ScatterTooltipProps {
    active?: boolean;
    payload?: ReadonlyArray<ScatterTooltipEntry>;
    xKey: string;
    yKey: string;
    sizeKey?: string;
    sizeName?: string;
    xFormat?: ValueFormat;
    valueFormat?: ValueFormat;
}

function finiteNumber(value: unknown): number | undefined {
    if (value == null || value === "") return undefined;
    const next = Number(value);
    return Number.isFinite(next) ? next : undefined;
}

function pointValue(
    entry: ScatterTooltipEntry | undefined,
    point: Record<string, unknown> | undefined,
    key: string,
): number | undefined {
    const value = Array.isArray(entry?.value) ? entry?.value[0] : entry?.value;
    return finiteNumber(value ?? point?.[key]);
}

function toPoint(
    row: Record<string, unknown>,
    xKey: string,
    yKey: string,
    sizeKey?: string,
): ScatterPoint | null {
    const x = finiteNumber(row[xKey]);
    const y = finiteNumber(row[yKey]);
    if (x == null || y == null) return null;

    const point: ScatterPoint = { ...row, [xKey]: x, [yKey]: y };
    if (sizeKey) {
        const size = finiteNumber(row[sizeKey]);
        if (size != null) point[sizeKey] = size;
    }
    return point;
}

function groupLabel(row: ScatterPoint, series: string): string {
    const value = row[series];
    if (value == null || String(value).trim() === "") return "Unspecified";
    return String(value);
}

function ScatterTooltipContent({
    active,
    payload,
    xKey,
    yKey,
    sizeKey,
    sizeName,
    xFormat,
    valueFormat,
}: ScatterTooltipProps) {
    if (!active || !payload || payload.length === 0) return null;

    const formatX = resolveFormat(xFormat);
    const formatY = resolveFormat(valueFormat);
    const point = payload[0]?.payload;
    const entryFor = (key: string) =>
        payload.find((entry) => String(entry.dataKey) === key);
    const x = pointValue(entryFor(xKey), point, xKey);
    const y = pointValue(entryFor(yKey), point, yKey);
    const size = sizeKey ? pointValue(entryFor(sizeKey), point, sizeKey) : undefined;

    return (
        <div
            className={cn(
                "rounded-lg border border-border-strong bg-popover/95 px-3 py-2 text-xs shadow-lg backdrop-blur",
            )}
        >
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                    <span className="text-foreground-secondary">{xKey}</span>
                    <span className="ml-auto pl-4 font-numeric tabular-nums text-foreground">
                        {formatX(x ?? Number.NaN)}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-foreground-secondary">{yKey}</span>
                    <span className="ml-auto pl-4 font-numeric tabular-nums text-foreground">
                        {formatY(y ?? Number.NaN)}
                    </span>
                </div>
                {sizeKey && (
                    <div className="flex items-center gap-2">
                        <span className="text-foreground-secondary">
                            {sizeName ?? sizeKey}
                        </span>
                        <span className="ml-auto pl-4 font-numeric tabular-nums text-foreground">
                            {formatY(size ?? Number.NaN)}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * Scatter / bubble chart for correlation analysis — plot one numeric measure
 * against another, optionally sizing bubbles by a third measure and splitting
 * points into themed category groups. The card owns axes, tooltip, legend,
 * null-safe coercion, loading, error, and empty states.
 *
 * @example
 * ```tsx
 * <ScatterChartCard
 *   title="Discount vs margin"
 *   data={rows}
 *   xKey="DiscountRate"
 *   yKey="GrossMargin"
 *   sizeKey="Revenue"
 *   series="Segment"
 *   xFormat="percent"
 *   valueFormat="percent"
 *   sizeName="Revenue"
 * />
 * ```
 */
export function ScatterChartCard({
    title,
    subtitle,
    action,
    className,
    loading,
    error,
    emptyMessage,
    onRetry,
    data = [],
    xKey,
    yKey,
    sizeKey,
    series,
    xFormat,
    valueFormat,
    sizeName,
    height,
    aspect,
    legendPlacement = "top",
    showGrid = true,
    showLegend,
}: ScatterChartCardProps) {
    const theme = useChartTheme();
    const formatX = resolveFormat(xFormat);
    const formatY = resolveFormat(valueFormat);
    const rows = data
        .map((row) => toPoint(row, xKey, yKey, sizeKey))
        .filter((row): row is ScatterPoint => row != null);
    const legend = showLegend ?? Boolean(series);

    warnMissingKeys("ScatterChartCard", data, [
        xKey,
        yKey,
        ...(sizeKey ? [sizeKey] : []),
        ...(series ? [series] : []),
    ]);

    const groups = new Map<string, ScatterPoint[]>();
    if (series) {
        for (const row of rows) {
            const label = groupLabel(row, series);
            groups.set(label, [...(groups.get(label) ?? []), row]);
        }
    }
    const groupedRows = Array.from(groups, ([label, groupRows]) => ({
        label,
        rows: groupRows,
    }));
    const legendSeries: SeriesConfig[] = groupedRows.map((group) => ({
        key: group.label,
        label: group.label,
    }));
    const legendColors = groupedRows.map((_, index) => seriesColor(index));
    const legendItems = legend
        ? legendSeries.map((entry, index) => ({
              label: entry.label ?? entry.key,
              color: legendColors[index],
          }))
        : undefined;
    const yAxisWidth = autoAxisWidth(
        rows.map((row) => Number(row[yKey])),
        formatY,
    );
    const scatterChart = (
        <ScatterChart>
            {showGrid && <CartesianGrid {...gridProps(theme)} />}
            <XAxis
                dataKey={xKey}
                type="number"
                domain={["auto", "auto"]}
                {...axisProps(theme)}
                minTickGap={24}
                tickFormatter={(value) => formatX(Number(value))}
            />
            <YAxis
                dataKey={yKey}
                type="number"
                {...axisProps(theme)}
                width={yAxisWidth}
                tickFormatter={(value) => formatY(Number(value))}
            />
            {sizeKey && (
                <ZAxis
                    dataKey={sizeKey}
                    range={[60, 400]}
                    name={sizeName ?? sizeKey}
                />
            )}
            <Tooltip
                cursor={{
                    strokeDasharray: "3 3",
                    stroke: theme.grid,
                }}
                content={
                    <ScatterTooltipContent
                        xKey={xKey}
                        yKey={yKey}
                        sizeKey={sizeKey}
                        sizeName={sizeName}
                        xFormat={xFormat}
                        valueFormat={valueFormat}
                    />
                }
            />
            {series
                ? groupedRows.map((group, index) => (
                      <Scatter
                          key={group.label}
                          name={group.label}
                          data={group.rows}
                          fill={seriesColor(index)}
                          isAnimationActive={false}
                      />
                  ))
                : (
                      <Scatter
                          name={yKey}
                          data={rows}
                          fill={resolveColor("chart-1", 0)}
                          isAnimationActive={false}
                      />
                  )}
        </ScatterChart>
    );

    return (
        <ChartCard
            title={title}
            subtitle={subtitle}
            action={action}
            className={cn(className)}
        >
            <TileBody
                loading={loading}
                error={error}
                isEmpty={data.length === 0}
                height={height}
                emptyMessage={emptyMessage}
                onRetry={onRetry}
            >
                <ChartFrame
                    height={height}
                    aspect={aspect}
                    legend={legendItems}
                    legendPlacement={legendPlacement}
                >
                    {scatterChart}
                </ChartFrame>
            </TileBody>
        </ChartCard>
    );
}

//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { PointerEvent } from "react";
import { extent } from "d3-array";
import { scaleSqrt } from "d3-scale";
import { motion, useReducedMotion } from "framer-motion";

import { resolveColor, seriesColor, useChartTheme } from "@/lib/chartTokens";
import { autoAxisWidth } from "@/lib/auto-format";
import { resolveFormat, type ValueFormat } from "@/lib/format";
import { cn } from "@/lib/utils";
import { warnMissingKeys } from "@/lib/validate";

import { ChartCard } from "./ChartCard";
import { ChartFrame, type LegendPlacement } from "./ChartFrame";
import { type ChartCardCommonProps, type SeriesConfig } from "./cartesian";
import { AxisBottom, AxisLeft } from "./charts/axis";
import { GridColumns, GridRows } from "./charts/grid";
import { linearScale, linearTicks, thinTicksByWidth } from "./charts/scales";
import { tooltipBoxStyle, useChartTooltip } from "./charts/tooltip";
import type { ChartSize } from "./charts/types";
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

interface ScatterGroup {
    label: string;
    rows: ScatterPoint[];
    color: string;
}

interface PlottedScatterPoint {
    row: ScatterPoint;
    index: number;
    x: number;
    y: number;
    radius: number;
    color: string;
}

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

function dataExtent(values: ReadonlyArray<number>): [number, number] {
    const [min, max] = extent(values);
    if (min == null || max == null) return [0, 1];
    if (min === max) return [min - 1, max + 1];
    return [min, max];
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

interface ScatterPlotProps {
    size: ChartSize;
    rows: ScatterPoint[];
    groups: ScatterGroup[];
    xKey: string;
    yKey: string;
    sizeKey?: string;
    sizeName?: string;
    xFormat?: ValueFormat;
    valueFormat?: ValueFormat;
    showGrid: boolean;
}

function ScatterPlot({
    size,
    rows,
    groups,
    xKey,
    yKey,
    sizeKey,
    sizeName,
    xFormat,
    valueFormat,
    showGrid,
}: ScatterPlotProps) {
    const theme = useChartTheme();
    const tooltip = useChartTooltip();
    const reduce = useReducedMotion();
    const { width, height } = size;
    const formatX = resolveFormat(xFormat);
    const formatY = resolveFormat(valueFormat);
    const xValues = rows.map((row) => Number(row[xKey]));
    const yValues = rows.map((row) => Number(row[yKey]));
    const margin = {
        top: 10,
        right: 14,
        bottom: 26,
        left: autoAxisWidth(yValues, formatY),
    };
    const innerW = Math.max(0, width - margin.left - margin.right);
    const innerH = Math.max(0, height - margin.top - margin.bottom);

    if (innerW <= 0 || innerH <= 0) return null;

    const xScale = linearScale(dataExtent(xValues), [0, innerW], true);
    const yScale = linearScale(dataExtent(yValues), [innerH, 0], true);
    const xTicks = linearTicks(xScale, 5);
    const yTicks = linearTicks(yScale, 5);
    const xAxisTicks = thinTicksByWidth(
        xTicks.map((tick) => ({
            key: String(tick),
            label: formatX(tick),
            pos: xScale(tick),
        })),
    );
    const yAxisTicks = yTicks.map((tick) => ({
        key: String(tick),
        label: formatY(tick),
        pos: yScale(tick),
    }));
    const sizeValues = sizeKey
        ? rows
              .map((row) => finiteNumber(row[sizeKey]))
              .filter((value): value is number => value != null)
        : [];
    const maxSize = Math.max(0, ...sizeValues.map((value) => Math.max(0, value)));
    const sizeScale = sizeKey
        ? scaleSqrt().domain([0, maxSize]).range([3, 18]).clamp(true)
        : undefined;
    const plottedPoints: PlottedScatterPoint[] = groups.flatMap((group) =>
        group.rows.map((row) => {
            const x = Number(row[xKey]);
            const y = Number(row[yKey]);
            const sizeValue = sizeKey ? finiteNumber(row[sizeKey]) : undefined;
            return {
                row,
                index: rows.indexOf(row),
                x,
                y,
                radius: sizeScale ? sizeScale(Math.max(0, sizeValue ?? 0)) : 5,
                color: group.color,
            };
        }),
    );

    const onPointerMove = (event: PointerEvent<SVGRectElement>) => {
        if (plottedPoints.length === 0) return;
        const box = event.currentTarget.getBoundingClientRect();
        const localX = event.clientX - box.left;
        const localY = event.clientY - box.top;
        let best = plottedPoints[0];
        let bestDist = Number.POSITIVE_INFINITY;

        for (const point of plottedPoints) {
            const px = xScale(point.x);
            const py = yScale(point.y);
            const dist = (px - localX) ** 2 + (py - localY) ** 2;
            if (dist < bestDist) {
                best = point;
                bestDist = dist;
            }
        }

        tooltip.show(
            best.index,
            margin.left + xScale(best.x),
            margin.top + yScale(best.y),
        );
    };

    const activePoint =
        tooltip.state == null
            ? undefined
            : plottedPoints.find((point) => point.index === tooltip.state?.index);
    const payload =
        activePoint == null
            ? []
            : [
                  {
                      dataKey: xKey,
                      value: activePoint.x,
                      payload: activePoint.row,
                      color: activePoint.color,
                  },
                  {
                      dataKey: yKey,
                      value: activePoint.y,
                      payload: activePoint.row,
                      color: activePoint.color,
                  },
                  ...(sizeKey
                      ? [
                            {
                                dataKey: sizeKey,
                                value:
                                    finiteNumber(activePoint.row[sizeKey]) ??
                                    Number.NaN,
                                payload: activePoint.row,
                                color: activePoint.color,
                            },
                        ]
                      : []),
              ];

    return (
        <>
            <svg
                width={width}
                height={height}
                role="img"
                className="overflow-visible"
                aria-label={`${xKey} versus ${yKey} scatter chart`}
            >
                <g transform={`translate(${margin.left},${margin.top})`}>
                    {showGrid && (
                        <>
                            <GridRows
                                positions={yTicks.map((tick) => yScale(tick))}
                                left={0}
                                right={innerW}
                                theme={theme}
                            />
                            <GridColumns
                                positions={xTicks.map((tick) => xScale(tick))}
                                top={0}
                                bottom={innerH}
                                theme={theme}
                            />
                        </>
                    )}
                    <AxisLeft ticks={yAxisTicks} right={0} theme={theme} />
                    <AxisBottom ticks={xAxisTicks} top={innerH} theme={theme} />
                    {groups.map((group) => (
                        <g key={group.label}>
                            {group.rows.map((row) => {
                                const point = plottedPoints.find(
                                    (item) => item.row === row,
                                );
                                if (point == null) return null;
                                return (
                                    <motion.circle
                                        key={point.index}
                                        cx={xScale(point.x)}
                                        cy={yScale(point.y)}
                                        fill={point.color}
                                        fillOpacity={0.7}
                                        stroke={point.color}
                                        initial={reduce ? false : { r: 0 }}
                                        animate={{ r: point.radius }}
                                        transition={{
                                            duration: 0.35,
                                            ease: "easeOut",
                                            delay: point.index * 0.01,
                                        }}
                                    />
                                );
                            })}
                        </g>
                    ))}
                    <rect
                        x={0}
                        y={0}
                        width={innerW}
                        height={innerH}
                        fill="transparent"
                        onPointerMove={onPointerMove}
                        onPointerLeave={tooltip.hide}
                    />
                </g>
            </svg>
            {tooltip.state != null && activePoint != null && (
                <div style={tooltipBoxStyle(tooltip.state.x, tooltip.state.y, width)}>
                    <ScatterTooltipContent
                        active
                        payload={payload}
                        xKey={xKey}
                        yKey={yKey}
                        sizeKey={sizeKey}
                        sizeName={sizeName}
                        xFormat={xFormat}
                        valueFormat={valueFormat}
                    />
                </div>
            )}
        </>
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
    } else if (rows.length > 0) {
        groups.set(yKey, rows);
    }
    const groupedRows: ScatterGroup[] = Array.from(groups, ([label, groupRows], index) => ({
        label,
        rows: groupRows,
        color: series ? seriesColor(index) : resolveColor("chart-1", 0),
    }));
    const legendSeries: SeriesConfig[] = groupedRows.map((group) => ({
        key: group.label,
        label: group.label,
    }));
    const legendItems = legend
        ? legendSeries.map((entry, index) => ({
              label: entry.label ?? entry.key,
              color: groupedRows[index].color,
          }))
        : undefined;

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
                    {(size) => (
                        <ScatterPlot
                            size={size}
                            rows={rows}
                            groups={groupedRows}
                            xKey={xKey}
                            yKey={yKey}
                            sizeKey={sizeKey}
                            sizeName={sizeName}
                            xFormat={xFormat}
                            valueFormat={valueFormat}
                            showGrid={showGrid}
                        />
                    )}
                </ChartFrame>
            </TileBody>
        </ChartCard>
    );
}

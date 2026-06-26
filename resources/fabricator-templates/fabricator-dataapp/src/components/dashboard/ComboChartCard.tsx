//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { useId, type PointerEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { line as d3Line } from "d3-shape";

import { autoAxisWidth, inferXFormat } from "@/lib/auto-format";
import { resolveColor, useChartTheme, type ChartTheme } from "@/lib/chartTokens";
import { resolveFormat, type ValueFormat } from "@/lib/format";
import { warnMissingKeys } from "@/lib/validate";

import { ChartCard } from "./ChartCard";
import { ChartFrame, type LegendItem } from "./ChartFrame";
import type { LegendPlacement } from "./ChartFrame";
import { type ChartCardCommonProps, type SeriesConfig } from "./cartesian";
import { AxisBottom, AxisLeft } from "./charts/axis";
import { GridRows } from "./charts/grid";
import {
    bandScale,
    curveFactory,
    linearScale,
    linearTicks,
    thinTicksByWidth,
    valueDomain,
    type CurveType,
} from "./charts/scales";
import { tooltipBoxStyle, useChartTooltip } from "./charts/tooltip";
import type { ChartSize } from "./charts/types";
import { ChartTooltip } from "./ChartTooltip";
import { TileBody } from "./states";

export interface ComboChartCardProps extends ChartCardCommonProps {
    /** Row objects — one per x value, carrying every bar + line measure. */
    data?: Array<Record<string, unknown>>;
    /** Property used for the X axis (category / time). */
    xKey: string;
    /** Measures drawn as bars (left axis). */
    bars?: SeriesConfig[];
    /** Measures drawn as lines (right axis when `rightAxis`, else left). */
    lines?: SeriesConfig[];
    /** Fixed pixel height; omit for responsive aspect height (default). */
    height?: number;
    /** Width/height ratio used when `height` is unset (default from `ChartFrame`). */
    aspect?: number;
    /** Legend placement around the responsive chart frame (default `"top"`). */
    legendPlacement?: LegendPlacement;
    /** Left-axis (bars) value format + tooltip default (default `"number"`). */
    valueFormat?: ValueFormat;
    /** Right-axis (lines) value format (defaults to `valueFormat`). */
    rightValueFormat?: ValueFormat;
    /** Put the lines on a secondary right Y axis. Defaults to `true` when the
     *  card has both bars and lines (the classic dual-axis combo). */
    rightAxis?: boolean;
    /** X-axis tick formatter (e.g. `formatDate`). */
    xFormat?: (value: string | number) => string;
    /** Toggle the horizontal gridlines (default true). */
    showGrid?: boolean;
    /** Toggle the legend (default: on when >1 total series). */
    showLegend?: boolean;
    /** Stack the bars (default false). */
    stacked?: boolean;
    /** Line interpolation (default `"monotone"`). */
    curve?: "monotone" | "linear" | "natural" | "step";
    /** Horizontal marker lines on the left axis (avg / target). */
    referenceLines?: ReadonlyArray<{ y: number; label?: string }>;
}

/**
 * Combo chart — bars plus line(s), with an optional **dual Y axis** so a
 * different-unit trend (e.g. a margin %) overlays value bars (e.g. revenue)
 * without being flattened. Same declarative, themed contract as the other
 * chart cards: map your DAX result, declare `bars` + `lines`, pass data.
 *
 * @example
 * ```tsx
 * <ComboChartCard
 *   title="Revenue & margin"
 *   data={rows}
 *   xKey="Month"
 *   bars={[{ key: "Revenue", label: "Revenue", color: "chart-1" }]}
 *   lines={[{ key: "Margin", label: "Margin %", color: "chart-4" }]}
 *   valueFormat="currency"
 *   rightValueFormat="percent"
 * />
 * ```
 */
export function ComboChartCard({
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
    bars = [],
    lines = [],
    height,
    aspect,
    legendPlacement = "top",
    valueFormat,
    rightValueFormat,
    rightAxis,
    xFormat,
    showGrid = true,
    showLegend,
    stacked,
    curve = "monotone",
    referenceLines,
}: ComboChartCardProps) {
    const barColors = bars.map((entry, index) => resolveColor(entry.color, index));
    const lineColors = lines.map((entry, index) =>
        resolveColor(entry.color, bars.length + index),
    );
    const resolvedXFormat = xFormat ?? inferXFormat(data, xKey);
    const useRightAxis = rightAxis ?? (bars.length > 0 && lines.length > 0);
    const legend = showLegend ?? bars.length + lines.length > 1;

    warnMissingKeys("ComboChartCard", data, [
        xKey,
        ...bars.map((entry) => entry.key),
        ...lines.map((entry) => entry.key),
    ]);

    // Per-series tooltip formats so bars/lines read in their own axis's units.
    const seriesFormats: Record<string, ValueFormat> = {};
    if (valueFormat) {
        for (const entry of bars) {
            seriesFormats[entry.key] = valueFormat;
            if (entry.label) seriesFormats[entry.label] = valueFormat;
        }
    }
    const rightFmt = rightValueFormat ?? valueFormat;
    if (rightFmt) {
        for (const entry of lines) {
            seriesFormats[entry.key] = rightFmt;
            if (entry.label) seriesFormats[entry.label] = rightFmt;
        }
    }

    const legendSeries: SeriesConfig[] = [...bars, ...lines];
    const legendColors = [...barColors, ...lineColors];
    const legendItems: LegendItem[] | undefined = legend
        ? legendSeries.map((entry, index) => ({
              label: entry.label ?? entry.key,
              color: legendColors[index],
          }))
        : undefined;

    return (
        <ChartCard
            title={title}
            subtitle={subtitle}
            action={action}
            className={className}
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
                        <ComboPlot
                            size={size}
                            data={data}
                            xKey={xKey}
                            bars={bars}
                            lines={lines}
                            barColors={barColors}
                            lineColors={lineColors}
                            valueFormat={valueFormat}
                            rightValueFormat={rightValueFormat}
                            resolvedXFormat={resolvedXFormat}
                            useRightAxis={useRightAxis}
                            showGrid={showGrid}
                            stacked={stacked}
                            curve={curve}
                            referenceLines={referenceLines}
                            seriesFormats={seriesFormats}
                        />
                    )}
                </ChartFrame>
            </TileBody>
        </ChartCard>
    );
}

interface ComboPlotProps {
    size: ChartSize;
    data: Array<Record<string, unknown>>;
    xKey: string;
    bars: SeriesConfig[];
    lines: SeriesConfig[];
    barColors: string[];
    lineColors: string[];
    valueFormat?: ValueFormat;
    rightValueFormat?: ValueFormat;
    resolvedXFormat?: (value: string | number) => string;
    useRightAxis: boolean;
    showGrid: boolean;
    stacked?: boolean;
    curve: CurveType;
    referenceLines?: ReadonlyArray<{ y: number; label?: string }>;
    seriesFormats: Record<string, ValueFormat>;
}

/** Value-space stack segment for one datum/bar series in a stacked combo. */
interface StackSeg {
    lo: number;
    hi: number;
}

function ComboPlot({
    size,
    data,
    xKey,
    bars,
    lines,
    barColors,
    lineColors,
    valueFormat,
    rightValueFormat,
    resolvedXFormat,
    useRightAxis,
    showGrid,
    stacked,
    curve,
    referenceLines,
    seriesFormats,
}: ComboPlotProps) {
    const theme = useChartTheme();
    const titleId = useId().replace(/:/g, "");
    const reduce = useReducedMotion();
    const tooltip = useChartTooltip();

    const { width, height } = size;
    const leftFormat = resolveFormat(valueFormat);
    const rightFormat = resolveFormat(rightValueFormat ?? valueFormat);
    const formatX = (value: string | number) =>
        resolvedXFormat ? resolvedXFormat(value) : String(value);

    const barKeys = bars.map((entry) => entry.key);
    const lineKeys = lines.map((entry) => entry.key);
    const leftKeys = useRightAxis ? barKeys : [...barKeys, ...lineKeys];
    const categories = data.map((row) => String(row[xKey]));
    const leftValues = data
        .flatMap((row) => leftKeys.map((key) => Number(row[key])))
        .filter((value) => Number.isFinite(value));
    const rightValues = data
        .flatMap((row) => lineKeys.map((key) => Number(row[key])))
        .filter((value) => Number.isFinite(value));

    const margin = {
        top: 10,
        right: useRightAxis ? autoAxisWidth(rightValues, rightFormat) : 14,
        bottom: 26,
        left: autoAxisWidth(leftValues, leftFormat),
    };
    const innerW = Math.max(0, width - margin.left - margin.right);
    const innerH = Math.max(0, height - margin.top - margin.bottom);

    if (innerW <= 0 || innerH <= 0) return null;

    const xBand = bandScale(categories, innerW);
    const centerX = (index: number) =>
        (xBand(categories[index]) ?? 0) + xBand.bandwidth() / 2;
    const leftScale = linearScale(
        valueDomain(data, leftKeys, { stacked, includeZero: true }),
        [innerH, 0],
    );
    const rightScale = useRightAxis
        ? linearScale(
              valueDomain(data, lineKeys, { includeZero: true }),
              [innerH, 0],
          )
        : leftScale;
    const leftTicks = linearTicks(leftScale, 5);
    const rightTicks = useRightAxis ? linearTicks(rightScale, 5) : [];
    const baseline = leftScale(0);

    const stacks: StackSeg[][] = stacked
        ? data.map((row) => {
              let pos = 0;
              let neg = 0;
              return bars.map((entry) => {
                  const value = Number(row[entry.key]) || 0;
                  if (value >= 0) {
                      const seg = { lo: pos, hi: pos + value };
                      pos = seg.hi;
                      return seg;
                  }
                  const seg = { lo: neg + value, hi: neg };
                  neg = seg.lo;
                  return seg;
              });
          })
        : [];

    const xTicks = thinTicksByWidth(
        categories.map((label, index) => ({
            key: `${label}-${index}`,
            label: formatX(label),
            pos: centerX(index),
        })),
    );

    const onPointerMove = (event: PointerEvent<SVGRectElement>) => {
        const box = event.currentTarget.getBoundingClientRect();
        const localX = event.clientX - box.left;
        const localY = event.clientY - box.top;
        if (categories.length === 0) return;

        let bestIndex = 0;
        let bestDist = Number.POSITIVE_INFINITY;
        categories.forEach((_, index) => {
            const dist = Math.abs(categoryCenter(index, categories.length, innerW) - localX);
            if (dist < bestDist) {
                bestDist = dist;
                bestIndex = index;
            }
        });

        tooltip.show(bestIndex, margin.left + centerX(bestIndex), margin.top + localY);
    };

    const active = tooltip.state;
    const payload =
        active != null
            ? [
                  ...bars.map((entry, index) => ({
                      name: entry.label ?? entry.key,
                      dataKey: entry.key,
                      value: Number(data[active.index]?.[entry.key]),
                      color: barColors[index],
                  })),
                  ...lines.map((entry, index) => ({
                      name: entry.label ?? entry.key,
                      dataKey: entry.key,
                      value: Number(data[active.index]?.[entry.key]),
                      color: lineColors[index],
                  })),
              ]
            : [];

    return (
        <>
            <svg
                width={width}
                height={height}
                role="img"
                aria-labelledby={titleId}
                className="overflow-visible"
            >
                <title id={titleId}>Combo chart</title>
                <g transform={`translate(${margin.left},${margin.top})`}>
                    {showGrid && (
                        <GridRows
                            positions={leftTicks.map((tick) => leftScale(tick))}
                            left={0}
                            right={innerW}
                            theme={theme}
                        />
                    )}
                    <AxisLeft
                        ticks={leftTicks.map((tick) => ({
                            key: String(tick),
                            label: leftFormat(tick),
                            pos: leftScale(tick),
                        }))}
                        right={0}
                        theme={theme}
                    />
                    <AxisBottom ticks={xTicks} top={innerH} theme={theme} />
                    {useRightAxis && (
                        <g aria-hidden>
                            {rightTicks.map((tick) => (
                                <text
                                    key={String(tick)}
                                    x={innerW + 8}
                                    y={rightScale(tick)}
                                    textAnchor="start"
                                    dominantBaseline="central"
                                    fontFamily="var(--font-mono)"
                                    fontSize={11}
                                    fill={theme.axis}
                                >
                                    {rightFormat(tick)}
                                </text>
                            ))}
                        </g>
                    )}
                    {referenceLines?.map((line, index) => (
                        <g key={`ref-${index}`}>
                            <line
                                x1={0}
                                x2={innerW}
                                y1={leftScale(line.y)}
                                y2={leftScale(line.y)}
                                stroke={theme.reference}
                                strokeDasharray="4 4"
                                strokeOpacity={0.7}
                            />
                            {line.label && (
                                <text
                                    x={innerW}
                                    y={leftScale(line.y) - 4}
                                    textAnchor="end"
                                    fontSize={11}
                                    fill={theme.foregroundMuted}
                                >
                                    {line.label}
                                </text>
                            )}
                        </g>
                    ))}
                    <ComboBars
                        data={data}
                        categories={categories}
                        bars={bars}
                        colors={barColors}
                        xBand={xBand}
                        yScale={leftScale}
                        baseline={baseline}
                        stacks={stacks}
                        stacked={stacked}
                        reduce={Boolean(reduce)}
                    />
                    <ComboLines
                        data={data}
                        lines={lines}
                        colors={lineColors}
                        centerX={centerX}
                        leftScale={leftScale}
                        rightScale={rightScale}
                        useRightAxis={useRightAxis}
                        curve={curve}
                        reduce={Boolean(reduce)}
                        activeIndex={active?.index ?? null}
                        theme={theme}
                    />
                    {active != null && (
                        <line
                            x1={centerX(active.index)}
                            x2={centerX(active.index)}
                            y1={0}
                            y2={innerH}
                            stroke={theme.cursor}
                            strokeDasharray="3 3"
                        />
                    )}
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
            {active != null && (
                <div style={tooltipBoxStyle(active.x, active.y, width)}>
                    <ChartTooltip
                        active
                        payload={payload}
                        label={data[active.index]?.[xKey] as string | number}
                        valueFormat={valueFormat}
                        seriesFormats={seriesFormats}
                        labelFormat={resolvedXFormat}
                    />
                </div>
            )}
        </>
    );
}

function categoryCenter(index: number, count: number, span: number): number {
    if (count <= 0) return 0;
    return ((index + 0.5) / count) * span;
}

interface ComboBarsProps {
    data: Array<Record<string, unknown>>;
    categories: string[];
    bars: SeriesConfig[];
    colors: string[];
    xBand: ReturnType<typeof bandScale>;
    yScale: ReturnType<typeof linearScale>;
    baseline: number;
    stacks: StackSeg[][];
    stacked?: boolean;
    reduce: boolean;
}

function ComboBars({
    data,
    categories,
    bars,
    colors,
    xBand,
    yScale,
    baseline,
    stacks,
    stacked,
    reduce,
}: ComboBarsProps) {
    return (
        <>
            {bars.map((entry, si) => {
                const groupW = xBand.bandwidth();
                const barW = stacked ? groupW : groupW / bars.length;
                return (
                    <g key={entry.key}>
                        {data.map((row, i) => {
                            const value = Number(row[entry.key]);
                            if (!Number.isFinite(value)) return null;
                            const slotX = xBand(categories[i]) ?? 0;
                            let x: number;
                            let yTop: number;
                            let barH: number;
                            if (stacked) {
                                const seg = stacks[i][si];
                                x = slotX;
                                yTop = yScale(seg.hi);
                                barH = Math.abs(yScale(seg.lo) - yScale(seg.hi));
                            } else {
                                x = slotX + si * barW;
                                yTop = Math.min(yScale(value), baseline);
                                barH = Math.abs(yScale(value) - baseline);
                            }
                            const radius = Math.min(4, barW / 2);
                            return (
                                <motion.rect
                                    key={i}
                                    x={x}
                                    width={Math.max(0, barW - 1)}
                                    rx={radius}
                                    fill={colors[si]}
                                    initial={reduce ? false : { y: baseline, height: 0 }}
                                    animate={{ y: yTop, height: barH }}
                                    transition={{
                                        duration: 0.5,
                                        ease: "easeOut",
                                        delay: i * 0.012,
                                    }}
                                />
                            );
                        })}
                    </g>
                );
            })}
        </>
    );
}

interface ComboLinesProps {
    data: Array<Record<string, unknown>>;
    lines: SeriesConfig[];
    colors: string[];
    centerX: (index: number) => number;
    leftScale: ReturnType<typeof linearScale>;
    rightScale: ReturnType<typeof linearScale>;
    useRightAxis: boolean;
    curve: CurveType;
    reduce: boolean;
    activeIndex: number | null;
    theme: ChartTheme;
}

function ComboLines({
    data,
    lines,
    colors,
    centerX,
    leftScale,
    rightScale,
    useRightAxis,
    curve,
    reduce,
    activeIndex,
    theme,
}: ComboLinesProps) {
    return (
        <>
            {lines.map((entry, si) => {
                const scale = useRightAxis ? rightScale : leftScale;
                const points = data.map(
                    (row, index) =>
                        [centerX(index), scale(Number(row[entry.key]))] as [
                            number,
                            number,
                        ],
                );
                const lineGen = d3Line<[number, number]>()
                    .defined((point) => Number.isFinite(point[1]))
                    .x((point) => point[0])
                    .y((point) => point[1])
                    .curve(curveFactory(curve));
                const linePath = lineGen(points) ?? "";

                return (
                    <g key={entry.key}>
                        <motion.path
                            d={linePath}
                            fill="none"
                            stroke={colors[si]}
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            initial={reduce ? false : { pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 0.7, ease: "easeInOut" }}
                        />
                        {activeIndex != null &&
                            Number.isFinite(Number(data[activeIndex]?.[entry.key])) && (
                                <circle
                                    cx={centerX(activeIndex)}
                                    cy={scale(Number(data[activeIndex][entry.key]))}
                                    r={4}
                                    fill={colors[si]}
                                    stroke={theme.surface}
                                    strokeWidth={2}
                                />
                            )}
                    </g>
                );
            })}
        </>
    );
}

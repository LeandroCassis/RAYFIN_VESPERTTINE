//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { ReactNode } from "react";
import { useId } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { area as d3Area, line as d3Line } from "d3-shape";

import { resolveColor, useChartTheme, type ChartTheme } from "@/lib/chartTokens";
import { autoAxisWidth, inferXFormat } from "@/lib/auto-format";
import { resolveFormat, type ValueFormat } from "@/lib/format";
import { warnMissingKeys } from "@/lib/validate";

import { ChartFrame, type LegendItem, type LegendPlacement } from "./ChartFrame";
import { ChartTooltip } from "./ChartTooltip";
import { AxisBottom, AxisLeft } from "./charts/axis";
import { GridColumns, GridRows } from "./charts/grid";
import {
    bandScale,
    curveFactory,
    linearScale,
    linearTicks,
    pointScale,
    thinTicksByWidth,
    valueDomain,
    type CurveType,
} from "./charts/scales";
import { tooltipBoxStyle, useChartTooltip } from "./charts/tooltip";
import {
    isInteractive,
    markOpacity,
    type ChartSize,
    type MarkInteraction,
} from "./charts/types";

/** One plotted measure. The model maps DAX rows → array and lists series. */
export interface SeriesConfig {
    /** Property on each row to plot. */
    key: string;
    /** Legend / tooltip label (defaults to `key`). */
    label?: string;
    /** Color — a chart token (`chart-1`), role, `var(--…)`, or hex.
     *  Defaults to the Nth color of the chart palette. */
    color?: string;
    /** Group id for stacked bars/areas. */
    stackId?: string;
}

/** Props shared by every chart card shell (title, state handling). */
export interface ChartCardCommonProps {
    title?: ReactNode;
    subtitle?: ReactNode;
    /** Right-aligned header slot (filters, legend, menu). */
    action?: ReactNode;
    className?: string;
    /** Render the loading skeleton. */
    loading?: boolean;
    /** Render the error tile when set. */
    error?: unknown;
    /** Message for the empty (no-rows) state. */
    emptyMessage?: ReactNode;
    /** Retry handler shown on the error tile. */
    onRetry?: () => void;
}

export interface CartesianChartProps extends MarkInteraction {
    type: "line" | "area" | "bar";
    /** Row objects — map your DAX result into these. */
    data?: Array<Record<string, unknown>>;
    /** Property used for the X axis (category / time). */
    xKey: string;
    /** One or more measures to plot. */
    series: SeriesConfig[];
    /** Bar layout (default "vertical"). Use "horizontal" for ranked bars. */
    layout?: "vertical" | "horizontal";
    /** Fixed pixel height. Omit for responsive aspect-based height (the default). */
    height?: number;
    /** Width/height ratio for responsive height (default 2.2); ignored when `height` is set. */
    aspect?: number;
    /** Y-axis + tooltip value format (default `"number"`). */
    valueFormat?: ValueFormat;
    /** X-axis tick formatter (e.g. `formatDate`). */
    xFormat?: (value: string | number) => string;
    /** Toggle the horizontal gridlines (default true). */
    showGrid?: boolean;
    /** Toggle the legend (default: on when >1 series). */
    showLegend?: boolean;
    /** Legend position (default "top"). */
    legendPlacement?: LegendPlacement;
    /** Stack bars / areas (default false). */
    stacked?: boolean;
    /** Line/area interpolation (default `"monotone"`). */
    curve?: CurveType;
    /** Horizontal marker lines (avg / target). */
    referenceLines?: ReadonlyArray<{ y: number; label?: string }>;
}

/** Compact legend strip rendered above multi-series charts. */
export function ChartLegend({
    series,
    colors,
}: {
    series: SeriesConfig[];
    colors: string[];
}) {
    return (
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            {series.map((entry, index) => (
                <span
                    key={entry.key}
                    className="inline-flex items-center gap-1.5 text-xs text-foreground-secondary"
                >
                    <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: colors[index] }}
                    />
                    {entry.label ?? entry.key}
                </span>
            ))}
        </div>
    );
}

/**
 * Shared renderer behind `LineChartCard` / `AreaChartCard` / `BarChartCard`.
 * Renders a fully custom SVG plot (no charting library): `d3-scale` /
 * `d3-shape` math + declarative React SVG, themed via `chartTokens`, animated
 * with `framer-motion`. Owns responsive sizing, axes/grid, hit-tested tooltip,
 * legend, gradients, stacking, reference lines, and click cross-filtering — so
 * the public cards stay declarative. Not exported from the kit barrel; use the
 * cards.
 */
export function CartesianChart({
    type,
    data = [],
    xKey,
    series,
    layout = "vertical",
    height,
    aspect,
    valueFormat,
    xFormat,
    showGrid = true,
    showLegend,
    legendPlacement = "top",
    stacked,
    curve = "monotone",
    referenceLines,
    selectedKeys,
    onSelect,
    dimUnselected,
}: CartesianChartProps) {
    const resolvedXFormat = xFormat ?? inferXFormat(data, xKey);
    const colors = series.map((entry, index) => resolveColor(entry.color, index));
    const legend = showLegend ?? series.length > 1;

    warnMissingKeys("CartesianChart", data, [
        xKey,
        ...series.map((entry) => entry.key),
    ]);

    const legendItems: LegendItem[] | undefined = legend
        ? series.map((entry, index) => ({
              label: entry.label ?? entry.key,
              color: colors[index],
          }))
        : undefined;

    return (
        <ChartFrame
            height={height}
            aspect={aspect}
            legend={legendItems}
            legendPlacement={legendPlacement}
        >
            {(size) => (
                <CartesianPlot
                    size={size}
                    type={type}
                    data={data}
                    xKey={xKey}
                    series={series}
                    colors={colors}
                    layout={layout}
                    valueFormat={valueFormat}
                    resolvedXFormat={resolvedXFormat}
                    showGrid={showGrid}
                    stacked={stacked}
                    curve={curve}
                    referenceLines={referenceLines}
                    interaction={{ selectedKeys, onSelect, dimUnselected }}
                />
            )}
        </ChartFrame>
    );
}

interface CartesianPlotProps {
    size: ChartSize;
    type: "line" | "area" | "bar";
    data: Array<Record<string, unknown>>;
    xKey: string;
    series: SeriesConfig[];
    colors: string[];
    layout: "vertical" | "horizontal";
    valueFormat?: ValueFormat;
    resolvedXFormat?: (value: string | number) => string;
    showGrid: boolean;
    stacked?: boolean;
    curve: CurveType;
    referenceLines?: ReadonlyArray<{ y: number; label?: string }>;
    interaction: MarkInteraction;
}

/** Value-space stack segment for one datum/series in a stacked chart. */
interface StackSeg {
    lo: number;
    hi: number;
}

function CartesianPlot({
    size,
    type,
    data,
    xKey,
    series,
    colors,
    layout,
    valueFormat,
    resolvedXFormat,
    showGrid,
    stacked,
    curve,
    referenceLines,
    interaction,
}: CartesianPlotProps) {
    const theme = useChartTheme();
    const uid = useId().replace(/:/g, "");
    const reduce = useReducedMotion();
    const tooltip = useChartTooltip();

    const { width, height } = size;
    const formatValue = resolveFormat(valueFormat);
    const seriesKeys = series.map((entry) => entry.key);
    const categories = data.map((row) => String(row[xKey]));
    const isHorizontalBar = type === "bar" && layout === "horizontal";
    const interactive = isInteractive(interaction);
    const formatX = (value: string | number) =>
        resolvedXFormat ? resolvedXFormat(value) : String(value);

    const yValues = data
        .flatMap((row) => seriesKeys.map((key) => Number(row[key])))
        .filter((value) => Number.isFinite(value));
    const yAxisWidth = autoAxisWidth(yValues, formatValue);

    const margin = isHorizontalBar
        ? { top: 8, right: 16, bottom: 26, left: 116 }
        : { top: 10, right: 14, bottom: 26, left: yAxisWidth };
    const innerW = Math.max(0, width - margin.left - margin.right);
    const innerH = Math.max(0, height - margin.top - margin.bottom);

    if (innerW <= 0 || innerH <= 0) return null;

    // Precompute stacked segments (value-space) when stacking is on.
    const stacks: StackSeg[][] = stacked
        ? data.map((row) => {
              let pos = 0;
              let neg = 0;
              return series.map((entry) => {
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

    const body = isHorizontalBar ? (
        <HorizontalBars
            data={data}
            categories={categories}
            series={series}
            colors={colors}
            stacks={stacks}
            stacked={stacked}
            innerW={innerW}
            innerH={innerH}
            theme={theme}
            showGrid={showGrid}
            formatValue={formatValue}
            formatX={formatX}
            interaction={interaction}
            reduce={Boolean(reduce)}
        />
    ) : (
        <VerticalPlot
            type={type}
            data={data}
            categories={categories}
            series={series}
            colors={colors}
            stacks={stacks}
            stacked={stacked}
            curve={curve}
            innerW={innerW}
            innerH={innerH}
            theme={theme}
            showGrid={showGrid}
            formatValue={formatValue}
            formatX={formatX}
            referenceLines={referenceLines}
            interaction={interaction}
            uid={uid}
            reduce={Boolean(reduce)}
            activeIndex={tooltip.state?.index ?? null}
        />
    );

    // Pointer hit-testing: map cursor → nearest category index.
    const onPointerMove = (event: React.PointerEvent<SVGRectElement>) => {
        const box = event.currentTarget.getBoundingClientRect();
        const localX = event.clientX - box.left;
        const localY = event.clientY - box.top;
        if (categories.length === 0) return;
        let bestIndex = 0;
        let bestDist = Number.POSITIVE_INFINITY;
        categories.forEach((_, index) => {
            const pos = isHorizontalBar
                ? categoryCenter(index, categories.length, innerH)
                : categoryCenter(index, categories.length, innerW);
            const cursor = isHorizontalBar ? localY : localX;
            const dist = Math.abs(pos - cursor);
            if (dist < bestDist) {
                bestDist = dist;
                bestIndex = index;
            }
        });
        const anchorX = isHorizontalBar
            ? margin.left + localX
            : margin.left + categoryCenter(bestIndex, categories.length, innerW);
        const anchorY = isHorizontalBar
            ? margin.top + categoryCenter(bestIndex, categories.length, innerH)
            : margin.top + localY;
        tooltip.show(bestIndex, anchorX, anchorY);
    };

    const onClick = () => {
        if (!interactive || tooltip.state == null) return;
        interaction.onSelect?.(categories[tooltip.state.index]);
    };

    const active = tooltip.state;
    const payload =
        active != null
            ? series.map((entry, index) => ({
                  name: entry.label ?? entry.key,
                  dataKey: entry.key,
                  value: Number(data[active.index]?.[entry.key]),
                  color: colors[index],
              }))
            : [];

    return (
        <>
            <svg
                width={width}
                height={height}
                role="img"
                className="overflow-visible"
            >
                <g transform={`translate(${margin.left},${margin.top})`}>
                    {body}
                    {/* Active cursor highlight. */}
                    {active != null && !isHorizontalBar && (
                        <line
                            x1={categoryCenter(
                                active.index,
                                categories.length,
                                innerW,
                            )}
                            x2={categoryCenter(
                                active.index,
                                categories.length,
                                innerW,
                            )}
                            y1={0}
                            y2={innerH}
                            stroke={theme.cursor}
                            strokeDasharray="3 3"
                        />
                    )}
                    {/* Pointer capture surface (on top). */}
                    <rect
                        x={0}
                        y={0}
                        width={innerW}
                        height={innerH}
                        fill="transparent"
                        style={{ cursor: interactive ? "pointer" : "default" }}
                        onPointerMove={onPointerMove}
                        onPointerLeave={tooltip.hide}
                        onClick={onClick}
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
                        labelFormat={resolvedXFormat}
                    />
                </div>
            )}
        </>
    );
}

/** Center pixel of the Nth of `count` evenly-spaced categories across `span`. */
function categoryCenter(index: number, count: number, span: number): number {
    if (count <= 0) return 0;
    return ((index + 0.5) / count) * span;
}

/* --------------------------- Vertical line/area/bar --------------------------- */

interface VerticalPlotProps {
    type: "line" | "area" | "bar";
    data: Array<Record<string, unknown>>;
    categories: string[];
    series: SeriesConfig[];
    colors: string[];
    stacks: StackSeg[][];
    stacked?: boolean;
    curve: CurveType;
    innerW: number;
    innerH: number;
    theme: ChartTheme;
    showGrid: boolean;
    formatValue: (value: number) => string;
    formatX: (value: string | number) => string;
    referenceLines?: ReadonlyArray<{ y: number; label?: string }>;
    interaction: MarkInteraction;
    uid: string;
    reduce: boolean;
    activeIndex: number | null;
}

function VerticalPlot({
    type,
    data,
    categories,
    series,
    colors,
    stacks,
    stacked,
    curve,
    innerW,
    innerH,
    theme,
    showGrid,
    formatValue,
    formatX,
    referenceLines,
    interaction,
    uid,
    reduce,
    activeIndex,
}: VerticalPlotProps) {
    const seriesKeys = series.map((entry) => entry.key);
    const yScale = linearScale(
        valueDomain(data, seriesKeys, { stacked }),
        [innerH, 0],
    );
    const yTicks = linearTicks(yScale, 5);
    const baseline = yScale(0);

    const xBand = bandScale(categories, innerW);
    const xPoint = pointScale(categories, innerW);
    const centerX = (index: number) =>
        type === "bar"
            ? (xBand(categories[index]) ?? 0) + xBand.bandwidth() / 2
            : (xPoint(categories[index]) ?? 0);

    const keptXTicks = thinTicksByWidth(
        categories.map((label, index) => ({
            key: `${label}-${index}`,
            label: formatX(label),
            pos: centerX(index),
        })),
    );

    return (
        <>
            {showGrid && (
                <GridRows
                    positions={yTicks.map((tick) => yScale(tick))}
                    left={0}
                    right={innerW}
                    theme={theme}
                />
            )}
            <AxisLeft
                ticks={yTicks.map((tick) => ({
                    key: String(tick),
                    label: formatValue(tick),
                    pos: yScale(tick),
                }))}
                right={0}
                theme={theme}
            />
            <AxisBottom ticks={keptXTicks} top={innerH} theme={theme} />

            {referenceLines?.map((ref, index) => (
                <g key={`ref-${index}`}>
                    <line
                        x1={0}
                        x2={innerW}
                        y1={yScale(ref.y)}
                        y2={yScale(ref.y)}
                        stroke={theme.reference}
                        strokeDasharray="4 4"
                        strokeOpacity={0.7}
                    />
                    {ref.label && (
                        <text
                            x={innerW}
                            y={yScale(ref.y) - 4}
                            textAnchor="end"
                            fontSize={11}
                            fill={theme.foregroundMuted}
                        >
                            {ref.label}
                        </text>
                    )}
                </g>
            ))}

            {type === "bar"
                ? series.map((entry, si) => {
                      const groupW = xBand.bandwidth();
                      const barW = stacked ? groupW : groupW / series.length;
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
                                          initial={
                                              reduce
                                                  ? false
                                                  : { y: baseline, height: 0 }
                                          }
                                          animate={{ y: yTop, height: barH }}
                                          transition={{
                                              duration: 0.5,
                                              ease: "easeOut",
                                              delay: i * 0.012,
                                          }}
                                          opacity={markOpacity(
                                              categories[i],
                                              interaction,
                                          )}
                                      />
                                  );
                              })}
                          </g>
                      );
                  })
                : series.map((entry, si) => {
                      const points = data.map(
                          (row, i) =>
                              [centerX(i), yScale(Number(row[entry.key]))] as [
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

                      let areaPath = "";
                      if (type === "area") {
                          if (stacked) {
                              const areaGen = d3Area<number>()
                                  .defined((i) =>
                                      Number.isFinite(Number(data[i][entry.key])),
                                  )
                                  .x((i) => centerX(i))
                                  .y0((i) => yScale(stacks[i][si].lo))
                                  .y1((i) => yScale(stacks[i][si].hi))
                                  .curve(curveFactory(curve));
                              areaPath = areaGen(data.map((_, i) => i)) ?? "";
                          } else {
                              const areaGen = d3Area<[number, number]>()
                                  .defined((point) => Number.isFinite(point[1]))
                                  .x((point) => point[0])
                                  .y0(baseline)
                                  .y1((point) => point[1])
                                  .curve(curveFactory(curve));
                              areaPath = areaGen(points) ?? "";
                          }
                      }

                      const gradientId = `${uid}-grad-${si}`;
                      return (
                          <g key={entry.key}>
                              {type === "area" && (
                                  <>
                                      <defs>
                                          <linearGradient
                                              id={gradientId}
                                              x1="0"
                                              y1="0"
                                              x2="0"
                                              y2="1"
                                          >
                                              <stop
                                                  offset="0%"
                                                  stopColor={colors[si]}
                                                  stopOpacity={0.3}
                                              />
                                              <stop
                                                  offset="100%"
                                                  stopColor={colors[si]}
                                                  stopOpacity={0.02}
                                              />
                                          </linearGradient>
                                      </defs>
                                      <motion.path
                                          d={areaPath}
                                          fill={`url(#${gradientId})`}
                                          initial={
                                              reduce ? false : { opacity: 0 }
                                          }
                                          animate={{ opacity: 1 }}
                                          transition={{ duration: 0.5 }}
                                      />
                                  </>
                              )}
                              <motion.path
                                  d={linePath}
                                  fill="none"
                                  stroke={colors[si]}
                                  strokeWidth={2}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  initial={
                                      reduce ? false : { pathLength: 0 }
                                  }
                                  animate={{ pathLength: 1 }}
                                  transition={{ duration: 0.7, ease: "easeInOut" }}
                              />
                              {activeIndex != null &&
                                  Number.isFinite(
                                      Number(data[activeIndex]?.[entry.key]),
                                  ) && (
                                      <circle
                                          cx={centerX(activeIndex)}
                                          cy={yScale(
                                              Number(data[activeIndex][entry.key]),
                                          )}
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

/* ------------------------------ Horizontal bars ------------------------------ */

interface HorizontalBarsProps {
    data: Array<Record<string, unknown>>;
    categories: string[];
    series: SeriesConfig[];
    colors: string[];
    stacks: StackSeg[][];
    stacked?: boolean;
    innerW: number;
    innerH: number;
    theme: ChartTheme;
    showGrid: boolean;
    formatValue: (value: number) => string;
    formatX: (value: string | number) => string;
    interaction: MarkInteraction;
    reduce: boolean;
}

function HorizontalBars({
    data,
    categories,
    series,
    colors,
    stacks,
    stacked,
    innerW,
    innerH,
    theme,
    showGrid,
    formatValue,
    formatX,
    interaction,
    reduce,
}: HorizontalBarsProps) {
    const seriesKeys = series.map((entry) => entry.key);
    const xScale = linearScale(
        valueDomain(data, seriesKeys, { stacked }),
        [0, innerW],
    );
    const xTicks = linearTicks(xScale, 5);
    const baseX = xScale(0);
    const yBand = bandScale(categories, innerH);

    return (
        <>
            {showGrid && (
                <GridColumns
                    positions={xTicks.map((tick) => xScale(tick))}
                    top={0}
                    bottom={innerH}
                    theme={theme}
                />
            )}
            <AxisBottom
                ticks={thinTicksByWidth(
                    xTicks.map((tick) => ({
                        key: String(tick),
                        label: formatValue(tick),
                        pos: xScale(tick),
                    })),
                )}
                top={innerH}
                theme={theme}
            />
            <AxisLeft
                ticks={categories.map((label, index) => ({
                    key: `${label}-${index}`,
                    label: formatX(label),
                    pos: (yBand(label) ?? 0) + yBand.bandwidth() / 2,
                }))}
                right={0}
                theme={theme}
            />
            {series.map((entry, si) => {
                const groupH = yBand.bandwidth();
                const barH = stacked ? groupH : groupH / series.length;
                return (
                    <g key={entry.key}>
                        {data.map((row, i) => {
                            const value = Number(row[entry.key]);
                            if (!Number.isFinite(value)) return null;
                            const slotY = yBand(categories[i]) ?? 0;
                            let y: number;
                            let x: number;
                            let barW: number;
                            if (stacked) {
                                const seg = stacks[i][si];
                                y = slotY;
                                x = xScale(seg.lo);
                                barW = Math.abs(xScale(seg.hi) - xScale(seg.lo));
                            } else {
                                y = slotY + si * barH;
                                x = Math.min(xScale(value), baseX);
                                barW = Math.abs(xScale(value) - baseX);
                            }
                            const radius = Math.min(4, barH / 2);
                            return (
                                <motion.rect
                                    key={i}
                                    y={y}
                                    height={Math.max(0, barH - 1)}
                                    x={x}
                                    rx={radius}
                                    fill={colors[si]}
                                    initial={
                                        reduce ? false : { width: 0 }
                                    }
                                    animate={{ width: barW }}
                                    transition={{
                                        duration: 0.5,
                                        ease: "easeOut",
                                        delay: i * 0.012,
                                    }}
                                    opacity={markOpacity(categories[i], interaction)}
                                />
                            );
                        })}
                    </g>
                );
            })}
        </>
    );
}

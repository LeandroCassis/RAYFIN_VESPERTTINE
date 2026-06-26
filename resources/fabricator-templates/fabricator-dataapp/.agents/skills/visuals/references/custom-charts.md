# Building a custom chart on the core

Use the core only when no kit card fits. Most dashboards should compose
`LineChartCard`, `BarChartCard`, `ComboChartCard`, `ScatterChartCard`,
`DonutChartCard`, etc. If you write the same custom chart twice, promote it
into the kit.

## Import surface

Public shell/theme imports come from the barrel: `ChartCard`, `ChartFrame`,
`ChartTooltip`, `useChartTheme`, `seriesColor`, `roleColor`, `useChartSize`,
and types `MarkInteraction`, `ChartSize`, `Margin`.

Advanced chart-core primitives live under `@/components/dashboard/charts/*`:

```tsx
import { AxisBottom, AxisLeft, type AxisTick } from "@/components/dashboard/charts/axis";
import { GridColumns, GridRows } from "@/components/dashboard/charts/grid";
import { bandScale, pointScale, linearScale, valueDomain, linearTicks, thinLabels, thinTicksByWidth, curveFactory } from "@/components/dashboard/charts/scales";
import { tooltipBoxStyle, useChartTooltip } from "@/components/dashboard/charts/tooltip";
import { isInteractive, isSelected, markOpacity } from "@/components/dashboard/charts/types";
import { arcCentroid, arcPath, compassToRadians, pieSlices } from "@/components/dashboard/charts/arc";
```

Axes, grids, scales, tooltip state helpers, arc helpers, and `markOpacity` are
advanced/internal subpath imports.

## Architecture

`ChartFrame` owns responsive measurement and legend. Its render prop receives
the measured plot box:

```tsx
<ChartCard title="Custom">
  <ChartFrame legend={[{ label: "Revenue", color: seriesColor(0) }]}>
    {({ width, height }) => <svg width={width} height={height} />}
  </ChartFrame>
</ChartCard>
```

Or use `useChartSize()` directly when you need your own wrapper. Canonical
example: `cartesian.tsx` composes margin → scales → grid → axes → marks →
tooltip → `MarkInteraction`.

## Lollipop chart example

A lollipop chart is a ranked bar with a line stem and circle mark. It is
responsive, themed, tooltip-enabled, and cross-filterable.

```tsx
import {
  ChartCard,
  ChartFrame,
  ChartTooltip,
  seriesColor,
  useChartTheme,
  type MarkInteraction,
} from "@/components/dashboard";
import { AxisBottom, AxisLeft } from "@/components/dashboard/charts/axis";
import { GridRows } from "@/components/dashboard/charts/grid";
import { bandScale, linearScale, linearTicks, thinTicksByWidth, valueDomain } from "@/components/dashboard/charts/scales";
import { tooltipBoxStyle, useChartTooltip } from "@/components/dashboard/charts/tooltip";
import { isInteractive, markOpacity } from "@/components/dashboard/charts/types";

interface LollipopChartCardProps extends MarkInteraction {
  title?: string;
  data: Array<Record<string, unknown>>;
  xKey: string;
  valueKey: string;
  valueFormat?: (value: number) => string;
}

export function LollipopChartCard(props: LollipopChartCardProps) {
  const color = seriesColor(0);
  return (
    <ChartCard title={props.title}>
      <ChartFrame legend={[{ label: props.valueKey, color }]}>
        {({ width, height }) => <LollipopPlot {...props} width={width} height={height} color={color} />}
      </ChartFrame>
    </ChartCard>
  );
}

function LollipopPlot({
  width,
  height,
  data,
  xKey,
  valueKey,
  color,
  valueFormat = (n) => new Intl.NumberFormat().format(n),
  selectedKeys,
  onSelect,
  dimUnselected,
}: LollipopChartCardProps & { width: number; height: number; color: string }) {
  const theme = useChartTheme();
  const tooltip = useChartTooltip();
  const interaction = { selectedKeys, onSelect, dimUnselected };
  const margin = { top: 10, right: 18, bottom: 28, left: 64 };
  const innerW = Math.max(0, width - margin.left - margin.right);
  const innerH = Math.max(0, height - margin.top - margin.bottom);
  const categories = data.map((row) => String(row[xKey]));
  const x = bandScale(categories, innerW, 0.36);
  const y = linearScale(valueDomain(data, [valueKey]), [innerH, 0]);
  const yTicks = linearTicks(y, 5);
  const xTicks = thinTicksByWidth(categories.map((label) => ({
    key: label,
    label,
    pos: (x(label) ?? 0) + x.bandwidth() / 2,
  })));
  const active = tooltip.state;
  const interactive = isInteractive(interaction);

  return (
    <>
      <svg width={width} height={height} role="img" className="overflow-visible">
        <g transform={`translate(${margin.left},${margin.top})`}>
          <GridRows positions={yTicks.map((tick) => y(tick))} left={0} right={innerW} theme={theme} />
          <AxisLeft ticks={yTicks.map((tick) => ({ key: String(tick), label: valueFormat(tick), pos: y(tick) }))} right={0} theme={theme} />
          <AxisBottom ticks={xTicks} top={innerH} theme={theme} />
          {data.map((row, index) => {
            const key = String(row[xKey]);
            const value = Number(row[valueKey]);
            if (!Number.isFinite(value)) return null;
            const cx = (x(key) ?? 0) + x.bandwidth() / 2;
            const cy = y(value);
            return (
              <g
                key={key}
                opacity={markOpacity(key, interaction)}
                onPointerEnter={() => tooltip.show(index, margin.left + cx, margin.top + cy)}
                onPointerLeave={tooltip.hide}
                onClick={() => onSelect?.(key)}
                style={{ cursor: interactive ? "pointer" : "default" }}
              >
                <line x1={cx} x2={cx} y1={y(0)} y2={cy} stroke={color} strokeWidth={2} />
                <circle cx={cx} cy={cy} r={5} fill={color} stroke={theme.surface} strokeWidth={2} />
              </g>
            );
          })}
        </g>
      </svg>
      {active != null && data[active.index] && (
        <div style={tooltipBoxStyle(active.x, active.y, width)}>
          <ChartTooltip
            active
            label={String(data[active.index][xKey])}
            payload={[{ name: valueKey, dataKey: valueKey, value: Number(data[active.index][valueKey]), color }]}
            valueFormat={valueFormat}
          />
        </div>
      )}
    </>
  );
}
```

Wire it to shared cross-filter state exactly like a kit cartesian chart:

```tsx
import { useCrossFilter } from "@/components/dashboard";

const cross = useCrossFilter("Product[Category]");
<LollipopChartCard data={rows} xKey="Category" valueKey="Revenue" {...cross} />;
```

## Core checklist

- Size with `ChartFrame` or `useChartSize`; never hard-code width.
- Use `useChartTheme()` for axis/grid/text colors and `seriesColor`/`roleColor`
  for marks.
- Use `ChartTooltip` with `useChartTooltip()` + `tooltipBoxStyle(...)`.
- Accept `MarkInteraction` (`selectedKeys`, `onSelect`, `dimUnselected`) and
  apply `markOpacity(...)` to every selectable mark.
- If the chart belongs in most apps, add it to the kit and export it from the
  barrel. Otherwise keep it as a local escape hatch and cross-link back to the
  visuals `SKILL.md` Escape hatch.

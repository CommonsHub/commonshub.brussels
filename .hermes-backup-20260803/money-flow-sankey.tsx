import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface MoneyFlowBreakdownRow {
  key: string;
  label: string;
  income: number;
  expenses: number;
  net: number;
}

interface SankeyNode {
  id: string;
  label: string;
  value: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  textAnchor: "start" | "middle" | "end";
}

interface SankeyLink {
  id: string;
  from: SankeyNode;
  to: SankeyNode;
  value: number;
  width: number;
  color: string;
  offsetFrom: number;
  offsetTo: number;
  label?: string;
}

interface MoneyFlowSankeyProps {
  income: number;
  expenses: number;
  net: number;
  incomeBreakdown?: MoneyFlowBreakdownRow[];
  expenseBreakdown?: MoneyFlowBreakdownRow[];
  openingBalance?: number | null;
  closingBalance?: number | null;
  title?: string;
}

const SVG_WIDTH = 980;
const SVG_HEIGHT = 500;
const NODE_WIDTH = 24;
const MIN_NODE_HEIGHT = 24;
const MAX_NODE_HEIGHT = 230;
const MIN_LINK_WIDTH = 6;
const MAX_LINK_WIDTH = 64;

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function compactCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function sanitizeRows(rows: MoneyFlowBreakdownRow[] | undefined, side: "income" | "expenses") {
  return (rows ?? [])
    .map((row) => ({
      id: row.key,
      label: row.label,
      value: side === "income" ? row.income : row.expenses,
    }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value);
}

function topRowsWithOther(
  rows: Array<{ id: string; label: string; value: number }>,
  total: number,
  fallbackLabel: string
) {
  if (!rows.length && total > 0) {
    return [{ id: fallbackLabel.toLowerCase(), label: fallbackLabel, value: total }];
  }

  const topRows = rows.slice(0, 6);
  const remainder = Math.max(0, total - topRows.reduce((sum, row) => sum + row.value, 0));
  if (remainder > 0.5) {
    topRows.push({ id: `${fallbackLabel.toLowerCase()}-other`, label: "Other", value: remainder });
  }
  return topRows;
}

function stackNodes(
  rows: Array<{ id: string; label: string; value: number }>,
  x: number,
  color: string,
  textAnchor: "start" | "middle" | "end",
  total: number,
  top = 92,
  availableHeight = 315
): SankeyNode[] {
  if (!rows.length) return [];

  const gap = rows.length > 5 ? 11 : 15;
  const maxValue = Math.max(...rows.map((row) => row.value), 1);
  const scale = Math.min(MAX_NODE_HEIGHT / maxValue, availableHeight / Math.max(total, 1));
  const heights = rows.map((row) => Math.max(MIN_NODE_HEIGHT, row.value * scale));
  const totalHeight = heights.reduce((sum, height) => sum + height, 0) + gap * (rows.length - 1);
  let y = top + Math.max(0, (availableHeight - totalHeight) / 2);

  return rows.map((row, index) => {
    const node: SankeyNode = {
      id: row.id,
      label: row.label,
      value: row.value,
      x,
      y,
      width: NODE_WIDTH,
      height: heights[index],
      color,
      textAnchor,
    };
    y += heights[index] + gap;
    return node;
  });
}

function linkPath(link: SankeyLink) {
  const sourceX = link.from.x + link.from.width;
  const sourceY = link.from.y + link.offsetFrom;
  const targetX = link.to.x;
  const targetY = link.to.y + link.offsetTo;
  const controlPadding = Math.max(105, (targetX - sourceX) * 0.52);
  return `M ${sourceX} ${sourceY} C ${sourceX + controlPadding} ${sourceY}, ${targetX - controlPadding} ${targetY}, ${targetX} ${targetY}`;
}

function buildLinks(
  incomeNodes: SankeyNode[],
  expenseNodes: SankeyNode[],
  treasury: SankeyNode,
  closingNode: SankeyNode | null,
  total: number
): SankeyLink[] {
  const scaleWidth = (value: number) => Math.max(MIN_LINK_WIDTH, Math.min(MAX_LINK_WIDTH, (value / Math.max(total, 1)) * 92));
  let treasuryIncomeOffset = 12;
  let treasuryExpenseOffset = 12;

  const incomeLinks = incomeNodes.map((node) => {
    const width = scaleWidth(node.value);
    const link: SankeyLink = {
      id: `income-${node.id}`,
      from: node,
      to: treasury,
      value: node.value,
      width,
      color: node.id === "opening-balance" ? "url(#opening-flow)" : "url(#income-flow)",
      offsetFrom: node.height / 2,
      offsetTo: Math.min(treasury.height - 10, treasuryIncomeOffset + width / 2),
    };
    treasuryIncomeOffset += width + 6;
    return link;
  });

  const outgoingNodes = closingNode ? [...expenseNodes, closingNode] : expenseNodes;
  const expenseLinks = outgoingNodes.map((node) => {
    const width = scaleWidth(node.value);
    const link: SankeyLink = {
      id: `out-${node.id}`,
      from: treasury,
      to: node,
      value: node.value,
      width,
      color: node === closingNode ? "url(#closing-flow)" : "url(#expense-flow)",
      offsetFrom: Math.min(treasury.height - 10, treasuryExpenseOffset + width / 2),
      offsetTo: node.height / 2,
    };
    treasuryExpenseOffset += width + 6;
    return link;
  });

  return [...incomeLinks, ...expenseLinks];
}

function truncateLabel(label: string, length = 26) {
  return label.length > length ? `${label.slice(0, length - 1)}…` : label;
}

export function MoneyFlowSankey({
  income,
  expenses,
  net,
  incomeBreakdown,
  expenseBreakdown,
  openingBalance,
  closingBalance,
  title = "Money Flow",
}: MoneyFlowSankeyProps) {
  const inferredOpening = openingBalance ?? Math.max(0, (closingBalance ?? 0) - net);
  const inferredClosing = closingBalance ?? Math.max(0, inferredOpening + net);
  const openingTopUp = Math.max(0, expenses + inferredClosing - income);
  const closingFlow = Math.max(0, income + openingTopUp - expenses);
  const totalThroughTreasury = Math.max(income + openingTopUp, expenses + closingFlow, 1);

  const incomeRows = topRowsWithOther(sanitizeRows(incomeBreakdown, "income"), income, "Income");
  const inflowRows = openingTopUp > 0.5
    ? [{ id: "opening-balance", label: "Opening balance used", value: openingTopUp }, ...incomeRows]
    : incomeRows;
  const expenseRows = topRowsWithOther(sanitizeRows(expenseBreakdown, "expenses"), expenses, "Expenses");

  const incomeNodes = stackNodes(inflowRows, 74, "#16a34a", "start", Math.max(income + openingTopUp, 1)).map((node) =>
    node.id === "opening-balance" ? { ...node, color: "#f59e0b" } : node
  );
  const expenseNodes = stackNodes(expenseRows, 800, "#dc2626", "end", Math.max(expenses, 1));
  const treasuryHeight = Math.max(130, Math.min(285, totalThroughTreasury / Math.max(totalThroughTreasury, 1) * 260));
  const treasury: SankeyNode = {
    id: "treasury",
    label: "Commons Hub treasury",
    value: totalThroughTreasury,
    x: 478,
    y: (SVG_HEIGHT - treasuryHeight) / 2,
    width: 34,
    height: treasuryHeight,
    color: "#2563eb",
    textAnchor: "middle",
  };
  const closingNode: SankeyNode | null = closingFlow > 0.5 ? {
    id: "closing-balance",
    label: "Closing balance",
    value: closingFlow,
    x: 800,
    y: 418,
    width: NODE_WIDTH,
    height: Math.max(MIN_NODE_HEIGHT, Math.min(88, (closingFlow / totalThroughTreasury) * 190)),
    color: "#2563eb",
    textAnchor: "end",
  } : null;

  const links = buildLinks(incomeNodes, expenseNodes, treasury, closingNode, totalThroughTreasury);
  const allNodes = [...incomeNodes, treasury, ...expenseNodes, ...(closingNode ? [closingNode] : [])];

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-linear-to-r from-slate-50 to-transparent dark:from-slate-900/50">
        <CardTitle>{title}</CardTitle>
        <CardDescription>Where money came from, how it moved through the Commons Hub treasury, and where it went.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/60 dark:bg-amber-950/20">
            <div className="text-muted-foreground">Started with</div>
            <div className="text-lg font-bold text-amber-700 dark:text-amber-300">{formatCurrency(inferredOpening)}</div>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50 p-3 dark:border-green-900/60 dark:bg-green-950/20">
            <div className="text-muted-foreground">Income</div>
            <div className="text-lg font-bold text-green-700 dark:text-green-300">{formatCurrency(income)}</div>
          </div>
          <div className="rounded-xl border bg-background p-3 shadow-xs">
            <div className="text-muted-foreground">Net change</div>
            <div className={`text-lg font-bold ${net >= 0 ? "text-green-600" : "text-red-600"}`}>
              {net >= 0 ? "+" : ""}{formatCurrency(net)}
            </div>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/60 dark:bg-red-950/20">
            <div className="text-muted-foreground">Expenses</div>
            <div className="text-lg font-bold text-red-700 dark:text-red-300">{formatCurrency(expenses)}</div>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-900/60 dark:bg-blue-950/20">
            <div className="text-muted-foreground">Ended with</div>
            <div className="text-lg font-bold text-blue-700 dark:text-blue-300">{formatCurrency(inferredClosing)}</div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border bg-linear-to-br from-white via-slate-50 to-slate-100 p-3 shadow-inner dark:from-slate-950 dark:via-slate-950 dark:to-slate-900" role="img" aria-label={`Money flow Sankey diagram showing ${formatCurrency(income)} income and ${formatCurrency(expenses)} expenses`}>
          <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="h-[500px] min-w-[820px] w-full" aria-hidden="true">
            <defs>
              <linearGradient id="income-flow" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#22c55e" stopOpacity="0.72" />
                <stop offset="100%" stopColor="#2563eb" stopOpacity="0.42" />
              </linearGradient>
              <linearGradient id="expense-flow" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#2563eb" stopOpacity="0.42" />
                <stop offset="100%" stopColor="#ef4444" stopOpacity="0.70" />
              </linearGradient>
              <linearGradient id="opening-flow" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.74" />
                <stop offset="100%" stopColor="#2563eb" stopOpacity="0.38" />
              </linearGradient>
              <linearGradient id="closing-flow" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#2563eb" stopOpacity="0.38" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.72" />
              </linearGradient>
              <filter id="sankey-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity="0.18" />
              </filter>
              <pattern id="sankey-grid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M 32 0 L 0 0 0 32" fill="none" stroke="currentColor" strokeOpacity="0.05" strokeWidth="1" />
              </pattern>
            </defs>

            <rect width={SVG_WIDTH} height={SVG_HEIGHT} rx="18" fill="url(#sankey-grid)" className="text-slate-900 dark:text-white" />
            <text x="76" y="42" className="fill-muted-foreground text-[12px] font-semibold uppercase tracking-[0.2em]">Sources</text>
            <text x="495" y="42" textAnchor="middle" className="fill-muted-foreground text-[12px] font-semibold uppercase tracking-[0.2em]">Treasury</text>
            <text x="824" y="42" textAnchor="end" className="fill-muted-foreground text-[12px] font-semibold uppercase tracking-[0.2em]">Uses</text>

            {links.map((link) => (
              <g key={link.id}>
                <path
                  d={linkPath(link)}
                  fill="none"
                  stroke="rgba(15, 23, 42, 0.10)"
                  strokeWidth={link.width + 4}
                  strokeLinecap="round"
                />
                <path
                  d={linkPath(link)}
                  fill="none"
                  stroke={link.color}
                  strokeWidth={link.width}
                  strokeLinecap="round"
                >
                  <title>{`${link.from.label} → ${link.to.label}: ${formatCurrency(link.value)}`}</title>
                </path>
              </g>
            ))}

            {allNodes.map((node) => {
              const labelX = node.textAnchor === "start" ? node.x + node.width + 12 : node.textAnchor === "end" ? node.x - 12 : node.x + node.width / 2;
              const labelY = node.id === "treasury" ? node.y + node.height / 2 - 12 : node.y + node.height / 2 - 6;
              return (
                <g key={node.id} filter="url(#sankey-shadow)">
                  <rect x={node.x} y={node.y} width={node.width} height={node.height} rx="10" fill={node.color} />
                  <rect x={node.x + 3} y={node.y + 3} width={Math.max(1, node.width - 6)} height={Math.max(1, node.height - 6)} rx="7" fill="white" opacity="0.16" />
                  <text
                    x={labelX}
                    y={labelY}
                    textAnchor={node.textAnchor}
                    className="fill-foreground text-[13px] font-semibold"
                  >
                    {truncateLabel(node.label, node.id === "treasury" ? 30 : 28)}
                  </text>
                  <text
                    x={labelX}
                    y={labelY + 19}
                    textAnchor={node.textAnchor}
                    className="fill-muted-foreground text-[12px] font-medium"
                  >
                    {compactCurrency(node.value)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}

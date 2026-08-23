import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPesos } from "@/lib/money";

export interface CashFlowGroupRow {
  groupId: string;
  groupLabel: string;
  programado: string[];
  real: string[];
  balance: string[];
}

export interface TopContractRow {
  groupLabel: string;
  companyName: string;
  contractLabel: string;
  montoMdpLabel: string;
}

function Section({
  title,
  monthLabels,
  groups,
  seriesKey,
  monthlyTotal,
  acumulado,
}: {
  title: string;
  monthLabels: string[];
  groups: CashFlowGroupRow[];
  seriesKey: "programado" | "real" | "balance";
  monthlyTotal: string[];
  acumulado: string[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-background">Grupo</TableHead>
              {monthLabels.map((m) => (
                <TableHead key={m} className="text-right">
                  {m}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((g) => (
              <TableRow key={g.groupId}>
                <TableCell className="sticky left-0 bg-background font-medium">
                  {g.groupLabel}
                </TableCell>
                {g[seriesKey].map((v, i) => (
                  <TableCell key={i} className="text-right whitespace-nowrap">
                    {formatPesos(v)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            <TableRow className="font-medium">
              <TableCell className="sticky left-0 bg-background">
                {title.startsWith("A") ? "Programado mensual" : title.startsWith("B") ? "Real mensual" : "Balance mensual"}
              </TableCell>
              {monthlyTotal.map((v, i) => (
                <TableCell key={i} className="text-right whitespace-nowrap">
                  {formatPesos(v)}
                </TableCell>
              ))}
            </TableRow>
            <TableRow className="text-muted-foreground">
              <TableCell className="sticky left-0 bg-background">Acumulado</TableCell>
              {acumulado.map((v, i) => (
                <TableCell key={i} className="text-right whitespace-nowrap">
                  {formatPesos(v)}
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function CashFlowSummary({
  monthLabels,
  groups,
  totals,
  topContracts,
}: {
  monthLabels: string[];
  groups: CashFlowGroupRow[];
  totals: {
    programado: string[];
    real: string[];
    balance: string[];
    programadoAcumulado: string[];
    realAcumulado: string[];
    balanceAcumulado: string[];
  };
  topContracts: TopContractRow[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Resumen Cash Flow</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-w-0 flex-col gap-6">
            <Section
              title="A. Programado"
              monthLabels={monthLabels}
              groups={groups}
              seriesKey="programado"
              monthlyTotal={totals.programado}
              acumulado={totals.programadoAcumulado}
            />
            <Section
              title="B. Real"
              monthLabels={monthLabels}
              groups={groups}
              seriesKey="real"
              monthlyTotal={totals.real}
              acumulado={totals.realAcumulado}
            />
            <Section
              title="C. Balance"
              monthLabels={monthLabels}
              groups={groups}
              seriesKey="balance"
              monthlyTotal={totals.balance}
              acumulado={totals.balanceAcumulado}
            />
            <p className="text-muted-foreground text-xs">
              &quot;Real&quot; y &quot;Balance&quot; muestran $0 hasta construir el módulo de
              Inversión Real (facturas/estimaciones/anticipos).
            </p>
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <h3 className="text-sm font-semibold">Montos más representativos</h3>
            <div className="flex flex-col divide-y rounded-md border">
              {topContracts.length === 0 && (
                <p className="text-muted-foreground p-3 text-center text-sm">Sin datos.</p>
              )}
              {topContracts.map((row, i) => (
                <div key={i} className="flex flex-col gap-0.5 p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-medium">{row.groupLabel}</span>
                    <span className="text-sm font-semibold whitespace-nowrap">
                      {row.montoMdpLabel}
                    </span>
                  </div>
                  <div className="text-xs">{row.companyName}</div>
                  <div className="text-muted-foreground text-xs">{row.contractLabel}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

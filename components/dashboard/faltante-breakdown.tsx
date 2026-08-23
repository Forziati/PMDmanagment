import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FaltanteDonutChart, type DonutSlice } from "@/components/charts/faltante-donut-chart";

export interface DonutBreakdownRow {
  concept: string;
  months: string[];
  total: string;
}

export function FaltanteBreakdown({
  slices,
  breakdown,
  monthLabels,
}: {
  slices: DonutSlice[];
  breakdown: DonutBreakdownRow[];
  monthLabels: string[];
}) {
  const total = slices.reduce((acc, s) => acc + s.valueMdp, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Desglose del faltante</CardTitle>
        <CardDescription>
          Producción contratada / por licitar según la etapa del contrato; anticipo y OENE según
          los saldos capturados en cada contrato (PPTX de GAP, slide 6).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {slices.length === 0 || monthLabels.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No quedan meses por venir en el año seleccionado, o no hay datos programados.
          </p>
        ) : (
          <>
            <FaltanteDonutChart slices={slices} />
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Concepto</TableHead>
                    {monthLabels.map((m) => (
                      <TableHead key={m} className="text-right">
                        {m}
                      </TableHead>
                    ))}
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {breakdown.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="max-w-56 truncate" title={row.concept}>
                        {row.concept}
                      </TableCell>
                      {row.months.map((m, j) => (
                        <TableCell key={j} className="text-right whitespace-nowrap">
                          {m}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-medium whitespace-nowrap">
                        {row.total}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-muted-foreground text-xs">
              Total del faltante mostrado en la dona: ${total.toLocaleString("es-MX", { maximumFractionDigits: 2 })} MDP.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

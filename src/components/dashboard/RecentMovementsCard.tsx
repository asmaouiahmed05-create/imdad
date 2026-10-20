import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const dateFormatter = new Intl.DateTimeFormat("ar-DZ", {
  dateStyle: "medium",
  timeStyle: "short",
});

export async function RecentMovementsCard() {
  const movements = await prisma.stockMovement.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      type: true,
      quantity: true,
      reason: true,
      reference: true,
      createdAt: true,
      product: { select: { name: true, unit: true } },
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>آخر حركات المخزون</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>التاريخ</TableHead>
              <TableHead>المنتج</TableHead>
              <TableHead>النوع</TableHead>
              <TableHead>الكمية</TableHead>
              <TableHead>السبب / المرجع</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  لا توجد حركات بعد
                </TableCell>
              </TableRow>
            ) : (
              movements.map((m) => {
                const isIn = m.type === "IN";
                return (
                  <TableRow key={m.id}>
                    <TableCell>{dateFormatter.format(m.createdAt)}</TableCell>
                    <TableCell className="font-medium">{m.product.name}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          isIn
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                            : "border-amber-500/30 bg-amber-500/10 text-amber-400"
                        }
                      >
                        {isIn ? "استلام" : "صرف"}
                      </Badge>
                    </TableCell>
                    <TableCell className={isIn ? "text-emerald-400" : "text-amber-400"}>
                      {isIn ? "+" : "-"}
                      {m.quantity} {m.product.unit}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {[m.reason, m.reference].filter(Boolean).join(" · ") || "—"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

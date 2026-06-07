"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, Eye, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { salaryService } from "@/src/services/salaryService";
import { toast } from "sonner";

interface PayrollRunHistoryItem {
    _id: string;
    month: number;
    year: number;
    status: "Draft" | "Finalized" | "Paid" | "Cancelled";
    totals?: {
        employees?: number;
        baseSalary?: number;
        earned?: number;
        paid?: number;
        pending?: number;
        workingDays?: number;
    };
    createdAt?: string;
    finalizedAt?: string;
}

const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const formatCurrency = (value = 0) => new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
}).format(value);

const statusStyle: Record<PayrollRunHistoryItem["status"], string> = {
    Draft: "bg-amber-50 text-amber-700 border-amber-200",
    Finalized: "bg-red-50 text-red-700 border-red-200",
    Paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Cancelled: "bg-slate-100 text-slate-600 border-slate-200"
};

export default function PayrollHistoryPage() {
    const router = useRouter();
    const [runs, setRuns] = useState<PayrollRunHistoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");

    useEffect(() => {
        salaryService.listPayrollRuns()
            .then((res) => {
                setRuns(res.data || []);
            })
            .catch((error) => {
                toast.error(error?.response?.data?.message || "Failed to fetch payroll history");
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, []);

    const filteredRuns = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase();

        return runs.filter((run) => {
            const matchesStatus = statusFilter === "All" || run.status === statusFilter;
            const label = `${monthNames[run.month - 1]} ${run.year} ${run.status}`.toLowerCase();
            const matchesSearch = !normalizedSearch || label.includes(normalizedSearch);
            return matchesStatus && matchesSearch;
        });
    }, [runs, search, statusFilter]);

    const totals = useMemo(() => {
        return filteredRuns.reduce((acc, run) => {
            acc.runs += 1;
            acc.employees = Math.max(acc.employees, run.totals?.employees || 0);
            acc.earned += run.totals?.earned || 0;
            acc.paid += run.totals?.paid || 0;
            acc.pending += run.totals?.pending || 0;
            return acc;
        }, { runs: 0, employees: 0, earned: 0, paid: 0, pending: 0 });
    }, [filteredRuns]);

    return (
        <div className="flex h-[calc(100vh-2rem)] flex-col gap-5">
            <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="icon" className="h-9 w-9 rounded-md" asChild>
                        <Link href="/superadmin/payroll">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Payroll History</h1>
                        <p className="text-xs text-muted-foreground">Saved monthly salary snapshots and payment status.</p>
                    </div>
                </div>
                <Button asChild className="rounded-md font-semibold">
                    <Link href="/superadmin/payroll">Current Payroll</Link>
                </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <Card className="rounded-lg py-0">
                    <CardContent className="p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Runs</p>
                        <p className="mt-1 text-2xl font-black text-foreground">{totals.runs}</p>
                    </CardContent>
                </Card>
                <Card className="rounded-lg py-0">
                    <CardContent className="p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Employees</p>
                        <p className="mt-1 text-2xl font-black text-blue-600">{totals.employees}</p>
                    </CardContent>
                </Card>
                <Card className="rounded-lg py-0">
                    <CardContent className="p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Calculated</p>
                        <p className="mt-1 text-2xl font-black text-amber-600">{formatCurrency(totals.earned)}</p>
                    </CardContent>
                </Card>
                <Card className="rounded-lg py-0">
                    <CardContent className="p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Paid</p>
                        <p className="mt-1 text-2xl font-black text-emerald-600">{formatCurrency(totals.paid)}</p>
                    </CardContent>
                </Card>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card shadow-sm">
                <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
                    <div className="relative w-full md:max-w-sm">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search month or status..."
                            className="h-10 rounded-md pl-9"
                        />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-10 w-full rounded-md md:w-[220px]">
                            <SelectValue placeholder="Filter status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All Status</SelectItem>
                            <SelectItem value="Draft">Draft</SelectItem>
                            <SelectItem value="Finalized">Finalized</SelectItem>
                            <SelectItem value="Paid">Paid</SelectItem>
                            <SelectItem value="Cancelled">Cancelled</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="min-h-0 flex-1 overflow-auto">
                    <Table>
                        <TableHeader className="sticky top-0 bg-muted/50">
                            <TableRow>
                                <TableHead className="pl-5">Month</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Employees</TableHead>
                                <TableHead className="text-right">Calculated</TableHead>
                                <TableHead className="text-right">Paid</TableHead>
                                <TableHead className="text-right">Pending</TableHead>
                                <TableHead className="text-right pr-5">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Loading payroll history...</TableCell>
                                </TableRow>
                            ) : filteredRuns.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No payroll snapshots found.</TableCell>
                                </TableRow>
                            ) : filteredRuns.map((run) => (
                                <TableRow
                                    key={run._id}
                                    className="cursor-pointer"
                                    onClick={() => router.push(`/superadmin/payroll/history/${run._id}`)}
                                >
                                    <TableCell className="pl-5">
                                        <div className="flex items-center gap-2">
                                            <CalendarDays className="h-4 w-4 text-primary" />
                                            <div>
                                                <p className="font-bold text-foreground">{monthNames[run.month - 1]} {run.year}</p>
                                                <p className="text-[10px] font-medium text-muted-foreground">
                                                    {run.finalizedAt ? `Finalized ${new Date(run.finalizedAt).toLocaleDateString("en-IN")}` : "Not finalized"}
                                                </p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={`rounded-md font-bold ${statusStyle[run.status]}`}>
                                            {run.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-bold">{run.totals?.employees || 0}</TableCell>
                                    <TableCell className="text-right font-bold text-amber-600">{formatCurrency(run.totals?.earned || 0)}</TableCell>
                                    <TableCell className="text-right font-bold text-emerald-600">{formatCurrency(run.totals?.paid || 0)}</TableCell>
                                    <TableCell className="text-right font-bold text-red-600">{formatCurrency(run.totals?.pending || 0)}</TableCell>
                                    <TableCell className="text-right pr-5">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 gap-2 rounded-md"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                router.push(`/superadmin/payroll/history/${run._id}`);
                                            }}
                                        >
                                            <Eye className="h-4 w-4" />
                                            View
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}

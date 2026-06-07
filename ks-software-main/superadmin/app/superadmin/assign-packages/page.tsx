"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "@/src/redux/hooks";
import { fetchClients } from "@/src/redux/slices/clientSlice";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { AssignmentWizard } from "@/components/subscriptions/AssignmentWizard";
import { ChutakDialog } from "./components/ChutakDialog";
import { DataHandler } from "@/components/DataHandler";
import { Badge } from "@/components/ui/badge";
import { ChutakViewDialog } from "./components/ChutakViewDialog";
import { CreateChutakSaleDialog } from "./components/CreateChutakSaleDialog";
import { ClientExpandableDetails } from "./components/ClientExpandableDetails";
import { BillingDownloadDialog } from "./components/BillingDownloadDialog";
import { cn } from "@/lib/utils";
import { Client } from "@/lib/clientdata";
import { Subscription } from "@/lib/subscriptionData";

type ClientDisplaySubscription = {
    packageName?: string;
    status?: "Active" | "Completed" | "Cancelled";
};

type AssignClient = Omit<Client, "subscriptions"> & {
    subscriptions?: ClientDisplaySubscription[];
};

type ChutakSaleItem = {
    price?: number;
    [key: string]: unknown;
};

export default function AssignPackagesPage() {
    const dispatch = useAppDispatch();
    const { clients, isLoading } = useAppSelector((state) => state.clients);

    const [filter, setFilter] = useState("");
    const [activeTab, setActiveTab] = useState("fixed");

    const [assignWizardOpen, setAssignWizardOpen] = useState(false);
    const [chutakOpen, setChutakOpen] = useState(false);
    const [viewChutakOpen, setViewChutakOpen] = useState(false);
    const [createSaleOpen, setCreateSaleOpen] = useState(false);
    const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
    const [selectedClient, setSelectedClient] = useState<{ id: string; businessName: string } | null>(null);
    const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
    const [billingDownloadOpen, setBillingDownloadOpen] = useState(false);
    const [chutakItemsForSale, setChutakItemsForSale] = useState<ChutakSaleItem[]>([]);
    const [saleDateRange, setSaleDateRange] = useState<{ from: Date; to: Date } | null>(null);

    useEffect(() => {
        dispatch(fetchClients());
    }, [dispatch]);

    const fixedClients = useMemo(() => {
        return clients.filter((client) => {
            const search = filter.toLowerCase();
            return client.businessName?.toLowerCase().includes(search) ||
                client.name?.toLowerCase().includes(search);
        });
    }, [clients, filter]);

    const chutakClients = useMemo(() => {
        return clients.filter((client) => {
            if (!client.hasChutakItems) return false;

            const search = filter.toLowerCase();
            return client.businessName?.toLowerCase().includes(search) ||
                client.name?.toLowerCase().includes(search);
        });
    }, [clients, filter]);

    const toggleExpand = (clientId: string) => {
        setExpandedClientId(expandedClientId === clientId ? null : clientId);
    };

    const handleAssignFixed = (client?: AssignClient, subscription?: Subscription) => {
        setSelectedClient(client ? { id: client.id, businessName: client.businessName } : null);
        setEditingSubscription(subscription || null);
        setAssignWizardOpen(true);
    };

    const handleDownloadBilling = (client: AssignClient) => {
        setSelectedClient({ id: client.id, businessName: client.businessName });
        setBillingDownloadOpen(true);
    };

    const handleAddChutak = (client?: AssignClient) => {
        setSelectedClient(client ? { id: client.id, businessName: client.businessName } : null);
        setChutakOpen(true);
    };

    const handleViewChutak = (client: AssignClient) => {
        setSelectedClient({ id: client.id, businessName: client.businessName });
        setViewChutakOpen(true);
    };

    const handleTriggerSaleFlow = (items: ChutakSaleItem[], range: { from: Date; to: Date }) => {
        setChutakItemsForSale(items);
        setSaleDateRange(range);
        setCreateSaleOpen(true);
    };

    const renderStatusBadge = (status?: string) => (
        <Badge
            className={cn(
                "capitalize h-6 px-2.5 text-xs font-medium",
                status === "Active"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
            )}
            variant="outline"
        >
            {status || "Onboarding"}
        </Badge>
    );

    const renderClientCell = (client: AssignClient, isExpanded: boolean) => (
        <div className="flex items-center gap-3">
            <div
                className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors",
                    isExpanded
                        ? "bg-primary/10 text-primary border-primary/20"
                        : "bg-muted/40 text-muted-foreground border-transparent"
                )}
            >
                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
            <div>
                <div className="font-semibold text-foreground leading-none">{client.businessName}</div>
                <div className="text-xs text-muted-foreground mt-1">{client.name}</div>
            </div>
        </div>
    );

    const renderExpandedDetails = (client: AssignClient, colSpan: number) => (
        <TableRow className="hover:bg-transparent border-t-0">
            <TableCell colSpan={colSpan} className="p-0 border-t-0 bg-muted/10">
                <ClientExpandableDetails
                    client={{ id: client.id, businessName: client.businessName }}
                    activeTab={activeTab}
                    onAssignFixed={(sub) => handleAssignFixed(client, sub)}
                    onAddChutak={() => handleAddChutak(client)}
                    onViewAllChutak={() => handleViewChutak(client)}
                    onDownloadBilling={() => handleDownloadBilling(client)}
                />
            </TableCell>
        </TableRow>
    );

    return (
        <div className="flex flex-col gap-6">
            <Tabs
                value={activeTab}
                className="w-full"
                onValueChange={(value) => {
                    setActiveTab(value);
                    setExpandedClientId(null);
                }}
            >
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <TabsList className="grid w-full md:w-auto grid-cols-2">
                        <TabsTrigger value="fixed" className="gap-2 px-4">Fixed Packages</TabsTrigger>
                        <TabsTrigger value="chutak" className="gap-2 px-4">Chutak Clients</TabsTrigger>
                    </TabsList>

                    <div className="relative w-full md:max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search active clients..."
                            value={filter}
                            onChange={(event) => setFilter(event.target.value)}
                            className="pl-9 bg-card h-10"
                        />
                    </div>
                </div>

                <TabsContent value="fixed" className="mt-4">
                    <div className="rounded-md border bg-card shadow-sm overflow-hidden">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-4 border-b">
                            <div className="space-y-1">
                                <h2 className="text-lg font-semibold text-foreground">Fixed Client Management</h2>
                                <p className="text-sm text-muted-foreground">View and manage already assigned recurring monthly packages.</p>
                            </div>
                            <Button
                                onClick={() => handleAssignFixed()}
                                className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                            >
                                <Plus size={16} /> Assign New Package
                            </Button>
                        </div>

                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow>
                                        <TableHead className="w-24 pl-6 font-semibold text-muted-foreground whitespace-nowrap">Sr. No.</TableHead>
                                        <TableHead className="font-semibold text-muted-foreground whitespace-nowrap">Client Business</TableHead>
                                        <TableHead className="font-semibold text-muted-foreground whitespace-nowrap">Active Package</TableHead>
                                        <TableHead className="font-semibold text-muted-foreground whitespace-nowrap">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <DataHandler
                                        loading={isLoading && clients.length === 0}
                                        isEmpty={!isLoading && fixedClients.length === 0}
                                        variant="table-row"
                                        colSpan={4}
                                        emptyText="No fixed packages assigned yet."
                                    >
                                        {fixedClients.map((client, index) => {
                                            const isExpanded = expandedClientId === client.id;
                                            const typedClient = client as AssignClient;
                                            const displaySub = (typedClient.subscriptions || []).find((sub) => sub.status === "Active") ||
                                                (typedClient.subscriptions || []).find((sub) => sub.status === "Completed");

                                            return (
                                                <React.Fragment key={client.id}>
                                                    <TableRow
                                                        className={cn(
                                                            "cursor-pointer transition-colors",
                                                            isExpanded ? "bg-muted/30" : "hover:bg-muted/20"
                                                        )}
                                                        onClick={() => toggleExpand(client.id)}
                                                    >
                                                        <TableCell className="py-3 pl-6 text-sm text-muted-foreground whitespace-nowrap">
                                                            {index + 1}.
                                                        </TableCell>
                                                        <TableCell className="py-3 min-w-[260px]">
                                                            {renderClientCell(typedClient, isExpanded)}
                                                        </TableCell>
                                                        <TableCell className="py-3 whitespace-nowrap">
                                                            {displaySub ? (
                                                                <Badge
                                                                    variant="secondary"
                                                                    className={cn(
                                                                        "h-6 px-2.5 text-xs font-medium border",
                                                                        displaySub.status === "Active"
                                                                            ? "bg-primary/5 text-primary border-primary/20"
                                                                            : "bg-muted text-muted-foreground border-border"
                                                                    )}
                                                                >
                                                                    {displaySub.packageName}
                                                                </Badge>
                                                            ) : (
                                                                <span className="text-sm text-muted-foreground">Not assigned</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="py-3 whitespace-nowrap">
                                                            {renderStatusBadge(client.status)}
                                                        </TableCell>
                                                    </TableRow>
                                                    {isExpanded && renderExpandedDetails(typedClient, 4)}
                                                </React.Fragment>
                                            );
                                        })}
                                    </DataHandler>
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="chutak" className="mt-4">
                    <div className="rounded-md border bg-card shadow-sm overflow-hidden">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-4 border-b">
                            <div className="space-y-1">
                                <h2 className="text-lg font-semibold text-foreground">Chutak Services History</h2>
                                <p className="text-sm text-muted-foreground">View clients who have requested one-off services.</p>
                            </div>
                            <Button
                                onClick={() => handleAddChutak()}
                                className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                            >
                                <Plus size={16} /> Add Chutak Item
                            </Button>
                        </div>

                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow>
                                        <TableHead className="w-24 pl-6 font-semibold text-muted-foreground whitespace-nowrap">Sr. No.</TableHead>
                                        <TableHead className="font-semibold text-muted-foreground whitespace-nowrap">Client Business</TableHead>
                                        <TableHead className="font-semibold text-muted-foreground whitespace-nowrap">Contact</TableHead>
                                        <TableHead className="font-semibold text-muted-foreground whitespace-nowrap">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <DataHandler
                                        loading={isLoading && clients.length === 0}
                                        isEmpty={!isLoading && chutakClients.length === 0}
                                        variant="table-row"
                                        colSpan={4}
                                        emptyText="No existing chutak clients found."
                                    >
                                        {chutakClients.map((client, index) => {
                                            const typedClient = client as AssignClient;
                                            const isExpanded = expandedClientId === typedClient.id;

                                            return (
                                                <React.Fragment key={client.id}>
                                                    <TableRow
                                                        className={cn(
                                                            "cursor-pointer transition-colors",
                                                            isExpanded ? "bg-muted/30" : "hover:bg-muted/20"
                                                        )}
                                                        onClick={() => toggleExpand(client.id)}
                                                    >
                                                        <TableCell className="py-3 pl-6 text-sm text-muted-foreground whitespace-nowrap">
                                                            {index + 1}.
                                                        </TableCell>
                                                        <TableCell className="py-3 min-w-[260px]">
                                                            {renderClientCell(typedClient, isExpanded)}
                                                        </TableCell>
                                                        <TableCell className="py-3 text-sm text-muted-foreground whitespace-nowrap">
                                                            {typedClient.phone || "-"}
                                                        </TableCell>
                                                        <TableCell className="py-3 whitespace-nowrap">
                                                            {renderStatusBadge(typedClient.status)}
                                                        </TableCell>
                                                    </TableRow>
                                                    {isExpanded && renderExpandedDetails(typedClient, 4)}
                                                </React.Fragment>
                                            );
                                        })}
                                    </DataHandler>
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

            {assignWizardOpen && (
                <AssignmentWizard
                    isOpen={assignWizardOpen}
                    onClose={() => {
                        setAssignWizardOpen(false);
                        setEditingSubscription(null);
                    }}
                    initialClientId={selectedClient?.id}
                    initialData={editingSubscription}
                />
            )}

            <ChutakDialog open={chutakOpen} onOpenChange={setChutakOpen} client={selectedClient} />

            <ChutakViewDialog open={viewChutakOpen} onOpenChange={setViewChutakOpen} client={selectedClient} onCreateSale={handleTriggerSaleFlow} />

            <BillingDownloadDialog open={billingDownloadOpen} onOpenChange={setBillingDownloadOpen} client={selectedClient} />

            <CreateChutakSaleDialog
                open={createSaleOpen}
                onOpenChange={setCreateSaleOpen}
                client={selectedClient}
                items={chutakItemsForSale}
                dateRange={saleDateRange}
                onSuccess={() => { setViewChutakOpen(false); }}
            />
        </div>
    );
}

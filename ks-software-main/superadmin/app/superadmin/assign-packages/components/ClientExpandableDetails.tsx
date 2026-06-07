"use client";

import React, { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/src/redux/hooks";
import { fetchClientSubscriptions } from "@/src/redux/slices/subscriptionSlice";
import { fetchChutakItemsByClient, deleteChutakItem } from "@/src/redux/slices/scheduleSlice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Loader2,
    Package,
    Calendar,
    ChevronRight,
    Plus,
    History,
    TrendingUp,
    LayoutGrid,
    AlertCircle,
    Trash2,
    Pencil
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { DeleteSubscriptionDialog } from "./DeleteSubscriptionDialog";
import { ChutakDialog } from "./ChutakDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Subscription } from "@/lib/subscriptionData";

type ChutakItem = {
    _id?: string;
    postType?: string;
    content?: string;
    price?: number;
};

interface ClientExpandableDetailsProps {
    client: { id: string; businessName: string };
    activeTab: string;
    onAssignFixed: (subscription?: Subscription) => void;
    onAddChutak: () => void;
    onViewAllChutak: () => void;
    onDownloadBilling: () => void;
}

const getSubscriptionTotal = (sub: Subscription) => {
    return (sub.deliverables || []).reduce((total, item) => {
        const price = item?.price ?? item?.basePrice ?? item?.unitPrice ?? 0;
        return total + price * (item?.quantity || 0);
    }, 0);
};

export function ClientExpandableDetails({
    client,
    activeTab,
    onAssignFixed,
    onAddChutak,
    onViewAllChutak,
}: ClientExpandableDetailsProps) {
    const dispatch = useAppDispatch();

    const { activeSubscriptions, isLoading: isSubLoading } = useAppSelector((state) => state.subscription);
    const { items: chutakItems, isLoading: isChutakLoading } = useAppSelector((state) => state.schedule);

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [subToDelete, setSubToDelete] = useState<{ id: string; name: string } | null>(null);
    const [editChutakOpen, setEditChutakOpen] = useState(false);
    const [editChutakItem, setEditChutakItem] = useState<ChutakItem | null>(null);
    const [deleteChutakId, setDeleteChutakId] = useState<string | null>(null);
    const [deleteChutakDialogOpen, setDeleteChutakDialogOpen] = useState(false);

    const typedChutakItems = (chutakItems || []) as ChutakItem[];

    const handleDeleteChutak = (id: string) => {
        setDeleteChutakId(id);
        setDeleteChutakDialogOpen(true);
    };

    const confirmDeleteChutak = async () => {
        if (!deleteChutakId) return;

        try {
            await dispatch(deleteChutakItem(deleteChutakId));
        } finally {
            setDeleteChutakDialogOpen(false);
            setDeleteChutakId(null);
        }
    };

    useEffect(() => {
        if (client.id) {
            dispatch(fetchClientSubscriptions(client.id));
            dispatch(fetchChutakItemsByClient({ clientId: client.id }));
        }
    }, [client.id, dispatch]);

    return (
        <div className="bg-muted/10 px-4 py-4 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className={cn("grid gap-4", activeTab === "fixed" || activeTab === "chutak" ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2")}>
                {activeTab === "fixed" && (
                    <div className="rounded-md border bg-card shadow-sm overflow-hidden">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 px-4 py-4 border-b">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                                    <Package size={18} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-semibold text-foreground">Active Fixed Packages</h4>
                                    <p className="text-xs text-muted-foreground">Recurring monthly deliverables</p>
                                </div>
                            </div>
                            <Button variant="outline" size="sm" className="h-9 gap-2" onClick={() => onAssignFixed()}>
                                <Plus size={14} /> Assign New Package
                            </Button>
                        </div>

                        {isSubLoading ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="animate-spin h-5 w-5 text-primary" />
                            </div>
                        ) : activeSubscriptions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-center space-y-2">
                                <AlertCircle size={22} className="text-muted-foreground/40" />
                                <p className="text-sm text-muted-foreground">No active fixed packages assigned.</p>
                            </div>
                        ) : (
                            <div className="divide-y">
                                {(activeSubscriptions || []).map((sub) => (
                                    <div key={sub?._id || sub?.packageName || Math.random()} className="space-y-4 p-4 bg-card">
                                        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
                                            <div className="flex-1 space-y-2">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <div className="text-sm font-semibold text-foreground">
                                                        {sub?.packageName || "Unnamed Package"}
                                                    </div>
                                                    <Badge className={cn(
                                                        "h-5 px-2 text-[11px] font-medium border",
                                                        sub?.status === "Active" ? "bg-primary/5 text-primary border-primary/20" :
                                                            sub?.status === "Completed" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                                                "bg-muted text-muted-foreground border-border"
                                                    )}>
                                                        {sub?.status}
                                                    </Badge>
                                                    <span className="text-sm font-semibold text-foreground">
                                                        Rs. {getSubscriptionTotal(sub).toLocaleString()}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                                                    <Calendar size={12} />
                                                    {sub?.startDate ? format(new Date(sub.startDate), "MMM d") : "N/A"} - {sub?.endDate ? format(new Date(sub.endDate), "MMM d, yyyy") : "N/A"}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 gap-2 text-xs"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        onAssignFixed(sub);
                                                    }}
                                                >
                                                    <Pencil size={14} />
                                                    Edit
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 gap-2 text-xs text-destructive hover:text-destructive"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        if (sub?._id) {
                                                            setSubToDelete({ id: sub._id, name: sub.packageName || "Unnamed Package" });
                                                        }
                                                        setDeleteDialogOpen(true);
                                                    }}
                                                >
                                                    <Trash2 size={14} />
                                                    Delete
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                            {(sub.deliverables || []).map((item, idx) => (
                                                <div key={idx} className="flex justify-between items-center gap-3 rounded-md border bg-muted/20 px-3 py-2 text-xs">
                                                    <span className="flex items-center gap-2 font-medium text-muted-foreground truncate">
                                                        <ChevronRight size={12} className="text-primary" />
                                                        {item?.serviceName || item?.name}
                                                    </span>
                                                    <Badge variant="secondary" className="h-5 px-2 text-[11px] font-medium">
                                                        x{item?.quantity || 0}
                                                    </Badge>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "chutak" && (
                    <div className="rounded-md border bg-card shadow-sm overflow-hidden">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 px-4 py-4 border-b">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                                    <TrendingUp size={18} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-semibold text-foreground">Recent Chutak Items</h4>
                                    <p className="text-xs text-muted-foreground">One-off service requests</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" className="h-9 gap-2" onClick={onAddChutak}>
                                    <Plus size={14} /> Add Item
                                </Button>
                                <Button variant="ghost" size="sm" className="h-9 gap-2" onClick={onViewAllChutak}>
                                    <History size={14} /> History
                                </Button>
                            </div>
                        </div>

                        {isChutakLoading ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="animate-spin h-5 w-5 text-primary" />
                            </div>
                        ) : typedChutakItems.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-center space-y-2">
                                <LayoutGrid size={22} className="text-muted-foreground/40" />
                                <p className="text-sm text-muted-foreground">No recent Chutak entries.</p>
                            </div>
                        ) : (
                            <div className="p-4 space-y-3">
                                <div className="space-y-2 max-h-[240px] overflow-y-auto pr-2 custom-scrollbar">
                                    {typedChutakItems.slice(0, 5).map((item) => (
                                        <div key={item?._id || item?.content || Math.random()} className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 rounded-md border bg-card px-3 py-2">
                                            <div className="flex items-center gap-4 overflow-hidden">
                                                <Badge variant="outline" className="text-[11px] font-medium whitespace-nowrap">
                                                    {item?.postType || "Item"}
                                                </Badge>
                                                <div className="text-sm font-medium text-foreground truncate">{item?.content}</div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="text-sm font-semibold text-foreground tabular-nums">Rs. {item?.price?.toLocaleString() || 0}</div>
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            setEditChutakItem(item);
                                                            setEditChutakOpen(true);
                                                        }}
                                                    >
                                                        <Pencil size={14} />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            if (item?._id) {
                                                                handleDeleteChutak(item._id);
                                                            }
                                                        }}
                                                    >
                                                        <Trash2 size={14} />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {typedChutakItems.length > 5 && (
                                    <p className="text-xs text-center text-muted-foreground pt-1">
                                        + {typedChutakItems.length - 5} more entries in full history
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {subToDelete && (
                <DeleteSubscriptionDialog
                    open={deleteDialogOpen}
                    onOpenChange={setDeleteDialogOpen}
                    subscriptionId={subToDelete.id}
                    packageName={subToDelete.name || "Unnamed Package"}
                />
            )}

            <ChutakDialog open={editChutakOpen} onOpenChange={setEditChutakOpen} client={client} itemToEdit={editChutakItem} />
            <ConfirmDialog
                open={deleteChutakDialogOpen}
                onOpenChange={setDeleteChutakDialogOpen}
                onConfirm={confirmDeleteChutak}
                title="Delete Chutak Item"
                description="Are you sure you want to delete this Chutak item? This action cannot be undone."
            />
        </div>
    );
}

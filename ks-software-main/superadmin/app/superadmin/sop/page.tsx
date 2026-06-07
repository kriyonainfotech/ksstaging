"use client";

import React, { useState, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/src/redux/hooks";
import { fetchSuperAdmins, fetchAdmins } from "@/src/redux/slices/adminSlice";
import {
    fetchSopGroups,
    createSopGroup,
    updateSopGroup,
    deleteSopGroup,
    reorderSopGroups,
    resetSopGroupStatus,
    setGroups,
    reorderGroupsSync
} from "@/src/redux/slices/sopGroupSlice";
import {
    fetchSopPoints,
    createSopPoint,
    updateSopPoint,
    deleteSopPoint,
    reorderSopPoints,
    resetSopPointStatus,
    setPoints,
    reorderPointsSync
} from "@/src/redux/slices/sopPointSlice";

import { SopEntityColumn } from "./components/SopEntityColumn";
import { SopGroupColumn } from "./components/SopGroupColumn";
import { SopPointColumn } from "./components/SopPointColumn";

import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/src/context/AuthContext";

const TEAM_CATEGORIES = [
    { id: "admin", name: "Admin", type: "team" as const },
    { id: "design", name: "Designer", type: "team" as const },
    { id: "video", name: "Video Editor", type: "team" as const },
    { id: "marketing", name: "Marketer", type: "team" as const },
    { id: "web", name: "Web Developer", type: "team" as const },
];

export default function SopPage() {
    const dispatch = useAppDispatch();
    const { user } = useAuth();

    // Redux State
    const { superadmins, admins } = useAppSelector((state) => state.admin);
    const { groups, isLoading: groupsLoading, message: groupMsg, error: groupErr } = useAppSelector((state) => state.sopGroups);
    const { points, isLoading: pointsLoading, message: pointMsg, error: pointErr } = useAppSelector((state) => state.sopPoints);

    // Context State
    const [selectedEntity, setSelectedEntity] = useState<any>(null);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

    // Dialog States
    const [editGroup, setEditGroup] = useState<any>(null);
    const [editPoint, setEditPoint] = useState<any>(null);
    const [deleteConfig, setDeleteConfig] = useState<{ type: 'group' | 'point', id: string } | null>(null);

    // Restriction Logic
    const isMasterAdmin = user?.role === "Superadmin";
    
    // Other Superadmins can manage Superadmin entities but are READ-ONLY for Team Categories and Admins
    const isReadOnly = !isMasterAdmin && (selectedEntity?.type === "team" || selectedEntity?.type === "admin");

    useEffect(() => {
        dispatch(fetchSuperAdmins());
        dispatch(fetchAdmins());
    }, [dispatch]);

    useEffect(() => {
        if (groupMsg) { toast.success(groupMsg); dispatch(resetSopGroupStatus()); }
        if (groupErr) { toast.error(groupErr); dispatch(resetSopGroupStatus()); }
        if (pointMsg) { toast.success(pointMsg); dispatch(resetSopPointStatus()); }
        if (pointErr) { toast.error(pointErr); dispatch(resetSopPointStatus()); }
    }, [groupMsg, groupErr, pointMsg, pointErr, dispatch]);

    // Handle Entity Selection
    useEffect(() => {
        if (selectedEntity) {
            const params: any = { category: "sop", entityType: selectedEntity.type };
            if (selectedEntity.type === "superadmin" || selectedEntity.type === "admin") params.entityId = selectedEntity.id;
            else params.teamCategory = selectedEntity.id;

            dispatch(fetchSopGroups(params));
            setSelectedGroupId(null);
        }
    }, [selectedEntity, dispatch]);

    // Handle Group Selection
    useEffect(() => {
        if (selectedGroupId) {
            dispatch(fetchSopPoints(selectedGroupId));
        }
    }, [selectedGroupId, dispatch]);

    // Set default entity
    useEffect(() => {
        if (!selectedEntity && superadmins.length > 0) {
            setSelectedEntity({ id: superadmins[0]._id, name: superadmins[0].name, type: "superadmin" });
        }
    }, [superadmins, selectedEntity]);

    if (user?.role !== "Superadmin") {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-40px)] text-center">
                <h1 className="text-2xl font-bold text-destructive">Access Restricted</h1>
                <p className="text-muted-foreground mt-2">Only administrators can manage SOPs and Rules.</p>
            </div>
        );
    }

    // --- Action Handlers ---

    const handleAddGroup = (title: string) => {
        if (!selectedEntity || isReadOnly) return;
        const payload: any = {
            title,
            category: "sop",
            entityType: selectedEntity.type
        };
        if (selectedEntity.type === "superadmin" || selectedEntity.type === "admin") payload.entityId = selectedEntity.id;
        else payload.teamCategory = selectedEntity.id;

        // Find max order
        const maxOrder = groups.length > 0 ? Math.max(...groups.map(g => g.order || 0)) : -1;
        payload.order = maxOrder + 1;

        dispatch(createSopGroup(payload));
    };

    const handleAddPoint = (content: string) => {
        if (!selectedGroupId || isReadOnly) return;
        const maxOrder = points.length > 0 ? Math.max(...points.map(p => p.order || 0)) : -1;
        dispatch(createSopPoint({
            content,
            groupId: selectedGroupId,
            order: maxOrder + 1
        }));
    };

    const handleMoveGroup = (sourceIndex: number, destinationIndex: number) => {
        if (isReadOnly) return;
        // Update Redux UI Sync
        dispatch(reorderGroupsSync({ sourceIndex, destinationIndex }));

        // Prepare orders for API
        const nextGroups = [...groups];
        const [reorderedItem] = nextGroups.splice(sourceIndex, 1);
        nextGroups.splice(destinationIndex, 0, reorderedItem);

        const orders = nextGroups.map((g, idx) => ({ id: g._id, order: idx }));
        dispatch(reorderSopGroups(orders));
    };

    const handleMovePoint = (sourceIndex: number, destinationIndex: number) => {
        if (isReadOnly) return;
        // Update Redux UI Sync
        dispatch(reorderPointsSync({ sourceIndex, destinationIndex }));

        // Prepare orders for API
        const nextPoints = [...points];
        const [reorderedItem] = nextPoints.splice(sourceIndex, 1);
        nextPoints.splice(destinationIndex, 0, reorderedItem);

        const orders = nextPoints.map((p, idx) => ({ id: p._id, order: idx }));
        dispatch(reorderSopPoints(orders));
    };
    return (
        <div className="flex flex-col h-[calc(100vh-140px)] gap-4 overflow-hidden">
            {/* Page Header */}
            <div>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold tracking-tight">Standard Operating Procedures</h1>
                        {user?.activeCompanyName && (
                            <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-full uppercase tracking-wider">
                                {user.activeCompanyName}
                            </span>
                        )}
                    </div>
                    {isReadOnly && (
                        <div className="bg-amber-50 text-amber-600 border border-amber-200 px-3 py-1 rounded-md text-xs font-medium flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                            </span>
                            Read Only: Global SOPs
                        </div>
                    )}
                </div>
                <p className="text-muted-foreground text-sm">Organize processes for {user?.activeCompanyName || 'your company'} with a clear hierarchical structure.</p>
            </div>

            {/* Mobile: Entity dropdown */}
            <div className="lg:hidden">
                <Select
                    value={selectedEntity ? `${selectedEntity.type}::${selectedEntity.id}` : ""}
                    onValueChange={(val) => {
                        const [type, id] = val.split("::");
                        if (type === "superadmin") {
                                const admin = superadmins.find(a => a._id === id);
                                if (admin) { setSelectedEntity({ id: admin._id, name: admin.name, type: "superadmin" }); setSelectedGroupId(null); }
                            } else if (type === "admin") {
                                const admin = admins.find(a => a._id === id);
                                if (admin) { setSelectedEntity({ id: admin._id, name: admin.name, type: "admin" }); setSelectedGroupId(null); }
                            } else {
                                const cat = TEAM_CATEGORIES.find(c => c.id === id);
                                if (cat) { setSelectedEntity(cat); setSelectedGroupId(null); }
                            }
                        }}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a member..." />
                        </SelectTrigger>
                        <SelectContent>
                            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Superadmins</div>
                            {superadmins.map(admin => (
                                <SelectItem key={admin._id} value={`superadmin::${admin._id}`}>{admin.name}</SelectItem>
                            ))}
                            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">Admins</div>
                            {admins.map(admin => (
                                <SelectItem key={admin._id} value={`admin::${admin._id}`}>{admin.name}</SelectItem>
                            ))}
                            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">Team Categories</div>
                            {TEAM_CATEGORIES.map(cat => (
                                <SelectItem key={cat.id} value={`team::${cat.id}`}>{cat.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

            {/* Mobile: breadcrumb for group → points drill-down */}
            {selectedEntity && (
                <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground lg:hidden">
                    <button
                        onClick={() => setSelectedGroupId(null)}
                        className={selectedGroupId ? "text-primary underline underline-offset-2" : "text-slate-500 cursor-default"}
                    >
                        Groups
                    </button>
                    {selectedGroupId && (
                        <>
                            <span className="text-slate-300">/</span>
                            <span className="text-slate-700 truncate max-w-[160px]">
                                {groups.find(g => g._id === selectedGroupId)?.title || "Points"}
                            </span>
                        </>
                    )}
                </div>
            )}

            {/* Desktop: 3-Column | Mobile: single active panel */}
            <div className="flex flex-1 gap-6 min-h-0">

                {/* Column 1: Entities — desktop only */}
                <div className="hidden lg:block w-[260px] border-r pr-2 h-full">
                    <SopEntityColumn
                        superadmins={superadmins}
                        admins={admins}
                        selectedEntity={selectedEntity}
                        onSelect={(entity) => { setSelectedEntity(entity); setSelectedGroupId(null); }}
                    />
                </div>

                {/* Column 2: Groups */}
                <div className={`lg:w-[300px] lg:border-r lg:pr-2 lg:block lg:h-full
                    ${!selectedEntity ? "hidden" : selectedGroupId ? "hidden lg:block" : "flex-1"}`}>
                    {selectedEntity ? (
                        <SopGroupColumn
                            groups={groups}
                            selectedGroupId={selectedGroupId}
                            onSelect={setSelectedGroupId}
                            onAdd={handleAddGroup}
                            onEdit={setEditGroup}
                            onDelete={(id) => setDeleteConfig({ type: 'group', id })}
                            onMove={handleMoveGroup}
                            isLoading={groupsLoading}
                            isReadOnly={isReadOnly}
                        />
                    ) : (
                        <div className="h-full flex items-center justify-center text-muted-foreground text-sm italic">
                            Select a member to see groups
                        </div>
                    )}
                </div>

                {/* Column 3: Points */}
                <div className={`bg-muted/5 p-4 rounded-xl border border-dashed border-muted h-full overflow-hidden
                    lg:flex lg:flex-col lg:flex-1
                    ${selectedGroupId ? "flex flex-col flex-1" : "hidden lg:flex"}`}>
                    <SopPointColumn
                        points={points}
                        groupId={selectedGroupId}
                        onAdd={handleAddPoint}
                        onEdit={setEditPoint}
                        onDelete={(id) => setDeleteConfig({ type: 'point', id })}
                        onMove={handleMovePoint}
                        isLoading={pointsLoading}
                        isReadOnly={isReadOnly}
                    />
                </div>
            </div>

            {/* Edit Group Dialog */}
            <EditDialog
                open={!!editGroup}
                title="Edit Group"
                value={editGroup?.title || ""}
                onClose={() => setEditGroup(null)}
                onSubmit={(val) => {
                    dispatch(updateSopGroup({ id: editGroup._id, data: { title: val } }));
                    setEditGroup(null);
                }}
            />

            {/* Edit Point Dialog */}
            <EditDialog
                open={!!editPoint}
                title="Edit Point"
                value={editPoint?.content || ""}
                onClose={() => setEditPoint(null)}
                onSubmit={(val) => {
                    dispatch(updateSopPoint({ id: editPoint._id, data: { content: val } }));
                    setEditPoint(null);
                }}
                isTextArea
            />

            {/* Delete Confirmation */}
            <ConfirmDialog
                open={!!deleteConfig}
                onOpenChange={(open) => !open && setDeleteConfig(null)}
                onConfirm={() => {
                    if (deleteConfig?.type === 'group') dispatch(deleteSopGroup(deleteConfig.id));
                    else if (deleteConfig?.type === 'point') dispatch(deleteSopPoint(deleteConfig.id));
                    setDeleteConfig(null);
                }}
                title={`Delete ${deleteConfig?.type === 'group' ? 'Group' : 'Point'}?`}
                description={`This will permanently remove this ${deleteConfig?.type}. Associated data will be lost.`}
            />
        </div>
    );
}

function EditDialog({ open, title, value, onClose, onSubmit, isTextArea }: { open: boolean, title: string, value: string, onClose: () => void, onSubmit: (val: string) => void, isTextArea?: boolean }) {
    const [val, setVal] = useState(value);
    useEffect(() => { setVal(value); }, [value, open]);

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
                <div className="py-4">
                    {isTextArea ? (
                        <Textarea
                            value={val}
                            onChange={(e) => setVal(e.target.value)}
                            autoFocus
                            rows={5}
                            className="resize-none"
                        />
                    ) : (
                        <Input
                            value={val}
                            onChange={(e) => setVal(e.target.value)}
                            autoFocus
                            onKeyDown={(e) => e.key === "Enter" && onSubmit(val)}
                        />
                    )}
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button onClick={() => onSubmit(val)}>Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { User, Users } from "lucide-react";

interface Entity {
    id: string;
    name: string;
    type: "superadmin" | "admin" | "team";
    category?: string;
}

interface SopEntityColumnProps {
    superadmins: any[];
    admins: any[];
    selectedEntity: Entity | null;
    onSelect: (entity: Entity) => void;
}

const TEAM_CATEGORIES = [
    { id: "admin", name: "Admin", type: "team" as const },
    { id: "design", name: "Designer", type: "team" as const },
    { id: "video", name: "Video Editor", type: "team" as const },
    { id: "marketing", name: "Marketer", type: "team" as const },
    { id: "web", name: "Web Developer", type: "team" as const },
];

export function SopEntityColumn({ superadmins, admins, selectedEntity, onSelect }: SopEntityColumnProps) {
    return (
        <div className="flex flex-col h-full max-h-full"> {/* Height fix */}
            <div className="flex items-center gap-2 px-2 pb-3 mb-2 border-b border-muted/50 shrink-0">
                <Users className="size-5 text-primary" />
                <h2 className="text-lg font-bold text-slate-800 tracking-tight">Members</h2>
            </div>

            {/* Native Scrollable Area */}
            <div className="flex-1 w-full overflow-y-auto pr-2 custom-scrollbar">
                <div className="flex flex-col gap-4 p-2 pb-10">
                    {/* Superadmins */}
                    <div className="space-y-1.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 px-2 mb-2">Superadmins</p>
                        {superadmins.map((admin) => (
                            <EntityCard
                                key={admin._id}
                                name={admin.name}
                                active={selectedEntity?.id === admin._id && selectedEntity?.type === "superadmin"}
                                onClick={() => onSelect({ id: admin._id, name: admin.name, type: "superadmin" })}
                                icon={<User className="size-4" />}
                            />
                        ))}
                    </div>

                    {/* Admins (Specific People) */}
                    {admins.length > 0 && (
                        <div className="space-y-1.5">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 px-2 mb-2">Admins</p>
                            {admins.map((admin) => (
                                <EntityCard
                                    key={admin._id}
                                    name={admin.name}
                                    active={selectedEntity?.id === admin._id && selectedEntity?.type === "admin"}
                                    onClick={() => onSelect({ id: admin._id, name: admin.name, type: "admin" })}
                                    icon={<User className="size-4 text-amber-600" />}
                                />
                            ))}
                        </div>
                    )}

                    {/* Team Categories */}
                    <div className="space-y-1.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 px-2 mb-2">Team Categories</p>
                        {TEAM_CATEGORIES.map((cat) => (
                            <EntityCard
                                key={cat.id}
                                name={cat.name}
                                active={selectedEntity?.id === cat.id && selectedEntity?.type === "team"}
                                onClick={() => onSelect(cat)}
                                icon={<Users className="size-4" />}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function EntityCard({ name, active, onClick, icon }: { name: string, active: boolean, onClick: () => void, icon: React.ReactNode }) {
    return (
        <Card
            className={cn(
                "cursor-pointer transition-all duration-200 border shadow-sm group relative py-0 overflow-hidden",
                active
                    ? "border-primary/40 bg-primary/5 ring-1 ring-primary/10 shadow-md"
                    : "border-slate-200 bg-white hover:border-primary/30 hover:shadow-md"
            )}
            onClick={onClick}
        >
            {/* Selection Indicator Strip */}
            {active && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
            )}

            <CardContent className="p-2.5 pl-4 flex items-center gap-3">
                <div className={cn(
                    "p-1.5 rounded-md transition-colors",
                    active
                        ? "bg-primary text-white"
                        : "bg-muted-foreground/10 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                )}>
                    {icon}
                </div>
                <span className={cn(
                    "text-sm font-bold truncate transition-colors",
                    active ? "text-primary" : "text-slate-700 group-hover:text-primary"
                )}>
                    {name}
                </span>
            </CardContent>
        </Card>
    );
}

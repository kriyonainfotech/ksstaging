"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "@/src/redux/hooks";
import { fetchTeamById, updateTeamMember } from "@/src/redux/slices/teamSlice";
import { restoreSession } from "@/src/redux/slices/authSlice";
import { useAuth } from "@/src/context/AuthContext";
import { Team } from "@/lib/teamdata";
import { User as UserType } from "@/lib/userData";
import { toast } from "sonner";

// UI Components    
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WalletCard } from "../components/WalletCard";
import { salaryService } from "@/src/services/salaryService";
import { Loader2, Mail, Phone, Briefcase, User, Save, X, Camera, Calendar, Clock, Search, FileText } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSunday, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";

const MONTHS = [
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" },
];

const YEARS = [2026];

const getDaysInMonthList = (month: number, year: number, logs: any[]) => {
    const startDate = startOfMonth(new Date(year, month - 1, 1));
    const endDate = endOfMonth(new Date(year, month - 1, 1));
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    return days.map(day => {
        const record = logs.find(log => {
            const logDate = new Date(log.date);
            return isSameDay(day, logDate);
        });

        let status = "Leave";
        let startTime = "—";
        let endTime = "—";
        let totalHours = 0;

        if (record) {
            status = record.status || "Leave";
            startTime = record.startTime || "—";
            endTime = record.endTime || "—";
            totalHours = record.totalHours || 0;
        } else if (isSunday(day)) {
            status = "Sunday";
        }

        return {
            date: day,
            status,
            startTime,
            endTime,
            totalHours,
            id: record?._id
        };
    }).reverse();
};

const formatTimeString = (timeStr: string) => {
    if (!timeStr || timeStr === "—") return "—";
    const parts = timeStr.split(":");
    if (parts.length !== 2) return timeStr;
    let hours = parseInt(parts[0]);
    const mins = parts[1];
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${mins} ${ampm}`;
};

export default function TeamProfilePage() {
    const dispatch = useAppDispatch();
    const { user } = useAuth();
    const { members, selectedMember, isLoading } = useAppSelector((state) => state.team);

    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<Partial<Team> | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    // New state for profile picture preview and file
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const myProfile = selectedMember || members.find(m => m?._id === user?._id) || null;
    console.log(myProfile, "myProfile")

    useEffect(() => {
        if (user?._id && !myProfile) {
            dispatch(fetchTeamById(user._id));
        }
    }, [dispatch, user, myProfile]);

    // Attendance & Salary Ledger States
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [statusFilter, setStatusFilter] = useState("all");
    const [dateSearch, setDateSearch] = useState("");

    const [walletData, setWalletData] = useState<any>(null);
    const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);

    useEffect(() => {
        if (!myProfile?._id) return;

        const loadLogs = async () => {
            setLoadingLogs(true);
            try {
                // Fetch wallet stats for selected month/year
                const walletRes = await salaryService.getMyWalletStats({ 
                    month: selectedMonth, 
                    year: selectedYear 
                });
                setWalletData(walletRes.data);

                // Fetch attendance logs for selected user & month/year
                const logsRes = await salaryService.getAttendanceLogs(
                    myProfile._id, 
                    { month: selectedMonth, year: selectedYear }
                );
                setAttendanceLogs(logsRes.data || []);
            } catch (error) {
                console.error("Failed to load attendance logs", error);
                toast.error("Failed to load attendance details for this month");
            } finally {
                setLoadingLogs(false);
            }
        };

        loadLogs();
    }, [myProfile?._id, selectedMonth, selectedYear]);

    const ledgerDays = useMemo(() => {
        const allDays = getDaysInMonthList(selectedMonth, selectedYear, attendanceLogs);

        return allDays.filter(day => {
            // 1. Filter by status
            if (statusFilter !== "all") {
                if (statusFilter === "present") {
                    if (day.status !== "Full Day" && day.status !== "Half Day") return false;
                } else if (statusFilter === "leave") {
                    if (day.status !== "Leave") return false;
                } else if (statusFilter === "sunday") {
                    if (day.status !== "Sunday") return false;
                }
            }

            // 2. Filter by search text
            if (dateSearch.trim() !== "") {
                const formattedDate = format(day.date, "eeee, MMMM do, yyyy").toLowerCase();
                const searchLower = dateSearch.toLowerCase();
                if (!formattedDate.includes(searchLower)) return false;
            }

            return true;
        });
    }, [selectedMonth, selectedYear, attendanceLogs, statusFilter, dateSearch]);

    useEffect(() => {
        if (myProfile && !formData) {
            setFormData(JSON.parse(JSON.stringify(myProfile)));
            // Set initial preview if exists
            if (myProfile.profilePic?.url) {
                setPreviewImage(myProfile.profilePic.url);
            }
        }
    }, [myProfile, formData]);

    // --- HANDLERS ---

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleInputChange = (path: string, value: any) => {
        if (!formData) return;

        setFormData((prev) => {
            if (!prev) return null;
            const newFormData = { ...prev };
            const keys = path.split(".");

            let current: any = newFormData;
            for (let i = 0; i < keys.length - 1; i++) {
                const key = keys[i];
                // @ts-ignore
                if (!current[key]) current[key] = {};
                // @ts-ignore
                current[key] = { ...current[key] };
                // @ts-ignore
                current = current[key];
            }

            // @ts-ignore
            current[keys[keys.length - 1]] = value;
            return newFormData;
        });

        // Clear error when user types
        if (fieldErrors[path]) {
            setFieldErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[path];
                return newErrors;
            });
        }
    };

    // Helper to safely append nested objects to FormData
    const appendToFormData = (formData: FormData, data: any, parentKey?: string) => {
        if (data && typeof data === 'object' && !(data instanceof Date) && !(data instanceof File)) {
            Object.keys(data).forEach(key => {
                appendToFormData(formData, data[key], parentKey ? `${parentKey}[${key}]` : key);
            });
        } else {
            const key = parentKey || '';
            if (data !== undefined && data !== null) {
                formData.append(key, data);
            }
        }
    };

    const handleSave = async () => {
        if (!formData || !myProfile) return;

        // --- VALIDATION ---
        const newErrors: Record<string, string> = {};
        const phoneRegex = /^[0-9]{10}$/;

        if (formData.phone && !phoneRegex.test(formData.phone)) {
            newErrors.phone = "Phone must be exactly 10 digits";
        }
        if (formData.profile?.emergencyContact1?.phone && !phoneRegex.test(formData.profile.emergencyContact1.phone)) {
            newErrors["profile.emergencyContact1.phone"] = "Phone must be exactly 10 digits";
        }
        if (formData.profile?.emergencyContact2?.phone && !phoneRegex.test(formData.profile.emergencyContact2.phone)) {
            newErrors["profile.emergencyContact2.phone"] = "Phone must be exactly 10 digits";
        }

        if (Object.keys(newErrors).length > 0) {
            setFieldErrors(newErrors);
            toast.error("Please fix the errors before saving.");
            return;
        }

        try {
            // 1. Prepare FormData
            const submissionData = new FormData();

            // 2. Append Profile Pic if changed
            if (selectedFile) {
                submissionData.append("profilePic", selectedFile);
            }

            // 3. Map frontend structure to backend expectations
            // Top level fields
            if (formData.name) submissionData.append("name", formData.name);
            if (formData.email) submissionData.append("email", formData.email);
            if (formData.phone) submissionData.append("phone", formData.phone);

            // Profile fields
            if (formData.profile?.specialization) {
                submissionData.append("specialization", formData.profile.specialization);
            }
            if (formData.profile?.experience) {
                submissionData.append("experience", formData.profile.experience);
            }

            // Salary
            if (formData.profile?.salary?.amount !== undefined && formData.profile?.salary?.amount !== null) {
                submissionData.append("salary[amount]", String(formData.profile.salary.amount));
            }
            if (formData.profile?.salary?.currency) {
                submissionData.append("salary[currency]", formData.profile.salary.currency);
            }

            // Skills array - backend expects 'skills' as an array or multiple fields
            if (formData.profile?.skills && Array.isArray(formData.profile.skills)) {
                formData.profile.skills.forEach((skill) => {
                    submissionData.append("skills", skill);
                });
            }

            // Address
            if (formData.profile?.address?.street) submissionData.append("street", formData.profile.address.street);
            if (formData.profile?.address?.city) submissionData.append("city", formData.profile.address.city);
            if (formData.profile?.address?.state) submissionData.append("state", formData.profile.address.state);
            if (formData.profile?.address?.country) submissionData.append("country", formData.profile.address.country);

            // Contact Info
            if (formData.profile?.emergencyContact1?.name) submissionData.append("emergency1Name", formData.profile.emergencyContact1.name);
            if (formData.profile?.emergencyContact1?.phone) submissionData.append("emergency1Phone", formData.profile.emergencyContact1.phone);
            if (formData.profile?.emergencyContact2?.name) submissionData.append("emergency2Name", formData.profile.emergencyContact2.name);
            if (formData.profile?.emergencyContact2?.phone) submissionData.append("emergency2Phone", formData.profile.emergencyContact2.phone);

            // Notes
            if (formData.profile?.notes) {
                const notesValue = typeof formData.profile.notes === 'string'
                    ? formData.profile.notes
                    : formData.profile.notes.type;
                if (notesValue) submissionData.append("notes", notesValue);
            }

            // Timing & Bank
            if (formData.profile?.timing?.start) submissionData.append("timing[start]", formData.profile.timing.start);
            if (formData.profile?.timing?.end) submissionData.append("timing[end]", formData.profile.timing.end);
            if (formData.profile?.bankInfo?.bankName) submissionData.append("bankInfo[bankName]", formData.profile.bankInfo.bankName);
            if (formData.profile?.bankInfo?.accountNumber) submissionData.append("bankInfo[accountNumber]", formData.profile.bankInfo.accountNumber);
            if (formData.profile?.bankInfo?.ifscCode) submissionData.append("bankInfo[ifscCode]", formData.profile.bankInfo.ifscCode);

            // Dispatch
            const updated = await dispatch(updateTeamMember({
                id: myProfile._id,
                userId: myProfile._id,
                data: submissionData
            })).unwrap();

            // 4. Sync with AuthContext to update Navbar/Sidebar
            if (updated) {
                // Ensure we merge the profile data correctly back into the auth user
                // The backend userController/authController returns a user object
                // Let's create a fresh user object for the auth slice
                const authUser = {
                    ...user,
                    name: formData.name,
                    email: formData.email,
                    phone: formData.phone,
                    profilePic: (updated as any).data?.profilePic || user?.profilePic,
                } as UserType;
                dispatch(restoreSession(authUser));
                localStorage.setItem("kriyona_user", JSON.stringify(authUser));
            }

            setIsEditing(false);
            toast.success("Profile updated successfully!");
        } catch (error) {
            toast.error("Failed to update profile.");
            console.error(error);
        }
    };

    const handleCancel = () => {
        if (myProfile) {
            setFormData(JSON.parse(JSON.stringify(myProfile)));
            setPreviewImage(myProfile.profilePic?.url || null);
            setSelectedFile(null);
        }
        setIsEditing(false);
        setFieldErrors({});
    };

    if (isLoading || !formData) {
        return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
    }

    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-col mb-3">
                <h1 className="text-2xl font-bold tracking-tight mb-0 ps-1">My Profile</h1>
                <p className="text-sm text-muted-foreground ps-1">Update your profile information here.</p>
            </div>
            {/* 1. Header Area */}
            <div className="flex flex-col md:flex-row gap-6 items-start">

                {/* LEFT: ID Card */}

                <Card className="w-full md:w-[350px] shrink-0">
                    <CardContent className="pt-6 flex flex-col items-center text-center">
                        <div className="relative mb-4 group">
                            <Avatar className="h-32 w-32 border-4 border-white shadow-lg cursor-pointer">
                                <AvatarImage src={previewImage || formData.profilePic?.url} style={{ objectFit: 'cover' }} />
                                <AvatarFallback className="text-4xl bg-slate-100 text-slate-500">
                                    {formData.name?.charAt(0)}
                                </AvatarFallback>
                            </Avatar>

                            {/* Camera Icon Overlay for Editing */}
                            {isEditing && (
                                <div
                                    className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Camera className="text-white w-8 h-8" />
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        hidden
                                        accept="image/*"
                                        onChange={handleImageChange}
                                    />
                                </div>
                            )}

                            <Badge className={`absolute bottom-0 right-0 px-3 py-1 ${formData.status === "Active" ? "bg-green-500" : "bg-amber-500"
                                }`}>
                                {formData.status}
                            </Badge>
                        </div>

                        <h2 className="text-2xl font-bold">{formData.name}</h2>
                        <p className="text-muted-foreground mb-4">{formData.email}</p>

                        <div className="w-full grid grid-cols-2 gap-2 text-sm mt-4 border-t pt-4">
                            <div className="flex flex-col p-2 bg-slate-50 rounded">
                                <span className="text-muted-foreground text-xs uppercase">Role</span>
                                <span className="font-semibold">{formData.role || "Member"}</span>
                            </div>
                            <div className="flex flex-col p-2 bg-slate-50 rounded">
                                <span className="text-muted-foreground text-xs uppercase">Joined</span>
                                <span className="font-semibold">
                                    {formData.profile?.joinedDate ? format(new Date(formData.profile.joinedDate), "MMM yyyy") : "-"}
                                </span>
                            </div>
                        </div>

                        <div className="mt-6 w-full">
                            {isEditing ? (
                                <div className="flex gap-2">
                                    <Button variant="outline" className="flex-1" onClick={handleCancel} disabled={isLoading}>
                                        <X className="w-4 h-4 mr-2" /> Cancel
                                    </Button>
                                    <Button className="flex-1" onClick={handleSave} disabled={isLoading}>
                                        {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                        Save
                                    </Button>
                                </div>
                            ) : (
                                <Button className="w-full" variant="outline" onClick={() => setIsEditing(true)}>
                                    Edit Profile
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* RIGHT: Detailed Info */}
                <div className="flex-1 w-full">
                    <Tabs defaultValue="personal" className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="personal" disabled={isLoading}>Personal Info</TabsTrigger>
                            <TabsTrigger value="professional" disabled={isLoading}>Professional</TabsTrigger>
                            <TabsTrigger value="emergency" disabled={isLoading}>Emergency</TabsTrigger>
                        </TabsList>

                        {/* TAB 1: PERSONAL */}
                        <TabsContent value="personal">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Contact Details</CardTitle>
                                    <CardDescription>Your personal contact information.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Full Name</Label>
                                            <div className="relative">
                                                <User className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    value={formData.name || ""}
                                                    onChange={(e) => handleInputChange("name", e.target.value)}
                                                    disabled={!isEditing}
                                                    className="pl-9"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Email</Label>
                                            <div className="relative">
                                                <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    value={formData.email || ""}
                                                    disabled // Email usually not editable directly
                                                    className="pl-9 bg-slate-50"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Phone Number</Label>
                                            <div className="relative">
                                                <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    value={formData.phone || ""}
                                                    onChange={(e) => {
                                                        const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                                                        handleInputChange("phone", val);
                                                    }}
                                                    disabled={!isEditing}
                                                    className={cn("pl-9", fieldErrors.phone && "border-red-500")}
                                                    placeholder="9876543210"
                                                    type="tel"
                                                />
                                            </div>
                                            {fieldErrors.phone && <p className="text-[10px] text-red-500 font-medium mt-1">{fieldErrors.phone}</p>}
                                        </div>
                                    </div>

                                    <Separator className="my-2" />

                                    <div className="space-y-2">
                                        <Label>Address</Label>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <Input
                                                placeholder="Street"
                                                value={formData.profile?.address?.street || ""}
                                                onChange={(e) => handleInputChange("profile.address.street", e.target.value)}
                                                disabled={!isEditing}
                                                className="col-span-1 md:col-span-2"
                                            />
                                            <Input
                                                placeholder="City"
                                                value={formData.profile?.address?.city || ""}
                                                onChange={(e) => handleInputChange("profile.address.city", e.target.value)}
                                                disabled={!isEditing}
                                            />
                                            <Input
                                                placeholder="State"
                                                value={formData.profile?.address?.state || ""}
                                                onChange={(e) => handleInputChange("profile.address.state", e.target.value)}
                                                disabled={!isEditing}
                                            />
                                            <Input
                                                placeholder="Country"
                                                value={formData.profile?.address?.country || ""}
                                                onChange={(e) => handleInputChange("profile.address.country", e.target.value)}
                                                disabled={!isEditing}
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* TAB 2: PROFESSIONAL */}
                        <TabsContent value="professional">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Work Profile</CardTitle>
                                    <CardDescription>Skills, role, and compensation information.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Specialization</Label>
                                            <div className="relative">
                                                <Briefcase className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    value={formData.profile?.specialization || ""}
                                                    disabled // Admin assigns this
                                                    className="pl-9 bg-slate-50"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Experience</Label>
                                            <Input
                                                value={formData.profile?.experience || ""}
                                                onChange={(e) => handleInputChange("profile.experience", e.target.value)}
                                                disabled={!isEditing}
                                                placeholder="e.g. 5 Years"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Skills (Comma separated)</Label>
                                        <Textarea
                                            value={formData.profile?.skills?.join(", ") || ""}
                                            onChange={(e) => {
                                                const skillsArray = e.target.value.split(",").map(s => s.trim());
                                                handleInputChange("profile.skills", skillsArray);
                                            }}
                                            disabled={!isEditing}
                                            placeholder=""
                                        />
                                    </div>

                                    {/* SALARY (Private) */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-white border border-slate-200 p-4 rounded-lg">
                                            <div className="flex items-center justify-between">
                                                <div className="flex flex-col gap-1">
                                                    <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">
                                                        Salary
                                                    </p>
                                                    <p className="text-lg font-semibold text-slate-900">
                                                        ₹{formData.profile?.salary?.amount ?? 0}
                                                        <span className="text-sm font-normal text-slate-500 ml-1">
                                                            / {formData.profile?.salary?.currency || "INR"}
                                                        </span>
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-white border border-slate-200 p-4 rounded-lg space-y-2">
                                            <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">
                                                Work Timing
                                            </p>
                                            <div className="flex gap-2">
                                                <div className="flex-1">
                                                    <Label className="text-[10px]">Start</Label>
                                                    <Input
                                                        value={formData.profile?.timing?.start || "9:00 AM"}
                                                        onChange={(e) => handleInputChange("profile.timing.start", e.target.value)}
                                                        disabled={!isEditing}
                                                        className="h-8 text-xs"
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <Label className="text-[10px] text-right block">End</Label>
                                                    <Input
                                                        value={formData.profile?.timing?.end || "7:00 PM"}
                                                        onChange={(e) => handleInputChange("profile.timing.end", e.target.value)}
                                                        disabled={!isEditing}
                                                        className="h-8 text-xs"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-sm font-semibold border-b pb-2">Bank Account Information</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <Label>Bank Name</Label>
                                                <Input
                                                    value={formData.profile?.bankInfo?.bankName || ""}
                                                    onChange={(e) => handleInputChange("profile.bankInfo.bankName", e.target.value)}
                                                    disabled={!isEditing}
                                                    placeholder="e.g. HDFC Bank"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label>Account Number</Label>
                                                <Input
                                                    value={formData.profile?.bankInfo?.accountNumber || ""}
                                                    onChange={(e) => handleInputChange("profile.bankInfo.accountNumber", e.target.value)}
                                                    disabled={!isEditing}
                                                    placeholder="Account Number"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label>IFSC Code</Label>
                                                <Input
                                                    value={formData.profile?.bankInfo?.ifscCode || ""}
                                                    onChange={(e) => handleInputChange("profile.bankInfo.ifscCode", e.target.value)}
                                                    disabled={!isEditing}
                                                    placeholder="IFSC Code"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Notes</Label>
                                        <Textarea
                                            value={typeof formData.profile?.notes === 'string' ? formData.profile.notes : formData.profile?.notes?.type || ""}
                                            onChange={(e) => handleInputChange("profile.notes.type", e.target.value)}
                                            disabled={!isEditing}
                                            placeholder="Additional notes..."
                                            className="min-h-[100px]"
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* TAB 3: EMERGENCY */}
                        <TabsContent value="emergency">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Emergency Contacts</CardTitle>
                                    <CardDescription>Who to call in case of emergency.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-4 border p-4 rounded-md">
                                        <h4 className="font-semibold text-sm">Primary Contact</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <Label>Name</Label>
                                                <Input
                                                    value={formData.profile?.emergencyContact1?.name || ""}
                                                    onChange={(e) => handleInputChange("profile.emergencyContact1.name", e.target.value)}
                                                    disabled={!isEditing}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label>Phone</Label>
                                                <Input
                                                    value={formData.profile?.emergencyContact1?.phone || ""}
                                                    onChange={(e) => {
                                                        const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                                                        handleInputChange("profile.emergencyContact1.phone", val);
                                                    }}
                                                    disabled={!isEditing}
                                                    className={cn(fieldErrors["profile.emergencyContact1.phone"] && "border-red-500")}
                                                    type="tel"
                                                    placeholder="9876543210"
                                                />
                                                {fieldErrors["profile.emergencyContact1.phone"] && <p className="text-[10px] text-red-500 font-medium mt-1">{fieldErrors["profile.emergencyContact1.phone"]}</p>}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4 border p-4 rounded-md">
                                        <h4 className="font-semibold text-sm">Secondary Contact</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <Label>Name</Label>
                                                <Input
                                                    value={formData.profile?.emergencyContact2?.name || ""}
                                                    onChange={(e) => handleInputChange("profile.emergencyContact2.name", e.target.value)}
                                                    disabled={!isEditing}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label>Phone</Label>
                                                <Input
                                                    value={formData.profile?.emergencyContact2?.phone || ""}
                                                    onChange={(e) => {
                                                        const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                                                        handleInputChange("profile.emergencyContact2.phone", val);
                                                    }}
                                                    disabled={!isEditing}
                                                    className={cn(fieldErrors["profile.emergencyContact2.phone"] && "border-red-500")}
                                                    type="tel"
                                                    placeholder="9123456789"
                                                />
                                                {fieldErrors["profile.emergencyContact2.phone"] && <p className="text-[10px] text-red-500 font-medium mt-1">{fieldErrors["profile.emergencyContact2.phone"]}</p>}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                    </Tabs>
                </div>
            </div>

            {/* Attendance & Salary Ledger Section */}
            <Separator className="my-8" />
            
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-bold tracking-tight flex items-center gap-2 text-slate-800">
                            <Calendar className="h-5 w-5 text-primary" />
                            Attendance & Salary Ledger
                        </h2>
                        <p className="text-xs text-muted-foreground mt-1">
                            Track your monthly wallet, attendance records, and clock-in logs.
                        </p>
                    </div>
                    
                    {/* Month/Year Filters */}
                    <div className="flex items-center gap-2">
                        <Select
                            value={String(selectedMonth)}
                            onValueChange={(val) => setSelectedMonth(Number(val))}
                        >
                            <SelectTrigger className="w-[140px] h-9">
                                <SelectValue placeholder="Select Month" />
                            </SelectTrigger>
                            <SelectContent>
                                {MONTHS.map((m) => (
                                    <SelectItem key={m.value} value={String(m.value)}>
                                        {m.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        
                        <Select
                            value={String(selectedYear)}
                            onValueChange={(val) => setSelectedYear(Number(val))}
                        >
                            <SelectTrigger className="w-[100px] h-9">
                                <SelectValue placeholder="Select Year" />
                            </SelectTrigger>
                            <SelectContent>
                                {YEARS.map((y) => (
                                    <SelectItem key={y} value={String(y)}>
                                        {y}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Monthly Wallet Card (1/3 width) */}
                    <div className="lg:col-span-4 h-full">
                        {walletData ? (
                            <WalletCard data={walletData} isLoading={loadingLogs} />
                        ) : (
                            <Card className="h-full border-slate-200 shadow-sm flex items-center justify-center p-6 text-center text-slate-400 text-xs italic bg-white min-h-[200px]">
                                No wallet statistics available for this period.
                            </Card>
                        )}
                    </div>

                    {/* Attendance Logs Table (2/3 width) */}
                    <Card className="lg:col-span-8 shadow-sm border-slate-200 bg-white">
                        <CardHeader className="py-4 px-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                Logs for {MONTHS.find(m => m.value === selectedMonth)?.label} {selectedYear}
                            </CardTitle>
                            
                            {/* Search & Status Filter */}
                            <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
                                <div className="relative w-full sm:w-[180px]">
                                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                                    <Input
                                        placeholder="Search date..."
                                        value={dateSearch}
                                        onChange={(e) => setDateSearch(e.target.value)}
                                        className="pl-8 h-8 text-xs w-full"
                                    />
                                </div>
                                
                                <Select
                                    value={statusFilter}
                                    onValueChange={setStatusFilter}
                                >
                                    <SelectTrigger className="w-full sm:w-[130px] h-8 text-xs">
                                        <SelectValue placeholder="All Days" />
                                    </SelectTrigger>
                                    <SelectContent className="text-xs">
                                        <SelectItem value="all">All Days</SelectItem>
                                        <SelectItem value="present">Present</SelectItem>
                                        <SelectItem value="leave">Leaves</SelectItem>
                                        <SelectItem value="sunday">Sundays</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardHeader>

                        <CardContent className="p-0">
                            {loadingLogs ? (
                                <div className="h-64 flex items-center justify-center">
                                    <Loader2 className="animate-spin text-slate-400 h-8 w-8" />
                                </div>
                            ) : ledgerDays.length > 0 ? (
                                <div className="overflow-x-auto max-h-[350px] custom-scrollbar">
                                    <Table>
                                        <TableHeader className="bg-slate-50 sticky top-0 z-10">
                                            <TableRow>
                                                <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 py-3 pl-5">Date</TableHead>
                                                <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 py-3">Status</TableHead>
                                                <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 py-3">Clock In</TableHead>
                                                <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 py-3">Clock Out</TableHead>
                                                <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 py-3 pr-5 text-right">Hours</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody className="divide-y divide-slate-100">
                                            {ledgerDays.map((day, idx) => {
                                                const getBadgeStyle = (status: string) => {
                                                    switch (status) {
                                                        case "Full Day":
                                                            return "bg-emerald-50 text-emerald-700 border-emerald-100";
                                                        case "Half Day":
                                                            return "bg-amber-50 text-amber-700 border-amber-100";
                                                        case "Leave":
                                                            return "bg-rose-50 text-rose-700 border-rose-100";
                                                        case "Sunday":
                                                            return "bg-slate-100 text-slate-600 border-slate-200";
                                                        default:
                                                            return "bg-slate-50 text-slate-500 border-slate-100";
                                                    }
                                                };

                                                return (
                                                    <TableRow key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                        <TableCell className="font-semibold text-xs text-slate-900 py-3 pl-5">
                                                            <div className="flex flex-col">
                                                                <span>{format(day.date, "MMMM do")}</span>
                                                                <span className="text-[10px] font-medium text-slate-400">{format(day.date, "eeee")}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="py-3">
                                                            <span className={cn(
                                                                "text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border",
                                                                getBadgeStyle(day.status)
                                                            )}>
                                                                {day.status}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="text-xs text-slate-600 font-medium py-3">
                                                            <div className="flex items-center gap-1">
                                                                {day.status === "Full Day" || day.status === "Half Day" ? (
                                                                    <>
                                                                        <Clock className="h-3 w-3 text-emerald-500" />
                                                                        <span>{formatTimeString(day.startTime)}</span>
                                                                    </>
                                                                ) : "—"}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-xs text-slate-600 font-medium py-3">
                                                            <div className="flex items-center gap-1">
                                                                {day.status === "Full Day" || day.status === "Half Day" ? (
                                                                    <>
                                                                        <Clock className="h-3 w-3 text-rose-400" />
                                                                        <span>{formatTimeString(day.endTime)}</span>
                                                                    </>
                                                                ) : "—"}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-xs font-bold text-slate-950 py-3 pr-5 text-right">
                                                            {day.totalHours > 0 ? `${day.totalHours} hrs` : "—"}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                                <div className="h-64 flex flex-col items-center justify-center text-center">
                                    <div className="h-12 w-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                                        <Calendar className="h-6 w-6 text-slate-300" />
                                    </div>
                                    <h3 className="text-sm font-semibold text-slate-900">No logs found</h3>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Try adjusting your search criteria or selecting a different month.
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
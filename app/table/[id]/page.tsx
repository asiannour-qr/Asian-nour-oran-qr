// app/table/[id]/page.tsx
"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import { toastAddedToCart } from "@/lib/cart-toast";
import TableLandingView from "@/app/components/TableLandingView";
import OrderConfirmedModal from "@/app/components/OrderConfirmedModal";
import { getOrCreateTableDeviceId } from "@/lib/table-device-id";
import {
    clearOrderingSessionActive,
    isOrderingSessionActive,
    markOrderingSessionActive,
} from "@/lib/table-ordering-session";
import { getStaffTableDeviceId } from "@/lib/staff-table-device";
import {
    guestNameFallback,
    guestNameFromMap,
    sanitizeGuestNameInput,
    sanitizeGuestNamesRecord,
} from "@/lib/guest-name-utils";
import {
    getDefaultGuestNames,
    persistGuestNamesForTable,
    resetGuestNames as resetGuestNamesForTable,
} from "@/lib/guest-names-store";
import CategorySlider from "@/app/components/CategorySlider";
import CompactCartBar from "@/app/components/CompactCartBar";
import { MenuCardFullscreenOverlay } from "@/app/components/MenuCardFullscreenOverlay";
import { ConfirmActionModal } from "@/app/components/ConfirmActionModal";
import FormulaMenuCard, { FormulaMenuGrid } from "@/app/components/FormulaMenuCard";
import FormulaSectionHeading from "@/app/components/FormulaSectionHeading";
import ColdMenuDrinkModal from "@/app/components/ColdMenuDrinkModal";
import { isColdMenuItem } from "@/lib/cold-menus";
import {
    COLD_MENUS_SECTION_ID,
    HOT_MENUS_SECTION_ID,
    HOT_MENUS_SLIDER_LABEL,
    COLD_MENUS_SLIDER_LABEL,
    isFormulaMenuCategory,
} from "@/lib/menu-formula-nav";
import { formatMoney } from "@/lib/currency";
import { buildKitchenItemLabel } from "@/lib/kitchen-item-label";
import SupplementPicker, { type SupplementDef } from "@/app/components/SupplementPicker";
import { isSupplementableCategory } from "@/lib/supplements";

type MenuItem = {
    id: string;
    name: string;
    priceCents: number;
    category: string;
    position: number;
    description?: string | null;
    imageUrl?: string | null;
    available?: boolean;
};
type CartLine = {
    id: string;
    name: string;
    priceCents: number;
    qty: number;
    personId: string;
    supplements?: SupplementDef[];
};

function supplementSignature(supps: SupplementDef[]): string {
    return supps.map((s) => `${s.label}:${s.priceCents}`).join(",");
}
type MenuGroup = { id: string; name: string; categoryFilter: string; minChoices: number; maxChoices: number; position: number };
type MenuDef = { id: string; name: string; priceCents: number; imageUrl?: string | null; groups?: MenuGroup[] };
type ComposeStep = {
    group: MenuGroup;
    options: MenuItem[];
    includeCategory: boolean;
    minChoices: number;
    maxChoices: number;
    multi: boolean;
    xorKey?: string | null;
    displayCategory: string;
};
type ComposeState = {
    menu: MenuDef;
    steps: ComposeStep[];
    selectionMap: Record<string, string[]>;
};

// 🔹 alias tolérés pour rattraper Starter/Silver/Gold
const CAT_ALIASES: Record<string, string | string[]> = {
    "Starter": "Plats Starter",
    "Silver": "Plats Silver",
    "Gold": "Plats Gold",
    "starter": "Plats Starter",
    "silver": "Plats Silver",
    "gold": "Plats Gold",
    "Entrée / Yakitoris": ["Entrées", "Yakitoris (2 pièces)"],
    "Entrée/Yakitoris": ["Entrées", "Yakitoris (2 pièces)"],
    "Entrée ou Yakitoris": ["Entrées", "Yakitoris (2 pièces)"],
    "Entrée": "Entrées",
    "entrée": "Entrées",
    "Yakitoris": "Yakitoris (2 pièces)",
    "Entrée (2 pièces)": "Entrées",
    "Accompagnement": "Accompagnements",
    "Goûter": "Desserts",
};

const HIDDEN_MENU_CATEGORIES = new Set([
    "Boissons Kid",
    "Desserts Kid",
    "Entrée Kid’s",
    "Plats Starter Kid",
]);

function slugifyCategory(value: string, fallback: string) {
    const base = value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return base || fallback;
}

function readTableUrlFlags() {
    if (typeof window === "undefined") {
        return { staff: false, order: false, carteView: false };
    }
    const params = new URLSearchParams(window.location.search);
    const staff = params.get("staff") === "1";
    const order = params.get("order") === "1";
    return {
        staff,
        order: order || staff,
        carteView: !staff && params.get("view") === "carte",
    };
}

export default function TablePage() {
    // ⚠️ dossier = app/table/[id] : le param s’appelle "id"
    const params = useParams<{ id: string }>();
    const tableId = params?.id ?? "1";
    const router = useRouter();
    const [orderMode, setOrderMode] = useState(() => readTableUrlFlags().order);
    const [readOnlyMode, setReadOnlyMode] = useState(() => readTableUrlFlags().carteView);
    const [staffMode, setStaffMode] = useState(() => readTableUrlFlags().staff);
    const [deviceId, setDeviceId] = useState("");
    const [masterStatus, setMasterStatus] = useState({
        hasMaster: false,
        isMaster: false,
        masterType: null as "staff" | "client" | null,
        loading: true,
    });
    const [claimingMaster, setClaimingMaster] = useState(false);
    const [releasingMaster, setReleasingMaster] = useState(false);
    const [staffClaimError, setStaffClaimError] = useState<string | null>(null);
    const staffClaimInFlightRef = useRef(false);
    const staffClaimAttemptsRef = useRef(0);
    const staffAutoClaimStartedRef = useRef(false);
    const takeChargeRef = useRef<(options?: { force?: boolean; silent?: boolean }) => Promise<void>>(
        async () => {}
    );
    const idleTableResetDoneRef = useRef(false);
    const clientBootstrapDoneRef = useRef(false);
    const sessionCleanupRef = useRef({
        reset: () => {},
        clearDraft: async () => {},
    });

    useEffect(() => {
        setDeviceId(getOrCreateTableDeviceId());
    }, []);

    const syncModeFromUrl = useCallback(() => {
        if (typeof window === "undefined") return;
        const urlParams = new URLSearchParams(window.location.search);
        const isStaff = urlParams.get("staff") === "1";
        if (isStaff) {
            setStaffMode(true);
            setOrderMode(true);
            setReadOnlyMode(false);
        }
        if (urlParams.get("order") === "1") {
            setOrderMode(true);
            if (!isStaff && urlParams.get("view") === "carte") setReadOnlyMode(true);
        }
    }, []);

    useLayoutEffect(() => {
        clientBootstrapDoneRef.current = false;
        staffAutoClaimStartedRef.current = false;
        staffClaimAttemptsRef.current = 0;
        setStaffClaimError(null);
        const flags = readTableUrlFlags();
        setStaffMode(flags.staff);
        setOrderMode(flags.order);
        if (flags.staff) {
            setReadOnlyMode(false);
        } else if (flags.carteView) {
            setReadOnlyMode(true);
        }
    }, [tableId]);

    useEffect(() => {
        syncModeFromUrl();
    }, [syncModeFromUrl, tableId]);

    const enterOrderMode = useCallback(
        (options?: { readOnly?: boolean; silent?: boolean }) => {
            setOrderMode(true);
            setReadOnlyMode(staffMode ? false : options?.readOnly === true);
            if (!options?.silent) {
                const query = staffMode
                    ? "?staff=1&order=1"
                    : options?.readOnly
                      ? "?order=1&view=carte"
                      : "?order=1";
                router.replace(`/table/${tableId}${query}`, { scroll: true });
                window.requestAnimationFrame(() => syncModeFromUrl());
            }
        },
        [router, staffMode, syncModeFromUrl, tableId]
    );

    const activeDeviceId = staffMode
        ? getStaffTableDeviceId(tableId)
        : deviceId;
    const staffDeviceId = getStaffTableDeviceId(tableId);

    const refreshMasterStatus = useCallback(async () => {
        if (!activeDeviceId) return;
        try {
            const res = await fetch(
                `/api/tables/${tableId}/master?deviceId=${encodeURIComponent(activeDeviceId)}`,
                { cache: "no-store" }
            );
            const data = await res.json();
            if (data.ok) {
                setMasterStatus({
                    hasMaster: Boolean(data.hasMaster),
                    isMaster: Boolean(data.isMaster),
                    masterType:
                        data.masterType === "staff" || data.masterType === "client"
                            ? data.masterType
                            : null,
                    loading: false,
                });
            } else {
                setMasterStatus((prev) => ({ ...prev, loading: false }));
            }
        } catch {
            setMasterStatus((prev) => ({ ...prev, loading: false }));
        }
    }, [activeDeviceId, tableId]);

    useEffect(() => {
        if (!activeDeviceId) return;
        if (
            !staffMode &&
            !clientBootstrapDoneRef.current &&
            !isOrderingSessionActive(tableId)
        ) {
            return;
        }
        void refreshMasterStatus();
    }, [activeDeviceId, refreshMasterStatus, staffMode, tableId]);

    useEffect(() => {
        if (!staffMode || !activeDeviceId) return;
        void refreshMasterStatus();
        const id = setInterval(() => {
            void refreshMasterStatus();
        }, 2500);
        return () => clearInterval(id);
    }, [staffMode, activeDeviceId, refreshMasterStatus]);

    useEffect(() => {
        if (orderMode || staffMode || !activeDeviceId) return;
        const waitingForMaster = masterStatus.hasMaster && !masterStatus.isMaster;
        const waitingForStaffRelease =
            waitingForMaster && masterStatus.masterType === "staff";
        const intervalMs = waitingForStaffRelease ? 1000 : waitingForMaster ? 2000 : 5000;
        const id = setInterval(() => {
            void refreshMasterStatus();
        }, intervalMs);
        return () => clearInterval(id);
    }, [
        orderMode,
        staffMode,
        activeDeviceId,
        masterStatus.hasMaster,
        masterStatus.isMaster,
        masterStatus.masterType,
        refreshMasterStatus,
    ]);

    useEffect(() => {
        if (!orderMode) return;
        const waitingForMaster = masterStatus.hasMaster && !masterStatus.isMaster;
        const waitingForStaffRelease =
            waitingForMaster && masterStatus.masterType === "staff";
        const intervalMs = masterStatus.isMaster
            ? 3000
            : waitingForStaffRelease
              ? 1000
              : waitingForMaster
                ? 2000
                : 20000;
        const id = setInterval(() => {
            void refreshMasterStatus();
        }, intervalMs);
        return () => clearInterval(id);
    }, [
        orderMode,
        masterStatus.hasMaster,
        masterStatus.isMaster,
        masterStatus.masterType,
        refreshMasterStatus,
    ]);

    useEffect(() => {
        if (staffMode) {
            setReadOnlyMode(false);
            return;
        }
        if (!orderMode || masterStatus.loading) return;
        if (masterStatus.isMaster) {
            setReadOnlyMode(false);
        } else if (masterStatus.hasMaster) {
            setReadOnlyMode(true);
        } else {
            setReadOnlyMode(false);
        }
    }, [orderMode, staffMode, masterStatus.hasMaster, masterStatus.isMaster, masterStatus.loading]);

    const staffQuery = staffMode ? "?staff=1" : "";

    const browseMenu = useCallback(() => {
        enterOrderMode({ readOnly: !staffMode });
    }, [enterOrderMode, staffMode]);

    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [menus, setMenus] = useState<MenuDef[]>([]);
    const [loading, setLoading] = useState(true);

    const [cart, setCart] = useState<CartLine[]>([]);
    const [peopleCount, setPeopleCount] = useState<number>(1);
    const [composeState, setComposeState] = useState<ComposeState | null>(null);
    const [coldMenuPick, setColdMenuPick] = useState<MenuItem | null>(null);
    const [allowedSupplements, setAllowedSupplements] = useState<SupplementDef[]>([]);
    const [supplementTarget, setSupplementTarget] = useState<MenuItem | null>(null);

    useEffect(() => {
        fetch("/api/supplements", { cache: "no-store" })
            .then((r) => r.json())
            .then((data) => {
                if (Array.isArray(data?.supplements)) setAllowedSupplements(data.supplements);
            })
            .catch(() => {});
    }, []);
    const [composeErrors, setComposeErrors] = useState<Record<string, string>>({});
    const [activePerson, setActivePerson] = useState<string>("P1");
    const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
    const [expandedPersons, setExpandedPersons] = useState<Set<string>>(() => new Set());
    const [tableComment, setTableComment] = useState("");
    const [guestNames, setGuestNames] = useState<Record<string, string>>(() => getDefaultGuestNames(1));
    const guestNamesStorageKey = useMemo(() => `guestNames:table:${tableId}`, [tableId]);
    const guestNamesPersistedRef = useRef<Record<string, string>>({});
    const [showGuestNameEditor, setShowGuestNameEditor] = useState(false);
    const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
    const inlineInputRef = useRef<HTMLInputElement>(null);
    const previousPeopleCountRef = useRef<number>(peopleCount);
    const cartScrollRef = useRef<HTMLDivElement>(null);
    const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
    const [activeFormulaId, setActiveFormulaId] = useState<string | null>(HOT_MENUS_SECTION_ID);
    const [orderConfirmedOpen, setOrderConfirmedOpen] = useState(false);
    const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
    const [menuCardOpen, setMenuCardOpen] = useState(false);
    const [draftReady, setDraftReady] = useState(false);
    const draftLoadKeyRef = useRef("");
    const cartRef = useRef(cart);
    cartRef.current = cart;
    const masterStatusRef = useRef(masterStatus);
    masterStatusRef.current = masterStatus;
    const draftPayloadRef = useRef<{
        deviceId: string;
        items: Array<{ id: string; name: string; priceCents: number; qty: number; personId: string; supplements?: SupplementDef[] }>;
        peopleCount: number;
        tableComment: string | null;
        guestNames: Record<string, string>;
    } | null>(null);

    const applyDraftFromPayload = useCallback(
        (
            draft: {
                items?: CartLine[];
                peopleCount?: number;
                tableComment?: string | null;
                guestNames?: Record<string, string>;
            } | null
            | undefined,
            options?: { toast?: boolean }
        ) => {
            if (!draft) return false;
            const lines = Array.isArray(draft.items) ? draft.items : [];
            let applied = false;

            if (lines.length > 0) {
                setCart(
                    lines.map((line) => ({
                        id: String(line.id),
                        name: String(line.name),
                        priceCents: Number(line.priceCents) || 0,
                        qty: Number(line.qty) || 1,
                        personId: String(line.personId || "P1"),
                        supplements: Array.isArray(line.supplements) ? line.supplements : undefined,
                    }))
                );
                applied = true;
                if (options?.toast && staffMode) {
                    const itemCount = lines.reduce(
                        (sum, line) => sum + (Number(line.qty) || 0),
                        0
                    );
                    if (itemCount > 0) {
                        toast.success(
                            `Panier client repris (${itemCount} article${itemCount > 1 ? "s" : ""}).`
                        );
                    }
                }
            }

            if (typeof draft.peopleCount === "number") {
                const nextPeople = Math.max(1, Math.min(12, Math.round(draft.peopleCount)));
                setPeopleCount(nextPeople);
                previousPeopleCountRef.current = nextPeople;
                if (typeof window !== "undefined") {
                    window.localStorage.setItem(`table:${tableId}:people`, String(nextPeople));
                }
                applied = true;
                if (
                    options?.toast &&
                    staffMode &&
                    lines.length === 0 &&
                    nextPeople > 1
                ) {
                    toast.success(`Convives repris (${nextPeople} personnes).`);
                }
            }
            if (typeof draft.tableComment === "string") {
                setTableComment(draft.tableComment);
                applied = true;
            }
            if (draft.guestNames && typeof draft.guestNames === "object") {
                const count =
                    typeof draft.peopleCount === "number"
                        ? Math.max(1, Math.min(12, Math.round(draft.peopleCount)))
                        : peopleCount;
                const sanitized = sanitizeGuestNamesRecord(
                    draft.guestNames as Record<string, string>,
                    { count }
                );
                setGuestNames(sanitized);
                guestNamesPersistedRef.current = sanitized;
                applied = true;
            }

            return applied;
        },
        [peopleCount, staffMode, tableId]
    );

    const fetchDraftFromServer = useCallback(
        async (options?: { toast?: boolean }) => {
            try {
                const res = await fetch(`/api/tables/${tableId}/draft-cart`, { cache: "no-store" });
                const data = await res.json();
                const draft = data?.draft;
                if (draft) {
                    applyDraftFromPayload(draft, { toast: options?.toast });
                    return draft;
                }
            } catch {
                // ignore
            }
            return null;
        },
        [applyDraftFromPayload, tableId]
    );

    const showOrderUi = staffMode || orderMode;

    const pushDraftCartNow = useCallback(async () => {
        const payload = draftPayloadRef.current;
        if (!payload?.deviceId) return;
        try {
            await fetch(`/api/tables/${tableId}/draft-cart`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                keepalive: true,
            });
        } catch {
            // best effort
        }
    }, [tableId]);

    const callReleaseMasterApi = useCallback(async () => {
        if (!activeDeviceId) {
            return { ok: false as const, status: 0, message: "Appareil non prêt." };
        }
        try {
            const res = await fetch(`/api/tables/${tableId}/master`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({ deviceId: activeDeviceId }),
            });
            const data = await res.json().catch(() => ({}));
            return {
                ok: res.ok as boolean,
                status: res.status,
                message: typeof data?.message === "string" ? data.message : undefined,
            };
        } catch {
            return { ok: false as const, status: 0, message: "Erreur réseau." };
        }
    }, [activeDeviceId, tableId]);

    const canModifyCart = staffMode
        ? masterStatus.isMaster
        : masterStatus.isMaster && !readOnlyMode;
    const canReleaseStaffTable =
        staffMode &&
        (masterStatus.isMaster || masterStatus.masterType === "staff" || masterStatus.hasMaster);
    const canSyncDraft = Boolean(activeDeviceId) && masterStatus.isMaster;
    const staffConnecting =
        staffMode && !masterStatus.isMaster && (masterStatus.loading || claimingMaster);

    const releaseMaster = useCallback(async () => {
        if (!activeDeviceId || releasingMaster) return;
        setReleasingMaster(true);
        try {
            if (masterStatusRef.current.isMaster) {
                await Promise.race([
                    pushDraftCartNow(),
                    new Promise<void>((resolve) => window.setTimeout(resolve, 2500)),
                ]);
            }
            const result = await callReleaseMasterApi();
            if (!result.ok) {
                const message =
                    staffMode && result.status === 401
                        ? "Session serveur expirée — retournez à l'écran serveur pour vous reconnecter."
                        : result.message || "Impossible de libérer la commande.";
                toast.error(message);
                return;
            }
            setMasterStatus({ hasMaster: false, isMaster: false, masterType: null, loading: false });
            draftLoadKeyRef.current = "";
            setDraftReady(false);
            if (staffMode) {
                toast.success(
                    "Main rendue à la table. Les convives peuvent reprendre la gestion et envoyer en cuisine."
                );
                router.push("/serveur");
                return;
            }
            setReadOnlyMode(true);
            toast.success(
                "Relais passé. Reprenez la gestion ou laissez un autre convive appuyer sur « Je gère la commande »."
            );
        } catch {
            toast.error("Erreur lors de la libération.");
        } finally {
            setReleasingMaster(false);
        }
    }, [
        activeDeviceId,
        callReleaseMasterApi,
        pushDraftCartNow,
        releasingMaster,
        router,
        staffMode,
    ]);

    const releaseMasterSilent = useCallback(async () => {
        if (!activeDeviceId) return;
        if (!staffMode && !masterStatusRef.current.isMaster) return;
        try {
            if (staffMode || masterStatusRef.current.isMaster) {
                if (masterStatusRef.current.isMaster) {
                    await Promise.race([
                        pushDraftCartNow(),
                        new Promise<void>((resolve) => window.setTimeout(resolve, 1500)),
                    ]);
                }
                await callReleaseMasterApi();
            }
            if (!staffMode) {
                clearOrderingSessionActive(tableId);
                await sessionCleanupRef.current.clearDraft();
                sessionCleanupRef.current.reset();
            }
        } catch {
            // best effort
        }
    }, [activeDeviceId, callReleaseMasterApi, pushDraftCartNow, staffMode, tableId]);

    const showLanding = useCallback(() => {
        if (staffMode) {
            void releaseMasterSilent().finally(() => {
                router.push("/serveur");
            });
            return;
        }
        setOrderMode(false);
        setReadOnlyMode(false);
        router.replace(`/table/${tableId}${staffQuery}`, { scroll: true });
    }, [releaseMasterSilent, router, staffMode, staffQuery, tableId]);

    useEffect(() => {
        if (staffMode || !masterStatus.isMaster) return;

        const onLeave = (event: PageTransitionEvent) => {
            if (event.persisted) return;
            void releaseMasterSilent();
        };

        window.addEventListener("pagehide", onLeave);
        return () => {
            window.removeEventListener("pagehide", onLeave);
        };
    }, [masterStatus.isMaster, releaseMasterSilent, staffMode]);

    const takeCharge = useCallback(async (options?: { force?: boolean; silent?: boolean }) => {
        if (!activeDeviceId) {
            if (!options?.silent) {
                toast.error("Chargement en cours… Réessayez dans une seconde.");
            }
            return;
        }

        if (!options?.force && !staffMode && masterStatusRef.current.isMaster) {
            enterOrderMode({ silent: options?.silent });
            if (!options?.silent) {
                toast.success("Vous reprenez la commande pour cette table.");
            }
            return;
        }

        if (!staffMode && !options?.silent && !masterStatusRef.current.hasMaster) {
            await sessionCleanupRef.current.clearDraft();
            sessionCleanupRef.current.reset();
        }

        setClaimingMaster(true);
        if (staffMode) {
            setStaffClaimError(null);
        }
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 15000);
        try {
            const res = await fetch(`/api/tables/${tableId}/master`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    deviceId: activeDeviceId,
                    force: options?.force === true || staffMode,
                }),
                signal: controller.signal,
            });
            const data = await res.json();
            if (!res.ok) {
                const message =
                    staffMode && res.status === 401
                        ? "Session serveur expirée — reconnectez-vous depuis l'écran serveur."
                        : data?.message || "Un autre téléphone gère déjà la commande.";
                if (staffMode) {
                    setStaffClaimError(message);
                }
                if (staffMode && res.status === 401) {
                    toast.error(message);
                } else if (!options?.silent) {
                    toast.error(message);
                }
                void refreshMasterStatus();
                return;
            }
            if (staffMode) {
                setStaffClaimError(null);
                staffClaimAttemptsRef.current = 0;
            }
            if (staffMode) {
                if (data.draft) {
                    applyDraftFromPayload(data.draft, { toast: true });
                }
                draftLoadKeyRef.current = `${tableId}:${staffDeviceId}`;
                setDraftReady(true);
                void fetchDraftFromServer({ toast: true });
            } else if (data.draft) {
                applyDraftFromPayload(data.draft, { toast: false });
                draftLoadKeyRef.current = activeDeviceId ? `${tableId}:${activeDeviceId}` : "";
                setDraftReady(true);
            } else {
                draftLoadKeyRef.current = activeDeviceId ? `${tableId}:${activeDeviceId}` : "";
                setDraftReady(true);
            }
            setMasterStatus({
                hasMaster: true,
                isMaster: true,
                masterType: staffMode ? "staff" : "client",
                loading: false,
            });
            if (!staffMode) {
                markOrderingSessionActive(tableId);
            }
            enterOrderMode({ silent: options?.silent });
            if (!options?.silent) {
                toast.success(
                    staffMode
                        ? "Mode serveur — vous gérez la commande pour cette table."
                        : "Vous gérez la commande pour cette table."
                );
            }
        } catch (err: unknown) {
            const aborted = err instanceof DOMException && err.name === "AbortError";
            const message = aborted
                ? "Délai dépassé — vérifiez la connexion et réessayez."
                : "Impossible de prendre la commande.";
            if (staffMode) {
                setStaffClaimError(message);
            }
            if (!options?.silent) {
                toast.error(message);
            }
        } finally {
            window.clearTimeout(timeoutId);
            setClaimingMaster(false);
        }
    }, [
        activeDeviceId,
        applyDraftFromPayload,
        enterOrderMode,
        fetchDraftFromServer,
        refreshMasterStatus,
        staffMode,
        staffDeviceId,
        tableId,
    ]);

    takeChargeRef.current = takeCharge;

    useEffect(() => {
        if (!staffMode || !activeDeviceId) {
            staffAutoClaimStartedRef.current = false;
            return;
        }
        if (masterStatus.isMaster) {
            staffClaimAttemptsRef.current = 0;
            setStaffClaimError(null);
            return;
        }
        if (masterStatus.loading || staffClaimInFlightRef.current || staffAutoClaimStartedRef.current) return;

        staffAutoClaimStartedRef.current = true;

        let cancelled = false;
        let retryTimer: number | undefined;

        const runClaim = async () => {
            if (cancelled || masterStatusRef.current.isMaster || staffClaimInFlightRef.current) return;
            staffClaimInFlightRef.current = true;
            staffClaimAttemptsRef.current += 1;
            try {
                await takeChargeRef.current({ force: true, silent: true });
            } finally {
                staffClaimInFlightRef.current = false;
            }
            if (cancelled || masterStatusRef.current.isMaster) return;
            if (staffClaimAttemptsRef.current < 4) {
                retryTimer = window.setTimeout(runClaim, 1200);
            } else if (!masterStatusRef.current.isMaster) {
                setStaffClaimError("Impossible de prendre la table — réessayez.");
            }
        };

        void runClaim();

        return () => {
            cancelled = true;
            if (retryTimer !== undefined) {
                window.clearTimeout(retryTimer);
            }
        };
    }, [staffMode, activeDeviceId, masterStatus.isMaster, masterStatus.loading, tableId]);

    const prevIsMasterRef = useRef(false);
    const prevMasterTypeRef = useRef<"staff" | "client" | null>(null);
    const prevHasMasterRef = useRef(false);
    useEffect(() => {
        const wasMaster = prevIsMasterRef.current;
        const prevType = prevMasterTypeRef.current;
        const prevHas = prevHasMasterRef.current;
        prevIsMasterRef.current = masterStatus.isMaster;
        prevMasterTypeRef.current = masterStatus.masterType;
        prevHasMasterRef.current = masterStatus.hasMaster;

        if (wasMaster && !masterStatus.isMaster && !staffMode) {
            void pushDraftCartNow();
        }

        if (
            !staffMode &&
            !masterStatus.loading &&
            prevType === "staff" &&
            prevHas &&
            !masterStatus.hasMaster
        ) {
            setReadOnlyMode(false);
            draftLoadKeyRef.current = "";
            void takeCharge({ silent: true });
        }
    }, [
        masterStatus.hasMaster,
        masterStatus.isMaster,
        masterStatus.loading,
        masterStatus.masterType,
        pushDraftCartNow,
        staffMode,
        takeCharge,
    ]);

    const scrollToPageTop = useCallback(() => {
        if (typeof window === "undefined") return;
        setActiveCategoryId(null);
        window.requestAnimationFrame(() => {
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    }, []);

    const [showScrollTopFab, setShowScrollTopFab] = useState(false);

    useEffect(() => {
        if (!showOrderUi) {
            setShowScrollTopFab(false);
            return;
        }
        const onScroll = () => {
            setShowScrollTopFab(window.scrollY > 320);
        };
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, [showOrderUi]);

    const updateGuestNames = useCallback(
        (updater: (prev: Record<string, string>) => Record<string, string>, persist: boolean) => {
            setGuestNames((prev) => {
                const nextDraft = updater(prev);
                const sanitizedNext = sanitizeGuestNamesRecord(nextDraft, { count: peopleCount });

                if (persist) {
                    guestNamesPersistedRef.current = sanitizedNext;
                    if (Object.keys(sanitizedNext).length === 0) {
                        resetGuestNamesForTable(tableId);
                    } else {
                        persistGuestNamesForTable(tableId, sanitizedNext);
                    }
                }

                return sanitizedNext;
            });
        },
        [peopleCount, tableId]
    );

    const getGuestNameForPersonId = useCallback(
        (personId: string) => guestNameFromMap(guestNames, personId),
        [guestNames]
    );

    const getGuestNameForIndex = useCallback(
        (index: number) => getGuestNameForPersonId(`P${index}`),
        [getGuestNameForPersonId]
    );

    const handleGuestNameChange = useCallback(
        (index: number, value: string) => {
            const sanitized = sanitizeGuestNameInput(value);
            updateGuestNames((prev) => {
                const next = { ...prev };
                const key = String(index);
                if (sanitized && sanitized !== guestNameFallback(index)) {
                    next[key] = sanitized;
                } else {
                    delete next[key];
                }
                return next;
            }, true);
        },
        [updateGuestNames]
    );

    const resetGuestNamesState = useCallback(() => {
        const defaults = resetGuestNamesForTable(tableId);
        guestNamesPersistedRef.current = defaults;
        setGuestNames(defaults);
    }, [tableId]);

    const resetTableAfterOrder = useCallback(() => {
        setCart([]);
        resetGuestNamesState();
        previousPeopleCountRef.current = 1;
        setPeopleCount(1);
        setActivePerson("P1");
        setExpandedPersons(new Set());
        setTableComment("");
        setShowGuestNameEditor(false);
        setEditingPersonId(null);
        setComposeState(null);
        setComposeErrors({});
        setCartDrawerOpen(false);
        if (typeof window !== "undefined") {
            window.localStorage.setItem(`table:${tableId}:people`, "1");
        }
    }, [resetGuestNamesState, tableId]);

    const resetClientTableSession = useCallback(() => {
        resetGuestNamesState();
        previousPeopleCountRef.current = 1;
        setPeopleCount(1);
        setActivePerson("P1");
        setCart([]);
        setExpandedPersons(new Set());
        setTableComment("");
        setShowGuestNameEditor(false);
        setEditingPersonId(null);
        setComposeState(null);
        setComposeErrors({});
        setCartDrawerOpen(false);
        draftLoadKeyRef.current = "";
        setDraftReady(false);
        if (typeof window !== "undefined") {
            window.localStorage.setItem(`table:${tableId}:people`, "1");
        }
    }, [resetGuestNamesState, tableId]);

    const clearServerDraft = useCallback(async () => {
        try {
            await fetch(`/api/tables/${tableId}/draft-cart`, {
                method: "DELETE",
                keepalive: true,
            });
        } catch {
            // best effort
        }
    }, [tableId]);

    useEffect(() => {
        sessionCleanupRef.current = {
            reset: resetClientTableSession,
            clearDraft: clearServerDraft,
        };
    }, [clearServerDraft, resetClientTableSession]);

    useEffect(() => {
        if (staffMode || !activeDeviceId) return;

        if (isOrderingSessionActive(tableId)) {
            clientBootstrapDoneRef.current = true;
            void refreshMasterStatus();
            return;
        }

        if (clientBootstrapDoneRef.current) return;
        clientBootstrapDoneRef.current = true;

        let cancelled = false;

        void (async () => {
            resetClientTableSession();

            let isMaster = false;
            let hasMaster = false;
            try {
                const res = await fetch(
                    `/api/tables/${tableId}/master?deviceId=${encodeURIComponent(activeDeviceId)}`,
                    { cache: "no-store" }
                );
                const data = await res.json();
                if (data.ok) {
                    isMaster = Boolean(data.isMaster);
                    hasMaster = Boolean(data.hasMaster);
                }
            } catch {
                // ignore
            }

            if (cancelled) return;

            if (isMaster) {
                await clearServerDraft();
                try {
                    await fetch(`/api/tables/${tableId}/master`, {
                        method: "DELETE",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ deviceId: activeDeviceId }),
                    });
                } catch {
                    // ignore
                }
            } else if (!hasMaster) {
                await clearServerDraft();
            }

            if (!cancelled) {
                void refreshMasterStatus();
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [activeDeviceId, clearServerDraft, refreshMasterStatus, resetClientTableSession, staffMode, tableId]);

    useEffect(() => {
        if (staffMode || orderMode || masterStatus.loading) return;
        if (masterStatus.hasMaster) {
            idleTableResetDoneRef.current = false;
            return;
        }
        if (idleTableResetDoneRef.current) return;
        idleTableResetDoneRef.current = true;
        resetClientTableSession();
        void clearServerDraft();
    }, [
        clearServerDraft,
        masterStatus.hasMaster,
        masterStatus.loading,
        orderMode,
        resetClientTableSession,
        staffMode,
        tableId,
    ]);

    async function loadAll() {
        setLoading(true);
        try {
            const [itRes, mRes] = await Promise.all([
                fetch("/api/menu", { cache: "no-store" }),
                fetch("/api/menus", { cache: "no-store" }),
            ]);
            if (!itRes.ok) {
                const errorData = await itRes.json().catch(() => ({}));
                throw new Error(`Menu: ${errorData?.error || errorData?.message || `HTTP ${itRes.status}`}`);
            }
            if (!mRes.ok) {
                const errorData = await mRes.json().catch(() => ({}));
                throw new Error(`Menus: ${errorData?.error || errorData?.message || `HTTP ${mRes.status}`}`);
            }
            const it = await itRes.json();
            const m = await mRes.json();
            const rawItems: MenuItem[] = Array.isArray(it.items) ? it.items : [];
            const sanitizedItems = rawItems.filter(
                (item) => !(item?.category === "Boissons" && /1L/i.test(item?.name ?? ""))
            );
            setMenuItems(sanitizedItems);
            setMenus(Array.isArray(m.menus) ? m.menus : []);
        } catch (e: any) {
            console.error("[table/loadAll] error:", e);
            toast.error(e?.message || "Erreur lors du chargement du menu");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadAll();
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;
        window.localStorage.setItem(`table:${tableId}:people`, String(peopleCount));
    }, [peopleCount, tableId]);

    useEffect(() => {
        if (!masterStatus.isMaster) {
            if (!staffMode) {
                draftLoadKeyRef.current = "";
                setDraftReady(false);
            }
            return;
        }
        if (!staffMode && !isOrderingSessionActive(tableId)) {
            draftLoadKeyRef.current = "";
            setDraftReady(false);
            return;
        }
        const draftSessionKey = activeDeviceId ? `${tableId}:${activeDeviceId}` : "";
        if (!draftSessionKey) return;
        if (draftLoadKeyRef.current === draftSessionKey) {
            setDraftReady(true);
            return;
        }

        let cancelled = false;
        setDraftReady(false);

        void (async () => {
            try {
                const res = await fetch(`/api/tables/${tableId}/draft-cart`, { cache: "no-store" });
                const data = await res.json();
                if (cancelled) return;

                const draft = data?.draft;
                if (draft) {
                    applyDraftFromPayload(draft, {
                        toast: staffMode && Array.isArray(draft.items) && draft.items.length > 0,
                    });
                }
            } catch {
                // sync locale continue même si le chargement échoue
            } finally {
                if (!cancelled) {
                    draftLoadKeyRef.current = draftSessionKey;
                    setDraftReady(true);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [activeDeviceId, applyDraftFromPayload, masterStatus.isMaster, staffMode, tableId]);

    useEffect(() => {
        if (!activeDeviceId) {
            draftPayloadRef.current = null;
            return;
        }
        draftPayloadRef.current = {
            deviceId: activeDeviceId,
            items: cart.map((l) => ({
                id: l.id,
                name: l.name,
                priceCents: l.priceCents,
                qty: l.qty,
                personId: l.personId,
                supplements: l.supplements,
            })),
            peopleCount,
            tableComment: tableComment.trim() || null,
            guestNames: sanitizeGuestNamesRecord(guestNames, { count: peopleCount }),
        };
    }, [activeDeviceId, cart, peopleCount, tableComment, guestNames]);

    useEffect(() => {
        if (!canSyncDraft) return;

        const payload = draftPayloadRef.current;
        if (!payload) return;

        const timer = window.setTimeout(() => {
            void fetch(`/api/tables/${tableId}/draft-cart`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
        }, 200);

        return () => window.clearTimeout(timer);
    }, [canSyncDraft, tableId, cart, peopleCount, tableComment, guestNames]);

    useEffect(() => {
        if (!canSyncDraft || cart.length === 0) return;
        const id = window.setInterval(() => {
            void pushDraftCartNow();
        }, 2000);
        return () => window.clearInterval(id);
    }, [canSyncDraft, cart.length, pushDraftCartNow]);

    useEffect(() => {
        if (!canSyncDraft || !staffMode) return;

        const flushDraftCart = () => {
            void pushDraftCartNow();
        };

        const onHide = () => {
            if (document.visibilityState === "hidden") flushDraftCart();
        };

        document.addEventListener("visibilitychange", onHide);
        window.addEventListener("pagehide", flushDraftCart);
        return () => {
            document.removeEventListener("visibilitychange", onHide);
            window.removeEventListener("pagehide", flushDraftCart);
        };
    }, [canSyncDraft, pushDraftCartNow, staffMode]);

    useEffect(() => {
        if (!staffMode || !masterStatus.isMaster) return;

        let ticks = 0;
        const id = window.setInterval(() => {
            ticks += 1;
            const hasContent =
                cartRef.current.length > 0 || previousPeopleCountRef.current > 1;
            if (ticks > 20 || hasContent) {
                window.clearInterval(id);
                return;
            }
            void fetchDraftFromServer({ toast: ticks === 1 });
        }, 1000);

        return () => window.clearInterval(id);
    }, [fetchDraftFromServer, masterStatus.isMaster, staffMode]);

    useEffect(() => {
        const previous = previousPeopleCountRef.current;
        if (peopleCount < previous) {
            updateGuestNames((prev) => {
                const next = { ...prev };
                let changed = false;
                for (const key of Object.keys(next)) {
                    if (Number(key) > peopleCount) {
                        delete next[key];
                        changed = true;
                    }
                }
                return changed ? next : prev;
            }, false);
        } else if (peopleCount > previous) {
            updateGuestNames((prev) => {
                const next = { ...prev };
                let changed = false;
                for (let i = previous + 1; i <= peopleCount; i += 1) {
                    const key = String(i);
                    const persisted = guestNamesPersistedRef.current[key];
                    const sanitized = sanitizeGuestNameInput(persisted);
                    if (sanitized && sanitized !== guestNameFallback(i)) {
                        next[key] = sanitized;
                        changed = true;
                    }
                }
                return changed ? next : prev;
            }, false);
        }
        previousPeopleCountRef.current = peopleCount;
    }, [peopleCount, updateGuestNames]);

    useEffect(() => {
        if (!cartDrawerOpen) return;
        const handler = (event: KeyboardEvent) => {
            if (event.key === "Escape") closeCartDrawer();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [cartDrawerOpen]);

    // Isoler le scroll du panier : empêche le wheel d'atteindre la page
    useEffect(() => {
        if (!cartDrawerOpen) return;
        const el = cartScrollRef.current;
        if (!el) return;
        const stop = (e: WheelEvent) => e.stopPropagation();
        el.addEventListener("wheel", stop, { passive: true });
        return () => el.removeEventListener("wheel", stop);
    }, [cartDrawerOpen]);

    useEffect(() => {
        if (cartDrawerOpen && cart.length === 0) {
            setCartDrawerOpen(false);
        }
    }, [cartDrawerOpen, cart.length]);

    const personIds = useMemo(
        () => Array.from({ length: Math.max(1, peopleCount) }, (_, i) => `P${i + 1}`),
        [peopleCount]
    );

    useEffect(() => {
        setExpandedPersons((prev) => {
            const next = new Set(Array.from(prev).filter((pid) => personIds.includes(pid)));
            return next.size === prev.size ? prev : next;
        });
    }, [personIds]);

    useEffect(() => {
        setCart((prev) => {
            if (!prev.length) return prev;
            const allowed = new Set(personIds);
            const fallback = personIds[personIds.length - 1] || "P1";
            let changed = false;
            const next = prev.map((line) => {
                if (allowed.has(line.personId)) return line;
                changed = true;
                return { ...line, personId: fallback };
            });
            return changed ? next : prev;
        });
        setActivePerson((prev) => {
            const index = parseInt(prev.slice(1) || "1", 10);
            if (!Number.isFinite(index) || index < 1 || index > peopleCount) {
                return personIds[0] || "P1";
            }
            return prev;
        });
    }, [peopleCount, personIds]);

    const categoryOrder = useMemo(() => {
        const order = new Map<string, number>();
        let index = 0;
        for (const it of menuItems) {
            const key = (it?.category || "").trim();
            if (!key) continue;
            if (!order.has(key)) {
                order.set(key, index++);
            }
        }
        return order;
    }, [menuItems]);

    const itemsByCategory = useMemo(() => {
        const map = new Map<string, MenuItem[]>();
        for (const it of menuItems) {
            const key = (it?.category || "").trim();
            if (!key) continue;
            const arr = map.get(key) ?? [];
            arr.push(it);
            map.set(key, arr);
        }
        for (const [k, arr] of map) {
            arr.sort((a, b) => {
                if (a.position !== b.position) return a.position - b.position;
                return a.name.localeCompare(b.name, "fr");
            });
        }
        return map;
    }, [menuItems]);

    const visibleCategorySections = useMemo(() => {
        const slugCounts = new Map<string, number>();
        let index = 0;
        return Array.from(itemsByCategory.entries())
            .filter(([cat]) => !HIDDEN_MENU_CATEGORIES.has(cat))
            .filter(([cat]) => !isFormulaMenuCategory(cat))
            // Boissons toujours en dernier
            .sort(([catA], [catB]) => {
                const aIsDrink = catA.toLowerCase() === "boissons";
                const bIsDrink = catB.toLowerCase() === "boissons";
                if (aIsDrink && !bIsDrink) return 1;
                if (!aIsDrink && bIsDrink) return -1;
                const orderA = categoryOrder.get(catA) ?? Number.MAX_SAFE_INTEGER;
                const orderB = categoryOrder.get(catB) ?? Number.MAX_SAFE_INTEGER;
                return orderA - orderB;
            })
            .map(([cat, list]) => {
                const label = cat === "Boxes" ? "Nos BOX" : cat;
                const baseSlug = slugifyCategory(cat, `section-${index + 1}`);
                const count = slugCounts.get(baseSlug) ?? 0;
                slugCounts.set(baseSlug, count + 1);
                const anchorId = count === 0 ? baseSlug : `${baseSlug}-${count}`;
                const sectionIndex = index;
                index += 1;
                return { anchorId, label, items: list, rawCategory: cat, index: sectionIndex };
            });
    }, [itemsByCategory, categoryOrder]);

    const coldMenuItems = useMemo(
        () =>
            menuItems
                .filter((it) => isColdMenuItem(it))
                .sort((a, b) => {
                    if (a.position !== b.position) return a.position - b.position;
                    return a.name.localeCompare(b.name, "fr");
                }),
        [menuItems]
    );

    const formulaSliderCategories = useMemo(() => {
        const items: { id: string; label: string }[] = [];
        if (menus.length > 0) {
            items.push({ id: HOT_MENUS_SECTION_ID, label: HOT_MENUS_SLIDER_LABEL });
        }
        if (coldMenuItems.length > 0) {
            items.push({ id: COLD_MENUS_SECTION_ID, label: COLD_MENUS_SLIDER_LABEL });
        }
        return items;
    }, [menus.length, coldMenuItems.length]);

    const sliderCategories = useMemo(
        () => visibleCategorySections.map((section) => ({ id: section.anchorId, label: section.label })),
        [visibleCategorySections]
    );

    useEffect(() => {
        if (!formulaSliderCategories.length) {
            setActiveFormulaId(null);
            return;
        }
        setActiveFormulaId((prev) => {
            if (prev && formulaSliderCategories.some((item) => item.id === prev)) return prev;
            const preferred = formulaSliderCategories.find((item) => item.id === HOT_MENUS_SECTION_ID);
            return preferred?.id ?? formulaSliderCategories[0].id;
        });
    }, [formulaSliderCategories]);

    useEffect(() => {
        if (!visibleCategorySections.length) {
            setActiveCategoryId(null);
            return;
        }
        setActiveCategoryId((prev) => prev ?? visibleCategorySections[0].anchorId);
    }, [visibleCategorySections]);

    useEffect(() => {
        if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return;
        if (!formulaSliderCategories.length) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const intersecting = entries.filter((entry) => entry.isIntersecting);
                if (!intersecting.length) return;
                intersecting.sort((a, b) => {
                    const aIndex = Number((a.target as HTMLElement).dataset.formulaIndex ?? 0);
                    const bIndex = Number((b.target as HTMLElement).dataset.formulaIndex ?? 0);
                    return aIndex - bIndex;
                });
                const topEntry = intersecting[0];
                if (topEntry?.target?.id) {
                    setActiveFormulaId(topEntry.target.id);
                }
            },
            {
                rootMargin: "-45% 0px -45% 0px",
                threshold: [0, 0.1, 0.25],
            }
        );

        formulaSliderCategories.forEach(({ id }, index) => {
            const element = document.getElementById(id);
            if (element) {
                element.dataset.formulaIndex = String(index);
                observer.observe(element);
            }
        });

        return () => observer.disconnect();
    }, [formulaSliderCategories]);

    useEffect(() => {
        if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return;
        if (!visibleCategorySections.length) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const intersecting = entries.filter((entry) => entry.isIntersecting);
                if (!intersecting.length) return;
                intersecting.sort((a, b) => {
                    const aIndex = Number((a.target as HTMLElement).dataset.categoryIndex ?? 0);
                    const bIndex = Number((b.target as HTMLElement).dataset.categoryIndex ?? 0);
                    return aIndex - bIndex;
                });
                const topEntry = intersecting[0];
                if (topEntry?.target?.id) {
                    setActiveCategoryId(topEntry.target.id);
                }
            },
            {
                rootMargin: "-45% 0px -45% 0px",
                threshold: [0, 0.1, 0.25],
            }
        );

        const elements = visibleCategorySections
            .map(({ anchorId }) => document.getElementById(anchorId))
            .filter((el): el is HTMLElement => Boolean(el));
        elements.forEach((element) => observer.observe(element));

        return () => observer.disconnect();
    }, [visibleCategorySections]);

    const menuItemMap = useMemo(() => {
        const map = new Map<string, MenuItem>();
        for (const it of menuItems) {
            map.set(it.id, it);
        }
        return map;
    }, [menuItems]);

    // ajout : support des filtres multiples (A|B|C) pour les menus chauds
    function resolveCategoryTokens(raw: string, seen = new Set<string>()): string[] {
        const tokens = raw
            .split("|")
            .map((s) => s.trim())
            .filter(Boolean);
        const queue = tokens.length ? tokens : [raw.trim()];
        const result = new Set<string>();

        const pushToken = (token: string) => {
            if (!token) return;
            const normalized = token.trim();
            if (!normalized) return;
            if (seen.has(normalized.toLowerCase())) return;
            seen.add(normalized.toLowerCase());

            const alias =
                CAT_ALIASES[normalized] ??
                CAT_ALIASES[normalized.toLowerCase()] ??
                CAT_ALIASES[normalized.replace(/\s+/g, " ")] ??
                CAT_ALIASES[normalized.replace(/\s+/g, " ").toLowerCase()];

            if (Array.isArray(alias)) {
                alias.forEach((next) => pushToken(next));
            } else if (typeof alias === "string") {
                pushToken(alias);
            } else {
                result.add(normalized);
            }
        };

        queue.forEach((token) => pushToken(token));
        return Array.from(result);
    }

    function findListByCategory(cat: string): MenuItem[] {
        const categories = resolveCategoryTokens(cat);
        if (!categories.length) return [];

        const collected: MenuItem[] = [];
        for (const key of categories) {
            const arr = itemsByCategory.get(key);
            if (arr?.length) collected.push(...arr);
        }

        collected.sort((a, b) => {
            const orderA = categoryOrder.get(a.category) ?? Number.MAX_SAFE_INTEGER;
            const orderB = categoryOrder.get(b.category) ?? Number.MAX_SAFE_INTEGER;
            if (orderA !== orderB) return orderA - orderB;
            if (a.position !== b.position) return a.position - b.position;
            return a.name.localeCompare(b.name, "fr");
        });

        return collected;
    }

    function parseCategoryFilter(raw: string) {
        const parts = raw.split("::").map((s) => s.trim()).filter(Boolean);
        const filter = parts.shift() ?? "";
        const meta: Record<string, string> = {};
        for (const part of parts) {
            const [k, v] = part.split("=").map((s) => s.trim());
            if (k && v) meta[k.toLowerCase()] = v;
        }
        return { filter, meta };
    }

    function filterOptionsForGroup(menuName: string, group: MenuGroup, rawFilter: string, options: MenuItem[]): MenuItem[] {
        if (menuName === "Asian Kid’s" && group.name.toLowerCase().includes("accompagnement")) {
            const allowedKeywords = ["riz nature", "nouilles sautées légumes", "riz cantonnais"];
            return options.filter((opt) => {
                const label = opt.name.toLowerCase();
                return allowedKeywords.some((kw) => label.includes(kw));
            });
        }
        if (rawFilter === "Desserts Kid") {
            return options.filter((opt) => opt.name.toLowerCase().includes("compote"));
        }
        if (rawFilter === "Boissons Kid") {
            return options.filter((opt) => opt.name.toLowerCase().includes("capri"));
        }
        return options;
    }

    function adjustPeople(delta: number) {
        setPeopleCount((prev) => {
            const next = Math.max(1, Math.min(12, prev + delta));
            if (delta > 0 && next > 1) setShowGuestNameEditor(true);
            return next;
        });
    }

    function addToCartLine(
        name: string,
        priceCents: number,
        personId?: string,
        supplements?: SupplementDef[]
    ) {
        if (!canModifyCart) {
            toast.error("Seul le téléphone maître peut ajouter des plats au panier.");
            return;
        }
        const target = personId || activePerson || "P1";
        const supps = supplements ?? [];
        const suppTotal = supps.reduce((s, x) => s + x.priceCents, 0);
        const unitPrice = priceCents + suppTotal;
        const key = `${name}|${priceCents}|${supplementSignature(supps)}`;
        setCart((prev) => {
            const i = prev.findIndex((l) => l.id === key && l.personId === target);
            if (i >= 0) {
                const copy = [...prev];
                copy[i] = { ...copy[i], qty: copy[i].qty + 1 };
                return copy;
            }
            return [
                ...prev,
                {
                    id: key,
                    name,
                    priceCents: unitPrice,
                    qty: 1,
                    personId: target,
                    supplements: supps.length > 0 ? supps : undefined,
                },
            ];
        });
        toastAddedToCart(name);
    }

    function incLine(id: string, personId: string) {
        if (!canModifyCart) {
            toast.error("Seul le téléphone maître peut modifier le panier.");
            return;
        }
        setCart((prev) =>
            prev.map((l) => (l.id === id && l.personId === personId ? { ...l, qty: l.qty + 1 } : l))
        );
    }

    function decFromCart(id: string, personId: string) {
        setCart((prev) => {
            const i = prev.findIndex((l) => l.id === id && l.personId === personId);
            if (i === -1) return prev;
            const copy = [...prev];
            const q = copy[i].qty - 1;
            if (q <= 0) copy.splice(i, 1);
            else copy[i] = { ...copy[i], qty: q };
            return copy;
        });
    }

    function removeLineFromCart(id: string, personId: string) {
        setCart((prev) => prev.filter((line) => !(line.id === id && line.personId === personId)));
    }

    function clearPersonCart(personId: string) {
        setCart((prev) => prev.filter((line) => line.personId !== personId));
    }

    function clearEntireCart() {
        setCart([]);
        setTableComment("");
        setCartDrawerOpen(false);
        setExpandedPersons(new Set());
    }

    // --- Composition menu avec contraintes (XOR, min/max) ---
    function composeMenu(menu: MenuDef) {
        if (!canModifyCart) {
            toast.error("Seul le téléphone maître peut composer un menu.");
            return;
        }
        try {
            if (!menu || !Array.isArray(menu.groups) || menu.groups.length === 0) {
                toast.error("Ce menu n’a pas de groupes. Va dans Admin > Menus.");
                return;
            }

            const sorted = [...menu.groups].sort((a, b) => a.position - b.position);
            const steps: ComposeStep[] = sorted.map((group) => {
                const { filter, meta } = parseCategoryFilter(group.categoryFilter);
                const minRaw = Number.isFinite(group.minChoices) ? Number(group.minChoices) : 1;
                const maxRaw = Number.isFinite(group.maxChoices) ? Number(group.maxChoices) : minRaw;
                const minChoices = Math.max(0, minRaw);
                const maxChoices = Math.max(minChoices || 0, maxRaw);

                const baseOptions = findListByCategory(filter);
                const options = filterOptionsForGroup(menu.name, group, filter, baseOptions)
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

                const includeCategory = new Set(options.map((it) => it.category)).size > 1;
                const multi = maxChoices > 1;

                return {
                    group,
                    options,
                    includeCategory,
                    minChoices,
                    maxChoices,
                    multi,
                    xorKey: meta.xor ?? null,
                    displayCategory: filter || group.categoryFilter,
                };
            });

            const blocking = steps.find((step) => step.options.length === 0 && !step.xorKey && step.minChoices > 0);
            if (blocking) {
                toast.error(`Aucun plat trouvé dans « ${blocking.displayCategory || blocking.group.categoryFilter} ». Mets à jour la carte ou les alias.`);
                return;
            }

            const selectionMap: Record<string, string[]> = {};
            for (const step of steps) {
                if (!step.xorKey && step.options.length === 1 && step.maxChoices >= 1) {
                    selectionMap[step.group.id] = [step.options[0].id];
                } else {
                    selectionMap[step.group.id] = [];
                }
            }

            setComposeState({ menu, steps, selectionMap });
            setComposeErrors(collectErrors(steps, selectionMap));
        } catch (e: any) {
            console.error("composeMenu error:", e);
            toast.error(e?.message || "Erreur pendant la composition du menu");
        }
    }

    function cancelCompose() {
        setComposeState(null);
        setComposeErrors({});
    }

    function setSelection(step: ComposeStep, values: string[]) {
        if (!composeState) return;
        const nextMap: Record<string, string[]> = { ...composeState.selectionMap, [step.group.id]: values };

        if (step.xorKey && values.length > 0) {
            for (const other of composeState.steps) {
                if (other.group.id !== step.group.id && other.xorKey === step.xorKey) {
                    nextMap[other.group.id] = [];
                }
            }
        }

        setComposeState({ ...composeState, selectionMap: nextMap });
        setComposeErrors(collectErrors(composeState.steps, nextMap));
    }

    function handleSingleSelect(step: ComposeStep, value: string | null) {
        setSelection(step, value ? [value] : []);
    }

    function handleCheckboxToggle(step: ComposeStep, value: string) {
        if (!composeState) return;
        const current = composeState.selectionMap[step.group.id] ?? [];
        const exists = current.includes(value);
        let next = exists ? current.filter((v) => v !== value) : [...current, value];
        if (!exists && next.length > step.maxChoices) {
            toast.error(`Sélection maximale : ${step.maxChoices} option(s).`);
            return;
        }
        setSelection(step, next);
    }

    function requirementText(step: ComposeStep) {
        if (step.xorKey) {
            return "Choisissez UNE entrée OU UNE paire de yakitoris.";
        }
        if (step.minChoices === step.maxChoices) {
            return `Choisissez ${step.minChoices} option(s).`;
        }
        return `Choisissez entre ${step.minChoices} et ${step.maxChoices} option(s).`;
    }

    function collectErrors(steps: ComposeStep[], selectionMap: Record<string, string[]>): Record<string, string> {
        const errors: Record<string, string> = {};
        const xorTotals = new Map<string, number>();

        for (const step of steps) {
            if (!step.xorKey) continue;
            const current = selectionMap[step.group.id] ?? [];
            xorTotals.set(step.xorKey, (xorTotals.get(step.xorKey) ?? 0) + current.length);
        }

        for (const step of steps) {
            const selectedCount = selectionMap[step.group.id]?.length ?? 0;
            const min = step.xorKey ? 0 : step.minChoices;
            if (selectedCount < min) {
                if (step.minChoices === step.maxChoices) {
                    errors[step.group.id] = `Sélectionnez ${step.minChoices} option(s).`;
                } else {
                    errors[step.group.id] = `Sélectionnez au moins ${step.minChoices} option(s).`;
                }
            } else if (selectedCount > step.maxChoices) {
                errors[step.group.id] = `Sélectionnez au maximum ${step.maxChoices} option(s).`;
            }
        }

        for (const [key, total] of xorTotals) {
            const related = steps.filter((s) => s.xorKey === key);
            if (total === 0) {
                for (const step of related) {
                    errors[step.group.id] = "Choisissez UNE entrée OU UNE paire de yakitoris.";
                }
            } else if (total > 1) {
                for (const step of related) {
                    errors[step.group.id] = "Sélectionnez une seule option pour cette étape.";
                }
            }
        }

        return errors;
    }

    function finalizeMenuSelections(menu: MenuDef, steps: ComposeStep[], selectionMap: Record<string, string[]>) {
        const detailParts: string[] = [];
        for (const step of steps) {
            const selectedIds = selectionMap[step.group.id] ?? [];
            const items = selectedIds
                .map((id) => menuItemMap.get(id))
                .filter((it): it is MenuItem => Boolean(it));
            if (!items.length) continue;
            const names = items
                .map((it) => (step.includeCategory ? `${it.name} — ${it.category}` : it.name))
                .join(step.multi ? " + " : ", ");
            detailParts.push(`${step.group.name}: ${names}`);
        }
        const label = detailParts.length > 0 ? `${menu.name} — ${detailParts.join(" • ")}` : menu.name;
        addToCartLine(label, menu.priceCents, activePerson);
        setComposeState(null);
        setComposeErrors({});
    }

    function confirmCompose() {
        if (!composeState) return;
        const errors = collectErrors(composeState.steps, composeState.selectionMap);
        setComposeErrors(errors);
        if (Object.keys(errors).length > 0) {
            toast.error("Complétez les choix du menu avant de valider.");
            return;
        }
        finalizeMenuSelections(composeState.menu, composeState.steps, composeState.selectionMap);
    }

    function openCartDrawer() {
        setExpandedPersons(new Set());
        setCartDrawerOpen(true);
    }

    function closeCartDrawer() {
        setCartDrawerOpen(false);
    }

    function togglePersonPanel(personId: string) {
        setExpandedPersons((prev) => {
            const next = new Set(prev);
            if (next.has(personId)) next.delete(personId);
            else next.add(personId);
            return next;
        });
    }

    const totalCents = cart.reduce((s, l) => s + l.priceCents * l.qty, 0);
    const cartByPerson = useMemo(() => {
        const map = new Map<string, CartLine[]>();
        for (const pid of personIds) map.set(pid, []);
        for (const line of cart) {
            const pid = personIds.includes(line.personId) ? line.personId : personIds[0] || "P1";
            if (!map.has(pid)) map.set(pid, []);
            map.get(pid)!.push(line);
        }
        for (const [, arr] of map) {
            arr.sort((a, b) => a.name.localeCompare(b.name, "fr"));
        }
        return map;
    }, [cart, personIds]);
    const cartItemCount = cart.reduce((s, l) => s + l.qty, 0);
    const hasCartItems = cartItemCount > 0;

    // --- ENVOI COMMANDE : version avec logs détaillés si 400
    async function executeSubmitOrder() {
        if (!canModifyCart) {
            toast.error("Seul le téléphone maître peut envoyer la commande.");
            return;
        }
        if (cart.length === 0) return toast.error("Panier vide");
        try {
            const trimmedComment = tableComment.trim();
            const guestNamesPayload = sanitizeGuestNamesRecord(guestNames, { count: peopleCount });

            const payload: Record<string, unknown> = {
                tableId: String(tableId),
                deviceId: activeDeviceId,
                total: totalCents,
                tableComment: trimmedComment ? trimmedComment : null,
                peopleCount: Math.max(1, Math.min(12, Number(peopleCount) || 1)),
                items: cart.map((l) => ({
                    name: String(l.name),
                    qty: Number(l.qty),
                    price: Number.isFinite(l.priceCents) ? l.priceCents : undefined,
                    personId: l.personId,
                    supplements: l.supplements ?? undefined,
                })),
            };

            if (Object.keys(guestNamesPayload).length > 0) {
                payload.guestNames = guestNamesPayload;
            }

            const res = await fetch(`/api/tables/${tableId}/submit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const text = await res.text();
            let data: any = {};
            try { data = JSON.parse(text); } catch { /* texte brut */ }

            if (!res.ok) {
                console.error("POST /api/tables/[id]/submit", res.status, data || text);
                toast.error(data?.message || `Commande refusée (${res.status})`);
                return;
            }

            setOrderConfirmedOpen(true);
            resetTableAfterOrder();
            if (staffMode) {
                await takeCharge({ force: true, silent: true });
            } else {
                clearOrderingSessionActive(tableId);
                setMasterStatus({ hasMaster: false, isMaster: false, masterType: null, loading: false });
                showLanding();
            }
            router.refresh();
        } catch (e: any) {
            console.error(e);
            toast.error(e?.message || "Erreur d’envoi");
        }
    }

    return (
        <>
            <OrderConfirmedModal
                open={orderConfirmedOpen}
                tableId={tableId}
                onClose={() => setOrderConfirmedOpen(false)}
            />
            {!showOrderUi ? (
                <TableLandingView
                    tableId={tableId}
                    hasMaster={masterStatus.hasMaster}
                    isMaster={masterStatus.isMaster}
                    masterType={masterStatus.masterType}
                    claiming={claimingMaster}
                    onBrowseMenu={browseMenu}
                    onTakeCharge={() => void takeCharge()}
                />
            ) : (
            <>
            <header className="sticky top-0 z-40 border-b border-[rgba(190,127,57,0.22)] bg-[rgba(245,239,230,0.85)] backdrop-blur-md">
                <div className="mx-auto flex h-14 items-center justify-between gap-3 px-4 sm:h-16 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={showLanding}
                            className="text-xs sm:text-sm text-[var(--color-heading)] underline-offset-2 hover:underline"
                        >
                            {staffMode ? "Retour serveur" : "Accueil table"}
                        </button>
                        <span className="text-base font-semibold text-[var(--color-heading)] sm:text-lg">Asian Nour</span>
                        <span className="inline-flex items-center rounded-full border border-[var(--color-border)] bg-[rgba(255,252,247,0.88)] px-3 py-1 text-xs font-medium text-[var(--color-heading)]">
                            Table {tableId}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setMenuCardOpen(true)}
                        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-[rgba(190,127,57,0.35)] bg-[rgba(255,252,247,0.92)] px-3 text-[var(--color-heading)] shadow-[0_10px_28px_rgba(61,47,33,0.15)] transition focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(190,127,57,0.55)] hover:bg-[rgba(217,168,108,0.18)] active:translate-y-[1px] sm:h-11 sm:px-4"
                        aria-label="Voir la carte du restaurant"
                    >
                        <svg
                            className="h-5 w-5 shrink-0"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16.5A2.5 2.5 0 0 0 17.5 17H6.5A2.5 2.5 0 0 1 4 14.5V5.5Z" />
                            <path d="M6.5 3v14" />
                        </svg>
                        <span className="text-sm font-semibold">Carte</span>
                    </button>
                    {canModifyCart && (
                    <button
                        type="button"
                        onClick={openCartDrawer}
                        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(190,127,57,0.35)] bg-[rgba(255,252,247,0.92)] text-[var(--color-heading)] shadow-[0_10px_28px_rgba(61,47,33,0.15)] transition focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(190,127,57,0.55)] hover:bg-[rgba(217,168,108,0.18)] active:translate-y-[1px] sm:h-11 sm:w-11"
                        aria-label={
                            cartItemCount > 0
                                ? `Ouvrir le panier (${cartItemCount} article${cartItemCount > 1 ? "s" : ""})`
                                : "Ouvrir le panier"
                        }
                    >
                        <svg
                            className="h-5 w-5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M6.5 7.5h11l-1.1 8.2a2 2 0 0 1-2 1.8H9.6a2 2 0 0 1-2-1.7L6.5 7.5Z" />
                            <path d="M9 7.5l.8-2.9A1.2 1.2 0 0 1 11 3.5h2a1.2 1.2 0 0 1 1.2 1.1L15 7.5" />
                            <circle cx="9.5" cy="19" r="1" />
                            <circle cx="14.5" cy="19" r="1" />
                        </svg>
                        {cartItemCount > 0 && (
                            <span
                                className="absolute -top-1.5 -right-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[var(--color-accent-strong)] px-1 text-[11px] font-semibold leading-none text-[var(--color-on-accent)]"
                                aria-hidden="true"
                            >
                                {cartItemCount}
                            </span>
                        )}
                    </button>
                    )}
                    </div>
                </div>
            </header>
            <MenuCardFullscreenOverlay
                open={menuCardOpen}
                onClose={() => setMenuCardOpen(false)}
                alt="Carte Asian Nour"
                closeLabel="Retour à ma commande"
            />
            <main className="page-shell space-y-8">
                <Toaster position="top-right" />

                {staffMode && staffConnecting && (
                    <div className="rounded-xl border border-violet-300 bg-violet-50 px-4 py-3 text-sm text-violet-900">
                        ⏳ <strong>Prise en charge de la table {tableId}…</strong>
                    </div>
                )}

                {staffMode && !canModifyCart && staffClaimError && !staffConnecting && (
                    <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 space-y-3">
                        <p>{staffClaimError}</p>
                        <button
                            type="button"
                            disabled={claimingMaster}
                            onClick={() => {
                                staffClaimAttemptsRef.current = 0;
                                void takeCharge({ force: true });
                            }}
                            className="inline-flex justify-center px-5 py-2.5 rounded-xl bg-[#7a5640] text-white font-semibold shadow-elevated hover:brightness-110 transition disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {claimingMaster ? "Prise en charge…" : "Réessayer la prise en charge"}
                        </button>
                    </div>
                )}

                {staffMode && canReleaseStaffTable && (
                    <div className="rounded-xl border border-violet-300 bg-violet-50 px-4 py-3 text-sm text-violet-900 flex flex-wrap items-center justify-between gap-3">
                        <span>
                            🍽️ <strong>Mode serveur</strong> — vous avez la priorité sur les téléphones clients.
                            {hasCartItems
                                ? " Le panier est synchronisé — envoyez en cuisine ou rendez la main à la table."
                                : " Ajoutez la commande, envoyez en cuisine, ou rendez la main aux convives."}
                        </span>
                        <button
                            type="button"
                            className="btn-ghost text-sm shrink-0 border border-violet-400/60 bg-white/70 hover:bg-white disabled:opacity-60"
                            disabled={releasingMaster || claimingMaster}
                            onClick={() => void releaseMaster()}
                        >
                            {releasingMaster ? "Libération…" : "Redonner la main à la table"}
                        </button>
                    </div>
                )}

                {staffMode && !staffConnecting && masterStatus.hasMaster && !masterStatus.isMaster && (
                    <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex flex-wrap items-center justify-between gap-3">
                        <span>Verrou serveur actif — libérez la table pour les convives.</span>
                        <button
                            type="button"
                            className="btn-ghost text-sm shrink-0 border border-amber-400/60 bg-white/70 hover:bg-white disabled:opacity-60"
                            disabled={releasingMaster}
                            onClick={() => void releaseMaster()}
                        >
                            {releasingMaster ? "Libération…" : "Forcer la libération"}
                        </button>
                    </div>
                )}

                {canModifyCart && !staffMode && (
                    <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 flex flex-wrap items-center justify-between gap-2">
                        <span>
                            📱 <strong>Vous gérez la commande</strong> pour cette table.
                        </span>
                        <button type="button" className="btn-ghost text-sm shrink-0" onClick={() => void releaseMaster()}>
                            Passer le relais
                        </button>
                    </div>
                )}

                {!staffMode && !masterStatus.loading && masterStatus.hasMaster && !masterStatus.isMaster && (
                    <div className="rounded-xl border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                        👀 <strong>Consultation seule</strong> — le serveur ou un autre convive gère le panier pour le
                        moment. Parcourez la carte librement ; seul le téléphone maître peut modifier le panier.
                    </div>
                )}

                {!staffMode && !masterStatus.loading && !masterStatus.hasMaster && (
                    <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 space-y-3">
                        <p>
                            📱 <strong>Aucun téléphone ne gère la commande</strong> pour cette table pour le moment.
                            {readOnlyMode
                                ? " Vous consultez la carte en lecture seule."
                                : " Désignez qui compose le panier avant d’ajouter des plats."}
                        </p>
                        <p className="text-amber-800/90">
                            Vous ou un autre convive pouvez reprendre la gestion ci-dessous, ou via « Accueil table »
                            puis « Je gère la commande pour la table ».
                        </p>
                        <button
                            type="button"
                            disabled={claimingMaster}
                            onClick={() => void takeCharge()}
                            className="w-full sm:w-auto inline-flex justify-center px-5 py-2.5 rounded-xl bg-[#7a5640] text-white font-semibold shadow-elevated hover:brightness-110 transition disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {claimingMaster ? "Prise en charge…" : "Je reprends la gestion de la commande"}
                        </button>
                    </div>
                )}

                <header className="surface-card-strong px-4 py-4 sm:px-6 sm:py-6 space-y-1.5 sm:space-y-2">
                    <span className="chip">{readOnlyMode ? "Consultation carte" : "Commande en cours"}</span>
                    <h1 className="text-2xl sm:text-3xl font-semibold">Asian Nour — Table {tableId}</h1>
                    <p className="surface-muted-text text-xs sm:text-sm hidden sm:block">
                        {readOnlyMode
                            ? "Parcourez la carte et les menus. Seul le téléphone maître peut ajouter au panier."
                            : staffMode
                              ? "Ajoutez les plats pour cette table, puis envoyez la commande en cuisine."
                              : "Composez votre menu ou sélectionnez vos plats à la carte. Choisissez le convive avant chaque ajout, puis envoyez une seule commande."}
                    </p>
                    {canModifyCart && (
                    <div className="flex flex-wrap items-center gap-4 pt-1">
                        <div className="flex items-center gap-2">
                            <span className="text-xs uppercase tracking-[0.2em] surface-muted-text">
                                Convives
                            </span>
                            <button
                                className="btn-ghost px-3 py-1"
                                onClick={() => adjustPeople(-1)}
                                title="Réduire le nombre de convives"
                            >
                                −
                            </button>
                            <span className="px-3 py-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-strong)] font-semibold">
                                {peopleCount}
                            </span>
                            <button
                                className="btn-ghost px-3 py-1"
                                onClick={() => adjustPeople(1)}
                                title="Augmenter le nombre de convives"
                            >
                                +
                            </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            {personIds.map((pid, idx) => {
                                const isActive = pid === activePerson;
                                const isEditing = editingPersonId === pid;
                                const index = idx + 1;
                                const key = String(index);
                                const displayName = getGuestNameForPersonId(pid);
                                const currentValue = guestNames[key] ?? "";

                                if (isEditing) {
                                    return (
                                        <span key={pid} className="inline-flex items-center rounded-full border-2 border-[var(--color-accent)] bg-white overflow-hidden shadow-sm">
                                            <input
                                                ref={inlineInputRef}
                                                defaultValue={currentValue}
                                                placeholder={`Convive ${index}`}
                                                maxLength={16}
                                                autoFocus
                                                className="w-28 px-3 py-1 text-sm bg-transparent outline-none text-[var(--color-text)]"
                                                onBlur={(e) => {
                                                    handleGuestNameChange(index, e.target.value);
                                                    setEditingPersonId(null);
                                                    setActivePerson(pid);
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter" || e.key === "Escape") {
                                                        handleGuestNameChange(index, (e.target as HTMLInputElement).value);
                                                        setEditingPersonId(null);
                                                        setActivePerson(pid);
                                                    }
                                                }}
                                            />
                                        </span>
                                    );
                                }

                                return (
                                    <button
                                        key={pid}
                                        className={`group px-3 py-1 rounded-full border transition flex items-center gap-1 ${isActive
                                            ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                                            : "border-[var(--color-border)] bg-[var(--color-surface-strong)] text-[var(--color-text)]"
                                        }`}
                                        onClick={() => {
                                            if (activePerson === pid) {
                                                setEditingPersonId(pid);
                                            } else {
                                                setActivePerson(pid);
                                            }
                                        }}
                                        title="Tap pour sélectionner · 2e tap pour renommer"
                                    >
                                        <span className="text-sm font-medium">{displayName}</span>
                                        <span className={`text-xs opacity-60 ${isActive ? "text-white" : "text-[var(--color-text-muted)]"}`}>
                                            ✎
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            className="btn-ghost text-xs"
                            type="button"
                            onClick={resetGuestNamesState}
                        >
                            Réinitialiser noms
                        </button>
                    </div>
                    )}
                </header>

                {/* Mini cart bar + navigation catégories */}
                <div className="sticky top-[56px] sm:top-[64px] z-30 space-y-2 sm:space-y-2.5">
                    {canModifyCart && (
                    <CompactCartBar
                        itemCount={cartItemCount}
                        totalCents={totalCents}
                        onClear={clearEntireCart}
                        onOpen={openCartDrawer}
                        openLabel="Panier"
                    />
                    )}

                    {!loading && formulaSliderCategories.length > 0 && (
                        <CategorySlider
                            categories={formulaSliderCategories}
                            activeId={activeFormulaId}
                            onCategorySelect={(id) => setActiveFormulaId(id)}
                        />
                    )}

                    {!loading && sliderCategories.length > 0 && (
                        <>
                            <p className="px-1 text-[10px] sm:text-xs font-semibold uppercase tracking-[0.14em] surface-muted-text">
                                À la carte
                            </p>
                            <CategorySlider
                                categories={sliderCategories}
                                activeId={activeCategoryId}
                                onCategorySelect={(id) => setActiveCategoryId(id)}
                            />
                        </>
                    )}
                </div>

                <section className="space-y-4 sm:space-y-5">
                    {loading ? (
                        <div className="surface-muted-text">Chargement…</div>
                    ) : (
                        <>
                            {menus.length > 0 && (
                                <article
                                    id={HOT_MENUS_SECTION_ID}
                                    className="space-y-2.5 sm:space-y-3 scroll-mt-24 sm:scroll-mt-32"
                                >
                                    <FormulaSectionHeading title="Menus chauds à composer" />
                                    <FormulaMenuGrid>
                                        {menus.map((m) => (
                                            <FormulaMenuCard
                                                key={m.id}
                                                name={m.name}
                                                priceCents={m.priceCents}
                                                imageUrl={m.imageUrl}
                                                actionLabel="Composer"
                                                onAction={() => composeMenu(m)}
                                                disabled={!canModifyCart}
                                                fallbackAction={
                                                    !canModifyCart ? (
                                                        <span className="text-[10px] sm:text-xs surface-muted-text shrink-0">
                                                            {staffMode ? "Prise en charge…" : "Consultation"}
                                                        </span>
                                                    ) : undefined
                                                }
                                            />
                                        ))}
                                    </FormulaMenuGrid>
                                </article>
                            )}

                            {coldMenuItems.length > 0 && (
                                <article
                                    id={COLD_MENUS_SECTION_ID}
                                    className="space-y-2.5 sm:space-y-3 scroll-mt-24 sm:scroll-mt-32"
                                >
                                    <FormulaSectionHeading title="Menus froids à composer" />
                                    <FormulaMenuGrid>
                                        {coldMenuItems.map((it) => (
                                            <FormulaMenuCard
                                                key={it.id}
                                                name={it.name}
                                                priceCents={it.priceCents}
                                                imageUrl={it.imageUrl}
                                                description={it.description}
                                                unavailable={it.available === false}
                                                actionLabel="Boisson"
                                                onAction={() => setColdMenuPick(it)}
                                                disabled={!canModifyCart}
                                                fallbackAction={
                                                    !canModifyCart && it.available !== false ? (
                                                        <span className="text-[10px] sm:text-xs surface-muted-text shrink-0">
                                                            Consultation
                                                        </span>
                                                    ) : undefined
                                                }
                                            />
                                        ))}
                                    </FormulaMenuGrid>
                                </article>
                            )}

                            {visibleCategorySections.map((section) => (
                                <article
                                    key={section.anchorId}
                                    id={section.anchorId}
                                    data-category-index={section.index}
                                    className="space-y-2.5 sm:space-y-3 scroll-mt-24 sm:scroll-mt-32"
                                >
                                    <h3 className="text-base sm:text-xl font-semibold text-sharp">{section.label}</h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3">
                                        {section.items.map((it) => {
                                            const unavailable = it.available === false;
                                            return (
                                                <div
                                                    key={it.id}
                                                    className={`surface-card overflow-hidden flex flex-col rounded-2xl border border-[var(--color-border)] relative ${
                                                        unavailable ? "opacity-50 pointer-events-none" : ""
                                                    }`}
                                                >
                                                    {it.imageUrl ? (
                                                        <div className="relative w-full aspect-[4/3] bg-[var(--color-background-secondary)]">
                                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                                            <img
                                                                src={it.imageUrl}
                                                                alt={it.name}
                                                                className="absolute inset-0 w-full h-full object-cover"
                                                                loading="lazy"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="w-full aspect-[4/3] bg-[var(--color-background-secondary)] flex items-center justify-center text-3xl select-none">
                                                            🍱
                                                        </div>
                                                    )}
                                                    <div className="flex flex-col flex-1 px-3 pt-2 pb-3 gap-2">
                                                        <div className="flex-1">
                                                            <div className="font-medium text-sm leading-snug line-clamp-2">{it.name}</div>
                                                            {it.description ? (
                                                                <p className="text-xs surface-muted-text mt-0.5 line-clamp-2">{it.description}</p>
                                                            ) : null}
                                                        </div>
                                                        <div className="flex items-center justify-between gap-1 flex-wrap">
                                                            <span className="text-sm font-semibold text-[var(--color-accent-strong)]">{formatMoney(it.priceCents)}</span>
                                                            {unavailable ? (
                                                                <span className="text-xs font-medium text-[var(--color-text-muted)] bg-[var(--color-surface-muted,#333)] rounded px-2 py-0.5">
                                                                    Indisponible
                                                                </span>
                                                            ) : canModifyCart ? (
                                                                isColdMenuItem(it) ? (
                                                                    <button
                                                                        className="btn-soft text-xs px-2 py-1 shrink-0"
                                                                        onClick={() => setColdMenuPick(it)}
                                                                    >
                                                                        Choisir boisson
                                                                    </button>
                                                                ) : (
                                                                    <div className="flex items-center gap-1 shrink-0">
                                                                        {isSupplementableCategory(it.category) &&
                                                                            (staffMode || allowedSupplements.length > 0) && (
                                                                                <button
                                                                                    className="btn-ghost text-xs px-2 py-1"
                                                                                    onClick={() => setSupplementTarget(it)}
                                                                                    title="Ajouter un supplément"
                                                                                >
                                                                                    + Suppl.
                                                                                </button>
                                                                            )}
                                                                        <button
                                                                            className="btn-soft text-xs px-2 py-1"
                                                                            onClick={() =>
                                                                                addToCartLine(
                                                                                    buildKitchenItemLabel(it.category, it.name),
                                                                                    it.priceCents
                                                                                )
                                                                            }
                                                                        >
                                                                            + {getGuestNameForPersonId(activePerson)}
                                                                        </button>
                                                                    </div>
                                                                )
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </article>
                            ))}
                        </>
                    )}
                </section>

                {hasCartItems && !cartDrawerOpen && canModifyCart && (
                    <button
                        className="sm:hidden fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] right-5 z-50 rounded-full bg-[var(--color-accent)] text-white px-4 py-3 shadow-elevated flex items-center gap-2"
                        onClick={openCartDrawer}
                    >
                        <span className="font-semibold">Panier</span>
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-[var(--color-accent)] text-xs font-bold">
                            {cartItemCount}
                        </span>
                    </button>
                )}
            </main>

            {composeState && (
                <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center bg-black/40 sm:p-4">
                    <div
                        className="surface-card w-full sm:max-w-2xl sm:mx-auto rounded-t-2xl sm:rounded-2xl shadow-elevated flex flex-col max-h-[100dvh] sm:max-h-[90dvh] overflow-hidden"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="compose-menu-title"
                    >
                        <div className="shrink-0 px-5 pt-5 pb-3 sm:px-6 border-b border-[var(--color-border)] space-y-3">
                            <div className="flex items-start justify-between gap-3">
                                <h3 id="compose-menu-title" className="text-xl font-semibold">
                                    Composer {composeState.menu.name}
                                </h3>
                                <span className="text-sm surface-muted-text shrink-0">
                                    Total menu&nbsp;: {formatMoney(composeState.menu.priceCents)}
                                </span>
                            </div>

                            {(() => {
                                const summary = composeState.steps
                                    .map((step) => {
                                        const selectedIds = composeState.selectionMap[step.group.id] ?? [];
                                        const items = selectedIds
                                            .map((id) => menuItemMap.get(id))
                                            .filter((it): it is MenuItem => Boolean(it));
                                        if (!items.length) return null;
                                        return {
                                            id: step.group.id,
                                            name: step.group.name,
                                            value: items.map((it) => it.name).join(step.multi ? " + " : ", "),
                                        };
                                    })
                                    .filter(Boolean) as { id: string; name: string; value: string }[];
                                if (!summary.length) return null;
                                return (
                                    <div className="surface-panel border border-[rgba(120,110,98,0.18)] rounded-xl px-4 py-3 text-sm space-y-1">
                                        {summary.map((item) => (
                                            <div key={item.id} className="flex items-center justify-between gap-2">
                                                <span className="font-medium">{item.name}</span>
                                                <span className="surface-muted-text text-right">{item.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>

                        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6 space-y-4">
                            {composeState.steps.map((step) => {
                                const selectedIds = composeState.selectionMap[step.group.id] ?? [];
                                const instruction = requirementText(step);
                                const error = composeErrors[step.group.id];

                                return (
                                    <section
                                        key={step.group.id}
                                        className={`rounded-xl border px-4 py-3 space-y-2 ${error ? "border-red-400 bg-red-50/60" : "border-[var(--color-border)] bg-[var(--color-surface)]"
                                            }`}
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="font-medium">{step.group.name}</div>
                                            <span className="text-xs surface-muted-text uppercase tracking-[0.18em]">
                                                {step.displayCategory || step.group.categoryFilter}
                                            </span>
                                        </div>
                                        {step.xorKey && (
                                            <p className="text-xs font-medium text-amber-600">
                                                Choisissez UNE entrée OU UNE paire de yakitoris.
                                            </p>
                                        )}

                                        {step.options.length === 0 ? (
                                            <div className="text-xs surface-muted-text">
                                                Aucun plat trouvé pour cette étape. Contactez le serveur.
                                            </div>
                                        ) : step.multi ? (
                                            <div className="space-y-2">
                                                {step.options.map((opt) => {
                                                    const checked = selectedIds.includes(opt.id);
                                                    return (
                                                        <label
                                                            key={opt.id}
                                                            className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-strong)] px-3 py-2 text-sm"
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={checked}
                                                                onChange={() => handleCheckboxToggle(step, opt.id)}
                                                                className="w-4 h-4"
                                                            />
                                                            <span className="flex-1">
                                                                {step.includeCategory
                                                                    ? `${opt.name} — ${opt.category}`
                                                                    : opt.name}
                                                            </span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <select
                                                value={selectedIds[0] ?? ""}
                                                onChange={(e) => handleSingleSelect(step, e.target.value || null)}
                                                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-strong)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                                            >
                                                <option value="">— Sélectionner —</option>
                                                {step.options.map((opt) => (
                                                    <option key={opt.id} value={opt.id}>
                                                        {step.includeCategory ? `${opt.name} — ${opt.category}` : opt.name}
                                                    </option>
                                                ))}
                                            </select>
                                        )}

                                        <p className="text-xs surface-muted-text">{instruction}</p>
                                        {error && <p className="text-xs text-red-600">{error}</p>}
                                    </section>
                                );
                            })}
                        </div>

                        <div className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4 sm:px-6 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] space-y-3">
                            <div className="text-sm surface-muted-text">
                                Ajouté pour <span className="font-semibold">{getGuestNameForPersonId(activePerson)}</span>
                            </div>
                            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2">
                                <button className="btn-ghost w-full sm:w-auto py-3" onClick={cancelCompose}>
                                    Annuler
                                </button>
                                <button
                                    className="btn-primary w-full sm:w-auto py-3"
                                    onClick={confirmCompose}
                                    disabled={Object.keys(composeErrors).length > 0}
                                >
                                    Ajouter ({formatMoney(composeState.menu.priceCents)})
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {coldMenuPick && (
                <ColdMenuDrinkModal
                    menu={coldMenuPick}
                    menuItems={menuItems}
                    formatPrice={formatMoney}
                    confirmLabel={`Ajouter pour ${getGuestNameForPersonId(activePerson)} (${formatMoney(coldMenuPick.priceCents)})`}
                    onClose={() => setColdMenuPick(null)}
                    onConfirm={(label, priceCents) => {
                        addToCartLine(label, priceCents);
                        setColdMenuPick(null);
                    }}
                />
            )}

            {supplementTarget && (
                <SupplementPicker
                    itemName={supplementTarget.name}
                    mode={staffMode ? "staff" : "client"}
                    allowed={allowedSupplements}
                    onClose={() => setSupplementTarget(null)}
                    onConfirm={(supps) => {
                        addToCartLine(
                            buildKitchenItemLabel(supplementTarget.category, supplementTarget.name),
                            supplementTarget.priceCents,
                            activePerson,
                            supps
                        );
                        setSupplementTarget(null);
                    }}
                />
            )}

            {showOrderUi && showScrollTopFab && !cartDrawerOpen && (
                <button
                    type="button"
                    onClick={scrollToPageTop}
                    className="fixed bottom-6 right-4 z-50 inline-flex items-center gap-2 rounded-full border border-[rgba(190,127,57,0.45)] bg-[rgba(255,252,247,0.96)] px-4 py-2.5 text-sm font-medium text-[var(--color-heading)] shadow-[0_8px_24px_rgba(61,47,33,0.18)] backdrop-blur-sm transition hover:bg-white hover:shadow-[0_10px_28px_rgba(61,47,33,0.22)] active:translate-y-px sm:bottom-8 sm:right-6"
                    aria-label="Retour en haut de la carte pour changer de convive ou de catégorie"
                >
                    <svg
                        className="h-4 w-4 shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <path d="M12 19V5" />
                        <path d="m5 12 7-7 7 7" />
                    </svg>
                    Haut de la carte
                </button>
            )}

            {cartDrawerOpen && canModifyCart && (
                <div className="fixed inset-0 z-[60] flex">
                    <div className="absolute inset-0 bg-black/40" onClick={closeCartDrawer} />
                    <aside className="relative ml-auto flex h-[100dvh] max-h-[100dvh] w-full max-w-md flex-col bg-[var(--color-surface)] shadow-elevated overflow-hidden">
                        <header className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
                            <div>
                                <div className="text-lg font-semibold">Mon panier</div>
                                <div className="text-xs surface-muted-text">{cartItemCount} article(s) — {formatMoney(totalCents)}</div>
                            </div>
                            <button className="btn-ghost" onClick={closeCartDrawer}>
                                Fermer
                            </button>
                        </header>

                        <div ref={cartScrollRef} className="flex-1 min-h-0 overflow-y-scroll overscroll-contain px-6 py-4 space-y-5">
                            <div className="space-y-2">
                                <label className="text-sm font-medium" htmlFor="cart-comment">
                                    Commentaire (optionnel)
                                </label>
                                <textarea
                                    id="cart-comment"
                                    value={tableComment}
                                    onChange={(e) => setTableComment(e.target.value)}
                                    rows={3}
                                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-strong)] px-3 py-2 text-sm"
                                    placeholder="Allergies, cuisson, etc."
                                />
                            </div>

                            {personIds.map((pid) => {
                                const lines = cartByPerson.get(pid) ?? [];
                                const subtotal = lines.reduce((s, l) => s + l.priceCents * l.qty, 0);
                                const count = lines.reduce((s, l) => s + l.qty, 0);
                                const expanded = expandedPersons.has(pid);
                                const displayName = getGuestNameForPersonId(pid);
                                return (
                                    <div key={pid} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-strong)]">
                                        <button
                                            className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
                                            onClick={() => togglePersonPanel(pid)}
                                        >
                                            <div>
                                                <div className="font-semibold">{displayName}</div>
                                                <div className="text-xs surface-muted-text">
                                                    {count} article(s) — {formatMoney(subtotal)}
                                                </div>
                                            </div>
                                            <span className="text-lg font-semibold">
                                                {expanded ? "−" : "+"}
                                            </span>
                                        </button>
                                        {expanded && (
                                            <div className="border-t border-[var(--color-border)] px-4 py-3 space-y-3">
                                                <div className="flex items-center justify-between text-xs surface-muted-text">
                                                    <span>
                                                        Sous-total&nbsp;{formatMoney(subtotal)}
                                                    </span>
                                                    <button
                                                        className="btn-ghost text-xs"
                                                        onClick={() => clearPersonCart(pid)}
                                                        disabled={lines.length === 0}
                                                    >
                                                        Vider {displayName}
                                                    </button>
                                                </div>
                                                {lines.length === 0 ? (
                                                    <div className="text-sm surface-muted-text">Aucun plat pour {displayName}.</div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {lines.map((line) => (
                                                            <div
                                                                key={`${line.personId}:${line.id}`}
                                                                className="flex items-start justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
                                                            >
                                                                <div className="flex-1">
                                                                    <div className="font-medium text-sm leading-snug">{line.name}</div>
                                                                    {line.supplements?.length ? (
                                                                        <ul className="text-xs text-[var(--color-accent-strong)] mt-0.5 space-y-0.5">
                                                                            {line.supplements.map((s, i) => (
                                                                                <li key={i}>+ {s.label} ({formatMoney(s.priceCents)})</li>
                                                                            ))}
                                                                        </ul>
                                                                    ) : null}
                                                                    <div className="text-xs surface-muted-text">{formatMoney(line.priceCents)}</div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <button
                                                                        className="px-2 py-1 rounded-full border border-[var(--color-border)] hover:bg-[var(--color-accent-soft)] transition"
                                                                        onClick={() => decFromCart(line.id, line.personId)}
                                                                        title="Retirer"
                                                                    >
                                                                        −
                                                                    </button>
                                                                    <span className="w-8 text-center text-sm font-semibold">{line.qty}</span>
                                                                    <button
                                                                        className="px-2 py-1 rounded-full border border-[var(--color-border)] hover:bg-[var(--color-accent-soft)] transition"
                                                                        onClick={() => incLine(line.id, line.personId)}
                                                                        title="Ajouter"
                                                                    >
                                                                        +
                                                                    </button>
                                                                    <button
                                                                        className="px-2 py-1 rounded-full border border-red-300 text-red-600 hover:bg-red-50 transition"
                                                                        onClick={() => removeLineFromCart(line.id, line.personId)}
                                                                        title="Supprimer"
                                                                    >
                                                                        ×
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <footer className="shrink-0 px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] border-t border-[var(--color-border)] bg-[var(--color-surface)] space-y-3">
                            <div className="flex items-center justify-between font-semibold">
                                <span>Total</span>
                                <span>{formatMoney(totalCents)}</span>
                            </div>
                            <button
                                className="btn-primary w-full py-3.5"
                                onClick={() => setConfirmSubmitOpen(true)}
                                disabled={!hasCartItems}
                            >
                                Envoyer la commande
                            </button>
                        </footer>
                    </aside>
                </div>
            )}
            <ConfirmActionModal
                open={confirmSubmitOpen}
                title="Confirmer l'envoi en cuisine ?"
                message={`${cartItemCount} article${cartItemCount > 1 ? "s" : ""} — total ${formatMoney(totalCents)}. La commande sera transmise immédiatement.`}
                confirmLabel="Envoyer en cuisine"
                onCancel={() => setConfirmSubmitOpen(false)}
                onConfirm={() => {
                    setConfirmSubmitOpen(false);
                    void executeSubmitOrder();
                }}
            />
            </>
            )}
        </>
    );
}

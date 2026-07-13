'use client';
import {
    AlertCircle,
    Anchor,
    Check,
    ChevronDown,
    Clock,
    Crosshair,
    Home,
    MapPin,
    Save,
    ShieldAlert,
    Ship as ShipIcon,
    Users,
    Warehouse,
    X,
} from 'lucide-react';
import { useMemo, useState } from 'react';

// ─── Schema dictionary — Refined variant definitions ─────────────────────────

const MISSION_TYPES = [
    'SAR', 'Anti-Piracy', 'Surface Contact', 'HADR', 'Routine PSM',
    'Convoy Escort', 'Strike Mission', 'ASW Hunt', 'Forward Presence',
    'Flag Showing', 'Standby', 'Medium-Threat Security',
];

const DOCKYARD_OPTIONS = ['Dockyard A', 'Dockyard B', 'Dockyard C'];
const BASE_OPTIONS = ['Base A', 'Base B', 'Base C'];

const ACTIVITY_SCHEMA = {
    mission: {
        label: 'Mission',
        icon: Crosshair,
        fields: [
            { key: 'missionType', label: 'Mission Type', type: 'select', options: MISSION_TYPES, required: true },
            { key: 'coordinates', label: 'Coordinates', type: 'text', placeholder: 'e.g. 18.9220° N, 72.8347° E', required: true },
            { key: 'log', label: 'Mission Log', type: 'textarea', placeholder: 'Enter mission log details…', required: true },
        ],
    },
    combat_group: {
        label: 'Combat Group',
        icon: ShieldAlert,
        fields: [
            { key: 'companionUnits', label: 'Companion Ship Units', type: 'multiselect', options: 'shipsExcludingActive', required: true },
            { key: 'coordinates', label: 'Coordinates', type: 'text', placeholder: 'e.g. 18.9220° N, 72.8347° E', required: true },
            { key: 'log', label: 'Mission Log', type: 'textarea', placeholder: 'Enter mission log details…', required: true },
        ],
    },
    dockyard: {
        label: 'Dockyard',
        icon: Warehouse,
        fields: [
            { key: 'dockyard', label: 'Dockyard', type: 'select', options: DOCKYARD_OPTIONS, required: true },
            { key: 'log', label: 'Activity Log', type: 'textarea', placeholder: 'Enter activity log details…', required: true },
        ],
    },
    base: {
        label: 'Base',
        icon: Home,
        fields: [
            { key: 'baseLocation', label: 'Base Location', type: 'select', options: BASE_OPTIONS, required: true },
            { key: 'log', label: 'Activity Log', type: 'textarea', placeholder: 'Enter activity log details…', required: true },
        ],
    },
};

const LOCATION_OPTIONS = Object.entries(ACTIVITY_SCHEMA).map(([key, v]) => ({
    key, label: v.label, icon: v.icon,
}));

const DEFAULT_ALL_SHIPS = [
    { id: 'inskolkata', name: 'INS KOLKATA' }, { id: 'inschennai', name: 'INS CHENNAI' },
    { id: 'instushil', name: 'INS TUSHIL' }, { id: 'instabar', name: 'INS TABAR' },
    { id: 'inssaryu', name: 'INS SARYU' }, { id: 'insimphal', name: 'INS IMPHAL' },
    { id: 'insvisakhapatnam', name: 'INS VISAKHAPATNAM' }, { id: 'istamal', name: 'INS TAMAL' },
];

function formatTimestamp(d) {
    return d.toLocaleString(undefined, {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

// ─── Field renderer ───────────────────────────────────────────────────────────

function FieldControl({ field, value, error, onChange, allShips, activeShipId }) {
    const base =
        'w-full rounded-lg bg-[#2F363D] border text-[15px] text-[#D6D6D6] placeholder-[#6b7280] px-3.5 py-2.5 outline-none transition-colors focus:border-[#2F6FED]';
    const borderColor = error ? 'border-rose-500' : 'border-[#4A5562]';

    if (field.type === 'select') {
        return (
            <div className="relative">
                <select
                    value={value ?? ''}
                    onChange={e => onChange(field.key, e.target.value)}
                    className={`${base} ${borderColor} appearance-none pr-9 cursor-pointer`}
                >
                    <option value="" disabled>Select {field.label.toLowerCase()}…</option>
                    {field.options.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                    ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-[#8b92a0]" />
            </div>
        );
    }

    if (field.type === 'multiselect') {
        const list = field.options === 'shipsExcludingActive'
            ? allShips.filter(s => s.id !== activeShipId)
            : field.options;
        const selected = Array.isArray(value) ? value : [];
        function toggle(id) {
            const next = selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id];
            onChange(field.key, next);
        }
        return (
            <div className={`rounded-lg border ${borderColor} bg-[#2F363D] p-2 flex flex-wrap gap-2`}>
                {list.length === 0 && <span className="text-[13px] text-[#6b7280] px-1.5 py-1">No other units available</span>}
                {list.map(unit => {
                    const id = unit.id ?? unit;
                    const label = unit.name ?? unit;
                    const active = selected.includes(id);
                    return (
                        <button
                            type="button"
                            key={id}
                            onClick={() => toggle(id)}
                            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold border transition-colors ${active
                                ? 'bg-[#2F6FED] border-[#2F6FED] text-white'
                                : 'bg-[#242A31] border-[#4A5562] text-[#D6D6D6] hover:border-[#2F6FED]'
                                }`}
                        >
                            <ShipIcon className="size-3" />
                            {label}
                        </button>
                    );
                })}
            </div>
        );
    }

    if (field.type === 'textarea') {
        return (
            <textarea
                value={value ?? ''}
                onChange={e => onChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                rows={5}
                className={`${base} ${borderColor} resize-none`}
            />
        );
    }

    return (
        <input
            type="text"
            value={value ?? ''}
            onChange={e => onChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            className={`${base} ${borderColor}`}
        />
    );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function ShipActivityPanel({
    ship,
    allShips = DEFAULT_ALL_SHIPS,
    onClose,
    onSaved,
}) {
    const [locationKey, setLocationKey] = useState('mission');
    const [formValues, setFormValues] = useState({});
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [successMsg, setSuccessMsg] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);

    const variant = ACTIVITY_SCHEMA[locationKey];
    const activeShipId = ship?.id ?? null;

    const locationIcon = useMemo(() => {
        const found = LOCATION_OPTIONS.find(o => o.key === locationKey);
        return found?.icon ?? MapPin;
    }, [locationKey]);
    const LocationIcon = locationIcon;

    function handleLocationChange(key) {
        setLocationKey(key);
        setFormValues({});
        setErrors({});
    }

    function handleFieldChange(key, value) {
        setFormValues(prev => ({ ...prev, [key]: value }));
        setErrors(prev => (prev[key] ? { ...prev, [key]: null } : prev));
    }

    function validate() {
        const nextErrors = {};
        for (const field of variant.fields) {
            const val = formValues[field.key];
            const empty =
                field.type === 'multiselect' ? !Array.isArray(val) || val.length === 0 : !val || String(val).trim() === '';
            if (field.required && empty) nextErrors[field.key] = 'Required';
        }
        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    }

    function handleSave() {
        if (!validate()) return;
        setSaving(true);
        setSuccessMsg(null);

        const timestamp = new Date();
        const payload = {
            shipId: activeShipId,
            activityType: locationKey,
            ...formValues,
            timestamp: timestamp.toISOString(),
        };

        setTimeout(() => {
            setSaving(false);
            setLastUpdated(timestamp);
            setSuccessMsg('Activity saved successfully');
            onSaved?.(payload);
            setTimeout(() => setSuccessMsg(null), 2500);
        }, 600);
    }

    return (
        <div className="flex flex-col h-full bg-[#1B1F24] text-[#D6D6D6]">
            {/* Header */}
            <div className="shrink-0 px-5 pt-4 pb-3 border-b border-[#4A5562] bg-[#242A31]">
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                            <ShieldAlert className="size-4 text-[#2F6FED] shrink-0" />
                            <span className="text-[13px] font-bold uppercase tracking-wider text-[#8b92a0]">
                                Ship Activity
                            </span>
                        </div>
                        <div className="text-[22px] font-extrabold text-white leading-tight truncate">
                            {ship?.name ?? 'No vessel selected'}
                        </div>
                    </div>

                    {onClose && (
                        <button
                            onClick={onClose}
                            className="shrink-0 rounded-full p-2 text-[#a9b0d1] hover:bg-[#2F363D] hover:text-white transition-colors"
                        >
                            <X className="size-5" />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2 rounded-lg bg-[#2F363D] border border-[#4A5562] px-3 py-2 w-fit">
                    <Clock className="size-3.5 text-[#8b92a0] shrink-0" />
                    <span className="text-[13px] font-semibold text-[#D6D6D6]">
                        Last updated: {lastUpdated ? formatTimestamp(lastUpdated) : '—'}
                    </span>
                </div>
            </div>

            {/* Success alert */}
            {successMsg && (
                <div className="shrink-0 mx-5 mt-3 flex items-center gap-2 rounded-lg bg-emerald-950/60 border border-emerald-700 px-3.5 py-2.5">
                    <Check className="size-4 text-emerald-400 shrink-0" />
                    <span className="text-[14px] font-bold text-emerald-400">{successMsg}</span>
                </div>
            )}

            {/* Form body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
                {/* Location selector */}
                <div>
                    <label className="block text-[14px] font-bold text-white mb-2">Location</label>
                    <div className="relative">
                        <select
                            value={locationKey}
                            onChange={e => handleLocationChange(e.target.value)}
                            className="w-full appearance-none rounded-lg bg-[#2F363D] border border-[#4A5562] text-[16px] font-semibold text-white px-4 py-3 pr-10 outline-none cursor-pointer focus:border-[#2F6FED] transition-colors"
                        >
                            {LOCATION_OPTIONS.map(opt => (
                                <option key={opt.key} value={opt.key}>{opt.label}</option>
                            ))}
                        </select>
                        <LocationIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#2F6FED]" />
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-5 text-[#8b92a0]" />
                    </div>
                </div>

                {/* Dynamic fields */}
                {variant.fields.map(field => (
                    <div key={field.key}>
                        <label className="flex items-center justify-between mb-2">
                            <span className="text-[14px] font-bold text-white">
                                {field.label}
                                {field.required && <span className="text-[#2F6FED] ml-1">*</span>}
                            </span>
                            {errors[field.key] && (
                                <span className="flex items-center gap-1 text-[12px] font-semibold text-rose-400">
                                    <AlertCircle className="size-3" />{errors[field.key]}
                                </span>
                            )}
                        </label>
                        <FieldControl
                            field={field}
                            value={formValues[field.key]}
                            error={errors[field.key]}
                            onChange={handleFieldChange}
                            allShips={allShips}
                            activeShipId={activeShipId}
                        />
                    </div>
                ))}
            </div>

            {/* Footer actions */}
            <div className="shrink-0 border-t border-[#4A5562] bg-[#242A31] px-5 py-4 flex items-center gap-3">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[#2F6FED] hover:bg-[#3b7bf7] disabled:opacity-60 text-white text-[16px] font-bold py-3 transition-colors"
                >
                    {saving ? (
                        <>
                            <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                            Saving…
                        </>
                    ) : (
                        <>
                            <Save className="size-4" />
                            Save
                        </>
                    )}
                </button>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="rounded-lg border border-[#4A5562] text-[#D6D6D6] hover:bg-[#2F363D] text-[15px] font-semibold px-5 py-3 transition-colors"
                    >
                        Close
                    </button>
                )}
            </div>
        </div>
    );
}
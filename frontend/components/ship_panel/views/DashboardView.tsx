'use client';

import { useState, useEffect } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ShipState extends Record<string, any> {}

interface DashboardProps {
  data: ShipState;
  editMode: boolean;
  onChange: (path: string[], value: any) => void;
}

// ─── Constants & Styles ───────────────────────────────────────────────────────
const ACRONYMS = new Set([
  'esm', 'vds', 'sam', 'pdms', 'ciws', 'ecm', 'satcom', 'otht', 'cms', 'jtc',
  'hadr', 'dg', 'asw', 'gt', 'sst', 'rib', 'ribs', 'id', 'opdef', 'hf'
]);

const NOTCH_10 = 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))';
const NOTCH_7  = 'polygon(0 0, calc(100% - 7px) 0, 100% 7px, 100% 100%, 7px 100%, 0 calc(100% - 7px))';

type StatusColor = 'green' | 'red' | 'yellow' | 'blue';

const COLORS: Record<StatusColor, { text: string; border: string; bg: string }> = {
  green:  { text: 'text-[#4ade80]', border: 'border-[#1a3324]', bg: 'bg-[#4ade80]' },
  yellow: { text: 'text-[#e0983a]', border: 'border-[#3a2b15]', bg: 'bg-[#e0983a]' },
  red:    { text: 'text-[#f07272]', border: 'border-[#3a2020]', bg: 'bg-[#f07272]' },
  blue:   { text: 'text-[#6cabff]', border: 'border-[#1e2538]', bg: 'bg-[#6cabff]' }, 
};

// ─── Shared Helpers ───────────────────────────────────────────────────────────
function humanizeKey(key: string): string {
  return key.split('_').map(word => {
    const lower = word.toLowerCase();
    if (ACRONYMS.has(lower)) return lower.toUpperCase();
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
}

function getWeaponColor(active: number, available: number): StatusColor {
  if (available === 0) return 'red';
  if (active === available) return 'green';
  return 'yellow';
}

function getNumColor(val: number, high: number, med: number): StatusColor {
  if (val >= high) return 'green';
  if (val >= med) return 'yellow';
  return 'red';
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const ChevronDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6"/>
  </svg>
);

const ChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6"/>
  </svg>
);

// ─── Primitive Editing Components ─────────────────────────────────────────────
function EditableNum({ value, onCommit, editMode, className }: {
  value: number; onCommit: (v: number) => void; editMode: boolean; className?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  if (!editMode) return <span className={className}>{value}</span>;
  return (
    <input 
      type="number" 
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { const n = Number(draft); if (!isNaN(n)) onCommit(n); }}
      onKeyDown={e => { if (e.key === 'Enter') { const n = Number(draft); if (!isNaN(n)) onCommit(n); } }}
      className={`w-14 bg-[#111520] border border-[#2f6fc9] rounded px-1 color-[#e8eaf2] font-inherit outline-none focus:border-blue-400 text-sm h-6 flex-shrink-0 ${className?.replace(/text-\[.*?\]/, '')}`}
    />
  );
}

function EditableBool({ value, colorName, onCommit, editMode, onText = 'YES', offText = 'NO' }: {
  value: boolean; colorName: StatusColor; onCommit: (v: boolean) => void; editMode: boolean; onText?: string; offText?: string;
}) {
  const c = COLORS[colorName];
  if (!editMode) return (
    <span className={`text-[9px] font-black tracking-[0.1em] flex-shrink-0 ${c.text}`}>
      {value ? onText : offText}
    </span>
  );
  return (
    <button 
      onClick={() => onCommit(!value)} 
      className={`text-[9px] font-bold px-1.5 py-0.5 rounded border transition-colors cursor-pointer tracking-[0.1em] uppercase ${
        value 
          ? 'border-[#1a3324] bg-[#0e1a12] text-[#4ade80] hover:bg-[#14281b]' 
          : 'border-[#3a2020] bg-[#1a1010] text-[#f07272] hover:bg-[#281818]'
      }`}
    >
      {value ? onText : offText}
    </button>
  );
}

// ─── Layout Components ────────────────────────────────────────────────────────

function WeaponCard({ label, active, available, editMode, onEditActive, onEditAvailable }: {
  label: string; active: number; available: number; editMode: boolean;
  onEditActive?: (v: number) => void; onEditAvailable?: (v: number) => void;
}) {
  const colName = getWeaponColor(active, available);
  const c = COLORS[colName];
  const pct = available > 0 ? (active / available) * 100 : 0;

  return (
    <div style={{ clipPath: NOTCH_10 }} className={`bg-[#161b28] border p-2.5 flex flex-col gap-1.5 ${c.border}`}>
      <div className="text-[10px] font-bold tracking-[0.08em] uppercase text-white">{humanizeKey(label)}</div>
      
      {editMode ? (
        <div className="flex items-baseline gap-1 mt-auto">
          <EditableNum value={active} onCommit={v => onEditActive?.(v)} editMode={editMode} className="text-[#e8eaf2]" />
          <span className="text-[13px] font-bold text-[#4a5168]">/</span>
          <EditableNum value={available} onCommit={v => onEditAvailable?.(v)} editMode={editMode} className="text-[#e8eaf2]" />
        </div>
      ) : (
        <div className="flex items-baseline gap-1 mt-auto leading-none">
          <span className={`text-[28px] font-black ${c.text}`}>{active}</span>
          <span className={`text-[28px] font-bold ${c.text}`}>/{available}</span>
        </div>
      )}

      {/* <div className="h-1 bg-[#1a1f30] rounded-sm overflow-hidden mt-1">
        <div className={`h-full rounded-sm transition-all duration-500 ${c.bg}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div> */}
    </div>
  );
}

function SystemRow({ label, value, colorName, editMode, onEditNum, onToggleBool, onText = 'YES', offText = 'NO', suffix }: {
  label: string; value: any; colorName: StatusColor; editMode: boolean;
  onEditNum?: (v: number) => void; onToggleBool?: (v: boolean) => void;
  onText?: string; offText?: string; suffix?: string;
}) {
  const c = COLORS[colorName];
  const isNum = typeof value === 'number';

  return (
    <div style={{ clipPath: NOTCH_7 }} className={`bg-[#161b28] border flex items-center gap-2 px-2.5 py-[7px] ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.bg}`} />
      <span className="text-[9px] font-bold tracking-[0.1em] uppercase text-white flex-1 truncate">
        {humanizeKey(label)}
      </span>
      {isNum ? (
        <div className="flex items-baseline gap-1 flex-shrink-0">
          {editMode ? (
            <EditableNum value={value} onCommit={v => onEditNum?.(v)} editMode={editMode} className={c.text} />
          ) : (
            <span className={`text-[9px] font-black tracking-[0.1em] ${c.text}`}>{value}{suffix ? ` ${suffix}` : ''}</span>
          )}
        </div>
      ) : (
        <EditableBool value={value} colorName={colorName} onCommit={v => onToggleBool?.(v)} editMode={editMode} onText={onText} offText={offText} />
      )}
    </div>
  );
}

function HeloCard({ label, count, editMode, onEdit }: {
  label: string; count: number; editMode: boolean; onEdit?: (v: number) => void;
}) {
  const colName = count === 0 ? 'red' : count === 1 ? 'yellow' : 'green';
  const c = COLORS[colName];

  return (
    <div style={{ clipPath: NOTCH_10 }} className={`bg-[#161b28] border p-2.5 flex flex-col gap-1.5 ${c.border}`}>
      <div className="text-[9px] font-bold tracking-[0.08em] uppercase text-white">{humanizeKey(label)}</div>
      {editMode ? (
        <EditableNum value={count} onCommit={v => onEdit?.(v)} editMode={editMode} className={c.text} />
      ) : (
        <span className={`text-[26px] font-black leading-none ${c.text}`}>{count}</span>
      )}
    </div>
  );
}

// ─── Major Sections ───────────────────────────────────────────────────────────

function CombatSection({ data, editMode, onChange }: DashboardProps) {
  const [openSection, setOpenSection] = useState<'surveillance' | 'comms' | 'defensive' | null>('surveillance');
  
  const cs = data.combat_system_state ?? {};
  const surv = cs.surveillance_systems ?? {};
  const weapons = cs.weapon_status ?? {};
  const comms = cs.communication_system ?? {};
  const defensive = cs.defensive_system ?? {};

  const toggleSection = (section: 'surveillance' | 'comms' | 'defensive') => {
    setOpenSection(prev => prev === section ? null : section);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-2.5 w-full">
      {/* WEAPONS */}
      <div className="bg-[#111520] border border-[#1e2538] p-2.5 flex-[3] flex flex-col">
        <div className="text-[9px] font-black tracking-[0.15em] text-[#4a5168] uppercase mb-2">Weapon Status</div>
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(115px, 1fr))' }}>
          {Object.entries(weapons).map(([k, v]: [string, any]) => (
            <WeaponCard 
              key={k} label={k} active={v.active} available={v.available} editMode={editMode}
              onEditActive={val => onChange(['combat_system_state', 'weapon_status', k, 'active'], val)}
              onEditAvailable={val => onChange(['combat_system_state', 'weapon_status', k, 'available'], val)} 
            />
          ))}
        </div>
      </div>

      {/* SYSTEMS ACCORDION */}
      <div className="bg-[#111520] border border-[#1e2538] p-2.5 flex-[2] flex flex-col gap-2">
        <div className="text-[9px] font-black tracking-[0.15em] text-[#4a5168] uppercase mb-1">Systems</div>
        
        {/* Surveillance */}
        <div className="flex flex-col border border-[#1e2538] bg-[#161b28]">
          <button onClick={() => toggleSection('surveillance')} className="flex items-center justify-between px-2.5 py-2 hover:bg-[#1a1f30] transition-colors cursor-pointer outline-none text-[#4a5168]">
            <span className="text-[9px] font-black tracking-[0.15em] uppercase">Surveillance</span>
            {openSection === 'surveillance' ? <ChevronDown /> : <ChevronRight />}
          </button>
          {openSection === 'surveillance' && (
            <div className="flex flex-col gap-1 p-2 bg-[#0b0e17] border-t border-[#1e2538]">
              {Object.entries(surv).map(([k, v]: [string, any]) => (
                <SystemRow key={k} label={k} value={v} colorName={v ? 'green' : 'red'} editMode={editMode} onToggleBool={val => onChange(['combat_system_state', 'surveillance_systems', k], val)} />
              ))}
            </div>
          )}
        </div>

        {/* Comms */}
        <div className="flex flex-col border border-[#1e2538] bg-[#161b28]">
          <button onClick={() => toggleSection('comms')} className="flex items-center justify-between px-2.5 py-2 hover:bg-[#1a1f30] transition-colors cursor-pointer outline-none text-[#4a5168]">
            <span className="text-[9px] font-black tracking-[0.15em] uppercase">Comms</span>
            {openSection === 'comms' ? <ChevronDown /> : <ChevronRight />}
          </button>
          {openSection === 'comms' && (
            <div className="flex flex-col gap-1 p-2 bg-[#0b0e17] border-t border-[#1e2538]">
              {Object.entries(comms).map(([k, v]: [string, any]) => (
                <SystemRow key={k} label={k} value={v} colorName={v ? 'green' : 'red'} editMode={editMode} onToggleBool={val => onChange(['combat_system_state', 'communication_system', k], val)} />
              ))}
            </div>
          )}
        </div>

        {/* Defensive */}
        <div className="flex flex-col border border-[#1e2538] bg-[#161b28]">
          <button onClick={() => toggleSection('defensive')} className="flex items-center justify-between px-2.5 py-2 hover:bg-[#1a1f30] transition-colors cursor-pointer outline-none text-[#4a5168]">
            <span className="text-[9px] font-black tracking-[0.15em] uppercase">Defensive</span>
            {openSection === 'defensive' ? <ChevronDown /> : <ChevronRight />}
          </button>
          {openSection === 'defensive' && (
            <div className="flex flex-col gap-1 p-2 bg-[#0b0e17] border-t border-[#1e2538]">
              {Object.entries(defensive).map(([k, v]: [string, any]) => (
                <SystemRow key={k} label={k} value={v} colorName={v ? 'green' : 'red'} editMode={editMode} onText="AVAIL" offText="UNAVAIL" onToggleBool={val => onChange(['combat_system_state', 'defensive_system', k], val)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MissionSection({ data, editMode, onChange }: DashboardProps) {
  const [openSection, setOpenSection] = useState<'assets' | null>('assets');
  const me = data.mission_enablers ?? {};
  const helos = me.helo_availability ?? {};
  const assets = me.additional_assets ?? {};

  return (
    <div className="flex flex-col lg:flex-row gap-2.5 w-full">
      {/* HELOS */}
      <div className="bg-[#111520] border border-[#1e2538] p-2.5 flex-1 flex flex-col">
        <div className="text-[9px] font-black tracking-[0.15em] text-[#4a5168] uppercase mb-2">Helo Availability</div>
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))' }}>
          {Object.entries(helos).map(([k, v]: [string, any]) => (
            <HeloCard key={k} label={k} count={v} editMode={editMode} onEdit={val => onChange(['mission_enablers', 'helo_availability', k], val)} />
          ))}
        </div>
      </div>

      {/* ASSETS ACCORDION */}
      <div className="bg-[#111520] border border-[#1e2538] p-2.5 flex-1 flex flex-col gap-2">
        <div className="text-[9px] font-black tracking-[0.15em] text-[#4a5168] uppercase mb-1">Logistics / Mission</div>
        
        <div className="flex flex-col border border-[#1e2538] bg-[#161b28]">
          <button onClick={() => setOpenSection(openSection === 'assets' ? null : 'assets')} className="flex items-center justify-between px-2.5 py-2 hover:bg-[#1a1f30] transition-colors cursor-pointer outline-none text-[#4a5168]">
            <span className="text-[9px] font-black tracking-[0.15em] uppercase">Additional Assets</span>
            {openSection === 'assets' ? <ChevronDown /> : <ChevronRight />}
          </button>
          
          {openSection === 'assets' && (
            <div className="flex flex-col gap-1 p-2 bg-[#0b0e17] border-t border-[#1e2538]">
              {Object.entries(assets).map(([k, v]: [string, any]) => {
                const isNum = typeof v === 'number';
                const colorName = isNum ? (v === 0 ? 'red' : v === 1 ? 'yellow' : 'green') : (v ? 'green' : 'red');
                return (
                  <SystemRow key={k} label={k} value={v} colorName={colorName} editMode={editMode} onText="READY" offText="UNAVAIL" suffix={isNum ? 'units' : undefined}
                    onEditNum={val => onChange(['mission_enablers', 'additional_assets', k], val)}
                    onToggleBool={val => onChange(['mission_enablers', 'additional_assets', k], val)} 
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LogisticsSection({ data, editMode, onChange }: DashboardProps) {
  const [openSection, setOpenSection] = useState<'crew' | 'endurance' | null>('crew');
  
  const pl = data.personnel_and_logistics_status ?? {};
  const speed = pl.max_available_speed_knots ?? 0;
  const crew = pl.crew_readiness ?? {};
  const endurance = pl.endurance_training ?? {};
  const fuel = pl.fuel_status_kilolitres ?? 0;
  const rationDays = endurance.ration_days ?? 0;
  const waterDays = endurance.water_days ?? 0;

  const toggleSection = (section: 'crew' | 'endurance') => {
    setOpenSection(prev => prev === section ? null : section);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-2.5 w-full">
      {/* SPEED WIDGET */}
      <div className="bg-[#111520] border border-[#1e2538] p-2.5 flex-1 flex flex-col justify-center">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4 px-4 py-4 bg-[#161b28] border border-[#1e2538]" style={{ clipPath: NOTCH_10 }}>
          <span className="text-[11px] font-black tracking-[0.12em] uppercase text-[#4a5168] text-center lg:text-left">Max Available Speed</span>
          <div className="flex items-baseline gap-2">
            {editMode ? (
              <EditableNum value={speed} onCommit={v => onChange(['personnel_and_logistics_status', 'max_available_speed_knots'], v)} editMode={editMode} className="text-3xl" />
            ) : (
               <span className={`text-4xl font-black ${COLORS[getNumColor(speed, 25, 15)].text}`}>{speed}</span>
            )}
            <span className="text-[11px] font-black text-[#4a5168]">KNOTS</span>
          </div>
        </div>
      </div>

      {/* READINESS ACCORDIONS */}
      <div className="bg-[#111520] border border-[#1e2538] p-2.5 flex-[2] flex flex-col gap-2">
        <div className="text-[9px] font-black tracking-[0.15em] text-[#4a5168] uppercase mb-1">Vessel Status</div>
        
        {/* Crew */}
        <div className="flex flex-col border border-[#1e2538] bg-[#161b28]">
          <button onClick={() => toggleSection('crew')} className="flex items-center justify-between px-2.5 py-2 hover:bg-[#1a1f30] transition-colors cursor-pointer outline-none text-[#4a5168]">
            <span className="text-[9px] font-black tracking-[0.15em] uppercase">Crew Readiness</span>
            {openSection === 'crew' ? <ChevronDown /> : <ChevronRight />}
          </button>
          {openSection === 'crew' && (
            <div className="flex flex-col gap-1 p-2 bg-[#0b0e17] border-t border-[#1e2538]">
              {Object.entries(crew).map(([k, v]: [string, any]) => {
                const isBool = typeof v === 'boolean';
                const colorName = isBool ? (v ? 'green' : 'red') : 'blue';
                return (
                  <SystemRow key={k} label={k} value={v} colorName={colorName} editMode={editMode} suffix={isBool ? undefined : 'days'}
                    onEditNum={val => onChange(['personnel_and_logistics_status', 'crew_readiness', k], val)}
                    onToggleBool={val => onChange(['personnel_and_logistics_status', 'crew_readiness', k], val)} 
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Endurance */}
        <div className="flex flex-col border border-[#1e2538] bg-[#161b28]">
          <button onClick={() => toggleSection('endurance')} className="flex items-center justify-between px-2.5 py-2 hover:bg-[#1a1f30] transition-colors cursor-pointer outline-none text-[#4a5168]">
            <span className="text-[9px] font-black tracking-[0.15em] uppercase">Endurance & Supplies</span>
            {openSection === 'endurance' ? <ChevronDown /> : <ChevronRight />}
          </button>
          {openSection === 'endurance' && (
            <div className="flex flex-col gap-1 p-2 bg-[#0b0e17] border-t border-[#1e2538]">
              <SystemRow label="Ration Days" value={rationDays} colorName={getNumColor(rationDays, 20, 10)} editMode={editMode} suffix="days" onEditNum={val => onChange(['personnel_and_logistics_status', 'endurance_training', 'ration_days'], val)} />
              <SystemRow label="Water Days" value={waterDays} colorName={getNumColor(waterDays, 20, 10)} editMode={editMode} suffix="days" onEditNum={val => onChange(['personnel_and_logistics_status', 'endurance_training', 'water_days'], val)} />
              <SystemRow label="Fuel Status" value={fuel} colorName={getNumColor(fuel, 500, 200)} editMode={editMode} suffix="T" onEditNum={val => onChange(['personnel_and_logistics_status', 'fuel_status_kilolitres'], val)} />
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ─── Main Single View Component ───────────────────────────────────────────────

export default function SingleViewDashboard({ data, editMode, onChange }: DashboardProps) {
  return (
    <div className="bg-[#0b0e17] font-mono p-2.5 flex flex-col gap-2.5 min-h-screen text-[#e8eaf2] box-border overflow-y-auto overflow-x-hidden">
      <CombatSection data={data} editMode={editMode} onChange={onChange} />
      <MissionSection data={data} editMode={editMode} onChange={onChange} />
      <LogisticsSection data={data} editMode={editMode} onChange={onChange} />
    </div>
  );
}
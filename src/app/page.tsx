"use client";

import { useState, useEffect, useCallback } from "react";

interface Job {
  id: string; title: string; company: string; location: string;
  work_mode: string; salary_min: number; salary_max: number;
  dist_miles: number | null; created_at: string; tags: string[];
}

const MOCK_JOBS: Job[] = [
  { id: "1", title: "Class A CDL Truck Driver Jobs", company: "Naeve Inc.", location: "Roscoe, Illinois, United States", work_mode: "onsite", salary_min: 78000, salary_max: 96000, dist_miles: 2.3, created_at: "2026-04-02T10:00:00Z", tags: ["CDL-A", "OTR", "Regional"] },
  { id: "2", title: "Technician / Lead (Low Voltage)", company: "ElectraTech", location: "Rockford, IL, United States", work_mode: "onsite", salary_min: 55000, salary_max: 72000, dist_miles: 8.1, created_at: "2026-04-03T08:00:00Z", tags: ["Low Voltage", "Installation", "Lead"] },
  { id: "3", title: "Commercial Construction PM", company: "BuildRight LLC", location: "Belvidere, IL, United States", work_mode: "onsite", salary_min: 95000, salary_max: 130000, dist_miles: 12.4, created_at: "2026-04-01T12:00:00Z", tags: ["Construction", "Estimator", "PM"] },
  { id: "4", title: "Sales Coordinator", company: "MidWest Supply Co", location: "Loves Park, IL, United States", work_mode: "onsite", salary_min: 45000, salary_max: 58000, dist_miles: 5.7, created_at: "2026-04-03T14:00:00Z", tags: ["Sales", "Coordination", "CRM"] },
  { id: "5", title: "Carpenter Foreman", company: "Heritage Builders", location: "South Beloit, IL, United States", work_mode: "onsite", salary_min: 62000, salary_max: 80000, dist_miles: 3.9, created_at: "2026-04-02T16:00:00Z", tags: ["Carpentry", "Foreman", "Construction"] },
  { id: "6", title: "Dispatcher", company: "RoadRunner Logistics", location: "Machesney Park, IL, United States", work_mode: "onsite", salary_min: 42000, salary_max: 55000, dist_miles: 6.8, created_at: "2026-03-30T09:00:00Z", tags: ["Dispatch", "Logistics", "Transportation"] },
  { id: "7", title: "Full Stack Engineer", company: "Joveo", location: "Remote (US)", work_mode: "remote", salary_min: 125000, salary_max: 165000, dist_miles: null, created_at: "2026-04-03T11:00:00Z", tags: ["Node.js", "React", "PostgreSQL"] },
  { id: "8", title: "Bilingual Retail Sales Consultant", company: "AT&T", location: "Rockford, IL, United States", work_mode: "onsite", salary_min: 38000, salary_max: 52000, dist_miles: 9.2, created_at: "2026-04-01T08:00:00Z", tags: ["Retail", "Bilingual", "Sales"] },
  { id: "9", title: "Data Scientist", company: "RemoteAI Corp", location: "Remote", work_mode: "remote", salary_min: 130000, salary_max: 170000, dist_miles: null, created_at: "2026-04-03T07:00:00Z", tags: ["Python", "ML", "TensorFlow"] },
  { id: "10", title: "Construction General Manager", company: "Apex Construction", location: "Cherry Valley, IL, United States", work_mode: "onsite", salary_min: 110000, salary_max: 150000, dist_miles: 14.1, created_at: "2026-04-03T15:00:00Z", tags: ["General Manager", "Construction"] },
  { id: "11", title: "Drive with DoorDash", company: "DoorDash", location: "Rockford, IL, United States", work_mode: "onsite", salary_min: 30000, salary_max: 55000, dist_miles: 7.5, created_at: "2026-04-03T09:00:00Z", tags: ["Delivery", "Driver", "Flexible"] },
  { id: "12", title: "Recruiter (Contract)", company: "Joblet.ai", location: "Remote (Anywhere)", work_mode: "remote", salary_min: 70000, salary_max: 95000, dist_miles: null, created_at: "2026-04-04T06:00:00Z", tags: ["Recruiting", "ATS", "Sourcing"] },
];

const RADIUS_OPTIONS = [5, 10, 25, 50, 100];
const MODE: Record<string, { label: string; color: string; bg: string }> = {
  remote: { label: "Remote", color: "#34D399", bg: "rgba(5,46,22,0.6)" },
  hybrid: { label: "Hybrid", color: "#60A5FA", bg: "rgba(12,25,41,0.6)" },
  onsite: { label: "On-site", color: "#FB923C", bg: "rgba(28,25,23,0.6)" },
};

const fmt$ = (n: number) => `$${Math.round(n / 1000)}K`;
const fmtSalary = (min: number, max: number) => min && max ? `${fmt$(min)} – ${fmt$(max)}` : null;

function timeAgo(d: string) {
  const h = Math.floor((Date.now() - new Date(d).getTime()) / 3600000);
  if (h < 1) return "Just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function DistBadge({ miles, mode }: { miles: number | null; mode: string }) {
  if (mode === "remote") return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: "#34D399", fontFamily: "monospace" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34D399" }} /> Anywhere
    </span>
  );
  const c = (miles ?? 99) <= 5 ? "#34D399" : (miles ?? 99) <= 15 ? "#FACC15" : "#FB923C";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: c, fontFamily: "monospace" }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
      {miles} mi
    </span>
  );
}

function JobCard({ job, onApply }: { job: Job; onApply: (j: Job) => void }) {
  const m = MODE[job.work_mode] || MODE.onsite;
  const salary = fmtSalary(job.salary_min, job.salary_max);
  return (
    <div
      className="group rounded-2xl transition-all duration-200 cursor-pointer"
      style={{ background: "#111", border: "1px solid #1E1E1E", padding: "16px 20px", animation: "slideUp 0.3s ease both" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "#333"; e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "#1E1E1E"; e.currentTarget.style.transform = "translateY(0)"; }}
    >
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="text-[15px] font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.01em", color: "#F5F5F5", margin: 0 }}>{job.title}</h3>
            <span style={{ background: m.bg, color: m.color, fontSize: 10, padding: "2px 8px", borderRadius: 100, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{m.label}</span>
          </div>
          <div style={{ fontSize: 13, color: "#777", marginBottom: 8 }}>{job.company} &middot; {job.location}</div>
          <div className="flex gap-1.5 flex-wrap mb-2">
            {job.tags.slice(0, 4).map(t => (
              <span key={t} style={{ background: "#1A1A1A", color: "#555", fontSize: 10, padding: "2px 8px", borderRadius: 5, border: "1px solid #222" }}>{t}</span>
            ))}
          </div>
          <div className="flex items-center gap-3" style={{ fontSize: 13, color: "#666" }}>
            {salary && <span style={{ fontWeight: 600, color: "#BBB", fontFamily: "monospace", fontSize: 12 }}>{salary}</span>}
            {salary && <span style={{ color: "#333" }}>|</span>}
            <span>{timeAgo(job.created_at)}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 min-w-[80px]">
          <DistBadge miles={job.dist_miles} mode={job.work_mode} />
          <button onClick={e => { e.stopPropagation(); onApply(job); }}
            className="rounded-lg px-4 py-2 text-xs font-bold text-white transition-transform hover:scale-105 active:scale-95"
            style={{ background: "linear-gradient(135deg, #2563EB, #1D4ED8)", border: "none", cursor: "pointer" }}
          >Quick Apply</button>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [zip, setZip] = useState("");
  const [radius, setRadius] = useState(25);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [locName, setLocName] = useState("");
  const [locating, setLocating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [zipError, setZipError] = useState("");

  const search = useCallback(() => {
    setLoading(true); setSearched(true); setZipError("");
    if (!zip && !locName) setLocName("Roscoe, IL");
    setTimeout(() => {
      const filtered = MOCK_JOBS
        .filter(j => j.work_mode === "remote" || (j.dist_miles != null && j.dist_miles <= radius))
        .sort((a, b) => {
          if (a.work_mode === "remote" && b.work_mode !== "remote") return 1;
          if (b.work_mode === "remote" && a.work_mode !== "remote") return -1;
          return (a.dist_miles || 9999) - (b.dist_miles || 9999);
        });
      setJobs(filtered); setLoading(false);
    }, 600);
  }, [radius, zip, locName]);

  const handleZipChange = (val: string) => {
    const clean = val.replace(/\D/g, "").slice(0, 5);
    setZip(clean); setZipError("");
    if (clean.length === 5) setLocName(`ZIP ${clean}`);
  };

  const handleSearch = () => {
    if (!zip && !locName) { setZipError("Enter a ZIP code or use GPS"); return; }
    if (zip && zip.length < 5) { setZipError("Enter a valid 5-digit ZIP"); return; }
    search();
  };

  const useGPS = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      () => { setLocName("Your Location"); setZip(""); setLocating(false); search(); },
      () => { setLocating(false); setZipError("GPS denied — enter ZIP instead"); },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  useEffect(() => { if (searched) search(); }, [radius]);

  const total = jobs.length;
  const remote = jobs.filter(j => j.work_mode === "remote").length;
  const local = total - remote;

  return (
    <div className="min-h-screen" style={{ background: "#0A0A0A" }}>
      {toast && (
        <div className="fixed top-4 right-4 rounded-xl px-5 py-3 z-50 flex items-center gap-3 shadow-2xl"
          style={{ background: "#052E16", border: "1px solid #065F46", animation: "fadeIn 0.3s ease" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
          <div><div style={{ fontSize: 13, fontWeight: 700, color: "#34D399" }}>Applied!</div><div style={{ fontSize: 11, color: "#6EE7B7" }}>{toast}</div></div>
          <button onClick={() => setToast(null)} style={{ background: "none", border: "none", color: "#34D399", cursor: "pointer", fontSize: 18, marginLeft: 6 }}>&times;</button>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 pt-7 pb-16">
        <div className="flex items-center gap-2 mb-1">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#2563EB", fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase" }}>Joblet.ai</span>
        </div>
        <h1 className="text-3xl font-bold mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.03em", margin: "0 0 4px" }}>Jobs Near Me</h1>
        <p style={{ margin: "0 0 20px", fontSize: 14, color: "#555" }}>Enter your ZIP code, choose a radius, and find the closest jobs.</p>

        {/* Search */}
        <div className="rounded-2xl p-4 mb-1.5" style={{ background: "#111", border: "1px solid #1E1E1E" }}>
          <div className="flex gap-2.5 flex-wrap items-end">
            <div style={{ minWidth: 140 }}>
              <label className="block text-[10px] uppercase tracking-widest font-bold mb-1" style={{ color: "#555" }}>Your ZIP code</label>
              <div className="flex gap-1.5">
                <input type="text" inputMode="numeric" placeholder="e.g. 61073" value={zip}
                  onChange={e => handleZipChange(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleSearch(); }}
                  className="outline-none transition-colors text-center"
                  style={{ width: 110, background: "#0A0A0A", border: `1px solid ${zipError ? "#E24B4A" : "#222"}`, borderRadius: 10, padding: "9px 12px", color: "#F5F5F5", fontSize: 16, fontFamily: "monospace", fontWeight: 700, letterSpacing: "0.15em" }}
                  onFocus={e => { if (!zipError) e.currentTarget.style.borderColor = "#2563EB"; }}
                  onBlur={e => { if (!zipError) e.currentTarget.style.borderColor = "#222"; }}
                />
                <button onClick={useGPS} disabled={locating} title="Use GPS"
                  className="flex items-center transition-colors"
                  style={{ background: "#0A0A0A", border: "1px solid #222", borderRadius: 10, padding: "8px 10px", cursor: "pointer", color: locating ? "#2563EB" : "#555" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = "#2563EB"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "#222"}>
                  {locating
                    ? <span style={{ width: 16, height: 16, border: "2px solid #2563EB", borderTopColor: "transparent", borderRadius: "50%", display: "block", animation: "spin 0.8s linear infinite" }} />
                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>
                  }
                </button>
              </div>
            </div>
            <div className="flex-1" style={{ minWidth: 180 }}>
              <label className="block text-[10px] uppercase tracking-widest font-bold mb-1" style={{ color: "#555" }}>Radius (miles)</label>
              <div className="flex gap-1">
                {RADIUS_OPTIONS.map(r => (
                  <button key={r} onClick={() => setRadius(r)}
                    className="flex-1 rounded-lg py-2 text-sm font-bold transition-all"
                    style={{ background: radius === r ? "#2563EB" : "#0A0A0A", color: radius === r ? "#fff" : "#444", border: `1px solid ${radius === r ? "#2563EB" : "#222"}`, fontFamily: "monospace", cursor: "pointer" }}
                  >{r}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[10px] mb-1 invisible">.</label>
              <button onClick={handleSearch}
                className="rounded-lg px-7 py-2 text-sm font-bold text-white transition-transform hover:scale-[1.03] active:scale-95"
                style={{ background: "linear-gradient(135deg, #2563EB, #1D4ED8)", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}
              >Find Jobs</button>
            </div>
          </div>
          {zipError && <div style={{ marginTop: 8, fontSize: 12, color: "#E24B4A", fontWeight: 600 }}>{zipError}</div>}
        </div>
        <div style={{ fontSize: 11, color: "#333", marginBottom: 20, paddingLeft: 4 }}>Your ZIP code is only used to calculate distance. We don&apos;t store your location.</div>

        {/* Results header */}
        {searched && !loading && (
          <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
            <div>
              <span className="text-base font-bold">{total} jobs</span>
              <span className="text-sm ml-1.5" style={{ color: "#555" }}>{local > 0 && <>{local} within {radius} mi of {locName || `ZIP ${zip}`}</>}</span>
              {remote > 0 && <span className="text-xs ml-2" style={{ color: "#34D399" }}>+{remote} remote</span>}
            </div>
            <span className="text-[11px] px-2.5 py-1 rounded-md" style={{ color: "#333", background: "#111", border: "1px solid #1E1E1E" }}>Nearest first</span>
          </div>
        )}

        {loading && (
          <div className="py-16 text-center">
            <div style={{ width: 28, height: 28, border: "3px solid #1E1E1E", borderTopColor: "#2563EB", borderRadius: "50%", margin: "0 auto 12px", animation: "spin 0.8s linear infinite" }} />
            <div style={{ fontSize: 13, color: "#444" }}>Finding jobs near {locName || `ZIP ${zip}`}...</div>
          </div>
        )}

        {searched && !loading && total === 0 && (
          <div className="py-14 text-center">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#222" strokeWidth="1.5" style={{ marginBottom: 12 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#666", marginBottom: 6 }}>No jobs within {radius} miles</div>
            <div style={{ fontSize: 13, color: "#444", marginBottom: 14 }}>Try a wider radius</div>
            <button onClick={() => setRadius(Math.min(radius * 2, 100))}
              style={{ background: "#111", border: "1px solid #222", borderRadius: 8, padding: "8px 20px", color: "#2563EB", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >Expand to {Math.min(radius * 2, 100)} miles</button>
          </div>
        )}

        {!loading && <div className="flex flex-col gap-2">
          {jobs.map((j, i) => (
            <div key={j.id} style={{ animationDelay: `${i * 50}ms` }}>
              <JobCard job={j} onApply={job => { setToast(`${job.title} at ${job.company}`); setTimeout(() => setToast(null), 3000); }} />
            </div>
          ))}
        </div>}

        {!searched && (
          <div className="py-14 text-center">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth="1" style={{ marginBottom: 14 }}>
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#333", marginBottom: 4 }}>Enter your ZIP code to get started</div>
            <div style={{ fontSize: 13, color: "#222" }}>We&apos;ll show jobs sorted by distance from you</div>
            <div className="flex justify-center gap-4 mt-6 flex-wrap">
              {[{ zip: "61073", label: "Roscoe, IL" }, { zip: "78701", label: "Austin, TX" }, { zip: "10001", label: "New York, NY" }, { zip: "90210", label: "Beverly Hills" }].map(ex => (
                <button key={ex.zip} onClick={() => { setZip(ex.zip); setLocName(ex.label); }}
                  className="rounded-xl transition-colors text-center"
                  style={{ background: "#111", border: "1px solid #1E1E1E", padding: "10px 16px", cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = "#2563EB"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "#1E1E1E"}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#F5F5F5", fontFamily: "monospace", letterSpacing: "0.1em" }}>{ex.zip}</div>
                  <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{ex.label}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

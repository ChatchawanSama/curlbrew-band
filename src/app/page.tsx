"use client";

import { FormEvent, useEffect, useState } from "react";
import { CalendarDays, ChevronRight, Clock3, LogOut, MoreHorizontal, Plus, Share2, X } from "lucide-react";

type Session = { id: string; code: string; name: string; scheduledAt: string | null; status: string };
type AdminAction = { type: "create" } | { type: "rename"; session: Session } | { type: "schedule"; session: Session } | { type: "delete"; session: Session };

export default function SessionsHome() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [authenticated, setAuthenticated] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<AdminAction | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [renameSession, setRenameSession] = useState<Session | null>(null);
  const [scheduleSession, setScheduleSession] = useState<Session | null>(null);
  const [managementUrl, setManagementUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");

  async function loadSessions() {
    const response = await fetch("/api/sessions", { cache: "no-store" });
    if (response.ok) setSessions(await response.json());
  }

  useEffect(() => {
    void loadSessions();
    fetch("/api/admin/session", { cache: "no-store" }).then((response) => response.json()).then((data: { authenticated: boolean }) => setAuthenticated(data.authenticated));
  }, []);

  function requestAdmin(action: AdminAction) {
    if (authenticated) void runAdminAction(action);
    else { setPendingAction(action); setLoginOpen(true); }
  }

  async function runAdminAction(action: AdminAction) {
    if (action.type === "create") setCreateOpen(true);
    if (action.type === "rename") setRenameSession(action.session);
    if (action.type === "schedule") setScheduleSession(action.session);
    if (action.type === "delete") {
      if (!window.confirm("Delete “" + action.session.name + "”? This removes its queue and requests.")) return;
      const response = await fetch("/api/sessions/" + action.session.code, { method: "DELETE" });
      if (response.ok) { setSessions((current) => current.filter((session) => session.id !== action.session.id)); setMessage("Session deleted."); }
      else if (response.status === 401) { setAuthenticated(false); setPendingAction(action); setLoginOpen(true); }
      else setMessage("Could not delete session.");
    }
  }

  async function createSession(data: { name: string; scheduledAt: string }) {
    const response = await fetch("/api/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: data.name, scheduledAt: new Date(data.scheduledAt + ":00+07:00").toISOString() }) });
    const result = await response.json();
    if (response.status === 401) { setCreateOpen(false); setAuthenticated(false); setPendingAction({ type: "create" }); setLoginOpen(true); return; }
    if (!response.ok) { setMessage(result.error ?? "Could not create session."); return; }
    localStorage.setItem("curlbrew-session-" + result.code, result.managementUrl);
    window.location.href = result.managementUrl;
  }

  async function renameSessionNow(name: string) {
    if (!renameSession) return;
    const response = await fetch("/api/sessions/" + renameSession.code, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    const result = await response.json();
    if (response.ok) { setSessions((current) => current.map((session) => session.id === renameSession.id ? { ...session, name: result.name } : session)); setRenameSession(null); setMessage("Session renamed."); }
    else if (response.status === 401) { setAuthenticated(false); setPendingAction({ type: "rename", session: renameSession }); setRenameSession(null); setLoginOpen(true); }
    else setMessage(result.error ?? "Could not rename session.");
  }

  async function scheduleSessionNow(scheduledAt: string) {
    if (!scheduleSession) return;
    const response = await fetch("/api/sessions/" + scheduleSession.code, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scheduledAt }) });
    const result = await response.json();
    if (response.ok) { setSessions((current) => current.map((session) => session.id === scheduleSession.id ? { ...session, scheduledAt: result.scheduledAt } : session)); setScheduleSession(null); setMessage("Schedule updated."); }
    else if (response.status === 401) { setAuthenticated(false); setPendingAction({ type: "schedule", session: scheduleSession }); setScheduleSession(null); setLoginOpen(true); }
    else setMessage(result.error ?? "Could not update schedule.");
  }

  async function logout() { await fetch("/api/admin/logout", { method: "POST" }); setAuthenticated(false); setMessage("Admin session ended."); }
  async function copy(value: string) { await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }

  function onLoginSuccess() {
    setAuthenticated(true); setLoginOpen(false);
    const action = pendingAction; setPendingAction(null);
    if (action) void runAdminAction(action);
  }

  return <main className="room-grid room-grain min-h-screen pb-20 lg:pb-0"><RoomNav authenticated={authenticated} onLogout={() => void logout()} /><section className="min-h-screen lg:pl-[228px]"><header className="flex items-center justify-between border-b border-white/10 px-5 py-5 md:px-10"><div><p className="mono text-[10px] uppercase tracking-[.24em] text-amber-300">Sessions</p><h1 className="serif mt-3 text-5xl text-stone-100 md:text-7xl">Make some<br />room.</h1></div><button onClick={() => requestAdmin({ type: "create" })} className="focus-ring flex items-center gap-2 bg-stone-100 px-4 py-3 text-sm font-semibold text-stone-950"><Plus size={16} /> Create Session</button></header><div className="mx-auto max-w-5xl px-5 py-8 md:px-10"><p className="max-w-md text-sm leading-6 text-stone-400">Schedule a session, open the room, and keep the queue moving.</p><div className="mt-10 grid gap-3">{sessions.map((session) => <SessionRow key={session.id} session={session} onRename={() => requestAdmin({ type: "rename", session })} onSchedule={() => requestAdmin({ type: "schedule", session })} onDelete={() => requestAdmin({ type: "delete", session })} />)}{sessions.length === 0 && <div className="border border-dashed border-white/15 p-12 text-center"><CalendarDays className="mx-auto mb-4 text-stone-600" size={30} /><h2 className="serif text-2xl text-stone-200">No sessions yet.</h2><p className="mt-2 text-sm text-stone-500">Create the first room for your next rehearsal.</p><button onClick={() => requestAdmin({ type: "create" })} className="mt-6 bg-stone-100 px-4 py-3 text-sm font-semibold text-stone-950">Create Session</button></div>}</div>{managementUrl && <div className="mt-8 border border-amber-300/30 bg-amber-300/10 p-5"><p className="mono text-[10px] uppercase tracking-[.18em] text-amber-300">Management link</p><p className="mt-2 break-all text-sm text-stone-300">Keep this private. Anyone with it can control the queue.</p><button onClick={() => void copy(managementUrl)} className="mt-4 flex items-center gap-2 text-sm text-stone-100"><Share2 size={15} />{copied ? "Copied" : "Copy management link"}</button></div>}</div></section><MobileNav />{createOpen && <CreateSession onClose={() => setCreateOpen(false)} onSave={(data) => void createSession(data)} />}{renameSession && <RenameSession session={renameSession} onClose={() => setRenameSession(null)} onSave={(name) => void renameSessionNow(name)} />}{scheduleSession && <ScheduleSession session={scheduleSession} onClose={() => setScheduleSession(null)} onSave={(value) => void scheduleSessionNow(value)} />}{loginOpen && <AdminLoginDialog onClose={() => { setLoginOpen(false); setPendingAction(null); }} onSuccess={onLoginSuccess} />}{message && <div role="status" className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 bg-stone-100 px-5 py-3 text-sm text-stone-950">{message}</div>}</main>;
}

function SessionRow({ session, onRename, onSchedule, onDelete }: { session: Session; onRename: () => void; onSchedule: () => void; onDelete: () => void }) { const [open, setOpen] = useState(false); const savedManagementUrl = typeof window !== "undefined" ? localStorage.getItem("curlbrew-session-" + session.code) : null; const href = savedManagementUrl || "/session/" + session.code + "/request"; return <div className="relative flex items-center gap-5 border border-white/10 bg-white/[.03] p-5 hover:bg-white/[.06]"><a href={href} className="flex min-w-0 flex-1 items-center gap-5"><div className="flex h-12 w-12 shrink-0 items-center justify-center bg-amber-300/10 text-amber-300"><CalendarDays size={22} /></div><div className="min-w-0 flex-1"><h2 className="serif truncate text-2xl text-stone-100">{session.name}</h2><p className="mt-1 flex items-center gap-2 text-sm text-stone-500"><Clock3 size={14} />{session.scheduledAt ? formatBangkok(session.scheduledAt) : "No time set"}</p></div><ChevronRight className="text-stone-600" size={20} /></a><div className="relative"><button aria-label={"Actions for " + session.name} aria-expanded={open} onClick={() => setOpen((value) => !value)} className="focus-ring p-2 text-stone-500 hover:text-stone-100"><MoreHorizontal size={20} /></button>{open && <div className="absolute right-0 top-11 z-20 w-36 border border-white/10 bg-[#151a1a] p-1 shadow-xl"><button onClick={() => { setOpen(false); onRename(); }} className="block w-full px-3 py-2 text-left text-xs text-stone-300 hover:bg-white/[.06]">Rename</button><button onClick={() => { setOpen(false); onSchedule(); }} className="block w-full px-3 py-2 text-left text-xs text-stone-300 hover:bg-white/[.06]">Edit date & time</button><button onClick={() => { setOpen(false); onDelete(); }} className="block w-full px-3 py-2 text-left text-xs text-red-300 hover:bg-white/[.06]">Delete</button></div>}</div></div>; }
function formatBangkok(value: string) { return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
function RoomNav({ authenticated, onLogout }: { authenticated: boolean; onLogout: () => void }) { return <aside className="fixed inset-y-0 left-0 z-30 hidden w-[228px] border-r border-white/10 bg-[#090d0e]/95 px-7 py-8 lg:block"><a href="/" className="serif text-3xl text-stone-100">curlbrew<span className="text-amber-400">.</span></a><p className="mono mt-4 text-[10px] uppercase leading-5 tracking-[.25em] text-stone-500">A little room<br />for music.</p><nav className="mt-16 grid gap-2"><a href="/" className="border-l-2 border-amber-300 bg-white/[.06] px-3 py-3 text-sm text-stone-100">Sessions</a><a href="/songs" className="border-l-2 border-transparent px-3 py-3 text-sm text-stone-500 hover:text-stone-200">Songs</a></nav>{authenticated && <button onClick={onLogout} className="mt-24 flex items-center gap-2 text-xs text-stone-600 hover:text-stone-300"><LogOut size={14} /> Log out admin</button>}</aside>; }
function MobileNav() { return <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-white/10 bg-[#090d0e]/95 px-2 py-3 backdrop-blur lg:hidden"><a href="/" className="text-[10px] text-amber-300">Sessions</a><a href="/songs" className="text-[10px] text-stone-500">Songs</a></nav>; }
function CreateSession({ onClose, onSave }: { onClose: () => void; onSave: (data: { name: string; scheduledAt: string }) => void }) { const [name, setName] = useState("Rehearsal"); const [scheduledAt, setScheduledAt] = useState(""); function submit(event: FormEvent) { event.preventDefault(); onSave({ name, scheduledAt }); } return <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-5"><form onSubmit={submit} className="w-full max-w-md border border-white/10 bg-[#151a1a] p-7"><div className="flex items-start justify-between"><div><p className="mono text-[10px] uppercase tracking-[.2em] text-amber-300">New session</p><h2 className="serif mt-3 text-3xl text-stone-100">Set the time.</h2><p className="mt-2 text-sm text-stone-500">Asia / Bangkok</p></div><button type="button" onClick={onClose} className="text-stone-500"><X size={18} /></button></div><label className="mt-7 block text-sm text-stone-300">Session name<input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 h-11 w-full border border-white/10 bg-black/20 px-3 text-stone-100 outline-none" /></label><label className="mt-4 block text-sm text-stone-300">Date and time<input required type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} className="mt-2 h-11 w-full border border-white/10 bg-black/20 px-3 text-stone-100 outline-none" /></label><button className="mt-7 w-full bg-stone-100 px-4 py-3 text-sm font-semibold text-stone-950">Create session</button></form></div>; }
function RenameSession({ session, onClose, onSave }: { session: Session; onClose: () => void; onSave: (name: string) => void }) { const [name, setName] = useState(session.name); return <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-5"><form onSubmit={(event) => { event.preventDefault(); onSave(name); }} className="w-full max-w-md border border-white/10 bg-[#151a1a] p-7"><div className="flex items-start justify-between"><div><p className="mono text-[10px] uppercase tracking-[.2em] text-amber-300">Edit session</p><h2 className="serif mt-3 text-3xl text-stone-100">Rename room.</h2></div><button type="button" onClick={onClose} className="text-stone-500"><X size={18} /></button></div><label className="mt-7 block text-sm text-stone-300">Session name<input autoFocus required value={name} onChange={(event) => setName(event.target.value)} className="mt-2 h-11 w-full border border-white/10 bg-black/20 px-3 text-stone-100 outline-none" /></label><button className="mt-7 w-full bg-stone-100 px-4 py-3 text-sm font-semibold text-stone-950">Save name</button></form></div>; }
function ScheduleSession({ session, onClose, onSave }: { session: Session; onClose: () => void; onSave: (value: string) => void }) { const [value, setValue] = useState(toBangkokInput(session.scheduledAt)); return <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-5"><form onSubmit={(event) => { event.preventDefault(); if (value) onSave(new Date(value + ":00+07:00").toISOString()); }} className="w-full max-w-md border border-white/10 bg-[#151a1a] p-7"><div className="flex items-start justify-between"><div><p className="mono text-[10px] uppercase tracking-[.2em] text-amber-300">Edit session</p><h2 className="serif mt-3 text-3xl text-stone-100">Set the time.</h2><p className="mt-2 text-sm text-stone-500">Asia / Bangkok</p></div><button type="button" onClick={onClose} className="text-stone-500"><X size={18} /></button></div><input autoFocus required type="datetime-local" value={value} onChange={(event) => setValue(event.target.value)} className="mt-7 h-11 w-full border border-white/10 bg-black/20 px-3 text-stone-100 outline-none" /><button className="mt-7 w-full bg-stone-100 px-4 py-3 text-sm font-semibold text-stone-950">Save schedule</button></form></div>; }
function AdminLoginDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) { const [username, setUsername] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false); async function submit(event: FormEvent) { event.preventDefault(); setLoading(true); setError(""); const response = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) }); const body = await response.json().catch(() => ({})); if (response.ok) onSuccess(); else setError(body.error ?? "Could not sign in."); setLoading(false); } return <div className="fixed inset-0 z-[55] grid place-items-center bg-black/75 p-5"><form onSubmit={(event) => void submit(event)} className="w-full max-w-md border border-white/10 bg-[#151a1a] p-7" aria-labelledby="admin-login-title"><div className="flex items-start justify-between"><div><p className="mono text-[10px] uppercase tracking-[.2em] text-amber-300">Private shelf</p><h2 id="admin-login-title" className="serif mt-3 text-3xl text-stone-100">Sign in to manage.</h2><p className="mt-2 text-sm text-stone-500">Admin access is required for session changes.</p></div><button type="button" onClick={onClose} className="text-stone-500"><X size={18} /></button></div><label className="mt-7 block text-sm text-stone-300">Username<input autoFocus required autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} className="mt-2 h-11 w-full border border-white/10 bg-black/20 px-3 text-stone-100 outline-none" /></label><label className="mt-4 block text-sm text-stone-300">Password<input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 h-11 w-full border border-white/10 bg-black/20 px-3 text-stone-100 outline-none" /></label>{error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}<button disabled={loading} className="mt-7 w-full bg-stone-100 px-4 py-3 text-sm font-semibold text-stone-950 disabled:opacity-50">{loading ? "Signing in…" : "Sign in"}</button></form></div>; }
function toBangkokInput(value: string | null) { if (!value) return ""; const parts = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(value)).reduce<Record<string, string>>((result, part) => { if (part.type !== "literal") result[part.type] = part.value; return result; }, {}); return parts.year + "-" + parts.month + "-" + parts.day + "T" + parts.hour + ":" + parts.minute; }

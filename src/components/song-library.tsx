"use client";

import { FormEvent, useEffect, useState } from "react";
import { BookOpen, Edit3, ExternalLink, Plus, Search, Trash2, X } from "lucide-react";

type Song = {
  id: string;
  title: string;
  artist?: string | null;
  notes?: string | null;
  chordUrl?: string | null;
};

type SongValues = { title: string; artist: string; notes: string; chordUrl: string };

export default function SongLibrary() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<Song | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Song | null>(null);
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch(`/api/songs?q=${encodeURIComponent(query)}`, { cache: "no-store" });
    if (response.ok) setSongs(await response.json());
  }

  useEffect(() => {
    void load();
  }, [query]);

  function toggleSelected(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function saveNew(values: SongValues) {
    const response = await fetch("/api/songs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, artist: values.artist || null, notes: values.notes || null, chordUrl: values.chordUrl || null, audienceRequestable: true }),
    });
    setMessage(response.ok ? "Song added." : "Could not add that song.");
    if (response.ok) {
      setAdding(false);
      void load();
    }
  }

  async function saveEdit(values: SongValues) {
    if (!editing) return;
    const response = await fetch(`/api/songs/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, artist: values.artist || null, notes: values.notes || null, chordUrl: values.chordUrl || null }),
    });
    if (!response.ok) {
      setMessage("Could not update that song.");
      return;
    }
    const updated = await response.json() as Song;
    setEditing(null);
    setSelected(updated);
    setMessage("Song updated.");
    void load();
  }

  async function removeOne(song: Song) {
    if (!window.confirm(`Remove ${song.title}?`)) return;
    const response = await fetch(`/api/songs/${song.id}`, { method: "DELETE" });
    if (response.ok) {
      setSelected(null);
      setSelectedIds((current) => current.filter((id) => id !== song.id));
      void load();
    } else {
      const body = await response.json().catch(() => null) as { error?: string } | null;
      setMessage(body?.error ?? "Could not remove that song.");
    }
  }

  async function removeMany() {
    if (!selectedIds.length || !window.confirm(`Remove ${selectedIds.length} selected songs?`)) return;
    const results = await Promise.all(selectedIds.map((id) => fetch(`/api/songs/${id}`, { method: "DELETE" })));
    const allRemoved = results.every((response) => response.ok);
    setSelectedIds([]);
    setSelected(null);
    setMessage(allRemoved ? "Songs removed." : "Some songs could not be removed because they are used in a session.");
    void load();
  }

  return (
    <div className="room-grid room-grain min-h-screen">
      <RoomNav active="Songs" />
      <main className="mx-auto max-w-6xl px-5 pb-24 pt-24 lg:pl-[290px] lg:pr-10 lg:pt-16">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <div><p className="mono text-[10px] uppercase tracking-[.22em] text-amber-400">The listening room / songs</p><h1 className="serif mt-4 text-5xl leading-none text-stone-100 md:text-7xl">Song shelf.</h1><p className="mt-4 max-w-md text-sm leading-6 text-stone-400">Chord references, notes, and everything the band wants close by.</p></div>
          <button onClick={() => setAdding(true)} className="room-button focus-ring flex w-fit items-center gap-2 rounded-full bg-stone-100 px-5 py-3 text-sm font-semibold text-stone-950"><Plus size={16} /> Add song</button>
        </div>
        <div className="mt-10 flex max-w-2xl items-center gap-3 border-b border-white/15 pb-3"><Search size={18} className="text-stone-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title or artist" className="w-full bg-transparent text-sm text-stone-100 outline-none placeholder:text-stone-600" /></div>
        {selectedIds.length > 0 && <div className="mt-5 flex flex-wrap items-center gap-3"><span className="text-sm text-stone-400">{selectedIds.length} selected</span><button onClick={() => void removeMany()} className="flex items-center gap-2 border border-red-300/30 px-4 py-2 text-sm text-red-200 hover:bg-red-300/10"><Trash2 size={15} /> Delete selected</button></div>}
        <div className="mt-8 grid gap-2">
          {songs.map((song, index) => <div key={song.id} className="flex items-center gap-3 border-b border-white/10 px-2 py-2 hover:bg-white/[.04]"><input type="checkbox" aria-label={`Select ${song.title}`} checked={selectedIds.includes(song.id)} onChange={() => toggleSelected(song.id)} className="h-4 w-4 accent-amber-400" /><button onClick={() => setSelected(song)} className="focus-ring flex min-w-0 flex-1 items-center gap-4 px-1 py-2 text-left"><span className="mono w-8 text-xs text-stone-600">{String(index + 1).padStart(2, "0")}</span><span className="min-w-0 flex-1"><span className="block truncate text-lg text-stone-100">{song.title}</span><span className="block truncate text-sm text-stone-500">{song.artist || "Artist not added"}</span></span><ExternalLink size={16} className="text-stone-600" /></button></div>)}
          {songs.length === 0 && <div className="border border-dashed border-white/15 p-10 text-center text-sm text-stone-500">No songs in the library yet.</div>}
        </div>
      </main>
      {selected && <aside className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-[#111718] p-6 shadow-2xl lg:fixed lg:inset-y-0 lg:right-0 lg:left-auto lg:w-[360px] lg:border-l lg:border-t-0 lg:pt-24"><button onClick={() => setSelected(null)} className="absolute right-5 top-5 text-stone-500"><X size={18} /></button><p className="mono text-[10px] uppercase tracking-[.18em] text-amber-400">Selected song</p><h2 className="serif mt-4 text-4xl text-stone-100">{selected.title}</h2><p className="mt-2 text-sm text-stone-400">{selected.artist || "Artist not added"}</p><p className="mt-8 border-t border-white/10 pt-6 text-sm leading-6 text-stone-400">{selected.notes || "No band notes yet."}</p><div className="mt-10 flex gap-5 text-sm"><button onClick={() => setEditing(selected)} className="flex items-center gap-2 text-stone-200"><Edit3 size={15} /> Edit</button><button onClick={() => void removeOne(selected)} className="flex items-center gap-2 text-red-300"><Trash2 size={15} /> Remove</button></div></aside>}
      {adding && <SongFormDialog title="Add a song." onClose={() => setAdding(false)} onSave={saveNew} />}
      {editing && <SongFormDialog title="Edit song." initial={editing} onClose={() => setEditing(null)} onSave={saveEdit} />}
      {message && <button onClick={() => setMessage("")} className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-stone-100 px-5 py-3 text-sm text-stone-900">{message}</button>}
    </div>
  );
}

function RoomNav({ active }: { active: string }) { return <aside className="fixed inset-y-0 left-0 z-30 hidden w-[228px] border-r border-white/10 bg-[#090d0e]/90 px-7 py-8 lg:block"><a href="/" className="serif text-3xl text-stone-100">curlbrew<span className="text-amber-400">.</span></a><p className="mono mt-4 text-[10px] uppercase tracking-[.25em] text-stone-500">A little room<br />for music.</p><nav className="mt-16 grid gap-2"><a href="/" className={`flex items-center gap-3 px-3 py-3 text-sm ${active === "Sessions" ? "text-stone-100" : "text-stone-500 hover:text-stone-200"}`}><BookOpen size={16} />Sessions</a><a href="/songs" className={`flex items-center gap-3 px-3 py-3 text-sm ${active === "Songs" ? "text-stone-100" : "text-stone-500 hover:text-stone-200"}`}><BookOpen size={16} />Songs</a></nav></aside>; }

function SongFormDialog({ title, initial, onClose, onSave }: { title: string; initial?: Song; onClose: () => void; onSave: (values: SongValues) => void }) {
  const [songTitle, setSongTitle] = useState(initial?.title ?? "");
  const [artist, setArtist] = useState(initial?.artist ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [chordUrl, setChordUrl] = useState(initial?.chordUrl ?? "");
  function submit(event: FormEvent) { event.preventDefault(); onSave({ title: songTitle, artist, notes, chordUrl }); }
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-5"><form onSubmit={submit} className="w-full max-w-md border border-white/10 bg-[#151b1b] p-7"><div className="flex justify-between"><div><p className="mono text-[10px] uppercase tracking-[.2em] text-amber-400">{initial ? "Edit entry" : "New entry"}</p><h2 className="serif mt-2 text-3xl text-stone-100">{title}</h2></div><button type="button" onClick={onClose} className="text-stone-500"><X size={18} /></button></div><div className="mt-7 grid gap-4"><label className="text-sm text-stone-300">Song title *<input required value={songTitle} onChange={(event) => setSongTitle(event.target.value)} className="mt-2 h-11 w-full border border-white/10 bg-black/20 px-3 text-stone-100 outline-none" /></label><label className="text-sm text-stone-300">Artist<input value={artist} onChange={(event) => setArtist(event.target.value)} className="mt-2 h-11 w-full border border-white/10 bg-black/20 px-3 text-stone-100 outline-none" /></label><label className="text-sm text-stone-300">Chord URL<input type="url" value={chordUrl} onChange={(event) => setChordUrl(event.target.value)} placeholder="https://..." className="mt-2 h-11 w-full border border-white/10 bg-black/20 px-3 text-stone-100 outline-none" /></label><label className="text-sm text-stone-300">Notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-2 w-full border border-white/10 bg-black/20 px-3 py-2 text-stone-100 outline-none" rows={3} /></label></div><button className="mt-7 w-full bg-stone-100 px-4 py-3 text-sm font-semibold text-stone-950">{initial ? "Save changes" : "Save song"}</button></form></div>;
}

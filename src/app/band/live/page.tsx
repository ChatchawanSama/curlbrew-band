"use client";

import { useState } from "react";
import Link from "next/link";

export default function BandLivePage() {
  const [name, setName] = useState(""); const [error, setError] = useState("");
  async function create() { const response = await fetch("/api/live", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }); const result = await response.json(); if (!response.ok) { setError(result.error ?? "Sign in before starting a session."); return; } window.location.href = `/band/live/${result.code}`; }
  return <main className="min-h-screen bg-cream p-6 text-ink md:p-12"><div className="mx-auto max-w-3xl"><Link href="/" className="font-display text-xl font-bold">curlbrew<span className="text-orange">.</span></Link><div className="mt-20 max-w-xl"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-orange">Band console</p><h1 className="mt-3 font-display text-5xl font-semibold tracking-[-.06em]">Start a live<br /><span className="text-orange">session.</span></h1><p className="mt-5 text-sm leading-6 text-ink/60">Create a public request room for the audience. You must be signed in as a band member.</p><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Session name" className="focus-ring mt-7 h-12 w-full max-w-sm rounded-xl border border-ink/10 bg-paper px-3 outline-none" />{error && <p className="mt-3 text-sm text-orange">{error}</p>}<button onClick={() => void create()} disabled={!name.trim()} className="focus-ring mt-4 block rounded-full bg-orange px-5 py-3 text-sm font-bold text-paper disabled:opacity-40">Create session</button></div></div></main>;
}

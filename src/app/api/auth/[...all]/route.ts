import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const GET = (request: Request) => auth ? toNextJsHandler(auth).GET(request) : new Response("Authentication is not configured", { status: 503 });
export const POST = (request: Request) => auth ? toNextJsHandler(auth).POST(request) : new Response("Authentication is not configured", { status: 503 });

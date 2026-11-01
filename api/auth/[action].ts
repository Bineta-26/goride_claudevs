// One serverless function for every /api/auth/* route (keeps the project within Vercel Hobby's function limit).
import * as changePassword from "../_handlers/auth/change-password.js";
import * as forgotPassword from "../_handlers/auth/forgot-password.js";
import * as login from "../_handlers/auth/login.js";
import * as logout from "../_handlers/auth/logout.js";
import * as me from "../_handlers/auth/me.js";
import * as resetPassword from "../_handlers/auth/reset-password.js";
import * as signup from "../_handlers/auth/signup.js";
import { json } from "../_lib/auth.js";

type Handler = (request: Request) => Response | Promise<Response>;
const routes: Record<string, Partial<Record<string, Handler>>> = {
  "change-password": changePassword, "forgot-password": forgotPassword, login, logout, me, "reset-password": resetPassword, signup,
};

async function handle(request: Request): Promise<Response> {
  const action = new URL(request.url).pathname.replace(/\/+$/, "").split("/").pop() ?? "";
  const route = Object.prototype.hasOwnProperty.call(routes, action) ? routes[action] : undefined;
  if (!route) return json({ error: "Not found" }, 404);
  const handler = route[request.method];
  if (!handler) return json({ error: "Method not allowed" }, 405);
  return handler(request);
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;

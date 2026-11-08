// One serverless function for every /api/admin/* route. Unknown routes look exactly like a missing page.
import * as accountStatus from "../_handlers/admin/account-status.js";
import * as driverCosts from "../_handlers/admin/driver-costs.js";
import * as driverStatus from "../_handlers/admin/driver-status.js";
import * as gate from "../_handlers/admin/gate.js";
import * as login from "../_handlers/admin/login.js";
import * as resetPassword from "../_handlers/admin/reset-password.js";
import * as session from "../_handlers/admin/session.js";
import * as users from "../_handlers/admin/users.js";
import { notFound } from "../_lib/admin.js";

type Handler = (request: Request) => Response | Promise<Response>;
const routes: Record<string, Partial<Record<string, Handler>>> = {
  "account-status": accountStatus, "driver-costs": driverCosts, "driver-status": driverStatus, gate, login, "reset-password": resetPassword, session, users,
};

async function handle(request: Request): Promise<Response> {
  const action = new URL(request.url).pathname.replace(/\/+$/, "").split("/").pop() ?? "";
  const route = Object.prototype.hasOwnProperty.call(routes, action) ? routes[action] : undefined;
  const handler = route?.[request.method];
  return handler ? handler(request) : notFound();
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;

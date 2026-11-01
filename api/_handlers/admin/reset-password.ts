import { ensureSchema, json, passwordProblem, readJson, setPassword } from "../../_lib/auth.js";
import { authorize } from "../../_lib/admin.js";

/** Admin sets a new temporary password for an account; the person is signed out everywhere. */
export async function POST(request: Request): Promise<Response> {
  const denied = authorize(request);
  if (denied) return denied;
  const body = await readJson(request);
  const userId = typeof body.userId === "string" ? body.userId : "";
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return json({ error: "Invalid account." }, 400);
  const problem = passwordProblem(body.password);
  if (problem) return json({ error: problem }, 400);
  try {
    await ensureSchema();
    const version = await setPassword(userId, body.password as string);
    if (!version) return json({ error: "Account not found." }, 404);
    return json({ ok: true });
  } catch (error) {
    console.error("reset password failed", error);
    return json({ error: "Could not reset the password." }, 500);
  }
}

import { stopImpersonationAction } from "../_actions";

/**
 * POST handler usado pelo banner de impersonação no app shell tenant. Form
 * HTML faz `method="post"` aqui — sem JS adicional.
 */
export async function POST(): Promise<Response> {
  await stopImpersonationAction();
  // `stopImpersonationAction` chama `redirect("/admin")`, então essa linha
  // não é alcançada — mas o TS exige retorno.
  return new Response(null, { status: 302, headers: { Location: "/admin" } });
}

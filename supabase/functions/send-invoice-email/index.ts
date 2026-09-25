import nodemailer from "npm:nodemailer@6.9.16";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization") || "";
    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await client.auth.getUser();
    if (!user) throw new Error("Sesión no válida");
    const body = await req.json();
    if (!body.to || !body.invoiceId || !Array.isArray(body.attachments)) throw new Error("Datos de envío incompletos");
    const transport = nodemailer.createTransport({ host: "smtp.hostinger.com", port: 465, secure: true, auth: { user: "administracion@mygreencode.es", pass: Deno.env.get("SMTP_PASSWORD") } });
    const attachments = body.attachments.map((item: { filename: string; content: string; cid?: string }) => ({ filename: item.filename, content: item.content, encoding: "base64", cid: item.cid }));
    const info = await transport.sendMail({
      from: '"Iris García | GreenCode" <administracion@mygreencode.es>',
      replyTo: "administracion@mygreencode.es",
      to: body.to,
      subject: body.subject,
      html: body.html,
      attachments
    });
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await admin.from("invoices").update({ emailStatus: "SENT", emailSentAt: new Date().toISOString(), emailRecipient: body.to, emailError: null }).eq("id", body.invoiceId);
    return new Response(JSON.stringify({ ok: true, messageId: info.messageId }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Error de envío" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }
});

import nodemailer from "npm:nodemailer@6.9.16";
import MailComposer from "npm:nodemailer@6.9.16/lib/mail-composer/index.js";
import { ImapFlow } from "npm:imapflow@2.2.5";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { Buffer } from "node:buffer";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const senderAddress = "administracion@mygreencode.es";

const buildRawMessage = (options: Record<string, unknown>) => new Promise<Buffer>((resolve, reject) => {
  new MailComposer(options).compile().build((error: Error | null, message: Buffer) => {
    if (error) reject(error);
    else resolve(message);
  });
});

const archiveInSent = async (rawMessage: Buffer, password: string) => {
  const imap = new ImapFlow({
    host: "imap.hostinger.com",
    port: 993,
    secure: true,
    auth: { user: senderAddress, pass: password },
    logger: false
  });

  try {
    await imap.connect();
    const mailboxes = await imap.list();
    const sentMailbox = mailboxes.find(mailbox => mailbox.specialUse === "\\Sent")
      || mailboxes.find(mailbox => /(^|[/.])(sent|enviados)$/i.test(mailbox.path));
    if (!sentMailbox) throw new Error("Hostinger no ha indicado la carpeta de Enviados");
    await imap.append(sentMailbox.path, rawMessage, ["\\Seen"], new Date());
  } finally {
    if (imap.usable) await imap.logout();
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization") || "";
    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await client.auth.getUser();
    if (!user) throw new Error("Sesión no válida");
    const body = await req.json();
    if (!body.to || !body.invoiceId || !Array.isArray(body.attachments)) throw new Error("Datos de envío incompletos");
    const smtpPassword = Deno.env.get("SMTP_PASSWORD");
    if (!smtpPassword) throw new Error("Falta la configuración SMTP_PASSWORD");
    const transport = nodemailer.createTransport({ host: "smtp.hostinger.com", port: 465, secure: true, auth: { user: senderAddress, pass: smtpPassword } });
    const attachments = body.attachments.map((item: { filename: string; content: string; cid?: string }) => ({ filename: item.filename, content: item.content, encoding: "base64", cid: item.cid }));
    const mail = {
      from: `"Iris García | GreenCode" <${senderAddress}>`,
      replyTo: senderAddress,
      to: body.to,
      subject: body.subject,
      html: body.html,
      attachments
    };
    const rawMessage = await buildRawMessage(mail);
    const info = await transport.sendMail({ envelope: { from: senderAddress, to: body.to }, raw: rawMessage });
    let archived = true;
    try {
      await archiveInSent(rawMessage, smtpPassword);
    } catch (archiveError) {
      archived = false;
      console.error("Invoice email was sent but could not be archived in Sent", archiveError);
    }
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await admin.from("invoices").update({ emailStatus: "SENT", emailSentAt: new Date().toISOString(), emailRecipient: body.to, emailError: null }).eq("id", body.invoiceId);
    return new Response(JSON.stringify({ ok: true, messageId: info.messageId, archived }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("send-invoice-email failed", error);
    return new Response(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Error de envío" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }
});

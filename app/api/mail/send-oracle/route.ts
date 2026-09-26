import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getStalwartCredentials } from '@/lib/stalwart/credentials';
import { rejectCrossOriginRequest } from '@/lib/security/same-origin';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const crossOrigin = rejectCrossOriginRequest(request);
  if (crossOrigin) return crossOrigin;

  // Verify authentication (cookie session or Authorization header)
  const credentials = await getStalwartCredentials(request);
  const authHeader = request.headers.get('Authorization') || credentials?.authHeader;

  if (!credentials && !authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check Oracle SMTP credentials from env
  const host = process.env.ORACLE_SMTP_HOST || 'smtp.email.ap-singapore-1.oci.oraclecloud.com';
  const port = parseInt(process.env.ORACLE_SMTP_PORT || '587', 10);
  const user = process.env.ORACLE_SMTP_USER;
  const pass = process.env.ORACLE_SMTP_PASS;

  if (!user || !pass) {
    return NextResponse.json(
      {
        error: 'Oracle SMTP 凭证未配置。请在 .env 中设置 ORACLE_SMTP_USER 和 ORACLE_SMTP_PASS。',
        code: 'ORACLE_CONFIG_MISSING',
      },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const {
      from,
      to,
      cc,
      bcc,
      subject,
      text,
      html,
      messageId,
      inReplyTo,
      references,
      attachments,
      serverUrl,
    } = body;

    if (!from?.email || !Array.isArray(to) || to.length === 0) {
      return NextResponse.json({ error: 'Missing required email fields (from, to)' }, { status: 400 });
    }

    // Process attachments
    const processedAttachments: Array<{
      filename: string;
      content: Buffer;
      contentType?: string;
      cid?: string;
      contentDisposition?: string;
    }> = [];
    if (Array.isArray(attachments) && attachments.length > 0) {
      for (const att of attachments) {
        if (att.downloadUrl) {
          try {
            const fetchUrl = att.downloadUrl.startsWith('http')
              ? att.downloadUrl
              : `${(serverUrl || credentials?.serverUrl || '').replace(/\/+$/, '')}${att.downloadUrl.startsWith('/') ? '' : '/'}${att.downloadUrl}`;

            const res = await fetch(fetchUrl, {
              headers: authHeader ? { Authorization: authHeader } : undefined,
            });

            if (res.ok) {
              const buffer = Buffer.from(await res.arrayBuffer());
              processedAttachments.push({
                filename: att.name,
                content: buffer,
                contentType: att.type || 'application/octet-stream',
                cid: att.cid,
                contentDisposition: (att.disposition as 'attachment' | 'inline') || 'attachment',
              });
            } else {
              console.warn(`[send-oracle] Failed to fetch attachment blob ${att.name}: HTTP ${res.status}`);
            }
          } catch (err) {
            console.error(`[send-oracle] Error fetching attachment blob ${att.name}:`, err);
          }
        }
      }
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
      tls: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true,
      },
    });

    const mailOptions: Parameters<typeof transporter.sendMail>[0] = {
      from: from.name ? `"${from.name}" <${from.email}>` : from.email,
      to: to.join(', '),
      cc: cc && cc.length > 0 ? cc.join(', ') : undefined,
      bcc: bcc && bcc.length > 0 ? bcc.join(', ') : undefined,
      subject: subject || '',
      text: text || '',
      html: html || undefined,
      messageId: messageId ? `<${messageId.replace(/^<|>$/g, '')}>` : undefined,
      inReplyTo: inReplyTo && inReplyTo.length > 0 ? `<${inReplyTo[0].replace(/^<|>$/g, '')}>` : undefined,
      references: references && references.length > 0 ? references.map((r: string) => `<${r.replace(/^<|>$/g, '')}>`).join(' ') : undefined,
      attachments: processedAttachments.length > 0 ? processedAttachments : undefined,
    };

    const info = await transporter.sendMail(mailOptions);

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      accepted: info.accepted,
      response: info.response,
    });
  } catch (error) {
    console.error('[send-oracle] Send mail error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error sending mail via Oracle';
    return NextResponse.json({ error: `Oracle 发信失败: ${message}` }, { status: 500 });
  }
}

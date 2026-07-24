import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, getClientIP } from '@/lib/admin/session';
import { auditLog } from '@/lib/admin/audit';
import {
  getInviteCodes,
  createInviteCode,
  revokeInviteCode,
  deleteInviteCode,
} from '@/lib/admin/invite-manager';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if ('error' in authResult) return authResult.error;

    const invites = await getInviteCodes();
    return NextResponse.json({ invites }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    logger.error('Admin invites fetch error', { error: error instanceof Error ? error.message : 'Unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if ('error' in authResult) return authResult.error;

    const body = await request.json().catch(() => ({}));
    const { code, maxUses, expiresDays, note } = body;

    const newInvite = await createInviteCode({
      code,
      maxUses: typeof maxUses === 'number' ? maxUses : 1,
      expiresDays: typeof expiresDays === 'number' ? expiresDays : null,
      note,
      createdBy: 'admin',
    });

    const ip = getClientIP(request);
    await auditLog(
      'invite_create',
      { code: newInvite.code, maxUses: newInvite.maxUses, note: newInvite.note },
      ip
    );

    return NextResponse.json({ success: true, invite: newInvite });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to create invite code';
    logger.error('Admin invite create error', { error: msg });
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if ('error' in authResult) return authResult.error;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const action = searchParams.get('action') || 'revoke'; // 'revoke' | 'delete'

    if (!id) {
      return NextResponse.json({ error: 'Missing invite ID' }, { status: 400 });
    }

    let success = false;
    if (action === 'delete') {
      success = await deleteInviteCode(id);
    } else {
      success = await revokeInviteCode(id);
    }

    if (!success) {
      return NextResponse.json({ error: 'Invite code not found' }, { status: 404 });
    }

    const ip = getClientIP(request);
    await auditLog(
      action === 'delete' ? 'invite_delete' : 'invite_revoke',
      { inviteId: id },
      ip
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Admin invite delete/revoke error', { error: error instanceof Error ? error.message : 'Unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

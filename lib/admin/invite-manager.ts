import { readFile, writeFile, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { getStatePath, ensureStateDir } from './paths';
import { logger } from '@/lib/logger';
import crypto from 'node:crypto';

export interface InviteUsageLog {
  email: string;
  usedAt: string;
  ip: string;
}

export interface InviteCode {
  id: string;
  code: string;
  maxUses: number; // 0 = unlimited, 1 = single-use, >1 = N-use
  usedCount: number;
  expiresAt: string | null; // ISO date string or null
  createdAt: string;
  createdBy?: string;
  note?: string;
  isRevoked: boolean;
  usedBy: InviteUsageLog[];
}

const INVITE_FILE = 'invite-codes.json';

function generateRandomCode(): string {
  // Generate code format: INV-XXXX-XXXX
  const bytes = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `INV-${bytes.slice(0, 4)}-${bytes.slice(4, 8)}`;
}

async function readInviteFile(): Promise<InviteCode[]> {
  await ensureStateDir();
  const filePath = getStatePath(INVITE_FILE);
  if (!existsSync(filePath)) {
    return [];
  }
  try {
    const raw = await readFile(filePath, 'utf-8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    logger.error('Failed to read invite codes file', { error: err });
    return [];
  }
}

async function writeInviteFile(invites: InviteCode[]): Promise<void> {
  await ensureStateDir();
  const filePath = getStatePath(INVITE_FILE);
  const tmpPath = `${filePath}.tmp.${Date.now()}`;
  const jsonStr = JSON.stringify(invites, null, 2);
  await writeFile(tmpPath, jsonStr, 'utf-8');
  await rename(tmpPath, filePath);
}

export async function getInviteCodes(): Promise<InviteCode[]> {
  return await readInviteFile();
}

export async function createInviteCode(options: {
  code?: string;
  maxUses?: number;
  expiresDays?: number | null;
  note?: string;
  createdBy?: string;
}): Promise<InviteCode> {
  const invites = await readInviteFile();

  const codeStr = options.code?.trim().toUpperCase() || generateRandomCode();
  
  // Check duplicate
  if (invites.some((i) => i.code.toUpperCase() === codeStr)) {
    throw new Error(`Invite code "${codeStr}" already exists.`);
  }

  let expiresAt: string | null = null;
  if (options.expiresDays && options.expiresDays > 0) {
    const d = new Date();
    d.setDate(d.getDate() + options.expiresDays);
    expiresAt = d.toISOString();
  }

  const newInvite: InviteCode = {
    id: `inv_${crypto.randomBytes(6).toString('hex')}`,
    code: codeStr,
    maxUses: typeof options.maxUses === 'number' && options.maxUses >= 0 ? options.maxUses : 1,
    usedCount: 0,
    expiresAt,
    createdAt: new Date().toISOString(),
    createdBy: options.createdBy || 'admin',
    note: options.note?.trim() || '',
    isRevoked: false,
    usedBy: [],
  };

  invites.unshift(newInvite);
  await writeInviteFile(invites);
  return newInvite;
}

export async function revokeInviteCode(id: string): Promise<boolean> {
  const invites = await readInviteFile();
  const item = invites.find((i) => i.id === id);
  if (!item) return false;

  item.isRevoked = true;
  await writeInviteFile(invites);
  return true;
}

export async function deleteInviteCode(id: string): Promise<boolean> {
  let invites = await readInviteFile();
  const initialLength = invites.length;
  invites = invites.filter((i) => i.id !== id);
  if (invites.length === initialLength) return false;

  await writeInviteFile(invites);
  return true;
}

export async function verifyInviteCode(codeStr: string): Promise<{
  valid: boolean;
  error?: string;
  invite?: InviteCode;
}> {
  if (!codeStr || !codeStr.trim()) {
    return { valid: false, error: 'Invite code is required' };
  }

  const invites = await readInviteFile();
  const normalized = codeStr.trim().toUpperCase();
  const invite = invites.find((i) => i.code.toUpperCase() === normalized);

  if (!invite) {
    return { valid: false, error: 'Invalid invite code' };
  }
  if (invite.isRevoked) {
    return { valid: false, error: 'Invite code has been revoked by admin' };
  }
  if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
    return { valid: false, error: 'Invite code has expired' };
  }
  if (invite.maxUses > 0 && invite.usedCount >= invite.maxUses) {
    return { valid: false, error: 'Invite code usage limit reached' };
  }

  return { valid: true, invite };
}

export async function consumeInviteCode(
  codeStr: string,
  email: string,
  ip: string
): Promise<boolean> {
  const invites = await readInviteFile();
  const normalized = codeStr.trim().toUpperCase();
  const invite = invites.find((i) => i.code.toUpperCase() === normalized);

  if (!invite) return false;

  invite.usedCount += 1;
  invite.usedBy.push({
    email,
    usedAt: new Date().toISOString(),
    ip,
  });

  await writeInviteFile(invites);
  return true;
}

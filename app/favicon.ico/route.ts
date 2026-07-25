import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { configManager } from '@/lib/admin/config-manager';

export async function GET(request: NextRequest) {
  try {
    await configManager.ensureLoaded();
    const faviconUrl = configManager.get<string>('faviconUrl', '/branding/Bulwark_Favicon.svg');

    // Remove query params or leading slash
    const cleanUrl = faviconUrl.split('?')[0].replace(/^\/+/, '');
    const publicPath = path.join(process.cwd(), 'public', cleanUrl);

    if (fs.existsSync(publicPath)) {
      const fileBuffer = fs.readFileSync(publicPath);
      const ext = path.extname(cleanUrl).toLowerCase();

      let contentType = 'image/x-icon';
      if (ext === '.svg') contentType = 'image/svg+xml';
      else if (ext === '.png') contentType = 'image/png';
      else if (ext === '.webp') contentType = 'image/webp';

      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        },
      });
    }

    // Fallback if branding file not found on disk
    return new NextResponse(null, { status: 404 });
  } catch (error) {
    return new NextResponse(null, { status: 500 });
  }
}

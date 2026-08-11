export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import os from 'os';

export async function GET() {
  const nets = os.networkInterfaces();
  const ips: string[] = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      // IPv4 涓旈潪鍥炵幆鍦板潃
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return NextResponse.json({ ips: ips.length ? ips : ['localhost'] });
}

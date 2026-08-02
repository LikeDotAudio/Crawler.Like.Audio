import { NextRequest, NextResponse } from 'next/server';
import youtubedl from 'youtube-dl-exec';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const url = searchParams.get('url');
  const type = searchParams.get('type') || 'video'; // 'video' or 'audio'

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    const dlFormat = type === 'audio' ? 'bestaudio/best' : 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best';
    
    // We get the JSON first to find the title
    const info = await youtubedl(url, {
      dumpJson: true,
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
      addHeader: [
        'referer:youtube.com',
        'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
      ]
    });

    // Sanitize title for filename
    const infoAny = info as any;
    const safeTitle = (infoAny.title || 'download').replace(/[^a-zA-Z0-9 -]/g, '').trim();
    const ext = type === 'audio' ? 'mp3' : 'mp4';
    const filename = `${safeTitle}.${ext}`;

    // Now we spawn the stream
    const subprocess = youtubedl.exec(url, {
      output: '-', // output to stdout
      format: dlFormat,
      extractAudio: type === 'audio',
      audioFormat: type === 'audio' ? 'mp3' : undefined,
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
      addHeader: [
        'referer:youtube.com',
        'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
      ]
    });

    if (!subprocess.stdout) {
      throw new Error("Failed to get stdout from yt-dlp");
    }

    // Convert Node.js Readable to Web ReadableStream
    const readable = new ReadableStream({
      start(controller) {
        subprocess.stdout?.on('data', (chunk) => {
          controller.enqueue(chunk);
        });
        subprocess.stdout?.on('end', () => {
          controller.close();
        });
        subprocess.stdout?.on('error', (err) => {
          controller.error(err);
        });
      },
      cancel() {
        subprocess.kill();
      }
    });

    const headers = new Headers();
    headers.set('Content-Disposition', `attachment; filename="${filename}"`);
    headers.set('Content-Type', type === 'audio' ? 'audio/mpeg' : 'video/mp4');

    return new Response(readable, {
      headers
    });
  } catch (error: any) {
    console.error('YTDL Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to download' }, { status: 500 });
  }
}

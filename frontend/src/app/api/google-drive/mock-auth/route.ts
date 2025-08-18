import { NextRequest, NextResponse } from 'next/server'

export async function GET(_request: NextRequest) {
    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Google Drive Mock Auth (Proxy)</title>
  </head>
  <body>
    <p>Autorização simulada com sucesso. Esta janela fechará automaticamente.</p>
    <script>
      try {
        if (window.opener) {
          window.opener.postMessage({ type: 'DRIVE_AUTH_SUCCESS' }, '*');
        }
      } catch (e) { /* ignore */ }
      setTimeout(function(){ try { window.close(); } catch(e){} }, 500);
    </script>
  </body>
  </html>`

    return new NextResponse(html, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
}




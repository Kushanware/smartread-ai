async function getSvgUrl() {
  try {
    const res = await fetch('brand.svg');
    const svgText = await res.text();
    const blob = new Blob([svgText], { type: 'image/svg+xml' });
    return URL.createObjectURL(blob);
  } catch {
    // Inline fallback SVG (same brand)
    const inline = `<?xml version="1.0"?><svg xmlns='http://www.w3.org/2000/svg' width='128' height='128' viewBox='0 0 128 128'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='#6366f1'/><stop offset='100%' stop-color='#10b981'/></linearGradient></defs><rect x='8' y='8' width='112' height='112' rx='24' fill='white'/><rect x='8' y='8' width='112' height='112' rx='24' fill='url(#g)' opacity='0.08'/><circle cx='64' cy='64' r='44' fill='url(#g)'/><path d='M86 50c0-8-9-14-22-14-11 0-20 5-24 12l9 5c3-5 9-8 15-8 7 0 12 3 12 6 0 4-4 6-12 7-17 3-25 9-25 19 0 9 10 15 22 15 11 0 20-5 24-12l-9-5c-3 5-9 8-15 8-7 0-12-3-12-6 0-4 4-6 12-7 17-3 25-9 25-20z' fill='#fff'/></svg>`;
    const blob = new Blob([inline], { type: 'image/svg+xml' });
    return URL.createObjectURL(blob);
  }
}

async function svgToPng(size){
  const url = await getSvgUrl();
  const img = new Image();
  return new Promise((resolve, reject) => {
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,size,size);
      ctx.drawImage(img, 0, 0, size, size);
      canvas.toBlob(b => {
        URL.revokeObjectURL(url);
        if (b) resolve(b); else reject(new Error('Canvas export failed'));
      }, 'image/png');
    };
    img.onerror = () => reject(new Error('SVG decode failed'));
    img.src = url;
  });
}

function download(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

document.getElementById('exportBtn').addEventListener('click', async ()=>{
  const log = document.getElementById('log');
  log.textContent = 'Exporting...';
  try{
    const sizes = [16, 48, 128];
    for(const s of sizes){
      const blob = await svgToPng(s);
      download(blob, `icon${s}.png`);
    }
    log.textContent = 'Done. Files downloaded. Replace icons/icon16.png, icon48.png, icon128.png and reload the extension.';
  }catch(e){
    log.textContent = 'Error: ' + e.message + '\nTip: open this file via http (e.g., Live Server) if your browser blocks file:// fetch.';
  }
});

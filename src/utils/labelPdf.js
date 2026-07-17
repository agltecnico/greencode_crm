export const generateLabelPDF = (productName, batchNumber, shelfLifeDays, count) => {
  const width = 800;
  const height = 1131; // A4 size aprox at 96dpi

  const svgParts = [];
  svgParts.push(\`<svg width="\${width}" height="\${height}" xmlns="http://www.w3.org/2000/svg">\`);
  svgParts.push(\`<rect width="100%" height="100%" fill="white"/>\`);
  
  const cols = 2;
  const rows = 5;
  const labelWidth = width / cols;
  const labelHeight = height / rows;
  
  const todayDate = new Date();
  const expDate = new Date(todayDate.getTime() + (shelfLifeDays * 24 * 60 * 60 * 1000));
  
  const formattedToday = todayDate.toLocaleDateString();
  const formattedExp = expDate.toLocaleDateString();

  let drawn = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (drawn >= count) break;
      const x = col * labelWidth;
      const y = row * labelHeight;
      
      svgParts.push(\`
        <g transform="translate(\${x + 20}, \${y + 20})">
          <rect width="\${labelWidth - 40}" height="\${labelHeight - 40}" fill="none" stroke="#ccc" stroke-width="2" rx="10"/>
          <text x="20" y="40" font-family="Arial" font-size="24" font-weight="bold" fill="black">GREENCODE</text>
          <text x="20" y="80" font-family="Arial" font-size="28" font-weight="bold" fill="#16a34a">\${productName}</text>
          
          <text x="20" y="120" font-family="Arial" font-size="16" fill="#333">Envasado: \${formattedToday}</text>
          <text x="20" y="145" font-family="Arial" font-size="16" fill="#333" font-weight="bold">Consumo Preferente: \${formattedExp}</text>
          
          <!-- Faux QR Code / Barcode -->
          <rect x="20" y="165" width="60" height="60" fill="black"/>
          <rect x="25" y="170" width="10" height="10" fill="white"/>
          <rect x="65" y="170" width="10" height="10" fill="white"/>
          <rect x="25" y="210" width="10" height="10" fill="white"/>
          <rect x="40" y="185" width="20" height="20" fill="white"/>
          
          <text x="95" y="195" font-family="monospace" font-size="14" fill="#666">LOTE SANIDAD:</text>
          <text x="95" y="215" font-family="monospace" font-size="20" font-weight="bold" fill="black">\${batchNumber}</text>
        </g>
      \`);
      drawn++;
    }
  }

  svgParts.push('</svg>');
  const svgString = svgParts.join('');

  const iframe = document.createElement('iframe');
  document.body.appendChild(iframe);
  iframe.style.position = 'absolute';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';

  iframe.contentDocument.open();
  iframe.contentDocument.write(\`
    <!DOCTYPE html>
    <html>
      <head><title>Imprimir Etiquetas \${batchNumber}</title></head>
      <body style="margin:0; padding:0; text-align:center;">
        \${svgString}
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.parent.document.body.removeChild(window.frameElement); }, 1000);
          }
        </script>
      </body>
    </html>
  \`);
  iframe.contentDocument.close();
};

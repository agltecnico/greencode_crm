export const generateLabelPDF = (productName, batchNumber, shelfLifeDays, count, nutritionalInfo, varietiesText = '') => {
  const width = 800;
  const height = 1131; // A4 size aprox at 96dpi

  const svgParts = [];
  svgParts.push(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`);
  svgParts.push(`<rect width="100%" height="100%" fill="white"/>`);
  
  // Imprimir tantas etiquetas como tuppers
  // Si no caben en un A4, esto dibuja todas en SVG y el print dialog las paginará? 
  // No, SVG no pagina. Para SVG, tenemos que agrandar el height.
  // Cada etiqueta será de por ejemplo 350x200
  const labelWidth = 380;
  const labelHeight = 250;
  
  const cols = 2;
  const labelsPerPage = cols * 4; // 8 etiquetas por pagina
  
  // Ajustar la altura total del SVG al numero de etiquetas
  const totalRows = Math.ceil(count / cols);
  const requiredHeight = Math.max(height, totalRows * labelHeight + 40);
  
  // Regenerar etiqueta raiz con altura dinamica
  svgParts[0] = `<svg width="${width}" height="${requiredHeight}" xmlns="http://www.w3.org/2000/svg">`;
  
  const todayDate = new Date();
  const expDate = new Date(todayDate.getTime() + (shelfLifeDays * 24 * 60 * 60 * 1000));
  
  const formattedToday = todayDate.toLocaleDateString('es-ES');
  const formattedExp = expDate.toLocaleDateString('es-ES');

  // Valores Nutricionales Seguros
  const n = nutritionalInfo || {};
  const eKcal = n.energy || '0';
  const grasa = n.fat || '0';
  const sat = n.saturatedFat || '0';
  const hc = n.carbs || '0';
  const azu = n.sugars || '0';
  const prot = n.protein || '0';
  const sal = n.salt || '0';

  let drawn = 0;
  for (let row = 0; row < totalRows; row++) {
    for (let col = 0; col < cols; col++) {
      if (drawn >= count) break;
      const x = col * labelWidth + 20;
      const y = row * labelHeight + 20;
      
      svgParts.push(`
        <g transform="translate(${x}, ${y})">
          <rect width="${labelWidth - 20}" height="${labelHeight - 20}" fill="white" stroke="#333" stroke-width="1.5" rx="8"/>
          
          <!-- Encabezado -->
          <text x="15" y="30" font-family="Arial" font-size="16" font-weight="900" fill="#064e3b">GREENCODE</text>
          <text x="15" y="55" font-family="Arial" font-size="18" font-weight="bold" fill="#16a34a">${productName}</text>
          
          <!-- Lote y Fechas -->
          <text x="15" y="80" font-family="Arial" font-size="12" fill="#333">Envasado: <tspan font-weight="bold">${formattedToday}</tspan></text>
          <text x="15" y="98" font-family="Arial" font-size="12" fill="#333">Caducidad: <tspan font-weight="bold">${formattedExp}</tspan></text>
          <text x="15" y="116" font-family="Arial" font-size="12" fill="#333">Lote Sanidad: <tspan font-weight="bold" fill="black">${batchNumber}</tspan></text>
          
          <!-- Variedades -->
          <text x="15" y="140" font-family="Arial" font-size="10" fill="#666" font-style="italic">${varietiesText.substring(0, 50)}${varietiesText.length > 50 ? '...' : ''}</text>

          <!-- Tabla Nutricional -->
          <g transform="translate(200, 15)">
            <rect width="150" height="185" fill="#f8fafc" stroke="#ccc" stroke-width="1" rx="4"/>
            <text x="75" y="20" font-family="Arial" font-size="10" font-weight="bold" text-anchor="middle" fill="#333">Información Nutricional</text>
            <text x="75" y="32" font-family="Arial" font-size="8" text-anchor="middle" fill="#666">(Valores medios por 100g)</text>
            
            <line x1="5" y1="40" x2="145" y2="40" stroke="#ccc" stroke-width="1"/>
            <text x="10" y="55" font-family="Arial" font-size="9" fill="#333">Energía (kcal)</text>
            <text x="140" y="55" font-family="Arial" font-size="9" font-weight="bold" text-anchor="end" fill="#333">${eKcal}</text>
            
            <line x1="5" y1="62" x2="145" y2="62" stroke="#eee" stroke-width="1"/>
            <text x="10" y="75" font-family="Arial" font-size="9" fill="#333">Grasas (g)</text>
            <text x="140" y="75" font-family="Arial" font-size="9" font-weight="bold" text-anchor="end" fill="#333">${grasa}</text>
            
            <text x="15" y="90" font-family="Arial" font-size="8" fill="#666">- Saturadas</text>
            <text x="140" y="90" font-family="Arial" font-size="8" text-anchor="end" fill="#666">${sat}</text>
            
            <line x1="5" y1="98" x2="145" y2="98" stroke="#eee" stroke-width="1"/>
            <text x="10" y="112" font-family="Arial" font-size="9" fill="#333">Hidratos C. (g)</text>
            <text x="140" y="112" font-family="Arial" font-size="9" font-weight="bold" text-anchor="end" fill="#333">${hc}</text>
            
            <text x="15" y="127" font-family="Arial" font-size="8" fill="#666">- Azúcares</text>
            <text x="140" y="127" font-family="Arial" font-size="8" text-anchor="end" fill="#666">${azu}</text>
            
            <line x1="5" y1="135" x2="145" y2="135" stroke="#eee" stroke-width="1"/>
            <text x="10" y="150" font-family="Arial" font-size="9" fill="#333">Proteínas (g)</text>
            <text x="140" y="150" font-family="Arial" font-size="9" font-weight="bold" text-anchor="end" fill="#333">${prot}</text>
            
            <line x1="5" y1="158" x2="145" y2="158" stroke="#eee" stroke-width="1"/>
            <text x="10" y="173" font-family="Arial" font-size="9" fill="#333">Sal (g)</text>
            <text x="140" y="173" font-family="Arial" font-size="9" font-weight="bold" text-anchor="end" fill="#333">${sal}</text>
          </g>

          <!-- Placeholder Logo / Conservación -->
          <text x="15" y="215" font-family="Arial" font-size="9" fill="#666" font-weight="bold">Mantener refrigerado entre 2°C y 4°C</text>
          <text x="15" y="228" font-family="Arial" font-size="8" fill="#999">Producido por Fractal Magnetosphere S.L.</text>
        </g>
      `);
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
  iframe.contentDocument.write(`
    <!DOCTYPE html>
    <html>
      <head><title>Imprimir Etiquetas ${batchNumber}</title></head>
      <body style="margin:0; padding:20px; text-align:center;">
        ${svgString}
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.parent.document.body.removeChild(window.frameElement); }, 1000);
          }
        </script>
      </body>
    </html>
  `);
  iframe.contentDocument.close();
};

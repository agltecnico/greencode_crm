export const generateLabelPDF = (productName, batchNumber, shelfLifeDays, count, nutritionalInfo, varietiesText = '') => {
  // Use setTimeout to ensure the React event loop isn't blocked, allowing the modal to close first
  setTimeout(() => {
    const todayDate = new Date();
    const expDate = new Date(todayDate.getTime() + ((shelfLifeDays || 10) * 24 * 60 * 60 * 1000));
    
    const formattedToday = todayDate.toLocaleDateString('es-ES');
    const formattedExp = expDate.toLocaleDateString('es-ES');

    const n = nutritionalInfo || {};
    const eKcal = n.energy || '0';
    const grasa = n.fat || '0';
    const sat = n.saturatedFat || '0';
    const hc = n.carbs || '0';
    const azu = n.sugars || '0';
    const prot = n.protein || '0';
    const sal = n.salt || '0';

    let labelsHtml = '';
    for (let i = 0; i < count; i++) {
      labelsHtml += `
        <div class="label">
          <div class="header">GREENCODE</div>
          <div class="product-name">${productName}</div>
          
          <div class="info-row">
            <span>Envasado: <strong>${formattedToday}</strong></span>
          </div>
          <div class="info-row">
            <span>Caducidad: <strong>${formattedExp}</strong></span>
          </div>
          <div class="info-row">
            <span>Lote Sanidad: <strong>${batchNumber}</strong></span>
          </div>
          
          <div class="varieties">${varietiesText}</div>
          
          <table class="nutrition-table">
            <tr><th colspan="2">Información Nutricional (por 100g)</th></tr>
            <tr><td>Energía</td><td class="right">${eKcal} kcal</td></tr>
            <tr><td>Grasas</td><td class="right">${grasa} g</td></tr>
            <tr><td class="indent">- Saturadas</td><td class="right">${sat} g</td></tr>
            <tr><td>Hidratos de carbono</td><td class="right">${hc} g</td></tr>
            <tr><td class="indent">- Azúcares</td><td class="right">${azu} g</td></tr>
            <tr><td>Proteínas</td><td class="right">${prot} g</td></tr>
            <tr><td>Sal</td><td class="right">${sal} g</td></tr>
          </table>
          
          <div class="footer">
            <div>Mantener refrigerado entre 2ºC y 4ºC</div>
            <div style="font-size: 6pt; font-weight: normal; margin-top: 2px;">Producido por Fractal Magnetosphere S.L.</div>
          </div>
        </div>
      `;
    }

    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Imprimir Etiquetas - ${batchNumber}</title>
        <style>
          @page { margin: 0; size: auto; }
          body { margin: 0; padding: 0; background: #f0f0f0; font-family: Arial, sans-serif; }
          .label {
            width: 58mm; height: 90mm; background: white; margin: 0 auto 10mm auto; padding: 4mm;
            box-sizing: border-box; border-radius: 2mm; page-break-after: always; overflow: hidden; display: flex; flex-direction: column;
          }
          .header { font-size: 10pt; font-weight: 900; color: #064e3b; text-align: center; margin-bottom: 2px; }
          .product-name { font-size: 14pt; font-weight: bold; color: #16a34a; text-align: center; line-height: 1.1; margin-bottom: 6px; }
          .info-row { font-size: 8pt; color: #111; margin-bottom: 2px; border-bottom: 1px dotted #ccc; padding-bottom: 2px; }
          .varieties { font-size: 7pt; color: #555; font-style: italic; margin: 4px 0; line-height: 1.2; text-align: center; }
          .nutrition-table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 7pt; color: #000; }
          .nutrition-table th { text-align: center; font-weight: bold; border-bottom: 1px solid #000; padding-bottom: 2px; margin-bottom: 2px; }
          .nutrition-table td { padding: 1.5px 0; border-bottom: 1px dotted #eee; }
          .nutrition-table td.right { text-align: right; font-weight: bold; }
          .nutrition-table td.indent { padding-left: 6px; font-size: 6.5pt; color: #444; }
          .footer { margin-top: auto; text-align: center; font-size: 7pt; font-weight: bold; color: #111; border-top: 1px solid #000; padding-top: 4px; }
          @media print { body { background: white; } .label { margin: 0; padding: 2mm; border: none; border-radius: 0; } }
        </style>
      </head>
      <body>
        ${labelsHtml}
        <script>window.onload = () => { setTimeout(() => { window.print(); }, 300); };</script>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(fullHtml);
      printWindow.document.close();
      printWindow.focus();
    } else {
      alert("Por favor, permite las ventanas emergentes (pop-ups) en tu navegador para generar las etiquetas.");
    }
  }, 100);
};

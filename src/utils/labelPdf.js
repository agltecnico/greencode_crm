import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

export const generateLabelPDF = (productName, batchNumber, shelfLifeDays, count, nutritionalInfo, varietiesText = '') => {
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

  // Configuración de tamaño de etiqueta (58x90mm típico para rollo continuo Brother/Dymo)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [58, 90]
  });

  for (let i = 0; i < count; i++) {
    if (i > 0) doc.addPage([58, 90], 'portrait');

    // Borde opcional
    doc.setDrawColor(200);
    doc.setLineWidth(0.3);
    doc.roundedRect(2, 2, 54, 86, 2, 2);

    // Cabecera GREENCODE
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(6, 78, 59); // Emerald 900
    doc.text("GREENCODE", 29, 7, { align: 'center' });

    // Nombre de Producto
    doc.setFontSize(13);
    doc.setTextColor(22, 163, 74); // Green 600
    doc.text(productName.substring(0, 30), 29, 13, { align: 'center' });
    
    if (productName.length > 30) {
      doc.text(productName.substring(30, 60), 29, 17, { align: 'center' });
    }

    // Info
    doc.setFontSize(8);
    doc.setTextColor(30, 30, 30);
    doc.setFont("helvetica", "normal");
    const infoY = productName.length > 30 ? 23 : 20;
    
    doc.text("Envasado:", 5, infoY);
    doc.setFont("helvetica", "bold");
    doc.text(formattedToday, 25, infoY);
    doc.setLineWidth(0.1);
    doc.line(5, infoY + 1, 53, infoY + 1);

    doc.setFont("helvetica", "normal");
    doc.text("Caducidad:", 5, infoY + 5);
    doc.setFont("helvetica", "bold");
    doc.text(formattedExp, 25, infoY + 5);
    doc.line(5, infoY + 6, 53, infoY + 6);

    doc.setFont("helvetica", "normal");
    doc.text("Lote Sanidad:", 5, infoY + 10);
    doc.setFont("helvetica", "bold");
    doc.text(batchNumber, 25, infoY + 10);
    doc.line(5, infoY + 11, 53, infoY + 11);

    // Variedades
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(80, 80, 80);
    const splitVarieties = doc.splitTextToSize(varietiesText || 'Sin variedades', 48);
    doc.text(splitVarieties, 29, infoY + 15, { align: 'center' });

    // Tabla Nutricional
    const tableY = infoY + 15 + (splitVarieties.length * 3);
    
    doc.autoTable({
      startY: tableY,
      theme: 'grid',
      margin: { left: 5, right: 5 },
      styles: { fontSize: 6, cellPadding: 0.5, textColor: 0 },
      headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold', halign: 'center' },
      columnStyles: { 0: { cellWidth: 32 }, 1: { cellWidth: 16, halign: 'right', fontStyle: 'bold' } },
      head: [['Info. Nutricional (100g)', '']],
      body: [
        ['Energía', eKcal + ' kcal'],
        ['Grasas', grasa + ' g'],
        [' - Saturadas', sat + ' g'],
        ['Hidratos C.', hc + ' g'],
        [' - Azúcares', azu + ' g'],
        ['Proteínas', prot + ' g'],
        ['Sal', sal + ' g'],
      ],
    });

    // Pie de página
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(0);
    doc.text("Mantener refrigerado entre 2ºC y 4ºC", 29, 83, { align: 'center' });
    doc.setFontSize(6);
    doc.setTextColor(80);
    doc.text("Producido por Fractal Magnetosphere S.L.", 29, 86, { align: 'center' });
  }

  // Intenta abrir el PDF en una pestaña nueva con el diálogo de impresión listo
  doc.autoPrint();
  const blobURL = doc.output('bloburl');
  const printWindow = window.open(blobURL);
  
  if (!printWindow) {
    // Si el navegador bloqueó la ventana emergente, descargamos el archivo como Plan B infalible
    doc.save(`Etiquetas_${batchNumber}.pdf`);
  }
};

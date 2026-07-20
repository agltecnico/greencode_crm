import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateLabelPDF = (productName, batchNumber, shelfLifeDays, count, nutritionalInfo, varietiesText = '') => {
  try {
    alert("Generando PDF... Revisa tu carpeta de Descargas al terminar.");
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

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [58, 90]
    });

    for (let i = 0; i < count; i++) {
      if (i > 0) doc.addPage([58, 90], 'portrait');

      doc.setDrawColor(200);
      doc.setLineWidth(0.3);
      doc.roundedRect(2, 2, 54, 86, 2, 2);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(6, 78, 59);
      doc.text("GREENCODE", 29, 7, { align: 'center' });

      doc.setFontSize(13);
      doc.setTextColor(22, 163, 74);
      doc.text(String(productName).substring(0, 30), 29, 13, { align: 'center' });
      
      if (String(productName).length > 30) {
        doc.text(String(productName).substring(30, 60), 29, 17, { align: 'center' });
      }

      doc.setFontSize(8);
      doc.setTextColor(30, 30, 30);
      doc.setFont("helvetica", "normal");
      const infoY = String(productName).length > 30 ? 23 : 20;
      
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
      doc.text(String(batchNumber), 25, infoY + 10);
      doc.line(5, infoY + 11, 53, infoY + 11);

      doc.setFont("helvetica", "italic");
      doc.setFontSize(7);
      doc.setTextColor(80, 80, 80);
      const splitVarieties = doc.splitTextToSize(varietiesText || 'Sin variedades', 48);
      doc.text(splitVarieties, 29, infoY + 15, { align: 'center' });

      const tableY = infoY + 15 + (splitVarieties.length * 3);
      
      autoTable(doc, {
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

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(0);
      doc.text("Mantener refrigerado entre 2ºC y 4ºC", 29, 83, { align: 'center' });
      doc.setFontSize(6);
      doc.setTextColor(80);
      doc.text("Producido por Fractal Magnetosphere S.L.", 29, 86, { align: 'center' });
    }

    doc.save(`Etiquetas_${batchNumber}.pdf`);
    alert("¡PDF descargado! Revisa la flecha de descargas arriba a la derecha en Chrome/Edge.");
  } catch (error) {
    console.error("Error al generar PDF:", error);
    alert("Error al generar las etiquetas: " + error.message);
  }
};

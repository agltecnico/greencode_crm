import { jsPDF } from 'jspdf';

export const generateLabelPDF = (productName, batchNumber, shelfLifeDays, count, nutritionalInfo, varietiesText = '') => {
  try {
    const todayDate = new Date();
    const expDate = new Date(todayDate.getTime() + ((shelfLifeDays || 10) * 24 * 60 * 60 * 1000));
    
    const formattedToday = todayDate.toLocaleDateString('es-ES');
    const formattedExp = expDate.toLocaleDateString('es-ES');

    // Zebra ZT220 typical small label (e.g. 50mm x 30mm)
    const labelWidth = 50;
    const labelHeight = 30;

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [labelHeight, labelWidth]
    });

    const numLabels = parseInt(count) || 1;

    for (let i = 0; i < numLabels; i++) {
      if (i > 0) doc.addPage([labelHeight, labelWidth], 'landscape');

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(6, 78, 59); // Dark green
      doc.text("GREENCODE", labelWidth / 2, 4, { align: 'center' });

      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      const splitName = doc.splitTextToSize(String(productName), labelWidth - 4);
      doc.text(splitName, labelWidth / 2, 9, { align: 'center' });

      const infoY = 9 + (splitName.length * 3.5);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      
      doc.text("Envasado:", 3, infoY);
      doc.setFont("helvetica", "bold");
      doc.text(formattedToday, 18, infoY);

      doc.setFont("helvetica", "normal");
      doc.text("Caducidad:", 3, infoY + 4);
      doc.setFont("helvetica", "bold");
      doc.text(formattedExp, 18, infoY + 4);

      doc.setFont("helvetica", "normal");
      doc.text("Lote:", 3, infoY + 8);
      doc.setFont("helvetica", "bold");
      doc.text(String(batchNumber), 12, infoY + 8);
      
      doc.setFontSize(5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 80);
      doc.text("Mantener refrigerado entre 2ºC y 4ºC", labelWidth / 2, labelHeight - 2, { align: 'center' });
    }

    doc.save(`Etiquetas_${batchNumber}.pdf`);
  } catch (error) {
    console.error("Error al generar PDF:", error);
    alert("Error al generar las etiquetas: " + error.message);
  }
};

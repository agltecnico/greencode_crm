import { jsPDF } from 'jspdf';

const formatDate = date =>
  new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);

const companyAddress = profile => [
  profile?.address,
  [profile?.postalCode, profile?.city].filter(Boolean).join(' '),
  profile?.province
].filter(Boolean).join(', ');

/**
 * Genera la etiqueta trasera de trazabilidad.
 * Ingredientes, alérgenos, peso neto y conservación ya figuran en la etiqueta frontal.
 */
export const generateLabelPDF = ({
  batchNumber,
  shelfLifeDays,
  count,
  packingDate,
  companyProfile
}) => {
  const packedAt = new Date(packingDate);
  const lifeDays = Number(shelfLifeDays);
  const numLabels = Number.parseInt(count, 10);

  if (Number.isNaN(packedAt.getTime())) {
    throw new Error('La cosecha no tiene una fecha de envasado válida.');
  }
  if (!Number.isInteger(lifeDays) || lifeDays <= 0) {
    throw new Error('El producto no tiene configurada una vida útil válida.');
  }
  if (!batchNumber) {
    throw new Error('La cosecha no tiene número de lote.');
  }
  if (!Number.isInteger(numLabels) || numLabels <= 0) {
    throw new Error('La cosecha no tiene unidades envasadas para imprimir.');
  }

  const operatorName = companyProfile?.fiscalName || companyProfile?.ownerName || companyProfile?.commercialName;
  const operatorIdentity = [operatorName, companyProfile?.nif && `NIF ${companyProfile.nif}`]
    .filter(Boolean)
    .join(' · ');
  const operatorAddress = companyAddress(companyProfile);
  if (!operatorName || !operatorAddress) {
    throw new Error('Completa la razón social y la dirección de GreenCode en Datos de empresa.');
  }

  const expiresAt = new Date(packedAt);
  expiresAt.setDate(expiresAt.getDate() + lifeDays);

  // Etiqueta trasera para Zebra ZT220: conserva el formato físico actual de 50 × 30 mm.
  const labelWidth = 50;
  const labelHeight = 30;
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [labelHeight, labelWidth]
  });

  for (let index = 0; index < numLabels; index += 1) {
    if (index > 0) doc.addPage([labelHeight, labelWidth], 'landscape');

    doc.setTextColor(6, 78, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('GREENCODE', labelWidth / 2, 4.2, { align: 'center' });

    doc.setTextColor(65, 65, 65);
    doc.setFontSize(6.5);
    doc.text('TRAZABILIDAD DEL PRODUCTO', labelWidth / 2, 7.4, { align: 'center' });

    const row = (label, value, y) => {
      doc.setTextColor(35, 35, 35);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(`${label}:`, 3, y);
      doc.setFont('helvetica', 'bold');
      doc.text(String(value), 18, y);
    };

    row('Envasado', formatDate(packedAt), 11.5);
    row('Caducidad', formatDate(expiresAt), 15.4);
    row('Lote', batchNumber, 19.3);
    row('Origen', 'España', 23.2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(75, 75, 75);
    const operatorLines = doc.splitTextToSize(`${operatorIdentity} · ${operatorAddress}`, labelWidth - 6);
    doc.text(operatorLines.slice(0, 2), labelWidth / 2, 26.2, {
      align: 'center',
      lineHeightFactor: 1.05
    });
  }

  doc.save(`Etiquetas_${batchNumber}.pdf`);
};

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const getLogoBase64 = async () => {
  try {
    const cachedJpeg = localStorage.getItem('crm_company_logo_jpeg_v4');
    if (cachedJpeg) return cachedJpeg;

    let logoData = null;
    const customLogo = localStorage.getItem('crm_company_logo');
    if (customLogo) {
      logoData = JSON.parse(customLogo);
    } else {
      const response = await fetch('/logo.png');
      if (response.ok) {
        const blob = await response.blob();
        logoData = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
      }
    }

    if (!logoData) return null;

    // Convert PNG to solid white background JPEG to prevent black background bug in PDF viewers
    return new Promise((resolve) => {
      const img = new Image();
      const timeout = setTimeout(() => {
        console.warn("Logo conversion timed out");
        resolve(logoData);
      }, 1500); // 1.5s timeout to prevent hanging on iOS
      
      img.onload = () => {
        clearTimeout(timeout);
        try {
          const canvas = document.createElement('canvas');
          let targetW = img.width || 200;
          let targetH = img.height || 100;
          // CAP max dimensions to 800px to prevent main-thread freeze on low-RAM phones!
          if (targetW > 800) {
            targetH = Math.floor(targetH * (800 / targetW));
            targetW = 800;
          }
          const sourceCanvas = document.createElement('canvas');
          sourceCanvas.width = targetW;
          sourceCanvas.height = targetH;
          const sourceCtx = sourceCanvas.getContext('2d');
          sourceCtx.drawImage(img, 0, 0, targetW, targetH);
          const pixels = sourceCtx.getImageData(0, 0, targetW, targetH).data;
          let minX = targetW, minY = targetH, maxX = 0, maxY = 0;
          for (let y = 0; y < targetH; y += 1) {
            for (let x = 0; x < targetW; x += 1) {
              const index = (y * targetW + x) * 4;
              const visible = pixels[index + 3] > 20 && (pixels[index] < 245 || pixels[index + 1] < 245 || pixels[index + 2] < 245);
              if (visible) {
                minX = Math.min(minX, x); maxX = Math.max(maxX, x);
                minY = Math.min(minY, y); maxY = Math.max(maxY, y);
              }
            }
          }
          const hasVisibleContent = minX <= maxX && minY <= maxY;
          const cropX = hasVisibleContent ? minX : 0;
          const cropY = hasVisibleContent ? minY : 0;
          const cropW = hasVisibleContent ? maxX - minX + 1 : targetW;
          const cropH = hasVisibleContent ? maxY - minY + 1 : targetH;
          canvas.width = cropW;
          canvas.height = cropH;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, cropW, cropH);
          ctx.drawImage(sourceCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
          const jpegBase64 = canvas.toDataURL('image/jpeg', 0.9);
          try {
            localStorage.setItem('crm_company_logo_jpeg_v4', jpegBase64);
          } catch (storageError) {
            console.warn('Could not cache the company logo', storageError);
          }
          resolve(jpegBase64);
        } catch(e) {
          console.warn(e);
          resolve(logoData);
        }
      };
      img.onerror = () => {
        clearTimeout(timeout);
        resolve(logoData); // Fallback
      };
      img.src = logoData;
    });
  } catch (e) {
    console.warn("Could not load logo", e);
    return null;
  }
};

/* Plantilla anterior conservada temporalmente como referencia.
const buildDeliveryNoteDoc = async (albaran, client) => {
  const doc = new jsPDF();
  const logoData = await getLogoBase64();
  
  let headerBottomY = 40;

  if (logoData) {
    const props = doc.getImageProperties(logoData);
    const ratio = props.width / props.height;
    
    // Brute force the size because the image file contains huge transparent padding
    const targetWidth = 85; 
    const targetHeight = targetWidth / ratio;
    
    // We shift it up a bit to compensate for top padding
    const imgFormat = logoData.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
    doc.addImage(logoData, imgFormat, 10, 6, targetWidth, targetHeight, undefined, 'FAST');

    // Dynamically calculate header bottom so it doesn't overlap if the logo is tall
    headerBottomY = Math.max(55, 6 + targetHeight + 5);
  }

  // Header Info
  doc.setFontSize(22);
  doc.setTextColor(47, 60, 77); // color-secondary
  doc.text('ALBARÁN DE ENTREGA', 196, 22, { align: 'right' });
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  const albaranDisplay = albaran.albaranNumber || albaran.id.slice(-6);
  doc.text(`Nº Albarán: ALB-${albaranDisplay}`, 196, 28, { align: 'right' });
  doc.text(`Fecha: ${new Date(albaran.date).toLocaleDateString()}`, 196, 33, { align: 'right' });

  // Client Info
  let currentY = Math.max(48, headerBottomY);
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.text('Datos del Cliente:', 14, currentY);
  currentY += 6;
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  if (client.commercialName) {
    doc.setFont("helvetica", "bold");
    doc.text(`${client.commercialName}`, 14, currentY); currentY += 5;
    doc.setFont("helvetica", "normal");
    doc.text(`${client.name}`, 14, currentY); currentY += 5;
  } else {
    doc.text(`${client.name}`, 14, currentY); currentY += 5;
  }
  doc.text(`NIF: ${client.nif || '-'}`, 14, currentY); currentY += 5;
  doc.text(`Dir: ${client.address || '-'}`, 14, currentY); currentY += 5;
  const cpCity = [client.postalCode, client.city].filter(Boolean).join(' ');
  const prov = client.province ? `(${client.province})` : '';
  const fullLoc = [cpCity, prov].filter(Boolean).join(' ').trim();
  if (fullLoc) {
    doc.text(`Pobl: ${fullLoc}`, 14, currentY); currentY += 5;
  }
  doc.text(`Tlf: ${client.phone || '-'}`, 14, currentY); currentY += 5;

  if (albaran.deliveredTo) {
    currentY += 4;
    doc.setFontSize(11);
    doc.setTextColor(44, 140, 50); // green
    doc.setFont("helvetica", "bold");
    doc.text(`Entregado a: ${albaran.deliveredTo}`, 14, currentY);
    doc.setFont("helvetica", "normal");
  }

  // Table
  const tableColumn = ["Producto", "Cantidad", "Precio Unit.", "Descuento", "Total Línea"];
  const tableRows = [];

  albaran.items.forEach(item => {
    const lineTotal = (item.price * item.quantity) * (1 - item.discount / 100);
    const row = [
      item.name,
      item.quantity,
      `${item.price.toFixed(2)} €`,
      `${item.discount}%`,
      `${lineTotal.toFixed(2)} €`
    ];
    tableRows.push(row);
  });

  currentY += 6; // Add space before table

  autoTable(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: currentY,
    theme: 'grid',
    headStyles: { fillColor: [61, 184, 70] }, // color-primary
  });

  // Total
  const finalY = doc.lastAutoTable.finalY || currentY;
  doc.setFontSize(14);
  doc.setTextColor(44, 140, 50); // primary-dark
  doc.text(`Total Albarán: ${albaran.total.toFixed(2)} €`, 196, finalY + 15, { align: 'right' });

  // Signature
  if (albaran.signature) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.setFont("helvetica", "bold");
    doc.text("Firma de Conformidad:", 14, finalY + 25);
    try {
      const isJpeg = albaran.signature.startsWith('/9j/') || albaran.signature.startsWith('data:image/jpeg');
      const mimeType = isJpeg ? 'image/jpeg' : 'image/png';
      const format = isJpeg ? 'JPEG' : 'PNG';
      
      const sigImg = albaran.signature.startsWith('data:image') ? albaran.signature : `data:${mimeType};base64,${albaran.signature}`;
      doc.addImage(sigImg, format, 14, finalY + 28, 55, 25);
    } catch (e) {
      console.warn("Could not render signature on PDF", e);
    }
  }

  return doc;
};

export const generateDeliveryNotePDF = async (albaran, client) => {
  const doc = await buildDeliveryNoteDoc(albaran, client);
  const albaranDisplay = albaran.albaranNumber || albaran.id.slice(-6);
  doc.save(`Albaran_${albaranDisplay}_${client.name}.pdf`);
};

export const generateDeliveryNoteBlob = async (albaran, client) => {
  const doc = await buildDeliveryNoteDoc(albaran, client);
  return doc.output('blob');
};

const buildInvoiceDoc = async (invoice, client, deliveryNotes) => {
  const doc = new jsPDF();
  const pageBottom = doc.internal.pageSize.getHeight() - 20;
  const ensureVerticalSpace = (currentY, requiredHeight, showContinuation = false) => {
    if (currentY + requiredHeight <= pageBottom) return currentY;
    if (showContinuation) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text('-- sigue --', doc.internal.pageSize.getWidth() / 2, pageBottom + 8, { align: 'center' });
    }
    doc.addPage();
    return 20;
  };
  const logoData = await getLogoBase64();
  const defaultCompanyProfile = {
    fiscalName: 'GREENCODE',
    ownerName: 'ANTONIO JOSÉ GÓMEZ LÓPEZ',
    nif: '48351348N',
    address: 'CALLE SANTA FAZ 41',
    postalCode: '',
    city: 'ASPE',
    province: 'ALICANTE',
    bankAccount: ''
  };
  const companyProfile = { ...defaultCompanyProfile, ...(JSON.parse(localStorage.getItem('crm_company_profile') || '{}')) };

  let currentY = 15;

  // Header: Logo on Left
  if (logoData) {
    const props = doc.getImageProperties(logoData);
    const ratio = props.width / props.height;
    const targetWidth = 60; 
    const targetHeight = targetWidth / ratio;
    const imgFormat = logoData.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
    doc.addImage(logoData, imgFormat, 14, currentY, targetWidth, targetHeight, undefined, 'FAST');
    currentY += Math.max(targetHeight + 5, 25);
  } else {
    currentY += 20;
  }

  // FACTURA or RESUMEN title
  doc.setFontSize(28);
  doc.setTextColor(47, 60, 77);
  doc.text(invoice.type === 'SUMMARY' ? 'ALBARANES' : 'FACTURA', 196, 25, { align: 'right' });

  // Two columns: Company Profile (Left) and Client Profile / Invoice Info (Right)
  let colLeftY = currentY;
  let colRightY = currentY;

  // --- Left Column: COMPANY ---
  doc.setFontSize(11);
  doc.setTextColor(0);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  
  if (invoice.type !== 'SUMMARY') {
    doc.text(`${companyProfile.fiscalName || 'GREENCODE'}`, 14, colLeftY); colLeftY += 5;
    doc.setFont("helvetica", "normal");
    if (companyProfile.ownerName) { doc.text(`${companyProfile.ownerName}`, 14, colLeftY); colLeftY += 5; }
    if (companyProfile.nif) { doc.text(`NIF/CIF: ${companyProfile.nif}`, 14, colLeftY); colLeftY += 5; }
    if (companyProfile.address) { doc.text(`${companyProfile.address}`, 14, colLeftY); colLeftY += 5; }
    const cpCityCompany = [companyProfile.postalCode, companyProfile.city].filter(Boolean).join(' ');
    const provCompany = companyProfile.province ? `(${companyProfile.province})` : '';
    const fullLocCompany = [cpCityCompany, provCompany].filter(Boolean).join(' ').trim();
    if (fullLocCompany) { doc.text(`${fullLocCompany}`, 14, colLeftY); colLeftY += 5; }
  }


  // --- Right Column: INVOICE & CLIENT INFO ---
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(invoice.type === 'SUMMARY' ? 'Cliente:' : 'Facturar a:', 120, colRightY);
  colRightY += 5;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  if (client.commercialName) {
    doc.setFont("helvetica", "bold");
    doc.text(`${client.commercialName}`, 120, colRightY); colRightY += 5;
    doc.setFont("helvetica", "normal");
    doc.text(`${client.name}`, 120, colRightY); colRightY += 5;
  } else {
    doc.text(`${client.name}`, 120, colRightY); colRightY += 5;
  }
  doc.setFont("helvetica", "normal");
  doc.text(`NIF/CIF: ${client.nif || '-'}`, 120, colRightY); colRightY += 5;
  doc.text(`Dirección: ${client.address || '-'}`, 120, colRightY); colRightY += 5;
  const cpCityInvoice = [client.postalCode, client.city].filter(Boolean).join(' ');
  const provInvoice = client.province ? `(${client.province})` : '';
  const fullLocInvoice = [cpCityInvoice, provInvoice].filter(Boolean).join(' ').trim();
  if (fullLocInvoice) { doc.text(`Prov: ${fullLocInvoice}`, 120, colRightY); colRightY += 5; }
  doc.text(`Tlf: ${client.phone || '-'}`, 120, colRightY); colRightY += 5;

  colRightY += 5;
  doc.setFont("helvetica", "bold");
  doc.text(`Nº ${invoice.type === 'SUMMARY' ? 'Resumen' : 'Factura'}: ${invoice.invoiceNumber}`, 120, colRightY); colRightY += 5;
  doc.text(`Fecha: ${new Date(invoice.date).toLocaleDateString()}`, 120, colRightY); colRightY += 5;

  if (invoice.paymentMethod) {
    colRightY += 2;
    doc.setTextColor(61, 184, 70);
    doc.text(`Forma de Pago: ${invoice.paymentMethod}`, 120, colRightY); colRightY += 5;
    if (invoice.paymentMethod === 'Transferencia' && companyProfile.bankAccount) {
      doc.setTextColor(0);
      doc.setFontSize(9);
      doc.text(`IBAN: ${companyProfile.bankAccount}`, 120, colRightY); colRightY += 5;
      doc.setFontSize(10);
    }
    doc.setTextColor(0);
  }

  currentY = Math.max(colLeftY, colRightY) + 15;

  // We loop over all delivery notes included in this invoice
  currentY += 6;

  deliveryNotes.forEach((dn) => {
    currentY = ensureVerticalSpace(currentY, 20);
    doc.setFontSize(11);
    doc.setTextColor(0);
    const albaranDisplay = dn.albaranNumber || dn.id.slice(-6);
    doc.text(`Albarán Ref: ALB-${albaranDisplay} - Fecha: ${new Date(dn.date).toLocaleDateString()}`, 14, currentY);
    
    const tableColumn = ["Producto", "Cantidad", "Precio Unit.", "Descuento", "Total Línea"];
    const tableRows = [];

    dn.items.forEach(item => {
      const lineTotal = (item.price * item.quantity) * (1 - item.discount / 100);
      tableRows.push([
        item.name,
        item.quantity,
        `${item.price.toFixed(2)} €`,
        `${item.discount}%`,
        `${lineTotal.toFixed(2)} €`
      ]);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: currentY + 5,
      theme: 'grid',
      headStyles: { fillColor: [47, 60, 77] }, // secondary color for invoice table header
      margin: { bottom: 20 }
    });

    currentY = doc.lastAutoTable.finalY + 15;
  });

  // Render Subtotal, IVA, and Total Block
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(0);

  // Fallbacks for legacy invoices
  const subtotal = invoice.subtotal !== undefined ? invoice.subtotal : invoice.total;
  const ivaPercentage = invoice.ivaPercentage !== undefined ? invoice.ivaPercentage : 0;
  const ivaAmount = subtotal * (ivaPercentage / 100);
  const finalTotal = invoice.total;

  // Keep the complete totals block together. Without this check, long invoices
  // could render the VAT and total below the printable area of the last page.
  currentY = ensureVerticalSpace(currentY, invoice.type === 'SUMMARY' ? 12 : 28, true);

  if (invoice.type !== 'SUMMARY') {
    doc.text(`SUBTOTAL:`, 160, currentY, { align: 'right' }); 
    doc.text(`${subtotal.toFixed(2)} €`, 196, currentY, { align: 'right' });
    currentY += 6;
    
    doc.setFont("helvetica", "normal");
    if (ivaPercentage === 0) {
      doc.text(`IVA (0%):`, 160, currentY, { align: 'right' });
    } else {
      doc.text(`IVA (${ivaPercentage}%):`, 160, currentY, { align: 'right' });
    }
    doc.text(`${ivaAmount.toFixed(2)} €`, 196, currentY, { align: 'right' });
    currentY += 8;
  }

  // Final Total Banner
  // Removing background rect for a cleaner cohesive look
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(0); // Black color
  doc.text(`TOTAL ${invoice.type === 'SUMMARY' ? 'RESUMEN' : 'FACTURA'}:`, 160, currentY + 3, { align: 'right' });
  doc.text(`${finalTotal.toFixed(2)} €`, 196, currentY + 3, { align: 'right' });

  return doc;
};

export const generateInvoicePDF = async (invoice, client, deliveryNotes) => {
  const doc = await buildInvoiceDoc(invoice, client, deliveryNotes);
  const prefix = invoice.type === 'SUMMARY' ? 'Resumen' : 'Factura';
  doc.save(`${prefix}_${invoice.invoiceNumber}_${client.name}.pdf`);
};

export const generateInvoiceBlob = async (invoice, client, deliveryNotes) => {
  const doc = await buildInvoiceDoc(invoice, client, deliveryNotes);
  return doc.output('blob');
};
*/

const PDF_COLORS = {
  green: [47, 143, 80],
  dark: [41, 68, 56],
  muted: [102, 118, 110],
  light: [243, 247, 244],
  lighter: [247, 250, 248],
  border: [215, 225, 218],
  soft: [131, 174, 145],
  white: [255, 255, 255]
};

const DEFAULT_COMPANY_PROFILE = {
  fiscalName: 'GREENCODE',
  ownerName: 'ANTONIO JOSÉ GÓMEZ LÓPEZ',
  nif: '48351348N',
  address: 'CALLE SANTA FAZ 41',
  postalCode: '',
  city: 'ASPE',
  province: 'ALICANTE',
  bankAccount: ''
};

const getCompanyProfile = () => ({
  ...DEFAULT_COMPANY_PROFILE,
  ...(JSON.parse(localStorage.getItem('crm_company_profile') || '{}'))
});

const formatMoney = (value) => `${Number(value || 0).toLocaleString('es-ES', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})} €`;

const formatDate = (value) => new Date(value).toLocaleDateString('es-ES');

const documentNumber = (value, prefix) => {
  const number = String(value || '').trim();
  return number.startsWith(prefix) ? number : `${prefix}${number}`;
};

const addImageWithRatio = (doc, image, x, y, maxWidth, maxHeight) => {
  if (!image) return;
  const props = doc.getImageProperties(image);
  const scale = Math.min(maxWidth / props.width, maxHeight / props.height);
  const width = props.width * scale;
  const height = props.height * scale;
  const format = image.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
  doc.addImage(image, format, x, y + (maxHeight - height) / 2, width, height, undefined, 'FAST');
};

const drawTopHeader = (doc, logoData, { title, number, date }) => {
  doc.setFillColor(...PDF_COLORS.soft);
  doc.rect(0, 0, 210, 0.8, 'F');
  addImageWithRatio(doc, logoData, 14, 12, 76, 29);

  doc.setFillColor(...PDF_COLORS.light);
  doc.roundedRect(116, 16, 79, 28, 3, 3, 'F');
  doc.setFillColor(...PDF_COLORS.soft);
  doc.rect(116, 18, 1, 24, 'F');
  doc.setTextColor(...PDF_COLORS.dark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(title.length > 18 ? 9 : 10);
  doc.text(title, 124, 23);
  doc.setTextColor(...PDF_COLORS.green);
  doc.setFontSize(number.length > 14 ? 14 : 16);
  doc.text(number, 124, 32);
  doc.setTextColor(...PDF_COLORS.muted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(title === 'ALBARÁN DE ENTREGA' ? 'Fecha de entrega' : 'Fecha de emisión', 124, 39);
  doc.setTextColor(...PDF_COLORS.dark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(formatDate(date), 190, 39, { align: 'right' });
  doc.setDrawColor(...PDF_COLORS.border);
  doc.line(14, 51, 196, 51);
};

const drawContinuationHeader = (doc, label, clientName) => {
  doc.setFillColor(...PDF_COLORS.soft);
  doc.rect(0, 0, 210, 0.8, 'F');
  doc.setTextColor(...PDF_COLORS.dark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(label, 14, 18);
  doc.setTextColor(...PDF_COLORS.muted);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.text(clientName || 'Continuación', 196, 18, { align: 'right' });
  doc.setDrawColor(...PDF_COLORS.border);
  doc.line(14, 23, 196, 23);
};

const drawFooter = (doc) => {
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...PDF_COLORS.border);
    doc.line(14, 282, 196, 282);
    doc.setTextColor(...PDF_COLORS.muted);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('GREENCODE', 14, 287);
    doc.setFont('helvetica', 'italic');
    doc.text('Tu código verde', 35, 287);
    doc.text(`Página ${page} de ${pages}`, 196, 287, { align: 'right' });
  }
};

const drawClientCard = (doc, client, y, invoiceDocument = false) => {
  const x = invoiceDocument ? 111 : 14;
  const width = invoiceDocument ? 85 : 182;
  doc.setFillColor(...PDF_COLORS.lighter);
  doc.roundedRect(x, y, width, 43, 3, 3, 'F');
  doc.setTextColor(...PDF_COLORS.dark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('CLIENTE', x + 7, y + 8);
  const lines = [];
  if (invoiceDocument) {
    if (client.commercialName) lines.push(client.commercialName, client.name);
    else lines.push(client.name);
    if (client.nif) lines.push(`NIF/CIF: ${client.nif}`);
  } else {
    lines.push(client.commercialName || client.name);
  }
  if (client.address) lines.push(client.address);
  const location = [client.postalCode, client.city, client.province].filter(Boolean).join(' ');
  if (location) lines.push(location);
  doc.setFontSize(9);
  lines.slice(0, 5).forEach((line, index) => {
    doc.setFont('helvetica', index === 0 ? 'bold' : 'normal');
    doc.text(String(line), x + 7, y + 17 + index * 5, { maxWidth: width - 14 });
  });
};

const drawCompanyCard = (doc, profile, y) => {
  doc.setFillColor(...PDF_COLORS.lighter);
  doc.roundedRect(14, y, 91, 43, 3, 3, 'F');
  doc.setTextColor(...PDF_COLORS.dark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('DATOS FISCALES', 21, y + 8);
  const lines = [
    profile.fiscalName || 'GREENCODE',
    profile.ownerName,
    profile.nif ? `NIF/CIF: ${profile.nif}` : '',
    profile.address,
    [profile.postalCode, profile.city, profile.province].filter(Boolean).join(' ')
  ].filter(Boolean);
  lines.slice(0, 5).forEach((line, index) => {
    doc.setFont('helvetica', index === 0 ? 'bold' : 'normal');
    doc.text(String(line), 21, y + 17 + index * 5, { maxWidth: 77 });
  });
};

const deliveryRows = (note) => (note.items || []).map((item) => {
  const discount = Number(item.discount || 0);
  const total = Number(item.price || 0) * Number(item.quantity || 0) * (1 - discount / 100);
  return [item.name, item.quantity, formatMoney(item.price), `${discount}%`, formatMoney(total)];
});

const drawItemsTable = (doc, note, y) => {
  autoTable(doc, {
    head: [['Producto', 'Cantidad', 'Precio unit.', 'Dto.', 'Total']],
    body: deliveryRows(note),
    startY: y,
    theme: 'grid',
    margin: { left: 14, right: 14, bottom: 22 },
    tableWidth: 182,
    styles: { font: 'helvetica', fontSize: 8.2, cellPadding: 2.2, textColor: PDF_COLORS.muted, lineColor: PDF_COLORS.border, lineWidth: 0.25 },
    headStyles: { fillColor: PDF_COLORS.dark, textColor: PDF_COLORS.white, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 63 }, 1: { cellWidth: 25, halign: 'right' },
      2: { cellWidth: 34, halign: 'right' }, 3: { cellWidth: 25, halign: 'right' },
      4: { cellWidth: 35, halign: 'right' }
    }
  });
  return doc.lastAutoTable.finalY;
};

const addContinuationPage = (doc, label, clientName, showMarker = true) => {
  if (showMarker) {
    doc.setTextColor(...PDF_COLORS.muted);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.text('Continúa en la página siguiente  >', 105, 275, { align: 'center' });
  }
  doc.addPage();
  drawContinuationHeader(doc, label, clientName);
  return 37;
};

const buildDeliveryNoteDoc = async (note, client) => {
  const doc = new jsPDF();
  const logoData = await getLogoBase64();
  const displayNumber = documentNumber(note.albaranNumber || note.id.slice(-6), 'ALB-');
  drawTopHeader(doc, logoData, { title: 'ALBARÁN DE ENTREGA', number: displayNumber, date: note.date });
  drawClientCard(doc, client, 58, false);

  doc.setTextColor(...PDF_COLORS.dark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('DETALLE DE LA ENTREGA', 14, 120);
  let y = drawItemsTable(doc, note, 125) + 8;

  const closingHeight = 63;
  if (y + closingHeight > 274) y = addContinuationPage(doc, `ALBARÁN ${displayNumber}`, 'Continuación');
  doc.setFillColor(...PDF_COLORS.light);
  doc.roundedRect(128, y, 68, 18, 3, 3, 'F');
  doc.setTextColor(...PDF_COLORS.dark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('TOTAL ALBARÁN', 135, y + 10);
  doc.setTextColor(...PDF_COLORS.green);
  doc.setFontSize(14);
  doc.text(formatMoney(note.total), 189, y + 11, { align: 'right' });
  y += 27;

  if (note.deliveredTo || note.signature) {
    doc.setFillColor(...PDF_COLORS.light);
    doc.roundedRect(14, y, 182, 33, 3, 3, 'F');
    doc.setTextColor(...PDF_COLORS.dark);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('ENTREGA', 21, y + 9);
    doc.setFont('helvetica', 'normal');
    if (note.deliveredTo) doc.text(`Entregado a: ${note.deliveredTo}`, 21, y + 20);
    if (note.signature) {
      doc.setFont('helvetica', 'bold');
      doc.text('FIRMA DE CONFORMIDAD', 132, y + 9);
      try {
        const isJpeg = note.signature.startsWith('/9j/') || note.signature.startsWith('data:image/jpeg');
        const format = isJpeg ? 'JPEG' : 'PNG';
        const image = note.signature.startsWith('data:image') ? note.signature : `data:image/${isJpeg ? 'jpeg' : 'png'};base64,${note.signature}`;
        doc.addImage(image, format, 137, y + 11, 44, 18, undefined, 'FAST');
      } catch (error) {
        console.warn('Could not render signature on PDF', error);
      }
    }
  }
  drawFooter(doc);
  return doc;
};

const drawNoteSection = (doc, note, y, continuationLabel, clientName, reserveAfter = 0) => {
  const estimatedHeight = 10 + (deliveryRows(note).length + 1) * 8;
  if (y + estimatedHeight + reserveAfter > 270) y = addContinuationPage(doc, continuationLabel, clientName);
  const number = documentNumber(note.albaranNumber || note.id.slice(-6), 'ALB-');
  doc.setTextColor(...PDF_COLORS.dark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(`Albarán ${number}`, 14, y);
  doc.setTextColor(...PDF_COLORS.muted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(formatDate(note.date), 196, y, { align: 'right' });
  return drawItemsTable(doc, note, y + 4) + 8;
};

const buildInvoiceDoc = async (invoice, client, deliveryNotes) => {
  const doc = new jsPDF();
  const logoData = await getLogoBase64();
  const profile = getCompanyProfile();
  const isSummary = invoice.type === 'SUMMARY';
  const title = isSummary ? 'RESUMEN DE ALBARANES' : 'FACTURA';
  const number = invoice.invoiceNumber;
  drawTopHeader(doc, logoData, { title, number, date: invoice.date });

  if (isSummary) {
    drawClientCard(doc, client, 58, false);
  } else {
    drawCompanyCard(doc, profile, 58);
    drawClientCard(doc, client, 58, true);
  }

  let y = 116;
  const continuationLabel = `${isSummary ? 'RESUMEN' : 'FACTURA'} ${number}`;
  const notes = deliveryNotes || [];
  const totalsHeight = isSummary ? 27 : 47;
  notes.forEach((note, index) => {
    const keepWithTotals = index === notes.length - 1 ? totalsHeight : 0;
    y = drawNoteSection(doc, note, y, continuationLabel, client.commercialName || client.name, keepWithTotals);
  });

  if (y + totalsHeight > 270) y = addContinuationPage(doc, continuationLabel, client.commercialName || client.name);
  const totalX = isSummary ? 112 : 112;
  if (invoice.paymentMethod) {
    doc.setFillColor(...PDF_COLORS.light);
    doc.roundedRect(14, y, 86, isSummary ? 18 : 34, 3, 3, 'F');
    doc.setTextColor(...PDF_COLORS.dark);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('FORMA DE PAGO', 21, y + 10);
    doc.setFont('helvetica', 'normal');
    doc.text(invoice.paymentMethod, 52, y + 10);
    if (!isSummary && invoice.paymentMethod === 'Transferencia' && profile.bankAccount) {
      doc.setFontSize(8.5);
      doc.text(`IBAN: ${profile.bankAccount}`, 21, y + 21, { maxWidth: 72 });
    }
  }

  if (isSummary) {
    doc.setFillColor(...PDF_COLORS.light);
    doc.roundedRect(totalX, y, 84, 18, 3, 3, 'F');
    doc.setTextColor(...PDF_COLORS.dark);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('TOTAL RESUMEN', 119, y + 10);
    doc.setTextColor(...PDF_COLORS.green);
    doc.setFontSize(14);
    doc.text(formatMoney(invoice.total), 189, y + 11, { align: 'right' });
  } else {
    const subtotal = invoice.subtotal !== undefined ? invoice.subtotal : invoice.total;
    const vatPercent = Number(invoice.ivaPercentage || 0);
    const vat = Number(invoice.taxTotal ?? (subtotal * vatPercent / 100));
    autoTable(doc, {
      body: [
        ['Subtotal', formatMoney(subtotal)],
        [`IVA (${vatPercent}%)`, formatMoney(vat)],
        ['TOTAL FACTURA', formatMoney(invoice.total)]
      ],
      startY: y,
      margin: { left: totalX },
      tableWidth: 84,
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 3, textColor: PDF_COLORS.dark, fillColor: PDF_COLORS.light },
      columnStyles: { 0: { cellWidth: 47 }, 1: { cellWidth: 37, halign: 'right' } },
      didParseCell: (data) => {
        if (data.row.index === 2) {
          data.cell.styles.fillColor = PDF_COLORS.green;
          data.cell.styles.textColor = PDF_COLORS.white;
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 11;
        }
      }
    });
  }
  drawFooter(doc);
  return doc;
};

export const generateDeliveryNotePDF = async (albaran, client) => {
  const doc = await buildDeliveryNoteDoc(albaran, client);
  const display = albaran.albaranNumber || albaran.id.slice(-6);
  doc.save(`Albaran_${display}_${client.name}.pdf`);
};

export const generateDeliveryNoteBlob = async (albaran, client) => {
  const doc = await buildDeliveryNoteDoc(albaran, client);
  return doc.output('blob');
};

export const generateInvoicePDF = async (invoice, client, deliveryNotes) => {
  const doc = await buildInvoiceDoc(invoice, client, deliveryNotes);
  const prefix = invoice.type === 'SUMMARY' ? 'Resumen' : 'Factura';
  doc.save(`${prefix}_${invoice.invoiceNumber}_${client.name}.pdf`);
};

export const generateInvoiceBlob = async (invoice, client, deliveryNotes) => {
  const doc = await buildInvoiceDoc(invoice, client, deliveryNotes);
  return doc.output('blob');
};

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const getLogoBase64 = async () => {
  try {
    const cachedJpeg = localStorage.getItem('crm_company_logo_jpeg_v3');
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
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, targetW, targetH);
          const jpegBase64 = canvas.toDataURL('image/jpeg', 0.9);
          try { localStorage.setItem('crm_company_logo_jpeg_v3', jpegBase64); } catch(e) {}
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

  deliveryNotes.forEach((dn, index) => {
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

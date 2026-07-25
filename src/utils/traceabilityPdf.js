import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getLogoBase64 } from './pdf';

const C = {
  ink: [15, 23, 42], green: [6, 78, 59], emerald: [5, 150, 105],
  pale: [236, 253, 245], slate: [71, 85, 105], line: [203, 213, 225],
  amber: [217, 119, 6], blue: [2, 132, 199], violet: [124, 58, 237]
};

const clean = value => String(value ?? '').trim() || 'Sin dato';
const formatDate = value => {
  if (!value) return 'Sin fecha';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(value))
    ? new Date(`${value}T12:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? 'Sin fecha'
    : date.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
};

const addHeader = (doc, logo, reportId, emittedAt) => {
  const width = doc.internal.pageSize.getWidth();
  doc.setFillColor(...C.green); doc.rect(0, 0, width, 34, 'F');
  doc.setFillColor(...C.emerald); doc.rect(0, 34, width, 2, 'F');
  if (logo) {
    const props = doc.getImageProperties(logo);
    const logoWidth = 50;
    const logoHeight = Math.min(25, logoWidth / (props.width / props.height));
    doc.addImage(logo, logo.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG',
      12, Math.max(4, (34 - logoHeight) / 2), logoWidth, logoHeight, undefined, 'FAST');
  } else {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(255, 255, 255);
    doc.text('GREENCODE', 14, 20);
  }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(255, 255, 255);
  doc.text('INFORME DE TRAZABILIDAD DE PRODUCTO', width - 12, 15, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(209, 250, 229);
  doc.text(`Informe ${reportId}  |  Emitido: ${emittedAt}`, width - 12, 23, { align: 'right' });
  doc.text('Cadena documental: origen, producción, cosecha y venta', width - 12, 29, { align: 'right' });
};

const addFooters = doc => {
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...C.line); doc.line(12, height - 10, width - 12, height - 10);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...C.slate);
    doc.text('GreenCode CRM - Documento generado electrónicamente', 12, height - 5);
    doc.text(`Página ${page} de ${pages}`, width - 12, height - 5, { align: 'right' });
  }
};

const drawFlow = (doc, y, counts) => {
  const width = doc.internal.pageSize.getWidth(), margin = 12, gap = 9;
  const boxWidth = (width - margin * 2 - gap * 3) / 4;
  const stages = [
    ['01', 'ORIGEN', `${counts.lots} lote${counts.lots === 1 ? '' : 's'} de semilla`, C.amber],
    ['02', 'PRODUCCIÓN', `${counts.crops} cultivo${counts.crops === 1 ? '' : 's'}`, C.emerald],
    ['03', 'COSECHA', `${counts.harvests} lote${counts.harvests === 1 ? '' : 's'} de venta`, C.blue],
    ['04', 'VENTA', `${counts.sales} entrega${counts.sales === 1 ? '' : 's'}`, C.violet]
  ];
  stages.forEach(([step, title, detail, color], index) => {
    const x = margin + index * (boxWidth + gap);
    doc.setFillColor(248, 250, 252); doc.setDrawColor(...color);
    doc.roundedRect(x, y, boxWidth, 18, 2.5, 2.5, 'FD');
    doc.setFillColor(...color); doc.circle(x + 7, y + 9, 4, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(255, 255, 255);
    doc.text(step, x + 7, y + 11, { align: 'center' });
    doc.setTextColor(...C.ink); doc.setFontSize(8.5); doc.text(title, x + 14, y + 7.5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...C.slate);
    doc.text(detail, x + 14, y + 13);
    if (index < 3) {
      doc.setDrawColor(...C.emerald); doc.setLineWidth(.7);
      doc.line(x + boxWidth + 1.5, y + 9, x + boxWidth + gap - 1.5, y + 9);
      doc.line(x + boxWidth + gap - 4, y + 6.5, x + boxWidth + gap - 1.5, y + 9);
      doc.line(x + boxWidth + gap - 4, y + 11.5, x + boxWidth + gap - 1.5, y + 9);
    }
  });
};

const section = (doc, title, subtitle, y, color) => {
  doc.setFillColor(...color); doc.roundedRect(12, y, 4, 9, 1, 1, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...C.ink);
  doc.text(title, 20, y + 4);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.slate);
  doc.text(subtitle, 20, y + 8);
  return y + 12;
};

const dataTable = (doc, startY, head, body, color) => {
  autoTable(doc, {
    startY, head: [head], body: body.length ? body : [head.map(() => 'Sin datos vinculados')],
    theme: 'grid', margin: { left: 12, right: 12, bottom: 14 },
    styles: { font: 'helvetica', fontSize: 7.2, cellPadding: 2.2, textColor: C.ink, lineColor: C.line, lineWidth: .15 },
    headStyles: { fillColor: color, textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] }
  });
  return doc.lastAutoTable.finalY;
};

export async function downloadTraceabilityPdf({ selection, trace, indexes, deliveryNotes, environmentalStats }) {
  if (!selection || !trace) return;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const logo = await getLogoBase64();
  const emitted = new Date();
  const emittedAt = emitted.toLocaleString('es-ES', { dateStyle: 'full', timeStyle: 'medium' });
  const reportId = `TRZ-${emitted.getFullYear()}-${String(emitted.getMonth() + 1).padStart(2, '0')}${String(emitted.getDate()).padStart(2, '0')}-${String(emitted.getHours()).padStart(2, '0')}${String(emitted.getMinutes()).padStart(2, '0')}`;
  addHeader(doc, logo, reportId, emittedAt);

  doc.setFillColor(...C.pale); doc.roundedRect(12, 42, 273, 20, 3, 3, 'F');
  doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.green); doc.setFontSize(8);
  doc.text(`CONSULTA: ${clean(selection.label).toUpperCase()}`, 18, 49);
  doc.setFontSize(15); doc.text(clean(selection.title), 18, 56);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...C.slate);
  doc.text(clean(selection.subtitle), 18, 60);
  const complete = [trace.relatedLots.length, trace.relatedCrops.length, trace.relatedHarvests.length, trace.relatedOrders.length].filter(Boolean).length;
  doc.setFillColor(...C.green); doc.roundedRect(245, 46, 32, 12, 2.5, 2.5, 'F');
  doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255); doc.setFontSize(13);
  doc.text(`${Math.round(complete / 4 * 100)}%`, 261, 52, { align: 'center' });
  doc.setFontSize(5.8); doc.text('CADENA LOCALIZADA', 261, 56, { align: 'center' });

  drawFlow(doc, 68, { lots: trace.relatedLots.length, crops: trace.relatedCrops.length, harvests: trace.relatedHarvests.length, sales: trace.relatedOrders.length });
  let y = section(doc, 'Origen de materias primas', 'Lotes de semilla y documentos de entrada vinculados', 92, C.amber);
  y = dataTable(doc, y, ['Semilla', 'Lote proveedor', 'Proveedor', 'Entrada en almacén', 'Albarán proveedor'],
    trace.relatedLots.map(lot => {
      const article = indexes.articles.get(String(lot.articleId));
      const provider = indexes.providers.get(String(lot.providerId));
      const line = indexes.noteLines.get(String(lot.deliveryNoteLineId));
      const note = line && indexes.purchaseNotes.get(String(line.deliveryNoteId));
      return [clean(article?.name), clean(lot.supplierBatch), clean(provider?.name), formatDate(lot.receivedAt || note?.date), clean(note?.number)];
    }), C.amber);
  y = section(doc, 'Siembra y producción', 'Desglose agronómico de las variedades utilizadas', y + 5, C.emerald);
  y = dataTable(doc, y, ['Variedad', 'Lote de cultivo', 'Fecha de plantado', 'Semilla utilizada', 'Bandejas empleadas', 'Lote semilla'],
    trace.relatedCrops.map(crop => {
      const cropType = indexes.cropTypes.get(String(crop.cropTypeId));
      const trays = trace.relatedHarvests.reduce((sum, harvest) => sum + Number(harvest.selectedCropUsages?.[crop.id] || 0), 0);
      return [clean(cropType?.name), clean(crop.cultivationBatchNumber || crop.batchNumber), formatDate(crop.datePlanted), `${clean(crop.seedQuantityUsed ?? 0)} g`, clean(trays || crop.traysCount || 0), clean(crop.seedSupplierBatch)];
    }), C.emerald);

  if (y > 150) { doc.addPage(); addHeader(doc, logo, reportId, emittedAt); y = 43; } else y += 5;
  y = section(doc, 'Cosecha y lote de venta', 'Producto terminado resultante de los cultivos anteriores', y, C.blue);
  y = dataTable(doc, y, ['Producto de venta', 'Lote de venta', 'Fecha de producción', 'Unidades producidas', 'Variedades'],
    trace.relatedHarvests.map(harvest => {
      const product = indexes.products.get(String(harvest.productId));
      return [clean(product?.name), clean(harvest.batchNumber), formatDate(harvest.harvestDate), `${clean(harvest.tuppersCount)} unidades`, clean((harvest.selectedCropIds || []).length)];
    }), C.blue);
  y = section(doc, 'Venta y entrega', 'Destino comercial documentado una vez concluida la expedición', y + 5, C.violet);
  y = dataTable(doc, y, ['Cliente', 'Albarán de venta', 'Fecha de entrega', 'Producto / lote', 'Estado'],
    trace.relatedOrders.map(order => {
      const client = indexes.clients.get(String(order.clientId));
      const note = (deliveryNotes || []).find(item => String(item.orderId) === String(order.id));
      return [clean(client?.commercialName || client?.name || order.clientName), clean(note?.deliveryNoteNumber || note?.albaranNumber), formatDate(note?.date || order.date), clean(trace.relatedHarvests.map(h => h.batchNumber).join(', ')), 'ENTREGA CONCLUIDA'];
    }), C.violet);
  const temp = environmentalStats.temperature, humidity = environmentalStats.humidity;
  y = section(doc, 'Control ambiental del periodo', 'Lecturas registradas entre la siembra y la cosecha', y + 5, C.ink);
  dataTable(doc, y, ['Controles', 'Temperatura media', 'Rango de temperatura', 'Humedad media', 'Rango de humedad'], [[
    clean(trace.environmental.length), temp ? `${temp.avg.toFixed(1)} °C` : 'Sin registros',
    temp ? `${temp.min}-${temp.max} °C` : 'Sin registros', humidity ? `${humidity.avg.toFixed(1)} %` : 'Sin registros',
    humidity ? `${humidity.min}-${humidity.max} %` : 'Sin registros'
  ]], C.ink);
  addFooters(doc);
  const safeName = clean(selection.title).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '');
  doc.save(`Trazabilidad-GreenCode-${safeName || reportId}.pdf`);
}

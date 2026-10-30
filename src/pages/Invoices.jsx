import Swal from 'sweetalert2';
import JSZip from 'jszip';
import { useMemo, useState } from 'react';
import { Banknote, CalendarClock, CheckCircle2, CircleAlert, Pencil, Search, UsersRound, WalletCards } from 'lucide-react';
import { useData } from '../context/DataContext';
import { generateInvoiceBlob, generateDeliveryNoteBlob } from '../utils/pdf';
import { supabase } from '../config/supabase';

const money = value => Number(value || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const toLocalISODate = date => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
const formatSendDate = value => new Date(value).toLocaleString('es-ES', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
}).replace(',', ' ·');
const invoiceNetAmount = invoice => {
  if (invoice.subtotal !== undefined && invoice.subtotal !== null) return Number(invoice.subtotal || 0);
  const vatRate = Number(invoice.ivaPercentage || 0) / 100;
  return vatRate > 0 ? Number(invoice.total || 0) / (1 + vatRate) : Number(invoice.total || 0);
};

const buildInvoiceEmailHtml = invoice => `
  <div style="margin:0;background:#f3f7f2;padding:28px 12px;font-family:Arial,Helvetica,sans-serif;color:#26352b">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 28px rgba(34,84,50,.12)">
      <tr>
        <td style="padding:34px 28px;text-align:center;background:#176b3a;color:#ffffff">
          <div style="font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#c9f2d5">GreenCode</div>
          <div style="margin-top:8px;font-size:30px;font-weight:700;line-height:1.15">FACTURA ADJUNTA</div>
          <div style="margin-top:10px;font-size:15px;color:#e4f7e9">Cultivamos frescura para tus platos 🌱</div>
        </td>
      </tr>
      <tr>
        <td style="padding:34px 34px 18px">
          <p style="margin:0 0 18px;font-size:17px;line-height:1.7">Hola,</p>
          <p style="margin:0 0 22px;font-size:16px;line-height:1.7">Gracias por confiar en <strong style="color:#176b3a">GreenCode</strong> y en nuestros microgreens. Seguimos cultivando sabor, color y mucha vida para cada uno de vuestros platos.</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;background:#edf8ef;border:1px solid #cfe9d5;border-radius:12px">
            <tr>
              <td style="padding:20px 22px">
                <div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#578065">Documentación adjunta</div>
                <div style="margin-top:6px;font-size:21px;font-weight:700;color:#176b3a">Factura ${invoice.invoiceNumber}</div>
                <div style="margin-top:7px;font-size:14px;line-height:1.5;color:#52705c">Incluye los albaranes correspondientes debidamente firmados.</div>
                <div style="margin-top:7px;font-size:14px;line-height:1.5;color:#315f3e"><strong>Vencimiento:</strong> ${getDueDate(invoice).toLocaleDateString('es-ES')}.</div>
              </td>
            </tr>
          </table>
          <p style="margin:0 0 10px;font-size:16px;line-height:1.7">Si tienes cualquier consulta o necesitas que revisemos algún documento, estaremos encantados de ayudarte.</p>
          <p style="margin:0;font-size:16px;line-height:1.7">Gracias por formar parte de este pequeño gran mundo verde.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:22px 34px 28px">
          <div style="border-top:1px solid #dfe9e1;padding-top:22px">
            <div style="font-size:19px;font-weight:700;color:#176b3a">Iris García</div>
            <div style="margin-top:3px;font-size:14px;color:#647269">Responsable de Administración</div>
            <div style="margin-top:10px;font-size:14px;line-height:1.6">
              <a href="mailto:administracion@mygreencode.es" style="color:#176b3a;text-decoration:none">administracion@mygreencode.es</a><br>
              Aspe · Alicante
            </div>
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 28px;text-align:center;background:#e6f3e8;color:#315f3e;font-size:13px;line-height:1.55">
          🌿 <strong>Hazlo más verde:</strong> evita imprimir este correo y sus documentos si no es necesario.
        </td>
      </tr>
      <tr>
        <td style="padding:18px 28px;background:#f8faf8;color:#7a837d;font-size:10px;line-height:1.5;text-align:center">
          <strong>Aviso de confidencialidad y protección de datos</strong><br>
          Este mensaje y sus archivos adjuntos pueden contener información confidencial dirigida exclusivamente a su destinatario. Si lo ha recibido por error, comuníquelo al remitente y elimínelo. Los datos personales serán tratados por Antonio José Gómez López, NIF 4835348N, conforme al Reglamento (UE) 2016/679 y la Ley Orgánica 3/2018. Puede ejercer sus derechos escribiendo a administracion@mygreencode.es.
        </td>
      </tr>
    </table>
  </div>`;

const getDueDate = invoice => {
  if (invoice.dueDate) return new Date(`${String(invoice.dueDate).slice(0, 10)}T00:00:00`);
  const date = new Date(invoice.date);
  const days = Number(invoice.paymentTermsDays ?? 15);
  date.setDate(date.getDate() + days);
  return date;
};

export default function Invoices() {
  const { clients, deliveryNotes, invoices, billingDrafts, addInvoice, updateInvoice, finalizeMonthlyBilling, deleteInvoice, deleteBillingDraft, markInvoiceAsPaid, refreshData } = useData();
  const [isAdding, setIsAdding] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedNotes, setSelectedNotes] = useState([]);
  const [ivaPercentage, setIvaPercentage] = useState(4);
  const [paymentMethod, setPaymentMethod] = useState('Transferencia');
  const [documentType, setDocumentType] = useState('INVOICE');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentTermsDays, setPaymentTermsDays] = useState(15);
  const [filterStatus, setFilterStatus] = useState('PENDING');
  const [filterClientId, setFilterClientId] = useState('');
  const [filterQuery, setFilterQuery] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [sendingInvoiceId, setSendingInvoiceId] = useState(null);
  const [emailReviewInvoice, setEmailReviewInvoice] = useState(null);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailNoteIds, setEmailNoteIds] = useState([]);
  const [activeDraftId, setActiveDraftId] = useState(null);
  const [editingInvoiceId, setEditingInvoiceId] = useState(null);
  const [runningMonthlyBilling, setRunningMonthlyBilling] = useState(false);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState([]);
  const [downloadingInvoices, setDownloadingInvoices] = useState(false);

  const editingInvoice = invoices.find(invoice => invoice.id === editingInvoiceId);
  const clientUnbilledNotes = deliveryNotes.filter(dn =>
    dn.clientId === selectedClientId && (
      dn.status === 'UNBILLED' || (editingInvoice?.deliveryNoteIds || []).includes(dn.id)
    )
  );
  const eligibleClients = clients.filter(client => (client.billingMode || 'INVOICE') === documentType);

  const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 };
  const modalCardStyle = { width: '100%', maxWidth: '900px', margin: '20px', maxHeight: '90vh', overflowY: 'auto', backgroundColor: '#fff', padding: '2rem', borderRadius: '8px', border: '1px solid var(--color-border)' };

  const handleSelectClient = (e) => {
    setSelectedClientId(e.target.value);
    setSelectedNotes([]); // Reset selection on client change
    const client = clients.find(c => c.id === e.target.value);
    if (client) {
      setPaymentTermsDays(Number(client.paymentTermsDays ?? 15));
      if (documentType === 'SUMMARY') {
        setPaymentMethod('Contado');
      } else {
        setPaymentMethod(client.paymentMethod || 'Transferencia');
      }
    } else {
      setPaymentMethod('Transferencia');
      setPaymentTermsDays(15);
    }
  };

  const handleDocumentTypeChange = (type) => {
    setDocumentType(type);
    setSelectedNotes([]);
    const selectedClient = clients.find(client => client.id === selectedClientId);
    if (selectedClient && (selectedClient.billingMode || 'INVOICE') !== type) setSelectedClientId('');
    if (type === 'SUMMARY') {
      setPaymentMethod('Contado');
    } else {
      const client = clients.find(c => c.id === selectedClientId);
      setPaymentMethod(client ? (client.paymentMethod || 'Transferencia') : 'Transferencia');
    }
  };

  const openBillingDraft = draft => {
    const client = clients.find(item => item.id === draft.clientId);
    const type = draft.billingMode || client?.billingMode || 'INVOICE';
    setActiveDraftId(draft.id);
    setDocumentType(type);
    setSelectedClientId(draft.clientId);
    setSelectedNotes((draft.deliveryNoteIds || []).filter(noteId =>
      deliveryNotes.some(note => note.id === noteId && note.status === 'UNBILLED')
    ));
    setInvoiceDate(toLocalISODate(new Date()));
    setPaymentTermsDays(Number(client?.paymentTermsDays ?? 15));
    setPaymentMethod(type === 'SUMMARY' ? 'Contado' : (client?.paymentMethod || 'Transferencia'));
    setIvaPercentage(4);
    setIsAdding(true);
  };

  const openInvoiceEditor = async invoice => {
    const hasBeenSent = invoice.emailStatus === 'SENT' || Boolean(invoice.emailSentAt) || Boolean(invoice.emailSendHistory?.length);
    if (hasBeenSent || invoice.isPaid) {
      const warning = await Swal.fire({
        title: 'Documento ya utilizado',
        text: `${hasBeenSent ? 'Esta factura ya se envió. ' : ''}${invoice.isPaid ? 'También figura como cobrada. ' : ''}Los cambios quedarán registrados, pero no se reenviará automáticamente.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Continuar y editar',
        cancelButtonText: 'Cancelar'
      });
      if (!warning.isConfirmed) return;
    }
    setActiveDraftId(null);
    setEditingInvoiceId(invoice.id);
    setDocumentType(invoice.type === 'SUMMARY' ? 'SUMMARY' : 'INVOICE');
    setSelectedClientId(invoice.clientId);
    setSelectedNotes([...(invoice.deliveryNoteIds || [])]);
    setInvoiceDate(toLocalISODate(new Date(invoice.date)));
    setPaymentTermsDays(Number(invoice.paymentTermsDays ?? 15));
    setPaymentMethod(invoice.paymentMethod || 'Transferencia');
    setIvaPercentage(Number(invoice.ivaPercentage ?? 4));
    setIsAdding(true);
  };

  const closeInvoiceModal = () => {
    setIsAdding(false);
    setActiveDraftId(null);
    setEditingInvoiceId(null);
  };

  const handleMonthlyBilling = async () => {
    const now = new Date();
    const periodStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const invoiceDateValue = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const periodLabel = now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    const unbilledCount = deliveryNotes.filter(note => {
      const noteDate = new Date(note.date);
      return note.status === 'UNBILLED' && noteDate.getFullYear() === now.getFullYear() && noteDate.getMonth() === now.getMonth();
    }).length;

    if (!unbilledCount) {
      await Swal.fire('Nada que facturar', `No hay albaranes pendientes de ${periodLabel}.`, 'info');
      return;
    }

    const result = await Swal.fire({
      title: `Facturar ${periodLabel}`,
      html: `Se crearán las facturas y resúmenes definitivos con fecha <b>${invoiceDateValue.toLocaleDateString('es-ES')}</b>.<br><br>Hay <b>${unbilledCount} albaranes</b> pendientes este mes. Al terminar, la facturación automática no repetirá este periodo.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, hacer facturación',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#4f46e5'
    });
    if (!result.isConfirmed) return;

    setRunningMonthlyBilling(true);
    const billingResult = await finalizeMonthlyBilling(periodStart);
    setRunningMonthlyBilling(false);
    if (!billingResult) return;

    if (billingResult.alreadyProcessed) {
      await Swal.fire('Mes ya facturado', 'Este mes ya se había procesado y no se ha creado ningún duplicado.', 'info');
      return;
    }
    if (billingResult.empty) {
      await Swal.fire('Nada que facturar', 'No se ha creado ningún documento y la facturación automática sigue disponible.', 'info');
      return;
    }
    await Swal.fire('Facturación terminada', `Se han creado ${billingResult.documentCount} documentos definitivos con ${billingResult.noteCount} albaranes.`, 'success');
  };

  const handleToggleNote = (noteId) => {
    if (selectedNotes.includes(noteId)) {
      setSelectedNotes(selectedNotes.filter(id => id !== noteId));
    } else {
      setSelectedNotes([...selectedNotes, noteId]);
    }
  };

  const calculateInvoiceTotal = () => {
    return selectedNotes.reduce((sum, noteId) => {
      const note = deliveryNotes.find(dn => dn.id === noteId);
      return sum + (note ? note.total : 0);
    }, 0);
  };

  const handleDeleteInvoice = (id) => {
    Swal.fire({
      text: '¿Estás seguro de que deseas eliminar esta factura? Los albaranes asociados pasarán a estar pendientes de nuevo.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        deleteInvoice(id);
      }
    });
  };

  const handleGenerateInvoice = async () => {
    if (!selectedClientId || selectedNotes.length === 0) return;

    const client = clients.find(c => c.id === selectedClientId);
    if (!client) return;

    if (editingInvoiceId) {
      const updated = await updateInvoice(editingInvoiceId, {
        deliveryNoteIds: selectedNotes,
        date: invoiceDate,
        ivaPercentage: documentType === 'SUMMARY' ? 0 : ivaPercentage,
        paymentMethod,
        paymentTermsDays: documentType === 'SUMMARY' ? 0 : paymentTermsDays
      });
      if (!updated) return;
      closeInvoiceModal();
      await Swal.fire('Factura actualizada', 'Los cambios se han guardado y los totales se han recalculado.', 'success');
      return;
    }

    // Generate Invoice Number format: YYYY-NNNN
    const year = new Date(`${invoiceDate}T00:00:00`).getFullYear();
    
    // Find how many invoices exist globally this year of the selected type
    const typedInvoicesThisYear = invoices.filter(inv => {
       const isSameType = documentType === 'SUMMARY' ? inv.type === 'SUMMARY' : inv.type !== 'SUMMARY';
       return new Date(inv.date).getFullYear() === year && isSameType;
    });
    
    const lastSequence = typedInvoicesThisYear.reduce((max, invoice) => {
      const sequence = Number(String(invoice.invoiceNumber || '').split('-').pop());
      return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
    }, 0);
    const seqStr = String(lastSequence + 1).padStart(4, '0');
    const invoiceNumber = documentType === 'SUMMARY' ? `ALB${year}-${seqStr}` : `F${year}-${seqStr}`;

    const subtotal = calculateInvoiceTotal();
    const finalIva = documentType === 'SUMMARY' ? 0 : ivaPercentage;
    const total = subtotal + (subtotal * (finalIva / 100));

    const newInvoice = {
      invoiceNumber,
      type: documentType,
      clientId: client.id,
      deliveryNoteIds: selectedNotes,
      subtotal,
      ivaPercentage: finalIva,
      total,
      date: new Date(invoiceDate).toISOString(),
      paymentMethod,
      paymentTermsDays: documentType === 'SUMMARY' ? 0 : paymentTermsDays,
      dueDate: documentType === 'SUMMARY' ? null : (() => {
        const due = new Date(`${invoiceDate}T00:00:00`);
        due.setDate(due.getDate() + paymentTermsDays);
        return toLocalISODate(due);
      })()
    };

    // Use context to add and update status
    const createdInvoice = await addInvoice(newInvoice, selectedNotes);
    if (!createdInvoice) return;
    if (activeDraftId) await deleteBillingDraft(activeDraftId);

    setIsAdding(false);
    setSelectedClientId('');
    setSelectedNotes([]);
    setActiveDraftId(null);
  };

  const handleViewOldInvoice = async (invoice) => {
    const client = clients.find(c => c.id === invoice.clientId);
    const notesToPrint = deliveryNotes.filter(dn => invoice.deliveryNoteIds.includes(dn.id));
    if (client) {
      const blob = await generateInvoiceBlob(invoice, client, notesToPrint);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    }
  };

  const invoiceRows = useMemo(() => invoices.map(invoice => {
    const client = clients.find(item => item.id === invoice.clientId);
    const dueDate = getDueDate(invoice);
    const isOfficial = invoice.type !== 'SUMMARY';
    const isOverdue = isOfficial && invoice.isPaid !== true && dueDate.getTime() < new Date().setHours(0, 0, 0, 0);
    return { ...invoice, client, dueDate, isOverdue, isCollectible: true, isOfficial };
  }), [clients, invoices]);

  const filteredInvoices = useMemo(() => invoiceRows.filter(invoice => {
    if (filterStatus === 'PENDING' && invoice.isPaid) return false;
    if (filterStatus === 'PAID' && !invoice.isPaid) return false;
    if (filterStatus === 'OVERDUE' && !invoice.isOverdue) return false;
    if (filterClientId && invoice.clientId !== filterClientId) return false;
    const invoiceTime = new Date(invoice.date).getTime();
    if (filterStartDate && invoiceTime < new Date(`${filterStartDate}T00:00:00`).getTime()) return false;
    if (filterEndDate && invoiceTime > new Date(`${filterEndDate}T23:59:59`).getTime()) return false;
    const haystack = `${invoice.invoiceNumber || ''} ${invoice.client?.name || ''} ${invoice.client?.commercialName || ''}`.toLocaleLowerCase('es');
    if (filterQuery.trim() && !haystack.includes(filterQuery.trim().toLocaleLowerCase('es'))) return false;
    return true;
  }), [filterClientId, filterEndDate, filterQuery, filterStartDate, filterStatus, invoiceRows]);
  const filteredInvoiceTotal = useMemo(
    () => filteredInvoices.reduce((sum, invoice) => sum + invoiceNetAmount(invoice), 0),
    [filteredInvoices]
  );

  const collectionSummary = useMemo(() => invoiceRows.reduce((summary, invoice) => {
    const total = invoiceNetAmount(invoice);
    summary.invoiced += total;
    if (invoice.isPaid) summary.collected += total;
    else {
      summary.pending += total;
      summary.pendingCount += 1;
      if (invoice.isOverdue) {
        summary.overdue += total;
        summary.overdueCount += 1;
      }
    }
    return summary;
  }, { invoiced: 0, collected: 0, pending: 0, overdue: 0, pendingCount: 0, overdueCount: 0 }), [invoiceRows]);

  const debtorClients = useMemo(() => {
    const grouped = new Map();
    invoiceRows.filter(invoice => !invoice.isPaid).forEach(invoice => {
      const key = invoice.clientId || 'unknown';
      const current = grouped.get(key) || {
        id: key,
        name: invoice.client?.commercialName || invoice.client?.name || 'Cliente desconocido',
        pending: 0,
        overdue: 0,
        documents: 0,
        oldest: invoice.date
      };
      current.pending += invoiceNetAmount(invoice);
      current.documents += 1;
      if (invoice.isOverdue) current.overdue += invoiceNetAmount(invoice);
      if (new Date(invoice.date) < new Date(current.oldest)) current.oldest = invoice.date;
      grouped.set(key, current);
    });
    return Array.from(grouped.values()).sort((a, b) => b.pending - a.pending);
  }, [invoiceRows]);

  const reconciliation = useMemo(() => {
    const invoiceByNote = new Map();
    invoiceRows.forEach(invoice => (invoice.deliveryNoteIds || []).forEach(noteId => {
      const key = String(noteId);
      const current = invoiceByNote.get(key);
      if (!current || (!current.isOfficial && invoice.isOfficial)) invoiceByNote.set(key, invoice);
    }));
    return deliveryNotes.reduce((summary, note) => {
      const amount = Number(note.total || 0);
      const invoice = invoiceByNote.get(String(note.id));
      summary.sold += amount;
      if (!invoice) {
        summary.unbilled += amount;
        summary.unbilledCount += 1;
      } else if (invoice.isOfficial) {
        summary.official += amount;
        summary.officialCount += 1;
        if (invoice.isPaid) summary.officialPaid += amount;
        else summary.officialPending += amount;
      } else {
        summary.summaries += amount;
        summary.summaryCount += 1;
        if (invoice.isPaid) summary.summaryPaid += amount;
        else summary.summaryPending += amount;
      }
      return summary;
    }, {
      sold: 0, official: 0, officialPaid: 0, officialPending: 0, officialCount: 0,
      summaries: 0, summaryPaid: 0, summaryPending: 0, summaryCount: 0,
      unbilled: 0, unbilledCount: 0
    });
  }, [deliveryNotes, invoiceRows]);

  const clearFilters = () => {
    setFilterStatus('PENDING');
    setFilterClientId('');
    setFilterQuery('');
    setFilterStartDate('');
    setFilterEndDate('');
  };

  const selectVisibleOfficialInvoices = () => {
    setSelectedInvoiceIds(filteredInvoices.filter(invoice => invoice.isOfficial).map(invoice => invoice.id));
  };

  const selectCurrentQuarterInvoices = () => {
    const today = new Date();
    const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
    const start = new Date(today.getFullYear(), quarterStartMonth, 1);
    const end = new Date(today.getFullYear(), quarterStartMonth + 3, 0);
    const startValue = toLocalISODate(start);
    const endValue = toLocalISODate(end);
    setFilterStatus('ALL');
    setFilterStartDate(startValue);
    setFilterEndDate(endValue);
    setSelectedInvoiceIds(invoiceRows.filter(invoice => {
      const date = String(invoice.date || '').slice(0, 10);
      return invoice.isOfficial && date >= startValue && date <= endValue;
    }).map(invoice => invoice.id));
  };

  const downloadSelectedInvoices = async () => {
    const selected = invoiceRows.filter(invoice => invoice.isOfficial && selectedInvoiceIds.includes(invoice.id));
    if (!selected.length) return;
    setDownloadingInvoices(true);
    try {
      const zip = new JSZip();
      for (const invoice of selected) {
        const client = invoice.client || clients.find(item => item.id === invoice.clientId);
        const notes = deliveryNotes.filter(note => (invoice.deliveryNoteIds || []).includes(note.id));
        const blob = await generateInvoiceBlob(invoice, client, notes);
        const clientName = String(client?.commercialName || client?.name || 'Cliente').replace(/[\\/:*?"<>|]/g, '-');
        zip.file(`${invoice.invoiceNumber}_${clientName}.pdf`, blob);
      }
      const archive = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(archive);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Facturas_GreenCode_${toLocalISODate(new Date())}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      await Swal.fire('No se pudo preparar el ZIP', error.message || 'Revisa las facturas seleccionadas.', 'error');
    } finally {
      setDownloadingInvoices(false);
    }
  };

  const handlePaymentStatusChange = async (invoice, isPaid) => {
    const result = await Swal.fire({
      title: isPaid ? 'Confirmar cobro' : 'Reabrir factura',
      text: isPaid
        ? `Se marcará ${invoice.invoiceNumber} (${money(invoiceNetAmount(invoice))} sin IVA) como cobrada.`
        : `La factura ${invoice.invoiceNumber} volverá a figurar como pendiente.`,
      icon: isPaid ? 'question' : 'warning',
      showCancelButton: true,
      confirmButtonText: isPaid ? 'Sí, registrar cobro' : 'Sí, reabrir',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: isPaid ? '#059669' : '#d97706'
    });
    if (result.isConfirmed) await markInvoiceAsPaid(invoice.id, isPaid);
  };

  const blobToBase64 = blob => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const findInvoiceClient = invoice => clients.find(item =>
    String(item.id) === String(invoice.clientId)
    || (invoice.clientName && item.name === invoice.clientName)
    || (invoice.clientCommercialName && item.commercialName === invoice.clientCommercialName)
  );

  const openEmailReview = invoice => {
    const client = findInvoiceClient(invoice);
    setEmailReviewInvoice(invoice);
    setEmailRecipient(client?.email?.trim() || '');
    setEmailNoteIds([...(invoice.deliveryNoteIds || [])]);
  };

  const sendOfficialInvoice = async invoice => {
    if (invoice.type === 'SUMMARY') return Swal.fire('No disponible', 'Los albaranes resumen no se envían desde este control.', 'info');
    const client = findInvoiceClient(invoice);
    const recipient = emailRecipient.trim();
    if (!recipient) return Swal.fire('Falta el correo', 'Indica el correo electrónico del destinatario.', 'warning');
    const notes = deliveryNotes.filter(note => emailNoteIds.includes(note.id));
    const unsigned = notes.filter(note => !note.signature);
    if (!notes.length || unsigned.length) return Swal.fire('Documentación incompleta', unsigned.length ? `Hay ${unsigned.length} albarán(es) sin firma.` : 'La factura no tiene albaranes asociados.', 'warning');
    setSendingInvoiceId(invoice.id);
    try {
      const invoiceBlob = await generateInvoiceBlob(invoice, client, notes);
      const attachments = [{ filename: `${invoice.invoiceNumber}.pdf`, content: await blobToBase64(invoiceBlob) }];
      for (const note of notes) {
        const blob = await generateDeliveryNoteBlob(note, client);
        attachments.push({ filename: `Albaran_${note.albaranNumber || note.id.slice(-6)}.pdf`, content: await blobToBase64(blob) });
      }
      const html = buildInvoiceEmailHtml(invoice);
      const { error } = await supabase.functions.invoke('send-invoice-email', { body: { invoiceId: invoice.id, to: recipient, subject: `Factura ${invoice.invoiceNumber} · GreenCode 🌱`, html, attachments } });
      if (error) throw error;
      await refreshData({ force: true });
      setEmailReviewInvoice(null);
      await Swal.fire('Factura enviada', `Enviada correctamente a ${recipient}.`, 'success');
    } catch (error) {
      await Swal.fire('No se pudo enviar', error.message || 'Revisa la configuración SMTP.', 'error');
    } finally { setSendingInvoiceId(null); }
  };

  return (
    <div className="admin-container billing-page">
      <div className="admin-header billing-header">
        <div>
          <span>ADMINISTRACIÓN DE VENTAS</span>
          <h2>Facturación y cobros</h2>
          <p>Controla lo facturado, quién debe dinero y los albaranes pendientes. Todos los importes del panel son sin IVA.</p>
        </div>
        <button className="billing-primary-action" onClick={() => { setActiveDraftId(null); setEditingInvoiceId(null); setIsAdding(true); }}>
          + Crear factura
        </button>
      </div>

      <section className="billing-summary-rows" aria-label="Resumen de facturación sin IVA">
        <div className="billing-summary-row">
          <article className="is-total"><WalletCards /><div><span>Total facturado · sin IVA</span><strong>{money(reconciliation.official + reconciliation.summaries)}</strong><small>Facturas + albaranes resumen</small></div></article>
          <article><WalletCards /><div><span>Facturado con factura · sin IVA</span><strong>{money(reconciliation.official)}</strong><small>Facturas oficiales</small></div></article>
          <article className="is-purple"><CalendarClock /><div><span>Facturado con albarán · sin IVA</span><strong>{money(reconciliation.summaries)}</strong><small>Albaranes resumen</small></div></article>
        </div>
        <div className="billing-summary-row">
          <article className="is-total-pending"><CircleAlert /><div><span>Total pendiente de cobro · sin IVA</span><strong>{money(reconciliation.officialPending + reconciliation.summaryPending)}</strong><small>Facturas + albaranes resumen</small></div></article>
          <article className="is-warning"><Banknote /><div><span>Pendiente en facturas · sin IVA</span><strong>{money(reconciliation.officialPending)}</strong><small>Facturas oficiales sin cobrar</small></div></article>
          <article className="is-warning"><Banknote /><div><span>Pendiente en albaranes · sin IVA</span><strong>{money(reconciliation.summaryPending)}</strong><small>Albaranes resumen sin cobrar</small></div></article>
        </div>
        <article className="billing-unbilled-card"><CalendarClock /><div><span>Pendiente de facturar · sin IVA</span><strong>{money(reconciliation.unbilled)}</strong><small>{reconciliation.unbilledCount} albaranes entregados todavía sin factura ni resumen</small></div></article>
      </section>
      <div className="billing-reconciliation"><strong>Conciliación:</strong> {money(reconciliation.official)} en facturas + {money(reconciliation.summaries)} en albaranes resumen + {money(reconciliation.unbilled)} sin facturar = <strong>{money(reconciliation.sold)} vendidos</strong></div>

      <section className="billing-drafts">
        <header><div><span>FACTURACIÓN AUTOMÁTICA</span><h3>Facturas definitivas del mes</h3><p>Se harán el día 1 del mes siguiente. También puedes adelantarlas ahora sin que luego se dupliquen.</p></div><div className="billing-draft-header-actions"><button type="button" onClick={handleMonthlyBilling} disabled={runningMonthlyBilling}>{runningMonthlyBilling ? 'Facturando…' : 'Hacer facturación'}</button><strong>{billingDrafts.length}</strong></div></header>
        {billingDrafts.length ? <div className="billing-draft-list">
          {billingDrafts.map(draft => {
            const client = clients.find(item => item.id === draft.clientId);
            return <article key={draft.id}>
              <div><strong>{client?.commercialName || client?.name || 'Cliente desconocido'}</strong><small>{draft.billingMode === 'SUMMARY' ? 'Albarán resumen' : 'Factura oficial'} · {new Date(`${draft.periodStart}T12:00:00`).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</small></div>
              <div className="billing-draft-amount"><strong>{money(draft.subtotal)}</strong><small>{draft.noteCount} albarán{draft.noteCount === 1 ? '' : 'es'} · sin IVA</small></div>
              <button type="button" onClick={() => openBillingDraft(draft)}>Revisar y confirmar</button>
            </article>;
          })}
        </div> : <div className="billing-all-clear"><CheckCircle2 /><span><strong>Sin revisiones pendientes</strong><small>Las facturas definitivas se crearán automáticamente cada día 1.</small></span></div>}
      </section>

      <section className="billing-debtors">
        <header><div><span>CUENTAS POR COBRAR</span><h3>Clientes con saldo pendiente</h3></div><strong>{debtorClients.length} clientes</strong></header>
        {debtorClients.length ? (
          <div className="billing-debtor-list">
            {debtorClients.slice(0, 6).map(client => (
              <button key={client.id} onClick={() => { setFilterClientId(client.id === 'unknown' ? '' : client.id); setFilterStatus('PENDING'); }}>
                <span className="billing-debtor-avatar"><UsersRound size={18} /></span>
                <span className="billing-debtor-name"><strong>{client.name}</strong><small>{client.documents} factura{client.documents === 1 ? '' : 's'} · desde {new Date(client.oldest).toLocaleDateString('es-ES')}</small></span>
                <span className="billing-debtor-amount"><strong>{money(client.pending)}</strong><small className={client.overdue > 0 ? 'has-overdue' : ''}>{client.overdue > 0 ? `${money(client.overdue)} vencido` : 'En plazo'}</small></span>
              </button>
            ))}
          </div>
        ) : <div className="billing-all-clear"><CheckCircle2 /><span><strong>Todo cobrado</strong><small>No hay clientes con facturas pendientes.</small></span></div>}
      </section>

      {isAdding && (
        <div style={modalOverlayStyle}>
          <div style={modalCardStyle}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-xl">{editingInvoiceId ? `Editar ${editingInvoice?.invoiceNumber}` : activeDraftId ? 'Revisar prefactura' : 'Generar Factura / Albarán Resumen'}</h3>
              <button className="btn btn-secondary" style={{ padding: '0.2rem 0.6rem' }} onClick={closeInvoiceModal}>Cerrar</button>
            </div>
          
          <div className="flex gap-4 mb-4">
            <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-md" style={{ borderColor: documentType === 'INVOICE' ? 'var(--color-primary)' : 'var(--color-border)', backgroundColor: documentType === 'INVOICE' ? 'rgba(99,102,241,0.05)' : 'transparent' }}>
              <input type="radio" name="docType" value="INVOICE" disabled={Boolean(activeDraftId || editingInvoiceId)} checked={documentType === 'INVOICE'} onChange={() => handleDocumentTypeChange('INVOICE')} />
              <div>
                <div className="font-bold text-sm">📄 Factura Oficial</div>
                <div className="text-xs text-muted">Aplica IVA y utiliza la serie F-</div>
              </div>
            </label>
            <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-md" style={{ borderColor: documentType === 'SUMMARY' ? 'var(--color-primary)' : 'var(--color-border)', backgroundColor: documentType === 'SUMMARY' ? 'rgba(99,102,241,0.05)' : 'transparent' }}>
              <input type="radio" name="docType" value="SUMMARY" disabled={Boolean(activeDraftId || editingInvoiceId)} checked={documentType === 'SUMMARY'} onChange={() => handleDocumentTypeChange('SUMMARY')} />
              <div>
                <div className="font-bold text-sm">📝 Albarán Resumen</div>
                <div className="text-xs text-muted">Sin IVA y utiliza la serie ALB-</div>
              </div>
            </label>
          </div>
          
          <div className="flex gap-4">
            <div className="mb-6 max-w-md w-full">
              <label className="form-label">Seleccionar Cliente</label>
              <select className="form-control" value={selectedClientId} onChange={handleSelectClient} disabled={Boolean(editingInvoiceId)}>
                <option value="">-- Elige un cliente --</option>
                {eligibleClients.map(c => <option key={c.id} value={c.id}>{c.commercialName || c.name} ({c.clientNumber})</option>)}
              </select>
            </div>
            {selectedClientId && (
              <>
                <div className="mb-6 max-w-xs w-full">
                  <label className="form-label">Fecha del Documento</label>
                  <input type="date" className="form-control" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} required />
                </div>
                <div className="mb-6 max-w-xs w-full">
                  <label className="form-label">Forma de Pago</label>
                  <select className="form-control" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                    <option value="Transferencia">Transferencia</option>
                    <option value="30 Días">30 Días</option>
                    <option value="Contado">Contado</option>
                  </select>
                </div>
                {documentType === 'INVOICE' && <div className="mb-6 max-w-xs w-full">
                  <label className="form-label">Plazo de pago</label>
                  <div className="billing-payment-term"><input type="number" min="0" max="365" className="form-control" value={paymentTermsDays} onChange={e => setPaymentTermsDays(Math.max(0, Math.min(365, Number(e.target.value))))} /><span>días</span></div>
                  <small className="text-muted">Vence el {(() => { const due = new Date(`${invoiceDate}T00:00:00`); due.setDate(due.getDate() + paymentTermsDays); return due.toLocaleDateString('es-ES'); })()}</small>
                </div>}
              </>
            )}
          </div>

          {selectedClientId && (
            <div>
              <h4 className="font-semibold mb-3">{editingInvoiceId ? 'Albaranes incluidos en el documento' : 'Albaranes Pendientes de Facturar'}</h4>
              {clientUnbilledNotes.length === 0 ? (
                <p className="text-muted mb-4 border border-color-border p-4 rounded-md">
                  El cliente seleccionado no tiene albaranes pendientes de facturar.
                </p>
              ) : (
                <div className="table-container mb-6">
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ width: '50px' }}>
                          <input 
                            type="checkbox" 
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedNotes(clientUnbilledNotes.map(n => n.id));
                              } else {
                                setSelectedNotes([]);
                              }
                            }}
                            checked={selectedNotes.length === clientUnbilledNotes.length && clientUnbilledNotes.length > 0}
                          />
                        </th>
                        <th>Ref. Albarán</th>
                        <th>Fecha</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientUnbilledNotes.map(dn => (
                        <tr key={dn.id}>
                          <td>
                            <input 
                              type="checkbox" 
                              checked={selectedNotes.includes(dn.id)}
                              onChange={() => handleToggleNote(dn.id)}
                            />
                          </td>
                          <td className="font-mono">ALB-{dn.albaranNumber || dn.id.slice(-6)}</td>
                          <td>{new Date(dn.date).toLocaleDateString()}</td>
                          <td className="font-bold">{dn.total.toFixed(2)} €</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan="3" className="text-right font-medium pt-4">SUBTOTAL:</td>
                        <td className="font-semibold pt-4">{calculateInvoiceTotal().toFixed(2)} €</td>
                      </tr>
                      {documentType === 'INVOICE' && (
                        <tr>
                          <td colSpan="3" className="text-right font-medium pb-2 pt-2 flex justify-end items-center gap-2">
                            IVA:
                            <select className="form-control" style={{ width: '100px', display: 'inline-block' }} value={ivaPercentage} onChange={(e) => setIvaPercentage(Number(e.target.value))}>
                              <option value={4}>4%</option>
                              <option value={10}>10%</option>
                              <option value={21}>21%</option>
                              <option value={0}>SIN IVA (0%)</option>
                            </select>
                          </td>
                          <td className="font-semibold pb-2 pt-2">{(calculateInvoiceTotal() * (ivaPercentage / 100)).toFixed(2)} €</td>
                        </tr>
                      )}
                      <tr>
                        <td colSpan="3" className="text-right font-bold text-lg pt-2 pb-4 border-t border-[rgba(0,0,0,0.1)]">
                          TOTAL {documentType === 'SUMMARY' ? 'RESUMEN' : 'A FACTURAR'}:
                        </td>
                        <td className="font-bold text-primary text-xl pt-2 pb-4 border-t border-[rgba(0,0,0,0.1)]">
                          {(calculateInvoiceTotal() * (documentType === 'SUMMARY' ? 1 : (1 + ivaPercentage / 100))).toFixed(2)} €
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button className="btn btn-secondary" onClick={closeInvoiceModal}>Cancelar</button>
                <button 
                  className="btn btn-primary" 
                  disabled={selectedNotes.length === 0}
                  onClick={handleGenerateInvoice}
                >
                  {editingInvoiceId ? 'Guardar cambios' : activeDraftId ? 'Confirmar y crear documento definitivo' : `Generar ${documentType === 'SUMMARY' ? 'Resumen' : 'Factura'}`}
                </button>
              </div>
            </div>
          )}
        </div>
        </div>
      )}

      <div>
        <section className="billing-register">
          <header><div><span>REGISTRO DE FACTURAS</span><h3>Documentos y situación de cobro · importes sin IVA</h3></div><div className="billing-list-total"><span>Base del listado · sin IVA</span><strong>{money(filteredInvoiceTotal)}</strong><small>{filteredInvoices.length} documentos</small></div></header>
          <div className="billing-bulk-actions">
            <div><strong>Facturas para el gestor</strong><small>Selecciona facturas oficiales y descárgalas juntas en un ZIP.</small></div>
            <button type="button" onClick={selectCurrentQuarterInvoices}>Seleccionar trimestre actual</button>
            <button type="button" onClick={selectVisibleOfficialInvoices}>Seleccionar facturas visibles</button>
            <button type="button" onClick={() => setSelectedInvoiceIds([])} disabled={!selectedInvoiceIds.length}>Limpiar selección</button>
            <button type="button" className="primary" onClick={downloadSelectedInvoices} disabled={!selectedInvoiceIds.length || downloadingInvoices}>{downloadingInvoices ? 'Preparando ZIP…' : `Descargar ZIP (${selectedInvoiceIds.length})`}</button>
          </div>
          <div className="billing-filters">
            <label className="billing-search"><Search size={17} /><input value={filterQuery} onChange={event => setFilterQuery(event.target.value)} placeholder="Buscar factura o cliente" /></label>
            <select value={filterClientId} onChange={event => setFilterClientId(event.target.value)}>
              <option value="">Todos los clientes</option>
              {clients.map(client => <option key={client.id} value={client.id}>{client.commercialName || client.name}</option>)}
            </select>
            <label><span>Desde</span><input type="date" value={filterStartDate} onChange={event => setFilterStartDate(event.target.value)} /></label>
            <label><span>Hasta</span><input type="date" value={filterEndDate} onChange={event => setFilterEndDate(event.target.value)} /></label>
            <button onClick={clearFilters}>Limpiar</button>
          </div>
          <nav className="billing-status-tabs">
            <button className={filterStatus === 'ALL' ? 'active' : ''} onClick={() => setFilterStatus('ALL')}>Todas <strong>{invoiceRows.length}</strong></button>
            <button className={filterStatus === 'PENDING' ? 'active pending' : ''} onClick={() => setFilterStatus('PENDING')}>Pendientes <strong>{collectionSummary.pendingCount}</strong></button>
            <button className={filterStatus === 'OVERDUE' ? 'active overdue' : ''} onClick={() => setFilterStatus('OVERDUE')}>Vencidas <strong>{collectionSummary.overdueCount}</strong></button>
            <button className={filterStatus === 'PAID' ? 'active paid' : ''} onClick={() => setFilterStatus('PAID')}>Cobradas <strong>{invoiceRows.length - collectionSummary.pendingCount}</strong></button>
          </nav>

        {filteredInvoices.length === 0 ? (
           <div className="billing-empty"><Search /><strong>No hay facturas con estos filtros</strong><span>Prueba a cambiar el cliente, las fechas o el estado.</span></div>
        ) : (
          <div className="table-container billing-table-wrap">
            <table className="table billing-table">
              <thead>
                <tr>
                  <th><input aria-label="Seleccionar todas las facturas visibles" type="checkbox" checked={filteredInvoices.some(invoice => invoice.isOfficial) && filteredInvoices.filter(invoice => invoice.isOfficial).every(invoice => selectedInvoiceIds.includes(invoice.id))} onChange={event => event.target.checked ? selectVisibleOfficialInvoices() : setSelectedInvoiceIds([])} /></th>
                  <th>Referencia</th>
                  <th>Tipo</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Base · sin IVA</th>
                  <th>Vencimiento</th>
                  <th>Envíos</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {[...filteredInvoices].reverse().map(inv => {
                  const client = inv.client;
                  const isSummary = inv.type === 'SUMMARY';
                  const hasBeenSent = inv.emailStatus === 'SENT' || Boolean(inv.emailSentAt) || Boolean(inv.emailSendHistory?.length);
                  return (
                    <tr key={inv.id} className={inv.isOverdue ? 'is-overdue' : ''}>
                      <td>{inv.isOfficial ? <input aria-label={`Seleccionar ${inv.invoiceNumber}`} type="checkbox" checked={selectedInvoiceIds.includes(inv.id)} onChange={() => setSelectedInvoiceIds(current => current.includes(inv.id) ? current.filter(id => id !== inv.id) : [...current, inv.id])} /> : '—'}</td>
                      <td className="font-mono font-bold text-secondary">{inv.invoiceNumber}</td>
                      <td>
                        <span style={{ padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', backgroundColor: isSummary ? '#e0e7ff' : '#dcfce7', color: isSummary ? '#4338ca' : '#166534' }}>
                          {isSummary ? 'Resumen' : 'Factura'}
                        </span>
                      </td>
                      <td>{new Date(inv.date).toLocaleDateString()}</td>
                      <td className="font-medium">{client ? (client.commercialName || client.name) : 'Desconocido'}</td>
                      <td className="font-bold">{money(invoiceNetAmount(inv))}</td>
                      <td><span className={inv.isOverdue ? 'billing-due overdue' : 'billing-due'}>{!inv.isOfficial || inv.isPaid ? '—' : <>{inv.dueDate.toLocaleDateString('es-ES')}<small>{Number(inv.paymentTermsDays ?? 15)} días</small></>}</span></td>
                      <td>{inv.emailSendHistory?.length ? <div className="billing-send-history"><strong>{inv.emailSendHistory.length === 1 ? 'Enviada' : `${inv.emailSendHistory.length} envíos`}</strong>{inv.emailSendHistory.map((send, index) => <small key={`${send.sentAt}-${index}`}>{index ? `Reenvío ${index}:` : 'Envío inicial:'} {formatSendDate(send.sentAt)}</small>)}</div> : inv.emailSentAt ? <div className="billing-send-history"><strong>Enviada</strong><small>Envío inicial: {formatSendDate(inv.emailSentAt)}</small></div> : <span className="billing-not-sent">Sin enviar</span>}</td>
                      <td>
                        {inv.isPaid ? (
                          <span className="billing-state paid">Cobrado</span>
                        ) : inv.isOverdue ? (
                          <span className="billing-state overdue">Vencida</span>
                        ) : (
                          <span className="billing-state pending">Pendiente</span>
                        )}
                      </td>
                      <td className="flex gap-2 items-center flex-wrap">
                        {!inv.isPaid ? (
                          <button 
                            className="btn btn-outline" 
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: 'green', borderColor: 'green' }}
                            onClick={() => handlePaymentStatusChange(inv, true)}
                            title="Establecer como Cobrado"
                          >
                            Cobrar
                          </button>
                        ) : (
                          <button 
                            className="btn btn-outline" 
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: 'gray', borderColor: 'gray' }}
                            onClick={() => handlePaymentStatusChange(inv, false)}
                            title="Desmarcar Cobrado"
                          >
                            Des-cobrar
                          </button>
                        )}
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                          onClick={() => handleViewOldInvoice(inv)}
                          title="Ver PDF"
                        >
                          Ver
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                          onClick={() => openInvoiceEditor(inv)}
                          title="Editar documento"
                        >
                          <Pencil size={13} /> Editar
                        </button>
                        {inv.type !== 'SUMMARY' && <button
                          className="btn btn-primary"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', backgroundColor: hasBeenSent ? '#64748b' : '#0f766e' }}
                          onClick={() => openEmailReview(inv)}
                          disabled={sendingInvoiceId === inv.id}
                          title={hasBeenSent ? `Reenviar a ${inv.emailRecipient || 'cliente'}` : 'Enviar factura y albaranes firmados por correo'}
                        >
                          {sendingInvoiceId === inv.id ? 'Enviando…' : hasBeenSent ? 'Reenviar' : 'Enviar'}
                        </button>}
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: 'red' }}
                          onClick={() => handleDeleteInvoice(inv.id)}
                          title="Eliminar Factura"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot><tr className="billing-total-row"><td colSpan="5">TOTAL SIN IVA</td><td>{money(filteredInvoiceTotal)}</td><td colSpan="4">{filteredInvoices.length} documentos</td></tr></tfoot>
            </table>
          </div>
        )}
        </section>
      </div>

      {emailReviewInvoice && (() => {
        const associatedNotes = deliveryNotes.filter(note => (emailReviewInvoice.deliveryNoteIds || []).includes(note.id));
        return <div className="invoice-email-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setEmailReviewInvoice(null); }}>
          <section className="invoice-email-modal" role="dialog" aria-modal="true">
            <header><div><span>ENVÍO DE FACTURA OFICIAL</span><h3>{emailReviewInvoice.invoiceNumber}</h3><p>Confirma el correo de destino antes de realizar el envío.</p></div><button onClick={() => setEmailReviewInvoice(null)}>×</button></header>
            <div className="invoice-email-body">
              <label>Correo de destino<input type="email" value={emailRecipient} onChange={event => setEmailRecipient(event.target.value)} placeholder="cliente@empresa.com"/><small>Se carga desde la ficha del cliente. Puedes cambiarlo para este envío sin modificar su ficha.</small></label>
              <div className="invoice-email-invoice"><input type="checkbox" checked readOnly/><div><strong>{emailReviewInvoice.invoiceNumber}.pdf</strong><small>Factura oficial · siempre adjunta</small></div><span>{money(emailReviewInvoice.total)}</span></div>
              <div className="invoice-email-notes"><div><strong>Albaranes asociados</strong><small>Todos están seleccionados por defecto.</small></div>{associatedNotes.map(note => <label key={note.id} className={!note.signature ? 'is-unsigned' : ''}><input type="checkbox" checked={emailNoteIds.includes(note.id)} disabled={!note.signature} onChange={() => setEmailNoteIds(current => current.includes(note.id) ? current.filter(id => id !== note.id) : [...current, note.id])}/><span><strong>Albarán {note.albaranNumber || note.id.slice(-6)}</strong><small>{new Date(note.date).toLocaleDateString('es-ES')} · {note.signature ? 'Firmado' : 'Sin firma'}</small></span><b>{money(note.total)}</b></label>)}</div>
            </div>
            <footer><div><span>Documentos seleccionados</span><strong>{1 + emailNoteIds.length}</strong></div><button onClick={() => setEmailReviewInvoice(null)}>Cancelar</button><button className="primary" disabled={sendingInvoiceId === emailReviewInvoice.id || !emailRecipient.trim() || !emailNoteIds.length} onClick={() => sendOfficialInvoice(emailReviewInvoice)}>{sendingInvoiceId === emailReviewInvoice.id ? 'Enviando…' : 'Confirmar y enviar'}</button></footer>
          </section>
        </div>;
      })()}

    </div>
  );
}

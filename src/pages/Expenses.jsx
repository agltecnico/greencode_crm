import { useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, CircleDollarSign, Clock3, Pencil, Plus, ReceiptText, Search, Trash2, X } from 'lucide-react';
import Swal from 'sweetalert2';
import { useData } from '../context/DataContext';

const money = value => new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR'
}).format(Number(value || 0));

const categories = [
  ['NOMINAS', 'Personal y nóminas'],
  ['SUMINISTROS', 'Luz, agua y suministros'],
  ['TRANSPORTE', 'Gasoil y desplazamientos'],
  ['MANTENIMIENTO', 'Mantenimiento'],
  ['ALQUILER', 'Alquiler'],
  ['MARKETING', 'Marketing y software'],
  ['OTROS', 'Otros']
];

const emptyForm = () => ({
  date: new Date().toISOString().slice(0, 10),
  category: 'SUMINISTROS',
  concept: '',
  total: '',
  ivaPercentage: 21,
  paymentMethod: 'Transferencia',
  isPaid: true
});

export default function Expenses() {
  const { expenses, addExpense, updateExpense, deleteExpense, markExpenseAsPaid } = useData();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const rows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('es');
    return (expenses || [])
      .filter(expense => {
        const date = String(expense.date || '').slice(0, 10);
        if (startDate && date < startDate) return false;
        if (endDate && date > endDate) return false;
        if (category && expense.category !== category) return false;
        if (paymentStatus === 'paid' && expense.isPaid !== true) return false;
        if (paymentStatus === 'pending' && expense.isPaid === true) return false;
        if (normalized && !`${expense.concept || ''} ${expense.category || ''} ${expense.paymentMethod || ''}`.toLocaleLowerCase('es').includes(normalized)) return false;
        return true;
      })
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }, [category, endDate, expenses, paymentStatus, query, startDate]);

  const totals = useMemo(() => rows.reduce((result, expense) => {
    const value = Number(expense.total ?? expense.amount ?? 0);
    result.total += value;
    if (expense.isPaid === true) result.paid += value;
    else result.pending += value;
    return result;
  }, { total: 0, paid: 0, pending: 0 }), [rows]);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm());
    setShowForm(true);
  };

  const openEdit = expense => {
    setEditingId(expense.id);
    setForm({
      date: String(expense.date || '').slice(0, 10),
      category: expense.category || 'OTROS',
      concept: expense.concept || '',
      total: Number(expense.total ?? expense.amount ?? 0),
      ivaPercentage: Number(expense.ivaPercentage ?? 21),
      paymentMethod: expense.paymentMethod || 'Transferencia',
      isPaid: expense.isPaid === true
    });
    setShowForm(true);
  };

  const save = async event => {
    event.preventDefault();
    const total = Number(form.total || 0);
    const ivaPercentage = Number(form.ivaPercentage || 0);
    if (!form.concept.trim() || total <= 0) return;
    const payload = { ...form, total, ivaPercentage, baseAmount: total / (1 + ivaPercentage / 100) };
    if (editingId) await updateExpense(editingId, payload);
    else await addExpense(payload);
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
  };

  const remove = async expense => {
    const confirmation = await Swal.fire({
      title: '¿Eliminar este gasto?',
      text: expense.concept,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626'
    });
    if (confirmation.isConfirmed) await deleteExpense(expense.id);
  };

  return (
    <div className="admin-container expenses-page">
      <header className="expenses-header">
        <div><span>CONTROL DE GASTOS</span><h1>Gastos generales</h1><p>Registra y consulta personal, suministros, transporte y demás gastos de la empresa.</p></div>
        <button onClick={openNew}><Plus size={18} /> Nuevo gasto</button>
      </header>

      <section className="expenses-summary">
        <article><CircleDollarSign /><div><span>Total filtrado</span><strong>{money(totals.total)}</strong><small>{rows.length} registros</small></div></article>
        <article><CheckCircle2 /><div><span>Pagado</span><strong>{money(totals.paid)}</strong><small>Gastos abonados</small></div></article>
        <article><Clock3 /><div><span>Pendiente</span><strong>{money(totals.pending)}</strong><small>Por pagar</small></div></article>
      </section>

      <section className="expenses-filters">
        <div className="expenses-search"><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar concepto…" /></div>
        <select value={category} onChange={event => setCategory(event.target.value)}><option value="">Todos los tipos</option>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select value={paymentStatus} onChange={event => setPaymentStatus(event.target.value)}><option value="">Todos los estados</option><option value="paid">Pagados</option><option value="pending">Pendientes</option></select>
        <label><CalendarDays size={16} /> Desde<input type="date" value={startDate} max={endDate || undefined} onChange={event => setStartDate(event.target.value)} /></label>
        <label><CalendarDays size={16} /> Hasta<input type="date" value={endDate} min={startDate || undefined} onChange={event => setEndDate(event.target.value)} /></label>
      </section>

      <section className="premium-card expenses-table-card">
        <div className="table-container"><table>
          <thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto</th><th>Forma de pago</th><th>Estado</th><th>Importe</th><th>Acciones</th></tr></thead>
          <tbody>
            {rows.map(expense => <tr key={expense.id}>
              <td>{new Date(`${String(expense.date).slice(0, 10)}T12:00:00`).toLocaleDateString('es-ES')}</td>
              <td><span className="expense-category">{categories.find(item => item[0] === expense.category)?.[1] || expense.category || 'Otros'}</span></td>
              <td><strong>{expense.concept}</strong></td><td>{expense.paymentMethod || '-'}</td>
              <td><button className={`expense-status ${expense.isPaid ? 'paid' : 'pending'}`} onClick={() => markExpenseAsPaid(expense.id, !expense.isPaid)}>{expense.isPaid ? 'Pagado' : 'Pendiente'}</button></td>
              <td className="expense-amount">{money(expense.total ?? expense.amount)}</td>
              <td><div className="expense-actions"><button title="Editar" onClick={() => openEdit(expense)}><Pencil size={16} /></button><button title="Eliminar" className="danger" onClick={() => remove(expense)}><Trash2 size={16} /></button></div></td>
            </tr>)}
            {!rows.length && <tr><td colSpan="7" className="expenses-empty"><ReceiptText size={28} />No hay gastos que coincidan con los filtros.</td></tr>}
          </tbody>
        </table></div>
      </section>

      {showForm && <div className="expense-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setShowForm(false); }}>
        <form className="expense-modal" onSubmit={save}>
          <header><div><span>{editingId ? 'EDITAR REGISTRO' : 'NUEVO REGISTRO'}</span><h2>{editingId ? 'Editar gasto' : 'Registrar gasto'}</h2></div><button type="button" onClick={() => setShowForm(false)}><X /></button></header>
          <div className="expense-form-grid">
            <label>Fecha<input type="date" required value={form.date} onChange={event => setForm({ ...form, date: event.target.value })} /></label>
            <label>Tipo de gasto<select value={form.category} onChange={event => setForm({ ...form, category: event.target.value })}>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="expense-form-wide">Concepto<input required value={form.concept} onChange={event => setForm({ ...form, concept: event.target.value })} placeholder="Ej. Factura de electricidad julio" /></label>
            <label>Total (€)<input type="number" min="0.01" step="0.01" required value={form.total} onChange={event => setForm({ ...form, total: event.target.value })} /></label>
            <label>IVA (%)<input type="number" min="0" step="1" value={form.ivaPercentage} onChange={event => setForm({ ...form, ivaPercentage: event.target.value })} /></label>
            <label>Forma de pago<select value={form.paymentMethod} onChange={event => setForm({ ...form, paymentMethod: event.target.value })}><option>Transferencia</option><option>Tarjeta</option><option>Efectivo</option><option>Domiciliación</option></select></label>
            <label className="expense-paid-check"><input type="checkbox" checked={form.isPaid} onChange={event => setForm({ ...form, isPaid: event.target.checked })} /> Gasto pagado</label>
          </div>
          <footer><button type="button" onClick={() => setShowForm(false)}>Cancelar</button><button type="submit">{editingId ? 'Guardar cambios' : 'Registrar gasto'}</button></footer>
        </form>
      </div>}
    </div>
  );
}

import { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';

export default function Expenses() {
  const { expenses = [], addExpense, updateExpense, deleteExpense, markExpenseAsPaid } = useData();
  const [isAdding, setIsAdding] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);

  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [concept, setConcept] = useState('');
  const [category, setCategory] = useState('Cultivo');
  const [baseAmount, setBaseAmount] = useState('');
  const [ivaPercentage, setIvaPercentage] = useState(21);
  const [paymentMethod, setPaymentMethod] = useState('Transferencia');
  const [isPaid, setIsPaid] = useState(false);

  // Filters
  const [filterPeriod, setFilterPeriod] = useState('MONTH'); // ALL, MONTH, YEAR

  const categories = [
    'Cultivo',
    'Semillas y Plantones',
    'Fertilizantes y Fitosanitarios',
    'Material de Embalaje',
    'Transporte y Logística',
    'Mantenimiento y Reparaciones',
    'Suministros (Agua, Luz)',
    'Gestoría e Impuestos',
    'Otros'
  ];

  const handleOpenAdd = () => {
    setDate(new Date().toISOString().split('T')[0]);
    setConcept('');
    setCategory('Cultivo');
    setBaseAmount('');
    setIvaPercentage(21);
    setPaymentMethod('Transferencia');
    setIsPaid(false);
    setEditingExpense(null);
    setIsAdding(true);
  };

  const handleOpenEdit = (exp) => {
    setDate(exp.date.split('T')[0]);
    setConcept(exp.concept);
    setCategory(exp.category);
    setBaseAmount(exp.baseAmount);
    setIvaPercentage(exp.ivaPercentage || 0);
    setPaymentMethod(exp.paymentMethod || 'Transferencia');
    setIsPaid(exp.isPaid || false);
    setEditingExpense(exp);
    setIsAdding(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!concept || !baseAmount) return;

    const expenseData = {
      date: new Date(date).toISOString(),
      concept,
      category,
      baseAmount: parseFloat(baseAmount),
      ivaPercentage: parseFloat(ivaPercentage),
      total: parseFloat(baseAmount) * (1 + parseFloat(ivaPercentage) / 100),
      paymentMethod,
      isPaid
    };

    if (editingExpense) {
      updateExpense(editingExpense.id, expenseData);
    } else {
      addExpense(expenseData);
    }
    setIsAdding(false);
  };

  const handleDelete = (id) => {
    if (window.confirm("¿Estás seguro de que deseas eliminar este gasto?")) {
      deleteExpense(id);
    }
  };

  const filteredExpenses = useMemo(() => {
    const today = new Date();
    return expenses.filter(exp => {
      const expDate = new Date(exp.date);
      if (filterPeriod === 'MONTH') {
        return expDate.getMonth() === today.getMonth() && expDate.getFullYear() === today.getFullYear();
      }
      if (filterPeriod === 'YEAR') {
        return expDate.getFullYear() === today.getFullYear();
      }
      return true;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [expenses, filterPeriod]);

  // Totals
  const totalBase = filteredExpenses.reduce((sum, exp) => sum + exp.baseAmount, 0);
  const totalIva = filteredExpenses.reduce((sum, exp) => sum + (exp.baseAmount * (exp.ivaPercentage / 100)), 0);
  const totalGastos = filteredExpenses.reduce((sum, exp) => sum + exp.total, 0);

  return (
    <div className="fade-in">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-secondary">Control de Gastos</h1>
        <div className="flex gap-4">
          <select 
            className="input" 
            value={filterPeriod}
            onChange={(e) => setFilterPeriod(e.target.value)}
          >
            <option value="ALL">Todo el Histórico</option>
            <option value="MONTH">Este Mes</option>
            <option value="YEAR">Este Año</option>
          </select>
          <button className="btn btn-primary" onClick={handleOpenAdd}>
            + Añadir Gasto
          </button>
        </div>
      </div>

      <div className="flex w-full gap-2 mb-8" style={{ flexWrap: 'nowrap' }}>
        <div style={{ flex: '1 1 0', minWidth: 0, background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', borderRadius: '0.5rem', padding: '0.75rem', color: 'white', boxShadow: 'var(--shadow-sm)' }}>
          <h3 style={{ color: 'rgba(255,255,255,0.9)', fontWeight: '700', marginBottom: '0.1rem', fontSize: '0.65rem', textTransform: 'uppercase' }}>Total Gastos</h3>
          <p style={{ fontSize: '1.2rem', fontWeight: '800' }}>{totalGastos.toFixed(2)} €</p>
        </div>
        <div style={{ flex: '1 1 0', minWidth: 0, background: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)', borderRadius: '0.5rem', padding: '0.75rem', color: 'white', boxShadow: 'var(--shadow-sm)' }}>
          <h3 style={{ color: 'rgba(255,255,255,0.9)', fontWeight: '700', marginBottom: '0.1rem', fontSize: '0.65rem', textTransform: 'uppercase' }}>Base Imponible</h3>
          <p style={{ fontSize: '1.2rem', fontWeight: '800' }}>{totalBase.toFixed(2)} €</p>
        </div>
        <div style={{ flex: '1 1 0', minWidth: 0, background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', borderRadius: '0.5rem', padding: '0.75rem', color: 'white', boxShadow: 'var(--shadow-sm)' }}>
          <h3 style={{ color: 'rgba(255,255,255,0.9)', fontWeight: '700', marginBottom: '0.1rem', fontSize: '0.65rem', textTransform: 'uppercase' }}>IVA Soportado</h3>
          <p style={{ fontSize: '1.2rem', fontWeight: '800' }}>{totalIva.toFixed(2)} €</p>
        </div>
      </div>

      {isAdding && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">{editingExpense ? 'Editar Gasto' : 'Nuevo Gasto'}</h2>
              <button className="text-muted hover:text-secondary" onClick={() => setIsAdding(false)}>✕</button>
            </div>
            
            <form onSubmit={handleSave} className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm font-semibold mb-1">Fecha</label>
                <input type="date" className="input w-full" value={date} onChange={e => setDate(e.target.value)} required />
              </div>
              
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm font-semibold mb-1">Categoría</label>
                <select className="input w-full" value={category} onChange={e => setCategory(e.target.value)}>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-semibold mb-1">Concepto / Proveedor</label>
                <input type="text" className="input w-full" placeholder="Ej. Abono orgánico, Factura luz..." value={concept} onChange={e => setConcept(e.target.value)} required />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm font-semibold mb-1">Base Imponible (€)</label>
                <input type="number" step="0.01" min="0" className="input w-full" value={baseAmount} onChange={e => setBaseAmount(e.target.value)} required />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm font-semibold mb-1">IVA (%)</label>
                <select className="input w-full" value={ivaPercentage} onChange={e => setIvaPercentage(e.target.value)}>
                  <option value={21}>21%</option>
                  <option value={10}>10%</option>
                  <option value={4}>4%</option>
                  <option value={0}>Exento (0%)</option>
                </select>
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm font-semibold mb-1">Método de Pago</label>
                <select className="input w-full" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                  <option value="Transferencia">Transferencia</option>
                  <option value="Tarjeta">Tarjeta</option>
                  <option value="Efectivo">Efectivo</option>
                  <option value="Domiciliado">Domiciliado</option>
                </select>
              </div>

              <div className="col-span-2 sm:col-span-1 flex items-end">
                <label className="flex items-center gap-2 cursor-pointer p-2 bg-[rgba(0,0,0,0.03)] rounded-md w-full border border-[rgba(0,0,0,0.1)]">
                  <input type="checkbox" checked={isPaid} onChange={e => setIsPaid(e.target.checked)} style={{ width: '1.2rem', height: '1.2rem' }} />
                  <span className="font-semibold text-sm">Gasto ya pagado</span>
                </label>
              </div>

              <div className="col-span-2 mt-2 pt-4 border-t border-[rgba(0,0,0,0.1)] flex justify-between items-center">
                <div className="text-sm">
                  Total con IVA: <span className="font-bold text-lg text-primary">{((parseFloat(baseAmount) || 0) * (1 + parseFloat(ivaPercentage) / 100)).toFixed(2)} €</span>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn btn-secondary" onClick={() => setIsAdding(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary">Guardar Gasto</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        {filteredExpenses.length === 0 ? (
          <p className="text-muted text-center py-8">No hay gastos registrados en este periodo.</p>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Concepto</th>
                  <th>Categoría</th>
                  <th>Base</th>
                  <th>IVA</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map(exp => (
                  <tr key={exp.id}>
                    <td>{new Date(exp.date).toLocaleDateString()}</td>
                    <td className="font-medium">{exp.concept}</td>
                    <td><span className="badge badge-secondary">{exp.category}</span></td>
                    <td>{exp.baseAmount.toFixed(2)} €</td>
                    <td className="text-muted text-sm">{exp.ivaPercentage}%</td>
                    <td className="font-bold text-red-600">{exp.total.toFixed(2)} €</td>
                    <td>
                      {exp.isPaid ? (
                        <span className="badge bg-green-500 text-white">Pagado</span>
                      ) : (
                        <span className="badge badge-warning">Pendiente</span>
                      )}
                    </td>
                    <td className="flex gap-2">
                      {!exp.isPaid && (
                        <button 
                          className="btn btn-outline" 
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: 'green', borderColor: 'green' }}
                          onClick={() => markExpenseAsPaid(exp.id, true)}
                          title="Marcar como pagado"
                        >
                          Pagar
                        </button>
                      )}
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                        onClick={() => handleOpenEdit(exp)}
                      >
                        Editar
                      </button>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: 'red' }}
                        onClick={() => handleDelete(exp.id)}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

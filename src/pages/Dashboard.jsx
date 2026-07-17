import { useState, useRef } from 'react';
import { useData } from '../context/DataContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function Dashboard() {
  const { companyProfile, updateCompanyProfile, companyLogo, updateCompanyLogo, clients, orders, deliveryNotes, invoices,
      expenses, products, importData } = useData();
  const [drillLevel, setDrillLevel] = useState('YEARS');
  const [drillYear, setDrillYear] = useState(null);
  const [drillMonth, setDrillMonth] = useState(null);
  const [drillWeek, setDrillWeek] = useState(null);
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [companyFormData, setCompanyFormData] = useState(companyProfile || {});
  const fileInputRef = useRef(null);

  // Compute metrics
  const totalClients = clients.length;
  const pendingOrdersCount = orders.filter(o => o.status !== 'DELIVERED').length;

  const getWeeksOfMonth = (year, month) => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    let currentWeekStart = new Date(firstDay);
    let weekIndex = 1;
    const weeks = [];
    while (currentWeekStart <= lastDay) {
      let currentWeekEnd = new Date(currentWeekStart);
      const dayOfWeek = currentWeekEnd.getDay();
      const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
      currentWeekEnd.setDate(currentWeekEnd.getDate() + daysUntilSunday);
      if (currentWeekEnd > lastDay) currentWeekEnd = new Date(lastDay);
      weeks.push({
        index: weekIndex,
        name: `Sem ${weekIndex} (${currentWeekStart.getDate()}-${currentWeekEnd.getDate()})`,
        start: new Date(currentWeekStart),
        end: new Date(currentWeekEnd)
      });
      currentWeekStart = new Date(currentWeekEnd);
      currentWeekStart.setDate(currentWeekStart.getDate() + 1);
      currentWeekStart.setHours(0,0,0,0);
      weekIndex++;
    }
    return weeks;
  };
  
  const today = new Date();
  const allYears = [...new Set(deliveryNotes.map(dn => new Date(dn.date).getFullYear()))].sort();
  if (allYears.length === 0) allYears.push(today.getFullYear());
  
  const monthWeeks = (drillYear !== null && drillMonth !== null) ? getWeeksOfMonth(drillYear, drillMonth) : [];

  
  const isDateInPeriod = (dateString) => {
    if (!dateString) return false;
    const itemDate = new Date(dateString);
    if (drillLevel === 'YEARS') return true;
    if (drillLevel === 'MONTHS') return itemDate.getFullYear() === drillYear;
    if (drillLevel === 'WEEKS') return itemDate.getFullYear() === drillYear && itemDate.getMonth() === drillMonth;
    if (drillLevel === 'DAYS' && drillWeek) {
      const itemTime = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate()).getTime();
      const startTime = new Date(drillWeek.start.getFullYear(), drillWeek.start.getMonth(), drillWeek.start.getDate()).getTime();
      const endTime = new Date(drillWeek.end.getFullYear(), drillWeek.end.getMonth(), drillWeek.end.getDate()).getTime();
      return itemTime >= startTime && itemTime <= endTime;
    }
    return true;
  };

  const isOrderInActualPeriod = (order) => {
    const dn = deliveryNotes.find(n => n.orderId.toString() === order.id.toString());
    if (dn) {
      return isDateInPeriod(dn.date);
    }
    return isDateInPeriod(order.date);
  };

  const periodOrders = orders.filter(isOrderInActualPeriod);
  
  let periodOrderSales = 0;
  let periodRevenueBase = 0;
  let periodRevenueSummary = 0;
  let periodRevenueEarned = 0;
  let periodRevenuePending = 0;
  let periodPendingOrdersTotal = 0;

  // 1. Process all Delivery Notes in the period
  const periodDeliveryNotes = deliveryNotes.filter(dn => isDateInPeriod(dn.date));
  
  periodDeliveryNotes.forEach(dn => {
    const finalTotal = dn.total || 0;
    
    // Sum for Ventas
    periodOrderSales += finalTotal;

    // Find if it belongs to a billed invoice
    let inv = null;
    if (dn.status === 'BILLED') {
      inv = invoices.find(i => i.deliveryNoteIds && (i.deliveryNoteIds.includes(dn.id.toString()) || i.deliveryNoteIds.includes(dn.id)));
    }

    // Track Payments (Based on Invoice status)
    if (inv && inv.isPaid) {
      periodRevenueEarned += finalTotal;
    } else {
      periodRevenuePending += finalTotal;
    }

    // Track Official Invoicing vs Summary
    if (inv) {
      if (inv.type === 'SUMMARY') {
        periodRevenueSummary += finalTotal;
      } else {
        periodRevenueBase += finalTotal;
      }
    }
  });

  // 2. Process all Pending Orders in the period (Orders without Delivery Notes)
  const pendingOrders = orders.filter(o => o.status !== 'DELIVERED' && isDateInPeriod(o.date));
  
  pendingOrders.forEach(o => {
    const finalTotal = o.total || 0;
    periodPendingOrdersTotal += finalTotal;
  });

  const periodPendingOrders = periodOrders.filter(o => o.status === 'PENDING').length;

  // Chart Data Generation
  const generateChartData = () => {
    const dataMap = new Map();
    
    if (drillLevel === 'YEARS') {
      const years = [...new Set(deliveryNotes.map(dn => new Date(dn.date).getFullYear()))].sort();
      if (years.length === 0) years.push(new Date().getFullYear());
      years.forEach(y => dataMap.set(y, { name: y.toString(), albaranes: 0, year: y }));
      
      deliveryNotes.forEach(dn => {
        const y = new Date(dn.date).getFullYear();
        if (dataMap.has(y)) dataMap.get(y).albaranes += (dn.total || 0);
      });
    } else if (drillLevel === 'MONTHS') {
      const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      months.forEach((m, idx) => dataMap.set(idx, { name: m, albaranes: 0, monthIndex: idx }));
      
      deliveryNotes.filter(dn => new Date(dn.date).getFullYear() === drillYear).forEach(dn => {
        const m = new Date(dn.date).getMonth();
        if (dataMap.has(m)) dataMap.get(m).albaranes += (dn.total || 0);
      });
    } else if (drillLevel === 'WEEKS') {
      monthWeeks.forEach(w => {
        dataMap.set(w.index, { 
          name: w.name, 
          albaranes: 0,
          start: w.start,
          end: w.end,
          week: w
        });
      });
      
      deliveryNotes.filter(dn => {
        const d = new Date(dn.date);
        return d.getFullYear() === drillYear && d.getMonth() === drillMonth;
      }).forEach(dn => {
        const d = new Date(dn.date);
        for (const [key, week] of dataMap.entries()) {
          // Normalize dates to ignore time when comparing boundaries
          const itemTime = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
          const startTime = new Date(week.start.getFullYear(), week.start.getMonth(), week.start.getDate()).getTime();
          const endTime = new Date(week.end.getFullYear(), week.end.getMonth(), week.end.getDate()).getTime();
          
          if (itemTime >= startTime && itemTime <= endTime) {
            week.albaranes += (dn.total || 0);
            break;
          }
        }
      });
    } else if (drillLevel === 'DAYS' && drillWeek) {
      const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      let currentDay = new Date(drillWeek.start);
      let dayIndex = 0;
      while (currentDay <= drillWeek.end) {
        const d = new Date(currentDay);
        dataMap.set(dayIndex, {
          name: `${days[d.getDay()]} ${d.getDate()}`,
          albaranes: 0,
          date: d
        });
        currentDay.setDate(currentDay.getDate() + 1);
        dayIndex++;
      }

      deliveryNotes.filter(dn => {
         const itemTime = new Date(dn.date).getTime();
         const startTime = new Date(drillWeek.start.getFullYear(), drillWeek.start.getMonth(), drillWeek.start.getDate()).getTime();
         const endTime = new Date(drillWeek.end.getFullYear(), drillWeek.end.getMonth(), drillWeek.end.getDate(), 23, 59, 59).getTime();
         return itemTime >= startTime && itemTime <= endTime;
      }).forEach(dn => {
         const d = new Date(dn.date);
         for (const [key, day] of dataMap.entries()) {
           if (day.date.getDate() === d.getDate() && day.date.getMonth() === d.getMonth()) {
             day.albaranes += (dn.total || 0);
             break;
           }
         }
      });
    }
    
    return Array.from(dataMap.values());
  };

  const chartData = generateChartData();
  
  const handleBarClick = (data) => {
    if (drillLevel === 'YEARS') {
      setDrillYear(data.year);
      setDrillLevel('MONTHS');
    } else if (drillLevel === 'MONTHS') {
      setDrillMonth(data.monthIndex);
      setDrillLevel('WEEKS');
    } else if (drillLevel === 'WEEKS') {
      setDrillWeek(data.week);
      setDrillLevel('DAYS');
    }
  };


  const handleSaveCompany = (e) => {
    e.preventDefault();
    updateCompanyProfile(companyFormData);
    setIsEditingCompany(false);
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("El logo no debe superar los 2MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        updateCompanyLogo(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleExportData = () => {
    const dataToExport = {
      clients,
      products,
      orders,
      deliveryNotes,
      invoices,
      companyProfile,
      companyLogo
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataToExport));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `crm_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImportData = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsedData = JSON.parse(event.target.result);
        if (window.confirm("ATENCIÓN: Esto sobrescribirá todos los datos actuales con los de la copia de seguridad. ¿Estás seguro?")) {
          importData(parsedData);
        }
      } catch (err) {
        alert("Error al leer el archivo de copia de seguridad. Asegúrate de que es un archivo JSON válido.");
      }
      // Reset input so it can be selected again
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '1.5rem' }}>
        <h2 className="text-2xl font-bold">Panel Principal</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', backgroundColor: 'white', padding: '12px 16px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', border: '1px solid #f3f4f6' }}>
          <div className="relative">
            <select 
              value={drillYear || 'ALL'} 
              onChange={(e) => {
                if (e.target.value === "ALL") {
                  setDrillLevel('YEARS'); setDrillYear(null); setDrillMonth(null); setDrillWeek(null);
                } else {
                  setDrillYear(Number(e.target.value));
                  if (drillLevel === 'YEARS') setDrillLevel('MONTHS');
                  if (drillLevel === 'DAYS') { setDrillLevel('MONTHS'); setDrillMonth(null); setDrillWeek(null); }
                }
              }}
              className="custom-select"
              style={{ backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%236b7280\' stroke-width=\'2.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><polyline points=\'6 9 12 15 18 9\'/></svg>")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1em' }}
            >
              <option value="ALL">Todos los Años</option>
              {allYears.map(y => <option key={y} value={y}>Año {y}</option>)}
            </select>
          </div>

          <span className="text-gray-300 font-normal">/</span>

          <div className="relative">
            <select 
              value={drillMonth !== null ? drillMonth : 'ALL'} 
              onChange={(e) => {
                if (e.target.value === "ALL") {
                  if (drillYear) setDrillLevel('MONTHS');
                  setDrillMonth(null);
                  setDrillWeek(null);
                } else {
                  if (!drillYear) {
                    setDrillYear(new Date().getFullYear());
                  }
                  setDrillMonth(Number(e.target.value));
                  setDrillWeek(null);
                  setDrillLevel('WEEKS');
                }
              }}
              disabled={drillLevel === 'YEARS' && !drillYear}
              className="custom-select"
              style={{ backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%236b7280\' stroke-width=\'2.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><polyline points=\'6 9 12 15 18 9\'/></svg>")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1em' }}
            >
              <option value="ALL">Todos los Meses</option>
              {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((m, idx) => (
                <option key={idx} value={idx}>{m}</option>
              ))}
            </select>
          </div>
          {drillLevel === 'WEEKS' || drillLevel === 'DAYS' ? (
            <>
              <span className="text-gray-300 font-normal">/</span>
              <div className="relative">
                <select 
                  value={drillWeek ? drillWeek.index : 'ALL'} 
                  onChange={(e) => {
                    if (e.target.value === "ALL") {
                      setDrillWeek(null);
                      setDrillLevel('WEEKS');
                    } else {
                      const selectedWeek = monthWeeks.find(w => w.index === Number(e.target.value));
                      if (selectedWeek) {
                        setDrillWeek(selectedWeek);
                        setDrillLevel('DAYS');
                      }
                    }
                  }}
                  className="custom-select"
                  style={{ backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%236b7280\' stroke-width=\'2.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><polyline points=\'6 9 12 15 18 9\'/></svg>")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1em' }}
                >
                  <option value="ALL">Todas las Semanas</option>
                  {monthWeeks.map(w => (
                    <option key={w.index} value={w.index}>{w.name}</option>
                  ))}
                </select>
              </div>
            </>
          ) : null}

        </div>
      </div>
      
      <div className="stats-container">
        
        {/* 1. VENTAS */}
        <div style={{ flex: '1 1 0', minWidth: 0, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', borderRadius: '0.5rem', padding: '0.75rem', color: 'white', boxShadow: 'var(--shadow-sm)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'relative', zIndex: 10 }}>
            <h3 style={{ color: 'rgba(255,255,255,0.9)', fontWeight: '700', marginBottom: '0.1rem', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Ventas</h3>
            <p style={{ fontSize: '1.2rem', fontWeight: '800', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{periodOrderSales.toFixed(2)} €</p>
          </div>
        </div>

        {/* 2. LO FACTURADO (OFICIAL) */}
        <div style={{ flex: '1 1 0', minWidth: 0, background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', borderRadius: '0.5rem', padding: '0.75rem', color: 'white', boxShadow: 'var(--shadow-sm)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'relative', zIndex: 10 }}>
            <h3 style={{ color: 'rgba(255,255,255,0.9)', fontWeight: '700', marginBottom: '0.1rem', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Facturas</h3>
            <p style={{ fontSize: '1.2rem', fontWeight: '800', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{periodRevenueBase.toFixed(2)} €</p>
          </div>
        </div>

        {/* 3. ALBARANES RESUMEN */}
        <div style={{ flex: '1 1 0', minWidth: 0, background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', borderRadius: '0.5rem', padding: '0.75rem', color: 'white', boxShadow: 'var(--shadow-sm)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'relative', zIndex: 10 }}>
            <h3 style={{ color: 'rgba(255,255,255,0.9)', fontWeight: '700', marginBottom: '0.1rem', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Albaranes</h3>
            <p style={{ fontSize: '1.2rem', fontWeight: '800', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{periodRevenueSummary.toFixed(2)} €</p>
          </div>
        </div>

        </div>
      <div className="stats-container">
        {/* 4. LO COBRADO */}
        <div style={{ flex: '1 1 0', minWidth: 0, background: 'linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)', borderRadius: '0.5rem', padding: '0.75rem', color: 'white', boxShadow: 'var(--shadow-sm)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'relative', zIndex: 10 }}>
            <h3 style={{ color: 'rgba(255,255,255,0.9)', fontWeight: '700', marginBottom: '0.1rem', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Cobrado</h3>
            <p style={{ fontSize: '1.2rem', fontWeight: '800', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{periodRevenueEarned.toFixed(2)} €</p>
          </div>
        </div>

        {/* 5. LO QUE QUEDA PENDIENTE */}
        <div style={{ flex: '1 1 0', minWidth: 0, background: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)', borderRadius: '0.5rem', padding: '0.75rem', color: 'white', boxShadow: 'var(--shadow-sm)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'relative', zIndex: 10 }}>
            <h3 style={{ color: 'rgba(255,255,255,0.9)', fontWeight: '700', marginBottom: '0.1rem', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Pendiente</h3>
            <p style={{ fontSize: '1.2rem', fontWeight: '800', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{periodRevenuePending.toFixed(2)} €</p>
          </div>
        </div>

        {/* 6. PEDIDOS PENDIENTES */}
        <div style={{ flex: '1 1 0', minWidth: 0, background: 'linear-gradient(135deg, #64748b 0%, #475569 100%)', borderRadius: '0.5rem', padding: '0.75rem', color: 'white', boxShadow: 'var(--shadow-sm)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'relative', zIndex: 10 }}>
            <h3 style={{ color: 'rgba(255,255,255,0.9)', fontWeight: '700', marginBottom: '0.1rem', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Pedidos Pend.</h3>
            <p style={{ fontSize: '1.2rem', fontWeight: '800', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{periodPendingOrdersTotal.toFixed(2)} €</p>
          </div>
        </div>

      </div>

            {/* CHART SECTION */}
      <div className="card mt-8" style={{ padding: '1.5rem', backgroundColor: 'var(--color-surface)', borderTop: '4px solid var(--color-primary)', overflow: 'hidden' }}>
        <div className="flex justify-between items-center mb-6">
          <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--color-secondary)' }}>
            Evolución de Ventas
          </h3>
        </div>
        <div style={{ width: '100%', height: 400 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} dy={10} />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{fill: '#6B7280', fontSize: 12}} 
                tickFormatter={(val) => `${val}€`} 
                dx={-10}
              />
              <Tooltip 
                cursor={{fill: 'rgba(0,0,0,0.04)'}}
                contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)'}}
                formatter={(value) => [`${value.toFixed(2)}€`]}
              />
              <Legend iconType="circle" wrapperStyle={{paddingTop: '20px'}}/>
              <Bar 
                name="Ventas (€)" 
                dataKey="albaranes" 
                fill="#10B981" 
                radius={[4, 4, 0, 0]} 
                maxBarSize={60} 
                onClick={handleBarClick}
                cursor={drillLevel !== 'DAYS' ? 'pointer' : 'default'}
              />
              
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card mt-8" style={{ padding: '1.5rem', backgroundColor: 'var(--color-surface)', borderTop: '4px solid var(--color-primary)' }}>
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div style={{ padding: '0.5rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-primary)', borderRadius: '0.5rem' }}>
              <svg style={{ width: '1.5rem', height: '1.5rem' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: 'var(--color-secondary)' }}>Configuración de Empresa</h3>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-outline" style={{ padding: '0.4rem 1rem', fontSize: '0.875rem', borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }} onClick={handleExportData}>
              Exportar Copia (Descargar)
            </button>
            <input 
              type="file" 
              accept=".json" 
              style={{ display: 'none' }} 
              ref={fileInputRef} 
              onChange={handleImportData} 
            />
            <button className="btn btn-outline" style={{ padding: '0.4rem 1rem', fontSize: '0.875rem', borderColor: 'var(--color-secondary)', color: 'var(--color-secondary)' }} onClick={() => fileInputRef.current && fileInputRef.current.click()}>
              Importar Copia
            </button>
            <button className={`btn ${isEditingCompany ? 'btn-secondary' : 'btn-primary'}`} style={{ padding: '0.4rem 1rem', fontSize: '0.875rem' }} onClick={() => setIsEditingCompany(!isEditingCompany)}>
              {isEditingCompany ? 'Cancelar' : 'Editar Datos'}
            </button>
          </div>
        </div>

        {isEditingCompany ? (
          <form onSubmit={handleSaveCompany} className="grid grid-cols-2 gap-4 bg-[rgba(0,0,0,0.02)] p-4 rounded-lg border border-[rgba(0,0,0,0.05)]">
            <div className="form-group mb-0">
              <label className="form-label text-sm">Nombre Comercial (Fiscal)</label>
              <input type="text" className="form-control text-sm p-2" required value={companyFormData.fiscalName} onChange={e => setCompanyFormData({...companyFormData, fiscalName: e.target.value})} placeholder="Ej: GREENCODE" />
            </div>
            <div className="form-group mb-0">
              <label className="form-label text-sm">Nombre del Titular / Entidad</label>
              <input type="text" className="form-control text-sm p-2" required value={companyFormData.ownerName} onChange={e => setCompanyFormData({...companyFormData, ownerName: e.target.value})} placeholder="Nombre completo" />
            </div>
            <div className="form-group mb-0">
              <label className="form-label text-sm">NIF / CIF</label>
              <input type="text" className="form-control text-sm p-2" required value={companyFormData.nif} onChange={e => setCompanyFormData({...companyFormData, nif: e.target.value})} />
            </div>
            <div className="form-group mb-0">
              <label className="form-label text-sm">Dirección Completa</label>
              <input type="text" className="form-control text-sm p-2" required value={companyFormData.address} onChange={e => setCompanyFormData({...companyFormData, address: e.target.value})} />
            </div>
            <div className="form-group mb-0">
              <label className="form-label text-sm">Población / Ciudad</label>
              <input type="text" className="form-control text-sm p-2" required value={companyFormData.city} onChange={e => setCompanyFormData({...companyFormData, city: e.target.value})} />
            </div>
             <div className="form-group mb-0">
              <label className="form-label text-sm">C.P. y Provincia</label>
              <div className="flex gap-2">
                <input type="text" className="form-control text-sm p-2 w-1/3" placeholder="C.P." value={companyFormData.postalCode || ''} onChange={e => setCompanyFormData({...companyFormData, postalCode: e.target.value})} />
                <input type="text" className="form-control text-sm p-2 w-2/3" placeholder="Provincia" required value={companyFormData.province || ''} onChange={e => setCompanyFormData({...companyFormData, province: e.target.value})} />
              </div>
            </div>
            <div className="form-group mb-0 col-span-2">
              <label className="form-label text-sm">Número de Cuenta para Cobro (IBAN)</label>
              <input type="text" className="form-control text-sm p-2" placeholder="Ej: ES21 0000 0000 0000 0000 0000" value={companyFormData.bankAccount || ''} onChange={e => setCompanyFormData({...companyFormData, bankAccount: e.target.value})} />
            </div>
            <div className="col-span-2 mt-4 pt-4 border-t border-[rgba(0,0,0,0.05)]">
              <label className="form-label text-sm text-muted">Logotipo Corporativo (.png / .jpg recomendados)</label>
              <div className="flex items-center gap-4">
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="form-control" />
                <button type="button" className="btn btn-outline text-red-500 border-red-500 hover:bg-red-500 hover:text-white transition-colors" onClick={() => updateCompanyLogo(null)}>Quitar Logo Personalizado</button>
              </div>
            </div>
            
            <div className="col-span-2 flex justify-end mt-2">
              <button type="submit" className="btn btn-success" style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>Guardar Configuración</button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted mb-1 font-bold uppercase tracking-wider">Titular</p>
              <p className="font-semibold">{companyProfile?.ownerName || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted mb-1 font-bold uppercase tracking-wider">Nombre Fiscal</p>
              <p className="font-semibold">{companyProfile?.fiscalName || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted mb-1 font-bold uppercase tracking-wider">NIF/CIF</p>
              <p className="font-semibold">{companyProfile?.nif || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted mb-1 font-bold uppercase tracking-wider">Dirección</p>
              <p className="font-semibold">{companyProfile?.address} {companyProfile?.postalCode ? `(${companyProfile?.postalCode})` : ''}</p>
              <p className="font-medium text-sm text-gray-600">{companyProfile?.city}{companyProfile?.province ? `, ${companyProfile?.province}` : ''}</p>
            </div>
            {companyProfile?.bankAccount && (
              <div className="col-span-2 p-3 mt-2 rounded bg-opacity-10 bg-green-500 border border-green-200">
                <p className="text-xs text-muted mb-1 font-bold uppercase tracking-wider text-green-800">Número de Cuenta (IBAN)</p>
                <p className="font-mono text-lg font-bold text-green-900 tracking-wider disabled" style={{ userSelect: 'all' }}>{companyProfile.bankAccount}</p>
              </div>
            )}
            
            <div className="col-span-2 mt-4 flex items-center justify-center p-4 bg-[rgba(255,255,255,0.4)] border border-[rgba(0,0,0,0.05)] rounded">
              {companyLogo ? (
                <img src={companyLogo} alt="Company Logo" style={{ maxHeight: '80px', objectFit: 'contain' }} />
              ) : (
                <p className="text-muted text-sm italic">Se usará el logo por defecto (GreenCode) si existe.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

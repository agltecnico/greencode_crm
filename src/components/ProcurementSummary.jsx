import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { buildProcurementPlan, procurementCounts } from '../utils/procurementPlan';

export default function ProcurementSummary() {
  const navigate = useNavigate();
  const { articles, stockLots, products, orders, providers } = useData();
  const plan = buildProcurementPlan({ articles, stockLots, products, orders, providers });
  const counts = procurementCounts(plan);

  if (!counts.total) return null;

  return (
    <button className="procurement-summary" type="button" onClick={() => navigate('/crops?tab=stock&section=procurement')}>
      <span className="procurement-summary-icon">↗</span>
      <span><strong>Plan de aprovisionamiento</strong><small>{counts.urgent} urgentes · {counts.recommended} recomendaciones</small></span>
      <span className="procurement-summary-actions">
        {counts.ORDER > 0 && <b>{counts.ORDER} pedir</b>}
        {counts.BUY > 0 && <b>{counts.BUY} comprar</b>}
        {counts.PRINT > 0 && <b>{counts.PRINT} imprimir</b>}
      </span>
      <span className="procurement-summary-link">Ver plan →</span>
    </button>
  );
}

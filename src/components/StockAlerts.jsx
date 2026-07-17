import React from 'react';
import { useData } from '../context/DataContext';

export default function StockAlerts() {
  const { articles, stockEntries, crops, cropTypes } = useData();

  const alerts = [];

  articles?.forEach(article => {
    if (!article.minStock || article.minStock <= 0) return;

    // Total Entradas
    const totalIn = stockEntries?.filter(e => e.articleId === article.id).reduce((acc, curr) => acc + Number(curr.quantity || 0), 0) || 0;
    
    // Total Consumo Automático
    let totalConsumed = 0;
    if (article.type === 'SEMILLA') {
      const relatedCropTypes = cropTypes?.filter(ct => ct.seedId === article.id) || [];
      crops?.forEach(crop => {
        const ct = relatedCropTypes.find(c => c.id === crop.cropTypeId);
        if (ct && ct.seedGrams) {
          totalConsumed += (Number(ct.seedGrams) * Number(crop.traysCount || 1)) / 1000; // Seed stock assumed in KG
        }
      });
    } else if (article.type === 'SUSTRATO') {
      const relatedCropTypes = cropTypes?.filter(ct => ct.substrateId === article.id) || [];
      crops?.forEach(crop => {
        const ct = relatedCropTypes.find(c => c.id === crop.cropTypeId);
        if (ct && ct.substrateLiters) {
          totalConsumed += (Number(ct.substrateLiters) * Number(crop.traysCount || 1)); // Substrate stock assumed in Liters
        }
      });
    } else if (article.type === 'ENVASE') {
      const relatedCropTypes = cropTypes?.filter(ct => ct.containerId === article.id) || [];
      // Containers are used upon harvest. Let's count them if crop is harvested?
      // For now we skip auto-consume of containers to avoid complexity, or assume 1 per crop tray? No, 1 per tupper, but tuppers are not directly linked to tray count if they over-yield. Let's just do seeds and substrates.
    }
    
    const currentStock = totalIn - totalConsumed;

    if (currentStock <= article.minStock) {
      alerts.push({
        id: article.id,
        name: article.name,
        type: article.type,
        currentStock: currentStock.toFixed(2),
        minStock: article.minStock
      });
    }
  });

  if (alerts.length === 0) return null;

  return (
    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'fadeIn 0.5s ease' }}>
      <h3 style={{ margin: 0, color: '#991b1b', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.25rem' }}>
        <span>⚠️</span> Alertas de Inventario
      </h3>
      <p style={{ margin: 0, color: '#b91c1c', fontSize: '0.9rem' }}>
        Los siguientes artículos están por debajo de su stock de seguridad configurado. Se ha restado el consumo automático de las bandejas plantadas.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
        {alerts.map(alert => (
          <div key={alert.id} style={{ background: 'white', border: '1px solid #fca5a5', padding: '1rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <div>
              <p style={{ margin: '0 0 0.25rem 0', fontWeight: 'bold', color: '#7f1d1d' }}>{alert.name}</p>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#dc2626' }}>Mínimo seguro: {alert.minStock}</p>
            </div>
            <div style={{ background: '#fee2e2', padding: '0.5rem 1rem', borderRadius: '6px', fontWeight: 'bold', color: '#991b1b', fontSize: '1.2rem' }}>
              {alert.currentStock}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

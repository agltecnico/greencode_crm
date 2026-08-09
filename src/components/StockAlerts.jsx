import React from 'react';
import { useData } from '../context/DataContext';

export default function StockAlerts() {
  const { articles, stockEntries, crops, cropTypes } = useData();
  const alerts = [];

  articles?.forEach(article => {
    if (!article.minStock || article.minStock <= 0) return;

    const totalIn = stockEntries?.filter(entry => entry.articleId === article.id)
      .reduce((total, entry) => total + Number(entry.quantity || 0), 0) || 0;
    let totalConsumed = 0;

    if (article.type === 'SEMILLA') {
      const relatedCropTypes = cropTypes?.filter(type => type.seedId === article.id) || [];
      crops?.forEach(crop => {
        const cropType = relatedCropTypes.find(type => type.id === crop.cropTypeId);
        if (cropType?.seedGrams) totalConsumed += (Number(cropType.seedGrams) * Number(crop.traysCount || 1)) / 1000;
      });
    } else if (article.type === 'SUSTRATO') {
      const relatedCropTypes = cropTypes?.filter(type => type.substrateId === article.id) || [];
      crops?.forEach(crop => {
        const cropType = relatedCropTypes.find(type => type.id === crop.cropTypeId);
        if (cropType?.substrateLiters) totalConsumed += Number(cropType.substrateLiters) * Number(crop.traysCount || 1);
      });
    }

    const currentStock = totalIn - totalConsumed;
    if (currentStock <= article.minStock) {
      alerts.push({
        id: article.id,
        name: article.name,
        currentStock: currentStock.toFixed(2),
        minStock: article.minStock
      });
    }
  });

  if (!alerts.length) return null;

  return (
    <section className="stock-alerts-panel" aria-label="Alertas de inventario">
      <div className="stock-alerts-heading">
        <span className="stock-alerts-icon">!</span>
        <strong>Stock bajo</strong>
        <span>{alerts.length} {alerts.length === 1 ? 'artículo' : 'artículos'}</span>
      </div>
      <div className="stock-alerts-list">
        {alerts.map(alert => (
          <div key={alert.id} className="stock-alert-chip">
            <strong>{alert.name}</strong>
            <span><b>{alert.currentStock}</b> / mín. {alert.minStock}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

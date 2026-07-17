import React, { useState } from 'react';
import EmployeeTasks from '../components/EmployeeTasks';
import { useData } from '../context/DataContext';
import '../crops.css';

export default function TvDashboard() {
  const [tvTab, setTvTab] = useState('tasks');
  const { crops, seeds, advanceCropStatus } = useData();

  const activeCropsList = crops?.filter(c => c.status !== 'HARVESTED' && c.status !== 'DISCARDED') || [];

  return (
    <div className="tv-mode">
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '3rem', justifyContent: 'center' }}>
        <button 
          onClick={() => setTvTab('tasks')}
          style={{
            background: tvTab === 'tasks' ? 'linear-gradient(135deg, #34d399, #0ea5e9)' : '#1e293b',
            color: tvTab === 'tasks' ? 'white' : '#94a3b8',
            border: '2px solid',
            borderColor: tvTab === 'tasks' ? 'transparent' : '#334155',
            padding: '1rem 3rem',
            fontSize: '1.5rem',
            fontWeight: '900',
            borderRadius: '16px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: tvTab === 'tasks' ? '0 10px 25px rgba(52, 211, 153, 0.3)' : 'none'
          }}>
          🎯 TAREAS DEL DÍA
        </button>
        <button 
          onClick={() => setTvTab('greenhouse')}
          style={{
            background: tvTab === 'greenhouse' ? 'linear-gradient(135deg, #34d399, #0ea5e9)' : '#1e293b',
            color: tvTab === 'greenhouse' ? 'white' : '#94a3b8',
            border: '2px solid',
            borderColor: tvTab === 'greenhouse' ? 'transparent' : '#334155',
            padding: '1rem 3rem',
            fontSize: '1.5rem',
            fontWeight: '900',
            borderRadius: '16px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: tvTab === 'greenhouse' ? '0 10px 25px rgba(52, 211, 153, 0.3)' : 'none'
          }}>
          🪴 INVERNADERO ACTIVO
        </button>
      </div>

      {tvTab === 'tasks' ? (
        <EmployeeTasks />
      ) : (
        <div style={{ animation: 'fadeIn 0.4s ease' }}>
          <div className="tasks-header" style={{ marginBottom: '3rem' }}>
            <h2>Visión General del Invernadero</h2>
            <p style={{ color: '#94a3b8', fontSize: '1.25rem' }}>Estado en tiempo real de todas las bandejas cultivadas.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {activeCropsList.map(crop => {
              const seed = seeds?.find(s => s.id === crop.seedId);
              const daysAlive = Math.floor((new Date() - new Date(crop.datePlanted)) / (1000 * 60 * 60 * 24));
              
              return (
                <div key={crop.id} className={`status-card ${crop.status}`} style={{ background: '#1e293b', borderColor: '#334155', padding: '2rem' }}>
                  <div className="status-header" style={{ marginBottom: '1.5rem' }}>
                    <div>
                      <h4 className="status-title" style={{ color: '#f8fafc', fontSize: '1.5rem' }}>{seed?.name}</h4>
                      <span className="status-batch" style={{ background: '#0f172a', color: '#94a3b8', fontSize: '1rem', padding: '4px 12px' }}>LOTE: {crop.batchNumber}</span>
                    </div>
                  </div>
                  
                  <div className="status-footer" style={{ borderTopColor: '#334155', marginTop: '1.5rem', paddingTop: '1.5rem' }}>
                    <div>
                      <p style={{ margin: '0 0 4px 0', fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>Estado Actual</p>
                      <p className="status-current" style={{ fontSize: '1.8rem' }}>{crop.status}</p>
                      <p className="status-days" style={{ fontSize: '1rem', color: '#cbd5e1', marginTop: '4px' }}>Día {daysAlive}</p>
                    </div>
                    <button 
                      onClick={() => advanceCropStatus(crop)} 
                      style={{ background: '#0f172a', color: '#38bdf8', border: '1px solid #38bdf8', padding: '12px 20px', borderRadius: '12px', cursor: 'pointer', fontSize: '1.1rem', fontWeight: '900', boxShadow: '0 4px 10px rgba(56, 189, 248, 0.1)' }}>
                      Avanzar ⏭
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          
          {activeCropsList.length === 0 && (
            <div style={{ textAlign: 'center', padding: '5rem', color: '#64748b', fontSize: '1.5rem' }}>
              🪴 El invernadero está completamente vacío en este momento.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

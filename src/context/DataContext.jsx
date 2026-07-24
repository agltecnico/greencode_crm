/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../config/supabase';
import Swal from 'sweetalert2';

export const DataContext = createContext();

export const useData = () => useContext(DataContext);

const createId = () => crypto.randomUUID();
const BACKGROUND_REFRESH_MS = 60_000;
const ACTIVE_REFRESH_THROTTLE_MS = 10_000;

export const DataProvider = ({ children }) => {

    const sanitizeForeignKeys = (obj) => {
      const copy = { ...obj };
      ['providerId', 'seedId', 'substrateId', 'containerId', 'articleId', 'clientId'].forEach(k => {
        if (copy[k] === '') copy[k] = null;
      });
      return copy;
    };

  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [deliveryNotes, setDeliveryNotes] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [companyProfile, setCompanyProfile] = useState(() => {
    const defaults = {
      fiscalName: 'GREENCODE',
      ownerName: 'ANTONIO JOSÉ GÓMEZ LÓPEZ',
      nif: '48351348N',
      address: 'CALLE SANTA FAZ 41',
      city: 'ASPE',
      province: 'ALICANTE',
      postalCode: '',
      bankAccount: ''
    };
    try {
      return { ...defaults, ...JSON.parse(localStorage.getItem('crm_company_profile') || '{}') };
    } catch {
      return defaults;
    }
  });
  const [companyLogo, setCompanyLogo] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('crm_company_logo') || 'null');
    } catch {
      return null;
    }
  });

  const [providers, setProviders] = useState([]);
  const [articles, setArticles] = useState([]);
  const [stockEntries, setStockEntries] = useState([]);
  const [stockLots, setStockLots] = useState([]);
  const [purchaseDeliveryNotes, setPurchaseDeliveryNotes] = useState([]);
  const [purchaseDeliveryNoteLines, setPurchaseDeliveryNoteLines] = useState([]);
  const [cropTypes, setCropTypes] = useState([]);

  const [crops, setCrops] = useState([]);
  const [harvestTargets, setHarvestTargets] = useState([]);
  const [harvests, setHarvests] = useState([]);
  const [productMovements, setProductMovements] = useState([]);
  const [dailyLogs, setDailyLogs] = useState([]);

  const refreshInFlightRef = useRef(null);
  const pendingMutationsRef = useRef(0);
  const lastRefreshAtRef = useRef(0);
  const realtimeRefreshTimerRef = useRef(null);

  // Load Initial Data from Supabase
  const refreshData = useCallback(async ({ force = false } = {}) => {
      if (!force && pendingMutationsRef.current > 0) return false;
      if (refreshInFlightRef.current) return refreshInFlightRef.current;

      const loadData = async () => {
      try {
        const results = await Promise.all([
          supabase.from('clients').select('*').order('createdAt', { ascending: true }),
          supabase.from('products').select('*').order('createdAt', { ascending: true }),
          supabase.from('orders').select('*').order('createdAt', { ascending: true }),
          supabase.from('delivery_notes').select('*').order('createdAt', { ascending: true }),
          supabase.from('invoices').select('*').order('createdAt', { ascending: true }),
          supabase.from('expenses').select('*').order('createdAt', { ascending: true }),
          supabase.from('company_profile').select('*').limit(1),
          supabase.from('providers').select('*'),
          supabase.from('articles').select('*'),
          supabase.from('stock_entries').select('*'),
          supabase.from('stock_lots').select('*').order('receivedAt', { ascending: true }),
          supabase.from('purchase_delivery_notes').select('*').order('date', { ascending: false }),
          supabase.from('purchase_delivery_note_lines').select('*'),
          supabase.from('crop_types').select('*'),
          supabase.from('crops').select('*').order('createdAt', { ascending: true }),
          supabase.from('harvest_targets').select('*'),
          supabase.from('harvests').select('*').order('harvestDate', { ascending: true }),
          supabase.from('daily_logs').select('*').order('date', { ascending: true }),
          supabase.from('product_movements').select('*').order('createdAt', { ascending: true }),
        ]);

        const failedQuery = results.find(result => result.error);
        if (failedQuery) throw failedQuery.error;

        const [
          { data: clientsData },
          { data: productsData },
          { data: ordersData },
          { data: notesData },
          { data: invoicesData },
          { data: expensesData },
          { data: profileData },
          { data: providersData },
          { data: articlesData },
          { data: stockEntriesData },
          { data: stockLotsData },
          { data: purchaseDeliveryNotesData },
          { data: purchaseDeliveryNoteLinesData },
          { data: cropTypesData },
          { data: cropsData },
          { data: harvestTargetsData },
          { data: harvestsData },
          { data: dailyLogsData },
          { data: productMovementsData }
        ] = results;

        if (clientsData) setClients(clientsData);
        if (productsData) setProducts(productsData);
        if (ordersData) setOrders(ordersData);
        if (notesData) setDeliveryNotes(notesData);
        if (invoicesData) setInvoices(invoicesData);
        if (expensesData) {
            const mappedExpenses = expensesData.map(exp => {
              let concept = exp.concept || '';
              let paymentMethod = exp.paymentMethod || 'Transferencia';
              let ivaPercentage = Number(exp.ivaPercentage ?? 21);
              if (concept.includes('|||')) {
                const parts = concept.split('|||');
                concept = parts[0].trim();
                if (!exp.paymentMethod) paymentMethod = parts[1] ? parts[1].trim() : 'Transferencia';
                if (exp.ivaPercentage == null) ivaPercentage = parts[2] ? parseFloat(parts[2].trim()) : 21;
              }
              const total = Number(exp.total ?? exp.amount ?? 0);
              const baseAmount = Number(exp.baseAmount ?? (total / (1 + ivaPercentage / 100)));
              
              return {
                ...exp,
                concept,
                paymentMethod,
                ivaPercentage,
                total,
                baseAmount
              };
            });
            setExpenses(mappedExpenses);
          }
        
        if (providersData) setProviders(providersData);
        if (articlesData) setArticles(articlesData);
        if (stockEntriesData) setStockEntries(stockEntriesData);
        if (stockLotsData) setStockLots(stockLotsData);
        if (purchaseDeliveryNotesData) setPurchaseDeliveryNotes(purchaseDeliveryNotesData);
        if (purchaseDeliveryNoteLinesData) setPurchaseDeliveryNoteLines(purchaseDeliveryNoteLinesData);
        if (cropTypesData) setCropTypes(cropTypesData);
        if (cropsData) setCrops(cropsData);
          // if (cropsData && cropTypesData) autoAdvanceCrops(cropsData, cropTypesData);
        if (harvestTargetsData) setHarvestTargets(harvestTargetsData);
        if (harvestsData) setHarvests(harvestsData);
        if (dailyLogsData) setDailyLogs(dailyLogsData);
        if (productMovementsData) setProductMovements(productMovementsData);

        if (profileData && profileData.length > 0) {
          setCompanyProfile(profileData[0]);
          localStorage.setItem('crm_company_profile', JSON.stringify(profileData[0]));
        } else {
          try {
            const savedProfile = JSON.parse(localStorage.getItem('crm_company_profile') || 'null');
            if (savedProfile) {
              const profileToPersist = {
                id: savedProfile.id || 'company-profile',
                fiscalName: savedProfile.fiscalName || '',
                ownerName: savedProfile.ownerName || '',
                bankAccount: savedProfile.bankAccount || '',
                nif: savedProfile.nif || '',
                address: savedProfile.address || '',
                city: savedProfile.city || '',
                postalCode: savedProfile.postalCode || '',
                province: savedProfile.province || '',
                email: savedProfile.email || '',
                phone: savedProfile.phone || '',
                website: savedProfile.website || ''
              };
              const { data, error } = await supabase
                .from('company_profile')
                .insert([profileToPersist])
                .select();
              if (error) throw error;
              if (data?.[0]) {
                setCompanyProfile(data[0]);
                localStorage.setItem('crm_company_profile', JSON.stringify(data[0]));
              }
            }
          } catch (profileError) {
            console.error('No se pudo migrar el perfil local de empresa a Supabase:', profileError);
          }
        }
        lastRefreshAtRef.current = Date.now();
        return true;
      } catch (err) {
        console.error("Error loading data from Supabase:", err);
        return false;
      } finally {
        refreshInFlightRef.current = null;
      }
      };

      refreshInFlightRef.current = loadData();
      return refreshInFlightRef.current;
    }, []);

  const persistOrReload = async (operation, actionLabel) => {
    pendingMutationsRef.current += 1;
    try {
      const result = await operation();
      if (result?.error) throw result.error;
      return result || { data: null, error: null };
    } catch (error) {
      console.error(`Error al ${actionLabel}:`, error);
      await refreshData({ force: true });
      await Swal.fire(
        'No se pudo guardar',
        `No se pudo ${actionLabel}. Los datos se han restaurado desde Supabase. ${error.message || ''}`,
        'error'
      );
      return { data: null, error };
    } finally {
      pendingMutationsRef.current -= 1;
    }
  };

  useEffect(() => {
    const refreshWhenActive = () => {
      const enoughTimeHasPassed = Date.now() - lastRefreshAtRef.current >= ACTIVE_REFRESH_THROTTLE_MS;
      if (document.visibilityState === 'visible' && navigator.onLine && enoughTimeHasPassed) {
        void refreshData();
      }
    };

    void refreshData({ force: true });

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        void refreshData();
      }
    }, BACKGROUND_REFRESH_MS);

    const channel = supabase
      .channel(`greencode-data-sync-${createId()}`)
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        window.clearTimeout(realtimeRefreshTimerRef.current);
        realtimeRefreshTimerRef.current = window.setTimeout(() => {
          void refreshData();
        }, 750);
      })
      .subscribe((status, error) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('Sincronización en tiempo real no disponible; se mantiene el refresco periódico.', error);
        }
      });

    window.addEventListener('focus', refreshWhenActive);
    window.addEventListener('online', refreshWhenActive);
    document.addEventListener('visibilitychange', refreshWhenActive);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(realtimeRefreshTimerRef.current);
      window.removeEventListener('focus', refreshWhenActive);
      window.removeEventListener('online', refreshWhenActive);
      document.removeEventListener('visibilitychange', refreshWhenActive);
      void supabase.removeChannel(channel);
    };
  }, [refreshData]);

  
  // Provider
  const addProvider = async (item) => {
    const tempId = createId();
    const newItem = { ...item, id: tempId };
    setProviders(prev => [...prev, newItem]);
    const { data, error } = await supabase.from('providers').insert([newItem]).select();
      if (error) {
        alert('Error critico en Supabase (providers): ' + error.message);
        setProviders(prev => prev.filter(i => i.id !== tempId));
        return null;
      }
      if (data) setProviders(prev => prev.map(i => i.id === tempId ? data[0] : i));
    return data?.[0]?.id || tempId;
  };
  const updateProvider = async (id, updatedFields) => {
    setProviders(prev => prev.map(i => i.id === id ? { ...i, ...updatedFields } : i));
    return persistOrReload(
      () => supabase.from('providers').update(updatedFields).eq('id', id),
      'actualizar el proveedor'
    );
  };
  const deleteProvider = async (id) => {
    setProviders(prev => prev.filter(i => i.id !== id));
    return persistOrReload(
      () => supabase.from('providers').delete().eq('id', id),
      'eliminar el proveedor'
    );
  };

  // Unified Articles and Stock Entries
    const addArticle = async (article) => {
      const tempId = createId();
      const newItem = { ...article, id: tempId };
      setArticles(prev => [...prev, newItem]);
      const { data, error } = await supabase.from('articles').insert([newItem]).select();
      if (error) {
        alert('Error guardando en Supabase: ' + error.message);
        setArticles(prev => prev.filter(i => i.id !== tempId));
        return null;
      }
      if (data) setArticles(prev => prev.map(i => i.id === tempId ? data[0] : i));
      return data?.[0]?.id || tempId;
    };
    const updateArticle = async (id, updatedFields) => {
      setArticles(prev => prev.map(i => i.id === id ? { ...i, ...updatedFields } : i));
      return persistOrReload(
        () => supabase.from('articles').update(updatedFields).eq('id', id),
        'actualizar el artículo'
      );
    };
    const deleteArticle = async (id) => {
      setArticles(prev => prev.filter(i => i.id !== id));
      return persistOrReload(
        () => supabase.from('articles').delete().eq('id', id),
        'eliminar el artículo'
      );
    };

    const addStockEntry = async (entry) => {
      const tempId = createId();
      const newItem = { ...entry, id: tempId };
      setStockEntries(prev => [...prev, newItem]);
      const { data, error } = await supabase.from('stock_entries').insert([newItem]).select();
      if (error) {
        alert('Error guardando en Supabase: ' + error.message);
        setStockEntries(prev => prev.filter(i => i.id !== tempId));
        return null;
      }
      if (data) setStockEntries(prev => prev.map(i => i.id === tempId ? data[0] : i));
      return data?.[0]?.id || tempId;
    };
    const updateStockEntry = async (id, updatedFields) => {
      setStockEntries(prev => prev.map(i => i.id === id ? { ...i, ...updatedFields } : i));
      return persistOrReload(
        () => supabase.from('stock_entries').update(updatedFields).eq('id', id),
        'actualizar el movimiento de almacén'
      );
    };
    const deleteStockEntry = async (id) => {
      setStockEntries(prev => prev.filter(i => i.id !== id));
      return persistOrReload(
        () => supabase.from('stock_entries').delete().eq('id', id),
        'eliminar el movimiento de almacén'
      );
    };

    
    const receivePurchaseDeliveryNote = async ({ providerId, number, date, notes = '', lines }) => {
      const { data, error } = await persistOrReload(
        () => supabase.rpc('receive_purchase_delivery_note', {
          p_provider_id: providerId,
          p_number: number,
          p_date: date,
          p_notes: notes,
          p_lines: lines
        }),
        'guardar el albarán de entrada'
      );
      if (error) return null;
      await refreshData({ force: true });
      return data;
    };

    const deletePurchaseDeliveryNote = async (id) => {
      const result = await persistOrReload(
        () => supabase.rpc('delete_unused_purchase_delivery_note', { p_note_id: id }),
        'eliminar el albarán de entrada'
      );
      if (result.error) return false;
      await refreshData({ force: true });
      return true;
    };

    const addCropType = async (item) => {
      item = sanitizeForeignKeys(item);
      const tempId = createId();
      const newItem = { ...item, id: tempId };
      setCropTypes(prev => [...prev, newItem]);
      const { data, error } = await supabase.from('crop_types').insert([newItem]).select();
      if (error) {
        alert('Error guardando en Supabase: ' + error.message);
        setCropTypes(prev => prev.filter(i => i.id !== tempId));
        return null;
      }
      if (data) setCropTypes(prev => prev.map(i => i.id === tempId ? data[0] : i));
      return data?.[0]?.id || tempId;
    };
    const updateCropType = async (id, updatedFields) => {
      updatedFields = sanitizeForeignKeys(updatedFields);
      setCropTypes(prev => prev.map(i => i.id === id ? { ...i, ...updatedFields } : i));
      return persistOrReload(
        () => supabase.from('crop_types').update(updatedFields).eq('id', id),
        'actualizar la ficha de cultivo'
      );
    };
    const deleteCropType = async (id) => {
      setCropTypes(prev => prev.filter(i => i.id !== id));
      return persistOrReload(
        () => supabase.from('crop_types').delete().eq('id', id),
        'eliminar la ficha de cultivo'
      );
    };
    
    // Derived Aliases for backwards compatibility in other files
    const seeds = articles.filter(a => a.type === 'SEMILLA');
    const substrates = articles.filter(a => a.type === 'SUSTRATO');
    
    // Seed inventory expects { seedId, weightGrams, providerBatch, purchaseDate }
    const seedInventory = stockEntries
      .filter(e => articles.find(a => a.id === e.articleId)?.type === 'SEMILLA')
      .map(e => ({
        ...e,
        seedId: e.articleId,
        weightGrams: e.quantity,
        providerBatch: e.batchNumber
      }));
      
    // Substrate inventory
    const substrateInventory = stockEntries
      .filter(e => articles.find(a => a.id === e.articleId)?.type === 'SUSTRATO')
      .map(e => ({
        ...e,
        substrateId: e.articleId
      }));

    const addSeed = (seed) => addArticle({ ...seed, type: 'SEMILLA' });
    const updateSeed = updateArticle;
    const deleteSeed = deleteArticle;
    
    const addSubstrate = (sub) => addArticle({ ...sub, type: 'SUSTRATO' });
    const deleteSubstrate = deleteArticle;

    const addSeedInventory = (inv) => addStockEntry({
      articleId: inv.seedId,
      quantity: inv.weightGrams || inv.quantity,
      batchNumber: inv.providerBatch || inv.batchNumber,
      purchaseDate: inv.purchaseDate,
      deliveryNote: inv.deliveryNote,
      price: inv.price || 0
    });
    const updateSeedInventory = updateStockEntry;
    const deleteSeedInventory = deleteStockEntry;

    const addSubstrateInventory = (inv) => addStockEntry({
      articleId: inv.substrateId,
      quantity: inv.quantity,
      batchNumber: inv.batchNumber,
      purchaseDate: inv.purchaseDate,
      deliveryNote: inv.deliveryNote,
      price: inv.price || 0
    });
    const deleteSubstrateInventory = deleteStockEntry;
  
  // Crop
    const addCrop = async (item) => {
      const tempId = createId();
      const newItem = { ...item, id: tempId };
      setCrops(prev => [...prev, newItem]);
      const { data, error } = await persistOrReload(
        () => supabase.from('crops').insert([newItem]).select(),
        'guardar el cultivo'
      );
      if (error) return null;
      if (data) setCrops(prev => prev.map(i => i.id === tempId ? data[0] : i));
      return data?.[0]?.id || tempId;
    };

  const sowCrop = async (newCrop) => {
    if (newCrop.stockLotId) {
      const { data, error } = await persistOrReload(
        () => supabase.rpc('sow_crop_from_lot', {
          p_crop_type_id: newCrop.cropTypeId,
          p_trays: Number(newCrop.traysCount || 1),
          p_stock_lot_id: newCrop.stockLotId
        }),
        'registrar la siembra y consumir su lote'
      );
      if (error) throw error;
      await refreshData({ force: true });
      return data?.cropId || data;
    }
    // 1. Get the CropType definition
    const cType = cropTypes.find(c => c.id === newCrop.cropTypeId);
    if (!cType) throw new Error("Ficha de cultivo no encontrada.");

    const trays = Number(newCrop.traysCount || 1);
    const batchNum = `S-${Date.now().toString().slice(-6)}`;
    
    // 2. Create the Crop Record using existing DB columns: seedId, datePlanted, batchNumber
    const cropRecord = {
        cropTypeId: cType.id,
        traysCount: trays,
        gramsPerTray: cType.seedGrams || 0,
        substrateCostPerTray: 0,
        status: (parseInt(cType.soakDays) > 0) ? 'SOAKING' : 'GERMINATING',
        datePlanted: new Date().toISOString(),
        batchNumber: newCrop.selectedSeedBatchId || 'SIN_LOTE'
      };
    
    const cropId = await addCrop(cropRecord);
    if (!cropId) throw new Error('No se pudo guardar el cultivo. No se ha descontado stock.');

    // 3. Deduct Stock (Seeds)
      if (cType.seedId && cType.seedGrams > 0) {
        const seedMovementId = await addStockEntry({
          articleId: cType.seedId,
          quantity: -(Number(cType.seedGrams) * trays),
          batchNumber: newCrop.selectedSeedBatchId || 'SIN_LOTE',
          purchaseDate: new Date().toISOString().split('T')[0],
          price: 0,
          
          deliveryNote: `Consumo siembra lote ${batchNum}`
        });
        if (!seedMovementId) throw new Error('El cultivo se guardó, pero no se pudo descontar el stock de semilla.');
      }

    // 4. Deduct Stock (Substrate)
    if (cType.substrateId && cType.substrateLiters > 0) {
      const substrateMovementId = await addStockEntry({
        articleId: cType.substrateId,
        quantity: -(Number(cType.substrateLiters) * trays),
        batchNumber: 'SIN_LOTE',
        purchaseDate: new Date().toISOString(),
        price: 0
      });
      if (!substrateMovementId) throw new Error('El cultivo se guardó, pero no se pudo descontar el stock de sustrato.');
    }
  };

  const updateCrop = async (id, updatedFields) => {
    setCrops(prev => prev.map(i => i.id === id ? { ...i, ...updatedFields } : i));
    return persistOrReload(
      () => supabase.from('crops').update(updatedFields).eq('id', id),
      'actualizar el cultivo'
    );
  };
  const deleteCrop = async (id) => {
    const { error } = await supabase.from('crops').delete().eq('id', id);
    if (error) {
      console.error("Error deleting crop:", error);
      Swal.fire('Error', 'No se pudo eliminar de la base de datos: ' + error.message, 'error');
    } else {
      setCrops(prev => prev.filter(i => i.id !== id));
    }
  };

    const setCropPhase = async (crop, nextStatus) => {
        const cType = cropTypes.find(ct => ct.id === crop.cropTypeId || ct.id === crop.seedId);
    let daysToSubtract = 0;
    
    if (cType) {
      const soakDays = cType.soakingHours > 0 ? 1 : 0;
      const germDay = soakDays;
      const darkDay = germDay + (Number(cType.germinationDays) || 0);
      const lightDay = darkDay + (Number(cType.darknessDays) || 0);
      const readyDay = lightDay + (Number(cType.lightDays) || 0);
      
      if (nextStatus === 'SOAKING') daysToSubtract = 0;
      else if (nextStatus === 'GERMINATING') daysToSubtract = germDay;
      else if (nextStatus === 'DARKNESS') daysToSubtract = darkDay;
      else if (nextStatus === 'LIGHT') daysToSubtract = lightDay;
      else if (nextStatus === 'READY') daysToSubtract = readyDay;
    }

    const newDate = new Date();
    newDate.setDate(newDate.getDate() - daysToSubtract);

    await updateCrop(crop.id, { 
      status: nextStatus,
      datePlanted: newDate.toISOString() 
    });
  };

  const reverseCropStatus = async (crop) => {
    const sequence = ['SOAKING', 'GERMINATING', 'DARKNESS', 'LIGHT', 'READY'];
    const currentIdx = sequence.indexOf(crop.status ? crop.status.toUpperCase() : 'SOWED');
    
    let prevStatus = 'SOAKING';
    if (currentIdx > 0) {
      prevStatus = sequence[currentIdx - 1];
    } else {
      return; // Already at first phase
    }

    const cType = cropTypes.find(ct => ct.id === crop.cropTypeId || ct.id === crop.seedId);
    let daysToSubtract = 0;
    
    if (cType) {
      const soakDays = cType.soakingHours > 0 ? 1 : 0;
      const germDay = soakDays;
      const darkDay = germDay + (Number(cType.germinationDays) || 0);
      const lightDay = darkDay + (Number(cType.darknessDays) || 0);
      
      if (prevStatus === 'SOAKING') daysToSubtract = 0;
      else if (prevStatus === 'GERMINATING') daysToSubtract = germDay;
      else if (prevStatus === 'DARKNESS') daysToSubtract = darkDay;
      else if (prevStatus === 'LIGHT') daysToSubtract = lightDay;
    }

    const newDate = new Date();
    newDate.setDate(newDate.getDate() - daysToSubtract);

    await updateCrop(crop.id, { 
      status: prevStatus,
      datePlanted: newDate.toISOString() 
    });
  };

  const advanceCropStatus = async (crop) => {
    const sequence = ['SOAKING', 'GERMINATING', 'DARKNESS', 'LIGHT', 'READY'];
    const currentIdx = sequence.indexOf(crop.status ? crop.status.toUpperCase() : 'SOWED');
    
    let nextStatus = 'GERMINATING';
    if (currentIdx !== -1 && currentIdx < sequence.length - 1) {
      nextStatus = sequence[currentIdx + 1];
    } else if (currentIdx === sequence.length - 1) {
      return; // Already READY
    }

    // Calculate days to subtract to match the beginning of the next phase
    const cType = cropTypes.find(ct => ct.id === crop.cropTypeId || ct.id === crop.seedId);
    let daysToSubtract = 0;
    
    if (cType) {
      const soakDays = cType.soakingHours > 0 ? 1 : 0;
      const germDay = soakDays;
      const darkDay = germDay + (Number(cType.germinationDays) || 0);
      const lightDay = darkDay + (Number(cType.darknessDays) || 0);
      const readyDay = lightDay + (Number(cType.lightDays) || 0);
      
      if (nextStatus === 'SOAKING') daysToSubtract = 0;
      else if (nextStatus === 'GERMINATING') daysToSubtract = germDay;
      else if (nextStatus === 'DARKNESS') daysToSubtract = darkDay;
      else if (nextStatus === 'LIGHT') daysToSubtract = lightDay;
      else if (nextStatus === 'READY') daysToSubtract = readyDay;
    }

    const newDate = new Date();
    newDate.setDate(newDate.getDate() - daysToSubtract);

    await updateCrop(crop.id, { 
      status: nextStatus,
      datePlanted: newDate.toISOString() 
    });
  };

  const discardCrop = async (crop) => {
    Swal.fire({
      title: '¿Descartar Bandeja?',
      text: "Esta acción marcará la bandeja como descartada y no se podrá revertir. ¿Estás seguro?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Sí, descartar 🗑️',
      cancelButtonText: 'Cancelar'
    }).then(async (result) => {
      if (result.isConfirmed) {
        await updateCrop(crop.id, { status: 'DISCARDED' });
        Swal.fire({
          title: '¡Descartada!',
          text: 'La bandeja ha sido movida al historial de descartes.',
          icon: 'success',
          confirmButtonColor: '#10b981',
          timer: 2000,
          showConfirmButton: false
        });
      }
    });
  };

  // HarvestTarget
  const addHarvestTarget = async (item) => {
    // Generate a proper UUID so Supabase accepts it
    const tempId = crypto.randomUUID();
    const newItem = { ...item, id: tempId };
    setHarvestTargets(prev => [...prev, newItem]);
    
    // We send the newItem WITH the UUID to Supabase
    const { data, error } = await supabase.from('harvest_targets').insert([newItem]).select();
    if (error) {
      console.error("Error inserting harvest target:", error);
      Swal.fire('Error', 'No se pudo guardar la rutina: ' + error.message, 'error');
      // Rollback
      setHarvestTargets(prev => prev.filter(i => i.id !== tempId));
    } else if (data) {
      setHarvestTargets(prev => prev.map(i => i.id === tempId ? data[0] : i));
    }
    return error ? null : data?.[0]?.id || tempId;
  };
  const updateHarvestTarget = async (id, updatedFields) => {
    setHarvestTargets(prev => prev.map(i => i.id === id ? { ...i, ...updatedFields } : i));
    return persistOrReload(
      () => supabase.from('harvest_targets').update(updatedFields).eq('id', id),
      'actualizar la planificación de cosecha'
    );
  };
  const deleteHarvestTarget = async (id) => {
    setHarvestTargets(prev => prev.filter(i => i.id !== id));
    return persistOrReload(
      () => supabase.from('harvest_targets').delete().eq('id', id),
      'eliminar la planificación de cosecha'
    );
  };

  // Harvest
  const addHarvest = async (item) => {
    const tempId = createId();
    const newItem = { ...item, id: tempId };
    setHarvests(prev => [...prev, newItem]);
    const { data, error } = await persistOrReload(
      () => supabase.from('harvests').insert([newItem]).select(),
      'guardar la cosecha'
    );
    if (error) return null;
    if (data) setHarvests(prev => prev.map(i => i.id === tempId ? data[0] : i));
    return data?.[0]?.id || tempId;
  };
    const addProductMovement = async (item) => {
    const tempId = createId();
    const newItem = { ...item, id: tempId, createdAt: new Date().toISOString() };
    setProductMovements(prev => [...prev, newItem]);
    const { data, error } = await persistOrReload(
      () => supabase.from('product_movements').insert([newItem]).select(),
      'guardar el movimiento de producto'
    );
    if (error) return null;
    if (data) setProductMovements(prev => prev.map(i => i.id === tempId ? data[0] : i));
    return data?.[0]?.id || tempId;
  };
  
  const updateHarvest = async (id, updatedFields) => {
    setHarvests(prev => prev.map(i => i.id === id ? { ...i, ...updatedFields } : i));
    return persistOrReload(
      () => supabase.from('harvests').update(updatedFields).eq('id', id),
      'actualizar la cosecha'
    );
  };
  const deleteHarvest = async (id) => {
    setHarvests(prev => prev.filter(i => i.id !== id));
    return persistOrReload(
      () => supabase.from('harvests').delete().eq('id', id),
      'eliminar la cosecha'
    );
  };

  // DailyLog
  const addDailyLog = async (item) => {
    const tempId = createId();
    const newItem = { ...item, id: tempId };
    setDailyLogs(prev => [...prev, newItem]);
    const { data, error } = await persistOrReload(
      () => supabase.from('daily_logs').insert([newItem]).select(),
      'guardar el registro diario'
    );
    if (error) return null;
    if (data) setDailyLogs(prev => prev.map(i => i.id === tempId ? data[0] : i));
    return data?.[0]?.id || tempId;
  };
  const updateDailyLog = async (id, updatedFields) => {
    setDailyLogs(prev => prev.map(i => i.id === id ? { ...i, ...updatedFields } : i));
    return persistOrReload(
      () => supabase.from('daily_logs').update(updatedFields).eq('id', id),
      'actualizar el registro diario'
    );
  };
  const deleteDailyLog = async (id) => {
    setDailyLogs(prev => prev.filter(i => i.id !== id));
    return persistOrReload(
      () => supabase.from('daily_logs').delete().eq('id', id),
      'eliminar el registro diario'
    );
  };

  // Company Profile
  const updateCompanyProfile = async (newProfile) => {
    const profile = { ...companyProfile, ...newProfile };
    setCompanyProfile(profile);
    localStorage.setItem('crm_company_profile', JSON.stringify(profile));
    
    if (companyProfile.id) {
      return persistOrReload(
        () => supabase.from('company_profile').update(newProfile).eq('id', companyProfile.id),
        'actualizar los datos de empresa'
      );
    } else {
      const { data, error } = await persistOrReload(
        () => supabase.from('company_profile').insert([{ ...newProfile, id: 'company-profile' }]).select(),
        'guardar los datos de empresa'
      );
      if (error) return null;
      if (data && data.length > 0) setCompanyProfile(data[0]);
      return data?.[0] || null;
    }
  };

  const updateCompanyLogo = (base64) => {
    setCompanyLogo(base64);
    if (base64) localStorage.setItem('crm_company_logo', JSON.stringify(base64));
    else localStorage.removeItem('crm_company_logo');
  };
  
  // Clients
  const addClient = async (client) => {
    const nextNum = clients.length > 0 ? Math.max(...clients.map(c => parseInt(c.clientNumber || 0))) + 1 : 1;
    const clientNumber = nextNum.toString().padStart(2, '0');
    
    const tempId = createId();
    const newClient = { ...client, clientNumber, id: tempId };
    setClients(prev => [...prev, newClient]);

    const { data, error } = await persistOrReload(
      () => supabase.from('clients').insert([newClient]).select(),
      'guardar el cliente'
    );
    if (error) return null;
    if (data) setClients(prev => prev.map(c => c.id === tempId ? data[0] : c));
    return data?.[0] || newClient;
  };

  const updateClient = async (id, updatedClient) => {
    setClients(prev => prev.map(c => c.id === id ? { ...c, ...updatedClient } : c));
    return persistOrReload(
      () => supabase.from('clients').update(updatedClient).eq('id', id),
      'actualizar el cliente'
    );
  };
  
  const deleteClient = async (id) => {
     setClients(prev => prev.filter(c => c.id !== id));
     return persistOrReload(
       () => supabase.from('clients').delete().eq('id', id),
       'eliminar el cliente'
     );
  };

  // Products
  const addProduct = async (product) => {
    const tempId = createId();
    setProducts(prev => [...prev, { ...product, id: tempId }]);
    
    const { data, error } = await persistOrReload(
      () => supabase.from('products').insert([{ ...product, id: tempId }]).select(),
      'guardar el producto'
    );
    if (error) return null;
    if (data) setProducts(prev => prev.map(p => p.id === tempId ? data[0] : p));
    return data?.[0] || { ...product, id: tempId };
  };

  const updateProduct = async (id, updatedProduct) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updatedProduct } : p));
    return persistOrReload(
      () => supabase.from('products').update(updatedProduct).eq('id', id),
      'actualizar el producto'
    );
  };
  
  const deleteProduct = async (id) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    return persistOrReload(
      () => supabase.from('products').delete().eq('id', id),
      'eliminar el producto'
    );
  };

  // Orders
  const addOrder = async (order) => {
    const tempId = createId();
    const newOrder = { ...order, id: tempId, status: 'PENDING', date: order.date || new Date().toISOString() };
    setOrders(prev => [...prev, newOrder]);

    const { data, error } = await persistOrReload(
      () => supabase.from('orders').insert([newOrder]).select(),
      'guardar el pedido'
    );
    if (error) return null;
    if (data) setOrders(prev => prev.map(o => o.id === tempId ? data[0] : o));
    return data?.[0] || newOrder;
  };

  const updateOrderList = async (id, updatedFields) => {
    // ---------------- PRODUCT MOVEMENTS INTERCEPTION ----------------
    if (updatedFields.status === 'DELIVERED') {
      const order = orders.find(o => o.id === id);
      const effectiveOrder = order ? { ...order, ...updatedFields } : null;
      if (effectiveOrder && effectiveOrder.items) {
        // Comprobar si ya restamos el stock de este pedido para no duplicar
        const existingMovements = productMovements.filter(m => m.type === 'ORDER' && (m.referenceId === id || m.referenceId.startsWith(id + '|')));
          if (existingMovements.length === 0) {
            for (const item of effectiveOrder.items) {
              if (item.productId && item.quantity > 0) {
                let quantityToFulfill = item.quantity;
                
                const harvestMovements = productMovements
                  .filter(m => m.type === 'HARVEST' && m.productId === item.productId)
                  .sort((a, b) => new Date(a.createdAt || a.date) - new Date(b.createdAt || b.date));
                  
                const batchStats = {};
                for (const hm of harvestMovements) {
                  const batch = hm.referenceId;
                  if (!batchStats[batch]) batchStats[batch] = 0;
                  batchStats[batch] += hm.quantity;
                }
                
                const orderMovements = productMovements.filter(m => m.type === 'ORDER' && m.productId === item.productId);
                for (const om of orderMovements) {
                  if (om.referenceId && om.referenceId.includes('|')) {
                    const batch = om.referenceId.split('|')[1];
                    if (batchStats[batch] !== undefined) {
                      batchStats[batch] -= Math.abs(om.quantity);
                    }
                  }
                }
                
                const availableBatches = Object.entries(batchStats).filter(([, q]) => q > 0);
                
                for (const [batch, availableQty] of availableBatches) {
                  if (quantityToFulfill <= 0) break;
                  const consumeQty = Math.min(availableQty, quantityToFulfill);
                  const movementId = await addProductMovement({
                    productId: item.productId,
                    quantity: -consumeQty,
                    type: 'ORDER',
                    referenceId: `${effectiveOrder.id}|${batch}`
                  });
                  if (!movementId) return null;
                  quantityToFulfill -= consumeQty;
                }
                
                if (quantityToFulfill > 0) {
                  const movementId = await addProductMovement({
                    productId: item.productId,
                    quantity: -quantityToFulfill,
                    type: 'ORDER',
                    referenceId: effectiveOrder.id
                  });
                  if (!movementId) return null;
                }
              }
            }
          }
      }
    }
    // ----------------------------------------------------------------

    setOrders(prev => prev.map(o => o.id === id ? { ...o, ...updatedFields } : o));
    const orderResult = await persistOrReload(
      () => supabase.from('orders').update(updatedFields).eq('id', id),
      'actualizar el pedido'
    );
    if (orderResult.error) return null;
    
    // Automatically keep the corresponding Delivery Note in sync
    if (updatedFields.items || updatedFields.total !== undefined || updatedFields.clientId || updatedFields.deliveredTo !== undefined) {
      const notesToSync = deliveryNotes
        .filter(dn => dn.orderId === id)
        .map(dn => ({
          id: dn.id,
          updates: {
            items: updatedFields.items || dn.items,
            total: updatedFields.total !== undefined ? updatedFields.total : dn.total,
            clientId: updatedFields.clientId || dn.clientId,
            deliveredTo: updatedFields.deliveredTo !== undefined ? updatedFields.deliveredTo : dn.deliveredTo,
            date: updatedFields.date || dn.date
          }
        }));

      setDeliveryNotes(prev => prev.map(dn => {
        const sync = notesToSync.find(note => note.id === dn.id);
        return sync ? { ...dn, ...sync.updates } : dn;
      }));

      for (const note of notesToSync) {
        const noteResult = await persistOrReload(
          () => supabase.from('delivery_notes').update(note.updates).eq('id', note.id),
          'sincronizar el albarán del pedido'
        );
        if (noteResult.error) return null;
      }
    }
    return true;
  };

  const deleteOrder = async (id) => {
    const associatedNotes = deliveryNotes.filter(dn => dn.orderId === id);
    setOrders(prev => prev.filter(o => o.id !== id));
    setDeliveryNotes(prev => prev.filter(dn => dn.orderId !== id));
    
    const notesResult = await persistOrReload(
      () => supabase.from('delivery_notes').delete().eq('orderId', id),
      'eliminar el albarán asociado al pedido'
    );
    if (notesResult.error) return null;
    const orderResult = await persistOrReload(
      () => supabase.from('orders').delete().eq('id', id),
      'eliminar el pedido'
    );
    if (orderResult.error && associatedNotes.length > 0) {
      await persistOrReload(
        () => supabase.from('delivery_notes').insert(associatedNotes),
        'restaurar el albarán asociado'
      );
      await refreshData({ force: true });
    }
    return orderResult;
  };

  const markOrderAsDelivered = async (orderId, deliveredTo, editedItems = null) => {
    const order = orders.find(o => o.id === orderId);
    if (!order || order.status === 'DELIVERED') return null;

    const finalItems = editedItems || order.items;
    
    // Calculate new total if items were edited
    let finalTotal = order.total;
    if (editedItems) {
      finalTotal = editedItems.reduce((acc, item) => {
        const lineTotal = (Number(item.price) * Number(item.quantity)) * (1 - (Number(item.discount || 0)) / 100);
        return acc + lineTotal;
      }, 0);
    }

    // Update order items and total locally and in Supabase if edited during delivery
    // (do NOT mark as DELIVERED yet)
    const orderUpdate = { deliveredTo };
    if (editedItems) {
      orderUpdate.items = editedItems;
      orderUpdate.total = finalTotal;
    }
    await updateOrderList(orderId, orderUpdate);

    // Calculate sequential Albaran Number
    const date = new Date();
    const year = date.getFullYear();
    const albaranesThisYear = deliveryNotes.filter(dn => new Date(dn.date).getFullYear() === year);
    const lastSequence = albaranesThisYear.reduce((max, note) => {
      const sequence = Number(String(note.albaranNumber || '').split('-').pop());
      return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
    }, 0);
    const seq = String(lastSequence + 1).padStart(4, '0');
    const albaranNumber = `${year}-${seq}`;

    const tempId = createId();
    const client = clients.find(c => c.id === order.clientId);
    const newAlbaran = {
      id: tempId,
      albaranNumber: albaranNumber,
      orderId: order.id,
      clientId: order.clientId,
      clientName: client ? client.name : '',
      clientCommercialName: client ? client.commercialName : '',
      items: finalItems,
      total: finalTotal,
      date: order.date || new Date().toISOString(),
      status: 'UNBILLED',
      deliveredTo: deliveredTo || '',
      signature: null,
      sent: false
    };

    return newAlbaran;
  };

  const saveSignedDeliveryNote = async (albaran, signatureBase64) => {
    const signedAlbaran = { ...albaran, signature: signatureBase64 };
    
    // Insert into Supabase delivery_notes table
    const { data, error } = await persistOrReload(
      () => supabase.from('delivery_notes').insert([signedAlbaran]).select(),
      'guardar el albarán firmado'
    );
    if (!error && data) {
       // Update local state with the saved albarán
       setDeliveryNotes(prev => [...prev, data[0]]);
       
       // Update order status to DELIVERED in Supabase and local state
        const orderUpdated = await updateOrderList(albaran.orderId, {
          status: 'DELIVERED',
          deliveredTo: albaran.deliveredTo,
          items: albaran.items,
          total: albaran.total
        });
        if (!orderUpdated) {
          await persistOrReload(
            () => supabase.from('delivery_notes').delete().eq('id', data[0].id),
            'revertir el albarán incompleto'
          );
          return null;
        }
       
       return data[0];
    } else {
       console.error('Error saving signed delivery note:', error);
       throw new Error(error?.message || 'Error al guardar el albarán en la base de datos');
    }
  };

  // Delivery Notes
  const updateDeliveryNote = async (id, updatedFields) => {
    setDeliveryNotes(prev => prev.map(n => n.id === id ? { ...n, ...updatedFields } : n));
    return persistOrReload(
      () => supabase.from('delivery_notes').update(updatedFields).eq('id', id),
      'actualizar el albarán'
    );
  };

  const deleteDeliveryNote = async (id) => {
    setDeliveryNotes(prev => prev.filter(n => n.id !== id));
    return persistOrReload(
      () => supabase.from('delivery_notes').delete().eq('id', id),
      'eliminar el albarán'
    );
  };

  const markDeliveryNoteAsBilled = async (ids) => {
    setDeliveryNotes(prev => prev.map(n => ids.includes(n.id) ? { ...n, status: 'BILLED' } : n));
    return persistOrReload(
      () => supabase.from('delivery_notes').update({ status: 'BILLED' }).in('id', ids),
      'marcar los albaranes como facturados'
    );
  };

  const markInvoiceAsPaid = async (id, isPaid) => {
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, isPaid } : i));
    return persistOrReload(
      () => supabase.from('invoices').update({ isPaid }).eq('id', id),
      'actualizar el estado de pago de la factura'
    );
  };

  // Invoices
  const addInvoice = async (invoiceObj, deliveryNoteIds) => {
    const tempId = createId();
    const newInvoice = { ...invoiceObj, id: tempId };
    setInvoices(prev => [...prev, newInvoice]);
    
    const billedResult = await markDeliveryNoteAsBilled(deliveryNoteIds);
    if (billedResult.error) return null;

    const { data, error } = await persistOrReload(
      () => supabase.from('invoices').insert([newInvoice]).select(),
      'guardar la factura'
    );
    if (error) {
      await persistOrReload(
        () => supabase.from('delivery_notes').update({ status: 'UNBILLED' }).in('id', deliveryNoteIds),
        'revertir el estado de los albaranes'
      );
      return null;
    }
    if (data) setInvoices(prev => prev.map(i => i.id === tempId ? data[0] : i));
    return data?.[0] || newInvoice;
  };
  
  const deleteInvoice = async (id) => {
    const invoiceToDelete = invoices.find(i => i.id === id);
    if (invoiceToDelete) {
      setDeliveryNotes(prev => prev.map(n => 
        invoiceToDelete.deliveryNoteIds.includes(n.id) 
        ? { ...n, status: 'UNBILLED' } 
        : n
      ));
      setInvoices(prev => prev.filter(i => i.id !== id));
      
      const notesResult = await persistOrReload(
        () => supabase.from('delivery_notes').update({ status: 'UNBILLED' }).in('id', invoiceToDelete.deliveryNoteIds),
        'restaurar los albaranes de la factura'
      );
      if (notesResult.error) return null;
      const invoiceResult = await persistOrReload(
        () => supabase.from('invoices').delete().eq('id', id),
        'eliminar la factura'
      );
      if (invoiceResult.error) {
        await persistOrReload(
          () => supabase.from('delivery_notes').update({ status: 'BILLED' }).in('id', invoiceToDelete.deliveryNoteIds),
          'revertir el estado de los albaranes'
        );
      }
      return invoiceResult;
    }
  };

  // Expenses
  const addExpense = async (expenseObj) => {
      const tempId = createId();
      const newExpense = { ...expenseObj, id: tempId };
      setExpenses(prev => [...prev, newExpense]);
  
      const dbExpense = {
        id: tempId,
        date: expenseObj.date,
        category: expenseObj.category,
        amount: expenseObj.total,
        isPaid: expenseObj.isPaid,
        concept: expenseObj.concept,
        baseAmount: expenseObj.baseAmount,
        ivaPercentage: expenseObj.ivaPercentage ?? 21,
        total: expenseObj.total,
        paymentMethod: expenseObj.paymentMethod || 'Transferencia'
      };

      const { data, error } = await persistOrReload(
        () => supabase.from('expenses').insert([dbExpense]).select(),
        'guardar el gasto'
      );
      if (!error && data) {
        // Retain local mapped properties, just update the DB id and createdAt if needed
        setExpenses(prev => prev.map(e => e.id === tempId ? { ...newExpense, createdAt: data[0].createdAt } : e));
      }
      return error ? null : data?.[0] || newExpense;
    };

  const updateExpense = async (id, updatedFields) => {
      setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...updatedFields } : e));
      
      const exp = expenses.find(e => e.id === id);
      const merged = { ...exp, ...updatedFields };
      
      const dbExpense = {
        date: merged.date,
        category: merged.category,
        amount: merged.total,
        isPaid: merged.isPaid,
        concept: merged.concept,
        baseAmount: merged.baseAmount,
        ivaPercentage: merged.ivaPercentage ?? 21,
        total: merged.total,
        paymentMethod: merged.paymentMethod || 'Transferencia'
      };

      return persistOrReload(
        () => supabase.from('expenses').update(dbExpense).eq('id', id),
        'actualizar el gasto'
      );
    };

  const deleteExpense = async (id) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
    return persistOrReload(
      () => supabase.from('expenses').delete().eq('id', id),
      'eliminar el gasto'
    );
  };

  const markExpenseAsPaid = async (id, isPaid) => {
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, isPaid } : e));
    return persistOrReload(
      () => supabase.from('expenses').update({ isPaid }).eq('id', id),
      'actualizar el estado de pago del gasto'
    );
  };

    const importData = async (dataObject) => {
    try {
      const imports = [
        ['clients', dataObject.clients],
        ['products', dataObject.products],
        ['orders', dataObject.orders],
        ['delivery_notes', dataObject.deliveryNotes],
        ['invoices', dataObject.invoices],
        ['expenses', dataObject.expenses]
      ];

      for (const [table, rows] of imports) {
        if (!rows?.length) continue;
        const result = await persistOrReload(
          () => supabase.from(table).insert(rows),
          `importar los datos de ${table}`
        );
        if (result.error) return false;
      }

      await refreshData({ force: true });
      
      alert("¡Datos subidos a Supabase y sincronizados con éxito!");
      return true;
    } catch (e) {
      console.error(e);
      alert("Error importando datos. Abre F12 para ver los detalles.");
      return false;
    }
  };

  return (
    <DataContext.Provider value={{
      companyProfile, updateCompanyProfile, companyLogo, updateCompanyLogo,

      providers, addProvider, updateProvider, deleteProvider,
        articles, stockEntries, stockLots, purchaseDeliveryNotes, purchaseDeliveryNoteLines,
        addArticle, updateArticle, deleteArticle, addStockEntry, updateStockEntry, deleteStockEntry,
        receivePurchaseDeliveryNote, deletePurchaseDeliveryNote,
        cropTypes, addCropType, updateCropType, deleteCropType,
        seeds, addSeed, updateSeed, deleteSeed,
        seedInventory, addSeedInventory, updateSeedInventory, deleteSeedInventory,
        substrates, addSubstrate, deleteSubstrate,
        substrateInventory, addSubstrateInventory, deleteSubstrateInventory,
        crops, addCrop, sowCrop, updateCrop, deleteCrop, advanceCropStatus, reverseCropStatus, setCropPhase, discardCrop,
        harvestTargets, addHarvestTarget, updateHarvestTarget, deleteHarvestTarget,
      harvests, addHarvest, updateHarvest, deleteHarvest,
      dailyLogs, addDailyLog, updateDailyLog, deleteDailyLog,

      clients, addClient, updateClient, deleteClient,
      productMovements, addProductMovement,
        products, addProduct, updateProduct, deleteProduct,
      orders, addOrder, updateOrderList, deleteOrder, markOrderAsDelivered, saveSignedDeliveryNote,
      deliveryNotes, updateDeliveryNote, deleteDeliveryNote,
      invoices, addInvoice, deleteInvoice, importData, markInvoiceAsPaid,
      expenses, addExpense, updateExpense, deleteExpense, markExpenseAsPaid,
      refreshData
    }}>
      {children}
    </DataContext.Provider>
  );
};

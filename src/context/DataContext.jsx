import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../config/supabase';

export const DataContext = createContext();

export const useData = () => useContext(DataContext);

export const DataProvider = ({ children }) => {
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [deliveryNotes, setDeliveryNotes] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [companyProfile, setCompanyProfile] = useState({
    fiscalName: 'GREENCODE',
    ownerName: 'ANTONIO JOSÉ GÓMEZ LÓPEZ',
    nif: '48351348N',
    address: 'CALLE SANTA FAZ 41',
    city: 'ASPE',
    province: 'ALICANTE',
    postalCode: '',
    bankAccount: ''
  });
  const [companyLogo, setCompanyLogo] = useState(null);

  const [providers, setProviders] = useState([]);
  const [articles, setArticles] = useState([]);
  const [stockEntries, setStockEntries] = useState([]);
  const [cropTypes, setCropTypes] = useState([]);

  const [crops, setCrops] = useState([]);
  const [harvestTargets, setHarvestTargets] = useState([]);
  const [harvests, setHarvests] = useState([]);
  const [dailyLogs, setDailyLogs] = useState([]);


  // Load Initial Data from Supabase
  const refreshData = async () => {
      try {
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
          { data: cropTypesData },
          { data: cropsData },
          { data: harvestTargetsData },
          { data: harvestsData },
          { data: dailyLogsData }
        ] = await Promise.all([
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
          supabase.from('crop_types').select('*'),
          supabase.from('crops').select('*').order('createdAt', { ascending: true }),
          supabase.from('harvest_targets').select('*').order('createdAt', { ascending: true }),
          supabase.from('harvests').select('*').order('createdAt', { ascending: true }),
          supabase.from('daily_logs').select('*').order('date', { ascending: true }),
        ]);

        if (clientsData) setClients(clientsData);
        if (productsData) setProducts(productsData);
        if (ordersData) setOrders(ordersData);
        if (notesData) setDeliveryNotes(notesData);
        if (invoicesData) setInvoices(invoicesData);
        if (expensesData) {
            const mappedExpenses = expensesData.map(exp => {
              let concept = exp.concept || '';
              let paymentMethod = 'Transferencia';
              let ivaPercentage = 21;
              if (concept.includes('|||')) {
                const parts = concept.split('|||');
                concept = parts[0].trim();
                paymentMethod = parts[1] ? parts[1].trim() : 'Transferencia';
                ivaPercentage = parts[2] ? parseFloat(parts[2].trim()) : 21;
              }
              const total = exp.amount || 0;
              const baseAmount = total / (1 + ivaPercentage / 100);
              
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
        if (cropTypesData) setCropTypes(cropTypesData);
        if (cropsData) setCrops(cropsData);
        if (harvestTargetsData) setHarvestTargets(harvestTargetsData);
        if (harvestsData) setHarvests(harvestsData);
        if (dailyLogsData) setDailyLogs(dailyLogsData);

        if (profileData && profileData.length > 0) {
          setCompanyProfile(profileData[0]);
          localStorage.setItem('crm_company_profile', JSON.stringify(profileData[0]));
        }
      } catch (err) {
        console.error("Error loading data from Supabase:", err);
      }
    };

  useEffect(() => {
    refreshData();
  }, []);

  
  // Provider
  const addProvider = async (item) => {
    const tempId = Date.now().toString();
    const newItem = { ...item, id: tempId };
    setProviders(prev => [...prev, newItem]);
    const { data, error } = await supabase.from('providers').insert([newItem]).select();
      if (error) {
        alert('Error critico en Supabase (providers): ' + error.message);
        setProviders(prev => prev.filter(i => i.id !== tempId));
        return tempId;
      }
      if (data) setProviders(prev => prev.map(i => i.id === tempId ? data[0] : i));
    return tempId;
  };
  const updateProvider = async (id, updatedFields) => {
    setProviders(prev => prev.map(i => i.id === id ? { ...i, ...updatedFields } : i));
    await supabase.from('providers').update(updatedFields).eq('id', id);
  };
  const deleteProvider = async (id) => {
    setProviders(prev => prev.filter(i => i.id !== id));
    await supabase.from('providers').delete().eq('id', id);
  };

  // Unified Articles and Stock Entries
    const addArticle = async (article) => {
      const tempId = Date.now().toString();
      const newItem = { ...article, id: tempId };
      setArticles(prev => [...prev, newItem]);
      const { data, error } = await supabase.from('articles').insert([newItem]).select();
      if (error) {
        alert('Error guardando en Supabase: ' + error.message);
        setArticles(prev => prev.filter(i => i.id !== tempId));
        return tempId;
      }
      if (data) setArticles(prev => prev.map(i => i.id === tempId ? data[0] : i));
      return tempId;
    };
    const updateArticle = async (id, updatedFields) => {
      setArticles(prev => prev.map(i => i.id === id ? { ...i, ...updatedFields } : i));
      await supabase.from('articles').update(updatedFields).eq('id', id);
    };
    const deleteArticle = async (id) => {
      setArticles(prev => prev.filter(i => i.id !== id));
      await supabase.from('articles').delete().eq('id', id);
    };

    const addStockEntry = async (entry) => {
      const tempId = Date.now().toString();
      const newItem = { ...entry, id: tempId };
      setStockEntries(prev => [...prev, newItem]);
      const { data, error } = await supabase.from('stock_entries').insert([newItem]).select();
      if (error) {
        alert('Error guardando en Supabase: ' + error.message);
        setStockEntries(prev => prev.filter(i => i.id !== tempId));
        return tempId;
      }
      if (data) setStockEntries(prev => prev.map(i => i.id === tempId ? data[0] : i));
      return tempId;
    };
    const updateStockEntry = async (id, updatedFields) => {
      setStockEntries(prev => prev.map(i => i.id === id ? { ...i, ...updatedFields } : i));
      await supabase.from('stock_entries').update(updatedFields).eq('id', id);
    };
    const deleteStockEntry = async (id) => {
      setStockEntries(prev => prev.filter(i => i.id !== id));
      await supabase.from('stock_entries').delete().eq('id', id);
    };

    
    const addCropType = async (item) => {
      const tempId = Date.now().toString();
      const newItem = { ...item, id: tempId };
      setCropTypes(prev => [...prev, newItem]);
      const { data, error } = await supabase.from('crop_types').insert([newItem]).select();
      if (error) {
        alert('Error guardando en Supabase: ' + error.message);
        setCropTypes(prev => prev.filter(i => i.id !== tempId));
        return tempId;
      }
      if (data) setCropTypes(prev => prev.map(i => i.id === tempId ? data[0] : i));
      return tempId;
    };
    const updateCropType = async (id, updatedFields) => {
      setCropTypes(prev => prev.map(i => i.id === id ? { ...i, ...updatedFields } : i));
      await supabase.from('crop_types').update(updatedFields).eq('id', id);
    };
    const deleteCropType = async (id) => {
      setCropTypes(prev => prev.filter(i => i.id !== id));
      await supabase.from('crop_types').delete().eq('id', id);
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
      const tempId = Date.now().toString();
      const newItem = { ...item, id: tempId };
      setCrops(prev => [...prev, newItem]);
      const { data, error } = await supabase.from('crops').insert([newItem]).select();
      if (error) {
        console.error("Error inserting crop:", error);
      }
      if (!error && data) setCrops(prev => prev.map(i => i.id === tempId ? data[0] : i));
      return tempId;
    };

  const sowCrop = async (newCrop) => {
    // 1. Get the CropType definition
    const cType = cropTypes.find(c => c.id === newCrop.cropTypeId);
    if (!cType) throw new Error("Ficha de cultivo no encontrada.");

    const trays = Number(newCrop.traysCount || 1);
    const batchNum = `S-${Date.now().toString().slice(-6)}`;
    
    // 2. Create the Crop Record using existing DB columns: seedId, datePlanted, batchNumber
    const cropRecord = {
      seedId: cType.id, // we store cropTypeId in seedId to match schema
      traysCount: trays,
      status: cType.soakingHours > 0 ? 'SOAKING' : 'SOWED',
      datePlanted: new Date().toISOString(),
      batchNumber: batchNum
    };
    
    await addCrop(cropRecord);

    // 3. Deduct Stock (Seeds)
    if (cType.seedId && cType.seedGrams > 0) {
      await addStockEntry({
        articleId: cType.seedId,
        quantity: -(Number(cType.seedGrams) * trays),
        batchNumber: 'USO_CULTIVO',
        purchaseDate: new Date().toISOString(),
        price: 0
      });
    }

    // 4. Deduct Stock (Substrate)
    if (cType.substrateId && cType.substrateGrams > 0) {
      await addStockEntry({
        articleId: cType.substrateId,
        quantity: -(Number(cType.substrateGrams) * trays),
        batchNumber: 'USO_CULTIVO',
        purchaseDate: new Date().toISOString(),
        price: 0
      });
    }
  };

  const updateCrop = async (id, updatedFields) => {
    setCrops(prev => prev.map(i => i.id === id ? { ...i, ...updatedFields } : i));
    await supabase.from('crops').update(updatedFields).eq('id', id);
  };
  const deleteCrop = async (id) => {
    setCrops(prev => prev.filter(i => i.id !== id));
    await supabase.from('crops').delete().eq('id', id);
  };

  const advanceCropStatus = async (crop) => {
    const sequence = ['SOAKING', 'GERMINATING', 'GROWING', 'HARVESTED'];
    const currentIdx = sequence.indexOf(crop.status ? crop.status.toUpperCase() : 'SOWED');
    if (currentIdx === -1) {
      // If it's SOWED, advance to GERMINATING
      await updateCrop(crop.id, { status: 'GERMINATING' });
    } else if (currentIdx < sequence.length - 1) {
      await updateCrop(crop.id, { status: sequence[currentIdx + 1] });
    }
  };

  const discardCrop = async (crop) => {
    if (window.confirm("¿Seguro que quieres descartar esta bandeja por completo?")) {
      await updateCrop(crop.id, { status: 'DISCARDED' });
    }
  };

  // HarvestTarget
  const addHarvestTarget = async (item) => {
    const tempId = Date.now().toString();
    const newItem = { ...item, id: tempId };
    setHarvestTargets(prev => [...prev, newItem]);
    const { data, error } = await supabase.from('harvest_targets').insert([newItem]).select();
    if (!error && data) setHarvestTargets(prev => prev.map(i => i.id === tempId ? data[0] : i));
    return tempId;
  };
  const updateHarvestTarget = async (id, updatedFields) => {
    setHarvestTargets(prev => prev.map(i => i.id === id ? { ...i, ...updatedFields } : i));
    await supabase.from('harvest_targets').update(updatedFields).eq('id', id);
  };
  const deleteHarvestTarget = async (id) => {
    setHarvestTargets(prev => prev.filter(i => i.id !== id));
    await supabase.from('harvest_targets').delete().eq('id', id);
  };

  // Harvest
  const addHarvest = async (item) => {
    const tempId = Date.now().toString();
    const newItem = { ...item, id: tempId };
    setHarvests(prev => [...prev, newItem]);
    const { data, error } = await supabase.from('harvests').insert([newItem]).select();
    if (!error && data) setHarvests(prev => prev.map(i => i.id === tempId ? data[0] : i));
    return tempId;
  };
  const updateHarvest = async (id, updatedFields) => {
    setHarvests(prev => prev.map(i => i.id === id ? { ...i, ...updatedFields } : i));
    await supabase.from('harvests').update(updatedFields).eq('id', id);
  };
  const deleteHarvest = async (id) => {
    setHarvests(prev => prev.filter(i => i.id !== id));
    await supabase.from('harvests').delete().eq('id', id);
  };

  // DailyLog
  const addDailyLog = async (item) => {
    const tempId = Date.now().toString();
    const newItem = { ...item, id: tempId };
    setDailyLogs(prev => [...prev, newItem]);
    const { data, error } = await supabase.from('daily_logs').insert([newItem]).select();
    if (!error && data) setDailyLogs(prev => prev.map(i => i.id === tempId ? data[0] : i));
    return tempId;
  };
  const updateDailyLog = async (id, updatedFields) => {
    setDailyLogs(prev => prev.map(i => i.id === id ? { ...i, ...updatedFields } : i));
    await supabase.from('daily_logs').update(updatedFields).eq('id', id);
  };
  const deleteDailyLog = async (id) => {
    setDailyLogs(prev => prev.filter(i => i.id !== id));
    await supabase.from('daily_logs').delete().eq('id', id);
  };

  // Company Profile
  const updateCompanyProfile = async (newProfile) => {
    const profile = { ...companyProfile, ...newProfile };
    setCompanyProfile(profile);
    localStorage.setItem('crm_company_profile', JSON.stringify(profile));
    
    if (companyProfile.id) {
      await supabase.from('company_profile').update(newProfile).eq('id', companyProfile.id);
    } else {
      const { data } = await supabase.from('company_profile').insert([newProfile]).select();
      if (data && data.length > 0) setCompanyProfile(data[0]);
    }
  };

  const updateCompanyLogo = (base64) => {
    setCompanyLogo(base64);
    if (base64) localStorage.setItem('crm_company_logo', JSON.stringify(base64));
    else localStorage.removeItem('crm_company_logo');
  };
  
  useEffect(() => {
    const saved = localStorage.getItem('crm_company_logo');
    if (saved) setCompanyLogo(JSON.parse(saved));
  }, []);

  // Clients
  const addClient = async (client) => {
    const nextNum = clients.length > 0 ? Math.max(...clients.map(c => parseInt(c.clientNumber || 0))) + 1 : 1;
    const clientNumber = nextNum.toString().padStart(2, '0');
    
    const tempId = Date.now().toString();
    const newClient = { ...client, clientNumber, id: tempId };
    setClients(prev => [...prev, newClient]);

    const { data, error } = await supabase.from('clients').insert([newClient]).select();
    if (!error && data) {
      setClients(prev => prev.map(c => c.id === tempId ? data[0] : c));
    }
  };

  const updateClient = async (id, updatedClient) => {
    setClients(prev => prev.map(c => c.id === id ? { ...c, ...updatedClient } : c));
    await supabase.from('clients').update(updatedClient).eq('id', id);
  };
  
  const deleteClient = async (id) => {
     setClients(prev => prev.filter(c => c.id !== id));
     await supabase.from('clients').delete().eq('id', id);
  };

  // Products
  const addProduct = async (product) => {
    const tempId = Date.now().toString();
    setProducts(prev => [...prev, { ...product, id: tempId }]);
    
    const { data, error } = await supabase.from('products').insert([{ ...product, id: tempId }]).select();
    if (!error && data) {
      setProducts(prev => prev.map(p => p.id === tempId ? data[0] : p));
    }
  };

  const updateProduct = async (id, updatedProduct) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updatedProduct } : p));
    await supabase.from('products').update(updatedProduct).eq('id', id);
  };
  
  const deleteProduct = async (id) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    await supabase.from('products').delete().eq('id', id);
  };

  // Orders
  const addOrder = async (order) => {
    const tempId = Date.now().toString();
    const newOrder = { ...order, id: tempId, status: 'PENDING', date: order.date || new Date().toISOString() };
    setOrders(prev => [...prev, newOrder]);

    const { data, error } = await supabase.from('orders').insert([newOrder]).select();
    if (!error && data) {
      setOrders(prev => prev.map(o => o.id === tempId ? data[0] : o));
    }
  };

  const updateOrderList = async (id, updatedFields) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, ...updatedFields } : o));
    await supabase.from('orders').update(updatedFields).eq('id', id);
    
    // Automatically keep the corresponding Delivery Note in sync
    if (updatedFields.items || updatedFields.total !== undefined || updatedFields.clientId || updatedFields.deliveredTo !== undefined) {
      setDeliveryNotes(prev => prev.map(dn => {
        if (dn.orderId === id) {
          const dnUpdates = {
            items: updatedFields.items || dn.items,
            total: updatedFields.total !== undefined ? updatedFields.total : dn.total,
            clientId: updatedFields.clientId || dn.clientId,
            deliveredTo: updatedFields.deliveredTo !== undefined ? updatedFields.deliveredTo : dn.deliveredTo,
            date: updatedFields.date || dn.date
          };
          // Fire and forget update
          supabase.from('delivery_notes').update(dnUpdates).eq('id', dn.id).then();
          return { ...dn, ...dnUpdates };
        }
        return dn;
      }));
    }
  };

  const deleteOrder = async (id) => {
    setOrders(prev => prev.filter(o => o.id !== id));
    setDeliveryNotes(prev => prev.filter(dn => dn.orderId !== id));
    
    await supabase.from('delivery_notes').delete().eq('orderId', id);
    await supabase.from('orders').delete().eq('id', id);
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
    const seq = String(albaranesThisYear.length + 1).padStart(4, '0');
    const albaranNumber = `${year}-${seq}`;

    const tempId = Date.now().toString();
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
    const { data, error } = await supabase.from('delivery_notes').insert([signedAlbaran]).select();
    if (!error && data) {
       // Update local state with the saved albarán
       setDeliveryNotes(prev => [...prev, data[0]]);
       
       // Update order status to DELIVERED in Supabase and local state
       await updateOrderList(albaran.orderId, { 
         status: 'DELIVERED', 
         deliveredTo: albaran.deliveredTo 
       });
       
       return data[0];
    } else {
       console.error('Error saving signed delivery note:', error);
       throw new Error(error?.message || 'Error al guardar el albarán en la base de datos');
    }
  };

  // Delivery Notes
  const updateDeliveryNote = async (id, updatedFields) => {
    setDeliveryNotes(prev => prev.map(n => n.id === id ? { ...n, ...updatedFields } : n));
    await supabase.from('delivery_notes').update(updatedFields).eq('id', id);
  };

  const deleteDeliveryNote = async (id) => {
    setDeliveryNotes(prev => prev.filter(n => n.id !== id));
    await supabase.from('delivery_notes').delete().eq('id', id);
  };

  const markDeliveryNoteAsBilled = async (ids) => {
    setDeliveryNotes(prev => prev.map(n => ids.includes(n.id) ? { ...n, status: 'BILLED' } : n));
    await supabase.from('delivery_notes').update({ status: 'BILLED' }).in('id', ids);
  };

  const markInvoiceAsPaid = async (id, isPaid) => {
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, isPaid } : i));
    await supabase.from('invoices').update({ isPaid }).eq('id', id);
  };

  // Invoices
  const addInvoice = async (invoiceObj, deliveryNoteIds) => {
    const tempId = Date.now().toString();
    const newInvoice = { ...invoiceObj, id: tempId };
    setInvoices(prev => [...prev, newInvoice]);
    
    markDeliveryNoteAsBilled(deliveryNoteIds);

    const { data, error } = await supabase.from('invoices').insert([newInvoice]).select();
    if (!error && data) {
       setInvoices(prev => prev.map(i => i.id === tempId ? data[0] : i));
    }
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
      
      await supabase.from('delivery_notes').update({ status: 'UNBILLED' }).in('id', invoiceToDelete.deliveryNoteIds);
      await supabase.from('invoices').delete().eq('id', id);
    }
  };

  // Expenses
  const addExpense = async (expenseObj) => {
      const tempId = Date.now().toString();
      const newExpense = { ...expenseObj, id: tempId };
      setExpenses(prev => [...prev, newExpense]);
  
      const dbExpense = {
        id: tempId,
        date: expenseObj.date,
        category: expenseObj.category,
        amount: expenseObj.total,
        isPaid: expenseObj.isPaid,
        concept: `${expenseObj.concept} ||| ${expenseObj.paymentMethod || 'Transferencia'} ||| ${expenseObj.ivaPercentage || 21}`
      };

      const { data, error } = await supabase.from('expenses').insert([dbExpense]).select();
      if (!error && data) {
        // Retain local mapped properties, just update the DB id and createdAt if needed
        setExpenses(prev => prev.map(e => e.id === tempId ? { ...newExpense, createdAt: data[0].createdAt } : e));
      } else {
        console.error("Error inserting expense:", error);
      }
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
        concept: `${merged.concept} ||| ${merged.paymentMethod || 'Transferencia'} ||| ${merged.ivaPercentage || 21}`
      };

      await supabase.from('expenses').update(dbExpense).eq('id', id);
    };

  const deleteExpense = async (id) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
    await supabase.from('expenses').delete().eq('id', id);
  };

  const markExpenseAsPaid = async (id, isPaid) => {
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, isPaid } : e));
    await supabase.from('expenses').update({ isPaid }).eq('id', id);
  };

    const importData = async (dataObject) => {
    try {
      if (dataObject.clients && dataObject.clients.length > 0) await supabase.from('clients').insert(dataObject.clients);
      if (dataObject.products && dataObject.products.length > 0) await supabase.from('products').insert(dataObject.products);
      if (dataObject.orders && dataObject.orders.length > 0) await supabase.from('orders').insert(dataObject.orders);
      if (dataObject.deliveryNotes && dataObject.deliveryNotes.length > 0) await supabase.from('delivery_notes').insert(dataObject.deliveryNotes);
      if (dataObject.invoices && dataObject.invoices.length > 0) await supabase.from('invoices').insert(dataObject.invoices);
      if (dataObject.expenses && dataObject.expenses.length > 0) await supabase.from('expenses').insert(dataObject.expenses);
      
      alert("¡Datos subidos a Supabase con éxito! Recarga la página para verlos.");
    } catch (e) {
      console.error(e);
      alert("Error importando datos. Abre F12 para ver los detalles.");
    }
  };

  return (
    <DataContext.Provider value={{
      companyProfile, updateCompanyProfile, companyLogo, updateCompanyLogo,

      providers, addProvider, updateProvider, deleteProvider,
        articles, stockEntries, addArticle, updateArticle, deleteArticle, addStockEntry, updateStockEntry, deleteStockEntry,
        cropTypes, addCropType, updateCropType, deleteCropType,
        seeds, addSeed, updateSeed, deleteSeed,
        seedInventory, addSeedInventory, updateSeedInventory, deleteSeedInventory,
        crops, addCrop, sowCrop, updateCrop, deleteCrop, advanceCropStatus, discardCrop,
        harvestTargets, addHarvestTarget, updateHarvestTarget, deleteHarvestTarget,
      harvests, addHarvest, updateHarvest, deleteHarvest,
      dailyLogs, addDailyLog, updateDailyLog, deleteDailyLog,

      clients, addClient, updateClient, deleteClient,
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

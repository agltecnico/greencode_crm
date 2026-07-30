/* eslint-disable no-unused-vars */
import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { generateLabelPDF } from '../utils/labelPdf.js';
import EmployeeTasks from '../components/EmployeeTasks';
import TraceabilityExplorer from '../components/TraceabilityExplorer';
import Supplies from './Supplies';
import '../crops.css';
import React from 'react';
import Swal from 'sweetalert2';
import { useAdminMode } from '../context/AdminModeContext';

const createHarvestBatchNumber = () =>
  `L-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;

const toLocalDateTimeInputValue = (date = new Date()) => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
};

const suggestedStatusForSowingDate = (cropType, dateValue) => {
  if (!cropType || !dateValue) return 'GERMINATING';
  const elapsed = calendarDaysSince(dateValue);
  const cycle = getCropCycleOffsets(cropType);
  if (cycle.soak > 0 && elapsed < cycle.soak) return 'SOAKING';
  if (elapsed < cycle.darknessStart) return 'GERMINATING';
  if (cycle.darkness > 0 && elapsed < cycle.lightStart) return 'DARKNESS';
  if (elapsed < cycle.harvest) return 'LIGHT';
  return 'READY';
};

const CROP_PHASE_OPTIONS = [
  ['SOAKING', 'Remojo'],
  ['GERMINATING', 'Germinación'],
  ['DARKNESS', 'Oscuridad'],
  ['LIGHT', 'Luz'],
  ['READY', 'Lista para cosechar']
];

const calendarDaysSince = (dateValue, now = new Date()) => {
  if (!dateValue) return 0;
  const planted = new Date(dateValue);
  if (Number.isNaN(planted.getTime())) return 0;
  const plantedDay = new Date(planted.getFullYear(), planted.getMonth(), planted.getDate());
  const currentDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((currentDay - plantedDay) / 86_400_000));
};

const formatSowingDateTime = (dateValue) => {
  if (!dateValue) return 'Sin fecha';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'Fecha no válida';
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
};

const startOfHarvestWeek = dateValue => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  const day = date.getDay();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  return date;
};

const getCropCycleOffsets = (cropType) => {
  const soak = Number(cropType?.soakingHours || 0) > 0 ? Math.max(1, Math.ceil(Number(cropType.soakingHours) / 24)) : 0;
  const germination = Number(cropType?.germinationDays || 0);
  const darkness = Number(cropType?.darknessDays || 0);
  const light = Number(cropType?.lightDays || 0);
  return {
    soak,
    germination,
    darkness,
    light,
    germinationStart: soak,
    darknessStart: soak + germination,
    lightStart: soak + germination + darkness,
    harvest: soak + germination + darkness + light
  };
};

const weekDay = (value) => ((Number(value) % 7) + 7) % 7;
const PLANNER_DAYS = [
  { idx: 1, name: 'Lunes', short: 'Lun' },
  { idx: 2, name: 'Martes', short: 'Mar' },
  { idx: 3, name: 'Miércoles', short: 'Mié' },
  { idx: 4, name: 'Jueves', short: 'Jue' },
  { idx: 5, name: 'Viernes', short: 'Vie' },
  { idx: 6, name: 'Sábado', short: 'Sáb' },
  { idx: 0, name: 'Domingo', short: 'Dom' }
];

const plannerDayName = (dayIndex, short = false) =>
  PLANNER_DAYS.find(day => day.idx === Number(dayIndex))?.[short ? 'short' : 'name'] || '';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return <div style={{padding: '2rem', background: '#fee2e2', color: '#991b1b'}}><h2>¡Error en la Aplicación!</h2><p>Por favor, haz una captura de pantalla de este error y envíasela a la IA:</p><pre style={{background: 'white', padding: '1rem', marginTop: '1rem', overflowX: 'auto'}}>{this.state.error && this.state.error.toString()}</pre><pre style={{background: 'white', padding: '1rem', marginTop: '1rem', overflowX: 'auto'}}>{this.state.error && this.state.error.stack}</pre></div>;
    }
    return this.props.children;
  }
}


export default function Crops() {
  const navigate = useNavigate();
  const { requireAdmin } = useAdminMode();
  const { 
    crops, sowCrop, updateCrop, advanceCropStatus, setCropPhase, discardCrop, deleteCrop,
    stockEntries, stockLots, articles, seedVarieties, providers,
    cropTypes,
    harvestTargets, addHarvestTarget, updateHarvestTarget, deleteHarvestTarget,
    harvests, registerHarvest, editHarvestPackaging,
    productMovements,
    products, packagingFormats,
    orders, clients, updateOrderList
  } = useData();

  const cropVarietyId = (crop) => {
    const cropType = cropTypes?.find(ct => ct.id === crop?.cropTypeId || ct.id === crop?.seedId);
    if (cropType?.varietyId) return cropType.varietyId;
    const seedId = crop?.seedId || cropType?.seedId;
    return articles?.find(article => article.id === seedId)?.varietyId || null;
  };

  const productVarietyIds = (product) => {
    if (Array.isArray(product?.recipeVarieties) && product.recipeVarieties.length) {
      return product.recipeVarieties.map(item => item.varietyId);
    }
    return (product?.recipeSeeds || []).map(item =>
      articles?.find(article => article.id === item.seedId)?.varietyId
    ).filter(Boolean);
  };

  const readyCropsForProduct = (product) => {
    const allowedVarietyIds = productVarietyIds(product);
    if (allowedVarietyIds.length === 0) return [];
    return (crops || []).filter(crop =>
      crop.status === 'READY' &&
      Number(crop.traysCount || crop.trays || 0) > 0 &&
      allowedVarietyIds.includes(cropVarietyId(crop))
    );
  };

  const packagingArticlesForProduct = product =>
    (product?.packagingArticleIds || [])
      .map(articleId => articles?.find(article =>
        article.id === articleId
        && ['ENVASE', 'BANDEJA'].includes(article.type)
        && article.active !== false
      ))
      .filter(Boolean);

  const articlePhysicalStock = articleId =>
    (stockEntries || [])
      .filter(entry => entry.articleId === articleId)
      .reduce((sum, entry) => sum + Number(entry.quantity || 0), 0);

  const productHarvestAvailability = (product) => {
    const requiredVarietyIds = productVarietyIds(product);
    const readyCrops = readyCropsForProduct(product);
    const availableVarietyIds = new Set(readyCrops.map(cropVarietyId));
    const minimumVarieties = Math.min(4, requiredVarietyIds.length);
    return {
      configured: requiredVarietyIds.length > 0,
      packagingConfigured: packagingArticlesForProduct(product).length > 0,
      readyCrops,
      minimumVarieties,
      availableVarieties: availableVarietyIds.size,
      canHarvest: requiredVarietyIds.length > 0 && packagingArticlesForProduct(product).length > 0 && availableVarietyIds.size >= minimumVarieties,
      totalTrays: readyCrops.reduce((sum, crop) => sum + Number(crop.traysCount || crop.trays || 0), 0)
    };
  };

  
  const handleDeleteCrop = async (crop) => {
    if (!(await requireAdmin())) return;
    Swal.fire({
      title: '⚠️ ATENCIÓN ADMINISTRACIÓN',
      text: 'Vas a eliminar permanentemente este registro de cultivo. Esta acción no se puede deshacer y afectará a la trazabilidad histórica. ¿Estás absolutamente seguro?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        deleteCrop(crop.id);
        Swal.fire({ title: 'Eliminado', text: 'El registro ha sido eliminado.', icon: 'success', timer: 1500, showConfirmButton: false });
      }
    });
  };

  const [activeTab, setActiveTab] = useState('menu');
  const [sowTab, setSowTab] = useState('activos');
  const [harvestTab, setHarvestTab] = useState('cosechar');
  const [harvestHistoryPage, setHarvestHistoryPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [historySearch, setHistorySearch] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Modals state
  const [isSowModalOpen, setIsSowModalOpen] = useState(false);
  const [isHarvestModalOpen, setIsHarvestModalOpen] = useState(false);
  const [harvestBatchQueue, setHarvestBatchQueue] = useState([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [showPhaseChangeModal, setShowPhaseChangeModal] = useState(null);
  const [pendingPhase, setPendingPhase] = useState(null);
  const readinessSyncRef = useRef(new Set());
  const [newCrop, setNewCrop] = useState({ cropTypeId: '', traysCount: 1, stockLotId: '', datePlanted: toLocalDateTimeInputValue(), initialStatus: 'GERMINATING' });
  const [plannerHarvestDay, setPlannerHarvestDay] = useState('');
  const [plannerSelections, setPlannerSelections] = useState({});
  const [plannerView, setPlannerView] = useState('harvest');
  const emptyHarvestForm = {
    productId: '',
    selectedCropUsages: {},
    packagingQuantities: {},
    harvestDate: toLocalDateTimeInputValue(),
    registrationNotes: ''
  };
  const [newHarvest, setNewHarvest] = useState(emptyHarvestForm);
  const [editingHarvest, setEditingHarvest] = useState(null);
  const [editPackagingQuantities, setEditPackagingQuantities] = useState({});
  const [savingHarvestEdit, setSavingHarvestEdit] = useState(false);

  const emptySowForm = { cropTypeId: '', traysCount: 1, stockLotId: '', datePlanted: toLocalDateTimeInputValue(), initialStatus: 'GERMINATING' };
  const openSowModal = (initialValues = {}) => {
    setNewCrop({ ...emptySowForm, ...initialValues, stockLotId: '' });
    setIsSowModalOpen(true);
  };
  const closeSowModal = () => {
    setIsSowModalOpen(false);
    setNewCrop(emptySowForm);
  };

  useEffect(() => {
    const action = searchParams.get('action');
    const requestedTab = searchParams.get('tab');
    if (requestedTab === 'trazabilidad') {
      setActiveTab('trazabilidad');
      setSearchParams({}, { replace: true });
      return;
    }
    if (action === 'sow') {
      const cId = searchParams.get('cropTypeId');
      const trays = searchParams.get('trays');
      if (cId) {
        openSowModal({ cropTypeId: cId, traysCount: Number(trays) || 1 });
        // Clean URL so it doesn't reopen on refresh
        setSearchParams({});
      }
    } else if (action === 'harvest') {
      const cId = searchParams.get('cropTypeId');
      if (cId) {
        // We might not know the specific crop ID, but we know it's a harvest action. 
        // We'll just open the modal.
        setIsHarvestModalOpen(true);
        setSearchParams({});
      }
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const cropsReadyByDate = (crops || []).filter(crop => {
      if (String(crop.status || '').toUpperCase() !== 'LIGHT' || readinessSyncRef.current.has(crop.id)) return false;
      const cropType = cropTypes?.find(type => type.id === crop.cropTypeId || type.id === crop.seedId);
      if (!cropType) return false;
      return calendarDaysSince(crop.datePlanted || crop.plantedAt) >= getCropCycleOffsets(cropType).harvest;
    });
    if (!cropsReadyByDate.length) return;
    cropsReadyByDate.forEach(crop => readinessSyncRef.current.add(crop.id));
    Promise.all(cropsReadyByDate.map(crop => updateCrop(crop.id, {
      status: 'READY',
      phaseConfirmedAt: new Date().toISOString()
    })));
  }, [crops, cropTypes, updateCrop]);

  // Computed properties for seed availability
  const selectedCropType = cropTypes?.find(c => c.id === newCrop.cropTypeId);
  const selectedVarietyId = selectedCropType?.varietyId
    || articles?.find(article => article.id === selectedCropType?.seedId)?.varietyId;
  const matchingSeedArticleIds = articles
    ?.filter(article => article.type === 'SEMILLA' && article.varietyId === selectedVarietyId && article.active !== false)
    .map(article => article.id) || [];
  const totalAvailableSeed = stockLots
    ?.filter(lot => matchingSeedArticleIds.includes(lot.articleId))
    .reduce((acc, curr) => acc + Number(curr.remainingQuantity || 0), 0) || 0;

  const availableBatches = useMemo(() => {
    if (!selectedVarietyId) return [];
    return (stockLots || [])
      .filter(lot => {
        const article = articles?.find(item => item.id === lot.articleId);
        return article?.type === 'SEMILLA'
          && article.varietyId === selectedVarietyId
          && article.active !== false
          && Number(lot.remainingQuantity || 0) > 0;
      })
      .sort((a, b) => String(a.receivedAt || a.createdAt || '').localeCompare(String(b.receivedAt || b.createdAt || '')));
  }, [selectedVarietyId, stockLots, articles]);

  const oldestBatch = availableBatches.length > 0 ? availableBatches[0].id : '';

  useEffect(() => {
    if (oldestBatch && newCrop.cropTypeId && !newCrop.stockLotId) {
      setNewCrop(prev => ({ ...prev, stockLotId: oldestBatch }));
    }
  }, [oldestBatch, newCrop.cropTypeId, newCrop.stockLotId]);

  const handleAddCrop = async (e) => { 
    e.preventDefault(); 
    try {
      const plantingDate = new Date(newCrop.datePlanted);
      if (Number.isNaN(plantingDate.getTime()) || plantingDate.getTime() > Date.now()) {
        Swal.fire({ title: 'Fecha no válida', text: 'La fecha de siembra debe ser válida y no puede estar en el futuro.', icon: 'warning', confirmButtonColor: '#f59e0b' });
        return;
      }
      if (selectedCropType) {
        const requiredGrams = (selectedCropType.seedGrams || 0) * newCrop.traysCount;
        const remainingSeed = totalAvailableSeed - requiredGrams;
        
        if (remainingSeed < 0) {
          alert(`⛔ Stock insuficiente: Necesitas ${requiredGrams}g pero solo tienes ${totalAvailableSeed}g en el inventario. Registra una entrada de almacén primero.`);
          return;
        }

        const selectedLot = stockLots?.find(lot => lot.id === newCrop.stockLotId);
        const seedArticle = articles?.find(a => a.id === selectedLot?.articleId);
        if (seedArticle && seedArticle.minStock > 0 && remainingSeed <= seedArticle.minStock) {
          alert(`¡Atención! Con esta siembra el stock de la semilla "${seedArticle.name}" bajará o ya está por debajo del límite de seguridad (${seedArticle.minStock}g). Recuerda pedir más a tu proveedor.`);
        }
      }
      await sowCrop(newCrop);
      closeSowModal();
      Swal.fire({ title: '¡Cultivo Plantado!', text: 'Stock de semillas y sustrato descontado correctamente.', icon: 'success', confirmButtonColor: '#10b981' });
    } catch (error) {
      Swal.fire({ title: 'Error', text: error.message, icon: 'error', confirmButtonColor: '#ef4444' });
    }
  };

  const handleRegisterHarvest = async (e) => {
    e.preventDefault();
    const cropIdsToHarvest = Object.keys(newHarvest.selectedCropUsages).filter(id => newHarvest.selectedCropUsages[id] > 0);
    const product = products?.find(item => item.id === newHarvest.productId);
    const requiredVarietyIds = productVarietyIds(product);
    const selectedVarietyIds = new Set(cropIdsToHarvest.map(cropId => cropVarietyId(crops.find(crop => crop.id === cropId))));
    const minimumVarieties = Math.min(4, requiredVarietyIds.length);
    const packagingBreakdown = Object.entries(newHarvest.packagingQuantities || {})
      .map(([articleId, quantity]) => ({ articleId, quantity: Number(quantity || 0) }))
      .filter(item => item.quantity > 0);
    const totalTuppers = packagingBreakdown.reduce((sum, item) => sum + item.quantity, 0);
    const selectedHarvestDate = new Date(newHarvest.harvestDate);
    const selectedCrops = cropIdsToHarvest
      .map(cropId => crops.find(crop => String(crop.id) === String(cropId)))
      .filter(Boolean);
    const latestPlantingDate = selectedCrops
      .map(crop => new Date(crop.datePlanted || crop.plantedAt))
      .filter(date => !Number.isNaN(date.getTime()))
      .sort((a, b) => b - a)[0];
    
    if (cropIdsToHarvest.length === 0) {
      Swal.fire({ title: 'Faltan datos', text: 'Debes indicar cuántas bandejas vas a cosechar de al menos un cultivo.', icon: 'warning', confirmButtonColor: '#f59e0b' });
      return;
    }
    if (selectedVarietyIds.size < minimumVarieties) {
      Swal.fire({ title: 'Mix incompleto', text: `Debes seleccionar al menos ${minimumVarieties} variedades distintas. Ahora has seleccionado ${selectedVarietyIds.size}.`, icon: 'warning', confirmButtonColor: '#f59e0b' });
      return;
    }
    if (totalTuppers <= 0) {
      Swal.fire({ title: 'Faltan envases', text: 'Indica cuántas unidades se han producido de al menos un formato de táper.', icon: 'warning', confirmButtonColor: '#f59e0b' });
      return;
    }
    if (Number.isNaN(selectedHarvestDate.getTime())) {
      Swal.fire({ title: 'Fecha no válida', text: 'Indica la fecha y hora reales de la cosecha.', icon: 'warning', confirmButtonColor: '#f59e0b' });
      return;
    }
    if (selectedHarvestDate.getTime() > Date.now()) {
      Swal.fire({ title: 'Fecha futura', text: 'La cosecha no puede registrarse con una fecha posterior al momento actual.', icon: 'warning', confirmButtonColor: '#f59e0b' });
      return;
    }
    if (latestPlantingDate && selectedHarvestDate < latestPlantingDate) {
      Swal.fire({
        title: 'Fecha anterior a la siembra',
        text: `La cosecha no puede ser anterior al ${formatSowingDateTime(latestPlantingDate)}.`,
        icon: 'warning',
        confirmButtonColor: '#f59e0b'
      });
      return;
    }

    const batchNum = createHarvestBatchNumber();
    const harvestResult = await registerHarvest({
      productId: newHarvest.productId,
      selectedCropUsages: newHarvest.selectedCropUsages,
      packagingBreakdown,
      harvestDate: selectedHarvestDate.toISOString(),
      registrationNotes: newHarvest.registrationNotes,
      batchNumber: batchNum
    });
    if (!harvestResult) return;

    const completedCropIds = new Set(cropIdsToHarvest.map(String));
    const remainingHarvestQueue = harvestBatchQueue.filter(crop => !completedCropIds.has(String(crop.id)));
    const wasBatchHarvest = harvestBatchQueue.length > 0;
    setHarvestBatchQueue(remainingHarvestQueue);
    setNewHarvest(emptyHarvestForm);
    setIsHarvestModalOpen(false);
    
    setTimeout(() => {
      Swal.fire({ 
        title: '¡Cosecha Registrada!', 
        text: `Se ha guardado el lote de Sanidad: ${batchNum}. ¿Deseas imprimir las etiquetas ahora?`, 
        icon: 'success', 
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sí, imprimir PDF',
        cancelButtonText: 'Cerrar'
      }).then((result) => {
        if (result.isConfirmed) {
          handlePrintLabelsSafe(product, batchNum, totalTuppers);
        }
        if (wasBatchHarvest && remainingHarvestQueue.length > 0) {
          openHarvestModalForCrop(remainingHarvestQueue[0]);
        }
      });
    }, 300);
  };

  const handleProductSelect = (productId) => {
    const newProduct = products?.find(product => product.id === productId);
    const selectedCropUsages = {};
    readyCropsForProduct(newProduct).forEach(crop => {
      selectedCropUsages[crop.id] = Number(crop.traysCount || crop.trays || 0);
    });
    setNewHarvest(prev => ({ ...prev, productId, selectedCropUsages }));
  };

  const openHarvestModalForCrop = (crop) => {
    const actualVarietyId = cropVarietyId(crop);
    if (actualVarietyId) {
      const compatibleProducts = products?.filter(product =>
        productVarietyIds(product).includes(actualVarietyId) &&
        productHarvestAvailability(product).canHarvest
      ) || [];
      if (compatibleProducts.length > 0) {
        handleProductSelect(compatibleProducts[0].id);
      } else {
        setNewHarvest(emptyHarvestForm);
      }
    }
    
    setIsHarvestModalOpen(true);
  };

  const openHarvestBatch = (tasks) => {
    const queuedCrops = tasks
      .map(task => crops?.find(crop => String(crop.id) === String(task.cropId)))
      .filter((crop, index, list) => crop && list.findIndex(item => String(item.id) === String(crop.id)) === index);
    if (queuedCrops.length === 0) return;
    setHarvestBatchQueue(queuedCrops);
    openHarvestModalForCrop(queuedCrops[0]);
  };

  const closeHarvestModal = () => {
    setIsHarvestModalOpen(false);
    setNewHarvest(emptyHarvestForm);
    setHarvestBatchQueue([]);
  };

  const openHarvestPackagingEditor = harvest => {
    const quantities = {};
    (harvest.packagingBreakdown || []).forEach(item => {
      const articleId = item.articleId || item.formatId;
      if (articleId) quantities[articleId] = Number(item.quantity || 0);
    });
    setEditPackagingQuantities(quantities);
    setEditingHarvest(harvest);
  };

  const saveHarvestPackagingEdit = async event => {
    event.preventDefault();
    if (!editingHarvest || savingHarvestEdit) return;
    const packagingBreakdown = Object.entries(editPackagingQuantities)
      .map(([articleId, quantity]) => ({ articleId, quantity: Math.max(0, Number(quantity || 0)) }))
      .filter(item => item.quantity > 0);
    if (!packagingBreakdown.length) {
      Swal.fire({ title: 'Faltan unidades', text: 'La cosecha debe conservar al menos una unidad envasada.', icon: 'warning' });
      return;
    }
    setSavingHarvestEdit(true);
    try {
      const result = await editHarvestPackaging(editingHarvest.id, packagingBreakdown);
      if (!result) throw new Error('Supabase no devolvió la confirmación de la corrección.');
      setEditingHarvest(null);
      setEditPackagingQuantities({});
      Swal.fire({
        title: 'Cosecha corregida',
        text: 'Se han actualizado los envases, el stock y los costes asociados.',
        icon: 'success',
        timer: 1800,
        showConfirmButton: false
      });
    } catch (error) {
      console.error('Error corrigiendo los envases de la cosecha:', error);
      Swal.fire({
        title: 'No se pudo guardar',
        text: error?.message || 'No se pudo corregir el envasado. Vuelve a intentarlo.',
        icon: 'error'
      });
    } finally {
      setSavingHarvestEdit(false);
    }
  };

  
  const getVarietiesText = (recipeSeeds) => {
    try {
      if (!Array.isArray(recipeSeeds)) return '';
      if (recipeSeeds.length === 0) return '';
      return recipeSeeds.map(rs => {
        // We use stockEntries or articles if seeds is not available, but since seeds isn't in useData
        // we will just return empty string or we can find it in articles.
        const s = articles?.find(x => x.id === rs.seedId);
        return s ? s.name : '';
      }).filter(Boolean).join(', ');
    } catch (e) {
      console.error("Error en getVarietiesText:", e);
      return '';
    }
  };

  const handlePrintLabelsSafe = (product, batchNum, tuppersCount) => {
    try {
      generateLabelPDF(
        product?.name || 'Desconocido', 
        batchNum, 
        product?.shelfLifeDays || 10, 
        tuppersCount, 
        product?.nutritionalInfo, 
        (productVarietyIds(product).map(id => seedVarieties?.find(v => v.id === id)?.name).filter(Boolean).join(', ')
          || getVarietiesText(product?.recipeSeeds))
      );
    } catch (e) {
      console.error("Error llamando a generateLabelPDF:", e);
      Swal.fire('Error', 'Hubo un error al preparar la etiqueta: ' + e.message, 'error');
    }
  };

  // Modal Styles
  const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999999 };
  const modalCardStyle = { width: '100%', maxWidth: '600px', margin: '20px', maxHeight: '90vh', overflowY: 'auto', backgroundColor: '#fff', padding: '2rem', borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' };

  const translateStatus = (status) => {
    const statusMap = {
      'SOAKING': 'En Remojo',
      'SOWED': 'Sembrado',
      'GERMINATING': 'Germinando',
      'DARKNESS': 'Oscuridad',
        'LIGHT': 'Luz',
        'READY': 'Listo',
      'HARVESTED': 'Cosechado',
      'DISCARDED': 'Descartado'
    };
    const normalized = (status || '').toUpperCase();
    return statusMap[normalized] || status;
  };

    const renderHistorial = () => {
    const historicalCrops = crops?.filter(c => c.status === 'HARVESTED' || c.status === 'DISCARDED') || [];
    
    const filteredHistory = historicalCrops.filter(crop => {
      const cType = cropTypes?.find(c => c.id === crop.seedId || c.id === crop.cropTypeId);
      const search = historySearch.toLowerCase();
      const matchBatch = (crop.batchNumber || '').toLowerCase().includes(search);
      const matchName = (cType?.name || '').toLowerCase().includes(search);
      return matchBatch || matchName;
    }).sort((a, b) => new Date(b.datePlanted || b.plantedAt) - new Date(a.datePlanted || a.plantedAt));

    const totalPages = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE);
    const paginatedHistory = filteredHistory.slice((historyPage - 1) * ITEMS_PER_PAGE, historyPage * ITEMS_PER_PAGE);

    return (
      <div style={{ animation: 'fadeIn 0.3s ease' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ position: 'relative', flex: '1', minWidth: '250px', maxWidth: '400px' }}>
            <span style={{ position: 'absolute', top: '50%', left: '1rem', transform: 'translateY(-50%)', color: '#94a3b8' }}>
              🔍
            </span>
            <input 
              type="text" 
              placeholder="Buscar por lote o cultivo..." 
              className="premium-input" 
              style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', borderRadius: '12px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
              value={historySearch}
              onChange={(e) => { setHistorySearch(e.target.value); setHistoryPage(1); }}
            />
          </div>
        </div>

        <div className="premium-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', textAlign: 'left', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '1.25rem 1.5rem', fontWeight: '700' }}>Lote / Siembra</th>
                  <th style={{ padding: '1.25rem 1.5rem', fontWeight: '700' }}>Ficha de Cultivo</th>
                  <th style={{ padding: '1.25rem 1.5rem', fontWeight: '700' }}>Inicio de Siembra</th>
                  <th style={{ padding: '1.25rem 1.5rem', fontWeight: '700', textAlign: 'center' }}>Bandejas</th>
                  <th style={{ padding: '1.25rem 1.5rem', fontWeight: '700', textAlign: 'right' }}>Estado Final</th>
                </tr>
              </thead>
              <tbody>
                {paginatedHistory.map(crop => {
                  const cType = cropTypes?.find(c => c.id === crop.seedId || c.id === crop.cropTypeId);
                  const plantedDate = formatSowingDateTime(crop.datePlanted || crop.plantedAt);
                  
                  return (
                    <tr key={crop.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s', cursor: 'default' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                      <td style={{ padding: '1.25rem 1.5rem', fontWeight: '600', color: '#0f172a' }}>{crop.batchNumber || 'N/A'}</td>
                      <td style={{ padding: '1.25rem 1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', backgroundColor: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669', fontWeight: 'bold', fontSize: '0.75rem' }}>
                            {(cType?.name || '?').charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: '600', color: '#334155' }}>{cType?.name || 'Desconocido'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '1.25rem 1.5rem', color: '#64748b' }}>{plantedDate}</td>
                      <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center', fontWeight: 'bold', color: '#334155' }}>{crop.traysCount}</td>
                      <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                        <span style={{ 
                          padding: '6px 12px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px',
                          backgroundColor: crop.status === 'HARVESTED' ? '#dcfce7' : '#fee2e2',
                          color: crop.status === 'HARVESTED' ? '#166534' : '#991b1b'
                        }}>
                          {crop.status === 'HARVESTED' ? '✅' : '🗑️'} {translateStatus(crop.status)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {paginatedHistory.length === 0 && (
              <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#64748b' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>📭</div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: '0 0 0.5rem 0' }}>No hay resultados</h3>
                <p style={{ margin: 0 }}>No se encontraron cultivos en el historial que coincidan con tu búsqueda.</p>
              </div>
            )}
          </div>
          
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 1rem', borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
              <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Mostrando {(historyPage - 1) * ITEMS_PER_PAGE + 1} a {Math.min(historyPage * ITEMS_PER_PAGE, filteredHistory.length)} de {filteredHistory.length} resultados</span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  onClick={() => setHistoryPage(p => Math.max(1, p - 1))} 
                  disabled={historyPage === 1}
                  style={{ padding: '0.15rem 0.5rem', borderRadius: '0.25rem', border: '1px solid #cbd5e1', backgroundColor: 'white', color: '#475569', fontWeight: '500', cursor: historyPage === 1 ? 'not-allowed' : 'pointer', opacity: historyPage === 1 ? 0.5 : 1 }}
                >Anterior</button>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button 
                      key={page} 
                      onClick={() => setHistoryPage(page)}
                      style={{ width: '2rem', height: '2rem', borderRadius: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '500', cursor: 'pointer', border: page === historyPage ? 'none' : '1px solid #cbd5e1', backgroundColor: page === historyPage ? '#059669' : 'white', color: page === historyPage ? 'white' : '#475569' }}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button 
                  onClick={() => setHistoryPage(p => Math.min(totalPages, p + 1))} 
                  disabled={historyPage === totalPages}
                  style={{ padding: '0.15rem 0.5rem', borderRadius: '0.25rem', border: '1px solid #cbd5e1', backgroundColor: 'white', color: '#475569', fontWeight: '500', cursor: historyPage === totalPages ? 'not-allowed' : 'pointer', opacity: historyPage === totalPages ? 0.5 : 1 }}
                >Siguiente</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderLotes = () => {
    // Solo mostramos cultivos vivos y que tengan al menos 1 bandeja física
    const activeCropsList = crops?.filter(c => c.status !== 'HARVESTED' && c.status !== 'DISCARDED' && (c.traysCount > 0 || c.trays > 0)) || [];

    return (
      <div style={{ animation: 'fadeIn 0.3s ease' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.875rem', fontWeight: '900', color: '#1e293b', margin: '0 0 0.25rem 0', letterSpacing: '-0.025em' }}>Gestión de Cultivos</h2>
            <p style={{ color: '#64748b', fontSize: '1.125rem', margin: 0 }}>Bandejas activas y seguimiento</p>
          </div>
          <button onClick={() => openSowModal()} className="btn" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', padding: '0.875rem 1.5rem', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.3)', transition: 'transform 0.2s ease' }} onMouseOver={e=>e.currentTarget.style.transform='translateY(-2px)'} onMouseOut={e=>e.currentTarget.style.transform='none'}>
            <span style={{ fontSize: '1.2rem' }}>⊕</span> Registrar Siembra
          </button>
        </div>

        
          {/* SOWING SMART TASKS OUTSIDE MODAL */}
          {(() => {
            const today = new Date();
            const targetDayOfWeek = today.getDay();
            const tasks = [];
            
            (harvestTargets || []).forEach(routine => {
              const cType = (cropTypes || []).find(ct => ct.id == routine.productId);
              if(!cType) return;
              
              const harvestWd = Number(routine.targetDayOfWeek);
              const plantWd = weekDay(harvestWd - getCropCycleOffsets(cType).harvest);
              
              const isPlanted = (crops || []).some(c => {
                if(c.cropTypeId !== cType.id) return false;
                if(!c.datePlanted || c.status === 'DISCARDED' || c.status === 'HARVESTED') return false;
                const cDate = new Date(c.datePlanted);
                const tDate = new Date();
                return cDate.getFullYear() === tDate.getFullYear() && 
                       cDate.getMonth() === tDate.getMonth() && 
                       cDate.getDate() === tDate.getDate();
              });
              
              if(plantWd === targetDayOfWeek && !isPlanted) {
                tasks.push({
                  cropTypeId: cType.id,
                  name: cType.name,
                  trays: routine.tuppersCount,
                  gramsPerTray: Number(cType.seedGrams || 0),
                  totalSeedGrams: Number(cType.seedGrams || 0) * Number(routine.tuppersCount || 0)
                });
              }
            });

            if (tasks.length > 0) {
              return (
                <div style={{ marginBottom: '2rem', backgroundColor: '#f0fdf4', padding: '1.25rem', borderRadius: '1rem', border: '1px solid #bbf7d0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                  <h4 style={{ fontWeight: 'bold', color: '#166534', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                    <span>📋</span> Tareas de Siembra Pendientes para Hoy
                  </h4>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    {tasks.map((t, idx) => (
                      <div key={idx} 
                          onClick={() => {
                            openSowModal({ cropTypeId: t.cropTypeId, traysCount: t.trays });
                          }}
                          style={{ flex: '1 1 min-content', minWidth: '250px', display: 'flex', justifyContent: 'space-between', padding: '1rem', backgroundColor: 'white', borderRadius: '0.75rem', border: '1px solid #cbd5e1', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#22c55e'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(34,197,94,0.2)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'; }}
                      >
                        <div>
                          <span style={{ fontWeight: 'bold', color: '#1e293b', fontSize: '1.1rem' }}>Sembrar {t.name}</span>
                          <div style={{ fontSize: '0.9rem', color: '#64748b', marginTop: '0.25rem' }}>
                            {t.trays} bandejas · {t.gramsPerTray} g/bandeja · {t.totalSeedGrams} g total
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', color: '#22c55e', fontWeight: 'bold' }}>
                           <span style={{ backgroundColor: '#dcfce7', padding: '0.5rem 1rem', borderRadius: '999px', fontSize: '0.85rem' }}>Empezar ➔</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', backgroundColor: '#f1f5f9', padding: '0.25rem', borderRadius: '0.75rem', width: 'fit-content' }}>
          <button 
            onClick={() => setSowTab('activos')}
            style={{ padding: '0.625rem 1.5rem', borderRadius: '0.5rem', fontWeight: 'bold', fontSize: '0.875rem', transition: 'all 0.2s', cursor: 'pointer', border: 'none', backgroundColor: sowTab === 'activos' ? 'white' : 'transparent', color: sowTab === 'activos' ? '#047857' : '#64748b', boxShadow: sowTab === 'activos' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
          >
            🪴 Bandejas Activas ({activeCropsList.length})
          </button>
          <button 
            onClick={() => setSowTab('historico')}
            style={{ padding: '0.625rem 1.5rem', borderRadius: '0.5rem', fontWeight: 'bold', fontSize: '0.875rem', transition: 'all 0.2s', cursor: 'pointer', border: 'none', backgroundColor: sowTab === 'historico' ? 'white' : 'transparent', color: sowTab === 'historico' ? '#1e293b' : '#64748b', boxShadow: sowTab === 'historico' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
          >
            📖 Histórico de Cultivos
          </button>
        </div>

        

        {sowTab === 'activos' && (
            <div style={{ animation: 'fadeIn 0.3s ease' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b' }}>Lotes en Producción</h3>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f8fafc', padding: '0.25rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                  <button onClick={() => setStatusFilter('ALL')} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', fontWeight: 'bold', fontSize: '0.875rem', border: 'none', cursor: 'pointer', transition: 'all 0.2s', backgroundColor: statusFilter === 'ALL' ? 'white' : 'transparent', color: statusFilter === 'ALL' ? '#0f172a' : '#64748b', boxShadow: statusFilter === 'ALL' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>Todos</button>
                  <button onClick={() => setStatusFilter('SOAKING')} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', fontWeight: 'bold', fontSize: '0.875rem', border: 'none', cursor: 'pointer', transition: 'all 0.2s', backgroundColor: statusFilter === 'SOAKING' ? '#dbeafe' : 'transparent', color: statusFilter === 'SOAKING' ? '#1e3a8a' : '#64748b', boxShadow: statusFilter === 'SOAKING' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>En Remojo</button>
                  <button onClick={() => setStatusFilter('GERMINATING')} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', fontWeight: 'bold', fontSize: '0.875rem', border: 'none', cursor: 'pointer', transition: 'all 0.2s', backgroundColor: statusFilter === 'GERMINATING' ? '#fef3c7' : 'transparent', color: statusFilter === 'GERMINATING' ? '#92400e' : '#64748b', boxShadow: statusFilter === 'GERMINATING' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>Germinación</button>
                  <button onClick={() => setStatusFilter('DARKNESS')} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', fontWeight: 'bold', fontSize: '0.875rem', border: 'none', cursor: 'pointer', transition: 'all 0.2s', backgroundColor: statusFilter === 'DARKNESS' ? '#e0e7ff' : 'transparent', color: statusFilter === 'DARKNESS' ? '#3730a3' : '#64748b', boxShadow: statusFilter === 'DARKNESS' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>Oscuridad</button>
                  <button onClick={() => setStatusFilter('LIGHT')} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', fontWeight: 'bold', fontSize: '0.875rem', border: 'none', cursor: 'pointer', transition: 'all 0.2s', backgroundColor: statusFilter === 'LIGHT' ? '#ccfbf1' : 'transparent', color: statusFilter === 'LIGHT' ? '#0f766e' : '#64748b', boxShadow: statusFilter === 'LIGHT' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>Luz</button>
                  <button onClick={() => setStatusFilter('READY')} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', fontWeight: 'bold', fontSize: '0.875rem', border: 'none', cursor: 'pointer', transition: 'all 0.2s', backgroundColor: statusFilter === 'READY' ? '#dcfce7' : 'transparent', color: statusFilter === 'READY' ? '#166534' : '#64748b', boxShadow: statusFilter === 'READY' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>Listo para cosechar</button>
                </div>
              </div>

              <div style={{ backgroundColor: 'white', borderRadius: '1rem', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <tr>
                      <th style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Variedad y Lote</th>
                      <th style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Bandejas</th>
                      <th style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fase Actual</th>
                      <th style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', width: '25%' }}>Desarrollo</th>
                      <th style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeCropsList
                      .filter(crop => {
                          if (statusFilter === 'ALL') return true;
                          const s = crop.status || 'SOWED';
                          if (statusFilter === 'READY') return s === 'READY';
                          return s === statusFilter;
                        })
                      .sort((a, b) => {
                        // Older crops (closest to harvest) first
                        const dateA = new Date(a.datePlanted || a.plantedAt);
                        const dateB = new Date(b.datePlanted || b.plantedAt);
                        return dateA - dateB;
                      })
                      .map(crop => {
                        const cType = cropTypes?.find(c => c.id === crop.seedId || c.id === crop.cropTypeId);
                        const daysAlive = calendarDaysSince(crop.datePlanted || crop.plantedAt);
                        const expectedDays = cType ? ((Number(cType.germinationDays || 0) + Number(cType.darknessDays || 0) + Number(cType.lightDays || 0)) || 14) : 14;
                        const progressPercentage = Math.min(100, Math.max(0, (daysAlive / expectedDays) * 100));
                        
                        let statusColor = { bg: '#f1f5f9', text: '#475569', bar: '#94a3b8' };
                        const statusStr = (crop.status || '').toUpperCase();
                        if (statusStr === 'SOAKING') statusColor = { bg: '#dbeafe', text: '#1e3a8a', bar: '#3b82f6' };
                        else if (statusStr === 'GERMINATING') statusColor = { bg: '#fef3c7', text: '#92400e', bar: '#f59e0b' };
                        else if (statusStr === 'DARKNESS') statusColor = { bg: '#e0e7ff', text: '#3730a3', bar: '#4f46e5' };
                          else if (statusStr === 'LIGHT') statusColor = { bg: '#ccfbf1', text: '#0f766e', bar: '#14b8a6' };
                          else if (statusStr === 'READY') statusColor = { bg: '#dcfce7', text: '#166534', bar: '#22c55e' };

                        return (
                          <tr key={crop.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.2s' }} onMouseOver={e=>e.currentTarget.style.backgroundColor='#f8fafc'} onMouseOut={e=>e.currentTarget.style.backgroundColor='transparent'}>
                            <td style={{ padding: '0.5rem 1rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ width: '1.75rem', height: '1.75rem', borderRadius: '0.5rem', backgroundColor: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1rem', border: '1px solid #d1fae5' }}>
                                  {cType?.name ? cType.name.charAt(0).toUpperCase() : '🌱'}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 'bold', color: '#1e293b', fontSize: '0.85rem' }}>{cType?.name || 'Desconocido'}</div>
                                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'monospace', marginTop: '-2px' }}>{crop.batchNumber || 'N/A'}</div>
                                  <div style={{ fontSize: '0.68rem', color: '#475569', marginTop: '2px' }}>Inicio: {formatSowingDateTime(crop.datePlanted || crop.plantedAt)}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '0.5rem 1rem', textAlign: 'center' }}>
                              <span style={{ fontSize: '1rem', fontWeight: '900', color: '#0f172a' }}>{crop.traysCount}</span>
                            </td>
                            <td style={{ padding: '0.5rem 1rem' }}>
                              <span style={{ backgroundColor: statusColor.bg, color: statusColor.text, padding: '0.15rem 0.5rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 'bold', border: `1px solid ${statusColor.text}20` }}>
                                {translateStatus(crop.status)}
                              </span>
                            </td>
                            <td style={{ padding: '0.5rem 1rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ flex: 1, backgroundColor: '#e2e8f0', borderRadius: '9999px', height: '0.35rem', overflow: 'hidden' }}>
                                  <div style={{ backgroundColor: statusColor.bar, height: '100%', borderRadius: '9999px', width: `${progressPercentage}%` }}></div>
                                </div>
                                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', minWidth: '4rem', textAlign: 'right' }}>
                                  Día {daysAlive >= 0 ? daysAlive : 0} / {expectedDays}
                                </span>
                              </div>
                            </td>
                            <td style={{ padding: '0.5rem 1rem', textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                <button onClick={() => handleDeleteCrop(crop)} title="Eliminar Registro" style={{ padding: '0.25rem 0.5rem', borderRadius: '0.35rem', border: '1px solid #fecaca', color: '#dc2626', backgroundColor: '#fee2e2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
</button>

                                <button onClick={() => { setShowPhaseChangeModal(crop); setPendingPhase(crop.status || "SOWED"); }} title="Cambiar Fase" style={{ padding: '0.35rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#334155', fontWeight: 'bold', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>Cambiar Fase</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      
                      {activeCropsList.length === 0 && (
                        <tr>
                          <td colSpan="5">
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', backgroundColor: 'transparent' }}>
                              <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>🌱</div>
                              <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#334155', margin: '0 0 0.5rem 0' }}>Invernadero Vacío</h3>
                              <p style={{ color: '#64748b', margin: 0, textAlign: 'center' }}>No hay bandejas en producción actualmente.<br/>Usa el botón de arriba para registrar una nueva siembra.</p>
                            </div>
                          </td>
                        </tr>
                      )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        {sowTab === 'historico' && renderHistorial()}

      </div>
    );
  };
  const renderHarvestHistory = () => {
    const weekMap = new Map();
    [...(harvests || [])]
      .sort((a, b) => new Date(b.harvestDate || b.createdAt) - new Date(a.harvestDate || a.createdAt))
      .forEach(harvest => {
        const weekStart = startOfHarvestWeek(harvest.harvestDate || harvest.createdAt);
        if (!weekStart) return;
        const key = weekStart.toISOString().slice(0, 10);
        if (!weekMap.has(key)) weekMap.set(key, { key, weekStart, harvests: [] });
        weekMap.get(key).harvests.push(harvest);
      });

    const weeks = [...weekMap.values()].sort((a, b) => b.weekStart - a.weekStart);
    const weeksPerPage = 4;
    const totalPages = Math.max(1, Math.ceil(weeks.length / weeksPerPage));
    const currentPage = Math.min(harvestHistoryPage, totalPages);
    const visibleWeeks = weeks.slice((currentPage - 1) * weeksPerPage, currentPage * weeksPerPage);

    return (
      <div className="premium-card mb-6" style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 10px rgba(15,23,42,0.06)' }}>
        <div style={{ padding: '1rem 1.25rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.15rem' }}>Cosechas realizadas</h3>
            <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{harvests?.length || 0} registros agrupados por semana</span>
          </div>
          {weeks.length > 0 && <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Página {currentPage} de {totalPages}</span>}
        </div>

        <div style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
          {visibleWeeks.map(week => {
            const weekEnd = new Date(week.weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            const totalUnits = week.harvests.reduce((sum, harvest) => sum + Number(harvest.tuppersCount || 0), 0);
            return (
              <section key={week.key} style={{ border: '1px solid #dbe6e0', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ padding: '0.65rem 0.9rem', background: '#ecfdf5', color: '#065f46', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <strong>
                    Semana del {week.weekStart.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                    {' '}al {weekEnd.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </strong>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800 }}>{week.harvests.length} cosechas · {totalUnits} unidades</span>
                </div>
                <div style={{ padding: '0.75rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.65rem' }}>
                  {week.harvests.map(harvest => {
                    const product = products?.find(item => item.id === harvest.productId);
                    return (
                      <article key={harvest.id} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.8rem', display: 'grid', gap: '0.5rem', background: '#fff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                          <strong style={{ color: '#0f172a' }}>{product?.name || 'Producto desconocido'}</strong>
                          <span style={{ color: '#64748b', fontSize: '0.76rem' }}>{new Date(harvest.harvestDate).toLocaleDateString('es-ES')}</span>
                        </div>
                        <div style={{ color: '#475569', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                          <span>Lote <strong>{harvest.batchNumber}</strong></span>
                          <span><strong>{harvest.tuppersCount}</strong> unidades</span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          {(harvest.packagingBreakdown || []).filter(item => Number(item.quantity) > 0).map(item => {
                            const format = articles?.find(candidate => candidate.id === item.articleId)
                              || packagingFormats?.find(candidate => candidate.id === item.formatId);
                            return <span key={item.articleId || item.formatId} className="badge badge-primary">{format?.name || 'Formato'}: {item.quantity}</span>;
                          })}
                        </div>
                        <div style={{ display: 'flex', gap: '0.45rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          <button type="button" className="btn btn-secondary" onClick={() => openHarvestPackagingEditor(harvest)}>Corregir envases</button>
                          <button type="button" className="btn btn-secondary" onClick={() => handlePrintLabelsSafe(product, harvest.batchNumber, harvest.tuppersCount)}>Reimprimir PDF</button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {weeks.length === 0 && <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>No hay cosechas registradas.</div>}
        </div>

        {totalPages > 1 && (
          <div style={{ padding: '0.85rem 1rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.65rem' }}>
            <button type="button" className="btn btn-secondary" disabled={currentPage === 1} onClick={() => setHarvestHistoryPage(page => Math.max(1, page - 1))}>Anterior</button>
            <strong style={{ color: '#334155', fontSize: '0.85rem' }}>{currentPage} / {totalPages}</strong>
            <button type="button" className="btn btn-secondary" disabled={currentPage === totalPages} onClick={() => setHarvestHistoryPage(page => Math.min(totalPages, page + 1))}>Siguiente</button>
          </div>
        )}
      </div>
    );
  };

  const renderCosechas = () => (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">🔪 Envasado y Pedidos</h2>
          <p className="text-gray-500">Registra lo cosechado y gestiona el inventario de ventas.</p>
        </div>
        <button onClick={() => setIsHarvestModalOpen(true)} className="btn btn-primary" style={{ background: '#0f172a', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
          + Registrar Cosecha
        </button>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem' }}>
        <button 
          onClick={() => setHarvestTab('cosechar')}
          style={{ 
            background: 'none', border: 'none', padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold',
            color: harvestTab === 'cosechar' ? '#16a34a' : '#64748b',
            borderBottom: harvestTab === 'cosechar' ? '3px solid #16a34a' : '3px solid transparent',
            marginBottom: '-0.65rem', transition: 'all 0.2s'
          }}
        >
          🌱 Para Cosechar
        </button>
        <button 
          onClick={() => setHarvestTab('inventario')}
          style={{ 
            background: 'none', border: 'none', padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold',
            color: harvestTab === 'inventario' ? '#0f172a' : '#64748b',
            borderBottom: harvestTab === 'inventario' ? '3px solid #0f172a' : '3px solid transparent',
            marginBottom: '-0.65rem', transition: 'all 0.2s'
          }}
        >
          📦 Producto Terminado
        </button>
        <button 
          onClick={() => {
            setHarvestHistoryPage(1);
            setHarvestTab('historico');
          }}
          style={{ 
            background: 'none', border: 'none', padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold',
            color: harvestTab === 'historico' ? '#0f172a' : '#64748b',
            borderBottom: harvestTab === 'historico' ? '3px solid #0f172a' : '3px solid transparent',
            marginBottom: '-0.65rem', transition: 'all 0.2s'
          }}
        >
          📖 Histórico de Cosechas
        </button>
      </div>

      {harvestTab === 'inventario' && (
      <div className="premium-card mb-6" style={{ background: 'linear-gradient(135deg, #1e293b, #0f172a)', color: 'white', border: '1px solid #334155', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)' }}>
        <h3 className="premium-card-title" style={{ margin: 0, color: 'white', background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid #334155', padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.25rem' }}>
          <span style={{ fontSize: '1.5rem' }}>📦</span> Inventario de Producto Terminado y Reservas
        </h3>
        
        <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
          {products?.map(product => {
            const harvested = productMovements?.filter(m => m.productId === product.id && m.type === 'HARVEST').reduce((acc, curr) => acc + Number(curr.quantity || 0), 0) || 0;
            const sold = productMovements?.filter(m => m.productId === product.id && m.type === 'ORDER').reduce((acc, curr) => acc + Math.abs(Number(curr.quantity || 0)), 0) || 0;
            const physicalStock = harvested - sold;
            const formatStocks = packagingArticlesForProduct(product).map(article => {
              const formatHarvested = productMovements?.filter(m => m.productId === product.id && m.type === 'HARVEST' && m.packagingArticleId === article.id).reduce((sum, movement) => sum + Number(movement.quantity || 0), 0) || 0;
              const formatSold = productMovements?.filter(m => m.productId === product.id && m.type === 'ORDER' && m.packagingArticleId === article.id).reduce((sum, movement) => sum + Math.abs(Number(movement.quantity || 0)), 0) || 0;
              return { ...article, stock: formatHarvested - formatSold };
            }).filter(article => article.stock !== 0);

            const pendingOrders = orders?.filter(o => o.status === 'PENDING' || o.status === 'PREPARED') || [];
            const reserved = pendingOrders.reduce((acc, order) => {
              const item = order.items?.find(i => i.productId === product.id);
              return acc + (item ? item.quantity : 0);
            }, 0);

            const available = physicalStock - reserved;

            if (physicalStock <= 0 && reserved <= 0) return null;

            return (
              <div key={product.id} className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-bold text-lg" style={{ color: '#e2e8f0' }}>{product.name}</h4>
                  <div className="text-xs px-2 py-1 rounded" style={{ background: '#334155', color: '#94a3b8' }}>
                    Físico: <span style={{ color: 'white', fontWeight: 'bold' }}>{physicalStock}</span>
                  </div>
                </div>
                {formatStocks.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {formatStocks.map(format => (
                      <span key={format.id} className="badge" style={{ background: '#334155', color: '#e2e8f0' }}>
                        {format.name}: {format.stock}
                      </span>
                    ))}
                  </div>
                )}
                
                <div className="flex justify-between items-center mb-2">
                  <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Cosechado (Total producido)</span>
                  <span className="font-bold text-lg" style={{ color: '#e2e8f0' }}>{harvested}</span>
                </div>

                <div className="flex justify-between items-center mb-2">
                  <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Entregado (Pedidos finalizados)</span>
                  <span className="font-bold text-lg" style={{ color: '#38bdf8' }}>{sold}</span>
                </div>

                <div className="flex justify-between items-center mb-2">
                  <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Reservado (Pedidos pendientes)</span>
                  <span className="font-bold text-lg" style={{ color: '#f59e0b' }}>{reserved}</span>
                </div>

                <div className="flex justify-between items-center pt-2" style={{ borderTop: '1px dashed #334155' }}>
                  <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Disponible</span>
                  <span className={`font-bold text-xl ${available < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {available}
                  </span>
                </div>
                
                {available < 0 && (
                  <div className="mt-3 text-xs font-bold p-2 rounded" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                    ⚠️ Faltan {Math.abs(available)} tuppers
                  </div>
                )}
      {harvestTab === 'historico' && (
        <div className="premium-card mb-6" style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: 0, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '1.25rem 1.5rem', fontSize: '1.25rem', color: '#1e293b', fontWeight: 'bold' }}>
            📖 Trazabilidad de Salidas
          </h3>
          <div style={{ padding: '1.5rem', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '0.85rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '1rem' }}>Fecha</th>
                  <th style={{ padding: '1rem' }}>Cliente</th>
                  <th style={{ padding: '1rem' }}>Producto</th>
                  <th style={{ padding: '1rem' }}>Cantidad</th>
                  <th style={{ padding: '1rem' }}>Lote de Sanidad (Trazabilidad)</th>
                </tr>
              </thead>
              <tbody>
                {productMovements?.filter(m => m.type === 'ORDER' && m.quantity < 0).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).map(m => {
                  let orderId = m.referenceId;
                  let batchNum = 'Sin Lote';
                  if (m.referenceId && m.referenceId.includes('|')) {
                    const parts = m.referenceId.split('|');
                    orderId = parts[0];
                    batchNum = parts[1];
                  }
                  
                  const order = orders?.find(o => o.id === orderId);
                  const client = clients?.find(c => c.id === order?.clientId);
                  const product = products?.find(p => p.id === m.productId);
                  const harvestDate = harvests?.find(h => h.batchNumber === batchNum)?.harvestDate;
                  
                  return (
                    <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '1rem', color: '#475569' }}>{new Date(m.createdAt).toLocaleDateString()}</td>
                      <td style={{ padding: '1rem', fontWeight: 'bold', color: '#1e293b' }}>{client?.name || 'Venta Desconocida'}</td>
                      <td style={{ padding: '1rem', color: '#334155' }}>{product?.name || 'Desconocido'}</td>
                      <td style={{ padding: '1rem', color: '#ef4444', fontWeight: 'bold' }}>{m.quantity}</td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <span style={{ fontWeight: 'bold', color: '#0f766e' }}>{batchNum}</span>
                          {harvestDate && <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Cosechado: {new Date(harvestDate).toLocaleDateString()}</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {productMovements?.filter(m => m.type === 'ORDER' && m.quantity < 0).length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>No hay ventas registradas aún.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

              </div>
            );
          })}
        </div>
      </div>
      )}

      {harvestTab === 'historico' && renderHarvestHistory()}
      
      {harvestTab === 'cosechar' && (
      <>
      <div className="premium-card mt-6" style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', overflow: 'hidden' }}>
        <h3 className="premium-card-title" style={{ margin: 0, padding: '1.25rem 1.5rem', background: 'linear-gradient(to right, #f8fafc, #ffffff)', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#1e293b', fontSize: '1.25rem' }}>
          <span style={{ fontSize: '1.5rem' }}>🌱</span> Cultivos Listos para Cosechar
        </h3>
        <div style={{ padding: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {(crops?.filter(c => c.status === 'READY' && (c.traysCount > 0 || c.trays > 0)) || []).map(crop => {
              const cType = cropTypes?.find(c => c.id === crop.seedId || c.id === crop.cropTypeId);
              const daysAlive = calendarDaysSince(crop.datePlanted || crop.plantedAt);
              
              return (
                <div key={crop.id} style={{ padding: '1.25rem', borderRadius: '12px', border: '1px solid #bbf7d0', backgroundColor: '#f0fdf4', position: 'relative', display: 'flex', flexDirection: 'column', gap: '1rem', transition: 'transform 0.2s, box-shadow 0.2s' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(34, 197, 94, 0.2)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h4 style={{ margin: 0, fontWeight: '800', color: '#166534', fontSize: '1.1rem' }}>{cType?.name || 'Desconocido'}</h4>
                    <span style={{ backgroundColor: '#16a34a', color: 'white', fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '6px', fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: '0.05em' }}>{crop.batchNumber || 'N/A'}</span>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem', color: '#15803d' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #bbf7d0', paddingBottom: '0.25rem' }}>
                      <strong>Bandejas cultivadas:</strong> <span>{crop.traysCount} unds</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>Días de crecimiento:</strong> <span>{daysAlive} días</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #bbf7d0', paddingTop: '0.25rem' }}>
                      <strong>Inicio:</strong> <span>{formatSowingDateTime(crop.datePlanted || crop.plantedAt)}</span>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => openHarvestModalForCrop(crop)}
                    style={{ marginTop: 'auto', width: '100%', backgroundColor: '#16a34a', color: 'white', fontWeight: 'bold', padding: '0.75rem', borderRadius: '8px', border: 'none', cursor: 'pointer', transition: 'background-color 0.2s, transform 0.1s', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
                    onMouseOver={e => e.currentTarget.style.backgroundColor = '#15803d'}
                    onMouseOut={e => e.currentTarget.style.backgroundColor = '#16a34a'}
                    onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
                    onMouseUp={e => e.currentTarget.style.transform = 'none'}
                  >
                    <span>✂️</span> Cortar y Envasar
                  </button>
                </div>
              );
            })}
          </div>
          {(crops?.filter(c => c.status === 'READY' && (c.traysCount > 0 || c.trays > 0)) || []).length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', backgroundColor: '#f8fafc', borderRadius: '12px', border: '2px dashed #cbd5e1' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem', opacity: 0.5 }}>🌱</div>
              <p style={{ color: '#64748b', fontSize: '1.1rem', margin: 0, fontWeight: '500' }}>No hay cultivos listos para cosechar actualmente.</p>
            </div>
          )}
        </div>
      </div>

      <div className="premium-card mt-6" style={{ display: 'none', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', overflow: 'hidden', marginTop: '2rem' }}>
        <h3 className="premium-card-title" style={{ margin: 0, padding: '1.25rem 1.5rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#1e293b', fontSize: '1.25rem' }}>
          <span style={{ fontSize: '1.5rem' }}>🏷️</span> Histórico de Ventas
        </h3>
        <div style={{ padding: '1.5rem' }}>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {harvests?.slice().reverse().map(h => {
              const product = products?.find(p => p.id === h.productId);
              const harvestCrops = crops?.filter(c => h.selectedCropIds?.includes(c.id)) || [];
              
              return (
                <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #cbd5e1', transition: 'background-color 0.2s, border-color 0.2s' }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1'; }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: '800', fontSize: '1.15rem', color: '#0f172a' }}>{product?.name || 'Desconocido'}</span>
                      <span style={{ fontSize: '0.75rem', backgroundColor: '#dcfce7', color: '#166534', padding: '0.25rem 0.6rem', borderRadius: '999px', fontFamily: 'monospace', fontWeight: 'bold', border: '1px solid #bbf7d0' }}>Lote: {h.batchNumber}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem', color: '#64748b' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>📅 Fecha: <strong style={{ color: '#334155' }}>{new Date(h.harvestDate).toLocaleDateString()}</strong></span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>📦 Envasados: <strong style={{ color: '#334155' }}>{h.tuppersCount} táperes</strong></span>
                    </div>
                    {Array.isArray(h.packagingBreakdown) && h.packagingBreakdown.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.65rem' }}>
                        {h.packagingBreakdown.filter(item => Number(item.quantity) > 0).map(item => {
                          const format = articles?.find(candidate => candidate.id === item.articleId)
                            || packagingFormats?.find(candidate => candidate.id === item.formatId);
                          return (
                            <span key={item.articleId || item.formatId} className="badge badge-primary">
                              {format?.name || 'Formato'}: {item.quantity} uds.
                            </span>
                          );
                        })}
                      </div>
                    )}
                    
                    {harvestCrops.length > 0 && (
                      <div style={{ marginTop: '0.75rem', padding: '0.5rem', background: '#e2e8f0', borderRadius: '8px', fontSize: '0.85rem', color: '#475569' }}>
                        <strong style={{ display: 'block', marginBottom: '0.25rem', color: '#1e293b' }}>🌱 Composición (Lotes de Semilla):</strong>
                        <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                          {harvestCrops.map(c => {
                            const cType = cropTypes?.find(ct => ct.id === c.cropTypeId || ct.id === c.seedId);
                            return (
                              <li key={c.id}>
                                {cType?.name || 'Variedad'}: <strong style={{ color: '#0f172a' }}>{c.batchNumber || 'SIN LOTE'}</strong>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                    
                  </div>
                  <div style={{ display: 'flex', gap: '0.55rem', marginLeft: '1rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    style={{ backgroundColor: '#ecfdf5', border: '1px solid #86efac', padding: '0.75rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', color: '#166534' }}
                    onClick={() => openHarvestPackagingEditor(h)}
                  >
                    ✏️ Corregir envases
                  </button>
                  <button 
                    style={{ backgroundColor: 'white', border: '1px solid #cbd5e1', padding: '0.75rem 1.25rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', color: '#334155', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', transition: 'all 0.2s', marginLeft: '1rem' }}
                    onMouseOver={e => { e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                    onMouseOut={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.backgroundColor = 'white'; }}
                    onClick={() => handlePrintLabelsSafe(product, h.batchNumber, h.tuppersCount)}
                  >
                    <span>🖨️</span> Re-Imprimir PDF
                  </button>
                  </div>
                </div>
              )
            })}
            {(!harvests || harvests.length === 0) && (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                No hay cosechas registradas.
              </div>
            )}
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );

  const getCycleEventsForCrop = (cType, harvestTargets) => {
    const events = [];
    const targets = harvestTargets?.filter(t => t.productId == cType.id) || [];
    
    targets.forEach(ht => {
      const harvestDay = Number(ht.targetDayOfWeek);
      const cycleOffsets = getCropCycleOffsets(cType);
      const sowDay = weekDay(harvestDay - cycleOffsets.harvest);
      let currentDayOffset = 0;

      events.push({
        type: 'sow',
        icon: '📥',
        color: '#059669',
        dayOfWeek: sowDay,
        weekOffset: 0,
        fromSowDay: sowDay
      });
      
      // Soaking
      const hasSoak = Number(cType.soakingHours) > 0;
      if (hasSoak) {
        currentDayOffset += cycleOffsets.soak;
        events.push({
          type: 'soak',
          icon: '💧',
          color: '#3b82f6',
          dayOfWeek: (sowDay + currentDayOffset) % 7,
          weekOffset: Math.floor((sowDay + currentDayOffset) / 7),
          fromSowDay: sowDay
        });
      }
      
      // Germination (starts either after soak, or immediately on sowDay + germination offset?)
      // Wait, germDay in previous logic was just the day after soaking. 
      // Actually, germination starts immediately. If there is soaking, soaking takes 1 day, then germination starts?
      // Yes, currentDayOffset holds the start of the current phase.
      const germDayOfWeek = (sowDay + currentDayOffset) % 7;
      const germWeek = Math.floor((sowDay + currentDayOffset) / 7);
      events.push({
        type: 'germ',
        icon: '🌱',
        color: '#c026d3', // Fuchsia
        dayOfWeek: germDayOfWeek,
        weekOffset: germWeek,
        fromSowDay: sowDay
      });
      
      // Darkness
      currentDayOffset += Number(cType.germinationDays) || 0;
      const hasDarkness = Number(cType.darknessDays) > 0;
      if (hasDarkness) {
        events.push({
          type: 'dark',
          icon: '🌑',
          color: '#475569',
          dayOfWeek: (sowDay + currentDayOffset) % 7,
          weekOffset: Math.floor((sowDay + currentDayOffset) / 7),
          fromSowDay: sowDay
        });
      }
      
      // Light
      currentDayOffset += Number(cType.darknessDays) || 0;
      events.push({
        type: 'light',
        icon: '☀️',
        color: '#eab308',
        dayOfWeek: (sowDay + currentDayOffset) % 7,
        weekOffset: Math.floor((sowDay + currentDayOffset) / 7),
        fromSowDay: sowDay
      });
      
      // Harvest
      currentDayOffset += Number(cType.lightDays) || 0;
      events.push({
        type: 'harvest',
        icon: '✂️',
        color: '#10b981',
        dayOfWeek: harvestDay,
        weekOffset: Math.floor((sowDay + currentDayOffset) / 7),
        fromSowDay: sowDay
      });
    });
    
    return events;
  };

  const handleCellClick = (cType, dayIndex) => {
    const existing = harvestTargets?.find(ht => ht.productId == cType.id && ht.targetDayOfWeek == dayIndex);
    const dayNames = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    if (existing) {
      Swal.fire({
        title: 'Modificar Rutina',
        html: `¿Cuántas bandejas quieres cosechar de <b>${cType.name}</b> los <b>${dayNames[dayIndex]}</b>?`,
        input: 'number',
        inputValue: existing.tuppersCount,
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonColor: '#059669',
        denyButtonColor: '#ef4444',
        confirmButtonText: 'Actualizar',
        denyButtonText: 'Eliminar Cosecha',
        cancelButtonText: 'Cancelar'
      }).then((result) => {
        if (result.isConfirmed && result.value > 0) {
          updateHarvestTarget(existing.id, { tuppersCount: Number(result.value) });
        } else if (result.isDenied || (result.isConfirmed && result.value <= 0)) {
          deleteHarvestTarget(existing.id);
        }
      });
    } else {
      Swal.fire({
        title: 'Nueva Cosecha Semanal',
        html: `¿Cuántas bandejas quieres cosechar de <b>${cType.name}</b> los <b>${dayNames[dayIndex]}</b>?`,
        input: 'number',
        inputValue: 1,
        showCancelButton: true,
        confirmButtonColor: '#059669',
        confirmButtonText: 'Añadir Cosecha',
        cancelButtonText: 'Cancelar'
      }).then((result) => {
        if (result.isConfirmed && result.value > 0) {
          addHarvestTarget({
            productId: cType.id,
            targetDayOfWeek: dayIndex,
            tuppersCount: Number(result.value)
          });
        }
      });
    }
  };

  const renderPlanificador = () => {
    const tableDays = [
      { idx: 1, name: 'Lunes', short: 'Lun' },
      { idx: 2, name: 'Martes', short: 'Mar' },
      { idx: 3, name: 'Miércoles', short: 'Mié' },
      { idx: 4, name: 'Jueves', short: 'Jue' },
      { idx: 5, name: 'Viernes', short: 'Vie' },
      { idx: 6, name: 'Sábado', short: 'Sáb' },
      { idx: 0, name: 'Domingo', short: 'Dom' }
    ];
    const plannerRows = (seedVarieties || [])
      .filter(variety => variety.active !== false)
      .flatMap(variety => {
        const relatedCropTypes = (cropTypes || []).filter(cropType => cropType.varietyId === variety.id);
        return relatedCropTypes.length
          ? relatedCropTypes.map(cropType => ({ variety, cropType }))
          : [{ variety, cropType: null }];
      });
    const legacyRows = (cropTypes || [])
      .filter(cropType => !cropType.varietyId || !seedVarieties?.some(variety => variety.id === cropType.varietyId))
      .map(cropType => ({ variety: { id: `legacy-${cropType.id}`, name: cropType.name }, cropType }));

    return (
      <div>
        <div style={{ background: 'linear-gradient(135deg, #f0fdf4, #ccfbf1)', border: '1px solid #99f6e4', padding: '2rem', borderRadius: '20px', marginBottom: '2rem' }}>
          <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.8rem', fontWeight: 900, color: '#065f46' }}>Planificador Semanal por Día de Cosecha</h2>
          <p style={{ margin: 0, color: '#047857', fontSize: '1.1rem', fontWeight: 500, lineHeight: 1.5 }}>
            Selecciona los días en los que quieres cosechar cada variedad. La siembra y las fases del ciclo se calcularán automáticamente hacia atrás. Puedes programar la misma variedad varios días por semana.
          </p>
        </div>

        <div style={{ overflowX: 'auto', background: 'white', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', padding: '1.5rem', marginBottom: '2rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1000px', tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '2px solid #e2e8f0', color: '#475569', width: '200px' }}>Variedad</th>
                {tableDays.map(d => (
                  <th key={d.idx} style={{ padding: '1rem', textAlign: 'center', borderBottom: '2px solid #e2e8f0', color: '#475569', fontWeight: 800 }}>{d.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...plannerRows, ...legacyRows].map(({ variety, cropType: cType }) => {
                if (!cType) {
                  return (
                    <tr key={variety.id} style={{ borderBottom: '1px solid #f1f5f9', background: '#fffbeb' }}>
                      <td style={{ padding: '1rem', fontWeight: 700, color: '#1e293b' }}>{variety.name}</td>
                      <td colSpan={7} style={{ padding: '1rem', textAlign: 'center' }}>
                        <span style={{ color: '#92400e', fontWeight: 700, marginRight: '1rem' }}>
                          Falta la ficha de cultivo para definir consumos y duración del ciclo.
                        </span>
                        <button className="btn btn-primary" onClick={() => setActiveTab('stock')}>
                          Crear ficha de cultivo
                        </button>
                      </td>
                    </tr>
                  );
                }
                const cropEvents = getCycleEventsForCrop(cType, harvestTargets);

                return (
                  <tr key={cType.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '1rem', color: '#1e293b' }}>
                      <div style={{ fontWeight: 800 }}>{variety.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>Ficha: {cType.name}</div>
                    </td>
                    {tableDays.map(d => {
                      const ht = harvestTargets?.find(t => t.productId == cType.id && t.targetDayOfWeek == d.idx);
                      const eventsToday = cropEvents.filter(e => e.dayOfWeek === d.idx);
                      
                      return (
                        <td key={d.idx} style={{ padding: '0.5rem', verticalAlign: 'top', height: '100%' }}>
                          <div 
                            onClick={() => handleCellClick(cType, d.idx)}
                            style={{
                              height: '100%',
                              minHeight: '90px',
                              borderRadius: '12px',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'flex-start',
                              padding: '0.5rem',
                              transition: 'all 0.2s ease',
                              border: ht ? '2px solid #10b981' : '2px dashed #cbd5e1',
                              background: ht ? '#f0fdf4' : (eventsToday.length > 0 ? '#f8fafc' : 'transparent'),
                              position: 'relative'
                            }}
                            onMouseEnter={e => {
                              if (!ht) e.currentTarget.style.borderColor = '#94a3b8';
                              e.currentTarget.style.transform = 'scale(1.02)';
                            }}
                            onMouseLeave={e => {
                              if (!ht) e.currentTarget.style.borderColor = '#cbd5e1';
                              e.currentTarget.style.transform = 'scale(1)';
                            }}
                          >
                            {ht ? (
                              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#059669', marginBottom: '0.5rem', background: '#d1fae5', padding: '2px 8px', borderRadius: '12px' }}>
                                ✂️ Cosecha: {ht.tuppersCount}
                              </div>
                            ) : (
                              eventsToday.length === 0 && <div style={{ color: '#cbd5e1', fontSize: '1.5rem', fontWeight: 900, opacity: 0.5 }}>+</div>
                            )}

                            {eventsToday.length > 0 && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                                {eventsToday.map((ev, i) => {
                                  const sourceDay = tableDays.find(td => td.idx === ev.fromSowDay)?.short || '';
                                  const weekStr = ev.weekOffset > 0 ? ` (+${ev.weekOffset}s)` : '';
                                  return (
                                    <div key={i} style={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      gap: '4px', 
                                      fontSize: '0.75rem', 
                                      color: ev.color, 
                                      fontWeight: ev.type === 'harvest' || ev.type === 'germ' ? 'bold' : 'normal',
                                      background: 'white',
                                      padding: '2px 6px',
                                      borderRadius: '6px',
                                      border: `1px solid ${ev.color}40`,
                                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                    }}>
                                      <span>{ev.icon}</span>
                                      <span>de {sourceDay}{weekStr}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderCropsHub = () => (
    <div className="hub-container" style={{ padding: '2rem', animation: 'fadeIn 0.4s ease' }}>
      <div className="hub-content" style={{ maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
        <div className="hub-header" style={{ marginBottom: '4rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h1 style={{ fontSize: '3rem', margin: '0 0 0.5rem 0', color: '#0f172a', fontWeight: '900', letterSpacing: '-0.05em' }}>Control de Producción</h1>
          <p style={{ color: '#64748b', fontSize: '1.25rem', margin: 0 }}>Selecciona tu zona de trabajo para gestionar el invernadero</p>
        </div>
        
        <div className="hub-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <button onClick={() => setActiveTab('stock')} className="hub-card" style={{ border: 'none', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem 1rem', background: 'linear-gradient(135deg, #fffbeb, #fef3c7)', borderRadius: '24px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.01)', transition: 'all 0.3s ease', cursor: 'pointer' }}>
            <div className="hub-card-text" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#92400e', margin: '0 0 0.5rem 0' }}>Stock</h2>
              <p style={{ fontSize: '1rem', color: '#b45309', margin: 0 }}>Semillas e insumos</p>
            </div>
            <div className="hub-card-icon" style={{ fontSize: '4rem', background: '#fefce8', width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>📦</div>
          </button>

        <button onClick={() => setActiveTab('tareas')} className="hub-card crops-card" style={{ border: 'none', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem 1rem', background: 'white', borderRadius: '24px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.01)', transition: 'all 0.3s ease', cursor: 'pointer' }}>
          <div className="hub-card-text" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#1e293b', margin: '0 0 0.5rem 0' }}>Tareas</h2>
            <p style={{ fontSize: '1rem', color: '#64748b', margin: 0 }}>Día / Semana / Mes</p>
          </div>
          <div className="hub-card-icon" style={{ fontSize: '4rem', background: '#fef2f2', width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>🎯</div>
        </button>

        <button onClick={() => setActiveTab('lotes')} className="hub-card tv-card" style={{ border: 'none', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem 1rem', background: 'white', borderRadius: '24px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.01)', transition: 'all 0.3s ease', cursor: 'pointer' }}>
          <div className="hub-card-text" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#1e293b', margin: '0 0 0.5rem 0' }}>Cultivos</h2>
            <p style={{ fontSize: '1rem', color: '#64748b', margin: 0 }}>Bandejas activas y seguimiento</p>
          </div>
          <div className="hub-card-icon" style={{ fontSize: '4rem', background: '#f0fdf4', width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>🪴</div>
        </button>

        <button onClick={() => { setHarvestTab('cosechar'); setActiveTab('cosechas'); }} className="hub-card admin-card" style={{ border: 'none', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem 1rem', background: 'white', borderRadius: '24px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.01)', transition: 'all 0.3s ease', cursor: 'pointer' }}>
          <div className="hub-card-text" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#1e293b', margin: '0 0 0.5rem 0' }}>Cosecha</h2>
            <p style={{ fontSize: '1rem', color: '#64748b', margin: 0 }}>Envasado y etiquetas</p>
          </div>
          <div className="hub-card-icon" style={{ fontSize: '4rem', background: '#f8fafc', width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>🔪</div>
        </button>

        <button onClick={() => setActiveTab('planificador')} className="hub-card driver-card" style={{ border: 'none', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem 1rem', background: 'white', borderRadius: '24px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.01)', transition: 'all 0.3s ease', cursor: 'pointer' }}>
          <div className="hub-card-text" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#1e293b', margin: '0 0 0.5rem 0' }}>Planificador</h2>
            <p style={{ fontSize: '1rem', color: '#64748b', margin: 0 }}>Rutinas automáticas</p>
          </div>
          <div className="hub-card-icon" style={{ fontSize: '4rem', background: '#eff6ff', width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>📅</div>
        </button>

        <button onClick={() => setActiveTab('trazabilidad')} className="hub-card" style={{ border: 'none', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem 1rem', background: 'linear-gradient(135deg, #ecfdf5, #f0fdfa)', borderRadius: '24px', boxShadow: '0 10px 25px -5px rgba(5,150,105,0.12)', transition: 'all 0.3s ease', cursor: 'pointer' }}>
          <div className="hub-card-text" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#065f46', margin: '0 0 0.5rem 0' }}>Trazabilidad</h2>
            <p style={{ fontSize: '1rem', color: '#047857', margin: 0 }}>Del proveedor al cliente</p>
          </div>
          <div className="hub-card-icon" style={{ fontSize: '4rem', background: '#d1fae5', width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>🔎</div>
        </button>
      </div>
      </div>
    </div>
  );

  const renderPedidos = () => {
    const handleStatusChange = (orderId, newStatus) => {
      updateOrderList(orderId, { status: newStatus });
    };

    return (
      <div style={{ animation: 'fadeIn 0.3s ease' }}>
        <div className="tasks-header" style={{ marginBottom: '3rem', textAlign: 'center' }}>
          <h2>Gestión de Pedidos y Reparto</h2>
          <p style={{ color: '#64748b', fontSize: '1.25rem' }}>Mueve los pedidos por el circuito logístico.</p>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          {/* Columna Pendientes */}
          <div style={{ background: '#f8fafc', borderRadius: '16px', padding: '1.5rem', border: '1px solid #e2e8f0' }}>
            <h3 style={{ color: '#d97706', fontSize: '1.5rem', textAlign: 'center', marginBottom: '1.5rem' }}>🟡 PENDIENTES</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {orders?.filter(o => o.status === 'PENDING').map(o => {
                const client = clients?.find(c => c.id === o.clientId);
                return (
                  <div key={o.id} className="crops-card" style={{ padding: '1rem', borderLeft: '6px solid #fbbf24' }}>
                    <h4 style={{ fontSize: '1.2rem', margin: '0 0 0.5rem 0' }}>{client?.name || 'Desconocido'}</h4>
                    <p style={{ margin: '0 0 1rem 0', color: '#64748b' }}>{o.items?.length || 0} tuppers a preparar</p>
                    <button 
                      onClick={() => handleStatusChange(o.id, 'PREPARED')}
                      className="btn btn-primary" style={{ width: '100%', padding: '0.8rem', background: '#38bdf8', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>
                      MARCAR PREPARADO ✅
                    </button>
                  </div>
                );
              })}
              {(!orders || orders.filter(o => o.status === 'PENDING').length === 0) && <p style={{ textAlign: 'center', color: '#94a3b8' }}>Todo envasado</p>}
            </div>
          </div>

          {/* Columna Preparados */}
          <div style={{ background: '#f8fafc', borderRadius: '16px', padding: '1.5rem', border: '1px solid #e2e8f0' }}>
            <h3 style={{ color: '#0284c7', fontSize: '1.5rem', textAlign: 'center', marginBottom: '1.5rem' }}>🔵 PREPARADOS</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {orders?.filter(o => o.status === 'PREPARED').map(o => {
                const client = clients?.find(c => c.id === o.clientId);
                return (
                  <div key={o.id} className="crops-card" style={{ padding: '1rem', borderLeft: '6px solid #38bdf8' }}>
                    <h4 style={{ fontSize: '1.2rem', margin: '0 0 0.5rem 0' }}>{client?.name || 'Desconocido'}</h4>
                    <p style={{ margin: '0 0 1rem 0', color: '#64748b' }}>Caja lista en expedición</p>
                    <button 
                      onClick={() => handleStatusChange(o.id, 'IN_TRANSIT')}
                      className="btn btn-primary" style={{ width: '100%', padding: '0.8rem', background: '#a855f7', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>
                      METER A FURGONETA 🚚
                    </button>
                  </div>
                );
              })}
              {(!orders || orders.filter(o => o.status === 'PREPARED').length === 0) && <p style={{ textAlign: 'center', color: '#94a3b8' }}>Nada esperando carga</p>}
            </div>
          </div>

          {/* Columna En Reparto */}
          <div style={{ background: '#f8fafc', borderRadius: '16px', padding: '1.5rem', border: '1px solid #e2e8f0' }}>
            <h3 style={{ color: '#7e22ce', fontSize: '1.5rem', textAlign: 'center', marginBottom: '1.5rem' }}>🟣 EN REPARTO</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {orders?.filter(o => o.status === 'IN_TRANSIT').map(o => {
                const client = clients?.find(c => c.id === o.clientId);
                return (
                  <div key={o.id} className="crops-card" style={{ padding: '1rem', borderLeft: '6px solid #a855f7' }}>
                    <h4 style={{ fontSize: '1.2rem', margin: '0 0 0.5rem 0' }}>{client?.name || 'Desconocido'}</h4>
                    <p style={{ margin: '0 0 1rem 0', color: '#64748b' }}>El conductor lo lleva</p>
                    <button 
                      onClick={() => window.location.href='/repartidor'}
                      className="btn btn-primary" style={{ width: '100%', padding: '0.8rem', background: '#10b981', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>
                      FIRMAR ENTREGA 📱
                    </button>
                  </div>
                );
              })}
              {(!orders || orders.filter(o => o.status === 'IN_TRANSIT').length === 0) && <p style={{ textAlign: 'center', color: '#94a3b8' }}>Ningún conductor en ruta</p>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderHarvestPlanner = () => {
    const selectableVarieties = (cropTypes || [])
      .map(cropType => {
        const variety = seedVarieties?.find(item => item.id === cropType.varietyId);
        return { cropType, variety, name: variety?.name || cropType.name };
      })
      .filter(item => item.variety?.active !== false)
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));

    const missingCropTypeCount = (seedVarieties || []).filter(variety =>
      variety.active !== false && !(cropTypes || []).some(cropType => cropType.varietyId === variety.id)
    ).length;
    const selectedCropTypeIds = Object.keys(plannerSelections);
    const routineRows = (harvestTargets || [])
      .map(routine => {
        const cropType = cropTypes?.find(item => item.id == routine.productId);
        if (!cropType) return null;
        const variety = seedVarieties?.find(item => item.id === cropType.varietyId);
        return { routine, cropType, varietyName: variety?.name || cropType.name };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const dayA = PLANNER_DAYS.findIndex(day => day.idx === Number(a.routine.targetDayOfWeek));
        const dayB = PLANNER_DAYS.findIndex(day => day.idx === Number(b.routine.targetDayOfWeek));
        return dayA - dayB || a.varietyName.localeCompare(b.varietyName, 'es');
      });
    const calendarRows = routineRows.map(row => {
      const harvestDay = Number(row.routine.targetDayOfWeek);
      const sowDay = weekDay(harvestDay - getCropCycleOffsets(row.cropType).harvest);
      return {
        ...row,
        calendarDay: plannerView === 'harvest' ? harvestDay : sowDay,
        harvestDay
      };
    });

    const togglePlannerVariety = (cropTypeId, checked) => {
      setPlannerSelections(previous => {
        const next = { ...previous };
        if (checked) next[cropTypeId] = 1;
        else delete next[cropTypeId];
        return next;
      });
    };

    const openPlannerDay = dayIndex => {
      const daySelections = {};
      (harvestTargets || [])
        .filter(target => Number(target.targetDayOfWeek) === Number(dayIndex))
        .forEach(target => {
          daySelections[target.productId] = Number(target.tuppersCount) || 1;
        });
      setPlannerSelections(daySelections);
      setPlannerHarvestDay(String(dayIndex));
    };

    const closePlannerDay = () => {
      setPlannerHarvestDay('');
      setPlannerSelections({});
    };

    const savePlannerDay = async () => {
      const dayIndex = Number(plannerHarvestDay);
      const existingTargets = (harvestTargets || []).filter(target =>
        Number(target.targetDayOfWeek) === dayIndex
      );

      for (const target of existingTargets) {
        if (!Object.prototype.hasOwnProperty.call(plannerSelections, target.productId)) {
          await deleteHarvestTarget(target.id);
        }
      }

      for (const cropTypeId of selectedCropTypeIds) {
        const quantity = Math.max(1, Number(plannerSelections[cropTypeId]) || 1);
        const existing = existingTargets.find(target => target.productId == cropTypeId);
        if (!existing) {
          await addHarvestTarget({
            productId: cropTypeId,
            targetDayOfWeek: dayIndex,
            tuppersCount: quantity
          });
        } else if (Number(existing.tuppersCount) !== quantity) {
          await updateHarvestTarget(existing.id, { tuppersCount: quantity });
        }
      }

      closePlannerDay();
      Swal.fire({
        title: 'Día actualizado',
        text: `La planificación del ${plannerDayName(dayIndex).toLowerCase()} se ha guardado.`,
        icon: 'success',
        confirmButtonColor: '#059669',
        timer: 1600,
        showConfirmButton: false
      });
    };

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.65rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.55rem', fontWeight: 900, color: plannerView === 'harvest' ? '#065f46' : '#1e40af' }}>
            Planificador de {plannerView === 'harvest' ? 'Cosechas' : 'Siembras'}
          </h2>
          <div style={{ display: 'inline-flex', gap: '0.25rem', padding: '0.22rem', background: '#e2e8f0', borderRadius: '10px' }}>
          <button
            type="button"
            onClick={() => setPlannerView('harvest')}
            style={{
              border: 0,
              borderRadius: '8px',
              padding: '0.48rem 0.8rem',
              cursor: 'pointer',
              fontWeight: 800,
              color: plannerView === 'harvest' ? 'white' : '#475569',
              background: plannerView === 'harvest' ? '#059669' : 'transparent'
            }}
          >
            ✂️ Cosechas
          </button>
          <button
            type="button"
            onClick={() => {
              closePlannerDay();
              setPlannerView('sowing');
            }}
            style={{
              border: 0,
              borderRadius: '8px',
              padding: '0.48rem 0.8rem',
              cursor: 'pointer',
              fontWeight: 800,
              color: plannerView === 'sowing' ? 'white' : '#475569',
              background: plannerView === 'sowing' ? '#2563eb' : 'transparent'
            }}
          >
            🌱 Siembras
          </button>
          </div>
        </div>

        <section>
          <div style={{ overflowX: 'auto', paddingBottom: '0.5rem' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, minmax(125px, 1fr))',
                minWidth: '920px',
                gap: '0.45rem',
                alignItems: 'stretch'
              }}>
                {PLANNER_DAYS.map(day => {
                  const dayRoutines = calendarRows.filter(row => row.calendarDay === day.idx);
                  const isToday = new Date().getDay() === day.idx;
                  return (
                    <div key={day.idx} style={{
                      border: isToday ? '2px solid #10b981' : '1px solid #dbe4ee',
                      borderRadius: '12px',
                      background: '#f8fafc',
                      minHeight: '105px',
                      overflow: 'hidden'
                    }}>
                      <button type="button" disabled={plannerView !== 'harvest'} onClick={() => plannerView === 'harvest' && openPlannerDay(day.idx)} style={{
                        width: '100%',
                        border: 0,
                        cursor: plannerView === 'harvest' ? 'pointer' : 'default',
                        padding: '0.45rem 0.35rem',
                        textAlign: 'center',
                        fontWeight: 900,
                        color: isToday ? 'white' : '#334155',
                        background: isToday ? '#059669' : '#e2e8f0'
                      }}>
                        {day.name}
                        {isToday && <small style={{ marginLeft: '0.3rem', fontWeight: 700, opacity: 0.8 }}>· Hoy</small>}
                      </button>
                      <div onClick={() => plannerView === 'harvest' && openPlannerDay(day.idx)} style={{ display: 'flex', flexDirection: 'column', gap: '0.22rem', padding: '0.3rem', cursor: plannerView === 'harvest' ? 'pointer' : 'default' }}>
                        {dayRoutines.length === 0 ? (
                          <div style={{ color: '#94a3b8', textAlign: 'center', padding: '1rem 0.2rem', fontSize: '0.78rem' }}>
                            {plannerView === 'harvest' ? '+ Añadir' : 'Sin siembras'}
                          </div>
                        ) : dayRoutines.map(({ routine, varietyName, harvestDay }) => (
                          <article key={routine.id} style={{
                            background: 'white',
                            border: `1px solid ${plannerView === 'harvest' ? '#a7f3d0' : '#bfdbfe'}`,
                            borderLeft: `3px solid ${plannerView === 'harvest' ? '#10b981' : '#3b82f6'}`,
                            borderRadius: '6px',
                            padding: '0.3rem 0.38rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.3rem'
                          }}>
                            <div title={varietyName} style={{ fontSize: '0.72rem', fontWeight: 900, color: '#0f172a', lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{varietyName}</div>
                            <div style={{ color: plannerView === 'harvest' ? '#047857' : '#1d4ed8', fontWeight: 900, fontSize: '0.68rem', whiteSpace: 'nowrap' }}>
                              {routine.tuppersCount} bdj.
                              {plannerView === 'sowing' && <span title={`Cosecha: ${plannerDayName(harvestDay)}`} style={{ color: '#64748b', marginLeft: '0.22rem' }}>· C:{plannerDayName(harvestDay, true)}</span>}
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
        </section>

        {plannerHarvestDay !== '' && (
          <div style={modalOverlayStyle} onClick={closePlannerDay}>
            <div style={{ ...modalCardStyle, maxWidth: '760px', padding: 0, overflow: 'hidden' }} onClick={event => event.stopPropagation()}>
              <div style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.35rem' }}>Cosechas del {plannerDayName(plannerHarvestDay).toLowerCase()}</h3>
                  <p style={{ margin: '0.25rem 0 0', color: '#d1fae5' }}>Selecciona las variedades y el número de bandejas.</p>
                </div>
                <button type="button" onClick={closePlannerDay} style={{ border: 0, background: 'rgba(255,255,255,0.18)', color: 'white', borderRadius: '8px', width: '36px', height: '36px', cursor: 'pointer', fontSize: '1.35rem' }}>×</button>
              </div>

              <div style={{ padding: '1.25rem', maxHeight: '62vh', overflowY: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.55rem' }}>
                  {selectableVarieties.map(({ cropType, name }) => {
                    const checked = Object.prototype.hasOwnProperty.call(plannerSelections, cropType.id);
                    return (
                      <div key={cropType.id} style={{
                        border: checked ? '2px solid #10b981' : '1px solid #dbe4ee',
                        background: checked ? '#ecfdf5' : 'white',
                        borderRadius: '10px',
                        padding: '0.65rem'
                      }}>
                        <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={event => togglePlannerVariety(cropType.id, event.target.checked)}
                            style={{ width: '19px', height: '19px', accentColor: '#059669' }}
                          />
                          <strong style={{ flex: 1, color: '#0f172a', fontSize: '0.9rem' }}>{name}</strong>
                          {checked && (
                            <input
                              type="number"
                              min="1"
                              step="1"
                              aria-label={`Bandejas de ${name}`}
                              value={plannerSelections[cropType.id]}
                              onClick={event => event.stopPropagation()}
                              onChange={event => setPlannerSelections(previous => ({
                                ...previous,
                                [cropType.id]: Math.max(1, Number(event.target.value) || 1)
                              }))}
                              className="premium-input"
                              style={{ width: '68px', padding: '0.35rem' }}
                            />
                          )}
                        </label>
                      </div>
                    );
                  })}
                </div>
                {missingCropTypeCount > 0 && (
                  <p style={{ color: '#92400e', background: '#fffbeb', padding: '0.65rem', borderRadius: '8px', fontSize: '0.82rem', marginBottom: 0 }}>
                    {missingCropTypeCount} variedad{missingCropTypeCount === 1 ? '' : 'es'} no aparece{missingCropTypeCount === 1 ? '' : 'n'} porque no tiene{missingCropTypeCount === 1 ? '' : 'n'} ficha de cultivo.
                  </p>
                )}
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', padding: '1rem 1.25rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', background: '#f8fafc' }}>
                <button type="button" className="btn" onClick={closePlannerDay}>Cancelar</button>
                <button type="button" className="btn btn-primary" onClick={savePlannerDay}>Guardar día</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <ErrorBoundary>
      <div className="crops-module" style={{ paddingBottom: '5rem', maxWidth: '1400px', margin: '0 auto', paddingTop: '1rem' }}>
      {activeTab === 'menu' && (
        <button onClick={() => navigate('/')} style={{ background: 'transparent', border: '1px solid var(--crop-border)', color: 'var(--crop-text-main)', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>🏠</span> Volver al Hub Central
        </button>
      )}
      
      {activeTab !== 'menu' && (
        <button onClick={() => setActiveTab('menu')} style={{ background: 'transparent', border: '1px solid var(--crop-border)', color: 'var(--crop-text-main)', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginBottom: activeTab === 'planificador' ? '0.65rem' : '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>🔙</span> Volver al Menú Producción
        </button>
      )}

      <div style={{ animation: 'fadeIn 0.3s ease' }}>
        {activeTab === 'menu' && renderCropsHub()}
        
        {activeTab === 'tareas' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
              <button 
                onClick={() => window.open('/tv', 'TVMode', 'width=1920,height=1080,menubar=no,toolbar=no,location=no,status=no,resizable=yes')} 
                style={{ background: '#0ea5e9', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(14, 165, 233, 0.3)' }}>
                🖥️ Lanzar en Modo TV
              </button>
            </div>
            <EmployeeTasks
              onTaskAction={(task) => {
                if (task.type === 'plant') {
                  openSowModal({ cropTypeId: task.cropTypeId, traysCount: task.trays || 1 });
                } else if (task.type === 'harvest') {
                  const crop = crops?.find(item => String(item.id) === String(task.cropId));
                  if (crop) openHarvestModalForCrop(crop);
                  else setIsHarvestModalOpen(true);
                }
              }}
              onHarvestBatchAction={openHarvestBatch}
            />
          </div>
        )}
        {activeTab === 'lotes' && renderLotes()}
        {activeTab === 'cosechas' && renderCosechas()}
        {activeTab === 'planificador' && renderHarvestPlanner()}
        {activeTab === 'trazabilidad' && <TraceabilityExplorer />}
        {activeTab === 'historial' && renderHistorial()}
        {activeTab === 'pedidos' && renderPedidos()}
        {activeTab === 'stock' && <Supplies />}
      </div>
      
    
      {isSowModalOpen && (
          <div style={{ ...modalOverlayStyle, padding: '0.75rem', boxSizing: 'border-box' }}>
            <div style={{ ...modalCardStyle, maxWidth: '500px', width: '100%', margin: 0, padding: 0, overflow: 'hidden', maxHeight: 'calc(100dvh - 1.5rem)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ background: 'linear-gradient(135deg, #10b981, #059669)', padding: '1.5rem', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '0.5rem', borderRadius: '0.5rem', fontSize: '1.5rem' }}>🌱</div>
                  <div>
                    <h3 style={{ fontWeight: 'bold', fontSize: '1.25rem', margin: 0 }}>Registrar Siembra</h3>
                    <p style={{ color: '#d1fae5', fontSize: '0.875rem', margin: 0 }}>Añade nuevas bandejas al invernadero</p>
                  </div>
                </div>
                <button onClick={closeSowModal} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer', opacity: 0.8 }} onMouseOver={e=>e.currentTarget.style.opacity=1} onMouseOut={e=>e.currentTarget.style.opacity=0.8}>&times;</button>
              </div>
              <div style={{ padding: '2rem', overflowY: 'auto', minHeight: 0, overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>
                  
                  <form onSubmit={handleAddCrop} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div>
                    <label style={{ fontSize: '0.875rem', fontWeight: 'bold', marginBottom: '0.5rem', display: 'block', color: '#334155' }}>1. ¿Qué vas a plantar?</label>
                    <select className="premium-input" style={{ width: '100%', padding: '1rem', borderRadius: '0.75rem', border: '2px solid #e2e8f0', background: '#f8fafc', fontSize: '1rem', fontWeight: '500', boxSizing: 'border-box' }} required value={newCrop.cropTypeId} onChange={e => {
                      const cropTypeId = e.target.value;
                      const cropType = cropTypes?.find(item => item.id === cropTypeId);
                      setNewCrop({ ...newCrop, cropTypeId, stockLotId: '', initialStatus: suggestedStatusForSowingDate(cropType, newCrop.datePlanted) });
                    }}>
                      <option value="">Selecciona una variedad...</option>
                      {cropTypes?.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.875rem', fontWeight: 'bold', marginBottom: '0.5rem', display: 'block', color: '#334155' }}>2. Fecha y hora reales de siembra</label>
                    <div style={{ display: 'flex', gap: '0.65rem' }}>
                      <input
                        type="datetime-local"
                        required
                        max={toLocalDateTimeInputValue()}
                        className="premium-input"
                        style={{ flex: 1, padding: '0.9rem', borderRadius: '0.75rem', border: '2px solid #e2e8f0', boxSizing: 'border-box', fontWeight: 700 }}
                        value={newCrop.datePlanted}
                        onChange={event => {
                          const datePlanted = event.target.value;
                          setNewCrop(prev => ({ ...prev, datePlanted, initialStatus: suggestedStatusForSowingDate(selectedCropType, datePlanted) }));
                        }}
                      />
                      <button type="button" className="btn btn-secondary" onClick={() => {
                        const datePlanted = toLocalDateTimeInputValue();
                        setNewCrop(prev => ({ ...prev, datePlanted, initialStatus: suggestedStatusForSowingDate(selectedCropType, datePlanted) }));
                      }}>Ahora</button>
                    </div>
                    {newCrop.datePlanted && new Date(newCrop.datePlanted).getTime() < Date.now() - 5 * 60_000 && (
                      <div style={{ marginTop: '0.6rem', padding: '0.65rem 0.8rem', borderRadius: '0.6rem', background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', fontSize: '0.8rem', fontWeight: 700 }}>
                        ⚠️ Siembra retroactiva: se conservará esta fecha en la trazabilidad.
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={{ fontSize: '0.875rem', fontWeight: 'bold', marginBottom: '0.5rem', display: 'block', color: '#334155' }}>3. Fase física actual</label>
                    <select className="premium-input" required value={newCrop.initialStatus} onChange={event => setNewCrop(prev => ({ ...prev, initialStatus: event.target.value }))} style={{ width: '100%', padding: '0.9rem', borderRadius: '0.75rem', border: '2px solid #e2e8f0', background: '#f8fafc', fontWeight: 700 }}>
                      {CROP_PHASE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    <p style={{ margin: '0.45rem 0 0', color: '#64748b', fontSize: '0.75rem' }}>La aplicación propone una fase según la ficha y la fecha; confirma aquí dónde está físicamente el cultivo.</p>
                  </div>

                  {selectedCropType && (
                      <div style={{ background: '#f0fdf4', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #bbf7d0', display: 'flex', gap: '1rem', alignItems: 'flex-start', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
                          <div style={{ fontSize: '1.5rem', marginTop: '0.25rem' }}>🌱</div>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#166534', display: 'block', marginBottom: '0.25rem' }}>Inventario Disponible Total</label>
                            <p style={{ fontSize: '1.25rem', fontWeight: '900', color: '#14532d', margin: 0 }}>
                              {totalAvailableSeed.toFixed(2)} g 
                              {selectedCropType.seedGrams > 0 && <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#15803d', marginLeft: '0.5rem' }}>(Max. {Math.floor(totalAvailableSeed / selectedCropType.seedGrams)} bandejas)</span>}
                            </p>
                            <p style={{ fontSize: '0.875rem', fontWeight: '700', color: '#15803d', margin: '0.35rem 0 0' }}>
                              Consumo previsto: {Number(selectedCropType.seedGrams || 0)} g por bandeja
                              {Number(newCrop.traysCount || 0) > 0 && ` · ${(Number(selectedCropType.seedGrams || 0) * Number(newCrop.traysCount || 0)).toFixed(2)} g total`}
                            </p>
                          </div>
                        </div>

                        <div style={{ width: '100%', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed #bbf7d0' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#166534', display: 'block', marginBottom: '0.5rem' }}>Selecciona el Lote de Semillas (Trazabilidad)</label>
                          <select className="premium-input" style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #86efac', background: 'white', fontSize: '0.875rem', fontWeight: 'bold' }} required value={newCrop.stockLotId || ''} onChange={e => setNewCrop({...newCrop, stockLotId: e.target.value})}>
                            <option value="">-- Sin stock de lotes --</option>
                            {availableBatches.map(b => (
                              <option key={b.id} value={b.id}>
                                {b.supplierBatch} · {articles?.find(a => a.id === b.articleId)?.name || 'Semilla'}
                                {' · '}{providers?.find(p => p.id === b.providerId)?.name || 'Sin proveedor'}
                                {' · '}{Number(b.remainingQuantity).toFixed(2)} g
                                {' · '}{Number(b.unitCost || 0).toFixed(4)} €/g
                              </option>
                            ))}
                          </select>
                          
                          {newCrop.stockLotId && newCrop.stockLotId !== oldestBatch && (
                            <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem', backgroundColor: '#fffbeb', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #fde68a' }}>
                              <span style={{ fontSize: '1.25rem' }}>⚠️</span>
                              <p style={{ margin: 0, fontSize: '0.75rem', color: '#92400e', fontWeight: 'bold', lineHeight: 1.4 }}>Aviso: hay un lote más antiguo disponible ({availableBatches[0]?.supplierBatch}). Se recomienda FIFO para evitar caducidades y mermas.</p>
                            </div>
                          )}
                          
                          <p style={{ fontSize: '0.75rem', color: '#15803d', marginTop: '0.75rem', lineHeight: 1.5 }}>Al plantar, se descontará automáticamente el consumo asignándolo al lote seleccionado para garantizar la trazabilidad.</p>
                        </div>
                      </div>
                    )}

                  <div>
                    <label style={{ fontSize: '0.875rem', fontWeight: 'bold', marginBottom: '0.5rem', display: 'block', color: '#334155' }}>4. ¿Cuántas bandejas son?</label>
                    <input type="number" required min="1" className="premium-input" style={{ width: '100%', padding: '1rem', borderRadius: '0.75rem', border: '2px solid #e2e8f0', fontSize: '1.5rem', fontWeight: '900', color: '#0f172a', textAlign: 'center', boxSizing: 'border-box' }} value={newCrop.traysCount} onChange={e=>setNewCrop({...newCrop, traysCount: Number(e.target.value)})}/>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                    <button type="button" onClick={closeSowModal} style={{ flex: '1', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: '2px solid #e2e8f0', color: '#475569', fontWeight: 'bold', backgroundColor: 'white', cursor: 'pointer', transition: 'background-color 0.2s' }} onMouseOver={e=>e.currentTarget.style.backgroundColor='#f8fafc'} onMouseOut={e=>e.currentTarget.style.backgroundColor='white'}>Cancelar</button>
                    <button type="submit" disabled={selectedCropType && totalAvailableSeed <= 0} style={{ flex: '1', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: 'none', color: 'white', fontWeight: 'bold', background: 'linear-gradient(135deg, #10b981, #059669)', cursor: (selectedCropType && totalAvailableSeed <= 0) ? 'not-allowed' : 'pointer', opacity: (selectedCropType && totalAvailableSeed <= 0) ? 0.5 : 1, boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)' }}>
                      {selectedCropType && totalAvailableSeed <= 0 ? 'Sin Semilla' : 'Confirmar Siembra'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

{isHarvestModalOpen && (
  <div style={modalOverlayStyle}>
    <div style={{ ...modalCardStyle, width: '760px', maxWidth: '94vw', maxHeight: '92vh', padding: 0, overflowY: 'auto' }}>
      
      {/* HEADER */}
      <div style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)', padding: '1.5rem', color: 'white', position: 'relative' }}>
        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>✂️</span> Registrar Cosecha
        </h3>
        <p style={{ margin: '0.5rem 0 0 0', color: '#94a3b8', fontSize: '0.9rem' }}>Selecciona el producto a envasar y las bandejas a cortar.</p>
        {harvestBatchQueue.length > 0 && <p style={{ margin: '0.35rem 0 0 2rem', color: '#bbf7d0', fontSize: '0.8rem', fontWeight: 700 }}>Modo múltiple · {harvestBatchQueue.length} cosecha{harvestBatchQueue.length === 1 ? '' : 's'} pendiente{harvestBatchQueue.length === 1 ? '' : 's'}</p>}
        <button onClick={closeHarvestModal} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }} onMouseOver={e=>e.currentTarget.style.background='rgba(255,255,255,0.2)'} onMouseOut={e=>e.currentTarget.style.background='rgba(255,255,255,0.1)'}>&times;</button>
      </div>

      <form onSubmit={handleRegisterHarvest} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* PASO 1 */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>1. Fecha y hora reales de cosecha</label>
          <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'stretch' }}>
            <input
              type="datetime-local"
              required
              max={toLocalDateTimeInputValue()}
              className="premium-input"
              style={{ flex: 1, padding: '0.9rem', borderRadius: '0.75rem', border: '2px solid #e2e8f0', boxSizing: 'border-box', fontWeight: 700 }}
              value={newHarvest.harvestDate}
              onChange={event => setNewHarvest(prev => ({ ...prev, harvestDate: event.target.value }))}
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setNewHarvest(prev => ({ ...prev, harvestDate: toLocalDateTimeInputValue() }))}
              style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}
            >
              Ahora
            </button>
          </div>
          {newHarvest.harvestDate && new Date(newHarvest.harvestDate).getTime() < Date.now() - 5 * 60_000 && (
            <div style={{ marginTop: '0.6rem', padding: '0.65rem 0.8rem', borderRadius: '0.6rem', background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', fontSize: '0.8rem', fontWeight: 700 }}>
              ⚠️ Registro retroactivo: la trazabilidad utilizará esta fecha como momento real de cosecha.
            </div>
          )}
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>2. Producto a Envasar</label>
          <select 
            className="premium-input" 
            style={{ width: '100%', padding: '1rem', borderRadius: '0.75rem', border: '2px solid #e2e8f0', background: '#f8fafc', fontSize: '1rem', fontWeight: 'bold', color: '#0f172a', boxSizing: 'border-box', cursor: 'pointer' }}
            required 
            value={newHarvest.productId} 
            onChange={e => handleProductSelect(e.target.value)}
          >
            <option value="">-- Seleccionar Producto --</option>
            {(() => {
              return (products || []).map(p => {
                const availability = productHarvestAvailability(p);
                const statusText = !availability.configured
                  ? 'Receta sin configurar'
                  : !availability.packagingConfigured
                    ? 'Envase sin asignar'
                  : availability.canHarvest
                    ? `${availability.availableVarieties} variedades · ${availability.totalTrays} bandejas listas`
                    : `${availability.availableVarieties}/${availability.minimumVarieties} variedades listas`;
                return (
                  <option key={p.id} value={p.id} disabled={!availability.canHarvest}>
                    {p.name} ({statusText})
                  </option>
                );
              });
            })()}
          </select>
        </div>

        {/* PASO 2 */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>3. Bandejas a Cortar</label>
          <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '0.75rem', padding: '1rem', maxHeight: '200px', overflowY: 'auto' }}>
            {(() => {
              const harvestProduct = products?.find(p => p.id === newHarvest.productId);
              if (!harvestProduct) return <div style={{ textAlign: 'center', color: '#94a3b8', padding: '1rem 0' }}>Selecciona un producto arriba para ver las bandejas.</div>;

              const availableCrops = readyCropsForProduct(harvestProduct);

              if (availableCrops.length === 0) {
                return (
                  <div style={{ textAlign: 'center', padding: '1rem 0', color: '#ef4444', fontWeight: '500' }}>
                    <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '0.25rem' }}>⚠️</span>
                    No hay cultivos listos para este producto.
                  </div>
                );
              }

              const grouped = {};
              availableCrops.forEach(crop => {
                const cType = cropTypes?.find(c => c.id === crop.seedId || c.id === crop.cropTypeId);
                const varietyId = cropVarietyId(crop);
                const varietyName = seedVarieties?.find(variety => variety.id === varietyId)?.name || cType?.name || 'Desconocido';
                if (!grouped[varietyName]) grouped[varietyName] = [];
                grouped[varietyName].push(crop);
              });

              return Object.entries(grouped).map(([cropName, cropsOfName]) => (
                <div key={cropName} style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#0f766e', marginBottom: '0.5rem', borderBottom: '1px solid #ccfbf1', paddingBottom: '0.25rem' }}>{cropName}</div>
                  {cropsOfName.map(c => {
                    const maxTrays = c.traysCount || c.trays || 0;
                    const isSelected = newHarvest.selectedCropUsages[c.id] > 0;
                    return (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem', backgroundColor: isSelected ? '#f0fdf4' : 'white', border: `1px solid ${isSelected ? '#4ade80' : '#e2e8f0'}`, borderRadius: '0.5rem', marginBottom: '0.5rem', transition: 'all 0.2s' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 'bold', color: '#1e293b', fontSize: '0.9rem' }}>Lote: {c.batchNumber || 'N/A'}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Disponibles: {maxTrays} bandejas</div>
                        </div>
                        <input 
                          type="number" 
                          className="premium-input"
                          style={{ width: '80px', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 'bold' }}
                          min="0" 
                          max={maxTrays}
                          value={newHarvest.selectedCropUsages[c.id] || 0}
                          onChange={e => {
                            const val = parseInt(e.target.value) || 0;
                            setNewHarvest(prev => ({
                              ...prev,
                              selectedCropUsages: { ...prev.selectedCropUsages, [c.id]: val }
                            }));
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              ));
            })()}
          </div>
        </div>

        {/* PASO 3 */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>4. Formatos y unidades producidas</label>
          <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '0.75rem', padding: '1rem', display: 'grid', gap: '0.75rem' }}>
            {packagingArticlesForProduct(products?.find(product => product.id === newHarvest.productId)).map(format => {
              const availableStock = articlePhysicalStock(format.id);
              return (
              <div key={format.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '0.6rem', padding: '0.75rem' }}>
                <span style={{ fontSize: '1.5rem' }}>{format.type === 'BANDEJA' ? '🌱' : '📦'}</span>
                <div style={{ flex: 1 }}>
                  <strong style={{ color: '#1e293b' }}>{format.type === 'BANDEJA' ? `Vivo · ${format.name}` : format.name}</strong>
                  <div style={{ color: availableStock >= 0 ? '#64748b' : '#b45309', fontSize: '0.75rem' }}>
                    {availableStock < 0
                      ? `Stock pendiente de regularizar: ${availableStock} unidades (no bloquea la cosecha)`
                      : `Stock disponible: ${availableStock} unidades`}
                  </div>
                </div>
                <input
                  type="number"
                  min="0"
                  className="premium-input"
                  style={{ width: '100px', padding: '0.7rem', textAlign: 'center', fontWeight: 900 }}
                  value={newHarvest.packagingQuantities?.[format.id] || 0}
                  onChange={event => setNewHarvest(prev => ({
                    ...prev,
                    packagingQuantities: { ...prev.packagingQuantities, [format.id]: Math.max(0, parseInt(event.target.value) || 0) }
                  }))}
                />
              </div>
            );})}
            {packagingArticlesForProduct(products?.find(product => product.id === newHarvest.productId)).length === 0 && (
              <div style={{ color: '#ef4444', fontWeight: 600 }}>Este producto no tiene un formato de venta asignado. Edítalo en Administración → Productos.</div>
            )}
            <div style={{ textAlign: 'right', color: '#334155', fontWeight: 800 }}>
              Total: {Object.values(newHarvest.packagingQuantities || {}).reduce((sum, value) => sum + Number(value || 0), 0)} unidades
            </div>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>5. Motivo o comentario (opcional)</label>
          <textarea
            className="premium-input"
            rows="2"
            placeholder="Ej.: Cosecha realizada antes de implantar la aplicación"
            value={newHarvest.registrationNotes}
            onChange={event => setNewHarvest(prev => ({ ...prev, registrationNotes: event.target.value }))}
            style={{ width: '100%', padding: '0.85rem', borderRadius: '0.75rem', border: '2px solid #e2e8f0', boxSizing: 'border-box', resize: 'vertical' }}
          />
        </div>

        {newHarvest.productId && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.75rem', padding: '0.85rem', color: '#166534', fontSize: '0.82rem', lineHeight: 1.6 }}>
            <strong>Resumen:</strong> {formatSowingDateTime(newHarvest.harvestDate)} · {Object.values(newHarvest.selectedCropUsages || {}).reduce((sum, value) => sum + Number(value || 0), 0)} bandejas · {Object.values(newHarvest.packagingQuantities || {}).reduce((sum, value) => sum + Number(value || 0), 0)} envases.
          </div>
        )}

        {/* BOTONES */}
        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
          <button type="button" onClick={closeHarvestModal} style={{ flex: 1, padding: '1rem', borderRadius: '0.75rem', border: '1px solid #cbd5e1', background: 'white', color: '#475569', fontWeight: 'bold', cursor: 'pointer', transition: 'background 0.2s' }} onMouseOver={e=>e.currentTarget.style.background='#f1f5f9'} onMouseOut={e=>e.currentTarget.style.background='white'}>
            Cancelar
          </button>
          <button type="submit" disabled={!newHarvest.productId || Object.values(newHarvest.selectedCropUsages).every(v => !v) || Object.values(newHarvest.packagingQuantities || {}).every(v => !Number(v))} style={{ flex: 1, padding: '1rem', borderRadius: '0.75rem', border: 'none', background: (!newHarvest.productId || Object.values(newHarvest.selectedCropUsages).every(v => !v) || Object.values(newHarvest.packagingQuantities || {}).every(v => !Number(v))) ? '#94a3b8' : 'linear-gradient(135deg, #10b981, #059669)', color: 'white', fontWeight: 'bold', cursor: (!newHarvest.productId || Object.values(newHarvest.selectedCropUsages).every(v => !v) || Object.values(newHarvest.packagingQuantities || {}).every(v => !Number(v))) ? 'not-allowed' : 'pointer', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.3)', transition: 'all 0.2s' }}>
            Registrar Cosecha
          </button>
        </div>
      </form>
    </div>
  </div>
)}

{editingHarvest && (() => {
  const product = products?.find(item => item.id === editingHarvest.productId);
  const allowedFormats = packagingArticlesForProduct(product);
  const oldByArticle = Object.fromEntries((editingHarvest.packagingBreakdown || []).map(item => [item.articleId || item.formatId, Number(item.quantity || 0)]));
  const totalUnits = Object.values(editPackagingQuantities).reduce((sum, value) => sum + Number(value || 0), 0);
  return (
    <div style={modalOverlayStyle}>
      <form onSubmit={saveHarvestPackagingEdit} style={{ ...modalCardStyle, maxWidth: '620px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <span style={{ color: '#059669', fontSize: '0.7rem', fontWeight: 900, letterSpacing: '0.08em' }}>CORRECCIÓN DE ENVASADO</span>
            <h3 style={{ margin: '0.2rem 0', color: '#0f172a' }}>{product?.name || 'Producto'}</h3>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.82rem' }}>Lote {editingHarvest.batchNumber} · No modifica fecha, cultivo ni bandejas cosechadas.</p>
          </div>
          <button type="button" onClick={() => setEditingHarvest(null)} style={{ border: 0, borderRadius: '50%', width: '2rem', height: '2rem', cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ display: 'grid', gap: '0.65rem' }}>
          {allowedFormats.map(format => {
            const returnedUnits = Number(oldByArticle[format.id] || 0);
            const correctedUnits = Number(editPackagingQuantities[format.id] || 0);
            const resultingStock = articlePhysicalStock(format.id) + returnedUnits - correctedUnits;
            return (
              <label key={format.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 110px', alignItems: 'center', gap: '1rem', padding: '0.8rem', border: '1px solid #dbe6e0', borderRadius: '0.75rem', background: '#f8faf9' }}>
                <span style={{ display: 'grid', gap: '0.15rem' }}>
                  <strong style={{ color: '#1e293b' }}>{format.type === 'BANDEJA' ? `Vivo · ${format.name}` : format.name}</strong>
                  <small style={{ color: resultingStock < 0 ? '#b45309' : '#64748b' }}>
                    Stock tras corregir: {resultingStock} · Antes: {returnedUnits}
                  </small>
                </span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={editPackagingQuantities[format.id] || 0}
                  onChange={event => setEditPackagingQuantities(previous => ({ ...previous, [format.id]: Math.max(0, parseInt(event.target.value) || 0) }))}
                  className="premium-input"
                  style={{ width: '100%', boxSizing: 'border-box', textAlign: 'center', fontWeight: 900 }}
                />
              </label>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', padding: '0.8rem', borderRadius: '0.7rem', background: '#ecfdf5', color: '#166534' }}>
          <span>Total corregido</span><strong>{totalUnits} unidades</strong>
        </div>
        <p style={{ color: '#92400e', fontSize: '0.75rem', lineHeight: 1.45 }}>El sistema devolverá primero los envases del registro anterior y descontará las cantidades nuevas. Si ya existen ventas de este lote, protegerá las unidades entregadas.</p>

        <div style={{ display: 'flex', gap: '0.65rem', justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => setEditingHarvest(null)} className="btn btn-secondary">Cancelar</button>
          <button type="submit" disabled={savingHarvestEdit || totalUnits <= 0} className="btn btn-primary">{savingHarvestEdit ? 'Guardando…' : 'Guardar corrección'}</button>
        </div>
      </form>
    </div>
  );
})()}

{showPhaseChangeModal && (
        <div style={modalOverlayStyle}>
          <div style={modalCardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '900', color: '#0f172a', margin: 0 }}>Ajustar Fase de Cultivo</h3>
              <button onClick={() => { setShowPhaseChangeModal(null); setPendingPhase(null); }} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>&times;</button>
            </div>
            <p style={{ marginBottom: '1.5rem', color: '#475569', fontSize: '0.95rem' }}>
              Selecciona la fase a la que deseas mover este lote y pulsa Aplicar. Los días de crecimiento se sincronizarán automáticamente con la ficha de cultivo.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {(() => {
                const cType = cropTypes?.find(c => c.id === showPhaseChangeModal.seedId || c.id === showPhaseChangeModal.cropTypeId);
                const availablePhases = [];
                if (cType) {
                  if (parseInt(cType.soakDays) > 0) availablePhases.push('SOAKING');
                  if (parseInt(cType.germinationDays) > 0) availablePhases.push('GERMINATING');
                  if (parseInt(cType.darknessDays) > 0) availablePhases.push('DARKNESS');
                  if (parseInt(cType.lightDays) > 0) availablePhases.push('LIGHT');
                } else {
                  availablePhases.push('SOAKING', 'GERMINATING', 'DARKNESS', 'LIGHT');
                }
                availablePhases.push('READY');
                
                return availablePhases.map(phase => {
                  const isCurrent = pendingPhase === phase;
                  const isActual = (showPhaseChangeModal.status || 'SOWED') === phase;
                  let cTheme = { bg: 'white', border: '#cbd5e1', text: '#334155', tagBg: '#94a3b8' };
                  
                  if (phase === 'SOAKING') cTheme = { bg: '#dbeafe', border: '#3b82f6', text: '#1e3a8a', tagBg: '#3b82f6' };
                  else if (phase === 'GERMINATING') cTheme = { bg: '#fef3c7', border: '#f59e0b', text: '#92400e', tagBg: '#f59e0b' };
                  else if (phase === 'DARKNESS') cTheme = { bg: '#e0e7ff', border: '#4f46e5', text: '#3730a3', tagBg: '#4f46e5' };
                  else if (phase === 'LIGHT') cTheme = { bg: '#ccfbf1', border: '#14b8a6', text: '#0f766e', tagBg: '#14b8a6' };
                  else if (phase === 'READY') cTheme = { bg: '#dcfce7', border: '#22c55e', text: '#166534', tagBg: '#22c55e' };

                  return (
                    <button 
                      key={phase} 
                      onClick={() => setPendingPhase(phase)}
                      style={{ 
                        padding: '1rem', 
                        border: isCurrent ? `2px solid ${cTheme.border}` : '1px solid #cbd5e1', 
                        borderRadius: '12px', 
                        textAlign: 'left', 
                        backgroundColor: isCurrent ? cTheme.bg : 'white', 
                        fontWeight: isCurrent ? 'bold' : 'normal',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transform: isCurrent ? 'scale(1.02)' : 'scale(1)'
                      }}
                    >
                      <span style={{ color: isCurrent ? cTheme.text : '#334155' }}>{translateStatus(phase)}</span>
                      {isActual && <span style={{ fontSize: '0.75rem', backgroundColor: '#64748b', color: 'white', padding: '0.15rem 0.5rem', borderRadius: '999px' }}>Estado Actual</span>}
                    </button>
                  );
                });
              })()}
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button onClick={() => { setShowPhaseChangeModal(null); setPendingPhase(null); }} style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: 'white', color: '#475569', fontWeight: 'bold', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button 
                onClick={() => {
                  if (pendingPhase && pendingPhase !== (showPhaseChangeModal.status || 'SOWED')) {
                    setCropPhase(showPhaseChangeModal, pendingPhase);
                  }
                  setShowPhaseChangeModal(null);
                  setPendingPhase(null);
                }} 
                style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', border: 'none', backgroundColor: '#0f172a', color: 'white', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                Aplicar Cambio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  </ErrorBoundary>
    );
}

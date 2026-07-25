import { useState } from 'react';
import { useData } from '../context/DataContext';
import { useAdminMode } from '../context/AdminModeContext';
import Swal from 'sweetalert2';

const emptyNutrition = { energy: '', fat: '', saturatedFat: '', carbs: '', sugars: '', protein: '', salt: '' };
const emptyForm = () => ({
  name: '',
  price: '',
  shelfLifeDays: 10,
  isMix: false,
  recipeVarieties: [],
  packagingArticleIds: [],
  nutritionalInfo: { ...emptyNutrition }
});

export default function Products() {
  const {
    products, seedVarieties, articles,
    addProduct, updateProduct, deleteProduct
  } = useData();
  const { isAdminMode, requireAdmin } = useAdminMode();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState(emptyForm);
  const packagingArticles = articles?.filter(article => article.type === 'ENVASE' && article.active !== false) || [];

  const recipeFor = (product) => {
    if (Array.isArray(product.recipeVarieties) && product.recipeVarieties.length) return product.recipeVarieties;
    return (product.recipeSeeds || []).map(item => {
      const article = articles?.find(a => a.id === item.seedId);
      return article?.varietyId ? { varietyId: article.varietyId } : null;
    }).filter(Boolean);
  };

  const cancelForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData(emptyForm());
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const recipe = formData.isMix ? formData.recipeVarieties : formData.recipeVarieties.slice(0, 1);
    const payload = {
      name: formData.name.trim(),
      price: Number(formData.price),
      shelfLifeDays: Number(formData.shelfLifeDays) || 10,
      recipeVarieties: recipe,
      packagingArticleIds: formData.packagingArticleIds,
      nutritionalInfo: formData.nutritionalInfo
    };
    if (editingId) await updateProduct(editingId, payload);
    else await addProduct(payload);
    cancelForm();
  };

  const editProduct = (product) => {
    const recipeVarieties = recipeFor(product);
    setFormData({
      name: product.name || '',
      price: product.price ?? '',
      shelfLifeDays: product.shelfLifeDays || 10,
      isMix: recipeVarieties.length > 1,
      recipeVarieties,
      packagingArticleIds: Array.isArray(product.packagingArticleIds) ? product.packagingArticleIds : [],
      nutritionalInfo: product.nutritionalInfo || { ...emptyNutrition }
    });
    setEditingId(product.id);
    setIsAdding(true);
    requestAnimationFrame(() => {
      const mainContent = document.querySelector('.main-content');
      if (mainContent) mainContent.scrollTo({ top: 0, behavior: 'smooth' });
      else window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  const toggleVariety = (varietyId) => {
    setFormData(prev => {
      const exists = prev.recipeVarieties.some(item => item.varietyId === varietyId);
      const recipeVarieties = exists
        ? prev.recipeVarieties.filter(item => item.varietyId !== varietyId)
        : [...prev.recipeVarieties, { varietyId }];
      return { ...prev, recipeVarieties };
    });
  };

  const togglePackagingArticle = articleId => {
    setFormData(prev => ({
      ...prev,
      packagingArticleIds: prev.packagingArticleIds.includes(articleId)
        ? prev.packagingArticleIds.filter(id => id !== articleId)
        : [...prev.packagingArticleIds, articleId]
    }));
  };

  const removeProduct = async (id) => {
    if (!(await requireAdmin())) return;
    const answer = await Swal.fire({
      title: 'Eliminar producto de venta',
      text: 'Solo debe borrarse si nunca se ha usado. Los documentos históricos pueden depender de él.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626'
    });
    if (answer.isConfirmed) await deleteProduct(id);
  };

  const visibleProducts = products?.filter(product =>
    product.name?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="admin-container">
      <div className="admin-header">
        <div>
          <h2 className="text-2xl font-bold">Catálogo de productos de venta</h2>
          <p className="text-muted" style={{ marginTop: '0.25rem' }}>
            Productos comerciales, precios, caducidad y variedades que componen cada receta.
          </p>
        </div>
        <button className="btn btn-primary" onClick={isAdding ? cancelForm : () => setIsAdding(true)}>
          {isAdding ? 'Cancelar' : '+ Nuevo producto'}
        </button>
      </div>

      <div className="admin-toolbar">
        <div className="admin-search">
          <input type="text" placeholder="Buscar producto..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
      </div>

      {isAdding && (
        <div className="premium-card mb-6">
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="form-group">
                <label className="form-label">Nombre comercial</label>
                <input required className="premium-input w-full" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Precio por unidad (€)</label>
                <input required min="0" step="0.01" type="number" className="premium-input w-full" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Caducidad (días)</label>
                <input required min="1" type="number" className="premium-input w-full" value={formData.shelfLifeDays} onChange={e => setFormData({ ...formData, shelfLifeDays: e.target.value })} />
              </div>
            </div>

            <div className="form-group mt-4">
              <label className="form-label">Tipo de producto</label>
              <select className="premium-input w-full" value={formData.isMix ? 'MIX' : 'SIMPLE'} onChange={e => setFormData({ ...formData, isMix: e.target.value === 'MIX', recipeVarieties: [] })}>
                <option value="SIMPLE">Una sola variedad</option>
                <option value="MIX">Mix de variedades</option>
              </select>
            </div>

            <div className="form-group mt-4">
              <label className="form-label">{formData.isMix ? 'Variedades de la receta' : 'Variedad agronómica'}</label>
              {formData.isMix ? (
                <div className="grid grid-cols-2 gap-2">
                  {seedVarieties?.filter(v => v.active !== false).map(variety => (
                    <label key={variety.id} className="premium-card" style={{ padding: '0.75rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={formData.recipeVarieties.some(item => item.varietyId === variety.id)} onChange={() => toggleVariety(variety.id)} />{' '}
                      {variety.name}
                    </label>
                  ))}
                </div>
              ) : (
                <select required className="premium-input w-full" value={formData.recipeVarieties[0]?.varietyId || ''} onChange={e => setFormData({ ...formData, recipeVarieties: e.target.value ? [{ varietyId: e.target.value }] : [] })}>
                  <option value="">Selecciona una variedad...</option>
                  {seedVarieties?.filter(v => v.active !== false).map(variety => <option key={variety.id} value={variety.id}>{variety.name}</option>)}
                </select>
              )}
              {!seedVarieties?.length && <p className="text-muted text-sm mt-2">Primero crea una variedad en Cultivo → Variedades.</p>}
            </div>

            <div className="form-group mt-4">
              <label className="form-label">Envases permitidos para la venta</label>
              <div className="grid grid-cols-2 gap-2">
                {packagingArticles.map(article => (
                  <label key={article.id} className="premium-card" style={{ padding: '0.75rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={formData.packagingArticleIds.includes(article.id)} onChange={() => togglePackagingArticle(article.id)} />{' '}
                    {article.name}
                  </label>
                ))}
              </div>
              {!packagingArticles.length && <p className="text-muted text-sm mt-2">Primero crea un artículo de tipo Envase en Producción → Stock.</p>}
            </div>

            <div className="flex gap-2 justify-end mt-4">
              <button type="button" className="btn btn-secondary" onClick={cancelForm}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={!formData.recipeVarieties.length || !formData.packagingArticleIds.length}>Guardar producto</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid">
        {visibleProducts.map(product => {
          const recipe = recipeFor(product);
          return (
            <div key={product.id} className="card">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-lg">{product.name}</h3>
                  <p className="text-2xl font-bold text-emerald-600">{Number(product.price || 0).toFixed(2)} € <span className="text-sm font-normal text-muted">/ unidad</span></p>
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-secondary" onClick={() => editProduct(product)}>Editar</button>
                  {isAdminMode && <button className="btn btn-danger" onClick={() => removeProduct(product.id)}>Eliminar</button>}
                </div>
              </div>
              <p className="text-sm text-muted">Caducidad: {product.shelfLifeDays || 10} días</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {(product.packagingArticleIds || []).map(articleId => {
                  const article = articles?.find(item => item.id === articleId);
                  return article ? <span key={articleId} className="badge badge-primary">📦 {article.name}</span> : null;
                })}
                {!(product.packagingArticleIds || []).length && <span className="badge badge-warning">Envase pendiente de asignar</span>}
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {recipe.map(item => {
                  const variety = seedVarieties?.find(v => v.id === item.varietyId);
                  return <span key={item.varietyId} className="badge badge-primary">{variety?.name || 'Variedad no disponible'}</span>;
                })}
                {!recipe.length && <span className="text-muted text-sm">Receta pendiente de asignar</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

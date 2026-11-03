// src/components/admin/AdminDashboard.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Utensils, Settings, PlusCircle, Trash2, Lock, LogOut, 
  CheckCircle, AlertCircle, Building2, Smartphone, 
  Search, Edit3, X, Eye, Flame, KeyRound, 
  PauseCircle, PlayCircle, CreditCard, Layers, ArrowUp, ArrowDown 
} from 'lucide-react';
import { upsertMenuProduct, deleteMenuProduct, updateStoreSettings, isSupabaseConfigured } from '../../lib/supabase';
import { DEFAULT_CATEGORIES, MENU_CATEGORIES, AVAILABLE_TOPPINGS } from '../../data/menu';
import { BUSINESS_CONFIG } from '../../data/business';


export default function AdminDashboard({ 
  products = [], 
  onRefreshProducts, 
  bankingInfo = BUSINESS_CONFIG.banking, 
  onUpdateBankingInfo,
  businessInfo = BUSINESS_CONFIG,
  onUpdateBusinessInfo,
  categories = DEFAULT_CATEGORIES || MENU_CATEGORIES.filter(c => c.id !== 'todos'),
  onUpdateCategories = () => {},
  toppings = AVAILABLE_TOPPINGS, // <--- CAMBIAR AQUÍ
  onUpdateToppings = () => {},   // <--- CAMBIAR AQUÍ
  adminPassword = 'santos2026',
  onUpdatePassword = () => {},
  onExitAdmin 
}) {
  // Autenticación con memoria
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem('santos_admin_remember') === 'true');
  const [passwordInput, setPasswordInput] = useState(() => {
    return localStorage.getItem('santos_admin_remember') === 'true' 
      ? (localStorage.getItem('santos_admin_saved_pwd') || '') 
      : '';
  });

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('santos_admin_remember') === 'true' && 
           localStorage.getItem('santos_admin_saved_pwd') === adminPassword;
  });

  const [authError, setAuthError] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [activeTab, setActiveTab] = useState('menu'); // 'menu', 'categorias', 'extras', 'negocio', 'cobros', 'seguridad'
  const [adminSearch, setAdminSearch] = useState('');
  const [statusMessage, setStatusMessage] = useState(null);
  const [toppingsList, setToppingsList] = useState(toppings || AVAILABLE_TOPPINGS);

  useEffect(() => {
    if (toppings && toppings.length > 0) {
      setToppingsList(toppings);
    }
  }, [toppings]);

  // Modal para editar producto existente
  const [editingProduct, setEditingProduct] = useState(null);

  // Categorías locales
  const [categoryList, setCategoryList] = useState(categories);
  const [newCatName, setNewCatName] = useState('');

  // Toppings locales
  const [toppingList, setToppingList] = useState(toppings);
  const [newTopping, setNewTopping] = useState({ name: '', price: '' });

  // Configuración de Negocio (local, horarios y cierre manual)
  const [businessForm, setBusinessForm] = useState(() => ({
    name: businessInfo?.name || '',
    address: businessInfo?.address || '',
    instagram: businessInfo?.instagram || '',
    deliveryTime: businessInfo?.deliveryTime || '',
    takeawayTime: businessInfo?.takeawayTime || '',
    schedule: businessInfo?.schedule || BUSINESS_CONFIG.schedule,
    isManualClosed: Boolean(businessInfo?.isManualClosed)
  }));

  // Datos de cobro por transferencia
  const [bankForm, setBankForm] = useState(() => ({ ...bankingInfo }));

  // Formulario nuevo producto
  const [newProduct, setNewProduct] = useState({
    title: '',
    category: '',
    price: '',
    originalPrice: '',
    badge: 'Firma de la casa',
    tagline: '',
    description: '',
    ingredientsStr: '',
    allowsToppings: true,
    toppingsIds: [],
    isOutOfStock: false,
    image: ''
  });

  // Último error de guardado en la nube (para avisar al usuario)
  const [cloudError, setCloudError] = useState(null);

  useEffect(() => {
    if (categories && categories.length > 0) {
      setCategoryList(categories);
    }
  }, [categories]);

  useEffect(() => {
    if (toppings && toppings.length > 0) {
      setToppingList(toppings);
    }
  }, [toppings]);

  // Sincronizar datos del local y horarios cuando se actualicen
  useEffect(() => {
    if (!businessInfo) return;
    setBusinessForm({
      name: businessInfo.name || '',
      address: businessInfo.address || '',
      instagram: businessInfo.instagram || '',
      deliveryTime: businessInfo.deliveryTime || '',
      takeawayTime: businessInfo.takeawayTime || '',
      schedule: businessInfo.schedule || BUSINESS_CONFIG.schedule,
      isManualClosed: Boolean(businessInfo.isManualClosed)
    });
  }, [businessInfo]);

  // Sincronizar datos bancarios
  useEffect(() => {
    if (!bankingInfo) return;
    setBankForm({ ...bankingInfo });
  }, [bankingInfo]);

  // Mantener siempre una categoría válida seleccionada en el formulario de alta
  useEffect(() => {
    if (categoryList.length === 0) return;
    setNewProduct(prev =>
      categoryList.some(c => c.id === prev.category) ? prev : { ...prev, category: categoryList[0].id }
    );
  }, [categoryList]);

  const showNotification = (text, isSuccess = true) => {
    setStatusMessage({ text, isSuccess });
    setTimeout(() => setStatusMessage(null), 3500);
  };

  // Centraliza el reporte de errores de guardado en la nube
  const reportError = (error, context) => {
    console.error(`[Admin Santos] Error guardando ${context}:`, error);
    setCloudError(error?.message || 'Error de conexión con la base de datos');
    showNotification(`No se pudo guardar ${context}. Revisá la conexión con Supabase.`, false);
    return true;
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const storedPwd = localStorage.getItem('santos_admin_pwd') || adminPassword;
    
    // Acepta la clave activa actual o la guardada
    if (passwordInput === adminPassword || passwordInput === storedPwd) {
      setIsAuthenticated(true);
      setAuthError(false);

      if (rememberMe) {
        localStorage.setItem('santos_admin_remember', 'true');
        localStorage.setItem('santos_admin_saved_pwd', passwordInput);
      } else {
        localStorage.removeItem('santos_admin_remember');
        localStorage.removeItem('santos_admin_saved_pwd');
      }
    } else {
      setAuthError(true);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('santos_admin_remember');
    localStorage.removeItem('santos_admin_saved_pwd');
    setPasswordInput('');
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      (p.title || '').toLowerCase().includes(adminSearch.toLowerCase()) ||
      (p.category || '').toLowerCase().includes(adminSearch.toLowerCase())
    );
  }, [products, adminSearch]);

  // ==========================================
  // GESTIÓN DE CATEGORÍAS
  // ==========================================
  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    const slug = newCatName.trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

    if (!slug) return;

    if (categoryList.some(c => c.id === slug)) {
      alert("Ya existe una sección similar.");
      return;
    }

    const updated = [...categoryList, { id: slug, label: newCatName.trim() }];
    setCategoryList(updated);
    setNewCatName('');
    onUpdateCategories(updated);
    const { error } = await updateStoreSettings({ categories: updated });
    if (error) return reportError(error, 'la sección');
    showNotification(`¡Sección "${newCatName.trim()}" creada con éxito!`);
  };

  const handleRenameCategory = async (id, newLabel) => {
    if (!newLabel.trim()) return;
    const updated = categoryList.map(c => c.id === id ? { ...c, label: newLabel.trim() } : c);
    setCategoryList(updated);
    onUpdateCategories(updated);
    const { error } = await updateStoreSettings({ categories: updated });
    if (error) return reportError(error, 'el nombre de la sección');
    showNotification("Sección renombrada.");
  };

  const handleDeleteCategory = async (id, label) => {
    const orphans = products.filter(p => p.category === id);
    const fallback = categoryList.find(c => c.id !== id);

    if (orphans.length > 0) {
      if (!fallback) {
        alert("No podés eliminar la única sección del menú. Creá otra sección antes de borrar esta.");
        return;
      }
      if (!confirm(`Hay ${orphans.length} platos en "${label}". Se van a mover automáticamente a "${fallback.label}". ¿Eliminamos la sección igual?`)) {
        return;
      }
    } else if (!confirm(`¿Eliminar la sección "${label}"?`)) {
      return;
    }

    const updated = categoryList.filter(c => c.id !== id);
    setCategoryList(updated);
    onUpdateCategories(updated);

    // Reasignamos los platos huérfanos para que no desaparezcan de la web
    let moveError = null;
    for (const product of orphans) {
      const moved = { ...product, category: fallback.id };
      const { error } = await upsertMenuProduct(moved);
      if (error) moveError = error;
      onRefreshProducts(moved);
    }

    const { error } = await updateStoreSettings({ categories: updated });
    if (error || moveError) return reportError(error || moveError, 'la eliminación de la sección');
    showNotification(`Sección "${label}" eliminada.`);
  };

  const handleMoveCategory = async (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= categoryList.length) return;
    const updated = [...categoryList];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    setCategoryList(updated);
    onUpdateCategories(updated);
    const { error } = await updateStoreSettings({ categories: updated });
    if (error) return reportError(error, 'el orden de las secciones');
  };

  // ==========================================
  // GESTIÓN DE TOPPINGS / EXTRAS
  // ==========================================
  const handleAddTopping = async (e) => {
    e.preventDefault();
    if (!newTopping.name.trim() || !newTopping.price) return;

    const id = newTopping.name.trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

    if (toppingList.some(t => t.id === id)) {
      alert("Ya existe un extra con ese nombre.");
      return;
    }

    const updated = [...toppingList, { id, name: newTopping.name.trim(), price: Number(newTopping.price) }];
    setToppingList(updated);
    setNewTopping({ name: '', price: '' });
    onUpdateToppings(updated);
    const { error } = await updateStoreSettings({ toppings: updated });
    if (error) return reportError(error, 'el extra');
    showNotification(`¡Extra "${newTopping.name.trim()}" creado!`);
  };

  const handleUpdateTopping = async (id, field, value) => {
    const updated = toppingList.map(t => t.id === id ? { ...t, [field]: field === 'price' ? Number(value) : value } : t);
    setToppingList(updated);
    onUpdateToppings(updated);
    const { error } = await updateStoreSettings({ toppings: updated });
    if (error) return reportError(error, 'el extra');
  };

  const handleDeleteTopping = async (id, name) => {
    if (!confirm(`¿Eliminar el extra "${name}"?`)) return;
    const updated = toppingList.filter(t => t.id !== id);
    setToppingList(updated);
    onUpdateToppings(updated);
    const { error } = await updateStoreSettings({ toppings: updated });
    if (error) return reportError(error, 'la eliminación del extra');
    showNotification(`Extra "${name}" eliminado.`);
  };

  const handleMoveTopping = async (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= toppingList.length) return;
    const updated = [...toppingList];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    setToppingList(updated);
    onUpdateToppings(updated);
    const { error } = await updateStoreSettings({ toppings: updated });
    if (error) return reportError(error, 'el orden de los extras');
  };

  // ==========================================
  // GESTIÓN DE PRODUCTOS
  // ==========================================
  const handleCreateProduct = async (e) => {
    e.preventDefault();
    if (!newProduct.title || !newProduct.price || !newProduct.image) {
      alert("Completá al menos el nombre del plato, el precio y la foto.");
      return;
    }

    const ingredients = newProduct.ingredientsStr 
      ? newProduct.ingredientsStr.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    const productPayload = {
      id: `prod-${Date.now()}`,
      title: newProduct.title.trim(),
      category: newProduct.category || categoryList[0]?.id || 'favoritos',
      price: Number(newProduct.price),
      originalPrice: newProduct.originalPrice ? Number(newProduct.originalPrice) : null,
      badge: newProduct.badge.trim() || null,
      tagline: newProduct.tagline.trim() || newProduct.title.trim(),
      description: newProduct.description.trim() || newProduct.tagline.trim() || newProduct.title.trim(),
      ingredients,
      allowsToppings: Boolean(newProduct.allowsToppings),
      toppingsIds: newProduct.toppingsIds || [],
      isOutOfStock: Boolean(newProduct.isOutOfStock),
      image: newProduct.image.trim()
    };

    const { error } = await upsertMenuProduct(productPayload);
    if (error) {
      reportError(error, 'el producto en la nube (quedó guardado solo en este dispositivo)');
    } else {
      showNotification("¡Producto publicado en el menú de Santos!");
    }
    onRefreshProducts(productPayload);

    setNewProduct({
      title: '',
      category: categoryList[0]?.id || '',
      price: '',
      originalPrice: '',
      badge: 'Firma de la casa',
      tagline: '',
      description: '',
      ingredientsStr: '',
      allowsToppings: true,
      toppingsIds: [],
      isOutOfStock: false,
      image: ''
    });
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    if (!editingProduct) return;

    const ingredients = typeof editingProduct.ingredientsStr === 'string'
      ? editingProduct.ingredientsStr.split(',').map(s => s.trim()).filter(Boolean)
      : editingProduct.ingredients;

    const updatedPayload = {
      ...editingProduct,
      price: Number(editingProduct.price),
      originalPrice: editingProduct.originalPrice ? Number(editingProduct.originalPrice) : null,
      ingredients
    };

    const { error } = await upsertMenuProduct(updatedPayload);
    if (error) return reportError(error, 'el producto');
    onRefreshProducts(updatedPayload);
    setEditingProduct(null);
    showNotification("¡Producto actualizado con éxito!");
  };

  const handleToggleStock = async (product) => {
    const updated = { ...product, isOutOfStock: !product.isOutOfStock };
    const { error } = await upsertMenuProduct(updated);
    if (error) return reportError(error, 'el stock del producto');
    onRefreshProducts(updated);
    showNotification(
      updated.isOutOfStock 
        ? `"${product.title}" pausada (Sin stock en cocina)` 
        : `"${product.title}" reactivada para la venta`
    );
  };

  const handleDeleteProduct = async (id, title) => {
    if (confirm(`¿Eliminar definitivamente "${title}" del menú?`)) {
      const { error } = await deleteMenuProduct(id);
      if (error) return reportError(error, 'la eliminación del producto');
      onRefreshProducts(null, id);
      showNotification("Producto eliminado del menú");
    }
  };

  // ==========================================
  // CONFIGURACIONES Y SEGURIDAD
  // ==========================================
  const handleSaveBanking = async (e) => {
    e.preventDefault();
    const { error } = await updateStoreSettings({
      titular: bankForm.titular,
      bank_name: bankForm.bankName,
      alias: bankForm.alias,
      cvu: bankForm.cvu,
      whatsapp: bankForm.whatsappKitchen
    });
    onUpdateBankingInfo(bankForm);
    if (error) return reportError(error, 'los datos de cobro en la nube');
    showNotification("¡Datos de cobro actualizados para toda la web!");
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    const cleanPwd = newPassword.trim();
    if (cleanPwd.length < 4) {
      alert("La clave debe tener al menos 4 caracteres.");
      return;
    }

    // 1. Guardar localmente (funciona siempre, incluso sin conexión)
    localStorage.setItem('santos_admin_pwd', cleanPwd);

    if (rememberMe) {
      localStorage.setItem('santos_admin_saved_pwd', cleanPwd);
      setPasswordInput(cleanPwd);
    }

    // 2. Guardar en Supabase y notificar
    const { error } = await updateStoreSettings({ admin_password: cleanPwd });
    onUpdatePassword(cleanPwd);
    setNewPassword('');

    if (error) return reportError(error, 'la contraseña en la nube (quedó activa en este dispositivo)');
    showNotification(`¡Contraseña cambiada con éxito a: "${cleanPwd}"!`);
  };

  // GUARDAR AJUSTES DE NEGOCIO (LOCAL, DIRECCIÓN, INSTAGRAM)
  const handleSaveBusiness = async (e) => {
    e.preventDefault();

    // Extraer ciudad automáticamente si la dirección tiene comas
    const parts = businessForm.address.split(',');
    const city = parts.length > 1 ? parts.slice(1).join(',').trim() : (businessForm.city || 'Villa Carlos Paz, Córdoba');

    const updatedData = {
      name: businessForm.name,
      address: businessForm.address,
      city: city,
      instagram: businessForm.instagram,
      delivery_time: businessForm.deliveryTime,
      takeaway_time: businessForm.takeawayTime,
      schedule: businessForm.schedule,
      is_manual_closed: businessForm.isManualClosed
    };

    // 1. Guardar en memoria local inmediata
    try {
      const current = JSON.parse(localStorage.getItem('santos_store_settings') || '{}');
      localStorage.setItem('santos_store_settings', JSON.stringify({ ...current, ...updatedData, id: 1 }));
    } catch {}

    // 2. Notificar inmediatamente a App.jsx para que el Footer cambie ya mismo
    onUpdateBusinessInfo({
      ...businessForm,
      city: city
    });

    // 3. Guardar en Supabase
    const res = await updateStoreSettings(updatedData);
    if (res && res.error) {
      showNotification("Guardado local (aviso Supabase: " + res.error.message + ")", false);
    } else {
      showNotification("¡Información del local y horarios guardada con éxito!");
    }
  };

  const handleScheduleChange = (day, field, value) => {
    setBusinessForm(prev => {
      const schedule = { ...(prev.schedule || BUSINESS_CONFIG.schedule) };
      // field === null significa "activar / desactivar el día completo"
      if (field === null) {
        schedule[day] = value;
        return { ...prev, schedule };
      }
      if (!schedule[day]) return prev;
      schedule[day] = { ...schedule[day], [field]: value };
      return { ...prev, schedule };
    });
  };

  // =========================================================================
  // VISTA 1: LOGIN DE ACCESO PROTEGIDO
  // =========================================================================
  if (!isAuthenticated) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 bg-[#f2eee2] select-none text-left">
        <div className="max-w-md w-full bg-[#fbf9f3] border-2 border-[#083821]/20 p-8 sm:p-10 rounded-3xl shadow-xl text-center">
          
          <div className="w-16 h-16 rounded-2xl bg-[#083821] text-[#eb623a] flex items-center justify-center mx-auto mb-4 border-2 border-[#eb623a] shadow-md">
            <Lock className="w-8 h-8" />
          </div>

          <h2 className="font-heading text-2xl uppercase text-[#083821]">
            Cocina & Administración
          </h2>
          <p className="text-xs text-zinc-600 font-medium mt-1 mb-6">
            Acceso exclusivo Santos Smash Burgers
          </p>

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="text-xs font-bold text-zinc-700 block mb-1.5 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-[#083821]" />
                <span>Contraseña Maestra</span>
              </label>
              <input 
                type="password"
                placeholder="Clave"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full bg-[#f2eee2] border-2 border-zinc-200 focus:border-[#083821] rounded-xl px-4 py-3 text-sm text-[#083821] focus:outline-none transition-all font-mono"
              />
            </div>

            <div className="flex items-center gap-2 pt-1 pb-1">
              <input 
                type="checkbox" 
                id="rememberSantosAdmin"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-2 border-zinc-300 accent-[#083821] cursor-pointer"
              />
              <label htmlFor="rememberSantosAdmin" className="text-xs text-zinc-600 font-medium cursor-pointer select-none">
                Recordar mi contraseña en este dispositivo
              </label>
            </div>

            {authError && (
              <div className="p-3 bg-red-100 border border-red-300 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Contraseña incorrecta.</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-[#083821] hover:bg-[#042415] text-[#eb623a] font-heading py-3.5 rounded-xl uppercase tracking-wider text-xs transition-all shadow-md active:scale-98 cursor-pointer font-bold"
            >
              Ingresar al Panel
            </button>
          </form>

          <button
            onClick={onExitAdmin}
            className="mt-6 text-xs text-zinc-500 hover:text-black font-bold transition-colors inline-block cursor-pointer"
          >
            ← Volver a la Tienda Pública
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VISTA 2: DASHBOARD PRINCIPAL ACTIVO
  // =========================================================================
  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-8 pt-4 pb-12 w-full text-left select-none text-[#083821]">
      
      {/* Toast Notificación Flotante */}
      {statusMessage && (
        <div className={`fixed bottom-6 left-6 z-[120] p-4 rounded-2xl border-2 text-xs font-bold flex items-center gap-2 shadow-2xl animate-bounce ${
          statusMessage.isSuccess 
            ? 'bg-[#083821] text-[#eb623a] border-[#eb623a]' 
            : 'bg-red-800 text-white border-red-500'
        }`}>
          {statusMessage.isSuccess ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* AVISO DE ESTADO DE LA BASE DE DATOS EN LA NUBE */}
      {(!isSupabaseConfigured || cloudError) && (
        <div className="mb-6 rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 text-xs text-amber-900 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-1 text-left">
            <strong className="block font-black uppercase tracking-wide">
              {isSupabaseConfigured
                ? 'Hubo un problema al guardar en la nube'
                : 'Modo local (sin conexión a Supabase)'}
            </strong>
            <p className="font-medium">
              {isSupabaseConfigured
                ? `Detalle: ${cloudError}. Revisá las políticas (RLS) y la estructura de las tablas en el panel de Supabase.`
                : 'Los cambios se guardan solo en este navegador. Configurá VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el archivo .env y ejecutá el script SQL en Supabase para activar el guardado en la nube.'}
            </p>
          </div>
        </div>
      )}

      {/* CABECERA DEL DASHBOARD */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b-2 border-zinc-200 mb-6">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-[#eb623a] flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 fill-[#eb623a]" />
            <span>Control de Cocina & Pedidos</span>
          </span>
          <h2 className="font-heading text-2xl sm:text-4xl uppercase text-[#083821] mt-0.5">
            Panel de Operaciones Santos
          </h2>
          <p className="text-xs text-zinc-500 font-medium">
            Gestioná el menú en tiempo real, pausá stock y actualizá secciones y horarios
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onExitAdmin}
            className="bg-[#fbf9f3] border-2 border-zinc-300 hover:border-[#083821] text-[#083821] px-4 py-2.5 rounded-xl text-xs font-heading uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shadow-sm"
          >
            <Eye className="w-4 h-4 text-[#083821]" />
            <span>Ver Menú en Vivo</span>
          </button>

          <button
            onClick={handleLogout}
            className="bg-red-50 hover:bg-red-100 text-red-700 border-2 border-red-200 px-3.5 py-2.5 rounded-xl text-xs font-heading uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Cerrar sesión</span>
          </button>
        </div>
      </div>

      {/* PESTAÑAS DE NAVEGACIÓN */}
      <div className="flex gap-2 mb-6 border-b-2 border-zinc-200 pb-3 overflow-x-auto">
        {[
          { id: 'menu', label: 'Gestor del Menú', icon: Utensils, count: products.length },
          { id: 'categorias', label: 'Secciones / Categorías', icon: Layers, count: categoryList.length },
          { id: 'extras', label: 'Extras / Toppings', icon: PlusCircle, count: toppingList.length },
          { id: 'negocio', label: 'Horarios y Local', icon: Building2 },
          { id: 'cobros', label: 'Datos de Cobro', icon: CreditCard },
          { id: 'seguridad', label: 'Seguridad', icon: Settings }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-heading uppercase tracking-wider flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#083821] text-[#eb623a] shadow-md'
                  : 'bg-[#fbf9f3] text-zinc-600 border border-zinc-200 hover:border-[#083821]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className="bg-[#083821] text-[#eb623a] text-[10px] px-2 py-0.5 rounded-full font-mono">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================= */}
      {/* PESTAÑA: SECCIONES Y CATEGORÍAS (DINÁMICAS)               */}
      {/* ========================================================= */}
      {activeTab === 'categorias' && (
        <div className="space-y-6">
          {/* Formulario Crear Nueva Sección */}
          <form onSubmit={handleAddCategory} className="bg-[#fbf9f3] border-2 border-[#083821]/15 p-6 rounded-3xl shadow-md">
            <div className="flex items-center gap-2 pb-3 border-b border-zinc-200 mb-4">
              <PlusCircle className="w-5 h-5 text-[#eb623a]" />
              <h3 className="font-heading text-lg uppercase text-[#083821]">Crear Nueva Sección</h3>
            </div>
            <p className="text-xs text-zinc-500 mb-4 font-medium">
              Agregá secciones como <em>"Pizzas"</em>, <em>"Baldes Cheddar & Dips"</em> o <em>"Mayonesas Caseras"</em>. Aparecerán de inmediato como píldoras y títulos en la web.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <input 
                required
                type="text"
                placeholder="Nombre de la sección (ej: Pizzas a la Piedra)"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="flex-1 bg-[#f2eee2] border border-zinc-300 rounded-xl px-4 py-2.5 text-xs text-[#083821] focus:outline-none focus:border-[#083821]"
              />
              <button 
                type="submit" 
                className="bg-[#083821] hover:bg-[#042415] text-[#eb623a] font-heading text-xs uppercase tracking-wider px-6 py-2.5 rounded-xl shadow-md cursor-pointer active:scale-98 font-bold"
              >
                Crear Sección
              </button>
            </div>
          </form>

          {/* Listado y Reordenamiento de Categorías */}
          <div className="bg-[#fbf9f3] border-2 border-[#083821]/15 p-6 rounded-3xl shadow-md space-y-4">
            <h3 className="font-heading text-base uppercase text-[#083821] border-b border-zinc-200 pb-3">
              Secciones Activas ({categoryList.length}) · Podés renombrar o cambiar el orden
            </h3>

            <div className="space-y-2.5">
              {categoryList.map((cat, index) => {
                const count = products.filter(p => p.category === cat.id).length;
                return (
                  <div key={cat.id} className="flex items-center justify-between gap-3 p-3 bg-[#f2eee2] border border-zinc-300 rounded-2xl">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <span className="font-mono text-xs font-bold text-zinc-400 w-6">
                        #{index + 1}
                      </span>
                      <input 
                        type="text"
                        defaultValue={cat.label}
                        onBlur={(e) => handleRenameCategory(cat.id, e.target.value)}
                        className="bg-card border border-zinc-300 rounded-lg px-3 py-1.5 text-xs font-bold text-[#083821] max-w-sm flex-1 focus:outline-none focus:border-[#083821]"
                      />
                      <span className="text-[11px] font-mono text-zinc-500 shrink-0">
                        ({count} {count === 1 ? 'plato' : 'platos'})
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleMoveCategory(index, -1)}
                        disabled={index === 0}
                        title="Subir posición"
                        className="p-1.5 rounded-lg bg-card border border-zinc-200 text-zinc-700 hover:bg-zinc-100 disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveCategory(index, 1)}
                        disabled={index === categoryList.length - 1}
                        title="Bajar posición"
                        className="p-1.5 rounded-lg bg-card border border-zinc-200 text-zinc-700 hover:bg-zinc-100 disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(cat.id, cat.label)}
                        title="Eliminar sección"
                        className="p-1.5 rounded-lg bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 cursor-pointer ml-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PESTAÑA: EXTRAS Y TOPPINGS (DINÁMICOS)                    */}
      {/* ========================================================= */}
      {activeTab === 'extras' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Formulario Crear Nuevo Extra */}
          <form onSubmit={handleAddTopping} className="bg-[#fbf9f3] border-2 border-[#083821]/15 p-6 rounded-3xl shadow-md">
            <div className="flex items-center gap-2 pb-3 border-b border-zinc-200 mb-4">
              <PlusCircle className="w-5 h-5 text-[#eb623a]" />
              <h3 className="font-heading text-lg uppercase text-[#083821]">Agregar Nuevo Extra / Topping</h3>
            </div>
            <p className="text-xs text-zinc-500 mb-4 font-medium">
              Agregá opciones que tus clientes puedan sumar a sus platos, como <em>"Medallón Extra"</em>, <em>"Cheddar"</em> o <em>"Bebidas"</em>.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <input 
                required
                type="text"
                placeholder="Nombre del extra (ej: Medallón Smash Extra)"
                value={newTopping.name}
                onChange={(e) => setNewTopping({ ...newTopping, name: e.target.value })}
                className="flex-[2] bg-[#f2eee2] border border-zinc-300 rounded-xl px-4 py-2.5 text-xs text-[#083821] focus:outline-none focus:border-[#083821]"
              />
              <input 
                required
                type="number"
                placeholder="Precio (ej: 3200)"
                value={newTopping.price}
                onChange={(e) => setNewTopping({ ...newTopping, price: e.target.value })}
                className="flex-1 bg-[#f2eee2] border border-zinc-300 rounded-xl px-4 py-2.5 text-xs text-[#083821] font-mono focus:outline-none focus:border-[#083821]"
              />
              <button 
                type="submit" 
                className="bg-[#083821] hover:bg-[#042415] text-[#eb623a] font-heading text-xs uppercase tracking-wider px-6 py-2.5 rounded-xl shadow-md cursor-pointer active:scale-98 font-bold"
              >
                Crear Extra
              </button>
            </div>
          </form>

          {/* Listado y Reordenamiento de Toppings */}
          <div className="bg-[#fbf9f3] border-2 border-[#083821]/15 p-6 rounded-3xl shadow-md space-y-4">
            <h3 className="font-heading text-base uppercase text-[#083821] border-b border-zinc-200 pb-3">
              Extras Activos ({toppingList.length}) · Podés modificar precios o el orden
            </h3>

            <div className="space-y-2.5">
              {toppingList.map((top, index) => (
                <div key={top.id} className="flex items-center justify-between gap-3 p-3 bg-[#f2eee2] border border-zinc-300 rounded-2xl">
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <span className="font-mono text-xs font-bold text-zinc-400 w-6">
                      #{index + 1}
                    </span>
                    <input 
                      type="text"
                      defaultValue={top.name}
                      onBlur={(e) => handleUpdateTopping(top.id, 'name', e.target.value)}
                      className="bg-card border border-zinc-300 rounded-lg px-3 py-1.5 text-xs font-bold text-[#083821] max-w-sm flex-[2] focus:outline-none focus:border-[#083821]"
                    />
                    <div className="flex items-center gap-1.5 flex-1 max-w-[120px]">
                      <span className="text-[11px] font-bold text-zinc-400">$</span>
                      <input 
                        type="number"
                        defaultValue={top.price}
                        onBlur={(e) => handleUpdateTopping(top.id, 'price', e.target.value)}
                        className="bg-card border border-zinc-300 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-[#083821] w-full focus:outline-none focus:border-[#083821]"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMoveTopping(index, -1)}
                      disabled={index === 0}
                      title="Subir posición"
                      className="p-1.5 rounded-lg bg-card border border-zinc-200 text-zinc-700 hover:bg-zinc-100 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveTopping(index, 1)}
                      disabled={index === toppingList.length - 1}
                      title="Bajar posición"
                      className="p-1.5 rounded-lg bg-card border border-zinc-200 text-zinc-700 hover:bg-zinc-100 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTopping(top.id, top.name)}
                      title="Eliminar extra"
                      className="p-1.5 rounded-lg bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 cursor-pointer ml-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PESTAÑA 1: GESTOR DE MENÚ                                 */}
      {/* ========================================================= */}
      {activeTab === 'menu' && (
        <div className="space-y-6">
          
          {/* Formulario de Alta de Producto */}
          <form onSubmit={handleCreateProduct} className="bg-[#fbf9f3] border-2 border-[#083821]/15 p-6 sm:p-8 rounded-3xl shadow-md">
            <div className="flex items-center gap-2 pb-4 border-b border-zinc-200 mb-6">
              <PlusCircle className="w-5 h-5 text-[#eb623a]" />
              <h3 className="font-heading text-lg sm:text-xl uppercase text-[#083821]">
                Cargar Nuevo Ítem al Menú
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="font-bold text-zinc-700 block mb-1">Nombre del Plato *</label>
                <input 
                  required
                  type="text"
                  placeholder="Ej: Santos Bacon King"
                  value={newProduct.title}
                  onChange={(e) => setNewProduct({ ...newProduct, title: e.target.value })}
                  className="w-full bg-[#f2eee2] border border-zinc-300 rounded-xl p-2.5 text-xs text-[#083821] focus:outline-none focus:border-[#083821]"
                />
              </div>

              <div>
                <label className="font-bold text-zinc-700 block mb-1">Sección / Categoría *</label>
                <select
                  value={newProduct.category}
                  onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                  className="w-full bg-[#f2eee2] border border-zinc-300 rounded-xl p-2.5 text-xs font-bold text-[#083821]"
                >
                  {categoryList.map(c => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-zinc-700 block mb-1">Precio de Venta (ARS) *</label>
                <input 
                  required
                  type="number"
                  placeholder="Ej: 14500"
                  value={newProduct.price}
                  onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                  className="w-full bg-[#f2eee2] border border-zinc-300 rounded-xl p-2.5 text-xs text-[#083821] font-mono font-bold focus:outline-none focus:border-[#083821]"
                />
              </div>

              <div>
                <label className="font-bold text-zinc-700 block mb-1">Precio Tachado (Opcional)</label>
                <input 
                  type="number"
                  placeholder="Ej: 17000"
                  value={newProduct.originalPrice}
                  onChange={(e) => setNewProduct({ ...newProduct, originalPrice: e.target.value })}
                  className="w-full bg-[#f2eee2] border border-zinc-300 rounded-xl p-2.5 text-xs text-[#083821] font-mono focus:outline-none focus:border-[#083821]"
                />
              </div>

              <div>
                <label className="font-bold text-zinc-700 block mb-1">Badge</label>
                <input 
                  type="text"
                  placeholder="Ej: Firma de la casa, Favorita..."
                  value={newProduct.badge}
                  onChange={(e) => setNewProduct({ ...newProduct, badge: e.target.value })}
                  className="w-full bg-[#f2eee2] border border-zinc-300 rounded-xl p-2.5 text-xs text-[#083821] focus:outline-none focus:border-[#083821]"
                />
              </div>

              <div>
                <label className="font-bold text-zinc-700 block mb-1">URL de la Foto *</label>
                <input 
                  required
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={newProduct.image}
                  onChange={(e) => setNewProduct({ ...newProduct, image: e.target.value })}
                  className="w-full bg-[#f2eee2] border border-zinc-300 rounded-xl p-2.5 text-xs text-[#083821] focus:outline-none focus:border-[#083821]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 text-xs">
              <div>
                <label className="font-bold text-zinc-700 block mb-1">Descripción Breve</label>
                <input 
                  type="text"
                  placeholder="Doble medallón smash, cheddar y salsa especial..."
                  value={newProduct.tagline}
                  onChange={(e) => setNewProduct({ ...newProduct, tagline: e.target.value })}
                  className="w-full bg-[#f2eee2] border border-zinc-300 rounded-xl p-2.5 text-xs text-[#083821] focus:outline-none focus:border-[#083821]"
                />
              </div>

              <div>
                <label className="font-bold text-zinc-700 block mb-1">Ingredientes (Separados por coma)</label>
                <input 
                  type="text"
                  placeholder="Blend 200g, Doble Cheddar, Pan Brioche..."
                  value={newProduct.ingredientsStr}
                  onChange={(e) => setNewProduct({ ...newProduct, ingredientsStr: e.target.value })}
                  className="w-full bg-[#f2eee2] border border-zinc-300 rounded-xl p-2.5 text-xs text-[#083821] focus:outline-none focus:border-[#083821]"
                />
              </div>
            </div>

            <div className="flex flex-col gap-6 mt-5 pt-4 border-t border-zinc-200 text-xs">
              <div className="flex flex-wrap items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-zinc-700">
                  <input 
                    type="checkbox"
                    checked={newProduct.allowsToppings}
                    onChange={(e) => setNewProduct({ ...newProduct, allowsToppings: e.target.checked })}
                    className="w-4 h-4 rounded border-zinc-300 accent-[#083821] cursor-pointer"
                  />
                  <span>Habilitar personalizador de Opciones / Extras</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-bold text-red-600">
                  <input 
                    type="checkbox"
                    checked={newProduct.isOutOfStock}
                    onChange={(e) => setNewProduct({ ...newProduct, isOutOfStock: e.target.checked })}
                    className="w-4 h-4 rounded border-zinc-300 accent-red-600 cursor-pointer"
                  />
                  <span>Marcar inicialmente como "Sin Stock"</span>
                </label>
              </div>

              {/* Selector de Extras Dinámico para el Nuevo Producto */}
              {newProduct.allowsToppings && toppingList.length > 0 && (
                <div className="bg-[#f2eee2] p-4 rounded-2xl border border-zinc-300 space-y-3">
                  <span className="font-bold text-[#083821] block border-b border-zinc-300 pb-2 mb-2">
                    Elegí qué extras/agregados se muestran para este plato:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {toppingList.map(top => {
                      const isSelected = newProduct.toppingsIds?.includes(top.id);
                      return (
                        <label key={top.id} className="flex items-center gap-2 p-2 rounded-lg bg-card border border-zinc-200 cursor-pointer hover:bg-zinc-50">
                          <input 
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              const ids = newProduct.toppingsIds || [];
                              setNewProduct({
                                ...newProduct,
                                toppingsIds: e.target.checked ? [...ids, top.id] : ids.filter(id => id !== top.id)
                              });
                            }}
                            className="w-3.5 h-3.5 rounded border-zinc-300 accent-[#083821]"
                          />
                          <span className="truncate">{top.name}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button 
                      type="button" 
                      onClick={() => setNewProduct({ ...newProduct, toppingsIds: toppingList.map(t => t.id) })}
                      className="text-[10px] font-bold text-[#083821] hover:underline"
                    >
                      Seleccionar todos
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setNewProduct({ ...newProduct, toppingsIds: [] })}
                      className="text-[10px] font-bold text-zinc-500 hover:underline"
                    >
                      Limpiar selección
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="submit"
                className="bg-[#083821] hover:bg-[#042415] text-[#eb623a] font-heading text-xs uppercase tracking-wider py-3.5 px-8 rounded-2xl shadow-md transition-all active:scale-98 cursor-pointer font-bold"
              >
                Publicar en el Menú
              </button>
            </div>
          </form>

          {/* Listado de Productos */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-heading text-xl uppercase text-[#083821]">
                  Menú Activo ({products.length} platos)
                </h3>
                <p className="text-xs text-zinc-500 font-medium">
                  Pausá stock o editá precios con un clic
                </p>
              </div>

              <div className="w-full sm:w-72 relative">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  placeholder="Buscar en el catálogo..."
                  value={adminSearch}
                  onChange={(e) => setAdminSearch(e.target.value)}
                  className="w-full bg-[#fbf9f3] border border-zinc-300 rounded-xl pl-10 pr-4 py-2 text-xs text-[#083821] focus:outline-none focus:border-[#083821]"
                />
              </div>
            </div>

            <div className="space-y-2.5">
              {filteredProducts.map(p => (
                <div 
                  key={p.id}
                  className={`bg-[#fbf9f3] p-4 rounded-2xl border-2 transition-all flex items-center justify-between gap-4 ${
                    p.isOutOfStock ? 'border-red-300 bg-red-50/50 opacity-80' : 'border-zinc-200 shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <img 
                      src={p.image} 
                      alt={p.title} 
                      className="w-14 h-14 object-cover rounded-xl bg-[#f2eee2] border border-zinc-200 shrink-0" 
                    />

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-heading text-sm uppercase text-[#083821] truncate">
                          {p.title}
                        </h4>
                        {p.isOutOfStock && (
                          <span className="bg-red-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded">
                            Sin Stock
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs font-bold mt-0.5">
                        <span className="text-[#083821] font-mono">
                          ${Number(p.price).toLocaleString('es-AR')} ARS
                        </span>
                        <span className="text-zinc-400">•</span>
                        <span className="text-zinc-500 text-[10px] uppercase font-mono">
                          {categoryList.find(c => c.id === p.category)?.label || p.category}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleStock(p)}
                      className={`p-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer ${
                        p.isOutOfStock 
                          ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                          : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                      }`}
                      title={p.isOutOfStock ? "Reactivar plato" : "Pausar stock de este plato"}
                    >
                      {p.isOutOfStock ? <PlayCircle className="w-4 h-4" /> : <PauseCircle className="w-4 h-4" />}
                      <span className="hidden sm:inline">{p.isOutOfStock ? 'Reactivar' : 'Pausar'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditingProduct({ ...p, ingredientsStr: Array.isArray(p.ingredients) ? p.ingredients.join(', ') : '' })}
                      className="p-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4 text-[#083821]" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteProduct(p.id, p.title)}
                      className="p-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL DE EDICIÓN CON SELECTOR DINÁMICO                     */}
      {/* ========================================================= */}
      {editingProduct && (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#f2eee2] border-2 border-[#083821] rounded-3xl p-6 sm:p-8 max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl text-left">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-300 mb-6">
              <h3 className="font-heading text-lg uppercase text-[#083821] flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-[#eb623a]" />
                <span>Editar: {editingProduct.title}</span>
              </h3>
              <button onClick={() => setEditingProduct(null)} className="p-1 text-zinc-500 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateProduct} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-zinc-700 block mb-1">Nombre</label>
                <input 
                  required
                  type="text"
                  value={editingProduct.title}
                  onChange={(e) => setEditingProduct({ ...editingProduct, title: e.target.value })}
                  className="w-full bg-[#fbf9f3] border border-zinc-300 rounded-xl p-2.5 text-[#083821]"
                />
              </div>

              <div>
                <label className="font-bold text-zinc-700 block mb-1">Sección / Categoría</label>
                <select
                  value={editingProduct.category}
                  onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                  className="w-full bg-[#fbf9f3] border border-zinc-300 rounded-xl p-2.5 text-[#083821] font-bold"
                >
                  {categoryList.map(c => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-zinc-700 block mb-1">Precio (ARS)</label>
                  <input 
                    required
                    type="number"
                    value={editingProduct.price}
                    onChange={(e) => setEditingProduct({ ...editingProduct, price: e.target.value })}
                    className="w-full bg-[#fbf9f3] border border-zinc-300 rounded-xl p-2.5 text-[#083821] font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-zinc-700 block mb-1">Precio Tachado</label>
                  <input 
                    type="number"
                    value={editingProduct.originalPrice || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, originalPrice: e.target.value })}
                    className="w-full bg-[#fbf9f3] border border-zinc-300 rounded-xl p-2.5 text-[#083821] font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-zinc-700 block mb-1">URL de Foto</label>
                <input 
                  required
                  type="url"
                  value={editingProduct.image}
                  onChange={(e) => setEditingProduct({ ...editingProduct, image: e.target.value })}
                  className="w-full bg-[#fbf9f3] border border-zinc-300 rounded-xl p-2.5 text-[#083821]"
                />
              </div>

              <div>
                <label className="font-bold text-zinc-700 block mb-1">Ingredientes</label>
                <input 
                  type="text"
                  value={editingProduct.ingredientsStr}
                  onChange={(e) => setEditingProduct({ ...editingProduct, ingredientsStr: e.target.value })}
                  className="w-full bg-[#fbf9f3] border border-zinc-300 rounded-xl p-2.5 text-[#083821]"
                />
              </div>

              <div>
                <label className="font-bold text-zinc-700 block mb-1">Descripción Breve</label>
                <input 
                  type="text"
                  value={editingProduct.tagline || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, tagline: e.target.value, description: e.target.value })}
                  className="w-full bg-[#fbf9f3] border border-zinc-300 rounded-xl p-2.5 text-[#083821]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                <div>
                  <label className="font-bold text-zinc-700 block mb-1">Badge (Etiqueta)</label>
                  <input 
                    type="text"
                    placeholder="Ej: Firma de la casa, Nuevo..."
                    value={editingProduct.badge || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, badge: e.target.value })}
                    className="w-full bg-[#fbf9f3] border border-zinc-300 rounded-xl p-2.5 text-[#083821]"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer font-bold text-zinc-700 pb-1">
                  <input 
                    type="checkbox"
                    checked={editingProduct.allowsToppings !== false}
                    onChange={(e) => setEditingProduct({ ...editingProduct, allowsToppings: e.target.checked })}
                    className="w-4 h-4 rounded border-zinc-300 accent-[#083821] cursor-pointer"
                  />
                  <span>Permitir personalizar toppings</span>
                </label>
              </div>

              {/* Selector de Extras Dinámico para Edición */}
              {editingProduct.allowsToppings !== false && toppingList.length > 0 && (
                <div className="bg-[#fbf9f3] p-4 rounded-2xl border border-zinc-300 space-y-3">
                  <span className="font-bold text-[#083821] block border-b border-zinc-300 pb-2 mb-1">
                    Extras habilitados para este plato:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {toppingList.map(top => {
                      const isSelected = editingProduct.toppingsIds?.includes(top.id);
                      return (
                        <label key={top.id} className="flex items-center gap-2 p-2 rounded-lg bg-[#f2eee2] border border-zinc-300 cursor-pointer hover:bg-zinc-50">
                          <input 
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              const ids = editingProduct.toppingsIds || [];
                              setEditingProduct({
                                ...editingProduct,
                                toppingsIds: e.target.checked ? [...ids, top.id] : ids.filter(id => id !== top.id)
                              });
                            }}
                            className="w-3.5 h-3.5 rounded border-zinc-300 accent-[#083821]"
                          />
                          <span className="truncate">{top.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-zinc-300 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2.5 bg-[#fbf9f3] border border-zinc-300 text-zinc-700 rounded-xl font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#083821] hover:bg-[#042415] text-[#eb623a] font-heading uppercase text-xs rounded-xl shadow-md cursor-pointer font-bold"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PESTAÑA 2: NEGOCIO                                        */}
      {/* ========================================================= */}
      {activeTab === 'negocio' && (
        <form onSubmit={handleSaveBusiness} className="space-y-6">
          <div className="bg-[#fbf9f3] border-2 border-[#083821]/15 p-8 rounded-3xl shadow-md space-y-6">
            <div className="border-b border-zinc-200 pb-3">
              <h3 className="font-heading text-lg uppercase text-[#083821] flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#eb623a]" />
                <span>Información del Local</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-bold text-zinc-700 block mb-1">Nombre</label>
                <input required type="text" value={businessForm.name} onChange={e => setBusinessForm({ ...businessForm, name: e.target.value })} className="w-full bg-[#f2eee2] border border-zinc-300 rounded-xl p-2.5 text-[#083821]" />
              </div>
              <div>
                <label className="font-bold text-zinc-700 block mb-1">Dirección</label>
                <input required type="text" value={businessForm.address} onChange={e => setBusinessForm({ ...businessForm, address: e.target.value })} className="w-full bg-[#f2eee2] border border-zinc-300 rounded-xl p-2.5 text-[#083821]" />
              </div>
              <div>
                <label className="font-bold text-zinc-700 block mb-1">Instagram URL</label>
                <input type="text" value={businessForm.instagram} onChange={e => setBusinessForm({ ...businessForm, instagram: e.target.value })} className="w-full bg-[#f2eee2] border border-zinc-300 rounded-xl p-2.5 text-[#083821]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-zinc-700 block mb-1">Tiempo Delivery</label>
                  <input type="text" value={businessForm.deliveryTime} onChange={e => setBusinessForm({ ...businessForm, deliveryTime: e.target.value })} className="w-full bg-[#f2eee2] border border-zinc-300 rounded-xl p-2.5 text-[#083821]" />
                </div>
                <div>
                  <label className="font-bold text-zinc-700 block mb-1">Tiempo Takeaway</label>
                  <input type="text" value={businessForm.takeawayTime} onChange={e => setBusinessForm({ ...businessForm, takeawayTime: e.target.value })} className="w-full bg-[#f2eee2] border border-zinc-300 rounded-xl p-2.5 text-[#083821]" />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-200">
              <label className="flex items-center gap-3 cursor-pointer p-4 rounded-2xl bg-red-50 border-2 border-red-200">
                <input 
                  type="checkbox" 
                  checked={businessForm.isManualClosed} 
                  onChange={e => setBusinessForm({ ...businessForm, isManualClosed: e.target.checked })}
                  className="w-5 h-5 accent-red-600"
                />
                <div>
                  <span className="font-heading text-red-700 block text-sm">Cerrar Local Manualmente</span>
                  <span className="text-[10px] text-red-500 font-medium">Usa esto para emergencias o feriados. Anula los horarios normales.</span>
                </div>
              </label>
            </div>
          </div>

          <div className="bg-[#fbf9f3] border-2 border-[#083821]/15 p-8 rounded-3xl shadow-md space-y-6">
            <div className="border-b border-zinc-200 pb-3">
              <h3 className="font-heading text-lg uppercase text-[#083821] flex items-center gap-2">
                <Utensils className="w-5 h-5 text-[#eb623a]" />
                <span>Horarios de Cocina</span>
              </h3>
            </div>

            <div className="space-y-3">
              {[0, 1, 2, 3, 4, 5, 6].map(day => {
                const dayConfig = businessForm.schedule[day];
                const label = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"][day];
                
                return (
                  <div key={day} className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-[#f2eee2] border border-zinc-200">
                    <div className="flex items-center gap-3 w-32">
                      <input 
                        type="checkbox" 
                        checked={!!dayConfig} 
                        onChange={(e) => {
                          if (e.target.checked) {
                            handleScheduleChange(day, null, { open: "19:45", close: "23:30", label });
                          } else {
                            handleScheduleChange(day, null, null);
                          }
                        }}
                        className="w-4 h-4 accent-[#083821]"
                      />
                      <span className="font-bold text-xs text-[#083821] uppercase">{label}</span>
                    </div>

                    {dayConfig ? (
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-zinc-500 uppercase">Abre</span>
                          <input 
                            type="time" 
                            value={dayConfig.open} 
                            onChange={(e) => handleScheduleChange(day, 'open', e.target.value)}
                            className="bg-[#fbf9f3] border border-zinc-300 rounded-lg px-2 py-1 text-xs font-mono"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-zinc-500 uppercase">Cierra</span>
                          <input 
                            type="time" 
                            value={dayConfig.close} 
                            onChange={(e) => handleScheduleChange(day, 'close', e.target.value)}
                            className="bg-[#fbf9f3] border border-zinc-300 rounded-lg px-2 py-1 text-xs font-mono"
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-[10px] font-black uppercase text-red-500 tracking-widest">Local Cerrado</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                className="bg-[#083821] hover:bg-[#042415] text-[#eb623a] font-heading text-xs uppercase tracking-wider py-3.5 px-10 rounded-2xl shadow-md transition-all active:scale-98 cursor-pointer font-bold"
              >
                Guardar Horarios y Local
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ========================================================= */}
      {/* PESTAÑA 3: COBROS                                         */}
      {/* ========================================================= */}
      {activeTab === 'cobros' && (
        <form onSubmit={handleSaveBanking} className="space-y-6">
          <div className="bg-[#fbf9f3] border-2 border-[#083821]/15 p-8 rounded-3xl shadow-md space-y-4">
          <div className="border-b border-zinc-200 pb-3">
            <h3 className="font-heading text-lg uppercase text-[#083821] flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#eb623a]" />
              <span>Datos para Cobrar por Transferencia</span>
            </h3>
          </div>

          <div>
            <label className="text-xs font-bold text-zinc-700 block mb-1">Titular</label>
            <input required type="text" value={bankForm.titular} onChange={e => setBankForm({ ...bankForm, titular: e.target.value })} className="w-full bg-[#f2eee2] border border-zinc-300 rounded-xl p-2.5 text-xs text-[#083821]" />
          </div>

          <div>
            <label className="text-xs font-bold text-zinc-700 block mb-1">Banco / Billetera</label>
            <input required type="text" value={bankForm.bankName} onChange={e => setBankForm({ ...bankForm, bankName: e.target.value })} className="w-full bg-[#f2eee2] border border-zinc-300 rounded-xl p-2.5 text-xs text-[#083821]" />
          </div>

          <div>
            <label className="text-xs font-bold text-zinc-700 block mb-1">Alias Oficial</label>
            <input required type="text" value={bankForm.alias} onChange={e => setBankForm({ ...bankForm, alias: e.target.value })} className="w-full bg-[#f2eee2] border border-zinc-300 rounded-xl p-2.5 text-xs text-[#083821] font-mono font-black" />
          </div>

          <div>
            <label className="text-xs font-bold text-zinc-700 block mb-1">CVU / CBU (22 dígitos)</label>
            <input required type="text" value={bankForm.cvu} onChange={e => setBankForm({ ...bankForm, cvu: e.target.value })} className="w-full bg-[#f2eee2] border border-zinc-300 rounded-xl p-2.5 text-xs text-zinc-700 font-mono" />
          </div>

          <div>
            <label className="text-xs font-bold text-zinc-700 block mb-1 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-[#25D366]" />
              <span>WhatsApp de Cocina para Comandas</span>
            </label>
            <input required type="text" value={bankForm.whatsappKitchen} onChange={e => setBankForm({ ...bankForm, whatsappKitchen: e.target.value })} className="w-full bg-[#f2eee2] border border-zinc-300 rounded-xl p-2.5 text-xs text-[#083821] font-mono" />
          </div>

          <button
            type="submit"
            className="w-full bg-[#083821] hover:bg-[#042415] text-[#eb623a] font-heading text-xs uppercase tracking-wider py-3.5 rounded-2xl shadow-md transition-all active:scale-98 cursor-pointer font-bold"
          >
            Guardar Datos de Cobro
          </button>
          </div>
        </form>
      )}

      {/* ========================================================= */}
      {/* PESTAÑA 4: SEGURIDAD Y CAMBIO DE CLAVE                    */}
      {/* ========================================================= */}
      {activeTab === 'seguridad' && (
        <div className="space-y-6">
          <div className="bg-[#fbf9f3] border-2 border-[#083821]/15 p-8 rounded-3xl shadow-md space-y-6 text-left">
          <div className="border-b border-zinc-200 pb-3">
            <h3 className="font-heading text-lg uppercase text-[#083821] flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-[#eb623a]" />
              <span>Seguridad & Clave Maestra</span>
            </h3>
            <p className="text-xs text-zinc-500 font-medium mt-1">
              Podés cambiar la contraseña de acceso al panel de administración.
            </p>
          </div>

          {/* Tarjeta de Clave Activa Actual */}
          <div className="p-4 bg-[#f2eee2] border-2 border-[#083821]/20 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase text-zinc-500 block">
                Contraseña Activa en este momento:
              </span>
              <strong className="font-mono text-base text-[#083821]">
                {adminPassword}
              </strong>
            </div>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-black px-2.5 py-1 rounded-full uppercase">
              Activa
            </span>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
            <div>
              <label className="font-bold text-zinc-700 block mb-1">
                Escribí la Nueva Contraseña
              </label>
              <input 
                required
                type="text"
                placeholder="Ej: santos2027, miclave123..."
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-[#f2eee2] border border-zinc-300 focus:border-[#083821] rounded-xl p-3 text-xs text-[#083821] font-mono font-bold focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-[#083821] hover:bg-[#042415] text-[#eb623a] font-heading text-xs uppercase tracking-wider py-3.5 rounded-2xl shadow-md transition-all cursor-pointer font-bold active:scale-98"
            >
              Guardar Nueva Contraseña
            </button>
          </form>

          {/* Botón rápido para cerrar sesión y probar la clave nueva */}
          <div className="pt-2 border-t border-zinc-200 text-center">
            <button
              type="button"
              onClick={handleLogout}
              className="text-xs text-zinc-500 hover:text-red-600 font-bold underline transition-colors cursor-pointer"
            >
              Cerrar sesión ahora para probar la nueva clave
            </button>
          </div>
          </div>
        </div>
      )}

    </div>
  );
}
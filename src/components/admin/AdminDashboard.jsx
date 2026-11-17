// src/components/admin/AdminDashboard.jsx
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Utensils, Settings, PlusCircle, Trash2, Lock, LogOut,
  CheckCircle, AlertCircle, Building2,
  Search, Edit3, X, Eye, EyeOff, Flame, KeyRound,
  PauseCircle, PlayCircle, CreditCard, Layers, ArrowUp, ArrowDown,
  LayoutDashboard, ClipboardList, Bike, CopyPlus, LoaderCircle, Megaphone, ShieldCheck
} from 'lucide-react';
import {
  upsertMenuProduct, deleteMenuProduct, reorderMenuProducts, updateStoreSettings, isSupabaseConfigured
} from '../../lib/supabase';
import {
  adminLogin, adminLogout, adminRestoreSession, adminChangePassword, hasAdminSession, onAdminSessionExpired
} from '../../lib/adminSession';
import { DEFAULT_CATEGORIES, AVAILABLE_TOPPINGS } from '../../data/menu';
import { BUSINESS_CONFIG, getStoreStatus } from '../../data/business';
import { DEFAULT_STORE_CONFIG } from '../../lib/settings';
import AdminOverview from './AdminOverview';
import OrdersPanel from './OrdersPanel';
import DeliveryPanel from './DeliveryPanel';
import PaymentsPanel from './PaymentsPanel';
import { formatDateTime } from './adminUi';

const EMPTY_PRODUCT = {
  title: '',
  category: '',
  price: '',
  originalPrice: '',
  badge: '',
  tagline: '',
  description: '',
  ingredientsStr: '',
  allowsToppings: true,
  toppingsIds: [],
  isOutOfStock: false,
  image: ''
};

export default function AdminDashboard({
  products = [],
  onRefreshProducts,
  onProductsReordered = () => {},
  bankingInfo = BUSINESS_CONFIG.banking,
  onUpdateBankingInfo,
  businessInfo = BUSINESS_CONFIG,
  onUpdateBusinessInfo,
  categories = DEFAULT_CATEGORIES,
  onUpdateCategories = () => {},
  toppings = AVAILABLE_TOPPINGS,
  onUpdateToppings = () => {},
  storeConfig = DEFAULT_STORE_CONFIG,
  storeStatus = null,
  onApplySettings = () => {},
  onExitAdmin
}) {
  // Sesión del panel: la contraseña se valida en el servidor; acá solo queda un token que vence
  const [rememberMe, setRememberMe] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(() => hasAdminSession());
  const [loggingIn, setLoggingIn] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [sessionNotice, setSessionNotice] = useState(null);
  const [isDefaultPassword, setIsDefaultPassword] = useState(false);
  const [mpSummary, setMpSummary] = useState(null);

  // Cambio de contraseña
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [showNewPasswords, setShowNewPasswords] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const [activeTab, setActiveTab] = useState('resumen');
  const [adminSearch, setAdminSearch] = useState('');
  const [statusMessage, setStatusMessage] = useState(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [savingBusiness, setSavingBusiness] = useState(false);
  const statusTimer = useRef(null);

  const currentStatus = storeStatus || getStoreStatus(businessInfo?.schedule, businessInfo?.isManualClosed);

  // Al abrir el panel con una sesión guardada se confirma con el servidor que siga vigente
  useEffect(() => {
    if (!hasAdminSession()) return;
    let cancelled = false;
    adminRestoreSession().then((res) => {
      if (cancelled) return;
      if (res.ok) {
        setMpSummary(res.mp ?? null);
      } else if (res.expired) {
        setIsAuthenticated(false);
        setSessionNotice('Tu sesión venció. Volvé a ingresar.');
      } else if (res.error) {
        setSessionNotice(res.error);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Si el servidor rechaza la sesión en medio de una acción, se vuelve al login
  useEffect(() => onAdminSessionExpired(() => {
    setIsAuthenticated(false);
    setSessionNotice('Tu sesión venció o se cerró desde otro dispositivo. Volvé a ingresar.');
  }), []);

  // Modal para editar producto existente
  const [editingProduct, setEditingProduct] = useState(null);

  // Categorías locales
  const [categoryList, setCategoryList] = useState(categories);
  const [newCatName, setNewCatName] = useState('');

  // Toppings locales
  const [toppingList, setToppingList] = useState(toppings);
  const [newTopping, setNewTopping] = useState({ name: '', price: '' });

  // Configuración de Negocio (local, horarios, cierre manual y textos)
  const buildBusinessForm = (info) => ({
    name: info?.name || '',
    address: info?.address || '',
    instagram: info?.instagram || '',
    deliveryTime: info?.deliveryTime || '',
    takeawayTime: info?.takeawayTime || '',
    schedule: info?.schedule || BUSINESS_CONFIG.schedule,
    isManualClosed: Boolean(info?.isManualClosed),
    closedMessage: info?.closedMessage || ''
  });
  const [businessForm, setBusinessForm] = useState(() => buildBusinessForm(businessInfo));
  const [marqueeText, setMarqueeText] = useState(() => (storeConfig.marqueeItems || []).join('\n'));

  // Formulario nuevo producto
  const [newProduct, setNewProduct] = useState(EMPTY_PRODUCT);

  // Último error de guardado en la nube (para avisar al usuario)
  const [cloudError, setCloudError] = useState(null);

  useEffect(() => {
    if (categories && categories.length > 0) {
      setCategoryList(categories);
    }
  }, [categories]);

  useEffect(() => {
    if (Array.isArray(toppings)) {
      setToppingList(toppings);
    }
  }, [toppings]);

  // Sincronizar datos del local y horarios solo cuando cambian de verdad
  // (así una recarga automática no borra lo que se está editando)
  const businessKey = JSON.stringify(businessInfo || {});
  useEffect(() => {
    setBusinessForm(buildBusinessForm(JSON.parse(businessKey)));
  }, [businessKey]);

  const marqueeKey = JSON.stringify(storeConfig.marqueeItems || []);
  useEffect(() => {
    setMarqueeText(JSON.parse(marqueeKey).join('\n'));
  }, [marqueeKey]);

  // Mantener siempre una categoría válida seleccionada en el formulario de alta
  useEffect(() => {
    if (categoryList.length === 0) return;
    setNewProduct(prev =>
      categoryList.some(c => c.id === prev.category) ? prev : { ...prev, category: categoryList[0].id }
    );
  }, [categoryList]);

  const showNotification = useCallback((text, isSuccess = true) => {
    if (statusTimer.current) clearTimeout(statusTimer.current);
    setStatusMessage({ text, isSuccess });
    statusTimer.current = setTimeout(() => setStatusMessage(null), 3500);
  }, []);

  useEffect(() => () => {
    if (statusTimer.current) clearTimeout(statusTimer.current);
  }, []);

  // Centraliza el reporte de errores de guardado en la nube
  const reportError = useCallback((error, context) => {
    console.error(`[Admin Santos] Error guardando ${context}:`, error);
    if (error?.code === 'UNAUTHORIZED') return true; // el login ya muestra el aviso
    setCloudError(error?.message || 'Error de conexión con la base de datos');
    showNotification(`No se pudo guardar ${context}. ${error?.message || 'Revisá la conexión.'}`, false);
    return true;
  }, [showNotification]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (loggingIn) return;
    if (!passwordInput) {
      setAuthError('Escribí la contraseña.');
      return;
    }
    setLoggingIn(true);
    setAuthError(null);
    const res = await adminLogin(passwordInput, rememberMe);
    setLoggingIn(false);

    if (!res.ok) {
      setAuthError(res.error || 'No se pudo iniciar sesión.');
      return;
    }

    setPasswordInput('');
    setSessionNotice(null);
    setCloudError(null);
    setIsDefaultPassword(Boolean(res.isDefaultPassword));
    setMpSummary(res.mp ?? null);
    setIsAuthenticated(true);
    setActiveTab(res.isDefaultPassword ? 'seguridad' : 'resumen');
  };

  const handleLogout = async () => {
    setIsAuthenticated(false);
    setPasswordInput('');
    await adminLogout();
  };

  const filteredProducts = useMemo(() => {
    const term = adminSearch.trim().toLowerCase();
    const indexed = products.map((p, i) => ({ p, i }));
    const filtered = term
      ? indexed.filter(({ p }) =>
          (p.title || '').toLowerCase().includes(term) ||
          (p.category || '').toLowerCase().includes(term)
        )
      : indexed;

    // Ordenar por el orden de las secciones y, dentro de cada una, por el orden manual
    return [...filtered].sort((a, b) => {
      const indexA = categoryList.findIndex(c => c.id === a.p.category);
      const indexB = categoryList.findIndex(c => c.id === b.p.category);
      const posA = indexA === -1 ? 999 : indexA;
      const posB = indexB === -1 ? 999 : indexB;
      if (posA !== posB) return posA - posB;
      return a.i - b.i;
    }).map(({ p }) => p);
  }, [products, adminSearch, categoryList]);

  // ==========================================
  // GESTIÓN DE CATEGORÍAS
  // ==========================================
  // Guarda la lista y, si falla, vuelve atrás para que el panel no muestre algo que no se guardó
  const persistCategories = async (updated, previous, context, successMessage) => {
    setCategoryList(updated);
    onUpdateCategories(updated);
    const { data, error } = await updateStoreSettings({ categories: updated });
    if (error) {
      setCategoryList(previous);
      onUpdateCategories(previous);
      reportError(error, context);
      return false;
    }
    if (data) onApplySettings(data);
    if (successMessage) showNotification(successMessage);
    return true;
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    const label = newCatName.trim();
    if (!label) return;

    const slug = label.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

    if (!slug) return;

    if (categoryList.some(c => c.id === slug)) {
      alert("Ya existe una sección similar.");
      return;
    }

    setNewCatName('');
    await persistCategories([...categoryList, { id: slug, label }], categoryList, 'la sección', `¡Sección "${label}" creada con éxito!`);
  };

  const handleRenameCategory = async (id, newLabel) => {
    const label = newLabel.trim();
    const current = categoryList.find(c => c.id === id);
    if (!label || !current || current.label === label) return;
    const updated = categoryList.map(c => c.id === id ? { ...c, label } : c);
    await persistCategories(updated, categoryList, 'el nombre de la sección', 'Sección renombrada.');
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

    // Primero se mueven los platos para que nunca queden huérfanos en la web
    for (const product of orphans) {
      const { data, error } = await upsertMenuProduct({ ...product, category: fallback.id });
      if (error) {
        reportError(error, 'el cambio de sección de los platos');
        return;
      }
      onRefreshProducts(data);
    }

    const updated = categoryList.filter(c => c.id !== id);
    await persistCategories(updated, categoryList, 'la eliminación de la sección', `Sección "${label}" eliminada.`);
  };

  const handleMoveCategory = async (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= categoryList.length) return;
    const updated = [...categoryList];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    await persistCategories(updated, categoryList, 'el orden de las secciones');
  };

  // ==========================================
  // GESTIÓN DE TOPPINGS / EXTRAS
  // ==========================================
  const persistToppings = async (updated, previous, context, successMessage) => {
    setToppingList(updated);
    onUpdateToppings(updated);
    const { data, error } = await updateStoreSettings({ toppings: updated });
    if (error) {
      setToppingList(previous);
      onUpdateToppings(previous);
      reportError(error, context);
      return false;
    }
    if (data) onApplySettings(data);
    if (successMessage) showNotification(successMessage);
    return true;
  };

  const handleAddTopping = async (e) => {
    e.preventDefault();
    const name = newTopping.name.trim();
    const price = Number(newTopping.price);
    if (!name || newTopping.price === '' || !Number.isFinite(price) || price < 0) return;

    const id = name.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

    if (!id) return;

    if (toppingList.some(t => t.id === id)) {
      alert("Ya existe un extra con ese nombre.");
      return;
    }

    setNewTopping({ name: '', price: '' });
    await persistToppings([...toppingList, { id, name, price }], toppingList, 'el extra', `¡Extra "${name}" creado!`);
  };

  const handleUpdateTopping = async (id, field, value) => {
    const current = toppingList.find(t => t.id === id);
    if (!current) return;

    let nextValue = value;
    if (field === 'price') {
      nextValue = Number(value);
      if (value === '' || !Number.isFinite(nextValue) || nextValue < 0) return;
    } else {
      nextValue = String(value).trim();
      if (!nextValue) return;
    }
    if (current[field] === nextValue) return;

    const updated = toppingList.map(t => t.id === id ? { ...t, [field]: nextValue } : t);
    await persistToppings(updated, toppingList, 'el extra', 'Extra actualizado.');
  };

  const handleDeleteTopping = async (id, name) => {
    const usedBy = products.filter(p => (p.toppingsIds || []).map(String).includes(String(id))).length;
    const warning = usedBy > 0 ? ` Está habilitado en ${usedBy} ${usedBy === 1 ? 'plato' : 'platos'}.` : '';
    if (!confirm(`¿Eliminar el extra "${name}"?${warning}`)) return;
    const updated = toppingList.filter(t => t.id !== id);
    await persistToppings(updated, toppingList, 'la eliminación del extra', `Extra "${name}" eliminado.`);
  };

  const handleMoveTopping = async (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= toppingList.length) return;
    const updated = [...toppingList];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    await persistToppings(updated, toppingList, 'el orden de los extras');
  };

  // ==========================================
  // GESTIÓN DE PRODUCTOS
  // ==========================================
  const parseIngredients = (text) =>
    String(text || '').split(',').map(s => s.trim()).filter(Boolean);

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    if (savingProduct) return;
    const price = Number(newProduct.price);
    if (!newProduct.title.trim() || newProduct.price === '' || !Number.isFinite(price) || price < 0 || !newProduct.image.trim()) {
      alert("Completá al menos el nombre del plato, el precio y la foto.");
      return;
    }

    const title = newProduct.title.trim();
    const productPayload = {
      id: `prod-${Date.now()}`,
      title,
      category: newProduct.category || categoryList[0]?.id || 'favoritos',
      price,
      originalPrice: newProduct.originalPrice ? Number(newProduct.originalPrice) : null,
      badge: newProduct.badge.trim() || null,
      tagline: newProduct.tagline.trim() || title,
      description: newProduct.description.trim() || newProduct.tagline.trim() || title,
      ingredients: parseIngredients(newProduct.ingredientsStr),
      allowsToppings: Boolean(newProduct.allowsToppings),
      toppingsIds: newProduct.toppingsIds || [],
      isOutOfStock: Boolean(newProduct.isOutOfStock),
      image: newProduct.image.trim()
    };

    setSavingProduct(true);
    const { data, error } = await upsertMenuProduct(productPayload);
    setSavingProduct(false);
    if (error) return reportError(error, 'el producto');

    onRefreshProducts(data);
    showNotification("¡Producto publicado en el menú de Santos!");
    setNewProduct({ ...EMPTY_PRODUCT, category: productPayload.category });
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    if (!editingProduct || savingProduct) return;

    const price = Number(editingProduct.price);
    if (!Number.isFinite(price) || price < 0) {
      alert("Revisá el precio.");
      return;
    }

    const ingredients = typeof editingProduct.ingredientsStr === 'string'
      ? parseIngredients(editingProduct.ingredientsStr)
      : editingProduct.ingredients;

    const updatedPayload = {
      ...editingProduct,
      title: String(editingProduct.title || '').trim(),
      badge: String(editingProduct.badge || '').trim() || null,
      price,
      originalPrice: editingProduct.originalPrice ? Number(editingProduct.originalPrice) : null,
      ingredients
    };

    setSavingProduct(true);
    const { data, error } = await upsertMenuProduct(updatedPayload);
    setSavingProduct(false);
    if (error) return reportError(error, 'el producto');
    onRefreshProducts(data);
    setEditingProduct(null);
    showNotification("¡Producto actualizado con éxito!");
  };

  const handleToggleStock = async (product) => {
    const updated = { ...product, isOutOfStock: !product.isOutOfStock };
    const { data, error } = await upsertMenuProduct(updated);
    if (error) return reportError(error, 'el stock del producto');
    onRefreshProducts(data);
    showNotification(
      updated.isOutOfStock
        ? `"${product.title}" pausada (Sin stock en cocina)`
        : `"${product.title}" reactivada para la venta`
    );
  };

  const handleDuplicateProduct = async (product) => {
    const copy = {
      ...product,
      id: `prod-${Date.now()}`,
      title: `${product.title} (copia)`,
      isOutOfStock: true
    };
    const { data, error } = await upsertMenuProduct(copy);
    if (error) return reportError(error, 'la copia del producto');
    onRefreshProducts(data);
    showNotification(`Copia creada (pausada). Editala y reactivala cuando esté lista.`);
  };

  // Sube o baja un plato dentro de su sección
  const handleMoveProduct = async (product, direction) => {
    const siblings = products.filter(p => p.category === product.category);
    const index = siblings.findIndex(p => p.id === product.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= siblings.length) return;

    const reordered = [...siblings];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(target, 0, moved);
    const ids = reordered.map(p => p.id);
    const previousIds = siblings.map(p => p.id);

    onProductsReordered(ids);
    const { error } = await reorderMenuProducts(ids);
    if (error) {
      onProductsReordered(previousIds);
      reportError(error, 'el orden de los platos');
    }
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
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (changingPassword) return;
    const next = passwordForm.next;

    if (next.length < 8) {
      showNotification('La contraseña nueva debe tener al menos 8 caracteres.', false);
      return;
    }
    if (next !== passwordForm.confirm) {
      showNotification('Las contraseñas nuevas no coinciden.', false);
      return;
    }
    if (next === passwordForm.current) {
      showNotification('La contraseña nueva tiene que ser distinta de la actual.', false);
      return;
    }

    setChangingPassword(true);
    const res = await adminChangePassword(passwordForm.current, next);
    setChangingPassword(false);

    if (!res.ok) {
      showNotification(res.error, false);
      return;
    }

    setPasswordForm({ current: '', next: '', confirm: '' });
    setIsDefaultPassword(false);
    showNotification('¡Contraseña cambiada! Se cerraron las sesiones de los otros dispositivos.');
  };

  // Abre / cierra el local desde el Resumen
  const handleToggleManualClosed = async (closed) => {
    const { data, error } = await updateStoreSettings({ is_manual_closed: closed });
    if (error) {
      reportError(error, 'el estado del local');
      return;
    }
    onApplySettings(data);
    showNotification(closed ? 'Local cerrado: la web ya no toma pedidos.' : 'Local abierto según el horario.');
  };

  // GUARDAR AJUSTES DE NEGOCIO (LOCAL, DIRECCIÓN, INSTAGRAM, HORARIOS)
  const handleSaveBusiness = async (e) => {
    e.preventDefault();
    if (savingBusiness) return;

    // Validar que cada turno tenga apertura y cierre
    for (const [day, slot] of Object.entries(businessForm.schedule || {})) {
      if (!slot) continue;
      const label = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"][day];
      if (!slot.open || !slot.close) {
        showNotification(`Completá el horario de apertura y cierre del ${label}.`, false);
        return;
      }
      if (Boolean(slot.open2) !== Boolean(slot.close2)) {
        showNotification(`El segundo turno del ${label} necesita apertura y cierre (o limpialo).`, false);
        return;
      }
    }

    // Extraer ciudad automáticamente si la dirección tiene comas
    const parts = businessForm.address.split(',');
    const city = parts.length > 1 ? parts.slice(1).join(',').trim() : (businessInfo.city || BUSINESS_CONFIG.city);

    const marqueeItems = marqueeText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 20);

    const updatedData = {
      name: businessForm.name.trim(),
      address: businessForm.address.trim(),
      city,
      instagram: businessForm.instagram.trim(),
      delivery_time: businessForm.deliveryTime.trim(),
      takeaway_time: businessForm.takeawayTime.trim(),
      schedule: businessForm.schedule,
      is_manual_closed: businessForm.isManualClosed,
      closed_message: businessForm.closedMessage.trim(),
      marquee_items: marqueeItems
    };

    setSavingBusiness(true);
    const { data, error } = await updateStoreSettings(updatedData);
    setSavingBusiness(false);

    if (error) return reportError(error, 'la información del local');
    onApplySettings(data);
    onUpdateBusinessInfo?.((prev) => ({ ...prev }));
    showNotification("¡Información del local y horarios guardada con éxito!");
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
      
      // Si el valor es vacío, lo eliminamos del objeto (para open2/close2)
      const newDayConfig = { ...schedule[day], [field]: value };
      if (value === "") {
        delete newDayConfig[field];
      }
      
      schedule[day] = newDayConfig;
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
            Acceso exclusivo {businessInfo?.name || 'Santos'}
          </p>

          {sessionNotice && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-300 text-amber-900 text-xs rounded-xl flex items-center gap-2 text-left">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{sessionNotice}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label htmlFor="santos-admin-password" className="text-xs font-bold text-zinc-700 mb-1.5 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-[#083821]" />
                <span>Contraseña Maestra</span>
              </label>
              <div className="relative">
                <input
                  id="santos-admin-password"
                  type={showLoginPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Clave"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full bg-[#f2eee2] border-2 border-zinc-200 focus:border-[#083821] rounded-xl px-4 py-3 pr-11 text-sm text-[#083821] focus:outline-none transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  aria-label={showLoginPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-zinc-500 hover:text-[#083821] cursor-pointer"
                >
                  {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
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
                Mantener la sesión iniciada en este dispositivo (30 días)
              </label>
            </div>

            {authError && (
              <div role="alert" className="p-3 bg-red-100 border border-red-300 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full bg-[#083821] hover:bg-[#042415] text-[#eb623a] font-heading py-3.5 rounded-xl uppercase tracking-wider text-xs transition-all shadow-md active:scale-98 cursor-pointer font-bold disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              {loggingIn && <LoaderCircle className="w-4 h-4 animate-spin" />}
              {loggingIn ? 'Verificando…' : 'Ingresar al Panel'}
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

  const tabs = [
    { id: 'resumen', label: 'Resumen', icon: LayoutDashboard },
    { id: 'pedidos', label: 'Pedidos', icon: ClipboardList },
    { id: 'menu', label: 'Gestor del Menú', icon: Utensils, count: products.length },
    { id: 'categorias', label: 'Secciones / Categorías', icon: Layers, count: categoryList.length },
    { id: 'extras', label: 'Extras / Toppings', icon: PlusCircle, count: toppingList.length },
    { id: 'negocio', label: 'Horarios y Local', icon: Building2 },
    { id: 'envios', label: 'Envíos', icon: Bike },
    { id: 'cobros', label: 'Pagos', icon: CreditCard },
    { id: 'seguridad', label: 'Seguridad', icon: Settings }
  ];

  // =========================================================================
  // VISTA 2: DASHBOARD PRINCIPAL ACTIVO
  // =========================================================================
  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-8 pt-4 pb-12 w-full text-left select-none text-[#083821]">

      {/* Toast Notificación Flotante */}
      {statusMessage && (
        <div role="status" aria-live="polite" className={`fixed bottom-6 left-6 right-6 sm:right-auto sm:max-w-md z-[120] p-4 rounded-2xl border-2 text-xs font-bold flex items-center gap-2 shadow-2xl animate-toastIn ${
          statusMessage.isSuccess
            ? 'bg-[#083821] text-[#eb623a] border-[#eb623a]'
            : 'bg-red-800 text-white border-red-500'
        }`}>
          {statusMessage.isSuccess ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* AVISO DE ESTADO DE LA BASE DE DATOS EN LA NUBE */}
      {(!isSupabaseConfigured || cloudError || sessionNotice) && (
        <div className="mb-6 rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 text-xs text-amber-900 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-1 text-left flex-1">
            <strong className="block font-black uppercase tracking-wide">
              {!isSupabaseConfigured
                ? 'Modo local (sin conexión a Supabase)'
                : cloudError
                  ? 'Hubo un problema al guardar en la nube'
                  : 'Aviso de conexión'}
            </strong>
            <p className="font-medium">
              {!isSupabaseConfigured
                ? 'Los cambios se guardan solo en este navegador. Configurá VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY y ejecutá supabase_setup.sql en Supabase para activar el guardado en la nube.'
                : cloudError || sessionNotice}
            </p>
          </div>
          {cloudError && (
            <button type="button" onClick={() => setCloudError(null)} aria-label="Cerrar aviso" className="p-1 rounded-lg hover:bg-amber-100 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          )}
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
          <p className="text-xs text-zinc-500 font-medium flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${currentStatus.dotColor}`} />
            {currentStatus.isOpen ? `Local abierto · ${currentStatus.badgeText.replace('Abierto - ', '')}` : `Local cerrado · ${currentStatus.closedDetail}`}
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
      <div className="flex gap-2 mb-6 border-b-2 border-zinc-200 pb-3 overflow-x-auto" role="tablist" aria-label="Secciones del panel">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={(e) => {
                setActiveTab(tab.id);
                // En celular la barra de pestañas se desliza para dejar visible la elegida
                e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
              }}
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
              {tab.id === 'seguridad' && isDefaultPassword && (
                <span className="size-2 rounded-full bg-red-500" aria-label="Requiere atención" />
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================= */}
      {/* PESTAÑA: RESUMEN                                          */}
      {/* ========================================================= */}
      {activeTab === 'resumen' && (
        <AdminOverview
          storeStatus={currentStatus}
          businessInfo={businessInfo}
          storeConfig={storeConfig}
          bankingInfo={bankingInfo}
          mpSummary={mpSummary}
          isDefaultPassword={isDefaultPassword}
          products={products}
          onToggleManualClosed={handleToggleManualClosed}
          onGoTo={setActiveTab}
        />
      )}

      {/* ========================================================= */}
      {/* PESTAÑA: PEDIDOS                                          */}
      {/* ========================================================= */}
      {activeTab === 'pedidos' && (
        <OrdersPanel storeName={businessInfo?.name} notify={showNotification} />
      )}

      {/* ========================================================= */}
      {/* PESTAÑA: ENVÍOS                                           */}
      {/* ========================================================= */}
      {activeTab === 'envios' && (
        <DeliveryPanel
          storeConfig={storeConfig}
          businessInfo={businessInfo}
          onApplySettings={onApplySettings}
          notify={showNotification}
          reportError={reportError}
        />
      )}

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
                placeholder="Nombre del extra (ej: Medallón Extra)"
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
                  placeholder="Doble medallón, cheddar y salsa especial..."
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

            <div className="space-y-8">
              {categoryList.map(category => {
                const categoryProducts = filteredProducts.filter(p => p.category === category.id);
                if (categoryProducts.length === 0) return null;
                
                return (
                  <div key={category.id} className="space-y-3">
                    <div className="flex items-center gap-3 px-2">
                      <h4 className="font-heading text-[10px] sm:text-xs uppercase text-[#eb623a] bg-[#083821]/5 px-3 py-1.5 rounded-lg border border-[#083821]/10 shadow-sm">
                        {category.label}
                      </h4>
                      <div className="h-[1px] flex-1 bg-gradient-to-r from-[#083821]/10 to-transparent" />
                    </div>
                    
                    <div className="space-y-2.5">
                      {categoryProducts.map((p, productIndex) => (
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
                                  {category.label}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {!adminSearch.trim() && (
                              <div className="flex flex-col gap-0.5" aria-label="Orden en el menú">
                                <button
                                  type="button"
                                  onClick={() => handleMoveProduct(p, -1)}
                                  disabled={productIndex === 0}
                                  title="Subir en el menú"
                                  aria-label={`Subir ${p.title}`}
                                  className="p-1 rounded-md bg-card border border-zinc-200 text-zinc-700 hover:bg-zinc-100 disabled:opacity-30 cursor-pointer"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveProduct(p, 1)}
                                  disabled={productIndex === categoryProducts.length - 1}
                                  title="Bajar en el menú"
                                  aria-label={`Bajar ${p.title}`}
                                  className="p-1 rounded-md bg-card border border-zinc-200 text-zinc-700 hover:bg-zinc-100 disabled:opacity-30 cursor-pointer"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}

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
                              title="Editar plato"
                              aria-label={`Editar ${p.title}`}
                            >
                              <Edit3 className="w-4 h-4 text-[#083821]" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDuplicateProduct(p)}
                              className="p-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl transition-colors cursor-pointer"
                              title="Duplicar plato"
                              aria-label={`Duplicar ${p.title}`}
                            >
                              <CopyPlus className="w-4 h-4 text-[#083821]" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteProduct(p.id, p.title)}
                              className="p-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors cursor-pointer"
                              title="Eliminar plato"
                              aria-label={`Eliminar ${p.title}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              
              {/* Productos sin categoría o con categoría no listada */}
              {(() => {
                const categorizedIds = categoryList.map(c => c.id);
                const uncategorizedProducts = filteredProducts.filter(p => !categorizedIds.includes(p.category));
                
                if (uncategorizedProducts.length === 0) return null;
                
                return (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 px-2">
                      <h4 className="font-heading text-[10px] sm:text-xs uppercase text-zinc-400 bg-zinc-100 px-3 py-1.5 rounded-lg border border-zinc-200">
                        Otros / Sin Categoría
                      </h4>
                      <div className="h-[1px] flex-1 bg-gradient-to-r from-zinc-200 to-transparent" />
                    </div>
                    <div className="space-y-2.5">
                      {uncategorizedProducts.map(p => (
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
                                  {p.category || 'Sin Categoría'}
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
                              title="Editar plato"
                              aria-label={`Editar ${p.title}`}
                            >
                              <Edit3 className="w-4 h-4 text-[#083821]" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDuplicateProduct(p)}
                              className="p-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl transition-colors cursor-pointer"
                              title="Duplicar plato"
                              aria-label={`Duplicar ${p.title}`}
                            >
                              <CopyPlus className="w-4 h-4 text-[#083821]" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteProduct(p.id, p.title)}
                              className="p-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors cursor-pointer"
                              title="Eliminar plato"
                              aria-label={`Eliminar ${p.title}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
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
                  <span className="text-[10px] text-red-500 font-medium">Usa esto para emergencias o feriados. Anula los horarios normales y bloquea los pedidos.</span>
                </div>
              </label>

              <div className="mt-4 text-xs">
                <label htmlFor="closed-message" className="font-bold text-zinc-700 block mb-1">
                  Mensaje cuando el local está cerrado manualmente <span className="font-medium text-zinc-400">(opcional)</span>
                </label>
                <input
                  id="closed-message"
                  type="text"
                  maxLength={160}
                  placeholder="Ej: Cerrado por feriado, volvemos el martes a las 19:45 hs"
                  value={businessForm.closedMessage}
                  onChange={e => setBusinessForm({ ...businessForm, closedMessage: e.target.value })}
                  className="w-full bg-[#f2eee2] border border-zinc-300 rounded-xl p-2.5 text-[#083821]"
                />
                <p className="mt-1 text-[10px] text-zinc-400 font-medium">
                  Si lo dejás vacío se muestra la próxima apertura según el horario (ej: "Abrimos hoy a las 19:45 hs").
                </p>
              </div>
            </div>
          </div>

          <div className="bg-[#fbf9f3] border-2 border-[#083821]/15 p-8 rounded-3xl shadow-md space-y-6">
            <div className="border-b border-zinc-200 pb-3">
              <h3 className="font-heading text-lg uppercase text-[#083821] flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-[#eb623a]" />
                <span>Textos de la Cinta</span>
              </h3>
              <p className="text-xs text-zinc-500 font-medium mt-1">
                Las frases que pasan en la cinta inclinada debajo del inicio. Una por renglón (máximo 20). Vacío = textos de siempre.
              </p>
            </div>
            <textarea
              rows={5}
              value={marqueeText}
              onChange={(e) => setMarqueeText(e.target.value)}
              placeholder={'CALIDAD 100% SANTOS\nBURGERS ARTESANALES\nPAPAS FRITAS BIEN CALIENTES'}
              className="w-full bg-[#f2eee2] border border-zinc-300 rounded-xl p-3 text-xs text-[#083821] font-mono uppercase focus:outline-none focus:border-[#083821]"
            />
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
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
                        {/* Turno 1 */}
                        <div className="flex items-center gap-3">
                          <span className="text-[9px] font-black text-zinc-400 uppercase w-10">Turno 1</span>
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

                        {/* Turno 2 (Opcional) */}
                        <div className="flex items-center gap-3 border-t sm:border-t-0 sm:border-l border-zinc-200 pt-2 sm:pt-0 sm:pl-6">
                          <span className="text-[9px] font-black text-zinc-400 uppercase w-10">Turno 2</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase">Abre</span>
                            <input 
                              type="time" 
                              value={dayConfig.open2 || ""} 
                              onChange={(e) => handleScheduleChange(day, 'open2', e.target.value)}
                              className="bg-[#fbf9f3] border border-zinc-300 rounded-lg px-2 py-1 text-xs font-mono"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase">Cierra</span>
                            <input 
                              type="time" 
                              value={dayConfig.close2 || ""} 
                              onChange={(e) => handleScheduleChange(day, 'close2', e.target.value)}
                              className="bg-[#fbf9f3] border border-zinc-300 rounded-lg px-2 py-1 text-xs font-mono"
                            />
                          </div>
                          {(dayConfig.open2 || dayConfig.close2) && (
                            <button 
                              type="button"
                              onClick={() => {
                                handleScheduleChange(day, 'open2', "");
                                handleScheduleChange(day, 'close2', "");
                              }}
                              className="text-[9px] font-bold text-red-500 hover:underline uppercase"
                            >
                              Limpiar
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-[10px] font-black uppercase text-red-500 tracking-widest">Local Cerrado</span>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="text-[11px] text-zinc-500 font-medium">
              Los horarios usan la hora de Córdoba. Si un turno cierra después de medianoche (ej: 20:00 a 01:30) se toma como parte del mismo día.
            </p>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={savingBusiness}
                className="bg-[#083821] hover:bg-[#042415] text-[#eb623a] font-heading text-xs uppercase tracking-wider py-3.5 px-10 rounded-2xl shadow-md transition-all active:scale-98 cursor-pointer font-bold disabled:opacity-60 inline-flex items-center justify-center gap-2"
              >
                {savingBusiness && <LoaderCircle className="w-4 h-4 animate-spin" />}
                Guardar Horarios y Local
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ========================================================= */}
      {/* PESTAÑA 3: PAGOS (MEDIOS, MERCADO PAGO Y TRANSFERENCIA)   */}
      {/* ========================================================= */}
      {activeTab === 'cobros' && (
        <PaymentsPanel
          storeConfig={storeConfig}
          bankingInfo={bankingInfo}
          mpSummary={mpSummary}
          onMpSummaryChange={setMpSummary}
          onApplySettings={onApplySettings}
          onUpdateBankingInfo={onUpdateBankingInfo}
          notify={showNotification}
          reportError={reportError}
        />
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
              La contraseña se guarda cifrada en el servidor: nadie la puede ver, ni siquiera desde este panel.
            </p>
          </div>

          {isDefaultPassword && (
            <div className="p-4 bg-red-50 border-2 border-red-200 rounded-2xl text-xs text-red-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="font-medium">
                <strong className="font-black">Estás usando la contraseña por defecto.</strong> Cualquiera que la conozca puede entrar al panel. Cambiala ahora.
              </span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
            <div>
              <label htmlFor="pwd-current" className="font-bold text-zinc-700 block mb-1">Contraseña actual</label>
              <input
                id="pwd-current"
                required
                type={showNewPasswords ? 'text' : 'password'}
                autoComplete="current-password"
                value={passwordForm.current}
                onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                className="w-full bg-[#f2eee2] border border-zinc-300 focus:border-[#083821] rounded-xl p-3 text-xs text-[#083821] font-mono focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="pwd-new" className="font-bold text-zinc-700 block mb-1">
                  Nueva contraseña <span className="font-medium text-zinc-400">(mínimo 8 caracteres)</span>
                </label>
                <input
                  id="pwd-new"
                  required
                  minLength={8}
                  maxLength={72}
                  type={showNewPasswords ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={passwordForm.next}
                  onChange={(e) => setPasswordForm({ ...passwordForm, next: e.target.value })}
                  className="w-full bg-[#f2eee2] border border-zinc-300 focus:border-[#083821] rounded-xl p-3 text-xs text-[#083821] font-mono focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="pwd-confirm" className="font-bold text-zinc-700 block mb-1">Repetí la nueva contraseña</label>
                <input
                  id="pwd-confirm"
                  required
                  minLength={8}
                  maxLength={72}
                  type={showNewPasswords ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={passwordForm.confirm}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                  className="w-full bg-[#f2eee2] border border-zinc-300 focus:border-[#083821] rounded-xl p-3 text-xs text-[#083821] font-mono focus:outline-none"
                />
                {passwordForm.confirm && passwordForm.confirm !== passwordForm.next && (
                  <p className="mt-1 text-[11px] font-bold text-red-600">No coincide con la nueva contraseña.</p>
                )}
              </div>
            </div>

            <label className="inline-flex items-center gap-2 cursor-pointer text-zinc-600 font-medium">
              <input
                type="checkbox"
                checked={showNewPasswords}
                onChange={(e) => setShowNewPasswords(e.target.checked)}
                className="w-4 h-4 accent-[#083821]"
              />
              Mostrar lo que escribo
            </label>

            <button
              type="submit"
              disabled={changingPassword}
              className="w-full bg-[#083821] hover:bg-[#042415] text-[#eb623a] font-heading text-xs uppercase tracking-wider py-3.5 rounded-2xl shadow-md transition-all cursor-pointer font-bold active:scale-98 disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              {changingPassword && <LoaderCircle className="w-4 h-4 animate-spin" />}
              Guardar Nueva Contraseña
            </button>
          </form>

          <div className="p-4 bg-[#f2eee2] border border-zinc-200 rounded-2xl text-xs text-zinc-600 space-y-1.5">
            <p className="font-bold text-[#083821] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" /> Cómo se protege el panel
            </p>
            <p>• Al cambiar la contraseña se cierran las sesiones abiertas en otros dispositivos.</p>
            <p>• Después de 8 intentos fallidos el ingreso se bloquea 15 minutos.</p>
            <p>• La sesión dura 12 horas, o 30 días si marcaste "mantener la sesión iniciada".</p>
            {hasAdminSession() && (() => {
              try {
                const raw = localStorage.getItem('santos_admin_session') || sessionStorage.getItem('santos_admin_session');
                const expires = raw ? JSON.parse(raw).expiresAt : null;
                return expires ? <p>• Esta sesión vence el {formatDateTime(expires)}.</p> : null;
              } catch {
                return null;
              }
            })()}
          </div>

          {/* Cerrar sesión */}
          <div className="pt-2 border-t border-zinc-200 text-center">
            <button
              type="button"
              onClick={handleLogout}
              className="text-xs text-zinc-500 hover:text-red-600 font-bold underline transition-colors cursor-pointer"
            >
              Cerrar sesión en este dispositivo
            </button>
          </div>
          </div>
        </div>
      )}

    </div>
  );
}

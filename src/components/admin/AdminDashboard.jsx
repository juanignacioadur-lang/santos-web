// src/components/admin/AdminDashboard.jsx
import React, { useState, useMemo } from 'react';
import { 
  Utensils, Settings, PlusCircle, Trash2, Lock, LogOut, 
  CheckCircle, AlertCircle, Building2, Smartphone, 
  Search, Edit3, X, Eye, Flame, KeyRound, 
  PauseCircle, PlayCircle 
} from 'lucide-react';
import { upsertMenuProduct, deleteMenuProduct, updateStoreSettings } from '../../lib/supabase';
import { MENU_CATEGORIES } from '../../data/menu';
import { BUSINESS_CONFIG } from '../../data/business';

export default function AdminDashboard({ 
  products = [], 
  onRefreshProducts, 
  bankingInfo = BUSINESS_CONFIG.banking, 
  onUpdateBankingInfo,
  businessInfo = BUSINESS_CONFIG,
  onUpdateBusinessInfo,
  adminPassword = '1234',
  onUpdatePassword,
  onExitAdmin 
}) {
  // Autenticación con memoria
  const [rememberMe, setRememberMe] = useState(() => {
    return localStorage.getItem('santos_admin_remember') === 'true';
  });

  const [passwordInput, setPasswordInput] = useState(() => {
    const shouldRemember = localStorage.getItem('santos_admin_remember') === 'true';
    return shouldRemember ? (localStorage.getItem('santos_admin_saved_pwd') || '') : '';
  });

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('santos_admin_remember') === 'true' && 
           localStorage.getItem('santos_admin_saved_pwd') === adminPassword;
  });

  const [authError, setAuthError] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [activeTab, setActiveTab] = useState('menu'); // 'menu', 'negocio', 'cobros', 'seguridad'
  const [adminSearch, setAdminSearch] = useState('');
  const [statusMessage, setStatusMessage] = useState(null);

  // Modal para editar producto existente
  const [editingProduct, setEditingProduct] = useState(null);

  // Configuración de Negocio (Horarios, etc.)
  const [businessForm, setBusinessForm] = useState({
    name: businessInfo.name,
    address: businessInfo.address,
    instagram: businessInfo.instagram,
    deliveryTime: businessInfo.deliveryTime,
    takeawayTime: businessInfo.takeawayTime,
    schedule: businessInfo.schedule,
    isManualClosed: businessInfo.isManualClosed || false
  });

  // Formulario para cargar nuevo producto
  const [newProduct, setNewProduct] = useState({
    title: '',
    category: 'smash-dobles',
    price: '',
    originalPrice: '',
    badge: 'La Más Pedida',
    tagline: '',
    description: '',
    ingredientsStr: '',
    allowsToppings: true,
    isOutOfStock: false,
    image: ''
  });

  // Formulario de datos bancarios
  const [bankForm, setBankForm] = useState({ ...bankingInfo });

  // Notificación flotante (toast)
  const showNotification = (text, isSuccess = true) => {
    setStatusMessage({ text, isSuccess });
    setTimeout(() => setStatusMessage(null), 3500);
  };

  // Login
  const handleLogin = (e) => {
    e.preventDefault();
    if (passwordInput === adminPassword) {
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

  // Filtrado de productos en el gestor
  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      (p.title || '').toLowerCase().includes(adminSearch.toLowerCase()) ||
      (p.category || '').toLowerCase().includes(adminSearch.toLowerCase())
    );
  }, [products, adminSearch]);

  // =========================================================================
  // CREAR NUEVO PRODUCTO
  // =========================================================================
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
      title: newProduct.title.trim(),
      category: newProduct.category,
      price: Number(newProduct.price),
      originalPrice: newProduct.originalPrice ? Number(newProduct.originalPrice) : null,
      badge: newProduct.badge,
      tagline: newProduct.tagline.trim() || newProduct.title.trim(),
      description: newProduct.description.trim() || newProduct.tagline.trim() || newProduct.title.trim(),
      ingredients,
      allowsToppings: Boolean(newProduct.allowsToppings),
      isOutOfStock: Boolean(newProduct.isOutOfStock),
      image: newProduct.image.trim()
    };

    // Guardado en Supabase (si está configurado)
    await upsertMenuProduct(productPayload);
    showNotification("¡Producto publicado en el menú de Santos!");

    onRefreshProducts(productPayload);

    // Resetear formulario
    setNewProduct({
      title: '',
      category: 'smash-dobles',
      price: '',
      originalPrice: '',
      badge: 'La Más Pedida',
      tagline: '',
      description: '',
      ingredientsStr: '',
      allowsToppings: true,
      isOutOfStock: false,
      image: ''
    });
  };

  // =========================================================================
  // ACTUALIZAR PRODUCTO EXISTENTE (DESDE MODAL)
  // =========================================================================
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

    await upsertMenuProduct(updatedPayload);
    onRefreshProducts(updatedPayload);
    setEditingProduct(null);
    showNotification("¡Producto actualizado con éxito!");
  };

  // =========================================================================
  // PAUSAR / ACTIVAR STOCK DE UN PLATO (1 CLIC)
  // =========================================================================
  const handleToggleStock = async (product) => {
    const updated = { ...product, isOutOfStock: !product.isOutOfStock };
    await upsertMenuProduct(updated);
    onRefreshProducts(updated);
    showNotification(
      updated.isOutOfStock 
        ? `"${product.title}" pausada (Sin stock en cocina)` 
        : `"${product.title}" reactivada para la venta`
    );
  };

  // =========================================================================
  // ELIMINAR PRODUCTO
  // =========================================================================
  const handleDeleteProduct = async (id, title) => {
    if (confirm(`¿Eliminar definitivamente "${title}" del menú?`)) {
      await deleteMenuProduct(id);
      onRefreshProducts(null, id);
      showNotification("Producto eliminado del menú");
    }
  };

  // =========================================================================
  // GUARDAR AJUSTES BANCARIOS
  // =========================================================================
  const handleSaveBanking = async (e) => {
    e.preventDefault();
    await updateStoreSettings({
      titular: bankForm.titular,
      bank_name: bankForm.bankName,
      alias: bankForm.alias,
      cvu: bankForm.cvu,
      whatsapp: bankForm.whatsappKitchen
    });
    onUpdateBankingInfo(bankForm);
    showNotification("¡Datos de cobro actualizados para toda la web!");
  };

  // =========================================================================
  // CAMBIAR CONTRASEÑA MAESTRA
  // =========================================================================
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword.trim().length < 4) {
      alert("La clave debe tener al menos 4 caracteres.");
      return;
    }
    const cleanPwd = newPassword.trim();
    await updateStoreSettings({ admin_password: cleanPwd });
    onUpdatePassword(cleanPwd);
    setNewPassword('');
    showNotification("¡Contraseña de administrador actualizada!");
  };

  // =========================================================================
  // GUARDAR AJUSTES DE NEGOCIO (HORARIOS, DIRECCIÓN)
  // =========================================================================
  const handleSaveBusiness = async (e) => {
    e.preventDefault();
    await updateStoreSettings({
      name: businessForm.name,
      address: businessForm.address,
      instagram: businessForm.instagram,
      delivery_time: businessForm.deliveryTime,
      takeaway_time: businessForm.takeawayTime,
      schedule: businessForm.schedule,
      is_manual_closed: businessForm.isManualClosed
    });
    onUpdateBusinessInfo(businessForm);
    showNotification("¡Configuración de negocio actualizada!");
  };

  const handleScheduleChange = (day, field, value) => {
    setBusinessForm(prev => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [day]: value === null ? null : { ...prev.schedule[day], [field]: value }
      }
    }));
  };

  // =========================================================================
  // VISTA 1: LOGIN DE ACCESO PROTEGIDO
  // =========================================================================
  if (!isAuthenticated) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center px-4 py-16 bg-[#052a18] select-none">
        <div className="max-w-md w-full bg-[#f2eee2] border-3 border-[#083821] p-8 sm:p-10 rounded-3xl shadow-diner text-center">
          
          <div className="w-16 h-16 rounded-2xl bg-[#083821] text-[#eb623a] flex items-center justify-center mx-auto mb-4 border-2 border-[#eb623a] shadow-diner-sm">
            <Lock className="w-8 h-8" />
          </div>

          <h2 className="font-heading text-2xl uppercase text-[#083821]">
            Cocina & Administración
          </h2>
          <p className="text-xs text-zinc-600 font-medium mt-1 mb-6">
            Acceso exclusivo para el dueño de Santos Smash Burgers
          </p>

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="text-xs font-bold text-zinc-700 block mb-1.5 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-[#083821]" />
                <span>Contraseña Maestra</span>
              </label>
              <input 
                type="password"
                placeholder="Clave (por defecto: santos2026)"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full bg-card border-2 border-zinc-200 focus:border-[#083821] rounded-xl px-4 py-3 text-sm text-[#083821] focus:outline-none transition-all shadow-inner font-mono"
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
                <span>Contraseña incorrecta. Por defecto es <strong>santos2026</strong></span>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-[#083821] hover:bg-[#052a18] text-[#eb623a] font-heading py-3.5 rounded-xl uppercase tracking-wider text-xs transition-all shadow-diner active:translate-x-[2px] active:translate-y-[2px] cursor-pointer"
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full text-left select-none text-[#083821]">
      
      {/* Toast Notificación Flotante */}
      {statusMessage && (
        <div className={`fixed bottom-6 left-6 z-[120] p-4 rounded-2xl border-2 text-xs font-bold flex items-center gap-2 shadow-diner animate-bounce ${
          statusMessage.isSuccess 
            ? 'bg-[#083821] text-[#eb623a] border-[#eb623a]' 
            : 'bg-red-800 text-white border-red-500'
        }`}>
          {statusMessage.isSuccess ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* CABECERA DEL DASHBOARD */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b-2 border-zinc-200 mb-8">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-[#eb623a] flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 fill-[#eb623a]" />
            <span>Control de Cocina & Pedidos</span>
          </span>
          <h2 className="font-heading text-2xl sm:text-4xl uppercase text-[#083821] mt-0.5">
            Panel de Operaciones Santos
          </h2>
          <p className="text-xs text-zinc-500 font-medium">
            Gestioná el menú, pausá productos sin stock y actualizá tus datos de cobro
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onExitAdmin}
            className="bg-card border-2 border-zinc-300 hover:border-[#083821] text-[#083821] px-4 py-2.5 rounded-xl text-xs font-heading uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shadow-sm"
          >
            <Eye className="w-4 h-4 text-[#083821]" />
            <span>Ver Menú en Vivo</span>
          </button>

          <button
            onClick={handleLogout}
            className="bg-red-50 hover:bg-red-100 text-red-700 border-2 border-red-200 px-3.5 py-2.5 rounded-xl text-xs font-heading uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Cerrar</span>
          </button>
        </div>
      </div>

      {/* PESTAÑAS DE NAVEGACIÓN */}
      <div className="flex gap-2 mb-8 border-b-2 border-zinc-200 pb-3 overflow-x-auto">
        {[
          { id: 'menu', label: 'Gestor del Menú', icon: Utensils, count: products.length },
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
                  ? 'bg-[#083821] text-[#eb623a] shadow-diner-sm'
                  : 'bg-card text-zinc-600 border border-zinc-200 hover:border-[#083821]'
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

      {/* =========================================================================
          PESTAÑA 1: GESTOR DE MENÚ & PUBLICACIÓN DE PRODUCTOS
          ========================================================================= */}
      {activeTab === 'menu' && (
        <div className="space-y-10 animate-fadeIn">
          
          {/* Formulario de Alta de Producto */}
          <form onSubmit={handleCreateProduct} className="bg-card border-2 border-[#083821]/20 p-6 sm:p-8 rounded-3xl shadow-diner">
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
                  placeholder="Ej: Oklahoma Triple Smash"
                  value={newProduct.title}
                  onChange={(e) => setNewProduct({ ...newProduct, title: e.target.value })}
                  className="w-full bg-[#f2eee2] border border-zinc-300 rounded-xl p-2.5 text-xs text-[#083821] focus:outline-none focus:border-[#083821]"
                />
              </div>

              <div>
                <label className="font-bold text-zinc-700 block mb-1">Categoría</label>
                <select
                  value={newProduct.category}
                  onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                  className="w-full bg-[#f2eee2] border border-zinc-300 rounded-xl p-2.5 text-xs text-[#083821] focus:outline-none focus:border-[#083821]"
                >
                  {MENU_CATEGORIES.filter(c => c.id !== 'todos').map(c => (
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
                <label className="font-bold text-zinc-700 block mb-1">Precio Tachado de Oferta (Opcional)</label>
                <input 
                  type="number"
                  placeholder="Ej: 17000 (calcula el % OFF)"
                  value={newProduct.originalPrice}
                  onChange={(e) => setNewProduct({ ...newProduct, originalPrice: e.target.value })}
                  className="w-full bg-[#f2eee2] border border-zinc-300 rounded-xl p-2.5 text-xs text-[#083821] font-mono focus:outline-none focus:border-[#083821]"
                />
              </div>

              <div>
                <label className="font-bold text-zinc-700 block mb-1">Badge Destacado</label>
                <select
                  value={newProduct.badge}
                  onChange={(e) => setNewProduct({ ...newProduct, badge: e.target.value })}
                  className="w-full bg-[#f2eee2] border border-zinc-300 rounded-xl p-2.5 text-xs text-[#083821] focus:outline-none focus:border-[#083821]"
                >
                  <option value="La Más Pedida">La Más Pedida</option>
                  <option value="Edición Limitada">Edición Limitada</option>
                  <option value="Favorita del Chef">Favorita del Chef</option>
                  <option value="Nuevo Ingreso">Nuevo Ingreso</option>
                  <option value="Para Compartir">Para Compartir</option>
                  <option value="Clásico">Clásico</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-zinc-700 block mb-1">URL de la Foto (Alta Resolución) *</label>
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
                <label className="font-bold text-zinc-700 block mb-1">Frase Corta Gancho</label>
                <input 
                  type="text"
                  placeholder="Ej: Tres carnes aplastadas al límite con cebolla fundida..."
                  value={newProduct.tagline}
                  onChange={(e) => setNewProduct({ ...newProduct, tagline: e.target.value })}
                  className="w-full bg-[#f2eee2] border border-zinc-300 rounded-xl p-2.5 text-xs text-[#083821] focus:outline-none focus:border-[#083821]"
                />
              </div>

              <div>
                <label className="font-bold text-zinc-700 block mb-1">Ingredientes (Separados por coma)</label>
                <input 
                  type="text"
                  placeholder="Ej: Blend 300g, Cuádruple Cheddar, Cebolla Grillada, Pan Brioche"
                  value={newProduct.ingredientsStr}
                  onChange={(e) => setNewProduct({ ...newProduct, ingredientsStr: e.target.value })}
                  className="w-full bg-[#f2eee2] border border-zinc-300 rounded-xl p-2.5 text-xs text-[#083821] focus:outline-none focus:border-[#083821]"
                />
              </div>
            </div>

            {/* Opciones booleanas (Permite toppings / Sin stock) */}
            <div className="flex flex-wrap items-center gap-6 mt-5 pt-4 border-t border-zinc-100 text-xs">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-zinc-700">
                <input 
                  type="checkbox"
                  checked={newProduct.allowsToppings}
                  onChange={(e) => setNewProduct({ ...newProduct, allowsToppings: e.target.checked })}
                  className="w-4 h-4 rounded border-zinc-300 accent-[#083821] cursor-pointer"
                />
                <span>Habilitar personalizador de Toppings (extra queso, bacon, etc.)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-bold text-red-600">
                <input 
                  type="checkbox"
                  checked={newProduct.isOutOfStock}
                  onChange={(e) => setNewProduct({ ...newProduct, isOutOfStock: e.target.checked })}
                  className="w-4 h-4 rounded border-zinc-300 accent-red-600 cursor-pointer"
                />
                <span>Marcar como "Sin Stock" inicialmente</span>
              </label>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="submit"
                className="bg-[#083821] hover:bg-[#052a18] text-[#eb623a] font-heading text-xs uppercase tracking-wider py-3.5 px-8 rounded-2xl shadow-diner transition-all active:translate-x-[2px] active:translate-y-[2px] cursor-pointer"
              >
                Publicar en el Menú
              </button>
            </div>
          </form>

          {/* Listado y Buscador de Productos Actuales */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-heading text-xl uppercase text-[#083821]">
                  Menú Activo ({products.length} platos)
                </h3>
                <p className="text-xs text-zinc-500 font-medium">
                  Podés pausar el stock temporalmente o editar precios con un clic
                </p>
              </div>

              <div className="w-full sm:w-72 relative">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  placeholder="Buscar en el catálogo..."
                  value={adminSearch}
                  onChange={(e) => setAdminSearch(e.target.value)}
                  className="w-full bg-card border border-zinc-300 rounded-xl pl-10 pr-4 py-2 text-xs text-[#083821] focus:outline-none focus:border-[#083821]"
                />
              </div>
            </div>

            <div className="space-y-2.5">
              {filteredProducts.map(p => (
                <div 
                  key={p.id}
                  className={`bg-card p-4 rounded-2xl border-2 transition-all flex items-center justify-between gap-4 ${
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
                        <span className="text-zinc-500 text-[10px] uppercase">{p.category}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Botón Switch de Stock */}
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

                    {/* Botón Editar */}
                    <button
                      type="button"
                      onClick={() => setEditingProduct({ ...p, ingredientsStr: Array.isArray(p.ingredients) ? p.ingredients.join(', ') : '' })}
                      className="p-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl transition-colors cursor-pointer"
                      title="Editar plato"
                    >
                      <Edit3 className="w-4 h-4 text-[#083821]" />
                    </button>

                    {/* Botón Eliminar */}
                    <button
                      type="button"
                      onClick={() => handleDeleteProduct(p.id, p.title)}
                      className="p-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors cursor-pointer"
                      title="Eliminar plato del menú"
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

      {/* =========================================================================
          MODAL DE EDICIÓN DE PLATO
          ========================================================================= */}
      {editingProduct && (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#f2eee2] border-3 border-[#083821] rounded-3xl p-6 sm:p-8 max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-diner text-left">
            
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
                  className="w-full bg-card border border-zinc-300 rounded-xl p-2.5 text-[#083821]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-zinc-700 block mb-1">Precio (ARS)</label>
                  <input 
                    required
                    type="number"
                    value={editingProduct.price}
                    onChange={(e) => setEditingProduct({ ...editingProduct, price: e.target.value })}
                    className="w-full bg-card border border-zinc-300 rounded-xl p-2.5 text-[#083821] font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-zinc-700 block mb-1">Precio Tachado</label>
                  <input 
                    type="number"
                    value={editingProduct.originalPrice || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, originalPrice: e.target.value })}
                    className="w-full bg-card border border-zinc-300 rounded-xl p-2.5 text-[#083821] font-mono"
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
                  className="w-full bg-card border border-zinc-300 rounded-xl p-2.5 text-[#083821]"
                />
              </div>

              <div>
                <label className="font-bold text-zinc-700 block mb-1">Ingredientes (Separados por coma)</label>
                <input 
                  type="text"
                  value={editingProduct.ingredientsStr}
                  onChange={(e) => setEditingProduct({ ...editingProduct, ingredientsStr: e.target.value })}
                  className="w-full bg-card border border-zinc-300 rounded-xl p-2.5 text-[#083821]"
                />
              </div>

              <div className="pt-4 border-t border-zinc-300 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2.5 bg-card border border-zinc-300 text-zinc-700 rounded-xl font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#083821] hover:bg-[#052a18] text-[#eb623a] font-heading uppercase text-xs rounded-xl shadow-diner-sm cursor-pointer"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* =========================================================================
          PESTAÑA 2: CONFIGURACIÓN DE NEGOCIO (HORARIOS, LOCAL)
          ========================================================================= */}
      {activeTab === 'negocio' && (
        <form onSubmit={handleSaveBusiness} className="max-w-4xl mx-auto space-y-8 animate-fadeIn">
          <div className="bg-card border-2 border-[#083821]/20 p-8 rounded-3xl shadow-diner space-y-6">
            <div className="border-b border-zinc-200 pb-3">
              <h3 className="font-heading text-lg uppercase text-[#083821] flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#eb623a]" />
                <span>Información del Local</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-bold text-zinc-700 block mb-1">Nombre del Negocio</label>
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
                  <span className="text-[10px] text-red-500 font-medium">Usa esto para cierres de emergencia o feriados no programados. Anula los horarios normales.</span>
                </div>
              </label>
            </div>
          </div>

          <div className="bg-card border-2 border-[#083821]/20 p-8 rounded-3xl shadow-diner space-y-6">
            <div className="border-b border-zinc-200 pb-3">
              <h3 className="font-heading text-lg uppercase text-[#083821] flex items-center gap-2">
                <Utensils className="w-5 h-5 text-[#eb623a]" />
                <span>Horarios de Cocina</span>
              </h3>
              <p className="text-[10px] text-zinc-500 font-medium mt-1">
                Configurá los horarios de apertura y cierre para cada día. Si el local cierra, desmarcá el día.
              </p>
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
                            handleScheduleChange(day, null, { open: "19:30", close: "23:45", label });
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
                            className="bg-card border border-zinc-300 rounded-lg px-2 py-1 text-xs font-mono"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-zinc-500 uppercase">Cierra</span>
                          <input 
                            type="time" 
                            value={dayConfig.close} 
                            onChange={(e) => handleScheduleChange(day, 'close', e.target.value)}
                            className="bg-card border border-zinc-300 rounded-lg px-2 py-1 text-xs font-mono"
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
                className="bg-[#083821] hover:bg-[#052a18] text-[#eb623a] font-heading text-xs uppercase tracking-wider py-3.5 px-10 rounded-2xl shadow-diner transition-all active:translate-x-[2px] active:translate-y-[2px] cursor-pointer"
              >
                Guardar Horarios y Local
              </button>
            </div>
          </div>
        </form>
      )}

      {/* =========================================================================
          PESTAÑA 3: CONFIGURACIÓN DE COBROS (MERCADO PAGO / BANCOS)
          ========================================================================= */}
      {activeTab === 'cobros' && (
        <form onSubmit={handleSaveBanking} className="max-w-2xl mx-auto bg-card border-2 border-[#083821]/20 p-8 rounded-3xl shadow-diner space-y-4">
          <div className="border-b border-zinc-200 pb-3">
            <h3 className="font-heading text-lg uppercase text-[#083821] flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#eb623a]" />
              <span>Datos para Cobrar por Transferencia</span>
            </h3>
            <p className="text-xs text-zinc-500 font-medium mt-0.5">
              Estos datos le aparecen a tus clientes al hacer el checkout.
            </p>
          </div>

          <div>
            <label className="text-xs font-bold text-zinc-700 block mb-1">Titular de la Cuenta</label>
            <input required type="text" value={bankForm.titular} onChange={e => setBankForm({ ...bankForm, titular: e.target.value })} className="w-full bg-[#f2eee2] border border-zinc-300 rounded-xl p-2.5 text-xs text-[#083821]" />
          </div>

          <div>
            <label className="text-xs font-bold text-zinc-700 block mb-1">Banco o Billetera (Mercado Pago, etc.)</label>
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
              <span>WhatsApp de Cocina que Recibe las Comandas</span>
            </label>
            <input required type="text" value={bankForm.whatsappKitchen} onChange={e => setBankForm({ ...bankForm, whatsappKitchen: e.target.value })} className="w-full bg-[#f2eee2] border border-zinc-300 rounded-xl p-2.5 text-xs text-[#083821] font-mono" />
          </div>

          <button
            type="submit"
            className="w-full bg-[#083821] hover:bg-[#052a18] text-[#eb623a] font-heading text-xs uppercase tracking-wider py-3.5 rounded-2xl shadow-diner transition-all active:translate-x-[2px] active:translate-y-[2px] cursor-pointer"
          >
            Guardar y Sincronizar en la Web
          </button>
        </form>
      )}

      {/* =========================================================================
          PESTAÑA 3: SEGURIDAD & CAMBIO DE CLAVE MAESTRA
          ========================================================================= */}
      {activeTab === 'seguridad' && (
        <div className="max-w-md mx-auto bg-card border-2 border-[#083821]/20 p-8 rounded-3xl shadow-diner space-y-5">
          <div className="border-b border-zinc-200 pb-3">
            <h3 className="font-heading text-lg uppercase text-[#083821] flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-[#eb623a]" />
              <span>Seguridad de Cocina</span>
            </h3>
            <p className="text-xs text-zinc-500 font-medium mt-0.5">
              Cambiá la contraseña de acceso al panel.
            </p>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
            <div>
              <label className="font-bold text-zinc-700 block mb-1">Nueva Clave</label>
              <input 
                required
                type="text"
                placeholder="Escribí tu nueva contraseña..."
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-[#f2eee2] border border-zinc-300 rounded-xl p-2.5 text-[#083821] font-mono"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-[#083821] hover:bg-[#052a18] text-[#eb623a] font-heading text-xs uppercase tracking-wider py-3.5 rounded-2xl shadow-diner transition-all cursor-pointer"
            >
              Actualizar Contraseña
            </button>
          </form>

          <p className="text-[11px] text-zinc-500 font-medium">
            * Al actualizar, se sincronizará automáticamente para tu próximo inicio de sesión.
          </p>
        </div>
      )}

    </div>
  );
}
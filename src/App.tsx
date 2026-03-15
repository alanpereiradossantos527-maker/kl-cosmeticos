/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { ShoppingBag, MessageCircle, Star, Sparkles, Camera, Plus, Trash2, Edit2, Package, Settings, ArrowLeft, Image as ImageIcon, CheckCircle2, ShoppingCart, X, Minus, Lock, Key, Bell, BellRing, Video, PlayCircle, Eye, TrendingUp, Box, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from './supabase';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';

type Product = {
  id: string;
  name: string;
  price: number;
  stock: number;
  image: string;
  description: string;
  createdAt?: number;
  video?: string;
};

type CartItem = Product & {
  quantity: number;
};

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  time: number;
  type: 'new' | 'promo';
  read: boolean;
  productId?: string;
};

type Sale = {
  id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  price_at_sale: number;
  total_price: number;
  sale_date: string;
};

const DEFAULT_WHATSAPP = '5599999999999';

export default function App() {
  const [view, setView] = useState<'store' | 'login' | 'admin'>('store');
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [whatsappNumber, setWhatsappNumber] = useState(DEFAULT_WHATSAPP);
  const [sales, setSales] = useState<Sale[]>([]);
  const [adminTab, setAdminTab] = useState<'products' | 'sales' | 'dashboard'>('products');

  // Auth State Listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load products from Supabase
  useEffect(() => {
    const fetchProducts = async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('createdAt', { ascending: true });
      
      if (error) {
        console.error("Error fetching products:", error);
      } else {
        setProducts(data as Product[]);
      }

      // Fetch settings
      const { data: settingsData } = await supabase
        .from('settings')
        .select('value')
        .eq('id', 'whatsapp')
        .single();
      
      if (settingsData) {
        setWhatsappNumber(settingsData.value);
      }

      setIsLoaded(true);
    };

    fetchProducts();

    // Subscribe to realtime changes for products (public)
    const channel = supabase
      .channel('db_products')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => {
        fetchProducts(); 
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Admin Data Fetching (Sales & Settings) - Protected by session check
  useEffect(() => {
    if (!user || user.email !== 'alanpereiradossantos527@gmail.com') {
      setSales([]); // Clear sales if not admin
      return;
    }

    const fetchSales = async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .order('sale_date', { ascending: false });
      
      if (error) {
        console.error("Error fetching sales:", error);
      } else {
        setSales(data as Sale[]);
      }
    };

    fetchSales();

    // Subscribe to realtime changes for sales (admin only)
    const salesChannel = supabase
      .channel('db_sales_admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, (payload) => {
        fetchSales();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(salesChannel);
    };
  }, [user]);

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem('@kl-cosmeticos:cart');
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (e) {
        setCart([]);
      }
    }
  }, []);

  // Sync cart across tabs
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === '@kl-cosmeticos:cart' && e.newValue) {
        try {
          setCart(JSON.parse(e.newValue));
        } catch (err) {}
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('@kl-cosmeticos:cart', JSON.stringify(cart));
    }
  }, [cart, isLoaded]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev; // Don't exceed stock
        return prev.map(item => 
          item.id === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === productId) {
        const newQuantity = item.quantity + delta;
        const product = products.find(p => p.id === productId);
        
        if (newQuantity < 1) return item; // Handled by remove button instead
        if (product && newQuantity > product.stock) return item; // Don't exceed stock
        
        return { ...item, quantity: newQuantity };
      }
      return item;
    }));
  };

  const clearCart = () => {
    setCart([]);
    setIsCartOpen(false);
  };

  if (!isLoaded) return null;

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-rose-50 font-sans text-slate-800">
        <Routes>
          {/* Rota do Cliente (Loja) */}
          <Route 
            path="/" 
            element={
              <Storefront 
                products={products} 
                cart={cart}
                isCartOpen={isCartOpen}
                setIsCartOpen={setIsCartOpen}
                addToCart={addToCart}
                removeFromCart={removeFromCart}
                updateQuantity={updateQuantity}
                clearCart={clearCart}
                whatsappNumber={whatsappNumber}
              />
            } 
          />

          {/* Rota do Gestor (Admin) */}
          <Route 
            path="/admin" 
            element={
              <AdminRouteGuard 
                user={user} 
                products={products}
                setProducts={setProducts}
                whatsappNumber={whatsappNumber}
                setWhatsappNumber={setWhatsappNumber}
                sales={sales}
                setSales={setSales}
                adminTab={adminTab}
                setAdminTab={setAdminTab}
              />
            } 
          />

          {/* Redirecionar qualquer outra coisa para a loja */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

// Guarda de Rota para o Admin
function AdminRouteGuard({ user, products, setProducts, whatsappNumber, setWhatsappNumber, sales, setSales, adminTab, setAdminTab }: any) {
  const navigate = useNavigate();
  
  // Se não estiver logado ou não for o admin, mostra o login
  if (!user || user.email !== 'alanpereiradossantos527@gmail.com') {
    return <LoginPanel onLogin={() => window.location.reload()} onCancel={() => navigate('/')} />;
  }

  return (
    <AdminPanel 
      products={products} 
      setProducts={setProducts} 
      whatsappNumber={whatsappNumber} 
      setWhatsappNumber={setWhatsappNumber} 
      onClose={() => navigate('/')} 
      sales={sales}
      setSales={setSales}
      adminTab={adminTab}
      setAdminTab={setAdminTab}
    />
  );
}

// ==========================================
// LOGIN VIEW
// ==========================================
function LoginPanel({ onLogin, onCancel }: { onLogin: () => void, onCancel: () => void }) {
  const email = 'alanpereiradossantos527@gmail.com';
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleResetPassword = async () => {
    setIsResetting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      setSuccessMsg('E-mail de recuperação enviado! Verifique sua caixa de entrada.');
    } catch (err: any) {
      console.error(err);
      setError('Erro ao enviar e-mail de recuperação. Verifique as configurações do Supabase.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (authError) throw authError;

      if (data.user?.email === 'alanpereiradossantos527@gmail.com') {
        onLogin();
      } else {
        await supabase.auth.signOut();
        setError('Acesso negado. Apenas o administrador pode acessar este painel.');
      }
    } catch (err: any) {
      console.error(err);
      const message = err.message || err.error_description || 'Erro desconhecido';
      if (message === 'Invalid login credentials') {
        setError('Senha incorreta.');
      } else if (message === 'Email not confirmed') {
        setError('E-mail não confirmado. Verifique sua caixa de entrada.');
      } else {
        setError(`Erro: ${message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-slate-100"
      >
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center text-rose-500">
            <Lock className="w-8 h-8" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">Acesso Restrito</h2>
        <p className="text-center text-slate-500 mb-8">Digite sua senha para acessar o painel de gestão.</p>
        
        <form onSubmit={handleLogin} className="space-y-5">
          {error && <p className="text-red-500 text-sm text-center bg-red-50 p-3 rounded-xl">{error}</p>}
          {successMsg && <p className="text-emerald-600 text-sm text-center bg-emerald-50 p-3 rounded-xl">{successMsg}</p>}

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-slate-700">Senha</label>
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={isResetting || isLoading}
                className="text-sm text-rose-500 hover:text-rose-600 font-medium disabled:opacity-70"
              >
                {isResetting ? 'Enviando...' : 'Esqueci a senha'}
              </button>
            </div>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite sua senha"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-rose-200 transition-all"
              required
            />
          </div>
          
          <button 
            type="submit"
            disabled={isLoading || isResetting}
            className="w-full py-3 px-4 rounded-xl font-medium text-white bg-rose-500 hover:bg-rose-600 transition-colors shadow-sm hover:shadow-md flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Conectando...' : 'Entrar'}
          </button>
          
          <button 
            type="button"
            onClick={onCancel}
            className="w-full py-3 px-4 rounded-xl font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            Voltar para a Loja
          </button>
        </form>
      </motion.div>
    </div>
  );
}

// ==========================================
// STOREFRONT VIEW
// ==========================================
function Storefront({ 
  products, 
  cart,
  isCartOpen,
  setIsCartOpen,
  addToCart,
  removeFromCart,
  updateQuantity,
  clearCart,
  whatsappNumber
}: { 
  products: Product[], 
  cart: CartItem[],
  isCartOpen: boolean,
  setIsCartOpen: (open: boolean) => void,
  addToCart: (p: Product) => void,
  removeFromCart: (id: string) => void,
  updateQuantity: (id: string, delta: number) => void,
  clearCart: () => void,
  whatsappNumber: string
}) {
  
  const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const cartItemCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  const [newProductToast, setNewProductToast] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null);
  const [highlightedProductId, setHighlightedProductId] = useState<string | null>(null);
  const [filterProductId, setFilterProductId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const prevProducts = useRef<Product[]>(products);

  const handleNotificationClick = (productId?: string) => {
    if (!productId) return;
    
    setShowNotifications(false);
    setFilterProductId(productId);
    
    // Abrir detalhes automaticamente se o produto for encontrado
    const product = products.find(p => p.id === productId);
    if (product) setSelectedProduct(product);
    
    // Scroll para o topo dos produtos destacados
    setTimeout(() => {
      const section = document.getElementById('produtos');
      if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
        setHighlightedProductId(productId);
        
        // Remove o destaque após 3 segundos
        setTimeout(() => {
          setHighlightedProductId(null);
        }, 3000);
      }
    }, 100);
  };

  const showToast = (text: string, type: 'error' | 'success' = 'error') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    // Check for new products since last visit
    const lastSeenCount = parseInt(localStorage.getItem('@kl-cosmeticos:last-seen-count') || '0', 10);
    const savedNotifications = localStorage.getItem('@kl-cosmeticos:notifications');
    
    if (savedNotifications) {
      try {
        setNotifications(JSON.parse(savedNotifications));
      } catch (e) {}
    }

    if (products.length > lastSeenCount && lastSeenCount > 0) {
      const newCount = products.length - lastSeenCount;
      setNewProductToast(newCount === 1 ? products[products.length - 1].name : `${newCount} novos produtos chegaram!`);
      setTimeout(() => setNewProductToast(null), 5000);
    }
    localStorage.setItem('@kl-cosmeticos:last-seen-count', products.length.toString());
  }, []);

  // Save notifications to localStorage
  useEffect(() => {
    localStorage.setItem('@kl-cosmeticos:notifications', JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    // Detect new products or price drops (promotions)
    if (products.length > prevProducts.current.length) {
      // New Product Added
      const newProduct = products.find(p => !prevProducts.current.find(oldP => oldP.id === p.id));
      if (newProduct) {
        const newNotif: NotificationItem = {
          id: Math.random().toString(36).substr(2, 9),
          title: 'Novo Chegando! ✨',
          message: `${newProduct.name} acabou de ser cadastrado.`,
          time: Date.now(),
          type: 'new',
          read: false,
          productId: newProduct.id
        };
        setNotifications(prev => [newNotif, ...prev].slice(0, 10)); // Keep last 10
        
        setNewProductToast(newProduct.name);
        setTimeout(() => setNewProductToast(null), 5000);

        if (notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('Novo na KL Cosméticos!', { body: newNotif.message });
        }
      }
    } else if (products.length === prevProducts.current.length) {
      // Check for price changes (promotions)
      products.forEach(p => {
        const oldP = prevProducts.current.find(op => op.id === p.id);
        if (oldP && p.price < oldP.price) {
          const promoNotif: NotificationItem = {
            id: Math.random().toString(36).substr(2, 9),
            title: 'Oferta Imperdível! 🔥',
            message: `${p.name} agora está por apenas R$ ${p.price.toFixed(2).replace('.', ',')}!`,
            time: Date.now(),
            type: 'promo',
            read: false,
            productId: p.id
          };
          setNotifications(prev => [promoNotif, ...prev].slice(0, 10));
          
          if (notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
            new Notification('Baixou o preço! 😍', { body: promoNotif.message });
          }
        }
      });
    }

    prevProducts.current = products;
  }, [products, notificationsEnabled]);

  const toggleNotifications = () => {
    setShowNotifications(!showNotifications);
    if (!showNotifications) {
      // Mark all as read when opening
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }
  };

  const handleEnableNotifications = () => {
    if (!('Notification' in window)) {
      showToast('Seu navegador não suporta notificações.', 'error');
      return;
    }
    Notification.requestPermission().then(permission => {
      setNotificationsEnabled(permission === 'granted');
      if (permission === 'granted') {
        new Notification('Notificações Ativadas!', {
          body: 'Você será avisado assim que novos produtos chegarem.'
        });
      }
    });
  };

  const handleCheckout = () => {
    if (cart.length === 0) return;

    let text = `Olá! Gostaria de finalizar meu pedido:\n\n`;
    
    cart.forEach(item => {
      text += `🛍️ ${item.quantity}x *${item.name}* - R$ ${(item.price * item.quantity).toFixed(2).replace('.', ',')}\n`;
    });
    
    text += `\n💰 *Total:* R$ ${cartTotal.toFixed(2).replace('.', ',')}\n\nAguardo retorno para combinar o pagamento e entrega!`;
    
    const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <>
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="text-rose-500 w-6 h-6" />
            <h1 className="text-2xl font-bold text-rose-600 tracking-tight">KL Cosméticos</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <button 
                onClick={toggleNotifications}
                className={`relative p-2 transition-colors rounded-full hover:bg-rose-50 ${notificationsEnabled || unreadCount > 0 ? 'text-rose-500' : 'text-slate-400 hover:text-rose-500'}`}
                title="Notificações"
              >
                {unreadCount > 0 ? <BellRing className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 border-2 border-white rounded-full animate-pulse" />
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setShowNotifications(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 z-20 overflow-hidden"
                    >
                      <div className="p-4 border-b border-slate-50 flex justify-between items-center bg-slate-50">
                        <h3 className="font-bold text-slate-800">Novidades</h3>
                        {!notificationsEnabled && (
                          <button 
                            onClick={handleEnableNotifications}
                            className="text-[10px] bg-rose-500 text-white px-2 py-1 rounded-full font-bold hover:bg-rose-600 transition-colors"
                          >
                            Ativar Avisos
                          </button>
                        )}
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="p-8 text-center text-slate-400">
                            <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                            <p className="text-sm">Nenhuma novidade por enquanto.</p>
                          </div>
                        ) : (
                          notifications.map((n) => (
                            <button 
                              key={n.id} 
                              onClick={() => handleNotificationClick(n.productId)}
                              className="w-full text-left p-4 border-b border-slate-50 hover:bg-rose-50 transition-colors group"
                            >
                              <div className="flex items-start gap-3">
                                <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${n.type === 'new' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                <div>
                                  <p className="text-xs font-bold text-slate-800 group-hover:text-rose-600 transition-colors">{n.title}</p>
                                  <p className="text-sm text-slate-600 leading-tight mb-1">{n.message}</p>
                                  <p className="text-[10px] text-slate-400">
                                    {new Date(n.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                </div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            <button 
              onClick={() => setIsCartOpen(true)}
              className="relative p-2 text-slate-600 hover:text-rose-500 transition-colors rounded-full hover:bg-rose-50"
            >
              <ShoppingCart className="w-6 h-6" />
              {cartItemCount > 0 && (
                <span className="absolute top-0 right-0 -mt-1 -mr-1 bg-rose-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
                  {cartItemCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Cart Drawer */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-30"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-40 flex flex-col"
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-rose-500" />
                  Seu Carrinho
                </h2>
                <button 
                  onClick={() => setIsCartOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
                    <ShoppingBag className="w-16 h-16 text-slate-200" />
                    <p>Seu carrinho está vazio.</p>
                    <button 
                      onClick={() => setIsCartOpen(false)}
                      className="text-rose-500 font-medium hover:text-rose-600"
                    >
                      Continuar comprando
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cart.map(item => (
                      <div key={item.id} className="flex gap-4 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
                        <img src={item.image} alt={item.name} className="w-20 h-20 object-cover rounded-xl border border-slate-100" />
                        <div className="flex-1 flex flex-col justify-between">
                          <div className="flex justify-between items-start">
                            <h4 className="font-semibold text-slate-800 text-sm line-clamp-2 pr-2">{item.name}</h4>
                            <button 
                              onClick={() => removeFromCart(item.id)}
                              className="text-slate-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <span className="font-bold text-rose-600">
                              R$ {(item.price * item.quantity).toFixed(2).replace('.', ',')}
                            </span>
                            <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-1 border border-slate-200">
                              <button 
                                onClick={() => updateQuantity(item.id, -1)}
                                disabled={item.quantity <= 1}
                                className="w-6 h-6 flex items-center justify-center rounded-md text-slate-600 hover:bg-white hover:shadow-sm disabled:opacity-50 disabled:hover:bg-transparent transition-all"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="text-sm font-medium w-4 text-center">{item.quantity}</span>
                              <button 
                                onClick={() => updateQuantity(item.id, 1)}
                                disabled={item.quantity >= item.stock}
                                className="w-6 h-6 flex items-center justify-center rounded-md text-slate-600 hover:bg-white hover:shadow-sm disabled:opacity-50 disabled:hover:bg-transparent transition-all"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {cart.length > 0 && (
                <div className="p-4 border-t border-slate-100 bg-slate-50">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-slate-600 font-medium">Total Estimado</span>
                    <span className="text-2xl font-bold text-slate-900">
                      R$ {cartTotal.toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                  <button
                    onClick={handleCheckout}
                    className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white py-4 px-4 rounded-xl font-bold transition-colors shadow-md hover:shadow-lg text-lg"
                  >
                    <MessageCircle className="w-6 h-6" />
                    Finalizar no WhatsApp
                  </button>
                  <button
                    onClick={clearCart}
                    className="w-full mt-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    Esvaziar carrinho
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <section className="max-w-5xl mx-auto px-4 py-12 md:py-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-4">
            Realce sua <span className="text-rose-500">beleza natural</span>
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-8">
            Produtos selecionados com carinho para cuidar de você todos os dias. 
            Compre fácil e rápido pelo WhatsApp.
          </p>
          <a 
            href="#produtos"
            className="inline-flex items-center gap-2 bg-rose-500 text-white px-6 py-3 rounded-full font-medium hover:bg-rose-600 transition-colors shadow-md hover:shadow-lg"
          >
            <ShoppingBag className="w-5 h-5" />
            Ver Catálogo
          </a>
        </motion.div>
      </section>

      {/* Products Section */}
      <section id="produtos" className="max-w-5xl mx-auto px-4 py-12">
        <div className="flex flex-col items-center gap-4 mb-10">
          <div className="flex items-center justify-center gap-2">
            <h3 className="text-3xl font-bold text-slate-900 text-center">
              {filterProductId ? 'Produto Selecionado' : 'Nossos Produtos'}
            </h3>
            <span className="text-2xl">{filterProductId ? '✨' : '💄'}</span>
          </div>
          
          {filterProductId && (
            <button 
              onClick={() => setFilterProductId(null)}
              className="flex items-center gap-2 text-rose-500 font-bold hover:text-rose-600 transition-colors bg-rose-50 px-4 py-2 rounded-full"
            >
              <ArrowLeft className="w-4 h-4" />
              Ver todo o catálogo
            </button>
          )}
        </div>

        {products.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>Nenhum produto cadastrado no momento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {products
              .filter(p => !filterProductId || p.id === filterProductId)
              .map((product, index) => {
              const isOutOfStock = product.stock <= 0;
              const cartItem = cart.find(item => item.id === product.id);
              const isMaxQuantityInCart = cartItem ? cartItem.quantity >= product.stock : false;
              
              return (
                <motion.div
                  key={product.id}
                  id={`product-${product.id}`}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  onClick={() => setSelectedProduct(product)}
                  className={`bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border flex flex-col relative cursor-pointer group/card ${
                    isOutOfStock ? 'opacity-75 grayscale-[0.5]' : ''
                  } ${
                    highlightedProductId === product.id 
                      ? 'border-rose-500 ring-4 ring-rose-200 shadow-2xl scale-[1.02] z-10' 
                      : 'border-rose-100'
                  }`}
                >
                  {/* Stock Badge */}
                  <div className="absolute top-3 right-3 z-10">
                    {isOutOfStock ? (
                      <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                        Esgotado
                      </span>
                    ) : product.stock <= 5 ? (
                      <span className="bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                        Restam {product.stock}
                      </span>
                    ) : null}
                  </div>

                  <div className="relative aspect-square overflow-hidden bg-slate-100">
                    <img 
                      src={product.image} 
                      alt={product.name}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="p-5 flex flex-col flex-grow">
                    <h4 className="font-semibold text-lg text-slate-900 mb-1">{product.name}</h4>
                    <p className="text-sm text-slate-500 mb-4 flex-grow line-clamp-2">{product.description}</p>
                    
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-2xl font-bold text-rose-600">
                        R$ {product.price.toFixed(2).replace('.', ',')}
                      </span>
                      <div className="flex items-center text-amber-400">
                        <Star className="w-4 h-4 fill-current" />
                        <Star className="w-4 h-4 fill-current" />
                        <Star className="w-4 h-4 fill-current" />
                        <Star className="w-4 h-4 fill-current" />
                        <Star className="w-4 h-4 fill-current" />
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        addToCart(product);
                      }}
                      disabled={isOutOfStock || isMaxQuantityInCart}
                      className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-colors shadow-sm ${
                        isOutOfStock 
                          ? 'bg-slate-200 text-slate-500 cursor-not-allowed' 
                          : isMaxQuantityInCart
                            ? 'bg-rose-100 text-rose-700 cursor-not-allowed'
                            : 'bg-rose-500 hover:bg-rose-600 text-white hover:shadow-md'
                      }`}
                    >
                      <ShoppingCart className="w-5 h-5" />
                      {isOutOfStock 
                        ? 'Indisponível' 
                        : isMaxQuantityInCart 
                          ? 'Limite atingido' 
                          : 'Adicionar'}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* VIP Club Section */}
      <section className="bg-rose-500 text-white py-16 mt-8">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="flex flex-col items-center"
          >
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-6 backdrop-blur-sm">
              <MessageCircle className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Quer receber novidades e promoções?
            </h2>
            <p className="text-rose-100 text-lg mb-8 max-w-2xl">
              Participe da nossa lista VIP no WhatsApp e seja o primeiro a saber quando chegarem novos produtos ou quando tivermos descontos exclusivos!
            </p>
            <a 
              href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent('Olá! Gostaria de participar da lista VIP para receber novidades e promoções da loja!')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-white text-rose-600 px-8 py-4 rounded-full font-bold hover:bg-rose-50 transition-colors shadow-lg hover:shadow-xl text-lg"
            >
              <MessageCircle className="w-6 h-6" />
              Quero receber ofertas
            </a>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-8 text-center">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="text-rose-500 w-5 h-5" />
            <span className="text-xl font-bold text-white">KL Cosméticos</span>
          </div>
          <p className="text-sm">© {new Date().getFullYear()} KL Cosméticos. Todos os direitos reservados.</p>
        </div>
      </footer>

      {/* Product Detail Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProduct(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]"
            >
              <button 
                onClick={() => setSelectedProduct(null)}
                className="absolute top-4 right-4 z-10 p-2 bg-white/80 backdrop-blur-sm rounded-full text-slate-500 hover:text-rose-500 transition-colors shadow-sm"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-full md:w-1/2 overflow-hidden bg-slate-100 relative group">
                {selectedProduct.video ? (
                  <div className="w-full h-full relative aspect-square md:aspect-auto">
                    <video 
                      src={selectedProduct.video}
                      className="w-full h-full object-cover"
                      controls
                      autoPlay
                      muted
                      playsInline
                    />
                    <div className="absolute top-4 left-4 z-10">
                      <span className="flex items-center gap-1.5 bg-rose-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg border border-rose-400/30 backdrop-blur-sm animate-pulse">
                        <Video className="w-3 h-3" />
                        VÍDEO REAL
                      </span>
                    </div>
                  </div>
                ) : (
                  <img 
                    src={selectedProduct.image} 
                    alt={selectedProduct.name}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>

              <div className="w-full md:w-1/2 p-6 md:p-8 flex flex-col overflow-y-auto">
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-rose-100 text-rose-600 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider">
                      Premium
                    </span>
                    <div className="flex items-center text-amber-400">
                      <Star className="w-3 h-3 fill-current" />
                      <span className="text-xs font-bold ml-1">5.0</span>
                    </div>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">{selectedProduct.name}</h2>
                  <div className="text-3xl font-bold text-rose-600 mb-4">
                    R$ {selectedProduct.price.toFixed(2).replace('.', ',')}
                  </div>
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 mb-1 uppercase tracking-widest">Descrição</h4>
                      <p className="text-slate-600 leading-relaxed text-sm whitespace-pre-wrap">
                        {selectedProduct.description}
                      </p>
                    </div>
                    {selectedProduct.stock > 0 && (
                      <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-2 rounded-xl text-sm font-medium w-fit">
                        <CheckCircle2 className="w-4 h-4" />
                        Em estoque ({selectedProduct.stock} disponíveis)
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-auto pt-6 border-t border-slate-100">
                  <button
                    onClick={() => {
                      addToCart(selectedProduct);
                      setSelectedProduct(null);
                    }}
                    disabled={selectedProduct.stock <= 0}
                    className={`w-full flex items-center justify-center gap-3 py-4 px-6 rounded-2xl font-bold text-lg transition-all shadow-lg hover:shadow-xl active:scale-95 ${
                      selectedProduct.stock <= 0
                        ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                        : 'bg-rose-500 hover:bg-rose-600 text-white'
                    }`}
                  >
                    <ShoppingCart className="w-6 h-6" />
                    {selectedProduct.stock <= 0 ? 'Indisponível' : 'Adicionar ao Carrinho'}
                  </button>
                  <p className="text-center text-[10px] text-slate-400 mt-4">
                    Pagamento e entrega combinados via WhatsApp após finalizar o pedido.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Product Toast */}
      <AnimatePresence>
        {newProductToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-50 bg-white rounded-2xl shadow-2xl border border-rose-100 p-4 max-w-sm flex items-start gap-4"
          >
            <div className="bg-rose-100 text-rose-500 p-3 rounded-full shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-slate-800 text-sm mb-1">Novo produto disponível!</h4>
              <p className="text-slate-600 text-sm line-clamp-2">{newProductToast}</p>
            </div>
            <button 
              onClick={() => setNewProductToast(null)}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full shadow-lg font-medium text-white ${
              toastMessage.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'
            }`}
          >
            {toastMessage.text}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ==========================================
// ADMIN PANEL VIEW
// ==========================================
function AdminPanel({ 
  products, 
  setProducts, 
  whatsappNumber,
  setWhatsappNumber,
  onClose,
  sales,
  setSales,
  adminTab,
  setAdminTab
}: { 
  products: Product[], 
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>, 
  whatsappNumber: string,
  setWhatsappNumber: React.Dispatch<React.SetStateAction<string>>,
  onClose: () => void,
  sales: Sale[],
  setSales: React.Dispatch<React.SetStateAction<Sale[]>>,
  adminTab: 'products' | 'sales' | 'dashboard',
  setAdminTab: React.Dispatch<React.SetStateAction<'products' | 'sales' | 'dashboard'>>
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteSaleId, setConfirmDeleteSaleId] = useState<string | null>(null);
  const [isRecordingSale, setIsRecordingSale] = useState(false);
  const [saleFormData, setSaleFormData] = useState({
    productId: '',
    quantity: '1'
  });
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    stock: '',
    description: '',
    image: '',
    video: ''
  });

  const [isVideoUploading, setIsVideoUploading] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalStock = products.reduce((acc, p) => acc + p.stock, 0);
  const totalValue = products.reduce((acc, p) => acc + (p.price * p.stock), 0);
  const totalRevenue = sales.reduce((acc, s) => acc + s.total_price, 0);
  const totalItemsSold = sales.reduce((acc, s) => acc + s.quantity, 0);

  const showToast = (text: string, type: 'error' | 'success' = 'error') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleRecordSale = async (e: React.FormEvent) => {
    e.preventDefault();
    const product = products.find(p => p.id === saleFormData.productId);
    if (!product) {
      showToast('Selecione um produto.');
      return;
    }
    const qty = parseInt(saleFormData.quantity);
    if (isNaN(qty) || qty <= 0) {
      showToast('Quantidade inválida.');
      return;
    }
    if (qty > product.stock) {
      showToast('Estoque insuficiente!');
      return;
    }

    setIsSaving(true);
    try {
      const totalPrice = product.price * qty;
      const { data: newSale, error: saleError } = await supabase
        .from('sales')
        .insert({
          product_id: product.id,
          product_name: product.name,
          quantity: qty,
          price_at_sale: product.price,
          total_price: totalPrice
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // Update product stock
      const { error: stockError } = await supabase
        .from('products')
        .update({ stock: product.stock - qty })
        .eq('id', product.id);

      if (stockError) throw stockError;

      showToast('Venda registrada com sucesso!', 'success');
      setSales([newSale as Sale, ...sales]);
      setIsRecordingSale(false);
      setSaleFormData({ productId: '', quantity: '1' });
    } catch (error) {
      console.error("Error recording sale:", error);
      showToast('Erro ao registrar venda.');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDeleteSale = async () => {
    if (!confirmDeleteSaleId) return;
    const sale = sales.find(s => s.id === confirmDeleteSaleId);
    if (!sale) return;

    try {
      // Repor estoque se o produto ainda existir
      if (sale.product_id) {
        const product = products.find(p => p.id === sale.product_id);
        if (product) {
          await supabase
            .from('products')
            .update({ stock: product.stock + sale.quantity })
            .eq('id', product.id);
        }
      }

      const { error } = await supabase.from('sales').delete().eq('id', confirmDeleteSaleId);
      if (error) throw error;

      setSales(sales.filter(s => s.id !== confirmDeleteSaleId));
      showToast('Venda removida e estoque reposto.', 'success');
    } catch (error) {
      console.error("Error deleting sale:", error);
      showToast('Erro ao remover venda.');
    } finally {
      setConfirmDeleteSaleId(null);
    }
  };


  const resetForm = () => {
    setFormData({ name: '', price: '', stock: '', description: '', image: '', video: '' });
    setEditingId(null);
    setIsAdding(false);
    setIsSaving(false);
    setIsVideoUploading(false);
  };

  const handleEdit = (product: Product) => {
    setFormData({
      name: product.name,
      price: product.price.toString(),
      stock: product.stock.toString(),
      description: product.description,
      image: product.image,
      video: product.video || ''
    });
    setEditingId(product.id);
    setIsAdding(true);
  };

  const confirmDelete = async () => {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      
      // Also remove from cart if it exists there
      const savedCart = localStorage.getItem('@kl-cosmeticos:cart');
      if (savedCart) {
        try {
          const cart = JSON.parse(savedCart) as CartItem[];
          const newCart = cart.filter(item => item.id !== id);
          localStorage.setItem('@kl-cosmeticos:cart', JSON.stringify(newCart));
        } catch (e) {
          // ignore
        }
      }
      showToast('Produto excluído com sucesso.', 'success');
    } catch (error) {
      console.error("Error deleting product:", error);
      showToast('Erro ao excluir produto.');
    }
  };

  const handleDelete = (id: string) => {
    setConfirmDeleteId(id);
  };

  // Compress image before saving to localStorage to avoid quota limits
  const handleImageCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Convert to base64 jpeg
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setFormData(prev => ({ ...prev, image: dataUrl }));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };
  
  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size (limit to 10MB for this example, adjust as needed)
    if (file.size > 10 * 1024 * 1024) {
      showToast('O vídeo deve ter no máximo 10MB.');
      return;
    }

    setIsVideoUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-videos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('product-videos')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, video: publicUrl }));
      showToast('Vídeo enviado com sucesso!', 'success');
    } catch (error) {
      console.error('Error uploading video:', error);
      showToast('Erro ao enviar vídeo.');
    } finally {
      setIsVideoUploading(false);
    }
  };
  
  const handleIAAnalysis = () => {
    window.open('https://gemini.google.com/app', '_blank');
    showToast('Abrindo o Gemini para você criar sua descrição! ✨', 'success');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.price || !formData.image) {
      showToast('Por favor, preencha o nome, preço e adicione uma foto.');
      return;
    }

    setIsSaving(true);

    try {
      const productData = {
        name: formData.name,
        price: parseFloat(formData.price),
        stock: parseInt(formData.stock) || 0,
        description: formData.description,
        image: formData.image,
        video: formData.video
      };

      if (editingId) {
        const { error } = await supabase.from('products').update(productData).eq('id', editingId);
        if (error) throw error;
        
        // Update cart if product is there
        const savedCart = localStorage.getItem('@kl-cosmeticos:cart');
        if (savedCart) {
          try {
            const cart = JSON.parse(savedCart) as CartItem[];
            const newCart = cart.map(item => {
              if (item.id === editingId) {
                // Ensure quantity doesn't exceed new stock
                const newQuantity = Math.min(item.quantity, productData.stock);
                return { ...item, ...productData, quantity: newQuantity };
              }
              return item;
            }).filter(item => item.quantity > 0); // Remove if stock became 0 and quantity became 0
            
            localStorage.setItem('@kl-cosmeticos:cart', JSON.stringify(newCart));
          } catch (e) {
            // ignore
          }
        }
        showToast('Produto atualizado com sucesso.', 'success');
      } else {
        const { error } = await supabase.from('products').insert({
          ...productData,
          createdAt: Date.now()
        });
        if (error) throw error;
        showToast('Produto adicionado com sucesso.', 'success');
      }
      
      resetForm();
    } catch (error) {
      console.error("Error saving product:", error);
      showToast('Erro ao salvar produto.');
      setIsSaving(false);
    }
  };

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    await supabase.auth.signOut();
    onClose();
  };

  const handleSaveWhatsapp = async () => {
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({ id: 'whatsapp', value: whatsappNumber });
      
      if (error) throw error;
      showToast('Número do WhatsApp atualizado!', 'success');
    } catch (error) {
      console.error("Error saving whatsapp:", error);
      showToast('Erro ao salvar WhatsApp. Verifique se a tabela "settings" existe no Supabase.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full shadow-lg font-medium text-white ${
              toastMessage.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'
            }`}
          >
            {toastMessage.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal (Products) */}
      <AnimatePresence>
        {confirmDeleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-xl w-full max-w-sm overflow-hidden p-6 text-center"
            >
              <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Excluir Produto?</h3>
              <p className="text-slate-500 mb-6">Esta ação não pode ser desfeita. O produto será removido permanentemente.</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setConfirmDeleteId(null)}
                  className="flex-1 py-3 px-4 rounded-xl font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 py-3 px-4 rounded-xl font-medium text-white bg-red-500 hover:bg-red-600 transition-colors shadow-sm"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Sale Confirmation Modal */}
      <AnimatePresence>
        {confirmDeleteSaleId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-xl w-full max-w-sm overflow-hidden p-6 text-center"
            >
              <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Excluir Venda?</h3>
              <p className="text-slate-500 mb-6">O estoque deste produto será reposto automaticamente.</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setConfirmDeleteSaleId(null)}
                  className="flex-1 py-3 px-4 rounded-xl font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmDeleteSale}
                  className="flex-1 py-3 px-4 rounded-xl font-medium text-white bg-red-500 hover:bg-red-600 transition-colors shadow-sm"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* Admin Header */}
      <header className="bg-slate-900 text-white shadow-md sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-2 -ml-2 hover:bg-slate-800 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Settings className="w-5 h-5 text-rose-400" />
              <span className="hidden sm:inline">Gestão da Loja</span>
              <span className="sm:hidden text-sm uppercase tracking-widest text-rose-400">{adminTab}</span>
            </h1>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-1 bg-slate-800 p-1 rounded-xl">
              <button 
                onClick={() => setAdminTab('products')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${adminTab === 'products' ? 'bg-rose-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
              >
                Produtos
              </button>
              <button 
                onClick={() => setAdminTab('sales')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${adminTab === 'sales' ? 'bg-rose-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
              >
                Vendas
              </button>
              <button 
                onClick={() => setAdminTab('dashboard')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${adminTab === 'dashboard' ? 'bg-rose-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
              >
                Estatística
              </button>
            </div>
            <a href="#" onClick={handleLogout} className="text-sm font-medium text-slate-400 hover:text-rose-400 transition-colors">
              Sair
            </a>
          </div>
        </div>

        {/* Mobile Tabs */}
        <div className="md:hidden flex border-b border-slate-800">
          <button 
            onClick={() => setAdminTab('products')}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-tighter border-b-2 transition-colors ${adminTab === 'products' ? 'border-rose-500 text-rose-400 bg-rose-500/5' : 'border-transparent text-slate-500'}`}
          >
            Produtos
          </button>
          <button 
            onClick={() => setAdminTab('sales')}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-tighter border-b-2 transition-colors ${adminTab === 'sales' ? 'border-rose-500 text-rose-400 bg-rose-500/5' : 'border-transparent text-slate-500'}`}
          >
            Vendas
          </button>
          <button 
            onClick={() => setAdminTab('dashboard')}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-tighter border-b-2 transition-colors ${adminTab === 'dashboard' ? 'border-rose-500 text-rose-400 bg-rose-500/5' : 'border-transparent text-slate-500'}`}
          >
            Estatística
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        
        {adminTab === 'dashboard' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
                <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 font-medium">Faturamento</p>
                  <p className="text-2xl font-bold text-emerald-600">R$ {totalRevenue.toFixed(2).replace('.', ',')}</p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
                <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 font-medium">Total de Saídas</p>
                  <p className="text-2xl font-bold text-slate-900">{sales.length}</p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
                <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 font-medium">Itens Vendidos</p>
                  <p className="text-2xl font-bold text-slate-900">{totalItemsSold}</p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
                <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl">
                  <Box className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 font-medium">Estoque Total</p>
                  <p className="text-2xl font-bold text-slate-900">{totalStock}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Valor em Mercadoria</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-slate-900">R$ {totalValue.toFixed(2).replace('.', ',')}</span>
                  <span className="text-sm text-slate-500">Preço de Venda</span>
                </div>
                <div className="mt-6 pt-6 border-t border-slate-100">
                   <div className="flex justify-between items-center text-sm mb-2">
                      <span className="text-slate-500">Variedade de Produtos</span>
                      <span className="font-bold text-slate-800">{products.length} itens</span>
                   </div>
                   <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full" style={{ width: '100%' }}></div>
                   </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Quick Insights</h3>
                <ul className="space-y-4">
                  <li className="flex items-center gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                    <span className="text-slate-600">Existem <strong className="text-slate-800">{products.filter(p => p.stock <= 0).length}</strong> produtos sem estoque.</span>
                  </li>
                  <li className="flex items-center gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                    <span className="text-slate-600"><strong className="text-slate-800">{products.filter(p => p.stock > 0 && p.stock < 5).length}</strong> produtos com estoque baixo (menos de 5).</span>
                  </li>
                  <li className="flex items-center gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <span className="text-slate-600">A maior venda unitária foi de {sales.length > 0 ? Math.max(...sales.map(s => s.quantity)) : 0} itens.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {adminTab === 'sales' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">Controle de Saídas</h2>
              <button 
                onClick={() => setIsRecordingSale(!isRecordingSale)}
                className="flex items-center gap-2 bg-emerald-500 text-white px-4 py-2 rounded-xl font-medium hover:bg-emerald-600 transition-colors shadow-sm"
              >
                <Plus className="w-5 h-5" />
                Registrar Saída Manual
              </button>
            </div>

            {isRecordingSale && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-emerald-50 border border-emerald-100 rounded-3xl p-6"
              >
                <form onSubmit={handleRecordSale} className="flex flex-col md:flex-row gap-4 items-end">
                  <div className="flex-1 w-full">
                    <label className="block text-xs font-bold text-emerald-700 mb-1 uppercase tracking-wider">Produto</label>
                    <select 
                      value={saleFormData.productId}
                      onChange={e => setSaleFormData({...saleFormData, productId: e.target.value})}
                      className="w-full bg-white border border-emerald-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">Selecione um produto</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id} disabled={p.stock <= 0}>
                          {p.name} ({p.stock} un em estoque)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-full md:w-32">
                    <label className="block text-xs font-bold text-emerald-700 mb-1 uppercase tracking-wider">Quantidade</label>
                    <input 
                      type="number"
                      min="1"
                      value={saleFormData.quantity}
                      onChange={e => setSaleFormData({...saleFormData, quantity: e.target.value})}
                      className="w-full bg-white border border-emerald-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="flex gap-2 w-full md:w-auto">
                    <button 
                      type="submit"
                      disabled={isSaving}
                      className="flex-1 md:flex-none px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-all"
                    >
                      Gravar
                    </button>
                    <button 
                      type="button"
                      onClick={() => setIsRecordingSale(false)}
                      className="px-6 py-3 bg-white text-slate-600 border border-slate-200 font-bold rounded-xl hover:bg-slate-50 transition-all"
                    >
                      Fechar
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-sm font-semibold text-slate-600">
                      <th className="p-4 whitespace-nowrap">Data</th>
                      <th className="p-4 whitespace-nowrap">Produto</th>
                      <th className="p-4 whitespace-nowrap">Qtd</th>
                      <th className="p-4 whitespace-nowrap">Valor</th>
                      <th className="p-4 whitespace-nowrap text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sales.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-12 text-center text-slate-400">
                          Nenhuma venda registrada ainda.
                        </td>
                      </tr>
                    ) : (
                      sales.map((sale) => (
                        <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 text-xs text-slate-500 whitespace-nowrap">
                            {new Date(sale.sale_date).toLocaleDateString('pt-BR')} {new Date(sale.sale_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="p-4 font-bold text-slate-800">
                            {sale.product_name}
                          </td>
                          <td className="p-4 text-slate-600">
                            {sale.quantity} un
                          </td>
                          <td className="p-4 font-bold text-emerald-600 whitespace-nowrap">
                            R$ {sale.total_price.toFixed(2).replace('.', ',')}
                          </td>
                          <td className="p-4 text-right whitespace-nowrap">
                             <button 
                              onClick={() => setConfirmDeleteSaleId(sale.id)}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Excluir Registro"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {adminTab === 'products' && (
          <div className="space-y-6">
            <AnimatePresence mode="wait">
              {isAdding ? (
                <motion.div
                  key="form"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden"
                >
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h2 className="text-xl font-bold text-slate-800">
                      {editingId ? 'Editar Produto' : 'Novo Produto'}
                    </h2>
                    <button onClick={resetForm} className="text-slate-500 hover:text-slate-700 font-medium text-sm">
                      Cancelar
                    </button>
                  </div>

                  <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="flex flex-col md:flex-row gap-8">
                      {/* Photo Upload / Capture */}
                      <div className="flex-1">
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Foto do Produto</label>
                        <div className="flex flex-col sm:flex-row gap-4 items-start">
                          <div 
                            className="w-32 h-32 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center overflow-hidden relative group cursor-pointer"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            {formData.image ? (
                              <>
                                <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Edit2 className="w-6 h-6 text-white" />
                                </div>
                              </>
                            ) : (
                              <>
                                <Camera className="w-8 h-8 text-slate-400 mb-2" />
                                <span className="text-xs text-slate-500 font-medium">Tirar Foto</span>
                              </>
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-slate-500 mb-3">
                              Adicione uma foto nítida do produto.
                            </p>
                            <button 
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="flex items-center gap-2 bg-rose-100 text-rose-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-rose-200 transition-colors"
                            >
                              <Camera className="w-4 h-4" />
                              Câmera / Galeria
                            </button>
                            <input 
                              type="file" 
                              ref={fileInputRef}
                              accept="image/*"
                              capture="environment"
                              onChange={handleImageCapture}
                              className="hidden"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Video Upload Section */}
                      <div className="flex-1">
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Vídeo do Produto (Opcional)</label>
                        <div className="flex flex-col sm:flex-row gap-4 items-start">
                          <div 
                            className="w-32 h-32 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center overflow-hidden relative group cursor-pointer"
                            onClick={() => !isVideoUploading && videoInputRef.current?.click()}
                          >
                            {formData.video ? (
                              <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                                <PlayCircle className="w-10 h-10 text-white" />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Edit2 className="w-6 h-6 text-white" />
                                </div>
                              </div>
                            ) : isVideoUploading ? (
                              <div className="flex flex-col items-center">
                                <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mb-2" />
                                <span className="text-[10px] text-slate-500 font-bold uppercase">Enviando...</span>
                              </div>
                            ) : (
                              <>
                                <Video className="w-8 h-8 text-slate-400 mb-2" />
                                <span className="text-xs text-slate-500 font-medium text-center px-2">Anexar Vídeo</span>
                              </>
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-slate-500 mb-3">
                              Adicione um vídeo mostrando o produto.
                            </p>
                            <button 
                              type="button"
                              disabled={isVideoUploading}
                              onClick={() => videoInputRef.current?.click()}
                              className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors disabled:opacity-50"
                            >
                              <Video className="w-4 h-4" />
                              Escolher Vídeo
                            </button>
                            <input 
                              type="file" 
                              ref={videoInputRef}
                              accept="video/*"
                              onChange={handleVideoUpload}
                              className="hidden"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleIAAnalysis}
                        className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md"
                      >
                        <Sparkles className="w-4 h-4" />
                        Ajudar com Descrição (IA)
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Nome do Produto</label>
                        <input 
                          type="text" 
                          required
                          value={formData.name}
                          onChange={e => setFormData({...formData, name: e.target.value})}
                          className="w-full border border-slate-300 rounded-xl px-4 py-3"
                          placeholder="Ex: Sérum Facial Vitamina C"
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">Preço (R$)</label>
                          <input 
                            type="number" 
                            step="0.01"
                            required
                            value={formData.price}
                            onChange={e => setFormData({...formData, price: e.target.value})}
                            className="w-full border border-slate-300 rounded-xl px-4 py-3"
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">Estoque</label>
                          <input 
                            type="number" 
                            required
                            value={formData.stock}
                            onChange={e => setFormData({...formData, stock: e.target.value})}
                            className="w-full border border-slate-300 rounded-xl px-4 py-3"
                            placeholder="Qtd"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Descrição</label>
                      <textarea 
                        rows={3}
                        value={formData.description}
                        onChange={e => setFormData({...formData, description: e.target.value})}
                        className="w-full border border-slate-300 rounded-xl px-4 py-3 resize-none"
                        placeholder="Detalhes sobre o produto..."
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                      <button type="button" onClick={resetForm} className="px-6 py-3 font-medium text-slate-600">Cancelar</button>
                      <button type="submit" className="bg-slate-900 text-white px-8 py-3 rounded-xl font-medium">Salvar Produto</button>
                    </div>
                  </form>
                </motion.div>
              ) : (
                <motion.div
                  key="list"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-slate-800">Catálogo de Produtos</h2>
                    <button 
                      onClick={() => setIsAdding(true)}
                      className="flex items-center gap-2 bg-rose-500 text-white px-4 py-2 rounded-xl font-medium hover:bg-rose-600 transition-colors shadow-sm"
                    >
                      <Plus className="w-5 h-5" />
                      Novo Produto
                    </button>
                  </div>

                  {products.length === 0 ? (
                    <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center">
                      <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-500">Nenhum produto cadastrado.</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-sm font-semibold text-slate-600">
                              <th className="p-4">Produto</th>
                              <th className="p-4">Preço</th>
                              <th className="p-4">Estoque</th>
                              <th className="p-4 text-right">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {products.map((product) => (
                              <tr key={product.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-4">
                                  <div className="flex items-center gap-3">
                                    <img src={product.image} alt="" className="w-12 h-12 rounded-lg object-cover" />
                                    <span className="font-semibold text-slate-900">{product.name}</span>
                                  </div>
                                </td>
                                <td className="p-4 font-medium">R$ {product.price.toFixed(2).replace('.', ',')}</td>
                                <td className="p-4">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${product.stock > 10 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                    {product.stock} un
                                  </span>
                                </td>
                                <td className="p-4 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button onClick={() => handleEdit(product)} className="p-2 text-slate-400 hover:text-blue-600"><Edit2 className="w-4 h-4" /></button>
                                    <button onClick={() => handleDelete(product.id)} className="p-2 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* WhatsApp Settings */}
            {!isAdding && (
              <div className="mt-8 bg-white rounded-3xl shadow-sm border border-slate-200 p-6">
                <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <MessageCircle className="w-6 h-6 text-emerald-500" />
                  Configurações do WhatsApp
                </h2>
                <div className="flex flex-col sm:flex-row gap-4 items-end">
                  <div className="flex-1 w-full">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Número</label>
                    <input 
                      type="text" 
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200"
                    />
                  </div>
                  <button onClick={handleSaveWhatsapp} className="w-full sm:w-auto px-6 py-3 bg-emerald-500 text-white font-bold rounded-xl">Salvar</button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

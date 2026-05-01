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
    <div className="min-h-screen flex items-center justify-center p-6 bg-brand-cream relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-brand-primary/5 -z-10 blur-3xl animate-pulse" />
      
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-10 rounded-[3rem] shadow-2xl w-full max-w-md border border-brand-primary/10 premium-shadow-lg relative"
      >
        <div className="flex justify-center mb-8">
          <div className="w-20 h-20 bg-brand-primary/10 rounded-[2.5rem] flex items-center justify-center text-brand-primary shadow-inner rotate-3">
            <Lock className="w-10 h-10" />
          </div>
        </div>
        <h2 className="text-3xl font-serif font-black text-center text-brand-dark mb-2">Portal <span className="text-brand-primary">Gestor</span></h2>
        <p className="text-center text-slate-400 font-medium mb-10 text-sm tracking-wide">AUTENTICAÇÃO EXCLUSIVA KL COSMÉTICOS</p>
        
        <form onSubmit={handleLogin} className="space-y-6">
          {error && (
            <motion.p 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-red-500 text-xs font-bold text-center bg-red-50 p-4 rounded-2xl border border-red-100"
            >
              {error}
            </motion.p>
          )}
          {successMsg && (
            <motion.p 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-emerald-600 text-xs font-bold text-center bg-emerald-50 p-4 rounded-2xl border border-emerald-100"
            >
              {successMsg}
            </motion.p>
          )}

          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
              <label className="block text-xs font-black text-brand-dark uppercase tracking-widest">Sua Senha</label>
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={isResetting || isLoading}
                className="text-[10px] text-brand-primary hover:text-brand-accent font-black uppercase tracking-widest disabled:opacity-50 transition-colors"
              >
                {isResetting ? 'Enviando...' : 'Recuperar Acesso'}
              </button>
            </div>
            <div className="relative group">
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-6 py-4 rounded-2xl border-2 border-slate-50 bg-slate-50 focus:bg-white focus:border-brand-primary focus:outline-none transition-all font-black tracking-widest text-brand-dark placeholder:text-slate-300"
                required
              />
              <Key className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-brand-primary transition-colors" />
            </div>
          </div>
          
          <div className="pt-2 space-y-4">
            <button 
              type="submit"
              disabled={isLoading || isResetting}
              className="w-full py-5 px-6 rounded-2xl font-black text-white bg-brand-dark hover:bg-brand-primary transition-all shadow-xl hover:shadow-brand-primary/30 flex items-center justify-center gap-3 disabled:opacity-70 active:scale-[0.98] tracking-widest uppercase text-sm"
            >
              {isLoading ? 'Autenticando...' : 'Acessar Painel'}
            </button>
            
            <button 
              type="button"
              onClick={onCancel}
              className="w-full py-4 px-6 rounded-2xl font-bold text-slate-400 hover:text-brand-dark bg-slate-50 hover:bg-slate-100 transition-all text-sm"
            >
              Retornar à Loja
            </button>
          </div>
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

  if (view === 'login') {
    return (
      <div className="min-h-screen bg-brand-dark flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-brand-primary/10 rounded-full blur-3xl -z-0 opacity-50" />
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 w-full max-w-md bg-white/10 backdrop-blur-2xl p-10 rounded-[3rem] border border-white/10 shadow-2xl"
        >
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-brand-primary rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-brand-primary/20 rotate-3">
              <Lock className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-3xl font-serif font-bold text-white mb-2">Portal <span className="text-brand-primary italic">Gestor</span></h2>
            <p className="text-slate-400 font-medium">Acesso restrito à administração</p>
          </div>

          <form onSubmit={async (e) => {
            e.preventDefault();
            const email = (e.target as any).email.value;
            const password = (e.target as any).password.value;
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) {
              showToast('Acesso negado. Verifique suas credenciais.', 'error');
            } else {
              setView('admin');
              showToast('Bem-vinda de volta!', 'success');
            }
          }} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-brand-primary uppercase tracking-widest px-1">E-mail Corporativo</label>
              <div className="relative">
                <input 
                  name="email"
                  type="email" 
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-brand-primary focus:bg-white/10 transition-all font-medium"
                  placeholder="admin@klcosmeticos.com"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-brand-primary uppercase tracking-widest px-1">Chave de Acesso</label>
              <div className="relative">
                <input 
                  name="password"
                  type="password" 
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-brand-primary focus:bg-white/10 transition-all font-medium"
                  placeholder="••••••••"
                />
              </div>
            </div>
            <button 
              type="submit"
              className="w-full py-5 bg-brand-primary text-white font-black rounded-2xl hover:bg-brand-accent transition-all shadow-xl shadow-brand-primary/20 active:scale-95 text-lg"
            >
              Entrar no Painel
            </button>
            <button 
              type="button"
              onClick={() => setView('store')}
              className="w-full py-2 text-xs font-bold text-slate-500 hover:text-white transition-colors uppercase tracking-widest"
            >
              Voltar para a Loja
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  if (view === 'admin') {
    if (!user) {
      setView('login');
      return null;
    }
    return (
      <AdminPanel 
        products={products}
        setProducts={setProducts}
        whatsappNumber={whatsappNumber}
        setWhatsappNumber={setWhatsappNumber}
        onClose={() => setView('store')}
        sales={sales}
        setSales={setSales}
        adminTab={adminTab}
        setAdminTab={setAdminTab}
      />
    );
  }

  return (
    <>
      {/* Header */}
      <header className="glass sticky top-0 z-30 transition-all duration-300">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <div className="w-10 h-10 bg-brand-primary rounded-xl flex items-center justify-center shadow-lg transform rotate-3">
              <Sparkles className="text-white w-6 h-6" />
            </div>
            <h1 className="text-2xl font-serif font-bold text-brand-dark tracking-tight">
              KL <span className="text-brand-primary italic">Cosméticos</span>
            </h1>
          </motion.div>
          
          <div className="flex items-center gap-2">
            <div className="relative">
              <button 
                onClick={toggleNotifications}
                className={`relative p-2.5 transition-all rounded-xl hover:bg-brand-primary/10 ${notificationsEnabled || unreadCount > 0 ? 'text-brand-primary' : 'text-slate-400'}`}
                title="Notificações"
              >
                {unreadCount > 0 ? <BellRing className="w-5 h-5 animate-bounce" /> : <Bell className="w-5 h-5" />}
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 w-3 h-3 bg-brand-primary border-2 border-white rounded-full" />
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowNotifications(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-4 w-80 bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 z-20 overflow-hidden premium-shadow-lg"
                    >
                      <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-brand-cream/50">
                        <h3 className="font-serif font-bold text-brand-dark">Novidades</h3>
                        {!notificationsEnabled && (
                          <button 
                            onClick={handleEnableNotifications}
                            className="text-[11px] bg-brand-primary text-white px-3 py-1.5 rounded-full font-bold hover:shadow-lg transition-all active:scale-95"
                          >
                            Ativar Avisos
                          </button>
                        )}
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="p-10 text-center text-slate-400">
                            <Bell className="w-10 h-10 mx-auto mb-3 opacity-10" />
                            <p className="text-sm font-medium">Nenhuma novidade por enquanto.</p>
                          </div>
                        ) : (
                          notifications.map((n) => (
                            <button 
                              key={n.id} 
                              onClick={() => handleNotificationClick(n.productId)}
                              className="w-full text-left p-5 border-b border-slate-50 hover:bg-brand-primary/5 transition-colors group"
                            >
                              <div className="flex items-start gap-3">
                                <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.type === 'new' ? 'bg-emerald-500' : 'bg-brand-primary'}`} />
                                <div>
                                  <p className="text-xs font-bold text-brand-dark group-hover:text-brand-primary transition-colors">{n.title}</p>
                                  <p className="text-sm text-slate-600 leading-snug mb-1.5">{n.message}</p>
                                  <p className="text-[10px] text-slate-400 font-medium">
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
              className="relative p-2.5 text-slate-600 hover:text-brand-primary transition-all rounded-xl hover:bg-brand-primary/10 group"
            >
              <ShoppingCart className="w-6 h-6 group-hover:scale-110 transition-transform" />
              {cartItemCount > 0 && (
                <span className="absolute top-1.5 right-1.5 bg-brand-primary text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
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
              className="fixed inset-0 bg-brand-dark/60 backdrop-blur-md z-40"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col premium-shadow-lg"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-brand-cream/30">
                <div className="flex flex-col">
                  <h2 className="text-2xl font-serif font-bold text-brand-dark flex items-center gap-2">
                    <ShoppingBag className="w-6 h-6 text-brand-primary" />
                    Carrinho
                  </h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                    {cartItemCount} itens selecionados
                  </p>
                </div>
                <button 
                  onClick={() => setIsCartOpen(false)}
                  className="p-3 text-slate-400 hover:text-brand-primary rounded-2xl hover:bg-brand-primary/5 transition-all active:scale-95"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-6">
                    <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center">
                      <ShoppingBag className="w-12 h-12 opacity-10" />
                    </div>
                    <div className="text-center">
                      <p className="font-serif font-bold text-brand-dark text-xl mb-2">Seu carrinho está vazio</p>
                      <p className="text-sm font-medium">Nenhum produto adicionado ainda.</p>
                    </div>
                    <button 
                      onClick={() => setIsCartOpen(false)}
                      className="text-brand-primary font-black uppercase tracking-widest text-xs hover:tracking-[0.2em] transition-all"
                    >
                      Continuar Explorando
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cart.map(item => (
                      <motion.div 
                        layout
                        key={item.id} 
                        className="flex gap-4 bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-shadow group"
                      >
                        <div className="w-24 h-24 rounded-2xl overflow-hidden border border-slate-100 shrink-0">
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        </div>
                        <div className="flex-1 flex flex-col justify-between py-1">
                          <div className="flex justify-between items-start">
                            <h4 className="font-serif font-bold text-brand-dark text-base line-clamp-1 group-hover:text-brand-primary transition-colors">{item.name}</h4>
                            <button 
                              onClick={() => removeFromCart(item.id)}
                              className="text-slate-300 hover:text-red-500 transition-colors p-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="font-black text-brand-primary text-lg">
                              R$ {(item.price * item.quantity).toFixed(2).replace('.', ',')}
                            </span>
                            <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-1.5 border border-slate-100">
                              <button 
                                onClick={() => updateQuantity(item.id, -1)}
                                disabled={item.quantity <= 1}
                                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-600 hover:bg-white hover:shadow-sm disabled:opacity-30 transition-all active:scale-90"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="text-xs font-black w-4 text-center text-brand-dark">{item.quantity}</span>
                              <button 
                                onClick={() => updateQuantity(item.id, 1)}
                                disabled={item.quantity >= item.stock}
                                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-600 hover:bg-white hover:shadow-sm disabled:opacity-30 transition-all active:scale-90"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {cart.length > 0 && (
                <div className="p-8 border-t border-slate-100 bg-brand-cream/20">
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Subtotal</span>
                      <span className="text-3xl font-black text-brand-dark">
                        R$ {cartTotal.toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">Entrega Segura</p>
                      <p className="text-xs text-slate-400 font-medium italic">Calculado no WhatsApp</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <button
                      onClick={handleCheckout}
                      className="w-full flex items-center justify-center gap-3 bg-brand-primary hover:bg-brand-accent text-white py-5 px-6 rounded-2xl font-black transition-all shadow-xl hover:shadow-brand-primary/30 text-lg active:scale-[0.98]"
                    >
                      <MessageCircle className="w-6 h-6" />
                      Finalizar Pedido
                    </button>
                    <button
                      onClick={clearCart}
                      className="w-full py-2 text-xs font-bold text-slate-300 hover:text-red-400 transition-colors uppercase tracking-widest"
                    >
                      Esvaziar Carrinho
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-24 md:pt-24 md:pb-32">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-brand-primary/5 rounded-full blur-3xl -z-10 opacity-60" />
        <div className="max-w-6xl mx-auto px-6 text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className="inline-flex items-center gap-2 bg-brand-primary/10 text-brand-primary px-4 py-2 rounded-full font-bold text-sm mb-6 border border-brand-primary/20">
              <Sparkles className="w-4 h-4" />
              <span>COLEÇÃO PREMIUM 2024</span>
            </div>
            <h2 className="text-5xl md:text-7xl font-serif font-black text-brand-dark mb-6 leading-tight">
              Realce sua <br />
              <span className="text-brand-primary italic relative">
                beleza natural
                <svg className="absolute -bottom-2 left-0 w-full h-3 text-brand-primary/30" viewBox="0 0 100 10" preserveAspectRatio="none">
                  <path d="M0 5 Q 25 0 50 5 T 100 5" fill="none" stroke="currentColor" strokeWidth="4" />
                </svg>
              </span>
            </h2>
            <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed font-medium">
              Produtos selecionados com curinho para cuidar de você todos os dias. 
              Descubra o segredo de uma pele radiante e saudável.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a 
                href="#produtos"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-brand-dark text-white px-10 py-5 rounded-2xl font-bold hover:bg-brand-primary transition-all shadow-xl hover:shadow-brand-primary/30 active:scale-95 group"
              >
                <ShoppingBag className="w-5 h-5 group-hover:animate-bounce" />
                Explorar Catálogo
              </a>
              <a 
                href={`https://wa.me/${whatsappNumber}`}
                target="_blank"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white text-brand-dark border-2 border-slate-100 px-10 py-5 rounded-2xl font-bold hover:bg-brand-cream transition-all shadow-sm active:scale-95"
              >
                <MessageCircle className="w-5 h-5 text-brand-primary" />
                Atendimento VIP
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Products Section */}
      <section id="produtos" className="max-w-6xl mx-auto px-6 py-20">
        <div className="flex flex-col items-center gap-4 mb-16">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <h3 className="text-4xl md:text-5xl font-serif font-bold text-brand-dark mb-4">
              {filterProductId ? 'Produto Selecionado' : 'Coleção Exclusiva'}
            </h3>
            <div className="w-24 h-1 bg-brand-primary mx-auto rounded-full mb-6" />
            <p className="text-slate-500 font-medium max-w-lg mx-auto">
              {filterProductId 
                ? 'Confira os detalhes deste item especial da nossa curadoria.' 
                : 'Explore nossa seleção cuidadosa de produtos premium para realçar sua beleza natural.'}
            </p>
          </motion.div>
          
          {filterProductId && (
            <button 
              onClick={() => setFilterProductId(null)}
              className="group flex items-center gap-2 text-brand-primary font-bold hover:text-white transition-all bg-brand-primary/5 hover:bg-brand-primary px-6 py-3 rounded-2xl premium-shadow"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              Ver Catálogo Completo
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
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.05 }}
                  onClick={() => setSelectedProduct(product)}
                  className={`group/card bg-white rounded-[2rem] overflow-hidden transition-all duration-500 flex flex-col relative cursor-pointer border-2 ${
                    isOutOfStock ? 'opacity-70 grayscale-[0.5]' : ''
                  } ${
                    highlightedProductId === product.id 
                      ? 'border-brand-primary ring-8 ring-brand-primary/10 shadow-2xl scale-[1.03] z-10' 
                      : 'border-slate-50 hover:border-brand-primary/20 hover:shadow-2xl'
                  }`}
                >
                  {/* Stock & Promo Badges */}
                  <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                    {isOutOfStock ? (
                      <span className="bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-tighter">
                        Esgotado
                      </span>
                    ) : product.stock <= 5 ? (
                      <span className="bg-amber-500/90 backdrop-blur-md text-white text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-tighter shadow-lg">
                        Últimas {product.stock}
                      </span>
                    ) : (
                      <span className="bg-brand-primary/90 backdrop-blur-md text-white text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-tighter shadow-lg">
                        Premium
                      </span>
                    )}
                  </div>

                  <div className="relative aspect-[4/5] overflow-hidden bg-slate-50">
                    <img 
                      src={product.image} 
                      alt={product.name}
                      className="w-full h-full object-cover transition-all duration-700 group-hover/card:scale-110 group-hover/card:rotate-1"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-brand-dark/40 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-500" />
                    
                    <div className="absolute bottom-4 left-0 right-0 px-4 translate-y-10 group-hover/card:translate-y-0 transition-transform duration-500">
                       <button
                        onClick={(e) => {
                          e.stopPropagation();
                          addToCart(product);
                        }}
                        disabled={isOutOfStock || isMaxQuantityInCart}
                        className="w-full bg-white/90 backdrop-blur-md text-brand-dark py-3 rounded-xl font-bold text-sm shadow-xl hover:bg-brand-primary hover:text-white transition-all active:scale-95"
                      >
                        {isOutOfStock ? 'Indisponível' : 'Adicionar ao Carrinho'}
                      </button>
                    </div>
                  </div>

                  <div className="p-6 flex flex-col flex-grow bg-white">
                    <div className="flex items-center gap-1 mb-2">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <h4 className="font-serif font-bold text-xl text-brand-dark mb-1 group-hover/card:text-brand-primary transition-colors line-clamp-1">{product.name}</h4>
                    <p className="text-xs text-slate-400 font-medium mb-4 flex-grow line-clamp-2 uppercase tracking-wide">{product.description}</p>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Preço</span>
                        <span className="text-2xl font-black text-brand-dark">
                          R$ {product.price.toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-brand-cream flex items-center justify-center text-brand-primary group-hover/card:bg-brand-primary group-hover/card:text-white transition-all">
                        <Plus className="w-6 h-6" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* VIP Club Section */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-brand-dark -z-10" />
        <div className="absolute top-0 right-0 w-1/2 h-full bg-brand-primary/10 blur-3xl -z-10" />
        
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="flex flex-col items-center"
          >
            <div className="w-20 h-20 bg-brand-primary/20 rounded-[2.5rem] flex items-center justify-center mb-8 backdrop-blur-xl border border-brand-primary/30 rotate-12 group hover:rotate-0 transition-transform duration-500">
              <MessageCircle className="w-10 h-10 text-brand-primary" />
            </div>
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-white mb-6">
              Experiência <span className="text-brand-primary italic">Exclusiva</span>
            </h2>
            <p className="text-slate-400 text-lg mb-10 max-w-2xl font-medium leading-relaxed">
              Junte-se à nossa lista VIP no WhatsApp e receba em primeira mão lançamentos luxuosos, dicas de beleza e ofertas que você não encontrará em nenhum outro lugar.
            </p>
            <a 
              href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent('Olá! Gostaria de participar da lista VIP para receber novidades e promoções da loja!')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 bg-brand-primary text-white px-12 py-5 rounded-2xl font-bold hover:bg-brand-accent transition-all shadow-xl hover:shadow-brand-primary/40 active:scale-95 text-lg"
            >
              <Sparkles className="w-6 h-6" />
              Quero ser VIP
            </a>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0f172a] text-slate-500 py-16 text-center border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-12">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-brand-primary rounded-lg flex items-center justify-center">
                <Sparkles className="text-white w-5 h-5" />
              </div>
              <span className="text-2xl font-serif font-bold text-white">KL <span className="text-brand-primary italic">Cosméticos</span></span>
            </div>
            <div className="flex gap-8 text-sm font-bold uppercase tracking-widest">
              <a href="#produtos" className="hover:text-brand-primary transition-colors">Produtos</a>
              <a href="#" className="hover:text-brand-primary transition-colors">Sobre</a>
              <a href="#" className="hover:text-brand-primary transition-colors">Contato</a>
            </div>
          </div>
          <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-medium">
            <p>© {new Date().getFullYear()} KL Cosméticos. Crafted for beauty.</p>
            <div className="flex items-center gap-6">
              <button 
                onClick={() => setView('login')}
                className="text-slate-600 hover:text-brand-primary transition-colors flex items-center gap-2"
              >
                <Lock className="w-3 h-3" />
                Área do Gestor
              </button>
              <p className="flex items-center gap-2">
                Privacidade • Termos • <span className="text-brand-primary">Beleza Real</span>
              </p>
            </div>
          </div>
        </div>
      </footer>

      {/* Product Detail Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProduct(null)}
              className="absolute inset-0 bg-brand-dark/80 backdrop-blur-xl"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="relative w-full max-w-5xl bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh] premium-shadow-lg"
            >
              <button 
                onClick={() => setSelectedProduct(null)}
                className="absolute top-6 right-6 z-20 p-3 bg-white/80 backdrop-blur-md rounded-2xl text-slate-400 hover:text-brand-primary transition-all shadow-xl hover:scale-110 active:scale-95"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="w-full md:w-1/2 overflow-hidden bg-slate-50 relative group">
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
                    <div className="absolute top-6 left-6 z-10">
                      <span className="flex items-center gap-2 bg-brand-primary text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-2xl border border-white/20 backdrop-blur-md animate-pulse uppercase tracking-widest">
                        <Video className="w-3 h-3" />
                        Vídeo Real
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

              <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col overflow-y-auto">
                <div className="mb-8">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="bg-brand-primary/10 text-brand-primary text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest border border-brand-primary/10">
                      Coleção Premium
                    </span>
                    <div className="flex items-center gap-1 text-amber-400">
                      <Star className="w-4 h-4 fill-current" />
                      <span className="text-sm font-black ml-1 text-brand-dark">5.0</span>
                    </div>
                  </div>
                  <h2 className="text-4xl md:text-5xl font-serif font-bold text-brand-dark mb-4 leading-tight">{selectedProduct.name}</h2>
                  <div className="flex items-baseline gap-3 mb-8">
                    <span className="text-4xl font-black text-brand-primary">
                      R$ {selectedProduct.price.toFixed(2).replace('.', ',')}
                    </span>
                    <span className="text-slate-400 line-through text-lg font-medium">
                      R$ {(selectedProduct.price * 1.2).toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                  
                  <div className="space-y-8">
                    <div>
                      <h4 className="text-xs font-black text-brand-dark mb-3 uppercase tracking-[0.2em] flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-brand-primary" />
                        A Essência do Produto
                      </h4>
                      <p className="text-slate-500 leading-relaxed text-base font-medium whitespace-pre-wrap">
                        {selectedProduct.description}
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Disponibilidade</p>
                        <p className="text-brand-dark font-bold flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          {selectedProduct.stock > 0 ? `${selectedProduct.stock} em estoque` : 'Esgotado'}
                        </p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Entrega</p>
                        <p className="text-brand-dark font-bold flex items-center gap-2">
                          <Clock className="w-4 h-4 text-brand-primary" />
                          Rápida & Segura
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-auto pt-8 border-t border-slate-100">
                  <button
                    onClick={() => {
                      addToCart(selectedProduct);
                      setSelectedProduct(null);
                    }}
                    disabled={selectedProduct.stock <= 0}
                    className={`w-full flex items-center justify-center gap-4 py-6 px-8 rounded-2xl font-black text-xl transition-all shadow-2xl hover:shadow-brand-primary/40 active:scale-[0.98] ${
                      selectedProduct.stock <= 0
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-brand-dark text-white hover:bg-brand-primary'
                    }`}
                  >
                    <ShoppingBag className="w-6 h-6" />
                    {selectedProduct.stock <= 0 ? 'Indisponível no Momento' : 'Garantir Meu Item'}
                  </button>
                  <p className="text-center text-[10px] text-slate-400 mt-6 font-bold uppercase tracking-widest">
                    Checkout 100% seguro via WhatsApp
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
    setView('store');
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
    <div className="min-h-screen bg-slate-50 pb-20 font-sans">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className={`fixed top-20 left-1/2 -translate-x-1/2 z-[100] px-8 py-4 rounded-2xl shadow-2xl font-bold text-white flex items-center gap-3 backdrop-blur-xl ${
              toastMessage.type === 'error' ? 'bg-red-500/90' : 'bg-emerald-500/90'
            }`}
          >
            {toastMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
            {toastMessage.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal (Products) */}
      <AnimatePresence>
        {confirmDeleteId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-brand-dark/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden p-8 text-center border border-slate-100"
            >
              <div className="w-20 h-20 bg-red-50 text-red-500 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-serif font-bold text-brand-dark mb-3">Excluir Produto?</h3>
              <p className="text-slate-500 mb-8 font-medium">Esta ação é irreversível. O item será removido permanentemente do catálogo.</p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setConfirmDeleteId(null)}
                  className="flex-1 py-4 px-4 rounded-2xl font-bold text-slate-400 bg-slate-50 hover:bg-slate-100 transition-all"
                >
                  Manter
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 py-4 px-4 rounded-2xl font-bold text-white bg-red-500 hover:bg-red-600 transition-all shadow-lg hover:shadow-red-500/30"
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-brand-dark/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden p-8 text-center border border-slate-100"
            >
              <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-serif font-bold text-brand-dark mb-3">Estornar Venda?</h3>
              <p className="text-slate-500 mb-8 font-medium">O estoque deste produto será recomposto automaticamente.</p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setConfirmDeleteSaleId(null)}
                  className="flex-1 py-4 px-4 rounded-2xl font-bold text-slate-400 bg-slate-50 hover:bg-slate-100 transition-all"
                >
                  Voltar
                </button>
                <button 
                  onClick={confirmDeleteSale}
                  className="flex-1 py-4 px-4 rounded-2xl font-bold text-white bg-amber-500 hover:bg-amber-600 transition-all shadow-lg hover:shadow-amber-500/30"
                >
                  Estornar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Header */}
      <header className="bg-brand-dark text-white sticky top-0 z-40 shadow-2xl">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-4">
            <button 
              onClick={onClose} 
              className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all active:scale-90"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex flex-col">
              <h1 className="text-xl font-serif font-bold flex items-center gap-2">
                Painel <span className="text-brand-primary italic">Gestor</span>
              </h1>
              <p className="text-[10px] font-black text-brand-primary uppercase tracking-[0.2em]">{adminTab}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <nav className="hidden lg:flex items-center gap-2 bg-white/5 p-1.5 rounded-2xl border border-white/5">
              {[
                { id: 'products', icon: Package, label: 'Catálogo' },
                { id: 'sales', icon: TrendingUp, label: 'Vendas' },
                { id: 'dashboard', icon: Settings, label: 'Estatísticas' }
              ].map(tab => (
                <button 
                  key={tab.id}
                  onClick={() => setAdminTab(tab.id as any)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${adminTab === tab.id ? 'bg-brand-primary text-white shadow-xl' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
            <button 
              onClick={handleLogout} 
              className="px-5 py-2.5 rounded-xl bg-red-500/10 text-red-500 text-sm font-bold hover:bg-red-500 hover:text-white transition-all active:scale-95"
            >
              Sair
            </button>
          </div>
        </div>

        {/* Mobile Tabs */}
        <div className="lg:hidden flex border-t border-white/5 bg-brand-dark/50 backdrop-blur-md">
          {[
            { id: 'products', icon: Package, label: 'Itens' },
            { id: 'sales', icon: TrendingUp, label: 'Vendas' },
            { id: 'dashboard', icon: Settings, label: 'Geral' }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setAdminTab(tab.id as any)}
              className={`flex-1 py-4 flex flex-col items-center gap-1 transition-all ${adminTab === tab.id ? 'text-brand-primary bg-brand-primary/10' : 'text-slate-500'}`}
            >
              <tab.icon className="w-5 h-5" />
              <span className="text-[10px] font-black uppercase tracking-widest">{tab.label}</span>
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        
        {adminTab === 'dashboard' && (
          <div className="space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'Faturamento Total', value: `R$ ${totalRevenue.toFixed(2).replace('.', ',')}`, icon: TrendingUp, color: 'emerald' },
                { label: 'Itens Vendidos', value: totalItemsSold, icon: ShoppingCart, color: 'brand-primary' },
                { label: 'Estoque Total', value: totalStock, icon: Box, color: 'amber' },
                { label: 'Valor em Estoque', value: `R$ ${totalValue.toFixed(2).replace('.', ',')}`, icon: Star, color: 'blue' }
              ].map((stat, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  key={i}
                  className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 premium-shadow relative overflow-hidden group"
                >
                  <div className={`absolute top-0 left-0 w-2 h-full bg-${stat.color === 'brand-primary' ? 'brand-primary' : stat.color + '-500'}`} />
                  <div className={`w-12 h-12 bg-${stat.color === 'brand-primary' ? 'brand-primary' : stat.color + '-100'} text-${stat.color === 'brand-primary' ? 'white' : stat.color + '-600'} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                    <stat.icon className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                  <p className={`text-2xl font-black text-slate-900 group-hover:text-brand-primary transition-colors`}>{stat.value}</p>
                </motion.div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-10 rounded-[3rem] border border-slate-100 premium-shadow">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-2xl font-serif font-bold text-brand-dark">Configurações Gerais</h3>
                    <p className="text-sm text-slate-400 font-medium">Ajustes essenciais da loja</p>
                  </div>
                </div>
                
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-brand-dark uppercase tracking-widest px-1">Número WhatsApp Business</label>
                    <div className="flex gap-3">
                      <div className="relative flex-1">
                        <MessageCircle className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                        <input 
                          type="text" 
                          value={whatsappNumber}
                          onChange={(e) => setWhatsappNumber(e.target.value)}
                          className="w-full pl-14 pr-6 py-4 rounded-2xl border-2 border-slate-50 bg-slate-50 focus:bg-white focus:border-brand-primary focus:outline-none transition-all font-bold text-brand-dark"
                          placeholder="Ex: 5599999999999"
                        />
                      </div>
                      <button 
                        onClick={handleSaveWhatsapp}
                        className="px-8 bg-brand-primary text-white font-bold rounded-2xl hover:bg-brand-accent transition-all shadow-lg hover:shadow-brand-primary/30 active:scale-95"
                      >
                        Salvar
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium italic px-2">Apenas números, incluindo o código do país (DDI) e o DDD.</p>
                  </div>
                </div>
              </div>

              <div className="bg-brand-dark p-10 rounded-[3rem] text-white premium-shadow relative overflow-hidden">
                <Sparkles className="absolute top-10 right-10 w-24 h-24 text-brand-primary/10 -rotate-12" />
                <h3 className="text-2xl font-serif font-bold mb-3">Assistente <span className="text-brand-primary italic">Gemini AI</span></h3>
                <p className="text-slate-400 mb-8 font-medium leading-relaxed">
                  Utilize o poder da inteligência artificial para criar descrições persuasivas e anúncios de alta conversão para seus cosméticos.
                </p>
                <button 
                  onClick={handleIAAnalysis}
                  className="w-full py-5 bg-white text-brand-dark rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-brand-primary hover:text-white transition-all shadow-xl active:scale-95 group"
                >
                  <Sparkles className="w-6 h-6 text-brand-primary group-hover:text-white" />
                  Gerar Conteúdo com IA
                </button>
              </div>
            </div>
          </div>
        )}

        {adminTab === 'sales' && (
          <div className="space-y-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <h2 className="text-3xl font-serif font-bold text-brand-dark">Controle de Saídas</h2>
                <p className="text-sm text-slate-400 font-medium">Histórico completo de vendas e retiradas</p>
              </div>
              <button 
                onClick={() => setIsRecordingSale(!isRecordingSale)}
                className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black transition-all shadow-xl active:scale-95 ${isRecordingSale ? 'bg-slate-100 text-slate-500' : 'bg-brand-primary text-white hover:bg-brand-accent shadow-brand-primary/20'}`}
              >
                {isRecordingSale ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                {isRecordingSale ? 'Cancelar Registro' : 'Nova Venda Manual'}
              </button>
            </div>

            <AnimatePresence mode="wait">
              {isRecordingSale && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-white p-10 rounded-[3rem] border border-slate-100 premium-shadow mb-10">
                    <form onSubmit={handleRecordSale} className="grid grid-cols-1 md:grid-cols-3 gap-8 items-end">
                      <div className="space-y-2">
                        <label className="text-xs font-black text-brand-dark uppercase tracking-widest px-1">Produto</label>
                        <select 
                          value={saleFormData.productId}
                          onChange={e => setSaleFormData({...saleFormData, productId: e.target.value})}
                          className="w-full px-6 py-4 rounded-2xl border-2 border-slate-50 bg-slate-50 focus:bg-white focus:border-brand-primary focus:outline-none transition-all font-bold text-brand-dark appearance-none"
                          required
                        >
                          <option value="">Selecione o item...</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id} disabled={p.stock <= 0}>
                              {p.name} ({p.stock} em estoque)
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-brand-dark uppercase tracking-widest px-1">Quantidade</label>
                        <input 
                          type="number" 
                          min="1"
                          value={saleFormData.quantity}
                          onChange={e => setSaleFormData({...saleFormData, quantity: e.target.value})}
                          className="w-full px-6 py-4 rounded-2xl border-2 border-slate-50 bg-slate-50 focus:bg-white focus:border-brand-primary focus:outline-none transition-all font-bold text-brand-dark"
                          required
                        />
                      </div>
                      <button 
                        type="submit"
                        disabled={isSaving}
                        className="py-5 bg-emerald-500 text-white font-black rounded-2xl hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
                      >
                        {isSaving ? 'Registrando...' : 'Confirmar Venda'}
                      </button>
                    </form>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {sales.length === 0 ? (
              <div className="bg-white rounded-[3rem] border border-slate-100 p-20 text-center premium-shadow">
                <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                  <TrendingUp className="w-10 h-10 text-slate-200" />
                </div>
                <p className="text-slate-400 font-medium">Nenhuma venda registrada até o momento.</p>
              </div>
            ) : (
              <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden premium-shadow">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                        <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Produto</th>
                        <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Qtd</th>
                        <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor Total</th>
                        <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {sales.map((sale) => (
                        <tr key={sale.id} className="hover:bg-slate-50/30 transition-colors group">
                          <td className="p-6">
                            <span className="text-sm font-bold text-slate-500">
                              {new Date(sale.sale_date).toLocaleDateString('pt-BR')}
                            </span>
                            <p className="text-[10px] text-slate-400 font-medium italic">
                              {new Date(sale.sale_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </td>
                          <td className="p-6">
                            <span className="font-bold text-brand-dark group-hover:text-brand-primary transition-colors">{sale.product_name}</span>
                          </td>
                          <td className="p-6">
                            <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-xs font-black">{sale.quantity} un</span>
                          </td>
                          <td className="p-6">
                            <span className="font-black text-emerald-600">R$ {sale.total_price.toFixed(2).replace('.', ',')}</span>
                          </td>
                          <td className="p-6 text-right">
                            <button 
                              onClick={() => setConfirmDeleteSaleId(sale.id)}
                              className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all active:scale-90"
                              title="Estornar Venda"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {adminTab === 'products' && (
          <div className="space-y-10">
            <AnimatePresence mode="wait">
              {isAdding || editingId ? (
                <motion.div
                  key="form"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -30 }}
                  className="bg-white p-10 rounded-[3rem] border border-slate-100 premium-shadow"
                >
                  <div className="flex items-center gap-6 mb-10 pb-6 border-b border-slate-100">
                    <div className="w-16 h-16 bg-brand-primary/10 rounded-2xl flex items-center justify-center text-brand-primary">
                      {editingId ? <Edit2 className="w-8 h-8" /> : <Plus className="w-8 h-8" />}
                    </div>
                    <div>
                      <h2 className="text-2xl font-serif font-bold text-brand-dark">{editingId ? 'Editar Produto' : 'Novo Produto Luxo'}</h2>
                      <p className="text-sm text-slate-400 font-medium">Preencha os detalhes para atualizar sua vitrine</p>
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      {/* Image Capture Section */}
                      <div className="space-y-4">
                        <label className="text-xs font-black text-brand-dark uppercase tracking-widest px-1">Fotografia do Produto</label>
                        <div className="flex gap-6 items-center">
                          <div 
                            className="w-40 h-40 rounded-[2.5rem] bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center overflow-hidden relative group cursor-pointer hover:border-brand-primary transition-all"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            {formData.image ? (
                              <>
                                <img src={formData.image} alt="Preview" className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500" />
                                <div className="absolute inset-0 bg-brand-dark/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                                  <Camera className="w-8 h-8 text-white" />
                                </div>
                              </>
                            ) : (
                              <div className="flex flex-col items-center text-slate-400">
                                <Camera className="w-10 h-10 mb-3" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-center px-4">Capturar Imagem</span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 space-y-4">
                            <p className="text-sm text-slate-500 font-medium leading-relaxed">Use fotos em alta resolução para transmitir luxo e sofisticação.</p>
                            <button 
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="px-6 py-3 bg-white border-2 border-slate-100 text-brand-dark font-bold rounded-2xl hover:border-brand-primary transition-all shadow-sm active:scale-95 flex items-center gap-2"
                            >
                              <Camera className="w-4 h-4" /> Alterar Foto
                            </button>
                            <input type="file" ref={fileInputRef} accept="image/*" capture="environment" onChange={handleImageCapture} className="hidden" />
                          </div>
                        </div>
                      </div>

                      {/* Video Section */}
                      <div className="space-y-4">
                        <label className="text-xs font-black text-brand-dark uppercase tracking-widest px-1">Vídeo de Apresentação</label>
                        <div className="flex gap-6 items-center">
                          <div 
                            className="w-40 h-40 rounded-[2.5rem] bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center overflow-hidden relative group cursor-pointer hover:border-brand-primary transition-all"
                            onClick={() => !isVideoUploading && videoInputRef.current?.click()}
                          >
                            {formData.video ? (
                              <div className="w-full h-full bg-brand-dark flex items-center justify-center">
                                <PlayCircle className="w-12 h-12 text-brand-primary" />
                                <div className="absolute inset-0 bg-brand-dark/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                                  <Edit2 className="w-8 h-8 text-white" />
                                </div>
                              </div>
                            ) : isVideoUploading ? (
                              <div className="flex flex-col items-center">
                                <div className="w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mb-3" />
                                <span className="text-[10px] font-black text-brand-primary uppercase">Subindo...</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center text-slate-400">
                                <Video className="w-10 h-10 mb-3" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-center px-4">Anexar Vídeo</span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 space-y-4">
                            <p className="text-sm text-slate-500 font-medium leading-relaxed">Vídeos curtos aumentam a confiança e conversão em até 80%.</p>
                            <button 
                              type="button"
                              disabled={isVideoUploading}
                              onClick={() => videoInputRef.current?.click()}
                              className="px-6 py-3 bg-white border-2 border-slate-100 text-brand-dark font-bold rounded-2xl hover:border-brand-primary transition-all shadow-sm active:scale-95 flex items-center gap-2 disabled:opacity-50"
                            >
                              <Video className="w-4 h-4" /> Escolher Vídeo
                            </button>
                            <input type="file" ref={videoInputRef} accept="video/*" onChange={handleVideoUpload} className="hidden" />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      <div className="space-y-2">
                        <label className="text-xs font-black text-brand-dark uppercase tracking-widest px-1">Nome do Produto</label>
                        <input 
                          type="text" 
                          required
                          value={formData.name}
                          onChange={e => setFormData({...formData, name: e.target.value})}
                          className="w-full px-6 py-4 rounded-2xl border-2 border-slate-50 bg-slate-50 focus:bg-white focus:border-brand-primary focus:outline-none transition-all font-bold text-brand-dark"
                          placeholder="Ex: Sérum Revitalizante 24k"
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-xs font-black text-brand-dark uppercase tracking-widest px-1">Preço (R$)</label>
                          <input 
                            type="number" 
                            step="0.01"
                            required
                            value={formData.price}
                            onChange={e => setFormData({...formData, price: e.target.value})}
                            className="w-full px-6 py-4 rounded-2xl border-2 border-slate-50 bg-slate-50 focus:bg-white focus:border-brand-primary focus:outline-none transition-all font-bold text-brand-dark"
                            placeholder="0,00"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-black text-brand-dark uppercase tracking-widest px-1">Estoque</label>
                          <input 
                            type="number" 
                            required
                            value={formData.stock}
                            onChange={e => setFormData({...formData, stock: e.target.value})}
                            className="w-full px-6 py-4 rounded-2xl border-2 border-slate-50 bg-slate-50 focus:bg-white focus:border-brand-primary focus:outline-none transition-all font-bold text-brand-dark"
                            placeholder="Qtd"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-xs font-black text-brand-dark uppercase tracking-widest">Descrição Persuasiva</label>
                        <button
                          type="button"
                          onClick={handleIAAnalysis}
                          className="flex items-center gap-2 bg-brand-dark text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-brand-primary transition-all active:scale-95"
                        >
                          <Sparkles className="w-3 h-3 text-brand-primary" /> Sugestão Gemini AI
                        </button>
                      </div>
                      <textarea 
                        rows={5}
                        value={formData.description}
                        onChange={e => setFormData({...formData, description: e.target.value})}
                        className="w-full px-6 py-4 rounded-3xl border-2 border-slate-50 bg-slate-50 focus:bg-white focus:border-brand-primary focus:outline-none transition-all font-medium text-slate-600 leading-relaxed"
                        placeholder="Descreva a experiência, benefícios e a alma do produto..."
                      />
                    </div>

                    <div className="flex justify-end gap-4 pt-10 border-t border-slate-100">
                      <button 
                        type="button" 
                        onClick={resetForm} 
                        className="px-10 py-5 font-bold text-slate-400 hover:text-brand-dark transition-colors"
                      >
                        Descartar Alterações
                      </button>
                      <button 
                        type="submit" 
                        disabled={isSaving}
                        className="px-12 py-5 bg-brand-dark text-white rounded-2xl font-black text-lg hover:bg-brand-primary transition-all shadow-2xl active:scale-95 disabled:opacity-50"
                      >
                        {isSaving ? 'Salvando...' : 'Publicar Produto'}
                      </button>
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
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                    <div>
                      <h2 className="text-3xl font-serif font-bold text-brand-dark">Catálogo de Itens</h2>
                      <p className="text-sm text-slate-400 font-medium">Gestão de estoque e apresentação</p>
                    </div>
                    <button 
                      onClick={() => setIsAdding(true)}
                      className="flex items-center gap-3 bg-brand-primary text-white px-8 py-4 rounded-2xl font-black hover:bg-brand-accent transition-all shadow-xl shadow-brand-primary/20 active:scale-95"
                    >
                      <Plus className="w-6 h-6" />
                      Novo Produto Luxo
                    </button>
                  </div>

                  {products.length === 0 ? (
                    <div className="bg-white rounded-[3rem] border border-slate-100 p-20 text-center premium-shadow">
                      <Package className="w-16 h-16 text-slate-200 mx-auto mb-6" />
                      <p className="text-slate-400 font-medium">Sua vitrine está vazia. Comece adicionando um produto!</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden premium-shadow">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                              <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Produto</th>
                              <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Preço</th>
                              <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estoque</th>
                              <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Gestão</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {products.map((product) => (
                              <tr key={product.id} className="hover:bg-slate-50/30 transition-colors group">
                                <td className="p-6">
                                  <div className="flex items-center gap-5">
                                    <div className="w-16 h-16 rounded-2xl overflow-hidden border border-slate-100 shadow-sm shrink-0 group-hover:scale-105 transition-transform">
                                      <img src={product.image} alt="" className="w-full h-full object-cover" />
                                    </div>
                                    <span className="font-serif font-bold text-lg text-brand-dark group-hover:text-brand-primary transition-colors">{product.name}</span>
                                  </div>
                                </td>
                                <td className="p-6 font-black text-slate-700">R$ {product.price.toFixed(2).replace('.', ',')}</td>
                                <td className="p-6">
                                  <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-xs font-black ${product.stock > 10 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                    {product.stock} un
                                  </span>
                                </td>
                                <td className="p-6 text-right">
                                  <div className="flex items-center justify-end gap-3">
                                    <button 
                                      onClick={() => handleEdit(product)} 
                                      className="p-3 text-slate-400 hover:text-brand-primary hover:bg-brand-primary/5 rounded-xl transition-all active:scale-90"
                                    >
                                      <Edit2 className="w-5 h-5" />
                                    </button>
                                    <button 
                                      onClick={() => handleDelete(product.id)} 
                                      className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all active:scale-90"
                                    >
                                      <Trash2 className="w-5 h-5" />
                                    </button>
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
          </div>
        )}
      </main>
    </div>
  );
}

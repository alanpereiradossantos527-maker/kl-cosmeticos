/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { ShoppingBag, MessageCircle, Star, Sparkles, Camera, Plus, Trash2, Edit2, Package, Settings, ArrowLeft, Image as ImageIcon, CheckCircle2, ShoppingCart, X, Minus, Lock, Key, Bell, BellRing } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from './supabase';

type Product = {
  id: string;
  name: string;
  price: number;
  stock: number;
  image: string;
  description: string;
  createdAt?: number;
};

type CartItem = Product & {
  quantity: number;
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

    // Subscribe to realtime changes
    const channel = supabase
      .channel('products_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => {
        fetchProducts(); // Re-fetch on any change
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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
    <div className="min-h-screen bg-rose-50 font-sans text-slate-800">
      {view === 'store' && (
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
          onOpenAdmin={() => {
            if (user && user.email === 'alanpereiradossantos527@gmail.com') {
              setView('admin');
            } else {
              setView('login');
            }
          }} 
        />
      )}
      {view === 'login' && (
        <LoginPanel onLogin={() => setView('admin')} onCancel={() => setView('store')} />
      )}
      {view === 'admin' && (
        <AdminPanel 
          products={products} 
          setProducts={setProducts} 
          whatsappNumber={whatsappNumber}
          setWhatsappNumber={setWhatsappNumber}
          onClose={() => setView('store')} 
        />
      )}
    </div>
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
      if (err.message === 'Invalid login credentials') {
        setError('Senha incorreta.');
      } else {
        setError('Erro ao fazer login. Verifique as configurações do Supabase.');
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
  whatsappNumber,
  onOpenAdmin 
}: { 
  products: Product[], 
  cart: CartItem[],
  isCartOpen: boolean,
  setIsCartOpen: (open: boolean) => void,
  addToCart: (p: Product) => void,
  removeFromCart: (id: string) => void,
  updateQuantity: (id: string, delta: number) => void,
  clearCart: () => void,
  whatsappNumber: string,
  onOpenAdmin: () => void 
}) {
  
  const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const cartItemCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [newProductToast, setNewProductToast] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null);
  const prevProductsLength = useRef(products.length);

  const showToast = (text: string, type: 'error' | 'success' = 'error') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationsEnabled(Notification.permission === 'granted');
    }

    // Check for new products since last visit
    const lastSeenCount = parseInt(localStorage.getItem('@kl-cosmeticos:last-seen-count') || '0', 10);
    if (products.length > lastSeenCount && lastSeenCount > 0) {
      const newCount = products.length - lastSeenCount;
      setNewProductToast(newCount === 1 ? products[products.length - 1].name : `${newCount} novos produtos chegaram!`);
      setTimeout(() => setNewProductToast(null), 5000);
    }
    localStorage.setItem('@kl-cosmeticos:last-seen-count', products.length.toString());
  }, []);

  useEffect(() => {
    if (products.length > prevProductsLength.current) {
      const newProduct = products[products.length - 1];
      
      setNewProductToast(newProduct.name);
      setTimeout(() => setNewProductToast(null), 5000);

      if (notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('Novo Produto na KL Cosméticos!', {
          body: `${newProduct.name} acabou de chegar. Confira!`,
        });
      }
      
      localStorage.setItem('@kl-cosmeticos:last-seen-count', products.length.toString());
    }
    prevProductsLength.current = products.length;
  }, [products, notificationsEnabled]);

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
            <button 
              onClick={handleEnableNotifications}
              className={`relative p-2 transition-colors rounded-full hover:bg-rose-50 ${notificationsEnabled ? 'text-rose-500' : 'text-slate-400 hover:text-rose-500'}`}
              title={notificationsEnabled ? "Notificações Ativadas" : "Ativar Notificações"}
            >
              {notificationsEnabled ? <BellRing className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
            </button>
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
            <button 
              onClick={onOpenAdmin}
              className="p-2 text-slate-400 hover:text-rose-500 transition-colors rounded-full hover:bg-rose-50"
              title="Painel de Controle"
            >
              <Settings className="w-5 h-5" />
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
        <div className="flex items-center justify-center gap-2 mb-10">
          <h3 className="text-3xl font-bold text-slate-900 text-center">Nossos Produtos</h3>
          <span className="text-2xl">💄</span>
        </div>

        {products.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>Nenhum produto cadastrado no momento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {products.map((product, index) => {
              const isOutOfStock = product.stock <= 0;
              const cartItem = cart.find(item => item.id === product.id);
              const isMaxQuantityInCart = cartItem ? cartItem.quantity >= product.stock : false;
              
              return (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  className={`bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-rose-100 flex flex-col relative ${isOutOfStock ? 'opacity-75 grayscale-[0.5]' : ''}`}
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
                      onClick={() => addToCart(product)}
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
  onClose 
}: { 
  products: Product[], 
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>, 
  whatsappNumber: string,
  setWhatsappNumber: React.Dispatch<React.SetStateAction<string>>,
  onClose: () => void 
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    stock: '',
    description: '',
    image: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalStock = products.reduce((acc, p) => acc + p.stock, 0);
  const totalValue = products.reduce((acc, p) => acc + (p.price * p.stock), 0);

  const showToast = (text: string, type: 'error' | 'success' = 'error') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const resetForm = () => {
    setFormData({ name: '', price: '', stock: '', description: '', image: '' });
    setEditingId(null);
    setIsAdding(false);
    setIsSaving(false);
  };

  const handleEdit = (product: Product) => {
    setFormData({
      name: product.name,
      price: product.price.toString(),
      stock: product.stock.toString(),
      description: product.description,
      image: product.image
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
        image: formData.image
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

      {/* Delete Confirmation Modal */}
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

      {/* Admin Header */}
      <header className="bg-slate-900 text-white shadow-md sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-2 -ml-2 hover:bg-slate-800 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Settings className="w-5 h-5 text-rose-400" />
              Gestão da Loja
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <a href="#" onClick={handleLogout} className="text-sm font-medium text-rose-400 hover:text-rose-300">
              Sair
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        
        {/* Dashboard Stats */}
        {!isAdding && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
              <p className="text-sm text-slate-500 font-medium mb-1">Total de Produtos</p>
              <p className="text-2xl font-bold text-slate-900">{products.length}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
              <p className="text-sm text-slate-500 font-medium mb-1">Itens em Estoque</p>
              <p className="text-2xl font-bold text-slate-900">{totalStock}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 col-span-2 md:col-span-2">
              <p className="text-sm text-slate-500 font-medium mb-1">Valor em Estoque</p>
              <p className="text-2xl font-bold text-emerald-600">R$ {totalValue.toFixed(2).replace('.', ',')}</p>
            </div>
          </div>
        )}

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
                {/* Photo Upload / Capture */}
                <div>
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
                        Tire uma foto do produto agora mesmo usando a câmera do seu celular ou escolha da galeria.
                      </p>
                      <div className="flex gap-2">
                        <button 
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center gap-2 bg-rose-100 text-rose-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-rose-200 transition-colors"
                        >
                          <Camera className="w-4 h-4" />
                          Câmera / Galeria
                        </button>
                      </div>
                      {/* Hidden file input with capture attribute for mobile cameras */}
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Nome do Produto</label>
                    <input 
                      type="text" 
                      required
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                      placeholder="Ex: Sérum Facial Vitamina C"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Preço (R$)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        min="0"
                        required
                        value={formData.price}
                        onChange={e => setFormData({...formData, price: e.target.value})}
                        className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Estoque</label>
                      <input 
                        type="number" 
                        min="0"
                        required
                        value={formData.stock}
                        onChange={e => setFormData({...formData, stock: e.target.value})}
                        className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                        placeholder="Qtd"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Descrição Curta</label>
                  <textarea 
                    rows={3}
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent resize-none"
                    placeholder="Descreva os benefícios do produto..."
                  />
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                  <button 
                    type="button"
                    onClick={resetForm}
                    disabled={isSaving}
                    className="px-6 py-3 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={isSaving}
                    className="flex items-center gap-2 bg-slate-900 text-white px-8 py-3 rounded-xl font-medium hover:bg-slate-800 transition-colors shadow-md disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    {isSaving ? 'Salvando...' : 'Salvar Produto'}
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
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-800">Seus Produtos</h2>
                <button 
                  onClick={() => setIsAdding(true)}
                  className="flex items-center gap-2 bg-rose-500 text-white px-4 py-2 rounded-xl font-medium hover:bg-rose-600 transition-colors shadow-sm"
                >
                  <Plus className="w-5 h-5" />
                  <span className="hidden sm:inline">Adicionar Produto</span>
                  <span className="sm:hidden">Novo</span>
                </button>
              </div>

              {products.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center">
                  <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-slate-700 mb-2">Nenhum produto cadastrado</h3>
                  <p className="text-slate-500 mb-6">Comece a montar seu catálogo agora mesmo.</p>
                  <button 
                    onClick={() => setIsAdding(true)}
                    className="inline-flex items-center gap-2 bg-rose-100 text-rose-700 px-6 py-3 rounded-xl font-medium hover:bg-rose-200 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                    Cadastrar Primeiro Produto
                  </button>
                </div>
              ) : (
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-sm font-semibold text-slate-600">
                          <th className="p-4 whitespace-nowrap">Produto</th>
                          <th className="p-4 whitespace-nowrap">Preço</th>
                          <th className="p-4 whitespace-nowrap">Estoque</th>
                          <th className="p-4 whitespace-nowrap text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {products.map((product) => (
                          <tr key={product.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <img src={product.image} alt="" className="w-12 h-12 rounded-lg object-cover border border-slate-200" />
                                <div>
                                  <p className="font-semibold text-slate-900 line-clamp-1">{product.name}</p>
                                  <p className="text-xs text-slate-500 line-clamp-1 w-48 sm:w-auto">{product.description}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 font-medium text-slate-900 whitespace-nowrap">
                              R$ {product.price.toFixed(2).replace('.', ',')}
                            </td>
                            <td className="p-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                product.stock > 10 ? 'bg-emerald-100 text-emerald-800' : 
                                product.stock > 0 ? 'bg-amber-100 text-amber-800' : 
                                'bg-red-100 text-red-800'
                              }`}>
                                {product.stock} un
                              </span>
                            </td>
                            <td className="p-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-2">
                                <button 
                                  onClick={() => handleEdit(product)}
                                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Editar"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => handleDelete(product.id)}
                                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Excluir"
                                >
                                  <Trash2 className="w-4 h-4" />
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

        {/* Settings Section */}
        {!isAdding && (
          <div className="mt-8 bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden p-6">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <MessageCircle className="w-6 h-6 text-emerald-500" />
              Configurações do WhatsApp
            </h2>
            <p className="text-slate-500 mb-6 text-sm">
              Defina o número de WhatsApp que receberá os pedidos da loja. Use o formato internacional (ex: 5511999999999).
            </p>
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1 w-full">
                <label className="block text-sm font-medium text-slate-700 mb-1">Número do WhatsApp</label>
                <input 
                  type="text" 
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="Ex: 5511999999999"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-emerald-200 transition-all"
                />
              </div>
              <button 
                onClick={handleSaveWhatsapp}
                className="w-full sm:w-auto px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-colors shadow-sm"
              >
                Salvar Número
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

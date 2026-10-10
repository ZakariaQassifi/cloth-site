import { useCallback, useEffect, useMemo, useState } from 'react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { CategorySection } from './components/CategorySection';
import { EditorialSection } from './components/EditorialSection';
import { ProductDetailPage } from './components/ProductDetailPage';
import { CartDrawer } from './components/CartDrawer';
import { CheckoutPage } from './components/CheckoutPage';
import { OrderConfirmationPage } from './components/OrderConfirmationPage';
import { WishlistPage } from './components/WishlistPage';
import { ContactPage } from './components/ContactPage';
import { Footer } from './components/Footer';
import { AdminLayout } from './admin/AdminLayout';
import { useCart } from './context/useCart';
import { useCatalog } from './context/useCatalog';
import { useWishlist } from './context/useWishlist';
import { useTranslation } from './i18n/useI18n';
import type { Product } from './data/products';
import type { Order } from './data/order';
import { buildPath, navigate, navigateToHome, slugifyCategory, useRoute, type Route } from './routing/routes';
import { Container } from './components/Container';
import { Button } from './components/Button';
import { CatalogProducts } from './components/CatalogProducts';

export function App() {
  const { t } = useTranslation();
  const route = useRoute();
  const { products, categories, findCategory, loadProducts } = useCatalog();
  const { lines, itemCount, subtotal, shipping, addItem, updateQuantity, removeItem, clearCart } = useCart();
  const {
    entries: wishlistEntries,
    count: wishlistCount,
    remove: removeFromWishlist,
    clear: clearWishlist,
  } = useWishlist();

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [latestOrder, setLatestOrder] = useState<Order | null>(null);

  const isAdminRoute = route.name === 'admin' || route.name === 'admin-login';
  /**
   * Resolve the category in the URL against the real category list so
   * `/category/t-shirts` and `/category/T-Shirts` both select "T-Shirts".
   */
  const collectionCategory = useMemo(() => {
    if (route.name !== 'category') return 'All';
    const wanted = slugifyCategory(route.category);
    const match = categories.find((category) => slugifyCategory(category.name) === wanted);
    return match?.name ?? route.category;
  }, [route, categories]);

  const specialFilter: 'all' | 'new' | 'sale' =
    route.name === 'sale' ? 'sale' : route.name === 'new' ? 'new' : 'all';
  const isHomeView = route.name === 'home';

  // Derived from the URL so a product page is linkable and Back always works.
  const selectedProduct: Product | null =
    route.name === 'product' ? products.find((product) => product.id === route.productId) ?? null : null;

  useEffect(() => {
    const query =
      collectionCategory !== 'All'
        ? { category: collectionCategory }
        : specialFilter === 'sale'
          ? { sale: true }
          : specialFilter === 'new'
            ? { sort: 'newest' }
            : {};
    void loadProducts(query);
  }, [collectionCategory, specialFilter, loadProducts]);

  const goToCollection = useCallback((category: string) => {
    navigate(category && category !== 'All' ? buildPath({ name: 'category', category }) : '/');
  }, []);

  const goToSpecial = useCallback((filter: 'sale' | 'new' | 'all') => {
    if (filter === 'sale') navigate('/sale');
    else if (filter === 'new') navigate('/new-arrivals');
    else navigate('/');
  }, []);

  const openProduct = useCallback((product: Product) => {
    navigate(buildPath({ name: 'product', productId: product.id }));
  }, []);

  const handleAddToCart = useCallback(
    (product: Product, quantity: number, color: string, size: string) => {
      addItem(product, quantity, color, size);
      setIsCartOpen(true);
    },
    [addItem]
  );

  const handleBuyNow = useCallback(
    (product: Product, quantity: number, color: string, size: string) => {
      addItem(product, quantity, color, size);
      navigate('/checkout');
    },
    [addItem]
  );

  const handleOrderSuccess = useCallback(
    (order: Order) => {
      setLatestOrder(order);
      clearCart();
      navigate('/order-confirmation');
    },
    [clearCart]
  );

  const returnToStore = useCallback(() => navigate('/'), []);

  /**
   * Hero callouts name a gendered collection. Resolve it against the real
   * category list so the buttons always land on a populated page.
   */
  const heroTarget = useMemo(() => {
    const byName = (name: string) => findCategory(name)?.name;
    return {
      men: byName('Men') ?? byName('Male') ?? categories[0]?.name ?? 'All',
      women: byName('Women') ?? byName('Female') ?? categories[1]?.name ?? categories[0]?.name ?? 'All',
    };
  }, [categories, findCategory]);

  const categoryNames = useMemo(() => categories.map((category) => category.name), [categories]);

  if (isAdminRoute) {
    return (
      <AdminLayout
        onReturnToStore={returnToStore}
        loginMode={route.name === 'admin-login'}
      />
    );
  }

  const isProductView = selectedProduct !== null;

  return (
    <>
      <Header
        cartCount={itemCount}
        wishlistCount={wishlistCount}
        onCartClick={() => setIsCartOpen(true)}
        onWishlistClick={() => navigate('/wishlist')}
        onSelectCategory={goToCollection}
        onSelectSpecialFilter={goToSpecial}
        onContactClick={() => navigate('/contact')}
      />
      <main>
        {route.name === 'order-confirmation' && latestOrder ? (
          <OrderConfirmationPage
            order={latestOrder}
            onContinueShopping={() => {
              setLatestOrder(null);
              navigate('/');
            }}
          />
        ) : route.name === 'order-confirmation' ? (
          // Reached by refreshing or bookmarking the confirmation URL, when no
          // order is held in memory. Falling through to the collection branch
          // used to render the whole product grid here, which looked like a
          // successful order page full of unrelated products.
          <section className="order-missing">
            <Container maxWidth="md">
              <h1>{t('confirm.missingTitle')}</h1>
              <p>{t('confirm.missingBody')}</p>
              <Button variant="primary" onClick={() => navigate('/')}>
                {t('confirm.continueShopping')}
              </Button>
            </Container>
          </section>
        ) : route.name === 'checkout' ? (
          <CheckoutPage
            lines={lines}
            onBack={() => navigate(isHomeView ? '/' : buildPath(routeOfCollection(collectionCategory, specialFilter)))}
            onOrderSuccess={handleOrderSuccess}
          />
        ) : route.name === 'wishlist' ? (
          <WishlistPage
            entries={wishlistEntries}
            products={products}
            onRemove={removeFromWishlist}
            onClear={clearWishlist}
            onAddToCart={handleAddToCart}
            onSelectProduct={openProduct}
          />
        ) : route.name === 'contact' ? (
          <ContactPage />
        ) : isProductView && selectedProduct ? (
          <ProductDetailPage
            key={selectedProduct.id}
            product={selectedProduct}
            onBack={() => navigate(isHomeView ? '/' : buildPath(routeOfCollection(collectionCategory, specialFilter)))}
            onAddToCart={handleAddToCart}
            onBuyNow={handleBuyNow}
          />
        ) : route.name === 'not-found' ? (
          <div style={{ padding: '5rem 0', textAlign: 'center' }}>
            <Container maxWidth="sm">
              <p
                style={{
                  fontSize: '3.5rem',
                  fontWeight: 800,
                  lineHeight: 1,
                  marginBottom: '0.75rem',
                  color: 'var(--text-primary)',
                }}
              >
                404
              </p>
              <h1
                style={{
                  fontSize: '1.75rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '0.75rem',
                }}
              >
                {t('notFound.title')}
              </h1>
              <p
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: '1rem',
                  maxWidth: '480px',
                  margin: '0 auto 2rem',
                }}
              >
                {t('notFound.body')}
              </p>
              <button
                type="button"
                className="btn btn--primary"
                onClick={navigateToHome}
              >
                {t('notFound.action')}
              </button>
            </Container>
          </div>
        ) : isHomeView ? (
          <>
            <Hero
              onShopMen={() => goToCollection(heroTarget.men)}
              onShopWomen={() => goToCollection(heroTarget.women)}
            />
            <CategorySection onSelectCategory={goToCollection} />
            <CatalogProducts
              products={products}
              title={t('home.collectionProducts')}
              subtitle={t('home.collectionProductsSubtitle')}
              category={collectionCategory}
              saleOnly={specialFilter === 'sale'}
              categoryOptions={categoryNames}
              onSelectProduct={openProduct}
            />
            <EditorialSection onExplore={() => goToSpecial('new')} />
          </>
        ) : (
          <div style={{ padding: '2rem 0' }}>
            <Container maxWidth="lg">
              <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
                <h1 style={{ fontSize: '2.5rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                  {specialFilter === 'sale'
                    ? t('home.saleCollection')
                    : specialFilter === 'new'
                      ? t('home.newArrivals')
                      : collectionCategory}
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: '600px', margin: '0 auto' }}>
                  {specialFilter === 'sale'
                    ? t('home.saleCollectionSubtitle')
                    : specialFilter === 'new'
                      ? t('home.newArrivalsSubtitle')
                      : t('home.discoverCollection', { category: collectionCategory })}
                </p>
              </div>
              <CatalogProducts
                products={products}
                title={
                  specialFilter === 'sale'
                    ? t('home.saleTitle')
                    : specialFilter === 'new'
                      ? t('home.newTitle')
                      : t('home.collectionProducts')
                }
                subtitle={t('home.collectionProductsSubtitle')}
                category={collectionCategory}
                saleOnly={specialFilter === 'sale'}
                categoryOptions={categoryNames}
                onSelectProduct={openProduct}
              />
            </Container>
          </div>
        )}
      </main>

      <Footer />

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        lines={lines}
        subtotal={subtotal}
        shipping={shipping}
        onUpdateQuantity={updateQuantity}
        onRemoveItem={removeItem}
        onCheckout={() => {
          setIsCartOpen(false);
          navigate('/checkout');
        }}
      />
    </>
  );
}

/** Rebuild the collection route the user was browsing before opening a sub-view. */
function routeOfCollection(category: string, specialFilter: 'all' | 'new' | 'sale'): Route {
  if (specialFilter === 'sale') return { name: 'sale' };
  if (specialFilter === 'new') return { name: 'new' };
  if (category && category !== 'All') return { name: 'category', category };
  return { name: 'home' };
}

export default App;
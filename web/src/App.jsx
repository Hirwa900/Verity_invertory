import { Component, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoadingSpinner from './components/LoadingSpinner';
import { useAuth } from './context/AuthContext';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const AddProductPage = lazy(() => import('./pages/AddProductPage'));
const AddCategoryPage = lazy(() => import('./pages/AddCategoryPage'));
const NewPurchasePage = lazy(() => import('./pages/NewPurchasePage'));
const NewSalePage = lazy(() => import('./pages/NewSalePage'));
const AddExpensePage = lazy(() => import('./pages/AddExpensePage'));
const StockAdjustmentPage = lazy(() => import('./pages/StockAdjustmentPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const ProductsPage = lazy(() => import('./pages/ProductsPage'));
const SalesHistoryPage = lazy(() => import('./pages/SalesHistoryPage'));
const PurchasesHistoryPage = lazy(() => import('./pages/PurchasesHistoryPage'));
const StockPage = lazy(() => import('./pages/StockPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));

function homeForRole(role) {
  return role === 'admin' ? '/dashboard' : '/new-sale';
}

function PrivateRoute({ children, allowedRoles = ['admin'] }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user || !user.isActive || !['admin', 'seller'].includes(user.role)) {
    return <Navigate to="/login" replace />;
  }
  return allowedRoles.includes(user.role)
    ? children
    : <Navigate to={homeForRole(user.role)} replace />;
}

class ChunkErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="form-error-box">
          <p>Unable to load this page.</p>
          <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <>
      <LoadingSpinner />
      <ChunkErrorBoundary>
        <Suspense
          fallback={(
            <div className="route-loader">
              <div className="route-spinner" />
            </div>
          )}
        >
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
            <Route path="/add-product" element={<PrivateRoute><AddProductPage /></PrivateRoute>} />
            <Route path="/add-category" element={<PrivateRoute><AddCategoryPage /></PrivateRoute>} />
            <Route path="/new-purchase" element={<PrivateRoute><NewPurchasePage /></PrivateRoute>} />
            <Route path="/new-sale" element={<PrivateRoute allowedRoles={['admin', 'seller']}><NewSalePage /></PrivateRoute>} />
            <Route path="/add-expense" element={<PrivateRoute><AddExpensePage /></PrivateRoute>} />
            <Route path="/stock-adjustment" element={<PrivateRoute><StockAdjustmentPage /></PrivateRoute>} />
            <Route path="/reports" element={<PrivateRoute><ReportsPage /></PrivateRoute>} />
            <Route path="/products" element={<PrivateRoute allowedRoles={['admin', 'seller']}><ProductsPage /></PrivateRoute>} />
            <Route path="/sales" element={<PrivateRoute allowedRoles={['admin', 'seller']}><SalesHistoryPage /></PrivateRoute>} />
            <Route path="/purchases" element={<PrivateRoute><PurchasesHistoryPage /></PrivateRoute>} />
            <Route path="/stock" element={<PrivateRoute allowedRoles={['admin', 'seller']}><StockPage /></PrivateRoute>} />
            <Route path="/users" element={<PrivateRoute><UsersPage /></PrivateRoute>} />
            <Route path="*" element={<RedirectHome />} />
          </Routes>
        </Suspense>
      </ChunkErrorBoundary>
    </>
  );
}

function RedirectHome() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to={homeForRole(user.role)} replace /> : <Navigate to="/login" replace />;
}

export default App;

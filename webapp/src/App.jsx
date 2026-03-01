import React, { Suspense, lazy } from 'react';
import { createBrowserRouter, RouterProvider, Route, Navigate, createRoutesFromElements, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PatientProvider, usePatient } from './context/PatientContext';
import { ToastProvider } from './components/Toast';
import { LanguageProvider, useTranslation } from './i18n/LanguageContext';
import ErrorBoundary from './components/ErrorBoundary';
import AppLayout from './layouts/AppLayout';

// Lazy-loaded pages for better bundle splitting
const Login = lazy(() => import('./pages/Login'));
const Home = lazy(() => import('./pages/Home'));
const Admission = lazy(() => import('./pages/Admission'));
const Diagnosis = lazy(() => import('./pages/Diagnosis'));
const Treatment = lazy(() => import('./pages/Treatment'));
const Calculator = lazy(() => import('./pages/Calculator'));
const Review = lazy(() => import('./pages/Review'));
const ReEvaluation = lazy(() => import('./pages/ReEvaluation'));
const Profile = lazy(() => import('./pages/Profile'));
const Consult = lazy(() => import('./pages/Consult'));
const ConsultDetail = lazy(() => import('./pages/ConsultDetail'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Dashboard = lazy(() => import('./pages/Dashboard'));

// Loading fallback
const PageLoader = () => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: '200px', color: 'var(--color-text-muted)',
  }}>
    <div className="spinner" />
  </div>
);

// Chặn người lạ tự ý gõ URL vào bên trong
const PrivateRoute = ({ children }) => {
  const { currentUser } = useAuth();
  return currentUser ? children : <Navigate to="/login" replace />;
};

// Nếu đã đăng nhập → vào thẳng trang chủ (bắt trường hợp Google redirect)
const PublicRoute = ({ children }) => {
  const { currentUser } = useAuth();
  return currentUser ? <Navigate to="/" replace /> : children;
};

// Khi đã lưu xong → reset patient context rồi mới navigate, tránh trigger "Leave site?"
const FollowupPage = () => {
  const { resetPatient } = usePatient();
  const navigate = useNavigate();
  const { t } = useTranslation();
  return (
    <div className="card" style={{ borderColor: 'var(--color-warning)' }}>
      <h2>{t('followup.title')}</h2>
      <p>{t('followup.message')}</p>
      <br />
      <button className="btn btn-primary" onClick={() => { resetPatient(); navigate('/'); }}>
        {t('followup.backHome')}
      </button>
    </div>
  );
};

const SuspenseWrapper = ({ children }) => (
  <Suspense fallback={<PageLoader />}>{children}</Suspense>
);

const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route path="/login" element={<PublicRoute><SuspenseWrapper><Login /></SuspenseWrapper></PublicRoute>} />

      {/* Các route bên trong AppLayout sẽ bị chặn nếu chưa đăng nhập */}
      <Route path="/" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
        <Route index element={<SuspenseWrapper><Home /></SuspenseWrapper>} />
        <Route path="admission" element={<SuspenseWrapper><Admission /></SuspenseWrapper>} />
        <Route path="diagnosis" element={<SuspenseWrapper><Diagnosis /></SuspenseWrapper>} />
        <Route path="treatment" element={<SuspenseWrapper><Treatment /></SuspenseWrapper>} />
        <Route path="calculator" element={<SuspenseWrapper><Calculator /></SuspenseWrapper>} />
        <Route path="review" element={<SuspenseWrapper><Review /></SuspenseWrapper>} />
        <Route path="reevaluation/:id" element={<SuspenseWrapper><ReEvaluation /></SuspenseWrapper>} />
        <Route path="profile" element={<SuspenseWrapper><Profile /></SuspenseWrapper>} />
        <Route path="consult" element={<SuspenseWrapper><Consult /></SuspenseWrapper>} />
        <Route path="consult/:id" element={<SuspenseWrapper><ConsultDetail /></SuspenseWrapper>} />
        <Route path="notifications" element={<SuspenseWrapper><Notifications /></SuspenseWrapper>} />
        <Route path="dashboard" element={<SuspenseWrapper><Dashboard /></SuspenseWrapper>} />
        {/* Fallback component for followups */}
        <Route path="followup" element={<FollowupPage />} />
      </Route>
    </>
  )
);

function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <AuthProvider>
          <PatientProvider>
            <ToastProvider>
              <RouterProvider router={router} />
            </ToastProvider>
          </PatientProvider>
        </AuthProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}

export default App;

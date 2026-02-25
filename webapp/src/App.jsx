import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PatientProvider } from './context/PatientContext';
import AppLayout from './layouts/AppLayout';

import Login from './pages/Login';
import Home from './pages/Home';
import Admission from './pages/Admission';
import Diagnosis from './pages/Diagnosis';
import Treatment from './pages/Treatment';
import Calculator from './pages/Calculator';
import Review from './pages/Review';
import ReEvaluation from './pages/ReEvaluation';

// Component bảo vệ (chặn người lạ tự ý gõ URL truy cập vào bên trong)
const PrivateRoute = ({ children }) => {
  const { currentUser } = useAuth();
  return currentUser ? children : <Navigate to="/login" replace />;
};

function App() {
  return (
    <AuthProvider>
      <PatientProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />

            {/* Các route bên trong AppLayout sẽ bị chặn nếu chưa đăng nhập */}
            <Route path="/" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
              <Route index element={<Home />} />
              <Route path="admission" element={<Admission />} />
              <Route path="diagnosis" element={<Diagnosis />} />
              <Route path="treatment" element={<Treatment />} />
              <Route path="calculator" element={<Calculator />} />
              <Route path="review" element={<Review />} />
              <Route path="reevaluation/:id" element={<ReEvaluation />} />
              {/* Fallback component for followups */}
              <Route path="followup" element={
                <div className="card" style={{ borderColor: 'var(--color-warning)' }}>
                  <h2>Theo Dõi Lâm Sàng</h2>
                  <p>Hệ thống đã lưu lại danh sách các ca bệnh cần phân loại THEO DÕI. Xin vui lòng làm lại xét nghiệm sau 12-24h.</p>
                  <br /><button className="btn btn-primary" onClick={() => window.location.href = '/'}>Trở lại trang chủ</button>
                </div>
              } />
            </Route>
          </Routes>
        </BrowserRouter>
      </PatientProvider>
    </AuthProvider>
  );
}

export default App;

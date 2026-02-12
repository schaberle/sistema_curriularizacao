import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { StudentFormPage } from './pages/StudentFormPage';
import { StudentPreferencesPage } from './pages/StudentPreferencesPage';
import { StudentResultPage } from './pages/StudentResultPage';
import { OrganizerDashboard } from './pages/OrganizerDashboard';

/**
 * App - Componente raiz com routing
 */
function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Públicas */}
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Alunos */}
          <Route path="/student/form/:distributionId" element={<StudentFormPage />} />
          <Route path="/student/:studentId/preferences/:distributionId" element={<StudentPreferencesPage />} />
          <Route path="/student/result/:distributionId" element={<StudentResultPage />} />

          {/* Organizadores */}
          <Route path="/organizer" element={<OrganizerDashboard />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;

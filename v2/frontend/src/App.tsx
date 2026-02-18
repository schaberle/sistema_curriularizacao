import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { OrganizerLayout } from './components/organizer/layout/OrganizerLayout';
import { ToastContainer } from './components/common/Toast';
import { AuthProvider } from './context/AuthContext';
import { DistributionProvider } from './context/DistributionContext';
import { ToastProvider } from './context/ToastContext';
import { AffinityInputPage } from './pages/AffinityInputPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { StudentFormPage } from './pages/StudentFormPage';
import { StudentPreferencesPage } from './pages/StudentPreferencesPage';
import { StudentResultPage } from './pages/StudentResultPage';
import { WizardGuard } from './components/organizer/guards/WizardGuard';
import { LegacyOrganizerRedirect } from './pages/organizer/LegacyOrganizerRedirect';
import { LegacyPhase2Page } from './pages/organizer/LegacyPhase2Page';
import { DistributionOverviewPage } from './pages/organizer/DistributionOverviewPage';
import { OrganizerListPage } from './pages/organizer/OrganizerListPage';
import { Step1_ThemeConfigPage } from './pages/organizer/Step1_ThemeConfigPage';
import { Step2_DataCollectionPage } from './pages/organizer/Step2_DataCollectionPage';
import { Step3_Phase1ConfigPage } from './pages/organizer/Step3_Phase1ConfigPage';
import { Step4_Phase1ExecutionPage } from './pages/organizer/Step4_Phase1ExecutionPage';
import { Step5_Phase1ResultsPage } from './pages/organizer/Step5_Phase1ResultsPage';
import { Step6_AffinitiesCollectionPage } from './pages/organizer/Step6_AffinitiesCollectionPage';
import { Step7_Phase2ConfigPage } from './pages/organizer/Step7_Phase2ConfigPage';
import { Step8_Phase2ExecutionPage } from './pages/organizer/Step8_Phase2ExecutionPage';
import { Step9_FinalResultsPage } from './pages/organizer/Step9_FinalResultsPage';

/**
 * App - Componente raiz com routing
 */
function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <DistributionProvider>
          <Router>
            <Routes>
              {/* Publicas */}
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />

              {/* Alunos */}
              <Route path="/student/form/:distributionId" element={<StudentFormPage />} />
              <Route path="/student/:studentId/preferences/:distributionId" element={<StudentPreferencesPage />} />
              <Route path="/student/:studentId/affinities/:distributionId" element={<AffinityInputPage />} />
              <Route path="/student/result/:distributionId" element={<StudentResultPage />} />

              {/* Organizadores */}
              <Route path="/organizer" element={<OrganizerLayout />}>
                <Route index element={<OrganizerListPage />} />

                {/* Gateway de rotas legadas */}
                <Route path=":distributionId/themes" element={<LegacyOrganizerRedirect />} />
                <Route path=":distributionId/execute" element={<LegacyOrganizerRedirect />} />
                <Route path=":distributionId/results" element={<LegacyOrganizerRedirect />} />
                <Route path=":distributionId/simulation" element={<Navigate to="../step5-phase1-results" replace />} />
                <Route path=":distributionId/:tab" element={<LegacyOrganizerRedirect />} />

                <Route element={<WizardGuard />}>
                  <Route path=":distributionId" element={<DistributionOverviewPage />} />
                  <Route path=":distributionId/step1-themes" element={<Step1_ThemeConfigPage />} />
                  <Route path=":distributionId/step2-data" element={<Step2_DataCollectionPage />} />
                  <Route path=":distributionId/step3-phase1-config" element={<Step3_Phase1ConfigPage />} />
                  <Route path=":distributionId/step4-phase1-execute" element={<Step4_Phase1ExecutionPage />} />
                  <Route path=":distributionId/step5-phase1-results" element={<Step5_Phase1ResultsPage />} />
                  <Route path=":distributionId/step6-affinities" element={<Step6_AffinitiesCollectionPage />} />
                  <Route path=":distributionId/step7-phase2-config" element={<Step7_Phase2ConfigPage />} />
                  <Route path=":distributionId/step8-phase2-execute" element={<Step8_Phase2ExecutionPage />} />
                  <Route path=":distributionId/step9-final-results" element={<Step9_FinalResultsPage />} />

                  {/* aliases legados */}
                  <Route path=":distributionId/phase2" element={<Navigate to="../step6-affinities" replace />} />
                  <Route path=":distributionId/final-results" element={<Navigate to="../step9-final-results" replace />} />

                  {/* fallback legado temporario preservado */}
                  <Route path=":distributionId/legacy-phase2" element={<LegacyPhase2Page />} />
                </Route>
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>

            <ToastContainer />
          </Router>
        </DistributionProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;


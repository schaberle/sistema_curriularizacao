/**
 * OrganizerLayout Component
 * Main layout wrapper for organizer wizard flow
 */

import React from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Button } from '../../common/Button';
import { ProgressStepper } from './ProgressStepper';
import { useDistribution } from '../../../hooks/useDistribution';
import { ORGANIZER_STEPS } from '../../../utils/distributionFlow';

export function OrganizerLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { distributionId } = useParams<{ distributionId?: string }>();
  const { currentDistribution } = useDistribution();

  const isListPage = location.pathname === '/organizer';
  const isStepPage = location.pathname.includes('/step');
  const isHubPage = Boolean(distributionId) && !isStepPage;

  const currentStep = ORGANIZER_STEPS.find((step) => location.pathname.includes(step.path));
  const currentStepId = currentStep?.id;
  const showPhase1Warning =
    Boolean(currentDistribution?.phase1NeedsRerun) && (currentStepId === 4 || currentStepId === 5);
  const showPhase2Warning =
    Boolean(currentDistribution?.phase2NeedsRerun) && (currentStepId === 8 || currentStepId === 9);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#eef4ff_0%,#f8fafc_45%,#f8fafc_100%)]">
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Distribuicao de Grupos</h1>
            <p className="mt-1 text-sm text-slate-600">Fluxo guiado completo da Fase 1 ate o resultado final.</p>
          </div>

          {isStepPage && distributionId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/organizer/${distributionId}`)}
              icon={<ChevronLeft className="h-4 w-4" />}
            >
              Voltar ao painel
            </Button>
          )}

          {isHubPage && (
            <Button variant="outline" size="sm" onClick={() => navigate('/organizer')} icon={<ChevronLeft className="h-4 w-4" />}>
              Voltar a lista
            </Button>
          )}
        </div>
      </header>

      {isStepPage && (
        <section className="border-b border-slate-200/80 bg-white/70">
          <div className="mx-auto max-w-7xl space-y-3 px-4 py-5 sm:px-6 lg:px-8">
            <ProgressStepper />

            {showPhase1Warning && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                Alteracao nao executada. Reexecute a Fase 1.
              </div>
            )}

            {showPhase2Warning && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                Alteracao nao executada. Reexecute a Fase 2.
              </div>
            )}
          </div>
        </section>
      )}

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}

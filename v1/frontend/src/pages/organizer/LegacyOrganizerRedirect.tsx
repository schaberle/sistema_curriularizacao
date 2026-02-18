import { Navigate, useLocation, useParams } from 'react-router-dom';

export function LegacyOrganizerRedirect() {
  const { distributionId, tab } = useParams<{ distributionId?: string; tab?: string }>();
  const location = useLocation();

  if (!distributionId) {
    return <Navigate to="/organizer" replace />;
  }

  const resolvedTab = tab ?? location.pathname.split('/').filter(Boolean).at(-1);

  switch (resolvedTab) {
    case 'themes':
      return <Navigate to={`/organizer/${distributionId}/step1-themes`} replace />;
    case 'execute':
      return <Navigate to={`/organizer/${distributionId}/step2-data`} replace />;
    case 'results':
      return <Navigate to={`/organizer/${distributionId}/step5-phase1-results`} replace />;
    case 'phase2':
      return <Navigate to={`/organizer/${distributionId}/step6-affinities`} replace />;
    case 'final-results':
      return <Navigate to={`/organizer/${distributionId}/step9-final-results`} replace />;
    default:
      return <Navigate to={`/organizer/${distributionId}/step1-themes`} replace />;
  }
}

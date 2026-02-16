// @ts-nocheck
const express_1 = require("express");
const domain_1 = require("../domain");
// ...
const DistributionEngine_1 = require("../services/optimization/DistributionEngine");
const AffinityMatrix_1 = require("../domain/AffinityMatrix");
const SeedService_1 = require("../services/database/SeedService");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validation_middleware_1 = require("../middleware/validation.middleware");
const error_middleware_1 = require("../middleware/error.middleware");
/**
 * Organizer Routes - Rotas de Organizador
 *
 * Requer autenticaÃ§Ã£o via JWT
 *
 * POST /api/organizer/distributions - Cria nova distribuiÃ§Ã£o
 * POST /api/organizer/distributions/:distributionId/themes - Upload de temas
 * POST /api/organizer/distributions/:distributionId/execute - Executa distribuiÃ§Ã£o (legado, chama Fase 1)
 * POST /api/organizer/distributions/:distributionId/execute-phase1 - Executa Fase 1 (formaÃ§Ã£o inicial)
 * POST /api/organizer/distributions/:distributionId/execute-phase2 - Executa Fase 2 (otimizaÃ§Ã£o social)
 * PUT /api/organizer/distributions/:distributionId/social-config - Configura Fase 2
 * GET /api/organizer/distributions/:distributionId/results - Resultados
 * GET /api/organizer/distributions/:distributionId/social-metrics - MÃ©tricas sociais (Fase 2)
 */
export function createOrganizerRoutes(database, authService) {
    const router = (0, express_1.Router)();
    const authMiddleware = (0, auth_middleware_1.createAuthMiddleware)(authService);
    const PHASE1_COMPLETED_STATUSES = new Set([
        'COMPLETED',
        'PARTIAL',
        'PHASE2',
        'PHASE2_EXECUTING',
        'PHASE2_COMPLETED',
    ]);
    const normalizeDistributionStatus = (status) => String(status || 'PENDING').toUpperCase();
    const hasCompletedPhase1 = (status) => PHASE1_COMPLETED_STATUSES.has(status);
    const hasCompletedPhase2 = (status) => status === 'PHASE2_COMPLETED';
    const buildPhase1InputInvalidationFlags = (status) => {
        const flags = {};
        if (hasCompletedPhase1(status)) {
            flags.phase1NeedsRerun = true;
        }
        if (hasCompletedPhase2(status)) {
            flags.phase2NeedsRerun = true;
        }
        return flags;
    };
    const buildPhase2InputInvalidationFlags = (status) => {
        if (!hasCompletedPhase2(status)) {
            return {};
        }
        return { phase2NeedsRerun: true };
    };
    const buildExecutionPendingFlagsByScope = (scope, status) => {
        if (scope === 'phase1') {
            return buildPhase1InputInvalidationFlags(status);
        }
        return buildPhase2InputInvalidationFlags(status);
    };
    /**
     * GET /api/organizer/distributions
     * Lista todas as distribuiÃ§Ãµes do organizador
     */
    router.get('/distributions', authMiddleware, (0, error_middleware_1.asyncHandler)(async (req, res) => {
        try {
            const organizerId = (0, auth_middleware_1.getOrganizerIdFromRequest)(req);
            const distributions = await database.getDistributionsByOrganizer(organizerId);
            res.status(200).json({
                success: true,
                data: { distributions },
            });
        }
        catch (error) {
            res.status(500).json({
                error: 'Erro ao listar distribuiÃ§Ãµes',
                message: error.message,
            });
        }
    }));
    /**
     * POST /api/organizer/distributions
     * Cria nova distribuiÃ§Ã£o
     *
     * Headers:
     * Authorization: Bearer <token>
     *
     * Response 201:
     * {
     *   "success": true,
     *   "data": {
     *     "distributionId": "dist_123"
     *   }
     * }
     *
     * Response 401: NÃ£o autenticado
     * Response 500: Erro interno
     */
    router.post('/distributions', authMiddleware, (0, error_middleware_1.asyncHandler)(async (req, res) => {
        try {
            const organizerId = (0, auth_middleware_1.getOrganizerIdFromRequest)(req);
            // Criar distribuiÃ§Ã£o
            const distributionId = await database.createDistribution(organizerId);
            res.status(201).json({
                success: true,
                data: {
                    distributionId,
                },
            });
        }
        catch (error) {
            res.status(500).json({
                error: 'Erro ao criar distribuiÃ§Ã£o',
                message: error.message,
            });
        }
    }));
    /**
     * POST /api/organizer/distributions/:distributionId/themes
     * Upload de temas (max 50)
     *
     * Headers:
     * Authorization: Bearer <token>
     *
     * Body:
     * {
     *   "themes": [
     *     { "name": "Tema A", "description": "DescriÃ§Ã£o A", "maxGroups": 2 },
     *     { "name": "Tema B", "description": "DescriÃ§Ã£o B", "maxGroups": 3 }
     *   ]
     * }
     *
     * Response 201:
     * {
     *   "success": true,
     *   "data": {
     *     "distributionId": "dist_123",
     *     "themesCreated": 2
     *   }
     * }
     *
     * Response 400: ValidaÃ§Ã£o falhou
     * Response 401: NÃ£o autenticado ou distribuiÃ§Ã£o nÃ£o pertence a organizador
     * Response 404: DistribuiÃ§Ã£o nÃ£o encontrada
     * Response 500: Erro interno
     */
    router.post('/distributions/:distributionId/themes', authMiddleware, validation_middleware_1.validateThemeUpload, (0, error_middleware_1.asyncHandler)(async (req, res) => {
        try {
            const organizerId = (0, auth_middleware_1.getOrganizerIdFromRequest)(req);
            const distributionId = req.params.distributionId;
            const { themes } = req.body;
            // Verificar se distribuiÃ§Ã£o existe e pertence ao organizador
            const distribution = await database.getDistribution(distributionId);
            if (!distribution) {
                return res.status(404).json({
                    error: 'DistribuiÃ§Ã£o nÃ£o encontrada',
                });
            }
            if (distribution.organizer_id !== organizerId) {
                return res.status(403).json({
                    error: 'VocÃª nÃ£o tem permissÃ£o para acessar esta distribuiÃ§Ã£o',
                });
            }
            // Verificar limite de temas
            if (themes.length > 50) {
                return res.status(400).json({
                    error: 'MÃ¡ximo de 50 temas permitidos',
                });
            }
            // Criar temas
            let themesCreated = 0;
            for (const theme of themes) {
                await database.createTheme(theme.name, theme.description || '', theme.maxGroups, distributionId);
                themesCreated++;
            }
            const currentStatus = normalizeDistributionStatus(distribution.status);
            const invalidationFlags = buildPhase1InputInvalidationFlags(currentStatus);
            await database.updateDistributionExecutionPendingFlags(distributionId, invalidationFlags);
            res.status(201).json({
                success: true,
                data: {
                    distributionId,
                    themesCreated,
                },
            });
        }
        catch (error) {
            res.status(500).json({
                error: 'Erro ao criar temas',
                message: error.message,
            });
        }
    }));
    /**
     * POST /api/organizer/distributions/:distributionId/execution-pending
     * Marca pendencia de reexecucao por escopo (Fase 1 ou Fase 2).
     */
    router.post('/distributions/:distributionId/execution-pending', authMiddleware, (0, error_middleware_1.asyncHandler)(async (req, res) => {
        try {
            const organizerId = (0, auth_middleware_1.getOrganizerIdFromRequest)(req);
            const distributionId = req.params.distributionId;
            const scope = String(req.body?.scope || '').toLowerCase();
            if (scope !== 'phase1' && scope !== 'phase2') {
                return res.status(400).json({
                    error: 'Escopo invalido. Use \"phase1\" ou \"phase2\".',
                });
            }
            const distribution = await database.getDistribution(distributionId);
            if (!distribution) {
                return res.status(404).json({
                    error: 'Distribuicao nao encontrada',
                });
            }
            if (distribution.organizer_id !== organizerId) {
                return res.status(403).json({
                    error: 'Voce nao tem permissao para acessar esta distribuicao',
                });
            }
            const currentStatus = normalizeDistributionStatus(distribution.status);
            const flagsToApply = buildExecutionPendingFlagsByScope(scope, currentStatus);
            const updated = await database.updateDistributionExecutionPendingFlags(distributionId, flagsToApply);
            res.status(200).json({
                success: true,
                data: {
                    distributionId,
                    phase1NeedsRerun: updated?.phase1_needs_rerun ?? Boolean(distribution.phase1_needs_rerun),
                    phase2NeedsRerun: updated?.phase2_needs_rerun ?? Boolean(distribution.phase2_needs_rerun),
                },
            });
        }
        catch (error) {
            res.status(500).json({
                error: 'Erro ao marcar pendencia de execucao',
                message: error.message,
            });
        }
    }));
    /**
     * POST /api/organizer/distributions/:distributionId/execute
     * Executa distribuiÃ§Ã£o (algoritmo)
     *
     * Headers:
     * Authorization: Bearer <token>
     *
     * Response 200:
     * {
     *   "success": true,
     *   "data": {
     *     "distributionId": "dist_123",
     *     "groupsCreated": 5,
     *     "score": 7850,
     *     "feasible": true,
     *     "executionTime": 1234,
     *     "report": "..." (relatÃ³rio detalhado)
     *   }
     * }
     *
     * Response 400: CenÃ¡rio infeasÃ­vel
     * Response 401: NÃ£o autenticado
     * Response 404: DistribuiÃ§Ã£o nÃ£o encontrada
     * Response 500: Erro interno
     */
    router.post('/distributions/:distributionId/execute', authMiddleware, (0, error_middleware_1.asyncHandler)(async (req, res) => {
        try {
            const organizerId = (0, auth_middleware_1.getOrganizerIdFromRequest)(req);
            const distributionId = req.params.distributionId;
            // Verificar permissÃ£o
            const distribution = await database.getDistribution(distributionId);
            if (!distribution) {
                return res.status(404).json({
                    error: 'DistribuiÃ§Ã£o nÃ£o encontrada',
                });
            }
            if (distribution.organizer_id !== organizerId) {
                return res.status(403).json({
                    error: 'VocÃª nÃ£o tem permissÃ£o para acessar esta distribuiÃ§Ã£o',
                });
            }
            const previousStatus = normalizeDistributionStatus(distribution.status);
            // Atualizar status
            await database.updateDistributionStatus(distributionId, 'EXECUTING');
            // 1. Buscar alunos e temas
            const studentsData = await database.getStudentsByDistribution(distributionId);
            const themesData = await database.getThemesByDistribution(distributionId);
            if (studentsData.length === 0) {
                return res.status(400).json({
                    error: 'Nenhum aluno registrado na distribuiÃ§Ã£o',
                });
            }
            if (themesData.length === 0) {
                return res.status(400).json({
                    error: 'Nenhum tema registrado na distribuiÃ§Ã£o',
                });
            }
            // 2. Converter para objetos do domain
            const students = [];
            for (const studentData of studentsData) {
                // Buscar preferÃªncias primeiro
                const preferencesData = await database.getStudentPreferences(studentData.id);
                const preferences = preferencesData.map(p => ({
                    themeId: p.theme_id,
                    rank: p.rank,
                }));
                // Buscar afinidades
                const affinitiesData = await database.getStudentAffinities(studentData.id);
                const student = new domain_1.Student(studentData.id, studentData.name, studentData.course, studentData.phase, preferences);
                // Configurar afinidades
                for (const aff of affinitiesData) {
                    student.setAffinity(aff.target_student_id, aff.level);
                }
                students.push(student);
            }
            const themes = themesData.map((t) => new domain_1.Theme(t.id, distributionId, t.name, t.max_groups, t.description));
            // 3. Executar distribuiÃ§Ã£o
            const engine = new DistributionEngine_1.DistributionEngine();
            const validation = engine.validateScenario(students, themes);
            if (!validation.isFeasible) {
                await database.updateDistributionStatus(distributionId, 'FAILED');
                return res.status(400).json({
                    error: 'CenÃ¡rio infeasÃ­vel',
                    issues: validation.issues,
                });
            }
            // Limpar grupos anteriores se houver
            await database.clearDistributionGroups(distributionId);
            // Executar algoritmo
            const result = await engine.solve(students, themes);
            // 4. Salvar resultado
            await database.saveSolution(distributionId, result.solution);
            res.status(200).json({
                success: true,
                data: {
                    distributionId,
                    groupsCreated: result.solution.getGroupCount(),
                    score: Math.round(result.solution.totalScore),
                    feasible: result.solution.constraintViolations.filter(v => v.severity === 'CRITICAL').length === 0,
                    executionTime: result.executionTime,
                    report: result.report,
                },
            });
        }
        catch (error) {
            res.status(500).json({
                error: 'Erro ao executar distribuiÃ§Ã£o',
                message: error.message,
            });
        }
    }));
    /**
     * GET /api/organizer/distributions/:distributionId/results
     * Busca resultados da distribuiÃ§Ã£o
     *
     * Headers:
     * Authorization: Bearer <token>
     *
     * Response 200:
     * {
     *   "success": true,
     *   "data": {
     *     "groups": [
     *       {
     *         "id": "grp_123",
     *         "theme": { "id": "tema_a", "name": "Tema A" },
     *         "students": [
     *           { "id": "stu_1", "name": "JoÃ£o", "course": "EE", "phase": 3 },
     *           ...
     *         ]
     *       },
     *       ...
     *     ]
     *   }
     * }
     *
     * Response 401: NÃ£o autenticado
     * Response 404: DistribuiÃ§Ã£o nÃ£o encontrada
     * Response 500: Erro interno
     */
    router.get('/distributions/:distributionId/results', authMiddleware, (0, error_middleware_1.asyncHandler)(async (req, res) => {
        try {
            const organizerId = (0, auth_middleware_1.getOrganizerIdFromRequest)(req);
            const distributionId = req.params.distributionId;
            // Verificar permissÃ£o
            const distribution = await database.getDistribution(distributionId);
            if (!distribution) {
                return res.status(404).json({
                    error: 'DistribuiÃ§Ã£o nÃ£o encontrada',
                });
            }
            if (distribution.organizer_id !== organizerId) {
                return res.status(403).json({
                    error: 'VocÃª nÃ£o tem permissÃ£o para acessar esta distribuiÃ§Ã£o',
                });
            }
            // Buscar soluÃ§Ã£o
            const solutionData = await database.getSolution(distributionId);
            const groups = solutionData.map((group) => ({
                id: group.id,
                theme: group.themes,
                students: group.group_students.map((gs) => gs.students),
            }));
            res.status(200).json({
                success: true,
                data: {
                    groups,
                },
            });
        }
        catch (error) {
            res.status(500).json({
                error: 'Erro ao buscar resultados',
                message: error.message,
            });
        }
    }));
    /**
     * POST /api/organizer/distributions/:distributionId/execute-phase1
     * Executa Fase 1 (FormaÃ§Ã£o inicial de grupos com otimizaÃ§Ã£o de energia)
     *
     * Headers:
     * Authorization: Bearer <token>
     *
     * Body (opcional):
     * {
     *   "wPref": 1.0,
     *   "wDup": 0.9,
     *   "wDiv": 0.35
     * }
     *
     * Response 200:
     * {
     *   "success": true,
     *   "data": {
     *     "distributionId": "dist_123",
     *     "phase": "PHASE1_COMPLETED",
     *     "groupsCreated": 5,
     *     "energy": 1234.5678,
     *     "feasible": true,
     *     "executionTime": 1234,
     *     "report": "..." (relatÃ³rio detalhado)
     *   }
     * }
     *
     * Response 400: CenÃ¡rio infeasÃ­vel
     * Response 401: NÃ£o autenticado
     * Response 404: DistribuiÃ§Ã£o nÃ£o encontrada
     * Response 500: Erro interno
     */
    router.post('/distributions/:distributionId/execute-phase1', authMiddleware, (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const organizerId = (0, auth_middleware_1.getOrganizerIdFromRequest)(req);
        const distributionId = req.params.distributionId;
        const { wPref, wDup, wDiv } = req.body || {};
        try {
            // Verificar permissÃ£o
            const distribution = await database.getDistribution(distributionId);
            if (!distribution) {
                return res.status(404).json({
                    error: 'DistribuiÃ§Ã£o nÃ£o encontrada',
                });
            }
            if (distribution.organizer_id !== organizerId) {
                return res.status(403).json({
                    error: 'VocÃª nÃ£o tem permissÃ£o para acessar esta distribuiÃ§Ã£o',
                });
            }
            // Atualizar status
            await database.updateDistributionStatus(distributionId, 'EXECUTING');
            // 1. Buscar alunos e temas
            const studentsData = await database.getStudentsByDistribution(distributionId);
            const themesData = await database.getThemesByDistribution(distributionId);
            if (studentsData.length === 0) {
                return res.status(400).json({
                    error: 'Nenhum aluno registrado na distribuiÃ§Ã£o',
                });
            }
            if (themesData.length === 0) {
                return res.status(400).json({
                    error: 'Nenhum tema registrado na distribuiÃ§Ã£o',
                });
            }
            // 2. Converter para objetos do domain
            const students = [];
            for (const studentData of studentsData) {
                const preferencesData = await database.getStudentPreferences(studentData.id);
                const preferences = preferencesData.map(p => ({
                    themeId: p.theme_id,
                    rank: p.rank,
                }));
                const student = new domain_1.Student(studentData.id, studentData.name, studentData.course, studentData.phase, preferences);
                students.push(student);
            }
            console.log('Themes Data:', JSON.stringify(themesData, null, 2));
            const themes = themesData.map((t) => new domain_1.Theme(t.id, distributionId, t.name, t.max_groups, t.description));
            // 3. Executar Fase 1
            const engine = new DistributionEngine_1.DistributionEngine(wPref !== undefined || wDup !== undefined || wDiv !== undefined
                ? { wPref, wDup, wDiv }
                : undefined);
            const validation = engine.validateScenario(students, themes);
            if (!validation.isFeasible) {
                await database.updateDistributionStatus(distributionId, 'FAILED');
                return res.status(400).json({
                    error: 'CenÃ¡rio infeasÃ­vel',
                    issues: validation.issues,
                });
            }
            // Limpar grupos anteriores se houver
            await database.clearDistributionGroups(distributionId);
            // Executar Fase 1
            const result = await engine.solvePhase1(students, themes);
            // 4. Salvar resultado
            await database.saveSolution(distributionId, result.solution);
            // 5. Atualizar distribuiÃ§Ã£o com status COMPLETED (Fase 1)
            await database.updateDistributionStatus(distributionId, 'COMPLETED');
            const pendingState = await database.updateDistributionExecutionPendingFlags(distributionId, {
                phase1NeedsRerun: false,
                phase2NeedsRerun: hasCompletedPhase2(previousStatus) ? true : undefined,
            });
            // Nota: Salvar pesos configurados seria feito aqui,
            // mas requer mÃ©todo helper no DatabaseService que serÃ¡ adicionado depois
            res.status(200).json({
                success: true,
                data: {
                    distributionId,
                    phase: 'PHASE1_COMPLETED',
                    groupsCreated: result.solution.getGroupCount(),
                    energy: result.solution.getTotalEnergy(),
                    feasible: result.solution.isFeasible(),
                    executionTime: result.executionTime,
                    report: result.report,
                    phase1NeedsRerun: pendingState?.phase1_needs_rerun ?? false,
                    phase2NeedsRerun: pendingState?.phase2_needs_rerun ?? false,
                },
            });
        }
        catch (error) {
            console.error('[execute-phase1] Error:', error);
            await database.updateDistributionStatus(distributionId, 'FAILED').catch(() => { });
            res.status(500).json({
                error: 'Erro ao executar Fase 1',
                message: error.message,
            });
        }
    }));
    /**
     * POST /api/organizer/distributions/:distributionId/execute-phase2
     * Executa Fase 2 (OtimizaÃ§Ã£o social com base em afinidades)
     *
     * Headers:
     * Authorization: Bearer <token>
     *
     * Body (opcional):
     * {
     *   "wSoc": 1.5,
     *   "maxIterations": 20000,
     *   "temperature": 0.8
     * }
     *
     * Response 200:
     * {
     *   "success": true,
     *   "data": {
     *     "distributionId": "dist_123",
     *     "phase": "PHASE2_COMPLETED",
     *     "groupsModified": 2,
     *     "avgCohesion": 2.3456,
     *     "executionTime": 1234,
     *     "report": "..." (relatÃ³rio detalhado)
     *   }
     * }
     *
     * Response 400: Fase 1 nÃ£o foi executada ou sem afinidades
     * Response 401: NÃ£o autenticado
     * Response 404: DistribuiÃ§Ã£o nÃ£o encontrada
     * Response 500: Erro interno
     */
    router.post('/distributions/:distributionId/execute-phase2', authMiddleware, (0, error_middleware_1.asyncHandler)(async (req, res) => {
        try {
            const organizerId = (0, auth_middleware_1.getOrganizerIdFromRequest)(req);
            const distributionId = req.params.distributionId;
            const { wSoc, maxIterations, temperature } = req.body || {};
            // Verificar permissÃ£o
            const distribution = await database.getDistribution(distributionId);
            if (!distribution) {
                return res.status(404).json({
                    error: 'DistribuiÃ§Ã£o nÃ£o encontrada',
                });
            }
            if (distribution.organizer_id !== organizerId) {
                return res.status(403).json({
                    error: 'VocÃª nÃ£o tem permissÃ£o para acessar esta distribuiÃ§Ã£o',
                });
            }
            // Verificar se Fase 1 foi executada
            const status = distribution.status;
            // Permitir execuÃ§Ã£o se COMPLETED, FAILED ou EXECUTING (assumindo retry/force)
            // O importante Ã© ter grupos da Fase 1 para otimizar
            if (status === 'PENDING') {
                return res.status(400).json({
                    error: 'Fase 1 nÃ£o foi executada',
                    message: 'Execute Fase 1 antes de Fase 2',
                    currentStatus: status,
                });
            }
            // Atualizar status
            await database.updateDistributionStatus(distributionId, 'PHASE2_EXECUTING');
            // 1. Buscar dados fundamentais (Alunos e Temas) para reconstruir objetos de domÃ­nio
            const studentsData = await database.getStudentsByDistribution(distributionId);
            const themesData = await database.getThemesByDistribution(distributionId);
            if (studentsData.length === 0 || themesData.length === 0) {
                return res.status(400).json({ error: 'Dados bases (alunos/temas) nÃ£o encontrados' });
            }
            // Converter alunos (com preferÃªncias)
            const studentsMap = new Map();
            for (const studentData of studentsData) {
                const preferencesData = await database.getStudentPreferences(studentData.id);
                const preferences = preferencesData.map(p => ({
                    themeId: p.theme_id,
                    rank: p.rank,
                }));
                const student = new domain_1.Student(studentData.id, studentData.name, studentData.course, studentData.phase, preferences);
                studentsMap.set(student.id, student);
            }
            // Converter temas
            const themes = themesData.map((t) => new domain_1.Theme(t.id, distributionId, t.name, t.max_groups, t.description));
            // 2. Buscar soluÃ§Ã£o da Fase 1 do banco e reconstruir objeto Solution
            const solutionGroupsData = await database.getSolution(distributionId);
            if (!solutionGroupsData || solutionGroupsData.length === 0) {
                await database.updateDistributionStatus(distributionId, 'FAILED').catch(() => { });
                return res.status(400).json({
                    error: 'Nenhuma soluÃ§Ã£o da Fase 1 encontrada',
                });
            }
            // Reconstruir Grupos
            const groups = [];
            for (const groupData of solutionGroupsData) {
                const groupThemeId = groupData.theme_id;
                const groupStudentsData = groupData.group_students || [];
                const group = new domain_1.Group(groupData.id, groupThemeId, distributionId);
                for (const gs of groupStudentsData) {
                    const student = studentsMap.get(gs.student_id);
                    if (student) {
                        group.addStudent(student);
                    }
                }
                groups.push(group);
            }
            // Reconstruir SoluÃ§Ã£o base (Fase 1)
            // Recalcular energia inicial para garantir consistÃªncia
            const baseSolution = new domain_1.Solution(groups);
            // 3. Construir Affinity Matrix com dados reais
            const affinityMatrix = new AffinityMatrix_1.AffinityMatrix();
            const affinitiesData = await database.getAllAffinitiesByDistribution(distributionId);
            for (const aff of affinitiesData) {
                const rawLevel = Number(aff.level ?? 0);
                const normalizedLevel = rawLevel >= -1 && rawLevel <= 1
                    ? rawLevel
                    : Math.max(-1, Math.min(1, rawLevel / 100));
                affinityMatrix.set(aff.student_id, aff.target_student_id, normalizedLevel);
            }
            console.log(`[execute-phase2] Carregadas ${affinitiesData.length} afinidades para ${studentsMap.size} alunos.`);
            // 4. Executar Fase 2 (Social Optimization)
            const engine = new DistributionEngine_1.DistributionEngine(
            // Pesos padrÃµes internos se nÃ£o passar config, mas o ideal seria persistir wPref da Fase 1
            // Por simplicidade, assume defaults ou o que for passado no body para wSoc
            );
            const result = await engine.solvePhase2(baseSolution, affinityMatrix, themes, { wSoc, maxIterations, temperature });
            // 5. Salvar resultado (Atualiza grupos existentes ou recria?)
            // saveSolution limpa e recria. Isso perde IDs de grupos originais se nÃ£o tratarmos, 
            // mas para o fluxo atual Ã© aceitÃ¡vel ter novos IDs de grupos ou a mesma estrutura.
            // O ideal seria update, mas saveSolution Ã© mais seguro para consistÃªncia.
            // CORREÃ‡ÃƒO: Limpar grupos anteriores antes de salvar novos para evitar duplicidade de alunos
            await database.clearDistributionGroups(distributionId);
            await database.saveSolution(distributionId, result.solution);
            // 6. Atualizar status
            await database.updateDistributionStatus(distributionId, 'PHASE2_COMPLETED');
            const pendingState = await database.updateDistributionExecutionPendingFlags(distributionId, {
                phase2NeedsRerun: false,
            });
            res.status(200).json({
                success: true,
                data: {
                    distributionId,
                    phase: 'PHASE2_COMPLETED',
                    groupsCount: result.solution.getGroupCount(),
                    executionTime: result.executionTime,
                    affinitiesUsed: affinityMatrix.getSize(),
                    avgCohesion: result.solution.socialScore / Math.max(1, result.solution.getGroupCount()), // AproximaÃ§Ã£o
                    report: result.report,
                    phase1NeedsRerun: pendingState?.phase1_needs_rerun ?? false,
                    phase2NeedsRerun: pendingState?.phase2_needs_rerun ?? false,
                },
            });
        }
        catch (error) {
            console.error('[execute-phase2] Error:', error);
            res.status(500).json({
                error: 'Erro ao executar Fase 2',
                message: error.message,
            });
        }
    }));
    /**
     * PUT /api/organizer/distributions/:distributionId/social-config
     * Configura parÃ¢metros da Fase 2 (OtimizaÃ§Ã£o Social)
     *
     * Headers:
     * Authorization: Bearer <token>
     *
     * Body:
     * {
     *   "enabled": true,
     *   "wSoc": 1.5,
     *   "maxIterations": 20000,
     *   "temperature": 0.8
     * }
     *
     * Response 200:
     * {
     *   "success": true,
     *   "message": "ConfiguraÃ§Ã£o de Fase 2 atualizada",
     *   "data": {
     *     "distributionId": "dist_123",
     *     "config": { "enabled": true, "wSoc": 1.5, ... }
     *   }
     * }
     *
     * Response 401: NÃ£o autenticado
     * Response 404: DistribuiÃ§Ã£o nÃ£o encontrada
     * Response 500: Erro interno
     */
    router.put('/distributions/:distributionId/social-config', authMiddleware, (0, error_middleware_1.asyncHandler)(async (req, res) => {
        try {
            const organizerId = (0, auth_middleware_1.getOrganizerIdFromRequest)(req);
            const distributionId = req.params.distributionId;
            const { enabled, wSoc, maxIterations, temperature } = req.body;
            // Verificar permissÃ£o
            const distribution = await database.getDistribution(distributionId);
            if (!distribution) {
                return res.status(404).json({
                    error: 'DistribuiÃ§Ã£o nÃ£o encontrada',
                });
            }
            if (distribution.organizer_id !== organizerId) {
                return res.status(403).json({
                    error: 'VocÃª nÃ£o tem permissÃ£o para acessar esta distribuiÃ§Ã£o',
                });
            }
            const shouldEnablePhase2 = enabled !== undefined ? Boolean(enabled) : true;
            const currentStatus = String(distribution.status || '').toUpperCase();
            if (shouldEnablePhase2 && (currentStatus === 'COMPLETED' || currentStatus === 'PARTIAL')) {
                await database.updateDistributionStatus(distributionId, 'PHASE2');
            }
            // Nota: ConfiguraÃ§Ã£o de Fase 2 ainda nÃ£o Ã© persistida no banco.
            res.status(200).json({
                success: true,
                message: 'ConfiguraÃ§Ã£o de Fase 2 registrada',
                data: {
                    distributionId,
                    config: {
                        enabled: shouldEnablePhase2,
                        wSoc: wSoc || 1.0,
                        maxIterations: maxIterations || 20000,
                        temperature: temperature || 0.8,
                    },
                },
            });
        }
        catch (error) {
            console.error('[social-config] Error:', error);
            res.status(500).json({
                error: 'Erro ao atualizar configuraÃ§Ã£o de Fase 2',
                message: error.message,
            });
        }
    }));
    /**
     * GET /api/organizer/distributions/:distributionId/social-metrics
     * Recupera mÃ©tricas sociais dos grupos (Fase 2)
     *
     * Headers:
     * Authorization: Bearer <token>
     *
     * Response 200:
     * {
     *   "success": true,
     *   "data": {
     *     "distributionId": "dist_123",
     *     "affinitiesCount": 45,
     *     "groups": [
     *       {
     *         "id": "grp_123",
     *         "theme": "Tema A",
     *         "students": 4,
     *         "socialCohesionScore": 2.3456,
     *         "status": "âœ… Afinidades positivas"
     *       },
     *       ...
     *     ]
     *   }
     * }
     *
     * Response 401: NÃ£o autenticado
     * Response 404: DistribuiÃ§Ã£o nÃ£o encontrada
     * Response 500: Erro interno
     */
    router.get('/distributions/:distributionId/social-metrics', authMiddleware, (0, error_middleware_1.asyncHandler)(async (req, res) => {
        try {
            const organizerId = (0, auth_middleware_1.getOrganizerIdFromRequest)(req);
            const distributionId = req.params.distributionId;
            // Verificar permissÃ£o
            const distribution = await database.getDistribution(distributionId);
            if (!distribution) {
                return res.status(404).json({
                    error: 'DistribuiÃ§Ã£o nÃ£o encontrada',
                });
            }
            if (distribution.organizer_id !== organizerId) {
                return res.status(403).json({
                    error: 'VocÃª nÃ£o tem permissÃ£o para acessar esta distribuiÃ§Ã£o',
                });
            }
            // Buscar grupos
            const groupsData = await database.getSolution(distributionId);
            // Calcular mÃ©tricas
            const groups = (groupsData || []).map((group) => {
                const socialScore = group.social_cohesion_score || 0;
                let status = 'âž– Neutro';
                if (socialScore > 0) {
                    status = 'âœ… Afinidades positivas';
                }
                else if (socialScore < 0) {
                    status = 'âš ï¸ Afinidades negativas';
                }
                const theme = group.themes || {};
                const students = group.group_students || [];
                return {
                    id: group.id,
                    theme: theme.name || 'N/A',
                    students: students.length,
                    socialCohesionScore: parseFloat((socialScore || 0).toFixed(4)),
                    status,
                };
            });
            res.status(200).json({
                success: true,
                data: {
                    distributionId,
                    groupsCount: groups.length,
                    groups,
                },
            });
        }
        catch (error) {
            console.error('[social-metrics] Error:', error);
            res.status(500).json({
                error: 'Erro ao buscar mÃ©tricas sociais',
                message: error.message,
            });
        }
    }));
    /**
     * GET /api/organizer/distributions/:distributionId/statistics
     * Retorna estatÃ­sticas de resposta dos alunos
     *
     * Headers:
     * Authorization: Bearer <token>
     *
     * Response 200:
     * {
     *   "success": true,
     *   "data": {
     *     "distributionId": "dist_123",
     *     "totalStudents": 133,
     *     "studentsWithPreferences": 120,
     *     "studentsWithAffinities": 45,
     *     "courseBreakdown": [
     *       { "course": "EE", "count": 56 },
     *       { "course": "ME", "count": 77 }
     *     ],
     *     "phaseBreakdown": [
     *       { "phase": 1, "count": 70 },
     *       { "phase": 3, "count": 35 },
     *       ...
     *     ],
     *     "preferenceCompletionRate": 90.22,
     *     "affinityCompletionRate": 33.83
     *   }
     * }
     *
     * Response 401: NÃ£o autenticado
     * Response 403: NÃ£o autorizado
     * Response 404: DistribuiÃ§Ã£o nÃ£o encontrada
     * Response 500: Erro interno
     */
    router.get('/distributions/:distributionId/statistics', authMiddleware, (0, error_middleware_1.asyncHandler)(async (req, res) => {
        try {
            const organizerId = (0, auth_middleware_1.getOrganizerIdFromRequest)(req);
            const distributionId = req.params.distributionId;
            // Verificar permissÃ£o
            const distribution = await database.getDistribution(distributionId);
            if (!distribution) {
                return res.status(404).json({
                    error: 'DistribuiÃ§Ã£o nÃ£o encontrada',
                });
            }
            if (distribution.organizer_id !== organizerId) {
                return res.status(403).json({
                    error: 'VocÃª nÃ£o tem permissÃ£o para acessar esta distribuiÃ§Ã£o',
                });
            }
            // Buscar estatÃ­sticas
            const stats = await database.getDistributionStatistics(distributionId);
            res.status(200).json({
                success: true,
                data: {
                    distributionId,
                    ...stats,
                },
            });
        }
        catch (error) {
            console.error('[statistics] Error:', error);
            res.status(500).json({
                error: 'Erro ao buscar estatÃ­sticas',
                message: error.message,
            });
        }
    }));
    /**
     * POST /api/organizer/distributions/:distributionId/seed
     * Popula distribuiÃ§Ã£o com dados de teste para simulaÃ§Ã£o
     *
     * Headers:
     * Authorization: Bearer <token>
     *
     * Body (todos opcionais):
     * {
     *   "studentCount": 133,           // PadrÃ£o: 133 (ME: 77, EE: 56)
     *   "generatePreferences": true,   // PadrÃ£o: true
     *   "generateAffinities": false,   // PadrÃ£o: false
     *   "affinityDensity": 0.13        // PadrÃ£o: 0.13 (13% manifestaÃ§Ã£o)
     * }
     *
     * Response 201:
     * {
     *   "success": true,
     *   "data": {
     *     "distributionId": "dist_123",
     *     "studentsCreated": 133,
     *     "preferencesCreated": 1064,
     *     "affinitiesCreated": 0,
     *     "message": "Dados de teste criados com sucesso"
     *   }
     * }
     *
     * Response 400: ValidaÃ§Ã£o falhou ou faltam temas
     * Response 401: NÃ£o autenticado
     * Response 403: NÃ£o autorizado
     * Response 404: DistribuiÃ§Ã£o nÃ£o encontrada
     * Response 500: Erro interno
     */
    router.post('/distributions/:distributionId/seed', authMiddleware, validation_middleware_1.validateSeedConfig, (0, error_middleware_1.asyncHandler)(async (req, res) => {
        try {
            const organizerId = (0, auth_middleware_1.getOrganizerIdFromRequest)(req);
            const distributionId = req.params.distributionId;
            const { studentCount, generatePreferences, generateAffinities, affinityDensity, } = req.body;
            // Verificar permissÃ£o
            const distribution = await database.getDistribution(distributionId);
            if (!distribution) {
                return res.status(404).json({
                    error: 'DistribuiÃ§Ã£o nÃ£o encontrada',
                });
            }
            if (distribution.organizer_id !== organizerId) {
                return res.status(403).json({
                    error: 'VocÃª nÃ£o tem permissÃ£o para acessar esta distribuiÃ§Ã£o',
                });
            }
            // Criar SeedService e popular
            const seedService = new SeedService_1.SeedService(database);
            const result = await seedService.seedDistribution(distributionId, {
                studentCount,
                generatePreferences,
                generateAffinities,
                affinityDensity,
            });
            const currentStatus = normalizeDistributionStatus(distribution.status);
            if (Number(result.affinitiesCreated || 0) > 0 &&
                (currentStatus === 'COMPLETED' || currentStatus === 'PARTIAL')) {
                await database.updateDistributionStatus(distributionId, 'PHASE2');
            }
            const invalidationFlags = buildPhase1InputInvalidationFlags(currentStatus);
            await database.updateDistributionExecutionPendingFlags(distributionId, invalidationFlags);
            res.status(201).json({
                success: true,
                data: {
                    distributionId,
                    ...result,
                    message: 'Dados de teste criados com sucesso',
                },
            });
        }
        catch (error) {
            console.error('[seed] Error:', error);
            res.status(500).json({
                error: 'Erro ao gerar dados de teste',
                message: error.message,
            });
        }
    }));
    /**
     * POST /api/organizer/distributions/:distributionId/seed-affinities
     * Gera dados de afinidade simulados para alunos jÃ¡ existentes
     *
     * Body (opcionais):
     * { "affinityDensity": 0.13 }
     */
    router.post('/distributions/:distributionId/seed-affinities', authMiddleware, (0, error_middleware_1.asyncHandler)(async (req, res) => {
        try {
            const organizerId = (0, auth_middleware_1.getOrganizerIdFromRequest)(req);
            const distributionId = req.params.distributionId;
            const { affinityDensity } = req.body;
            // Verificar permissÃ£o
            const distribution = await database.getDistribution(distributionId);
            if (!distribution) {
                return res.status(404).json({
                    error: 'DistribuiÃ§Ã£o nÃ£o encontrada',
                });
            }
            if (distribution.organizer_id !== organizerId) {
                return res.status(403).json({
                    error: 'VocÃª nÃ£o tem permissÃ£o para acessar esta distribuiÃ§Ã£o',
                });
            }
            const seedService = new SeedService_1.SeedService(database);
            const result = await seedService.seedAffinities(distributionId, {
                affinityDensity,
            });
            const currentStatus = normalizeDistributionStatus(distribution.status);
            if (Number(result.affinitiesCreated || 0) > 0 &&
                (currentStatus === 'COMPLETED' || currentStatus === 'PARTIAL')) {
                await database.updateDistributionStatus(distributionId, 'PHASE2');
            }
            const invalidationFlags = buildPhase2InputInvalidationFlags(currentStatus);
            await database.updateDistributionExecutionPendingFlags(distributionId, invalidationFlags);
            res.status(201).json({
                success: true,
                data: {
                    distributionId,
                    ...result,
                    message: `Afinidades simuladas criadas: ${result.affinitiesCreated} afinidades para ${result.studentsProcessed} alunos`,
                },
            });
        }
        catch (error) {
            console.error('[seed-affinities] Error:', error);
            res.status(500).json({
                error: 'Erro ao gerar dados de afinidade',
                message: error.message,
            });
        }
    }));
    /**
     * GET /api/organizer/distributions/:distributionId/groups
     * Retorna grupos formados apÃ³s Fase 1 com detalhes dos membros
     *
     * Headers:
     * Authorization: Bearer <token>
     *
     * Response 200:
     * {
     *   "success": true,
     *   "data": {
     *     "distributionId": "dist_123",
     *     "groupCount": 33,
     *     "groups": [
     *       {
     *         "id": "grp_1",
     *         "theme": { "id": "thm_1", "name": "IoT" },
     *         "memberCount": 4,
     *         "members": [
     *           { "id": "std_1", "name": "JoÃ£o Silva", "course": "EE", "phase": 1 },
     *           ...
     *         ]
     *       }
     *     ]
     *   }
     * }
     *
     * Response 401: NÃ£o autenticado
     * Response 403: NÃ£o autorizado
     * Response 404: DistribuiÃ§Ã£o nÃ£o encontrada
     * Response 500: Erro interno
     */
    router.get('/distributions/:distributionId/groups', authMiddleware, (0, error_middleware_1.asyncHandler)(async (req, res) => {
        try {
            const organizerId = (0, auth_middleware_1.getOrganizerIdFromRequest)(req);
            const distributionId = req.params.distributionId;
            // Verificar permissÃ£o
            const distribution = await database.getDistribution(distributionId);
            if (!distribution) {
                return res.status(404).json({
                    error: 'DistribuiÃ§Ã£o nÃ£o encontrada',
                });
            }
            if (distribution.organizer_id !== organizerId) {
                return res.status(403).json({
                    error: 'VocÃª nÃ£o tem permissÃ£o para acessar esta distribuiÃ§Ã£o',
                });
            }
            // Buscar grupos
            const groups = await database.getDistributionGroups(distributionId);
            res.status(200).json({
                success: true,
                data: {
                    distributionId,
                    groupCount: groups.length,
                    groups,
                },
            });
        }
        catch (error) {
            console.error('[groups] Error:', error);
            res.status(500).json({
                error: 'Erro ao buscar grupos',
                message: error.message,
            });
        }
    }));
    return router;
}
//# sourceMappingURL=organizer.routes.js.map



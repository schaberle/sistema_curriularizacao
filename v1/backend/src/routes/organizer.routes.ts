// @ts-nocheck
const express_1 = require("express");
const domain_1 = require("../domain");
// ...
const DistributionEngine_1 = require("../services/optimization/DistributionEngine");
const SimulationIdealMetricsService_1 = require("../services/optimization/SimulationIdealMetricsService");
const VectorState_1 = require("../services/optimization/VectorState");
const SimulationRuntime_1 = require("../services/optimization/SimulationRuntime");
const AffinityMatrix_1 = require("../domain/AffinityMatrix");
const SeedService_1 = require("../services/database/SeedService");
const simulationVisualState_helpers_1 = require("./simulationVisualState.helpers");
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
    const simulationExecutionMetaByDistribution = new Map();
    const simulationRunManager = new SimulationRuntime_1.SimulationRunManager();
    const seedInFlightByDistribution = new Set();
    const SIMULATION_ENERGY_AXIS = ['-E_pref', '-E_fase', '-E_soc'];
    const normalizeAffinityLevel = (rawValue) => {
        const rawNumber = Number(rawValue ?? 0);
        if (Number.isNaN(rawNumber)) {
            return 0;
        }
        if (rawNumber >= -1 && rawNumber <= 1) {
            return rawNumber;
        }
        return Math.max(-1, Math.min(1, rawNumber / 100));
    };
    const buildStudentsWithPreferences = async (distributionId) => {
        const studentsData = await database.getStudentsByDistribution(distributionId);
        const studentsMap = new Map();
        for (const studentData of studentsData) {
            const preferencesData = await database.getStudentPreferences(studentData.id);
            const preferences = preferencesData.map((item) => ({
                themeId: item.theme_id,
                rank: item.rank,
            }));
            const student = new domain_1.Student(studentData.id, studentData.name, studentData.course, studentData.phase, preferences);
            studentsMap.set(student.id, student);
        }
        return { studentsData, studentsMap, students: Array.from(studentsMap.values()) };
    };
    const buildThemes = (distributionId, themesData) => themesData.map((theme) => new domain_1.Theme(theme.id, distributionId, theme.name, theme.max_groups, theme.description));
    const buildAffinityMatrix = async (distributionId) => {
        const affinityMatrix = new AffinityMatrix_1.AffinityMatrix();
        const affinitiesData = await database.getAllAffinitiesByDistribution(distributionId);
        for (const affinity of affinitiesData) {
            affinityMatrix.set(affinity.student_id, affinity.target_student_id, normalizeAffinityLevel(affinity.level));
        }
        return affinityMatrix;
    };
    const buildSolutionFromDatabase = async (distributionId, studentsMap) => {
        const solutionGroupsData = await database.getSolution(distributionId);
        if (!solutionGroupsData || solutionGroupsData.length === 0) {
            return { groups: [], solution: new domain_1.Solution([]), rawGroups: [] };
        }
        const groups = [];
        for (const groupData of solutionGroupsData) {
            const groupThemeId = groupData.theme_id;
            const groupStudentsData = groupData.group_students || [];
            const group = new domain_1.Group(groupData.id, groupThemeId, distributionId);
            for (const groupStudent of groupStudentsData) {
                const student = studentsMap.get(groupStudent.student_id);
                if (student) {
                    group.addStudent(student);
                }
            }
            groups.push(group);
        }
        return { groups, solution: new domain_1.Solution(groups), rawGroups: solutionGroupsData };
    };
    const ensureThemeCapacityFeasibility = (students, themes) => {
        const requiredGroups = Math.ceil(students.length / 4);
        const totalThemeCapacity = themes.reduce((sum, theme) => sum + Math.max(0, Number(theme.maxGroups || 0)), 0);
        if (totalThemeCapacity < requiredGroups) {
            throw new Error(`Capacidade de temas insuficiente para modo ideal: requiredGroups=${requiredGroups}, totalThemeCapacity=${totalThemeCapacity}`);
        }
    };
    const buildSimulationMetricsPayload = async (distributionId, themes, groups, options) => {
        const affinityMatrix = await buildAffinityMatrix(distributionId);
        const metricsService = new SimulationIdealMetricsService_1.SimulationIdealMetricsService({ wSoc: options?.wSoc ?? 1.0 });
        return metricsService.calculate(groups, themes, affinityMatrix, {
            includePhase2Energy: Boolean(options?.includePhase2Energy),
            executionMeta: options?.executionMeta,
        });
    };
    const pickAxisThemeIds = (themes, students) => {
        const themeIds = (themes || []).map((theme) => theme.id);
        if (!themeIds.length) {
            return ['x', 'y', 'z'];
        }
        const rankScores = [100, 70, 50, 35, 25, 18, 12, 8];
        const scoreByTheme = new Map(themeIds.map((themeId) => [themeId, 0]));
        for (const student of students || []) {
            for (const themeId of themeIds) {
                const rank = Number(student?.getThemeRank?.(themeId) || -1);
                if (rank <= 0) {
                    continue;
                }
                const score = rank <= rankScores.length
                    ? rankScores[rank - 1]
                    : Math.max(0, 8 - (rank - rankScores.length));
                scoreByTheme.set(themeId, (scoreByTheme.get(themeId) || 0) + score);
            }
        }
        const rankedThemes = [...themeIds].sort((a, b) => {
            const scoreDiff = (scoreByTheme.get(b) || 0) - (scoreByTheme.get(a) || 0);
            if (scoreDiff !== 0) {
                return scoreDiff;
            }
            return String(a).localeCompare(String(b));
        });
        const axis = rankedThemes.slice(0, 3);
        for (const themeId of themeIds) {
            if (axis.length >= 3) {
                break;
            }
            if (!axis.includes(themeId)) {
                axis.push(themeId);
            }
        }
        while (axis.length < 3) {
            axis.push(axis[axis.length - 1] || themeIds[0]);
        }
        return axis;
    };
    const buildEnergyProjectionConfig = (params) => ({
        mode: 'energy_components',
        weights: {
            wPref: Number.isFinite(Number(params?.wPref)) ? Number(params?.wPref) : 1.0,
            wDup: Number.isFinite(Number(params?.wDup)) ? Number(params?.wDup) : 0.9,
            wDiv: Number.isFinite(Number(params?.wDiv)) ? Number(params?.wDiv) : 0.35,
            wSoc: Number.isFinite(Number(params?.wSoc)) ? Number(params?.wSoc) : 1.0,
        },
        affinityMatrix: params?.affinityMatrix,
    });
    const orderThemesForVisualState = (themesData) => [...(themesData || [])].sort((a, b) => {
        const timeA = new Date(a?.created_at || 0).getTime();
        const timeB = new Date(b?.created_at || 0).getTime();
        if (Number.isFinite(timeA) && Number.isFinite(timeB) && timeA !== timeB) {
            return timeA - timeB;
        }
        return String(a?.id || '').localeCompare(String(b?.id || ''));
    });
    const setRunSseHeaders = (res) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        if (typeof res.flushHeaders === 'function') {
            res.flushHeaders();
        }
    };
    const writeSseEvent = (res, type, payload) => {
        res.write(`event: ${type}\n`);
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };
    const serializeSimulationRunResult = (run, result) => ({
        runId: run.id,
        distributionId: run.distributionId,
        phase: run.phase,
        axisThemeIds: run.axisThemeIds,
        status: run.status,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        error: run.error,
        result: result || null,
    });
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
    router.post('/distributions/:distributionId/simulation/execute-phase1', authMiddleware, (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const organizerId = (0, auth_middleware_1.getOrganizerIdFromRequest)(req);
        const distributionId = req.params.distributionId;
        const { wPref, wDup, wDiv } = req.body || {};
        try {
            const distribution = await database.getDistribution(distributionId);
            if (!distribution) {
                return res.status(404).json({ error: 'DistribuiÃ§Ã£o nÃ£o encontrada' });
            }
            if (distribution.organizer_id !== organizerId) {
                return res.status(403).json({ error: 'VocÃª nÃ£o tem permissÃ£o para acessar esta distribuiÃ§Ã£o' });
            }
            const previousStatus = normalizeDistributionStatus(distribution.status);
            await database.updateDistributionStatus(distributionId, 'EXECUTING');
            const studentsBuild = await buildStudentsWithPreferences(distributionId);
            const themesData = await database.getThemesByDistribution(distributionId);
            if (studentsBuild.students.length === 0) {
                return res.status(400).json({ error: 'Nenhum aluno registrado na distribuiÃ§Ã£o' });
            }
            if (themesData.length === 0) {
                return res.status(400).json({ error: 'Nenhum tema registrado na distribuiÃ§Ã£o' });
            }
            const themes = buildThemes(distributionId, themesData);
            ensureThemeCapacityFeasibility(studentsBuild.students, themes);
            const axisThemeIds = [...SIMULATION_ENERGY_AXIS];
            const vectorState = VectorState_1.VectorState.fromStudents(studentsBuild.students, themes);
            const engine = new DistributionEngine_1.DistributionEngine(wPref !== undefined || wDup !== undefined || wDiv !== undefined
                ? { wPref, wDup, wDiv }
                : undefined);
            const validation = engine.validateScenario(studentsBuild.students, themes);
            if (!validation.isFeasible) {
                await database.updateDistributionStatus(distributionId, 'FAILED');
                return res.status(400).json({ error: 'CenÃ¡rio infeasÃ­vel', issues: validation.issues });
            }
            await database.clearDistributionGroups(distributionId);
            const result = await engine.solvePhase1(studentsBuild.students, themes, {
                simulationIdeal: true,
                enforceThemeCapacity: true,
                runtime: {
                    enabled: true,
                    runId: `adhoc_phase1_${Date.now()}`,
                    phase: 'phase1',
                    students: studentsBuild.students,
                    vectorState,
                    axisThemeIds,
                    projectionMode: 'energy_components',
                    projectionWeights: {
                        wPref: Number.isFinite(Number(wPref)) ? Number(wPref) : 1.0,
                        wDup: Number.isFinite(Number(wDup)) ? Number(wDup) : 0.9,
                        wDiv: Number.isFinite(Number(wDiv)) ? Number(wDiv) : 0.35,
                        wSoc: 1.0,
                    },
                    lambdaVec: Number(req.body?.lambdaVec ?? 0.35),
                    snapshotEvery: Number(req.body?.snapshotEvery ?? 8),
                },
            });
            await database.saveSolution(distributionId, result.solution);
            await database.updateDistributionStatus(distributionId, 'COMPLETED');
            simulationRunManager.setVectorSnapshot(distributionId, vectorState.toSnapshot());
            const pendingState = await database.updateDistributionExecutionPendingFlags(distributionId, {
                phase1NeedsRerun: false,
                phase2NeedsRerun: hasCompletedPhase2(previousStatus) ? true : undefined,
            });
            simulationExecutionMetaByDistribution.set(distributionId, {
                phase1: {
                    executedAt: new Date().toISOString(),
                    totalEnergy: result.solution.getTotalEnergy(),
                },
                phase2: null,
            });
            const metrics = await buildSimulationMetricsPayload(distributionId, themes, result.solution.groups, {
                includePhase2Energy: false,
            });
            res.status(200).json({
                success: true,
                data: {
                    distributionId,
                    phase: 'PHASE1_COMPLETED',
                    groupsCount: result.solution.getGroupCount(),
                    executionTime: result.executionTime,
                    report: result.report,
                    phase1NeedsRerun: pendingState?.phase1_needs_rerun ?? false,
                    phase2NeedsRerun: pendingState?.phase2_needs_rerun ?? false,
                    axisThemeIds,
                    finalPositions: vectorState.projectTo3D(axisThemeIds, studentsBuild.students, result.solution.groups, buildEnergyProjectionConfig({
                        wPref,
                        wDup,
                        wDiv,
                    })),
                    metrics,
                },
            });
        }
        catch (error) {
            console.error('[simulation/execute-phase1] Error:', error);
            await database.updateDistributionStatus(distributionId, 'FAILED').catch(() => { });
            res.status(500).json({
                error: 'Erro ao executar Fase 1 de simulaÃ§Ã£o',
                message: error.message,
            });
        }
    }));
    router.post('/distributions/:distributionId/simulation/execute-phase2', authMiddleware, (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const organizerId = (0, auth_middleware_1.getOrganizerIdFromRequest)(req);
        const distributionId = req.params.distributionId;
        const { wSoc, maxIterations, temperature } = req.body || {};
        try {
            const distribution = await database.getDistribution(distributionId);
            if (!distribution) {
                return res.status(404).json({ error: 'DistribuiÃ§Ã£o nÃ£o encontrada' });
            }
            if (distribution.organizer_id !== organizerId) {
                return res.status(403).json({ error: 'VocÃª nÃ£o tem permissÃ£o para acessar esta distribuiÃ§Ã£o' });
            }
            await database.updateDistributionStatus(distributionId, 'PHASE2_EXECUTING');
            const studentsBuild = await buildStudentsWithPreferences(distributionId);
            const themesData = await database.getThemesByDistribution(distributionId);
            if (studentsBuild.students.length === 0 || themesData.length === 0) {
                return res.status(400).json({ error: 'Dados base nÃ£o encontrados para simulaÃ§Ã£o' });
            }
            const themes = buildThemes(distributionId, themesData);
            ensureThemeCapacityFeasibility(studentsBuild.students, themes);
            const axisThemeIds = [...SIMULATION_ENERGY_AXIS];
            const solutionData = await buildSolutionFromDatabase(distributionId, studentsBuild.studentsMap);
            if (!solutionData.groups.length) {
                return res.status(400).json({
                    error: 'Fase 1 da simulaÃ§Ã£o ainda nÃ£o foi executada',
                    message: 'Execute simulation/execute-phase1 antes de simulation/execute-phase2',
                });
            }
            const affinityMatrix = await buildAffinityMatrix(distributionId);
            const savedVectorSnapshot = simulationRunManager.getVectorSnapshot(distributionId);
            const vectorState = savedVectorSnapshot
                ? VectorState_1.VectorState.fromSnapshot(savedVectorSnapshot)
                : VectorState_1.VectorState.fromStudents(studentsBuild.students, themes);
            const beforeMetrics = await buildSimulationMetricsPayload(distributionId, themes, solutionData.solution.groups, {
                includePhase2Energy: true,
                wSoc,
            });
            const engine = new DistributionEngine_1.DistributionEngine();
            const result = await engine.solvePhase2(solutionData.solution, affinityMatrix, themes, {
                wSoc,
                maxIterations,
                temperature,
                simulationIdeal: true,
                enforceThemeCapacity: true,
                runtime: {
                    enabled: true,
                    runId: `adhoc_phase2_${Date.now()}`,
                    phase: 'phase2',
                    students: studentsBuild.students,
                    vectorState,
                    axisThemeIds,
                    projectionMode: 'energy_components',
                    projectionWeights: {
                        wPref: 1.0,
                        wDup: 0.9,
                        wDiv: 0.35,
                        wSoc: Number.isFinite(Number(wSoc)) ? Number(wSoc) : 1.0,
                    },
                    lambdaVec: Number(req.body?.lambdaVec ?? 0.35),
                    snapshotEvery: Number(req.body?.snapshotEvery ?? 8),
                    affinityMatrix,
                },
            });
            await database.clearDistributionGroups(distributionId);
            await database.saveSolution(distributionId, result.solution);
            await database.updateDistributionStatus(distributionId, 'PHASE2_COMPLETED');
            simulationRunManager.setVectorSnapshot(distributionId, vectorState.toSnapshot());
            const pendingState = await database.updateDistributionExecutionPendingFlags(distributionId, {
                phase2NeedsRerun: false,
            });
            const socialExecutionMeta = result.metrics.socialExecution || {
                attemptedSwaps: 0,
                swapsAccepted: 0,
                stabilityPercent: 100,
            };
            simulationExecutionMetaByDistribution.set(distributionId, {
                ...(simulationExecutionMetaByDistribution.get(distributionId) || {}),
                phase2: {
                    executedAt: new Date().toISOString(),
                    ...socialExecutionMeta,
                },
            });
            const afterMetrics = await buildSimulationMetricsPayload(distributionId, themes, result.solution.groups, {
                includePhase2Energy: true,
                wSoc,
                executionMeta: {
                    swapsAccepted: socialExecutionMeta.swapsAccepted,
                    stabilityPercent: socialExecutionMeta.stabilityPercent,
                },
            });
            res.status(200).json({
                success: true,
                data: {
                    distributionId,
                    phase: 'PHASE2_COMPLETED',
                    executionTime: result.executionTime,
                    report: result.report,
                    phase1NeedsRerun: pendingState?.phase1_needs_rerun ?? false,
                    phase2NeedsRerun: pendingState?.phase2_needs_rerun ?? false,
                    before: beforeMetrics,
                    after: afterMetrics,
                    changes: result.metrics.changes,
                    socialExecution: socialExecutionMeta,
                    axisThemeIds,
                    finalPositions: vectorState.projectTo3D(axisThemeIds, studentsBuild.students, result.solution.groups, buildEnergyProjectionConfig({
                        wPref: 1.0,
                        wDup: 0.9,
                        wDiv: 0.35,
                        wSoc,
                        affinityMatrix,
                    })),
                },
            });
        }
        catch (error) {
            console.error('[simulation/execute-phase2] Error:', error);
            await database.updateDistributionStatus(distributionId, 'FAILED').catch(() => { });
            res.status(500).json({
                error: 'Erro ao executar Fase 2 de simulaÃ§Ã£o',
                message: error.message,
            });
        }
    }));
    router.post('/distributions/:distributionId/simulation/runs/start-phase1', authMiddleware, (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const organizerId = (0, auth_middleware_1.getOrganizerIdFromRequest)(req);
        const distributionId = req.params.distributionId;
        const { wPref, wDup, wDiv, lambdaVec, snapshotEvery } = req.body || {};
        const distribution = await database.getDistribution(distributionId);
        if (!distribution) {
            return res.status(404).json({ error: 'DistribuiÃ§Ã£o nÃ£o encontrada' });
        }
        if (distribution.organizer_id !== organizerId) {
            return res.status(403).json({ error: 'VocÃª nÃ£o tem permissÃ£o para acessar esta distribuiÃ§Ã£o' });
        }
        const studentsBuild = await buildStudentsWithPreferences(distributionId);
        const themesData = await database.getThemesByDistribution(distributionId);
        if (studentsBuild.students.length === 0) {
            return res.status(400).json({ error: 'Nenhum aluno registrado na distribuiÃ§Ã£o' });
        }
        if (!themesData.length) {
            return res.status(400).json({ error: 'Nenhum tema registrado na distribuiÃ§Ã£o' });
        }
        const themes = buildThemes(distributionId, themesData);
        ensureThemeCapacityFeasibility(studentsBuild.students, themes);
        const axisThemeIds = [...SIMULATION_ENERGY_AXIS];
        const vectorState = VectorState_1.VectorState.fromStudents(studentsBuild.students, themes);
        const initialPositions = vectorState.projectTo3D(axisThemeIds, studentsBuild.students, undefined, buildEnergyProjectionConfig({
            wPref,
            wDup,
            wDiv,
        }));
        const runStarted = simulationRunManager.createRun(distributionId, organizerId, 'phase1', axisThemeIds, initialPositions);
        res.status(202).json({
            success: true,
            data: runStarted,
        });
        void (async () => {
            const previousStatus = normalizeDistributionStatus(distribution.status);
            try {
                await database.updateDistributionStatus(distributionId, 'EXECUTING');
                const engine = new DistributionEngine_1.DistributionEngine(wPref !== undefined || wDup !== undefined || wDiv !== undefined
                    ? { wPref, wDup, wDiv }
                    : undefined);
                const validation = engine.validateScenario(studentsBuild.students, themes);
                if (!validation.isFeasible) {
                    throw new Error(`CenÃ¡rio infeasÃ­vel: ${validation.issues.join(', ')}`);
                }
                await database.clearDistributionGroups(distributionId);
                const result = await engine.solvePhase1(studentsBuild.students, themes, {
                    simulationIdeal: true,
                    enforceThemeCapacity: true,
                    runtime: {
                        enabled: true,
                        runId: runStarted.runId,
                        phase: 'phase1',
                        students: studentsBuild.students,
                        vectorState,
                        axisThemeIds,
                        projectionMode: 'energy_components',
                        projectionWeights: {
                            wPref: Number.isFinite(Number(wPref)) ? Number(wPref) : 1.0,
                            wDup: Number.isFinite(Number(wDup)) ? Number(wDup) : 0.9,
                            wDiv: Number.isFinite(Number(wDiv)) ? Number(wDiv) : 0.35,
                            wSoc: 1.0,
                        },
                        lambdaVec: Number(lambdaVec ?? 0.35),
                        snapshotEvery: Number(snapshotEvery ?? 8),
                        onSnapshot: (snapshot) => simulationRunManager.publishSnapshot(runStarted.runId, snapshot),
                    },
                });
                await database.saveSolution(distributionId, result.solution);
                await database.updateDistributionStatus(distributionId, 'COMPLETED');
                simulationRunManager.setVectorSnapshot(distributionId, vectorState.toSnapshot());
                const pendingState = await database.updateDistributionExecutionPendingFlags(distributionId, {
                    phase1NeedsRerun: false,
                    phase2NeedsRerun: hasCompletedPhase2(previousStatus) ? true : undefined,
                });
                simulationExecutionMetaByDistribution.set(distributionId, {
                    phase1: {
                        executedAt: new Date().toISOString(),
                        totalEnergy: result.solution.getTotalEnergy(),
                    },
                    phase2: null,
                });
                const metrics = await buildSimulationMetricsPayload(distributionId, themes, result.solution.groups, {
                    includePhase2Energy: false,
                });
                const completedPayload = {
                    runId: runStarted.runId,
                    distributionId,
                    phase: 'phase1',
                    executionTime: result.executionTime,
                    axisThemeIds,
                    metrics,
                    groups: metrics.groups,
                    phase1NeedsRerun: pendingState?.phase1_needs_rerun ?? false,
                    phase2NeedsRerun: pendingState?.phase2_needs_rerun ?? false,
                    finalPositions: vectorState.projectTo3D(axisThemeIds, studentsBuild.students, result.solution.groups, buildEnergyProjectionConfig({
                        wPref,
                        wDup,
                        wDiv,
                    })),
                    completedAt: new Date().toISOString(),
                };
                simulationRunManager.completeRun(runStarted.runId, completedPayload);
            }
            catch (error) {
                console.error('[simulation/runs/start-phase1] Error:', error);
                await database.updateDistributionStatus(distributionId, 'FAILED').catch(() => { });
                simulationRunManager.failRun(runStarted.runId, error.message || 'Falha ao executar fase 1 ao vivo');
            }
        })();
    }));
    router.post('/distributions/:distributionId/simulation/runs/start-phase2', authMiddleware, (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const organizerId = (0, auth_middleware_1.getOrganizerIdFromRequest)(req);
        const distributionId = req.params.distributionId;
        const { wSoc, maxIterations, temperature, lambdaVec, snapshotEvery } = req.body || {};
        const distribution = await database.getDistribution(distributionId);
        if (!distribution) {
            return res.status(404).json({ error: 'DistribuiÃ§Ã£o nÃ£o encontrada' });
        }
        if (distribution.organizer_id !== organizerId) {
            return res.status(403).json({ error: 'VocÃª nÃ£o tem permissÃ£o para acessar esta distribuiÃ§Ã£o' });
        }
        const studentsBuild = await buildStudentsWithPreferences(distributionId);
        const themesData = await database.getThemesByDistribution(distributionId);
        if (studentsBuild.students.length === 0 || !themesData.length) {
            return res.status(400).json({ error: 'Dados base nÃ£o encontrados para simulaÃ§Ã£o' });
        }
        const themes = buildThemes(distributionId, themesData);
        ensureThemeCapacityFeasibility(studentsBuild.students, themes);
        const solutionData = await buildSolutionFromDatabase(distributionId, studentsBuild.studentsMap);
        if (!solutionData.groups.length) {
            return res.status(400).json({
                error: 'Fase 1 da simulaÃ§Ã£o ainda nÃ£o foi executada',
                message: 'Execute simulation/execute-phase1 antes de simulation/runs/start-phase2',
            });
        }
        const axisThemeIds = [...SIMULATION_ENERGY_AXIS];
        const savedVectorSnapshot = simulationRunManager.getVectorSnapshot(distributionId);
        const vectorState = savedVectorSnapshot
            ? VectorState_1.VectorState.fromSnapshot(savedVectorSnapshot)
            : VectorState_1.VectorState.fromStudents(studentsBuild.students, themes);
        const affinityMatrix = await buildAffinityMatrix(distributionId);
        const initialPositions = vectorState.projectTo3D(axisThemeIds, studentsBuild.students, solutionData.solution.groups, buildEnergyProjectionConfig({
            wPref: 1.0,
            wDup: 0.9,
            wDiv: 0.35,
            wSoc,
            affinityMatrix,
        }));
        const runStarted = simulationRunManager.createRun(distributionId, organizerId, 'phase2', axisThemeIds, initialPositions);
        res.status(202).json({
            success: true,
            data: runStarted,
        });
        void (async () => {
            try {
                await database.updateDistributionStatus(distributionId, 'PHASE2_EXECUTING');
                const beforeMetrics = await buildSimulationMetricsPayload(distributionId, themes, solutionData.solution.groups, {
                    includePhase2Energy: true,
                    wSoc,
                });
                const engine = new DistributionEngine_1.DistributionEngine();
                const result = await engine.solvePhase2(solutionData.solution, affinityMatrix, themes, {
                    wSoc,
                    maxIterations,
                    temperature,
                    simulationIdeal: true,
                    enforceThemeCapacity: true,
                    runtime: {
                        enabled: true,
                        runId: runStarted.runId,
                        phase: 'phase2',
                        students: studentsBuild.students,
                        vectorState,
                        axisThemeIds,
                        projectionMode: 'energy_components',
                        projectionWeights: {
                            wPref: 1.0,
                            wDup: 0.9,
                            wDiv: 0.35,
                            wSoc: Number.isFinite(Number(wSoc)) ? Number(wSoc) : 1.0,
                        },
                        lambdaVec: Number(lambdaVec ?? 0.35),
                        snapshotEvery: Number(snapshotEvery ?? 8),
                        affinityMatrix,
                        onSnapshot: (snapshot) => simulationRunManager.publishSnapshot(runStarted.runId, snapshot),
                    },
                });
                await database.clearDistributionGroups(distributionId);
                await database.saveSolution(distributionId, result.solution);
                await database.updateDistributionStatus(distributionId, 'PHASE2_COMPLETED');
                simulationRunManager.setVectorSnapshot(distributionId, vectorState.toSnapshot());
                const pendingState = await database.updateDistributionExecutionPendingFlags(distributionId, {
                    phase2NeedsRerun: false,
                });
                const socialExecutionMeta = result.metrics.socialExecution || {
                    attemptedSwaps: 0,
                    swapsAccepted: 0,
                    stabilityPercent: 100,
                };
                simulationExecutionMetaByDistribution.set(distributionId, {
                    ...(simulationExecutionMetaByDistribution.get(distributionId) || {}),
                    phase2: {
                        executedAt: new Date().toISOString(),
                        ...socialExecutionMeta,
                    },
                });
                const afterMetrics = await buildSimulationMetricsPayload(distributionId, themes, result.solution.groups, {
                    includePhase2Energy: true,
                    wSoc,
                    executionMeta: {
                        swapsAccepted: socialExecutionMeta.swapsAccepted,
                        stabilityPercent: socialExecutionMeta.stabilityPercent,
                    },
                });
                const completedPayload = {
                    runId: runStarted.runId,
                    distributionId,
                    phase: 'phase2',
                    executionTime: result.executionTime,
                    axisThemeIds,
                    before: beforeMetrics,
                    after: afterMetrics,
                    groups: afterMetrics.groups,
                    changes: result.metrics.changes,
                    phase1NeedsRerun: pendingState?.phase1_needs_rerun ?? false,
                    phase2NeedsRerun: pendingState?.phase2_needs_rerun ?? false,
                    socialExecution: socialExecutionMeta,
                    finalPositions: vectorState.projectTo3D(axisThemeIds, studentsBuild.students, result.solution.groups, buildEnergyProjectionConfig({
                        wPref: 1.0,
                        wDup: 0.9,
                        wDiv: 0.35,
                        wSoc,
                        affinityMatrix,
                    })),
                    completedAt: new Date().toISOString(),
                };
                simulationRunManager.completeRun(runStarted.runId, completedPayload);
            }
            catch (error) {
                console.error('[simulation/runs/start-phase2] Error:', error);
                await database.updateDistributionStatus(distributionId, 'FAILED').catch(() => { });
                simulationRunManager.failRun(runStarted.runId, error.message || 'Falha ao executar fase 2 ao vivo');
            }
        })();
    }));
    router.get('/simulation/runs/:runId/stream', async (req, res) => {
        try {
            const runId = req.params.runId;
            const token = String(req.query?.access_token || '');
            if (!token) {
                return res.status(401).json({ error: 'Token de acesso ausente para stream SSE' });
            }
            const decoded = await authService.verifyToken(token);
            const run = simulationRunManager.getRun(runId);
            if (!run) {
                return res.status(404).json({ error: 'ExecuÃ§Ã£o de simulaÃ§Ã£o nÃ£o encontrada' });
            }
            if (run.organizerId !== decoded.organizerId) {
                return res.status(403).json({ error: 'VocÃª nÃ£o tem permissÃ£o para acompanhar esta execuÃ§Ã£o' });
            }
            setRunSseHeaders(res);
            writeSseEvent(res, 'connected', {
                runId,
                connectedAt: new Date().toISOString(),
            });
            for (const event of simulationRunManager.getRunEvents(runId)) {
                writeSseEvent(res, event.type, event.payload);
            }
            const heartbeat = setInterval(() => {
                res.write(`: ping ${Date.now()}\n\n`);
            }, 15000);
            const unsubscribe = simulationRunManager.subscribe(runId, (event) => {
                writeSseEvent(res, event.type, event.payload);
                if (event.type === 'phase_completed' || event.type === 'run_error') {
                    clearInterval(heartbeat);
                    unsubscribe();
                    res.end();
                }
            });
            req.on('close', () => {
                clearInterval(heartbeat);
                unsubscribe();
            });
        }
        catch (error) {
            console.error('[simulation/runs/stream] Error:', error);
            if (!res.headersSent) {
                return res.status(401).json({
                    error: 'NÃ£o autorizado para acessar stream da simulaÃ§Ã£o',
                    message: error.message,
                });
            }
            res.end();
        }
    });
    router.get('/simulation/runs/:runId/result', authMiddleware, (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const organizerId = (0, auth_middleware_1.getOrganizerIdFromRequest)(req);
        const runId = req.params.runId;
        const run = simulationRunManager.getRun(runId);
        if (!run) {
            return res.status(404).json({ error: 'ExecuÃ§Ã£o de simulaÃ§Ã£o nÃ£o encontrada' });
        }
        if (run.organizerId !== organizerId) {
            return res.status(403).json({ error: 'VocÃª nÃ£o tem permissÃ£o para acessar esta execuÃ§Ã£o' });
        }
        const result = simulationRunManager.getRunResult(runId);
        res.status(200).json({
            success: true,
            data: serializeSimulationRunResult(run, result),
        });
    }));
    router.get('/distributions/:distributionId/simulation/metrics', authMiddleware, (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const organizerId = (0, auth_middleware_1.getOrganizerIdFromRequest)(req);
        const distributionId = req.params.distributionId;
        try {
            const distribution = await database.getDistribution(distributionId);
            if (!distribution) {
                return res.status(404).json({ error: 'DistribuiÃ§Ã£o nÃ£o encontrada' });
            }
            if (distribution.organizer_id !== organizerId) {
                return res.status(403).json({ error: 'VocÃª nÃ£o tem permissÃ£o para acessar esta distribuiÃ§Ã£o' });
            }
            const studentsBuild = await buildStudentsWithPreferences(distributionId);
            const themesData = await database.getThemesByDistribution(distributionId);
            const themes = buildThemes(distributionId, themesData || []);
            const solutionData = await buildSolutionFromDatabase(distributionId, studentsBuild.studentsMap);
            const status = normalizeDistributionStatus(distribution.status);
            const includePhase2Energy = status === 'PHASE2_COMPLETED';
            const executionMeta = simulationExecutionMetaByDistribution.get(distributionId)?.phase2 || {
                swapsAccepted: 0,
                stabilityPercent: 100,
            };
            const metrics = await buildSimulationMetricsPayload(distributionId, themes, solutionData.solution.groups, {
                includePhase2Energy,
                executionMeta,
            });
            res.status(200).json({
                success: true,
                data: {
                    distributionId,
                    ...metrics,
                },
            });
        }
        catch (error) {
            console.error('[simulation/metrics] Error:', error);
            res.status(500).json({
                error: 'Erro ao buscar mÃ©tricas de simulaÃ§Ã£o',
                message: error.message,
            });
        }
    }));
    router.get('/distributions/:distributionId/simulation/groups', authMiddleware, (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const organizerId = (0, auth_middleware_1.getOrganizerIdFromRequest)(req);
        const distributionId = req.params.distributionId;
        try {
            const distribution = await database.getDistribution(distributionId);
            if (!distribution) {
                return res.status(404).json({ error: 'DistribuiÃ§Ã£o nÃ£o encontrada' });
            }
            if (distribution.organizer_id !== organizerId) {
                return res.status(403).json({ error: 'VocÃª nÃ£o tem permissÃ£o para acessar esta distribuiÃ§Ã£o' });
            }
            const studentsBuild = await buildStudentsWithPreferences(distributionId);
            const themesData = await database.getThemesByDistribution(distributionId);
            const themes = buildThemes(distributionId, themesData || []);
            const solutionData = await buildSolutionFromDatabase(distributionId, studentsBuild.studentsMap);
            const status = normalizeDistributionStatus(distribution.status);
            const includePhase2Energy = status === 'PHASE2_COMPLETED';
            const executionMeta = simulationExecutionMetaByDistribution.get(distributionId)?.phase2 || {
                swapsAccepted: 0,
                stabilityPercent: 100,
            };
            const metrics = await buildSimulationMetricsPayload(distributionId, themes, solutionData.solution.groups, {
                includePhase2Energy,
                executionMeta,
            });
            res.status(200).json({
                success: true,
                data: {
                    distributionId,
                    groupsCount: metrics.groups.length,
                    groups: metrics.groups,
                },
            });
        }
        catch (error) {
            console.error('[simulation/groups] Error:', error);
            res.status(500).json({
                error: 'Erro ao buscar grupos da simulaÃ§Ã£o',
                message: error.message,
            });
        }
    }));
    router.get('/distributions/:distributionId/simulation/visual-state', authMiddleware, (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const organizerId = (0, auth_middleware_1.getOrganizerIdFromRequest)(req);
        const distributionId = req.params.distributionId;
        try {
            const distribution = await database.getDistribution(distributionId);
            if (!distribution) {
                return res.status(404).json({ error: 'DistribuiÃ§Ã£o nÃ£o encontrada' });
            }
            if (distribution.organizer_id !== organizerId) {
                return res.status(403).json({ error: 'VocÃª nÃ£o tem permissÃ£o para acessar esta distribuiÃ§Ã£o' });
            }
            const studentsBuild = await buildStudentsWithPreferences(distributionId);
            const themesData = await database.getThemesByDistribution(distributionId);
            const orderedThemesData = orderThemesForVisualState(themesData);
            const themes = buildThemes(distributionId, orderedThemesData || []);
            const themeById = new Map(themes.map((theme) => [theme.id, theme]));
            const themeIds = themes.map((theme) => theme.id);
            const solutionData = await buildSolutionFromDatabase(distributionId, studentsBuild.studentsMap);
            const affinityMatrix = await buildAffinityMatrix(distributionId);
            const partition = (0, simulationVisualState_helpers_1.buildVisualPartition)(solutionData.solution.groups, studentsBuild.students, themeById);
            const isolationScoreByStudentId = (0, simulationVisualState_helpers_1.buildIsolationScoreByStudentId)(partition, affinityMatrix);
            const hasIsolationScores = Object.keys(isolationScoreByStudentId).length > 0;
            res.status(200).json({
                success: true,
                data: {
                    distributionId,
                    themes: themes.map((theme, index) => ({
                        id: theme.id,
                        name: theme.name,
                        index,
                    })),
                    students: (0, simulationVisualState_helpers_1.buildVisualStudents)(studentsBuild.students, themeIds),
                    partition,
                    affinities: (0, simulationVisualState_helpers_1.buildVisualAffinities)(affinityMatrix),
                    isolationScoreByStudentId: hasIsolationScores ? isolationScoreByStudentId : undefined,
                    updatedAt: new Date().toISOString(),
                },
            });
        }
        catch (error) {
            console.error('[simulation/visual-state] Error:', error);
            res.status(500).json({
                error: 'Erro ao buscar estado visual da simulaÃ§Ã£o',
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
            if (seedInFlightByDistribution.has(distributionId)) {
                return res.status(409).json({
                    error: 'Geração de seed já está em andamento para esta distribuição',
                });
            }
            seedInFlightByDistribution.add(distributionId);
            // Verificar permissÃ£o
            const distribution = await database.getDistribution(distributionId);
            if (!distribution) {
                seedInFlightByDistribution.delete(distributionId);
                return res.status(404).json({
                    error: 'DistribuiÃ§Ã£o nÃ£o encontrada',
                });
            }
            if (distribution.organizer_id !== organizerId) {
                seedInFlightByDistribution.delete(distributionId);
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
            seedInFlightByDistribution.delete(distributionId);
        }
        catch (error) {
            seedInFlightByDistribution.delete(req.params.distributionId);
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



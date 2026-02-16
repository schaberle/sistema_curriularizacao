import random, math
from collections import defaultdict

# entradas esperadas:
# - grupos: lista de grupos, cada grupo é lista de dicts de aluno (com "id", "curso", "fase", "ranking", "score")
# - tema_grupo: dict {idx_grupo: tema}
# - func energia_grupo(membros, tema) da fase 1

# hiperparâmetros sociais
W_SOC = 1.0           # aumenta pra forçar mais trocas
P_MANIFEST = 0.13     # % de pares que "se manifestam" (aprox)
BIAS_INTRA = 4.0      # mais chance de manifestar dentro do grupo do que fora

N_ITERS_SOC = 20000
TEMP0_SOC = 0.8

# --- 1) construir mapa id -> índice e grupos atuais
alunos_all = [a for g in grupos for a in g]
ids = [a["id"] for a in alunos_all]
id_to_idx = {ids[i]: i for i in range(len(ids))}

# --- 2) gerar afinidades esparsas A (somente para pares manifestados)
A = defaultdict(float)  # chave (i,j) com i<j

def set_A(i, j, v):
    if i == j: return
    if i > j: i, j = j, i
    A[(i, j)] = max(-1.0, min(1.0, v))

def get_A(i, j):
    if i == j: return 0.0
    if i > j: i, j = j, i
    return A.get((i, j), 0.0)

# helper: alunos por grupo em índices
grupos_idx = [[id_to_idx[a["id"]] for a in g] for g in grupos]

# probabilidade maior de manifestar intra-grupo
def p_manifest(i, j):
    # checa se estão no mesmo grupo
    same = False
    for g in grupos_idx:
        if i in g and j in g:
            same = True
            break
    base = P_MANIFEST
    return min(1.0, base * (BIAS_INTRA if same else 1.0))

# gera afinidades aleatórias: mistura de positivo/negativo
for i in range(len(ids)):
    for j in range(i+1, len(ids)):
        if random.random() < p_manifest(i, j):
            # distribuição com mais positivo que negativo (ajustável)
            v = random.gauss(0.25, 0.35)
            set_A(i, j, v)

# --- 3) energia social do grupo
def energia_social_grupo(membros_idx):
    # soma de pares dentro do grupo
    s = 0.0
    for a in range(len(membros_idx)):
        for b in range(a+1, len(membros_idx)):
            s += get_A(membros_idx[a], membros_idx[b])
    return -W_SOC * s

# --- 4) energia total do grupo na fase 2
# OBS: aqui você soma energia_grupo(...) (pref+fase+máscara dura) + energia_social_grupo(...)
def energia_grupo_fase2(membros, tema):
    e_base = energia_grupo(membros, tema)
    if math.isinf(e_base):
        return float("inf")
    membros_idx = [id_to_idx[a["id"]] for a in membros]
    return e_base + energia_social_grupo(membros_idx)

def melhor_tema_para_grupo_fase2(membros):
    best_t, best_e = None, float("inf")
    for t in temas:
        e = energia_grupo_fase2(membros, t)
        if e < best_e:
            best_t, best_e = e, t
    return best_t, best_e

# --- 5) isolamento S(i,g) pra guiar candidato
def isolamento(i_idx, grupo_idx_list):
    return sum(get_A(i_idx, j) for j in grupo_idx_list if j != i_idx)

# --- 6) otimização social por swaps
energia_cache2 = {}
for gi in range(len(grupos)):
    t = tema_grupo[gi]
    energia_cache2[gi] = energia_grupo_fase2(grupos[gi], t)

def energia_total2():
    return sum(energia_cache2.values())

for it in range(N_ITERS_SOC):
    T = max(1e-6, TEMP0_SOC * (1 - it / N_ITERS_SOC))

    # escolhe um grupo e um candidato "isolado"
    gi = random.randrange(len(grupos))
    g_list = grupos_idx[gi]
    # escolhe aluno com viés para menor isolamento
    scores = []
    for i_idx in g_list:
        s = isolamento(i_idx, g_list)
        scores.append((math.exp(-s), i_idx))
    total = sum(w for w,_ in scores)
    r = random.random() * total
    acc = 0.0
    pick = scores[0][1]
    for w, i_idx in scores:
        acc += w
        if acc >= r:
            pick = i_idx
            break

    # acha posição desse aluno no grupo gi
    ai = g_list.index(pick)

    # escolhe outro grupo e aluno aleatório
    gj = random.randrange(len(grupos))
    if gj == gi:
        continue
    bj = random.randrange(len(grupos[gj]))

    # swap em nível de dict de aluno
    ga, gb = grupos[gi], grupos[gj]
    a, b = ga[ai], gb[bj]

    ga2, gb2 = ga[:], gb[:]
    ga2[ai], gb2[bj] = b, a

    # recalcula melhor tema em cada grupo (fase 2)
    t_i, e_i = melhor_tema_para_grupo_fase2(ga2)
    t_j, e_j = melhor_tema_para_grupo_fase2(gb2)

    if math.isinf(e_i) or math.isinf(e_j):
        continue

    dE = (e_i + e_j) - (energia_cache2[gi] + energia_cache2[gj])
    if dE < 0 or random.random() < math.exp(-dE / T):
        grupos[gi], grupos[gj] = ga2, gb2
        tema_grupo[gi], tema_grupo[gj] = t_i, t_j
        energia_cache2[gi], energia_cache2[gj] = e_i, e_j

        # atualiza também as versões idx (pra isolamento ficar consistente)
        grupos_idx[gi] = [id_to_idx[x["id"]] for x in grupos[gi]]
        grupos_idx[gj] = [id_to_idx[x["id"]] for x in grupos[gj]]

print("energia total fase 2:", energia_total2())

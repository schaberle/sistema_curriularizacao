import random, math
from collections import Counter

SEED = 99
random.seed(SEED)

PHASES = [1, 3, 5, 7, 9]
mec_counts = {1: 40, 3: 20, 5: 10, 7: 5, 9: 2}
ele_counts = {1: 30, 3: 15, 5: 7, 7: 3, 9: 1}

TAM_GRUPO = 4
N_TEMAS = 8
temas = [f"T{t+1}" for t in range(N_TEMAS)]

W_PREF = 1.0
W_DUP_FASE = 0.9
W_NOVA_FASE = 0.35

N_ITERS_SWAP = 20000
TEMP0 = 0.7

def ranking_to_scores(ranking):
    base = [100, 70, 50, 35, 25, 18, 12, 8]
    return {t: base[i] if i < len(base) else max(0, 8 - (i - len(base) + 1))
            for i, t in enumerate(ranking)}

def normalize_scores(scores_dict):
    mx, mn = max(scores_dict.values()), min(scores_dict.values())
    if mx == mn:
        return {k: 0.0 for k in scores_dict}
    return {k: (v - mn) / (mx - mn) for k, v in scores_dict.items()}

def mk_aluno(idx, curso, fase):
    phase_pos = PHASES.index(fase) / (len(PHASES) - 1)
    tema_pref = int(round(phase_pos * (N_TEMAS - 1)))

    pool = temas[:]
    pool.sort(key=lambda t: (0 if int(t[1:]) - 1 == tema_pref else 1, random.random()))
    ranking = pool[:]
    s_raw = ranking_to_scores(ranking)
    s = normalize_scores(s_raw)
    return {
        "id": f"A{idx:03d}",
        "curso": curso,
        "fase": fase,
        "ranking": ranking,
        "score": s,
        "score_raw": s_raw,
    }

alunos = []
idx = 1
for fase in PHASES:
    for _ in range(mec_counts[fase]):
        alunos.append(mk_aluno(idx, "mecanica", fase)); idx += 1
    for _ in range(ele_counts[fase]):
        alunos.append(mk_aluno(idx, "eletrica", fase)); idx += 1

def eletricas_no_grupo(membros):
    return sum(1 for a in membros if a["curso"] == "eletrica")

def fases_distintas(membros):
    return len({a["fase"] for a in membros})

def grupo_viavel(membros):
    if len(membros) != TAM_GRUPO:
        return False
    e = eletricas_no_grupo(membros)
    if not (1 <= e <= 2):
        return False
    if fases_distintas(membros) < 2:
        return False
    return True

def energia_grupo(membros, tema):
    if len(membros) != TAM_GRUPO:
        return float("inf")
    e = eletricas_no_grupo(membros)
    if e < 1 or e > 2:
        return float("inf")
    fd = fases_distintas(membros)
    if fd < 2:
        return float("inf")

    e_pref = -W_PREF * sum(a["score"][tema] for a in membros)

    fases = [a["fase"] for a in membros]
    c = Counter(fases)
    dup = sum(v - 1 for v in c.values() if v > 1)
    e_fase = W_DUP_FASE * dup - W_NOVA_FASE * fd
    return e_pref + e_fase

def melhor_tema_para_grupo(membros):
    best_t, best_e = None, float("inf")
    for t in temas:
        e = energia_grupo(membros, t)
        if e < best_e:
            best_t, best_e = t, e
    return best_t, best_e

N = len(alunos)
G = N // TAM_GRUPO
sobram = N - G*TAM_GRUPO

eletricas = [a for a in alunos if a["curso"] == "eletrica"]
mecanicas = [a for a in alunos if a["curso"] == "mecanica"]
random.shuffle(eletricas); random.shuffle(mecanicas)

grupos = [[] for _ in range(G)]

for i in range(G):
    if eletricas:
        grupos[i].append(eletricas.pop())

i = 0
while eletricas and i < 10000:
    gi = i % G
    if eletricas_no_grupo(grupos[gi]) < 2 and len(grupos[gi]) < TAM_GRUPO:
        grupos[gi].append(eletricas.pop())
    i += 1

for i in range(G):
    while len(grupos[i]) < TAM_GRUPO and mecanicas:
        fases_pres = {a["fase"] for a in grupos[i]}
        cand_idx = next((j for j,a in enumerate(mecanicas) if a["fase"] not in fases_pres), None)
        if cand_idx is None:
            grupos[i].append(mecanicas.pop())
        else:
            grupos[i].append(mecanicas.pop(cand_idx))

tema_grupo = {}
energia_cache = {}
for i in range(G):
    t, e = melhor_tema_para_grupo(grupos[i])
    tema_grupo[i] = t
    energia_cache[i] = e

def energia_total():
    return sum(energia_cache.values())

for it in range(N_ITERS_SWAP):
    temp = max(1e-6, TEMP0 * (1 - it / N_ITERS_SWAP))
    i, j = random.sample(range(G), 2)
    ai, bj = random.randrange(TAM_GRUPO), random.randrange(TAM_GRUPO)

    ga, gb = grupos[i], grupos[j]
    a, b = ga[ai], gb[bj]

    ga2, gb2 = ga[:], gb[:]
    ga2[ai], gb2[bj] = b, a

    t_i, e_i = melhor_tema_para_grupo(ga2)
    t_j, e_j = melhor_tema_para_grupo(gb2)
    if math.isinf(e_i) or math.isinf(e_j):
        continue

    dE = (e_i + e_j) - (energia_cache[i] + energia_cache[j])
    if dE < 0 or random.random() < math.exp(-dE / temp):
        grupos[i], grupos[j] = ga2, gb2
        tema_grupo[i], tema_grupo[j] = t_i, t_j
        energia_cache[i], energia_cache[j] = e_i, e_j

# métricas
alloc = []
for i in range(G):
    t = tema_grupo[i]
    for a in grupos[i]:
        alloc.append(a["ranking"].index(t) + 1)

top1 = sum(1 for p in alloc if p == 1) / len(alloc)
top2 = sum(1 for p in alloc if p <= 2) / len(alloc)
top3 = sum(1 for p in alloc if p <= 3) / len(alloc)
pos_media = sum(alloc) / len(alloc)

print("alunos:", N, "grupos:", G, "sobram:", sobram)
print("grupos viáveis:", sum(1 for i in range(G) if grupo_viavel(grupos[i])), "/", G)
print("top1/top2/top3:", top1, top2, top3)
print("posição média:", pos_media)

const API_URL = '/api/squadre';
let teams = [];
let allPartite = [];
let activeTeamId = null;
let activeMatchId = null;

let isReadonly = false;

window.onload = () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'readonly') {
        isReadonly = true;
        
        // Nascondi TUTTO tranne la classifica
        const header = document.querySelector('header');
        if (header) header.style.display = 'none';
        
        const nav = document.querySelector('nav');
        if (nav) nav.style.display = 'none';

        // Aggiungi un titolo pulito per gli ospiti
        document.body.insertAdjacentHTML('afterbegin', `
            <div class="readonly-header text-center py-4 mb-4 bg-white shadow-sm border-bottom">
                <h1 class="h3 fw-bold mb-1">🍺 BEERPONG <span class="text-warning">LIVE</span></h1>
                <p class="text-muted small mb-0">Classifica del Torneo</p>
            </div>
        `);
        
        switchTab('classifica');
        setInterval(loadTeams, 5000);
    }
    loadTeams();
};

async function loadTeams() {
    try {
        const response = await fetch(API_URL);
        teams = await response.json();
        renderTeams();
        renderLeaderboard();
    } catch (error) {
        console.error("Errore nel caricamento:", error);
    }
}

// ─── GESTIONE SQUADRE ───────────────────────────────────────

async function createTeam() {
    const input = document.getElementById('teamName');
    const gironeSelect = document.getElementById('teamGirone');
    const name = input.value.trim();
    if (!name) return;

    const newTeam = {
        nome: name,
        punti: 0,
        girone: parseInt(gironeSelect.value),
        giocatori: []
    };

    await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTeam)
    });

    input.value = '';
    loadTeams();
}

// NUOVA GESTIONE ELIMINAZIONE SINGOLA
function openDeleteSingleModal(id) {
    activeTeamId = id;
    const team = teams.find(t => t.id === id);
    document.getElementById('deleteSingleName').innerText = team.nome;
    document.getElementById('deleteSingleModal').style.display = 'flex';
}

async function confirmDeleteSingle() {
    await fetch(`${API_URL}/${activeTeamId}`, { method: 'DELETE' });
    closeModal('deleteSingleModal');
    loadTeams();
}

async function confirmDeleteAll() {
    await fetch(`${API_URL}/all`, { method: 'DELETE' });
    closeModal('deleteAllModal');
    loadTeams();
    loadPartite();
    switchTab('squadre'); // Torna alla creazione squadre
    showNotify("🗑️ Reset", "Torneo resettato con successo!", "info");
}

// ─── GESTIONE PUNTI ─────────────────────────────────────────

function openPointsModal(id) {
    activeTeamId = id;
    const team = teams.find(t => t.id === id);
    document.getElementById('pointsInput').value = team.punti;
    document.getElementById('pointsModal').style.display = 'flex';
}

async function confirmPoints() {
    const pts = parseInt(document.getElementById('pointsInput').value) || 0;
    await fetch(`${API_URL}/${activeTeamId}/punti`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pts)
    });
    closeModal('pointsModal');
    loadTeams();
}

// ─── GESTIONE UTENTI ────────────────────────────────────────

function openPlayerModal(id) {
    activeTeamId = id;
    const team = teams.find(t => t.id === id);
    document.getElementById('playerModalTeamName').innerText = team.nome;
    renderPlayersList();
    document.getElementById('playerModal').style.display = 'flex';
}

async function addPlayer() {
    const input = document.getElementById('playerNameInput');
    const name = input.value.trim();
    if (!name) return;
    const team = teams.find(t => t.id === activeTeamId);

    if (team.giocatori.length >= 2) {
        showNotify("Attenzione", "Massimo 2 giocatori per squadra nel Beer Pong!", "warning");
        return;
    }

    team.giocatori.push({ nome: name });
    await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(team)
    });
    input.value = '';
    renderPlayersList();
    renderTeams();
}

async function removePlayer(index) {
    const team = teams.find(t => t.id === activeTeamId);
    team.giocatori.splice(index, 1);
    await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(team)
    });
    renderPlayersList();
    renderTeams();
}

// ─── RENDERING ──────────────────────────────────────────────

function renderTeams() {
    const lists = {
        1: document.getElementById('list-girone1'),
        2: document.getElementById('list-girone2'),
        3: document.getElementById('list-girone3'),
        4: document.getElementById('list-girone4')
    };
    
    // Pulisci liste e contatori
    Object.keys(lists).forEach(key => {
        if (lists[key]) lists[key].innerHTML = '';
        const countElem = document.getElementById(`count-g${key}`);
        if (countElem) countElem.innerText = '0';
    });

    teams.forEach(t => {
        const div = document.createElement('div');
        div.className = 'team-card position-relative overflow-hidden shadow-sm mb-3 bg-white';
        div.innerHTML = `
            <div class="p-3 w-100">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <div>
                        <h5 class="fw-bold mb-1 text-dark" style="letter-spacing: -0.5px;">${t.nome}</h5>
                        <div class="d-flex align-items-center gap-2 mt-2">
                            ${t.sconfitte >= 2 ? 
                                '<span class="badge bg-danger bg-opacity-10 text-danger border border-danger rounded-pill" style="font-size: 0.65rem; padding: 0.35em 0.65em;">💀 ELIMINATA</span>' : 
                                `<span class="badge ${t.giocatori.length === 2 ? 'bg-success bg-opacity-10 text-success border border-success' : 'bg-warning bg-opacity-10 text-warning border border-warning'} rounded-pill" style="font-size: 0.65rem; padding: 0.35em 0.65em;">
                                    ${t.giocatori.length === 2 ? '✓ COMPLETA' : '⚠️ INCOMPLETA'}
                                </span>`
                            }
                            <span class="text-muted" style="font-size: 0.75rem; font-weight: 600;">👤 ${t.giocatori.length}/2</span>
                        </div>
                    </div>
                    <div class="d-flex gap-1">
                        <button class="btn btn-sm btn-light shadow-sm d-flex align-items-center justify-content-center border-0" style="width: 32px; height: 32px; border-radius: 10px;" onclick="openPlayerModal(${t.id})" title="Gestisci Giocatori">👥</button>
                        <button class="btn btn-sm shadow-sm d-flex align-items-center justify-content-center" style="width: 32px; height: 32px; border-radius: 10px; background: #ffe5e5; color: #dc3545; border: none;" onclick="openDeleteSingleModal(${t.id})" title="Elimina Squadra">✕</button>
                    </div>
                </div>
                
                <div class="d-flex justify-content-between align-items-center mt-3 pt-3 border-top" style="border-color: rgba(0,0,0,0.05) !important;">
                    <div class="d-flex gap-3 text-center">
                        <div>
                            <div class="text-muted" style="font-size: 0.65rem; text-transform: uppercase; font-weight: 800;">Vinte</div>
                            <div class="fw-bold text-success" style="font-size: 1.1rem; line-height: 1;">${t.vittorie}</div>
                        </div>
                        <div>
                            <div class="text-muted" style="font-size: 0.65rem; text-transform: uppercase; font-weight: 800;">Perse</div>
                            <div class="fw-bold text-danger" style="font-size: 1.1rem; line-height: 1;">${t.sconfitte}</div>
                        </div>
                        <div>
                            <div class="text-muted" style="font-size: 0.65rem; text-transform: uppercase; font-weight: 800;">Cups</div>
                            <div class="fw-bold text-primary" style="font-size: 1.1rem; line-height: 1;">${t.bicchieriFatti}</div>
                        </div>
                    </div>
                    <button class="btn btn-warning rounded-pill fw-bold shadow-sm px-3" style="font-size: 0.85rem;" onclick="openPointsModal(${t.id})">${t.punti} PT</button>
                </div>
            </div>
        `;
        if (lists[t.girone]) {
            lists[t.girone].appendChild(div);
            const countElem = document.getElementById(`count-g${t.girone}`);
            if (countElem) countElem.innerText = parseInt(countElem.innerText) + 1;
        }
    });
    
    // Gestione visibilità e testo tasto PROSSIMO ROUND
    fetch(`${API_URL}/partite`).then(res => res.json()).then(partite => {
        const btnInitial = document.getElementById('initial-gen-container');
        const btnNext = document.getElementById('btnNextRound');
        const activeTeams = teams.filter(t => t.sconfitte < 2);
        const hasTeams = teams.length >= 2;
        const noMatches = partite.length === 0;
        
        // Tasto iniziale in tab Squadre
        if (hasTeams && noMatches) {
            btnInitial.style.display = 'block';
        } else {
            btnInitial.style.display = 'none';
        }

        // Testo tasto in tab Partite
        if (activeTeams.length === 2) {
            btnNext.innerText = "🏆 GENERA FINALISSIMA";
            btnNext.classList.replace('btn-warning', 'btn-success');
        } else {
            btnNext.innerText = "🚀 PROSSIMO ROUND";
            btnNext.classList.replace('btn-success', 'btn-warning');
        }
    });

    checkForFinal();
    checkForTournamentEnd();
}

async function generateRandomMatches() {
    const matchResponse = await fetch(`${API_URL}/partite`);
    const currentMatches = await matchResponse.json();
    
    if (currentMatches.some(p => p.giocata && p.girone === 99)) { // 99 per la Finalissima
        showNotify("🏆 Torneo Finito", "Il torneo è già concluso!", "success");
        return;
    }

    const incomplete = currentMatches.filter(p => !p.giocata);
    if (currentMatches.length > 0 && incomplete.length > 0) {
        showNotify("⚠️ Round in corso", "Ci sono ancora dei match da giocare!", "warning");
        return;
    }

    const activeTeams = teams.filter(t => t.sconfitte < 2);
    if (activeTeams.length < 2) {
        showNotify("⚠️ Squadre insufficienti", "Servono almeno 2 squadre attive!", "warning");
        return;
    }

    if (activeTeams.length === 2) {
        showNotify("🏆 FINALISSIMA", "È il momento dello scontro finale!", "warning");
        await createBalancedMatches(activeTeams, 99); 
    } else if (activeTeams.length <= 4) {
        showNotify("🔥 SEMIFINALI", "I gironi si uniscono per la fase finale.", "warning");
        await createBalancedMatches(activeTeams, 88); // 88 per le semifinali
    } else {
        // Genera match per ogni girone che ha squadre
        const gironi = [1, 2, 3, 4];
        let matchGenerated = false;
        for (const g of gironi) {
            const teamsInGirone = activeTeams.filter(t => t.girone === g);
            if (teamsInGirone.length >= 2) {
                await createBalancedMatches(teamsInGirone, g);
                matchGenerated = true;
            }
        }
        
        if (!matchGenerated) {
            // Se nessun girone ha almeno 2 squadre ma il totale è > 4, uniamo tutto in un girone unico temporaneo
            showNotify("🔄 Unione Gironi", "Squadre sparse unite per procedere.", "info");
            await createBalancedMatches(activeTeams, 1);
        } else {
            showNotify("✅ Prossimo Round", "Nuove partite generate nei gironi!", "success");
        }
    }
    await loadPartite();
    switchTab('live');
}

async function createBalancedMatches(squadre, gironeNum) {
    if (gironeNum === 99 && squadre.length === 2) {
        const partita = {
            squadra1: { id: squadre[0].id },
            squadra2: { id: squadre[1].id },
            bicchieriSquadra1: 0,
            bicchieriSquadra2: 0,
            girone: 99,
            giocata: false
        };
        await fetch(`${API_URL}/partite/nuova`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(partita)
        });
        return;
    }

    const groups = {};
    squadre.forEach(s => {
        const key = `${s.vittorie}-${s.sconfitte}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(s);
    });

    for (const key in groups) {
        let shuffled = groups[key].sort(() => 0.5 - Math.random());
        for (let i = 0; i < shuffled.length - 1; i += 2) {
            const partita = {
                squadra1: { id: shuffled[i].id },
                squadra2: { id: shuffled[i+1].id },
                bicchieriSquadra1: 0,
                bicchieriSquadra2: 0,
                girone: gironeNum,
                giocata: false
            };
            await fetch(`${API_URL}/partite/nuova`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(partita)
            });
        }
    }
}

function showNotify(title, message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast-custom d-flex align-items-center gap-2 mb-2`;
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    const icon = icons[type] || '🔔';
    toast.innerHTML = `<span class="h5 m-0">${icon}</span><span class="fw-bold">${message || title}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

function checkForTournamentEnd() {
    const activeTeams = teams.filter(t => t.sconfitte < 2);
    const completed = [...allPartite].filter(p => p.giocata).sort((a, b) => a.id - b.id);
    const lastMatch = completed[completed.length - 1];
    
    const isFinalPlayed = lastMatch && lastMatch.girone === 99;
    const isOneLeft = teams.length >= 2 && activeTeams.length === 1;

    if (isOneLeft || isFinalPlayed) {
        let champion = isFinalPlayed 
            ? (lastMatch.bicchieriSquadra1 > lastMatch.bicchieriSquadra2 ? lastMatch.squadra1 : lastMatch.squadra2)
            : activeTeams[0];
        
        const navTabs = document.getElementById('navbarNav');
        if (navTabs) navTabs.style.display = 'none';
        
        switchTab('classifica');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        if (!document.getElementById('winner-banner')) {
            const banner = document.createElement('div');
            banner.id = 'winner-banner';
            banner.className = 'p-5 mb-5 rounded-5 text-center bg-warning shadow-lg border-warning border-5';
            banner.style.borderStyle = 'double';
            banner.innerHTML = `
                <div class="display-1 mb-3">🏆</div>
                <h2 class="display-4 fw-bold text-dark m-0">CAMPIONI!</h2>
                <div class="h2 fw-bold text-danger mb-4">${champion.nome}</div>
                <p class="text-dark opacity-75 mb-4">Il torneo è concluso con la grande finale.</p>
                <button class="btn btn-dark btn-lg px-5 py-3 rounded-pill fw-bold" onclick="openDeleteAllModal()">🔄 RESET PER NUOVO TORNEO</button>
            `;
            document.getElementById('tab-classifica').prepend(banner);
        }
        renderLeaderboard();
    } else {
        const navTabs = document.getElementById('navbarNav');
        if (navTabs) navTabs.style.display = 'block';
        const banner = document.getElementById('winner-banner');
        if (banner) banner.remove();
    }
}


function checkForFinal() {
    // La finale ora viene gestita dinamicamente da generateRandomMatches
    // ma possiamo mostrare un avviso se mancano 2 squadre totali
    const activeTeams = teams.filter(t => t.sconfitte < 2);
    
    if (activeTeams.length === 2) {
        document.getElementById('final-section').style.display = 'block';
        document.getElementById('final-match-display').innerHTML = `
            <div class="h4 fw-bold text-dark">${activeTeams[0].nome}</div>
            <div class="h2 text-warning">VS</div>
            <div class="h4 fw-bold text-dark">${activeTeams[1].nome}</div>
        `;
    } else {
        document.getElementById('final-section').style.display = 'none';
    }
}

function renderLeaderboard() {
    const container = document.getElementById('leaderboard-list');
    const sorted = [...teams].sort((a, b) => b.punti - a.punti || (b.vittorie - a.vittorie));
    
    let html = `
        <div class="table-responsive">
            <table class="table table-hover align-middle">
                <thead class="table-light">
                    <tr>
                        <th>Pos</th>
                        <th>Squadra</th>
                        <th class="text-center">V</th>
                        <th class="text-center">S</th>
                        <th class="text-center">Cup+</th>
                        <th class="text-center">Cup-</th>
                        <th class="text-center">PT</th>
                    </tr>
                </thead>
                <tbody>
    `;

    html += sorted.map((t, i) => `
        <tr>
            <td><b class="text-primary">#${i + 1}</b></td>
            <td>
                <div class="fw-bold text-dark">${t.nome}</div>
                <div class="small text-muted">${t.giocatori.map(p => p.nome).join(', ')}</div>
            </td>
            <td class="text-center">${t.vittorie || 0}</td>
            <td class="text-center">${t.sconfitte || 0}</td>
            <td class="text-center text-success">${t.bicchieriFatti || 0}</td>
            <td class="text-center text-danger">${t.bicchieriSubiti || 0}</td>
            <td class="text-center"><span class="badge bg-primary rounded-pill">${t.punti}</span></td>
        </tr>
    `).join('');

    html += `</tbody></table></div>`;
    
    container.innerHTML = sorted.length > 0 ? html : '<p class="text-center text-muted">Nessun dato</p>';
}

// ─── UTILS ──────────────────────────────────────────────────

function switchTab(tab, e = null) {
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.getElementById(`tab-${tab}`).style.display = 'block';
    
    const currentEvent = e || window.event;
    if (currentEvent && currentEvent.currentTarget && currentEvent.currentTarget.classList) {
        currentEvent.currentTarget.classList.add('active');
    }
    
    if (tab === 'classifica') renderLeaderboard();
    if (tab === 'live') {
        // Carica sempre le partite aggiornate quando si entra in "In Campo"
        fetch(`${API_URL}/partite`)
            .then(res => res.json())
            .then(data => {
                allPartite = data;
                renderLiveMatches();
            });
    }
    if (tab === 'partite') {
        loadPartite();
        populateTeamSelects();
    }
}

async function loadPartite() {
    const response = await fetch(`${API_URL}/partite`);
    allPartite = await response.json();
    renderPartite(allPartite);
}

function renderPartite(partite) {
    const upcomingContainer = document.getElementById('upcoming-list');
    const historyContainer = document.getElementById('match-list');
    
    const completed = partite.filter(p => p.giocata);
    const upcoming = partite.filter(p => !p.giocata);
    
    document.getElementById('match-count').innerText = `${completed.length} match conclusi`;
    document.getElementById('upcoming-count').innerText = `${upcoming.length} da giocare`;
    
    // Render Storico
    historyContainer.innerHTML = completed.reverse().map(p => `
        <div class="col-md-6">
            <div class="p-3 border rounded-4 bg-white shadow-sm d-flex justify-content-between align-items-center">
                <div class="text-center" style="flex: 1;">
                    <div class="fw-bold text-dark">${p.squadra1.nome}</div>
                    <div class="badge bg-light text-muted border">
                        ${p.girone === 99 ? '🏆 Finalissima' : (p.girone === 88 ? '🔥 Semifinale' : 'Girone ' + p.girone)}
                    </div>
                </div>
                <div class="mx-2 d-flex align-items-center">
                    <div class="h3 fw-bold m-0 px-3 py-2 bg-dark text-white rounded-3">${p.bicchieriSquadra1}</div>
                    <div class="mx-2 text-muted fw-bold">-</div>
                    <div class="h3 fw-bold m-0 px-3 py-2 bg-dark text-white rounded-3">${p.bicchieriSquadra2}</div>
                </div>
                <div class="text-center" style="flex: 1;">
                    <div class="fw-bold text-dark">${p.squadra2.nome}</div>
                    <div class="badge bg-light text-muted border">
                        ${p.girone === 99 ? '🏆 Finalissima' : (p.girone === 88 ? '🔥 Semifinale' : 'Girone ' + p.girone)}
                    </div>
                </div>
            </div>
        </div>
    `).join('') || '<div class="col-12"><p class="text-center text-muted">Nessun match concluso</p></div>';

    // Render Prossime
    let upcomingHtml = `
        <div class="table-responsive bg-white rounded-5 shadow-sm p-2">
            <table class="table table-hover align-middle mb-0">
                <thead class="table-light">
                    <tr>
                        <th>Fase</th>
                        <th class="text-center">Scontro Diretto</th>
                        <th class="text-end">Azione</th>
                    </tr>
                </thead>
                <tbody>
    `;

    upcomingHtml += upcoming.map(p => `
        <tr>
            <td>
                <span class="badge bg-light text-muted border">
                    ${p.girone === 99 ? '🏆 Finalissima' : (p.girone === 88 ? '🔥 Semifinale' : 'Girone ' + p.girone)}
                </span>
            </td>
            <td class="text-center">
                <div class="d-flex justify-content-center align-items-center gap-3">
                    <span class="fw-bold">${p.squadra1.nome}</span>
                    <span class="text-warning small fw-bold">VS</span>
                    <span class="fw-bold">${p.squadra2.nome}</span>
                </div>
            </td>
            <td class="text-end">
                <button class="btn btn-sm btn-dark px-3 rounded-pill" onclick="prepareMatchResult('${p.squadra1.id}', '${p.squadra2.id}', ${p.id})">
                    🎯 Registra
                </button>
            </td>
        </tr>
    `).join('');

    upcomingHtml += `</tbody></table></div>`;
    
    upcomingContainer.innerHTML = upcoming.length > 0 ? upcomingHtml : '<div class="col-12"><p class="text-center text-muted">Tutte le partite sono state giocate!</p></div>';
}

function prepareMatchResult(s1Id, s2Id, matchId) {
    document.getElementById('matchTeam1').value = s1Id;
    document.getElementById('matchTeam2').value = s2Id;
    activeMatchId = matchId;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function adjustScore(id, delta) {
    const input = document.getElementById(id);
    let val = parseInt(input.value) || 0;
    val = val + delta;
    if (val < 0) val = 0;
    if (val > 10) val = 10;
    input.value = val;
}

function populateTeamSelects() {
    const s1 = document.getElementById('matchTeam1');
    const s2 = document.getElementById('matchTeam2');
    const options = teams.map(t => `<option value="${t.id}">${t.nome} (Girone ${t.girone})</option>`).join('');
    s1.innerHTML = options;
    s2.innerHTML = options;
    
    if (teams.length >= 2) {
        s1.value = teams[0].id;
        s2.value = teams[1].id;
    }
}

async function saveMatch() {
    const s1Id = document.getElementById('matchTeam1').value;
    const s2Id = document.getElementById('matchTeam2').value;
    const b1 = parseInt(document.getElementById('matchScore1').value) || 0;
    const b2 = parseInt(document.getElementById('matchScore2').value) || 0;

    if (!s1Id || !s2Id || s1Id === s2Id) {
        showNotify("⚠️ Errore", "Scegli due squadre diverse!", "error");
        return;
    }

    if (b1 > 10 || b2 > 10) {
        showNotify("⚠️ Errore", "Il limite massimo di bicchieri è 10!", "warning");
        return;
    }

    const team1 = teams.find(t => t.id == s1Id);

    const activeTeams = teams.filter(t => t.sconfitte < 2);
    let finalGirone = team1.girone;
    if (activeTeams.length === 2) finalGirone = 4; // Forza girone finale se sono rimasti in 2

    const partita = {
        id: activeMatchId,
        squadra1: { id: s1Id },
        squadra2: { id: s2Id },
        bicchieriSquadra1: b1,
        bicchieriSquadra2: b2,
        girone: finalGirone,
        giocata: true
    };

    await fetch(`${API_URL}/partite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partita)
    });

    document.getElementById('matchScore1').value = '0';
    document.getElementById('matchScore2').value = '0';
    activeMatchId = null;
    await loadPartite();
    await loadTeams(); 
    showNotify("🎯 Registrato", "Risultato salvato correttamente!", "success");
}

function openDeleteAllModal() { document.getElementById('deleteAllModal').style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function renderPlayersList() {
    const team = teams.find(t => t.id === activeTeamId);
    const container = document.getElementById('playerList');
    container.innerHTML = team.giocatori.map((p, i) => `
        <div class="list-group-item d-flex justify-content-between align-items-center border-0 border-bottom">
            <span class="fw-semibold">${p.nome}</span>
            <button class="btn btn-sm text-danger" onclick="removePlayer(${i})">🗑️</button>
        </div>`).join('') || '<div class="p-3 text-center text-muted">Senza giocatori</div>';
}

async function showQRCodeModal() {
    let host = window.location.host;
    let usingAutoIP = false;

    if (host.includes('localhost') || host.includes('127.0.0.1')) {
        try {
            const response = await fetch('/api/squadre/ip');
            const ip = await response.text();
            if (ip && ip.trim() !== 'localhost' && ip.trim() !== '') {
                host = ip.trim() + ":8081";
                usingAutoIP = true;
            } else {
                const manualIp = prompt("⚠️ CONFIGURAZIONE NECESSARIA ⚠️\nInserisci l'IP del tuo PC (es. 192.168.1.15) per far funzionare il QR Code sul telefono:");
                if (manualIp && manualIp.trim() !== "") {
                    host = manualIp.trim() + ":8081";
                }
            }
        } catch(e) {
            console.error("Errore recupero IP:", e);
        }
    }

    // Costruisci URL pulito
    const currentUrl = "http://" + host + "/?view=readonly";
    
    showNotify("Generazione QR", `Indirizzo: ${host}`, "info");
    const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=" + encodeURIComponent(currentUrl);
    document.getElementById('qrImage').src = qrUrl;
    document.getElementById('qrModal').style.display = 'flex';
}

function renderLiveMatches() {
    const container = document.getElementById('live-matches-list');
    const upcoming = allPartite.filter(p => !p.giocata);
    
    container.innerHTML = upcoming.map(p => `
        <div class="col-md-6 mb-3">
            <div class="card border-0 shadow-sm rounded-4 p-3 bg-white">
                <div class="d-flex justify-content-between align-items-center">
                    <div class="text-center flex-grow-1">
                        <div class="fw-bold text-dark" style="font-size: 1.1rem;">${p.squadra1.nome}</div>
                    </div>
                    <div class="px-3">
                        <span class="badge bg-warning bg-opacity-10 text-warning border border-warning rounded-pill px-3">VS</span>
                    </div>
                    <div class="text-center flex-grow-1">
                        <div class="fw-bold text-dark" style="font-size: 1.1rem;">${p.squadra2.nome}</div>
                    </div>
                </div>
                <div class="text-center mt-3 pt-2 border-top small text-muted font-monospace" style="letter-spacing: 1px;">GIRONE ${p.girone}</div>
            </div>
        </div>
    `).join('') || '<div class="text-center py-5 text-muted opacity-50"><h3>☕</h3>Nessuna partita in attesa.<br>Genera i match per iniziare!</div>';
}
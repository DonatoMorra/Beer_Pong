const API_URL = '/api/squadre';
let teams = [];
let allPartite = [];
let activeTeamId = null;
let activeMatchId = null;

let activeGroups = [1];
const groupStyles = {
    1: 'primary',
    2: 'info',
    3: 'success',
    4: 'warning',
    5: 'secondary',
    6: 'dark',
    7: 'danger'
};

let isReadonly = false;
let isLoggedIn = true;
window.authHeader = null;
let lastSelectedGroup = 1;

window.onload = async () => {
    const storedGroup = parseInt(localStorage.getItem('lastSelectedGroup'));
    if (Number.isInteger(storedGroup) && storedGroup >= 1) {
        lastSelectedGroup = storedGroup;
    }
    // Carica IP server per QR Code
    try {
        const ipRes = await fetch(`${API_URL}/ip`);
        window.serverIp = await ipRes.text();
    } catch(e) {
        window.serverIp = window.location.hostname;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'readonly') {
        isReadonly = true;
        
        // Nascondi elementi admin in modo aggressivo
        document.body.classList.add('is-readonly');
        const header = document.querySelector('header');
        if (header) header.style.display = 'none';
        
        const nav = document.querySelector('nav');
        if (nav) nav.style.display = 'none';

        document.body.insertAdjacentHTML('afterbegin', `
            <div class="readonly-header text-center py-4 mb-4 bg-white shadow-sm border-bottom animate__animated animate__fadeInDown">
                <h1 class="h3 fw-bold mb-1" style="color: var(--primary);">🍺 BEERPONG <span class="text-warning">LIVE</span></h1>
                <p class="text-muted small mb-0 fw-bold">🏆 Classifica e Risultati in tempo reale</p>
            </div>
        `);
        
        switchTab('classifica');
        // Auto-refresh per gli spettatori ogni 10 secondi
        setInterval(() => {
            loadTeams();
            if (activeTab === 'live') loadLivePartite();
        }, 10000);
    } else {
        switchTab('classifica'); 
    }
    loadTeams();
};

let activeTab = 'classifica';

function renderGroupSections() {
    const container = document.getElementById('group-sections');
    if (!container) return;
    container.innerHTML = '';

    activeGroups.forEach(g => {
        const color = groupStyles[g] || 'secondary';
        container.insertAdjacentHTML('beforeend', `
            <div class="col-md-3" id="group-col-${g}">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <div class="d-flex align-items-center gap-2">
                        <h4 class="h6 fw-bold text-${color} m-0">GIRONE ${g}</h4>
                        ${g > 1 ? `<button type="button" class="btn btn-sm btn-outline-danger rounded-circle p-0 d-flex align-items-center justify-content-center" style="width: 26px; height: 26px;" onclick="removeGirone(${g})" aria-label="Rimuovi girone">✕</button>` : ''}
                    </div>
                    <span class="badge bg-${color} rounded-pill" id="count-g${g}">0</span>
                </div>
                <div id="list-girone${g}"></div>
            </div>
        `);
    });
}

function updateGroupSelectOptions() {
    const select = document.getElementById('teamGirone');
    if (!select) return;
    select.innerHTML = activeGroups
        .map(g => `<option value="${g}">Girone ${g}</option>`)
        .join('');

    if (!activeGroups.includes(lastSelectedGroup)) {
        lastSelectedGroup = activeGroups[0] || 1;
    }
    select.value = lastSelectedGroup;
    select.onchange = () => {
        const selected = parseInt(select.value);
        if (Number.isInteger(selected)) {
            lastSelectedGroup = selected;
            localStorage.setItem('lastSelectedGroup', selected);
        }
    };
}

function addGirone() {
    const maxGroup = activeGroups.length > 0 ? Math.max(...activeGroups) : 1;
    const nextGroup = maxGroup + 1;
    activeGroups = Array.from(new Set([...activeGroups, nextGroup])).sort((a, b) => a - b);
    renderGroupSections();
    updateGroupSelectOptions();
    // Ripopola liste squadre per nuovo DOM dei gironi
    renderTeams();
    showNotify('✅ Girone aggiunto', `Girone ${nextGroup} creato.`, 'success');
}

function removeGirone(groupNumber) {
    if (groupNumber === 1) {
        showNotify('ℹ️ Girone fisso', 'Girone 1 non può essere rimosso.', 'info');
        return;
    }
    const teamsInGroup = teams.filter(t => t.girone === groupNumber);
    if (teamsInGroup.length > 0) {
        showNotify('⚠️ Girone non vuoto', `Il girone ${groupNumber} contiene squadre. Sposta o elimina prima le squadre.`, 'warning');
        return;
    }
    activeGroups = activeGroups.filter(g => g !== groupNumber);
    renderGroupSections();
    updateGroupSelectOptions();
    // Ripopola liste squadre dopo rimozione
    renderTeams();
    showNotify('✅ Girone rimosso', `Girone ${groupNumber} eliminato.`, 'success');
}

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

    const selectedGirone = parseInt(gironeSelect.value);
    if (Number.isInteger(selectedGirone)) {
        lastSelectedGroup = selectedGirone;
        localStorage.setItem('lastSelectedGroup', selectedGirone);
    }

    const newTeam = {
        nome: name,
        punti: 0,
        girone: selectedGirone,
        giocatori: []
    };

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': window.authHeader || ''
        },
        body: JSON.stringify(newTeam)
    });

    if (response.status === 401) {
        showNotify("🔒 Accesso Negato", "Devi inserire la password admin!", "danger");
        return;
    }

    input.value = '';
    input.focus();
    loadTeams();
}

// NUOVA GESTIONE ELIMINAZIONE SINGOLA
function openDeleteSingleModal(id) {
    activeTeamId = id;
    const team = teams.find(t => t.id === id);
    if (!team) {
        showNotify("Errore", "Squadra non trovata.", "danger");
        return;
    }
    const nameLabel = document.getElementById('deleteSingleName');
    if (nameLabel) nameLabel.innerText = team.nome;
    document.getElementById('deleteSingleModal').style.display = 'flex';
}

async function confirmDeleteSingle() {
    if (!activeTeamId) {
        showNotify("Errore", "Nessuna squadra selezionata.", "danger");
        return;
    }
    const response = await fetch(`${API_URL}/${activeTeamId}`, { 
        method: 'DELETE',
        headers: { 'Authorization': window.authHeader || '' }
    });
    if (response.status === 401) {
        showNotify("🔒 Accesso Negato", "Password admin necessaria!", "danger");
        return;
    }
    closeModal('deleteSingleModal');
    loadTeams();
}

async function confirmDeleteAll() {
    const codeInput = document.getElementById('deleteAllCode');
    const deleteCode = (codeInput?.value || '').trim();

    if (deleteCode !== '1234') {
        showNotify('? Codice errato', 'Inserisci il codice corretto per resettare il torneo.', 'danger');
        return;
    }

    const response = await fetch(`${API_URL}/all`, {
        method: 'DELETE',
        headers: {
            'X-Delete-Code': deleteCode
        }
    });

    if (response.status === 403) {
        showNotify('?? Codice non valido', 'Il codice di conferma non � corretto.', 'danger');
        return;
    }

    closeModal('deleteAllModal');
    loadTeams();
    loadPartite();
    switchTab('squadre'); // Torna alla creazione squadre
    showNotify('??? Reset', 'Torneo resettato con successo!', 'info');
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
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': window.authHeader || ''
        },
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
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': window.authHeader || ''
        },
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
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': window.authHeader || ''
        },
        body: JSON.stringify(team)
    });
    renderPlayersList();
    renderTeams();
}

// ─── RENDERING ──────────────────────────────────────────────

function renderTeams() {
    const groupsFound = new Set(activeGroups);
    teams.forEach(t => {
        if (Number.isInteger(t.girone) && t.girone >= 1) groupsFound.add(t.girone);
    });
    activeGroups = [...groupsFound].sort((a, b) => a - b);
    if (!activeGroups.includes(lastSelectedGroup)) {
        lastSelectedGroup = activeGroups[0] || 1;
    }
    renderGroupSections();
    updateGroupSelectOptions();

    const lists = {};
    activeGroups.forEach(g => {
        lists[g] = document.getElementById(`list-girone${g}`);
    });
    
    // Pulisci liste e contatori
    activeGroups.forEach(g => {
        if (lists[g]) lists[g].innerHTML = '';
        const countElem = document.getElementById(`count-g${g}`);
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

        // Testo tasto in tab Partite e Admin
        const btnAdmin = document.getElementById('btnNextRoundAdmin');
        
        const updateBtn = (btn) => {
            if (!btn) return;
            const stages = partite.map(p => p.girone);
            const maxStage = partite.length > 0 ? Math.max(...stages) : 0;
            const activeCount = activeTeams.length;

            if (partite.length === 0) {
                btn.innerHTML = "🚀 PROSSIMO ROUND";
                btn.className = "btn btn-warning btn-lg fw-bold rounded-pill px-5 shadow w-100";
            } else if (maxStage === 99) {
                btn.innerHTML = "🏁 TORNEO CONCLUSO";
                btn.className = "btn btn-dark btn-lg fw-bold rounded-pill px-5 shadow w-100 disabled";
            } else if (maxStage === 88 || activeCount === 2) {
                btn.innerHTML = "🏆 GENERA FINALISSIMA";
                btn.className = "btn btn-danger btn-lg fw-bold rounded-pill px-5 shadow w-100";
            } else if (maxStage === 77 || activeCount <= 4) {
                btn.innerHTML = "🔥 GENERA SEMIFINALI";
                btn.className = "btn btn-primary btn-lg fw-bold rounded-pill px-5 shadow w-100";
            } else if (maxStage === 66 || activeCount <= 8) {
                btn.innerHTML = "⚡ GENERA QUARTI";
                btn.className = "btn btn-warning btn-lg fw-bold rounded-pill px-5 shadow w-100";
            } else if (partite.some(p => p.girone > 0 && p.girone < 66) && !partite.some(p => p.girone >= 66)) {
                btn.innerHTML = "🎯 GENERA ELIMINATORIE";
                btn.className = "btn btn-info btn-lg fw-bold rounded-pill px-5 shadow w-100";
            } else {
                btn.innerHTML = "🎯 GENERA OTTAVI";
                btn.className = "btn btn-info btn-lg fw-bold rounded-pill px-5 shadow w-100";
            }
        };

        updateBtn(btnNext);
        updateBtn(btnAdmin);
    });

    checkForFinal();
    checkForTournamentEnd();
}

async function generateRandomMatches() {
    try {
        const matchResponse = await fetch(`${API_URL}/partite`);
        if (matchResponse.status === 401) {
            showNotify("🔒 Login Richiesto", "Per favore ricarica la pagina e inserisci le credenziali admin.", "danger");
            return;
        }
        const currentMatches = await matchResponse.json();
        
        const incomplete = currentMatches.filter(p => !p.giocata);
        if (currentMatches.length > 0 && incomplete.length > 0) {
            showNotify("⚠️ Partite in corso", "Finisci i match attuali prima di generare i nuovi!", "warning");
            switchTab('live');
            return;
        }

        const activeTeams = teams.filter(t => t.sconfitte < 2);
        const groupValidationError = validateTournamentGroups();
        if (groupValidationError) {
            showNotify("⚠️ Controlla i gironi", groupValidationError, "warning");
            return;
        }
        if (activeTeams.length < 2) {
            showNotify("⚠️ Squadre insufficienti", "Servono almeno 2 squadre per continuare!", "warning");
            return;
        }

        let generatedAny = false;
        
        // LOGICA DI PROGRESSIONE ROBUSTA (State-Machine)
        const stages = currentMatches.map(p => p.girone);
        const maxStage = currentMatches.length > 0 ? Math.max(...stages) : 0;
        const groupStageMatches = currentMatches.filter(p => p.girone > 0 && p.girone < 66);
        const eliminationMatches = currentMatches.filter(p => p.girone >= 66);
        const groupStageIncomplete = groupStageMatches.some(p => !p.giocata);
        const eliminationStageIncomplete = eliminationMatches.some(p => !p.giocata);

        if (groupStageIncomplete) {
            showNotify("⚠️ Partite gironi in corso", "Finisci tutte le partite del girone prima di generare il prossimo round.", "warning");
            switchTab('live');
            return;
        }

        if (eliminationStageIncomplete) {
            showNotify("⚠️ Partite ad eliminazione diretta in corso", "Finisci prima tutte le partite ad eliminazione diretta.", "warning");
            switchTab('live');
            return;
        }

        if (maxStage === 99) {
            showNotify("🏁 Torneo Concluso", "La finale è già stata disputata!", "info");
            return;
        }

        if (groupStageMatches.length === 0 && eliminationMatches.length === 0) {
            // --- GENERAZIONE PRIMO GIRONE ---
            const gironi = [...new Set(activeGroups)].sort((a, b) => a - b);
            for (const g of gironi) {
                const teamsInGirone = activeTeams.filter(t => t.girone === g);
                if (teamsInGirone.length >= 2) {
                    const success = await createGroupRoundRobinMatches(teamsInGirone, g, currentMatches);
                    if (success) generatedAny = true;
                }
            }
        } else if (groupStageMatches.length > 0 && eliminationMatches.length === 0) {
            // --- PASSAGGIO ALLA FASE AD ELIMINAZIONE DIRETTA ---
            const winners = getGroupWinners();
            if (winners.length < 2) {
                showNotify("⚠️ Nessun girone pronto", "Occorre almeno un vincitore di girone per continuare.", "warning");
                return;
            }

            const bracketSize = getBracketSize(winners.length);
            const stageCode = getStageCodeForSize(bracketSize);
            const qualified = getTopRankedTeams(winners, bracketSize);

            if (qualified.length < 2) {
                showNotify("⚠️ Impossibile creare fase finale", "Non ci sono abbastanza squadre qualificate.", "warning");
                return;
            }

            await createBalancedMatches(qualified, stageCode);
            generatedAny = true;
        } else if (eliminationMatches.length > 0) {
            const nextStageMap = { 66: 77, 77: 88, 88: 99 };
            const nextStageCode = nextStageMap[maxStage];
            if (!nextStageCode) {
                showNotify("⚠️ Impossibile avanzare", "Lo stato attuale non corrisponde a una fase ad eliminazione valida.", "warning");
                return;
            }

            const winners = getEliminationWinners(maxStage);
            const bracketSize = getBracketSize(winners.length);
            if (bracketSize !== winners.length) {
                showNotify("⚠️ Numero vincitori non valido", "La fase precedente non ha prodotto un numero di vincitori compatibile.", "warning");
                return;
            }

            if (winners.length < 2) {
                showNotify("⚠️ Nessun vincitore disponibile", "Non ci sono abbastanza vincitori per la fase successiva.", "warning");
                return;
            }

            await createBalancedMatches(winners, nextStageCode);
            generatedAny = true;
        } else {
            showNotify("ℹ️ Nulla da generare", "Controlla lo stato del torneo e riprova.", "info");
            return;
        }

        if (generatedAny) {
            showNotify("✅ Round Generato", "Nuove sfide pronte in campo!", "success");
            await loadPartite();
            switchTab('live');
        } else {
            showNotify("ℹ️ Nulla da generare", "Tutte le squadre hanno già sfidanti o sono dispari.", "info");
        }
    } catch (e) {
        console.error("Errore generazione:", e);
        showNotify("❌ Errore", "Impossibile generare i match. Riprova.", "danger");
    }
}

function getCompletedMatchesByStage(stageCode) {
    return allPartite.filter(p => p.giocata && p.girone === stageCode);
}

function getMatchWinners(matches) {
    return matches.map(p => {
        if (p.bicchieriSquadra1 === p.bicchieriSquadra2) {
            console.warn(`Match pari, scelgo squadra1 per default: ${p.id}`);
            return p.squadra1;
        }
        return p.bicchieriSquadra1 > p.bicchieriSquadra2 ? p.squadra1 : p.squadra2;
    }).filter(Boolean);
}

function getEliminationWinners(stageCode) {
    return getMatchWinners(getCompletedMatchesByStage(stageCode));
}

function getBracketSize(teamCount) {
    if (teamCount < 2) return 0;
    let size = 1;
    while (size < teamCount) {
        size *= 2;
    }
    return Math.max(2, size);
}

function getStageCodeForSize(bracketSize) {
    switch (bracketSize) {
        case 2: return 99;
        case 4: return 88;
        case 8: return 77;
        case 16: return 66;
        default: return 66;
    }
}

function getTopRankedTeams(squadre, count) {
    return [...squadre]
        .sort((a, b) =>
            (b.punti - a.punti) ||
            (b.vittorie - a.vittorie) ||
            ((b.bicchieriFatti - b.bicchieriSubiti) - (a.bicchieriFatti - a.bicchieriSubiti))
        )
        .slice(0, count);
}

async function createBalancedMatches(squadre, gironeNum) {
    if (!squadre || squadre.length < 2) {
        return false;
    }

    const teamsToPair = [...squadre].sort(() => 0.5 - Math.random());
    if (teamsToPair.length % 2 !== 0) {
        showNotify("⚠️ Numero squadre dispari", "Non posso creare match diretti con numero dispari di squadre per questa fase.", "warning");
        return false;
    }

    let created = false;
    for (let i = 0; i < teamsToPair.length; i += 2) {
        const s1 = teamsToPair[i];
        const s2 = teamsToPair[i + 1];

        const alreadyPlayed = allPartite.some(p =>
            (p.squadra1.id == s1.id && p.squadra2.id == s2.id) ||
            (p.squadra1.id == s2.id && p.squadra2.id == s1.id)
        );

        if (alreadyPlayed && gironeNum < 80) {
            console.log(`Salto match già giocato: ${s1.nome} vs ${s2.nome}`);
            continue;
        }

        const partita = {
            squadra1: { id: s1.id },
            squadra2: { id: s2.id },
            bicchieriSquadra1: 0,
            bicchieriSquadra2: 0,
            girone: gironeNum,
            turno: 1,
            giocata: false
        };
        const response = await fetch(`${API_URL}/partite/nuova`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': window.authHeader || ''
            },
            body: JSON.stringify(partita)
        });
        if (response.status === 401) {
            showNotify("🔒 Accesso Negato", "Devi inserire la password admin per generare i match!", "danger");
            return false;
        }
        created = true;
    }

    return created;
}

function computeGroupCountForTeams(teamCount) {
    if (teamCount <= 4) return 2;
    return Math.min(6, Math.max(2, Math.round(teamCount / 4)));
}

async function distribuisciSquadre() {
    if (!teams || teams.length === 0) {
        showNotify("⚠️ Nessuna squadra", "Aggiungi almeno una squadra prima di distribuire.", "warning");
        return;
    }

    const teamCount = teams.length;
    const groupCount = activeGroups.length > 1 ? activeGroups.length : computeGroupCountForTeams(teamCount);
    const baseSize = Math.floor(teamCount / groupCount);
    const remainder = teamCount % groupCount;
    const groupSizes = Array.from({ length: groupCount }, (_, i) => baseSize + (i < remainder ? 1 : 0));

    if (groupSizes.some(size => size === 0)) {
        showNotify("⚠️ Distribuzione non valida", "Non ci sono abbastanza squadre per i gironi selezionati.", "warning");
        return;
    }

    const shuffledTeams = [...teams].sort(() => 0.5 - Math.random());
    const updatedTeams = [];
    let currentIndex = 0;

    for (let groupIndex = 0; groupIndex < groupCount; groupIndex++) {
        const targetGroup = groupIndex + 1;
        for (let j = 0; j < groupSizes[groupIndex]; j++) {
            const team = shuffledTeams[currentIndex++];
            if (!team) break;
            updatedTeams.push({ id: team.id, nome: team.nome, girone: targetGroup });
        }
    }

    activeGroups = Array.from({ length: groupCount }, (_, i) => i + 1);
    lastSelectedGroup = activeGroups.includes(lastSelectedGroup) ? lastSelectedGroup : 1;
    localStorage.setItem('lastSelectedGroup', lastSelectedGroup);

    showNotify('📍 Distribuzione in corso', `Sto distribuendo ${teamCount} squadre in ${groupCount} gironi...`, 'info');

    try {
        const updatePromises = updatedTeams.map(team => fetch(`${API_URL}/${team.id}/girone`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': window.authHeader || ''
            },
            body: JSON.stringify({ girone: team.girone })
        }));

        const responses = await Promise.all(updatePromises);
        const failed = responses.find(res => !res.ok);
        if (failed) {
            const text = await failed.text();
            throw new Error(text || 'Errore durante l aggiornamento dei gironi.');
        }

        showNotify('📍 Squadre distribuite', `Distribuite ${teamCount} squadre in ${groupCount} gironi.`, 'success');
        await loadTeams();
    } catch (error) {
        console.error(error);
        showNotify('❌ Errore', error.message || 'Impossibile distribuire le squadre.', 'danger');
    }
}

function validateTournamentGroups() {
    if (!teams || teams.length === 0) {
        return 'Nessuna squadra disponibile per avviare il torneo.';
    }

    const missingGroup = teams.filter(t => !Number.isInteger(t.girone) || t.girone < 1);
    if (missingGroup.length > 0) {
        return 'Assegna un girone a tutte le squadre prima di avviare il torneo.';
    }

    const groupCounts = {};
    activeGroups.forEach(g => groupCounts[g] = 0);
    teams.forEach(t => {
        if (activeGroups.includes(t.girone)) {
            groupCounts[t.girone] = (groupCounts[t.girone] || 0) + 1;
        }
    });

    const emptyGroups = Object.entries(groupCounts).filter(([, count]) => count === 0).map(([g]) => g);
    if (emptyGroups.length > 0) {
        return `Il girone ${emptyGroups.join(', ')} è vuoto. Rimuovilo o assegna una squadra.`;
    }

    const sizes = Object.values(groupCounts);
    const maxSize = Math.max(...sizes);
    const minSize = Math.min(...sizes);
    if (maxSize - minSize > 1) {
        return 'La distribuzione dei gironi non è bilanciata. Usa Distribuisci Squadre per riequilibrare.';
    }

    return null;
}

function buildRoundRobinTurns(squadre) {
    const teams = [...squadre];
    const hasBye = teams.length % 2 !== 0;
    if (hasBye) {
        teams.push({ id: null, nome: 'Bye' });
    }

    const rounds = [];
    const count = teams.length;
    const fixed = teams[0];
    const rotating = teams.slice(1);

    for (let round = 0; round < count - 1; round++) {
        const current = [fixed, ...rotating];
        const matches = [];

        for (let i = 0; i < count / 2; i++) {
            const teamA = current[i];
            const teamB = current[count - 1 - i];
            if (!teamA.id || !teamB.id) continue;
            matches.push({ squadra1: teamA, squadra2: teamB, turno: round + 1 });
        }

        rounds.push(matches);
        rotating.unshift(rotating.pop());
    }

    return rounds;
}

async function createGroupRoundRobinMatches(squadre, gironeNum, existingMatches) {
    let created = false;
    const rounds = buildRoundRobinTurns(squadre);

    for (const matches of rounds) {
        for (const m of matches) {
            const s1 = m.squadra1;
            const s2 = m.squadra2;
            const alreadyExists = existingMatches.some(p =>
                p.girone === gironeNum &&
                p.turno === m.turno &&
                ((p.squadra1.id == s1.id && p.squadra2.id == s2.id) ||
                 (p.squadra1.id == s2.id && p.squadra2.id == s1.id))
            );
            if (alreadyExists) continue;

            const partita = {
                squadra1: { id: s1.id },
                squadra2: { id: s2.id },
                bicchieriSquadra1: 0,
                bicchieriSquadra2: 0,
                girone: gironeNum,
                turno: m.turno,
                giocata: false
            };
            const response = await fetch(`${API_URL}/partite/nuova`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': window.authHeader || ''
                },
                body: JSON.stringify(partita)
            });
            if (response.status === 401) {
                showNotify("🔒 Accesso Negato", "Devi inserire la password admin per generare i match!", "danger");
                return false;
            }
            created = true;
        }
    }
    return created;
}

function getGroupStandingsForGroup(groupId) {
    return teams
        .filter(t => t.girone === groupId)
        .sort((a, b) =>
            (b.punti - a.punti) ||
            (b.vittorie - a.vittorie) ||
            ((b.bicchieriFatti - b.bicchieriSubiti) - (a.bicchieriFatti - a.bicchieriSubiti))
        );
}

function getGroupWinners() {
    const groupIds = [...new Set(teams
        .filter(t => Number.isInteger(t.girone) && t.girone > 0 && t.girone < 80)
        .map(t => t.girone))].sort((a, b) => a - b);

    return groupIds.flatMap(g => getGroupStandingsForGroup(g).slice(0, 2)).filter(Boolean);
}

function getQualifiedTeams() {
    const groupIds = [...new Set(teams
        .filter(t => Number.isInteger(t.girone) && t.girone > 0 && t.girone < 80)
        .map(t => t.girone))].sort((a, b) => a - b);
    return groupIds.map(g => ({
        girone: g,
        qualifiers: getGroupStandingsForGroup(g).slice(0, 2)
    }));
}

function renderQualifiedOverview(groupIds) {
    const qualifiedGroups = getQualifiedTeams();
    const rows = qualifiedGroups.map(group => {
        const names = group.qualifiers.map(t => t.nome).join(' / ') || 'Nessuno';
        return `<li class="mb-2"><strong>Girone ${group.girone}:</strong> ${names}</li>`;
    }).join('');

    return `
    <div class="col-12">
        <div class="card border-0 shadow-sm rounded-4 p-4 bg-white">
            <div class="d-flex flex-column flex-md-row justify-content-between align-items-start gap-3">
                <div>
                    <div class="text-uppercase text-muted small fw-bold mb-1">Panoramica qualificati</div>
                    <h3 class="h5 fw-bold mb-2">Tutti i gironi completati</h3>
                    <p class="text-muted small mb-3">Seleziona la fase a eliminazione diretta e genera automaticamente i match in base ai migliori classificati.</p>
                </div>
                <button class="btn btn-warning btn-sm fw-bold rounded-pill px-4" onclick="generateRandomMatches()">Genera fase eliminazione</button>
            </div>
            <ul class="list-unstyled mt-4 mb-0 text-dark small">${rows}</ul>
        </div>
    </div>
    `;
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
                        <th class="text-center">P</th>
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
            <td class="text-center">${t.pareggi || 0}</td>
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

function switchTab(tab) {
    // Controllo sicurezza: se cerchi di andare in sezioni admin senza login, vai al login
    if (!isLoggedIn && (tab === 'squadre' || tab === 'partite')) {
        tab = 'admin';
        showNotify("🔐 Accesso Richiesto", "Effettua il login per gestire il torneo.", "info");
    }

    if (isReadonly) {
        // Forza sola lettura se il parametro è presente
        if (tab !== 'classifica' && tab !== 'live') {
            tab = 'classifica';
        }
    }

    activeTab = tab;

    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(t => {
        t.style.display = 'none';
        t.classList.remove('active');
    });
    
    const targetTab = document.getElementById(`tab-${tab}`);
    if (targetTab) {
        targetTab.style.display = 'block';
        setTimeout(() => targetTab.classList.add('active'), 10);
    } else {
        console.error("Tab non trovata:", tab);
        return;
    }

    // Aggiorna classi active nella navbar
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    
    // Esegui caricamento dati specifico per la tab
    if (tab === 'classifica') renderLeaderboard();
    if (tab === 'live') loadLivePartite();
    if (tab === 'admin') updateAdminView();
    if (tab === 'partite') {
        loadPartite();
        populateTeamSelects();
    }
    if (tab === 'squadre') {
        loadTeams();
    }

    window.scrollTo(0,0);
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
    document.getElementById('upcoming-count').innerText = `${upcoming.length} partite attive`;

    const stageLabel = (stage) => {
        if (stage === 99) return '🏆 Finalissima';
        if (stage === 88) return '🔥 Semifinale';
        if (stage === 77) return '⚡ Quarti';
        if (stage === 66) return '🎯 Ottavi';
        if (stage === 0) return 'Girone misto';
        return 'Girone ' + stage;
    };

    const stageBadgeClass = (stage) => {
        if (stage === 99) return 'bg-danger text-white';
        if (stage === 88) return 'bg-primary text-white';
        if (stage === 77) return 'bg-warning text-dark';
        if (stage === 66) return 'bg-info text-dark';
        return 'bg-secondary text-white';
    };

    const groupPhaseMatches = partite.filter(p => p.girone > 0 && p.girone < 80);
    const eliminationMatches = partite.filter(p => p.girone >= 80 && !p.giocata);
    const groupIds = [...new Set(groupPhaseMatches.map(p => p.girone))].sort((a, b) => a - b);

    const activeGroupCards = [];
    const summaryGroupCards = [];

    groupIds.forEach(g => {
        const allMatches = groupPhaseMatches.filter(p => p.girone === g).sort((a, b) => a.id - b.id);
        const todoMatches = allMatches.filter(p => !p.giocata);
        const playedMatches = allMatches.filter(p => p.giocata);
        const progress = allMatches.length ? Math.round((playedMatches.length / allMatches.length) * 100) : 0;

        if (todoMatches.length > 0) {
            const nextMatch = todoMatches[0];
            activeGroupCards.push(`
                <div class="col">
                    <div class="card border-0 shadow-sm rounded-4 h-100 overflow-hidden">
                        <div class="card-body p-4 d-flex flex-column">
                            <div class="d-flex justify-content-between align-items-start mb-3 gap-3">
                                <div>
                                    <div class="text-uppercase text-muted small fw-bold mb-1">${stageLabel(g)}</div>
                                    <h3 class="h5 fw-bold mb-1">Girone ${g}</h3>
                                </div>
                                <span class="badge ${stageBadgeClass(g)} rounded-pill py-2 px-3">In corso</span>
                            </div>
                            <div class="mb-3">
                                <div class="text-muted small mb-2">Avanzamento</div>
                                <div class="progress rounded-pill" style="height: 10px;">
                                    <div class="progress-bar bg-warning" role="progressbar" style="width: ${progress}%" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"></div>
                                </div>
                                <div class="d-flex justify-content-between align-items-center mt-2 small text-muted">
                                    <span>${playedMatches.length}/${allMatches.length} giocate</span>
                                    <span>${progress}%</span>
                                </div>
                            </div>
                            <div class="mb-4">
                                <div class="text-muted small mb-2">Prossima partita</div>
                                <div class="fw-semibold">${nextMatch.squadra1.nome} <span class="text-warning">VS</span> ${nextMatch.squadra2.nome}</div>
                                <div class="text-muted small mt-1">Partita ${playedMatches.length + 1} di ${allMatches.length}</div>
                            </div>
                            <div class="mt-auto d-flex justify-content-between align-items-center gap-3">
                                <div>
                                    <div class="text-muted small">Stato</div>
                                    <div class="fw-bold">${todoMatches.length} partite rimanenti</div>
                                </div>
                                <button class="btn btn-sm btn-dark rounded-pill px-3" onclick="prepareMatchResult('${nextMatch.squadra1.id}', '${nextMatch.squadra2.id}', ${nextMatch.id})">🎯 Registra match</button>
                            </div>
                        </div>
                    </div>
                </div>
            `);
        } else {
            const standings = getGroupStandingsForGroup(g);
            const first = standings[0] || { nome: 'N/D' };
            const second = standings[1] || { nome: 'N/D' };
            const qualifiers = standings.slice(0, 2).map(t => t.nome).join(' / ') || 'Nessuno';
            summaryGroupCards.push(`
                <div class="col">
                    <div class="card border-0 shadow-sm rounded-4 h-100 overflow-hidden bg-light bg-opacity-75">
                        <div class="card-body p-4 d-flex flex-column">
                            <div class="d-flex justify-content-between align-items-start mb-3 gap-3">
                                <div>
                                    <div class="text-uppercase text-muted small fw-bold mb-1">${stageLabel(g)}</div>
                                    <h3 class="h5 fw-bold mb-1">Girone ${g} completato</h3>
                                </div>
                                <span class="badge bg-success text-white rounded-pill py-2 px-3">Completato</span>
                            </div>
                            <div class="mb-3">
                                <div class="text-muted small mb-2">Classifica finale</div>
                                <div class="fw-semibold">1° ${first.nome}</div>
                                <div class="fw-semibold">2° ${second.nome}</div>
                            </div>
                            <div class="mb-4">
                                <div class="text-muted small mb-2">Qualificati</div>
                                <div class="fw-bold">${qualifiers}</div>
                            </div>
                            <div class="mt-auto">
                                <div class="text-muted small">Partite giocate: ${allMatches.length}</div>
                            </div>
                        </div>
                    </div>
                </div>
            `);
        }
    });

    const allGroupsCompleted = groupIds.length > 0 && activeGroupCards.length === 0;
    const eliminationCards = eliminationMatches.map(p => `
        <div class="col-md-6 col-xl-4">
            <div class="card border-0 shadow-sm rounded-4 h-100 overflow-hidden">
                <div class="card-body p-4 d-flex flex-column">
                    <div class="d-flex justify-content-between align-items-start mb-3 gap-3">
                        <div>
                            <div class="text-uppercase text-muted small fw-bold mb-1">${stageLabel(p.girone)}</div>
                            <h3 class="h6 fw-bold mb-1">${p.squadra1.nome} vs ${p.squadra2.nome}</h3>
                        </div>
                        <span class="badge ${stageBadgeClass(p.girone)} rounded-pill py-2 px-3">Eliminazione</span>
                    </div>
                    <div class="mb-4">
                        <div class="text-muted small mb-2">Prossima partita</div>
                        <div class="fw-semibold">${p.squadra1.nome} <span class="text-warning">VS</span> ${p.squadra2.nome}</div>
                    </div>
                    <div class="mt-auto text-end">
                        <button class="btn btn-sm btn-dark rounded-pill px-3" onclick="prepareMatchResult('${p.squadra1.id}', '${p.squadra2.id}', ${p.id})">🎯 Registra match</button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');

    const allCards = [...activeGroupCards, ...summaryGroupCards];
    let output = allCards.join('');
    if (eliminationCards) {
        output += eliminationCards;
    }
    if (!output) {
        output = '<div class="col-12"><div class="p-4 border rounded-4 bg-white shadow-sm text-center text-muted">Nessuna partita da giocare. Genera prima le partite del torneo.</div></div>';
    }
    if (allGroupsCompleted && !eliminationCards) {
        output += renderQualifiedOverview(groupIds);
    }

    upcomingContainer.innerHTML = output;

    const scheduleContainer = document.getElementById('schedule-list');
    const maxTurno = groupPhaseMatches.length ? Math.max(...groupPhaseMatches.map(p => p.turno || 1)) : 0;
    const scheduleSections = [];

    for (let turno = 1; turno <= maxTurno; turno++) {
        groupIds.forEach(g => {
            const roundMatches = groupPhaseMatches
                .filter(p => p.girone === g && (p.turno || 1) === turno)
                .sort((a, b) => a.id - b.id);
            if (!roundMatches.length) return;

            const listItems = roundMatches.map(p => `
                <li class="list-group-item d-flex justify-content-between align-items-center border-0 border-bottom py-2 px-0">
                    <div>
                        <span class="fw-bold">${p.squadra1.nome}</span>
                        <span class="text-muted mx-2">vs</span>
                        <span class="fw-bold">${p.squadra2.nome}</span>
                    </div>
                    <button class="btn btn-sm btn-outline-dark rounded-pill" onclick="prepareMatchResult('${p.squadra1.id}', '${p.squadra2.id}', ${p.id})">Registra</button>
                </li>
            `).join('');

            scheduleSections.push(`
                <div class="col-12">
                    <div class="card border-0 shadow-sm rounded-4 bg-white">
                        <div class="card-body p-4">
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <div>
                                    <div class="text-uppercase text-muted small fw-bold">Partita ${turno}</div>
                                    <h5 class="fw-bold mb-0">Girone ${g}</h5>
                                </div>
                                <span class="badge ${stageBadgeClass(g)} rounded-pill py-2 px-3">Turno</span>
                            </div>
                            <ul class="list-group list-group-flush">
                                ${listItems}
                            </ul>
                        </div>
                    </div>
                </div>
            `);
        });
    }

    const eliminationSchedule = eliminationMatches.map(p => `
        <div class="col-12">
            <div class="card border-0 shadow-sm rounded-4 bg-white">
                <div class="card-body p-4">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <div>
                            <div class="text-uppercase text-muted small fw-bold">${stageLabel(p.girone)}</div>
                            <h5 class="fw-bold mb-0">${p.squadra1.nome} vs ${p.squadra2.nome}</h5>
                        </div>
                        <span class="badge ${stageBadgeClass(p.girone)} rounded-pill py-2 px-3">Eliminazione</span>
                    </div>
                    <button class="btn btn-sm btn-dark rounded-pill" onclick="prepareMatchResult('${p.squadra1.id}', '${p.squadra2.id}', ${p.id})">Registra risultato</button>
                </div>
            </div>
        </div>
    `).join('');

    scheduleContainer.innerHTML = [...scheduleSections, eliminationSchedule].join('') || '<div class="col-12"><div class="p-4 border rounded-4 bg-white shadow-sm text-center text-muted">Nessuna programmazione disponibile.</div></div>';

    historyContainer.innerHTML = completed.reverse().map(p => `
        <div class="col-md-6">
            <div class="p-3 border rounded-4 bg-white shadow-sm d-flex justify-content-between align-items-center">
                <div class="text-center" style="flex: 1;">
                    <div class="fw-bold text-dark">${p.squadra1.nome}</div>
                    <div class="badge bg-light text-muted border">
                        ${stageLabel(p.girone)}
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
                        ${stageLabel(p.girone)}
                    </div>
                </div>
            </div>
        </div>
    `).join('') || '<div class="col-12"><p class="text-center text-muted">Nessun match concluso</p></div>';
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
    const currentMatch = allPartite.find(p => p.id === activeMatchId);

    const activeTeams = teams.filter(t => t.sconfitte < 2);
    let finalGirone = currentMatch ? currentMatch.girone : team1.girone;
    if (activeTeams.length === 2) finalGirone = 99; // Forza girone 99 (Finalissima) quando restano in 2

    const partita = {
        id: activeMatchId,
        squadra1: { id: s1Id },
        squadra2: { id: s2Id },
        bicchieriSquadra1: b1,
        bicchieriSquadra2: b2,
        girone: finalGirone,
        giocata: true
    };

    const response = await fetch(`${API_URL}/partite`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': window.authHeader || ''
        },
        body: JSON.stringify(partita)
    });

    if (response.status === 401) {
        showNotify("🔒 Accesso Negato", "Inserisci User e Pass admin per salvare i risultati!", "danger");
        return;
    }

    document.getElementById('matchScore1').value = '0';
    document.getElementById('matchScore2').value = '0';
    activeMatchId = null;
    await loadPartite();
    await loadTeams(); 
    showNotify("🎯 Registrato", "Risultato salvato correttamente!", "success");
}

function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function openDeleteAllModal() {
    const codeInput = document.getElementById('deleteAllCode');
    if (codeInput) codeInput.value = '';
    openModal('deleteAllModal');
}
function openModal(id) {
    if (isReadonly && (id === 'deleteAllModal' || id === 'deleteSingleModal' || id === 'playerModal' || id === 'pointsModal')) {
        return; // Impedisce l'apertura di modali di modifica in sola lettura
    }
    document.getElementById(id).style.display = 'flex';
}

function renderPlayersList() {
    const team = teams.find(t => t.id === activeTeamId);
    const container = document.getElementById('playerList');
    container.innerHTML = team.giocatori.map((p, i) => `
        <div class="list-group-item d-flex justify-content-between align-items-center border-0 border-bottom">
            <span class="fw-semibold">${p.nome}</span>
            <button class="btn btn-sm text-danger" onclick="removePlayer(${i})">🗑️</button>
        </div>`).join('') || '<div class="p-3 text-center text-muted">Senza giocatori</div>';
}

async function loadLivePartite() {
    try {
        const res = await fetch(`${API_URL}/partite`);
        allPartite = await res.json();
        renderLiveMatches();
    } catch(e) {
        console.error("Errore live:", e);
    }
}

async function showQRCodeModal() {
    const hostname = window.location.hostname;
    const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(hostname);
    const host = isLocalHost && window.serverIp ? window.serverIp : hostname;
    const port = window.location.port ? `:${window.location.port}` : '';
    const currentUrl = `${window.location.protocol}//${host}${port}/?view=readonly`;

    showNotify("Generazione QR WiFi", "I tuoi amici possono inquadrare il QR!", "success");

    const qrImage = document.getElementById('qrImage');
    const qrLink = document.getElementById('qrLink');
    const qrUrl = `/api/squadre/qr?data=${encodeURIComponent(currentUrl)}`;

    qrImage.alt = 'QR Code';
    qrImage.src = qrUrl;
    qrLink.textContent = currentUrl;
    qrLink.title = currentUrl;
    qrImage.onerror = () => {
        qrImage.alt = 'QR code non disponibile';
        qrLink.innerHTML = `Link diretto: <a href="${currentUrl}" target="_blank" rel="noopener noreferrer">${currentUrl}</a>`;
    };

    document.getElementById('qrModal').style.display = 'flex';
}

function renderLiveMatches() {
    const container = document.getElementById('live-matches-list');
    const upcoming = allPartite.filter(p => !p.giocata);
    
    container.innerHTML = upcoming.map(p => {
        let stageLabel = `GIRONE ${p.girone}`;
        let badgeClass = "bg-warning bg-opacity-10 text-warning border-warning";
        
        if (p.girone === 99) {
            stageLabel = "🏆 FINALISSIMA";
            badgeClass = "bg-danger text-white border-danger shadow-sm fw-bold";
        } else if (p.girone === 88) {
            stageLabel = "🔥 SEMIFINALE";
            badgeClass = "bg-primary text-white border-primary shadow-sm fw-bold";
        }

        return `
        <div class="col-md-6 mb-3">
            <div class="card border-0 shadow-lg rounded-4 p-4 ${p.girone >= 88 ? 'border-start border-4 border-warning' : 'bg-white shadow-sm'}">
                <div class="d-flex justify-content-between align-items-center">
                    <div class="text-center flex-grow-1">
                        <div class="fw-bold text-dark h5 mb-0">${p.squadra1.nome}</div>
                    </div>
                    <div class="px-4">
                        <span class="badge rounded-pill px-3 py-2 ${badgeClass}">VS</span>
                    </div>
                    <div class="text-center flex-grow-1">
                        <div class="fw-bold text-dark h5 mb-0">${p.squadra2.nome}</div>
                    </div>
                </div>
                <div class="text-center mt-3 pt-3 border-top small fw-bold text-uppercase tracking-widest ${p.girone === 99 ? 'text-danger' : 'text-muted'}">
                    ${stageLabel}
                </div>
            </div>
        </div>
    `}).join('') || '<div class="text-center py-5 text-muted opacity-50"><h3>☕</h3>Nessuna partita in attesa.<br>Genera i match per iniziare!</div>';
}

function updateAdminView() {
    const loginSection = document.getElementById('admin-login-section');
    const controlsSection = document.getElementById('admin-controls-section');
    const navAdmin = document.getElementById('nav-admin');
    const navSquadre = document.getElementById('nav-squadre-container');
    const navPartite = document.getElementById('nav-partite-container');
    const headerReset = document.getElementById('header-reset-btn');

    if (loginSection) loginSection.style.display = 'none';
    if (controlsSection) controlsSection.style.display = 'block';
    if (navSquadre) navSquadre.classList.remove('d-none');
    if (navPartite) navPartite.classList.remove('d-none');
    if (headerReset) headerReset.classList.remove('d-none');
    if (navAdmin) {
        navAdmin.innerHTML = 'Reset';
        navAdmin.classList.remove('btn-primary');
        navAdmin.classList.add('btn-success');
    }
}

async function attemptLogin() {
    showNotify("Login rimosso", "L'area admin � sempre disponibile.", "info");
}

function logout() {
    showNotify("Login rimosso", "L'area admin � sempre disponibile.", "info");
    updateAdminView();
}




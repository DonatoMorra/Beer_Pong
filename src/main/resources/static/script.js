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

window.onload = async () => {
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
    if (!activeGroups.includes(parseInt(select.value))) select.value = '1';
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

    const newTeam = {
        nome: name,
        punti: 0,
        girone: parseInt(gironeSelect.value),
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
        if (activeTeams.length < 2) {
            showNotify("⚠️ Squadre insufficienti", "Servono almeno 2 squadre per continuare!", "warning");
            return;
        }

        let generatedAny = false;
        
        // LOGICA DI PROGRESSIONE ROBUSTA (State-Machine)
        const stages = currentMatches.map(p => p.girone);
        const maxStage = currentMatches.length > 0 ? Math.max(...stages) : 0;
        const groupStageMatches = currentMatches.filter(p => p.girone > 0 && p.girone < 80);
        const eliminationMatches = currentMatches.filter(p => p.girone >= 80);
        const groupStageIncomplete = groupStageMatches.some(p => !p.giocata);

        if (groupStageIncomplete) {
            showNotify("⚠️ Partite gironi in corso", "Finisci tutte le partite del girone prima di generare il prossimo round.", "warning");
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
            // --- GIRONE COMPLETATO, AVANZANO SOLO VINCE PER GIRONE ---
            const winners = getGroupWinners();
            if (winners.length < 2) {
                showNotify("⚠️ Nessun girone pronto", "Occorre almeno un vincitore di girone per continuare.", "warning");
                return;
            }
            let stageCode = 66;
            if (winners.length === 2) stageCode = 99;
            else if (winners.length <= 4) stageCode = 88;
            else if (winners.length <= 8) stageCode = 77;
            await createBalancedMatches(winners, stageCode);
            generatedAny = true;
        } else if (maxStage === 88) {
            // --- FASE: GENERAZIONE FINALE (99) ---
            const finalists = [...activeTeams]
                .sort((a, b) => (b.punti - a.punti) || (b.vittorie - a.vittorie) || ((b.bicchieriFatti - b.bicchieriSubiti) - (a.bicchieriFatti - a.bicchieriSubiti)))
                .slice(0, 2);
            
            if (finalists.length === 2) {
                await createBalancedMatches(finalists, 99);
                generatedAny = true;
            } else {
                showNotify("⚠️ Errore", "Impossibile determinare i 2 finalisti.", "danger");
                return;
            }
        } else if (maxStage === 77 || activeTeams.length <= 4) {
            // --- FASE: GENERAZIONE SEMIFINALI (88) ---
            const semifinalists = [...activeTeams]
                .sort((a, b) => (b.punti - a.punti) || (b.vittorie - a.vittorie) || ((b.bicchieriFatti - b.bicchieriSubiti) - (a.bicchieriFatti - a.bicchieriSubiti)))
                .slice(0, 4);
            
            if (semifinalists.length >= 2) {
                await createBalancedMatches(semifinalists, 88);
                generatedAny = true;
            } else {
                showNotify("⚠️ Squadre insufficienti", "Mancano squadre per le semifinali.", "warning");
                return;
            }
        } else if (maxStage === 66 || activeTeams.length <= 8) {
            // --- FASE: GENERAZIONE QUARTI (77) ---
            const quarterFinalists = [...activeTeams]
                .sort((a, b) => (b.punti - a.punti) || (b.vittorie - a.vittorie) || ((b.bicchieriFatti - b.bicchieriSubiti) - (a.bicchieriFatti - a.bicchieriSubiti)))
                .slice(0, 8);
            
            if (quarterFinalists.length >= 2) {
                await createBalancedMatches(quarterFinalists, 77);
                generatedAny = true;
            } else {
                showNotify("⚠️ Squadre insufficienti", "Mancano squadre per i quarti.", "warning");
                return;
            }
        } else if (maxStage > 0 || activeTeams.length <= 16) {
            // --- FASE: GENERAZIONE OTTAVI (66) ---
            const ottaviTeams = [...activeTeams]
                .sort((a, b) => (b.punti - a.punti) || (b.vittorie - a.vittorie) || ((b.bicchieriFatti - b.bicchieriSubiti) - (a.bicchieriFatti - a.bicchieriSubiti)))
                .slice(0, 16);
            
            if (ottaviTeams.length >= 2) {
                await createBalancedMatches(ottaviTeams, 66);
                generatedAny = true;
            } else {
                showNotify("⚠️ Squadre insufficienti", "Mancano squadre per gli ottavi.", "warning");
                return;
            }
        } else {
            // Fallback: nessuna azione possibile
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

async function createBalancedMatches(squadre, gironeNum) {
    let created = false;
    const groups = {};
    squadre.forEach(s => {
        const key = `${s.vittorie}-${s.sconfitte}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(s);
    });

    for (const key in groups) {
        let shuffled = groups[key].sort(() => 0.5 - Math.random());
        for (let i = 0; i < shuffled.length - 1; i += 2) {
            const s1 = shuffled[i];
            const s2 = shuffled[i+1];

            // Controllo duplicati: hanno già giocato tra loro?
            const alreadyPlayed = allPartite.some(p => 
                (p.squadra1.id == s1.id && p.squadra2.id == s2.id) ||
                (p.squadra1.id == s2.id && p.squadra2.id == s1.id)
            );

            // In semifinale e finale ignoriamo il controllo duplicati (devono giocare!)
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

async function createGroupRoundRobinMatches(squadre, gironeNum, existingMatches) {
    let created = false;
    for (let i = 0; i < squadre.length; i++) {
        for (let j = i + 1; j < squadre.length; j++) {
            const s1 = squadre[i];
            const s2 = squadre[j];
            const alreadyExists = existingMatches.some(p =>
                p.girone === gironeNum &&
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

function getGroupWinners() {
    const groupIds = [...new Set(teams.map(t => t.girone))].sort((a, b) => a - b);
    return groupIds.map(g => {
        const groupTeams = teams.filter(t => t.girone === g);
        return groupTeams.sort((a, b) =>
            (b.punti - a.punti) ||
            (b.vittorie - a.vittorie) ||
            ((b.bicchieriFatti - b.bicchieriSubiti) - (a.bicchieriFatti - a.bicchieriSubiti))
        )[0];
    }).filter(Boolean);
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
    document.getElementById('upcoming-count').innerText = `${upcoming.length} da giocare`;
    
    const stageLabel = (stage) => {
        if (stage === 99) return '🏆 Finalissima';
        if (stage === 88) return '🔥 Semifinale';
        if (stage === 77) return '⚡ Quarti';
        if (stage === 66) return '🎯 Ottavi';
        if (stage === 0) return 'Girone misto';
        return 'Girone ' + stage;
    };

    // Render Storico
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
                    ${stageLabel(p.girone)}
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




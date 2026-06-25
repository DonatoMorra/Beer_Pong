package com.example.Gioco.a.squadre.Service;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.Gioco.a.squadre.Model.Squadra;
import com.example.Gioco.a.squadre.Model.Utente;
import com.example.Gioco.a.squadre.Repository.SquadreRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class SquadreService {

    private final SquadreRepository squadreRepository;
    private final com.example.Gioco.a.squadre.Repository.PartitaRepository partitaRepository;

    // 1. Recupera tutte le squadre (per la dashboard e classifica)
    public List<Squadra> findAll() {
        return squadreRepository.findAll();
    }

    // 2. Salva o Crea una nuova squadra
    @Transactional
    public Squadra save(Squadra squadra) {
        if (squadra.getGiocatori() != null && squadra.getGiocatori().size() > 2) {
            throw new IllegalStateException("Una squadra non può avere più di 2 giocatori.");
        }
        return squadreRepository.save(squadra);
    }

    // 3. Aggiorna solo i punti di una squadra
    @Transactional
    public void updatePunti(Long id, int nuoviPunti) {
        squadreRepository.findById(id).ifPresent(squadra -> {
            squadra.setPunti(nuoviPunti);
            squadreRepository.save(squadra);
        });
    }

    // 3b. Aggiorna il girone di una squadra
    @Transactional
    public void updateGirone(Long id, int girone) {
        squadreRepository.findById(id).ifPresent(squadra -> {
            squadra.setGirone(girone);
            squadreRepository.save(squadra);
        });
    }

    // 4. Elimina una singola squadra
    @Transactional
    public void delete(Long id) {
        squadreRepository.deleteById(id);
    }

    // 5. Elimina TUTTE le squadre (Tasto svuota torneo)
    @Transactional
    public void deleteAll() {
        partitaRepository.deleteAll();
        squadreRepository.deleteAll();
    }

    // --- GESTIONE UTENTI (GIOCATORI) ---

    // 6. Aggiunge un utente a una squadra esistente
    @Transactional
    public void addUtenteToSquadra(Long squadraId, Utente nuovoUtente) {
        squadreRepository.findById(squadraId).ifPresent(squadra -> {
            if (squadra.getGiocatori().size() < 2) {
                squadra.getGiocatori().add(nuovoUtente);
                squadreRepository.save(squadra);
            } else {
                throw new IllegalStateException("La squadra ha già il numero massimo di giocatori (2).");
            }
        });
    }

    // 7. Modifica nome utente o elimina utente
    // Nota: Grazie al CascadeType.ALL nel model Squadra,
    // modificando la lista giocatori e salvando la squadra, JPA aggiorna il DB.

    @Transactional
    public void removeUtente(Long squadraId, Long utenteId) {
        squadreRepository.findById(squadraId).ifPresent(squadra -> {
            squadra.getGiocatori().removeIf(u -> u.getId().equals(utenteId));
            squadreRepository.save(squadra);
        });
    }

    // --- GESTIONE PARTITE ---

    @Transactional
    public com.example.Gioco.a.squadre.Model.Partita registraPartita(
            com.example.Gioco.a.squadre.Model.Partita partita) {
        com.example.Gioco.a.squadre.Model.Partita pToSave;
        if (partita.getId() != null) {
            pToSave = partitaRepository.findById(partita.getId()).orElse(partita);
        } else {
            pToSave = partita;
        }

        Squadra s1 = squadreRepository.findById(pToSave.getSquadra1().getId()).orElseThrow();
        Squadra s2 = squadreRepository.findById(pToSave.getSquadra2().getId()).orElseThrow();

        pToSave.setSquadra1(s1);
        pToSave.setSquadra2(s2);
        pToSave.setBicchieriSquadra1(partita.getBicchieriSquadra1());
        pToSave.setBicchieriSquadra2(partita.getBicchieriSquadra2());
        pToSave.setGiocata(true);

        // Aggiorna bicchieri
        s1.setBicchieriFatti(s1.getBicchieriFatti() + pToSave.getBicchieriSquadra1());
        s1.setBicchieriSubiti(s1.getBicchieriSubiti() + pToSave.getBicchieriSquadra2());
        s2.setBicchieriFatti(s2.getBicchieriFatti() + pToSave.getBicchieriSquadra2());
        s2.setBicchieriSubiti(s2.getBicchieriSubiti() + pToSave.getBicchieriSquadra1());

        // Calcola vincitore
        if (pToSave.getBicchieriSquadra1() > pToSave.getBicchieriSquadra2()) {
            s1.setVittorie(s1.getVittorie() + 1);
            s1.setPunti(s1.getPunti() + 3);
            s2.setSconfitte(s2.getSconfitte() + 1);
        } else if (pToSave.getBicchieriSquadra2() > pToSave.getBicchieriSquadra1()) {
            s2.setVittorie(s2.getVittorie() + 1);
            s2.setPunti(s2.getPunti() + 3);
            s1.setSconfitte(s1.getSconfitte() + 1);
        } else {
            s1.setPareggi(s1.getPareggi() + 1);
            s2.setPareggi(s2.getPareggi() + 1);
            s1.setPunti(s1.getPunti() + 1);
            s2.setPunti(s2.getPunti() + 1);
        }

        squadreRepository.save(s1);
        squadreRepository.save(s2);
        return partitaRepository.save(pToSave);
    }

    @Transactional
    public com.example.Gioco.a.squadre.Model.Partita savePartita(com.example.Gioco.a.squadre.Model.Partita p) {
        Squadra s1 = squadreRepository.findById(p.getSquadra1().getId()).orElseThrow();
        p.setSquadra1(s1);
        if (p.getSquadra2() != null && p.getSquadra2().getId() != null) {
            Squadra s2 = squadreRepository.findById(p.getSquadra2().getId()).orElseThrow();
            p.setSquadra2(s2);
        } else {
            p.setSquadra2(null);
        }
        return partitaRepository.save(p);
    }

    public List<com.example.Gioco.a.squadre.Model.Partita> findAllPartite() {
        return partitaRepository.findAll();
    }
}
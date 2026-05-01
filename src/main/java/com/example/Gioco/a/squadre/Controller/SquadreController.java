package com.example.Gioco.a.squadre.Controller;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.Gioco.a.squadre.Model.Partita;
import com.example.Gioco.a.squadre.Model.Squadra;
import com.example.Gioco.a.squadre.Service.SquadreService;

@RestController
@RequestMapping("/api/squadre")
@CrossOrigin(origins = "*")
public class SquadreController {

    @Autowired
    private SquadreService squadreService;

    @GetMapping("/ip")
    public String getServerIp() {
        String hostIp = System.getenv("HOST_IP");
        if (hostIp != null && !hostIp.isEmpty()) {
            return hostIp;
        }
        return "localhost";
    }

    @GetMapping
    public List<Squadra> getAll() {
        return squadreService.findAll();
    }

    @PostMapping
    public Squadra create(@RequestBody Squadra s) {
        return squadreService.save(s);
    }

    @PutMapping("/{id}/punti")
    public void updatePunti(@PathVariable Long id, @RequestBody int punti) {
        squadreService.updatePunti(id, punti);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        squadreService.delete(id);
    }

    @DeleteMapping("/all")
    public void deleteAll() {
        squadreService.deleteAll();
    }

    // --- PARTITE ---

    @GetMapping("/partite")
    public List<Partita> getPartite() {
        return squadreService.findAllPartite();
    }

    @PostMapping("/partite")
    public Partita registraPartita(@RequestBody Partita p) {
        return squadreService.registraPartita(p);
    }

    @PostMapping("/partite/nuova")
    public Partita creaPartita(@RequestBody Partita p) {
        return squadreService.savePartita(p);
    }
}

package com.example.Gioco.a.squadre.Model;

import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Entity;
import jakarta.persistence.OneToMany;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

@Entity
@Data
@AllArgsConstructor
@NoArgsConstructor
@EqualsAndHashCode(callSuper = true)
public class Squadra extends BaseEntity {
    private String nome;
    private int punti;
    private int girone;
    private int vittorie;
    private int sconfitte;
    private int bicchieriFatti;
    private int bicchieriSubiti;

    @OneToMany(mappedBy = "squadra", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Utente> giocatori = new ArrayList<>();
}

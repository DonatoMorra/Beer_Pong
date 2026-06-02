package com.example.Gioco.a.squadre.Model;

import jakarta.persistence.Entity;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
@EqualsAndHashCode(callSuper = true)
@Entity
public class Partita extends BaseEntity {

    private int bicchieriSquadra1;
    private int bicchieriSquadra2;

    private int girone;
    private boolean giocata = false;

    @ManyToOne
    @JoinColumn(name = "squadra1_id")
    private Squadra squadra1;

    @ManyToOne
    @JoinColumn(name = "squadra2_id")
    private Squadra squadra2;

}

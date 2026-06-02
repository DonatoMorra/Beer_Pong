package com.example.Gioco.a.squadre.Model;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import com.fasterxml.jackson.annotation.JsonIgnore;

@Data
@AllArgsConstructor
@NoArgsConstructor
@EqualsAndHashCode(callSuper = true)
@Entity
public class Utente extends BaseEntity {

    private String nome;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "squadra_id")
    @JsonIgnore
    private Squadra squadra;

}

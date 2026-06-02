# 🏆 BEERPONG CHAMPIONS - Tournament Manager Professional

![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.x-brightgreen)
![Java](https://img.shields.io/badge/Java-21-orange)
![MySQL](https://img.shields.io/badge/MySQL-8.0-blue)
![Docker](https://img.shields.io/badge/Docker-Ready-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)

**BEERPONG CHAMPIONS** è un'applicazione web professionale progettata per la gestione completa di tornei di Beer Pong. Caratterizzata da un design **Premium Glassmorphism**, offre un'esperienza utente fluida, sicura e moderna.

---

## 🚀 Funzionalità Esclusive

- **🔐 Sicurezza Admin**: Area protetta da credenziali per la gestione di squadre, punteggi e reset del torneo.
- **📱 QR Code & Live View**: Generazione automatica di un QR Code per permettere ai partecipanti di seguire la classifica in tempo reale dai propri smartphone (modalità sola lettura).
- **⚔️ Algoritmo di Matchmaking**: Generazione automatica di round bilanciati basati sulle prestazioni delle squadre.
- **🔥 Progression Dinamica**: Gestione automatica del passaggio dai Gironi alle **Semifinali** e alla **Finalissima**.
- **🎭 Design Premium**: Interfaccia responsiva con micro-animazioni, modalità dark-mode adaptive e layout moderno.

---

## 🛠️ Tech Stack

### Backend & Database
- **Java 21** & **Spring Boot 3**.
- **Spring Security**: Protezione degli endpoint e gestione accessi.
- **MySQL 8**: Database relazionale per la persistenza dei dati.

### Frontend
- **Vanilla JS & HTML5**: Logica reattiva senza dipendenze pesanti.
- **Bootstrap 5**: Struttura responsiva.
- **Animate.css**: Animazioni fluide per gli eventi del torneo.

---

## 📦 Installazione e Avvio

### 🐳 Avvio rapido con Docker (Consigliato)

1. **Clona la repository**:
   ```bash
   git clone https://github.com/DonatoMorra/Beer_Pong.git
   cd Beer_Pong
   ```

2. **Configura la Password Admin**:
   Crea o modifica il file `.env` nella root del progetto:
   ```env
   ADMIN_PASSWORD=la_tua_password_segreta
   MYSQL_ROOT_PASSWORD=root
   ```

3. **Avvia i container**:
   ```bash
   # Opzione A - esposizione porta DB su host (porta host: 3308 -> container: 3306)
   docker compose up --build -d

   # Opzione B - DB accessibile solo dalla rete Docker (non esporre la porta MySQL al host)
   docker compose -f docker-compose.no-ports.yml up --build -d
   ```

4. **Accedi all'app**:
   - **Main App**: [http://localhost:8081](http://localhost:8081)
   - **Login Default**: User: `admin` | Pass: `roccadaspideBeer` (se non cambiata nel .env)

---

## 📖 Guida all'Uso

1. **Setup**: Accedi all'area Admin, crea le squadre e assegnale ai gironi.
2. **Torneo**: Genera i round iniziali. Registra i risultati match dopo match.
3. **Pubblico**: Condividi il QR Code generato nella dashboard per permettere a tutti di vedere la classifica aggiornata (senza poter modificare nulla).
4. **Fase Finale**: Il sistema rileverà automaticamente la fine dei gironi e ti proporrà di generare Semifinali e Finalissima.

---

## 🤝 Contributi

Se vuoi migliorare BeerPong Champions, sentiti libero di aprire una Pull Request o segnalare un bug nelle Issue!

---

## 👤 Autore

- **Donato Morra** - [GitHub Profile](https://github.com/DonatoMorra)

---

> Progetto realizzato per elevare ogni torneo di Beer Pong ad un livello competitivo e professionale! 🍻🏓🏆

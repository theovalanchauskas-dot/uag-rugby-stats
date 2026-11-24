#!/usr/bin/env python3
"""
UAG RUGBY GAILLAC - Serveur de Statistiques en Direct
Application multi-utilisateurs temps réel pour le staff et les joueuses blessées.
"""

import http.server
import json
import os
import socket
import sys
import threading
import time
import urllib.parse
from datetime import datetime

PORT = 8000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
PUBLIC_DIR = os.path.join(BASE_DIR, "public")
STATE_FILE = os.path.join(DATA_DIR, "current_match.json")
DEFAULT_STATE_FILE = os.path.join(DATA_DIR, "default_state.json")
STANDINGS_FILE = os.path.join(DATA_DIR, "standings.json")

# Catégories officielles issues de la note de match UAG Gaillac
CATEGORIES_METADATA = {
    "tackles_made": {"label": "Plaquage réussi", "short": "Plaquage +", "type": "positive", "group": "defense"},
    "tackles_missed": {"label": "Plaquage manqué", "short": "Plaquage -", "type": "negative", "group": "defense"},
    "turnovers_won": {"label": "Grattage", "short": "Grattage", "type": "positive", "group": "defense"},
    "offensive_actions": {"label": "Action offensives", "short": "Action Off.", "type": "positive", "group": "attaque"},
    "turnovers_lost": {"label": "Perte de balles", "short": "Perte balle", "type": "negative", "group": "attaque"},
    "rucks_lost": {"label": "Ruck perdu/inefficace", "short": "Ruck inefficace", "type": "negative", "group": "ruck"},
    "penalties": {"label": "Pénalité", "short": "Pénalité", "type": "negative", "group": "discipline"},
    "yellow_cards": {"label": "Carton jaune", "short": "Carton J.", "type": "negative", "group": "discipline"},
    "red_cards": {"label": "Carton rouge", "short": "Carton R.", "type": "negative", "group": "discipline"},
    "white_cards": {"label": "Carton blanc", "short": "Carton B.", "type": "negative", "group": "discipline"},
    "minutes_played": {"label": "Temp de jeu", "short": "Tps jeu (mn)", "type": "neutral", "group": "temps"},
    "tries": {"label": "Essai", "short": "Essai", "type": "highlight", "group": "marque"},
    "lineout_throws_made": {"label": "Lancer réussi", "short": "Lancer +", "type": "positive", "group": "conquete"},
    "lineout_throws_lost": {"label": "Lancer manqué", "short": "Lancer -", "type": "negative", "group": "conquete"},
}

lock = threading.Lock()
sse_clients = []


def get_local_ip():
    """Détecte l'adresse IP locale du Mac sur le réseau Wi-Fi / partage de connexion."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        try:
            import subprocess
            out = subprocess.check_output("ifconfig | grep 'inet ' | grep -v 127.0.0.1", shell=True).decode()
            for line in out.splitlines():
                parts = line.strip().split()
                if len(parts) >= 2:
                    return parts[1]
        except Exception:
            pass
    return "127.0.0.1"


def load_state():
    """Charge l'état du match depuis current_match.json ou default_state.json."""
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[WARN] Erreur lecture {STATE_FILE}: {e}")

    if os.path.exists(DEFAULT_STATE_FILE):
        with open(DEFAULT_STATE_FILE, "r", encoding="utf-8") as f:
            state = json.load(f)
            save_state(state)
            return state

    return {"match": {}, "players": [], "history": []}


def save_state(state):
    """Sauvegarde l'état dans le fichier JSON."""
    os.makedirs(DATA_DIR, exist_ok=True)
    temp_file = STATE_FILE + ".tmp"
    with open(temp_file, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)
    os.replace(temp_file, STATE_FILE)


match_state = load_state()


def broadcast_update(event_type="update", data=None):
    """Diffuse la mise à jour à tous les téléphones et tablettes connectés."""
    global sse_clients
    if data is None:
        data = match_state

    payload = f"event: {event_type}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n".encode("utf-8")
    dead_clients = []

    with lock:
        clients_copy = list(sse_clients)

    for client in clients_copy:
        try:
            client.wfile.write(payload)
            client.wfile.flush()
        except Exception:
            dead_clients.append(client)

    if dead_clients:
        with lock:
            for dead in dead_clients:
                if dead in sse_clients:
                    sse_clients.remove(dead)


def ping_worker():
    """Envoie des pings réguliers pour maintenir les flux SSE ouverts sur mobile."""
    while True:
        time.sleep(15)
        ping_payload = b": ping\n\n"
        dead_clients = []
        with lock:
            clients_copy = list(sse_clients)
        for client in clients_copy:
            try:
                client.wfile.write(ping_payload)
                client.wfile.flush()
            except Exception:
                dead_clients.append(client)
        if dead_clients:
            with lock:
                for dead in dead_clients:
                    if dead in sse_clients:
                        sse_clients.remove(dead)


def load_standings():
    """Charge le classement de Fédérale 1 Féminine depuis data/standings.json."""
    if os.path.exists(STANDINGS_FILE):
        try:
            with open(STANDINGS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"Erreur chargement standings.json: {e}")
    return {
        "competition": "Fédérale 1 Féminine",
        "pool": "Poule 3 - Phase de Qualification",
        "season": "2026/2027",
        "source": "Fédération Française de Rugby (FFR - Mon Club House)",
        "source_url": "https://monclubhouse.ffr.fr/nationales/federale-1-feminine/qualification-50138/73056/classements",
        "last_updated": datetime.now().strftime("%d/%m/%Y"),
        "next_update": "Dimanche soir après les rencontres",
        "teams": []
    }


def save_standings(data):
    """Enregistre le classement dans data/standings.json."""
    try:
        with open(STANDINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Erreur sauvegarde standings.json: {e}")


def standings_weekend_scheduler():
    """Vérifie l'actualisation du classement lors des week-ends de match."""
    while True:
        try:
            now = datetime.now()
            # 5 = Samedi, 6 = Dimanche
            if now.weekday() in (5, 6):
                data = load_standings()
                today_str = now.strftime("%d/%m/%Y")
                if data.get("last_updated") != today_str:
                    data["last_updated"] = today_str
                    save_standings(data)
                    broadcast_update("standings_update", data)
        except Exception as e:
            print(f"[Standings Scheduler Error] {e}")
        time.sleep(3600 * 4)  # Vérification toutes les 4 heures


# Lancement des threads d'arrière-plan
ping_thread = threading.Thread(target=ping_worker, daemon=True)
ping_thread.start()

standings_thread = threading.Thread(target=standings_weekend_scheduler, daemon=True)
standings_thread.start()


class UAGRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PUBLIC_DIR, **kwargs)

    def log_message(self, format, *args):
        # Ne logue pas les pings SSE pour garder la console propre
        if "events" not in str(args):
            super().log_message(format, *args)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == "/api/events":
            self.handle_sse()
            return
        elif path == "/api/state":
            self.send_json(match_state)
            return
        elif path == "/api/network":
            local_ip = get_local_ip()
            host_header = self.headers.get("Host", "")
            scheme = "https" if self.headers.get("X-Forwarded-Proto") == "https" else "http"
            if host_header and not host_header.startswith("localhost") and not host_header.startswith("127.0.0.1"):
                url = f"{scheme}://{host_header}"
            else:
                url = f"http://{local_ip}:{PORT}"

            self.send_json({
                "local_ip": local_ip,
                "port": PORT,
                "url": url,
                "connected_clients": len(sse_clients),
                "timestamp": int(time.time())
            })
            return
        elif path == "/api/categories":
            self.send_json(CATEGORIES_METADATA)
            return
        elif path == "/api/export/note":
            self.handle_export_note(parsed.query)
            return
        elif path == "/api/standings":
            self.handle_get_standings()
            return

        # Fichiers statiques par défaut
        super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length) if content_length > 0 else b"{}"
        try:
            payload = json.loads(body.decode("utf-8")) if body else {}
        except Exception:
            payload = {}

        if path == "/api/action":
            self.handle_action(payload)
        elif path == "/api/undo":
            self.handle_undo()
        elif path == "/api/match":
            self.handle_update_match(payload)
        elif path == "/api/player":
            self.handle_upsert_player(payload)
        elif path == "/api/player/delete":
            self.handle_delete_player(payload)
        elif path == "/api/reset":
            self.handle_reset(payload)
        elif path == "/api/load-standard-team":
            self.handle_load_standard_team()
        elif path == "/api/standings":
            self.handle_update_standings(payload)
        else:
            self.send_error(404, "Endpoint non trouvé")

    def handle_sse(self):
        """Gestionnaire de connexion Server-Sent Events (SSE)."""
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Connection", "keep-alive")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()

        # Envoi initial de l'état complet
        initial_data = f"event: init\ndata: {json.dumps(match_state, ensure_ascii=False)}\n\n".encode("utf-8")
        try:
            self.wfile.write(initial_data)
            self.wfile.flush()
        except Exception:
            return

        with lock:
            sse_clients.append(self)

        # Maintient la connexion ouverte
        try:
            while True:
                time.sleep(1)
        except Exception:
            pass
        finally:
            with lock:
                if self in sse_clients:
                    sse_clients.remove(self)

    def handle_action(self, payload):
        """
        Incrémente ou décrémente une statistique en direct.
        Payload attendu:
        {
            "playerId": "p1",
            "half": "first" | "second",
            "category": "tackles_made",
            "delta": 1 | -1,
            "user": "Nom de la blessée (optionnel)"
        }
        """
        player_id = payload.get("playerId")
        half = payload.get("half", match_state.get("match", {}).get("currentHalf", "first"))
        category = payload.get("category")
        delta = int(payload.get("delta", 1))
        user_name = payload.get("user", "Joueuse blessée")

        if not player_id or not category:
            self.send_error(400, "playerId et category requis")
            return

        with lock:
            target_player = None
            for p in match_state.get("players", []):
                if p["id"] == player_id:
                    target_player = p
                    break

            if not target_player:
                self.send_error(404, "Joueuse non trouvée")
                return

            if half not in target_player["stats"]:
                target_player["stats"][half] = {}

            current_val = target_player["stats"][half].get(category, 0)
            new_val = max(0, current_val + delta)
            target_player["stats"][half][category] = new_val

            # Si l'action est un essai marqué, on peut aussi incrémenter le score du match si c'est un +1
            if category == "tries":
                if delta > 0:
                    match_state["match"]["scoreUAG"] = match_state["match"].get("scoreUAG", 0) + 5
                elif delta < 0 and match_state["match"].get("scoreUAG", 0) >= 5:
                    match_state["match"]["scoreUAG"] = max(0, match_state["match"].get("scoreUAG", 0) - 5)

            cat_info = CATEGORIES_METADATA.get(category, {"label": category})
            action_record = {
                "id": f"act-{int(time.time() * 1000)}",
                "time": datetime.now().strftime("%H:%M:%S"),
                "minute": match_state.get("match", {}).get("timer", {}).get("minutes", 0),
                "half": half,
                "playerId": player_id,
                "playerName": target_player["name"],
                "category": category,
                "label": cat_info.get("label", category),
                "delta": delta,
                "newValue": new_val,
                "user": user_name
            }

            if "history" not in match_state:
                match_state["history"] = []
            match_state["history"].insert(0, action_record)
            # Limite l'historique aux 200 dernières actions
            match_state["history"] = match_state["history"][:200]

            save_state(match_state)

        # Diffusion temps réel à tous les écrans
        broadcast_update("action", {
            "state": match_state,
            "lastAction": action_record
        })

        self.send_json({"success": True, "action": action_record, "state": match_state})

    def handle_undo(self):
        """Annule la toute dernière action enregistrée."""
        with lock:
            if not match_state.get("history"):
                self.send_json({"success": False, "message": "Aucune action à annuler"})
                return

            last_action = match_state["history"].pop(0)
            p_id = last_action["playerId"]
            half = last_action["half"]
            cat = last_action["category"]
            delta = last_action["delta"]

            for p in match_state.get("players", []):
                if p["id"] == p_id:
                    cur = p["stats"].get(half, {}).get(cat, 0)
                    p["stats"][half][cat] = max(0, cur - delta)
                    break

            if cat == "tries":
                if delta > 0:
                    match_state["match"]["scoreUAG"] = max(0, match_state["match"].get("scoreUAG", 0) - 5)
                elif delta < 0:
                    match_state["match"]["scoreUAG"] = match_state["match"].get("scoreUAG", 0) + 5

            save_state(match_state)

        broadcast_update("undo", {
            "state": match_state,
            "undoneAction": last_action
        })

        self.send_json({"success": True, "undone": last_action, "state": match_state})

    def handle_update_match(self, payload):
        """Met à jour les informations du match (score, chrono, mi-temps, adversaire)."""
        with lock:
            match_info = match_state.get("match", {})
            for k, v in payload.items():
                if k == "timer" and isinstance(v, dict):
                    match_info.setdefault("timer", {})
                    match_info["timer"].update(v)
                else:
                    match_info[k] = v
            match_state["match"] = match_info
            save_state(match_state)

        broadcast_update("match_update", match_state)
        self.send_json({"success": True, "match": match_state["match"]})

    def handle_upsert_player(self, payload):
        """Ajoute ou modifie une joueuse."""
        p_id = payload.get("id")
        name = payload.get("name", "").strip()
        if not name:
            self.send_error(400, "Le nom de la joueuse est obligatoire")
            return

        with lock:
            players = match_state.get("players", [])
            existing = None
            if p_id:
                for p in players:
                    if p["id"] == p_id:
                        existing = p
                        break

            if existing:
                existing["name"] = name
                existing["number"] = payload.get("number", existing.get("number", 0))
                existing["position"] = payload.get("position", existing.get("position", ""))
                existing["tracker"] = payload.get("tracker", existing.get("tracker", ""))
                existing["active"] = payload.get("active", existing.get("active", True))
            else:
                new_id = f"p{int(time.time() * 1000) % 100000}"
                new_player = {
                    "id": new_id,
                    "name": name,
                    "number": payload.get("number", len(players) + 1),
                    "position": payload.get("position", "Joueuse"),
                    "tracker": payload.get("tracker", ""),
                    "active": True,
                    "stats": {
                        "first": {k: 0 for k in CATEGORIES_METADATA.keys()},
                        "second": {k: 0 for k in CATEGORIES_METADATA.keys()}
                    }
                }
                players.append(new_player)
                match_state["players"] = players

            save_state(match_state)

        broadcast_update("players_update", match_state)
        self.send_json({"success": True, "state": match_state})

    def handle_delete_player(self, payload):
        """Supprime une joueuse de la feuille de match."""
        p_id = payload.get("id")
        with lock:
            players = match_state.get("players", [])
            match_state["players"] = [p for p in players if p["id"] != p_id]
            save_state(match_state)

        broadcast_update("players_update", match_state)
        self.send_json({"success": True, "state": match_state})

    def handle_reset(self, payload):
        """Réinitialise les stats du match ou d'une mi-temps."""
        scope = payload.get("scope", "all")
        with lock:
            for p in match_state.get("players", []):
                if scope in ("all", "first"):
                    p["stats"]["first"] = {k: 0 for k in CATEGORIES_METADATA.keys()}
                if scope in ("all", "second"):
                    p["stats"]["second"] = {k: 0 for k in CATEGORIES_METADATA.keys()}
            if scope == "all":
                match_state["history"] = []
                match_state["match"]["scoreUAG"] = 0
                match_state["match"]["scoreOpponent"] = 0
                match_state["match"]["currentHalf"] = "first"
                match_state["match"]["timer"] = {"minutes": 0, "seconds": 0, "isRunning": False}
            save_state(match_state)

        broadcast_update("reset", match_state)
        self.send_json({"success": True, "state": match_state})

    def handle_load_standard_team(self):
        """Charge l'effectif type des 15 postes officiels de l'UAG Gaillac."""
        standard_players = [
            {"id": "p1", "number": 1, "name": "Léa", "position": "Pilier Gauche"},
            {"id": "p2", "number": 2, "name": "Nono", "position": "Talonneuse"},
            {"id": "p3", "number": 3, "name": "Manon", "position": "Pilier Droit"},
            {"id": "p4", "number": 4, "name": "Clara", "position": "Deuxième Ligne"},
            {"id": "p5", "number": 5, "name": "Emma", "position": "Deuxième Ligne"},
            {"id": "p6", "number": 6, "name": "Lucie", "position": "Troisième Ligne Aile"},
            {"id": "p7", "number": 7, "name": "Juliette", "position": "Troisième Ligne Aile"},
            {"id": "p8", "number": 8, "name": "Camille", "position": "Troisième Ligne Centre"},
            {"id": "p9", "number": 9, "name": "Inès", "position": "Demi de Mêlée"},
            {"id": "p10", "number": 10, "name": "Sarah", "position": "Demi d'Ouverture"},
            {"id": "p11", "number": 11, "name": "Mathilde", "position": "Ailière Gauche"},
            {"id": "p12", "number": 12, "name": "Jade", "position": "Premier Centre"},
            {"id": "p13", "number": 13, "name": "Anaïs", "position": "Deuxième Centre"},
            {"id": "p14", "number": 14, "name": "Chloé", "position": "Ailière Droite"},
            {"id": "p15", "number": 15, "name": "Marine", "position": "Arrière"},
        ]
        with lock:
            new_players = []
            for p in standard_players:
                new_players.append({
                    "id": p["id"],
                    "name": p["name"],
                    "number": p["number"],
                    "position": p["position"],
                    "tracker": "",
                    "active": True,
                    "stats": {
                        "first": {k: 0 for k in CATEGORIES_METADATA.keys()},
                        "second": {k: 0 for k in CATEGORIES_METADATA.keys()}
                    }
                })
            match_state["players"] = new_players
            save_state(match_state)

        broadcast_update("players_update", match_state)
        self.send_json({"success": True, "state": match_state})

    def handle_export_note(self, query_string):
        """
        Génère le texte formaté fidèle à la note iPhone du screenshot utilisateur.
        Supporte playerId spécifique ou 'all', et half 'first', 'second' ou 'total'.
        """
        params = urllib.parse.parse_qs(query_string)
        p_id = params.get("playerId", ["p1"])[0]
        half = params.get("half", ["first"])[0]

        half_title = "Première mis temps"
        if half == "second":
            half_title = "Deuxième mis temps"
        elif half == "total":
            half_title = "Match Complet (Total)"

        if p_id == "all":
            # Résumé complet de toute l'équipe UAG Gaillac
            lines = [
                f"🏉 STATS COLLECTIVES - UAG RUGBY GAILLAC",
                f"Match vs {match_state.get('match', {}).get('opponent', 'Adversaire')}",
                f"Score : UAG {match_state.get('match', {}).get('scoreUAG', 0)} - {match_state.get('match', {}).get('scoreOpponent', 0)} {match_state.get('match', {}).get('opponent', 'Adversaire')}",
                f"Période : {half_title}",
                "------------------------------------",
                ""
            ]
            for p in match_state.get("players", []):
                stats = self._get_player_stats_for_half(p, half)
                total_cartons = (stats.get("yellow_cards", 0) + 
                                 stats.get("red_cards", 0) + 
                                 stats.get("white_cards", 0))
                lines.extend([
                    f"Stat #{p.get('number', '-')} {p['name']} ({p.get('position', 'Joueuse')})",
                    f"Plaquage réussi:{stats.get('tackles_made', 0)}",
                    f"Plaquage manqué:{stats.get('tackles_missed', 0)}",
                    f"Grattage:{stats.get('turnovers_won', 0)}",
                    f"Action offensives:{stats.get('offensive_actions', 0)}",
                    f"Perte de balles:{stats.get('turnovers_lost', 0)}",
                    f"Ruck perdu/inefficace:{stats.get('rucks_lost', 0)}",
                    f"Pénalité:{stats.get('penalties', 0)}",
                    f"Carton:{total_cartons}",
                    f"Temp de jeu:{stats.get('minutes_played', 40)}mn",
                    f"Essai:{stats.get('tries', 0)}",
                    f"Lancer réussi: {stats.get('lineout_throws_made', 0)}",
                    f"Lancer manque:{stats.get('lineout_throws_lost', 0)}",
                    ""
                ])
            text_content = "\n".join(lines)
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(text_content.encode("utf-8"))
            return

        target_player = None
        for p in match_state.get("players", []):
            if p["id"] == p_id:
                target_player = p
                break

        if not target_player:
            self.send_error(404, "Joueuse non trouvée")
            return

        stats = self._get_player_stats_for_half(target_player, half)
        total_cartons = (stats.get("yellow_cards", 0) + 
                         stats.get("red_cards", 0) + 
                         stats.get("white_cards", 0))

        # Formatage exact fidèle au screen de l'utilisateur
        lines = [
            f"Stat {target_player['name']}",
            "",
            half_title,
            f"Plaquage réussi:{stats.get('tackles_made', 0)}",
            f"Plaquage manqué:{stats.get('tackles_missed', 0)}",
            f"Grattage:{stats.get('turnovers_won', 0)}",
            f"Action offensives:{stats.get('offensive_actions', 0)}",
            f"Perte de balles:{stats.get('turnovers_lost', 0)}",
            f"Ruck perdu/inefficace:{stats.get('rucks_lost', 0)}",
            f"Pénalité:{stats.get('penalties', 0)}",
            f"Carton:{total_cartons}",
            f"Temp de jeu:{stats.get('minutes_played', 40)}mn",
            f"Essai:{stats.get('tries', 0)}",
            f"Lancer réussi: {stats.get('lineout_throws_made', 0)}",
            f"Lancer manque:{stats.get('lineout_throws_lost', 0)}",
        ]

        text_content = "\n".join(lines)
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.end_headers()
        self.wfile.write(text_content.encode("utf-8"))

    def handle_get_standings(self):
        """Retourne le classement de Fédérale 1 Féminine."""
        standings = load_standings()
        self.send_json(standings)

    def handle_update_standings(self, payload):
        """Met à jour le classement ou les résultats du week-end."""
        with lock:
            standings = load_standings()
            if "teams" in payload:
                standings["teams"] = payload["teams"]
            if "last_updated" in payload:
                standings["last_updated"] = payload["last_updated"]
            else:
                standings["last_updated"] = datetime.now().strftime("%d/%m/%Y")
            save_standings(standings)
        broadcast_update("standings_update", standings)
        self.send_json({"success": True, "standings": standings})

    def _get_player_stats_for_half(self, player, half):
        """Calcule les stats d'une joueuse pour une mi-temps ou le total match."""
        if half == "total":
            first = player.get("stats", {}).get("first", {})
            second = player.get("stats", {}).get("second", {})
            total = {}
            for k in CATEGORIES_METADATA.keys():
                total[k] = first.get(k, 0) + second.get(k, 0)
            return total
        return player.get("stats", {}).get(half, {})

    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def find_available_port(start_port=8000):
    for port in [start_port, 8080, 8888, 5050, 3000, 8001, 8002]:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                s.bind(("0.0.0.0", port))
                return port
            except OSError:
                continue
    return start_port


def run_server():
    global PORT
    env_port = os.environ.get("PORT")
    if env_port and env_port.isdigit():
        PORT = int(env_port)
    elif len(sys.argv) > 1 and sys.argv[1].isdigit():
        PORT = int(sys.argv[1])
    else:
        PORT = find_available_port(PORT)

    server_address = ("0.0.0.0", PORT)
    
    class ReusableThreadingServer(http.server.ThreadingHTTPServer):
        allow_reuse_address = True

    httpd = ReusableThreadingServer(server_address, UAGRequestHandler)
    local_ip = get_local_ip()

    print("=" * 65)
    print("🏉  UAG RUGBY GAILLAC - SERVEUR DE STATISTIQUES EN DIRECT  🏉")
    print("=" * 65)
    print(f"👉 Local (sur ce Mac)       : http://localhost:{PORT}")
    print(f"👉 Réseau (téléphones/Wi-Fi): http://{local_ip}:{PORT}")
    print("=" * 65)
    print("Les joueuses blessées sur la touche peuvent flasher le QR code")
    print("ou ouvrir l'adresse ci-dessus pour saisir les stats en direct !")
    print("=" * 65)

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nArrêt du serveur UAG...")
        httpd.server_close()


if __name__ == "__main__":
    run_server()

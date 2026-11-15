#!/bin/bash
# ==============================================================================
# UAG RUGBY GAILLAC - Lanceur de l'application de statistiques de match
# ==============================================================================

cd "$(dirname "$0")"

echo ""
echo "🏉 ========================================================== 🏉"
echo "        UNION ATHLÉTIQUE GAILLACOISE RUGBY (UAG)               "
echo "             Application de Statistiques en Direct             "
echo "🏉 ========================================================== 🏉"
echo ""

# Détection de l'IP locale pour les autres téléphones
LOCAL_IP=$(/usr/bin/python3 -c "
import socket
try:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.connect(('8.8.8.8', 80))
    ip = s.getsockname()[0]
    s.close()
    print(ip)
except:
    print('127.0.0.1')
")

# Détection d'un port disponible
PORT=$(/usr/bin/python3 -c "
import socket
for p in [8000, 8080, 8888, 5050]:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            s.bind(('0.0.0.0', p))
            print(p)
            break
        except OSError:
            continue
")

if [ -z "$PORT" ]; then
    PORT=8080
fi

echo "✅ Serveur prêt !"
echo "👉 Sur ce Mac         : http://localhost:${PORT}"
echo "👉 Sur les téléphones : http://${LOCAL_IP}:${PORT}"
echo ""
echo "📱 Conseil : Fais scanner le QR Code affiché dans l'application"
echo "   aux joueuses blessées sur la touche pour qu'elles se connectent en direct !"
echo ""

# Ouverture automatique dans le navigateur
(sleep 1 && open "http://localhost:${PORT}") &

# Démarrage du serveur Python standard
/usr/bin/python3 server.py "$PORT"

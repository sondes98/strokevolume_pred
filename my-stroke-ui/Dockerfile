# Utilise une image Node
FROM node:20-alpine

# Crée un répertoire de travail
WORKDIR /app

# Copie les fichiers de configuration
COPY package*.json ./

# Installe les dépendances
RUN npm install

# Copie le reste du code
COPY . .

# Expose le port utilisé par le serveur Vite ou CRA
EXPOSE 5173

# Commande pour démarrer le serveur de dev
CMD ["npm", "run", "dev"]

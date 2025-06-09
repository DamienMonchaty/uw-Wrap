# uW-Wrap - uWebSockets.js Wrapper

Un wrapper TypeScript moderne pour uWebSockets.js avec gestion de base de données, authentification JWT, système d'erreurs et de logs.

## 🚀 Démarrage rapide

```bash
# Installation
npm install

# Configuration (copier et modifier le template)
cp .env.example .env

# Compilation
npm run build

# Démarrage
npm start

# Ou avec Bun (expérimental)
npm run start:bun
```

## 🛠️ Scripts de développement

```bash
# Développement interactif (Windows)
npm run dev

# Nettoyage du projet
npm run clean

# Vérification de santé du serveur
npm run health

# Consultation des logs
npm run logs
```

## ✨ Fonctionnalités

- ✅ **Wrapper uWebSockets.js** - Interface simplifiée pour HTTP et WebSocket
- ✅ **Gestion de base de données** - CRUD avec SQLite/MySQL
- ✅ **Authentification JWT** - Génération et validation de tokens
- ✅ **Système d'erreurs** - Gestion centralisée des erreurs avec codes personnalisés
- ✅ **Système de logs** - Logging avec niveaux (DEBUG, INFO, WARN, ERROR)
- ✅ **TypeScript** - Typage complet et interfaces
- ✅ **Architecture IoC** - Injection de dépendances
- ✅ **Repository Pattern** - Abstraction de données
- ✅ **Service Layer** - Logique métier encapsulée

## 📚 Documentation

Pour une documentation complète, consultez le dossier [`docs/`](./docs/):

- **[Setup & Configuration](./docs/setup/)** - Guides d'installation
- **[Guides d'utilisation](./docs/guides/)** - Comment utiliser le framework
- **[Architecture](./docs/architecture/)** - Documentation technique
- **[Migration](./docs/migration/)** - Guides de migration
- **[Référence](./docs/reference/)** - Résumé complet du projet

## Structure du projet

```
src/
├── auth/
│   └── jwtManager.ts       # Gestion JWT
├── core/
│   └── uWebSocketWrapper.ts # Wrapper principal
├── database/
│   └── databaseManager.ts  # Gestion de base de données
├── types/
│   └── index.ts           # Types TypeScript
├── utils/
│   ├── errorHandler.ts    # Gestion d'erreurs
│   └── logger.ts          # Système de logs
└── server.ts              # Point d'entrée principal
```

## Installation

```bash
npm install
```

## Utilisation

### Démarrage du serveur
```bash
npm start
```

### Build du projet
```bash
npm run build
```

## Licence

MIT

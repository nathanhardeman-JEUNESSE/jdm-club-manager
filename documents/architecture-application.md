# Architecture de l'application JDM Club Manager

## Objectif

Définir les écrans principaux de l'application avant le développement.

---

# Rôles et accès

L'application utilise l'adresse e-mail de connexion pour identifier l'utilisateur.

Chaque utilisateur peut posséder un ou plusieurs rôles.

Exemples de rôles :

- Visiteur
- Parent
- Gymnaste adulte
- Coach
- Secrétaire
- Trésorier
- Président
- Administrateur

Selon son rôle, l'utilisateur accède à des fonctionnalités différentes.

Un administrateur peut accéder à un espace de gestion avec des fonctionnalités supplémentaires :

- publier ou modifier les actualités
- gérer les adhérents
- gérer les groupes
- gérer le planning
- gérer les documents
- gérer la boutique
- gérer les inscriptions
- gérer les utilisateurs
- modifier certains paramètres de l'application

Les fonctionnalités d'administration ne sont pas visibles pour les utilisateurs qui n'ont pas les droits nécessaires.

# Contenus administrables

Les contenus de l'application sont répartis en deux catégories :

- Contenus fixes : structure de l'application, navigation et fonctionnalités.
- Contenus administrables : informations pouvant être modifiées depuis l'espace d'administration sans intervenir dans le code.

Les contenus administrables comprennent notamment :

- les actualités ;
- la présentation du club ;
- les coordonnées ;
- les entraîneurs ;
- les partenaires ;
- le planning ;
- la boutique ;
- les documents ;
- les compétitions ;
- les informations d'inscription ;
- les paramètres généraux du club.

---

# Écrans principaux

## Accueil public

Accessible sans connexion.

Contenu :

- Actualités du club
- Présentation rapide du club
- Planning des entraînements
- Boutique
- Inscription
- Espace membre

Remarque :

Les actualités affichées sur l'accueil public doivent être administrables depuis un espace réservé aux personnes autorisées du club.

---

## Mon club

Accessible sans connexion.

Contenu :

- Présentation de La Jeunesse du Marais
- Adresse
- Contact
- Entraîneur principal
- Email du club
- Réseaux sociaux

---

## Planning

Accessible sans connexion.

Contenu :

- Planning général des entraînements
- Occupation des salles
- Groupes
- Horaires

Règle importante :

Le planning affiché dépend du profil connecté.

- Visiteur : accès au planning public avec tous les groupes.
- Parent / Gymnaste : accès au planning personnalisé lié aux groupes de ses enfants ou à son propre groupe.
- Coach : accès prioritaire aux groupes qu'il encadre.
- Administrateur : accès au planning complet avec des filtres.

---

## Boutique

Accessible sans connexion.

Contenu :

- Articles du club
- Tailles disponibles
- Prix
- Commande

---

## Inscription

Accessible sans connexion.

Contenu :

- Saison concernée
- Formulaire d'inscription
- Redirection ou synchronisation avec HelloAsso

---

## Espace membre / Connexion

Accessible avec compte.

Contenu :

- Connexion
- Mot de passe oublié
- Accès au compte membre

---

## Mon compte

Accessible après connexion.

Contenu :

- Informations personnelles
- Mot de passe
- Mes gymnastes
- Cotisation
- Déconnexion

---

## Fiche gymnaste

Accessible après connexion.

Contenu :

- Informations du gymnaste
- Licence FFG / UFOLEP
- Mon équipe
- Mon parcours
- Documents
- WhatsApp
- Planning personnel du gymnaste

---

## Administration du club

Accessible uniquement aux utilisateurs disposant des droits d'administration.

Contenu :

- Tableau de bord
- Actualités
- Adhérents
- Groupes
- Entraîneurs
- Planning
- Documents
- Boutique
- Compétitions
- Inscriptions
- Utilisateurs
- Paramètres

Fonctionnalités boutique administrateur :

- Ajouter un produit
- Modifier un produit
- Supprimer ou masquer un produit
- Ajouter une ou plusieurs photos
- Définir le prix
- Définir les tailles disponibles
- Définir les coloris disponibles
- Choisir le type de boutique : permanente ou éphémère
- Ouvrir ou fermer une campagne éphémère
- Suivre les commandes

Fonctionnalités d'export :

- Exporter les adhérents au format Excel
- Exporter les gymnastes au format Excel
- Exporter les groupes au format Excel
- Exporter les documents manquants au format Excel
- Exporter les cotisations au format Excel
- Exporter les commandes boutique au format Excel
- Exporter les inscriptions au format Excel
- Exporter les présences au format Excel
- Filtrer les exports par saison, groupe, statut, âge, document, paiement ou produit
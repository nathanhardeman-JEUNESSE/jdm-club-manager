# Base de données JDM Club Manager

## Objectif

Définir les informations que l'application devra stocker pour gérer La Jeunesse du Marais.

---

# Familles

Une famille peut contenir :

- un ou plusieurs parents
- un ou plusieurs enfants

Exemple :

Famille Dupont

- Marie Dupont (mère)
- Lucas Dupont
- Hugo Dupont

## Règle importante

Un parent peut inscrire un ou plusieurs enfants.

Chaque enfant possède sa propre fiche adhérent et sa propre inscription pour la saison.

Exemple :

Famille Dupont

- Parent : Marie Dupont
- Enfant : Lucas Dupont - Baby Gym 5/6 ans
- Enfant : Hugo Dupont - Gym 8/10 ans

Même si le parent réalise une seule démarche, l'application doit créer une inscription distincte pour chaque adhérent.

---

# Adhérents

Informations à conserver :

- Nom
- Prénom
- Date de naissance
- Sexe
- Adresse
- Téléphone
- Email
- Photo
- Date d'inscription

---

# Groupes

Exemples :

- Baby Gym 2/3 ans
- Baby Gym 4 ans
- Baby Gym 5/6 ans
- Gym 6/8 ans
- Gym 8/10 ans
- Compétition
- Gym Adulte
- Renforcement Musculaire

---

# Entraîneurs

Informations :

- Nom
- Prénom
- Téléphone
- Email
- Diplômes
- Groupes encadrés

# Utilisateurs

Types :

- Parent
- Adhérent adulte
- Coach
- Salarié
- Bénévole
- Secrétaire
- Trésorier
- Président
- Administrateur

Informations :

- Nom
- Prénom
- Email
- Téléphone
- Rôle

---

# Saisons

Exemples :

- 2025-2026
- 2026-2027
- 2027-2028

## Règle importante

Toutes les données sportives sont liées à une saison.

Exemples :

- inscriptions
- groupes
- licences
- compétitions
- présences

---

# Inscriptions

Une inscription relie :

- un adhérent
- une saison
- un groupe

Statuts :

- Pré-inscrit
- Validé
- Refusé
- En attente

## Règle importante

Lors de l'inscription, le parent choisit uniquement une catégorie générale ou une tranche d'âge.

Le parent ne choisit pas :

- le niveau réel de l'enfant
- le groupe définitif
- l'entrée en compétition
- la fédération sportive

Ces décisions sont prises par l'équipe encadrante, les entraîneurs et/ou le bureau du club.

L'application doit donc permettre de modifier le groupe, le statut sportif et les licences après l'inscription initiale.

---

# Paiements

Modes de paiement :

- Carte bancaire
- Chèque
- Espèces
- Pass'Sport
- Virement

Informations :

- Montant
- Date
- Mode
- Statut

# Réductions

Types :

- Résident Lille / Lomme / Hellemmes
- Pass'Sport
- Réduction exceptionnelle

Informations :

- Motif
- Montant
- Justificatif

---

# Documents

Documents possibles :

- Certificat médical
- Questionnaire santé
- Pass'Sport
- Autorisation parentale
- Photo

# Licences

Une licence est toujours liée à une saison.

Un adhérent peut posséder :

- aucune licence
- une licence FFGym
- une licence UFOLEP
- plusieurs licences sur une même saison

Informations :

- Saison
- Fédération
- Numéro de licence
- Date de création
- Date d'expiration
- Statut

---

# Présences

Pour chaque entraînement :

- Présent
- Absent
- Excusé

---

# Compétitions

Informations :

- Nom
- Date
- Lieu
- Fédération
- Participants
- Résultats

# Cautions

Informations :

- Montant
- Motif
- Date de dépôt
- Date de restitution
- Statut

---

# Boutique

Produits :

- T-shirts
- Vestes
- Shorts
- Gourdes
- Équipements du club

---

# Notifications

Types :

- Information
- Rappel
- Compétition
- Annulation de cours
- Événement club
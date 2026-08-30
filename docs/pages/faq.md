---
title: Aide
layout: home
nav_order: 8
lang: fr
translation_key: faq
permalink: /fr/pages/faq
---

# Aide / FAQ
{: .fs-9 }

Vous trouverez ci‑dessous une liste de questions fréquentes et/ou de problèmes courants, avec leurs solutions possibles.
{: .fs-5 .fw-300 }

### Est‑ce une vraie application, et si non pourquoi ?
Non, il ne s'agit pas d'une application distribuée sur l'App Store d'Apple. C'est un "app" ou script pour [Scriptable](https://scriptable.app/). Vous devez donc installer l'application Scriptable depuis l'App Store puis importer/installer le script fourni dans ce dépôt.

Pourquoi ce choix ? Parce que c'est plus simple à développer et à déployer de cette façon, et cela évite certaines contraintes imposées par l'App Store. Cette application utilise des API Hyundai et Kia non documentées ; cela rend la publication sur l'App Store plus compliquée et sujette à des restrictions.

### Le support Android est‑il prévu ?
Non, cette application est uniquement pour iOS et il n'est pas prévu pour l'instant de version Android. [Scriptable](https://scriptable.app/) n'existe que sur iOS ; l'équivalent Android le plus proche serait Tasker. Pour porter ceci sur Android, il faudrait développer une application native ou en React Native et la distribuer (probablement en sideload). Ce projet actuel ne couvre pas cela.

### Ai‑je besoin d'un abonnement Bluelink Kia / Hyundai pour utiliser l'application ?
Oui, en général. L'application utilise les mêmes API Hyundai/Kia que les applications officielles ; il est donc supposé que vous ayez un compte Bluelink actif et les droits nécessaires pour contrôler le véhicule depuis ces API.

### Mes identifiants Bluelink sont‑ils en sécurité si je les entre dans l'application ?
Oui. Toutes les configurations (y compris votre nom d'utilisateur, mot de passe et code PIN Bluelink) sont stockées localement dans le trousseau iOS (iOS keychain). Les identifiants ne sont exposés que si vous activez les logs de débogage (Debug Logging) et partagez ensuite ces logs. Faites attention aux logs avant de les partager.

### Quels pays / constructeurs sont pris en charge ?
Voir la page [Régions](/fr/pages/region) pour la liste des régions prises en charge et les limitations éventuelles.

### Les véhicules à moteur thermique (ICE) sont‑ils pris en charge ?
Pas pour l'instant. Cette application a été développée spécifiquement pour les véhicules électriques Hyundai / Kia basés sur la plateforme E‑GMP. Le support des véhicules à moteur thermique (ICE) a été demandé et pourra être envisagé, mais n'est pas encore implémenté. Si vous souhaitez le support ICE, veuillez ouvrir une issue sur GitHub pour en discuter.

### J'ai saisi mes identifiants de façon incorrecte et l'application ne s'ouvre plus / ne fait rien
Vous devrez réinitialiser la configuration stockée. Un script de "reset" est fourni dans les [releases GitHub](https://github.com/andyfase/egmp-bluelink-scriptable/releases). Téléchargez le fichier "egmp-reset.js" depuis les releases et exécutez‑le dans Scriptable pour effacer la configuration locale.

### J'ai trouvé un bug et j'aimerais qu'il soit corrigé
Veuillez ouvrir une [issue GitHub](https://github.com/andyfase/egmp-bluelink-scriptable/issues) et fournir toutes les informations concernant le problème rencontré (étapes pour reproduire, version utilisée, modèle de véhicule, région, etc.). Il est probable que des logs de débogage soient nécessaires pour diagnostiquer le problème — voir la question suivante.

### Comment activer et obtenir les logs de débogage ?
Assurez‑vous d'utiliser la version v1.2.0 (ou supérieure), car cette version facilite l'accès aux logs de débogage.

Une fois sur une version compatible, allez dans l'écran des paramètres de l'application et activez l'option "Debug logs". Lorsqu'elle est activée, chaque requête et réponse API envoyée par l'application est consignée dans les logs.

Exécutez ensuite les actions nécessaires pour reproduire le bug. Quand vous avez terminé, effectuez un triple‑appui sur l'icône des paramètres et choisissez "Share Debug Logs" (Partager les logs de débogage). Un écran de partage s'ouvrira vous permettant d'envoyer les logs (par e‑mail, message, etc.).

### Comment obtenir la liste complète des fichiers de logs en dehors de l'application ?
Les fichiers de logs sont stockés dans le dossier Scriptable sur iCloud Drive. Le fichier en cours d'utilisation s'appelle généralement egmp-bluelink.log. Les fichiers de logs sont automatiquement archivés/rotés avec un horodatage lorsque nécessaire.

Tous les fichiers de logs se trouvent dans le même répertoire Scriptable que les scripts. Attention : ces fichiers de logs peuvent contenir vos identifiants. Si on vous demande de fournir des logs, veillez à les vérifier et à supprimer ou masquer vos identifiants avant de les partager, ou ne les partagez qu'avec des personnes de confiance.

```
